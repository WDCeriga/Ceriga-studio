begin;
do $$
declare target public.orders%rowtype; after_quote public.orders%rowtype; tiers jsonb; denied boolean:=false;
begin
 select * into target from public.orders where assigned_manufacturer_id is not null and status in('submitted','awaiting_payment') and not workflow_managed order by created_at limit 1;
 if not found then raise exception 'No eligible assigned order available for verification';end if;
 tiers := '[{"id":"verification-only","kind":"sample","label":"Rollback verification","totalUnits":6,"manufacturerQuoteCents":12000,"currency":"GBP","leadTimeDays":14}]'::jsonb;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',target.user_id,'email','customer-check@example.invalid','role','authenticated')::text,true);
 execute 'set local role authenticated';
 begin perform public.submit_manufacturer_quote(target.id,tiers);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Customer quote submission was allowed';end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',target.assigned_manufacturer_id,'email','factory-check@example.invalid','role','authenticated')::text,true);
 execute 'set local role authenticated';
 perform public.submit_manufacturer_quote(target.id,tiers);
 select * into after_quote from public.orders where id=target.id;
 if after_quote.factory_status<>'quoted' or after_quote.manufacturer_quote is distinct from tiers or after_quote.quoted_at is null then raise exception 'Quote did not persist';end if;
 if after_quote.status is distinct from target.status or after_quote.total is distinct from target.total or after_quote.paid_amount_cents is distinct from target.paid_amount_cents or after_quote.assigned_manufacturer_id is distinct from target.assigned_manufacturer_id then raise exception 'Customer price, status, payment or assignment changed';end if;
 execute 'reset role';
 perform set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","email":"owner@ceriga.io","role":"authenticated"}',true);
 execute 'set local role authenticated';
 if not exists(select 1 from public.orders where id=target.id and factory_status='quoted') then raise exception 'Superadmin cannot read submitted quotation';end if;
 execute 'reset role';
end $$;
select 'PASS: assigned factory submits; customer denied; superadmin receives; customer price, payment, status and assignment unchanged; all test changes rolled back' as verification,
has_function_privilege('anon','public.submit_manufacturer_quote(uuid,jsonb)','EXECUTE') as anonymous_access;
rollback;