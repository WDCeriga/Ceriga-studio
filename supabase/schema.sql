-- Ceriga Studio — run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Creates the projects table and row-level security so each user only sees their own drafts.

create extension if not exists "pgcrypto";

create table if not exists public.superadmin_emails (
  email text primary key
);

insert into public.superadmin_emails (email) values
  ('owner@ceriga.io'),
  ('xexead@ceriga.io'),
  ('maya.chen@ceriga.io'),
  ('j.okonkwo@ceriga.io'),
  ('superadmin@ceriga.co')
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
  -- Included at creation as well as the compatibility ALTER below (20261018 repair).
  contact_name text,
  contact_email text,
  contact_phone text,
  delivery_address jsonb,
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

drop policy if exists "orders_delete_superadmin" on public.orders;
create policy "orders_delete_superadmin"
  on public.orders for delete
  to authenticated
  using (public.is_superadmin());

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
-- Invitation-only manufacturer account activation
-- ---------------------------------------------------------------------------

create table if not exists public.manufacturer_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz
);

alter table public.manufacturer_invites enable row level security;
revoke all on public.manufacturer_invites from anon, authenticated;

create or replace function public.create_manufacturer_invite(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_email text := lower(trim(p_email));
  invite_token text := encode(gen_random_bytes(32), 'hex');
begin
  if auth.uid() is null or not public.is_superadmin() then
    raise exception 'Superadmin access required';
  end if;
  if invite_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address';
  end if;

  insert into public.manufacturer_invites (email, token_hash, created_by, expires_at)
  values (
    invite_email,
    encode(digest(invite_token, 'sha256'), 'hex'),
    auth.uid(),
    now() + interval '7 days'
  );
  return invite_token;
end;
$$;

create or replace function public.redeem_manufacturer_invite(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
  invite_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in before redeeming the manufacturer invitation';
  end if;

  select lower(email) into current_email from auth.users where id = auth.uid();
  if current_email is null then
    raise exception 'Could not verify the signed-in email';
  end if;

  select id into invite_id
  from public.manufacturer_invites
  where token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
    and email = current_email
    and redeemed_at is null
    and expires_at > now()
  for update;

  if invite_id is null then
    raise exception 'Invitation is invalid, expired, already used, or belongs to another email';
  end if;

  update public.profiles set role = 'manufacturer' where id = auth.uid();
  if not found then
    raise exception 'Account profile is not ready; try again shortly';
  end if;

  update public.manufacturer_invites set redeemed_at = now() where id = invite_id;
end;
$$;

revoke all on function public.create_manufacturer_invite(text) from public, anon;
revoke all on function public.redeem_manufacturer_invite(text) from public, anon;
grant execute on function public.create_manufacturer_invite(text) to authenticated;
grant execute on function public.redeem_manufacturer_invite(text) to authenticated;

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
  "full" boolean not null default true,
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

-- ---------------------------------------------------------------------------
-- Demock: profiles credits, manufacturer status, platform settings, admin chat
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists message_credits integer not null default 0;

alter table public.manufacturer_profiles
  add column if not exists status text not null default 'onboarding'
    check (status in ('active', 'paused', 'onboarding')),
  add column if not exists specialties text[] not null default '{}'::text[],
  add column if not exists certifications text[] not null default '{}'::text[],
  add column if not exists country text,
  add column if not exists city text;

drop policy if exists "manufacturer_profiles_insert_superadmin" on public.manufacturer_profiles;
create policy "manufacturer_profiles_insert_superadmin"
  on public.manufacturer_profiles for insert
  to authenticated
  with check (public.is_superadmin());

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

drop policy if exists "platform_settings_select_superadmin" on public.platform_settings;
drop policy if exists "platform_settings_upsert_superadmin" on public.platform_settings;

create policy "platform_settings_select_superadmin"
  on public.platform_settings for select
  to authenticated
  using (public.is_superadmin());

create policy "platform_settings_upsert_superadmin"
  on public.platform_settings for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

insert into public.platform_settings (key, value)
values (
  'pricing',
  '{
    "techPack": {"currency": "EUR", "pdfCents": 2900, "bundleCents": 4900},
    "chatPlans": [
      {"id": "free", "tier": "Free", "monthlyCents": 0, "messageLimit": 20, "published": true},
      {"id": "studio", "tier": "Studio", "monthlyCents": 1900, "messageLimit": 500, "published": true},
      {"id": "scale", "tier": "Scale", "monthlyCents": 4900, "messageLimit": 2000, "published": true, "featured": true},
      {"id": "business", "tier": "Business", "monthlyCents": 9900, "messageLimit": 10000, "published": true}
    ],
    "production": {
      "currency": "GBP",
      "defaultPlanId": "standard",
      "estimatedDutiesPercent": 0,
      "planMargins": [
        {"planId": "standard", "planName": "Standard", "platformMarginPercent": 17.5},
        {"planId": "preferred", "planName": "Preferred", "platformMarginPercent": 15},
        {"planId": "priority", "planName": "Priority", "platformMarginPercent": 12}
      ]
    }
  }'::jsonb
)
on conflict (key) do nothing;

create table if not exists public.admin_chat_threads (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'ceriga'
    check (channel in ('ceriga', 'alibaba')),
  participant_user_id uuid references auth.users (id) on delete cascade,
  participant_type text not null
    check (participant_type in ('brand', 'manufacturer', 'alibaba')),
  subject text not null default 'Conversation',
  last_message text not null default '',
  last_message_at timestamptz not null default now(),
  unread_admin integer not null default 0,
  external_conversation_id text,
  external_peer_account_id text,
  external_peer_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_chat_threads_ceriga_participant_chk check (
    (channel = 'ceriga' and participant_user_id is not null and participant_type in ('brand', 'manufacturer'))
    or (channel = 'alibaba' and participant_type = 'alibaba')
  )
);

-- Upgrade path for DBs that already created the older admin_chat_* shape.
alter table public.admin_chat_threads
  add column if not exists channel text;
alter table public.admin_chat_threads
  add column if not exists external_conversation_id text;
alter table public.admin_chat_threads
  add column if not exists external_peer_account_id text;
alter table public.admin_chat_threads
  add column if not exists external_peer_name text;

update public.admin_chat_threads
set channel = 'ceriga'
where channel is null;

alter table public.admin_chat_threads
  alter column channel set default 'ceriga';
alter table public.admin_chat_threads
  alter column channel set not null;

alter table public.admin_chat_threads
  alter column participant_user_id drop not null;

alter table public.admin_chat_threads
  drop constraint if exists admin_chat_threads_participant_type_check;
alter table public.admin_chat_threads
  drop constraint if exists admin_chat_threads_channel_check;
alter table public.admin_chat_threads
  drop constraint if exists admin_chat_threads_ceriga_participant_chk;

alter table public.admin_chat_threads
  add constraint admin_chat_threads_channel_check
  check (channel in ('ceriga', 'alibaba'));
alter table public.admin_chat_threads
  add constraint admin_chat_threads_participant_type_check
  check (participant_type in ('brand', 'manufacturer', 'alibaba'));
alter table public.admin_chat_threads
  add constraint admin_chat_threads_ceriga_participant_chk check (
    (channel = 'ceriga' and participant_user_id is not null and participant_type in ('brand', 'manufacturer'))
    or (channel = 'alibaba' and participant_type = 'alibaba')
  );

create unique index if not exists admin_chat_threads_alibaba_conversation_uidx
  on public.admin_chat_threads (external_conversation_id)
  where external_conversation_id is not null;

create index if not exists admin_chat_threads_updated_idx
  on public.admin_chat_threads (last_message_at desc);

create index if not exists admin_chat_threads_channel_idx
  on public.admin_chat_threads (channel, last_message_at desc);

create table if not exists public.admin_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.admin_chat_threads (id) on delete cascade,
  sender text not null check (sender in ('admin', 'participant')),
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  external_message_id text,
  created_at timestamptz not null default now()
);

alter table public.admin_chat_messages
  add column if not exists external_message_id text;

create unique index if not exists admin_chat_messages_external_uidx
  on public.admin_chat_messages (thread_id, external_message_id)
  where external_message_id is not null;

create index if not exists admin_chat_messages_thread_idx
  on public.admin_chat_messages (thread_id, created_at);

alter table public.admin_chat_threads enable row level security;
alter table public.admin_chat_messages enable row level security;
grant select,insert,update,delete on public.admin_chat_threads,public.admin_chat_messages to authenticated;

drop policy if exists "admin_chat_threads_superadmin" on public.admin_chat_threads;
drop policy if exists "admin_chat_threads_participant" on public.admin_chat_threads;
drop policy if exists "admin_chat_messages_superadmin" on public.admin_chat_messages;
drop policy if exists "admin_chat_messages_participant" on public.admin_chat_messages;

create policy "admin_chat_threads_superadmin"
  on public.admin_chat_threads for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy "admin_chat_threads_participant"
  on public.admin_chat_threads for select
  to authenticated
  using (auth.uid() = participant_user_id);

create policy "admin_chat_messages_superadmin"
  on public.admin_chat_messages for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy "admin_chat_messages_participant"
  on public.admin_chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_chat_threads t
      where t.id = thread_id and t.participant_user_id = auth.uid()
    )
  );

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

-- One account preference inside the existing profile pricing object.
-- Old rows and historical order/quote amounts are not rewritten or converted.
alter table public.manufacturer_profiles add column if not exists pricing jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'manufacturer_profiles_pricing_object'
    and conrelid = 'public.manufacturer_profiles'::regclass) then
    alter table public.manufacturer_profiles add constraint manufacturer_profiles_pricing_object
      check (pricing is null or (jsonb_typeof(pricing) = 'object' and pricing->>'preferredCurrency' in ('GBP','USD','EUR')));
  end if;
end;
$$;

-- Complete application-level superadmin permissions
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

-- Shared messaging across member roles
-- Connect existing admin threads to authenticated peer replies and direct messaging.
begin;
alter table public.admin_chat_threads add column if not exists recipient_user_id uuid references auth.users(id) on delete cascade;
alter table public.admin_chat_messages add column if not exists sender_user_id uuid references auth.users(id) on delete set null;
update public.admin_chat_messages m set sender_user_id=t.participant_user_id from public.admin_chat_threads t
  where m.thread_id=t.id and m.sender='participant' and m.sender_user_id is null and t.channel='ceriga' and t.recipient_user_id is null;
create index if not exists admin_chat_recipient_idx on public.admin_chat_threads(recipient_user_id,last_message_at desc);
create unique index if not exists admin_chat_direct_pair_idx on public.admin_chat_threads
  (least(participant_user_id,recipient_user_id),greatest(participant_user_id,recipient_user_id))
  where channel='ceriga' and recipient_user_id is not null;

create or replace function public.can_access_chat(p_thread uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists(select 1 from public.admin_chat_threads t where t.id=p_thread
    and (public.is_superadmin() or (t.channel='ceriga' and auth.uid() in (t.participant_user_id,t.recipient_user_id))));
$$;
revoke all on function public.can_access_chat(uuid) from public,anon;
grant execute on function public.can_access_chat(uuid) to authenticated;
drop policy if exists admin_chat_threads_participant on public.admin_chat_threads;
create policy admin_chat_threads_participant on public.admin_chat_threads for select to authenticated
  using(channel='ceriga' and auth.uid() in (participant_user_id,recipient_user_id));
drop policy if exists admin_chat_messages_participant on public.admin_chat_messages;
create policy admin_chat_messages_participant on public.admin_chat_messages for select to authenticated using(public.can_access_chat(thread_id));
drop policy if exists admin_chat_messages_reply on public.admin_chat_messages;
create policy admin_chat_messages_reply on public.admin_chat_messages for insert to authenticated
  with check(public.can_access_chat(thread_id) and sender_user_id=auth.uid() and sender=case when public.is_superadmin() then 'admin' else 'participant' end);

create or replace function public.chat_contacts()
returns table(id uuid,name text,role text) language sql stable security definer set search_path=public as $$
  select p.id,coalesce(nullif(p.full_name,''),'Studio member'),p.role from public.profiles p
  where auth.uid() is not null and p.id<>auth.uid()
    and not exists(select 1 from public.superadmin_emails a where lower(a.email)=lower(p.email))
  order by p.full_name nulls last;
$$;
revoke all on function public.chat_contacts() from public,anon;
grant execute on function public.chat_contacts() to authenticated;

create or replace function public.start_chat(p_recipient uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare caller uuid:=auth.uid(); target uuid:=p_recipient; caller_role text; thread_id uuid;
begin
  if caller is null then raise exception 'Sign in to start a conversation'; end if;
  if target=caller then raise exception 'Choose another account'; end if;
  select role into caller_role from public.profiles where id=caller;
  if caller_role is null then raise exception 'Account profile is missing'; end if;
  if target is not null and not exists(select 1 from public.profiles where id=target) then raise exception 'Account not found'; end if;
  if target is not null and exists(select 1 from public.profiles p join public.superadmin_emails a on lower(p.email)=lower(a.email) where p.id=target) then target:=null; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(caller::text,coalesce(target::text,'support'))||':'||greatest(caller::text,coalesce(target::text,'support')),0));
  select id into thread_id from public.admin_chat_threads t where t.channel='ceriga'
    and ((target is null and t.participant_user_id=caller and t.recipient_user_id is null)
      or (target is not null and ((t.participant_user_id=caller and t.recipient_user_id=target) or (t.participant_user_id=target and t.recipient_user_id=caller))))
    order by t.created_at limit 1;
  if thread_id is null then
    insert into public.admin_chat_threads(channel,participant_user_id,recipient_user_id,participant_type,subject)
    values('ceriga',caller,target,case when caller_role='manufacturer' then 'manufacturer' else 'brand' end,'Conversation') returning id into thread_id;
  end if;
  return thread_id;
end;
$$;
revoke all on function public.start_chat(uuid) from public,anon;
grant execute on function public.start_chat(uuid) to authenticated;

create or replace function public.stamp_chat_sender()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null then
    if not public.can_access_chat(new.thread_id) then raise exception 'Conversation access denied'; end if;
    new.sender_user_id:=auth.uid();
    new.sender:=case when public.is_superadmin() then 'admin' else 'participant' end;
  end if;
  return new;
end;
$$;
drop trigger if exists chat_stamp_sender on public.admin_chat_messages;
create trigger chat_stamp_sender before insert on public.admin_chat_messages for each row execute function public.stamp_chat_sender();
create or replace function public.update_chat_summary()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.admin_chat_threads set last_message=coalesce(nullif(left(new.body,200),''),'Attachment'),last_message_at=new.created_at,
    updated_at=now(),unread_admin=case when new.sender='admin' then 0 else unread_admin+1 end where id=new.thread_id;
  return new;
end;
$$;
drop trigger if exists chat_update_summary on public.admin_chat_messages;
create trigger chat_update_summary after insert on public.admin_chat_messages for each row execute function public.update_chat_summary();

insert into storage.buckets(id,name,public,file_size_limit) values('chat-attachments','chat-attachments',false,10485760) on conflict(id) do nothing;
drop policy if exists chat_attachment_read on storage.objects;
create policy chat_attachment_read on storage.objects for select to authenticated
  using(bucket_id='chat-attachments' and public.can_access_chat(((storage.foldername(name))[1])::uuid));
drop policy if exists chat_attachment_insert on storage.objects;
create policy chat_attachment_insert on storage.objects for insert to authenticated
  with check(bucket_id='chat-attachments' and public.can_access_chat(((storage.foldername(name))[1])::uuid));
grant select,insert,update,delete on public.admin_chat_threads,public.admin_chat_messages to authenticated;
alter table public.admin_chat_threads replica identity full;
alter table public.admin_chat_messages replica identity full;
do $$ declare table_name text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach table_name in array array['admin_chat_threads','admin_chat_messages'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
        execute format('alter publication supabase_realtime add table public.%I',table_name);
      end if;
    end loop;
  end if;
end $$;
notify pgrst,'reload schema';
commit;

-- Keep existing history, but limit active messaging to factories, their teams and Ceriga.
begin;
alter table public.manufacturer_profiles add column if not exists messaging_team_emails text[] not null default '{}';
create index if not exists manufacturer_messaging_team_idx on public.manufacturer_profiles using gin(messaging_team_emails);

create or replace function public.chat_factory_ids()
returns setof uuid language sql stable security definer set search_path=public as $$
  select m.user_id from public.manufacturer_profiles m
  where auth.uid() is not null and (m.user_id=auth.uid() or exists(
    select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null
      and lower(u.email)=any(m.messaging_team_emails)));
$$;
revoke all on function public.chat_factory_ids() from public,anon;
grant execute on function public.chat_factory_ids() to authenticated;

create or replace function public.messaging_enabled()
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (public.is_superadmin() or exists(select 1 from public.chat_factory_ids()));
$$;
revoke all on function public.messaging_enabled() from public,anon;
grant execute on function public.messaging_enabled() to authenticated;

create or replace function public.set_messaging_teammate(p_email text,p_enabled boolean)
returns void language plpgsql security definer set search_path=public as $$
declare normalized text:=lower(trim(p_email));
begin
 if normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid teammate email'; end if;
 update public.manufacturer_profiles set messaging_team_emails=case when p_enabled then
   array(select distinct unnest(messaging_team_emails||array[normalized]))
   else array_remove(messaging_team_emails,normalized) end where user_id=auth.uid();
 if not found then raise exception 'Only the manufacturer account owner can manage messaging teammates'; end if;
end;
$$;
revoke all on function public.set_messaging_teammate(text,boolean) from public,anon;
grant execute on function public.set_messaging_teammate(text,boolean) to authenticated;

create or replace function public.can_access_chat(p_thread uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.admin_chat_threads t where t.id=p_thread
 and (public.is_superadmin() or (t.channel='ceriga' and t.recipient_user_id is null
   and t.participant_user_id in(select public.chat_factory_ids()))));
$$;
drop policy if exists admin_chat_threads_participant on public.admin_chat_threads;
create policy admin_chat_threads_participant on public.admin_chat_threads for select to authenticated using(public.can_access_chat(id));

create or replace function public.chat_contacts()
returns table(id uuid,name text,role text) language sql stable security definer set search_path=public as $$
 select p.id,case when public.is_superadmin() then coalesce(nullif(p.full_name,''),'Manufacturer')
   else 'Ceriga Support — '||coalesce(nullif(p.full_name,''),'Your factory') end,
   case when public.is_superadmin() then 'manufacturer' else 'superadmin' end
 from public.manufacturer_profiles m join public.profiles p on p.id=m.user_id
 where public.is_superadmin() or m.user_id in(select public.chat_factory_ids()) order by p.full_name nulls last;
$$;

create or replace function public.start_chat(p_recipient uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare factory uuid; thread_id uuid;
begin
 if not public.messaging_enabled() then raise exception 'Messaging is available only to manufacturers, their teams and Ceriga administrators'; end if;
 if public.is_superadmin() then
   select user_id into factory from public.manufacturer_profiles where user_id=p_recipient;
 else
   select id into factory from public.chat_factory_ids() id where p_recipient is null or id=p_recipient order by id limit 1;
 end if;
 if factory is null then raise exception 'Choose an authorized manufacturer conversation'; end if;
 perform pg_advisory_xact_lock(hashtextextended('factory-support:'||factory::text,0));
 select id into thread_id from public.admin_chat_threads where channel='ceriga' and participant_user_id=factory and recipient_user_id is null order by created_at limit 1;
 if thread_id is null then
   insert into public.admin_chat_threads(channel,participant_user_id,participant_type,subject)
   values('ceriga',factory,'manufacturer','Manufacturer conversation') returning id into thread_id;
 end if;
 return thread_id;
end;
$$;

-- Even privileged UI inserts must not create a new brand conversation.
create or replace function public.check_chat_participants()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.channel='ceriga' and (new.recipient_user_id is not null or not exists(
   select 1 from public.manufacturer_profiles where user_id=new.participant_user_id)) then
   raise exception 'Messaging is restricted to manufacturer conversations with Ceriga';
 end if;
 return new;
end;
$$;
drop trigger if exists chat_check_participants on public.admin_chat_threads;
create trigger chat_check_participants before insert or update of participant_user_id,recipient_user_id,channel
 on public.admin_chat_threads for each row execute function public.check_chat_participants();
create or replace function public.stamp_chat_sender()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null then
   if not public.can_access_chat(new.thread_id) or exists(select 1 from public.admin_chat_threads t
     where t.id=new.thread_id and t.channel='ceriga' and (t.recipient_user_id is not null or not exists(
       select 1 from public.manufacturer_profiles m where m.user_id=t.participant_user_id))) then
     raise exception 'Conversation access denied';
   end if;
   new.sender_user_id:=auth.uid();
   new.sender:=case when public.is_superadmin() then 'admin' else 'participant' end;
 end if;
 return new;
end;
$$;
notify pgrst,'reload schema';
commit;

-- The existing orders row remains the single assignment record. No order data is rewritten.
begin;
alter table public.orders enable row level security;
grant select on public.orders to authenticated;
drop policy if exists orders_read_assigned_factory on public.orders;
create policy orders_read_assigned_factory on public.orders for select to authenticated using(auth.uid()=assigned_manufacturer_id);
drop policy if exists order_uploads_read_assigned_factory on storage.objects;
create policy order_uploads_read_assigned_factory on storage.objects for select to authenticated using(
 bucket_id='order-uploads' and exists(select 1 from public.orders o where o.assigned_manufacturer_id=auth.uid() and coalesce(o.quote_request->'storagePaths','[]'::jsonb) ? name)
);
-- Assignment decisions belong to allowlisted superadmins, including direct API requests.
create or replace function public.protect_manual_order_assignment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and not public.is_superadmin() then
  if (tg_op='INSERT' and (new.assigned_manufacturer_id is not null or new.assigned_at is not null or new.due_quote_by is not null)) or (tg_op='UPDATE' and (new.assigned_manufacturer_id is distinct from old.assigned_manufacturer_id or new.assigned_at is distinct from old.assigned_at or new.due_quote_by is distinct from old.due_quote_by)) then raise exception 'Only a superadmin may assign a manufacturer or change its quotation deadline';end if;
 end if;
 if new.assigned_manufacturer_id is not null and (tg_op='INSERT' or new.assigned_manufacturer_id is distinct from old.assigned_manufacturer_id) and not exists(select 1 from public.manufacturer_profiles m where m.user_id=new.assigned_manufacturer_id and m.onboarding_complete and m.status is distinct from 'paused') then raise exception 'Choose an onboarded, available manufacturer';end if;
 return new;
end $$;
drop trigger if exists orders_assignment_admin_only on public.orders;
create trigger orders_assignment_admin_only before insert or update on public.orders for each row execute function public.protect_manual_order_assignment();

notify pgrst,'reload schema';
commit;
begin;
create or replace function public.submit_manufacturer_quote(p_order_id uuid, p_tiers jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare target public.orders%rowtype; tier jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to submit a quotation'; end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.assigned_manufacturer_id is distinct from auth.uid() then
  raise exception 'This order is not assigned to your factory';
 end if;
 if target.status not in ('submitted','awaiting_payment') or coalesce(target.factory_status,'new') not in ('new','reviewing','clarifying','quoted') then
  raise exception 'This order is no longer accepting manufacturer quotations';
 end if;
 if jsonb_typeof(p_tiers) is distinct from 'array' or jsonb_array_length(p_tiers) not between 1 and 20 then raise exception 'Provide at least one quotation tier'; end if;
 for tier in select value from jsonb_array_elements(p_tiers) loop
  if jsonb_typeof(tier) is distinct from 'object'
    or coalesce(tier->>'id','')='' or coalesce(tier->>'label','')=''
    or coalesce(tier->>'kind','') not in ('sample','bulk')
    or coalesce(tier->>'currency','')<>'GBP'
    or coalesce(tier->>'totalUnits','') !~ '^[1-9][0-9]*$'
    or coalesce(tier->>'manufacturerQuoteCents','') !~ '^[1-9][0-9]*$'
    or coalesce(tier->>'leadTimeDays','') !~ '^[1-9][0-9]*$'
  then raise exception 'Each tier requires quantity, a positive GBP total and lead time'; end if;
  if (tier->>'manufacturerQuoteCents')::numeric>100000000000 or (tier->>'totalUnits')::numeric>100000000 or (tier->>'leadTimeDays')::numeric>3650 then raise exception 'Quotation values exceed supported limits';end if;
 end loop;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_tiers))<>jsonb_array_length(p_tiers) then raise exception 'Quotation tier IDs must be unique'; end if;
 update public.orders set manufacturer_quote=p_tiers, factory_status='quoted', quoted_at=now() where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.submit_manufacturer_quote(uuid,jsonb) from public,anon;
grant execute on function public.submit_manufacturer_quote(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
begin;
-- Derive every quantity and extended price from the saved customer request.
create or replace function public.submit_manufacturer_quote(p_order_id uuid, p_tiers jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; requirement jsonb; tier jsonb; requirements jsonb; normalized jsonb := '[]'; units numeric; unit_price numeric; days numeric; line_id text; line_kind text;
begin
 if auth.uid() is null then raise exception 'Sign in to submit a quotation';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.assigned_manufacturer_id is distinct from auth.uid() then raise exception 'This order is not assigned to your factory';end if;
 if target.status not in('submitted','awaiting_payment') or coalesce(target.factory_status,'new') not in('new','reviewing','clarifying','quoted') then raise exception 'This order is no longer accepting manufacturer quotations';end if;
 if jsonb_typeof(target.order_quantities->'sample')='object' then
  requirements := case when coalesce((target.order_quantities->'sample'->>'targetTotal')::numeric,(select sum(value::numeric) from jsonb_each_text(coalesce(target.order_quantities->'sample'->'bySize','{}'::jsonb))),0)>0 then jsonb_build_array(target.order_quantities->'sample') else '[]'::jsonb end || coalesce(target.order_quantities->'bulkRuns','[]'::jsonb);
 elsif coalesce(target.quote_request->>'quantity','') ~ '^[1-9][0-9]*$' then
  requirements := jsonb_build_array(jsonb_build_object('id','factory-quote','kind','bulk','targetTotal',(target.quote_request->>'quantity')::numeric));
 else raise exception 'The customer quantity is missing. Ask Ceriga to complete the order quantities';end if;
 if jsonb_typeof(p_tiers) is distinct from 'array' or jsonb_array_length(p_tiers)<>jsonb_array_length(requirements) or jsonb_array_length(p_tiers) not between 1 and 20 then raise exception 'Quote every customer quantity option';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_tiers))<>jsonb_array_length(p_tiers) then raise exception 'Quotation tier IDs must be unique';end if;
 for requirement in select value from jsonb_array_elements(requirements) loop
  line_id := requirement->>'id'; line_kind := requirement->>'kind';
  units := coalesce((requirement->>'targetTotal')::numeric,(select sum(value::numeric) from jsonb_each_text(coalesce(requirement->'bySize','{}'::jsonb))));
  if units is null or units<=0 or units<>trunc(units) or units>100000000 then raise exception 'The customer quantity is missing or invalid';end if;
  select value into tier from jsonb_array_elements(p_tiers) where value->>'id'=line_id;
  if tier is null or coalesce(tier->>'currency','')<>'GBP' or coalesce(tier->>'unitPriceCents','') !~ '^[1-9][0-9]*$' or coalesce(tier->>'leadTimeDays','') !~ '^[1-9][0-9]*$' then raise exception 'Each option requires a positive GBP unit price and lead time';end if;
  unit_price := (tier->>'unitPriceCents')::numeric; days := (tier->>'leadTimeDays')::numeric;
  if days>3650 or unit_price*units>100000000000 then raise exception 'Quotation values exceed supported limits';end if;
  normalized := normalized || jsonb_build_array(jsonb_build_object('id',line_id,'kind',line_kind,'label',case when line_kind='sample' then 'Samples' else 'Bulk · '||units::text||' units' end,'totalUnits',units,'unitPriceCents',unit_price,'manufacturerQuoteCents',unit_price*units,'currency','GBP','leadTimeDays',days));
 end loop;
 update public.orders set manufacturer_quote=normalized,factory_status='quoted',factory_reject_reason=null,quoted_at=now() where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.submit_manufacturer_quote(uuid,jsonb) from public,anon;
grant execute on function public.submit_manufacturer_quote(uuid,jsonb) to authenticated;

-- Manufacturers may decline assignments; superadmins may return submitted quotes for revision.
create or replace function public.reject_order_quotation(p_order_id uuid,p_reason text)
returns text language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; next_status text;
begin
 if auth.uid() is null then raise exception 'Sign in to reject a quotation';end if;
 if length(btrim(coalesce(p_reason,'')))<3 or length(p_reason)>2000 then raise exception 'Give a reason between 3 and 2000 characters';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order unavailable';end if;
 if target.status not in('submitted','awaiting_payment') then raise exception 'This order is no longer accepting quotation changes';end if;
 if public.is_superadmin() then
  if target.factory_status is distinct from 'quoted' then raise exception 'Only a submitted quotation can be returned for revision';end if;
  next_status := 'clarifying';
 elsif target.assigned_manufacturer_id=auth.uid() then
  if coalesce(target.factory_status,'new') not in('new','reviewing','clarifying','quoted') then raise exception 'This assignment has already been declined';end if;
  next_status := 'rejected';
 else raise exception 'This order is not assigned to your factory';end if;
 update public.orders set factory_status=next_status,factory_reject_reason=btrim(p_reason) where id=p_order_id;
 return next_status;
end $$;
revoke all on function public.reject_order_quotation(uuid,text) from public,anon;
grant execute on function public.reject_order_quotation(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;

begin;
-- Derive every quantity and extended price from the saved customer request.
create or replace function public.submit_manufacturer_quote(p_order_id uuid, p_tiers jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; requirement jsonb; tier jsonb; requirements jsonb; normalized jsonb := '[]'; units numeric; unit_price numeric; days numeric; line_id text; line_kind text; quote_currency text;
begin
 if auth.uid() is null then raise exception 'Sign in to submit a quotation';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.assigned_manufacturer_id is distinct from auth.uid() then raise exception 'This order is not assigned to your factory';end if;
 if target.status not in('submitted','awaiting_payment') or coalesce(target.factory_status,'new') not in('new','reviewing','clarifying','quoted') then raise exception 'This order is no longer accepting manufacturer quotations';end if;
 if jsonb_array_length(coalesce(target.manufacturer_quote,'[]'::jsonb))>0 then
  quote_currency := coalesce(target.manufacturer_quote->0->>'currency','GBP');
 else
  select coalesce(pricing->>'preferredCurrency','GBP') into quote_currency from public.manufacturer_profiles where user_id=auth.uid();
 end if;
 if quote_currency is null or quote_currency not in('GBP','USD','EUR') then quote_currency:='GBP';end if;
 if jsonb_typeof(target.order_quantities->'sample')='object' then
  requirements := jsonb_build_array(target.order_quantities->'sample') || coalesce(target.order_quantities->'bulkRuns','[]'::jsonb);
 elsif coalesce(target.quote_request->>'quantity','') ~ '^[1-9][0-9]*$' then
  requirements := jsonb_build_array(jsonb_build_object('id','factory-quote','kind','bulk','targetTotal',(target.quote_request->>'quantity')::numeric));
 else raise exception 'The customer quantity is missing. Ask Ceriga to complete the order quantities';end if;
 if jsonb_typeof(p_tiers) is distinct from 'array' or jsonb_array_length(p_tiers)<>jsonb_array_length(requirements) or jsonb_array_length(p_tiers) not between 1 and 20 then raise exception 'Quote every customer quantity option';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_tiers))<>jsonb_array_length(p_tiers) then raise exception 'Quotation tier IDs must be unique';end if;
 for requirement in select value from jsonb_array_elements(requirements) loop
  line_id := requirement->>'id'; line_kind := requirement->>'kind';
  units := coalesce((requirement->>'targetTotal')::numeric,(select sum(value::numeric) from jsonb_each_text(coalesce(requirement->'bySize','{}'::jsonb))));
  if units is null or units<=0 or units<>trunc(units) or units>100000000 then raise exception 'The customer quantity is missing or invalid';end if;
  select value into tier from jsonb_array_elements(p_tiers) where value->>'id'=line_id;
  if tier is null or coalesce(tier->>'currency','')<>quote_currency or coalesce(tier->>'unitPriceCents','') !~ '^[1-9][0-9]*$' or coalesce(tier->>'leadTimeDays','') !~ '^[1-9][0-9]*$' then raise exception 'Each option requires a positive unit price in the quotation currency and a lead time';end if;
  unit_price := (tier->>'unitPriceCents')::numeric; days := (tier->>'leadTimeDays')::numeric;
  if days>3650 or unit_price*units>100000000000 then raise exception 'Quotation values exceed supported limits';end if;
  normalized := normalized || jsonb_build_array(jsonb_build_object('id',line_id,'kind',line_kind,'label',case when line_kind='sample' then 'Samples' else 'Bulk · '||units::text||' units' end,'totalUnits',units,'unitPriceCents',unit_price,'manufacturerQuoteCents',unit_price*units,'currency',quote_currency,'leadTimeDays',days));
 end loop;
 update public.orders set manufacturer_quote=normalized,factory_status='quoted',factory_reject_reason=null,quoted_at=now() where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.submit_manufacturer_quote(uuid,jsonb) from public,anon;
grant execute on function public.submit_manufacturer_quote(uuid,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
begin;
-- Existing records retain NULL version and their original status/price/assignment/timestamps.
alter table public.orders add column if not exists routing_version integer;
alter table public.orders alter column routing_version set default 2;
alter table public.orders add column if not exists quote_expires_at timestamptz;
alter table public.orders add column if not exists offer_issued_at timestamptz;
alter table public.orders add column if not exists payment_verified_at timestamptz;
alter table public.orders add column if not exists production_released_at timestamptz;
create index if not exists orders_offer_expiry_idx on public.orders(quote_expires_at) where status='priced';
create table if not exists public.order_routing_events(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,event_type text not null,
 manufacturer_id uuid references auth.users(id) on delete set null,details jsonb not null default '{}',created_at timestamptz not null default now());
create index if not exists order_routing_events_order_idx on public.order_routing_events(order_id,created_at);
create table if not exists public.order_payment_controls(id boolean primary key default true check(id),enabled boolean not null default false);
insert into public.order_payment_controls(id,enabled)values(true,false)on conflict(id)do nothing;
create table if not exists public.order_verified_payments(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),provider_event_id text not null unique,
 option_id text not null,amount_cents bigint not null check(amount_cents>0),currency text not null check(currency in('GBP','USD','EUR')),
 provider_paid_at timestamptz not null,verified_at timestamptz not null default now());
create unique index if not exists order_verified_payment_order_idx on public.order_verified_payments(order_id);
-- Only the existing migration-only superadmin helper supplies application-wide admin access.
create or replace function public.apply_superadmin_access()
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare table_name text;
begin
  foreach table_name in array array[
    'projects','orders','packaging_library','brand_notifications','profiles',
    'manufacturer_profiles','manufacturer_invites','factory_materials',
    'factory_capacity_blocks','portal_notifications','measurement_guide_packs',
    'platform_settings','admin_chat_threads','admin_chat_messages',
    'manufacturer_customisation_settings','superadmin_emails',
    'order_routing_events','order_payment_controls','order_verified_payments'
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
create or replace function public.guard_routing_order_v2()
returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' then
  if old.routing_version=2 and (new.kind,new.user_id,new.id) is distinct from (old.kind,old.user_id,old.id) then raise exception 'Order identity cannot be changed';end if;
 end if;
 if new.kind<>'production' then return new;end if;
 if tg_op='INSERT' then
  new.routing_version:=2;
  if auth.uid() is not null and not public.is_superadmin() and (new.status not in('submitted','awaiting_payment') or new.assigned_manufacturer_id is not null or new.manufacturer_quote is not null or new.price_options is not null or new.paid_amount_cents is not null)then raise exception 'New production orders must enter admin review';end if;
 elsif old.routing_version=2 then
  if (new.status,new.assigned_manufacturer_id,new.assigned_at,new.due_quote_by,new.manufacturer_quote,new.factory_status,new.factory_reject_reason,new.quoted_at,new.price_options,new.priced_at,new.quote_expires_at,new.offer_issued_at,new.paid_amount_cents,new.selected_price_option_id,new.payment_verified_at,new.production_released_at,new.routing_version) is distinct from (old.status,old.assigned_manufacturer_id,old.assigned_at,old.due_quote_by,old.manufacturer_quote,old.factory_status,old.factory_reject_reason,old.quoted_at,old.price_options,old.priced_at,old.quote_expires_at,old.offer_issued_at,old.paid_amount_cents,old.selected_price_option_id,old.payment_verified_at,old.production_released_at,old.routing_version)
    and current_setting('app.routing_write',true) is distinct from new.id::text then raise exception 'Use the authorised order routing actions';end if;
  if auth.uid() is not null and not public.is_superadmin() and (new.order_quantities,new.specifications) is distinct from (old.order_quantities,old.specifications) and (old.assigned_manufacturer_id is not null or old.status<>'submitted')then raise exception 'Ask Ceriga to revise an assigned order';end if;
 end if;
 return new;
end $$;
drop trigger if exists orders_guard_routing_v2 on public.orders;
create trigger orders_guard_routing_v2 before insert or update on public.orders for each row execute function public.guard_routing_order_v2();
create or replace function public.audit_order_routing()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.routing_version=2 and (tg_op='INSERT' or (new.status,new.assigned_manufacturer_id,new.factory_status,new.quoted_at,new.priced_at) is distinct from (old.status,old.assigned_manufacturer_id,old.factory_status,old.quoted_at,old.priced_at))then
  insert into public.order_routing_events(order_id,actor_id,event_type,manufacturer_id,details)values(new.id,(select id from auth.users where id=auth.uid()),case when tg_op='INSERT' then 'submitted' else coalesce(nullif(current_setting('app.routing_action',true),''),'updated')end,new.assigned_manufacturer_id,jsonb_build_object('status',new.status,'factoryStatus',new.factory_status,'reason',new.factory_reject_reason));
 end if;return new;
end $$;
drop trigger if exists orders_audit_routing on public.orders;
create trigger orders_audit_routing after insert or update on public.orders for each row execute function public.audit_order_routing();

create or replace function public.assign_order_manufacturer(p_order_id uuid,p_manufacturer uuid,p_due date)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype;
begin
 if not public.is_superadmin() then raise exception 'Superadmin authorization required';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.kind<>'production' or target.status not in('submitted','awaiting_payment','priced') then raise exception 'Order cannot be assigned at this stage';end if;
 if p_due is null or p_due<current_date then raise exception 'Choose a future quotation deadline';end if;
 if not exists(select 1 from public.manufacturer_profiles where user_id=p_manufacturer and onboarding_complete and status is distinct from 'paused')then raise exception 'Choose an active onboarded manufacturer';end if;
 if exists(select 1 from public.order_routing_events where order_id=p_order_id and manufacturer_id=p_manufacturer and event_type in('manufacturer_declined','admin_rejected')) or (target.factory_status='rejected' and target.assigned_manufacturer_id=p_manufacturer)then raise exception 'Choose another manufacturer after rejection';end if;
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.routing_action','assigned',true);
 update public.orders set assigned_manufacturer_id=p_manufacturer,assigned_at=now(),due_quote_by=p_due,factory_status='new',factory_reject_reason=null,manufacturer_quote=null,quoted_at=null,price_options=null,priced_at=null,offer_issued_at=null,quote_expires_at=null,status='submitted',status_label='Assigned to manufacturer' where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.assign_order_manufacturer(uuid,uuid,date)from public,anon;
grant execute on function public.assign_order_manufacturer(uuid,uuid,date)to authenticated;

create or replace function public.publish_order_quote(p_order_id uuid,p_prices jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; tier jsonb; approved jsonb; options jsonb:='[]';
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.kind<>'production' or target.status not in('submitted','awaiting_payment','priced') or target.factory_status is distinct from 'quoted' then raise exception 'Review a submitted manufacturer quotation first';end if;
 if target.status='priced' and jsonb_array_length(coalesce(target.price_options,'[]'))>0 and target.quote_expires_at>now() then raise exception 'The current offer has already been published';end if;
 if jsonb_typeof(p_prices) is distinct from 'array' or jsonb_array_length(p_prices)=0 or jsonb_array_length(p_prices)<>jsonb_array_length(coalesce(target.manufacturer_quote,'[]')) or (select count(distinct value->>'id')from jsonb_array_elements(p_prices))<>jsonb_array_length(p_prices)then raise exception 'Approve each quotation option exactly once';end if;
 for tier in select value from jsonb_array_elements(target.manufacturer_quote)loop
  select value into approved from jsonb_array_elements(p_prices)where value->>'id'=tier->>'id';
  if approved is null or coalesce(approved->>'cents','')!~'^[1-9][0-9]*$' or (approved->>'cents')::numeric>100000000000 then raise exception 'Enter valid approved prices';end if;
  options:=options||jsonb_build_array(jsonb_build_object('id',tier->>'id','kind',tier->>'kind','label',tier->>'label','description',(tier->>'totalUnits')||' units','totalUnits',tier->'totalUnits','priceCents',(approved->>'cents')::numeric,'currency',coalesce(tier->>'currency','GBP'),'leadTimeDays',tier->'leadTimeDays'));
 end loop;
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.routing_action','offer_published',true);
 update public.orders set price_options=options,priced_at=now(),offer_issued_at=now(),quote_expires_at=now()+interval '30 days',status='priced',status_label='Quote ready — valid for 30 days'where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.publish_order_quote(uuid,jsonb)from public,anon;
grant execute on function public.publish_order_quote(uuid,jsonb)to authenticated;

-- Derive every quantity and extended price from the saved customer request.
create or replace function public.submit_manufacturer_quote(p_order_id uuid, p_tiers jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; requirement jsonb; tier jsonb; requirements jsonb; normalized jsonb := '[]'; units numeric; unit_price numeric; days numeric; line_id text; line_kind text; quote_currency text;
begin
 if auth.uid() is null then raise exception 'Sign in to submit a quotation';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.assigned_manufacturer_id is distinct from auth.uid() then raise exception 'This order is not assigned to your factory';end if;
 if target.status not in('submitted','awaiting_payment') or coalesce(target.factory_status,'new') not in('new','reviewing','clarifying','quoted') then raise exception 'This order is no longer accepting manufacturer quotations';end if;
 if jsonb_array_length(coalesce(target.manufacturer_quote,'[]'::jsonb))>0 then
  quote_currency := coalesce(target.manufacturer_quote->0->>'currency','GBP');
 else
  select coalesce(pricing->>'preferredCurrency','GBP') into quote_currency from public.manufacturer_profiles where user_id=auth.uid();
 end if;
 if quote_currency is null or quote_currency not in('GBP','USD','EUR') then quote_currency:='GBP';end if;
 if jsonb_typeof(target.order_quantities->'sample')='object' then
  requirements := case when coalesce((target.order_quantities->'sample'->>'targetTotal')::numeric,(select sum(value::numeric) from jsonb_each_text(coalesce(target.order_quantities->'sample'->'bySize','{}'::jsonb))),0)>0 then jsonb_build_array(target.order_quantities->'sample') else '[]'::jsonb end || coalesce(target.order_quantities->'bulkRuns','[]'::jsonb);
 elsif coalesce(target.quote_request->>'quantity','') ~ '^[1-9][0-9]*$' then
  requirements := jsonb_build_array(jsonb_build_object('id','factory-quote','kind','bulk','targetTotal',(target.quote_request->>'quantity')::numeric));
 else raise exception 'The customer quantity is missing. Ask Ceriga to complete the order quantities';end if;
 if jsonb_typeof(p_tiers) is distinct from 'array' or jsonb_array_length(p_tiers)<>jsonb_array_length(requirements) or jsonb_array_length(p_tiers) not between 1 and 20 then raise exception 'Quote every customer quantity option';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_tiers))<>jsonb_array_length(p_tiers) then raise exception 'Quotation tier IDs must be unique';end if;
 for requirement in select value from jsonb_array_elements(requirements) loop
  line_id := requirement->>'id'; line_kind := requirement->>'kind';
  units := coalesce((requirement->>'targetTotal')::numeric,(select sum(value::numeric) from jsonb_each_text(coalesce(requirement->'bySize','{}'::jsonb))));
  if units is null or units<=0 or units<>trunc(units) or units>100000000 then raise exception 'The customer quantity is missing or invalid';end if;
  select value into tier from jsonb_array_elements(p_tiers) where value->>'id'=line_id;
  if tier is null or coalesce(tier->>'currency','')<>quote_currency or coalesce(tier->>'unitPriceCents','') !~ '^[1-9][0-9]*$' or coalesce(tier->>'leadTimeDays','') !~ '^[1-9][0-9]*$' then raise exception 'Each option requires a positive unit price in the quotation currency and a lead time';end if;
  unit_price := (tier->>'unitPriceCents')::numeric; days := (tier->>'leadTimeDays')::numeric;
  if days>3650 or unit_price*units>100000000000 then raise exception 'Quotation values exceed supported limits';end if;
  normalized := normalized || jsonb_build_array(jsonb_build_object('id',line_id,'kind',line_kind,'label',case when line_kind='sample' then 'Samples' else 'Bulk · '||units::text||' units' end,'totalUnits',units,'unitPriceCents',unit_price,'manufacturerQuoteCents',unit_price*units,'currency',quote_currency,'leadTimeDays',days));
 end loop;
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.routing_action','quoted',true);
 update public.orders set manufacturer_quote=normalized,factory_status='quoted',factory_reject_reason=null,quoted_at=now() where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.submit_manufacturer_quote(uuid,jsonb) from public,anon;
grant execute on function public.submit_manufacturer_quote(uuid,jsonb) to authenticated;


create or replace function public.reject_order_quotation(p_order_id uuid,p_reason text)
returns text language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; next_status text;
begin
 if auth.uid() is null then raise exception 'Sign in to reject a quotation';end if;
 if length(btrim(coalesce(p_reason,'')))<3 or length(p_reason)>2000 then raise exception 'Give a reason between 3 and 2000 characters';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order unavailable';end if;
 if target.status not in('submitted','awaiting_payment') then raise exception 'This order is no longer accepting quotation changes';end if;
 if public.is_superadmin() then
  if target.factory_status is distinct from 'quoted' then raise exception 'Only a submitted quotation can be returned for revision';end if;
  next_status := 'rejected';
  perform set_config('app.routing_action','admin_rejected',true);
 elsif target.assigned_manufacturer_id=auth.uid() then
  if coalesce(target.factory_status,'new') not in('new','reviewing','clarifying','quoted') then raise exception 'This assignment has already been declined';end if;
  next_status := 'rejected';
  perform set_config('app.routing_action','manufacturer_declined',true);
 else raise exception 'This order is not assigned to your factory';end if;
 perform set_config('app.routing_write',p_order_id::text,true);
 update public.orders set factory_status=next_status,factory_reject_reason=btrim(p_reason),price_options=null,priced_at=null,offer_issued_at=null,quote_expires_at=null,status='submitted',status_label='Awaiting manufacturer reassignment' where id=p_order_id;
 return next_status;
end $$;
revoke all on function public.reject_order_quotation(uuid,text) from public,anon;
grant execute on function public.reject_order_quotation(uuid,text) to authenticated;

-- Service-only handoff for a future provider webhook. Browser clicks can never confirm payment.
create or replace function public.confirm_order_payment(p_order_id uuid,p_option_id text,p_event_id text,p_amount bigint,p_currency text,p_paid_at timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; option jsonb; existing public.order_verified_payments%rowtype;
begin
 if not coalesce((select enabled from public.order_payment_controls where id=true),false)then raise exception 'Payments are disabled';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order unavailable';end if;
 select * into existing from public.order_verified_payments where provider_event_id=p_event_id;
 if found then
  if existing.order_id=p_order_id and existing.option_id=p_option_id and existing.amount_cents=p_amount and existing.currency=p_currency and target.production_released_at is not null then return p_order_id;end if;
  raise exception 'Payment event has already been used';
 end if;
 if target.kind<>'production' or target.status<>'priced' or target.assigned_manufacturer_id is null or target.quote_expires_at is null or p_paid_at is null or p_paid_at>=target.quote_expires_at or p_paid_at<target.offer_issued_at or p_paid_at>now()+interval '5 minutes' then raise exception 'No valid payable offer';end if;
 if not exists(select 1 from public.manufacturer_profiles where user_id=target.assigned_manufacturer_id and onboarding_complete and status is distinct from 'paused')then raise exception 'Assigned manufacturer is unavailable; Ceriga must review this payment';end if;
 select value into option from jsonb_array_elements(target.price_options)where value->>'id'=p_option_id;
 if option is null or p_amount is distinct from (option->>'priceCents')::bigint or p_currency is distinct from option->>'currency' or length(btrim(coalesce(p_event_id,'')))<3 then raise exception 'Payment amount, currency or option does not match the approved offer';end if;
 insert into public.order_verified_payments(order_id,provider_event_id,option_id,amount_cents,currency,provider_paid_at)values(p_order_id,p_event_id,p_option_id,p_amount,p_currency,p_paid_at);
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.routing_action','production_released',true);
 update public.orders set status='processing',status_label='Payment verified — in production',factory_status='in_production',paid_amount_cents=p_amount,selected_price_option_id=p_option_id,payment_verified_at=now(),production_released_at=now()where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.confirm_order_payment(uuid,text,text,bigint,text,timestamptz)from public,anon,authenticated;
grant execute on function public.confirm_order_payment(uuid,text,text,bigint,text,timestamptz)to service_role;
notify pgrst,'reload schema';
commit;
-- Detailed capability matching reuses existing, owner-isolated JSONB documents.
-- manufacturer_customisation_settings.settings.garmentDetails stores the manufacturer's
-- reviewed styles, materials, construction details, GSM range and confirmed flag.
-- orders.specifications stores the customer's actual fabric, GSM, styles,
-- constructionDetails and explicit requiredCapabilities (including [] for plain garments).
-- Historical documents are not backfilled with suggestions or invented confirmations.
-- No tables, grants, RLS, storage policies or records need changing for these fields.
begin read only;
do $$
begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='manufacturer_customisation_settings' and column_name='settings' and data_type='jsonb')
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='specifications' and data_type='jsonb') then raise exception 'Capability matching requires the existing JSONB settings and order specifications columns';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in('orders','manufacturer_customisation_settings') and not c.relrowsecurity)then raise exception 'Capability matching requires existing RLS protections';end if;
end $$;
commit;

