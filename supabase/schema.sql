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

drop policy if exists "projects_select_superadmin" on public.projects;
create policy "projects_select_superadmin"
  on public.projects for select
  using (public.is_superadmin());

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

insert into public.superadmin_emails (email) values
  ('xexead44@gmail.com')
on conflict (email) do nothing;

-- Full-email match only: local-part matching (xexead@anything.com) was a privilege hole.
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

-- ---------------------------------------------------------------------------
-- Brand orders (tech pack exports + production / upload quotes)
-- ---------------------------------------------------------------------------

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('tech-pack', 'production')),
  product_name text not null,
  garment_type text not null default 'Garment',
  product_id text,
  status text not null
    check (status in (
      'submitted', 'awaiting_payment', 'priced', 'paid',
      'processing', 'shipping', 'completed', 'ready'
    )),
  status_label text not null,
  total numeric,
  tracking text,
  order_quantities jsonb,
  price_options jsonb,
  selected_price_option_id text,
  paid_amount_cents integer,
  export_format text check (export_format is null or export_format in ('pdf', 'pdf_bundle')),
  revision_used boolean not null default false,
  download_ready boolean not null default false,
  priced_at date,
  quote_request jsonb,
  specifications jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);

create or replace function public.set_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function public.set_orders_updated_at();

alter table public.orders enable row level security;

drop policy if exists "orders_select_own" on public.orders;
drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_update_own" on public.orders;
drop policy if exists "orders_delete_own" on public.orders;

create policy "orders_select_own"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "orders_insert_own"
  on public.orders for insert
  with check (auth.uid() = user_id);

create policy "orders_update_own"
  on public.orders for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "orders_delete_own"
  on public.orders for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Packaging design library (reusable snapshots per user)
-- ---------------------------------------------------------------------------

create table if not exists public.packaging_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Packaging',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists packaging_library_user_updated_idx
  on public.packaging_library (user_id, updated_at desc);

create or replace function public.set_packaging_library_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists packaging_library_set_updated_at on public.packaging_library;
create trigger packaging_library_set_updated_at
  before update on public.packaging_library
  for each row
  execute function public.set_packaging_library_updated_at();

alter table public.packaging_library enable row level security;

drop policy if exists "packaging_library_select_own" on public.packaging_library;
drop policy if exists "packaging_library_insert_own" on public.packaging_library;
drop policy if exists "packaging_library_update_own" on public.packaging_library;
drop policy if exists "packaging_library_delete_own" on public.packaging_library;

create policy "packaging_library_select_own"
  on public.packaging_library for select
  using (auth.uid() = user_id);

create policy "packaging_library_insert_own"
  on public.packaging_library for insert
  with check (auth.uid() = user_id);

create policy "packaging_library_update_own"
  on public.packaging_library for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "packaging_library_delete_own"
  on public.packaging_library for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: order upload files (tech packs for quote)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-uploads',
  'order-uploads',
  false,
  52428800,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do nothing;

drop policy if exists "order_uploads_select_own" on storage.objects;
drop policy if exists "order_uploads_insert_own" on storage.objects;
drop policy if exists "order_uploads_update_own" on storage.objects;
drop policy if exists "order_uploads_delete_own" on storage.objects;

create policy "order_uploads_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'order-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "order_uploads_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'order-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "order_uploads_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'order-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "order_uploads_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'order-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Brand notifications (in-app inbox)
-- ---------------------------------------------------------------------------

create table if not exists public.brand_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null
    check (category in ('admin', 'order', 'payment', 'shipping', 'system')),
  title text not null,
  body text not null,
  href text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists brand_notifications_user_created_idx
  on public.brand_notifications (user_id, created_at desc);

alter table public.brand_notifications enable row level security;

drop policy if exists "brand_notifications_select_own" on public.brand_notifications;
drop policy if exists "brand_notifications_insert_own" on public.brand_notifications;
drop policy if exists "brand_notifications_update_own" on public.brand_notifications;
drop policy if exists "brand_notifications_delete_own" on public.brand_notifications;

create policy "brand_notifications_select_own"
  on public.brand_notifications for select
  using (auth.uid() = user_id);

create policy "brand_notifications_insert_own"
  on public.brand_notifications for insert
  with check (auth.uid() = user_id);

create policy "brand_notifications_update_own"
  on public.brand_notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "brand_notifications_delete_own"
  on public.brand_notifications for delete
  using (auth.uid() = user_id);

