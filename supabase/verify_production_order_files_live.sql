-- Rollback-only verification: no customer orders, storage records or assignments remain.
begin;
select set_config('app.order_test_buyer',gen_random_uuid()::text,true);
select set_config('app.order_test_factory',gen_random_uuid()::text,true);
select set_config('app.order_test_id',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('app.order_test_buyer')::uuid,'order-test-'||current_setting('app.order_test_buyer')||'@example.invalid'),(current_setting('app.order_test_factory')::uuid,'factory-test-'||current_setting('app.order_test_factory')||'@example.invalid');
insert into public.manufacturer_profiles(user_id,factory_name,status,onboarding_complete,garments,calendar_workdays)
values(current_setting('app.order_test_factory')::uuid,'Rollback order fixture','active',true,array['T-shirts'],array[1,2,3,4,5,6,7]);
update public.platform_settings set value='"automatic"' where key='manufacturer_assignment_mode';
insert into storage.objects(bucket_id,name,owner)values('order-uploads',current_setting('app.order_test_buyer')||'/'||current_setting('app.order_test_id')||'/preview.png',current_setting('app.order_test_buyer')::uuid);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.order_test_buyer'),'email','order-fixture@example.invalid','role','authenticated')::text,true);
set local role authenticated;
do $$ declare saved jsonb; payload jsonb; failed boolean:=false; begin
 payload:=jsonb_build_object('id',current_setting('app.order_test_id'),'kind','production','product_name','Rollback blank-design fixture','garment_type','T-shirts','order_quantities','{"mode":"custom_clothing","sample":{"id":"sample","kind":"sample","bySize":{"m":1}},"bulkRuns":[]}'::jsonb,'specifications','{"decoration":[],"requiredCapabilities":[]}'::jsonb,'quote_request',jsonb_build_object('storagePaths',jsonb_build_array(current_setting('app.order_test_buyer')||'/'||current_setting('app.order_test_id')||'/preview.png'),'fileNames',jsonb_build_array('preview.png')));
 saved:=public.create_customer_order(payload);
 if saved->>'id'<>current_setting('app.order_test_id') or saved->>'assigned_manufacturer_id' is null or saved->'quote_request'->'storagePaths'->>0 is distinct from current_setting('app.order_test_buyer')||'/'||current_setting('app.order_test_id')||'/preview.png' then raise exception 'Order creation/attachment/automatic assignment verification failed';end if;
 if not exists(select 1 from public.account_orders where id=(saved->>'id')::uuid) then raise exception 'Customer read-back failed';end if;
 begin perform public.create_customer_order(payload||jsonb_build_object('id',gen_random_uuid()));exception when others then if sqlerrm not like 'Files must belong%' then raise;end if;failed:=true;end;
 if not failed then raise exception 'Cross-order attachment was accepted';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('app.order_test_factory'),'role','authenticated')::text,true);
 if exists(select 1 from public.account_orders where id=(saved->>'id')::uuid) then raise exception 'Another customer can read the order';end if;
end $$;
reset role;
rollback;
select 'PASS: blank-design production order, initial preview persisted, automatic assignment, owner read-back, invalid attachment rejection and account isolation; all fixtures rolled back.' as verification;
