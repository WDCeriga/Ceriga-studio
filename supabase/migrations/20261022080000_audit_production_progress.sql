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
