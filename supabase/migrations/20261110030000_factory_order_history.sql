begin;

create table if not exists public.factory_customer_references (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturer_profiles(user_id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  code text generated always as ('C-' || upper(left(replace(id::text, '-', ''), 12))) stored unique,
  unique (manufacturer_id, customer_id)
);

create table if not exists public.order_product_history (
  order_id uuid primary key references public.orders(id) on delete cascade,
  product_id uuid not null default gen_random_uuid(),
  source_order_id uuid references public.order_product_history(order_id) on delete set null,
  source_version integer,
  uses_approved_sample boolean not null default false,
  approved_version integer,
  approved_at timestamptz,
  check ((approved_version is null) = (approved_at is null))
);
create index if not exists order_product_history_product_idx on public.order_product_history(product_id, order_id);
create index if not exists order_product_history_source_idx on public.order_product_history(source_order_id);

create table if not exists public.order_specification_versions (
  order_id uuid not null references public.order_product_history(order_id) on delete cascade,
  version integer not null check (version > 0),
  specification jsonb not null,
  source_specification jsonb,
  source_files jsonb,
  captured_at timestamptz not null default now(),
  primary key (order_id, version)
);

create table if not exists public.factory_order_memory (
  manufacturer_id uuid not null references public.manufacturer_profiles(user_id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  nickname text not null default '' check (length(nickname) <= 80),
  primary key (manufacturer_id, order_id)
);

create index if not exists factory_order_history_scope_idx on public.orders(assigned_manufacturer_id, created_at desc, id) where kind = 'production';
create index if not exists factory_order_history_customer_idx on public.orders(assigned_manufacturer_id, user_id, created_at desc, id) where kind = 'production';
create index if not exists factory_order_memory_order_idx on public.factory_order_memory(order_id);

-- The existing helper grants superadmin access to every application table.
select public.apply_superadmin_access();

create or replace function public.order_history_option(o public.orders) returns jsonb
language sql immutable set search_path = public as $$
  select value from jsonb_array_elements(case when jsonb_typeof(o.price_options) = 'array' then o.price_options else '[]' end)
  where value->>'id' = o.selected_price_option_id limit 1
$$;

create or replace function public.order_history_run_kind(o public.orders) returns text
language sql immutable set search_path = public as $$
  select coalesce(public.order_history_option(o)->>'kind',
    case
      when jsonb_typeof(o.order_quantities->'bulkRuns') = 'array' and jsonb_array_length(o.order_quantities->'bulkRuns') > 0 then
        case when exists (select 1 from jsonb_each_text(case when jsonb_typeof(o.order_quantities->'sample'->'bySize') = 'object' then o.order_quantities->'sample'->'bySize' else '{}' end) where value ~ '^[1-9][0-9]*$') then 'options' else 'bulk' end
      when jsonb_typeof(o.order_quantities->'sample') = 'object' then 'sample'
      else 'unclassified'
    end)
$$;

create or replace function public.order_history_specification(o public.orders) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'fabric', o.specifications->'fabricType', 'gsm', o.specifications->'gsm',
    'colour', coalesce(o.specifications->'colorName', o.specifications->'color'),
    'colourCode', o.specifications->'color', 'colourways', o.specifications->'colours', 'fit', o.specifications->'fit',
    'measurements', o.specifications->'measurements', 'sizing', o.specifications->'sizing',
    'construction', o.specifications->'constructionDetails', 'neckline', o.specifications->'neckType',
    'sleeveStyle', o.specifications->'sleeveType', 'sleeveLength', o.specifications->'sleeveLength',
    'materials', o.specifications->'materials', 'decoration', coalesce(o.specifications->'decoration',o.specifications->'requiredCapabilities'),
    'artworkRevision', o.specifications->'artworkRevision', 'techPackVersion', o.specifications->'techPackVersion',
    'quantity', coalesce(public.order_history_option(o)->'totalUnits',
      case when public.order_history_run_kind(o)='bulk' and jsonb_array_length(o.order_quantities->'bulkRuns')=1 then o.order_quantities->'bulkRuns'->0->'targetTotal'
           when public.order_history_run_kind(o)='sample' and jsonb_typeof(o.order_quantities->'sample'->'bySize')='object' then (select to_jsonb(sum(value::numeric)) from jsonb_each_text(o.order_quantities->'sample'->'bySize') where value ~ '^[0-9]{1,12}$') end), 'quantityPlan', o.order_quantities
  ))
$$;

create or replace function public.capture_order_history() returns trigger
language plpgsql security definer set search_path = public as $$
declare recorded jsonb; latest public.order_specification_versions%rowtype;
begin
  if new.kind <> 'production' then return new; end if;
  if new.assigned_manufacturer_id is not null then
    insert into public.factory_customer_references(manufacturer_id, customer_id)
    select new.assigned_manufacturer_id, new.user_id
    where exists (select 1 from public.manufacturer_profiles where user_id = new.assigned_manufacturer_id)
    on conflict (manufacturer_id, customer_id) do nothing;
  end if;
  insert into public.order_product_history(order_id) values (new.id) on conflict do nothing;
  recorded := public.order_history_specification(new);
  select * into latest from public.order_specification_versions where order_id = new.id order by version desc limit 1;
  if latest.specification is distinct from recorded or latest.source_specification is distinct from new.specifications
      or latest.source_files is distinct from new.quote_request->'storagePaths' then
    insert into public.order_specification_versions(order_id, version, specification, source_specification, source_files)
    values (new.id, coalesce(latest.version, 0) + 1, recorded, new.specifications, new.quote_request->'storagePaths');
  end if;
  return new;