-- Order quality control (20261021030000)
begin;

-- Existing production records are enrolled when QC requirements are first approved.
alter table public.orders add column if not exists qc_required boolean not null default false;
alter table public.orders alter column qc_required set default true;

create table if not exists public.qc_requirement_versions (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 version integer not null check(version>0), checks jsonb not null check(jsonb_typeof(checks)='array' and jsonb_array_length(checks)>0),
 status text not null default 'draft' check(status in('draft','approved')), created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), approved_by uuid references auth.users(id), approved_at timestamptz,
 unique(order_id,version), unique(id,order_id)
);
create table if not exists public.qc_inspections (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 requirement_id uuid not null, stage text not null check(stage in('sample','pre_production','in_production','final','reinspection')),
 batch text not null check(length(btrim(batch))>0), size_colour text not null default '', inspector_id uuid references auth.users(id),
 produced integer not null check(produced>0), inspected integer not null check(inspected>0 and inspected<=produced),
 accepted integer not null default 0 check(accepted>=0), rejected integer not null default 0 check(rejected>=0), held integer not null default 0 check(held>=0),
 checks jsonb not null default '[]' check(jsonb_typeof(checks)='array'), notes text not null default '',
 result text not null default 'draft' check(result in('draft','passed','failed')), created_at timestamptz not null default now(), submitted_at timestamptz,
 parent_defect_id uuid, unique(id,order_id), foreign key(requirement_id,order_id) references public.qc_requirement_versions(id,order_id),
 check(accepted+rejected+held<=inspected), check((result='draft')=(submitted_at is null))
);
alter table public.qc_inspections add column if not exists reviewed_by uuid references auth.users(id), add column if not exists reviewed_at timestamptz, add column if not exists review_note text, add column if not exists manufacturer_id uuid references auth.users(id);
create table if not exists public.qc_defects (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 inspection_id uuid not null, check_id text not null, title text not null, severity text not null check(severity in('minor','major','critical')),
 affected_units integer not null check(affected_units>0), owner_name text not null default '', action text not null default '', due_date date,
 status text not null default 'open' check(status in('open','rework','awaiting_reinspection','closed','deviation_accepted')),
 resolution text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,order_id), unique(inspection_id,check_id), foreign key(inspection_id,order_id) references public.qc_inspections(id,order_id)
);
do $$ begin
 if not exists(select 1 from pg_constraint where conname='qc_reinspection_defect_fk') then
  alter table public.qc_inspections add constraint qc_reinspection_defect_fk foreign key(parent_defect_id,order_id) references public.qc_defects(id,order_id);
 end if;
end $$;
create table if not exists public.qc_evidence (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 inspection_id uuid, defect_id uuid, check_id text not null default '', path text not null unique, file_name text not null,
 uploaded_by uuid references auth.users(id), created_at timestamptz not null default now(),
 foreign key(inspection_id,order_id) references public.qc_inspections(id,order_id), foreign key(defect_id,order_id) references public.qc_defects(id,order_id),
 check((inspection_id is not null)::integer+(defect_id is not null)::integer=1)
);
create table if not exists public.qc_shipment_releases (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 inspection_id uuid not null, quantity integer not null check(quantity>0), reason text not null check(length(btrim(reason))>0),
 approved_by uuid not null references auth.users(id), approved_at timestamptz not null default now(), revoked_at timestamptz,
 dispatched_at timestamptz, tracking text, foreign key(inspection_id,order_id) references public.qc_inspections(id,order_id)
);
create table if not exists public.qc_audit_events (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 actor_id uuid references auth.users(id), action text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.qc_defect_events (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 defect_id uuid not null, actor_id uuid references auth.users(id), action text not null, note text not null, created_at timestamptz not null default now(),
 foreign key(defect_id,order_id) references public.qc_defects(id,order_id)
);
-- Account deletion must not erase inspection history or block privileged Auth cleanup.
alter table public.qc_shipment_releases alter column approved_by drop not null;
do $$ declare fk record;begin
 for fk in select c.conname,t.relname,a.attname from pg_constraint c
 join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
 join pg_attribute a on a.attrelid=t.oid and a.attnum=c.conkey[1]
 where c.contype='f' and c.confrelid='auth.users'::regclass and n.nspname='public'
 and t.relname in('qc_requirement_versions','qc_inspections','qc_defects','qc_evidence','qc_shipment_releases','qc_audit_events','qc_defect_events') and c.confdeltype<>'n'
 loop
  execute format('alter table public.%I drop constraint %I',fk.relname,fk.conname);
  execute format('alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete set null',fk.relname,fk.conname,fk.attname);
 end loop;
end $$;
create index if not exists qc_requirements_order_idx on public.qc_requirement_versions(order_id,version desc);
create index if not exists qc_inspections_order_idx on public.qc_inspections(order_id,stage,result,created_at desc);
create index if not exists qc_defects_open_idx on public.qc_defects(order_id,status);
create index if not exists qc_evidence_order_idx on public.qc_evidence(order_id,inspection_id,defect_id);
create index if not exists qc_releases_order_idx on public.qc_shipment_releases(order_id,revoked_at,dispatched_at);
create index if not exists qc_audit_order_idx on public.qc_audit_events(order_id,created_at desc);
create index if not exists qc_defect_events_order_idx on public.qc_defect_events(order_id,defect_id,created_at);

create or replace function public.qc_can_access(p_order uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (public.is_superadmin() or exists(select 1 from public.orders where id=p_order and assigned_manufacturer_id=auth.uid() and kind='production'))
$$;
revoke all on function public.qc_can_access(uuid) from public,anon;
grant execute on function public.qc_can_access(uuid) to authenticated;

create or replace function public.apply_superadmin_access()
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare table_name text;
begin
 foreach table_name in array array[
 'projects','orders','packaging_library','brand_notifications','profiles','manufacturer_profiles','manufacturer_invites','factory_materials',
 'factory_capacity_blocks','portal_notifications','measurement_guide_packs','platform_settings','admin_chat_threads','admin_chat_messages',
 'manufacturer_customisation_settings','superadmin_emails','order_routing_events','order_payment_controls','order_verified_payments',
 'qc_requirement_versions','qc_inspections','qc_defects','qc_evidence','qc_shipment_releases','qc_audit_events','qc_defect_events'
 ] loop
  if to_regclass(format('public.%I',table_name)) is not null then
   execute format('alter table public.%I enable row level security',table_name);
   execute format('grant select,insert,update,delete on public.%I to authenticated',table_name);
   if not exists(select 1 from pg_policies where schemaname='public' and tablename=table_name and policyname='superadmin_full_access') then
    execute format('create policy superadmin_full_access on public.%I for all to authenticated using(public.is_superadmin()) with check(public.is_superadmin())',table_name);
   end if;
  end if;
 end loop;
end $$;
revoke all on function public.apply_superadmin_access() from public,anon,authenticated;
grant execute on function public.apply_superadmin_access() to service_role;
select public.apply_superadmin_access();

create or replace function public.qc_guard_write() returns trigger language plpgsql set search_path=public as $$
declare oid uuid;
begin
 oid:=case when tg_op='DELETE' then old.order_id else new.order_id end;
 if tg_op='DELETE' and not exists(select 1 from public.orders where id=oid) then return old;end if;
 if tg_op='UPDATE' and pg_trigger_depth()>1 and
  (to_jsonb(new)-array['created_by','approved_by','inspector_id','reviewed_by','manufacturer_id','uploaded_by','actor_id']) =
  (to_jsonb(old)-array['created_by','approved_by','inspector_id','reviewed_by','manufacturer_id','uploaded_by','actor_id']) then return new;end if;
 if current_setting('app.qc_write',true) is distinct from oid::text then raise exception 'Use the authorised QC actions'; end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end $$;
do $$ declare t text;begin
 foreach t in array array['qc_requirement_versions','qc_inspections','qc_defects','qc_evidence','qc_shipment_releases','qc_audit_events','qc_defect_events'] loop
  execute format('drop policy if exists qc_factory_read on public.%I',t);
  execute format('create policy qc_factory_read on public.%I for select to authenticated using(public.qc_can_access(order_id))',t);
  execute format('drop trigger if exists qc_guard_write on public.%I',t);
  execute format('create trigger qc_guard_write before insert or update or delete on public.%I for each row execute function public.qc_guard_write()',t);
 end loop;
end $$;

create or replace function public.qc_action(p_order uuid,p_action text,p_data jsonb default '{}')
returns uuid language plpgsql security definer set search_path=public,storage as $$
declare o public.orders%rowtype; r public.qc_requirement_versions%rowtype; i public.qc_inspections%rowtype; d public.qc_defects%rowtype;
 rid uuid; cid uuid; ch jsonb; v jsonb; norm jsonb:='[]'; failed boolean:=false; computed text; admin boolean;
 units integer; released integer; maximum integer; req_id uuid; stage_name text;
begin
 if not public.qc_can_access(p_order) then raise exception 'QC access denied for this order';end if;
 select * into o from public.orders where id=p_order for update;
 if o.kind<>'production' then raise exception 'QC requires a production order';end if;
 admin:=public.is_superadmin();
 perform set_config('app.qc_write',p_order::text,true);
 -- Cooperate with the configured project's older controlled-workflow guard.
 -- This RPC never changes payment amounts or releases production.
 perform set_config('app.workflow_write',p_order::text,true);
 if p_action='requirements' then
  if not admin then raise exception 'Only Ceriga can define and approve requirements';end if;
  if jsonb_typeof(p_data->'checks') is distinct from 'array' or jsonb_array_length(p_data->'checks') not between 1 and 100 then raise exception 'Provide 1–100 checks';end if;
  for ch in select value from jsonb_array_elements(p_data->'checks') loop
   if coalesce(ch->>'id','')='' or coalesce(btrim(ch->>'label'),'')='' or coalesce(btrim(ch->>'criteria'),'')='' then raise exception 'Checks require ID, label and acceptance criteria';end if;
   if ch->>'stage' not in('sample','pre_production','in_production','final') or ch->>'stage' is null then raise exception 'Choose a check stage';end if;
   if ch->>'target' is not null and (coalesce(ch->>'tolerance','')='' or (ch->>'tolerance')::numeric<0 or coalesce(ch->>'unit','')='') then raise exception 'Measurements require a non-negative tolerance and unit';end if;
   if ch->>'target' is not null then perform (ch->>'target')::numeric;end if;
  end loop;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_data->'checks'))<>jsonb_array_length(p_data->'checks') then raise exception 'Check IDs must be unique';end if;
  insert into public.qc_requirement_versions(order_id,version,checks,status,created_by,approved_by,approved_at)
   values(p_order,coalesce((select max(version) from public.qc_requirement_versions where order_id=p_order),0)+1,p_data->'checks','approved',auth.uid(),auth.uid(),now()) returning id into rid;
  update public.orders set qc_required=true where id=p_order;
  update public.qc_shipment_releases set revoked_at=now() where order_id=p_order and revoked_at is null and dispatched_at is null;
 elsif p_action in('save_inspection','submit_inspection') then
  cid:=nullif(p_data->>'id','')::uuid;
  if cid is not null then
   select * into i from public.qc_inspections where id=cid and order_id=p_order for update;
   if not found or i.result<>'draft' then raise exception 'Only an existing draft can be edited';end if;
  end if;
  select * into r from public.qc_requirement_versions where order_id=p_order and status='approved' order by version desc limit 1;
  if not found then raise exception 'Ceriga must approve quality requirements first';end if;
  req_id:=r.id; stage_name:=p_data->>'stage';
  if stage_name is distinct from 'sample' and o.production_released_at is null then raise exception 'Payment must be verified before bulk QC';end if;
  if stage_name not in('sample','reinspection') and exists(select 1 from jsonb_array_elements(r.checks) c where c->>'stage'='sample') and not exists(select 1 from public.qc_inspections where order_id=p_order and stage='sample' and result='passed' and reviewed_at is not null and requirement_id=r.id and manufacturer_id=o.assigned_manufacturer_id) then raise exception 'Ceriga must approve the sample inspection before bulk QC';end if;
  if stage_name='reinspection' then
   select * into d from public.qc_defects where id=nullif(p_data->>'parent_defect_id','')::uuid and order_id=p_order;
   if not found or d.status<>'awaiting_reinspection' then raise exception 'Choose a defect awaiting reinspection';end if;
   if (p_data->>'inspected')::integer<d.affected_units then raise exception 'Reinspect all affected units';end if;
   if not exists(select 1 from jsonb_array_elements(r.checks) c where c->>'id'=d.check_id) then raise exception 'Current requirements must retain the failed check for reinspection';end if;
  elsif nullif(p_data->>'parent_defect_id','') is not null then raise exception 'Only reinspections can link to a defect';end if;
  if p_action='submit_inspection' then
   if (p_data->>'accepted')::integer+(p_data->>'rejected')::integer+(p_data->>'held')::integer is distinct from (p_data->>'inspected')::integer then raise exception 'Accepted, rejected and held must equal inspected units';end if;
   if jsonb_typeof(p_data->'checks') is distinct from 'array' then raise exception 'Complete the checklist';end if;
   for ch in select value from jsonb_array_elements(r.checks) where (stage_name='reinspection' and value->>'id'=d.check_id) or value->>'stage'=stage_name loop
    select value into v from jsonb_array_elements(p_data->'checks') where value->>'id'=ch->>'id';
    if v is null or (select count(*) from jsonb_array_elements(p_data->'checks') x where x->>'id'=ch->>'id')<>1 then raise exception 'Complete every applicable check once';end if;
    computed:=v->>'result';
    if ch->>'target' is not null and computed is distinct from 'na' then
     if coalesce(v->>'actual','')='' then raise exception 'Enter actual measurements';end if;
     computed:=case when abs((v->>'actual')::numeric-(ch->>'target')::numeric)<=(ch->>'tolerance')::numeric then 'pass' else 'fail' end;
    end if;
    if computed not in('pass','fail','na') or computed is null then raise exception 'Choose a result for every check';end if;
    if computed='na' and coalesce(btrim(v->>'note'),'')='' then raise exception 'Explain checks marked not applicable';end if;
    if computed='fail' then
     failed:=true;
     if coalesce(btrim(v->>'note'),'')='' or coalesce(v->>'severity','') not in('minor','major','critical') or coalesce(v->>'affected_units','')!~'^[1-9][0-9]*$' or (v->>'affected_units')::integer>(p_data->>'inspected')::integer then raise exception 'Failed checks need notes, severity and valid affected quantity';end if;
    end if;
    norm:=norm||jsonb_build_array(v||jsonb_build_object('result',computed));
   end loop;
   if jsonb_array_length(norm)=0 then raise exception 'No approved checks for this stage';end if;
   if failed and (p_data->>'accepted')::integer=(p_data->>'inspected')::integer then raise exception 'Failed goods must be rejected or held';end if;
   if not failed and ((p_data->>'rejected')::integer>0 or (p_data->>'held')::integer>0) then raise exception 'Document a failed check for rejected or held units';end if;
  else norm:=coalesce(p_data->'checks','[]');end if;
  rid:=coalesce(cid,gen_random_uuid());
  insert into public.qc_inspections(id,order_id,requirement_id,stage,batch,size_colour,inspector_id,produced,inspected,accepted,rejected,held,checks,notes,result,submitted_at,parent_defect_id)
  values(rid,p_order,req_id,stage_name,btrim(p_data->>'batch'),coalesce(p_data->>'size_colour',''),coalesce(i.inspector_id,auth.uid()),(p_data->>'produced')::integer,(p_data->>'inspected')::integer,(p_data->>'accepted')::integer,(p_data->>'rejected')::integer,(p_data->>'held')::integer,norm,coalesce(p_data->>'notes',''),case when p_action='save_inspection' then 'draft' when failed then 'failed' else 'passed' end,case when p_action='submit_inspection' then now() end,case when stage_name='reinspection' then d.id end)
  on conflict(id) do update set requirement_id=excluded.requirement_id,stage=excluded.stage,batch=excluded.batch,size_colour=excluded.size_colour,produced=excluded.produced,inspected=excluded.inspected,accepted=excluded.accepted,rejected=excluded.rejected,held=excluded.held,checks=excluded.checks,notes=excluded.notes,result=excluded.result,submitted_at=excluded.submitted_at,parent_defect_id=excluded.parent_defect_id;
  update public.qc_inspections set manufacturer_id=o.assigned_manufacturer_id where id=rid;
  if p_action='submit_inspection' then
   for v in select value from jsonb_array_elements(norm) where value->>'result'='fail' loop
    insert into public.qc_defects(order_id,inspection_id,check_id,title,severity,affected_units)
     select p_order,rid,v->>'id',chx->>'label',v->>'severity',(v->>'affected_units')::integer from jsonb_array_elements(r.checks) chx where chx->>'id'=v->>'id';
   end loop;
   if stage_name='reinspection' and not failed then
    update public.qc_defects set status='closed',updated_at=now() where id=d.id;
    insert into public.qc_defect_events(order_id,defect_id,actor_id,action,note) values(p_order,d.id,auth.uid(),'closed','Passed reinspection '||rid::text);
   elsif stage_name='reinspection' and failed then
    update public.qc_defects set status='open',updated_at=now() where id=d.id;
   end if;
   -- New final results supersede previous unshipped releases; failures put all remaining goods on hold.
   if failed or stage_name='final' then update public.qc_shipment_releases set revoked_at=now() where order_id=p_order and revoked_at is null and dispatched_at is null;end if;
  end if;
 elsif p_action='review_inspection' then
  if not admin or coalesce(btrim(p_data->>'note'),'')='' then raise exception 'Ceriga must provide an inspection review note';end if;
  update public.qc_inspections set reviewed_by=auth.uid(),reviewed_at=now(),review_note=p_data->>'note' where id=(p_data->>'id')::uuid and order_id=p_order and result='passed' and reviewed_at is null returning id into rid;
  if rid is null then raise exception 'Choose an unreviewed passing inspection';end if;
 elsif p_action='defect' then
  select * into d from public.qc_defects where id=(p_data->>'id')::uuid and order_id=p_order for update;
  if not found or d.status in('closed','deviation_accepted') then raise exception 'Choose an open defect';end if;
  if coalesce(btrim(p_data->>'resolution'),'')='' then raise exception 'Describe the action or resolution';end if;
  if p_data->>'status'='deviation_accepted' then
   if not admin or d.severity='critical' then raise exception 'Only Ceriga can accept non-critical deviations';end if;
  elsif p_data->>'status'='awaiting_reinspection' then
   if d.status<>'rework' or not exists(select 1 from public.qc_evidence where defect_id=d.id) then raise exception 'Start rework and attach completion evidence first';end if;
  elsif p_data->>'status' is distinct from 'rework' then raise exception 'Use passing reinspection to close defects';end if;
  update public.qc_defects set status=p_data->>'status',owner_name=coalesce(p_data->>'owner_name',''),action=coalesce(p_data->>'action',''),due_date=nullif(p_data->>'due_date','')::date,resolution=p_data->>'resolution',updated_at=now() where id=d.id;
  insert into public.qc_defect_events(order_id,defect_id,actor_id,action,note) values(p_order,d.id,auth.uid(),p_data->>'status',p_data->>'resolution');rid:=d.id;
 elsif p_action='evidence' then
  if nullif(p_data->>'inspection_id','') is not null then
   select * into i from public.qc_inspections where id=(p_data->>'inspection_id')::uuid and order_id=p_order;
   if not found or i.result<>'draft' then raise exception 'Evidence can only be added to draft inspections';end if;
   if coalesce(p_data->>'check_id','')<>'' and not exists(select 1 from public.qc_requirement_versions rv,jsonb_array_elements(rv.checks) c where rv.id=i.requirement_id and c->>'id'=p_data->>'check_id') then raise exception 'Unknown evidence check';end if;
  else
   select * into d from public.qc_defects where id=(p_data->>'defect_id')::uuid and order_id=p_order;
   if not found or d.status<>'rework' then raise exception 'Attach rework evidence to an active rework task';end if;
  end if;
  if split_part(p_data->>'path','/',1)<>p_order::text or split_part(p_data->>'path','/',2)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='qc-evidence' and name=p_data->>'path') then raise exception 'Upload private evidence for this order first';end if;
  insert into public.qc_evidence(order_id,inspection_id,defect_id,check_id,path,file_name,uploaded_by) values(p_order,nullif(p_data->>'inspection_id','')::uuid,nullif(p_data->>'defect_id','')::uuid,coalesce(p_data->>'check_id',''),p_data->>'path',p_data->>'file_name',auth.uid()) returning id into rid;
 elsif p_action='release' then
  if not admin then raise exception 'Only Ceriga may release shipments';end if;
  if o.production_released_at is null then raise exception 'Payment must be verified before shipment';end if;
  select * into i from public.qc_inspections where id=(p_data->>'inspection_id')::uuid and order_id=p_order;
  select * into r from public.qc_requirement_versions where order_id=p_order and status='approved' order by version desc limit 1;
  if i.id is null or i.stage<>'final' or i.result<>'passed' or i.requirement_id<>r.id or i.manufacturer_id is distinct from o.assigned_manufacturer_id or i.inspected<>i.produced or i.accepted<>i.produced then raise exception 'Release requires a current passing final inspection of every unit in the shipment batch';end if;
  if exists(select 1 from public.qc_inspections where order_id=p_order and stage='final' and submitted_at>i.submitted_at) then raise exception 'Use the latest final inspection';end if;
  if exists(select 1 from public.qc_defects where order_id=p_order and status not in('closed','deviation_accepted')) then raise exception 'Resolve outstanding defects before release';end if;
  units:=(p_data->>'quantity')::integer;
  select coalesce(sum(quantity),0) into released from public.qc_shipment_releases where order_id=p_order and (revoked_at is null or dispatched_at is not null);
  select (x->>'totalUnits')::integer into maximum from jsonb_array_elements(coalesce(o.price_options,'[]')) x where x->>'id'=o.selected_price_option_id;
  if units is null or units<=0 or maximum is null or released+units>maximum or units+coalesce((select sum(sr.quantity) from public.qc_shipment_releases sr join public.qc_inspections qi on qi.id=sr.inspection_id where sr.order_id=p_order and qi.batch=i.batch and (sr.revoked_at is null or sr.dispatched_at is not null)),0)>i.accepted then raise exception 'Release quantity exceeds inspected or purchased units';end if;
  insert into public.qc_shipment_releases(order_id,inspection_id,quantity,reason,approved_by) values(p_order,i.id,units,btrim(p_data->>'reason'),auth.uid()) returning id into rid;
 elsif p_action='revoke_release' then
  if not admin or coalesce(btrim(p_data->>'reason'),'')='' then raise exception 'Ceriga must provide a revocation reason';end if;
  update public.qc_shipment_releases set revoked_at=now() where id=(p_data->>'id')::uuid and order_id=p_order and dispatched_at is null and revoked_at is null returning id into rid;
  if rid is null then raise exception 'Release is not available to revoke';end if;
 elsif p_action='dispatch' then
  if coalesce(btrim(p_data->>'tracking'),'')='' then raise exception 'Enter tracking or a carrier handover reference';end if;
  if o.status not in('processing','shipping') or o.production_released_at is null then raise exception 'Order is not available for dispatch';end if;
  if exists(select 1 from public.qc_defects where order_id=p_order and status not in('closed','deviation_accepted')) then raise exception 'Resolve outstanding defects before dispatch';end if;
  update public.qc_shipment_releases set dispatched_at=now(),tracking=btrim(p_data->>'tracking') where id=(p_data->>'id')::uuid and order_id=p_order and revoked_at is null and dispatched_at is null returning id into rid;
  if rid is null then raise exception 'A current unused shipment release is required';end if;
  perform set_config('app.routing_write',p_order::text,true);
  update public.orders set status='shipping',status_label='QC-approved shipment dispatched' where id=p_order;
 else raise exception 'Unknown QC action';end if;
 insert into public.qc_audit_events(order_id,actor_id,action,details) values(p_order,auth.uid(),p_action,jsonb_build_object('record_id',rid,'reason',p_data->>'reason'));
 return rid;
end $$;
revoke all on function public.qc_action(uuid,text,jsonb) from public,anon;
grant execute on function public.qc_action(uuid,text,jsonb) to authenticated;

create or replace function public.qc_guard_dispatch() returns trigger language plpgsql security definer set search_path=public as $$
declare maximum integer; dispatched integer;
begin
 if tg_op='INSERT' then if new.kind='production' then new.qc_required:=true;end if;return new;end if;
 if new.qc_required is distinct from old.qc_required and current_setting('app.qc_write',true) is distinct from new.id::text then raise exception 'QC enrollment is managed by Ceriga quality requirements';end if;
 if old.assigned_manufacturer_id is distinct from new.assigned_manufacturer_id then
  perform set_config('app.qc_write',new.id::text,true);
  update public.qc_shipment_releases set revoked_at=now() where order_id=new.id and revoked_at is null and dispatched_at is null;
  insert into public.qc_audit_events(order_id,actor_id,action,details) select new.id,auth.uid(),'manufacturer_changed',jsonb_build_object('previous',old.assigned_manufacturer_id,'next',new.assigned_manufacturer_id) where exists(select 1 from public.qc_requirement_versions where order_id=new.id);
 end if;
 if old.kind='production' and (old.qc_required or new.qc_required) and old.status is distinct from new.status and new.status in('shipping','completed','ready') then
  if current_setting('app.qc_write',true) is distinct from new.id::text then
   if not exists(select 1 from public.qc_shipment_releases where order_id=new.id and dispatched_at is not null) then raise exception 'Dispatch requires QC inspection and Ceriga shipment release';end if;
   if new.status='shipping' then raise exception 'Use QC dispatch to record the approved shipment';end if;
  end if;
  if new.status in('completed','ready') and exists(select 1 from public.qc_shipment_releases where order_id=new.id and revoked_at is null and dispatched_at is null) then raise exception 'Dispatch remaining approved goods first';end if;
  if new.status in('completed','ready') then
   select (x->>'totalUnits')::integer into maximum from jsonb_array_elements(coalesce(new.price_options,'[]')) x where x->>'id'=new.selected_price_option_id;
   select coalesce(sum(quantity),0) into dispatched from public.qc_shipment_releases where order_id=new.id and dispatched_at is not null;
   if maximum is null or dispatched<maximum then raise exception 'Dispatch all purchased units before completing the order';end if;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists orders_qc_guard_dispatch on public.orders;
create trigger orders_qc_guard_dispatch before insert or update on public.orders for each row execute function public.qc_guard_dispatch();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('qc-evidence','qc-evidence',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do nothing;
drop policy if exists qc_evidence_read on storage.objects;
create policy qc_evidence_read on storage.objects for select to authenticated using(bucket_id='qc-evidence' and exists(select 1 from public.qc_evidence e where e.path=name and public.qc_can_access(e.order_id)));
drop policy if exists qc_evidence_upload on storage.objects;
create policy qc_evidence_upload on storage.objects for insert to authenticated with check(bucket_id='qc-evidence' and (storage.foldername(name))[2]=auth.uid()::text and exists(select 1 from public.orders o where o.id::text=(storage.foldername(name))[1] and public.qc_can_access(o.id)));
drop policy if exists qc_evidence_cleanup on storage.objects;
create policy qc_evidence_cleanup on storage.objects for delete to authenticated using(bucket_id='qc-evidence' and (storage.foldername(name))[2]=auth.uid()::text and not exists(select 1 from public.qc_evidence e where e.path=name));
notify pgrst,'reload schema';
commit;

-- Assignment requirement review (20261021040000)
-- Quote assignment evaluates the requirements actually saved on an order.
-- Missing specifications, unknown capacity and unreviewed garment details are
-- explicit review warnings, not fabricated capability mismatches. Known garment,
-- technique, confirmed fabric/style/GSM, quantity and availability mismatches still
-- block the application action. Quotation does not authorize production.
-- Existing JSONB documents and server-side superadmin assignment authorization are
-- reused unchanged; do not invent requirements or confirmations for older orders.
begin read only;
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='specifications' and data_type='jsonb')
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='manufacturer_customisation_settings' and column_name='settings' and data_type='jsonb')
 then raise exception 'Assignment review requires order specifications and manufacturer settings';end if;
 if has_function_privilege('anon','public.assign_order_manufacturer(uuid,uuid,date)','execute') then raise exception 'Anonymous clients must not assign manufacturers';end if;
end $$;
commit;

