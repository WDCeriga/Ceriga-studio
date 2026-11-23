-- Manufacturer matching is private to Ceriga administrators. Existing routing events
-- remain the assignment ledger and the existing assignment RPC performs the write.
begin;

create index if not exists matching_assignment_events_recent_idx
  on public.order_routing_events(created_at desc, order_id)
  where event_type='assigned' and manufacturer_id is not null;

insert into public.platform_settings(key, value) values (
  'manufacturer_matching', '{"windowDays":60,"similarityPoints":5,"workloadWeight":1,"paidWeight":1,"opportunityWeight":0.15,"outstandingWeight":0.25}'
) on conflict (key) do nothing;

create or replace function public.matching_token(input text)
returns text language sql immutable set search_path = '' as $$
  select coalesce($aliases${"regular":"regularfit","slim":"slimfit","relaxed":"relaxedfit","oversizedfit":"oversized","boxy":"boxyfit","crew":"crewneck","crewneckline":"crewneck","vneck":"vneck","dropped":"dropshoulder","droppedshoulder":"dropshoulder","setin":"setinsleeves","raglan":"raglansleeve","short":"shortsleeve","long":"longsleeve","threequarter":"threequartersleeve","jersey":"singlejersey","fleece":"brushedfleece","twill":"canvastwill","dtg":"directtogarment","dtgdirecttogarment":"directtogarment","dtf":"directtofilm","dtfdirecttofilm":"directtofilm","screenprint":"screenprinting","screen":"screenprinting","puffprint":"puffprinting","embroidery":"standardflatembroidery","heat":"heattransfer","cutsew":"cutandsew","hoodsingle":"singlelayerhood","hooddouble":"doublelayerhood","fullzip":"fullzipfront","halfzip":"halfzipfront"}$aliases$::jsonb->>token, token)
  from (select regexp_replace(replace(lower(normalize(coalesce(input,''), NFKD)), '&', 'and'), '[^a-z0-9]', '', 'g') token) keys;
$$;

create or replace function public.matching_serves_destination(destinations text[], destination text)
returns boolean language sql immutable set search_path = '' as $$
  with keys as (
    select regexp_replace(lower(normalize(coalesce(destination,''), NFKD)), '[^a-z0-9]', '', 'g') destination,
           regexp_replace(lower(normalize(region, NFKD)), '[^a-z0-9]', '', 'g') region
    from unnest(destinations) region
  ), normalized as (
    select region, upper(coalesce($countries${"morocco":"MA","tunisia":"TN","egypt":"EG","brazil":"BR","uk":"GB","gb":"GB","unitedkingdom":"GB","us":"US","usa":"US","unitedstates":"US","canada":"CA","australia":"AU","newzealand":"NZ","germany":"DE","france":"FR","portugal":"PT","italy":"IT","spain":"ES","netherlands":"NL","ireland":"IE","belgium":"BE","austria":"AT","denmark":"DK","finland":"FI","sweden":"SE","poland":"PL","czechia":"CZ","czechrepublic":"CZ","luxembourg":"LU","greece":"GR","romania":"RO","bulgaria":"BG","croatia":"HR","hungary":"HU","slovenia":"SI","slovakia":"SK","estonia":"EE","latvia":"LV","lithuania":"LT","cyprus":"CY","malta":"MT","turkey":"TR","india":"IN","china":"CN","vietnam":"VN","pakistan":"PK","bangladesh":"BD","japan":"JP","southkorea":"KR","unitedarabemirates":"AE","saudiarabia":"SA","qatar":"QA","oman":"OM","bahrain":"BH","kuwait":"KW","israel":"IL","jordan":"JO","lebanon":"LB","mexico":"MX"}$countries$::jsonb->>destination,destination)) country,
           upper(coalesce($countries${"morocco":"MA","tunisia":"TN","egypt":"EG","brazil":"BR","uk":"GB","gb":"GB","unitedkingdom":"GB","us":"US","usa":"US","unitedstates":"US","canada":"CA","australia":"AU","newzealand":"NZ","germany":"DE","france":"FR","portugal":"PT","italy":"IT","spain":"ES","netherlands":"NL","ireland":"IE","belgium":"BE","austria":"AT","denmark":"DK","finland":"FI","sweden":"SE","poland":"PL","czechia":"CZ","czechrepublic":"CZ","luxembourg":"LU","greece":"GR","romania":"RO","bulgaria":"BG","croatia":"HR","hungary":"HU","slovenia":"SI","slovakia":"SK","estonia":"EE","latvia":"LV","lithuania":"LT","cyprus":"CY","malta":"MT","turkey":"TR","india":"IN","china":"CN","vietnam":"VN","pakistan":"PK","bangladesh":"BD","japan":"JP","southkorea":"KR","unitedarabemirates":"AE","saudiarabia":"SA","qatar":"QA","oman":"OM","bahrain":"BH","kuwait":"KW","israel":"IL","jordan":"JO","lebanon":"LB","mexico":"MX"}$countries$::jsonb->>region,region)) direct
    from keys
  )
  select exists (select 1 from normalized where region='worldwide' or direct=country or
    case
      when region in ('eu','europeanunioneu') then country=any(array['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'])
      when region='northamerica' then country=any(array['US','CA','MX'])
      when region in ('northamericausandcanada','northamericauscanada') then country=any(array['US','CA'])
      when region in ('australiaandoceania','australiaoceania') then country=any(array['AU','NZ'])
      when region='middleeast' then country=any(array['AE','SA','QA','OM','BH','KW','IL','JO','LB'])
      when region in ('asiaandfareast','asiafareast') then country=any(array['IN','CN','VN','PK','BD','JP','KR','SG','MY','TH','ID','PH','TW'])
      else false
    end);
