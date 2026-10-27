-- Application-level admin access; no browser DDL or service-role credentials.
begin;

alter table public.manufacturer_profiles
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists status text,
  add column if not exists specialties text[] not null default '{}'::text[],
  add column if not exists certifications text[] not null default '{}'::text[],
  add column if not exists pricing jsonb;
alter table public.manufacturer_profiles alter column status set default 'onboarding';

-- Preserve accounts created before profiles were introduced.
insert into public.profiles(id,email,full_name,role)
select u.id,coalesce(u.email,''),coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name'), 'manufacturer'
from auth.users u join public.manufacturer_profiles m on m.user_id=u.id
on conflict(id) do nothing;

do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.manufacturer_profiles'::regclass and confrelid='public.profiles'::regclass and contype='f') then
    alter table public.manufacturer_profiles add constraint manufacturer_profiles_profile_fkey
      foreign key(user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

create or replace function public.apply_superadmin_access()
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare table_name text;
begin
  foreach table_name in array array[
    'projects','orders','packaging_library','brand_notifications','profiles',
    'manufacturer_profiles','manufacturer_invites','factory_materials',
    'factory_capacity_blocks','portal_notifications','measurement_guide_packs',
    'platform_settings','admin_chat_threads','admin_chat_messages',
    'manufacturer_customisation_settings','superadmin_emails'
  ] loop
    if to_regclass(format('public.%I',table_name)) is not null then
      execute format('alter table public.%I enable row level security',table_name);
      execute format('grant select,insert,update,delete on public.%I to authenticated',table_name);
      if not exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename=table_name and p.policyname='superadmin_full_access') then
        execute format('create policy superadmin_full_access on public.%I for all to authenticated using(public.is_superadmin()) with check(public.is_superadmin())',table_name);
      end if;
    end if;
  end loop;
end $$;
revoke all on function public.apply_superadmin_access() from public,anon,authenticated;
grant execute on function public.apply_superadmin_access() to service_role;
select public.apply_superadmin_access();

do $$ begin
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='order_uploads_superadmin_all') then
    create policy order_uploads_superadmin_all on storage.objects for all to authenticated
      using(bucket_id='order-uploads' and public.is_superadmin())
      with check(bucket_id='order-uploads' and public.is_superadmin());
  end if;
end $$;
notify pgrst,'reload schema';
commit;