end
$$;

insert into public.factory_customer_references(manufacturer_id, customer_id)
select distinct o.assigned_manufacturer_id, o.user_id from public.orders o
join public.manufacturer_profiles m on m.user_id = o.assigned_manufacturer_id
where o.kind = 'production'
on conflict (manufacturer_id, customer_id) do nothing;

insert into public.order_product_history(order_id)
select id from public.orders where kind = 'production'
on conflict do nothing;

insert into public.order_specification_versions(order_id, version, specification, source_specification, source_files)
select o.id, 1, public.order_history_specification(o), o.specifications, o.quote_request->'storagePaths' from public.orders o
where o.kind = 'production' and not exists (select 1 from public.order_specification_versions v where v.order_id = o.id)
on conflict do nothing;

drop trigger if exists capture_order_history on public.orders;
create trigger capture_order_history after insert or update of assigned_manufacturer_id, specifications, order_quantities, price_options, selected_price_option_id, quote_request
on public.orders for each row execute function public.capture_order_history();

create or replace function public.customer_approve_history_sample(p_order uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; selected_version integer;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid() for update;
  if not found or o.kind <> 'production' or o.status <> 'completed' or o.qc_status is distinct from 'approved'
     or (public.order_history_option(o)->>'kind') is distinct from 'sample' then
    raise exception 'Only your completed, quality-approved sample can be approved';
  end if;
  select approved_version into selected_version from public.order_product_history where order_id = p_order;
  if selected_version is null then
    select max(version) into selected_version from public.order_specification_versions where order_id = p_order;
    if selected_version is null then raise exception 'This sample has no recorded specifications'; end if;
    update public.order_product_history set approved_version = selected_version, approved_at = now() where order_id = p_order;
  end if;
  return selected_version;
end
$$;

create or replace function public.customer_order_sample_approval(p_order uuid) returns integer
language sql stable security definer set search_path = public as $$
  select h.approved_version from public.order_product_history h join public.orders o on o.id=h.order_id
  where h.order_id=p_order and o.user_id=auth.uid()
$$;
revoke all on function public.customer_order_sample_approval(uuid) from public,anon;
grant execute on function public.customer_order_sample_approval(uuid) to authenticated;

create or replace function public.customer_create_linked_order(p_input jsonb, p_source uuid, p_use_approved_sample boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare source public.orders%rowtype; lineage public.order_product_history%rowtype; baseline_version integer; created jsonb; approval jsonb;
begin
  select * into source from public.orders where id = p_source and user_id = auth.uid() and kind = 'production' for share;
  if not found or p_input->>'kind' is distinct from 'production' then raise exception 'Choose one of your production orders'; end if;
  select * into lineage from public.order_product_history where order_id = p_source;
  if not found then raise exception 'Product history is unavailable'; end if;
  if p_use_approved_sample then
    baseline_version := lineage.approved_version;
    if baseline_version is null then raise exception 'Approve this sample before using it for bulk'; end if;
    if jsonb_typeof(p_input->'order_quantities'->'bulkRuns') is distinct from 'array'
       or jsonb_array_length(p_input->'order_quantities'->'bulkRuns') = 0
       or exists(select 1 from jsonb_each_text(case when jsonb_typeof(p_input->'order_quantities'->'sample'->'bySize')='object' then p_input->'order_quantities'->'sample'->'bySize' else '{}' end) where value ~ '^[1-9][0-9]*$') then
      raise exception 'Provide a bulk quantity for the approved sample';
    end if;
    select source_specification into approval from public.order_specification_versions where order_id = p_source and version = baseline_version;
    if not found then raise exception 'The approved sample version is unavailable'; end if;
    p_input := p_input || jsonb_build_object('specifications',approval);
  else
    select max(version) into baseline_version from public.order_specification_versions where order_id = p_source;
  end if;
  p_input := p_input || jsonb_build_object('garment_type',source.garment_type,'product_id',source.product_id);
  created := public.create_customer_order(p_input);
  update public.order_product_history
  set product_id = lineage.product_id, source_order_id = p_source, source_version = baseline_version, uses_approved_sample = coalesce(p_use_approved_sample,false)
  where order_id = (created->>'id')::uuid;
  return created;
end
$$;

create or replace function public.guard_linked_sample_specifications() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.specifications is distinct from new.specifications
     and exists(select 1 from public.order_product_history where order_id = old.id and uses_approved_sample) then
    raise exception 'This bulk order uses an approved sample. Create a modified repeat to change its specifications';
  end if;
  return new;
end
$$;
revoke all on function public.guard_linked_sample_specifications() from public, anon, authenticated;
drop trigger if exists guard_linked_sample_specifications on public.orders;
create trigger guard_linked_sample_specifications before update of specifications on public.orders
for each row execute function public.guard_linked_sample_specifications();

revoke all on function public.order_history_option(public.orders), public.order_history_run_kind(public.orders),
  public.order_history_specification(public.orders), public.capture_order_history() from public, anon, authenticated;
revoke all on function public.customer_approve_history_sample(uuid), public.customer_create_linked_order(jsonb, uuid, boolean) from public, anon;
grant execute on function public.customer_approve_history_sample(uuid), public.customer_create_linked_order(jsonb, uuid, boolean) to authenticated;

create or replace function public.factory_safe_order_title(p_title text, p_garment text, p_customer uuid, p_contact text, p_email text)
returns text language sql stable security definer set search_path = public as $history$
  select case when p_title ~* '(@|https?://|[+]?[0-9][0-9 ()-]{8,}[0-9])'
    or exists (
      select 1 from public.profiles p
      cross join lateral unnest(array[p.full_name, p.email, p_contact, p_email, p_customer::text]) as identity(value)
      where p.id = p_customer and length(btrim(identity.value)) >= 3 and position(lower(btrim(identity.value)) in lower(p_title)) > 0
    ) then coalesce(nullif(p_garment,''),'Garment') else p_title end
$history$;

create or replace function public.factory_safe_specification(p_value jsonb, p_customer uuid, p_contact text, p_email text, p_depth integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare clean jsonb;
begin
  if p_depth > 10 then return null; end if;
  case jsonb_typeof(p_value)
    when 'object' then
      select jsonb_object_agg(key,public.factory_safe_specification(value,p_customer,p_contact,p_email,p_depth+1))
      into clean from jsonb_each(p_value)
      where key !~* '(customer|brand|email|phone|address|account|fingerprint|(^|_)user(_|id|$)|url|path|filename|storage|(^|_)contact(_|$))'
        and public.factory_safe_order_title(key,'',p_customer,p_contact,p_email) = key;
      return jsonb_strip_nulls(coalesce(clean,'{}'));
    when 'array' then
      select jsonb_agg(public.factory_safe_specification(value,p_customer,p_contact,p_email,p_depth+1) order by n)
      into clean from jsonb_array_elements(p_value) with ordinality a(value,n);
      return coalesce(clean,'[]');
    when 'string' then
      return case when public.factory_safe_order_title(p_value#>>'{}','',p_customer,p_contact,p_email) = p_value#>>'{}' then p_value end;
    else return p_value;
  end case;
end
$$;
revoke all on function public.factory_safe_specification(jsonb,uuid,text,text,integer) from public,anon,authenticated;

-- Factory APIs return an explicit projection. Private customer keys never enter JSON.
create or replace function public.factory_history_rows(p_factory uuid)
returns table(order_id uuid, customer_code text, product_reference text, title text, garment text,
  created_at timestamptz, assigned_at timestamptz, due_date date, quote_due date, status text,
  factory_status text, qc_status text, released boolean, stage text, order_group text, run_type text,
  units text, fabric text, gsm text, colour text, nickname text, previous_order uuid,
  prior_count bigint, last_order timestamptz, is_returning boolean, approved boolean, delayed boolean,
  action_required boolean)
language sql stable security definer set search_path = public as $$
  with scoped as materialized (
    select o.*, c.code, h.product_id as history_product, h.source_order_id, h.source_version, h.approved_at,
      m.nickname, public.order_history_run_kind(o) as run_kind
    from public.orders o
    join public.factory_customer_references c on c.manufacturer_id = p_factory and c.customer_id = o.user_id
    join public.order_product_history h on h.order_id = o.id
    left join public.factory_order_memory m on m.order_id = o.id and m.manufacturer_id = p_factory
    where o.kind = 'production' and o.assigned_manufacturer_id = p_factory and public.factory_order_visible(o.id)
  ), stats as (
    select s.*, count(*) over prior as previous_count, max(s.created_at) over prior as previous_date,
      min(case when s.status in ('completed','ready') then coalesce(s.completed_at, s.updated_at) end) over (partition by s.user_id) as first_fulfilled,
      min(s.created_at) filter (where s.run_kind = 'bulk' and (s.production_released_at is not null or s.status = 'completed')) over (partition by s.history_product) as first_bulk
    from scoped s
    window prior as (partition by s.user_id order by s.created_at, s.id rows between unbounded preceding and 1 preceding)
  )
  select s.id, s.code, 'P-' || upper(left(md5(s.code || s.history_product::text), 12)),
    public.factory_safe_order_title(s.product_name, s.garment_type, s.user_id, s.contact_name, s.contact_email),
    s.garment_type, s.created_at, s.assigned_at,
    coalesce(plan.expected_completion::date, progress.expected_completion, case when s.status in ('submitted','awaiting_payment') then s.due_quote_by end),
    s.due_quote_by, s.status, s.factory_status, s.qc_status, s.production_released_at is not null,
    case when s.status in ('paid','processing') and s.production_released_at is not null then public.production_stage_key(coalesce(progress.stage,'preparation')) end,
    case
      when s.status in ('completed','ready') or s.factory_status = 'completed' then 'completed'
      when s.status = 'shipping' then 'delivery'
      when s.factory_status = 'rejected' then 'declined'
      when s.status in ('paid','processing') and s.production_released_at is not null then
        case when s.qc_status = 'approved' then 'delivery' when s.qc_status in ('changes_required','pending_review') then 'quality' else 'production' end
      else 'quotation'
    end,
    case when s.run_kind = 'sample' and previous.run_kind = 'sample' then 'sample_revision'
         when s.run_kind = 'bulk' and s.first_bulk < s.created_at then
           case when exists (select 1 from public.order_specification_versions v
             cross join lateral jsonb_each(v.specification - 'quantityPlan') as prior(key,value)
             where v.order_id = previous.id and v.version = s.source_version
               and prior.value not in ('""'::jsonb,'null'::jsonb) and current_spec.value->prior.key not in ('""'::jsonb,'null'::jsonb)
               and current_spec.value->prior.key <> prior.value) then 'modified_repeat' else 'repeat_bulk' end
         else s.run_kind end,
    coalesce(selected.value->>'totalUnits',
      case when s.run_kind='bulk' and jsonb_typeof(s.order_quantities->'bulkRuns')='array' and jsonb_array_length(s.order_quantities->'bulkRuns')=1 then s.order_quantities->'bulkRuns'->0->>'targetTotal' end,
      case when s.run_kind='sample' then s.order_quantities->'sample'->>'targetTotal' end,
      case when s.run_kind = 'sample' then (select sum(value::numeric)::text from jsonb_each_text(case when jsonb_typeof(s.order_quantities->'sample'->'bySize')='object' then s.order_quantities->'sample'->'bySize' else '{}' end) where value ~ '^[0-9]{1,12}$') end,
      case when s.quote_request->>'quantity' ~ '^[0-9]{1,12}$' then s.quote_request->>'quantity' end),
    nullif(public.factory_safe_order_title(s.specifications->>'fabricType','',s.user_id,s.contact_name,s.contact_email),'Garment'),
    case when s.specifications->>'gsm' ~ '^[0-9]{1,4}$' then s.specifications->>'gsm' end,
    nullif(public.factory_safe_order_title(coalesce(s.specifications->>'colorName',s.specifications->>'color'),'',s.user_id,s.contact_name,s.contact_email),'Garment'),
    s.nickname, previous.id, s.previous_count, s.previous_date, coalesce(s.first_fulfilled < s.created_at, false), s.approved_at is not null,
    coalesce(s.status = 'processing' and (nullif(progress.delay_reason,'') is not null or coalesce(plan.expected_completion::date,progress.expected_completion) < current_date), false)
      or coalesce(s.status in ('submitted','awaiting_payment') and s.due_quote_by < current_date and coalesce(s.factory_status,'new') in ('new','reviewing','clarifying'), false),
    coalesce((s.status in ('submitted','awaiting_payment') and coalesce(s.factory_status,'new') in ('new','reviewing','clarifying') and public.factory_has_permission(p_factory,'quote'))
       or (s.status = 'processing' and s.production_released_at is not null and
         ((s.qc_status = 'changes_required' and public.factory_has_permission(p_factory,'qc')) or
          (s.qc_status = 'approved' and public.factory_has_permission(p_factory,'shipping')))), false)
  from stats s
  left join scoped previous on previous.id = s.source_order_id
  left join lateral (select v.specification as value from public.order_specification_versions v where v.order_id = s.id order by v.version desc limit 1) current_spec on previous.id is not null
  left join public.order_production_timelines plan on plan.order_id = s.id and plan.manufacturer_id = p_factory
  left join lateral (select stage, expected_completion, delay_reason from public.order_production_updates
    where order_id = s.id and manufacturer_id = p_factory order by version desc limit 1) progress on true
  left join lateral (select value from jsonb_array_elements(case when jsonb_typeof(s.price_options) = 'array' then s.price_options else '[]' end)
    where value->>'id' = s.selected_price_option_id limit 1) selected on true
$$;

create or replace function public.factory_order_history_list(
  p_search text default '', p_group text default 'all', p_customer text default null,
  p_customer_type text default 'all', p_run_type text default 'all', p_status text default 'all',
  p_due_before date default null, p_sort text default 'newest', p_page integer default 1
) returns jsonb language plpgsql security definer set search_path = public as $$
declare f uuid := public.current_factory_id(); result jsonb;
begin
  if not public.factory_has_permission(f, 'view_orders') then raise exception 'Order access denied'; end if;
  if p_customer is not null and not exists (
    select 1 from public.factory_customer_references c join public.orders o on o.user_id = c.customer_id and o.assigned_manufacturer_id = f
    where c.code = p_customer and c.manufacturer_id = f and o.kind = 'production' and public.factory_order_visible(o.id)
  ) then raise exception 'Client history unavailable'; end if;
  if p_customer is not null and p_page = 1 and p_search = '' and p_group = 'all' and p_status = 'all' and p_run_type = 'all' then
    insert into public.manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id)
    select f,auth.uid(),'read_client_history',id from public.factory_customer_references where manufacturer_id=f and code=p_customer;
  end if;
  with rows as materialized (
    select * from public.factory_history_rows(f) r where p_customer is null or r.customer_code = p_customer
  ), filtered as materialized (
    select r.* from rows r
    where (p_group = 'all' or r.order_group = p_group)
      and (p_customer_type = 'all' or r.is_returning = (p_customer_type = 'returning'))
      and (p_run_type = 'all' or r.run_type = p_run_type
        or (p_run_type = 'sample' and r.run_type = 'sample_revision')
        or (p_run_type = 'bulk' and r.run_type in ('repeat_bulk','modified_repeat'))
        or (p_run_type = 'repeat_bulk' and r.run_type = 'modified_repeat'))
      and (p_status = 'all' or (p_status = 'active' and r.order_group not in ('completed','declined'))
        or (p_status = 'completed' and r.order_group = 'completed') or (p_status = 'delayed' and r.delayed)
        or (p_status = 'action' and r.action_required))
      and (p_due_before is null or r.due_date <= p_due_before)
      and not exists (
        select 1 from regexp_split_to_table(lower(btrim(left(coalesce(p_search,''),150))), '[[:space:]]+') as terms(term)
        where strpos(lower(concat_ws(' ', r.order_id, 'ORD-' || left(r.order_id::text,8), r.title, r.customer_code,
          r.product_reference, r.garment, r.fabric, r.gsm, 'GSM', r.colour, r.units, r.nickname,
          r.stage, replace(r.stage,'_',' '), case when r.stage = 'cutting_sewing' then 'Cutting & Sewing' when r.stage = 'preparation' then 'Preparations' end,
          r.status, r.order_group, r.previous_order, 'ORD-' || left(r.previous_order::text,8))), terms.term) = 0
      )
  ), paginated as (
    select r.*, row_number() over (order by
      case when p_sort = 'priority' then r.delayed end desc nulls last,
      case when p_sort = 'priority' then r.action_required end desc nulls last,
      case when p_sort in ('due','priority') then r.due_date end asc nulls last,
      case when p_sort = 'oldest' then r.created_at end asc,
      r.created_at desc, r.order_id) as sort_row
    from filtered r
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(p) - 'sort_row' order by p.sort_row) from paginated p
      where p.sort_row > (greatest(1,coalesce(p_page,1))::bigint - 1) * 24 and p.sort_row <= greatest(1,coalesce(p_page,1))::bigint * 24), '[]'),
    'total', (select count(*) from filtered),
    'products', case when p_customer is not null then
      (select coalesce(jsonb_agg(to_jsonb(products) order by created_at desc, product_reference),'[]') from (
        select product_reference, title, garment, created_at from (
          select distinct on(product_reference) product_reference,title,garment,created_at
          from rows where order_group = 'completed' order by product_reference,created_at desc,order_id
        ) latest order by created_at desc,product_reference limit 24
      ) products)
      else '[]'::jsonb end,
    'counts', (select jsonb_build_object('all',count(*),'quotation',count(*) filter (where order_group='quotation'),
      'production',count(*) filter (where order_group='production'),'quality',count(*) filter (where order_group='quality'),
      'delivery',count(*) filter (where order_group='delivery'),'completed',count(*) filter (where order_group='completed'),
      'declined',count(*) filter (where order_group='declined'),'active',count(*) filter (where order_group not in ('completed','declined')),
      'samples',count(*) filter (where run_type in ('sample','sample_revision')),'bulk',count(*) filter (where run_type in ('bulk','repeat_bulk','modified_repeat')),
      'products',count(distinct product_reference),'lastOrder',max(created_at),'returning',coalesce(bool_or(is_returning),false)) from rows)
  ) into result;
  return result;
