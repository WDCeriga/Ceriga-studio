-- R16: private per-staff quotation drafts and atomic stale-quotation checks.
begin;
create table if not exists public.factory_quote_drafts(
 order_id uuid not null references public.orders(id)on delete cascade,
 factory_id uuid not null references public.manufacturer_profiles(user_id),
 actor_id uuid not null references auth.users(id)on delete cascade,
 payload jsonb not null check(jsonb_typeof(payload)='object'and octet_length(payload::text)<=50000),
 base_revision jsonb not null check(jsonb_typeof(base_revision)='object'),
 revision integer not null default 1 check(revision>0),updated_at timestamptz not null default now(),
 primary key(order_id,factory_id,actor_id)
);
create index if not exists factory_quote_draft_actor_idx on public.factory_quote_drafts(actor_id,updated_at desc);
alter table public.factory_quote_drafts enable row level security;
grant select,insert,update,delete on public.factory_quote_drafts to authenticated;
select public.apply_superadmin_access();

create or replace function public.factory_quote_draft(p_order uuid,p_action text default 'read',
 p_data jsonb default null,p_base jsonb default null,p_expected integer default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare f uuid:=public.current_factory_id();d public.factory_quote_drafts;o public.orders;
begin
 if f is null or not public.factory_has_permission(f,'quote')or not public.factory_has_permission(f,'view_orders')then
  raise exception 'Quotation access denied'using errcode='42501';end if;
 select *into o from public.orders where id=p_order for update;
 if not found or o.kind<>'production'or o.offer_issued_at is not null or o.production_released_at is not null
  or o.status not in('submitted','awaiting_payment')
  or not(o.assigned_manufacturer_id=f or exists(select 1 from public.order_factory_quotes q where q.order_id=p_order and q.factory_id=f and q.status in('pending','submitted')and q.due_on>=current_date))then
  raise exception 'Quotation access denied'using errcode='42501';end if;
 select *into d from public.factory_quote_drafts where order_id=p_order and factory_id=f and actor_id=auth.uid()for update;
 if p_action='read'then return case when d.order_id is null then null else to_jsonb(d)end;end if;
 if p_action='save'then
  if jsonb_typeof(p_data)is distinct from 'object'or octet_length(p_data::text)>50000
   or exists(select 1 from jsonb_object_keys(p_data)k where k not in('rows','shipping','currency','comments'))
   or jsonb_typeof(p_data->'rows')is distinct from 'array'
   or jsonb_typeof(p_data->'shipping')is distinct from 'object'
   or jsonb_typeof(p_base)is distinct from 'object'then raise exception 'Invalid quotation draft';end if;
  if(d.order_id is null and coalesce(p_expected,0)<>0)or(d.order_id is not null and p_expected is distinct from d.revision)then
   raise exception 'This draft changed. Refresh before saving.'using errcode='40001';end if;
  insert into public.factory_quote_drafts(order_id,factory_id,actor_id,payload,base_revision)
   values(p_order,f,auth.uid(),p_data,p_base)
   on conflict(order_id,factory_id,actor_id)do update set payload=excluded.payload,base_revision=excluded.base_revision,revision=factory_quote_drafts.revision+1,updated_at=clock_timestamp()
   returning *into d;
  return to_jsonb(d);
 elsif p_action='clear'then
  if d.order_id is not null and p_expected is distinct from d.revision then raise exception 'This draft changed. Refresh before clearing.'using errcode='40001';end if;
  delete from public.factory_quote_drafts where order_id=p_order and factory_id=f and actor_id=auth.uid();
  return jsonb_build_object('cleared',true);
 end if;
 raise exception 'Unknown draft action';
end$$;
revoke all on function public.factory_quote_draft(uuid,text,jsonb,jsonb,integer)from public,anon;
grant execute on function public.factory_quote_draft(uuid,text,jsonb,jsonb,integer)to authenticated;

create or replace function public.submit_factory_quote_checked(p_order uuid,p_tiers jsonb,p_expected jsonb,
 p_comparison boolean default false,p_comments text default '')
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare f uuid:=public.current_factory_id();o public.orders;q public.order_factory_quotes;actual_at timestamptz;actual_status text;result uuid;
begin
 if f is null or not public.factory_has_permission(f,'quote')or not public.factory_has_permission(f,'view_orders')then raise exception 'Quotation access denied'using errcode='42501';end if;
 select *into o from public.orders where id=p_order for update;
 if not found then raise exception 'Quotation access denied'using errcode='42501';end if;
 if p_comparison then
  select *into q from public.order_factory_quotes where order_id=p_order and factory_id=f for update;
  if not found or q.status not in('pending','submitted')then raise exception 'Quotation access denied'using errcode='42501';end if;
  actual_at:=q.submitted_at;actual_status:=case when q.status='pending'then 'new'else 'quoted'end;
 else
  if o.assigned_manufacturer_id is distinct from f then raise exception 'Quotation access denied'using errcode='42501';end if;
  actual_at:=o.quoted_at;actual_status:=o.factory_status;
 end if;
 if jsonb_typeof(p_expected)is distinct from 'object'or not(p_expected ?&array['at','status'])
  or nullif(p_expected->>'at','')::timestamptz is distinct from actual_at
  or p_expected->>'status'is distinct from actual_status then
  raise exception 'This quotation changed. Review the latest version before submitting.'using errcode='40001';end if;
 if p_comparison then result:=public.factory_respond_comparison(p_order,p_tiers,p_comments,false);
 else result:=public.submit_manufacturer_quote(p_order,p_tiers);end if;
 delete from public.factory_quote_drafts where order_id=p_order and factory_id=f and actor_id=auth.uid();
 return result;
end$$;
revoke all on function public.submit_factory_quote_checked(uuid,jsonb,jsonb,boolean,text)from public,anon;
grant execute on function public.submit_factory_quote_checked(uuid,jsonb,jsonb,boolean,text)to authenticated;
notify pgrst,'reload schema';
commit;
