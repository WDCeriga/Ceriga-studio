begin;
do $$
declare factory record; expected bigint; actual bigint; checks integer := 0;
begin
 for factory in select user_id from public.manufacturer_profiles loop
  select count(*) into expected from public.orders where assigned_manufacturer_id=factory.user_id;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',factory.user_id,'email','manufacturer-verification@example.invalid','role','authenticated')::text,true);
  execute 'set local role authenticated';
  select count(*) into actual from public.orders where assigned_manufacturer_id=factory.user_id;
  if actual<>expected then raise exception 'Assigned manufacturer read failed'; end if;
  if exists(select 1 from public.orders where assigned_manufacturer_id is distinct from factory.user_id and user_id is distinct from factory.user_id) then raise exception 'Manufacturer isolation failed'; end if;
  execute 'reset role';
  checks := checks+1;
 end loop;
 if checks=0 then raise exception 'No manufacturer accounts to verify';end if;
end $$;
select 'PASS: real assigned orders visible to assigned manufacturers; unrelated orders isolated' as verification,
(select count(*) from public.orders where assigned_manufacturer_id is not null) as assigned_orders,
(select count(*) from public.manufacturer_profiles) as manufacturers_checked,
exists(select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_read_assigned_factory') as order_policy_installed,
exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='order_uploads_read_assigned_factory') as file_policy_installed,
exists(select 1 from pg_trigger where tgname='orders_assignment_admin_only' and not tgisinternal) as assignment_guard_installed;
rollback;