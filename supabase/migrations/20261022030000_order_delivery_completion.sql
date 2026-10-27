begin;
-- Reuse the brand inbox helper on older deployments.
create or replace function public.notify_brand(
  p_user_id uuid,
  p_category text,
  p_title text,
  p_body text,
  p_href text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.brand_notifications (user_id, category, title, body, href)
  values (p_user_id, p_category, p_title, p_body, p_href);
end;
$$;


revoke all on function public.notify_brand(uuid,text,text,text,text)from public,anon,authenticated;
alter table public.orders
 add column if not exists fully_dispatched_at timestamptz,
 add column if not exists completion_due_at timestamptz,
 add column if not exists completion_on_hold boolean not null default false,
 add column if not exists completion_hold_reason text,
 add column if not exists delivery_confirmed_at timestamptz,
 add column if not exists delivery_confirmed_by uuid references auth.users(id)on delete set null,
 add column if not exists delivery_confirmation_note text,
 add column if not exists completed_at timestamptz,
 add column if not exists completion_method text check(completion_method in('admin_delivery','automatic'));
create index if not exists orders_completion_due_idx on public.orders(completion_due_at)where status='shipping'and not completion_on_hold;

-- Use the latest approved production version and actual, non-revoked handovers.
create or replace function public.order_dispatch_is_complete(p_order uuid)returns boolean language plpgsql stable security definer set search_path=public as $$
declare o public.orders%rowtype;i public.qc_inspections%rowtype;required bigint;sent bigint;
begin
 select * into o from public.orders where id=p_order;
 if not found or o.kind<>'production'or o.qc_status<>'approved'or o.production_released_at is null then return false;end if;
 select * into i from public.qc_inspections where order_id=p_order and workflow_version=2 order by report_version desc limit 1;
 if found then
  if i.qc_status<>'approved'or i.order_snapshot is distinct from public.qc_order_snapshot(p_order)or i.manufacturer_id is distinct from o.assigned_manufacturer_id then return false;end if;
  required:=i.produced;
  select coalesce(sum(quantity),0)into sent from public.qc_shipment_releases where order_id=p_order and inspection_id=i.id and dispatched_at is not null and revoked_at is null;
 else
  select (v->>'totalUnits')::bigint into required from jsonb_array_elements(coalesce(o.price_options,'[]'))v where v->>'id'=o.selected_price_option_id;
  select coalesce(sum(r.quantity),0)into sent from public.qc_shipment_releases r join public.qc_inspections old_i on old_i.id=r.inspection_id where r.order_id=p_order and r.dispatched_at is not null and r.revoked_at is null and old_i.result='passed';
 end if;
 return coalesce(required>0 and sent>=required,false);
end $$;
revoke all on function public.order_dispatch_is_complete(uuid)from public,anon,authenticated;

create or replace function public.guard_order_completion()returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  if new.fully_dispatched_at is not null or new.completion_due_at is not null or new.completed_at is not null or new.completion_method is not null or new.delivery_confirmed_at is not null or new.delivery_confirmed_by is not null or new.completion_on_hold or new.completion_hold_reason is not null or new.delivery_confirmation_note is not null then raise exception 'Completion is managed by the delivery workflow';end if;return new;
 end if;
 if pg_trigger_depth()>1 and new.delivery_confirmed_by is null and (to_jsonb(new)-'delivery_confirmed_by')=(to_jsonb(old)-'delivery_confirmed_by')then return new;end if;
 if (new.fully_dispatched_at,new.completion_due_at,new.completion_on_hold,new.completion_hold_reason,new.delivery_confirmed_at,new.delivery_confirmed_by,new.delivery_confirmation_note,new.completed_at,new.completion_method)is distinct from(old.fully_dispatched_at,old.completion_due_at,old.completion_on_hold,old.completion_hold_reason,old.delivery_confirmed_at,old.delivery_confirmed_by,old.delivery_confirmation_note,old.completed_at,old.completion_method)and current_setting('app.delivery_write',true)is distinct from new.id::text then raise exception 'Use authorised delivery completion actions';end if;
 if new.kind<>'production'then return new;end if;
 if old.status='completed'and new.status is distinct from old.status then raise exception 'Completed orders cannot be reopened through status edits';end if;
 if new.status='completed'and old.status<>'completed'and current_setting('app.delivery_write',true)is distinct from new.id::text then raise exception 'Confirm delivery or use the automatic completion worker';end if;
 -- Existing shipped orders are not backdated/enrolled by this migration. New complete handovers start a 14-day window.
 if current_setting('app.qc_write',true)=new.id::text and new.status='shipping'and (old.status<>'shipping'or old.fully_dispatched_at is null)and public.order_dispatch_is_complete(new.id)then
  select max(dispatched_at)into new.fully_dispatched_at from public.qc_shipment_releases where order_id=new.id and dispatched_at is not null and revoked_at is null;
  if new.completion_due_at is null then new.completion_due_at:=new.fully_dispatched_at+interval '14 days';end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_order_completion()from public,anon,authenticated;
drop trigger if exists orders_delivery_completion_guard on public.orders;
create trigger orders_delivery_completion_guard before insert or update on public.orders for each row execute function public.guard_order_completion();

create or replace function public.finish_order_completion(p_order uuid,p_automatic boolean,p_note text default '')returns uuid language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;method text;actor uuid;
begin
 select * into o from public.orders where id=p_order for update;
 if not found then raise exception 'Order not found';end if;
 if o.status='completed'then
  if not p_automatic and o.completion_method='automatic'then raise exception 'This order already completed automatically; refresh to see its completion record';end if;
  return p_order;
 end if;
 if o.status<>'shipping'or not public.order_dispatch_is_complete(p_order)then raise exception 'QC approval and dispatch of every approved unit are required before completion';end if;
 if p_automatic and (o.completion_due_at is null or o.completion_due_at>now()or o.completion_on_hold)then raise exception 'The automatic completion deadline has not been reached or is paused';end if;
 if length(coalesce(p_note,''))>6000 then raise exception 'Delivery notes must be 6000 characters or fewer';end if;
 actor:=case when p_automatic then null else auth.uid()end;method:=case when p_automatic then 'automatic'else 'admin_delivery'end;
 perform set_config('app.delivery_write',p_order::text,true);perform set_config('app.qc_write',p_order::text,true);perform set_config('app.routing_write',p_order::text,true);perform set_config('app.workflow_write',p_order::text,true);
 update public.orders set status='completed',factory_status='completed',status_label=case when p_automatic then 'Completed automatically — delivery window elapsed'else 'Delivered — completed'end,
  completed_at=now(),completion_method=method,delivery_confirmed_at=case when p_automatic then null else now()end,delivery_confirmed_by=actor,delivery_confirmation_note=btrim(coalesce(p_note,'')),completion_on_hold=false where id=p_order;
 insert into public.qc_audit_events(order_id,actor_id,action,details)values(p_order,actor,'order_completed',jsonb_build_object('method',method,'note',coalesce(p_note,''),'deadline',o.completion_due_at));
 perform public.notify_brand(o.user_id,'order','Order completed',o.product_name||case when p_automatic then ' — automatically completed after the dispatch review window.'else ' — delivery confirmed by Ceriga.'end,'/orders/'||p_order);
 if o.assigned_manufacturer_id is not null then perform public.notify_manufacturer(o.assigned_manufacturer_id,'order','Order completed',o.product_name,'/manufacturer/orders/'||p_order,p_order);end if;
 if p_automatic then perform public.notify_superadmin('order','Order completed automatically',o.product_name,'/superadmin/quality-control/'||p_order,p_order);end if;
 return p_order;
end $$;
revoke all on function public.finish_order_completion(uuid,boolean,text)from public,anon,authenticated,service_role;
create or replace function public.confirm_order_delivery(p_order_id uuid,p_note text default '')returns uuid language plpgsql security definer set search_path=public as $$begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 return public.finish_order_completion(p_order_id,false,p_note);
end $$;
revoke all on function public.confirm_order_delivery(uuid,text)from public,anon;grant execute on function public.confirm_order_delivery(uuid,text)to authenticated;

create or replace function public.set_order_completion_deadline(p_order_id uuid,p_due_at timestamptz,p_hold boolean default false,p_reason text default '')returns uuid language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;handover timestamptz;
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.status<>'shipping'or not public.order_dispatch_is_complete(p_order_id)then raise exception 'Only fully dispatched, QC-approved orders can have a completion deadline';end if;
 if p_hold is null then raise exception 'Choose whether automatic completion is paused';end if;
 if p_hold and length(btrim(coalesce(p_reason,'')))not between 3 and 6000 then raise exception 'Explain why automatic completion is paused';end if;
 if not p_hold and (p_due_at is null or p_due_at<=now()or p_due_at>now()+interval '90 days')then raise exception 'Choose a future deadline within the next 90 days';end if;
 select max(dispatched_at)into handover from public.qc_shipment_releases where order_id=p_order_id and dispatched_at is not null and revoked_at is null;
 perform set_config('app.delivery_write',p_order_id::text,true);perform set_config('app.qc_write',p_order_id::text,true);perform set_config('app.workflow_write',p_order_id::text,true);perform set_config('app.routing_write',p_order_id::text,true);
 update public.orders set fully_dispatched_at=coalesce(fully_dispatched_at,handover),completion_due_at=case when p_hold then coalesce(o.completion_due_at,p_due_at)else p_due_at end,completion_on_hold=p_hold,completion_hold_reason=case when p_hold then btrim(p_reason)else null end where id=p_order_id;
 insert into public.qc_audit_events(order_id,actor_id,action,details)values(p_order_id,auth.uid(),'completion_deadline_updated',jsonb_build_object('previous_deadline',o.completion_due_at,'deadline',case when p_hold then coalesce(o.completion_due_at,p_due_at)else p_due_at end,'paused',p_hold,'reason',p_reason));
 return p_order_id;
end $$;
revoke all on function public.set_order_completion_deadline(uuid,timestamptz,boolean,text)from public,anon;grant execute on function public.set_order_completion_deadline(uuid,timestamptz,boolean,text)to authenticated;

create or replace function public.complete_due_orders()returns integer language plpgsql security definer set search_path=public as $$
declare target record;completed integer:=0;
begin
 for target in select id from public.orders where kind='production'and status='shipping'and fully_dispatched_at is not null and completion_due_at<=now()and not completion_on_hold order by completion_due_at for update skip locked limit 200 loop
  if public.order_dispatch_is_complete(target.id)then perform public.finish_order_completion(target.id,true,'Automatic dispatch review deadline reached');completed:=completed+1;end if;
 end loop;
 return completed;
end $$;
revoke all on function public.complete_due_orders()from public,anon,authenticated;grant execute on function public.complete_due_orders()to service_role;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('ceriga-complete-delivery-orders','*/5 * * * *','select public.complete_due_orders();');
notify pgrst,'reload schema';
commit;
