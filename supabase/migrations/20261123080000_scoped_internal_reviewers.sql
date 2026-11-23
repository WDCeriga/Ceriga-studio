-- R15: explicit per-order review capabilities. No existing role gains permissions.
begin;
do $catalog$
declare d text;
begin
 d:=pg_get_functiondef('public.platform_worker_catalog()'::regprocedure);
 if position('"id":"communication"'in d)=0 then
  if position(']''::jsonb'in d)=0 then raise exception 'Unexpected worker permission catalog';end if;
  execute replace(d,']''::jsonb',
   ',{"id":"communication","label":"Order communication","description":"Review order-specific messages and approved responses.","scoped":true,"actions":["view","edit"]},{"id":"quotations","label":"Quotation review","description":"Review manufacturer quotations and select a preferred offer. Final customer pricing remains protected.","scoped":true,"actions":["view","edit"]},{"id":"shipping","label":"Shipping","description":"Review shipping preparation and update authorised logistics. Payment and QC gates remain required.","scoped":true,"actions":["view","edit"]}]''::jsonb');
 end if;
 if to_regprocedure('public.validate_permissions_before_workflow_reviews(jsonb)')is null then
  alter function public.platform_worker_validate_permissions(jsonb)rename to validate_permissions_before_workflow_reviews;
 end if;
end$catalog$;
revoke all on function public.validate_permissions_before_workflow_reviews(jsonb)from public,anon,authenticated;
create or replace function public.platform_worker_validate_permissions(p_permissions jsonb)returns void
language plpgsql immutable set search_path=pg_catalog,public as $$
declare area text;
begin
 perform public.validate_permissions_before_workflow_reviews(p_permissions);
 foreach area in array array['communication','quotations','shipping']loop
  if p_permissions?(area||'.view')and(
   not(p_permissions?'orders.view')or(p_permissions->>(area||'.view')='all'and p_permissions->>'orders.view'<>'all'))then
   raise exception 'Review permissions require equal or broader Orders access';end if;
 end loop;
end$$;
revoke all on function public.platform_worker_validate_permissions(jsonb)from public,anon,authenticated;

create or replace function public.internal_reviewer_can(p_area text,p_action text,p_order uuid default null)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select auth.uid()is not null and p_area in('communication','quotations','shipping')and p_action in('view','edit')
 and(public.is_superadmin()or(public.platform_worker_can(p_area||'.'||p_action,p_order)
  and public.platform_worker_can('orders.view',p_order)
  and (p_order is null or not exists(select 1 from public.orders o where o.id=p_order and(
   o.assigned_manufacturer_id=auth.uid()or exists(select 1 from public.manufacturer_team_members m
    where m.manufacturer_id=o.assigned_manufacturer_id and m.user_id=auth.uid()and m.removed_at is null))))));
$$;
revoke all on function public.internal_reviewer_can(text,text,uuid)from public,anon,authenticated;

