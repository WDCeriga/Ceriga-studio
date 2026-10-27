begin;
-- Derive every quantity and extended price from the saved customer request.
create or replace function public.submit_manufacturer_quote(p_order_id uuid, p_tiers jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; requirement jsonb; tier jsonb; requirements jsonb; normalized jsonb := '[]'; units numeric; unit_price numeric; days numeric; line_id text; line_kind text; quote_currency text;
begin
 if auth.uid() is null then raise exception 'Sign in to submit a quotation';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.assigned_manufacturer_id is distinct from auth.uid() then raise exception 'This order is not assigned to your factory';end if;
 if target.status not in('submitted','awaiting_payment') or coalesce(target.factory_status,'new') not in('new','reviewing','clarifying','quoted') then raise exception 'This order is no longer accepting manufacturer quotations';end if;
 if jsonb_array_length(coalesce(target.manufacturer_quote,'[]'::jsonb))>0 then
  quote_currency := coalesce(target.manufacturer_quote->0->>'currency','GBP');
 else
  select coalesce(pricing->>'preferredCurrency','GBP') into quote_currency from public.manufacturer_profiles where user_id=auth.uid();
 end if;
 if quote_currency is null or quote_currency not in('GBP','USD','EUR') then quote_currency:='GBP';end if;
 if jsonb_typeof(target.order_quantities->'sample')='object' then
  requirements := jsonb_build_array(target.order_quantities->'sample') || coalesce(target.order_quantities->'bulkRuns','[]'::jsonb);
 elsif coalesce(target.quote_request->>'quantity','') ~ '^[1-9][0-9]*$' then
  requirements := jsonb_build_array(jsonb_build_object('id','factory-quote','kind','bulk','targetTotal',(target.quote_request->>'quantity')::numeric));
 else raise exception 'The customer quantity is missing. Ask Ceriga to complete the order quantities';end if;
 if jsonb_typeof(p_tiers) is distinct from 'array' or jsonb_array_length(p_tiers)<>jsonb_array_length(requirements) or jsonb_array_length(p_tiers) not between 1 and 20 then raise exception 'Quote every customer quantity option';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_tiers))<>jsonb_array_length(p_tiers) then raise exception 'Quotation tier IDs must be unique';end if;
 for requirement in select value from jsonb_array_elements(requirements) loop
  line_id := requirement->>'id'; line_kind := requirement->>'kind';
  units := coalesce((requirement->>'targetTotal')::numeric,(select sum(value::numeric) from jsonb_each_text(coalesce(requirement->'bySize','{}'::jsonb))));
  if units is null or units<=0 or units<>trunc(units) or units>100000000 then raise exception 'The customer quantity is missing or invalid';end if;
  select value into tier from jsonb_array_elements(p_tiers) where value->>'id'=line_id;
  if tier is null or coalesce(tier->>'currency','')<>quote_currency or coalesce(tier->>'unitPriceCents','') !~ '^[1-9][0-9]*$' or coalesce(tier->>'leadTimeDays','') !~ '^[1-9][0-9]*$' then raise exception 'Each option requires a positive unit price in the quotation currency and a lead time';end if;
  unit_price := (tier->>'unitPriceCents')::numeric; days := (tier->>'leadTimeDays')::numeric;
  if days>3650 or unit_price*units>100000000000 then raise exception 'Quotation values exceed supported limits';end if;
  normalized := normalized || jsonb_build_array(jsonb_build_object('id',line_id,'kind',line_kind,'label',case when line_kind='sample' then 'Samples' else 'Bulk · '||units::text||' units' end,'totalUnits',units,'unitPriceCents',unit_price,'manufacturerQuoteCents',unit_price*units,'currency',quote_currency,'leadTimeDays',days));
 end loop;
 update public.orders set manufacturer_quote=normalized,factory_status='quoted',factory_reject_reason=null,quoted_at=now() where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.submit_manufacturer_quote(uuid,jsonb) from public,anon;
grant execute on function public.submit_manufacturer_quote(uuid,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