-- Customer submission without payment (20261021050000)
begin;
alter table public.orders add column if not exists manufacturer_submitted_at timestamptz;
alter table public.order_payment_controls add column if not exists submission_without_payment_enabled boolean not null default true;

create or replace function public.guard_manufacturer_submission() returns trigger language plpgsql set search_path=public as $$
begin
 if (tg_op='INSERT' and new.manufacturer_submitted_at is not null) or (tg_op='UPDATE' and new.manufacturer_submitted_at is distinct from old.manufacturer_submitted_at) then
  if current_setting('app.manufacturer_submission_write',true) is distinct from new.id::text then raise exception 'Use the customer submission action';end if;
 end if;
 return new;
end $$;
drop trigger if exists orders_guard_manufacturer_submission on public.orders;
create trigger orders_guard_manufacturer_submission before insert or update on public.orders for each row execute function public.guard_manufacturer_submission();

create or replace function public.submit_order_to_manufacturer(p_order_id uuid,p_option_id text)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; chosen jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to submit an order';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.user_id is distinct from auth.uid() then raise exception 'This order does not belong to your account';end if;
 if target.manufacturer_submitted_at is not null then
  if target.selected_price_option_id=p_option_id and target.status in('processing','shipping','completed') then return target.id;end if;
  raise exception 'This order has already been submitted';
 end if;
 if not coalesce((select submission_without_payment_enabled from public.order_payment_controls where id=true),false) then raise exception 'Submission without payment is currently disabled';end if;
 if target.kind<>'production' or target.status<>'priced' or target.priced_at is null or target.quote_expires_at is null or now()>=target.quote_expires_at or target.assigned_manufacturer_id is null or target.factory_status is distinct from 'quoted' then raise exception 'A current approved quote and assigned manufacturer are required';end if;
 if not exists(select 1 from public.manufacturer_profiles where user_id=target.assigned_manufacturer_id and onboarding_complete and status is distinct from 'paused') then raise exception 'The manufacturer is unavailable. Ask Ceriga to review your order';end if;
 select value into chosen from jsonb_array_elements(coalesce(target.price_options,'[]')) where value->>'id'=p_option_id;
 if chosen is null or coalesce(chosen->>'totalUnits','')!~'^[1-9][0-9]*$' or coalesce(chosen->>'priceCents','')!~'^[1-9][0-9]*$' then raise exception 'Choose an approved sample or bulk option';end if;
 perform set_config('app.routing_write',target.id::text,true);
 perform set_config('app.workflow_write',target.id::text,true);
 perform set_config('app.manufacturer_submission_write',target.id::text,true);
 perform set_config('app.routing_action','customer_submitted_to_manufacturer',true);
 update public.orders set status='processing',status_label='Submitted to manufacturer',factory_status='in_production',selected_price_option_id=p_option_id,manufacturer_submitted_at=now(),production_released_at=now() where id=target.id;
 -- No payment amount, verification timestamp or payment receipt is created.
 return target.id;
