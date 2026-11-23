begin;

alter table public.order_communication_events add column if not exists language text
  check (language in ('en','zh-CN','tr','pt','es','fr'));

create or replace function public.order_communication_localized_action(
  p_order uuid, p_scope text, p_action text, p_id uuid, p_version integer,
  p_body text default '', p_category text default null, p_proposal jsonb default null,
  p_files jsonb default '[]', p_share_files boolean default false, p_language text default null
) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare result uuid;
begin
  if p_language is not null and p_language not in ('en','zh-CN','tr','pt','es','fr') then
    raise exception 'Unsupported message language' using errcode='22023';
  end if;
  result := public.order_communication_action(
    p_order,p_scope,p_action,p_id,p_version,p_body,p_category,p_proposal,p_files,p_share_files
  );
  update public.order_communication_events e
    set language=p_language
    from public.order_communication_requests r
    where r.id=result and e.request_id=r.id and e.version=r.version and e.actor_id=auth.uid();
  return result;
end $$;

revoke all on function public.order_communication_localized_action(uuid,text,text,uuid,integer,text,text,jsonb,jsonb,boolean,text)
  from public,anon,authenticated;
grant execute on function public.order_communication_localized_action(uuid,text,text,uuid,integer,text,text,jsonb,jsonb,boolean,text)
  to authenticated;

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
        'id',e.id,'action',e.action,'body',e.body,'at',e.created_at,'proposal',e.proposal,'language',e.language,
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

notify pgrst,'reload schema';
commit;