end
$$;

create or replace function public.factory_order_history_detail(p_order uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f uuid := public.current_factory_id(); item record; h public.order_product_history%rowtype;
  current_spec public.order_specification_versions%rowtype; previous_spec public.order_specification_versions%rowtype;
  raw public.orders%rowtype; previous_raw public.orders%rowtype; shown jsonb; baseline jsonb; art_change text;
begin
  if not public.factory_order_visible(p_order) then raise exception 'Order history unavailable'; end if;
  select * into item from public.factory_history_rows(f) where order_id = p_order;
  if not found then raise exception 'Order history unavailable'; end if;
  select * into h from public.order_product_history where order_id = p_order;
  select * into raw from public.orders where id = p_order;
  select * into current_spec from public.order_specification_versions where order_id = p_order
    and (h.approved_version is null or version = h.approved_version) order by version desc limit 1;
  if item.previous_order is not null then
    select * into previous_raw from public.orders where id = item.previous_order;
    select * into previous_spec from public.order_specification_versions
      where order_id = item.previous_order and version = h.source_version;
  end if;
  shown := public.factory_safe_specification(current_spec.specification,raw.user_id,raw.contact_name,raw.contact_email);
  baseline := public.factory_safe_specification(previous_spec.specification,previous_raw.user_id,previous_raw.contact_name,previous_raw.contact_email);
  if current_spec.source_specification->>'artworkFingerprint' ~ '^[a-f0-9]{64}$'
    and previous_spec.source_specification->>'artworkFingerprint' ~ '^[a-f0-9]{64}$' then
    art_change := case when current_spec.source_specification->>'artworkFingerprint' = previous_spec.source_specification->>'artworkFingerprint'
      then 'Unchanged' else 'Changed' end;
  end if;
  if h.uses_approved_sample and jsonb_typeof(previous_spec.source_files) = 'array' and jsonb_array_length(previous_spec.source_files) > 0
    and (current_spec.source_files is null or current_spec.source_files = '[]'::jsonb) then
    shown := shown || jsonb_build_object('supportingFiles','Approved sample v' || previous_spec.version);
    baseline := baseline || jsonb_build_object('supportingFiles','Approved sample v' || previous_spec.version);
  end if;
  insert into public.manufacturer_team_audit(manufacturer_id, actor_id, action, subject_id)
    values (f, auth.uid(), 'read_order_history', p_order);
  return jsonb_build_object(
    'order', to_jsonb(item), 'specification', shown, 'version', current_spec.version,
    'capturedAt', current_spec.captured_at, 'previousSpecification', baseline,
    'previousVersion', previous_spec.version, 'artworkComparison', art_change,
    'versions', (select coalesce(jsonb_agg(jsonb_build_object('version',v.version,'capturedAt',v.captured_at,
      'specification',public.factory_safe_specification(v.specification,raw.user_id,raw.contact_name,raw.contact_email))
      order by v.version desc),'[]') from (
        select * from public.order_specification_versions where order_id = p_order order by version desc limit 25
    ) v),
    'timeline', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.order_id),'[]') from (
      select * from public.factory_history_rows(f) r where r.product_reference = item.product_reference order by r.created_at desc,r.order_id limit 100
    ) t),
    'productionNotes', (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc),'[]') from (
      select u.order_id, u.stage, u.note, u.delay_reason, u.expected_completion, u.created_at
      from public.order_production_updates u
      join public.order_product_history ph on ph.order_id = u.order_id
      where ph.product_id = h.product_id and u.manufacturer_id = f and public.factory_order_visible(u.order_id)
      order by (u.order_id = p_order) desc, u.created_at desc limit 50
    ) n),
    'quality', (select coalesce(jsonb_agg(to_jsonb(q) order by q.submitted_at desc),'[]') from (
      select i.order_id, i.result, i.qc_status, i.notes, i.review_note, i.submitted_at,
        (select coalesce(jsonb_agg(jsonb_build_object('problem',d.title,'resolution',d.resolution,'status',d.status)),'[]')
          from public.qc_defects d where d.inspection_id = i.id) as issues
      from public.qc_inspections i join public.order_product_history ph on ph.order_id = i.order_id
      where ph.product_id = h.product_id and i.manufacturer_id = f and i.submitted_at is not null and public.factory_order_visible(i.order_id)
      order by (i.order_id = p_order) desc, i.submitted_at desc limit 30
    ) q)
  );
