-- Restore missing user profiles without replacing existing account records.
begin;

do $$ begin
  if to_regprocedure('public.is_superadmin()') is null then
    raise exception 'Apply the existing superadmin authorization setup before repairing profiles';
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'brand' check (role in ('brand', 'manufacturer', 'worker')),
  message_credits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists message_credits integer not null default 0;
create index if not exists profiles_role_idx on public.profiles(role);
alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_own') then
    create policy profiles_select_own on public.profiles for select to authenticated using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_superadmin') then
    create policy profiles_select_superadmin on public.profiles for select to authenticated using (public.is_superadmin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_own') then
    create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_superadmin') then
    create policy profiles_update_superadmin on public.profiles for update to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_insert_self') then
    create policy profiles_insert_self on public.profiles for insert to authenticated with check (auth.uid() = id);
  end if;
end $$;

create or replace function public.set_profiles_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='profiles_set_updated_at') then
    create trigger profiles_set_updated_at before update on public.profiles
      for each row execute function public.set_profiles_updated_at();
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name)
  values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',split_part(coalesce(new.email,''),'@',1)))
  on conflict(id) do nothing;
  return new;
end;
$$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='on_auth_user_created') then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

-- Recognize existing factory accounts from server-owned records, never signup metadata.
do $$
declare manufacturer_ids uuid[] := array[]::uuid[];
begin
  if to_regclass('public.manufacturer_profiles') is not null then
    execute 'select coalesce(array_agg(user_id), array[]::uuid[]) from public.manufacturer_profiles' into manufacturer_ids;
  end if;
  insert into public.profiles(id,email,full_name,role,created_at,updated_at)
  select u.id,coalesce(u.email,''),coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',split_part(coalesce(u.email,''),'@',1)),
    case when u.id=any(manufacturer_ids) then 'manufacturer' else 'brand' end,
    coalesce(u.created_at,now()),coalesce(u.updated_at,u.created_at,now())
  from auth.users u on conflict(id) do nothing;
end $$;

notify pgrst, 'reload schema';
commit;
select count(*) as user_profiles, count(*) filter (where role='manufacturer') as manufacturers from public.profiles;