$$;

create or replace function public.matching_number(input text)
returns numeric language sql immutable set search_path = '' as $$
  select case when input ~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' then input::numeric end;
$$;

create or replace function public.matching_units(line jsonb)
returns numeric language sql immutable set search_path = '' as $$
  select coalesce(public.matching_number(line->>'targetTotal'),
    (select sum(public.matching_number(value)) from jsonb_each_text(
      case when jsonb_typeof(line->'bySize')='object' then line->'bySize' else '{}'::jsonb end)));
$$;

create or replace function public.matching_requirements(o public.orders, m public.manufacturer_profiles, s jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  spec jsonb := coalesce(o.specifications,'{}');
  garment_key text := public.calendar_garment_key(o.garment_type);
  detail jsonb;
  capabilities text[];
  required text[];
  styles text[];
  materials text[];
  regions text[];
  failures text[] := '{}';
  warnings text[] := '{}';
  reasons text[] := '{}';
  item text;
  run jsonb;
  units numeric;
  bulk_moq numeric;
  weight numeric := public.matching_number(spec->>'gsm');
  ceiling numeric := public.matching_number(s->>'maxSingleOrderQuantity');
  available numeric := public.matching_number(s->>'currentAvailableMonthlyCapacity');
  destination text := o.delivery_address->>'country';
  lead_days integer;
  run_lead integer;
  requested_days integer;
begin
  if m.status='paused' or not m.onboarding_complete then
    failures := array_append(failures, 'Factory is paused or has not completed onboarding');
  end if;
  if s->>'acceptingNewOrders'='false' then
    failures := array_append(failures, 'Factory is not accepting new orders');
  end if;
  if garment_key='' or not exists (select 1 from unnest(m.garments) g where public.calendar_garment_key(g)=garment_key) then
    failures := array_append(failures, 'Garment category is not offered');
  else
    reasons := array_append(reasons, 'Produces ' || o.garment_type);
  end if;
  if exists(select 1 from public.order_routing_events e where e.order_id=o.id and e.manufacturer_id=m.user_id
      and e.event_type in ('manufacturer_declined','admin_rejected','manufacturer_quotation_rejected'))
    or (o.assigned_manufacturer_id=m.user_id and o.factory_status='rejected') then
    failures := array_append(failures, 'Previously rejected for this order');
  end if;

  select value into detail from jsonb_each(coalesce(s->'garmentDetails','{}'))
    where public.calendar_garment_key(key)=garment_key order by key limit 1;
  capabilities := case when jsonb_typeof(s->'capabilitiesMap')='object' then
    array(select public.matching_token(key) from jsonb_each_text(s->'capabilitiesMap') where value in ('in_house','outsourced'))
    else array(select public.matching_token(value) from unnest(m.capabilities) value) end;
  required := array(select distinct value from jsonb_array_elements_text(coalesce(spec->'requiredCapabilities','[]')) value);
  foreach item in array required loop
    if not public.matching_token(item)=any(capabilities) then
      failures := array_append(failures, 'Decoration not offered: ' || item);
    else
      reasons := array_append(reasons, 'Supports ' || item);
    end if;
  end loop;

  if detail->>'confirmed' is distinct from 'true' then
    warnings := array_append(warnings, 'Confirm fabric and construction during quotation');
  else
    materials := array(select public.matching_token(value) from jsonb_array_elements_text(
      coalesce(detail->'materials','[]') || coalesce(detail->'customMaterials','[]')));
    if nullif(spec->>'fabricType','') is not null then
      if not public.matching_token(spec->>'fabricType')=any(materials) then
        failures := array_append(failures, 'Fabric not supported: ' || (spec->>'fabricType'));
      else
        reasons := array_append(reasons, 'Fabric: ' || (spec->>'fabricType'));
      end if;
    end if;
    if nullif(spec->>'gsm','') is not null then
      if weight is null or weight<=0 or weight<public.matching_number(detail->>'minGsm') or weight>public.matching_number(detail->>'maxGsm') then
        failures := array_append(failures, 'Fabric weight is outside the supported range');
      elsif public.matching_number(detail->>'minGsm') is null or public.matching_number(detail->>'maxGsm') is null then
        warnings := array_append(warnings, 'Confirm fabric weight range');
      end if;
    end if;
    styles := capabilities || array(select public.matching_token(value) from jsonb_array_elements_text(
      coalesce(detail->'styles','[]') || coalesce(detail->'customStyles','[]') ||
      coalesce(detail->'constructionDetails','[]') || coalesce(detail->'customConstructionDetails','[]')));
    for item in select value from jsonb_array_elements_text(
      jsonb_build_array(spec->'fit', spec->'neckType', spec->'sleeveType', spec->'sleeveLength')
      || coalesce(spec->'constructionDetails','[]')) where nullif(value,'') is not null
    loop
      if not public.matching_token(item)=any(styles) then
        failures := array_append(failures, 'Style or construction not confirmed: ' || item);
      else
        reasons := array_append(reasons, 'Supports ' || item);
      end if;
    end loop;
  end if;

  select public.matching_number(value) into bulk_moq from jsonb_each_text(coalesce(s->'garmentMoqOverrides','{}'))
    where public.calendar_garment_key(key)=garment_key and coalesce(s->'confirmedGarmentMoqOverrides','[]') ? key
    order by key limit 1;
  bulk_moq := coalesce(bulk_moq, public.matching_number(s->>'generalMoq'), nullif(m.moq,0));
  for run in select value from jsonb_array_elements(jsonb_build_array(o.order_quantities->'sample') || coalesce(o.order_quantities->'bulkRuns','[]'))
  loop
    units := public.matching_units(run);
    continue when units is null or units=0;
    if units<0 or trunc(units)<>units then
      failures := array_append(failures, 'Invalid order quantity');
    end if;
    reasons := array_append(reasons, initcap(run->>'kind') || ': ' || units || ' units checked');
    if units>ceiling then failures := array_append(failures, 'Exceeds single-order quantity limit'); end if;
    if units>coalesce(available,nullif(m.monthly_capacity,0)) then
      failures := array_append(failures, 'Exceeds recorded factory capacity');
    end if;
    if run->>'kind'='bulk' then
      if units<bulk_moq then failures := array_append(failures, 'Bulk quantity is below MOQ ' || bulk_moq);
      elsif bulk_moq is null then warnings := array_append(warnings, 'Confirm bulk MOQ');
      else reasons := array_append(reasons, 'Meets bulk MOQ ' || bulk_moq);
      end if;
    end if;
    for item in select value->>'method' from jsonb_array_elements(coalesce(s->'customMethodMoqs','[]'))
      where units<public.matching_number(value->>'moq') and exists (
        select 1 from unnest(required) r where public.matching_token(r)=public.matching_token(value->>'method'))
    loop
      failures := array_append(failures, 'Quantity is below the minimum for ' || item);
    end loop;
    run_lead := least(365, coalesce(public.matching_number(s->>(case when run->>'kind'='sample'
      then 'sampleLeadTimeMaxDays' else 'bulkLeadTimeMaxDays' end)), nullif(m.typical_lead_days,0)))::integer;
    if run_lead>0 then lead_days := greatest(lead_days,run_lead); end if;
  end loop;
  if not exists(select 1 from jsonb_array_elements(jsonb_build_array(o.order_quantities->'sample') || coalesce(o.order_quantities->'bulkRuns','[]')) r where public.matching_units(r)>0) then
    failures := array_append(failures, 'Sample or bulk quantities are not recorded');
  end if;
  regions := case when jsonb_typeof(s->'shippingDestinations')='array'
    then array(select jsonb_array_elements_text(s->'shippingDestinations')) else m.shipping_regions end;
  if nullif(destination,'') is not null then
    if cardinality(regions)>0 and not public.matching_serves_destination(regions,destination) then
      failures := array_append(failures, 'Delivery destination is not served');
    elsif coalesce(cardinality(regions),0)=0 then
      warnings := array_append(warnings, 'Confirm shipping coverage');
    else
      reasons := array_append(reasons, 'Ships to ' || destination);
    end if;
  end if;
  if lead_days is null then warnings := array_append(warnings, 'Production lead time is unknown'); end if;
  -- Upload-quote timelines are the only structured relative delivery requirement.
  -- A quotation due date is never treated as a customer delivery deadline.
  if o.quote_request->>'timeline' ~ '^[1-9][0-9]{0,2} (day|days|week|weeks|month|months)$' then
    requested_days := split_part(o.quote_request->>'timeline',' ',1)::integer *
      case when o.quote_request->>'timeline' like '%week%' then 7
        when o.quote_request->>'timeline' like '%month%' then 30 else 1 end;
    if lead_days>requested_days then
      failures := array_append(failures, 'Recorded production lead time exceeds the requested timeline');
    end if;
  end if;
  return jsonb_build_object('eligible',cardinality(failures)=0,'failures',failures,'warnings',warnings,
    'reasons',reasons,'leadDays',lead_days);
end;
$$;

-- Keep lifecycle facts in the existing, admin-protected routing ledger. The
-- quotation deadline is captured with the assignment so expiry survives reroutes.
create or replace function public.matching_capture_assignment_deadline()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.event_type='assigned' then
    new.details := new.details || jsonb_build_object('dueQuoteBy',
      (select due_quote_by from public.orders where id=new.order_id));
  end if;
  return new;
end;
$$;

drop trigger if exists matching_capture_assignment_deadline on public.order_routing_events;
create trigger matching_capture_assignment_deadline before insert on public.order_routing_events
for each row execute function public.matching_capture_assignment_deadline();

create or replace function public.matching_capture_milestones()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind <> 'production' or new.assigned_manufacturer_id is null then return new; end if;

  insert into public.order_routing_events(order_id, manufacturer_id, actor_id, event_type, created_at)
  select new.id, new.assigned_manufacturer_id, (select id from auth.users where id=auth.uid()), event, at
  from (values
    ('matching_quote_submitted', case when new.quoted_at is distinct from old.quoted_at then new.quoted_at end),
    ('matching_manufacturer_selected', case when new.production_released_at is distinct from old.production_released_at then new.production_released_at end),
    ('matching_payment_confirmed', case when new.payment_verified_at is distinct from old.payment_verified_at then new.payment_verified_at end),
    ('matching_production_started', case when new.production_released_at is distinct from old.production_released_at then new.production_released_at end),
    ('matching_order_completed', case when new.status='completed' and old.status<>'completed' then coalesce(new.completed_at,now()) end)
  ) milestones(event,at)
  where at is not null;
  return new;
end;
$$;

drop trigger if exists matching_capture_milestones on public.orders;
create trigger matching_capture_milestones after update on public.orders
for each row execute function public.matching_capture_milestones();

create or replace function public.matching_opportunities(p_since timestamptz, p_order uuid default null)
returns table(order_id uuid, manufacturer_id uuid, assigned_at timestamptz, due_on date,
  submitted_at timestamptz, declined_at timestamptz, expired_at timestamptz)
language sql stable set search_path = '' as $$
  with assignments as (
    select e.order_id,e.manufacturer_id,e.created_at assigned_at,
      case when e.details->>'dueQuoteBy' ~ '^\d{4}-\d{2}-\d{2}$' then (e.details->>'dueQuoteBy')::date
        when o.assigned_at=e.created_at and o.assigned_manufacturer_id=e.manufacturer_id then o.due_quote_by end due_on,
      lead(e.created_at) over(partition by e.order_id order by e.created_at,e.id) next_assignment
    from public.order_routing_events e
    join public.orders o on o.id=e.order_id
    where e.event_type='assigned' and e.manufacturer_id is not null
      and e.created_at>=p_since and (p_order is null or e.order_id=p_order)
  )
  select a.order_id,a.manufacturer_id,a.assigned_at,a.due_on,r.submitted_at,r.declined_at,
    case when deadline.at<=now() and coalesce(r.submitted_at,'infinity')>=deadline.at
      and coalesce(r.declined_at,'infinity')>=deadline.at
      and coalesce(a.next_assignment,'infinity')>=deadline.at then deadline.at end
  from assignments a
  cross join lateral (select ((a.due_on+1)::timestamp at time zone 'UTC') at) deadline
  cross join lateral (
    select min(e.created_at) filter(where e.event_type in ('quoted','matching_quote_submitted') or
             (e.event_type='updated' and e.details->>'factoryStatus'='quoted')) submitted_at,
           min(e.created_at) filter(where e.event_type='manufacturer_declined') declined_at
    from public.order_routing_events e
    where e.order_id=a.order_id and e.manufacturer_id=a.manufacturer_id and e.created_at>=a.assigned_at
      and e.created_at<coalesce(a.next_assignment,'infinity')
  ) r;
$$;

create or replace function public.admin_manufacturer_matching(p_order uuid, p_due date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  target public.orders%rowtype;
  settings jsonb;
  window_days integer;
  similarity numeric;
  since_at timestamptz;
  result jsonb;
begin
  if not public.is_superadmin() then raise exception 'Superadmin authorization required' using errcode='42501'; end if;
  select * into target from public.orders where id=p_order and kind='production';
  if not found then raise exception 'Production order not found'; end if;
  if p_due is null or p_due not between current_date and current_date+365 then
    raise exception 'Choose a quotation deadline within the next year';
  end if;
  select value into settings from public.platform_settings where key='manufacturer_matching';
  window_days := greatest(7,least(365,coalesce(public.matching_number(settings->>'windowDays'),60)))::integer;
  similarity := least(25,coalesce(public.matching_number(settings->>'similarityPoints'),5));
  since_at := now()-make_interval(days=>window_days);

  with matches as materialized (
    select m.user_id id,m.factory_name,m.monthly_capacity,m.calendar_workdays,m.calendar_timezone,
      coalesce(s.settings,'{}') config, public.matching_requirements(target,m,coalesce(s.settings,'{}')) match
    from public.manufacturer_profiles m left join public.manufacturer_customisation_settings s on s.user_id=m.user_id
    where m.status is distinct from 'paused' and m.onboarding_complete
  ), eligible as materialized (
    select *, (match->>'leadDays')::integer lead_days from matches where (match->>'eligible')::boolean
  ), production as materialized (
    select o.assigned_manufacturer_id id,o.id order_id,
      coalesce(public.matching_number(choice.value->>'totalUnits'),
        public.matching_units(saved.value),
        case when jsonb_array_length(coalesce(o.order_quantities->'bulkRuns','[]'))=0 then public.matching_units(o.order_quantities->'sample') end) units,
      coalesce(choice.value->>'kind',saved.value->>'kind',case when jsonb_array_length(coalesce(o.order_quantities->'bulkRuns','[]'))=0
        and public.matching_units(o.order_quantities->'sample')>0 then 'sample' end) kind,
      coalesce((coalesce(t.override_completion,case when not t.uncertain then t.expected_completion end) at time zone e.calendar_timezone)::date,
        progress.expected_completion,
        (o.production_released_at at time zone e.calendar_timezone)::date +
          case when public.matching_number(choice.value->>'leadTimeDays') between 1 and 365
            then (choice.value->>'leadTimeDays')::integer end) due_on
    from public.orders o join eligible e on e.id=o.assigned_manufacturer_id
    left join public.order_production_timelines t on t.order_id=o.id and t.manufacturer_id=e.id
    left join lateral (select u.expected_completion from public.order_production_updates u
      where u.order_id=o.id and u.manufacturer_id=e.id order by u.version desc limit 1) progress on true
    left join lateral (select value from jsonb_array_elements(coalesce(o.price_options,'[]'))
      where value->>'id'=o.selected_price_option_id limit 1) choice on true
    left join lateral (select value from jsonb_array_elements(
      jsonb_build_array(o.order_quantities->'sample') || coalesce(o.order_quantities->'bulkRuns','[]'))
      where value->>'id'=o.selected_price_option_id limit 1) saved on true
    where o.kind='production' and o.id<>p_order and o.status in ('paid','processing')
      and (o.production_released_at is not null or o.payment_verified_at is not null)
      and o.factory_status is distinct from 'rejected' and o.qc_status is distinct from 'approved'
  ), load as (
    select p.id,count(*) active,count(*) filter(where kind='sample') samples,
      count(*) filter(where kind='bulk') bulk, coalesce(sum(units),0) units,
      count(*) filter(where units is null or units<=0) unknown_units,
      count(*) filter(where due_on is null) unscheduled,
      count(*) filter(where due_on<=p_due+coalesce(e.lead_days,30)) competing_deadlines,
      count(*) filter(where exists(select 1 from public.manufacturer_availability a
        where a.manufacturer_id=p.id and a.status='approved' and p.due_on between a.starts_on and a.ends_on)) closure_deadlines
    from production p join eligible e using(id) group by p.id
  ), opportunities as (
    select a.manufacturer_id id,count(distinct a.order_id) opportunities,count(*) assignments,
      max(a.assigned_at) last_assignment,count(*) filter(where a.declined_at is not null) declines,
      count(*) filter(where a.expired_at is not null) expired,
      count(*) filter(where a.submitted_at is not null and a.due_on is not null) observed,
      count(*) filter(where (a.submitted_at at time zone 'UTC')::date<=a.due_on) on_time
    from public.matching_opportunities(since_at) a join eligible e on e.id=a.manufacturer_id
    where a.order_id<>p_order group by a.manufacturer_id
  ), paid as (
    select o.assigned_manufacturer_id id,count(*) paid
    from public.orders o join eligible e on e.id=o.assigned_manufacturer_id
    where o.id<>p_order and o.kind='production' and o.payment_verified_at>=since_at
    group by o.assigned_manufacturer_id
  ), outstanding as (
    select o.assigned_manufacturer_id id,count(*) outstanding
    from public.orders o join eligible e on e.id=o.assigned_manufacturer_id
    where o.id<>p_order and o.kind='production' and o.status in ('submitted','awaiting_payment')
      and o.factory_status in ('new','reviewing','clarifying') and o.quoted_at is null
      and (o.due_quote_by is null or o.due_quote_by>=current_date)
    group by o.assigned_manufacturer_id
  ), facts as (
    select e.*,coalesce(l.active,0) active,coalesce(l.samples,0) samples,coalesce(l.bulk,0) bulk,
      coalesce(l.units,0) units,coalesce(l.unknown_units,0) unknown_units,coalesce(l.unscheduled,0) unscheduled,
      coalesce(l.competing_deadlines,0) competing_deadlines,coalesce(l.closure_deadlines,0) closure_deadlines,
      coalesce(a.opportunities,0) opportunities,coalesce(a.assignments,0) assignments,a.last_assignment,
      coalesce(a.declines,0) declines,coalesce(a.expired,0) expired,coalesce(p.paid,0) paid,
      coalesce(q.outstanding,0) outstanding,
      case when a.observed>=3 then a.on_time::numeric/a.observed end reliability,
      days.quote_days,days.closed_days,days.nominal_days,days.working_days,
      public.matching_number(e.config->>'currentAvailableMonthlyCapacity') declared_available,
      (select max(public.matching_units(r)) from jsonb_array_elements(
        jsonb_build_array(target.order_quantities->'sample') || coalesce(target.order_quantities->'bulkRuns','[]')) r) requested_units
    from eligible e left join load l using(id) left join opportunities a using(id)
      left join paid p using(id) left join outstanding q using(id)
    cross join lateral (
      select count(*) filter(where calendar_day<=p_due and is_open) quote_days,
        count(*) filter(where calendar_day>p_due and closed) closed_days,
        count(*) filter(where calendar_day>p_due and scheduled) nominal_days,
        count(*) filter(where calendar_day>p_due and scheduled and not closed) working_days
      from (
        select d::date calendar_day,extract(isodow from d)::integer=any(e.calendar_workdays) scheduled,
          b.closed, not b.closed and (e.calendar_workdays is null or extract(isodow from d)::integer=any(e.calendar_workdays)) is_open
        from generate_series(current_date::timestamp,(p_due+coalesce(e.lead_days,30))::timestamp,'1 day') d
        cross join lateral (
          select exists(select 1 from public.manufacturer_availability a
            where a.manufacturer_id=e.id and a.status='approved' and d::date between a.starts_on and a.ends_on)
          or (coalesce(e.config->>'unavailableUntil','') ~ '^\d{4}-\d{2}-\d{2}$'
              and to_char(d,'YYYY-MM-DD')<=e.config->>'unavailableUntil') closed
        ) b
      ) calendar
    ) days
  ), scored as (
    select *,
      case when declared_available is not null then declared_available
        when monthly_capacity>0 and unknown_units=0 and unscheduled=0 and nominal_days>0
        then greatest(0,round(monthly_capacity * working_days / nominal_days::numeric - units)) end available_units,
      -- Suitability differences are points out of 100. Fairness only sorts
      -- within a band; it cannot outrank a materially better delivery fit.
      greatest(0,100 - (case when quote_days=0 then 30 else 0 end)
        - least(20,closed_days*2) - least(12,closure_deadlines*4)
        - case when lead_days is null then 8 else least(20,lead_days/3.0) end
        - case when reliability is null then 0 else 20*(1-reliability) end
        - 2*jsonb_array_length(match->'warnings')) suitability
    from facts
  ), bands as (
    select *,case when similarity=0 then max(suitability) over()-suitability
      else ceil(greatest(0,max(suitability) over()-suitability-similarity)/similarity) end band,
      coalesce(public.matching_number(settings->>'workloadWeight'),1) *
        (active + competing_deadlines + case when monthly_capacity>0 then units/monthly_capacity
          else ln(1+units)/ln(2)/10 end
          + case when available_units is not null and requested_units>available_units then 1 else 0 end)
      + coalesce(public.matching_number(settings->>'paidWeight'),1)*paid
      + coalesce(public.matching_number(settings->>'opportunityWeight'),0.15)*opportunities
      + coalesce(public.matching_number(settings->>'outstandingWeight'),0.25)*outstanding fairness
    from scored
  ), ranked as (
    select *,row_number() over(order by band,fairness,suitability desc,assignments,last_assignment nulls first,md5(p_order::text||id::text)) rank
    from bands
  )
  select jsonb_build_object('windowDays',window_days,'candidates',coalesce((
    select jsonb_agg(row_json order by rank nulls last,name,id) from (
      select id,factory_name name,rank,
        match || jsonb_build_object('id',id,'name',factory_name,'rank',rank,'comparable',band=0,
          'active',active,'samples',samples,'bulk',bulk,'units',units,'unknownUnits',unknown_units,'unscheduled',unscheduled,
          'capacity',available_units,'capacitySource',case when declared_available is not null then 'reported'
            when available_units is not null then 'estimated' else 'unknown' end,
          'capacityShortfall',coalesce(requested_units>available_units,false),
          'opportunities',opportunities,'paid',paid,'outstanding',outstanding,'declines',declines,'expired',expired,
          'assignments',assignments,'lastAssignment',last_assignment,'competingDeadlines',competing_deadlines,
          'closureDeadlines',closure_deadlines,'closedDays',closed_days,'quoteConflict',quote_days=0,
          'reliability',round(100*reliability),
          'reason',case when rank=1 and exists(select 1 from ranked r where r.rank=2 and r.band=0 and r.fairness>ranked.fairness)
            then 'Lower combined workload and recent assignments among similarly suitable factories'
            when rank=1 and exists(select 1 from ranked r where r.rank=2 and r.band=0 and r.suitability=ranked.suitability)
            then 'Comparable suitability and workload; assignment history and rotation break ties'
            when rank=1 then 'Best fit for the saved requirements and delivery signals'
            when band=0 then 'Comparable capability and delivery fit'
            else 'Eligible, with weaker delivery or capability evidence' end) row_json
      from ranked
      union all
      select id,factory_name,null,match||jsonb_build_object('id',id,'name',factory_name)
      from matches where not (match->>'eligible')::boolean
    ) candidates
  ),'[]'::jsonb)) into result;
  return result;
end;
$$;

create or replace function public.admin_manufacturer_assignment_history(p_order uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_superadmin() then raise exception 'Superadmin authorization required' using errcode='42501'; end if;
  with events as (
    select e.id::text id,e.manufacturer_id,e.event_type,e.created_at at,e.details
    from public.order_routing_events e where e.order_id=p_order and e.manufacturer_id is not null
      and e.event_type in ('assigned','manufacturer_declined','admin_rejected','manufacturer_quotation_rejected','offer_published',
        'matching_quote_submitted','matching_manufacturer_selected','matching_payment_confirmed','matching_production_started','matching_order_completed')
    union all
    select 'expiry:'||a.assigned_at,a.manufacturer_id,'request_expired',a.expired_at,'{}'
    from public.matching_opportunities('-infinity',p_order) a where a.expired_at is not null
    union all
    select 'legacy:'||event,o.assigned_manufacturer_id,event,at,'{}'
    from public.orders o
    cross join lateral (values ('matching_quote_submitted',o.quoted_at),
      ('matching_manufacturer_selected',o.production_released_at),('matching_payment_confirmed',o.payment_verified_at),
      ('matching_production_started',o.production_released_at),('matching_order_completed',o.completed_at)) facts(event,at)
    where o.id=p_order and o.assigned_manufacturer_id is not null and at is not null
      and not exists(select 1 from public.order_routing_events e where e.order_id=o.id and e.event_type=event)
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'event',e.event_type,'at',e.at,
    'manufacturerId',e.manufacturer_id,'factory',coalesce(m.factory_name,'Former manufacturer'),
    'dueQuoteBy',e.details->>'dueQuoteBy','overrideReason',e.details->>'overrideReason')
    order by e.at desc,e.id),'[]') into result
  from events e left join public.manufacturer_profiles m on m.user_id=e.manufacturer_id;
  return result;
end;
$$;

create or replace function public.admin_assign_matched_manufacturer(
  p_order uuid, p_manufacturer uuid, p_due date, p_override_reason text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target public.orders%rowtype;
  factory public.manufacturer_profiles%rowtype;
  settings jsonb;
  requirements jsonb;
  event_id uuid;
  result uuid;
begin
  if not public.is_superadmin() then raise exception 'Superadmin authorization required' using errcode='42501'; end if;
  if length(coalesce(p_override_reason,''))>500 then raise exception 'Use at most 500 characters for the override reason'; end if;
  select * into target from public.orders where id=p_order and kind='production' for update;
  if not found then raise exception 'Production order not found'; end if;
  select * into factory from public.manufacturer_profiles where user_id=p_manufacturer;
  if not found then raise exception 'Manufacturer not found'; end if;
  select s.settings into settings from public.manufacturer_customisation_settings s where s.user_id=p_manufacturer;
  requirements := public.matching_requirements(target,factory,coalesce(settings,'{}'));
  if not (requirements->>'eligible')::boolean then
    raise exception '%', array_to_string(array(select jsonb_array_elements_text(requirements->'failures')), '; ');
  end if;
  result := public.assign_order_manufacturer(p_order,p_manufacturer,p_due);
  select id into event_id from public.order_routing_events where order_id=p_order and manufacturer_id=p_manufacturer
    and event_type='assigned' and created_at=now() order by id desc limit 1;
  if event_id is null then
    insert into public.order_routing_events(order_id,manufacturer_id,actor_id,event_type)
      values(p_order,p_manufacturer,auth.uid(),'assigned') returning id into event_id;
  end if;
  if nullif(btrim(p_override_reason),'') is not null then
    update public.order_routing_events set details=details||jsonb_build_object('overrideReason',btrim(p_override_reason))
      where id=event_id;
  end if;
  return result;
end;
$$;

revoke all on function public.matching_token(text),public.matching_number(text),public.matching_units(jsonb),
  public.matching_serves_destination(text[],text),public.matching_requirements(public.orders,public.manufacturer_profiles,jsonb),
  public.matching_capture_assignment_deadline(),public.matching_capture_milestones(),public.matching_opportunities(timestamptz,uuid)
  from public,anon,authenticated;
revoke all on function public.admin_manufacturer_matching(uuid,date),public.admin_manufacturer_assignment_history(uuid),
  public.admin_assign_matched_manufacturer(uuid,uuid,date,text) from public,anon;
grant execute on function public.admin_manufacturer_matching(uuid,date),public.admin_manufacturer_assignment_history(uuid),
  public.admin_assign_matched_manufacturer(uuid,uuid,date,text) to authenticated;

notify pgrst, 'reload schema';

commit;