end
$$;

create or replace function public.factory_save_order_nickname(p_order uuid, p_nickname text) returns text
language plpgsql security definer set search_path = public as $$
declare f uuid := public.current_factory_id(); nickname_value text := btrim(coalesce(p_nickname,''));
begin
  if not public.factory_order_visible(p_order) then raise exception 'Order history unavailable'; end if;
  if length(nickname_value) > 80 then raise exception 'Use up to 80 characters'; end if;
  insert into public.factory_order_memory(manufacturer_id,order_id,nickname) values(f,p_order,nickname_value)
    on conflict (manufacturer_id,order_id) do update set nickname = excluded.nickname;
  insert into public.manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id)
    values(f,auth.uid(),'change_order_nickname',p_order);
  return nickname_value;
end
$$;

revoke all on function public.factory_history_rows(uuid), public.factory_safe_order_title(text,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.factory_order_history_list(text,text,text,text,text,text,date,text,integer),
  public.factory_order_history_detail(uuid), public.factory_save_order_nickname(uuid,text) from public,anon;
grant execute on function public.factory_order_history_list(text,text,text,text,text,text,date,text,integer),
  public.factory_order_history_detail(uuid), public.factory_save_order_nickname(uuid,text) to authenticated;

create table if not exists public.factory_order_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  manufacturer_id uuid not null references public.manufacturer_profiles(user_id) on delete cascade,
  storage_path text not null,
  purpose text not null check (purpose in ('quotation','production')),
  unique(order_id, manufacturer_id, storage_path)
);
create index if not exists factory_order_documents_factory_idx on public.factory_order_documents(manufacturer_id,order_id);
select public.apply_superadmin_access();