end $$;
revoke all on function public.submit_order_to_manufacturer(uuid,text) from public,anon;
grant execute on function public.submit_order_to_manufacturer(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;

-- Simplified QC reports (20261022010000)
begin;
-- Install the existing portal inbox dependencies if an older deployment omitted them.
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


revoke all on function public.notify_superadmin(text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.notify_manufacturer(uuid,text,text,text,text,uuid) from public,anon,authenticated;

-- Extend existing QC records; legacy inspections, evidence and decisions stay intact.
alter table public.orders add column if not exists qc_status text not null default 'not_submitted';
alter table public.orders drop constraint if exists orders_qc_status_check;
alter table public.orders add constraint orders_qc_status_check check(qc_status in('not_submitted','pending_review','changes_required','approved'));
alter table public.qc_inspections alter column requirement_id drop not null;
alter table public.qc_inspections add column if not exists workflow_version integer not null default 1,
 add column if not exists report_version integer,
 add column if not exists qc_status text,
 add column if not exists production_summary text not null default '',
 add column if not exists produced_lines jsonb not null default '[]',
 add column if not exists order_snapshot text,
 add column if not exists has_issues boolean,
 add column if not exists issue_description text not null default '',
 add column if not exists manufacturer_confirmed boolean not null default false,
 add column if not exists confirmed_at timestamptz,
 add column if not exists photo_ids jsonb not null default '[]',
 add column if not exists supporting_ids jsonb not null default '[]',
 add column if not exists measurement_notes text not null default '', add column if not exists draft_superseded boolean not null default false;
alter table public.qc_inspections drop constraint if exists qc_inspections_result_check;
alter table public.qc_inspections add constraint qc_inspections_result_check check(result in('draft','submitted','passed','failed'));
alter table public.qc_inspections drop constraint if exists qc_report_shape;
alter table public.qc_inspections add constraint qc_report_shape check(workflow_version=1 or
 (workflow_version=2 and report_version is not null and qc_status is not null and order_snapshot is not null and report_version>0 and qc_status in('not_submitted','pending_review','changes_required','approved')
 and jsonb_typeof(produced_lines)='array' and jsonb_typeof(photo_ids)='array' and jsonb_typeof(supporting_ids)='array'
 and (qc_status='not_submitted' or (manufacturer_confirmed and confirmed_at is not null and submitted_at is not null and length(btrim(production_summary))>0 and jsonb_array_length(photo_ids)>0 and has_issues is not null and (not has_issues or length(btrim(issue_description))>0)))));
create unique index if not exists qc_report_version_idx on public.qc_inspections(order_id,report_version) where workflow_version=2;
drop index if exists public.qc_one_report_draft_idx;
create unique index qc_one_report_draft_idx on public.qc_inspections(order_id) where workflow_version=2 and qc_status='not_submitted' and not draft_superseded;
create index if not exists qc_report_review_queue_idx on public.qc_inspections(qc_status,submitted_at desc) where workflow_version=2;
alter table public.qc_evidence add column if not exists file_role text not null default 'support',
 add column if not exists mime_type text, add column if not exists byte_size bigint;
alter table public.qc_evidence drop constraint if exists qc_evidence_file_role_check;
alter table public.qc_evidence add constraint qc_evidence_file_role_check check(file_role in('photo','support'));

-- Assignment grants access to the order, not to a previous factory's private reports.
drop policy if exists qc_factory_read on public.qc_inspections;
create policy qc_factory_read on public.qc_inspections for select to authenticated using(public.qc_can_access(order_id) and (manufacturer_id=auth.uid() or (workflow_version=1 and manufacturer_id is null and inspector_id=auth.uid())));
drop policy if exists qc_factory_read on public.qc_evidence;
create policy qc_factory_read on public.qc_evidence for select to authenticated using(public.qc_can_access(order_id) and exists(select 1 from public.qc_inspections i where i.id=inspection_id and (i.manufacturer_id=auth.uid() or (i.workflow_version=1 and i.inspector_id=auth.uid()))));
drop policy if exists qc_factory_read on public.qc_shipment_releases;
create policy qc_factory_read on public.qc_shipment_releases for select to authenticated using(public.qc_can_access(order_id) and exists(select 1 from public.qc_inspections i where i.id=inspection_id and (i.manufacturer_id=auth.uid() or (i.workflow_version=1 and i.inspector_id=auth.uid()))));
drop policy if exists qc_factory_read on public.qc_audit_events;
create policy qc_factory_read on public.qc_audit_events for select to authenticated using(public.qc_can_access(order_id) and (actor_id=auth.uid() or details->>'manufacturer_id'=auth.uid()::text or exists(select 1 from public.qc_inspections i where i.id::text=details->>'record_id' and i.manufacturer_id=auth.uid())));

drop policy if exists qc_factory_read on public.qc_defects;
create policy qc_factory_read on public.qc_defects for select to authenticated using(public.qc_can_access(order_id) and exists(select 1 from public.qc_inspections i where i.id=inspection_id and (i.manufacturer_id=auth.uid() or (i.workflow_version=1 and i.inspector_id=auth.uid()))));
drop policy if exists qc_factory_read on public.qc_defect_events;
create policy qc_factory_read on public.qc_defect_events for select to authenticated using(public.qc_can_access(order_id) and exists(select 1 from public.qc_defects d where d.id=defect_id));

create or replace function public.qc_order_snapshot(p_order uuid) returns text language sql stable security definer set search_path=public as $$
 select md5(jsonb_build_object('manufacturer',assigned_manufacturer_id,'option',selected_price_option_id,'quantities',order_quantities,'specifications',specifications,'garment',garment_type,'options',price_options)::text) from public.orders where id=p_order
$$;
revoke all on function public.qc_order_snapshot(uuid) from public,anon,authenticated;

-- Only the selected purchased/submitted option is production, not every alternative quote tier.
create or replace function public.qc_order_lines(p_order uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare o public.orders%rowtype; chosen jsonb; source jsonb; sources jsonb; part jsonb; sz record; rows jsonb:='[]'; line_id text; line_label text; expected integer; sized integer; n integer:=0;
begin
 select * into o from public.orders where id=p_order;
 select value into chosen from jsonb_array_elements(coalesce(o.price_options,'[]')) where value->>'id'=o.selected_price_option_id;
 if chosen is null then raise exception 'The production option has not been selected';end if;
 if jsonb_typeof(chosen->'lineItems')='array' and jsonb_array_length(chosen->'lineItems')>0 then sources:=chosen->'lineItems';
 elsif jsonb_typeof(chosen->'lines')='array' and jsonb_array_length(chosen->'lines')>0 then sources:=chosen->'lines';
 else
  select value into source from jsonb_array_elements(jsonb_build_array(o.order_quantities->'sample')||coalesce(o.order_quantities->'bulkRuns','[]')) where value->>'id'=o.selected_price_option_id;
  source:=coalesce(source,'{}')||jsonb_build_object('id',o.selected_price_option_id,'garmentType',o.garment_type,'label',coalesce(chosen->>'label',o.product_name),'totalUnits',chosen->'totalUnits');
  sources:=jsonb_build_array(source);
 end if;
 for part in select value from jsonb_array_elements(sources) loop
  n:=n+1;line_id:=coalesce(nullif(part->>'id',''),'line-'||n);line_label:=concat_ws(' · ',coalesce(part->>'garmentType',o.garment_type),part->>'label');
  expected:=coalesce(nullif(part->>'totalUnits','')::integer,nullif(part->>'targetTotal','')::integer,0);sized:=0;
  if jsonb_typeof(part->'bySize')='object' then
   for sz in select * from jsonb_each_text(part->'bySize') order by key loop
    if sz.value!~'^[0-9]+$' then raise exception 'Order size quantities need correction';end if;
    if sz.value::integer>0 then
     sized:=sized+sz.value::integer;
     rows:=rows||jsonb_build_array(jsonb_build_object('id',line_id||':size:'||sz.key,'label',line_label||' · '||upper(sz.key),'ordered',sz.value::integer));
    end if;
   end loop;
  end if;
  if expected=0 then expected:=sized;end if;
  if sized>expected or expected<=0 then raise exception 'Ordered line quantities need correction before QC';end if;
  if sized<expected then rows:=rows||jsonb_build_array(jsonb_build_object('id',line_id||':remaining','label',line_label||case when sized>0 then ' · Other / unallocated sizes' else '' end,'ordered',expected-sized));end if;
 end loop;
 if (select count(distinct x->>'id') from jsonb_array_elements(rows) x)<>jsonb_array_length(rows) then raise exception 'Order line identifiers must be unique';end if;
 if (select sum((x->>'ordered')::integer) from jsonb_array_elements(rows) x) is distinct from (chosen->>'totalUnits')::integer then raise exception 'Order line quantities do not match the selected option';end if;
 return rows;
end $$;
revoke all on function public.qc_order_lines(uuid) from public,anon,authenticated;

create or replace function public.qc_report_context(p_order uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare o public.orders%rowtype; rows jsonb:='[]'; message text;
begin
 if not public.qc_can_access(p_order) then raise exception 'QC access denied';end if;
 select * into o from public.orders where id=p_order;
 begin rows:=public.qc_order_lines(p_order);exception when others then message:=sqlerrm;end;
 return jsonb_build_object('ordered_lines',rows,'snapshot',public.qc_order_snapshot(p_order),'status',o.qc_status,
 'manufacturer_name',(select factory_name from public.manufacturer_profiles where user_id=o.assigned_manufacturer_id),
 'can_submit',o.assigned_manufacturer_id=auth.uid() and o.kind='production' and o.status='processing' and o.production_released_at is not null and o.factory_status='in_production' and message is null,
 'stage_available',o.kind='production' and o.status='processing' and o.production_released_at is not null and o.factory_status='in_production' and message is null,
 'unavailable_reason',coalesce(message,case when o.production_released_at is null then 'QC becomes available when this order is released to production.' when o.status<>'processing' then 'This order is no longer awaiting production QC.' end));
end $$;
revoke all on function public.qc_report_context(uuid) from public,anon;
grant execute on function public.qc_report_context(uuid) to authenticated;

-- Keep the previous server routine for controlled dispatch of pre-existing releases.
do $$ begin
 if to_regprocedure('public.qc_action_legacy(uuid,text,jsonb)') is null then alter function public.qc_action(uuid,text,jsonb) rename to qc_action_legacy;end if;
end $$;
revoke all on function public.qc_action_legacy(uuid,text,jsonb) from public,anon,authenticated;

create or replace function public.qc_action(p_order uuid,p_action text,p_data jsonb default '{}')
returns uuid language plpgsql security definer set search_path=public,storage as $$
declare o public.orders%rowtype; i public.qc_inspections%rowtype; latest public.qc_inspections%rowtype; e public.qc_evidence%rowtype;
 rid uuid; rows jsonb; normalized jsonb:='[]'; part jsonb; answer jsonb; photos jsonb; supports jsonb; asset text; meta jsonb; total integer:=0; changed boolean:=false; admin boolean; remaining integer;
begin
 if not public.qc_can_access(p_order) then raise exception 'QC access denied for this order';end if;
 select * into o from public.orders where id=p_order for update;
 if o.kind<>'production' then raise exception 'QC requires a production order';end if;
 admin:=public.is_superadmin();
 perform set_config('app.qc_write',p_order::text,true);perform set_config('app.workflow_write',p_order::text,true);perform set_config('app.routing_write',p_order::text,true);
 select * into latest from public.qc_inspections where order_id=p_order and workflow_version=2 order by report_version desc limit 1;
 if p_action='start_report' then
  if o.assigned_manufacturer_id is distinct from auth.uid() or o.production_released_at is null or o.status<>'processing' or o.factory_status is distinct from 'in_production' then raise exception 'Only the assigned manufacturer can submit QC for a production-released order';end if;
  if latest.id is not null and latest.qc_status='not_submitted' and latest.order_snapshot=public.qc_order_snapshot(p_order) and latest.manufacturer_id=auth.uid() then return latest.id;end if;
  if latest.qc_status='pending_review' and latest.order_snapshot=public.qc_order_snapshot(p_order) then raise exception 'QC is already pending review';end if;
  if latest.id is not null and latest.qc_status='not_submitted' then
   -- A stale draft is retained as an archived draft and cannot be submitted.
   update public.qc_inspections set draft_superseded=true where id=latest.id;
  end if;
  rows:=public.qc_order_lines(p_order);
  for part in select value from jsonb_array_elements(rows) loop
   answer:=null;
   if latest.manufacturer_id=auth.uid() and latest.order_snapshot=public.qc_order_snapshot(p_order) then select value into answer from jsonb_array_elements(latest.produced_lines) where value->>'id'=part->>'id';end if;
   normalized:=normalized||jsonb_build_array(part||jsonb_build_object('produced',coalesce((answer->>'produced')::integer,(part->>'ordered')::integer)));total:=total+coalesce((answer->>'produced')::integer,(part->>'ordered')::integer);
  end loop;
  insert into public.qc_inspections(order_id,requirement_id,stage,batch,manufacturer_id,inspector_id,produced,inspected,workflow_version,report_version,qc_status,produced_lines,order_snapshot,production_summary,has_issues,issue_description,photo_ids,supporting_ids,measurement_notes)
  values(p_order,null,'final','Production report',auth.uid(),auth.uid(),total,total,2,coalesce(latest.report_version,0)+1,'not_submitted',normalized,public.qc_order_snapshot(p_order),
   case when latest.manufacturer_id=auth.uid() then latest.production_summary else '' end,case when latest.manufacturer_id=auth.uid() then latest.has_issues end,case when latest.manufacturer_id=auth.uid() then latest.issue_description else '' end,
   case when latest.manufacturer_id=auth.uid() then latest.photo_ids else '[]' end,case when latest.manufacturer_id=auth.uid() then latest.supporting_ids else '[]' end,case when latest.manufacturer_id=auth.uid() then latest.measurement_notes else '' end) returning id into rid;
  update public.qc_shipment_releases set revoked_at=now() where order_id=p_order and revoked_at is null and dispatched_at is null;
  update public.orders set qc_status='not_submitted',qc_required=true,status_label='Production — QC not submitted' where id=p_order;
 elsif p_action in('save_report','submit_report','report_evidence','remove_report_evidence') then
  select * into i from public.qc_inspections where id=(p_data->>'id')::uuid and order_id=p_order and workflow_version=2 for update;
  if i.id is null or i.manufacturer_id is distinct from auth.uid() or o.assigned_manufacturer_id is distinct from auth.uid() then raise exception 'Only the assigned manufacturer can change this report';end if;
  if p_action='submit_report' and i.qc_status='pending_review' and i.id=latest.id and i.order_snapshot=public.qc_order_snapshot(p_order) and o.qc_status='pending_review' then return i.id;end if;
  if i.id is distinct from latest.id or i.qc_status<>'not_submitted' or i.order_snapshot is distinct from public.qc_order_snapshot(p_order) or o.status<>'processing' or o.production_released_at is null then raise exception 'This draft is no longer editable. Reload the current order';end if;
  rid:=i.id;
  if p_action='report_evidence' then
   asset:=p_data->>'path';
   if split_part(asset,'/',1)<>p_order::text or split_part(asset,'/',2)<>auth.uid()::text then raise exception 'Invalid evidence path';end if;
   select metadata into meta from storage.objects where bucket_id='qc-evidence' and name=asset;
   if meta is null or coalesce(meta->>'mimetype','') not in('image/jpeg','image/png','image/webp','application/pdf') or coalesce(meta->>'size','')!~'^[1-9][0-9]*$' or (meta->>'size')::bigint>10485760 then raise exception 'Evidence must be a JPG, PNG, WebP or PDF up to 10 MB';end if;
   if p_data->>'file_role' not in('photo','support') or p_data->>'file_role' is null or (p_data->>'file_role'='photo' and meta->>'mimetype'='application/pdf') then raise exception 'Production photos must be JPG, PNG or WebP';end if;
   if (p_data->>'file_role'='photo' and jsonb_array_length(i.photo_ids)>=40) or (p_data->>'file_role'='support' and jsonb_array_length(i.supporting_ids)>=20) then raise exception 'Upload limit reached (40 photos and 20 supporting files)';end if;
   insert into public.qc_evidence(order_id,inspection_id,path,file_name,uploaded_by,file_role,mime_type,byte_size)
    values(p_order,i.id,asset,left(coalesce(p_data->>'file_name','Evidence'),250),auth.uid(),p_data->>'file_role',meta->>'mimetype',(meta->>'size')::bigint) returning id into rid;
   update public.qc_inspections set photo_ids=case when p_data->>'file_role'='photo' then photo_ids||to_jsonb(rid::text) else photo_ids end,supporting_ids=case when p_data->>'file_role'='support' then supporting_ids||to_jsonb(rid::text) else supporting_ids end where id=i.id;
  elsif p_action='remove_report_evidence' then
   asset:=p_data->>'evidence_id';
   update public.qc_inspections set photo_ids=photo_ids-asset,supporting_ids=supporting_ids-asset where id=i.id;
   delete from public.qc_evidence x where x.id=asset::uuid and x.inspection_id=i.id and not exists(select 1 from public.qc_inspections v where v.submitted_at is not null and (v.photo_ids ? asset or v.supporting_ids ? asset));
  else
   rows:=public.qc_order_lines(p_order);
   if jsonb_typeof(p_data->'produced_lines') is distinct from 'array' or jsonb_array_length(p_data->'produced_lines')<>jsonb_array_length(rows) then raise exception 'Provide produced quantities for every ordered line and size';end if;
   for part in select value from jsonb_array_elements(rows) loop
    select value into answer from jsonb_array_elements(p_data->'produced_lines') where value->>'id'=part->>'id';
    if answer is null or coalesce(answer->>'produced','')!~'^[0-9]+$' or (select count(*) from jsonb_array_elements(p_data->'produced_lines') x where x->>'id'=part->>'id')<>1 or (answer->>'produced')::numeric>100000000 then raise exception 'Each line needs a whole-number produced quantity';end if;
    normalized:=normalized||jsonb_build_array(part||jsonb_build_object('produced',(answer->>'produced')::integer));
    total:=total+(answer->>'produced')::integer;changed:=changed or (answer->>'produced')::integer<>(part->>'ordered')::integer;
   end loop;
   photos:=coalesce(p_data->'photo_ids',i.photo_ids);supports:=coalesce(p_data->'supporting_ids',i.supporting_ids);
   if jsonb_typeof(photos)<>'array' or jsonb_typeof(supports)<>'array' or jsonb_array_length(photos)>40 or jsonb_array_length(supports)>20 then raise exception 'Invalid evidence selection';end if;
   if (select count(distinct value) from jsonb_array_elements_text(photos))<>jsonb_array_length(photos) or (select count(distinct value) from jsonb_array_elements_text(supports))<>jsonb_array_length(supports) then raise exception 'Evidence must not be duplicated';end if;
   for asset in select value from jsonb_array_elements_text(photos||supports) loop
    select x.* into e from public.qc_evidence x join public.qc_inspections v on v.id=x.inspection_id where x.id=asset::uuid and x.order_id=p_order and v.manufacturer_id=auth.uid() and v.workflow_version=2;
    if e.id is null or (photos ? asset and e.file_role<>'photo') or (supports ? asset and e.file_role<>'support') then raise exception 'Evidence does not belong to this factory and order';end if;
   end loop;
   if p_action='submit_report' then
    if total<=0 then raise exception 'Quantity Produced must be a positive whole number';end if;
    if jsonb_array_length(photos)=0 then raise exception 'Upload at least one production photo';end if;
    if coalesce(length(btrim(p_data->>'production_summary')),0)=0 then raise exception 'Production Summary is required';end if;
    if p_data->>'has_issues' not in('true','false') or p_data->>'has_issues' is null then raise exception 'Declare whether there were production issues';end if;
    if (changed or (p_data->>'has_issues')::boolean) and coalesce(length(btrim(p_data->>'issue_description')),0)=0 then raise exception 'Explain production issues and quantity discrepancies';end if;
    if coalesce((p_data->>'manufacturer_confirmed')::boolean,false) is not true then raise exception 'Confirm the accuracy of your submission';end if;
   end if;
   if length(coalesce(p_data->>'production_summary',''))>6000 or length(coalesce(p_data->>'issue_description',''))>6000 or length(coalesce(p_data->>'measurement_notes',''))>10000 then raise exception 'Report text exceeds the supported length';end if;
   update public.qc_inspections set production_summary=coalesce(p_data->>'production_summary',''),produced_lines=normalized,produced=greatest(total,1),inspected=greatest(total,1),
    has_issues=case when changed then true else nullif(p_data->>'has_issues','')::boolean end,issue_description=coalesce(p_data->>'issue_description',''),photo_ids=photos,supporting_ids=supports,measurement_notes=coalesce(p_data->>'measurement_notes',''),
    manufacturer_confirmed=p_action='submit_report',confirmed_at=case when p_action='submit_report' then now() end,
    qc_status=case when p_action='submit_report' then 'pending_review' else 'not_submitted' end,result=case when p_action='submit_report' then 'submitted' else 'draft' end,submitted_at=case when p_action='submit_report' then now() end where id=i.id;
   if p_action='submit_report' then
    update public.orders set qc_status='pending_review',status_label='QC pending review' where id=p_order;
    perform public.notify_superadmin('order','QC ready for review',o.product_name||' — production report v'||i.report_version,'/superadmin/orders/'||p_order,p_order);
   end if;
  end if;
 elsif p_action in('approve_report','request_report_changes') then
  if not admin then raise exception 'Only an authorised superadmin may review QC';end if;
  select * into i from public.qc_inspections where id=(p_data->>'id')::uuid and order_id=p_order and workflow_version=2 for update;
  if i.id is null or i.id is distinct from latest.id or i.qc_status<>'pending_review' or i.order_snapshot is distinct from public.qc_order_snapshot(p_order) or i.manufacturer_id is distinct from o.assigned_manufacturer_id or o.status<>'processing' then raise exception 'Review the current pending submission';end if;
  if i.manufacturer_id=auth.uid() then raise exception 'Manufacturers cannot approve or review their own submissions';end if;
  if p_action='request_report_changes' and coalesce(length(btrim(p_data->>'feedback')),0)=0 then raise exception 'Explain what needs to be corrected';end if;
  update public.qc_inspections set qc_status=case when p_action='approve_report' then 'approved' else 'changes_required' end,
   result=case when p_action='approve_report' then 'passed' else 'submitted' end,accepted=case when p_action='approve_report' then produced else 0 end,reviewed_by=auth.uid(),reviewed_at=now(),review_note=coalesce(p_data->>'feedback','') where id=i.id;
  update public.qc_shipment_releases set revoked_at=now() where order_id=p_order and revoked_at is null and dispatched_at is null;
  if p_action='approve_report' then
   select i.produced-coalesce(sum(quantity),0)::integer into remaining from public.qc_shipment_releases where order_id=p_order and dispatched_at is not null;
   if remaining<=0 then raise exception 'There are no remaining produced units to dispatch';end if;
   insert into public.qc_shipment_releases(order_id,inspection_id,quantity,reason,approved_by) values(p_order,i.id,remaining,'QC report v'||i.report_version||' approved',auth.uid());
  end if;
  update public.orders set qc_status=case when p_action='approve_report' then 'approved' else 'changes_required' end,status_label=case when p_action='approve_report' then 'Ready for dispatch' else 'QC changes required' end where id=p_order;
  perform public.notify_manufacturer(i.manufacturer_id,'order',case when p_action='approve_report' then 'QC approved — ready for dispatch' else 'QC changes required' end,o.product_name||case when p_action='request_report_changes' then ': '||(p_data->>'feedback') else ' — your production report has been approved.' end,'/manufacturer/orders/'||p_order,p_order);
  rid:=i.id;
 elsif p_action='dispatch' then
  if o.qc_status<>'approved' or o.production_released_at is null or o.status not in('processing','shipping') then raise exception 'QC must be approved before dispatch';end if;
  if coalesce(length(btrim(p_data->>'tracking')),0)=0 then raise exception 'Enter the carrier tracking or handover reference';end if;
  if latest.id is not null and (latest.qc_status<>'approved' or latest.order_snapshot is distinct from public.qc_order_snapshot(p_order) or latest.manufacturer_id is distinct from o.assigned_manufacturer_id) then raise exception 'The latest production details require QC approval';end if;
  update public.qc_shipment_releases set dispatched_at=now(),tracking=btrim(p_data->>'tracking') where id=(p_data->>'id')::uuid and order_id=p_order and revoked_at is null and dispatched_at is null and (latest.id is null or inspection_id=latest.id) returning id into rid;
  if rid is null then raise exception 'No unused approved shipment is available';end if;
  update public.orders set status='shipping',status_label='Shipped',tracking=btrim(p_data->>'tracking') where id=p_order;
 else raise exception 'Checklist QC actions are archived. Use the production report and review actions';end if;
 insert into public.qc_audit_events(order_id,actor_id,action,details) values(p_order,auth.uid(),p_action,jsonb_build_object('record_id',rid,'feedback',p_data->>'feedback','manufacturer_id',o.assigned_manufacturer_id));
 return rid;
end $$;
revoke all on function public.qc_action(uuid,text,jsonb) from public,anon;
grant execute on function public.qc_action(uuid,text,jsonb) to authenticated;

create or replace function public.qc_guard_dispatch() returns trigger language plpgsql security definer set search_path=public as $$
declare maximum integer; dispatched integer;
begin
 if tg_op='INSERT' then
  if new.kind='production' then new.qc_required:=true;new.qc_status:='not_submitted';end if;return new;
 end if;
 if (new.qc_required,new.qc_status) is distinct from (old.qc_required,old.qc_status) and current_setting('app.qc_write',true) is distinct from new.id::text then raise exception 'QC status is managed by the review workflow';end if;
 if (new.assigned_manufacturer_id,new.selected_price_option_id,new.garment_type,new.order_quantities,new.specifications,new.price_options) is distinct from (old.assigned_manufacturer_id,old.selected_price_option_id,old.garment_type,old.order_quantities,old.specifications,old.price_options) then
  perform set_config('app.qc_write',new.id::text,true);
  update public.qc_shipment_releases set revoked_at=now() where order_id=new.id and revoked_at is null and dispatched_at is null;
  new.qc_status:='not_submitted';
  if new.status='processing' and old.qc_status in('approved','pending_review','changes_required') then new.status_label:='Production — QC review required';end if;
  if exists(select 1 from public.qc_inspections where order_id=new.id and workflow_version=2 and submitted_at is not null) then
   insert into public.qc_audit_events(order_id,actor_id,action,details) values(new.id,auth.uid(),'production_details_changed','{}');
  end if;
 end if;
 if new.status_label='Ready for dispatch' and new.qc_status<>'approved' then raise exception 'QC approval is required before Ready for Dispatch';end if;
 if old.kind='production' and (old.qc_required or new.qc_required) and new.status is distinct from old.status and new.status in('shipping','completed','ready') then
  if new.qc_status<>'approved' then raise exception 'QC approval is required before dispatch';end if;
  if new.status='shipping' and (current_setting('app.qc_write',true) is distinct from new.id::text or not exists(select 1 from public.qc_shipment_releases where order_id=new.id and dispatched_at is not null and revoked_at is null)) then raise exception 'Use approved QC carrier handover to dispatch';end if;
  if new.status in('completed','ready') then
   select produced into maximum from public.qc_inspections where order_id=new.id and workflow_version=2 and qc_status='approved' order by report_version desc limit 1;
   if maximum is null then select (x->>'totalUnits')::integer into maximum from jsonb_array_elements(coalesce(new.price_options,'[]')) x where x->>'id'=new.selected_price_option_id;end if;
   select coalesce(sum(quantity),0) into dispatched from public.qc_shipment_releases where order_id=new.id and dispatched_at is not null;
   if maximum is null or dispatched<maximum then raise exception 'Dispatch all approved production before completing the order';end if;
  end if;
 end if;
 return new;
end $$;

-- Existing approved releases remain usable; no legacy report or decision is rewritten.
do $$ declare target uuid;begin
 for target in select distinct order_id from public.qc_shipment_releases where revoked_at is null loop
  perform set_config('app.qc_write',target::text,true);perform set_config('app.workflow_write',target::text,true);
  update public.orders set qc_status='approved' where id=target and qc_status='not_submitted' and not exists(select 1 from public.qc_inspections where order_id=target and workflow_version=2);
 end loop;
end $$;
select public.apply_superadmin_access();
notify pgrst,'reload schema';
commit;

-- Central account currency (20261022020000)
begin;
-- One backend preference; seed only explicitly recorded manufacturer preferences.
alter table public.profiles add column if not exists preferred_currency text;
update public.profiles p set preferred_currency=m.pricing->>'preferredCurrency' from public.manufacturer_profiles m where m.user_id=p.id and p.preferred_currency is null and m.pricing->>'preferredCurrency' in('EUR','GBP','USD');
update public.profiles set preferred_currency='EUR' where preferred_currency is null;
alter table public.profiles alter column preferred_currency set default 'EUR',alter column preferred_currency set not null;
alter table public.profiles drop constraint if exists profiles_preferred_currency_check;
alter table public.profiles add constraint profiles_preferred_currency_check check(preferred_currency in('EUR','USD','GBP'));
create or replace function public.set_account_currency(p_currency text) returns text language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in to save currency';end if;
 if p_currency is null or p_currency not in('EUR','USD','GBP')then raise exception 'Unsupported currency';end if;
 insert into public.profiles(id,email,preferred_currency) values(auth.uid(),coalesce(auth.jwt()->>'email',''),p_currency) on conflict(id)do update set preferred_currency=excluded.preferred_currency;
 return p_currency;
end $$;
revoke all on function public.set_account_currency(text)from public,anon;grant execute on function public.set_account_currency(text)to authenticated;
-- Keep old onboarding clients compatible with the single authoritative preference.
create or replace function public.sync_account_currency()returns trigger language plpgsql security definer set search_path=public as $$
begin
 if pg_trigger_depth()>1 then return new;end if;
 if tg_table_name='profiles' then
  update public.manufacturer_profiles set pricing=jsonb_set(coalesce(pricing,'{}'),'{preferredCurrency}',to_jsonb(new.preferred_currency),true)where user_id=new.id and pricing->>'preferredCurrency' is distinct from new.preferred_currency;
 elsif new.pricing->>'preferredCurrency' in('EUR','USD','GBP')then
  update public.profiles set preferred_currency=new.pricing->>'preferredCurrency' where id=new.user_id and preferred_currency is distinct from new.pricing->>'preferredCurrency';
 end if;return new;
end $$;
drop trigger if exists profiles_currency_sync on public.profiles;
create trigger profiles_currency_sync after insert or update of preferred_currency on public.profiles for each row execute function public.sync_account_currency();
drop trigger if exists manufacturer_currency_sync on public.manufacturer_profiles;
create trigger manufacturer_currency_sync after insert or update of pricing on public.manufacturer_profiles for each row execute function public.sync_account_currency();
revoke all on function public.sync_account_currency()from public,anon,authenticated;

create table if not exists public.currency_rate_cache(
 id boolean primary key default true check(id),rates jsonb,rate_date date,retrieved_at timestamptz,provider text not null default 'Frankfurter / ECB',
 refresh_seconds integer not null default 86400 check(refresh_seconds between 3600 and 604800),max_age_seconds integer not null default 259200 check(max_age_seconds between 3600 and 604800),
 binding_max_age_seconds integer not null default 86400 check(binding_max_age_seconds between 3600 and 86400),
 request_id bigint,requested_at timestamptz,last_error text,
 check(rates is null or (jsonb_typeof(rates)='object' and rates?'EUR' and rates?'USD' and rates?'GBP' and (rates->>'EUR')::numeric=1 and (rates->>'USD')::numeric>0 and (rates->>'GBP')::numeric>0))
);
alter table public.currency_rate_cache drop constraint if exists currency_rate_cache_shape;
alter table public.currency_rate_cache add constraint currency_rate_cache_shape check(rates is null or ((jsonb_typeof(rates)='object' and (rates->>'EUR')::numeric=1 and (rates->>'GBP')::numeric>0 and (rates->>'USD')::numeric>0 and rate_date is not null and retrieved_at is not null) is true));
insert into public.currency_rate_cache(id)values(true)on conflict(id)do nothing;
alter table public.currency_rate_cache enable row level security;
-- Reuse the migration-only helper, including all its existing application tables.
do $$declare def text;begin
 select pg_get_functiondef('public.apply_superadmin_access()'::regprocedure)into def;
 if position('currency_rate_cache' in def)=0 then def:=replace(def,'''qc_defect_events''','''qc_defect_events'',''currency_rate_cache''');execute def;end if;
end $$;
select public.apply_superadmin_access();
create extension if not exists pg_net with schema extensions;
-- This internal worker only fetches a fixed public provider URL; callers cannot supply URLs/rates.
create or replace function public.refresh_currency_rates()returns void language plpgsql security definer set search_path=public,net as $$
declare c public.currency_rate_cache%rowtype;r record;payload jsonb;item jsonb;v_rates jsonb:='{"EUR":"1"}';d date;rid bigint;
begin
 select * into c from public.currency_rate_cache where id=true for update;
 if c.request_id is not null then
  select * into r from net._http_response where id=c.request_id;
  if found then
   begin
    if r.status_code is distinct from 200 or r.error_msg is not null then raise exception 'Exchange rate provider unavailable';end if;
    payload:=r.content::jsonb;if jsonb_typeof(payload)<>'array' or jsonb_array_length(payload)<>2 then raise exception 'Invalid exchange rate response';end if;
    for item in select value from jsonb_array_elements(payload)loop
     if item->>'base' is distinct from 'EUR' or coalesce(item->>'quote','') not in('USD','GBP') or (item->>'rate')::numeric<=0 or (item->>'rate')::numeric>1000 then raise exception 'Invalid exchange rate';end if;
     if item->>'date' is null or (item->>'date')::date>current_date or (item->>'date')::date<current_date-7 then raise exception 'Provider rates are outdated';end if;
     if d is not null and d<>(item->>'date')::date then raise exception 'Rate dates do not match';end if;d:=(item->>'date')::date;
     v_rates:=jsonb_set(v_rates,array[item->>'quote'],to_jsonb(item->>'rate'));
    end loop;
    if not(v_rates?'GBP' and v_rates?'USD')then raise exception 'Missing currency rates';end if;
    update public.currency_rate_cache set rates=v_rates,rate_date=d,retrieved_at=now(),last_error=null,request_id=null where id=true;
   exception when others then update public.currency_rate_cache set last_error=sqlerrm,request_id=null where id=true;end;
  elsif c.requested_at<now()-interval '2 minutes'then update public.currency_rate_cache set request_id=null,last_error='Exchange rate request timed out'where id=true;
  end if;
 end if;
 select * into c from public.currency_rate_cache where id=true;
 if c.request_id is null and (c.retrieved_at is null or c.retrieved_at<now()-make_interval(secs=>least(c.refresh_seconds,c.binding_max_age_seconds))) and (c.requested_at is null or c.requested_at<now()-interval '5 minutes')then
  select net.http_get(url:='https://api.frankfurter.dev/v2/providers/ecb/rates?base=EUR&quotes=USD,GBP',timeout_milliseconds:=10000)into rid;
  update public.currency_rate_cache set request_id=rid,requested_at=now()where id=true;
 end if;
exception when others then update public.currency_rate_cache set last_error='Exchange rates are temporarily unavailable'where id=true;
end $$;
revoke all on function public.refresh_currency_rates()from public,anon,authenticated;
create or replace function public.currency_context()returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.currency_rate_cache%rowtype;preferred text;
begin
 if auth.uid() is null then raise exception 'Sign in to load currency';end if;
 select preferred_currency into preferred from public.profiles where id=auth.uid();
 if preferred is null then perform public.set_account_currency('EUR');preferred:='EUR';end if;
 perform public.refresh_currency_rates();select * into c from public.currency_rate_cache where id=true;
 return jsonb_build_object('currency',preferred,'rates',case when c.retrieved_at>now()-make_interval(secs=>c.max_age_seconds)and c.rate_date>=current_date-7 then jsonb_build_object('rates',c.rates,'retrieved_at',c.retrieved_at,'rate_date',c.rate_date,'provider',c.provider,'valid_until',least(c.retrieved_at+make_interval(secs=>c.max_age_seconds),(c.rate_date+8)::timestamptz))else null end,'rate_error',case when c.retrieved_at is null then coalesce(c.last_error,'Exchange rates are loading') when c.retrieved_at<=now()-make_interval(secs=>c.max_age_seconds)or c.rate_date<current_date-7 then 'Cached exchange rates have expired'else c.last_error end);
end $$;
revoke all on function public.currency_context()from public,anon;grant execute on function public.currency_context()to authenticated;
create or replace function public.currency_convert_minor(p_amount bigint,p_source text,p_target text,p_binding boolean default false)returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.currency_rate_cache%rowtype;rate numeric;converted numeric;
begin
 if p_amount is null or abs(p_amount::numeric)>9007199254740991 or p_source is null or p_target is null or p_source not in('EUR','USD','GBP')or p_target not in('EUR','USD','GBP')then raise exception 'Currency needs review';end if;
 if p_source=p_target then return jsonb_build_object('amount',p_amount,'rate','1','source_rate','1','target_rate','1','provider','same currency','rate_date',null,'retrieved_at',null);end if;
 select * into c from public.currency_rate_cache where id=true;
 if c.rates is null or c.rate_date is null or c.retrieved_at is null or c.retrieved_at>now()+interval '5 minutes' or c.retrieved_at<now()-make_interval(secs=>case when p_binding then c.binding_max_age_seconds else c.max_age_seconds end)or c.rate_date<current_date-7 then raise exception 'A current exchange rate is required; try again after refreshing rates';end if;
 rate:=(c.rates->>p_target)::numeric/(c.rates->>p_source)::numeric;converted:=round(p_amount::numeric*(c.rates->>p_target)::numeric/(c.rates->>p_source)::numeric);
 if abs(converted)>9007199254740991 then raise exception 'Converted amount exceeds supported limits';end if;
 return jsonb_build_object('amount',converted,'rate',rate::text,'source_rate',c.rates->>p_source,'target_rate',c.rates->>p_target,'provider',c.provider,'rate_date',c.rate_date,'retrieved_at',c.retrieved_at);
end $$;
revoke all on function public.currency_convert_minor(bigint,text,text,boolean)from public,anon,authenticated;

-- Additive immutable quotation history; keep old price_options untouched.
create table if not exists public.order_quote_currency_snapshots(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id)on delete cascade,created_by uuid references auth.users(id)on delete set null,
 created_at timestamptz not null,expires_at timestamptz not null,target_currency text not null check(target_currency in('EUR','USD','GBP')),options jsonb not null check(jsonb_typeof(options)='array'),manufacturer_quote jsonb not null,
 unique(order_id,created_at)
);
create index if not exists order_quote_currency_order_idx on public.order_quote_currency_snapshots(order_id,created_at desc);
alter table public.order_quote_currency_snapshots enable row level security;
drop policy if exists quote_currency_owner_read on public.order_quote_currency_snapshots;
create policy quote_currency_owner_read on public.order_quote_currency_snapshots for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
do $$declare def text;begin select pg_get_functiondef('public.apply_superadmin_access()'::regprocedure)into def;if position('order_quote_currency_snapshots' in def)=0 then def:=replace(def,'''currency_rate_cache''','''currency_rate_cache'',''order_quote_currency_snapshots''');execute def;end if;end $$;
select public.apply_superadmin_access();
create or replace function public.guard_quote_currency_history()returns trigger language plpgsql set search_path=public as $$begin
 if tg_op='INSERT' and current_setting('app.currency_quote_write',true)=new.order_id::text then return new;end if;
 if tg_op='DELETE' and not exists(select 1 from public.orders where id=old.order_id)then return old;end if;
 if tg_op='UPDATE' and pg_trigger_depth()>1 and new.created_by is null and (to_jsonb(new)-'created_by')=(to_jsonb(old)-'created_by')then return new;end if;
 raise exception 'Issued quotation currency snapshots are immutable';end $$;
drop trigger if exists quote_currency_history_guard on public.order_quote_currency_snapshots;
create trigger quote_currency_history_guard before insert or update or delete on public.order_quote_currency_snapshots for each row execute function public.guard_quote_currency_history();
revoke all on function public.guard_quote_currency_history()from public,anon,authenticated;
create or replace function public.publish_order_quote(p_order_id uuid,p_prices jsonb)returns uuid language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;tier jsonb;approved jsonb;options jsonb:='[]';target text;source text;fx jsonb;source_amount bigint;manufacturer_amount bigint;markup bigint;shipping bigint;tax bigint;fees bigint;issued timestamptz:=now();
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.kind<>'production' or o.status not in('submitted','awaiting_payment','priced')or o.factory_status is distinct from 'quoted'then raise exception 'Review a submitted manufacturer quotation first';end if;
 if o.status='priced'and jsonb_array_length(coalesce(o.price_options,'[]'))>0 and o.quote_expires_at>now()then raise exception 'The current offer has already been published';end if;
 select preferred_currency into target from public.profiles where id=o.user_id;if target is null then raise exception 'Customer currency needs review';end if;
 if jsonb_typeof(p_prices)is distinct from 'array'or jsonb_array_length(p_prices)=0 or jsonb_array_length(p_prices)<>jsonb_array_length(coalesce(o.manufacturer_quote,'[]'))or(select count(distinct value->>'id')from jsonb_array_elements(p_prices))<>jsonb_array_length(p_prices)then raise exception 'Approve each quotation option exactly once';end if;
 for tier in select value from jsonb_array_elements(o.manufacturer_quote)loop
  select value into approved from jsonb_array_elements(p_prices)where value->>'id'=tier->>'id';source:=tier->>'currency';
  if approved is null or source is null or source not in('EUR','USD','GBP')or coalesce(approved->>'cents','')!~'^[1-9][0-9]*$'or(approved->>'cents')::numeric>100000000000 or coalesce(tier->>'manufacturerQuoteCents','')!~'^[1-9][0-9]*$'then raise exception 'Valid original amounts and currency are required; ambiguous historical quotes need review';end if;
  -- Admin inputs remain explicitly in the original quote currency. Existing margins are already in this total.
  source_amount:=(approved->>'cents')::bigint;manufacturer_amount:=(tier->>'manufacturerQuoteCents')::bigint;
  shipping:=coalesce((approved->>'shippingCents')::bigint,0);tax:=coalesce((approved->>'taxCents')::bigint,0);fees:=coalesce((approved->>'feesCents')::bigint,0);
  if least(shipping,tax,fees)<0 then raise exception 'Costs cannot be negative';end if;
  markup:=source_amount-manufacturer_amount-shipping-tax-fees;
  fx:=public.currency_convert_minor(source_amount,source,target,true);
  options:=options||jsonb_build_array(jsonb_build_object('id',tier->>'id','kind',tier->>'kind','label',tier->>'label','description',(tier->>'totalUnits')||' units','totalUnits',tier->'totalUnits','priceCents',fx->'amount','currency',target,'leadTimeDays',tier->'leadTimeDays','currencySnapshot',jsonb_build_object('originalManufacturerCents',manufacturer_amount,'originalCurrency',source,'approvedOriginalCents',source_amount,'markupCents',markup,'shippingCents',shipping,'taxCents',tax,'feesCents',fees,'costsCurrency',source,'shippingIncludedInManufacturerQuote',true,'rate',fx->>'rate','sourceRate',fx->>'source_rate','targetRate',fx->>'target_rate','rateDate',fx->'rate_date','retrievedAt',fx->'retrieved_at','provider',fx->>'provider','issuedAt',issued,'expiresAt',issued+interval '30 days')));
 end loop;
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.workflow_write',p_order_id::text,true);perform set_config('app.routing_action','offer_published',true);perform set_config('app.currency_quote_write',p_order_id::text,true);
 update public.orders set price_options=options,priced_at=issued,offer_issued_at=issued,quote_expires_at=issued+interval '30 days',status='priced',status_label='Quote ready — valid for 30 days'where id=p_order_id;
 insert into public.order_quote_currency_snapshots(order_id,created_by,created_at,expires_at,target_currency,options,manufacturer_quote)values(p_order_id,auth.uid(),issued,issued+interval '30 days',target,options,o.manufacturer_quote);
 return p_order_id;
end $$;
revoke all on function public.publish_order_quote(uuid,jsonb)from public,anon;grant execute on function public.publish_order_quote(uuid,jsonb)to authenticated;
-- Preserve old data and expose unknown currency records for authorised review.
create or replace function public.currency_review_orders()returns table(order_id uuid,reason text)language plpgsql security definer set search_path=public as $$begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 return query select o.id,'Original currency is missing or unsupported; do not infer from an account preference.'::text from public.orders o where exists(select 1 from jsonb_array_elements(coalesce(o.manufacturer_quote,'[]')) t where coalesce(t->>'currency','')not in('EUR','GBP','USD'))or exists(select 1 from jsonb_array_elements(coalesce(o.price_options,'[]')) t where coalesce(t->>'currency','')not in('EUR','GBP','USD'));
end $$;
revoke all on function public.currency_review_orders()from public,anon;grant execute on function public.currency_review_orders()to authenticated;
create or replace function public.submit_manufacturer_quote(p_order_id uuid, p_tiers jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; requirement jsonb; tier jsonb; requirements jsonb; normalized jsonb := '[]'; units numeric; unit_price numeric; days numeric; line_id text; line_kind text; quote_currency text;
begin
 if auth.uid() is null then raise exception 'Sign in to submit a quotation';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.assigned_manufacturer_id is distinct from auth.uid() then raise exception 'This order is not assigned to your factory';end if;
 if target.status not in('submitted','awaiting_payment') or coalesce(target.factory_status,'new') not in('new','reviewing','clarifying','quoted') then raise exception 'This order is no longer accepting manufacturer quotations';end if;
 if jsonb_array_length(coalesce(target.manufacturer_quote,'[]'::jsonb))>0 then
  quote_currency := target.manufacturer_quote->0->>'currency';
 else
  select preferred_currency into quote_currency from public.profiles where id=auth.uid();
 end if;
 if quote_currency is null or quote_currency not in('GBP','USD','EUR') then raise exception 'Original quotation currency needs review';end if;
 if jsonb_typeof(target.order_quantities->'sample')='object' then
  requirements := jsonb_build_array(target.order_quantities->'sample') || coalesce(target.order_quantities->'bulkRuns','[]'::jsonb);
 elsif coalesce(target.quote_request->>'quantity','') ~ '^[1-9][0-9]*$' then
  requirements := jsonb_build_array(jsonb_build_object('id','factory-quote','kind','bulk','targetTotal',(target.quote_request->>'quantity')::numeric));
 else raise exception 'The customer quantity is missing. Ask Ceriga to complete the order quantities';end if;
 if jsonb_typeof(p_tiers) is distinct from 'array' or jsonb_array_length(p_tiers)<>jsonb_array_length(requirements) or jsonb_array_length(p_tiers) not between 1 and 20 then raise exception 'Quote every customer quantity option';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_tiers))<>jsonb_array_length(p_tiers) then raise exception 'Quotation tier IDs must be unique';end if;
 for requirement in select value from jsonb_array_elements(requirements) loop
  line_id := requirement->>'id'; line_kind := requirement->>'kind';
  units := coalesce((requirement->>'targetTotal')::numeric,(select sum(value::numeric) from jsonb_each_text(coalesce(requirement->'bySize','{}'::jsonb))));
  if units is null or units<=0 or units<>trunc(units) or units>100000000 then raise exception 'The customer quantity is missing or invalid';end if;
  select value into tier from jsonb_array_elements(p_tiers) where value->>'id'=line_id;
  if tier is null or coalesce(tier->>'currency','')<>quote_currency or coalesce(tier->>'unitPriceCents','') !~ '^[1-9][0-9]*$' or coalesce(tier->>'leadTimeDays','') !~ '^[1-9][0-9]*$' then raise exception 'Each option requires a positive unit price in the quotation currency and a lead time';end if;
  unit_price := (tier->>'unitPriceCents')::numeric; days := (tier->>'leadTimeDays')::numeric;
  if days>3650 or unit_price*units>100000000000 then raise exception 'Quotation values exceed supported limits';end if;
  normalized := normalized || jsonb_build_array(jsonb_build_object('id',line_id,'kind',line_kind,'label',case when line_kind='sample' then 'Samples' else 'Bulk · '||units::text||' units' end,'totalUnits',units,'unitPriceCents',unit_price,'manufacturerQuoteCents',unit_price*units,'currency',quote_currency,'leadTimeDays',days));
 end loop;
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.workflow_write',p_order_id::text,true);
 update public.orders set manufacturer_quote=normalized,factory_status='quoted',factory_reject_reason=null,quoted_at=now() where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.submit_manufacturer_quote(uuid,jsonb) from public,anon;
grant execute on function public.submit_manufacturer_quote(uuid,jsonb) to authenticated;


alter table public.orders add column if not exists paid_currency text check(paid_currency in('EUR','USD','GBP')),
 add column if not exists total_currency text check(total_currency in('EUR','USD','GBP'));
-- Receipts and selected options provide evidence; ambiguous totals remain null.
do $$declare receipt record;begin for receipt in select p.order_id,p.currency from public.order_verified_payments p join public.orders o on o.id=p.order_id where o.paid_currency is null and p.currency in('EUR','USD','GBP')loop perform set_config('app.routing_write',receipt.order_id::text,true);perform set_config('app.workflow_write',receipt.order_id::text,true);update public.orders set paid_currency=receipt.currency where id=receipt.order_id;end loop;end $$;
create or replace function public.guard_order_money_currency()returns trigger language plpgsql set search_path=public as $$begin
 if tg_op='INSERT' then if new.kind='tech-pack' then new.total_currency:='EUR';end if;return new;end if;
 if new.paid_currency is distinct from old.paid_currency and current_setting('app.routing_write',true)is distinct from old.id::text then raise exception 'Payment currency is controlled by verified payments';end if;
 if old.price_options is not null and exists(select 1 from jsonb_array_elements(old.price_options) v where v?'currencySnapshot') and new.price_options is distinct from old.price_options and current_setting('app.routing_write',true)is distinct from old.id::text then raise exception 'Issued quotation prices and currencies are locked; use the approved quote workflow';end if;
 if old.total is not null and new.total_currency is distinct from old.total_currency then raise exception 'Original monetary currency cannot be relabelled';end if;return new;
end $$;
drop trigger if exists orders_money_currency_guard on public.orders;
create trigger orders_money_currency_guard before insert or update on public.orders for each row execute function public.guard_order_money_currency();
revoke all on function public.guard_order_money_currency()from public,anon,authenticated;
do $$begin if to_regprocedure('public.confirm_order_payment_currency_legacy(uuid,text,text,bigint,text,timestamptz)')is null then alter function public.confirm_order_payment(uuid,text,text,bigint,text,timestamptz)rename to confirm_order_payment_currency_legacy;end if;end $$;
revoke all on function public.confirm_order_payment_currency_legacy(uuid,text,text,bigint,text,timestamptz)from public,anon,authenticated,service_role;
create or replace function public.confirm_order_payment(p_order_id uuid,p_option_id text,p_event_id text,p_amount bigint,p_currency text,p_paid_at timestamptz)returns uuid language plpgsql security definer set search_path=public as $$begin
 if p_currency is null or p_currency not in('EUR','USD','GBP')then raise exception 'Unsupported payment currency';end if;
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.workflow_write',p_order_id::text,true);
 perform public.confirm_order_payment_currency_legacy(p_order_id,p_option_id,p_event_id,p_amount,p_currency,p_paid_at);
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.workflow_write',p_order_id::text,true);
 update public.orders set paid_currency=p_currency where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.confirm_order_payment(uuid,text,text,bigint,text,timestamptz)from public,anon,authenticated;grant execute on function public.confirm_order_payment(uuid,text,text,bigint,text,timestamptz)to service_role;

-- Explicit admin review path for ambiguous, unpaid legacy quotes. Never relabel an amount.
create or replace function public.request_currency_requote(p_order_id uuid,p_reason text)returns uuid language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 if length(btrim(coalesce(p_reason,'')))not between 5 and 6000 then raise exception 'Explain the currency review and evidence needed';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.assigned_manufacturer_id is null or o.status not in('submitted','awaiting_payment','priced')or o.production_released_at is not null or o.paid_amount_cents is not null then raise exception 'Only unpaid, unreleased quotations can be returned for currency review';end if;
 if not exists(select 1 from public.currency_review_orders() r where r.order_id=p_order_id)then raise exception 'This quote has explicit currencies; use the existing quote review process';end if;
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.workflow_write',p_order_id::text,true);perform set_config('app.routing_action','currency_requote_requested',true);
 insert into public.order_routing_events(order_id,actor_id,event_type,manufacturer_id,details)values(p_order_id,auth.uid(),'currency_requote_requested',o.assigned_manufacturer_id,jsonb_build_object('reason',btrim(p_reason),'previousManufacturerQuote',o.manufacturer_quote,'previousPriceOptions',o.price_options,'previousIssuedAt',o.offer_issued_at,'previousExpiresAt',o.quote_expires_at));
 update public.orders set manufacturer_quote=null,price_options=null,priced_at=null,offer_issued_at=null,quote_expires_at=null,status='submitted',status_label='Currency review — revised manufacturer quotation required',factory_status='clarifying'where id=p_order_id;
 perform public.notify_manufacturer(o.assigned_manufacturer_id,'order','Revised quotation required',p_reason,'/manufacturer/orders/'||p_order_id,p_order_id);
 return p_order_id;
end $$;
revoke all on function public.request_currency_requote(uuid,text)from public,anon;grant execute on function public.request_currency_requote(uuid,text)to authenticated;

select public.refresh_currency_rates();
notify pgrst,'reload schema';
commit;

-- Order delivery completion (20261022030000)
begin;
-- Reuse the brand inbox helper on older deployments.
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


revoke all on function public.notify_brand(uuid,text,text,text,text)from public,anon,authenticated;
alter table public.orders
 add column if not exists fully_dispatched_at timestamptz,
 add column if not exists completion_due_at timestamptz,
 add column if not exists completion_on_hold boolean not null default false,
 add column if not exists completion_hold_reason text,
 add column if not exists delivery_confirmed_at timestamptz,
 add column if not exists delivery_confirmed_by uuid references auth.users(id)on delete set null,
 add column if not exists delivery_confirmation_note text,
 add column if not exists completed_at timestamptz,
 add column if not exists completion_method text check(completion_method in('admin_delivery','automatic'));
create index if not exists orders_completion_due_idx on public.orders(completion_due_at)where status='shipping'and not completion_on_hold;

-- Use the latest approved production version and actual, non-revoked handovers.
create or replace function public.order_dispatch_is_complete(p_order uuid)returns boolean language plpgsql stable security definer set search_path=public as $$
declare o public.orders%rowtype;i public.qc_inspections%rowtype;required bigint;sent bigint;
begin
 select * into o from public.orders where id=p_order;
 if not found or o.kind<>'production'or o.qc_status<>'approved'or o.production_released_at is null then return false;end if;
 select * into i from public.qc_inspections where order_id=p_order and workflow_version=2 order by report_version desc limit 1;
 if found then
  if i.qc_status<>'approved'or i.order_snapshot is distinct from public.qc_order_snapshot(p_order)or i.manufacturer_id is distinct from o.assigned_manufacturer_id then return false;end if;
  required:=i.produced;
  select coalesce(sum(quantity),0)into sent from public.qc_shipment_releases where order_id=p_order and inspection_id=i.id and dispatched_at is not null and revoked_at is null;
 else
  select (v->>'totalUnits')::bigint into required from jsonb_array_elements(coalesce(o.price_options,'[]'))v where v->>'id'=o.selected_price_option_id;
  select coalesce(sum(r.quantity),0)into sent from public.qc_shipment_releases r join public.qc_inspections old_i on old_i.id=r.inspection_id where r.order_id=p_order and r.dispatched_at is not null and r.revoked_at is null and old_i.result='passed';
 end if;
 return coalesce(required>0 and sent>=required,false);
end $$;
revoke all on function public.order_dispatch_is_complete(uuid)from public,anon,authenticated;

create or replace function public.guard_order_completion()returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  if new.fully_dispatched_at is not null or new.completion_due_at is not null or new.completed_at is not null or new.completion_method is not null or new.delivery_confirmed_at is not null or new.delivery_confirmed_by is not null or new.completion_on_hold or new.completion_hold_reason is not null or new.delivery_confirmation_note is not null then raise exception 'Completion is managed by the delivery workflow';end if;return new;
 end if;
 if pg_trigger_depth()>1 and new.delivery_confirmed_by is null and (to_jsonb(new)-'delivery_confirmed_by')=(to_jsonb(old)-'delivery_confirmed_by')then return new;end if;
 if (new.fully_dispatched_at,new.completion_due_at,new.completion_on_hold,new.completion_hold_reason,new.delivery_confirmed_at,new.delivery_confirmed_by,new.delivery_confirmation_note,new.completed_at,new.completion_method)is distinct from(old.fully_dispatched_at,old.completion_due_at,old.completion_on_hold,old.completion_hold_reason,old.delivery_confirmed_at,old.delivery_confirmed_by,old.delivery_confirmation_note,old.completed_at,old.completion_method)and current_setting('app.delivery_write',true)is distinct from new.id::text then raise exception 'Use authorised delivery completion actions';end if;
 if new.kind<>'production'then return new;end if;
 if old.status='completed'and new.status is distinct from old.status then raise exception 'Completed orders cannot be reopened through status edits';end if;
 if new.status='completed'and old.status<>'completed'and current_setting('app.delivery_write',true)is distinct from new.id::text then raise exception 'Confirm delivery or use the automatic completion worker';end if;
 -- Existing shipped orders are not backdated/enrolled by this migration. New complete handovers start a 14-day window.
 if current_setting('app.qc_write',true)=new.id::text and new.status='shipping'and (old.status<>'shipping'or old.fully_dispatched_at is null)and public.order_dispatch_is_complete(new.id)then
  select max(dispatched_at)into new.fully_dispatched_at from public.qc_shipment_releases where order_id=new.id and dispatched_at is not null and revoked_at is null;
  if new.completion_due_at is null then new.completion_due_at:=new.fully_dispatched_at+interval '14 days';end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_order_completion()from public,anon,authenticated;
drop trigger if exists orders_delivery_completion_guard on public.orders;
create trigger orders_delivery_completion_guard before insert or update on public.orders for each row execute function public.guard_order_completion();

create or replace function public.finish_order_completion(p_order uuid,p_automatic boolean,p_note text default '')returns uuid language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;method text;actor uuid;
begin
 select * into o from public.orders where id=p_order for update;
 if not found then raise exception 'Order not found';end if;
 if o.status='completed'then
  if not p_automatic and o.completion_method='automatic'then raise exception 'This order already completed automatically; refresh to see its completion record';end if;
  return p_order;
 end if;
 if o.status<>'shipping'or not public.order_dispatch_is_complete(p_order)then raise exception 'QC approval and dispatch of every approved unit are required before completion';end if;
 if p_automatic and (o.completion_due_at is null or o.completion_due_at>now()or o.completion_on_hold)then raise exception 'The automatic completion deadline has not been reached or is paused';end if;
 if length(coalesce(p_note,''))>6000 then raise exception 'Delivery notes must be 6000 characters or fewer';end if;
 actor:=case when p_automatic then null else auth.uid()end;method:=case when p_automatic then 'automatic'else 'admin_delivery'end;
 perform set_config('app.delivery_write',p_order::text,true);perform set_config('app.qc_write',p_order::text,true);perform set_config('app.routing_write',p_order::text,true);perform set_config('app.workflow_write',p_order::text,true);
 update public.orders set status='completed',factory_status='completed',status_label=case when p_automatic then 'Completed automatically — delivery window elapsed'else 'Delivered — completed'end,
  completed_at=now(),completion_method=method,delivery_confirmed_at=case when p_automatic then null else now()end,delivery_confirmed_by=actor,delivery_confirmation_note=btrim(coalesce(p_note,'')),completion_on_hold=false where id=p_order;
 insert into public.qc_audit_events(order_id,actor_id,action,details)values(p_order,actor,'order_completed',jsonb_build_object('method',method,'note',coalesce(p_note,''),'deadline',o.completion_due_at));
 perform public.notify_brand(o.user_id,'order','Order completed',o.product_name||case when p_automatic then ' — automatically completed after the dispatch review window.'else ' — delivery confirmed by Ceriga.'end,'/orders/'||p_order);
 if o.assigned_manufacturer_id is not null then perform public.notify_manufacturer(o.assigned_manufacturer_id,'order','Order completed',o.product_name,'/manufacturer/orders/'||p_order,p_order);end if;
 if p_automatic then perform public.notify_superadmin('order','Order completed automatically',o.product_name,'/superadmin/quality-control/'||p_order,p_order);end if;
 return p_order;
end $$;
revoke all on function public.finish_order_completion(uuid,boolean,text)from public,anon,authenticated,service_role;
create or replace function public.confirm_order_delivery(p_order_id uuid,p_note text default '')returns uuid language plpgsql security definer set search_path=public as $$begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 return public.finish_order_completion(p_order_id,false,p_note);
end $$;
revoke all on function public.confirm_order_delivery(uuid,text)from public,anon;grant execute on function public.confirm_order_delivery(uuid,text)to authenticated;

create or replace function public.set_order_completion_deadline(p_order_id uuid,p_due_at timestamptz,p_hold boolean default false,p_reason text default '')returns uuid language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;handover timestamptz;
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.status<>'shipping'or not public.order_dispatch_is_complete(p_order_id)then raise exception 'Only fully dispatched, QC-approved orders can have a completion deadline';end if;
 if p_hold is null then raise exception 'Choose whether automatic completion is paused';end if;
 if p_hold and length(btrim(coalesce(p_reason,'')))not between 3 and 6000 then raise exception 'Explain why automatic completion is paused';end if;
 if not p_hold and (p_due_at is null or p_due_at<=now()or p_due_at>now()+interval '90 days')then raise exception 'Choose a future deadline within the next 90 days';end if;
 select max(dispatched_at)into handover from public.qc_shipment_releases where order_id=p_order_id and dispatched_at is not null and revoked_at is null;
 perform set_config('app.delivery_write',p_order_id::text,true);perform set_config('app.qc_write',p_order_id::text,true);perform set_config('app.workflow_write',p_order_id::text,true);perform set_config('app.routing_write',p_order_id::text,true);
 update public.orders set fully_dispatched_at=coalesce(fully_dispatched_at,handover),completion_due_at=case when p_hold then coalesce(o.completion_due_at,p_due_at)else p_due_at end,completion_on_hold=p_hold,completion_hold_reason=case when p_hold then btrim(p_reason)else null end where id=p_order_id;
 insert into public.qc_audit_events(order_id,actor_id,action,details)values(p_order_id,auth.uid(),'completion_deadline_updated',jsonb_build_object('previous_deadline',o.completion_due_at,'deadline',case when p_hold then coalesce(o.completion_due_at,p_due_at)else p_due_at end,'paused',p_hold,'reason',p_reason));
 return p_order_id;
end $$;
revoke all on function public.set_order_completion_deadline(uuid,timestamptz,boolean,text)from public,anon;grant execute on function public.set_order_completion_deadline(uuid,timestamptz,boolean,text)to authenticated;

create or replace function public.complete_due_orders()returns integer language plpgsql security definer set search_path=public as $$
declare target record;completed integer:=0;
begin
 for target in select id from public.orders where kind='production'and status='shipping'and fully_dispatched_at is not null and completion_due_at<=now()and not completion_on_hold order by completion_due_at for update skip locked limit 200 loop
  if public.order_dispatch_is_complete(target.id)then perform public.finish_order_completion(target.id,true,'Automatic dispatch review deadline reached');completed:=completed+1;end if;
 end loop;
 return completed;
end $$;
revoke all on function public.complete_due_orders()from public,anon,authenticated;grant execute on function public.complete_due_orders()to service_role;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('ceriga-complete-delivery-orders','*/5 * * * *','select public.complete_due_orders();');
notify pgrst,'reload schema';
commit;

-- Manufacturer quote review (20261022040000)
begin;
create or replace function public.review_manufacturer_quotation(p_order_id uuid,p_reason text,p_next_action text)
returns text language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;next_state text;
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 if p_next_action not in('revise','reassign')or p_next_action is null then raise exception 'Choose revised quotation or another manufacturer';end if;
 if length(btrim(coalesce(p_reason,'')))not between 3 and 2000 then raise exception 'Give a reason between 3 and 2000 characters';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.kind<>'production'or o.assigned_manufacturer_id is null or o.factory_status is distinct from 'quoted'then raise exception 'Only a received manufacturer quotation can be rejected';end if;
 if o.status not in('submitted','awaiting_payment')or o.production_released_at is not null or o.payment_verified_at is not null or o.paid_amount_cents is not null or o.offer_issued_at is not null then raise exception 'Issued customer quotations and released or paid orders cannot be rejected here';end if;
 next_state:=case when p_next_action='revise'then 'clarifying'else 'rejected'end;
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.workflow_write',p_order_id::text,true);perform set_config('app.routing_action','manufacturer_quotation_rejected',true);
 insert into public.order_routing_events(order_id,actor_id,event_type,manufacturer_id,details)values(p_order_id,auth.uid(),'manufacturer_quotation_rejected',o.assigned_manufacturer_id,jsonb_build_object('reason',btrim(p_reason),'nextAction',p_next_action,'previousManufacturerQuote',o.manufacturer_quote,'previousQuotedAt',o.quoted_at,'previousPriceOptions',o.price_options));
 update public.orders set factory_status=next_state,factory_reject_reason=btrim(p_reason),manufacturer_quote=null,quoted_at=null,price_options=null,priced_at=null,selected_price_option_id=null,quote_expires_at=null,status='submitted',status_label=case when p_next_action='revise'then 'Revised manufacturer quotation requested'else 'Awaiting manufacturer reassignment'end where id=p_order_id;
 perform public.notify_manufacturer(o.assigned_manufacturer_id,'order',case when p_next_action='revise'then 'Revised quotation requested'else 'Quotation rejected'end,btrim(p_reason),'/manufacturer/orders/'||p_order_id,p_order_id);
 return p_next_action;
end $$;
revoke all on function public.review_manufacturer_quotation(uuid,text,text)from public,anon;
grant execute on function public.review_manufacturer_quotation(uuid,text,text)to authenticated;
notify pgrst,'reload schema';
commit;

-- Audit security and routing (20261022050000)
begin;

-- Reproduce deployed legacy guard columns without changing any existing order.
alter table public.orders add column if not exists workflow_managed boolean not null default false;
alter table public.manufacturer_profiles add column if not exists commission_plan_id text;

create or replace function public.guard_profile_entitlements() returns trigger
language plpgsql set search_path=public as $$
begin
 if current_user in('authenticated','anon') and not public.is_superadmin() then
  if tg_op='INSERT' then
   if new.role<>'brand' or new.message_credits<>0 or new.email is distinct from auth.jwt()->>'email' then raise exception 'Account entitlements are managed by Ceriga';end if;
  elsif (new.role,new.message_credits,new.email,new.id) is distinct from (old.role,old.message_credits,old.email,old.id) then
   raise exception 'Account roles, email and credits require an authorised server action';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists profiles_entitlement_guard on public.profiles;
create trigger profiles_entitlement_guard before insert or update on public.profiles for each row execute function public.guard_profile_entitlements();
revoke all on function public.guard_profile_entitlements() from public,anon,authenticated;

create or replace function public.admin_update_profile(p_user_id uuid,p_patch jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_superadmin() then raise exception 'Superadmin authorization required';end if;
 if jsonb_typeof(p_patch) is distinct from 'object' or p_patch-array['role','message_credits','full_name']<>'{}' then raise exception 'Unsupported profile fields';end if;
 if p_patch?'role' and coalesce(p_patch->>'role','') not in('brand','manufacturer','worker') then raise exception 'Invalid account role';end if;
 if p_patch?'message_credits' and (coalesce(p_patch->>'message_credits','')!~'^[0-9]{1,9}$')then raise exception 'Credits must be a non-negative whole number';end if;
 if p_patch?'full_name' and length(coalesce(p_patch->>'full_name',''))>200 then raise exception 'Name is too long';end if;
 update public.profiles set role=case when p_patch?'role' then p_patch->>'role' else role end,
 message_credits=case when p_patch?'message_credits'then(p_patch->>'message_credits')::integer else message_credits end,
 full_name=case when p_patch?'full_name'then nullif(btrim(p_patch->>'full_name'),'')else full_name end where id=p_user_id;
 if not found then raise exception 'Account not found';end if;
 return p_user_id;
end $$;
revoke all on function public.admin_update_profile(uuid,jsonb)from public,anon;
grant execute on function public.admin_update_profile(uuid,jsonb)to authenticated;

create or replace function public.wf_guard_factory_status() returns trigger
language plpgsql set search_path=public as $$
begin
 if current_user in('authenticated','anon')and not public.is_superadmin()then
  if tg_op='INSERT'then
   if new.status<>'onboarding'or new.onboarding_complete or new.commission_plan_id is not null or not exists(select 1 from public.profiles where id=auth.uid()and role='manufacturer') then raise exception 'Only Ceriga may set factory eligibility or commission plans';end if;
  elsif (new.status,new.commission_plan_id,new.onboarding_complete) is distinct from(old.status,old.commission_plan_id,old.onboarding_complete)then raise exception 'Only Ceriga may change factory eligibility or commission plans';end if;
 end if;
 return new;
end $$;
drop trigger if exists wf_guard_factory_status on public.manufacturer_profiles;
create trigger wf_guard_factory_status before insert or update on public.manufacturer_profiles for each row execute function public.wf_guard_factory_status();
revoke all on function public.wf_guard_factory_status()from public,anon,authenticated;

create or replace function public.wf_protect_order()returns trigger language plpgsql set search_path=public as $$
begin
 if current_user not in('authenticated','anon')or public.is_superadmin()then return new;end if;
 if tg_op='INSERT'then
  if new.status not in('submitted','awaiting_payment')or new.paid_amount_cents is not null or new.payment_verified_at is not null or new.production_released_at is not null or new.workflow_managed then raise exception 'Use the controlled order workflow';end if;
 elsif (to_jsonb(new)-array['updated_at','quote_request','specifications','order_quantities','contact_name','contact_email','contact_phone','delivery_address']) is distinct from(to_jsonb(old)-array['updated_at','quote_request','specifications','order_quantities','contact_name','contact_email','contact_phone','delivery_address'])then
  raise exception 'Use authorised order actions';
 elsif old.user_id is distinct from auth.uid()or old.status not in('submitted','awaiting_payment')or old.assigned_manufacturer_id is not null then raise exception 'Ask Ceriga to revise an assigned order';end if;
 return new;
end $$;
drop trigger if exists wf_protect_order on public.orders;
create trigger wf_protect_order before insert or update on public.orders for each row execute function public.wf_protect_order();
revoke all on function public.wf_protect_order()from public,anon,authenticated;

-- This projection is also used for histories: internal snapshots stay immutable.
create or replace function public.public_price_options(p_options jsonb,p_factory boolean default false)returns jsonb
language sql immutable set search_path=public as $$
 select case when p_options is null then null else coalesce(jsonb_agg(
 case when p_factory then value-array['priceCents','currencySnapshot','currency','shippingQuoteCents','taxCents','feesCents']
 else (value-'currencySnapshot')||case when value?'currencySnapshot'then jsonb_build_object('currencySnapshot',(value->'currencySnapshot')-array['originalManufacturerCents','markupCents','shippingIncludedInManufacturerQuote'])else '{}'::jsonb end end),'[]'::jsonb)end
 from jsonb_array_elements(coalesce(p_options,'[]'::jsonb))
$$;
revoke all on function public.public_price_options(jsonb,boolean)from public,anon;
grant execute on function public.public_price_options(jsonb,boolean)to authenticated;
create or replace function public.account_order_projection(p_order public.orders)returns public.orders
language plpgsql stable security definer set search_path=public as $$
declare result public.orders%rowtype;factory boolean;
begin
 if auth.uid() is null then raise exception 'Sign in to view orders';end if;
 if not(public.is_superadmin()or p_order.user_id=auth.uid()or p_order.assigned_manufacturer_id=auth.uid())then raise exception 'Order access denied';end if;
 result:=p_order;
 if public.is_superadmin()then return result;end if;
 factory:=p_order.assigned_manufacturer_id=auth.uid()and p_order.user_id<>auth.uid();
 result.ops_notes:=null;
 result.price_options:=public.public_price_options(p_order.price_options,coalesce(factory,false));
 if factory then result.paid_amount_cents:=null;result.total:=null;result.paid_currency:=null;result.total_currency:=null;
 else result.manufacturer_quote:=null;result.factory_reject_reason:=null;end if;
 return result;
end $$;
revoke all on function public.account_order_projection(public.orders)from public,anon;
grant execute on function public.account_order_projection(public.orders)to authenticated;
create or replace view public.account_orders with(security_barrier=true)as
 select projected.* from public.orders o cross join lateral public.account_order_projection(o) projected
 where auth.uid()is not null and(public.is_superadmin()or o.user_id=auth.uid()or o.assigned_manufacturer_id=auth.uid());
revoke all on public.account_orders from public,anon;
grant select on public.account_orders to authenticated;
create or replace view public.account_quote_history with(security_barrier=true)as
 select h.id,h.order_id,h.created_at,h.expires_at,h.target_currency,
 case when public.is_superadmin()then h.options else public.public_price_options(h.options,false)end options,
 case when public.is_superadmin()then h.manufacturer_quote else null::jsonb end manufacturer_quote
 from public.order_quote_currency_snapshots h join public.orders o on o.id=h.order_id
 where auth.uid()is not null and(public.is_superadmin()or o.user_id=auth.uid());
revoke all on public.account_quote_history from public,anon;
grant select on public.account_quote_history to authenticated;

create or replace function public.create_customer_order(p_input jsonb)returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;kind_value text;
begin
 if auth.uid()is null then raise exception 'Sign in to create an order';end if;
 kind_value:=p_input->>'kind';
 if kind_value not in('production','tech-pack')or kind_value is null or length(btrim(coalesce(p_input->>'product_name','')))not between 1 and 300 then raise exception 'A valid order type and product name are required';end if;
 insert into public.orders(user_id,kind,product_name,garment_type,product_id,status,status_label,order_quantities,quote_request,specifications,contact_name,contact_email,contact_phone,delivery_address,export_format)
 values(auth.uid(),kind_value,btrim(p_input->>'product_name'),coalesce(p_input->>'garment_type',''),p_input->>'product_id','submitted','Awaiting review',p_input->'order_quantities',p_input->'quote_request',p_input->'specifications',p_input->>'contact_name',p_input->>'contact_email',p_input->>'contact_phone',p_input->'delivery_address',p_input->>'export_format')returning * into o;
 return to_jsonb(public.account_order_projection(o));
end $$;
revoke all on function public.create_customer_order(jsonb)from public,anon;
grant execute on function public.create_customer_order(jsonb)to authenticated;

create or replace function public.patch_account_order(p_order_id uuid,p_patch jsonb)returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;updated public.orders%rowtype;path text;allowed text[];
begin
 if auth.uid()is null then raise exception 'Sign in to edit an order';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order not found';end if;
 if public.is_superadmin()then allowed:=array['ops_notes','status_label','download_ready','export_format'];
 elsif o.user_id=auth.uid()and o.status in('submitted','awaiting_payment')and o.assigned_manufacturer_id is null then allowed:=array['quote_request','specifications','order_quantities','contact_name','contact_email','contact_phone','delivery_address','export_format'];
 else raise exception 'Use the authorised quotation, production or delivery action';end if;
 if jsonb_typeof(p_patch)is distinct from 'object'or p_patch-allowed<>'{}'then raise exception 'These order fields require a controlled workflow action';end if;
 if p_patch?'quote_request'then
  for path in select jsonb_array_elements_text(coalesce(p_patch->'quote_request'->'storagePaths','[]'))loop
   if split_part(path,'/',1)<>o.user_id::text or split_part(path,'/',2)<>o.id::text then raise exception 'Files must belong to this order and customer';end if;
  end loop;
 end if;
 updated:=jsonb_populate_record(o,p_patch);
 perform set_config('app.workflow_write',p_order_id::text,true);perform set_config('app.routing_write',p_order_id::text,true);
 update public.orders set ops_notes=updated.ops_notes,status_label=updated.status_label,download_ready=updated.download_ready,export_format=updated.export_format,
 quote_request=updated.quote_request,specifications=updated.specifications,order_quantities=updated.order_quantities,contact_name=updated.contact_name,contact_email=updated.contact_email,contact_phone=updated.contact_phone,delivery_address=updated.delivery_address where id=p_order_id returning * into updated;
 return to_jsonb(public.account_order_projection(updated));
end $$;
revoke all on function public.patch_account_order(uuid,jsonb)from public,anon;
grant execute on function public.patch_account_order(uuid,jsonb)to authenticated;
create or replace function public.admin_delete_order(p_order_id uuid)returns uuid language plpgsql security definer set search_path=public as $$
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 delete from public.orders where id=p_order_id;if not found then raise exception 'Order not found';end if;return p_order_id;
end $$;
revoke all on function public.admin_delete_order(uuid)from public,anon;
grant execute on function public.admin_delete_order(uuid)to authenticated;
create or replace function public.protect_issued_order_deletion()returns trigger language plpgsql set search_path=public as $$
begin
 if current_user in('authenticated','anon')and not public.is_superadmin()and(old.status not in('submitted','awaiting_payment')or old.assigned_manufacturer_id is not null or old.offer_issued_at is not null or old.production_released_at is not null)then raise exception 'Issued or assigned orders must be cancelled through Ceriga; history cannot be deleted';end if;
 return old;
end $$;
drop trigger if exists orders_retention_guard on public.orders;
create trigger orders_retention_guard before delete on public.orders for each row execute function public.protect_issued_order_deletion();
revoke all on function public.protect_issued_order_deletion()from public,anon,authenticated;

-- Policies with order subqueries must use the role-safe projection after raw SELECT is removed.
do $$declare p record;q text;w text;begin
 for p in select *from pg_policies where schemaname in('public','storage')and tablename<>'orders'and(coalesce(qual,'')~'\morders\M'or coalesce(with_check,'')~'\morders\M')loop
  q:=regexp_replace(p.qual,'\morders\M','account_orders','g');w:=regexp_replace(p.with_check,'\morders\M','account_orders','g');
  execute format('alter policy %I on %I.%I %s %s',p.policyname,p.schemaname,p.tablename,case when q is not null then 'using ('||q||')'else ''end,case when w is not null then 'with check ('||w||')'else ''end);
 end loop;
end $$;
-- Keep this migration-only helper complete, including future application tables.
create or replace function public.apply_superadmin_access()returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare t record;
begin
 for t in select tablename from pg_tables where schemaname='public'loop
  execute format('alter table public.%I enable row level security',t.tablename);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t.tablename);
  if not exists(select 1 from pg_policies where schemaname='public'and tablename=t.tablename and policyname='superadmin_full_access')then execute format('create policy superadmin_full_access on public.%I for all to authenticated using(public.is_superadmin())with check(public.is_superadmin())',t.tablename);end if;
 end loop;
 revoke select on public.orders,public.order_quote_currency_snapshots from public,anon,authenticated;
 grant select(id)on public.orders to authenticated;
end $$;
revoke all on function public.apply_superadmin_access()from public,anon,authenticated;
grant execute on function public.apply_superadmin_access()to service_role;
select public.apply_superadmin_access();

-- Canonical rejection history consumed by both existing assignment implementations.
do $$declare d text;begin
 select pg_get_functiondef('public.review_manufacturer_quotation(uuid,text,text)'::regprocedure)into d;
 d:=replace(d,'''manufacturer_quotation_rejected''','''admin_rejected''');execute d;
end $$;
-- Reject unavailable/oversized assignments on the server as well as in recommendations.
create or replace function public.check_factory_assignment(p_order uuid,p_factory uuid,p_due date)returns void language plpgsql stable security definer set search_path=public as $$
declare s jsonb;o public.orders%rowtype;line jsonb;quantity numeric;ceiling numeric;capacity numeric;
begin
 select * into o from public.orders where id=p_order;
 select settings into s from public.manufacturer_customisation_settings where user_id=p_factory;
 if s->>'acceptingNewOrders'='false'then raise exception 'Manufacturer is not accepting new orders';end if;
 if coalesce(s->>'maxSingleOrderQuantity','')~'^[0-9]+$'then ceiling:=(s->>'maxSingleOrderQuantity')::numeric;end if;
 if coalesce(s->>'currentAvailableMonthlyCapacity','')~'^[0-9]+$'then capacity:=(s->>'currentAvailableMonthlyCapacity')::numeric;end if;
 for line in select value from jsonb_array_elements(coalesce(o.order_quantities->'bulkRuns','[]')||case when o.order_quantities->'sample' is not null then jsonb_build_array(o.order_quantities->'sample')else '[]'end)loop
  quantity:=coalesce((line->>'targetTotal')::numeric,(select sum(value::numeric)from jsonb_each_text(coalesce(line->'bySize','{}'))));
  if ceiling is not null and quantity>ceiling then raise exception 'Order quantity exceeds the manufacturer single-order ceiling';end if;
  if capacity is not null and quantity>capacity then raise exception 'Order quantity exceeds available factory capacity';end if;
 end loop;
end $$;
revoke all on function public.check_factory_assignment(uuid,uuid,date)from public,anon,authenticated;
do $$declare d text;begin
 select pg_get_functiondef('public.assign_order_manufacturer(uuid,uuid,date)'::regprocedure)into d;
 if position('check_factory_assignment' in d)=0 then d:=replace(d,'perform set_config(''app.routing_write''','perform public.check_factory_assignment(p_order_id,p_manufacturer,p_due); perform set_config(''app.routing_write''');end if;
 -- Live-only legacy guards require this authorised RPC to mark its own writes.
 if position('app.workflow_write'in d)=0 then d:=replace(d,'perform set_config(''app.routing_write''','perform set_config(''app.workflow_write'',p_order_id::text,true); perform set_config(''app.routing_write''');end if;
 execute d;
end $$;
-- Reproduce lifecycle notification functions on older live deployments.
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
drop trigger if exists orders_after_insert_notify on public.orders;
create trigger orders_after_insert_notify after insert on public.orders for each row execute function public.orders_after_insert_notify();
-- Repeated deployments replace, rather than multiply, notifications.
drop trigger if exists orders_after_update_notify on public.orders;
create trigger orders_after_update_notify after update on public.orders for each row execute function public.orders_after_update_notify();
revoke all on function public.orders_after_insert_notify(),public.orders_after_update_notify()from public,anon,authenticated;
notify pgrst,'reload schema';
commit;


-- Audit features (20261022060000)
begin;
alter table public.manufacturer_profiles add column if not exists profile_details jsonb not null default '{}';
create or replace function public.sync_factory_profile_details()returns trigger language plpgsql set search_path=public as $$begin
 new.profile_details:=(new.profile_details-array['verification','portfolio','pricing','status','commission_plan_id'])||jsonb_build_object('factoryName',new.factory_name,'contactName',coalesce(new.contact_name,''),'contactEmail',coalesce(new.contact_email,''),'contactPhone',coalesce(new.contact_phone,''),'website',coalesce(new.website,''),'addressLine',coalesce(new.address_line,''),'city',coalesce(new.city,''),'country',coalesce(new.country,''),'garments',new.garments,'generalMoq',new.moq,'monthlyCapacity',new.monthly_capacity,'shippingDestinations',new.shipping_regions,'onboardingComplete',new.onboarding_complete,'updatedAt',now());return new;
end $$;
drop trigger if exists zz_factory_profile_details_sync on public.manufacturer_profiles;
create trigger zz_factory_profile_details_sync before insert or update on public.manufacturer_profiles for each row execute function public.sync_factory_profile_details();
revoke all on function public.sync_factory_profile_details()from public,anon,authenticated;
create or replace function public.save_manufacturer_profile(p_profile jsonb,p_complete boolean default false)returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();details jsonb;category text;capacity numeric;moq_value numeric;
begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and role='manufacturer')then raise exception 'A manufacturer account is required';end if;
 if jsonb_typeof(p_profile)is distinct from 'object'or octet_length(p_profile::text)>500000 then raise exception 'Invalid factory profile';end if;
 details:=p_profile-array['verification','portfolio','pricing','status','commission_plan_id','userId'];
 if p_complete then
  if length(btrim(coalesce(p_profile->>'factoryName','')))<1 or length(btrim(coalesce(p_profile->>'contactName','')))<1 or coalesce(p_profile->>'contactEmail','')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'or length(btrim(coalesce(p_profile->>'contactPhone','')))<1 or length(btrim(coalesce(p_profile->>'country','')))<1 or length(btrim(coalesce(p_profile->>'city','')))<1 then raise exception 'Complete factory name, contact, valid email, phone, country and city';end if;
  if jsonb_array_length(coalesce(p_profile->'manufacturerTypes','[]'))<1 or jsonb_array_length(coalesce(p_profile->'garments','[]'))<1 or jsonb_array_length(coalesce(p_profile->'shippingMethods','[]'))<1 or jsonb_array_length(coalesce(p_profile->'shippingDestinations','[]'))<1 or coalesce(p_profile->'capabilitiesMap','{}')='{}'then raise exception 'Select manufacturer type, garments, capabilities, shipping methods and destinations';end if;
  for category in select jsonb_array_elements_text(p_profile->'garments')loop if coalesce(p_profile->'garmentDetails'->category->>'confirmed','false')<>'true'then raise exception 'Confirm the specifications for every selected garment';end if;end loop;
  if coalesce(p_profile->>'generalMoq','')!~'^[1-9][0-9]*$'or coalesce(p_profile->>'monthlyCapacity','')!~'^[1-9][0-9]*$'then raise exception 'MOQ and capacity must be positive whole numbers';end if;
  foreach category in array array['sample','bulk']loop
   if coalesce(p_profile->>(category||'LeadTimeMinDays'),'')!~'^[1-9][0-9]*$'or coalesce(p_profile->>(category||'LeadTimeMaxDays'),'')!~'^[1-9][0-9]*$'then raise exception 'Enter valid sample and bulk lead-time ranges';end if;
   if(p_profile->>(category||'LeadTimeMinDays'))::integer>(p_profile->>(category||'LeadTimeMaxDays'))::integer or(p_profile->>(category||'LeadTimeMaxDays'))::integer>3650 then raise exception 'Lead-time ranges must be ordered and no greater than 3650 days';end if;
  end loop;
 end if;
 if coalesce(p_profile->>'monthlyCapacity','')~'^[0-9]+$'then capacity:=(p_profile->>'monthlyCapacity')::numeric;end if;
 if coalesce(p_profile->>'generalMoq','')~'^[0-9]+$'then moq_value:=(p_profile->>'generalMoq')::numeric;end if;
 if capacity>1000000000 or moq_value>1000000000 then raise exception 'Factory quantities exceed supported limits';end if;
 if coalesce(p_profile->>'currentAvailableMonthlyCapacity','')~'^[0-9]+$'and(p_profile->>'currentAvailableMonthlyCapacity')::numeric>capacity then raise exception 'Available capacity cannot exceed monthly capacity';end if;
 insert into public.manufacturer_profiles(user_id,factory_name,contact_name,contact_email,contact_phone,website,address_line,city,country,garments,capabilities,shipping_regions,moq,monthly_capacity,onboarding_complete,profile_details)
 values(uid,coalesce(nullif(btrim(p_profile->>'factoryName'),''),'My factory'),p_profile->>'contactName',p_profile->>'contactEmail',p_profile->>'contactPhone',p_profile->>'website',p_profile->>'addressLine',p_profile->>'city',p_profile->>'country',array(select jsonb_array_elements_text(coalesce(p_profile->'garments','[]'))),array(select jsonb_object_keys(coalesce(p_profile->'capabilitiesMap','{}'))),array(select jsonb_array_elements_text(coalesce(p_profile->'shippingDestinations','[]'))),coalesce(moq_value,50),coalesce(capacity,0),p_complete,details||jsonb_build_object('updatedAt',now()))
 on conflict(user_id)do update set factory_name=excluded.factory_name,contact_name=excluded.contact_name,contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,website=excluded.website,address_line=excluded.address_line,city=excluded.city,country=excluded.country,garments=excluded.garments,capabilities=excluded.capabilities,shipping_regions=excluded.shipping_regions,moq=excluded.moq,monthly_capacity=excluded.monthly_capacity,onboarding_complete=public.manufacturer_profiles.onboarding_complete or p_complete,profile_details=excluded.profile_details;
 return uid;
end $$;
revoke all on function public.save_manufacturer_profile(jsonb,boolean)from public,anon;
grant execute on function public.save_manufacturer_profile(jsonb,boolean)to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('manufacturer-assets','manufacturer-assets',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])on conflict(id)do nothing;
drop policy if exists manufacturer_assets_owner on storage.objects;
create policy manufacturer_assets_owner on storage.objects for all to authenticated using(bucket_id='manufacturer-assets'and((storage.foldername(name))[1]=auth.uid()::text or public.is_superadmin()))with check(bucket_id='manufacturer-assets'and((storage.foldername(name))[1]=auth.uid()::text or public.is_superadmin()));
create table if not exists public.manufacturer_portfolio_items(
 id uuid primary key default gen_random_uuid(),manufacturer_id uuid not null references public.manufacturer_profiles(user_id)on delete cascade,
 title text not null check(length(btrim(title))between 1 and 200),garment_type text not null,description text not null default ''check(length(description)<=6000),materials text not null default '',gsm integer check(gsm between 1 and 5000),methods text[]not null default '{}',image_paths text[]not null default '{}',
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists manufacturer_portfolio_owner_idx on public.manufacturer_portfolio_items(manufacturer_id,created_at desc);
alter table public.manufacturer_portfolio_items enable row level security;
drop policy if exists portfolio_owner_read on public.manufacturer_portfolio_items;
create policy portfolio_owner_read on public.manufacturer_portfolio_items for select to authenticated using(manufacturer_id=auth.uid());
create or replace function public.save_portfolio_item(p_item jsonb,p_id uuid default null,p_version integer default null)returns uuid language plpgsql security definer set search_path=public as $$
declare row public.manufacturer_portfolio_items%rowtype;paths text[];path text;
begin
 if auth.uid()is null or not exists(select 1 from public.manufacturer_profiles where user_id=auth.uid())then raise exception 'A manufacturer account is required';end if;
 paths:=array(select jsonb_array_elements_text(coalesce(p_item->'image_paths','[]')));
 if cardinality(paths)>20 then raise exception 'Use no more than 20 images';end if;
 foreach path in array paths loop if split_part(path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='manufacturer-assets'and name=path and metadata->>'mimetype'in('image/jpeg','image/png','image/webp'))then raise exception 'Portfolio images must be valid uploads belonging to your factory';end if;end loop;
 if p_id is null then
  insert into public.manufacturer_portfolio_items(manufacturer_id,title,garment_type,description,materials,gsm,methods,image_paths)values(auth.uid(),btrim(p_item->>'title'),coalesce(p_item->>'garment_type',''),coalesce(p_item->>'description',''),coalesce(p_item->>'materials',''),nullif(p_item->>'gsm','')::integer,array(select jsonb_array_elements_text(coalesce(p_item->'methods','[]'))),paths)returning *into row;
 else
  select *into row from public.manufacturer_portfolio_items where id=p_id for update;
  if not found or row.manufacturer_id<>auth.uid()then raise exception 'Portfolio item not found';end if;
  if p_version is distinct from row.version then raise exception 'This item changed on another device; refresh before saving';end if;
  update public.manufacturer_portfolio_items set title=btrim(p_item->>'title'),garment_type=coalesce(p_item->>'garment_type',''),description=coalesce(p_item->>'description',''),materials=coalesce(p_item->>'materials',''),gsm=nullif(p_item->>'gsm','')::integer,methods=array(select jsonb_array_elements_text(coalesce(p_item->'methods','[]'))),image_paths=paths,version=version+1,updated_at=now()where id=p_id;
 end if;
 return row.id;
end $$;
revoke all on function public.save_portfolio_item(jsonb,uuid,integer)from public,anon;
grant execute on function public.save_portfolio_item(jsonb,uuid,integer)to authenticated;
create or replace function public.remove_portfolio_item(p_id uuid,p_version integer)returns uuid language plpgsql security definer set search_path=public as $$begin
 delete from public.manufacturer_portfolio_items where id=p_id and manufacturer_id=auth.uid()and version=p_version;
 if not found then raise exception 'Item unavailable or changed; refresh and try again';end if;return p_id;
end $$;
revoke all on function public.remove_portfolio_item(uuid,integer)from public,anon;
grant execute on function public.remove_portfolio_item(uuid,integer)to authenticated;

create table if not exists public.manufacturer_verification_submissions(
 id uuid primary key default gen_random_uuid(),manufacturer_id uuid not null references public.manufacturer_profiles(user_id)on delete cascade,version integer not null,
 registration_number text not null check(length(btrim(registration_number))between 1 and 200),registered_address text not null check(length(btrim(registered_address))between 1 and 2000),certifications text[]not null default '{}',document_paths text[]not null,
 status text not null default 'pending_review'check(status in('pending_review','verified','changes_required')),submitted_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid references auth.users(id)on delete set null,feedback text,
 unique(manufacturer_id,version));
create index if not exists verification_pending_idx on public.manufacturer_verification_submissions(status,submitted_at);
alter table public.manufacturer_verification_submissions enable row level security;
drop policy if exists verification_owner_read on public.manufacturer_verification_submissions;
create policy verification_owner_read on public.manufacturer_verification_submissions for select to authenticated using(manufacturer_id=auth.uid());
create or replace function public.submit_factory_verification(p_registration text,p_address text,p_certifications text[],p_documents text[])returns uuid language plpgsql security definer set search_path=public as $$
declare previous public.manufacturer_verification_submissions%rowtype;result uuid;path text;
begin
 perform 1 from public.manufacturer_profiles where user_id=auth.uid()for update;if not found then raise exception 'A manufacturer account is required';end if;
 select *into previous from public.manufacturer_verification_submissions where manufacturer_id=auth.uid()order by version desc limit 1;
 if previous.status='pending_review'then
  if(previous.registration_number,previous.registered_address,previous.document_paths)is not distinct from(btrim(p_registration),btrim(p_address),p_documents)then return previous.id;end if;
  raise exception 'A verification submission is already pending review';
 end if;
 if cardinality(p_documents)not between 1 and 20 or p_documents is null then raise exception 'Attach 1–20 supporting documents';end if;
 foreach path in array p_documents loop if split_part(path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='manufacturer-assets'and name=path and metadata->>'mimetype'in('image/jpeg','image/png','image/webp','application/pdf'))then raise exception 'Upload valid documents belonging to your factory';end if;end loop;
 insert into public.manufacturer_verification_submissions(manufacturer_id,version,registration_number,registered_address,certifications,document_paths)values(auth.uid(),coalesce(previous.version,0)+1,btrim(p_registration),btrim(p_address),coalesce(p_certifications,'{}'),p_documents)returning id into result;
 perform public.notify_superadmin('system','Factory verification ready for review',(select factory_name from public.manufacturer_profiles where user_id=auth.uid()),'/superadmin/manufacturers/'||auth.uid(),null);
 return result;
end $$;
revoke all on function public.submit_factory_verification(text,text,text[],text[])from public,anon;
grant execute on function public.submit_factory_verification(text,text,text[],text[])to authenticated;
create or replace function public.review_factory_verification(p_id uuid,p_approved boolean,p_feedback text default '')returns uuid language plpgsql security definer set search_path=public as $$
declare row public.manufacturer_verification_submissions%rowtype;
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 select *into row from public.manufacturer_verification_submissions where id=p_id for update;
 if not found or row.status<>'pending_review'then raise exception 'Only a pending submission can be reviewed';end if;
 if row.manufacturer_id=auth.uid()then raise exception 'You cannot review your own factory verification';end if;
 if p_approved is null or(not p_approved and length(btrim(coalesce(p_feedback,'')))<3)or length(coalesce(p_feedback,''))>6000 then raise exception 'Provide feedback when requesting changes';end if;
 update public.manufacturer_verification_submissions set status=case when p_approved then 'verified'else 'changes_required'end,reviewed_at=now(),reviewed_by=auth.uid(),feedback=btrim(p_feedback)where id=p_id;
 perform public.notify_manufacturer(row.manufacturer_id,'system',case when p_approved then 'Factory verified'else 'Verification changes requested'end,p_feedback,'/manufacturer/verification',null);return p_id;
end $$;
revoke all on function public.review_factory_verification(uuid,boolean,text)from public,anon;
grant execute on function public.review_factory_verification(uuid,boolean,text)to authenticated;

create table if not exists public.manufacturer_availability(
 id uuid primary key default gen_random_uuid(),manufacturer_id uuid not null references public.manufacturer_profiles(user_id)on delete cascade,kind text not null check(kind in('capacity_block','time_off')),
 starts_on date not null,ends_on date not null,reason text not null check(length(btrim(reason))between 1 and 2000),status text not null check(status in('pending','approved','declined','withdrawn')),
 created_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid references auth.users(id)on delete set null,feedback text,
 check(ends_on>=starts_on and ends_on<=starts_on+365));
create index if not exists factory_availability_owner_dates on public.manufacturer_availability(manufacturer_id,starts_on,ends_on)where status='approved';
create index if not exists factory_availability_pending on public.manufacturer_availability(status,created_at);
alter table public.manufacturer_availability enable row level security;
drop policy if exists availability_owner_read on public.manufacturer_availability;
create policy availability_owner_read on public.manufacturer_availability for select to authenticated using(manufacturer_id=auth.uid());
create or replace function public.request_factory_availability(p_kind text,p_start date,p_end date,p_reason text)returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if auth.uid()is null or not exists(select 1 from public.manufacturer_profiles where user_id=auth.uid())then raise exception 'A manufacturer account is required';end if;
 if p_kind not in('time_off','capacity_block')or p_start is null or p_start<current_date or p_end is null then raise exception 'Choose valid future availability dates';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_kind||p_start::text,0));
 select id into result from public.manufacturer_availability where manufacturer_id=auth.uid()and kind=p_kind and starts_on=p_start and ends_on=p_end and status in('pending','approved');if found then return result;end if;
 insert into public.manufacturer_availability(manufacturer_id,kind,starts_on,ends_on,reason,status)values(auth.uid(),p_kind,p_start,p_end,btrim(p_reason),case when p_kind='capacity_block'then 'approved'else 'pending'end)returning id into result;
 perform public.notify_superadmin('capacity',case when p_kind='time_off'then 'Factory time off requested'else 'Factory capacity blocked'end,p_reason,'/superadmin/time-off',null);return result;
