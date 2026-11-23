begin;

-- Dashboard, order history and fulfilment classify the same released work.
create or replace function public.factory_fulfilment_stage(o public.orders, production_stage text)
returns text language sql immutable set search_path=public as $$
  select case
    when o.kind <> 'production' or o.status not in ('paid','processing','shipping','completed') then null
    when o.payment_verified_at is null and (o.production_released_at is null or o.status='paid') then null
    when o.status='completed' then 'completed'
    when o.status='shipping' then 'shipping'
    when o.qc_status='approved' then 'dispatch'
    when o.qc_status in ('pending_review','changes_required') or production_stage='quality_control' then 'quality'
    else 'production' end
$$;
revoke all on function public.factory_fulfilment_stage(public.orders,text) from public,anon,authenticated;

do $$
declare definition text; original text;
begin
  select pg_get_functiondef('public.factory_fulfilment_board(text,text,integer)'::regprocedure) into definition;
  if strpos(definition,'public.factory_fulfilment_stage')=0 then
    original := definition;
    definition := regexp_replace(definition, 'case when o.status=''completed'' then ''completed''[[:space:][:print:]]*?else ''production'' end as step',
      'case when workflow.stage in (''shipping'',''dispatch'') then ''delivery'' else workflow.stage end as step, workflow.stage as workflow_stage');
    definition := regexp_replace(definition, 'where o.assigned_manufacturer_id=f and o.kind=''production'' and o.status in[[:space:][:print:]]*?and public.factory_order_visible\(o.id\)',
      'cross join lateral (select public.factory_fulfilment_stage(o,u.stage) as stage) workflow where o.assigned_manufacturer_id=f and workflow.stage is not null and public.factory_order_visible(o.id)');
    if definition=original or strpos(definition,'workflow.stage is not null')=0 then raise exception 'Unexpected fulfilment definition'; end if;
    definition := replace(definition,'''delivery'',''completed'') or length', '''delivery'',''dispatch'',''completed'') or length');
    definition := replace(definition,'or p_filter=step)','or p_filter=step or p_filter=''dispatch'' and workflow_stage=''dispatch'')');
    execute definition;
  end if;
end $$;

-- Keep the Orders workspace aligned without changing quotation or declined history.
do $$
declare definition text; old_branch text; new_branch text;
begin
  select pg_get_functiondef('public.factory_history_rows(uuid)'::regprocedure) into definition;
  old_branch := $old$when s.status in ('paid','processing') and s.production_released_at is not null then
        case when s.qc_status = 'approved' then 'delivery' when s.qc_status in ('changes_required','pending_review') then 'quality' else 'production' end$old$;
  new_branch := $new$when public.factory_fulfilment_stage(s.source_order,progress.stage)='dispatch' then 'delivery'
      when public.factory_fulfilment_stage(s.source_order,progress.stage) is not null then public.factory_fulfilment_stage(s.source_order,progress.stage)$new$;
  if strpos(definition,new_branch)=0 then
    if strpos(definition,old_branch)=0 then raise exception 'Unexpected order history definition'; end if;
    definition := replace(definition,old_branch,new_branch);
    definition := replace(definition,'select o.*, c.code','select o.*, o as source_order, c.code');
    execute definition;
  end if;
end$$;
create index if not exists dashboard_factory_work_idx on public.orders(assigned_manufacturer_id,status,due_quote_by)
  where kind='production';
create index if not exists dashboard_factory_order_staff_idx on public.manufacturer_team_order_assignments(manufacturer_id,order_id,user_id);

