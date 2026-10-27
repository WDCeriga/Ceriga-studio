begin;
do $$
declare target public.orders%rowtype; quote_currency text; requirements jsonb; tiers jsonb; saved public.orders%rowtype;
begin
 select * into target from public.orders where assigned_manufacturer_id is not null and status in('submitted','awaiting_payment') and coalesce(factory_status,'new') in('new','reviewing','clarifying','quoted') and not workflow_managed and jsonb_typeof(order_quantities->'sample')='object' order by created_at limit 1;
 if not found then raise exception 'No eligible assigned order for verification';end if;
 if jsonb_array_length(coalesce(target.manufacturer_quote,'[]'::jsonb))>0 then quote_currency:=coalesce(target.manufacturer_quote->0->>'currency','GBP');else select coalesce(pricing->>'preferredCurrency','GBP') into quote_currency from public.manufacturer_profiles where user_id=target.assigned_manufacturer_id;end if;
 requirements:=jsonb_build_array(target.order_quantities->'sample')||coalesce(target.order_quantities->'bulkRuns','[]'::jsonb);
 select jsonb_agg(jsonb_build_object('id',value->>'id','unitPriceCents',1250,'currency',quote_currency,'leadTimeDays',14)) into tiers from jsonb_array_elements(requirements);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',target.assigned_manufacturer_id,'email','factory-check@example.invalid','role','authenticated')::text,true);
 execute 'set local role authenticated';
 perform public.submit_manufacturer_quote(target.id,tiers);
 select * into saved from public.orders where id=target.id;
 if exists(select 1 from jsonb_array_elements(saved.manufacturer_quote) where value->>'currency' is distinct from quote_currency or (value->>'manufacturerQuoteCents')::numeric<>(value->>'totalUnits')::numeric*1250)then raise exception 'Currency or amount was not preserved';end if;
 if saved.total is distinct from target.total or saved.status is distinct from target.status or saved.paid_amount_cents is distinct from target.paid_amount_cents then raise exception 'Customer price/payment changed';end if;
 execute 'reset role';
end $$;
select 'PASS: settings/saved quotation currency persisted with unit totals; customer price and payment unchanged. Test changes rolled back.' as verification;
rollback;