end $$;
revoke all on function public.request_factory_availability(text,date,date,text)from public,anon;
grant execute on function public.request_factory_availability(text,date,date,text)to authenticated;
create or replace function public.review_factory_availability(p_id uuid,p_approved boolean,p_feedback text default '')returns uuid language plpgsql security definer set search_path=public as $$
declare row public.manufacturer_availability%rowtype;
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 select *into row from public.manufacturer_availability where id=p_id for update;
 if not found or row.status<>'pending'or p_approved is null then raise exception 'Only pending time off can be reviewed';end if;
 if not p_approved and length(btrim(coalesce(p_feedback,'')))<3 then raise exception 'Give a reason for declining';end if;
 update public.manufacturer_availability set status=case when p_approved then 'approved'else 'declined'end,reviewed_at=now(),reviewed_by=auth.uid(),feedback=p_feedback where id=p_id;
 perform public.notify_manufacturer(row.manufacturer_id,'capacity',case when p_approved then 'Time off approved'else 'Time off declined'end,p_feedback,'/manufacturer/capacity',null);return p_id;
end $$;
revoke all on function public.review_factory_availability(uuid,boolean,text)from public,anon;
grant execute on function public.review_factory_availability(uuid,boolean,text)to authenticated;
create or replace function public.withdraw_factory_availability(p_id uuid)returns uuid language plpgsql security definer set search_path=public as $$begin
 update public.manufacturer_availability set status='withdrawn'where id=p_id and manufacturer_id=auth.uid()and(status in('pending','declined')or kind='capacity_block');if not found then raise exception 'This availability record cannot be withdrawn';end if;return p_id;
end $$;
revoke all on function public.withdraw_factory_availability(uuid)from public,anon;
grant execute on function public.withdraw_factory_availability(uuid)to authenticated;
do $$declare d text;begin
 select pg_get_functiondef('public.check_factory_assignment(uuid,uuid,date)'::regprocedure)into d;
 if position('manufacturer_availability'in d)=0 then d:=replace(d,'select * into o from public.orders',
 'if exists(select 1 from public.manufacturer_availability where manufacturer_id=p_factory and status=''approved''and(current_date between starts_on and ends_on or p_due between starts_on and ends_on))then raise exception ''Factory is unavailable during this assignment window'';end if; select * into o from public.orders');execute d;end if;
end $$;

create or replace function public.dismiss_portal_notifications(p_audience text,p_id uuid default null)returns integer language plpgsql security definer set search_path=public as $$
declare removed integer;
begin
 if auth.uid()is null or p_audience not in('manufacturer','superadmin')or(p_audience='superadmin'and not public.is_superadmin())then raise exception 'Notification access denied';end if;
 delete from public.portal_notifications where audience=p_audience and(p_id is null or id=p_id)and(p_audience='superadmin'or user_id=auth.uid());get diagnostics removed=row_count;return removed;
end $$;
revoke all on function public.dismiss_portal_notifications(text,uuid)from public,anon;
grant execute on function public.dismiss_portal_notifications(text,uuid)to authenticated;
create index if not exists portal_notifications_unread_idx on public.portal_notifications(audience,user_id,created_at desc)where not read;
-- Retain documents referenced by historical verification decisions.
drop policy if exists manufacturer_assets_owner on storage.objects;
drop policy if exists manufacturer_assets_read on storage.objects;
create policy manufacturer_assets_read on storage.objects for select to authenticated using(bucket_id='manufacturer-assets'and((storage.foldername(name))[1]=auth.uid()::text or public.is_superadmin()));
drop policy if exists manufacturer_assets_upload on storage.objects;
create policy manufacturer_assets_upload on storage.objects for insert to authenticated with check(bucket_id='manufacturer-assets'and((storage.foldername(name))[1]=auth.uid()::text or public.is_superadmin()));
drop policy if exists manufacturer_assets_remove_unused on storage.objects;
create policy manufacturer_assets_remove_unused on storage.objects for delete to authenticated using(bucket_id='manufacturer-assets'and(public.is_superadmin()or((storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.manufacturer_verification_submissions v where name=any(v.document_paths))and not exists(select 1 from public.manufacturer_portfolio_items p where name=any(p.image_paths)))));
select public.apply_superadmin_access();
notify pgrst,'reload schema';
commit;


-- Audit features (20261022070000)
begin;
create schema if not exists ceriga_private;
revoke all on schema ceriga_private from public,anon,authenticated;
create table if not exists ceriga_private.integration_settings(key text primary key,value jsonb not null,updated_at timestamptz not null default now());
alter table ceriga_private.integration_settings enable row level security;
revoke all on ceriga_private.integration_settings from public,anon,authenticated;
insert into ceriga_private.integration_settings(key,value)select key,value from public.platform_settings where key='api_keys' on conflict(key)do nothing;
update public.platform_settings set value='{}'::jsonb where key='api_keys' and exists(select 1 from ceriga_private.integration_settings where key='api_keys');
drop policy if exists platform_settings_protect_credentials on public.platform_settings;
create policy platform_settings_protect_credentials on public.platform_settings as restrictive for all to authenticated using(key<>'api_keys')with check(key<>'api_keys');
create or replace function public.admin_integration_status()returns jsonb language plpgsql security definer set search_path=public as $$begin
 if not public.is_superadmin()then raise exception 'Super admin access required';end if;
 return jsonb_build_object('emailConfigured',exists(select 1 from ceriga_private.integration_settings where key='api_keys'and length(coalesce(value->>'sendgridKey',''))>0));
end $$;
revoke all on function public.admin_integration_status()from public,anon;grant execute on function public.admin_integration_status()to authenticated;
create table if not exists ceriga_private.ai_request_windows(user_id uuid primary key references auth.users(id)on delete cascade,window_start timestamptz not null,requests integer not null);
alter table ceriga_private.ai_request_windows enable row level security;
revoke all on ceriga_private.ai_request_windows from public,anon,authenticated;
create or replace function public.authorise_ai_request(p_user uuid)returns boolean language plpgsql security definer set search_path=public as $$declare n integer;begin
 if current_user<>'postgres'and coalesce(auth.jwt()->>'role','')<>'service_role'then raise exception 'Server access required';end if;
 if not exists(select 1 from auth.users where id=p_user)then return false;end if;
 insert into ceriga_private.ai_request_windows(user_id,window_start,requests)values(p_user,now(),1)on conflict(user_id)do update set window_start=case when ceriga_private.ai_request_windows.window_start<now()-interval '1 minute'then now()else ceriga_private.ai_request_windows.window_start end,requests=case when ceriga_private.ai_request_windows.window_start<now()-interval '1 minute'then 1 else ceriga_private.ai_request_windows.requests+1 end returning requests into n;
 return n<=6;
end $$;
revoke all on function public.authorise_ai_request(uuid)from public,anon,authenticated;grant execute on function public.authorise_ai_request(uuid)to service_role;
notify pgrst,'reload schema';
commit;


-- Audit features (20261022080000)
begin;
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

create table if not exists public.order_production_updates(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id)on delete cascade,
 manufacturer_id uuid not null references auth.users(id),submitted_by uuid not null references auth.users(id),
 version integer not null check(version>0),stage text not null check(stage in('preparation','cutting','sewing','finishing','quality_control')),
 note text not null default ''check(length(note)<=4000),expected_completion date,delay_reason text not null default ''check(length(delay_reason)<=4000),
 created_at timestamptz not null default now(),unique(order_id,version));
create index if not exists order_production_updates_order_idx on public.order_production_updates(order_id,version desc);
create index if not exists order_production_updates_factory_idx on public.order_production_updates(manufacturer_id,created_at desc);
alter table public.order_production_updates enable row level security;
drop policy if exists production_updates_participants on public.order_production_updates;
create policy production_updates_participants on public.order_production_updates for select to authenticated using(exists(select 1 from public.account_orders o where o.id=order_id));
grant select on public.order_production_updates to authenticated;
create or replace function public.update_order_production(p_order uuid,p_stage text,p_note text default '',p_expected date default null,p_delay_reason text default '',p_version integer default 0)returns uuid language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;previous public.order_production_updates%rowtype;result uuid;
begin
 select *into o from public.orders where id=p_order for update;
 if not found or auth.uid()is null or o.assigned_manufacturer_id is distinct from auth.uid()then raise exception 'Only the assigned manufacturer can update production';end if;
 if o.kind<>'production'or o.status<>'processing'or o.production_released_at is null or o.factory_status<>'in_production'then raise exception 'Production must be authorised before posting an update';end if;
 if p_stage is null or p_stage not in('preparation','cutting','sewing','finishing','quality_control')or length(coalesce(p_note,''))>4000 or length(coalesce(p_delay_reason,''))>4000 then raise exception 'Choose a valid stage and concise production notes';end if;
 if p_expected is not null and(p_expected<current_date or p_expected>current_date+3650)then raise exception 'Choose a valid expected completion date';end if;
 select *into previous from public.order_production_updates where order_id=p_order order by version desc limit 1;
 if coalesce(previous.version,0)is distinct from p_version then raise exception 'Production changed on another device; refresh before saving';end if;
 if previous.expected_completion is not null and p_expected>previous.expected_completion and length(btrim(coalesce(p_delay_reason,'')))<3 then raise exception 'Explain the production delay';end if;
 if(previous.stage,previous.note,previous.expected_completion,previous.delay_reason)is not distinct from(p_stage,btrim(coalesce(p_note,'')),p_expected,btrim(coalesce(p_delay_reason,'')))then return previous.id;end if;
 insert into public.order_production_updates(order_id,manufacturer_id,submitted_by,version,stage,note,expected_completion,delay_reason)values(p_order,auth.uid(),auth.uid(),coalesce(previous.version,0)+1,p_stage,btrim(coalesce(p_note,'')),p_expected,btrim(coalesce(p_delay_reason,'')))returning id into result;
 perform public.notify_superadmin('order',case when length(btrim(coalesce(p_delay_reason,'')))>0 then 'Production delay reported'else 'Production progress updated'end,o.product_name||' · '||replace(p_stage,'_',' '),'/superadmin/orders/'||p_order,p_order);
 return result;
end $$;
revoke all on function public.update_order_production(uuid,text,text,date,text,integer)from public,anon;grant execute on function public.update_order_production(uuid,text,text,date,text,integer)to authenticated;
-- Preserve existing unusual stock records; enforce validation for future writes.
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='public.factory_materials'::regclass and conname='factory_materials_valid_stock')then
 alter table public.factory_materials add constraint factory_materials_valid_stock check(length(btrim(name))between 1 and 200 and quantity>=0 and reorder_at>=0 and(gsm is null or gsm between 1 and 5000))not valid;
 end if;
end $$;
select public.apply_superadmin_access();
notify pgrst,'reload schema';
commit;


-- Audit features (20261022090000)
begin;
create index if not exists order_verified_payments_paid_idx on public.order_verified_payments(provider_paid_at,currency);
create index if not exists orders_factory_created_idx on public.orders(assigned_manufacturer_id,created_at desc);
create index if not exists orders_created_status_idx on public.orders(created_at desc,status);
create or replace function public.portal_report(p_days integer default 30)returns jsonb language plpgsql security definer set search_path=public as $$
declare admin boolean:=public.is_superadmin();since_at timestamptz;result jsonb;
begin
 if auth.uid()is null or(not admin and not exists(select 1 from public.profiles where id=auth.uid()and role='manufacturer'))then raise exception 'Portal access required';end if;
 if p_days is null or p_days not between 1 and 3650 then raise exception 'Choose a reporting period between 1 and 3650 days';end if;
 since_at:=now()-make_interval(days=>p_days);
 with scoped as(select *from public.orders where created_at>=since_at and(admin or assigned_manufacturer_id=auth.uid())),
 pipeline as(select status,count(*) n from scoped group by status),
 monthly as(select to_char(created_at,'YYYY-MM') as "month",count(*) orders from scoped group by 1),
 payments as(select currency,sum(amount_cents)::text cents,count(*) payments from public.order_verified_payments where admin and provider_paid_at>=since_at group by currency),
 paid_monthly as(select to_char(provider_paid_at,'YYYY-MM') as "month",currency,sum(amount_cents)::text cents from public.order_verified_payments where admin and provider_paid_at>=since_at group by 1,2)
 select jsonb_build_object('days',p_days,'since',since_at,'generatedAt',now(),'admin',admin,'orders',(select count(*)from scoped),'production',(select count(*)from scoped where status='processing'),'completed',(select count(*)from scoped where status='completed'),'quotesSubmitted',(select count(*)from scoped where quoted_at is not null),'quoteDeadlineSamples',(select count(*)from scoped where quoted_at is not null and due_quote_by is not null),'quotesOnTime',(select count(*)from scoped where quoted_at is not null and due_quote_by is not null and quoted_at<due_quote_by::date+interval '1 day'),'awaitingAssignment',(select count(*)from scoped where assigned_manufacturer_id is null),'pendingQc',(select count(*)from scoped where qc_status='pending_review'),'changesRequired',(select count(*)from scoped where qc_status='changes_required'),'pipeline',coalesce((select jsonb_agg(to_jsonb(pipeline))from pipeline),'[]'),'monthlyOrders',coalesce((select jsonb_agg(to_jsonb(monthly)order by "month")from monthly),'[]'),'verifiedRevenue',coalesce((select jsonb_agg(to_jsonb(payment_row))from payments payment_row),'[]'),'monthlyVerifiedRevenue',coalesce((select jsonb_agg(to_jsonb(paid_monthly)order by "month")from paid_monthly),'[]'),'users',case when admin then(select count(*)from public.profiles where created_at>=since_at)else null end,'manufacturers',case when admin then(select count(*)from public.manufacturer_profiles)else null end,'unreadNotifications',(select count(*)from public.portal_notifications where read=false and((admin and audience='superadmin')or(not admin and audience='manufacturer'and user_id=auth.uid()))))into result;
 return result;
end $$;
revoke all on function public.portal_report(integer)from public,anon;grant execute on function public.portal_report(integer)to authenticated;
notify pgrst,'reload schema';
commit;


-- Audit features (20261022100000)
begin;
create or replace function public.portal_configuration()returns jsonb language plpgsql security definer set search_path=public as $$
begin
 return coalesce((select jsonb_object_agg(key,value)from public.platform_settings where key='shipping_carriers'or key like 'catalog_base_%'or(key like 'catalog_product_%'and(public.is_superadmin()or coalesce((value->>'published')::boolean,false)))),'{}');
end $$;
revoke all on function public.portal_configuration()from public;grant execute on function public.portal_configuration()to anon,authenticated;
notify pgrst,'reload schema';
commit;


-- Audit features (20261022110000)
begin;
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
  if new.factory_status = 'rejected' and coalesce(old.factory_status, '') <> 'rejected' and coalesce(current_setting('app.routing_action',true),'') not in ('admin_rejected','manufacturer_quotation_rejected') then
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

  if new.status='priced' and old.status is distinct from 'priced' and new.assigned_manufacturer_id is not null then
    perform public.notify_manufacturer(new.assigned_manufacturer_id,'pricing','Quotation approved',new.product_name||' — Ceriga issued the customer quotation. Wait for production authorisation.','/manufacturer/orders/'||new.id,new.id);
  end if;
  if new.production_released_at is not null and old.production_released_at is null then
    perform public.notify_manufacturer(new.assigned_manufacturer_id,'order','Production authorised',new.product_name||case when new.payment_verified_at is not null then ' — payment verified.'else ' — customer submitted the order under the current submission policy.'end,'/manufacturer/orders/'||new.id,new.id);
    perform public.notify_superadmin('order','Order released to production',new.product_name,'/superadmin/orders/'||new.id,new.id);
    if new.payment_verified_at is not null then perform public.notify_brand(new.user_id,'payment','Payment received',new.product_name||' — payment verified and production authorised.',brand_href);end if;
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

  return new;
end;
$$;

create or replace function public.guard_portal_notification_content()returns trigger language plpgsql set search_path=public as $$begin
 if current_user in('authenticated','anon')and not public.is_superadmin()then
  if tg_op='INSERT'then raise exception 'Notifications are generated by the server';end if;
  if(to_jsonb(new)-'read')is distinct from(to_jsonb(old)-'read')then raise exception 'Only notification read state can be updated';end if;
 end if;return new;
end $$;
drop trigger if exists portal_notification_content_guard on public.portal_notifications;
create trigger portal_notification_content_guard before insert or update on public.portal_notifications for each row execute function public.guard_portal_notification_content();
revoke all on function public.guard_portal_notification_content()from public,anon,authenticated;
notify pgrst,'reload schema';commit;


