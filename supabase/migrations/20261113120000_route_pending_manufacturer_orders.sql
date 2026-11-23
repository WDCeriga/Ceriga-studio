begin;

create or replace function public.try_auto_assign_order(p_order uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  chosen uuid;
  previous_routing_write text := current_setting('app.routing_write',true);
  previous_workflow_write text := current_setting('app.workflow_write',true);
  previous_routing_action text := current_setting('app.routing_action',true);
  due date := current_date+3;
begin
  if not exists(select 1 from public.orders where id=p_order and kind='production' and status='submitted' and assigned_manufacturer_id is null for update skip locked) then return; end if;

  -- Serialize automatic decisions so the next order sees the preceding opportunity.
  perform pg_advisory_xact_lock(73495120);
  select (candidate->>'id')::uuid into chosen
    from jsonb_array_elements(public.rank_manufacturers_for_order(p_order,due)->'candidates') candidate
    where (candidate->>'eligible')::boolean
      and not coalesce((candidate->>'quoteConflict')::boolean,false)
      and not coalesce((candidate->>'capacityShortfall')::boolean,false)
    order by (candidate->>'rank')::integer limit 1;
  if chosen is null then return; end if;

  perform public.check_factory_assignment(p_order,chosen,due);
  perform set_config('app.auto_assignment_write',p_order::text,true);
  perform set_config('app.routing_write',p_order::text,true);
  perform set_config('app.workflow_write',p_order::text,true);
  perform set_config('app.routing_action','assigned',true);
  update public.orders set assigned_manufacturer_id=chosen,assigned_at=now(),due_quote_by=due,
    factory_status='new',factory_reject_reason=null,status_label='Assigned to manufacturer'
    where id=p_order and assigned_manufacturer_id is null and status='submitted';
  update public.order_routing_events set details=details||'{"assignmentMode":"automatic"}'::jsonb
    where order_id=p_order and manufacturer_id=chosen and event_type='assigned' and created_at=now();
  perform set_config('app.auto_assignment_write','',true);
  perform set_config('app.routing_write',coalesce(previous_routing_write,''),true);
  perform set_config('app.workflow_write',coalesce(previous_workflow_write,''),true);
  perform set_config('app.routing_action',coalesce(previous_routing_action,''),true);
  return;
exception when others then
  -- A routing failure leaves the order intact and available for review.
  raise warning 'Automatic assignment failed for order % (SQLSTATE %)',p_order,sqlstate;
  return;
end;
$$;
revoke all on function public.try_auto_assign_order(uuid) from public,anon,authenticated;


create or replace function public.auto_assign_new_order()
returns trigger language plpgsql security definer set search_path='' as $$
declare mode text;
begin
  if new.kind<>'production' or new.status<>'submitted' or new.assigned_manufacturer_id is not null then
    return new;
  end if;
  select value #>> '{}' into mode from public.platform_settings
    where key='manufacturer_assignment_mode' for share;
  if mode='automatic' then perform public.try_auto_assign_order(new.id); end if;
  return new;
end;
$$;

create or replace function public.admin_assignment_mode(p_mode text default null)
returns text language plpgsql security definer set search_path='' as $$
declare
  mode text;
  pending record;
begin
  if not public.is_superadmin() then raise exception 'Superadmin authorization required' using errcode='42501'; end if;
  if p_mode is not null then
    if p_mode not in ('automatic','manual') then raise exception 'Invalid assignment mode'; end if;
    insert into public.platform_settings(key,value) values ('manufacturer_assignment_mode',to_jsonb(p_mode))
    on conflict (key) do update set value=excluded.value,updated_at=now();
    if p_mode='automatic' then
      for pending in select id from public.orders where kind='production' and status='submitted'
        and assigned_manufacturer_id is null order by created_at,id
      loop
        perform public.try_auto_assign_order(pending.id);
      end loop;
    end if;
  end if;
  select value #>> '{}' into mode from public.platform_settings where key='manufacturer_assignment_mode';
  return coalesce(mode,'manual');
end;
$$;
revoke all on function public.admin_assignment_mode(text) from public,anon;
grant execute on function public.admin_assignment_mode(text) to authenticated;


notify pgrst,'reload schema';
commit;
do $$
declare pending record;
begin
  if (select value #>> '{}' from public.platform_settings where key='manufacturer_assignment_mode')='automatic' then
    for pending in select id from public.orders where kind='production' and status='submitted'
      and assigned_manufacturer_id is null order by created_at,id
    loop
      perform public.try_auto_assign_order(pending.id);
    end loop;
  end if;
end;
$$;
