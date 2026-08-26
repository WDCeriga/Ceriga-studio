-- Ceriga Studio — run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Creates the projects table and row-level security so each user only sees their own drafts.

create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  name text not null default 'Untitled Project',
  garment_type text not null default 'tshirt',
  flow_type text not null default 'techpack'
    check (flow_type in ('techpack', 'packaging', 'manufacturer')),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  current_step integer not null default 1,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_updated_idx
  on public.projects (user_id, updated_at desc);

create or replace function public.set_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_projects_updated_at();

alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

create policy "projects_select_own"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "projects_insert_own"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "projects_update_own"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects_delete_own"
  on public.projects for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Measurement guide packs (shared catalog: one row per garment asset)
-- ---------------------------------------------------------------------------

create table if not exists public.superadmin_emails (
  email text primary key
);

insert into public.superadmin_emails (email) values
  ('owner@ceriga.io'),
  ('xexead@ceriga.io'),
  ('maya.chen@ceriga.io'),
  ('j.okonkwo@ceriga.io')
on conflict (email) do nothing;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.superadmin_emails s
    where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       or lower(split_part(s.email, '@', 1)) = lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1))
  );
$$;

revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to authenticated;

create table if not exists public.measurement_guide_packs (
  garment_type text not null
    check (garment_type in ('tshirt', 'hoodie', 'trousers')),
  asset_id text not null,
  guides jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (garment_type, asset_id)
);

create index if not exists measurement_guide_packs_garment_idx
  on public.measurement_guide_packs (garment_type);

create or replace function public.set_measurement_guide_packs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists measurement_guide_packs_set_updated_at on public.measurement_guide_packs;
create trigger measurement_guide_packs_set_updated_at
  before update on public.measurement_guide_packs
  for each row
  execute function public.set_measurement_guide_packs_updated_at();

alter table public.measurement_guide_packs enable row level security;

drop policy if exists "measurement_guide_packs_select_authenticated" on public.measurement_guide_packs;
drop policy if exists "measurement_guide_packs_insert_superadmin" on public.measurement_guide_packs;
drop policy if exists "measurement_guide_packs_update_superadmin" on public.measurement_guide_packs;
drop policy if exists "measurement_guide_packs_delete_superadmin" on public.measurement_guide_packs;

create policy "measurement_guide_packs_select_authenticated"
  on public.measurement_guide_packs for select
  to authenticated
  using (true);

create policy "measurement_guide_packs_insert_superadmin"
  on public.measurement_guide_packs for insert
  to authenticated
  with check (public.is_superadmin());

create policy "measurement_guide_packs_update_superadmin"
  on public.measurement_guide_packs for update
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy "measurement_guide_packs_delete_superadmin"
  on public.measurement_guide_packs for delete
  to authenticated
  using (public.is_superadmin());
