-- R07: include independent comparison enquiries in outstanding workload.
-- Does not change mandatory eligibility, paid-order metrics or suitability weights.
begin;
create index if not exists order_factory_quotes_pending_workload_idx
  on public.order_factory_quotes(factory_id,due_on,order_id) where status='pending';
CREATE OR REPLACE FUNCTION public.rank_manufacturers_for_order(p_order uuid, p_due date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target public.orders%rowtype;
  settings jsonb;
  window_days integer;
  similarity numeric;
  since_at timestamptz;
  result jsonb;
begin

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
  ), outstanding_requests as (
    -- Enquiries are not paid production. UNION also avoids counting an order
    -- twice if a selected comparison overlaps the ordinary assigned record.
    select o.assigned_manufacturer_id id,o.id order_id
    from public.orders o join eligible e on e.id=o.assigned_manufacturer_id
    where o.id<>p_order and o.kind='production' and o.status in ('submitted','awaiting_payment')
      and o.factory_status in ('new','reviewing','clarifying') and o.quoted_at is null
      and (o.due_quote_by is null or o.due_quote_by>=current_date)
    union
    select q.factory_id id,q.order_id
    from public.order_factory_quotes q
      join public.orders o on o.id=q.order_id
      join eligible e on e.id=q.factory_id
    where q.order_id<>p_order and q.status='pending' and q.due_on>=current_date
      and o.kind='production' and o.status in ('submitted','awaiting_payment')
      and o.offer_issued_at is null
  ), outstanding as (
    select id,count(*) outstanding from outstanding_requests group by id
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
$function$
;
revoke all on function public.rank_manufacturers_for_order(uuid,date) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
