-- Additive storage for the selected capability catalog and method MOQ constraints.
-- Legacy manufacturer profile columns and existing rows remain untouched.
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