create or replace function public.admin_share_factory_order_document(p_order uuid, p_index integer, p_purpose text, p_from_sample boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; object_path text; expected_order uuid;
begin
  if not public.is_superadmin() then raise exception 'Superadmin authorisation required'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found or o.assigned_manufacturer_id is null then raise exception 'Assign a factory first'; end if;
  if p_index is null or p_index < 0 then raise exception 'Choose a supporting file'; end if;
  if p_from_sample then
    select h.source_order_id, v.source_files->>p_index into expected_order,object_path
    from public.order_product_history h join public.order_specification_versions v on v.order_id=h.source_order_id and v.version=h.source_version
    where h.order_id=p_order and h.uses_approved_sample;
  else expected_order := o.id; object_path := o.quote_request->'storagePaths'->>p_index;
  end if;
  if object_path is null or split_part(object_path,'/',1) <> o.user_id::text or split_part(object_path,'/',2) is distinct from expected_order::text then
    raise exception 'The file does not belong to this order';
  end if;
  if p_purpose is null then
    delete from public.factory_order_documents where order_id = p_order and manufacturer_id = o.assigned_manufacturer_id and storage_path = object_path;
  else
    if not exists(select 1 from storage.objects where bucket_id='order-uploads' and name=object_path) then raise exception 'The supporting file is unavailable'; end if;
    insert into public.factory_order_documents(order_id,manufacturer_id,storage_path,purpose)
    values(p_order,o.assigned_manufacturer_id,object_path,p_purpose)
    on conflict(order_id,manufacturer_id,storage_path) do update set purpose = excluded.purpose;
  end if;
  insert into public.manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id,details)
  values(o.assigned_manufacturer_id,auth.uid(),'change_order_document_access',p_order,jsonb_build_object('index',p_index,'purpose',p_purpose));
