begin;
-- Extend the existing order conversation and retain all original submissions.
alter table public.order_communication_requests drop constraint if exists order_communication_requests_category_check;
alter table public.order_communication_requests add constraint order_communication_requests_category_check
  check (category in ('general','design','fabric','colour','moq','timeline','quotation','other','production_issue'));
alter table public.order_communication_requests add column if not exists impact text
  check (impact in ('informational','clarification','approval','blocking'));

create or replace function public.order_communication_factory_active(p_order uuid,p_factory uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists (
    select 1 from public.orders o where o.id=p_order and o.kind='production'
    and (o.assigned_manufacturer_id=p_factory or (o.offer_issued_at is null
      and o.production_released_at is null and exists (
        select 1 from public.order_factory_quotes q where q.order_id=o.id and q.factory_id=p_factory
          and q.status in ('pending','submitted','selected')
      )))
  )
$$;
revoke all on function public.order_communication_factory_active(uuid,uuid) from public,anon,authenticated;

create or replace function public.order_communication_access(p_order uuid,p_scope text)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select auth.uid() is not null and coalesce(case p_scope
    when 'admin' then public.is_superadmin()
    when 'manufacturer' then public.order_communication_factory_active(p_order,public.current_factory_id())
      and public.factory_has_permission(public.current_factory_id(),'messages')
      and public.factory_has_permission(public.current_factory_id(),'view_orders')
    when 'customer' then exists(select 1 from public.orders where id=p_order and user_id=auth.uid())
    else false end,false)
$$;

create or replace function public.order_communication_action(
  p_order uuid,p_scope text,p_action text,p_id uuid,p_version integer,p_body text default '',
  p_category text default null,p_proposal jsonb default null,p_files jsonb default '[]',
  p_share_files boolean default false
) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  o public.orders%rowtype; r public.order_communication_requests%rowtype;
  next_status text; audience text[]; body text:=btrim(coalesce(p_body,''));
  new_proposal jsonb; request_impact text; active_factory uuid; files jsonb; source_id uuid; new_decision text; notice text; recipient text;
begin
  if not public.order_communication_access(p_order,p_scope) then raise exception 'Communication access denied'; end if;
  select * into o from public.orders where id=p_order for update;
  if not found or not public.order_communication_access(p_order,p_scope) then
    raise exception 'Communication unavailable for this order';
  end if;
  select * into r from public.order_communication_requests where id=p_id and order_id=p_order
    and (p_scope<>'manufacturer' or factory_id=public.current_factory_id()) for update;
  active_factory:=case when p_scope='manufacturer' then public.current_factory_id() else r.factory_id end;
  if not public.order_communication_factory_active(p_order,active_factory) then
    raise exception 'The factory is no longer assigned to this conversation';
  end if;
  if not found then
    if p_scope<>'manufacturer' or p_action not in ('draft','submit') or p_version is distinct from 0 then
      raise exception 'Request unavailable';
    end if;
    insert into public.order_communication_requests(id,order_id,factory_id,created_by,category,status)
      values(p_id,p_order,active_factory,auth.uid(),p_category,'draft') returning * into r;
  end if;
  if r.version is distinct from p_version then raise exception 'This request changed. Refresh and try again'; end if;
  if length(body)>5000 then raise exception 'Messages can contain up to 5,000 characters'; end if;
  if p_scope='manufacturer' and p_action in ('draft','submit') then
    request_impact:=p_proposal->>'impact';
    if p_category='production_issue' then
      if o.production_released_at is null or request_impact is null
        or request_impact not in ('informational','clarification','approval','blocking') then
        raise exception 'Choose the impact of the issue on a released production order';
      end if;
    elsif request_impact is not null then
      raise exception 'Only production issues can carry an impact';
    end if;
  end if;
  if p_proposal is not null and p_proposal-'impact'<>'{}'::jsonb then
    if coalesce(p_proposal->>'field','') not in ('quantity','material','colour','price','lead_time','construction','shipping')
       or coalesce(length(btrim(p_proposal->>'current')),0) not between 1 and 500
       or coalesce(length(btrim(p_proposal->>'proposed')),0) not between 1 and 500
       or btrim(p_proposal->>'current')=btrim(p_proposal->>'proposed') then
      raise exception 'Enter the affected term, current value and a different proposed value';
    end if;
    new_proposal:=jsonb_build_object('field',p_proposal->>'field','current',btrim(p_proposal->>'current'),'proposed',btrim(p_proposal->>'proposed'));
  end if;
  audience:=array[p_scope];
  case
    when p_scope='manufacturer' and p_action in ('draft','submit') and r.status='draft' then
      if r.created_by<>auth.uid() then raise exception 'Only the author can submit this draft'; end if;
      next_status:=case p_action when 'draft' then 'draft' else 'pending_review' end;
      if p_action='submit' then recipient:='admin'; notice:=case when request_impact='blocking' then 'Production issue blocking work' else 'Manufacturer request ready for review' end; end if;
    when p_scope='manufacturer' and (
      (p_action='clarify' and r.status='clarification_requested')
      or (p_action='follow_up' and r.status='resolved' and r.proposal is null)
    ) then
      next_status:='pending_review'; recipient:='admin'; notice:='Manufacturer clarification ready for review';
    when p_scope='admin' and p_action in ('approve','reject','request_clarification') and r.status='pending_review' then
      recipient:='manufacturer'; audience:=array['manufacturer'];
      if p_action='approve' then
        if (r.proposal is null)<>(new_proposal is null) or (new_proposal is not null and r.proposal->>'field'<>new_proposal->>'field') then
          raise exception 'Review the structured proposal before sending it';
        end if;
        select id into source_id from public.order_communication_events
          where request_id=r.id and action in ('submit','clarify','follow_up') order by version desc limit 1;
        next_status:='awaiting_customer'; audience:=array['customer']; notice:='Ceriga sent your request to the customer';
      elsif p_action='reject' then next_status:='rejected'; notice:='Ceriga declined your request';
      else next_status:='clarification_requested'; notice:='Ceriga requested clarification'; end if;
    when p_scope='customer' and p_action in ('reply','accept','decline') and r.status='awaiting_customer' then
      if p_action<>'reply' and r.proposal is null then raise exception 'No formal proposal is awaiting a decision'; end if;
      new_decision:=case p_action when 'accept' then 'accepted' when 'decline' then 'declined' end;
      next_status:='customer_responded'; recipient:='admin'; notice:='Customer response ready for review';
    when p_scope='admin' and p_action in ('share_reply','return_reply') and r.status='customer_responded' then
      if p_action='share_reply' then
        select id into source_id from public.order_communication_events
          where request_id=r.id and action in ('reply','accept','decline') order by version desc limit 1;
        audience:=array['manufacturer','customer'];
        next_status:=case
          when r.decision='accepted' then 'customer_responded'
          when r.proposal is not null and r.decision is null then 'clarification_requested'
          else 'resolved' end;
        if exists(select 1 from public.order_communication_events where request_id=r.id and action='share_reply'
          and file_source=source_id) then raise exception 'This reply was already shared'; end if;
        recipient:='manufacturer'; notice:='Ceriga shared a reviewed customer response';
      else
        if (select action from public.order_communication_events where request_id=r.id order by version desc limit 1)='share_reply' then
          raise exception 'A published response cannot be returned';
        end if;
        audience:=array['customer']; next_status:='awaiting_customer';
        recipient:='customer'; notice:='Ceriga requested more information';
      end if;
    when p_scope='admin' and p_action='resolve_issue' and r.status='pending_review'
      and r.category='production_issue' and r.proposal is null then
      next_status:='resolved'; audience:=array['manufacturer'];
      recipient:='manufacturer'; notice:='Ceriga resolved a production issue';
    when p_scope='admin' and p_action='resolve' and r.status='customer_responded' and r.decision='accepted'
      and exists(select 1 from public.order_communication_events where request_id=r.id and action='share_reply') then
      -- Record the independent commercial workflow reference. This RPC cannot modify the accepted order.
      next_status:='resolved'; audience:=array[]::text[];
      recipient:='manufacturer'; notice:='Ceriga closed the proposal review';
    else raise exception 'This action is unavailable for the current request status';
  end case;
  if body='' and p_action not in ('draft','accept','decline') then raise exception 'Enter a message'; end if;
  if p_action not in ('draft','submit','clarify','follow_up','reply','accept','decline') and p_files<>'[]'::jsonb then
    raise exception 'Only original submissions can include files';
  end if;
  files:=public.order_communication_files(p_files);
  if p_action in ('draft','submit') and files='[]' then
    select e.files into files from public.order_communication_events e
      where e.request_id=r.id and e.action='draft' order by version desc limit 1;
    files:=coalesce(files,'[]');
  end if;
  if p_action in ('approve','share_reply','return_reply','resolve_issue') and
    (body || coalesce(new_proposal::text,'')) ~* '[[:alnum:]_.%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}' then
    raise exception 'Remove email addresses before sharing this message';
  end if;
  if p_action in ('approve','share_reply','return_reply','resolve_issue') and
    (body || coalesce(new_proposal::text,'')) ~ '(^|[^[:alnum:]])\+?[0-9][0-9 ()-]{7,}[0-9]([^[:alnum:]]|$)' then
    raise exception 'Remove phone numbers before sharing this message';
  end if;
  if p_action='approve' then
    insert into public.order_communication_events(request_id,version,actor_id,action,status,audiences,body)
      values(r.id,r.version+1,auth.uid(),'approve','approved',array[]::text[],'');
    insert into public.order_communication_events(request_id,version,actor_id,action,status,audiences,body)
      values(r.id,r.version+2,auth.uid(),'send','sent',array[]::text[],'');
    r.version:=r.version+2;
  end if;
  insert into public.order_communication_events(request_id,version,actor_id,action,status,audiences,body,proposal,files,file_source,share_files)
    values(r.id,r.version+1,auth.uid(),case p_action when 'approve' then 'delivery' else p_action end,
      next_status,audience,body,case when p_action in ('draft','submit','approve') then new_proposal end,
      files,source_id,source_id is not null and coalesce(p_share_files,false));
  update public.order_communication_requests as target set status=next_status,version=r.version+1,updated_at=clock_timestamp(),
    impact=case when p_action in ('draft','submit') then request_impact else r.impact end,
    category=case when p_action in ('draft','submit') then p_category else r.category end,
    proposal=case when p_action in ('draft','submit','approve') then new_proposal else r.proposal end,
    decision=case when p_action='return_reply' then null else coalesce(new_decision,r.decision) end
    where id=r.id;
  if recipient in ('admin','manufacturer') then
    insert into public.portal_notifications(audience,user_id,category,title,body,href,order_id)
      values(case recipient when 'admin' then 'superadmin' else recipient end,
        case when recipient='manufacturer' then r.factory_id end,'message',notice,'Open the order communication to review.',
        case recipient when 'admin' then '/superadmin/orders/'||p_order||'#customer-communication'
          else (case when o.production_released_at is not null then '/manufacturer/fulfilment/'
            when o.status in ('submitted','awaiting_payment') then '/manufacturer/quotations/' else '/manufacturer/orders/' end)
            ||p_order||'#customer-communication' end,p_order);
  end if;
  if p_action='approve' or recipient='customer' then
    insert into public.brand_notifications(user_id,category,title,body,href)
      values(o.user_id,'order',case when p_action='approve' then 'New message from Ceriga' else notice end,
        'Open your order to review.','/orders/'||p_order||'#customer-communication');
  end if;
  return r.id;
end $$;

create or replace function public.order_communication_history(p_order uuid,p_scope text,p_before timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
  if not public.order_communication_access(p_order,p_scope) then raise exception 'Communication access denied'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',r.id,'order',r.order_id,'category',r.category,'version',r.version,
      'createdAt',r.created_at,'canAct',public.order_communication_factory_active(r.order_id,r.factory_id) and (p_scope<>'customer' or r.status='awaiting_customer'),
      'impact',case when p_scope<>'customer' then r.impact end,'status',case
        when p_scope='customer' then case
          when r.status='resolved' and r.decision is not null then 'resolved'
          else (select case when e.action='share_reply' and e.status='clarification_requested'
                    then 'customer_responded' else e.status end
            from public.order_communication_events e where e.request_id=r.id
              and 'customer'=any(e.audiences) order by e.version desc limit 1) end
        when p_scope='manufacturer' and r.status='customer_responded' and not exists(
          select 1 from public.order_communication_events e where e.request_id=r.id and e.action='share_reply' and e.version=r.version
        ) then 'awaiting_customer' else r.status end,
      'decision',case when p_scope<>'manufacturer' or exists(
        select 1 from public.order_communication_events e where e.request_id=r.id and e.action in ('share_reply','resolve') and e.version=r.version
      ) then r.decision end,
      'paid',o.payment_verified_at is not null,
      'canEdit',p_scope='manufacturer' and r.created_by=auth.uid(),
      'events',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',e.id,'action',e.action,'body',e.body,'at',e.created_at,'proposal',e.proposal,
        'reviewer',case when p_scope='admin' and e.action in ('delivery','reject','request_clarification','share_reply','return_reply','resolve','resolve_issue')
          then e.actor_id end,
        'files',(select coalesce(jsonb_agg(f.value->>'type' order by f.n),'[]')
          from jsonb_array_elements(case when e.share_files then src.files else e.files end) with ordinality f(value,n))
      ) order by e.version),'[]') from public.order_communication_events e
        left join public.order_communication_events src on src.id=e.file_source
        where e.request_id=r.id and (p_scope='admin' or (p_scope=any(e.audiences)
          and (e.action<>'draft' or r.created_by=auth.uid()))))
    ) order by r.created_at desc,r.id desc) from (
      select x.* from public.order_communication_requests x join public.orders assigned on assigned.id=x.order_id
      where x.order_id=p_order and (p_scope<>'manufacturer' or x.factory_id=public.current_factory_id())
        and (p_before is null or (x.created_at,x.id)<(p_before,p_before_id))
        and (p_scope<>'customer' or exists(select 1 from public.order_communication_events e
          where e.request_id=x.id and 'customer'=any(e.audiences)))
        and (p_scope<>'manufacturer' or x.status<>'draft' or x.created_by=auth.uid())
      order by x.created_at desc,x.id desc limit 50
    ) r join public.orders o on o.id=r.order_id
  ),'[]');
