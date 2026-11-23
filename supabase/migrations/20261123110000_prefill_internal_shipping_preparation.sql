-- Reuse approved route and current forecast without scheduling collection or booking.
begin;
do $patch$
declare d text;old_text text:=$old$v_details:=jsonb_build_object('carrier','','collection_at',null,'note','');$old$;
 new_text text:=$new$v_details:=jsonb_build_object('carrier',left(coalesce((
  select q.terms->>'provider'from public.order_freight_selections s join public.order_freight_quotes q on q.id=s.quote_id
   where s.order_id=p_order and s.option_id=o.selected_price_option_id),''),200),
  'collection_at',null,'note','',
  'route',(select jsonb_build_object('origin',q.terms->>'origin','destination',q.terms->>'destination')
   from public.order_freight_selections s join public.order_freight_quotes q on q.id=s.quote_id
   where s.order_id=p_order and s.option_id=o.selected_price_option_id),
  'forecast_at',(select t.expected_completion from public.order_production_timelines t where t.order_id=p_order and t.manufacturer_id=o.assigned_manufacturer_id));$new$;
begin
 d:=pg_get_functiondef('public.internal_order_work(uuid,text,text,uuid,integer,jsonb)'::regprocedure);
 if position(new_text in d)=0 then
  if position(old_text in d)=0 then raise exception 'Unexpected internal shipping preparation definition';end if;
  execute replace(d,old_text,new_text);
 end if;
end$patch$;
notify pgrst,'reload schema';
commit;