create or replace function public.internal_review_context(p_order uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare o public.orders;
begin
 if not public.platform_worker_can('orders.view',p_order)then raise exception 'Order access denied'using errcode='42501';end if;
 select *into o from public.orders where id=p_order;
 if not found then raise exception 'Order unavailable';end if;
 return jsonb_build_object(
 'communicationRead',public.internal_reviewer_can('communication','view',p_order),
 'communicationWrite',public.internal_reviewer_can('communication','edit',p_order),
 'quotationsRead',public.internal_reviewer_can('quotations','view',p_order),
 'quotationsWrite',public.internal_reviewer_can('quotations','edit',p_order),
 'shippingRead',public.internal_reviewer_can('shipping','view',p_order),
 'shippingWrite',public.internal_reviewer_can('shipping','edit',p_order),
 'comparing',exists(select 1 from public.order_factory_quotes where order_id=p_order),
 'quotation',case when public.internal_reviewer_can('quotations','view',p_order)then o.manufacturer_quote end,
 'factoryStatus',case when public.internal_reviewer_can('quotations','view',p_order)then o.factory_status end);
end$$;
revoke all on function public.internal_review_context(uuid)from public,anon;
grant execute on function public.internal_review_context(uuid)to authenticated;

create or replace function public.order_communication_access(p_order uuid,p_scope text)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select auth.uid()is not null and coalesce(case p_scope
 when 'admin'then public.internal_reviewer_can('communication','view',p_order)
 when 'manufacturer'then public.order_communication_factory_active(p_order,public.current_factory_id())
  and public.factory_has_permission(public.current_factory_id(),'messages')
  and public.factory_has_permission(public.current_factory_id(),'view_orders')
 when 'customer'then exists(select 1 from public.orders where id=p_order and user_id=auth.uid())
 else false end,false)
$$;
do $review_guards$
declare d text;
begin
 d:=pg_get_functiondef('public.order_communication_action(uuid,text,text,uuid,integer,text,text,jsonb,jsonb,boolean)'::regprocedure);
 if position('Communication review permission required'in d)=0 then
  d:=replace(d,'if not public.order_communication_access(p_order,p_scope)',
   'if p_scope=''admin''and not public.internal_reviewer_can(''communication'',''edit'',p_order)then raise exception ''Communication review permission required''using errcode=''42501'';end if; if not public.order_communication_access(p_order,p_scope)');
  execute d;
 end if;
 d:=pg_get_functiondef('public.order_communication_history(uuid,text,timestamptz,uuid)'::regprocedure);
 if position('public.internal_reviewer_can(''communication'',''edit'',r.order_id)'in d)=0 then
  d:=replace(d,'''canAct'',public.order_communication_factory_active(r.order_id,r.factory_id)',
   '''canAct'',(p_scope<>''admin''or public.internal_reviewer_can(''communication'',''edit'',r.order_id))and public.order_communication_factory_active(r.order_id,r.factory_id)');execute d;
 end if;
 execute pg_get_functiondef('public.platform_worker_role_guard()'::regprocedure);
 d:=pg_get_functiondef('public.admin_select_factory_quote(uuid,uuid,text)'::regprocedure);
 d:=replace(d,'if not public.is_superadmin() then','if not public.internal_reviewer_can(''quotations'',''edit'',p_order) then');execute d;
 d:=pg_get_functiondef('public.review_manufacturer_quotation(uuid,text,text)'::regprocedure);
 d:=replace(d,'if not public.is_superadmin()then','if not(public.is_superadmin()or(p_next_action=''revise''and public.internal_reviewer_can(''quotations'',''edit'',p_order_id)))then');execute d;
 d:=pg_get_functiondef('public.freight_logistics_update(uuid,uuid,text,jsonb)'::regprocedure);
 d:=replace(d,'if not public.is_superadmin()then','if not public.internal_reviewer_can(''shipping'',''edit'',p_order)then');execute d;
end$review_guards$;

create or replace function public.review_factory_comparisons(p_order uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if not public.internal_reviewer_can('quotations','view',p_order)then raise exception 'Quotation review access denied'using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'orderId',q.order_id,'factoryId',q.factory_id,'factory',m.factory_name,
 'status',case when q.status='pending'and q.due_on<current_date or q.status in('submitted','selected')and q.valid_until<=now()then 'expired'else q.status end,
 'dueOn',q.due_on,'validUntil',q.valid_until,'tiers',q.tiers,'comments',q.comments,'reason',q.selection_reason,
 'eligibility',public.matching_requirements(o,m,coalesce(s.settings,'{}')),
 'workload',(select count(*)from public.orders a where a.assigned_manufacturer_id=q.factory_id and a.kind='production'and a.status in('paid','processing')and(a.payment_verified_at is not null or a.production_released_at is not null)and a.factory_status is distinct from 'rejected'and a.qc_status is distinct from 'approved')
 )order by q.requested_at,q.factory_id)
 from public.order_factory_quotes q join public.orders o on o.id=q.order_id
 join public.manufacturer_profiles m on m.user_id=q.factory_id
 left join public.manufacturer_customisation_settings s on s.user_id=q.factory_id
 where q.order_id=p_order and o.offer_issued_at is null),'[]');
end$$;
revoke all on function public.review_factory_comparisons(uuid)from public,anon;
grant execute on function public.review_factory_comparisons(uuid)to authenticated;

create or replace function public.worker_shipping_context(p_order uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare o public.orders;opt jsonb;events jsonb;
begin
 if not public.internal_reviewer_can('shipping','view',p_order)then raise exception 'Shipping access denied'using errcode='42501';end if;
 select *into o from public.orders where id=p_order;
 if not found then raise exception 'Order unavailable';end if;
 select value->'shipping'into opt from jsonb_array_elements(coalesce(o.price_options,'[]'))where value->>'id'=o.selected_price_option_id;
 opt:=opt-array['priceCents','currency','manufacturingCents','serviceFeeCents','taxCents','dutiesCents','otherCents','roundingCents','totalCents'];
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'details',e.details,'created_at',e.created_at)order by e.created_at desc),'[]')into events
 from public.order_logistics_events e where order_id=p_order;
 return jsonb_build_object('approved',opt,'events',events,'canManage',public.internal_reviewer_can('shipping','edit',p_order),
 'releaseAuthorized',coalesce(public.production_release_authorized(o),false),'paid',o.payment_verified_at is not null,
 'qcApproved',o.qc_status='approved','manufacturerQuotes',null,'quotes','[]'::jsonb,'selections','[]'::jsonb,'amendments','[]'::jsonb);
end$$;
revoke all on function public.worker_shipping_context(uuid)from public,anon;
grant execute on function public.worker_shipping_context(uuid)to authenticated;
create or replace function public.internal_work_allowed(p_order uuid,p_kind text,p_write boolean default false)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select auth.uid()is not null and(public.is_superadmin()or(
 p_kind='shipping_preparation'and public.internal_reviewer_can('shipping',case when p_write then 'edit'else 'view'end,p_order)));
$$;
notify pgrst,'reload schema';
commit;
