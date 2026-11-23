begin;
create table if not exists public.order_factory_quotes (
  order_id uuid not null references public.orders(id) on delete cascade,
  factory_id uuid not null references public.manufacturer_profiles(user_id),
  requested_at timestamptz not null default now(),
  due_on date not null,
  status text not null default 'pending' check(status in ('pending','submitted','declined','selected','not_selected')),
  tiers jsonb not null default '[]' check(jsonb_typeof(tiers)='array'),
  submitted_at timestamptz,
  valid_until timestamptz,
  comments text not null default '' check(length(comments)<=2000),
  selection_reason text check(length(selection_reason)<=500),
  primary key(order_id,factory_id)
);
create unique index if not exists order_factory_quote_one_winner on public.order_factory_quotes(order_id) where status='selected';
create index if not exists order_factory_quote_inbox on public.order_factory_quotes(factory_id,due_on);
alter table public.order_factory_quotes enable row level security;
grant select,insert,update,delete on public.order_factory_quotes to authenticated;
do $$declare d text; begin
  select pg_get_functiondef('public.apply_superadmin_access()'::regprocedure) into d;
  if strpos(d,'''order_factory_quotes''')=0 then
    execute replace(d,'''projects''','''order_factory_quotes'',''projects''');
  end if;
  perform public.apply_superadmin_access();
end$$;

create or replace function public.admin_request_factory_comparison(p_order uuid,p_first uuid,p_second uuid,p_due date,p_second_due date)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; f uuid; deadline date; candidate jsonb;
begin
  if not public.is_superadmin() then raise exception 'Superadmin authorization required'; end if;
  if p_first is null or p_second is null or p_first=p_second then raise exception 'Choose two different manufacturers'; end if;
  select * into o from public.orders where id=p_order for update;
  if not found or o.kind<>'production' or o.status not in ('submitted','awaiting_payment') or
     o.offer_issued_at is not null or o.production_released_at is not null or o.payment_verified_at is not null or
     o.manufacturer_quote is not null or exists(select 1 from public.order_factory_quotes where order_id=p_order)
  then raise exception 'Comparison is available before a factory has submitted a quotation'; end if;
  for f,deadline in select * from (values (p_first,p_due),(p_second,p_second_due)) t
  loop
    select value into candidate from jsonb_array_elements(public.rank_manufacturers_for_order(p_order,deadline)->'candidates')
      where value->>'id'=f::text;
    if not coalesce((candidate->>'eligible')::boolean,false) then raise exception 'Both manufacturers must be eligible'; end if;
    perform public.check_factory_assignment(p_order,f,deadline);
  end loop;
  -- Clear a previously routed single request so only the isolated quote endpoints see the order.
  perform set_config('app.comparison_write',p_order::text,true);
  if o.assigned_manufacturer_id is not null then
    perform set_config('app.routing_write',p_order::text,true);
    perform set_config('app.workflow_write',p_order::text,true);
    perform set_config('app.routing_action','comparison_requested',true);
    update public.orders set assigned_manufacturer_id=null,assigned_at=null,due_quote_by=null,
      factory_status=null,factory_reject_reason=null,status_label='Comparing manufacturer quotations' where id=p_order;
  else
    update public.orders set status_label='Comparing manufacturer quotations' where id=p_order;
  end if;
  perform set_config('app.comparison_write','',true);
  for f,deadline in select * from (values (p_first,p_due),(p_second,p_second_due)) t
  loop
    insert into public.order_factory_quotes(order_id,factory_id,due_on) values(p_order,f,deadline);
    insert into public.order_routing_events(order_id,manufacturer_id,actor_id,event_type,details)
      values(p_order,f,auth.uid(),'assigned',jsonb_build_object('dueQuoteBy',deadline,'comparison',true));
    -- No order ID on the notification because general order access remains restricted.
    perform public.notify_manufacturer(f,'order','Quotation requested','Ceriga has requested a quotation. Open your quotation queue.','/manufacturer/quotations/'||p_order,null);
  end loop;
  return p_order;
end;
$$;

create or replace function public.comparison_quote_line(line jsonb)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('id',line->'id','kind',line->'kind','targetTotal',line->'targetTotal','bySize',
    (select coalesce(jsonb_object_agg(key,public.matching_number(value)),'{}')
     from jsonb_each_text(case when jsonb_typeof(line->'bySize')='object' then line->'bySize' else '{}' end)
     where key in ('xs','s','m','l','xl','xxl') and public.matching_number(value) is not null));
$$;
revoke all on function public.comparison_quote_line(jsonb) from public,anon,authenticated;