-- ===========================================================================
-- P0 launch hardening: profiles, delivery + assignment on orders,
-- manufacturer portal tables, portal notifications, lifecycle triggers.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Profiles (one row per auth user; role drives portals)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'brand' check (role in ('brand', 'manufacturer', 'worker')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_superadmin" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_superadmin" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_select_superadmin"
  on public.profiles for select
  to authenticated
  using (public.is_superadmin());

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_update_superadmin"
  on public.profiles for update
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- A row may only be created for the caller themselves (the trigger handles signup).
create policy "profiles_insert_self"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create a profile whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that signed up before this trigger existed.
insert into public.profiles (id, email, full_name)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(coalesce(u.email, ''), '@', 1))
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Orders: delivery contact/address, assignment, manufacturer quote
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists delivery_address jsonb,
  add column if not exists assigned_manufacturer_id uuid references auth.users (id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists due_quote_by date,
  add column if not exists manufacturer_quote jsonb,
  add column if not exists factory_status text
    check (factory_status is null or factory_status in (
      'new', 'reviewing', 'clarifying', 'quoted', 'rejected', 'in_production', 'completed'
    )),
  add column if not exists factory_reject_reason text,
  add column if not exists quoted_at timestamptz,
  add column if not exists ops_notes text;

create index if not exists orders_assigned_idx
  on public.orders (assigned_manufacturer_id, created_at desc);

create index if not exists orders_status_idx
  on public.orders (status);

create index if not exists orders_factory_status_idx
  on public.orders (factory_status);

-- Admin: read every order; update any column (assignment, pricing, tracking, status).
drop policy if exists "orders_select_superadmin" on public.orders;
drop policy if exists "orders_update_superadmin" on public.orders;

create policy "orders_select_superadmin"
  on public.orders for select
  to authenticated
  using (public.is_superadmin());

create policy "orders_update_superadmin"
  on public.orders for update
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Manufacturer: read + update orders assigned to their account.
drop policy if exists "orders_select_assigned_manufacturer" on public.orders;
drop policy if exists "orders_update_assigned_manufacturer" on public.orders;

create policy "orders_select_assigned_manufacturer"
  on public.orders for select
  to authenticated
  using (auth.uid() = assigned_manufacturer_id);

create policy "orders_update_assigned_manufacturer"
  on public.orders for update
  to authenticated
  using (auth.uid() = assigned_manufacturer_id)
  with check (auth.uid() = assigned_manufacturer_id);

-- ---------------------------------------------------------------------------
-- Manufacturer profiles (onboarding + factory profile page)
-- ---------------------------------------------------------------------------

create table if not exists public.manufacturer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
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

create or replace function public.set_manufacturer_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists manufacturer_profiles_set_updated_at on public.manufacturer_profiles;
create trigger manufacturer_profiles_set_updated_at
  before update on public.manufacturer_profiles
  for each row
  execute function public.set_manufacturer_profiles_updated_at();

alter table public.manufacturer_profiles enable row level security;

drop policy if exists "manufacturer_profiles_select_own" on public.manufacturer_profiles;
drop policy if exists "manufacturer_profiles_select_superadmin" on public.manufacturer_profiles;
drop policy if exists "manufacturer_profiles_insert_own" on public.manufacturer_profiles;
drop policy if exists "manufacturer_profiles_update_own" on public.manufacturer_profiles;
drop policy if exists "manufacturer_profiles_update_superadmin" on public.manufacturer_profiles;

create policy "manufacturer_profiles_select_own"
  on public.manufacturer_profiles for select
  using (auth.uid() = user_id);

create policy "manufacturer_profiles_select_superadmin"
  on public.manufacturer_profiles for select
  to authenticated
  using (public.is_superadmin());

create policy "manufacturer_profiles_insert_own"
  on public.manufacturer_profiles for insert
  with check (auth.uid() = user_id);

create policy "manufacturer_profiles_update_own"
  on public.manufacturer_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "manufacturer_profiles_update_superadmin"
  on public.manufacturer_profiles for update
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- ---------------------------------------------------------------------------
-- Factory materials inventory
-- ---------------------------------------------------------------------------

create table if not exists public.factory_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('fabric', 'trim', 'packaging', 'other')),
  colour text,
  gsm integer,
  quantity numeric not null default 0,
  unit text not null default 'units' check (unit in ('metres', 'kg', 'rolls', 'units', 'cones')),
  reorder_at numeric not null default 0,
  supplier text,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists factory_materials_user_idx
  on public.factory_materials (user_id, updated_at desc);