-- Audit features (20261022120000)
begin;
create or replace function public.wf_protect_order()returns trigger language plpgsql set search_path=public as $$
begin
 if current_user not in('authenticated','anon')or public.is_superadmin()then return new;end if;
 if tg_op='INSERT'then
  if new.status not in('submitted','awaiting_payment')or new.paid_amount_cents is not null or new.payment_verified_at is not null or new.production_released_at is not null or new.workflow_managed then raise exception 'Use the controlled order workflow';end if;
 elsif (to_jsonb(new)-array['updated_at','quote_request','specifications','order_quantities','contact_name','contact_email','contact_phone','delivery_address']) is distinct from(to_jsonb(old)-array['updated_at','quote_request','specifications','order_quantities','contact_name','contact_email','contact_phone','delivery_address'])then
  raise exception 'Use authorised order actions';
 elsif old.user_id is distinct from auth.uid()or old.status not in('submitted','awaiting_payment')or old.assigned_manufacturer_id is not null then raise exception 'Ask Ceriga to revise an assigned order';end if;
 return new;
end $$;
create or replace function public.portal_report(p_days integer default 30)returns jsonb language plpgsql security definer set search_path=public as $$
declare admin boolean:=public.is_superadmin();since_at timestamptz;result jsonb;
begin
 if auth.uid()is null or(not admin and not exists(select 1 from public.profiles where id=auth.uid()and role='manufacturer'))then raise exception 'Portal access required';end if;
 if p_days is null or p_days not between 1 and 3650 then raise exception 'Choose a reporting period between 1 and 3650 days';end if;
 since_at:=now()-make_interval(days=>p_days);
 with scoped as(select *from public.orders where created_at>=since_at and(admin or assigned_manufacturer_id=auth.uid())),
 pipeline as(select status,count(*) n from scoped group by status),
 monthly as(select to_char(created_at,'YYYY-MM') as "month",count(*) orders from scoped group by 1),
 payments as(select currency,sum(amount_cents)::text cents,count(*) payments from public.order_verified_payments where admin and provider_paid_at>=since_at group by currency),
 paid_monthly as(select to_char(provider_paid_at,'YYYY-MM') as "month",currency,sum(amount_cents)::text cents from public.order_verified_payments where admin and provider_paid_at>=since_at group by 1,2)
 select jsonb_build_object('days',p_days,'since',since_at,'generatedAt',now(),'admin',admin,'orders',(select count(*)from scoped),'production',(select count(*)from scoped where status='processing'),'completed',(select count(*)from scoped where status='completed'),'quotesSubmitted',(select count(*)from scoped where quoted_at is not null),'quoteDeadlineSamples',(select count(*)from scoped where quoted_at is not null and due_quote_by is not null),'quotesOnTime',(select count(*)from scoped where quoted_at is not null and due_quote_by is not null and quoted_at<due_quote_by::date+interval '1 day'),'awaitingAssignment',(select count(*)from scoped where assigned_manufacturer_id is null),'pendingQc',(select count(*)from scoped where qc_status='pending_review'),'changesRequired',(select count(*)from scoped where qc_status='changes_required'),'pipeline',coalesce((select jsonb_agg(to_jsonb(pipeline))from pipeline),'[]'),'monthlyOrders',coalesce((select jsonb_agg(to_jsonb(monthly)order by "month")from monthly),'[]'),'verifiedRevenue',coalesce((select jsonb_agg(to_jsonb(payment_row))from payments payment_row),'[]'),'monthlyVerifiedRevenue',coalesce((select jsonb_agg(to_jsonb(paid_monthly)order by "month")from paid_monthly),'[]'),'users',case when admin then(select count(*)from public.profiles where created_at>=since_at)else null end,'manufacturers',case when admin then(select count(*)from public.manufacturer_profiles)else null end,'unreadNotifications',(select count(*)from public.portal_notifications where read=false and((admin and audience='superadmin')or(not admin and audience='manufacturer'and user_id=auth.uid()))))into result;
 return result;
end $$;
revoke all on function public.portal_report(integer)from public,anon;grant execute on function public.portal_report(integer)to authenticated;
notify pgrst,'reload schema';
commit;


-- Audit features (20261022130000)
begin;
create or replace function public.wf_guard_factory_status() returns trigger
language plpgsql set search_path=public as $$
begin
 if current_user in('authenticated','anon')and not public.is_superadmin()then
  if tg_op='INSERT'then
   if new.status<>'onboarding'or new.onboarding_complete or new.commission_plan_id is not null or not exists(select 1 from public.profiles where id=auth.uid()and role='manufacturer') then raise exception 'Only Ceriga may set factory eligibility or commission plans';end if;
  elsif (new.status,new.commission_plan_id,new.onboarding_complete) is distinct from(old.status,old.commission_plan_id,old.onboarding_complete)then raise exception 'Only Ceriga may change factory eligibility or commission plans';end if;
 end if;
 return new;
end $$;
notify pgrst,'reload schema';commit;


-- Audit features (20261024010000)
begin;
-- Read-only dashboard projections; existing ownership and administrator authority remain unchanged.
create index if not exists dashboard_completed_idx on public.orders(completed_at)where completed_at is not null;
create index if not exists dashboard_routing_recent_idx on public.order_routing_events(created_at desc,order_id);
create index if not exists dashboard_routing_factory_idx on public.order_routing_events(manufacturer_id,created_at desc);
create index if not exists dashboard_qc_recent_idx on public.qc_audit_events(created_at desc,order_id);
create index if not exists dashboard_reports_factory_idx on public.qc_inspections(manufacturer_id,submitted_at desc)where workflow_version=2;

create or replace function public.portal_dashboard(p_admin boolean default false,p_days integer default 30,p_search text default '',p_stage text default 'all',p_sort text default 'desc')returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare uid uuid:=auth.uid();since_at timestamptz;result jsonb;
begin
 if uid is null then raise exception 'Sign in to load the dashboard';end if;
 if p_admin is null or(p_admin and not public.is_superadmin())or(not p_admin and not exists(select 1 from public.profiles where id=uid and role='manufacturer'))then raise exception 'Dashboard access denied';end if;
 if p_days is null or p_days not in(7,30,90)then raise exception 'Choose a 7, 30 or 90 day reporting period';end if;
 if p_sort is null or p_sort not in('asc','desc')or p_stage is null or p_stage not in('all','assignment','quotation','quote_review','awaiting_customer','production','quality','dispatch','shipping')or p_search is null or length(p_search)>100 then raise exception 'Invalid dashboard filter';end if;
 since_at:=now()-make_interval(days=>p_days);
 with accessible as not materialized(select *from public.orders where p_admin union all select *from public.orders where not p_admin and assigned_manufacturer_id=uid),
 scoped as materialized(
  select o.*,coalesce(nullif(b.full_name,''),'Brand account')as brand_name,coalesce(nullif(m.factory_name,''),'Unassigned')as factory_name,
   p.stage as production_stage,p.expected_completion,p.delay_reason,p.created_at as progress_at,
   q.id as latest_report_id,q.qc_status as report_status,q.has_issues,q.submitted_at as report_submitted_at,q.reviewed_at as report_reviewed_at,
   greatest(o.created_at,o.assigned_at,o.quoted_at,o.offer_issued_at,o.production_released_at,o.completed_at,p.created_at,q.submitted_at,q.reviewed_at,e.event_at)as last_updated,
   e.revision_at,
   case when o.status in('completed','ready')then 'completed' when o.status='shipping'then 'shipping' when o.status='processing'and o.qc_status='approved'then 'dispatch' when o.status='processing'and(o.qc_status in('pending_review','changes_required')or p.stage='quality_control')then 'quality' when o.status='processing'then 'production' when o.status='priced'then 'awaiting_customer' when o.factory_status='quoted'then 'quote_review' when o.assigned_manufacturer_id is not null then 'quotation'else 'assignment'end as dashboard_stage,
   case when selected.value is not null then (selected.value->>'totalUnits')||' units'
    when coalesce(jsonb_array_length(o.order_quantities->'bulkRuns'),0)>1 or(o.order_quantities->'sample' is not null and coalesce(jsonb_array_length(o.order_quantities->'bulkRuns'),0)>0)then 'Multiple quotation options'
    else coalesce(o.order_quantities->'sample'->>'targetTotal',o.order_quantities->'bulkRuns'->0->>'targetTotal',o.quote_request->>'quantity','Quantity not recorded')||case when o.order_quantities is not null then ' units'else ''end end as quantity_label,
   case when p_admin then selected.value->>'priceCents'else null end as value_cents,
   case when p_admin then selected.value->>'currency'else null end as value_currency,
   (o.status='processing'and o.qc_status not in('approved','pending_review')and(coalesce(length(btrim(p.delay_reason)),0)>0 or(p.expected_completion<current_date and p.stage<>'quality_control')))as delayed
  from accessible o left join public.profiles b on b.id=o.user_id left join public.manufacturer_profiles m on m.user_id=o.assigned_manufacturer_id
  left join lateral(select u.stage,u.expected_completion,u.delay_reason,u.created_at from public.order_production_updates u where u.order_id=o.id and(u.manufacturer_id=o.assigned_manufacturer_id)order by version desc limit 1)p on true
  left join lateral(select i.id,i.qc_status,i.has_issues,i.submitted_at,i.reviewed_at from public.qc_inspections i where i.order_id=o.id and i.workflow_version=2 and i.manufacturer_id=o.assigned_manufacturer_id order by report_version desc limit 1)q on true
  left join lateral(select max(created_at)event_at,max(created_at)filter(where event_type in('admin_rejected','manufacturer_quotation_rejected')and details->>'nextAction'='revise')revision_at from public.order_routing_events r where r.order_id=o.id and(p_admin or r.manufacturer_id=uid))e on true
  left join lateral(select value from jsonb_array_elements(coalesce(o.price_options,'[]'))where value->>'id'=o.selected_price_option_id limit 1)selected on true
  where(p_admin or o.assigned_manufacturer_id=uid)and(o.status not in('completed','ready','cancelled')or o.created_at>=since_at or o.assigned_at>=since_at or o.quoted_at>=since_at or o.completed_at>=since_at)
 ), active as materialized(select *from scoped where status not in('completed','ready','cancelled')),
 classified as(
  select a.*,case when p_admin then
   case when kind='production'and factory_status='rejected'and status in('submitted','awaiting_payment')then 'reassign'
    when kind='production'and assigned_manufacturer_id is null and status in('submitted','awaiting_payment')then 'assign'
    when qc_status='pending_review'and coalesce(has_issues,false)then 'qc_issues'
    when qc_status='pending_review'then 'review_qc'
    when factory_status='quoted'and status in('submitted','awaiting_payment')and offer_issued_at is null then 'review_quote'
    when delayed then 'delay'
    when factory_status in('new','reviewing','clarifying')and due_quote_by<current_date then 'quote_overdue'end
   else case when factory_status='clarifying'and status in('submitted','awaiting_payment')then 'revise_quote'
    when factory_status in('new','reviewing')and status in('submitted','awaiting_payment')then 'quote'
    when status='processing'and qc_status='changes_required'then 'revise_qc'
    when status='processing'and qc_status='approved'then 'dispatch'
    when status='processing'and qc_status='not_submitted'and(production_stage='quality_control'or latest_report_id is not null)then 'submit_qc'
    when delayed then 'delay'
    when status='processing'and production_released_at is not null and progress_at is null and qc_status='not_submitted'then 'production_update'end end as task
  from active a
 ), tasks as materialized(
  select id,product_name,garment_type,brand_name,factory_name,quantity_label,dashboard_stage,task,
   case when task in('reassign','qc_issues','revise_qc')then 1 when task in('delay','quote_overdue','revise_quote')then 2 else 3 end priority,
   case when task in('quote','revise_quote','quote_overdue')then due_quote_by when task='delay'then expected_completion end deadline,
   case when task in('quote','revise_quote')then coalesce(revision_at,assigned_at,created_at)when task in('review_qc','qc_issues')then coalesce(report_submitted_at,last_updated)when task='revise_qc'then coalesce(report_reviewed_at,last_updated)when task='review_quote'then quoted_at when task='assign'then created_at when task='dispatch'then coalesce(report_reviewed_at,last_updated)when task='delay'then coalesce(progress_at,last_updated)else last_updated end waiting_since
  from classified where task is not null
 ), table_rows as(
  select a.* from active a where(p_admin or(production_released_at is not null and status='processing'))and(p_stage='all'or dashboard_stage=p_stage)and(p_search=''or concat_ws(' ',id::text,product_name,garment_type,brand_name,factory_name)ilike '%'||p_search||'%')
  order by case when p_sort='desc'then last_updated end desc nulls last,case when p_sort='asc'then last_updated end asc nulls last,id limit 12
 ), routing_feed as(
  select 'routing:'||e.id::text id,e.order_id,case when e.event_type='updated'and e.details->>'factoryStatus'='quoted'then 'quoted'when e.event_type in('admin_rejected','manufacturer_quotation_rejected')then case when e.details->>'nextAction'='revise'then 'revision_requested'else 'quote_rejected'end when e.event_type='production_released'and o.payment_verified_at is not null then 'payment_confirmed'else e.event_type end kind,e.created_at at from public.order_routing_events e join scoped o on o.id=e.order_id
  where e.created_at>=since_at and(p_admin or e.manufacturer_id=uid)and((e.event_type='updated'and e.details->>'factoryStatus'='quoted'and e.details->>'status'in('submitted','awaiting_payment'))or e.event_type in('submitted','assigned','quoted','offer_published','manufacturer_declined','production_released','customer_submitted_to_manufacturer','currency_requote_requested')or(e.event_type in('admin_rejected','manufacturer_quotation_rejected')and e.details?'nextAction'))
  order by e.created_at desc,e.id limit 20
 ), qc_feed as(
  select 'qc:'||e.id::text id,e.order_id,case when e.action='order_completed'then case when e.details->>'method'='automatic'then 'automatic_completion'else 'order_delivered'end else e.action end kind,e.created_at at from public.qc_audit_events e join scoped o on o.id=e.order_id
  where e.created_at>=since_at and e.action in('submit_report','approve_report','request_report_changes','dispatch','order_completed')and(p_admin or e.actor_id=uid or e.details->>'manufacturer_id'=uid::text or e.action='order_completed')
  order by e.created_at desc,e.id limit 20
 ), progress_feed as(
  select 'progress:'||u.id::text id,u.order_id,'production_update'::text kind,u.created_at at from public.order_production_updates u join scoped o on o.id=u.order_id where u.created_at>=since_at and(p_admin or u.manufacturer_id=uid)order by u.created_at desc,u.id limit 20
 ), feed as(select *from routing_feed union all select *from qc_feed union all select *from progress_feed),
 recent as(select f.*,o.product_name,o.brand_name,o.factory_name,o.dashboard_stage from feed f join scoped o on o.id=f.order_id order by at desc,id limit 20),
 quote_samples as(
  select e.id,e.created_at,e.order_id,e.manufacturer_id,extract(epoch from(e.created_at-request.created_at))/3600.0 hours
  from public.order_routing_events e join scoped o on o.id=e.order_id
  join lateral(select r.created_at from public.order_routing_events r where r.order_id=e.order_id and r.manufacturer_id=e.manufacturer_id and r.created_at<=e.created_at and(r.event_type='assigned'or(r.event_type in('admin_rejected','manufacturer_quotation_rejected')and r.details->>'nextAction'='revise'))order by r.created_at desc limit 1)request on true
  where(e.event_type='quoted'or(e.event_type='updated'and e.details->>'factoryStatus'='quoted'and e.details->>'status'in('submitted','awaiting_payment')))and e.created_at>=since_at and(p_admin or e.manufacturer_id=uid)
 ), decisions as(
  select distinct on(q.id)q.id,e.event_type,e.created_at from public.order_routing_events e join scoped o on o.id=e.order_id
  join lateral(select r.id from public.order_routing_events r where r.order_id=e.order_id and r.manufacturer_id=e.manufacturer_id and(r.event_type='quoted'or(r.event_type='updated'and r.details->>'factoryStatus'='quoted'and r.details->>'status'in('submitted','awaiting_payment')))and r.created_at<=e.created_at order by r.created_at desc,r.id desc limit 1)q on true
  where e.created_at>=since_at and(p_admin or e.manufacturer_id=uid)and(e.event_type='offer_published'or(e.event_type in('admin_rejected','manufacturer_quotation_rejected')and e.details?'previousManufacturerQuote'))order by q.id,e.created_at,e.id
 ), reports as materialized(select i.id,i.order_id,i.manufacturer_id,i.report_version,i.submitted_at,i.reviewed_at,i.qc_status from public.qc_inspections i join scoped o on o.id=i.order_id where workflow_version=2 and(p_admin or i.manufacturer_id=uid)),
 first_reports as(select distinct on(order_id,manufacturer_id)*from reports where submitted_at is not null order by order_id,manufacturer_id,report_version),
 revenue as(select p.currency,sum(p.amount_cents)::text cents from public.order_verified_payments p where p_admin and p.provider_paid_at>=since_at group by p.currency),
 daily_received as(select to_char(case when p_admin then created_at else assigned_at end,'YYYY-MM-DD')as day_key,count(*)n from scoped where(case when p_admin then created_at else assigned_at end)>=since_at group by 1),
 daily_completed as(select to_char(completed_at,'YYYY-MM-DD')as day_key,count(*)n from scoped where completed_at>=since_at and status='completed'group by 1),
 trend as(select to_char(d,'YYYY-MM-DD')as "day",coalesce(r.n,0)received,coalesce(c.n,0)completed from generate_series(date_trunc('day',since_at),date_trunc('day',now()),interval '1 day')d left join daily_received r on r.day_key=to_char(d,'YYYY-MM-DD')left join daily_completed c on c.day_key=to_char(d,'YYYY-MM-DD'))
 select jsonb_build_object(
  'audience',case when p_admin then 'admin'else 'manufacturer'end,'generatedAt',now(),'days',p_days,
  'counts',jsonb_build_object('newOrders',(select count(*)from classified where task='assign'),'active',(select count(*)from active),'assignment',(select count(*)from classified where task in('assign','reassign')),'quoteReview',(select count(*)from classified where task='review_quote'),'pendingQuotes',(select count(*)from classified where task in('quote','revise_quote')),'qcPending',(select count(*)from active where qc_status='pending_review'),'production',(select count(*)from active where status='processing'and production_released_at is not null and qc_status not in('approved','pending_review')),'qcSubmission',(select count(*)from classified where task in('submit_qc','revise_qc')),'dispatch',(select count(*)from active where dashboard_stage='dispatch'),'completed',(select count(*)from scoped where completed_at>=since_at and status='completed'),'delayed',(select count(*)from active where delayed),'attention',(select count(*)from tasks),'manufacturers',case when p_admin then(select count(*)from public.manufacturer_profiles where status='active'and onboarding_complete)else null end),
  'revenue',coalesce((select jsonb_agg(to_jsonb(r))from revenue r),'[]'),
  'tasks',coalesce((select jsonb_agg(to_jsonb(t)order by overdue desc,priority,waiting_since,id)from(select t.*,coalesce(deadline<current_date,false)as overdue from tasks t order by(deadline<current_date)desc nulls last,priority,waiting_since,id limit 12)t),'[]'),
  'orders',coalesce((select jsonb_agg(jsonb_build_object('id',id,'product',product_name,'brand',brand_name,'manufacturer',factory_name,'garment',garment_type,'quantity',quantity_label,'stage',dashboard_stage,'productionStage',production_stage,'expectedCompletion',expected_completion,'updatedAt',last_updated,'valueCents',value_cents,'currency',value_currency,'delayed',delayed)order by case when p_sort='desc'then last_updated end desc,case when p_sort='asc'then last_updated end asc,id)from table_rows),'[]'),
  'matchingOrders',(select count(*)from active where(p_admin or(production_released_at is not null and status='processing'))and(p_stage='all'or dashboard_stage=p_stage)and(p_search=''or concat_ws(' ',id::text,product_name,garment_type,brand_name,factory_name)ilike '%'||p_search||'%')),
  'activity',coalesce((select jsonb_agg(to_jsonb(r)order by at desc,id)from recent r),'[]'),
  'metrics',jsonb_build_object('received',(select count(*)from scoped where(case when p_admin then created_at else assigned_at end)>=since_at),'completed',(select count(*)from scoped where completed_at>=since_at and status='completed'),'quoteHours',(select round(avg(hours)::numeric,1)from quote_samples),'quoteSamples',(select count(*)from quote_samples),'productionDays',(select round(avg(extract(epoch from(f.submitted_at-o.production_released_at))/86400.0)::numeric,1)from first_reports f join scoped o on o.id=f.order_id where o.production_released_at is not null and f.submitted_at>=o.production_released_at and f.submitted_at>=since_at),'productionSamples',(select count(*)from first_reports f join scoped o on o.id=f.order_id where o.production_released_at is not null and f.submitted_at>=o.production_released_at and f.submitted_at>=since_at),'qcReviewed',(select count(*)from reports where reviewed_at>=since_at and qc_status in('approved','changes_required')),'qcApproved',(select count(*)from reports where reviewed_at>=since_at and qc_status='approved'),'qcFirstReviewed',(select count(*)from first_reports where reviewed_at>=since_at and qc_status in('approved','changes_required')),'qcFirstApproved',(select count(*)from first_reports where reviewed_at>=since_at and qc_status='approved'),'quoteDecided',(select count(*)from decisions),'quoteAccepted',(select count(*)from decisions where event_type='offer_published'),'onTimeCompletion',null,'onTimeReason','An immutable agreed production completion deadline is not recorded.','delayed',(select count(*)from active where delayed)),
  'trend',coalesce((select jsonb_agg(to_jsonb(t)order by "day")from trend t),'[]'))into result;
 return result;
end $$;
revoke all on function public.portal_dashboard(boolean,integer,text,text,text)from public,anon;
grant execute on function public.portal_dashboard(boolean,integer,text,text,text)to authenticated;
notify pgrst,'reload schema';
commit;


-- Audit features (20261025010000)
begin;
-- Older deployed profiles lack a column used by the existing profile-sync trigger.
alter table public.manufacturer_profiles add column if not exists city text;
update public.manufacturer_profiles set city=nullif(profile_details->>'city','')where city is null and coalesce(profile_details->>'city','')<>'';
-- Extend the existing availability source; no order commitments are changed.
alter table public.manufacturer_availability add column if not exists updated_at timestamptz not null default now();
alter table public.manufacturer_availability add column if not exists revision integer not null default 0;
alter table public.manufacturer_availability add column if not exists created_by uuid references auth.users(id)on delete set null;
alter table public.manufacturer_availability add column if not exists timezone text not null default 'UTC';
alter table public.manufacturer_availability add column if not exists history jsonb not null default '[]';
do $$declare c record;begin for c in select conname from pg_constraint where conrelid='public.manufacturer_availability'::regclass and contype='c' and pg_get_constraintdef(oid)like '%btrim(reason)%'loop execute format('alter table public.manufacturer_availability drop constraint %I',c.conname);end loop;end $$;
alter table public.manufacturer_availability drop constraint if exists calendar_reason_length;
alter table public.manufacturer_availability add constraint calendar_reason_length check(length(reason)<=2000);
alter table public.manufacturer_profiles add column if not exists calendar_workdays integer[];
alter table public.manufacturer_profiles add column if not exists calendar_timezone text not null default 'UTC';
alter table public.manufacturer_profiles add column if not exists calendar_revision integer not null default 0;
create index if not exists calendar_effective_ranges on public.manufacturer_availability(manufacturer_id,starts_on,ends_on)where status in('approved','pending');
create index if not exists calendar_processing_factories on public.orders(assigned_manufacturer_id,production_released_at)where status='processing';
create or replace function public.guard_calendar_schedule()returns trigger language plpgsql set search_path=public as $$begin
 if not exists(select 1 from pg_timezone_names where name=new.calendar_timezone)then raise exception 'Choose a valid factory time zone';end if;
 if new.calendar_workdays is not null and(cardinality(new.calendar_workdays)not between 1 and 7 or exists(select 1 from unnest(new.calendar_workdays)d where d is null or d not between 1 and 7)or cardinality(new.calendar_workdays)<>(select count(distinct d)from unnest(new.calendar_workdays)d))then raise exception 'Select distinct working weekdays';end if;
 if tg_op='UPDATE'and(new.calendar_workdays,new.calendar_timezone)is distinct from(old.calendar_workdays,old.calendar_timezone)then new.calendar_revision:=old.calendar_revision+1;end if;return new;end $$;
drop trigger if exists manufacturer_calendar_schedule_guard on public.manufacturer_profiles;
create trigger manufacturer_calendar_schedule_guard before insert or update on public.manufacturer_profiles for each row execute function public.guard_calendar_schedule();
insert into public.platform_settings(key,value)values('calendar_thresholds','{"busy":70,"full":90,"warning":30,"critical":60}')on conflict(key)do nothing;
create or replace function public.calendar_garment_key(value text)returns text language sql immutable parallel safe set search_path=public as $$
 select case k when 'tshirts'then 'tshirt'when 'tees'then 'tshirt'when 'hoodies'then 'hoodie'when 'polos'then 'polo'when 'poloshirts'then 'polo'when 'zipups'then 'zipuphoodie'when 'zipuphoodies'then 'zipuphoodie'else regexp_replace(k,'s$','')end from(select lower(regexp_replace(coalesce(value,''),'[^a-zA-Z0-9]','','g'))k)s;
$$;

create or replace function public.calendar_order_facts(p_factory uuid default null)
returns table(id uuid,manufacturer_id uuid,product text,garment text,quantity numeric,starts_on date,due_on date,stage text,status text,delay_reason text,effort_active boolean)
language sql stable security definer set search_path=public as $$
 select o.id,o.assigned_manufacturer_id,o.product_name,o.garment_type,
 case when coalesce(selected.value->>'totalUnits','')~'^[0-9]+$'then(selected.value->>'totalUnits')::numeric
 when jsonb_array_length(coalesce(o.order_quantities->'bulkRuns','[]'))=0 and coalesce(o.order_quantities->'sample'->>'targetTotal','')~'^[0-9]+$'then(o.order_quantities->'sample'->>'targetTotal')::numeric else null end,
 first_update.started,p.expected_completion,coalesce(p.stage,'not_updated'),o.status,p.delay_reason,o.qc_status<>'approved'
 from public.orders o
 left join lateral(select value from jsonb_array_elements(coalesce(o.price_options,'[]'))where value->>'id'=o.selected_price_option_id limit 1)selected on true
 left join lateral(select min((u.created_at at time zone m.calendar_timezone)::date)started from public.order_production_updates u join public.manufacturer_profiles m on m.user_id=u.manufacturer_id where u.order_id=o.id and u.manufacturer_id=o.assigned_manufacturer_id)first_update on true
 left join lateral(select u.expected_completion,u.stage,u.delay_reason from public.order_production_updates u where u.order_id=o.id and u.manufacturer_id=o.assigned_manufacturer_id order by u.version desc limit 1)p on true
 where o.status='processing'and o.production_released_at is not null and(p_factory is null or o.assigned_manufacturer_id=p_factory);
$$;
revoke all on function public.calendar_order_facts(uuid)from public,anon,authenticated;

create or replace function public.save_calendar_schedule(p_days integer[],p_timezone text,p_revision integer)returns integer
language plpgsql security definer set search_path=public as $$declare result integer;begin
 if auth.uid()is null or not exists(select 1 from public.profiles where id=auth.uid()and role='manufacturer')then raise exception 'Manufacturer access required';end if;
 if p_days is null or cardinality(p_days)not between 1 and 7 or exists(select 1 from unnest(p_days)d where d is null or d not between 1 and 7)or cardinality(p_days)<>(select count(distinct d)from unnest(p_days)d)then raise exception 'Select distinct working weekdays';end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone)then raise exception 'Choose a valid time zone';end if;
 update public.manufacturer_profiles set calendar_workdays=p_days,calendar_timezone=p_timezone,calendar_revision=calendar_revision+1 where user_id=auth.uid()and calendar_revision=p_revision returning calendar_revision into result;
 if not found then raise exception 'Schedule changed; refresh before saving';end if;
 perform public.notify_superadmin('capacity','Factory working schedule changed','Review the production calendar for availability and order conflicts.','/superadmin/time-off',null);
 return result;end $$;
revoke all on function public.save_calendar_schedule(integer[],text,integer)from public,anon;
grant execute on function public.save_calendar_schedule(integer[],text,integer)to authenticated;

create or replace function public.save_calendar_availability(p_ranges jsonb,p_reason text default '',p_id uuid default null,p_revision integer default null,p_remove boolean default false)returns jsonb
language plpgsql security definer set search_path=public as $$
declare factory public.manufacturer_profiles%rowtype;old public.manufacturer_availability%rowtype;r jsonb;first_date date;last_date date;result uuid;ids jsonb:='[]';changed boolean:=false;affected integer;
begin
 select m.*into factory from public.manufacturer_profiles m join public.profiles p on p.id=m.user_id where m.user_id=auth.uid()and p.role='manufacturer';
 if not found then raise exception 'Manufacturer access required';end if;
 if p_remove is null or p_reason is null or length(p_reason)>2000 then raise exception 'Invalid availability details';end if;
 perform pg_advisory_xact_lock(hashtextextended('calendar:'||auth.uid()::text,0));
 if p_id is not null then
  select *into old from public.manufacturer_availability where id=p_id and manufacturer_id=auth.uid()for update;
  if not found or old.revision is distinct from p_revision then raise exception 'Availability changed or inaccessible; refresh before saving';end if;
  if old.status='withdrawn'then raise exception 'This period was already removed';end if;
  if p_remove then
   update public.manufacturer_availability set status='withdrawn',updated_at=now(),revision=revision+1,history=history||jsonb_build_array(to_jsonb(old)-'history')where id=p_id;changed:=true;ids:=jsonb_build_array(p_id);
  end if;
 elsif p_remove then raise exception 'Select an existing period';end if;
 if not p_remove then
  if jsonb_typeof(p_ranges)is distinct from 'array'or jsonb_array_length(p_ranges)not between 1 and 366 or(p_id is not null and jsonb_array_length(p_ranges)<>1)then raise exception 'Select valid dates or a range';end if;
  for r in select value from jsonb_array_elements(p_ranges)loop
   first_date:=(r->>'start')::date;last_date:=(r->>'end')::date;
   if first_date is null or last_date is null or last_date<first_date or last_date>first_date+365 or(last_date<(now()at time zone factory.calendar_timezone)::date and p_id is null)then raise exception 'Choose a valid current or future range of at most 366 days';end if;
   if p_id is not null then
    result:=p_id;
    if old.starts_on is distinct from first_date or old.ends_on is distinct from last_date or old.reason is distinct from btrim(p_reason)or old.status<>'approved'then
     update public.manufacturer_availability set starts_on=first_date,ends_on=last_date,reason=btrim(p_reason),status='approved',updated_at=now(),revision=revision+1,timezone=factory.calendar_timezone,history=history||jsonb_build_array(to_jsonb(old)-'history')where id=p_id;changed:=true;
    end if;
   else
    select id into result from public.manufacturer_availability where manufacturer_id=auth.uid()and starts_on=first_date and ends_on=last_date and reason=btrim(p_reason)and status='approved'limit 1;
    if not found then insert into public.manufacturer_availability(manufacturer_id,kind,starts_on,ends_on,reason,status,created_by,timezone)values(auth.uid(),'time_off',first_date,last_date,btrim(p_reason),'approved',auth.uid(),factory.calendar_timezone)returning id into result;changed:=true;end if;
   end if;
   ids:=ids||jsonb_build_array(result);
  end loop;
 end if;
 select count(*)into affected from public.calendar_order_facts(auth.uid())o where exists(select 1 from public.manufacturer_availability a where a.id in(select value::text::uuid from jsonb_array_elements_text(ids))and a.status='approved'and(o.due_on between a.starts_on and a.ends_on or(o.starts_on is not null and o.due_on is not null and daterange(o.starts_on,greatest(o.starts_on,o.due_on),'[]')&&daterange(a.starts_on,a.ends_on,'[]'))));
 if changed then perform public.notify_superadmin('capacity',case when p_remove then 'Factory unavailable dates removed'else 'Factory unavailable dates changed'end,factory.factory_name||': '||affected||' active order conflicts. '||coalesce(p_reason,''),'/superadmin/time-off',null);end if;
 return jsonb_build_object('ids',ids,'conflicts',affected,'changed',changed);
end $$;
revoke all on function public.save_calendar_availability(jsonb,text,uuid,integer,boolean)from public,anon;
grant execute on function public.save_calendar_availability(jsonb,text,uuid,integer,boolean)to authenticated;

-- Keep callers of the old interface compatible with immediate self-managed closures.
create or replace function public.request_factory_availability(p_kind text,p_start date,p_end date,p_reason text)returns uuid language plpgsql security definer set search_path=public as $$declare r jsonb;begin
 if p_kind not in('time_off','capacity_block')then raise exception 'Invalid availability type';end if;
 r:=public.save_calendar_availability(jsonb_build_array(jsonb_build_object('start',p_start,'end',p_end)),coalesce(p_reason,''));return(r->'ids'->>0)::uuid;end $$;
create or replace function public.withdraw_factory_availability(p_id uuid)returns uuid language plpgsql security definer set search_path=public as $$declare v integer;begin select revision into v from public.manufacturer_availability where id=p_id and manufacturer_id=auth.uid();perform public.save_calendar_availability('[]','',p_id,v,true);return p_id;end $$;
-- A quotation due date is not a confirmed production window: closure conflicts must not reject quote assignment.
do $$declare d text;begin select pg_get_functiondef('public.check_factory_assignment(uuid,uuid,date)'::regprocedure)into d;
 d:=replace(d,'if exists(select 1 from public.manufacturer_availability where manufacturer_id=p_factory and status=''approved''and(current_date between starts_on and ends_on or p_due between starts_on and ends_on))then raise exception ''Factory is unavailable during this assignment window'';end if; ','');execute d;end $$;

