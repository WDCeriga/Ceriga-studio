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
