-- Run in the SQL Editor of the SAME Supabase project configured by the app.
-- Additive repair: no existing rows or saved prices are deleted or rewritten.
begin;

create table if not exists public.manufacturer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  factory_name text not null default 'My factory',
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  address_line text,
  typical_lead_days integer,
  onboarding_complete boolean not null default false,
  garments text[] not null default '{}'::text[],
  capabilities text[] not null default '{}'::text[],
  shipping_regions text[] not null default '{}'::text[],
  moq integer not null default 50,
  monthly_capacity integer not null default 0,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.manufacturer_profiles add column if not exists pricing jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint
    where conname = 'manufacturer_profiles_pricing_object'
    and conrelid = 'public.manufacturer_profiles'::regclass) then
    alter table public.manufacturer_profiles add constraint manufacturer_profiles_pricing_object
      check (pricing is null or (jsonb_typeof(pricing) = 'object'
        and pricing->>'preferredCurrency' in ('GBP','USD','EUR')));
  end if;
end;
$$;
alter table public.manufacturer_profiles enable row level security;
grant select, insert, update on public.manufacturer_profiles to authenticated;
drop policy if exists manufacturer_profiles_select_own on public.manufacturer_profiles;
create policy manufacturer_profiles_select_own on public.manufacturer_profiles
  for select to authenticated using (user_id = auth.uid());
drop policy if exists manufacturer_profiles_insert_own on public.manufacturer_profiles;
create policy manufacturer_profiles_insert_own on public.manufacturer_profiles
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists manufacturer_profiles_update_own on public.manufacturer_profiles;
create policy manufacturer_profiles_update_own on public.manufacturer_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Existing superadmin policies are intentionally left intact.
create or replace function public.set_manufacturer_profiles_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists manufacturer_profiles_set_updated_at on public.manufacturer_profiles;
create trigger manufacturer_profiles_set_updated_at before update on public.manufacturer_profiles
  for each row execute function public.set_manufacturer_profiles_updated_at();

create table if not exists public.manufacturer_customisation_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint manufacturer_customisation_settings_object check (jsonb_typeof(settings) = 'object')
);
alter table public.manufacturer_customisation_settings enable row level security;
grant select, insert, update on public.manufacturer_customisation_settings to authenticated;
drop policy if exists manufacturer_customisation_select_own on public.manufacturer_customisation_settings;
create policy manufacturer_customisation_select_own on public.manufacturer_customisation_settings
  for select to authenticated using (user_id = auth.uid());
drop policy if exists manufacturer_customisation_insert_own on public.manufacturer_customisation_settings;
create policy manufacturer_customisation_insert_own on public.manufacturer_customisation_settings
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists manufacturer_customisation_update_own on public.manufacturer_customisation_settings;
create policy manufacturer_customisation_update_own on public.manufacturer_customisation_settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create or replace function public.set_manufacturer_customisation_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists manufacturer_customisation_updated_at on public.manufacturer_customisation_settings;
create trigger manufacturer_customisation_updated_at before update on public.manufacturer_customisation_settings
  for each row execute function public.set_manufacturer_customisation_updated_at();

notify pgrst, 'reload schema';
commit;

-- Expected: two rows, both flags true.
select c.relname as table_name, c.relrowsecurity as row_level_security,
  exists (select 1 from information_schema.columns col
    where col.table_schema = 'public' and col.table_name = c.relname
      and col.column_name = case when c.relname = 'manufacturer_profiles' then 'pricing' else 'settings' end
  ) as required_column_present
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('manufacturer_profiles', 'manufacturer_customisation_settings');
