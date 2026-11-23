-- R14: internal notifications only. Human decisions and customer messaging are unchanged.
begin;
create table if not exists public.internal_reminder_dispatches(
 event_key text primary key,kind text not null,record_id uuid not null,
 order_id uuid references public.orders(id)on delete cascade,
 created_at timestamptz not null default now()
);
create index if not exists internal_reminder_order_idx on public.internal_reminder_dispatches(order_id,created_at desc);
alter table public.internal_reminder_dispatches enable row level security;
grant select,insert,update,delete on public.internal_reminder_dispatches to authenticated;
-- The migration-only helper discovers all public tables, including this one.
select public.apply_superadmin_access();
insert into public.platform_settings(key,value)values('internal_workflow_reminders',
 '{"enabled":true,"reviewHours":24,"quoteHours":24,"repeatHours":24,"shippingDays":3}')
on conflict(key)do nothing;

create or replace function public.internal_workflow_reminders()returns integer
language plpgsql security definer set search_path=pg_catalog,public as $$
declare reminder_config jsonb;item record;bucket bigint;key text;n integer:=0;
begin
 select value into reminder_config from public.platform_settings where platform_settings.key='internal_workflow_reminders';
 if not coalesce((reminder_config->>'enabled')::boolean,false)then return 0;end if;
 -- One notification per event and configured repeat window. This is a reminder,
 -- not a production promise or an automatically approved decision.
 bucket:=floor(extract(epoch from now())/(greatest(1,(reminder_config->>'repeatHours')::integer)*3600));
 for item in
  with pending_quotes as (
   select o.id order_id,o.assigned_manufacturer_id factory,o.id record_id
   from public.orders o where o.kind='production'and o.status in('submitted','awaiting_payment')
     and o.assigned_manufacturer_id is not null and o.factory_status in('new','reviewing','clarifying')
     and o.quoted_at is null and o.due_quote_by<=current_date+ceil((reminder_config->>'quoteHours')::numeric/24)::integer
   union
   select q.order_id,q.factory_id,q.order_id from public.order_factory_quotes q join public.orders o on o.id=q.order_id
    where q.status='pending'and q.due_on<=current_date+ceil((reminder_config->>'quoteHours')::numeric/24)::integer
      and o.offer_issued_at is null and o.status in('submitted','awaiting_payment')
  ), candidates as (
   select 'quotation'::text kind,q.order_id,q.record_id,q.factory,'Quotation reminder'::text title,
    '/manufacturer/quotations/'||q.order_id href from pending_quotes q
   union all
   select 'communication',r.order_id,r.id,null::uuid,'Review reminder',
    '/superadmin/orders/communication?order='||r.order_id
    from public.order_communication_requests r where r.status in('pending_review','customer_responded')
     and public.order_communication_factory_active(r.order_id,r.factory_id)
     and r.updated_at<=now()-make_interval(hours=>(reminder_config->>'reviewHours')::integer)
     and not exists(select 1 from public.order_communication_events e where e.request_id=r.id
       and e.version=r.version and e.action='share_reply')
   union all
   select 'qc',i.order_id,i.id,null::uuid,'Review reminder','/superadmin/orders/'||i.order_id||'#current-work'
    from public.qc_inspections i join public.orders o on o.id=i.order_id
    where i.workflow_version=2 and i.qc_status='pending_review'and o.qc_status='pending_review'
     and i.submitted_at<=now()-make_interval(hours=>(reminder_config->>'reviewHours')::integer)
   union all
   select 'production',o.id,o.id,o.assigned_manufacturer_id,'Production reminder','/manufacturer/fulfilment/'||o.id
    from public.orders o join public.order_production_timelines p on p.order_id=o.id and p.manufacturer_id=o.assigned_manufacturer_id
    where o.status='processing'and o.production_released_at is not null
      and (p.needs_review is not null or p.expected_completion<now())
   union all
   select 'shipping',o.id,o.id,null::uuid,'Shipping reminder','/superadmin/orders/'||o.id||'#shipping-preparation'
    from public.orders o join public.order_production_timelines p on p.order_id=o.id and p.manufacturer_id=o.assigned_manufacturer_id
    where o.status='processing'and o.production_released_at is not null
     and p.expected_completion<=now()+make_interval(days=>(reminder_config->>'shippingDays')::integer)
     and not exists(select 1 from public.order_internal_work w where w.order_id=o.id and w.kind='shipping_preparation'and w.state<>'cancelled')
   union all
   select 'delivery',o.id,o.id,null::uuid,'Shipping reminder','/superadmin/orders/'||o.id||'#current-work'
    from public.orders o where o.status='shipping'and not coalesce(o.completion_on_hold,false)
     and o.completion_due_at<=now()+interval '2 days'
     and (select e.status from public.order_logistics_events e where e.order_id=o.id order by e.created_at desc limit 1)='exception'
   union all
   select 'internal_work',w.order_id,w.id,null::uuid,'Review reminder','/superadmin/orders/'||w.order_id||'#internal-amendment'
    from public.order_internal_work w where w.kind='amendment'and w.state in('draft','review')
     and w.updated_at<=now()-make_interval(hours=>(reminder_config->>'reviewHours')::integer)
   union all
   select 'support',case when a.entity='order'then a.record_id end,a.id,null::uuid,'Support follow-up',
    case a.entity when 'order'then '/superadmin/orders/'when 'manufacturer'then '/superadmin/manufacturers/'else '/superadmin/users/'end||a.record_id
    from public.admin_record_activity a where a.follow_up<=now()and a.action='support'
     and not exists(select 1 from public.admin_record_activity b where b.entity=a.entity and b.record_id=a.record_id and b.action='support'and b.created_at>a.created_at)
  )
  select c.*from candidates c where not exists(select 1 from public.internal_reminder_dispatches d
   where d.event_key=c.kind||':'||c.record_id||':'||coalesce(c.factory::text,'admin')||':'||bucket)
  order by c.kind,c.record_id limit 200
 loop
  key:=item.kind||':'||item.record_id||':'||coalesce(item.factory::text,'admin')||':'||bucket;
  insert into public.internal_reminder_dispatches(event_key,kind,record_id,order_id)
   values(key,item.kind,item.record_id,item.order_id)on conflict do nothing;
  if not found then continue;end if;
  if item.factory is null then
   perform public.notify_superadmin('order',item.title,'This order is waiting for an update.',item.href,item.order_id);
  else
   perform public.notify_manufacturer(item.factory,'order',item.title,'This order is waiting for an update.',item.href,item.order_id);
  end if;
  n:=n+1;
 end loop;
 return n;
