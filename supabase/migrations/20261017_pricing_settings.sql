-- Repair only the storage needed by the super admin Pricing page.
begin;
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
grant select,insert,update,delete on public.platform_settings to authenticated;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='platform_settings' and policyname='platform_settings_superadmin_all') then
    create policy platform_settings_superadmin_all on public.platform_settings for all to authenticated
      using(public.is_superadmin()) with check(public.is_superadmin());
  end if;
end $$;
notify pgrst,'reload schema';
commit;
