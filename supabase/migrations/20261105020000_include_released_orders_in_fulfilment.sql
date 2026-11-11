-- Include orders already released through the legacy customer submission flow.
create or replace function public.factory_fulfilment_board(
 p_search text default '',p_filter text default 'active',p_page integer default 0
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare f uuid:=public.current_factory_id(); result jsonb;
begin
 if f is null or not public.factory_has_permission(f,'view_orders') then
  raise exception 'An authorised factory workspace is required';
 end if;
 if p_page is null or p_page<0 or p_page>100000 or p_filter is null
  or p_filter not in('all','active','production','quality','delivery','completed') or length(coalesce(p_search,''))>150 then
  raise exception 'Invalid fulfilment filter';
 end if;
 with eligible as (
  select o.id,o.product_name as name,o.garment_type as garment,o.status,o.qc_status,
   o.production_released_at as released_at,o.created_at,o.tracking,
   coalesce((select case when (x->>'totalUnits') ~ '^[0-9]{1,9}$' then (x->>'totalUnits')::integer end
    from jsonb_array_elements(coalesce(o.price_options,'[]')) x
    where x->>'id'=o.selected_price_option_id limit 1),0) as quantity,
   public.production_stage_key(coalesce(u.stage,'preparation')) as stage,
   t.expected_completion,t.uncertain,t.needs_review,
   (select coalesce(jsonb_agg(to_jsonb(h)),'[]'::jsonb)from(
     select id,kind,explanation,created_at from public.production_timeline_events
     where order_id=o.id and manufacturer_id=f order by created_at desc limit 20)h) as history,
   case when o.status='completed' then 'completed'
    when o.status='shipping' or o.qc_status='approved' then 'delivery'
    when o.qc_status in('pending_review','changes_required') or u.stage='quality_control' then 'quality'
    else 'production' end as step
  from public.orders o
  left join public.order_production_timelines t on t.order_id=o.id and t.manufacturer_id=f
  left join lateral(select v.stage from public.order_production_updates v
   where v.order_id=o.id and v.manufacturer_id=f order by v.version desc limit 1) u on true
  where o.assigned_manufacturer_id=f and o.kind='production' and o.status in('paid','processing','shipping','completed')
   and (o.payment_verified_at is not null or
     (o.production_released_at is not null and o.status in('processing','shipping','completed')))
   and public.factory_order_visible(o.id)
 ), filtered as (
  select * from eligible where
   (p_filter='all' or p_filter='active' and step<>'completed' or p_filter=step)
   and (coalesce(p_search,'')='' or position(lower(p_search) in lower(name||' '||coalesce(garment,'')||' '||id::text))>0)
 ), paged as (
  select * from filtered order by (qc_status='changes_required') desc,
   expected_completion nulls last,created_at,id limit 30 offset p_page*30
 )
 select jsonb_build_object('total',(select count(*)from filtered),
  'counts',(select jsonb_object_agg(step,n)from(select step,count(*) n from eligible group by step)c),
  'orders',coalesce((select jsonb_agg(to_jsonb(p))from paged p),'[]'::jsonb)) into result;
 return result;
end$$;
notify pgrst,'reload schema';