create or replace function public.factory_comparison_requests(p_order uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f uuid:=public.current_factory_id();
begin
  if f is null or not public.factory_has_permission(f,'quote') or not public.factory_has_permission(f,'view_orders')
    then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',o.id,'kind','production','status','submitted','status_label','Quotation requested',
    'product_name',public.factory_safe_order_title(o.product_name,o.garment_type,o.user_id,o.contact_name,o.contact_email),
    'garment_type',o.garment_type,'created_at',q.requested_at,'assigned_manufacturer_id',f,
    'due_quote_by',q.due_on,'factory_status',case q.status when 'pending' then 'new' else 'quoted' end,
    'quoted_at',q.submitted_at,'manufacturer_quote',q.tiers,'delivery_address',jsonb_build_object('country',o.delivery_address->>'country'),
    'specifications',public.factory_safe_specification(o.specifications,o.user_id,o.contact_name,o.contact_email),
    'order_quantities',jsonb_build_object('mode',o.order_quantities->'mode','sample',
      public.comparison_quote_line(o.order_quantities->'sample'),'bulkRuns',
      (select coalesce(jsonb_agg(public.comparison_quote_line(value)),'[]')
       from jsonb_array_elements(coalesce(o.order_quantities->'bulkRuns','[]')))),
    'quote_request',jsonb_build_object('quantity',case when o.quote_request->>'quantity' ~ '^[0-9]{1,12}$' then o.quote_request->>'quantity' end,
      'timeline',case when o.quote_request->>'timeline' ~ '^[0-9]{1,3} (day|days|week|weeks|month|months)$' then o.quote_request->>'timeline' end)
    ) order by q.due_on,q.requested_at) from public.order_factory_quotes q join public.orders o on o.id=q.order_id
    where q.factory_id=f and (p_order is null or p_order=o.id) and q.status in ('pending','submitted','selected')
      and (q.status<>'pending' or q.due_on>=current_date) and o.offer_issued_at is null),'[]'::jsonb);
end;
$$;

create or replace function public.factory_respond_comparison(p_order uuid,p_tiers jsonb,p_comments text,p_decline boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare f uuid:=public.current_factory_id(); q public.order_factory_quotes; o public.orders;
  required jsonb; line jsonb; tier jsonb; shipping jsonb; result jsonb:='[]'; units numeric; price numeric; days numeric; currency text;
begin
  if f is null or not public.factory_has_permission(f,'quote') or not public.factory_has_permission(f,'view_orders') then raise exception 'Quotation access denied'; end if;
  select * into o from public.orders where id=p_order for update;
  select * into q from public.order_factory_quotes where order_id=p_order and factory_id=f for update;
  if not found or q.status not in ('pending','submitted') or q.due_on<current_date or o.offer_issued_at is not null
    then raise exception 'This quotation request is unavailable or expired'; end if;
  if length(coalesce(p_comments,''))>2000 then raise exception 'Use at most 2,000 characters'; end if;
  if p_decline then
    if length(trim(coalesce(p_comments,'')))<3 then raise exception 'Enter a reason'; end if;
    update public.order_factory_quotes set status='declined',comments=trim(p_comments) where order_id=p_order and factory_id=f;
    insert into public.order_routing_events(order_id,manufacturer_id,actor_id,event_type) values(p_order,f,auth.uid(),'manufacturer_declined');
  else
    select coalesce(q.tiers->0->>'currency',p.preferred_currency) into currency from public.profiles p where id=f;
    required := (select jsonb_agg(value) from jsonb_array_elements(jsonb_build_array(o.order_quantities->'sample')||
      coalesce(o.order_quantities->'bulkRuns','[]')) where public.matching_units(value)>0);
    if required is null or jsonb_typeof(p_tiers) is distinct from 'array' or jsonb_array_length(p_tiers)<>jsonb_array_length(required)
      or (select count(distinct value->>'id') from jsonb_array_elements(p_tiers))<>jsonb_array_length(required)
      then raise exception 'Quote every customer quantity option'; end if;
    for line in select value from jsonb_array_elements(required) loop
      select value into tier from jsonb_array_elements(p_tiers) where value->>'id'=line->>'id';
      units:=public.matching_units(line); price:=public.matching_number(tier->>'unitPriceCents'); days:=public.matching_number(tier->>'leadTimeDays');
      if currency is null or currency not in ('GBP','USD','EUR') or tier->>'currency' is distinct from currency
        or price is null or price<1 or trunc(price)<>price or units<>trunc(units) or units>100000000
        or price*units>100000000000 or days is null or days<1 or days>3650 or trunc(days)<>days
        then raise exception 'Each option requires a valid unit price and lead time'; end if;
      shipping:=public.freight_validate(tier->'shipping');
      if (shipping->>'validUntil')::date<current_date then raise exception 'Shipping quotation expired'; end if;
      result:=result||jsonb_build_array(jsonb_build_object('id',line->>'id','kind',line->>'kind',
        'label',case when line->>'kind'='sample' then 'Samples' else 'Bulk · '||units||' units' end,
        'totalUnits',units,'unitPriceCents',price,'manufacturerQuoteCents',price*units,'currency',currency,
        'leadTimeDays',days,'shipping',shipping));
    end loop;
    update public.order_factory_quotes set status='submitted',tiers=result,submitted_at=now(),
      valid_until=least(now()+interval '30 days',(select min(((value->'shipping'->>'validUntil')::date+1)::timestamp at time zone 'UTC')
        from jsonb_array_elements(result))),comments=trim(coalesce(p_comments,''))
      where order_id=p_order and factory_id=f;
    insert into public.order_routing_events(order_id,manufacturer_id,actor_id,event_type) values(p_order,f,auth.uid(),'matching_quote_submitted');
  end if;
  perform public.notify_superadmin('pricing','Manufacturer responded to comparison','Review the quotation comparison in Production review.',
    '/superadmin/assignment?view=pricing&order='||p_order,p_order);
  return p_order;
end;
$$;

create or replace function public.admin_factory_comparisons()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_superadmin() then raise exception 'Superadmin authorization required'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'orderId',q.order_id,'factoryId',q.factory_id,'factory',m.factory_name,
    'status',case when q.status='pending' and q.due_on<current_date
      or q.status in ('submitted','selected') and q.valid_until<=now() then 'expired' else q.status end,
    'dueOn',q.due_on,'validUntil',q.valid_until,'tiers',q.tiers,'comments',q.comments,'reason',q.selection_reason,
    'eligibility',public.matching_requirements(o,m,coalesce(s.settings,'{}')),
    'workload',(select count(*) from public.orders a where a.assigned_manufacturer_id=q.factory_id and
      a.kind='production' and a.status in ('paid','processing') and
      (a.payment_verified_at is not null or a.production_released_at is not null) and
      a.factory_status is distinct from 'rejected' and a.qc_status is distinct from 'approved')
  ) order by q.requested_at,q.factory_id)
  from public.order_factory_quotes q join public.orders o on o.id=q.order_id
    join public.manufacturer_profiles m on m.user_id=q.factory_id
    left join public.manufacturer_customisation_settings s on s.user_id=q.factory_id
    where o.offer_issued_at is null),'[]'::jsonb);
