-- R05: bounded internal order search, stable server ordering and independent totals.
begin;
create index if not exists orders_internal_created_idx on public.orders(created_at desc,id);
create index if not exists orders_internal_status_date_idx on public.orders(status,factory_status,created_at desc,id);

create or replace function public.admin_order_page(p_query jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare result jsonb;query_text text:=left(btrim(coalesce(p_query->>'search','')),200);
 kind text:=coalesce(p_query->>'kind','all');stage text:=coalesce(p_query->>'stage','all');
 sort_key text:=coalesce(p_query->>'sort','date');direction text:=coalesce(p_query->>'direction','desc');
 target text:=coalesce(p_query->>'currency','EUR');page_offset integer:=greatest(0,coalesce((p_query->>'offset')::integer,0));
begin
 if not coalesce(public.is_superadmin(),false)then raise exception 'Superadmin authorization required'using errcode='42501';end if;
 if jsonb_typeof(p_query)<>'object'or octet_length(p_query::text)>5000
  or kind not in('all','techpack','custom_clothing')or stage not in('all','review','at_manufacturer','with_brand','fulfilment')
  or sort_key not in('order','customer','status','date','price')or direction not in('asc','desc')or target not in('EUR','USD','GBP')then
  raise exception 'Invalid order filters';end if;
 with rates as (
  select rates,retrieved_at>=now()-make_interval(secs=>max_age_seconds)and rate_date>=current_date-7 as current
   from public.currency_rate_cache where id=true
 ), base as materialized (
  select o as ord,o.id,o.created_at,o.product_name,o.assigned_manufacturer_id,
   coalesce(nullif(p.full_name,''),nullif(split_part(p.email,'@',1),''),'Brand')user_name,
   coalesce(p.email,o.contact_email,'')user_email,coalesce(m.factory_name,'')manufacturer_name,
   case when o.kind='tech-pack'then 'techpack'else 'custom_clothing'end ui_kind,
   case when o.status in('admin_draft','customer_confirmation')then 'draft'
    when o.status='priced'then case when jsonb_array_length(coalesce(o.price_options,'[]'))>0 then 'sent_to_brand'else 'pending_review'end
    when o.status='paid'then 'paid'when o.status='processing'then 'in_production'when o.status='shipping'then 'shipped'
    when o.status in('completed','ready')then 'completed'
    when o.factory_status='quoted'then 'pending_review'when o.factory_status='rejected'or o.assigned_manufacturer_id is not null then 'assigned'
    else 'submitted'end ui_status,
   coalesce(o.paid_amount_cents,case when option.value->>'priceCents'~'^[0-9]{1,15}$'then(option.value->>'priceCents')::bigint end)amount,
   coalesce(o.paid_currency,option.value->>'currency')currency
  from public.orders o left join public.profiles p on p.id=o.user_id
   left join public.manufacturer_profiles m on m.user_id=o.assigned_manufacturer_id
   left join lateral(select value from jsonb_array_elements(coalesce(o.price_options,'[]'))where value->>'id'=o.selected_price_option_id limit 1)option on true
 ), filtered as (
  select b.*,
   case when b.currency=target then b.amount
    when r.current and b.currency in('EUR','USD','GBP')and r.rates?b.currency and r.rates?target
     then round(b.amount::numeric*(r.rates->>target)::numeric/nullif((r.rates->>b.currency)::numeric,0))end normalized_minor,
   coalesce(p_query->'statusLabels'->>b.ui_status,b.ui_status)status_name
  from base b left join rates r on true
  where(kind='all'or b.ui_kind=kind)
   and(stage='all'or stage='review'and b.ui_status='pending_review'
    or stage='at_manufacturer'and b.ui_status in('submitted','assigned')
    or stage='with_brand'and b.ui_status in('priced','sent_to_brand')
    or stage='fulfilment'and b.ui_status in('paid','in_production','shipped','completed'))
   and(query_text=''or strpos(lower(concat_ws(' ',b.id,b.product_name,b.user_name,b.user_email,b.manufacturer_name,(b.ord).delivery_address->>'city',p_query->'statusLabels'->>b.ui_status)),lower(query_text))>0)
 ), page as (
  select *from filtered order by
   case when sort_key='order'and direction='asc'then id::text end asc,
   case when sort_key='order'and direction='desc'then id::text end desc,
   case when sort_key='customer'and direction='asc'then user_name end asc,
   case when sort_key='customer'and direction='desc'then user_name end desc,
   case when sort_key='status'and direction='asc'then status_name end asc,
   case when sort_key='status'and direction='desc'then status_name end desc,
   case when sort_key='price'and direction='asc'then normalized_minor end asc nulls last,
   case when sort_key='price'and direction='desc'then normalized_minor end desc nulls last,
   case when sort_key='date'and direction='asc'then created_at end asc,
   case when sort_key='date'and direction='desc'then created_at end desc,id
  limit 25 offset page_offset
 )
 select jsonb_build_object(
  'rows',coalesce((select jsonb_agg(to_jsonb(public.account_order_projection(p.ord))||jsonb_build_object('user_name',p.user_name,'user_email',p.user_email,'manufacturer_name',p.manufacturer_name))from page p),'[]'),
  'total',(select count(*)from filtered),
  'totalAll',(select count(*)from base),
  'awaitingReview',(select count(*)from base where ui_status='pending_review'),
  'atManufacturer',(select count(*)from base where ui_status in('submitted','assigned')),
  'quotedTotals',coalesce((select jsonb_agg(to_jsonb(t))from(select currency,sum(amount)::bigint cents from base where amount is not null and currency in('EUR','USD','GBP')group by currency)t),'[]')
 )into result;
 return result;
end$$;
revoke all on function public.admin_order_page(jsonb)from public,anon;
grant execute on function public.admin_order_page(jsonb)to authenticated;
notify pgrst,'reload schema';
commit;
