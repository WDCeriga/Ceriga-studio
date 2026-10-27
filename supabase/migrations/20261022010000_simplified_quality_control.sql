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
