-- R09 / R10: internal coordination records, never a second order or payment system.
begin;
create table if not exists public.order_internal_work(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 kind text not null check(kind in('amendment','shipping_preparation')),
 request_id uuid references public.order_communication_requests(id),
 state text not null default 'draft' check(state in('draft','review','resolved','cancelled')),
 details jsonb not null default '{}' check(jsonb_typeof(details)='object' and octet_length(details::text)<=200000),
 owner_id uuid references auth.users(id) on delete set null,
 created_by uuid references auth.users(id) on delete set null,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((kind='amendment' and request_id is not null)or(kind='shipping_preparation' and request_id is null))
);
create unique index if not exists order_internal_work_request_idx on public.order_internal_work(request_id)where request_id is not null;
create unique index if not exists order_internal_work_shipping_idx on public.order_internal_work(order_id,kind)where kind='shipping_preparation'and state in('draft','review');
create index if not exists order_internal_work_order_idx on public.order_internal_work(order_id,updated_at desc);
create index if not exists order_internal_work_owner_idx on public.order_internal_work(owner_id,state,updated_at);
alter table public.order_internal_work enable row level security;
grant select,insert,update,delete on public.order_internal_work to authenticated;
do $access$
declare d text;
begin
 d:=pg_get_functiondef('public.apply_superadmin_access()'::regprocedure);
 if position('''order_internal_work''' in d)=0 and position('tablename from pg_tables' in d)=0 then
  if position('''projects''' in d)=0 then raise exception 'Superadmin access registry unavailable';end if;
  execute replace(d,'''projects''','''order_internal_work'',''projects''');
 end if;
 perform public.apply_superadmin_access();
end$access$;
create or replace function public.internal_work_audit()returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 insert into public.admin_record_activity(entity,record_id,actor_id,action,previous,updated,reason)
 values('order',coalesce(new.order_id,old.order_id),auth.uid(),
  'internal_work_'||lower(tg_op),case when tg_op<>'INSERT'then to_jsonb(old)end,
  case when tg_op<>'DELETE'then to_jsonb(new)end,coalesce(new.details->>'note',old.details->>'note'));
 return coalesce(new,old);
end$$;
revoke all on function public.internal_work_audit()from public,anon,authenticated;
drop trigger if exists internal_work_audit on public.order_internal_work;
create trigger internal_work_audit after insert or update or delete on public.order_internal_work for each row execute function public.internal_work_audit();

create or replace function public.internal_work_allowed(p_order uuid,p_kind text,p_write boolean default false)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select auth.uid()is not null and (public.is_superadmin()or(
 p_kind='shipping_preparation'
 and public.platform_worker_can('orders.view',p_order)
 and public.platform_worker_can(case when p_write then 'shipping.edit'else 'shipping.view'end,p_order)));
$$;
revoke all on function public.internal_work_allowed(uuid,text,boolean)from public,anon,authenticated;

create or replace function public.internal_order_work(p_order uuid,p_kind text,p_action text default 'read',
 p_id uuid default null,p_expected integer default null,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare o public.orders;r public.order_communication_requests;w public.order_internal_work;v_details jsonb;request uuid;next_state text;
begin
 if p_kind not in('amendment','shipping_preparation')or not coalesce(public.internal_work_allowed(p_order,p_kind,p_action<>'read'),false)then
  raise exception 'Internal workflow access denied'using errcode='42501';end if;
 select *into o from public.orders where id=p_order for update;
 if not found then raise exception 'Order not found';end if;
 if p_action='read'then return coalesce((select jsonb_agg(to_jsonb(x)order by x.updated_at desc)from public.order_internal_work x where order_id=p_order and kind=p_kind),'[]');end if;
 if jsonb_typeof(p_data)is distinct from 'object'or octet_length(p_data::text)>10000 then raise exception 'Invalid internal task details';end if;
 if p_action='create' then
  if o.kind<>'production'or o.status in('completed','cancelled')then raise exception 'This order cannot accept a new task';end if;
  if p_kind='amendment'then
   request:=nullif(p_data->>'request_id','')::uuid;
   select *into r from public.order_communication_requests where id=request and order_id=p_order for update;
   if not found or r.decision is distinct from 'accepted'
    or not exists(select 1 from public.order_communication_events e where request_id=r.id and action='delivery'and proposal is not null)
    or (select action from public.order_communication_events where request_id=r.id order by version desc limit 1)is distinct from 'share_reply'
    then raise exception 'Review and share the accepted proposal before preparing a revision';end if;
   select *into w from public.order_internal_work where request_id=r.id;
   if found then return to_jsonb(w);end if;
   v_details:=jsonb_build_object('proposal',r.proposal,'specifications',o.specifications,'quantities',o.order_quantities,
    'quoted_at',o.quoted_at,'paid',o.payment_verified_at is not null,'released',o.production_released_at is not null,
    'note','Customer consent recorded. Complete the existing quotation revision or controlled amendment before changing agreed instructions.');
  else
   select *into w from public.order_internal_work where order_id=p_order and kind=p_kind and state in('draft','review')for update;
   if found then return to_jsonb(w);end if;
   v_details:=jsonb_build_object('carrier','','collection_at',null,'note','');
  end if;
  insert into public.order_internal_work(order_id,kind,request_id,details,owner_id,created_by)
   values(p_order,p_kind,request,v_details,auth.uid(),auth.uid())returning *into w;
 elsif p_action in('save','claim','review','resolve','cancel')then
  select *into w from public.order_internal_work where id=p_id and order_id=p_order and kind=p_kind for update;
  if not found then raise exception 'Internal task not found';end if;
  if p_expected is null or p_expected<>w.revision then raise exception 'Task changed. Refresh before saving.'using errcode='40001';end if;
  if w.state in('resolved','cancelled')then raise exception 'This task is already closed';end if;
  v_details:=w.details;next_state:=w.state;
  if p_action='save'then
   if p_kind='shipping_preparation'then
    if exists(select 1 from jsonb_object_keys(p_data)k where k not in('carrier','collection_at','note'))or length(coalesce(p_data->>'carrier',''))>200 or length(coalesce(p_data->>'note',''))>2000 then raise exception 'Enter short preparation details';end if;
    if nullif(p_data->>'collection_at','')is not null then perform(p_data->>'collection_at')::timestamptz;end if;
    v_details:=v_details||p_data;
   else
    if exists(select 1 from jsonb_object_keys(p_data)k where k not in('note','reference'))or length(coalesce(p_data->>'note',''))>4000 or length(coalesce(p_data->>'reference',''))>500 then raise exception 'Enter a short revision note and reference';end if;
    v_details:=v_details||p_data;
   end if;
  elsif p_action='review'then next_state:='review';
  elsif p_action='resolve'then
   if p_kind='amendment'and length(btrim(coalesce(v_details->>'reference','')))<3 then raise exception 'Record the completed revision or amendment reference first';end if;
   next_state:='resolved';
  elsif p_action='cancel'then next_state:='cancelled';
  end if;
  update public.order_internal_work set details=v_details,state=next_state,
   owner_id=case when p_action='claim'then auth.uid()else owner_id end,revision=revision+1,updated_at=clock_timestamp()
   where id=w.id returning *into w;
 else raise exception 'Unknown internal workflow action';
 end if;
 return to_jsonb(w);
end$$;
revoke all on function public.internal_order_work(uuid,text,text,uuid,integer,jsonb)from public,anon;
grant execute on function public.internal_order_work(uuid,text,text,uuid,integer,jsonb)to authenticated;
notify pgrst,'reload schema';
commit;