end
$$;

create or replace function public.factory_order_documents_list(p_order uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'purpose',d.purpose) order by d.id),'[]')
  from public.factory_order_documents d join public.orders o on o.id = d.order_id
  where d.order_id = p_order and d.manufacturer_id = o.assigned_manufacturer_id
    and public.factory_order_visible(o.id) and d.manufacturer_id = public.current_factory_id()
    and ((o.quote_request->'storagePaths') ? d.storage_path or exists(
      select 1 from public.order_product_history h join public.order_specification_versions v on v.order_id=h.source_order_id and v.version=h.source_version
      where h.order_id=o.id and h.uses_approved_sample and v.source_files ? d.storage_path
    ))
    and ((d.purpose = 'quotation' and public.factory_has_permission(d.manufacturer_id,'quote'))
      or (o.production_released_at is not null and
        (public.factory_has_permission(d.manufacturer_id,'production') or public.factory_has_permission(d.manufacturer_id,'qc'))))
$$;

create or replace function public.factory_authorize_order_document(p_order uuid, p_document uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare f uuid := public.current_factory_id();
begin
  if not exists(select 1 from jsonb_array_elements(public.factory_order_documents_list(p_order)) where value->>'id' = p_document::text) then
    raise exception 'File access denied';
  end if;
  insert into public.manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id,details)
  values(f,auth.uid(),'read_order_document',p_order,jsonb_build_object('document',p_document));
  return f;