end$$;
revoke all on function public.internal_workflow_reminders()from public,anon,authenticated;
grant execute on function public.internal_workflow_reminders()to service_role;

create or replace function public.admin_workflow_health(p_settings jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare reminder_config jsonb;jobs jsonb;history jsonb:='[]';
begin
 if not coalesce(public.is_superadmin(),false)then raise exception 'Superadmin authorization required'using errcode='42501';end if;
 if p_settings is not null then
  if jsonb_typeof(p_settings)<>'object'or jsonb_typeof(p_settings->'enabled')is distinct from 'boolean'
   or exists(select 1 from jsonb_object_keys(p_settings)k where k not in('enabled','reviewHours','quoteHours','repeatHours','shippingDays'))
   or not(p_settings ?&array['reviewHours','quoteHours','repeatHours','shippingDays'])then raise exception 'Invalid reminder settings';end if;
  if (p_settings->>'reviewHours')!~'^[0-9]+$'or(p_settings->>'quoteHours')!~'^[0-9]+$'or(p_settings->>'repeatHours')!~'^[0-9]+$'or(p_settings->>'shippingDays')!~'^[0-9]+$'
   or(p_settings->>'reviewHours')::integer not between 1 and 168
   or(p_settings->>'quoteHours')::integer not between 0 and 168
   or(p_settings->>'repeatHours')::integer not between 1 and 168
   or(p_settings->>'shippingDays')::integer not between 0 and 14 then raise exception 'Choose valid reminder intervals';end if;
  insert into public.platform_settings(key,value)values('internal_workflow_reminders',p_settings)
   on conflict(key)do update set value=excluded.value,updated_at=now();
 end if;
 select value into reminder_config from public.platform_settings where key='internal_workflow_reminders';
 select coalesce(jsonb_agg(jsonb_build_object('name',jobname,'schedule',schedule,'active',active)order by jobname),'[]')into jobs
  from cron.job where jobname in('ceriga-production-timeline','ceriga-complete-delivery-orders','ceriga-internal-workflow-reminders');
 if to_regclass('cron.job_run_details')is not null then
  execute $query$select coalesce(jsonb_agg(to_jsonb(x)),'[]')from(
   select distinct on(j.jobid) j.jobname as name,r.status,r.start_time,r.end_time
   from cron.job j left join cron.job_run_details r on r.jobid=j.jobid
   where j.jobname in('ceriga-production-timeline','ceriga-complete-delivery-orders','ceriga-internal-workflow-reminders')
   order by j.jobid,r.start_time desc nulls last)x$query$ into history;
 end if;
 return jsonb_build_object('settings',reminder_config,'jobs',jobs,'history',history);
end$$;
revoke all on function public.admin_workflow_health(jsonb)from public,anon;
grant execute on function public.admin_workflow_health(jsonb)to authenticated;
select cron.schedule('ceriga-internal-workflow-reminders','15 * * * *','select public.internal_workflow_reminders();');
notify pgrst,'reload schema';
commit;