end;
$$;

create or replace function public.admin_select_factory_quote(p_order uuid,p_factory uuid,p_reason text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; q public.order_factory_quotes; m public.manufacturer_profiles; settings jsonb;
begin
  if not public.is_superadmin() then raise exception 'Superadmin authorization required'; end if;
  if length(coalesce(p_reason,''))>500 then raise exception 'Use at most 500 characters'; end if;
  select * into o from public.orders where id=p_order for update;
  if not found or o.status not in ('submitted','awaiting_payment') or o.offer_issued_at is not null or o.production_released_at is not null
    then raise exception 'This comparison is closed'; end if;
  select * into q from public.order_factory_quotes where order_id=p_order and factory_id=p_factory;
  if not found or q.status not in ('submitted','selected') or q.valid_until is null or q.valid_until<=now()
    or jsonb_array_length(q.tiers)=0 then raise exception 'Choose a complete, valid quotation'; end if;
  select * into m from public.manufacturer_profiles where user_id=p_factory;
  select s.settings into settings from public.manufacturer_customisation_settings s where user_id=p_factory;
  if not (public.matching_requirements(o,m,coalesce(settings,'{}'))->>'eligible')::boolean then raise exception 'Manufacturer is no longer eligible'; end if;
  if o.assigned_manufacturer_id is distinct from p_factory then
    delete from public.order_freight_selections where order_id=p_order;
  end if;
  update public.order_factory_quotes set status='submitted' where order_id=p_order and status='selected' and factory_id<>p_factory;
  update public.order_factory_quotes set status='selected',selection_reason=nullif(trim(p_reason),'') where order_id=p_order and factory_id=p_factory;
  perform set_config('app.routing_write',p_order::text,true);
  perform set_config('app.workflow_write',p_order::text,true);
  perform set_config('app.routing_action','comparison_preferred',true);
  perform set_config('app.comparison_write',p_order::text,true);
  update public.orders set assigned_manufacturer_id=p_factory,assigned_at=q.requested_at,due_quote_by=q.due_on,
    factory_status='quoted',manufacturer_quote=q.tiers,quoted_at=q.submitted_at,factory_reject_reason=null where id=p_order;
  perform set_config('app.comparison_write','',true);
  return p_order;
end;
$$;

-- A comparison request never grants general order access. Until publication the
-- preferred factory continues to see only its own quote-specific projection.
do $$begin
  if to_regprocedure('public.single_factory_order_visible(uuid)') is null then
    execute replace(pg_get_functiondef('public.factory_order_visible(uuid)'::regprocedure),
      'public.factory_order_visible(', 'public.single_factory_order_visible(');
  end if;
end$$;
revoke all on function public.single_factory_order_visible(uuid) from public,anon,authenticated;
create or replace function public.factory_order_visible(p_order uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.single_factory_order_visible(p_order) and not exists(
    select 1 from public.order_factory_quotes q join public.orders o on o.id=q.order_id
    where q.order_id=p_order and o.offer_issued_at is null);
$$;
revoke all on function public.factory_order_visible(uuid) from public,anon;
grant execute on function public.factory_order_visible(uuid) to authenticated;

create or replace function public.guard_factory_comparison()
returns trigger language plpgsql security definer set search_path='' as $$
declare winner public.order_factory_quotes;
begin
  if not exists(select 1 from public.order_factory_quotes where order_id=new.id) then return new; end if;
  if (new.assigned_manufacturer_id,new.manufacturer_quote,new.order_quantities,new.specifications)
     is distinct from (old.assigned_manufacturer_id,old.manufacturer_quote,old.order_quantities,old.specifications)
     and current_setting('app.comparison_write',true) is distinct from new.id::text then
    raise exception 'Use the manufacturer comparison to change this order';
  end if;
  if new.offer_issued_at is distinct from old.offer_issued_at and new.offer_issued_at is not null then
    select * into winner from public.order_factory_quotes where order_id=new.id and status='selected';
    if not found or winner.factory_id is distinct from new.assigned_manufacturer_id or winner.valid_until<=now()
      or new.manufacturer_quote is distinct from winner.tiers then raise exception 'Select a complete, valid manufacturer quotation'; end if;
    perform public.notify_manufacturer(q.factory_id,'order','Quotation request closed',
      'Thank you for your time. Ceriga did not select your quotation for this order.','/manufacturer/orders',null)
      from public.order_factory_quotes q where q.order_id=new.id and q.status in ('pending','submitted');
    update public.order_factory_quotes set status='not_selected' where order_id=new.id and status in ('pending','submitted');
  end if;
  if new.production_released_at is not null and new.production_released_at is distinct from old.production_released_at then
    if new.payment_verified_at is null or not exists (
      select 1 from public.order_verified_payments p where p.order_id=new.id
        and p.option_id=new.selected_price_option_id and p.amount_cents=new.paid_amount_cents
    ) or not exists(select 1 from public.order_factory_quotes where order_id=new.id and status='selected'
      and factory_id=new.assigned_manufacturer_id) then
      raise exception 'Verified payment is required before the selected manufacturer can begin production';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists orders_guard_factory_comparison on public.orders;
create trigger orders_guard_factory_comparison before update on public.orders
for each row execute function public.guard_factory_comparison();
revoke all on function public.guard_factory_comparison() from public,anon,authenticated;

-- Keep deadlines supplied by comparison requests rather than replacing them with the canonical order deadline.
create or replace function public.matching_capture_assignment_deadline()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.event_type='assigned' and not (new.details ? 'dueQuoteBy') then
    new.details := new.details || jsonb_build_object('dueQuoteBy',
      (select due_quote_by from public.orders where id=new.order_id));
  end if;
  return new;
end;
$$;

revoke all on function public.admin_request_factory_comparison(uuid,uuid,uuid,date,date),
  public.factory_comparison_requests(uuid),public.factory_respond_comparison(uuid,jsonb,text,boolean),
  public.admin_factory_comparisons(),public.admin_select_factory_quote(uuid,uuid,text) from public,anon;
grant execute on function public.admin_request_factory_comparison(uuid,uuid,uuid,date,date),
  public.factory_comparison_requests(uuid),public.factory_respond_comparison(uuid,jsonb,text,boolean),
  public.admin_factory_comparisons(),public.admin_select_factory_quote(uuid,uuid,text) to authenticated;
-- The automatic queue must skip orders already sent for comparison.
do $$declare d text; begin
  select pg_get_functiondef('public.try_auto_assign_order(uuid)'::regprocedure) into d;
  if strpos(d,'order_factory_quotes')=0 then
    execute replace(d,'assigned_manufacturer_id is null for update skip locked',
      'assigned_manufacturer_id is null and not exists(select 1 from public.order_factory_quotes where order_id=p_order) for update skip locked');
  end if;
end$$;

-- Comparison requests overlap. Match responses to each factory's own deadline.
do $fair$
declare definition text;
begin
  select pg_get_functiondef('public.matching_opportunities(timestamptz,uuid)'::regprocedure) into definition;
  if strpos(definition,'comparison')=0 then
    definition := replace(definition,'partition by e.order_id order by',
      'partition by e.order_id, case when e.details ? ''comparison'' then e.manufacturer_id end order by');
    execute definition;
  end if;
end;
$fair$;

notify pgrst,'reload schema';
commit;