end
$$;

revoke all on function public.admin_share_factory_order_document(uuid,integer,text,boolean), public.factory_order_documents_list(uuid),
  public.factory_authorize_order_document(uuid,uuid) from public,anon;
grant execute on function public.admin_share_factory_order_document(uuid,integer,text,boolean), public.factory_order_documents_list(uuid),
  public.factory_authorize_order_document(uuid,uuid) to authenticated;
grant select on public.factory_order_documents to service_role;

drop policy if exists order_uploads_read_assigned_factory on storage.objects;
drop policy if exists team_order_files_read on storage.objects;

create or replace function public.account_order_projection(p_order public.orders) returns public.orders
language plpgsql stable security definer set search_path=public as $$
declare result public.orders%rowtype; factory boolean;
begin
  if auth.uid() is null then raise exception 'Sign in to view orders'; end if;
  if not(public.is_superadmin() or p_order.user_id=auth.uid() or public.factory_order_visible(p_order.id)) then
    raise exception 'Order access denied';
  end if;
  result := p_order;
  if public.is_superadmin() then return result; end if;
  factory := public.factory_order_visible(p_order.id) and p_order.user_id <> auth.uid();
  result.ops_notes := null;
  result.price_options := public.public_price_options(p_order.price_options,coalesce(factory,false));
  if factory then
    result.paid_amount_cents := null; result.total := null; result.paid_currency := null; result.total_currency := null;
    if not public.factory_has_permission(p_order.assigned_manufacturer_id,'view_financial') then
      result.manufacturer_quote := null;
      select jsonb_agg(jsonb_build_object('id',x->'id','kind',x->'kind','label',x->'label','totalUnits',x->'totalUnits','leadTimeDays',x->'leadTimeDays'))
      into result.price_options from jsonb_array_elements(coalesce(p_order.price_options,'[]')) x;
    end if;
    result.specifications := public.factory_safe_specification(p_order.specifications,p_order.user_id,p_order.contact_name,p_order.contact_email);
    result.order_quantities := public.factory_safe_specification(p_order.order_quantities,p_order.user_id,p_order.contact_name,p_order.contact_email);
    result.user_id := null; result.product_id := null; result.contact_name := null; result.contact_email := null; result.contact_phone := null;
    result.delivery_confirmed_by := null; result.delivery_confirmation_note := null;
    result.product_name := public.factory_safe_order_title(p_order.product_name,p_order.garment_type,p_order.user_id,p_order.contact_name,p_order.contact_email);
    result.quote_request := jsonb_strip_nulls(jsonb_build_object(
      'quantity',case when p_order.quote_request->>'quantity' ~ '^[0-9]{1,12}$' then p_order.quote_request->'quantity' end,
      'timeline',case when p_order.quote_request->>'timeline' ~ '^[0-9]{1,3} (day|days|week|weeks|month|months)$' then p_order.quote_request->'timeline' end));
    if p_order.delivery_address is not null then
      if p_order.production_released_at is not null and p_order.qc_status='approved'
        and public.factory_has_permission(p_order.assigned_manufacturer_id,'shipping') then
        result.delivery_address := p_order.delivery_address - array['firstName','lastName','email','phone','instructions'];
      else result.delivery_address := jsonb_strip_nulls(jsonb_build_object('country',p_order.delivery_address->'country'));
      end if;
    end if;
  else
    result.manufacturer_quote := null; result.factory_reject_reason := null;
  end if;
  return result;