create or replace function public.manufacturer_operations_dashboard(
  p_days integer default 30,p_search text default '',p_stage text default 'all',
  p_sort text default 'deadline',p_due text default 'all',p_staff text default 'all',
  p_type text default 'all',p_priority text default 'all',p_action text default 'all',
  p_task_staff text default 'all',p_page integer default 0,p_task_page integer default 0,
  p_soon integer default 3
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  factory uuid := public.current_factory_id();
  zone text;
  today date;
  result jsonb;
  can_analytics boolean;
  can_quote boolean;
  can_production boolean;
  can_qc boolean;
  can_shipping boolean;
begin
  if factory is null or not public.factory_has_permission(factory,'view_orders') then
    raise exception 'An authorised factory workspace is required';
  end if;
  if p_days not in (7,30,90) or length(coalesce(p_search,''))>150
    or p_page not between 0 and 10000 or p_task_page not between 0 and 10000 or p_soon not between 1 and 14 then
    raise exception 'Invalid dashboard filters';
  end if;
  select calendar_timezone into zone from manufacturer_profiles where user_id=factory;
  zone := coalesce(zone,'UTC');
  today := (now() at time zone zone)::date;
  can_quote := public.factory_has_permission(factory,'quote');
  can_production := public.factory_has_permission(factory,'production');
  can_qc := public.factory_has_permission(factory,'qc');
  can_shipping := public.factory_has_permission(factory,'shipping');
  can_analytics := public.factory_has_permission(factory,'analytics');

  with scoped as materialized (
    select o.id, public.factory_safe_order_title(o.product_name,o.garment_type,o.user_id,o.contact_name,o.contact_email) product,
      o.garment_type garment, o.created_at, o.updated_at, o.completed_at, o.qc_status, o.due_quote_by,
      coalesce(o.factory_status,'new') factory_status,
      o.status in ('submitted','awaiting_payment') and coalesce(o.factory_status,'new') in ('new','reviewing','clarifying') quote_pending,
      public.factory_fulfilment_stage(o,u.stage) stage,
      public.production_stage_key(coalesce(u.stage,'preparation')) production_stage,
      u.id is not null has_progress,
      coalesce((t.override_completion at time zone zone)::date,u.expected_completion) completion,
      coalesce(nullif(btrim(u.delay_reason),''),nullif(btrim(t.legacy_delay),'')) is not null reported_delay,
      coalesce(h.units,'') units,h.customer_code,h.is_returning,
      coalesce(h.run_type,public.order_history_run_kind(o)) run_type,h.nickname
    from orders o
    left join lateral(select v.id,v.stage,v.expected_completion,v.delay_reason from order_production_updates v
      where v.order_id=o.id and v.manufacturer_id=factory order by v.version desc limit 1) u on true
    left join order_production_timelines t on t.order_id=o.id and t.manufacturer_id=factory
    left join public.factory_history_rows(factory) h on h.order_id=o.id
    where o.kind='production' and o.assigned_manufacturer_id=factory and public.factory_order_visible(o.id)
  ), staff as materialized (
    select a.order_id,m.user_id,coalesce(nullif(m.member_name,''),nullif(p.full_name,''),'Team member') name
    from manufacturer_team_order_assignments a
    join scoped s on s.id=a.order_id
    join manufacturer_team_members m on m.manufacturer_id=factory and m.user_id=a.user_id and m.removed_at is null
    join profiles p on p.id=m.user_id
    where a.manufacturer_id=factory
  ), floor as materialized (
    select s.*,case when stage='production' then completion-today end days_left,
      case when stage='production' and completion<today then 'overdue'
        when stage='production' and completion<=today+p_soon then 'soon'
        when reported_delay then 'delay' else 'normal' end priority,
      case when stage='production' and can_production then 'Open production'
        when stage='quality' and qc_status='changes_required' and can_qc then 'Review correction'
        when stage='quality' and qc_status='not_submitted' and can_qc then 'Submit QC'
        when stage='dispatch' and can_shipping then 'Prepare dispatch'
        when stage='shipping' and can_shipping then 'Track delivery' else 'View order' end action
    from scoped s where stage in ('production','quality','dispatch','shipping')
  ), actions as materialized (
    select s.*,case
      when quote_pending and can_quote then case when factory_status='clarifying' then 'revise_quote' else 'quote' end
      when stage='quality' and can_qc and qc_status='changes_required' then 'revise_qc'
      when stage='quality' and can_qc and qc_status='not_submitted' then 'submit_qc'
      when stage='dispatch' and can_shipping then 'dispatch'
      when stage='production' and can_production and (reported_delay or completion<today) then 'delay'
      when stage='production' and can_production and not has_progress then 'production_update'
      end task,
      case when quote_pending then due_quote_by when stage='production' then completion end deadline
    from scoped s
  ), filtered_tasks as (
    select a.*,(deadline-today) days_left from actions a where task is not null
      and (p_action='all' or p_action=task)
      and (p_task_staff='all' or exists(select 1 from staff where order_id=a.id and user_id::text=p_task_staff)
        or p_task_staff='unassigned' and not exists(select 1 from staff where order_id=a.id))
  ), filtered_floor as (
    select d.* from floor d where (p_stage='all' or p_stage=stage or p_stage=production_stage and stage='production')
      and (coalesce(p_search,'')='' or position(lower(p_search) in lower(concat_ws(' ',id, 'ORD-'||left(id::text,8),product,garment,customer_code,nickname)))>0)
      and (p_due='all' or p_due='overdue' and days_left<0 or p_due='today' and days_left=0 or p_due='tomorrow' and days_left=1
        or p_due='week' and days_left between 0 and 7 or p_due='unset' and completion is null)
      and (p_type='all' or p_type=run_type or p_type='sample' and run_type='sample_revision' or p_type='repeat_bulk' and run_type='modified_repeat')
      and (p_priority='all' or p_priority=priority)
      and (p_staff='all' or exists(select 1 from staff where order_id=d.id and user_id::text=p_staff)
        or p_staff='unassigned' and not exists(select 1 from staff where order_id=d.id))
  ), page as (
    select * from filtered_floor order by
      case when p_sort='deadline' then days_left end nulls last,
      case when p_sort='newest' then created_at end desc,
      case when p_sort='oldest' then created_at end asc,id limit 12 offset p_page*12
  ), task_page as (
    select * from filtered_tasks order by deadline nulls last, updated_at,id limit 6 offset p_task_page*6
  ), deadlines as (
    select * from floor where stage='production' order by days_left nulls last,id limit 5
  ), events as (
    (select 'production:'||u.id id,u.order_id,'production_update' kind,u.created_at at,u.submitted_by actor,
      public.production_stage_key(prior.stage) previous,public.production_stage_key(u.stage) next
    from order_production_updates u join scoped s on s.id=u.order_id
    left join lateral(select p.stage from order_production_updates p where p.order_id=u.order_id
      and p.manufacturer_id=factory and p.version<u.version order by p.version desc limit 1) prior on true
    where u.manufacturer_id=factory and u.created_at>=now()-interval '30 days'
    order by u.created_at desc,u.id limit 24)
    union all
    (select 'quote:'||e.id,e.order_id,case when e.event_type='updated' then 'quoted' else e.event_type end,e.created_at,e.actor_id,null,null
    from order_routing_events e join scoped s on s.id=e.order_id where e.manufacturer_id=factory and e.created_at>=now()-interval '30 days'
      and (e.event_type in ('assigned','quoted','offer_published','manufacturer_declined','production_released','customer_submitted_to_manufacturer') or (e.event_type='updated' and e.details->>'factoryStatus'='quoted' and e.details->>'status' in ('submitted','awaiting_payment')))
    order by e.created_at desc,e.id limit 24)
    union all
    (select 'qc:'||e.id,e.order_id,e.action,e.created_at,e.actor_id,null,null
    from qc_audit_events e join scoped s on s.id=e.order_id where e.details->>'manufacturer_id'=factory::text and e.created_at>=now()-interval '30 days'
      and e.action in ('submit_report','approve_report','request_report_changes','dispatch','order_completed')
    order by e.created_at desc,e.id limit 24)
  ), recent as (
    select distinct on (order_id,kind,date_trunc('second',at),next) *
    from events order by order_id,kind,date_trunc('second',at),next,at desc,id
  )
  , quote_samples as (
    select extract(epoch from (e.created_at-request.created_at))/3600.0 hours
    from order_routing_events e join scoped s on s.id=e.order_id
    join lateral (
      select r.created_at from order_routing_events r where r.order_id=e.order_id and r.manufacturer_id=factory
        and r.created_at<=e.created_at and (r.event_type='assigned'
          or r.event_type in ('admin_rejected','manufacturer_quotation_rejected') and r.details->>'nextAction'='revise')
      order by r.created_at desc,r.id limit 1
    ) request on true
    where can_analytics and e.manufacturer_id=factory and e.created_at>=now()-make_interval(days=>p_days)
      and (e.event_type='quoted' or e.event_type='updated' and e.details->>'factoryStatus'='quoted'
        and e.details->>'status' in ('submitted','awaiting_payment'))
  ), first_reports as (
    select distinct on (q.order_id) q.order_id,q.qc_status,q.reviewed_at
    from qc_inspections q join scoped s on s.id=q.order_id
    where can_analytics and q.manufacturer_id=factory and q.workflow_version=2 and q.submitted_at is not null
    order by q.order_id,q.report_version
  )
  select jsonb_build_object(
    'today',today,'timezone',zone,'generatedAt',now(),'days',p_days,'metrics',case when can_analytics then jsonb_build_object(
      'completed',(select count(*) from scoped where stage='completed' and completed_at>=now()-make_interval(days=>p_days)),
      'quoteHours',(select round(avg(hours)::numeric,1) from quote_samples),
      'quoteSamples',(select count(*) from quote_samples),
      'qcFirstReviewed',(select count(*) from first_reports where reviewed_at>=now()-make_interval(days=>p_days) and qc_status in ('approved','changes_required')),
      'qcFirstApproved',(select count(*) from first_reports where reviewed_at>=now()-make_interval(days=>p_days) and qc_status='approved')) end,
    'counts',(select jsonb_build_object('production',count(*) filter(where stage='production'),
      'pendingQuotes',count(*) filter(where quote_pending),'quality',count(*) filter(where stage='quality'),
      'dispatch',count(*) filter(where stage='dispatch'),'active',count(*) filter(where stage in ('production','quality','dispatch','shipping')),
      'overdueQuotes',count(*) filter(where quote_pending and due_quote_by<today),
      'qcCorrections',count(*) filter(where stage='quality' and qc_status='changes_required')) from scoped),
    'deadlineCounts',(select jsonb_build_object('overdue',count(*) filter(where days_left<0),'today',count(*) filter(where days_left=0),
      'tomorrow',count(*) filter(where days_left=1),'week',count(*) filter(where days_left between 0 and 7)) from floor),
    'staff',coalesce((select jsonb_agg(to_jsonb(x) order by name,user_id) from (select distinct user_id,name from staff)x),'[]'::jsonb),
    'taskTotal',(select count(*) from filtered_tasks),'floorTotal',(select count(*) from filtered_floor),
    'tasks',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('staff',coalesce((select string_agg(name,', ' order by name) from staff where order_id=t.id),''))
      order by t.deadline nulls last,t.updated_at,t.id) from task_page t),'[]'::jsonb),
    'orders',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('staff',coalesce((select string_agg(name,', ' order by name) from staff where order_id=p.id),''))
      order by case when p_sort='deadline' then p.days_left end nulls last,case when p_sort='newest' then p.created_at end desc,
      case when p_sort='oldest' then p.created_at end asc,p.id) from page p),'[]'::jsonb),
    'deadlines',coalesce((select jsonb_agg(to_jsonb(d)||jsonb_build_object('staff',coalesce((select string_agg(name,', ' order by name) from staff where order_id=d.id),''))
      order by d.days_left nulls last,d.id) from deadlines d),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(to_jsonb(e)-'actor'||jsonb_build_object('product',s.product,
      'employee',case when m.user_id is not null then coalesce(nullif(m.member_name,''),p.full_name) end)
      order by e.at desc,e.id) from (select * from recent order by at desc,id limit 12)e
      join scoped s on s.id=e.order_id left join manufacturer_team_members m on m.manufacturer_id=factory and m.user_id=e.actor and m.removed_at is null
      left join profiles p on p.id=m.user_id),'[]'::jsonb)
  ) into result;
  return result;
end$$;

revoke all on function public.manufacturer_operations_dashboard(integer,text,text,text,text,text,text,text,text,text,integer,integer,integer) from public,anon;
grant execute on function public.manufacturer_operations_dashboard(integer,text,text,text,text,text,text,text,text,text,integer,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
