-- Apply via Supabase SQL Editor or the project's migration runner. No storage bucket required:
-- source layers and transparent preview data URLs are committed atomically in one private row.
begin;

create table public.asset_projects (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (length(btrim(id)) > 0),
  name text not null,
  width double precision not null check (width > 0 and width < 'Infinity'::double precision),
  height double precision not null check (height > 0 and height < 'Infinity'::double precision),
  elements jsonb not null check (jsonb_typeof(elements) = 'array'),
  preview text not null check (preview ~ '^data:image/(png|webp);base64,[A-Za-z0-9+/]+={0,2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index asset_projects_user_updated_idx on public.asset_projects (user_id, updated_at desc);

create function public.set_asset_projects_timestamps()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' then
    new.created_at = old.created_at;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger asset_projects_set_timestamps
  before insert or update on public.asset_projects
  for each row execute function public.set_asset_projects_timestamps();

alter table public.asset_projects enable row level security;
revoke all on public.asset_projects from anon;
grant select, insert, update, delete on public.asset_projects to authenticated;

create policy asset_projects_select_own on public.asset_projects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy asset_projects_insert_own on public.asset_projects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy asset_projects_update_own on public.asset_projects
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy asset_projects_delete_own on public.asset_projects
  for delete to authenticated using ((select auth.uid()) = user_id);

commit;