end
$$;

-- Approved files are part of the pinned sample version. Only Ceriga can
-- replace or remove those objects after approval.
create or replace function public.customer_approved_sample_file(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select split_part(p_path,'/',1) = auth.uid()::text and exists (
    select 1 from public.order_product_history h
    join public.order_specification_versions v on v.order_id = h.order_id and v.version = h.approved_version
    where h.order_id::text = split_part(p_path,'/',2) and v.source_files ? p_path
  )
$$;
revoke all on function public.customer_approved_sample_file(text) from public,anon;
grant execute on function public.customer_approved_sample_file(text) to authenticated;
drop policy if exists preserve_approved_sample_file_update on storage.objects;
create policy preserve_approved_sample_file_update on storage.objects as restrictive for update to authenticated
using (bucket_id <> 'order-uploads' or public.is_superadmin() or not public.customer_approved_sample_file(name))
with check (bucket_id <> 'order-uploads' or public.is_superadmin() or not public.customer_approved_sample_file(name));
drop policy if exists preserve_approved_sample_file_delete on storage.objects;
create policy preserve_approved_sample_file_delete on storage.objects as restrictive for delete to authenticated
using (bucket_id <> 'order-uploads' or public.is_superadmin() or not public.customer_approved_sample_file(name));

create or replace function public.admin_factory_order_share_options(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_superadmin() then raise exception 'Superadmin authorisation required'; end if;
  select jsonb_build_object('assigned',o.assigned_manufacturer_id is not null,
    'documents', (select coalesce(jsonb_agg(jsonb_build_object(
      'path',x.path,'name',case when x.pinned then 'Approved sample file ' || x.n else coalesce(o.quote_request->'fileNames'->>(x.n::integer-1),'File ' || x.n) end,
      'pinned',x.pinned,'index',x.n-1,'purpose',d.purpose) order by x.pinned,x.n),'[]')
      from (
        select path,n,false as pinned from jsonb_array_elements_text(case when jsonb_typeof(o.quote_request->'storagePaths')='array' then o.quote_request->'storagePaths' else '[]' end) with ordinality a(path,n)
        union all
        select a.path,a.n,true from public.order_product_history h
        join public.order_specification_versions v on v.order_id=h.source_order_id and v.version=h.source_version
        cross join lateral jsonb_array_elements_text(case when jsonb_typeof(v.source_files)='array' then v.source_files else '[]' end) with ordinality a(path,n)
        where h.order_id=p_order and h.uses_approved_sample
      ) x left join public.factory_order_documents d on d.order_id=p_order and d.manufacturer_id=o.assigned_manufacturer_id and d.storage_path=x.path))
  into result from public.orders o where o.id=p_order;
  return result;
end
$$;
revoke all on function public.admin_factory_order_share_options(uuid) from public,anon;
grant execute on function public.admin_factory_order_share_options(uuid) to authenticated;

-- Redact the brand at source, including dashboard search and activity payloads.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.team_impl_portal_dashboard(boolean,integer,text,text,text)'::regprocedure) into definition;
  definition := replace(definition, 'coalesce(nullif(b.full_name,''''),''Brand account'')as brand_name',
    'case when p_admin then coalesce(nullif(b.full_name,''''),''Brand account'') else coalesce(c.code,''Client'') end as brand_name');
  definition := replace(definition, 'from accessible o left join public.profiles b',
    'from accessible o left join public.factory_customer_references c on c.manufacturer_id=o.assigned_manufacturer_id and c.customer_id=o.user_id left join public.profiles b');
  if position(' as safe_title' in definition) = 0 then
    definition := replace(definition, 'select o.*,case when p_admin then coalesce(nullif(b.full_name',
      'select o.*,case when p_admin then o.product_name else public.factory_safe_order_title(o.product_name,o.garment_type,o.user_id,o.contact_name,o.contact_email) end as safe_title,case when p_admin then coalesce(nullif(b.full_name');
    definition := replace(definition, 'select id,product_name,garment_type,brand_name', 'select id,safe_title as product_name,garment_type,brand_name');
    definition := replace(definition, 'o.product_name,o.brand_name', 'o.safe_title as product_name,o.brand_name');
    definition := replace(definition, 'id::text,product_name,garment_type,brand_name', 'id::text,safe_title,garment_type,brand_name');
    definition := replace(definition, '''product'',product_name,''brand''', '''product'',safe_title,''brand''');
  end if;
  execute definition;
end
$$;

-- Calendar and fulfilment keep their existing schedule and stage data.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.calendar_order_facts(uuid)'::regprocedure) into definition;
  definition := replace(definition, 'o.assigned_manufacturer_id,o.product_name,o.garment_type,',
    'o.assigned_manufacturer_id,case when public.is_superadmin() then o.product_name else public.factory_safe_order_title(o.product_name,o.garment_type,o.user_id,o.contact_name,o.contact_email) end,o.garment_type,');
  execute definition;
  select pg_get_functiondef('public.factory_fulfilment_board(text,text,integer)'::regprocedure) into definition;
  definition := replace(definition, 'o.product_name as name',
    'public.factory_safe_order_title(o.product_name,o.garment_type,o.user_id,o.contact_name,o.contact_email) as name');
  execute definition;
end
$$;

notify pgrst, 'reload schema';
commit;