create or replace function public.production_calendar(p_start date,p_end date,p_admin boolean default false,p_factory uuid default null,p_garment text default '',p_country text default '',p_availability text default 'all',p_workload text default 'all',p_status text default 'all')returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;owner uuid;thresholds jsonb;v_busy numeric;full_at numeric;warning numeric;critical numeric;
begin
 if auth.uid()is null or p_admin is null or(p_admin and not public.is_superadmin())or(not p_admin and not exists(select 1 from public.profiles where id=auth.uid()and role='manufacturer'))then raise exception 'Calendar access denied';end if;
 if p_start is null or p_end is null or p_end<p_start or p_end>p_start+61 or p_garment is null or p_country is null or length(p_garment)>100 or length(p_country)>100 or p_availability is null or p_availability not in('all','unavailable','working','unknown')or p_workload is null or p_workload not in('all','available','busy','full','unknown')or p_status is null or p_status not in('all','not_updated','preparation','cutting','sewing','finishing','quality_control')then raise exception 'Invalid calendar range or filter';end if;
 if not p_admin and p_factory is not null and p_factory<>auth.uid()then raise exception 'Calendar access denied';end if;
 owner:=case when p_admin then p_factory else auth.uid()end;
 select value into thresholds from public.platform_settings where key='calendar_thresholds';
 v_busy:=(thresholds->>'busy')::numeric;full_at:=(thresholds->>'full')::numeric;warning:=(thresholds->>'warning')::numeric;critical:=(thresholds->>'critical')::numeric;
 if v_busy is null or v_busy<=0 or full_at<=v_busy or full_at>100 or warning<=0 or critical<=warning or critical>100 then raise exception 'Calendar thresholds are invalid; ask a super admin to configure them';end if;
 with factories as materialized(select m.user_id id,m.factory_name name,m.garments,m.country,m.monthly_capacity capacity,m.calendar_workdays workdays,m.calendar_timezone timezone,m.calendar_revision revision
 from public.manufacturer_profiles m where(owner is null or m.user_id=owner)and(not p_admin or(m.onboarding_complete and m.status is distinct from 'paused'))and(p_garment=''or exists(select 1 from unnest(m.garments)g where public.calendar_garment_key(g)=public.calendar_garment_key(p_garment)))and(p_country=''or m.country=p_country)),
 facts as materialized(select o.*from public.calendar_order_facts(owner)o join factories f on f.id=o.manufacturer_id where(p_garment=''or public.calendar_garment_key(o.garment)=public.calendar_garment_key(p_garment))and(p_status='all'or o.stage=p_status)),
 blocks as materialized(select a.*from public.manufacturer_availability a join factories f on f.id=a.manufacturer_id where a.status in('approved','pending')and a.starts_on<=p_end and a.ends_on>=p_start),
 months as(select d::date month_start from generate_series(date_trunc('month',p_start::timestamp),date_trunc('month',p_end::timestamp),interval '1 month')d),
 load as materialized(select f.id,m.month_start,wd.nominal,wd.available,wd.blocked,dem.units,dem.unknown_units,dem.unscheduled,
 case when f.workdays is not null and f.capacity>0 and wd.nominal>0 then f.capacity*wd.available/wd.nominal end capacity,
 case when f.workdays is not null and f.capacity>0 and wd.available>0 and dem.unknown_units=0 then round(100*dem.units/(f.capacity*wd.available/wd.nominal),1)end utilisation
 from factories f cross join months m
 cross join lateral(select count(*)filter(where extract(isodow from d)::integer=any(f.workdays))::numeric nominal,
 count(*)filter(where extract(isodow from d)::integer=any(f.workdays)and not exists(select 1 from public.manufacturer_availability a where a.manufacturer_id=f.id and a.status='approved'and d::date between a.starts_on and a.ends_on))::numeric available,
 count(*)filter(where exists(select 1 from public.manufacturer_availability a where a.manufacturer_id=f.id and a.status='approved'and d::date between a.starts_on and a.ends_on))blocked
 from generate_series(m.month_start::timestamp,(m.month_start+interval '1 month'-interval '1 day')::timestamp,interval '1 day')d)wd
 cross join lateral(select coalesce(sum(o.quantity)filter(where o.due_on>=m.month_start and o.due_on<m.month_start+interval '1 month'and o.effort_active),0)units,
 count(*)filter(where o.due_on>=m.month_start and o.due_on<m.month_start+interval '1 month'and o.quantity is null and o.effort_active)unknown_units,
 count(*)filter(where o.due_on is null and o.effort_active)unscheduled from facts o where o.manufacturer_id=f.id)dem),
 summary as materialized(select f.*,l.month_start,l.capacity adjusted_capacity,l.units,l.unscheduled,l.unknown_units,l.blocked,l.utilisation,
 case when l.capacity=0 and l.units>0 then 'full'when l.utilisation>=full_at then 'full'when l.utilisation>=v_busy then 'busy'when l.utilisation is not null and l.unscheduled=0 then 'available'else 'unknown'end workload,
 case when exists(select 1 from blocks a where a.manufacturer_id=f.id and a.status='approved')then 'unavailable'when f.workdays is null then 'unknown'else 'working'end availability,
 (select count(*)from facts o where o.manufacturer_id=f.id)active_orders,
 (select count(*)from facts o where o.manufacturer_id=f.id and o.due_on between p_start and p_end)deadlines
 from factories f join load l on l.id=f.id),
 selected as materialized(select distinct id from summary where(p_availability='all'or availability=p_availability)and(p_workload='all'or workload=p_workload)),
 visible_orders as materialized(select o.*,
 exists(select 1 from public.manufacturer_availability a where a.manufacturer_id=o.manufacturer_id and a.status='approved'and(o.due_on between a.starts_on and a.ends_on or(o.starts_on is not null and o.due_on is not null and daterange(o.starts_on,greatest(o.starts_on,o.due_on),'[]')&&daterange(a.starts_on,a.ends_on,'[]'))))or coalesce(length(btrim(o.delay_reason))>0,false)or o.due_on<current_date as at_risk
 from facts o join selected s on s.id=o.manufacturer_id where o.due_on is null or(o.due_on<current_date and o.effort_active)or o.due_on between p_start and p_end or(o.starts_on is not null and o.due_on is not null and daterange(o.starts_on,greatest(o.starts_on,o.due_on),'[]')&&daterange(p_start,p_end,'[]'))),
 daily as materialized(select d::date date_key,f.id,f.garments,f.capacity baseline_capacity,l.utilisation,
 (exists(select 1 from blocks a where a.manufacturer_id=f.id and a.status='approved'and d::date between a.starts_on and a.ends_on)or(f.workdays is not null and not(extract(isodow from d)::integer=any(f.workdays))))unavailable,
 (f.workdays is null)unknown_schedule,l.capacity,l.units,
 (exists(select 1 from blocks a where a.manufacturer_id=f.id and a.status='approved'and d::date between a.starts_on and a.ends_on))closure,
 (l.utilisation>=v_busy)busy,(l.utilisation>=full_at or(l.capacity=0 and l.units>0))fully_booked
 from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day')d cross join factories f join selected s on s.id=f.id join load l on l.id=f.id and l.month_start=date_trunc('month',d)::date),
 days as(select date_key,count(*)total,count(*)filter(where unavailable)unavailable,count(*)filter(where not unavailable and not unknown_schedule)working,count(*)filter(where unknown_schedule and not unavailable)unknown,
 count(*)filter(where busy)busy,count(*)filter(where fully_booked)fully_booked,
 case when count(*)filter(where capacity is null)=0 and sum(capacity)>0 then round(100*sum(units)/sum(capacity),1)end utilisation
 from daily group by date_key),
 category_days as(select distinct d.date_key,d.id,public.calendar_garment_key(g)garment,d.closure,d.baseline_capacity from daily d cross join lateral unnest(garments)g),
 categories as(select date_key,garment,count(*)total,count(*)filter(where closure)unavailable,
 case when count(*)filter(where baseline_capacity<=0)=0 and sum(baseline_capacity)>0 then round(100*coalesce(sum(baseline_capacity)filter(where closure),0)/sum(baseline_capacity),1)end capacity_loss
 from category_days group by date_key,garment),
 risks as(select *,case when unavailable=total or capacity_loss>=critical then 'critical'else 'warning'end level from categories where unavailable>0 and(100.0*unavailable/total>=warning or capacity_loss>=warning))
 select jsonb_build_object('start',p_start,'end',p_end,'thresholds',thresholds,
 'factories',coalesce((select jsonb_agg(to_jsonb(s)order by s.name,s.month_start)from summary s join selected x on x.id=s.id),'[]'),
 'filterOptions',jsonb_build_object('factories',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',m.factory_name)order by m.factory_name)from public.manufacturer_profiles m where(p_admin and m.onboarding_complete and m.status is distinct from 'paused')or m.user_id=auth.uid()),'[]'),'garments',coalesce((select jsonb_agg(g)from(select distinct unnest(m.garments)g from public.manufacturer_profiles m where p_admin or m.user_id=auth.uid())z),'[]'),'countries',coalesce((select jsonb_agg(c)from(select distinct country c from public.manufacturer_profiles m where p_admin or m.user_id=auth.uid())z),'[]')),
 'stats',jsonb_build_object('active',(select count(*)from facts o join selected x on x.id=o.manufacturer_id),'deadlines',(select count(*)from visible_orders where due_on between p_start and p_end),'upcoming',(select count(*)from visible_orders where due_on between current_date and p_end),'atRisk',(select count(*)from visible_orders where at_risk),'unscheduled',(select count(*)from visible_orders where due_on is null)),
 'orders',coalesce((select jsonb_agg(to_jsonb(o)order by o.due_on nulls last,o.id)from(select *from visible_orders order by due_on nulls last,id limit 300)o),'[]'),'orderCount',(select count(*)from visible_orders),
 'blocks',coalesce((select jsonb_agg((to_jsonb(a)-'history'-'feedback'-'reviewed_by')||jsonb_build_object('conflicts',coalesce((select jsonb_agg(o.id)from visible_orders o where o.manufacturer_id=a.manufacturer_id and(o.due_on between a.starts_on and a.ends_on or(o.starts_on is not null and o.due_on is not null and daterange(o.starts_on,greatest(o.starts_on,o.due_on),'[]')&&daterange(a.starts_on,a.ends_on,'[]')))),'[]'))order by a.starts_on)from blocks a join selected x on x.id=a.manufacturer_id),'[]'),
 'days',coalesce((select jsonb_agg(to_jsonb(d)||jsonb_build_object('production',(select count(*)from visible_orders o where o.due_on=d.date_key or(o.starts_on is not null and o.due_on is not null and d.date_key between o.starts_on and o.due_on)),'deadlines',(select count(*)from visible_orders o where o.due_on=d.date_key))order by date_key)from days d),'[]'),
 'risks',coalesce((select jsonb_agg(to_jsonb(r)order by date_key,garment)from risks r),'[]'))into result;
 return result;
end $$;
revoke all on function public.production_calendar(date,date,boolean,uuid,text,text,text,text,text)from public,anon;
grant execute on function public.production_calendar(date,date,boolean,uuid,text,text,text,text,text)to authenticated;
create or replace function public.manufacturer_calendar_signals()returns jsonb language plpgsql stable security definer set search_path=public as $$declare report jsonb;result jsonb;begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 report:=public.production_calendar(date_trunc('month',current_date)::date,(date_trunc('month',current_date)+interval '1 month'-interval '1 day')::date,true);
 select coalesce(jsonb_agg(jsonb_build_object('id',f->>'id','scheduleKnown',f->'workdays'<>'null'::jsonb,'workload',f->>'workload','utilisation',f->'utilisation','unscheduled',f->'unscheduled','closures',coalesce((select jsonb_agg(jsonb_build_object('start',a.starts_on,'end',a.ends_on)order by a.starts_on)from public.manufacturer_availability a where a.manufacturer_id=(f->>'id')::uuid and a.status='approved'and a.ends_on>=current_date and a.starts_on<=current_date+365),'[]'))),'[]')into result from jsonb_array_elements(report->'factories')f;
 return result;end $$;
revoke all on function public.manufacturer_calendar_signals()from public,anon;
grant execute on function public.manufacturer_calendar_signals()to authenticated;
notify pgrst,'reload schema';
commit;



-- Manufacturer organisation teams (20261025020000)
begin;
-- The stable organisation key remains manufacturer_profiles.user_id.
create table if not exists public.manufacturer_team_members(
 id uuid primary key default gen_random_uuid(), manufacturer_id uuid not null references public.manufacturer_profiles(user_id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade, role text not null check(role in('owner','admin','production','sales','staff')),
 permissions text[], joined_at timestamptz not null default now(), last_active_at timestamptz, removed_at timestamptz, revision integer not null default 1,
 unique(manufacturer_id,user_id));
create index if not exists team_members_user_idx on public.manufacturer_team_members(user_id,manufacturer_id)where removed_at is null;
create table if not exists public.manufacturer_team_invitations(
 id uuid primary key default gen_random_uuid(),manufacturer_id uuid not null references public.manufacturer_profiles(user_id)on delete cascade,
 email text not null, role text not null check(role in('admin','production','sales','staff')),token_hash text not null unique,
 invited_by uuid references public.profiles(id)on delete set null,created_at timestamptz not null default now(),expires_at timestamptz not null,
 accepted_at timestamptz,accepted_by uuid references public.profiles(id)on delete set null,revoked_at timestamptz,
 delivery_status text not null default 'link_created' check(delivery_status in('link_created','sent','failed')),delivery_error text,
 revision integer not null default 1);
create index if not exists team_invites_factory_idx on public.manufacturer_team_invitations(manufacturer_id,created_at desc);
create unique index if not exists team_invites_pending_idx on public.manufacturer_team_invitations(manufacturer_id,lower(email))where accepted_at is null and revoked_at is null;
create table if not exists public.manufacturer_team_contexts(user_id uuid primary key references public.profiles(id)on delete cascade,manufacturer_id uuid references public.manufacturer_profiles(user_id)on delete cascade);
create table if not exists public.manufacturer_team_audit(id uuid primary key default gen_random_uuid(),manufacturer_id uuid not null references public.manufacturer_profiles(user_id)on delete cascade,actor_id uuid references public.profiles(id)on delete set null,action text not null,subject_id uuid,details jsonb not null default '{}',created_at timestamptz not null default now());
create index if not exists team_audit_factory_idx on public.manufacturer_team_audit(manufacturer_id,created_at desc);
create table if not exists public.manufacturer_team_order_assignments(manufacturer_id uuid not null references public.manufacturer_profiles(user_id)on delete cascade,user_id uuid not null references public.profiles(id)on delete cascade,order_id uuid not null references public.orders(id)on delete cascade,assigned_by uuid references public.profiles(id)on delete set null,created_at timestamptz not null default now(),primary key(manufacturer_id,user_id,order_id),foreign key(manufacturer_id,user_id)references public.manufacturer_team_members(manufacturer_id,user_id)on delete cascade);
create index if not exists team_order_assignment_order_idx on public.manufacturer_team_order_assignments(order_id,user_id);
insert into public.manufacturer_team_members(manufacturer_id,user_id,role)select user_id,user_id,'owner'from public.manufacturer_profiles on conflict do nothing;
create or replace function public.team_seed_owner()returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.manufacturer_team_members(manufacturer_id,user_id,role)values(new.user_id,new.user_id,'owner')on conflict do nothing;return new;end$$;
revoke all on function public.team_seed_owner()from public,anon,authenticated;
drop trigger if exists team_seed_owner on public.manufacturer_profiles;
create trigger team_seed_owner after insert on public.manufacturer_profiles for each row execute function public.team_seed_owner();
create or replace function public.team_actor()returns uuid language sql stable set search_path=public as $$select coalesce(nullif(current_setting('app.team_actor',true),'')::uuid,auth.uid())$$;
revoke all on function public.team_actor()from public,anon,authenticated;
create or replace function public.factory_role_permissions(p_role text)returns text[]language sql immutable set search_path=public as $$select case p_role
 when 'owner'then array['view_orders','view_financial','quote','production','qc','shipping','calendar','inventory','customers','analytics','team','settings','portfolio','verification','messages']
 when 'admin'then array['view_orders','view_financial','quote','production','qc','shipping','calendar','inventory','customers','analytics','team','portfolio','verification','messages']
 when 'production'then array['view_orders','production','qc','shipping','calendar','inventory','messages']
 when 'sales'then array['view_orders','view_financial','quote','customers','messages']
 when 'staff'then array['view_orders','production']else '{}'::text[]end$$;
revoke all on function public.factory_role_permissions(text)from public,anon;grant execute on function public.factory_role_permissions(text)to authenticated;
create or replace function public.factory_has_permission(p_factory uuid,p_permission text)returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from manufacturer_team_members where manufacturer_id=p_factory and user_id=public.team_actor()and removed_at is null and p_permission=any(case when role='owner'then public.factory_role_permissions('owner')else coalesce(permissions,public.factory_role_permissions(role))end))$$;
revoke all on function public.factory_has_permission(uuid,text)from public,anon;grant execute on function public.factory_has_permission(uuid,text)to authenticated;
create or replace function public.current_factory_id()returns uuid language sql stable security definer set search_path=public as $$with requested as(select nullif(lower(btrim(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-ceriga-factory')),'')id),chosen as(select coalesce((select id from requested),(select manufacturer_id::text from manufacturer_team_contexts where user_id=public.team_actor()),(select manufacturer_id::text from manufacturer_team_members where user_id=public.team_actor()and removed_at is null order by(manufacturer_id=user_id)desc,joined_at,manufacturer_id limit 1))id)select m.manufacturer_id from manufacturer_team_members m,chosen c where m.manufacturer_id::text=c.id and m.user_id=public.team_actor()and m.removed_at is null$$;
revoke all on function public.current_factory_id()from public,anon;grant execute on function public.current_factory_id()to authenticated;
create or replace function public.factory_order_visible(p_order uuid)returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from orders o join manufacturer_team_members m on m.manufacturer_id=o.assigned_manufacturer_id where o.id=p_order and m.manufacturer_id=public.current_factory_id()and m.user_id=public.team_actor()and m.removed_at is null and public.factory_has_permission(m.manufacturer_id,'view_orders')and(m.role<>'staff'or exists(select 1 from manufacturer_team_order_assignments a where a.manufacturer_id=m.manufacturer_id and a.user_id=m.user_id and a.order_id=o.id)))$$;
revoke all on function public.factory_order_visible(uuid)from public,anon;grant execute on function public.factory_order_visible(uuid)to authenticated;
create or replace function public.factory_team_context()returns jsonb language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();result jsonb;begin
 if auth.uid()is null then raise exception 'Sign in required';end if;
 update manufacturer_team_members set last_active_at=now()where user_id=auth.uid()and manufacturer_id=f and(last_active_at is null or last_active_at<now()-interval '5 minutes');
 select jsonb_build_object('factoryId',f,'role',m.role,'permissions',case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end,'organisations',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'name',p.factory_name))from manufacturer_team_members a join manufacturer_profiles p on p.user_id=a.manufacturer_id where a.user_id=auth.uid()and a.removed_at is null),'[]'))into result from manufacturer_team_members m where m.manufacturer_id=f and m.user_id=auth.uid()and m.removed_at is null;
 return coalesce(result,jsonb_build_object('factoryId',null,'permissions','[]'::jsonb,'hadMembership',exists(select 1 from manufacturer_team_members where user_id=auth.uid()),'organisations',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'name',p.factory_name))from manufacturer_team_members a join manufacturer_profiles p on p.user_id=a.manufacturer_id where a.user_id=auth.uid()and a.removed_at is null),'[]'::jsonb)));end$$;
create or replace function public.switch_factory_organisation(p_factory uuid)returns uuid language plpgsql security definer set search_path=public as $$begin
 if not exists(select 1 from manufacturer_team_members where user_id=auth.uid()and manufacturer_id=p_factory and removed_at is null)then raise exception 'Organisation access denied';end if;
 insert into manufacturer_team_contexts(user_id,manufacturer_id)values(auth.uid(),p_factory)on conflict(user_id)do update set manufacturer_id=excluded.manufacturer_id;return p_factory;end$$;
create or replace function public.factory_team_list()returns jsonb language plpgsql stable security definer set search_path=public as $$declare f uuid:=public.current_factory_id();begin
 if not public.factory_has_permission(f,'team')then raise exception 'Manage team permission required';end if;
 return jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('email',p.email,'name',p.full_name)order by m.joined_at)from manufacturer_team_members m join profiles p on p.id=m.user_id where m.manufacturer_id=f and m.removed_at is null),'[]'),
 'invitations',coalesce((select jsonb_agg((to_jsonb(i)-'token_hash')||jsonb_build_object('status',case when accepted_at is not null then 'Accepted'when revoked_at is not null then 'Revoked'when expires_at<=now()then 'Expired'else 'Pending'end)order by created_at desc)from(select *from manufacturer_team_invitations where manufacturer_id=f order by created_at desc limit 200)i),'[]'),
 'audit',coalesce((select jsonb_agg(to_jsonb(a))from(select *from manufacturer_team_audit where manufacturer_id=f order by created_at desc limit 30)a),'[]'),
 'orders',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',product_name))from(select id,product_name from orders where assigned_manufacturer_id=f and status not in('completed','cancelled')order by created_at desc limit 200)o),'[]'),
 'assignments',coalesce((select jsonb_agg(to_jsonb(a))from manufacturer_team_order_assignments a where manufacturer_id=f),'[]'));end$$;
create or replace function public.factory_team_invite(p_email text,p_role text,p_resend uuid default null)returns jsonb language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();m manufacturer_team_members%rowtype;i manufacturer_team_invitations%rowtype;token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');address text:=lower(btrim(p_email));begin
 perform 1 from manufacturer_profiles where user_id=f for update;
 select *into m from manufacturer_team_members where manufacturer_id=f and user_id=auth.uid()and removed_at is null;
 if not public.factory_has_permission(f,'team')or not(public.factory_role_permissions(p_role)<@case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end)then raise exception 'You cannot grant permissions you do not possess';end if;
 if p_role not in('admin','production','sales','staff')or address!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'or length(address)>254 then raise exception 'Enter a valid email and role';end if;
 if exists(select 1 from manufacturer_team_members t join profiles p on p.id=t.user_id where t.manufacturer_id=f and t.removed_at is null and lower(p.email)=address)then raise exception 'This user is already a team member';end if;
 if(select count(*)from manufacturer_team_audit where manufacturer_id=f and action in('invite','resend')and created_at>now()-interval '1 hour')>=30 then raise exception 'Invitation limit reached; try again later';end if;
 if p_resend is not null then
 select *into i from manufacturer_team_invitations where id=p_resend and manufacturer_id=f for update;
 if not found or i.accepted_at is not null or i.revoked_at is not null then raise exception 'Only pending or expired invitations can be resent';end if;
 if i.email<>address or i.role<>p_role then raise exception 'Invitation details changed; refresh first';end if;
 update manufacturer_team_invitations set token_hash=encode(sha256(token::bytea),'hex'),invited_by=auth.uid(),expires_at=now()+interval '7 days',revision=revision+1,delivery_status='link_created',delivery_error=null where id=i.id;
 else
 update manufacturer_team_invitations set revoked_at=now()where manufacturer_id=f and lower(email)=address and accepted_at is null and revoked_at is null and expires_at<=now();
 if exists(select 1 from manufacturer_team_invitations where manufacturer_id=f and lower(email)=address and accepted_at is null and revoked_at is null)then raise exception 'A pending invitation already exists; resend or revoke it';end if;
 insert into manufacturer_team_invitations(manufacturer_id,email,role,token_hash,invited_by,expires_at)values(f,address,p_role,encode(sha256(token::bytea),'hex'),auth.uid(),now()+interval '7 days')returning *into i;
 end if;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id,details)values(f,auth.uid(),case when p_resend is null then 'invite'else 'resend'end,i.id,jsonb_build_object('email',address,'role',p_role));
 return jsonb_build_object('id',i.id,'token',token,'email',address,'factoryName',(select factory_name from manufacturer_profiles where user_id=f),'expiresAt',now()+interval '7 days');end$$;
create or replace function public.accept_factory_invitation(p_token text)returns uuid language plpgsql security definer set search_path=public as $$declare i manufacturer_team_invitations%rowtype;f uuid;verified_email text;begin
 if auth.uid()is null or length(coalesce(p_token,''))<>64 then raise exception 'Sign in to accept a valid invitation';end if;
 select lower(email)into verified_email from auth.users where id=auth.uid()and email_confirmed_at is not null;
 select manufacturer_id into f from manufacturer_team_invitations where token_hash=encode(sha256(p_token::bytea),'hex');
 perform 1 from manufacturer_profiles where user_id=f for update;
 select *into i from manufacturer_team_invitations where token_hash=encode(sha256(p_token::bytea),'hex')for update;
 if not found or i.revoked_at is not null or i.accepted_at is not null or i.expires_at<=now()then raise exception 'Invitation expired, revoked or already used';end if;
 if verified_email is distinct from i.email then raise exception 'Sign in with the verified invited email address';end if;
 -- Recheck the issuer: revoked administrators cannot leave invitations granting elevated access.
 if not exists(select 1 from manufacturer_team_members m where m.manufacturer_id=f and m.user_id=i.invited_by and m.removed_at is null and public.factory_role_permissions(i.role)<@case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end and 'team'=any(case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end))then raise exception 'The inviter no longer has permission to grant this role';end if;
 if exists(select 1 from manufacturer_team_members where manufacturer_id=f and user_id=auth.uid()and removed_at is null)then raise exception 'Already a member of this organisation';end if;
 insert into manufacturer_team_members(manufacturer_id,user_id,role)values(f,auth.uid(),i.role)on conflict(manufacturer_id,user_id)do update set role=excluded.role,permissions=null,removed_at=null,joined_at=now(),revision=manufacturer_team_members.revision+1;
 update manufacturer_team_invitations set accepted_at=now(),accepted_by=auth.uid(),revision=revision+1 where id=i.id;
 insert into manufacturer_team_contexts(user_id,manufacturer_id)values(auth.uid(),f)on conflict(user_id)do update set manufacturer_id=f;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id)values(f,auth.uid(),'accept_invitation',i.id);return f;end$$;
create or replace function public.factory_team_change(p_id uuid,p_revision integer,p_action text,p_role text default null,p_permissions text[] default null)returns uuid language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();actor manufacturer_team_members%rowtype;m manufacturer_team_members%rowtype;allowed text[];begin
 perform 1 from manufacturer_profiles where user_id=f for update;
 select *into actor from manufacturer_team_members where manufacturer_id=f and user_id=auth.uid()and removed_at is null;
 if not public.factory_has_permission(f,'team')then raise exception 'Manage team permission required';end if;
 if p_action='revoke'then
 update manufacturer_team_invitations set revoked_at=now(),revision=revision+1 where id=p_id and manufacturer_id=f and revision=p_revision and accepted_at is null and revoked_at is null;
 if not found then raise exception 'Invitation changed; refresh first';end if;
 else
 select *into m from manufacturer_team_members where id=p_id and manufacturer_id=f and removed_at is null for update;
 if not found or m.revision is distinct from p_revision then raise exception 'Member changed; refresh first';end if;
 if m.role='owner'and actor.role<>'owner'then raise exception 'Only owners can change owner access';end if;
 allowed:=case when actor.role='owner'then public.factory_role_permissions('owner')else coalesce(actor.permissions,public.factory_role_permissions(actor.role))end;
 if not(coalesce(m.permissions,public.factory_role_permissions(m.role))<@allowed)then raise exception 'You cannot manage a member with greater permissions';end if;
 if p_action not in('role','permissions','remove')then raise exception 'Unknown team action';end if;
 if p_action='role'and(p_role is null or p_role not in('owner','admin','production','sales','staff')or(p_role='owner'and actor.role<>'owner')or not(public.factory_role_permissions(p_role)<@allowed))then raise exception 'You cannot grant this role';end if;
 if p_action='permissions'and(m.role='owner'or not(coalesce(p_permissions,public.factory_role_permissions(m.role))<@allowed and coalesce(p_permissions,'{}')<@public.factory_role_permissions('owner'))or(p_permissions is not null and(cardinality(p_permissions)>16 or cardinality(p_permissions)<>(select count(distinct x)from unnest(p_permissions)x))))then raise exception 'Invalid permission override';end if;
 if m.role='owner'and(p_action='remove'or(p_action='role'and p_role<>'owner'))and(select count(*)from manufacturer_team_members where manufacturer_id=f and role='owner'and removed_at is null)<=1 then raise exception 'The last owner cannot be removed or demoted';end if;
 update manufacturer_team_members set role=case when p_action='role'then p_role else role end,permissions=case when p_action='role'then null when p_action='permissions'then p_permissions else permissions end,removed_at=case when p_action='remove'then now()else removed_at end,revision=revision+1 where id=m.id;
 if p_action='remove'then delete from manufacturer_team_order_assignments where manufacturer_id=f and user_id=m.user_id;update manufacturer_team_invitations set revoked_at=now(),revision=revision+1 where manufacturer_id=f and invited_by=m.user_id and accepted_at is null and revoked_at is null;end if;
 end if;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id,details)values(f,auth.uid(),p_action,p_id,jsonb_build_object('role',p_role,'permissions',p_permissions));return p_id;end$$;
create or replace function public.factory_team_assign_order(p_user uuid,p_order uuid,p_enabled boolean)returns uuid language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();begin
 perform 1 from manufacturer_profiles where user_id=f for update;
 if p_enabled is null or not public.factory_has_permission(f,'team')or not exists(select 1 from orders where id=p_order and assigned_manufacturer_id=f)or not exists(select 1 from manufacturer_team_members where manufacturer_id=f and user_id=p_user and removed_at is null)then raise exception 'Invalid team or order assignment';end if;
 if p_enabled then insert into manufacturer_team_order_assignments(manufacturer_id,user_id,order_id,assigned_by)values(f,p_user,p_order,auth.uid())on conflict do nothing;else delete from manufacturer_team_order_assignments where manufacturer_id=f and user_id=p_user and order_id=p_order;end if;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id,details)values(f,auth.uid(),'assign_order',p_user,jsonb_build_object('order',p_order,'enabled',p_enabled));return p_order;end$$;
-- Authorisation adapter reuses the existing validated workflow implementations. The
-- original authenticated actor is retained separately from the factory principal.
create or replace function public.team_enter(p_permission text,p_order uuid default null)returns jsonb language plpgsql security definer set search_path=public as $$declare claims jsonb:=auth.jwt();actor uuid:=public.team_actor();f uuid:=public.current_factory_id();email_value text;begin
 if auth.uid()is null then raise exception 'Sign in required';end if;
 if public.is_superadmin()and nullif(current_setting('app.team_actor',true),'')is null then return claims;end if;
 if f is null and p_permission='settings'and not exists(select 1 from manufacturer_profiles where user_id=actor)and exists(select 1 from profiles where id=actor and role='manufacturer')then f:=actor;
 else
 perform 1 from manufacturer_profiles where user_id=f for share;
 perform 1 from manufacturer_team_members where manufacturer_id=f and user_id=actor and removed_at is null for share;
 if not found or not public.factory_has_permission(f,p_permission)then raise exception 'Permission denied: %',p_permission;end if;
 end if;
 if p_order is not null and not public.factory_order_visible(p_order)then raise exception 'Order access denied';end if;
 select email into email_value from auth.users where id=f;
 perform set_config('app.team_actor',actor::text,true);
 perform set_config('request.jwt.claims',(claims||jsonb_build_object('sub',f,'email',email_value))::text,true);
 return claims;end$$;
revoke all on function public.team_enter(text,uuid)from public,anon,authenticated;
-- Controlled wrappers retain existing API signatures, defaults and validations.
do $wrap$declare spec record;p record;signature text;arguments text;names text;result_type text;gate text;after_call text;definition text;legacy text;
begin
 for spec in select *from(values
 ('submit_manufacturer_quote','quote','p_order_id'),('reject_order_quotation','quote','p_order_id'),
 ('update_order_production','production','p_order'),('qc_action','qc','p_order'),('qc_report_context','view_orders','p_order'),
 ('portal_dashboard','view_orders',null),('portal_report','analytics',null),('production_calendar','calendar',null),
 ('save_calendar_schedule','calendar',null),('save_calendar_availability','calendar',null),('request_factory_availability','calendar',null),('withdraw_factory_availability','calendar',null),
 ('dismiss_portal_notifications','view_orders',null),('save_manufacturer_profile','settings',null),('save_portfolio_item','portfolio',null),('remove_portfolio_item','portfolio',null),('submit_factory_verification','verification',null)
 )s(name,permission,order_arg)loop
 select pg.*into p from pg_proc pg join pg_namespace n on n.oid=pg.pronamespace where n.nspname='public'and pg.proname=spec.name;
 if not found then raise exception 'Missing existing API: %',spec.name;end if;
 signature:=pg_get_function_identity_arguments(p.oid);arguments:=pg_get_function_arguments(p.oid);result_type:=pg_get_function_result(p.oid);names:=array_to_string(p.proargnames,',');legacy:='team_impl_'||spec.name;
 if not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname=legacy)then
 execute format('alter function public.%I(%s)rename to %I',spec.name,signature,legacy);
 end if;
 execute format('revoke all on function public.%I(%s)from public,anon,authenticated',legacy,signature);
 gate:=format('claims:=public.team_enter(%L,%s);',spec.permission,coalesce(spec.order_arg,'null'));
 if spec.name='qc_action'then gate:='if p_action in(''approve_report'',''request_report_changes'')then if not public.is_superadmin()or nullif(current_setting(''app.team_actor'',true),'''')is not null then raise exception ''Superadmin review required'';end if;end if;claims:=public.team_enter(case when p_action=''dispatch''then ''shipping''else ''qc''end,p_order);';end if;
 if spec.name in('portal_dashboard','production_calendar')then gate:='if p_admin then if not public.is_superadmin()or nullif(current_setting(''app.team_actor'',true),'''')is not null then raise exception ''Superadmin access required'';end if;claims:=auth.jwt();else '||gate||'end if;';end if;
 after_call:='';
 if spec.name='update_order_production'then after_call:='update public.order_production_updates set submitted_by=actor where id=result;';end if;
 if spec.name='qc_action'then after_call:='if not public.is_superadmin()then update public.qc_inspections set inspector_id=actor where id=result and manufacturer_id=public.current_factory_id();update public.qc_evidence set uploaded_by=actor where id=result;update public.qc_audit_events set actor_id=actor where order_id=p_order and created_at=now()and actor_id=public.current_factory_id();end if;';end if;
 if spec.name='qc_report_context'then after_call:='result:=result||jsonb_build_object(''can_submit'',coalesce((result->>''can_submit'')::boolean,false)and public.factory_has_permission(public.current_factory_id(),''qc''));';end if;
 if spec.name not in('portal_dashboard','portal_report','production_calendar','qc_report_context')then after_call:=after_call||format('insert into public.manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id)select public.current_factory_id(),actor,%L,%s where public.current_factory_id()is not null;',spec.name,coalesce(spec.order_arg,'null'));end if;
 definition:=format('create or replace function public.%I(%s)returns %s language plpgsql security definer set search_path=public as $body$declare claims jsonb;outer_actor text:=current_setting(''app.team_actor'',true);actor uuid:=public.team_actor();result %s;begin %s result:=public.%I(%s);%s perform set_config(''request.jwt.claims'',claims::text,true);perform set_config(''app.team_actor'',coalesce(outer_actor,''''),true);return result;end$body$',spec.name,arguments,result_type,result_type,gate,legacy,names,after_call);
 definition:=regexp_replace(definition,'\mresult\M','v_result','g');execute definition;
 execute format('revoke all on function public.%I(%s)from public,anon;grant execute on function public.%I(%s)to authenticated',spec.name,signature,spec.name,signature);
 end loop;
 -- Dashboard queries must scope every count, task and activity to authorised orders.
 select pg_get_functiondef('public.team_impl_portal_dashboard(boolean,integer,text,text,text)'::regprocedure)into definition;
 definition:=replace(definition,'not p_admin and assigned_manufacturer_id=uid)','not p_admin and assigned_manufacturer_id=uid and public.factory_order_visible(id))');execute definition;
end$wrap$;
-- Secure read projections use the real account actor, never raw factory credentials.
create or replace function public.account_order_projection(p_order public.orders)returns public.orders language plpgsql stable security definer set search_path=public as $$declare result public.orders%rowtype;factory boolean;begin
 if auth.uid()is null then raise exception 'Sign in to view orders';end if;
 if not(public.is_superadmin()or p_order.user_id=auth.uid()or public.factory_order_visible(p_order.id))then raise exception 'Order access denied';end if;
 result:=p_order;if public.is_superadmin()then return result;end if;
 factory:=public.factory_order_visible(p_order.id)and p_order.user_id<>auth.uid();result.ops_notes:=null;
 result.price_options:=public.public_price_options(p_order.price_options,coalesce(factory,false));
 if factory then result.paid_amount_cents:=null;result.total:=null;result.paid_currency:=null;result.total_currency:=null;
 if not public.factory_has_permission(p_order.assigned_manufacturer_id,'view_financial')then result.manufacturer_quote:=null;select jsonb_agg(jsonb_build_object('id',x->'id','kind',x->'kind','label',x->'label','totalUnits',x->'totalUnits','leadTimeDays',x->'leadTimeDays'))into result.price_options from jsonb_array_elements(coalesce(p_order.price_options,'[]'))x;end if;
 if not(public.factory_has_permission(p_order.assigned_manufacturer_id,'customers')or public.factory_has_permission(p_order.assigned_manufacturer_id,'shipping'))then result.contact_email:=null;result.contact_phone:=null;result.delivery_address:=null;end if;
 else result.manufacturer_quote:=null;result.factory_reject_reason:=null;end if;return result;end$$;
create or replace view public.account_orders with(security_barrier=true)as select projected.*from public.orders o cross join lateral public.account_order_projection(o)projected where auth.uid()is not null and(public.is_superadmin()or o.user_id=auth.uid()or public.factory_order_visible(o.id));
create or replace function public.qc_can_access(p_order uuid)returns boolean language sql stable security definer set search_path=public as $$select auth.uid()is not null and exists(select 1 from orders where id=p_order and(public.is_superadmin()or user_id=auth.uid()or public.factory_order_visible(id)))$$;
create or replace function public.factory_workspace_profile()returns jsonb language plpgsql stable security definer set search_path=public as $$declare f uuid:=public.current_factory_id();result jsonb;begin
 if f is null then return null;end if;
 select to_jsonb(m)into result from manufacturer_profiles m where user_id=f;
 if not public.factory_has_permission(f,'settings')then result:=result-array['internal_notes','messaging_team_emails','commission_plan_id'];result:=jsonb_set(result,'{profile_details}',coalesce(result->'profile_details','{}')-array['internalNotes','contactEmail','contactPhone','pricing']);end if;
 if not public.factory_has_permission(f,'view_financial')then result:=result-'pricing';end if;return result;end$$;
-- Raw table writes remain unavailable for team records: management is via locked RPCs.
do $$declare t text;definition text;begin
 select pg_get_functiondef('public.apply_superadmin_access()'::regprocedure)into definition;
 definition:=replace(definition,'''projects''','''manufacturer_team_members'',''manufacturer_team_invitations'',''manufacturer_team_contexts'',''manufacturer_team_audit'',''manufacturer_team_order_assignments'',''projects''');execute definition;perform public.apply_superadmin_access();
 foreach t in array array['manufacturer_team_members','manufacturer_team_invitations','manufacturer_team_contexts','manufacturer_team_audit','manufacturer_team_order_assignments']loop
 execute format('drop policy if exists team_management_read on public.%I',t);
 if t not in('manufacturer_team_contexts','manufacturer_team_invitations')then execute format('create policy team_management_read on public.%I for select to authenticated using(manufacturer_id=public.current_factory_id()and public.factory_has_permission(manufacturer_id,''team''))',t);end if;
 end loop;
end$$;
-- Only allowlisted superadmins read raw invitation records. Organisation managers use the token-free list RPC.
grant select on public.manufacturer_team_invitations to authenticated;
-- Existing owners retain profile editing; removed or demoted owners cannot use legacy table routes.
drop policy if exists team_profile_restriction on public.manufacturer_profiles;
create policy team_profile_restriction on public.manufacturer_profiles as restrictive for all to authenticated using(public.is_superadmin()or public.factory_has_permission(user_id,'settings'))with check(public.is_superadmin()or public.factory_has_permission(user_id,'settings')or(user_id=auth.uid()and not exists(select 1 from public.manufacturer_team_members where manufacturer_id=user_id)));
drop policy if exists team_materials on public.factory_materials;
create policy team_materials on public.factory_materials for all to authenticated using(user_id=public.current_factory_id()and public.factory_has_permission(user_id,'inventory'))with check(user_id=public.current_factory_id()and public.factory_has_permission(user_id,'inventory'));
drop policy if exists team_materials_restriction on public.factory_materials;
create policy team_materials_restriction on public.factory_materials as restrictive for all to authenticated using(public.is_superadmin()or public.factory_has_permission(user_id,'inventory'))with check(public.is_superadmin()or public.factory_has_permission(user_id,'inventory'));
drop policy if exists team_assets_upload on storage.objects;
create policy team_assets_upload on storage.objects for insert to authenticated with check(bucket_id='manufacturer-assets'and split_part(name,'/',1)=public.current_factory_id()::text and(public.factory_has_permission(public.current_factory_id(),'portfolio')or public.factory_has_permission(public.current_factory_id(),'verification')));
drop policy if exists team_assets_read on storage.objects;
create policy team_assets_read on storage.objects for select to authenticated using(bucket_id='manufacturer-assets'and split_part(name,'/',1)=public.current_factory_id()::text and(public.factory_has_permission(public.current_factory_id(),'portfolio')or public.factory_has_permission(public.current_factory_id(),'verification')));
-- QC upload paths use the factory namespace; backend wrappers retain the actual uploader.
drop policy if exists team_qc_upload on storage.objects;
create policy team_qc_upload on storage.objects for insert to authenticated with check(bucket_id='qc-evidence'and split_part(name,'/',2)=public.current_factory_id()::text and public.factory_has_permission(public.current_factory_id(),'qc')and exists(select 1 from public.account_orders o where o.id::text=split_part(name,'/',1)and o.assigned_manufacturer_id=public.current_factory_id()and o.status='processing'));
drop policy if exists team_order_files_read on storage.objects;
create policy team_order_files_read on storage.objects for select to authenticated using(bucket_id='order-uploads'and exists(select 1 from public.account_orders o where o.id::text=split_part(name,'/',2)and o.assigned_manufacturer_id=public.current_factory_id()));
-- Team member reads remain capability-specific, and account/order RLS still applies.
drop policy if exists team_portfolio_read on public.manufacturer_portfolio_items;
create policy team_portfolio_read on public.manufacturer_portfolio_items for select to authenticated using(manufacturer_id=public.current_factory_id()and public.factory_has_permission(manufacturer_id,'portfolio'));
drop policy if exists team_verification_read on public.manufacturer_verification_submissions;
create policy team_verification_read on public.manufacturer_verification_submissions for select to authenticated using(manufacturer_id=public.current_factory_id()and public.factory_has_permission(manufacturer_id,'verification'));
drop policy if exists team_availability_read on public.manufacturer_availability;
create policy team_availability_read on public.manufacturer_availability for select to authenticated using(manufacturer_id=public.current_factory_id()and public.factory_has_permission(manufacturer_id,'calendar'));
-- Lock down the former email-only messaging grant; existing entries are preserved,
-- but new operational membership must be accepted through the invitation workflow.
create or replace function public.set_messaging_teammate(p_email text,p_enabled boolean)returns void language plpgsql security definer set search_path=public as $$begin raise exception 'Manage team membership through Team & roles invitations';end$$;
do $$declare p record;begin for p in select oid,proname from pg_proc where pronamespace='public'::regnamespace and proname in('factory_team_context','switch_factory_organisation','factory_team_list','factory_team_invite','accept_factory_invitation','factory_team_change','factory_team_assign_order','factory_workspace_profile')loop execute format('revoke all on function %s from public,anon;grant execute on function %s to authenticated',p.oid::regprocedure,p.oid::regprocedure);end loop;end$$;
create or replace function public.record_team_invite_delivery(p_id uuid,p_status text,p_error text default null)returns uuid language plpgsql security definer set search_path=public as $$begin if p_status not in('sent','failed')then raise exception 'Invalid delivery status';end if;update manufacturer_team_invitations set delivery_status=p_status,delivery_error=left(p_error,500)where id=p_id;if not found then raise exception 'Invitation not found';end if;return p_id;end$$;
revoke all on function public.record_team_invite_delivery(uuid,text,text)from public,anon,authenticated;grant execute on function public.record_team_invite_delivery(uuid,text,text)to service_role;
create or replace function public.chat_factory_ids()returns setof uuid language sql stable security definer set search_path=public as $$select public.current_factory_id()where public.factory_has_permission(public.current_factory_id(),'messages')$$;
-- Guards also cover old direct table endpoints for the factory's original account.
do $$begin if to_regclass('public.factory_capacity_blocks')is not null then drop policy if exists team_capacity_restriction on public.factory_capacity_blocks;
create policy team_capacity_restriction on public.factory_capacity_blocks as restrictive for all to authenticated using(public.is_superadmin()or public.factory_has_permission(user_id,'calendar'))with check(public.is_superadmin()or public.factory_has_permission(user_id,'calendar')); end if;end$$;
drop policy if exists team_customisation_restriction on public.manufacturer_customisation_settings;
create policy team_customisation_restriction on public.manufacturer_customisation_settings as restrictive for all to authenticated using(public.is_superadmin()or public.factory_has_permission(user_id,'settings'))with check(public.is_superadmin()or public.factory_has_permission(user_id,'settings'));


create or replace function public.patch_factory_workspace(p_patch jsonb)returns uuid language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();m manufacturer_profiles%rowtype;begin
 perform 1 from manufacturer_profiles where user_id=f for update;
 if not public.factory_has_permission(f,'settings')or jsonb_typeof(p_patch)is distinct from 'object'or p_patch-array['factory_name','contact_name','contact_email','contact_phone','website','address_line','typical_lead_days','garments','capabilities','shipping_regions','moq','monthly_capacity','internal_notes','pricing']<>'{}'then raise exception 'Invalid profile permission or fields';end if;
 if p_patch?'pricing'and not public.factory_has_permission(f,'view_financial')then raise exception 'Financial permission required';end if;
 if f<>auth.uid()and jsonb_typeof(p_patch->'pricing')='object'then p_patch:=jsonb_set(p_patch,'{pricing,preferredCurrency}',to_jsonb((select preferred_currency from profiles where id=f)),true);end if;
 select *into m from manufacturer_profiles where user_id=f; m:=jsonb_populate_record(m,p_patch);
 if length(btrim(m.factory_name))not between 1 and 200 or m.moq<=0 or m.monthly_capacity<0 then raise exception 'Invalid factory name, MOQ or capacity';end if;
 update manufacturer_profiles set factory_name=m.factory_name,contact_name=m.contact_name,contact_email=m.contact_email,contact_phone=m.contact_phone,website=m.website,address_line=m.address_line,typical_lead_days=m.typical_lead_days,garments=m.garments,capabilities=m.capabilities,shipping_regions=m.shipping_regions,moq=m.moq,monthly_capacity=m.monthly_capacity,internal_notes=m.internal_notes,pricing=m.pricing where user_id=f;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action)values(f,auth.uid(),'update_factory_settings');return f;end$$;
revoke all on function public.patch_factory_workspace(jsonb)from public,anon;grant execute on function public.patch_factory_workspace(jsonb)to authenticated;
create or replace function public.team_require_owner()returns trigger language plpgsql security definer set search_path=public as $$declare f uuid:=coalesce(new.manufacturer_id,old.manufacturer_id);begin
 if tg_op='UPDATE'and(new.role,new.removed_at)is not distinct from(old.role,old.removed_at)then return null;end if;
 perform 1 from manufacturer_profiles where user_id=f for update;
 if exists(select 1 from manufacturer_profiles where user_id=f)and not exists(select 1 from manufacturer_team_members where manufacturer_id=f and role='owner'and removed_at is null)then raise exception 'Every factory must retain an active owner';end if;return null;end$$;
revoke all on function public.team_require_owner()from public,anon,authenticated;
drop trigger if exists team_require_owner on manufacturer_team_members;
create constraint trigger team_require_owner after insert or update or delete on manufacturer_team_members deferrable initially deferred for each row execute function public.team_require_owner();
drop policy if exists team_orders_restriction on public.orders;
create policy team_orders_restriction on public.orders as restrictive for select to authenticated using(public.is_superadmin()or user_id=auth.uid()or public.factory_order_visible(id));
drop policy if exists team_assets_restriction on storage.objects;
create policy team_assets_restriction on storage.objects as restrictive for all to authenticated using(bucket_id<>'manufacturer-assets'or public.is_superadmin()or(split_part(name,'/',1)=public.current_factory_id()::text and(public.factory_has_permission(public.current_factory_id(),'portfolio')or public.factory_has_permission(public.current_factory_id(),'verification'))))with check(bucket_id<>'manufacturer-assets'or public.is_superadmin()or(split_part(name,'/',1)=public.current_factory_id()::text and(public.factory_has_permission(public.current_factory_id(),'portfolio')or public.factory_has_permission(public.current_factory_id(),'verification'))));


drop policy if exists team_qc_reports_read on qc_inspections;
create policy team_qc_reports_read on qc_inspections for select to authenticated using(public.factory_order_visible(order_id)and manufacturer_id=public.current_factory_id());
drop policy if exists team_qc_evidence_read on qc_evidence;
create policy team_qc_evidence_read on qc_evidence for select to authenticated using(public.factory_order_visible(order_id)and exists(select 1 from qc_inspections i where i.id=inspection_id and i.manufacturer_id=public.current_factory_id()));
drop policy if exists team_qc_releases_read on qc_shipment_releases;
create policy team_qc_releases_read on qc_shipment_releases for select to authenticated using(public.factory_order_visible(order_id)and exists(select 1 from qc_inspections i where i.id=inspection_id and i.manufacturer_id=public.current_factory_id()));
drop policy if exists team_qc_audit_read on qc_audit_events;
create policy team_qc_audit_read on qc_audit_events for select to authenticated using(public.factory_order_visible(order_id)and details->>'manufacturer_id'=public.current_factory_id()::text);


create or replace function public.factory_operational_settings()returns jsonb language plpgsql stable security definer set search_path=public as $$declare f uuid:=public.current_factory_id();s jsonb;begin
 if f is null and exists(select 1 from profiles where id=auth.uid()and role='manufacturer')and not exists(select 1 from manufacturer_team_members where user_id=auth.uid())then return null;end if;
 if not public.factory_has_permission(f,'view_orders')then raise exception 'Factory access required';end if;
 select settings into s from manufacturer_customisation_settings where user_id=f;
 return s-array['factoryProfile','pricing','internalNotes'];end$$;
revoke all on function public.factory_operational_settings()from public,anon;grant execute on function public.factory_operational_settings()to authenticated;


create or replace function public.save_factory_operational_settings(p_settings jsonb)returns uuid language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();begin
 perform 1 from manufacturer_profiles where user_id=f for update;
 if not public.factory_has_permission(f,'settings')or jsonb_typeof(p_settings)is distinct from 'object'or octet_length(p_settings::text)>500000 then raise exception 'Factory settings permission required';end if;
 insert into manufacturer_customisation_settings(user_id,settings)values(f,p_settings)on conflict(user_id)do update set settings=excluded.settings,updated_at=now();
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action)values(f,auth.uid(),'update_capability_settings');return f;end$$;
revoke all on function public.save_factory_operational_settings(jsonb)from public,anon;grant execute on function public.save_factory_operational_settings(jsonb)to authenticated;
drop policy if exists team_notifications_read on public.portal_notifications;
create policy team_notifications_read on public.portal_notifications for select to authenticated using(audience='manufacturer'and user_id=public.current_factory_id()and public.factory_has_permission(user_id,'view_orders')and(order_id is null or public.factory_order_visible(order_id)));


create or replace function public.save_factory_pricing(p_pricing jsonb)returns uuid language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();begin
 if jsonb_typeof(p_pricing)is distinct from 'object'or octet_length(p_pricing::text)>500000 then raise exception 'Invalid pricing settings';end if;
 if f is null then
 if auth.uid()is null or not exists(select 1 from profiles where id=auth.uid()and role='manufacturer')or exists(select 1 from manufacturer_team_members where user_id=auth.uid())then raise exception 'Factory settings permission required';end if;
 insert into manufacturer_profiles(user_id,factory_name,pricing)values(auth.uid(),'My factory',p_pricing);f:=auth.uid();
 else
 perform 1 from manufacturer_profiles where user_id=f for update;
 if not(public.factory_has_permission(f,'settings')and public.factory_has_permission(f,'view_financial'))then raise exception 'Factory financial settings permission required';end if;
 if f<>auth.uid()then p_pricing:=p_pricing||jsonb_build_object('preferredCurrency',(select preferred_currency from profiles where id=f));end if;
 update manufacturer_profiles set pricing=p_pricing where user_id=f;
 end if;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action)values(f,auth.uid(),'update_factory_pricing');return f;end$$;
revoke all on function public.save_factory_pricing(jsonb)from public,anon;grant execute on function public.save_factory_pricing(jsonb)to authenticated;
drop policy if exists team_notifications_update on public.portal_notifications;
create policy team_notifications_update on public.portal_notifications for update to authenticated using(audience='manufacturer'and user_id=public.current_factory_id()and public.factory_has_permission(user_id,'view_orders')and(order_id is null or public.factory_order_visible(order_id)))with check(audience='manufacturer'and user_id=public.current_factory_id()and public.factory_has_permission(user_id,'view_orders')and(order_id is null or public.factory_order_visible(order_id)));
drop policy if exists team_notifications_scope on public.portal_notifications;
create policy team_notifications_scope on public.portal_notifications as restrictive for select to authenticated using(public.is_superadmin()or(audience='manufacturer'and user_id=public.current_factory_id()and public.factory_has_permission(user_id,'view_orders')and(order_id is null or public.factory_order_visible(order_id))));


-- Delegating a factory principal must never inherit a factory owner's platform-admin identity.
create or replace function public.is_superadmin()returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.superadmin_emails s where lower(s.email)=lower(case when nullif(current_setting('app.team_actor',true),'')is null then coalesce(auth.jwt()->>'email','')else coalesce((select email from auth.users where id=public.team_actor()),'')end));
$$;
revoke all on function public.is_superadmin()from public,anon;grant execute on function public.is_superadmin()to authenticated;
do $$declare definition text;begin
 select pg_get_functiondef('public.team_impl_portal_report(integer)'::regprocedure)into definition;
 definition:=replace(definition,'admin or assigned_manufacturer_id=auth.uid()','admin or (assigned_manufacturer_id=auth.uid()and public.factory_order_visible(id))');execute definition;
 select pg_get_functiondef('public.calendar_order_facts(uuid)'::regprocedure)into definition;
 if position('app.team_actor'in definition)=0 then definition:=replace(definition,'and(p_factory is null or o.assigned_manufacturer_id=p_factory)','and(p_factory is null or o.assigned_manufacturer_id=p_factory)and(nullif(current_setting(''app.team_actor'',true),'''')is null or public.factory_order_visible(o.id))');execute definition;end if;
