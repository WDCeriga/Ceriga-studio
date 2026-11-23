-- R02 / R08 / R11: internal readiness and waiting-state projections.
begin;
create or replace function public.admin_manufacturer_matching(p_order uuid,p_due date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required'using errcode='42501';end if;
 return public.rank_manufacturers_for_order(p_order,p_due)||jsonb_build_object('comparisonReleaseReady',
  coalesce((select enabled from public.order_payment_controls where id=true),false));
end$$;

create or replace function public.order_communication_queue(p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if not coalesce(public.is_superadmin(),false)then raise exception 'Communication access denied'using errcode='42501';end if;
 return jsonb_build_object(
 'pending',(select count(*)from public.order_communication_requests r
  where r.status in('pending_review','customer_responded')and public.order_communication_factory_active(r.order_id,r.factory_id)),
 'rows',coalesce((select jsonb_agg(to_jsonb(q))from(
  select r.id,r.order_id,r.category,r.status,r.updated_at,r.created_at,r.impact,
   coalesce(f.factory_name,'Assigned manufacturer')factory_name,
   (r.decision='accepted'and(select e.action from public.order_communication_events e where e.request_id=r.id order by e.version desc limit 1)='share_reply')amendment,
   (select coalesce(nullif(p.full_name,''),'Ceriga')from public.order_internal_work w left join public.profiles p on p.id=w.owner_id where w.request_id=r.id order by w.updated_at desc limit 1)owner_name
  from public.order_communication_requests r left join public.manufacturer_profiles f on f.user_id=r.factory_id
  where r.status in('pending_review','customer_responded')and public.order_communication_factory_active(r.order_id,r.factory_id)
  order by(r.impact='blocking')desc nulls last,r.updated_at,r.id limit 25 offset greatest(0,p_offset)
 )q),'[]'));
end$$;

do $board$
declare d text;
begin
 d:=pg_get_functiondef('public.factory_fulfilment_board(text,text,integer)'::regprocedure);
 if position('o.completion_method' in d)=0 then
  if position('o.created_at,o.tracking' in d)=0 then raise exception 'Unexpected fulfilment projection';end if;
  d:=replace(d,'o.created_at,o.tracking','o.created_at,o.tracking,o.completion_method');execute d;
 end if;
end$board$;
notify pgrst,'reload schema';
commit;