create or replace function public.set_factory_materials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists factory_materials_set_updated_at on public.factory_materials;
create trigger factory_materials_set_updated_at
  before update on public.factory_materials
  for each row
  execute function public.set_factory_materials_updated_at();

alter table public.factory_materials enable row level security;

drop policy if exists "factory_materials_select_own" on public.factory_materials;
drop policy if exists "factory_materials_select_superadmin" on public.factory_materials;
drop policy if exists "factory_materials_insert_own" on public.factory_materials;
drop policy if exists "factory_materials_update_own" on public.factory_materials;
drop policy if exists "factory_materials_delete_own" on public.factory_materials;

create policy "factory_materials_select_own"
  on public.factory_materials for select
  using (auth.uid() = user_id);

create policy "factory_materials_select_superadmin"
  on public.factory_materials for select
  to authenticated
  using (public.is_superadmin());

create policy "factory_materials_insert_own"
  on public.factory_materials for insert
  with check (auth.uid() = user_id);

create policy "factory_materials_update_own"
  on public.factory_materials for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "factory_materials_delete_own"
  on public.factory_materials for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Factory capacity blocks (weeks marked full)
-- ---------------------------------------------------------------------------

create table if not exists public.factory_capacity_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  full boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.factory_capacity_blocks enable row level security;

drop policy if exists "factory_capacity_select_own" on public.factory_capacity_blocks;
drop policy if exists "factory_capacity_select_superadmin" on public.factory_capacity_blocks;
drop policy if exists "factory_capacity_insert_own" on public.factory_capacity_blocks;
drop policy if exists "factory_capacity_update_own" on public.factory_capacity_blocks;
drop policy if exists "factory_capacity_delete_own" on public.factory_capacity_blocks;

create policy "factory_capacity_select_own"
  on public.factory_capacity_blocks for select
  using (auth.uid() = user_id);

create policy "factory_capacity_select_superadmin"
  on public.factory_capacity_blocks for select
  to authenticated
  using (public.is_superadmin());

create policy "factory_capacity_insert_own"
  on public.factory_capacity_blocks for insert
  with check (auth.uid() = user_id);

create policy "factory_capacity_update_own"
  on public.factory_capacity_blocks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "factory_capacity_delete_own"
  on public.factory_capacity_blocks for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Portal notifications (superadmin inbox + manufacturer inbox)
-- user_id is null for superadmin (shared admin inbox), set for manufacturer.
-- ---------------------------------------------------------------------------

