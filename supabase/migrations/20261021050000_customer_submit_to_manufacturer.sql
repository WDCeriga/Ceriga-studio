begin;
alter table public.orders add column if not exists manufacturer_submitted_at timestamptz;
alter table public.order_payment_controls add column if not exists submission_without_payment_enabled boolean not null default true;

create or replace function public.guard_manufacturer_submission() returns trigger language plpgsql set search_path=public as $$
begin
 if (tg_op='INSERT' and new.manufacturer_submitted_at is not null) or (tg_op='UPDATE' and new.manufacturer_submitted_at is distinct from old.manufacturer_submitted_at) then
  if current_setting('app.manufacturer_submission_write',true) is distinct from new.id::text then raise exception 'Use the customer submission action';end if;
 end if;
 return new;
end $$;
drop trigger if exists orders_guard_manufacturer_submission on public.orders;
create trigger orders_guard_manufacturer_submission before insert or update on public.orders for each row execute function public.guard_manufacturer_submission();

create or replace function public.submit_order_to_manufacturer(p_order_id uuid,p_option_id text)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; chosen jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to submit an order';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.user_id is distinct from auth.uid() then raise exception 'This order does not belong to your account';end if;
 if target.manufacturer_submitted_at is not null then
  if target.selected_price_option_id=p_option_id and target.status in('processing','shipping','completed') then return target.id;end if;
  raise exception 'This order has already been submitted';
 end if;
 if not coalesce((select submission_without_payment_enabled from public.order_payment_controls where id=true),false) then raise exception 'Submission without payment is currently disabled';end if;
 if target.kind<>'production' or target.status<>'priced' or target.priced_at is null or target.quote_expires_at is null or now()>=target.quote_expires_at or target.assigned_manufacturer_id is null or target.factory_status is distinct from 'quoted' then raise exception 'A current approved quote and assigned manufacturer are required';end if;
 if not exists(select 1 from public.manufacturer_profiles where user_id=target.assigned_manufacturer_id and onboarding_complete and status is distinct from 'paused') then raise exception 'The manufacturer is unavailable. Ask Ceriga to review your order';end if;
 select value into chosen from jsonb_array_elements(coalesce(target.price_options,'[]')) where value->>'id'=p_option_id;
 if chosen is null or coalesce(chosen->>'totalUnits','')!~'^[1-9][0-9]*$' or coalesce(chosen->>'priceCents','')!~'^[1-9][0-9]*$' then raise exception 'Choose an approved sample or bulk option';end if;
 perform set_config('app.routing_write',target.id::text,true);
 perform set_config('app.workflow_write',target.id::text,true);
 perform set_config('app.manufacturer_submission_write',target.id::text,true);
 perform set_config('app.routing_action','customer_submitted_to_manufacturer',true);
 update public.orders set status='processing',status_label='Submitted to manufacturer',factory_status='in_production',selected_price_option_id=p_option_id,manufacturer_submitted_at=now(),production_released_at=now() where id=target.id;
 -- No payment amount, verification timestamp or payment receipt is created.
 return target.id;
end $$;
revoke all on function public.submit_order_to_manufacturer(uuid,text) from public,anon;
grant execute on function public.submit_order_to_manufacturer(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