end $$;

create or replace function public.order_communication_attachment(p_event uuid,p_index integer,p_scope text)
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
  select (case when e.share_files then src.files else e.files end)->p_index
  from public.order_communication_events e
  join public.order_communication_requests r on r.id=e.request_id
  join public.orders o on o.id=r.order_id
  left join public.order_communication_events src on src.id=e.file_source
  where e.id=p_event and p_index between 0 and 2
    and (p_scope<>'manufacturer' or public.current_factory_id()=r.factory_id)
    and (p_scope<>'manufacturer' or e.action<>'draft' or r.created_by=auth.uid())
    and public.order_communication_access(r.order_id,p_scope)
    and (p_scope='admin' or p_scope=any(e.audiences))
$$;

create or replace function public.order_communication_queue(p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
  if not coalesce(public.is_superadmin(),false) then raise exception 'Communication access denied'; end if;
  return jsonb_build_object(
    'pending',(select count(*) from public.order_communication_requests r join public.orders o
      on o.id=r.order_id and public.order_communication_factory_active(r.order_id,r.factory_id)
      where r.status in ('pending_review','customer_responded')),
    'rows',coalesce((select jsonb_agg(to_jsonb(q)) from (
      select r.id,r.order_id,r.category,r.status,r.updated_at,r.created_at,
        coalesce(f.factory_name,'Assigned manufacturer') as factory_name
      from public.order_communication_requests r
      join public.orders o on o.id=r.order_id and public.order_communication_factory_active(r.order_id,r.factory_id)
      left join public.manufacturer_profiles f on f.user_id=r.factory_id
      where r.status in ('pending_review','customer_responded')
      order by (r.impact='blocking') desc nulls last,r.updated_at,r.id limit 25 offset greatest(0,p_offset)
    ) q),'[]'));
end $$;

notify pgrst,'reload schema';
commit;
