create table if not exists public.order_communication_requests (
  id uuid primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  factory_id uuid not null references auth.users(id),
  created_by uuid not null references auth.users(id),
  category text not null check (category in ('general','design','fabric','colour','moq','timeline','quotation','other')),
  status text not null check (status in ('draft','pending_review','clarification_requested','approved','sent','awaiting_customer','customer_responded','resolved','rejected')),
  proposal jsonb,
  decision text check (decision in ('accepted','declined')),
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.order_communication_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.order_communication_requests(id) on delete cascade,
  version integer not null,
  actor_id uuid not null references auth.users(id),
  action text not null,
  status text not null,
  audiences text[] not null,
  body text not null,
  proposal jsonb,
  files jsonb not null default '[]',
  share_files boolean not null default false,
  file_source uuid references public.order_communication_events(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(request_id,version)
);
create index if not exists order_communication_order_idx on public.order_communication_requests(order_id,created_at,id);
create index if not exists order_communication_review_idx on public.order_communication_requests(updated_at,id)
  where status in ('pending_review','customer_responded');
select public.apply_superadmin_access();

create or replace function public.order_communication_access(p_order uuid,p_scope text)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select auth.uid() is not null and coalesce(case p_scope
    when 'admin' then public.is_superadmin()
    when 'manufacturer' then public.factory_order_visible(p_order)
      and public.factory_has_permission(public.current_factory_id(),'messages')
    when 'customer' then exists(select 1 from public.orders where id=p_order and user_id=auth.uid())
    else false end,false)
$$;

create or replace function public.order_communication_files(p_files jsonb)
returns jsonb language plpgsql immutable set search_path=pg_catalog as $$
declare item jsonb; bytes bytea; result jsonb:='[]'; mime text;
begin
  if jsonb_typeof(p_files) is distinct from 'array' or jsonb_array_length(p_files)>3 then
    raise exception 'Attach up to three files';
  end if;
  for item in select value from jsonb_array_elements(p_files) loop
    if coalesce(length(item->>'data'),0) not between 8 and 2796204 then
      raise exception 'Each attachment must be under 2 MiB';
    end if;
    bytes:=decode(item->>'data','base64');
    mime:=item->>'type';
    if length(bytes)>2097152 or not coalesce(case mime
      when 'image/png' then substring(bytes from 1 for 8)=decode('89504e470d0a1a0a','hex')
      when 'image/jpeg' then substring(bytes from 1 for 3)=decode('ffd8ff','hex')
      when 'application/pdf' then substring(bytes from 1 for 5)=decode('255044462d','hex')
      else false end,false) then
      raise exception 'Use PNG, JPEG or PDF attachments under 2 MiB';
    end if;
    result:=result || jsonb_build_array(jsonb_build_object('type',mime,'data',encode(bytes,'base64')));
  end loop;
  return result;
end $$;

create or replace function public.order_communication_action(
  p_order uuid,p_scope text,p_action text,p_id uuid,p_version integer,p_body text default '',
  p_category text default null,p_proposal jsonb default null,p_files jsonb default '[]',
  p_share_files boolean default false
) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  o public.orders%rowtype; r public.order_communication_requests%rowtype;
  next_status text; audience text[]; body text:=btrim(coalesce(p_body,''));
  new_proposal jsonb; files jsonb; source_id uuid; new_decision text; notice text; recipient text;
begin
  if not public.order_communication_access(p_order,p_scope) then raise exception 'Communication access denied'; end if;
  select * into o from public.orders where id=p_order for update;
  if not found or o.assigned_manufacturer_id is null or not public.order_communication_access(p_order,p_scope) then
    raise exception 'Communication unavailable for this order';
  end if;
  select * into r from public.order_communication_requests where id=p_id and order_id=p_order
    and factory_id=o.assigned_manufacturer_id for update;
  if not found then
    if p_scope<>'manufacturer' or p_action not in ('draft','submit') or p_version is distinct from 0 then
      raise exception 'Request unavailable';
    end if;
    insert into public.order_communication_requests(id,order_id,factory_id,created_by,category,status)
      values(p_id,p_order,o.assigned_manufacturer_id,auth.uid(),p_category,'draft') returning * into r;
  end if;
  if r.version is distinct from p_version then raise exception 'This request changed. Refresh and try again'; end if;
  if length(body)>5000 then raise exception 'Messages can contain up to 5,000 characters'; end if;
  if p_proposal is not null then
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
      if p_category in ('fabric','colour','moq','timeline','quotation') and new_proposal is null then
        raise exception 'Use a formal proposal to change order terms';
      end if;
      next_status:=case p_action when 'draft' then 'draft' else 'pending_review' end;
      if p_action='submit' then recipient:='admin'; notice:='Manufacturer request ready for review'; end if;
    when p_scope='manufacturer' and p_action='clarify' and r.status='clarification_requested' then
      next_status:='pending_review'; recipient:='admin'; notice:='Manufacturer clarification ready for review';
    when p_scope='admin' and p_action in ('approve','reject','request_clarification') and r.status='pending_review' then
      recipient:='manufacturer'; audience:=array['manufacturer'];
      if p_action='approve' then
        if (r.proposal is null)<>(new_proposal is null) or (new_proposal is not null and r.proposal->>'field'<>new_proposal->>'field') then
          raise exception 'Review the structured proposal before sending it';
        end if;
        select id into source_id from public.order_communication_events
          where request_id=r.id and action in ('submit','clarify') order by version desc limit 1;
        next_status:='awaiting_customer'; audience:=array['customer']; notice:='Ceriga sent your request to the customer';
      elsif p_action='reject' then next_status:='rejected'; notice:='Ceriga declined your request';
      else next_status:='clarification_requested'; notice:='Ceriga requested clarification'; end if;
    when p_scope='customer' and p_action in ('reply','accept','decline') and r.status='awaiting_customer' then
      if p_action='reply' and r.proposal is not null then raise exception 'Choose whether to accept or decline the proposal'; end if;
      if p_action<>'reply' and r.proposal is null then raise exception 'No formal proposal is awaiting a decision'; end if;
      new_decision:=case p_action when 'accept' then 'accepted' when 'decline' then 'declined' end;
      next_status:='customer_responded'; recipient:='admin'; notice:='Customer response ready for review';
    when p_scope='admin' and p_action in ('share_reply','return_reply') and r.status='customer_responded' then
      if p_action='share_reply' then
        select id into source_id from public.order_communication_events
          where request_id=r.id and action in ('reply','accept','decline') order by version desc limit 1;
        audience:=array['manufacturer','customer'];
        next_status:=case when r.decision='accepted' then 'customer_responded' else 'resolved' end;
        if exists(select 1 from public.order_communication_events where request_id=r.id and action='share_reply'
          and file_source=source_id) then raise exception 'This reply was already shared'; end if;
        recipient:='manufacturer'; notice:='Ceriga shared a reviewed customer response';
      else
        if exists(select 1 from public.order_communication_events where request_id=r.id and action='share_reply') then
          raise exception 'A published response cannot be returned';
        end if;
        audience:=array['customer']; next_status:='awaiting_customer';
        recipient:='customer'; notice:='Ceriga requested more information';
      end if;
    when p_scope='admin' and p_action='resolve' and r.status='customer_responded' and r.decision='accepted'
      and exists(select 1 from public.order_communication_events where request_id=r.id and action='share_reply') then
      -- Record the independent commercial workflow reference. This RPC cannot modify the accepted order.
      next_status:='resolved'; audience:=array[]::text[];
      recipient:='manufacturer'; notice:='Ceriga closed the proposal review';
    else raise exception 'This action is unavailable for the current request status';
  end case;
  if body='' and p_action not in ('draft','accept','decline') then raise exception 'Enter a message'; end if;
  if p_action not in ('draft','submit','clarify','reply','accept','decline') and p_files<>'[]'::jsonb then
    raise exception 'Only original submissions can include files';
  end if;
  files:=public.order_communication_files(p_files);
  if p_action in ('draft','submit') and files='[]' then
    select e.files into files from public.order_communication_events e
      where e.request_id=r.id and e.action='draft' order by version desc limit 1;
    files:=coalesce(files,'[]');
  end if;
  if p_action in ('approve','share_reply','return_reply') and
    (body || coalesce(new_proposal::text,'')) ~* '[[:alnum:]_.%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}' then
    raise exception 'Remove email addresses before sharing this message';
  end if;
  if p_action in ('approve','share_reply','return_reply') and
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
    category=case when p_action in ('draft','submit') then p_category else r.category end,
    proposal=case when p_action in ('draft','submit','approve') then new_proposal else r.proposal end,
    decision=case when p_action='return_reply' then null else coalesce(new_decision,r.decision) end
    where id=r.id;
  if recipient in ('admin','manufacturer') then
    insert into public.portal_notifications(audience,user_id,category,title,body,href,order_id)
      values(case recipient when 'admin' then 'superadmin' else recipient end,
        case when recipient='manufacturer' then r.factory_id end,'message',notice,'Open the order communication to review.',
        case recipient when 'admin' then '/superadmin/orders/communication?order='||p_order
          else '/manufacturer/orders/'||p_order||'#customer-communication' end,p_order);
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
      'createdAt',r.created_at,'status',case
        when p_scope='manufacturer' and r.status='customer_responded' and not exists(
          select 1 from public.order_communication_events e where e.request_id=r.id and e.action='share_reply'
        ) then 'awaiting_customer' else r.status end,
      'decision',case when p_scope<>'manufacturer' or exists(
        select 1 from public.order_communication_events e where e.request_id=r.id and e.action='share_reply'
      ) then r.decision end,
      'paid',o.payment_verified_at is not null,
      'canEdit',p_scope='manufacturer' and r.created_by=auth.uid(),
      'events',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',e.id,'action',e.action,'body',e.body,'at',e.created_at,'proposal',e.proposal,
        'files',(select coalesce(jsonb_agg(f.value->>'type' order by f.n),'[]')
          from jsonb_array_elements(case when e.share_files then src.files else e.files end) with ordinality f(value,n))
      ) order by e.version),'[]') from public.order_communication_events e
        left join public.order_communication_events src on src.id=e.file_source
        where e.request_id=r.id and (p_scope='admin' or (p_scope=any(e.audiences)
          and (e.action<>'draft' or r.created_by=auth.uid()))))
    ) order by r.created_at desc,r.id desc) from (
      select x.* from public.order_communication_requests x join public.orders assigned on assigned.id=x.order_id
      where x.order_id=p_order and (p_scope<>'manufacturer' or x.factory_id=assigned.assigned_manufacturer_id)
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
    and (p_scope<>'manufacturer' or o.assigned_manufacturer_id=r.factory_id)
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
      on o.id=r.order_id and o.assigned_manufacturer_id=r.factory_id
      where r.status in ('pending_review','customer_responded')),
    'rows',coalesce((select jsonb_agg(to_jsonb(q)) from (
      select r.id,r.order_id,r.category,r.status,r.updated_at,r.created_at,
        coalesce(f.factory_name,'Assigned manufacturer') as factory_name
      from public.order_communication_requests r
      join public.orders o on o.id=r.order_id and o.assigned_manufacturer_id=r.factory_id
      left join public.manufacturer_profiles f on f.user_id=r.factory_id
      where r.status in ('pending_review','customer_responded')
      order by r.updated_at,r.id limit 25 offset greatest(0,p_offset)
    ) q),'[]'));
end $$;

revoke all on function public.order_communication_access(uuid,text),public.order_communication_files(jsonb),
  public.order_communication_action(uuid,text,text,uuid,integer,text,text,jsonb,jsonb,boolean),
  public.order_communication_history(uuid,text,timestamptz,uuid),public.order_communication_attachment(uuid,integer,text),
  public.order_communication_queue(integer) from public,anon,authenticated;
grant execute on function public.order_communication_action(uuid,text,text,uuid,integer,text,text,jsonb,jsonb,boolean),
  public.order_communication_history(uuid,text,timestamptz,uuid),public.order_communication_attachment(uuid,integer,text),
  public.order_communication_queue(integer) to authenticated;

notify pgrst,'reload schema';
