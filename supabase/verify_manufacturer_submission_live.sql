-- Verifies real owner submission and factory visibility without retaining fixture data.
begin;
do $$
declare buyer uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); oid uuid:=gen_random_uuid(); factory uuid; result_id uuid; before_receipts bigint;
begin
 select user_id into factory from public.manufacturer_profiles where onboarding_complete and status is distinct from 'paused' limit 1;
 if factory is null then raise exception 'An onboarded manufacturer is required';end if;
 perform set_config('request.jwt.claims','{}',true);
 insert into auth.users(id,email,raw_user_meta_data)values(buyer,'submission-'||buyer||'@example.invalid','{}'),(outsider,'submission-'||outsider||'@example.invalid','{}');
 insert into public.orders(id,user_id,kind,product_name,garment_type,status,status_label)values(oid,buyer,'production','Submission rollback verification','T-shirts','submitted','Submitted');
 perform set_config('app.routing_write',oid::text,true);perform set_config('app.workflow_write',oid::text,true);
 update public.orders set assigned_manufacturer_id=factory,factory_status='quoted',status='priced',priced_at=now(),quote_expires_at=now()+interval '30 days',price_options='[{"id":"sample","label":"Sample","kind":"sample","totalUnits":6,"priceCents":10000,"currency":"GBP"}]' where id=oid;
 select count(*) into before_receipts from public.order_verified_payments where order_id=oid;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',buyer,'email','buyer@example.invalid','role','authenticated')::text,true);
 execute 'set local role authenticated';
 result_id:=public.submit_order_to_manufacturer(oid,'sample');
 if result_id<>oid or not exists(select 1 from public.account_orders where id=oid and status='processing' and factory_status='in_production' and selected_price_option_id='sample' and manufacturer_submitted_at is not null and production_released_at is not null and paid_amount_cents is null and payment_verified_at is null) then raise exception 'Submission did not persist correctly';end if;
 if public.submit_order_to_manufacturer(oid,'sample')<>oid then raise exception 'Repeated submission was not idempotent';end if;
 execute 'reset role';
 if (select count(*) from public.order_verified_payments where order_id=oid)<>before_receipts then raise exception 'Submission created a payment receipt';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',factory,'email','manufacturer@example.invalid','role','authenticated')::text,true);
 execute 'set local role authenticated';
 if not exists(select 1 from public.account_orders where id=oid and production_released_at is not null) then raise exception 'Assigned manufacturer cannot see submitted order';end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'email','outsider@example.invalid','role','authenticated')::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from public.account_orders where id=oid) then raise exception 'Other customer can read submission';end if;
 begin perform public.submit_order_to_manufacturer(oid,'sample');raise exception 'UNEXPECTED submission bypass';exception when others then if sqlerrm='UNEXPECTED submission bypass' then raise;end if;end;
 execute 'reset role';
 if has_function_privilege('anon','public.submit_order_to_manufacturer(uuid,text)','execute') then raise exception 'Anonymous submission enabled';end if;
end $$;
rollback;
select 'PASS: customer submission persists, assigned factory receives the selected option, duplicate requests are safe, other accounts are isolated, and payment fields/receipts remain untouched. All fixtures rolled back.' as verification;