create table if not exists public.portal_notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('superadmin', 'manufacturer')),
  user_id uuid references auth.users (id) on delete cascade,
  category text not null check (category in ('order', 'pricing', 'message', 'shipping', 'capacity', 'team', 'system')),
  title text not null,
  body text not null,
  href text,
  order_id uuid references public.orders (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists portal_notifications_audience_idx
  on public.portal_notifications (audience, created_at desc);

create index if not exists portal_notifications_user_idx
  on public.portal_notifications (user_id, created_at desc);

alter table public.portal_notifications enable row level security;

drop policy if exists "portal_notifications_select_manufacturer" on public.portal_notifications;
drop policy if exists "portal_notifications_select_superadmin" on public.portal_notifications;
drop policy if exists "portal_notifications_update_manufacturer" on public.portal_notifications;
drop policy if exists "portal_notifications_update_superadmin" on public.portal_notifications;

create policy "portal_notifications_select_manufacturer"
  on public.portal_notifications for select
  to authenticated
  using (audience = 'manufacturer' and auth.uid() = user_id);

create policy "portal_notifications_select_superadmin"
  on public.portal_notifications for select
  to authenticated
  using (audience = 'superadmin' and public.is_superadmin());

create policy "portal_notifications_update_manufacturer"
  on public.portal_notifications for update
  to authenticated
  using (audience = 'manufacturer' and auth.uid() = user_id)
  with check (audience = 'manufacturer' and auth.uid() = user_id);

create policy "portal_notifications_update_superadmin"
  on public.portal_notifications for update
  to authenticated
  using (audience = 'superadmin' and public.is_superadmin())
  with check (audience = 'superadmin' and public.is_superadmin());

-- ---------------------------------------------------------------------------
-- Lifecycle triggers: keep inboxes in sync with real order state.
-- ---------------------------------------------------------------------------

create or replace function public.notify_superadmin(
  p_category text,
  p_title text,
  p_body text,
  p_href text,
  p_order_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.portal_notifications (audience, user_id, category, title, body, href, order_id)
  values ('superadmin', null, p_category, p_title, p_body, p_href, p_order_id);
end;
$$;

create or replace function public.notify_manufacturer(
  p_user_id uuid,
  p_category text,
  p_title text,
  p_body text,
  p_href text,
  p_order_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.portal_notifications (audience, user_id, category, title, body, href, order_id)
  values ('manufacturer', p_user_id, p_category, p_title, p_body, p_href, p_order_id);
end;
$$;

create or replace function public.notify_brand(
  p_user_id uuid,
  p_category text,
  p_title text,
  p_body text,
  p_href text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.brand_notifications (user_id, category, title, body, href)
  values (p_user_id, p_category, p_title, p_body, p_href);
end;
$$;

create or replace function public.orders_after_insert_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_superadmin(
    'order',
    case when new.kind = 'tech-pack' then 'New tech pack order' else 'New production order' end,
    new.product_name || ' submitted — needs review.',
    '/superadmin/orders',
    new.id
  );
  return new;
end;
$$;

drop trigger if exists orders_after_insert_notify on public.orders;
create trigger orders_after_insert_notify
  after insert on public.orders
  for each row execute function public.orders_after_insert_notify();

create or replace function public.orders_after_update_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  brand_href text := '/orders/' || new.id::text;
begin
  -- Order assigned to a manufacturer
  if new.assigned_manufacturer_id is not null
     and (old.assigned_manufacturer_id is null or old.assigned_manufacturer_id <> new.assigned_manufacturer_id) then
    if new.factory_status is null then
      new.factory_status := 'new';
    end if;
    perform public.notify_manufacturer(
      new.assigned_manufacturer_id,
      'order',
      'New order assigned',
      new.product_name || ' — quote due ' || coalesce(new.due_quote_by::text, 'soon') || '.',
      '/manufacturer/orders',
      new.id
    );
  end if;

  -- Manufacturer submitted a quote
  if new.factory_status = 'quoted' and coalesce(old.factory_status, '') <> 'quoted' then
    perform public.notify_superadmin(
      'pricing',
      'Manufacturer quoted order',
      new.product_name || ' — review pricing before sending to brand.',
      '/superadmin/orders/review',
      new.id
    );
  end if;

  -- Manufacturer declined
  if new.factory_status = 'rejected' and coalesce(old.factory_status, '') <> 'rejected' then
    perform public.notify_superadmin(
      'order',
      'Manufacturer declined order',
      new.product_name || coalesce(' — ' || new.factory_reject_reason, ''),
      '/superadmin/assignment',
      new.id
    );
  end if;

  -- Quote/pricing sent to the brand (status -> priced): tell them it is ready to pay
  if new.status = 'priced' and coalesce(old.status, '') <> 'priced' then
    perform public.notify_brand(
      new.user_id,
      'order',
      'Your quote is ready',
      new.product_name || ' — review pricing and pay from your order page.',
      brand_href
    );
  end if;

  -- Brand paid
  if new.status = 'paid' and coalesce(old.status, '') <> 'paid' then
    perform public.notify_brand(
      new.user_id,
      'payment',
      'Payment received',
      new.product_name || ' — we are getting started.',
      brand_href
    );
    perform public.notify_superadmin(
      'order',
      'Order paid',
      new.product_name || ' paid by brand.',
      '/superadmin/orders/' || new.id::text,
      new.id
    );
  end if;

  -- Shipped with tracking
  if new.status = 'shipping' and coalesce(old.status, '') <> 'shipping' then
    perform public.notify_brand(
      new.user_id,
      'shipping',
      'Order shipped',
      coalesce('Tracking: ' || new.tracking, new.product_name || ' is on its way.'),
      brand_href
    );
  end if;

  -- Completed
  if new.status = 'completed' and coalesce(old.status, '') <> 'completed' then
    perform public.notify_brand(
      new.user_id,
      'order',
      'Order completed',
      new.product_name || ' is complete.',
      brand_href
    );
  end if;

  return new;
end;
$$;

drop trigger if exists orders_after_update_notify on public.orders;
create trigger orders_after_update_notify
  before update on public.orders
  for each row execute function public.orders_after_update_notify();

-- ---------------------------------------------------------------------------
-- Storage: superadmin can read uploaded tech packs (order review needs them)
-- ---------------------------------------------------------------------------

drop policy if exists "order_uploads_admin_read" on storage.objects;
create policy "order_uploads_admin_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'order-uploads'
    and public.is_superadmin()
  );
