-- Live persistence verification only; all fixture writes are rolled back.
begin;
do $$
declare factory uuid;other_user uuid;admin_id uuid;admin_email text;details jsonb:='{"T-shirts":{"category":"T-shirts","confirmed":true,"styles":["Oversized"],"materials":["French Terry"],"minGsm":280,"maxGsm":400,"constructionDetails":["Raglan sleeve"]}}';saved jsonb;affected integer;
begin
 select user_id into factory from public.manufacturer_profiles where onboarding_complete limit 1;
 select id into other_user from auth.users where id<>factory and not exists(select 1 from public.superadmin_emails s where lower(s.email)=lower(auth.users.email)) limit 1;
 select u.id,u.email into admin_id,admin_email from auth.users u join public.superadmin_emails s on lower(s.email)=lower(u.email)limit 1;
 if factory is null or other_user is null or admin_id is null then raise exception 'Missing verification actors';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',factory,'email','factory-verification@example.invalid','role','authenticated')::text,true);execute 'set local role authenticated';
 insert into public.manufacturer_customisation_settings(user_id,settings)values(factory,jsonb_build_object('garmentDetails',details))on conflict(user_id)do update set settings=public.manufacturer_customisation_settings.settings||excluded.settings;
 select settings->'garmentDetails' into saved from public.manufacturer_customisation_settings where user_id=factory;
 if saved is distinct from details then raise exception 'Detailed production capabilities did not persist';end if;
 execute 'reset role';perform set_config('request.jwt.claims',jsonb_build_object('sub',other_user,'email','other-verification@example.invalid','role','authenticated')::text,true);execute 'set local role authenticated';
 if exists(select 1 from public.manufacturer_customisation_settings where user_id=factory)then raise exception 'Other account can read factory capabilities';end if;
 update public.manufacturer_customisation_settings set settings='{}' where user_id=factory;get diagnostics affected=row_count;if affected<>0 then raise exception 'Other account can change factory capabilities';end if;
 execute 'reset role';perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'email',admin_email,'role','authenticated')::text,true);execute 'set local role authenticated';
 select settings->'garmentDetails'into saved from public.manufacturer_customisation_settings where user_id=factory;if saved is distinct from details then raise exception 'Admin cannot read saved matching requirements';end if;
 execute 'reset role';
end $$;
select 'PASS: owner saves and reloads confirmed fabric/GSM/styles/construction; superadmin reads them for matching; other accounts cannot read or modify them. All test changes rolled back.' as verification;
rollback;
