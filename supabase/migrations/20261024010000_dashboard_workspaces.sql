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
