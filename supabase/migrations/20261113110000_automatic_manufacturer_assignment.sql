begin;

-- Keep the matching algorithm private, with a separate admin-only read endpoint.
do $$
declare definition text;
begin
  if to_regprocedure('public.rank_manufacturers_for_order(uuid,date)') is null then
    definition := pg_get_functiondef('public.admin_manufacturer_matching(uuid,date)'::regprocedure);
    definition := replace(definition, 'public.admin_manufacturer_matching(', 'public.rank_manufacturers_for_order(');
    definition := replace(definition,
      '  if not public.is_superadmin() then raise exception ''Superadmin authorization required'' using errcode=''42501''; end if;',
      '');
    execute definition;
  end if;
end;
$$;
revoke all on function public.rank_manufacturers_for_order(uuid,date) from public, anon, authenticated;

create or replace function public.admin_manufacturer_matching(p_order uuid,p_due date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_superadmin() then raise exception 'Superadmin authorization required' using errcode='42501'; end if;
  return public.rank_manufacturers_for_order(p_order,p_due);
end;
$$;

insert into public.platform_settings(key,value)
values ('manufacturer_assignment_mode','"automatic"')
on conflict (key) do nothing;

create or replace function public.admin_assignment_mode(p_mode text default null)
returns text language plpgsql security definer set search_path='' as $$
declare mode text;
begin
  if not public.is_superadmin() then raise exception 'Superadmin authorization required' using errcode='42501'; end if;
  if p_mode is not null then
    if p_mode not in ('automatic','manual') then raise exception 'Invalid assignment mode'; end if;
    insert into public.platform_settings(key,value) values ('manufacturer_assignment_mode',to_jsonb(p_mode))
    on conflict (key) do update set value=excluded.value,updated_at=now();
  end if;
  select value #>> '{}' into mode from public.platform_settings where key='manufacturer_assignment_mode';
  return coalesce(mode,'manual');
end;
$$;
revoke all on function public.admin_assignment_mode(text) from public,anon;
grant execute on function public.admin_assignment_mode(text) to authenticated;

-- The marker is only honoured for writes made by a privileged database function.
-- Direct browser writes still require the existing admin/worker authorization.
create or replace function public.protect_manual_order_assignment()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is not null and not public.is_superadmin()
    and not (coalesce(current_setting('app.routing_write',true)=new.id::text,false)
      and public.platform_worker_can('orders.assign',new.id))
    and not (current_user not in ('authenticated','anon','service_role') and tg_op='UPDATE'
      and coalesce(current_setting('app.auto_assignment_write',true)=new.id::text,false)) then
    if (tg_op='INSERT' and (new.assigned_manufacturer_id is not null or new.assigned_at is not null or new.due_quote_by is not null))
      or (tg_op='UPDATE' and (new.assigned_manufacturer_id,new.assigned_at,new.due_quote_by)
        is distinct from (old.assigned_manufacturer_id,old.assigned_at,old.due_quote_by)) then
      raise exception 'Only a superadmin may assign a manufacturer or change its quotation deadline';
    end if;
  end if;
  if new.assigned_manufacturer_id is not null
    and (tg_op='INSERT' or new.assigned_manufacturer_id is distinct from old.assigned_manufacturer_id)
    and not exists(select 1 from public.manufacturer_profiles m where m.user_id=new.assigned_manufacturer_id
      and m.onboarding_complete and m.status is distinct from 'paused') then
    raise exception 'Choose an onboarded, available manufacturer';
  end if;
  return new;
end;
$$;

create or replace function public.auto_assign_new_order()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  mode text;
  chosen uuid;
  previous_routing_write text := current_setting('app.routing_write',true);
  previous_workflow_write text := current_setting('app.workflow_write',true);
  previous_routing_action text := current_setting('app.routing_action',true);
  due date := current_date+3;
begin
  if new.kind<>'production' or new.status<>'submitted' or new.assigned_manufacturer_id is not null then
    return new;
  end if;
  select value #>> '{}' into mode from public.platform_settings
    where key='manufacturer_assignment_mode' for share;
  if mode is distinct from 'automatic' then return new; end if;

  -- Serialize automatic decisions so the next order sees the preceding opportunity.
  perform pg_advisory_xact_lock(73495120);
  select (candidate->>'id')::uuid into chosen
    from jsonb_array_elements(public.rank_manufacturers_for_order(new.id,due)->'candidates') candidate
    where (candidate->>'eligible')::boolean
      and not coalesce((candidate->>'quoteConflict')::boolean,false)
      and not coalesce((candidate->>'capacityShortfall')::boolean,false)
    order by (candidate->>'rank')::integer limit 1;
  if chosen is null then return new; end if;

  perform public.check_factory_assignment(new.id,chosen,due);
  perform set_config('app.auto_assignment_write',new.id::text,true);
  perform set_config('app.routing_write',new.id::text,true);
  perform set_config('app.workflow_write',new.id::text,true);
  perform set_config('app.routing_action','assigned',true);
  update public.orders set assigned_manufacturer_id=chosen,assigned_at=now(),due_quote_by=due,
    factory_status='new',factory_reject_reason=null,status_label='Assigned to manufacturer'
    where id=new.id and assigned_manufacturer_id is null and status='submitted';
  update public.order_routing_events set details=details||'{"assignmentMode":"automatic"}'::jsonb
    where order_id=new.id and manufacturer_id=chosen and event_type='assigned' and created_at=now();
  perform set_config('app.auto_assignment_write','',true);
  perform set_config('app.routing_write',coalesce(previous_routing_write,''),true);
  perform set_config('app.workflow_write',coalesce(previous_workflow_write,''),true);
  perform set_config('app.routing_action',coalesce(previous_routing_action,''),true);
  return new;
exception when others then
  -- A routing failure leaves the order intact and available for review.
  raise warning 'Automatic assignment failed for order % (SQLSTATE %)',new.id,sqlstate;
  return new;
end;
$$;
revoke all on function public.auto_assign_new_order() from public,anon,authenticated;

drop trigger if exists zz_auto_assign_new_order on public.orders;
create trigger zz_auto_assign_new_order after insert on public.orders
for each row execute function public.auto_assign_new_order();

-- INSERT RETURNING contains the pre-trigger row. Return the saved assignment.
do $$
declare definition text;
begin
  definition := pg_get_functiondef('public.create_customer_order(jsonb)'::regprocedure);
  if position('select saved.* into o' in definition)=0 then
    definition := replace(definition, 'return to_jsonb(public.account_order_projection(o));',
      'select saved.* into o from public.orders saved where saved.id=o.id; return to_jsonb(public.account_order_projection(o));');
    execute definition;
  end if;
end;
$$;

notify pgrst,'reload schema';
commit;
