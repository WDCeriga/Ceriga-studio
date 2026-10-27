begin;
do $$ declare customer uuid; admin uuid; begin
 select u.id into admin from auth.users u join public.superadmin_emails a on lower(a.email)=lower(u.email) order by u.created_at limit 1;
 select p.id into customer from public.profiles p where p.role='brand' and not exists(select 1 from public.superadmin_emails a where lower(a.email)=lower(p.email)) and not exists(select 1 from public.manufacturer_profiles m where m.user_id=p.id) order by (select count(*) from public.orders o where o.user_id=p.id) desc limit 1;
 if admin is null or customer is null then raise exception 'An existing allowlisted admin and customer are required for verification';end if;
 perform set_config('test.order_admin',admin::text,true);
 perform set_config('test.order_customer',customer::text,true);
 perform set_config('test.order_total',(select count(*)::text from public.orders),true);
 perform set_config('test.customer_order_total',(select count(*)::text from public.orders where user_id=customer),true);
 perform set_config('test.admin_email',(select email from auth.users where id=admin),true);
 perform set_config('test.customer_email',(select email from auth.users where id=customer),true);
end $$;
set local role authenticated;
do $$ begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.order_customer'),'role','authenticated','email',current_setting('test.customer_email'))::text,true);
 if public.is_superadmin() then raise exception 'Customer incorrectly has admin access';end if;
 if exists(select 1 from public.account_orders where user_id<>auth.uid()) then raise exception 'Customer can read another customer order';end if;
 if (select count(*) from public.account_orders)<>current_setting('test.customer_order_total')::integer then raise exception 'Customer cannot read their saved orders';end if;
 if exists(select 1 from public.account_orders where id=gen_random_uuid()) then raise exception 'Empty lookup was not empty';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.order_admin'),'role','authenticated','email',current_setting('test.admin_email'))::text,true);
 if not public.is_superadmin() then raise exception 'Allowlisted admin access failed';end if;
 if (select count(*) from public.account_orders)<>current_setting('test.order_total')::integer then raise exception 'Superadmin cannot read all customer orders';end if;
 perform id,user_id,product_name,status,created_at from public.account_orders;
end $$;
reset role;
rollback;
select 'PASS: customers read only their own orders; exact-email superadmin reads all saved orders; empty lookup works; no data changed' verification;