end$$;


create or replace function public.factory_asset_can_read(p_path text,p_owner uuid)returns boolean language sql stable security definer set search_path=public as $$
 select split_part(p_path,'/',1)=public.current_factory_id()::text and(
 (p_owner=public.team_actor()and(public.factory_has_permission(public.current_factory_id(),'portfolio')or public.factory_has_permission(public.current_factory_id(),'verification'))and not exists(select 1 from manufacturer_portfolio_items where p_path=any(image_paths))and not exists(select 1 from manufacturer_verification_submissions where p_path=any(document_paths)))
 or(public.factory_has_permission(public.current_factory_id(),'portfolio')and exists(select 1 from manufacturer_portfolio_items where manufacturer_id=public.current_factory_id()and p_path=any(image_paths)))
 or(public.factory_has_permission(public.current_factory_id(),'verification')and exists(select 1 from manufacturer_verification_submissions where manufacturer_id=public.current_factory_id()and p_path=any(document_paths))));
$$;
revoke all on function public.factory_asset_can_read(text,uuid)from public,anon;grant execute on function public.factory_asset_can_read(text,uuid)to authenticated;
drop policy if exists team_assets_read on storage.objects;
create policy team_assets_read on storage.objects for select to authenticated using(bucket_id='manufacturer-assets'and public.factory_asset_can_read(name,owner));
drop policy if exists team_assets_restriction on storage.objects;
create policy team_assets_restriction on storage.objects as restrictive for all to authenticated using(bucket_id<>'manufacturer-assets'or public.is_superadmin()or public.factory_asset_can_read(name,owner))with check(bucket_id<>'manufacturer-assets'or public.is_superadmin()or(split_part(name,'/',1)=public.current_factory_id()::text and(public.factory_has_permission(public.current_factory_id(),'portfolio')or public.factory_has_permission(public.current_factory_id(),'verification'))));
drop policy if exists team_qc_staged_read on storage.objects;
create policy team_qc_staged_read on storage.objects for select to authenticated using(bucket_id='qc-evidence'and owner=auth.uid()and split_part(name,'/',2)=public.current_factory_id()::text and public.factory_has_permission(public.current_factory_id(),'qc')and exists(select 1 from public.account_orders where id::text=split_part(name,'/',1)));
drop policy if exists team_qc_cleanup on storage.objects;
create policy team_qc_cleanup on storage.objects for delete to authenticated using(bucket_id='qc-evidence'and owner=auth.uid()and split_part(name,'/',2)=public.current_factory_id()::text and public.factory_has_permission(public.current_factory_id(),'qc')and not exists(select 1 from qc_evidence where path=name));
drop policy if exists team_assets_cleanup on storage.objects;
create policy team_assets_cleanup on storage.objects for delete to authenticated using(bucket_id='manufacturer-assets'and owner=auth.uid()and public.factory_asset_can_read(name,owner)and not exists(select 1 from manufacturer_portfolio_items where name=any(image_paths))and not exists(select 1 from manufacturer_verification_submissions where name=any(document_paths)));


-- New quotations use the authenticated submitter's saved preference; existing
-- quotation currencies remain locked by the original validation routine.
do $$declare definition text;begin
 select pg_get_functiondef('public.team_impl_submit_manufacturer_quote(uuid,jsonb)'::regprocedure)into definition;
 definition:=replace(definition,'select preferred_currency into quote_currency from public.profiles where id=auth.uid();','select preferred_currency into quote_currency from public.profiles where id=public.team_actor();');execute definition;
end$$;


-- Cleanup checks use all historical references, even after an order is reassigned
-- or the uploader loses permission to read a particular document category.
create or replace function public.factory_asset_is_unused(p_bucket text,p_path text)returns boolean language sql stable security definer set search_path=public as $$select case p_bucket when 'qc-evidence'then not exists(select 1 from qc_evidence where path=p_path)when 'manufacturer-assets'then not exists(select 1 from manufacturer_portfolio_items where p_path=any(image_paths))and not exists(select 1 from manufacturer_verification_submissions where p_path=any(document_paths))else false end$$;
revoke all on function public.factory_asset_is_unused(text,text)from public,anon;grant execute on function public.factory_asset_is_unused(text,text)to authenticated;
drop policy if exists team_preserve_referenced_files on storage.objects;
create policy team_preserve_referenced_files on storage.objects as restrictive for delete to authenticated using(bucket_id not in('qc-evidence','manufacturer-assets')or public.is_superadmin()or public.factory_asset_is_unused(bucket_id,name));


-- Only offer dashboard actions the current teammate is allowed to complete.
do $$declare definition text;begin
 select pg_get_functiondef('public.team_impl_portal_dashboard(boolean,integer,text,text,text)'::regprocedure)into definition;
 if position('public.factory_has_permission(uid,case when task'in definition)=0 then
 definition:=replace(definition,'from classified where task is not null','from classified where task is not null and(p_admin or public.factory_has_permission(uid,case when task in(''quote'',''revise_quote'')then ''quote''when task in(''submit_qc'',''revise_qc'')then ''qc''when task=''dispatch''then ''shipping''when task in(''production_update'',''delay'')then ''production''else ''view_orders''end))');execute definition;
 end if;
end$$;

notify pgrst,'reload schema';
commit;

-- Named manufacturer staff roles (20261026010000)
begin;
create table if not exists public.manufacturer_team_roles (
 id text primary key default ('custom_'||gen_random_uuid()::text),
 manufacturer_id uuid not null references public.manufacturer_profiles(user_id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 60),
 permissions text[] not null default '{}', revision integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 created_by uuid references public.profiles(id) on delete set null,
 check(id like 'custom_%'),check(array_position(permissions,null) is null));
create unique index if not exists team_roles_name_idx on public.manufacturer_team_roles(manufacturer_id,lower(btrim(name)));
alter table public.manufacturer_team_roles enable row level security;
grant select,insert,update,delete on public.manufacturer_team_roles to authenticated;
drop policy if exists team_roles_read on public.manufacturer_team_roles;
create policy team_roles_read on public.manufacturer_team_roles for select to authenticated using(manufacturer_id=public.current_factory_id() and public.factory_has_permission(manufacturer_id,'team'));
do $$declare d text;begin select pg_get_functiondef('public.apply_superadmin_access()'::regprocedure)into d;if position('''manufacturer_team_roles'''in d)=0 then d:=replace(d,'''projects''','''manufacturer_team_roles'',''projects''');execute d;end if;perform public.apply_superadmin_access();end$$;
alter table public.manufacturer_team_members drop constraint if exists manufacturer_team_members_role_check;
alter table public.manufacturer_team_invitations drop constraint if exists manufacturer_team_invitations_role_check;
create or replace function public.factory_role_valid(p_factory uuid,p_role text)returns boolean language sql stable security definer set search_path=public as $$select coalesce(p_role in('owner','admin','production','sales','staff')or exists(select 1 from manufacturer_team_roles where id=p_role and manufacturer_id=p_factory),false)$$;
revoke all on function public.factory_role_valid(uuid,text)from public,anon;grant execute on function public.factory_role_valid(uuid,text)to authenticated;
create or replace function public.team_validate_role()returns trigger language plpgsql security definer set search_path=public as $$begin if not public.factory_role_valid(new.manufacturer_id,new.role)or(tg_table_name='manufacturer_team_invitations'and new.role='owner')then raise exception 'Invalid organisation role';end if;return new;end$$;
revoke all on function public.team_validate_role()from public,anon,authenticated;
drop trigger if exists team_validate_role on public.manufacturer_team_members;
create trigger team_validate_role before insert or update of role,manufacturer_id on public.manufacturer_team_members for each row execute function public.team_validate_role();
drop trigger if exists team_validate_role on public.manufacturer_team_invitations;
create trigger team_validate_role before insert or update of role,manufacturer_id on public.manufacturer_team_invitations for each row execute function public.team_validate_role();
create or replace function public.factory_role_permissions(p_role text)returns text[]language sql stable security definer set search_path=public as $$select case p_role
 when 'owner'then array['view_orders','view_financial','quote','production','qc','shipping','calendar','inventory','customers','analytics','team','settings','portfolio','verification','messages']
 when 'admin'then array['view_orders','view_financial','quote','production','qc','shipping','calendar','inventory','customers','analytics','team','portfolio','verification','messages']
 when 'production'then array['view_orders','production','qc','shipping','calendar','inventory','messages']
 when 'sales'then array['view_orders','view_financial','quote','customers','messages']
 when 'staff'then array['view_orders','production']else coalesce((select permissions from manufacturer_team_roles where id=p_role),'{}'::text[])end$$;
create or replace function public.factory_team_invite(p_email text,p_role text,p_resend uuid default null)returns jsonb language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();m manufacturer_team_members%rowtype;i manufacturer_team_invitations%rowtype;token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');address text:=lower(btrim(p_email));begin
 perform 1 from manufacturer_profiles where user_id=f for update;
 select *into m from manufacturer_team_members where manufacturer_id=f and user_id=auth.uid()and removed_at is null;
 if not public.factory_has_permission(f,'team')or not(public.factory_role_permissions(p_role)<@case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end)then raise exception 'You cannot grant permissions you do not possess';end if;
 if (p_role='owner'or not public.factory_role_valid(f,p_role))or address!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'or length(address)>254 then raise exception 'Enter a valid email and role';end if;
 if exists(select 1 from manufacturer_team_members t join profiles p on p.id=t.user_id where t.manufacturer_id=f and t.removed_at is null and lower(p.email)=address)then raise exception 'This user is already a team member';end if;
 if(select count(*)from manufacturer_team_audit where manufacturer_id=f and action in('invite','resend')and created_at>now()-interval '1 hour')>=30 then raise exception 'Invitation limit reached; try again later';end if;
 if p_resend is not null then
 select *into i from manufacturer_team_invitations where id=p_resend and manufacturer_id=f for update;
 if not found or i.accepted_at is not null or i.revoked_at is not null then raise exception 'Only pending or expired invitations can be resent';end if;
 if i.email<>address or i.role<>p_role then raise exception 'Invitation details changed; refresh first';end if;
 update manufacturer_team_invitations set token_hash=encode(sha256(token::bytea),'hex'),invited_by=auth.uid(),expires_at=now()+interval '7 days',revision=revision+1,delivery_status='link_created',delivery_error=null where id=i.id;
 else
 update manufacturer_team_invitations set revoked_at=now()where manufacturer_id=f and lower(email)=address and accepted_at is null and revoked_at is null and expires_at<=now();
 if exists(select 1 from manufacturer_team_invitations where manufacturer_id=f and lower(email)=address and accepted_at is null and revoked_at is null)then raise exception 'A pending invitation already exists; resend or revoke it';end if;
 insert into manufacturer_team_invitations(manufacturer_id,email,role,token_hash,invited_by,expires_at)values(f,address,p_role,encode(sha256(token::bytea),'hex'),auth.uid(),now()+interval '7 days')returning *into i;
 end if;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id,details)values(f,auth.uid(),case when p_resend is null then 'invite'else 'resend'end,i.id,jsonb_build_object('email',address,'role',p_role));
 return jsonb_build_object('id',i.id,'token',token,'email',address,'factoryName',(select factory_name from manufacturer_profiles where user_id=f),'expiresAt',now()+interval '7 days');end$$;
create or replace function public.factory_team_change(p_id uuid,p_revision integer,p_action text,p_role text default null,p_permissions text[] default null)returns uuid language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();actor manufacturer_team_members%rowtype;m manufacturer_team_members%rowtype;allowed text[];begin
 perform 1 from manufacturer_profiles where user_id=f for update;
 select *into actor from manufacturer_team_members where manufacturer_id=f and user_id=auth.uid()and removed_at is null;
 if not public.factory_has_permission(f,'team')then raise exception 'Manage team permission required';end if;
 if p_action='revoke'then
 update manufacturer_team_invitations set revoked_at=now(),revision=revision+1 where id=p_id and manufacturer_id=f and revision=p_revision and accepted_at is null and revoked_at is null;
 if not found then raise exception 'Invitation changed; refresh first';end if;
 else
 select *into m from manufacturer_team_members where id=p_id and manufacturer_id=f and removed_at is null for update;
 if not found or m.revision is distinct from p_revision then raise exception 'Member changed; refresh first';end if;
 if m.role='owner'and actor.role<>'owner'then raise exception 'Only owners can change owner access';end if;
 allowed:=case when actor.role='owner'then public.factory_role_permissions('owner')else coalesce(actor.permissions,public.factory_role_permissions(actor.role))end;
 if not(coalesce(m.permissions,public.factory_role_permissions(m.role))<@allowed)then raise exception 'You cannot manage a member with greater permissions';end if;
 if p_action not in('role','permissions','remove')then raise exception 'Unknown team action';end if;
 if p_action='role'and(p_role is null or not public.factory_role_valid(f,p_role)or(p_role='owner'and actor.role<>'owner')or not(public.factory_role_permissions(p_role)<@allowed))then raise exception 'You cannot grant this role';end if;
 if p_action='permissions'and(m.role='owner'or not(coalesce(p_permissions,public.factory_role_permissions(m.role))<@allowed and coalesce(p_permissions,'{}')<@public.factory_role_permissions('owner'))or(p_permissions is not null and(cardinality(p_permissions)>16 or cardinality(p_permissions)<>(select count(distinct x)from unnest(p_permissions)x))))then raise exception 'Invalid permission override';end if;
 if m.role='owner'and(p_action='remove'or(p_action='role'and p_role<>'owner'))and(select count(*)from manufacturer_team_members where manufacturer_id=f and role='owner'and removed_at is null)<=1 then raise exception 'The last owner cannot be removed or demoted';end if;
 update manufacturer_team_members set role=case when p_action='role'then p_role else role end,permissions=case when p_action='role'then null when p_action='permissions'then p_permissions else permissions end,removed_at=case when p_action='remove'then now()else removed_at end,revision=revision+1 where id=m.id;
 if p_action='remove'then delete from manufacturer_team_order_assignments where manufacturer_id=f and user_id=m.user_id;update manufacturer_team_invitations set revoked_at=now(),revision=revision+1 where manufacturer_id=f and invited_by=m.user_id and accepted_at is null and revoked_at is null;end if;
 end if;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id,details)values(f,auth.uid(),p_action,p_id,jsonb_build_object('role',p_role,'permissions',p_permissions));return p_id;end$$;
create or replace function public.factory_team_list()returns jsonb language plpgsql stable security definer set search_path=public as $$declare f uuid:=public.current_factory_id();begin
 if not public.factory_has_permission(f,'team')then raise exception 'Manage team permission required';end if;
 return jsonb_build_object('roles',coalesce((select jsonb_agg(to_jsonb(r)order by name)from manufacturer_team_roles r where manufacturer_id=f),'[]'),'members',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('email',p.email,'name',p.full_name)order by m.joined_at)from manufacturer_team_members m join profiles p on p.id=m.user_id where m.manufacturer_id=f and m.removed_at is null),'[]'),
 'invitations',coalesce((select jsonb_agg((to_jsonb(i)-'token_hash')||jsonb_build_object('status',case when accepted_at is not null then 'Accepted'when revoked_at is not null then 'Revoked'when expires_at<=now()then 'Expired'else 'Pending'end)order by created_at desc)from(select *from manufacturer_team_invitations where manufacturer_id=f order by created_at desc limit 200)i),'[]'),
 'audit',coalesce((select jsonb_agg(to_jsonb(a))from(select *from manufacturer_team_audit where manufacturer_id=f order by created_at desc limit 30)a),'[]'),
 'orders',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',product_name))from(select id,product_name from orders where assigned_manufacturer_id=f and status not in('completed','cancelled')order by created_at desc limit 200)o),'[]'),
 'assignments',coalesce((select jsonb_agg(to_jsonb(a))from manufacturer_team_order_assignments a where manufacturer_id=f),'[]'));end$$;
create or replace function public.factory_team_save_role(p_name text,p_permissions text[],p_id text default null,p_revision integer default null)returns text language plpgsql security definer set search_path=public as $$
declare f uuid:=public.current_factory_id();r manufacturer_team_roles%rowtype;allowed text[];result text;begin
 perform 1 from manufacturer_profiles where user_id=f for update;
 if not public.factory_has_permission(f,'team')then raise exception 'Manage team permission required';end if;
 select case when role='owner'then public.factory_role_permissions('owner')else coalesce(permissions,public.factory_role_permissions(role))end into allowed from manufacturer_team_members where manufacturer_id=f and user_id=auth.uid()and removed_at is null;
 if p_permissions is null or array_position(p_permissions,null)is not null or not(p_permissions<@allowed)or not(p_permissions<@public.factory_role_permissions('owner'))or cardinality(p_permissions)<>(select count(distinct x)from unnest(p_permissions)x)then raise exception 'You cannot grant these permissions';end if;
 if p_name is null or length(btrim(p_name))not between 1 and 60 or lower(btrim(p_name))in('owner','admin','production manager','sales / quotations','staff')then raise exception 'Choose a distinct role name (1–60 characters)';end if;
 if p_id is null then insert into manufacturer_team_roles(manufacturer_id,name,permissions,created_by)values(f,btrim(p_name),p_permissions,auth.uid())returning id into result;
 else select *into r from manufacturer_team_roles where id=p_id and manufacturer_id=f for update;
 if not found or r.revision is distinct from p_revision then raise exception 'Role changed; refresh first';end if;
 if not(r.permissions<@allowed)then raise exception 'You cannot manage a role with greater permissions';end if;
 -- Existing individual overrides remain explicit; role defaults update immediately.
 update manufacturer_team_roles set name=btrim(p_name),permissions=p_permissions,revision=revision+1,updated_at=now()where id=r.id returning id into result;
 end if;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action,details)values(f,auth.uid(),'save_custom_role',jsonb_build_object('role',result,'name',btrim(p_name),'permissions',p_permissions));return result;end$$;
revoke all on function public.factory_team_save_role(text,text[],text,integer)from public,anon;grant execute on function public.factory_team_save_role(text,text[],text,integer)to authenticated;

create index if not exists team_members_role_idx on public.manufacturer_team_members(manufacturer_id,role);
create index if not exists team_invites_role_idx on public.manufacturer_team_invitations(manufacturer_id,role);
create or replace function public.team_protect_custom_role()returns trigger language plpgsql security definer set search_path=public as $$begin
 if exists(select 1 from manufacturer_profiles where user_id=old.manufacturer_id)and(exists(select 1 from manufacturer_team_members where role=old.id)or exists(select 1 from manufacturer_team_invitations where role=old.id))then raise exception 'This role is referenced by team records and must be retained';end if;return old;end$$;
revoke all on function public.team_protect_custom_role()from public,anon,authenticated;
drop trigger if exists team_protect_custom_role on public.manufacturer_team_roles;
create trigger team_protect_custom_role before delete or update of id,manufacturer_id on public.manufacturer_team_roles for each row execute function public.team_protect_custom_role();
commit;

-- Invitation account setup (20261026020000)
begin;
create or replace function public.factory_invitation_details(p_token text)returns jsonb language plpgsql stable security definer set search_path=public as $$declare i manufacturer_team_invitations%rowtype;u auth.users%rowtype;begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$'then raise exception 'Invalid invitation link';end if;
 select *into i from manufacturer_team_invitations where token_hash=encode(sha256(p_token::bytea),'hex');
 if not found or i.revoked_at is not null or i.accepted_at is not null or i.expires_at<=now()then raise exception 'Invitation expired, revoked or already used';end if;
 if not exists(select 1 from manufacturer_team_members m where m.manufacturer_id=i.manufacturer_id and m.user_id=i.invited_by and m.removed_at is null and 'team'=any(case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end)and public.factory_role_permissions(i.role)<@case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end)then raise exception 'The inviter no longer has permission to grant this role';end if;
 select *into u from auth.users where lower(email)=i.email;
 return jsonb_build_object('email',i.email,'factoryName',(select factory_name from manufacturer_profiles where user_id=i.manufacturer_id),'accountExists',u.id is not null,'needsPassword',u.id is not null and u.invited_at is not null and coalesce(u.encrypted_password,'')='' and not exists(select 1 from manufacturer_team_members where user_id=u.id and removed_at is null));end$$;
revoke all on function public.factory_invitation_details(text)from public;
grant execute on function public.factory_invitation_details(text)to anon,authenticated,service_role;
commit;

-- Mandatory invited-member password setup (20261026030000)
begin;
create table if not exists public.manufacturer_team_account_setup(user_id uuid primary key references auth.users(id)on delete cascade,created_at timestamptz not null default now(),completed_at timestamptz);
alter table public.manufacturer_team_account_setup enable row level security;
grant select,insert,update,delete on public.manufacturer_team_account_setup to authenticated;
drop policy if exists team_account_setup_self on public.manufacturer_team_account_setup;
create policy team_account_setup_self on public.manufacturer_team_account_setup for select to authenticated using(user_id=auth.uid());
do $$declare d text;begin select pg_get_functiondef('public.apply_superadmin_access()'::regprocedure)into d;if position('''manufacturer_team_account_setup'''in d)=0 then d:=replace(d,'''projects''','''manufacturer_team_account_setup'',''projects''');execute d;end if;perform public.apply_superadmin_access();end$$;
-- Previously invited team accounts must explicitly finish setup once. Never reset their credentials here.
insert into manufacturer_team_account_setup(user_id)select u.id from auth.users u where u.invited_at is not null and(exists(select 1 from manufacturer_team_members where user_id=u.id and manufacturer_id<>u.id)or exists(select 1 from manufacturer_team_invitations where email=lower(u.email)))on conflict do nothing;
create or replace function public.record_team_account_setup(p_invitation uuid,p_user uuid)returns void language plpgsql security definer set search_path=public as $$begin
 if not exists(select 1 from manufacturer_team_invitations i join auth.users u on lower(u.email)=i.email where i.id=p_invitation and u.id=p_user and u.invited_at is not null and i.accepted_at is null and i.revoked_at is null and i.expires_at>now())then raise exception 'Invitation account mismatch';end if;
 insert into manufacturer_team_account_setup(user_id)values(p_user)on conflict do nothing;end$$;
revoke all on function public.record_team_account_setup(uuid,uuid)from public,anon,authenticated;grant execute on function public.record_team_account_setup(uuid,uuid)to service_role;
create or replace function public.team_password_saved()returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.encrypted_password is distinct from old.encrypted_password and coalesce(new.encrypted_password,'')<>''then update manufacturer_team_account_setup set completed_at=now()where user_id=new.id and completed_at is null;end if;return new;end$$;
revoke all on function public.team_password_saved()from public,anon,authenticated;
drop trigger if exists team_password_saved on auth.users;
create trigger team_password_saved after update of encrypted_password on auth.users for each row execute function public.team_password_saved();
create or replace function public.factory_password_ready(p_user uuid)returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from auth.users where id=p_user and not exists(select 1 from manufacturer_team_account_setup where user_id=p_user and completed_at is null)and(invited_at is null or coalesce(encrypted_password,'')<>''))$$;
revoke all on function public.factory_password_ready(uuid)from public,anon,authenticated;
create or replace function public.factory_password_setup_context()returns jsonb language plpgsql stable security definer set search_path=public as $$begin if auth.uid()is null then raise exception 'Sign in required';end if;return jsonb_build_object('email',(select email from auth.users where id=auth.uid()),'required',not public.factory_password_ready(auth.uid()));end$$;
revoke all on function public.factory_password_setup_context()from public,anon;grant execute on function public.factory_password_setup_context()to authenticated;

create or replace function public.factory_invitation_details(p_token text)returns jsonb language plpgsql stable security definer set search_path=public as $$declare i manufacturer_team_invitations%rowtype;u auth.users%rowtype;begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$'then raise exception 'Invalid invitation link';end if;
 select *into i from manufacturer_team_invitations where token_hash=encode(sha256(p_token::bytea),'hex');
 if not found or i.revoked_at is not null or i.accepted_at is not null or i.expires_at<=now()then raise exception 'Invitation expired, revoked or already used';end if;
 if not exists(select 1 from manufacturer_team_members m where m.manufacturer_id=i.manufacturer_id and m.user_id=i.invited_by and m.removed_at is null and 'team'=any(case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end)and public.factory_role_permissions(i.role)<@case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end)then raise exception 'The inviter no longer has permission to grant this role';end if;
 select *into u from auth.users where lower(email)=i.email;
 return jsonb_build_object('email',i.email,'factoryName',(select factory_name from manufacturer_profiles where user_id=i.manufacturer_id),'accountExists',u.id is not null,'needsPassword',u.id is not null and not public.factory_password_ready(u.id) ,'canProvisionSetup',u.id is not null and u.invited_at is not null and coalesce(u.encrypted_password,'')='' and not exists(select 1 from manufacturer_team_members where user_id=u.id and removed_at is null));end$$;

create or replace function public.factory_has_permission(p_factory uuid,p_permission text)returns boolean language sql stable security definer set search_path=public as $$select public.factory_password_ready(public.team_actor())and exists(select 1 from manufacturer_team_members where manufacturer_id=p_factory and user_id=public.team_actor()and removed_at is null and p_permission=any(case when role='owner'then public.factory_role_permissions('owner')else coalesce(permissions,public.factory_role_permissions(role))end))$$;
create or replace function public.factory_team_context()returns jsonb language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();result jsonb;begin
 if auth.uid()is null then raise exception 'Sign in required';end if;
 update manufacturer_team_members set last_active_at=now()where user_id=auth.uid()and manufacturer_id=f and(last_active_at is null or last_active_at<now()-interval '5 minutes');
 select jsonb_build_object('factoryId',f,'role',m.role,'permissions',case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end,'organisations',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'name',p.factory_name))from manufacturer_team_members a join manufacturer_profiles p on p.user_id=a.manufacturer_id where a.user_id=auth.uid()and a.removed_at is null),'[]'))into result from manufacturer_team_members m where m.manufacturer_id=f and m.user_id=auth.uid()and m.removed_at is null;
 if result is not null and not public.factory_password_ready(auth.uid())then result:=result||jsonb_build_object('passwordSetupRequired',true,'permissions','[]'::jsonb);end if;
 return coalesce(result,jsonb_build_object('factoryId',null,'permissions','[]'::jsonb,'hadMembership',exists(select 1 from manufacturer_team_members where user_id=auth.uid()),'organisations',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'name',p.factory_name))from manufacturer_team_members a join manufacturer_profiles p on p.user_id=a.manufacturer_id where a.user_id=auth.uid()and a.removed_at is null),'[]'::jsonb)));end$$;
create or replace function public.accept_factory_invitation(p_token text)returns uuid language plpgsql security definer set search_path=public as $$declare i manufacturer_team_invitations%rowtype;f uuid;verified_email text;begin
 if not public.factory_password_ready(auth.uid())then raise exception 'Create your password before joining the team';end if;
 if auth.uid()is null or length(coalesce(p_token,''))<>64 then raise exception 'Sign in to accept a valid invitation';end if;
 select lower(email)into verified_email from auth.users where id=auth.uid()and email_confirmed_at is not null;
 select manufacturer_id into f from manufacturer_team_invitations where token_hash=encode(sha256(p_token::bytea),'hex');
 perform 1 from manufacturer_profiles where user_id=f for update;
 select *into i from manufacturer_team_invitations where token_hash=encode(sha256(p_token::bytea),'hex')for update;
 if not found or i.revoked_at is not null or i.accepted_at is not null or i.expires_at<=now()then raise exception 'Invitation expired, revoked or already used';end if;
 if verified_email is distinct from i.email then raise exception 'Sign in with the verified invited email address';end if;
 -- Recheck the issuer: revoked administrators cannot leave invitations granting elevated access.
 if not exists(select 1 from manufacturer_team_members m where m.manufacturer_id=f and m.user_id=i.invited_by and m.removed_at is null and public.factory_role_permissions(i.role)<@case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end and 'team'=any(case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end))then raise exception 'The inviter no longer has permission to grant this role';end if;
 if exists(select 1 from manufacturer_team_members where manufacturer_id=f and user_id=auth.uid()and removed_at is null)then raise exception 'Already a member of this organisation';end if;
 insert into manufacturer_team_members(manufacturer_id,user_id,role)values(f,auth.uid(),i.role)on conflict(manufacturer_id,user_id)do update set role=excluded.role,permissions=null,removed_at=null,joined_at=now(),revision=manufacturer_team_members.revision+1;
 update manufacturer_team_invitations set accepted_at=now(),accepted_by=auth.uid(),revision=revision+1 where id=i.id;
 insert into manufacturer_team_contexts(user_id,manufacturer_id)values(auth.uid(),f)on conflict(user_id)do update set manufacturer_id=f;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id)values(f,auth.uid(),'accept_invitation',i.id);return f;end$$;
commit;
