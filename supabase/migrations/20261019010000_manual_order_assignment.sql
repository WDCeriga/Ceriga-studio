-- The existing orders row remains the single assignment record. No order data is rewritten.
begin;
alter table public.orders enable row level security;
grant select on public.orders to authenticated;
drop policy if exists orders_read_assigned_factory on public.orders;
create policy orders_read_assigned_factory on public.orders for select to authenticated using(auth.uid()=assigned_manufacturer_id);
drop policy if exists order_uploads_read_assigned_factory on storage.objects;
create policy order_uploads_read_assigned_factory on storage.objects for select to authenticated using(
 bucket_id='order-uploads' and exists(select 1 from public.orders o where o.assigned_manufacturer_id=auth.uid() and coalesce(o.quote_request->'storagePaths','[]'::jsonb) ? name)
);
-- Assignment decisions belong to allowlisted superadmins, including direct API requests.
create or replace function public.protect_manual_order_assignment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and not public.is_superadmin() then
  if (tg_op='INSERT' and (new.assigned_manufacturer_id is not null or new.assigned_at is not null or new.due_quote_by is not null)) or (tg_op='UPDATE' and (new.assigned_manufacturer_id is distinct from old.assigned_manufacturer_id or new.assigned_at is distinct from old.assigned_at or new.due_quote_by is distinct from old.due_quote_by)) then raise exception 'Only a superadmin may assign a manufacturer or change its quotation deadline';end if;
 end if;
 if new.assigned_manufacturer_id is not null and (tg_op='INSERT' or new.assigned_manufacturer_id is distinct from old.assigned_manufacturer_id) and not exists(select 1 from public.manufacturer_profiles m where m.user_id=new.assigned_manufacturer_id and m.onboarding_complete and m.status is distinct from 'paused') then raise exception 'Choose an onboarded, available manufacturer';end if;
 return new;
end $$;
drop trigger if exists orders_assignment_admin_only on public.orders;
create trigger orders_assignment_admin_only before insert or update on public.orders for each row execute function public.protect_manual_order_assignment();

notify pgrst,'reload schema';
commit;
