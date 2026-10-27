begin;

-- Reproduce deployed legacy guard columns without changing any existing order.
alter table public.orders add column if not exists workflow_managed boolean not null default false;
alter table public.manufacturer_profiles add column if not exists commission_plan_id text;

create or replace function public.guard_profile_entitlements() returns trigger
language plpgsql set search_path=public as $$
begin
 if current_user in('authenticated','anon') and not public.is_superadmin() then
  if tg_op='INSERT' then
   if new.role<>'brand' or new.message_credits<>0 or new.email is distinct from auth.jwt()->>'email' then raise exception 'Account entitlements are managed by Ceriga';end if;
  elsif (new.role,new.message_credits,new.email,new.id) is distinct from (old.role,old.message_credits,old.email,old.id) then
   raise exception 'Account roles, email and credits require an authorised server action';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists profiles_entitlement_guard on public.profiles;
create trigger profiles_entitlement_guard before insert or update on public.profiles for each row execute function public.guard_profile_entitlements();
revoke all on function public.guard_profile_entitlements() from public,anon,authenticated;

create or replace function public.admin_update_profile(p_user_id uuid,p_patch jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_superadmin() then raise exception 'Superadmin authorization required';end if;
 if jsonb_typeof(p_patch) is distinct from 'object' or p_patch-array['role','message_credits','full_name']<>'{}' then raise exception 'Unsupported profile fields';end if;
 if p_patch?'role' and coalesce(p_patch->>'role','') not in('brand','manufacturer','worker') then raise exception 'Invalid account role';end if;
 if p_patch?'message_credits' and (coalesce(p_patch->>'message_credits','')!~'^[0-9]{1,9}$')then raise exception 'Credits must be a non-negative whole number';end if;
 if p_patch?'full_name' and length(coalesce(p_patch->>'full_name',''))>200 then raise exception 'Name is too long';end if;
 update public.profiles set role=case when p_patch?'role' then p_patch->>'role' else role end,
 message_credits=case when p_patch?'message_credits'then(p_patch->>'message_credits')::integer else message_credits end,
 full_name=case when p_patch?'full_name'then nullif(btrim(p_patch->>'full_name'),'')else full_name end where id=p_user_id;
 if not found then raise exception 'Account not found';end if;
 return p_user_id;
end $$;
revoke all on function public.admin_update_profile(uuid,jsonb)from public,anon;
grant execute on function public.admin_update_profile(uuid,jsonb)to authenticated;

create or replace function public.wf_guard_factory_status() returns trigger
language plpgsql set search_path=public as $$
begin
 if current_user in('authenticated','anon')and not public.is_superadmin()then
  if tg_op='INSERT'then
   if new.status<>'onboarding'or new.onboarding_complete or new.commission_plan_id is not null or not exists(select 1 from public.profiles where id=auth.uid()and role='manufacturer') then raise exception 'Only Ceriga may set factory eligibility or commission plans';end if;
  elsif (new.status,new.commission_plan_id,new.onboarding_complete) is distinct from(old.status,old.commission_plan_id,old.onboarding_complete)then raise exception 'Only Ceriga may change factory eligibility or commission plans';end if;
 end if;
 return new;
end $$;
drop trigger if exists wf_guard_factory_status on public.manufacturer_profiles;
create trigger wf_guard_factory_status before insert or update on public.manufacturer_profiles for each row execute function public.wf_guard_factory_status();
revoke all on function public.wf_guard_factory_status()from public,anon,authenticated;

create or replace function public.wf_protect_order()returns trigger language plpgsql set search_path=public as $$
begin
 if current_user not in('authenticated','anon')or public.is_superadmin()then return new;end if;
 if tg_op='INSERT'then
  if new.status not in('submitted','awaiting_payment')or new.paid_amount_cents is not null or new.payment_verified_at is not null or new.production_released_at is not null or new.workflow_managed then raise exception 'Use the controlled order workflow';end if;
 elsif (to_jsonb(new)-array['updated_at','quote_request','specifications','order_quantities','contact_name','contact_email','contact_phone','delivery_address']) is distinct from(to_jsonb(old)-array['updated_at','quote_request','specifications','order_quantities','contact_name','contact_email','contact_phone','delivery_address'])then
  raise exception 'Use authorised order actions';
 elsif old.user_id is distinct from auth.uid()or old.status not in('submitted','awaiting_payment')or old.assigned_manufacturer_id is not null then raise exception 'Ask Ceriga to revise an assigned order';end if;
 return new;
end $$;
drop trigger if exists wf_protect_order on public.orders;
create trigger wf_protect_order before insert or update on public.orders for each row execute function public.wf_protect_order();
revoke all on function public.wf_protect_order()from public,anon,authenticated;

-- This projection is also used for histories: internal snapshots stay immutable.
create or replace function public.public_price_options(p_options jsonb,p_factory boolean default false)returns jsonb
language sql immutable set search_path=public as $$
 select case when p_options is null then null else coalesce(jsonb_agg(
 case when p_factory then value-array['priceCents','currencySnapshot','currency','shippingQuoteCents','taxCents','feesCents']
 else (value-'currencySnapshot')||case when value?'currencySnapshot'then jsonb_build_object('currencySnapshot',(value->'currencySnapshot')-array['originalManufacturerCents','markupCents','shippingIncludedInManufacturerQuote'])else '{}'::jsonb end end),'[]'::jsonb)end
 from jsonb_array_elements(coalesce(p_options,'[]'::jsonb))
$$;
revoke all on function public.public_price_options(jsonb,boolean)from public,anon;
grant execute on function public.public_price_options(jsonb,boolean)to authenticated;
create or replace function public.account_order_projection(p_order public.orders)returns public.orders
language plpgsql stable security definer set search_path=public as $$
declare result public.orders%rowtype;factory boolean;
begin
 if auth.uid() is null then raise exception 'Sign in to view orders';end if;
 if not(public.is_superadmin()or p_order.user_id=auth.uid()or p_order.assigned_manufacturer_id=auth.uid())then raise exception 'Order access denied';end if;
 result:=p_order;
 if public.is_superadmin()then return result;end if;
 factory:=p_order.assigned_manufacturer_id=auth.uid()and p_order.user_id<>auth.uid();
 result.ops_notes:=null;
 result.price_options:=public.public_price_options(p_order.price_options,coalesce(factory,false));
 if factory then result.paid_amount_cents:=null;result.total:=null;result.paid_currency:=null;result.total_currency:=null;
 else result.manufacturer_quote:=null;result.factory_reject_reason:=null;end if;
 return result;
end $$;
revoke all on function public.account_order_projection(public.orders)from public,anon;
grant execute on function public.account_order_projection(public.orders)to authenticated;
create or replace view public.account_orders with(security_barrier=true)as
 select projected.* from public.orders o cross join lateral public.account_order_projection(o) projected
 where auth.uid()is not null and(public.is_superadmin()or o.user_id=auth.uid()or o.assigned_manufacturer_id=auth.uid());
revoke all on public.account_orders from public,anon;
grant select on public.account_orders to authenticated;
create or replace view public.account_quote_history with(security_barrier=true)as
 select h.id,h.order_id,h.created_at,h.expires_at,h.target_currency,
 case when public.is_superadmin()then h.options else public.public_price_options(h.options,false)end options,
 case when public.is_superadmin()then h.manufacturer_quote else null::jsonb end manufacturer_quote
 from public.order_quote_currency_snapshots h join public.orders o on o.id=h.order_id
 where auth.uid()is not null and(public.is_superadmin()or o.user_id=auth.uid());
revoke all on public.account_quote_history from public,anon;
grant select on public.account_quote_history to authenticated;

create or replace function public.create_customer_order(p_input jsonb)returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;kind_value text;
begin
 if auth.uid()is null then raise exception 'Sign in to create an order';end if;
 kind_value:=p_input->>'kind';
 if kind_value not in('production','tech-pack')or kind_value is null or length(btrim(coalesce(p_input->>'product_name','')))not between 1 and 300 then raise exception 'A valid order type and product name are required';end if;
 insert into public.orders(user_id,kind,product_name,garment_type,product_id,status,status_label,order_quantities,quote_request,specifications,contact_name,contact_email,contact_phone,delivery_address,export_format)
 values(auth.uid(),kind_value,btrim(p_input->>'product_name'),coalesce(p_input->>'garment_type',''),p_input->>'product_id','submitted','Awaiting review',p_input->'order_quantities',p_input->'quote_request',p_input->'specifications',p_input->>'contact_name',p_input->>'contact_email',p_input->>'contact_phone',p_input->'delivery_address',p_input->>'export_format')returning * into o;
 return to_jsonb(public.account_order_projection(o));
end $$;
revoke all on function public.create_customer_order(jsonb)from public,anon;
grant execute on function public.create_customer_order(jsonb)to authenticated;

create or replace function public.patch_account_order(p_order_id uuid,p_patch jsonb)returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;updated public.orders%rowtype;path text;allowed text[];
begin
 if auth.uid()is null then raise exception 'Sign in to edit an order';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order not found';end if;
 if public.is_superadmin()then allowed:=array['ops_notes','status_label','download_ready','export_format'];
 elsif o.user_id=auth.uid()and o.status in('submitted','awaiting_payment')and o.assigned_manufacturer_id is null then allowed:=array['quote_request','specifications','order_quantities','contact_name','contact_email','contact_phone','delivery_address','export_format'];
 else raise exception 'Use the authorised quotation, production or delivery action';end if;
 if jsonb_typeof(p_patch)is distinct from 'object'or p_patch-allowed<>'{}'then raise exception 'These order fields require a controlled workflow action';end if;
 if p_patch?'quote_request'then
  for path in select jsonb_array_elements_text(coalesce(p_patch->'quote_request'->'storagePaths','[]'))loop
   if split_part(path,'/',1)<>o.user_id::text or split_part(path,'/',2)<>o.id::text then raise exception 'Files must belong to this order and customer';end if;
  end loop;
 end if;
 updated:=jsonb_populate_record(o,p_patch);
 perform set_config('app.workflow_write',p_order_id::text,true);perform set_config('app.routing_write',p_order_id::text,true);
 update public.orders set ops_notes=updated.ops_notes,status_label=updated.status_label,download_ready=updated.download_ready,export_format=updated.export_format,
 quote_request=updated.quote_request,specifications=updated.specifications,order_quantities=updated.order_quantities,contact_name=updated.contact_name,contact_email=updated.contact_email,contact_phone=updated.contact_phone,delivery_address=updated.delivery_address where id=p_order_id returning * into updated;
 return to_jsonb(public.account_order_projection(updated));
end $$;
revoke all on function public.patch_account_order(uuid,jsonb)from public,anon;
grant execute on function public.patch_account_order(uuid,jsonb)to authenticated;
create or replace function public.admin_delete_order(p_order_id uuid)returns uuid language plpgsql security definer set search_path=public as $$
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 delete from public.orders where id=p_order_id;if not found then raise exception 'Order not found';end if;return p_order_id;
end $$;
revoke all on function public.admin_delete_order(uuid)from public,anon;
grant execute on function public.admin_delete_order(uuid)to authenticated;
create or replace function public.protect_issued_order_deletion()returns trigger language plpgsql set search_path=public as $$
begin
 if current_user in('authenticated','anon')and not public.is_superadmin()and(old.status not in('submitted','awaiting_payment')or old.assigned_manufacturer_id is not null or old.offer_issued_at is not null or old.production_released_at is not null)then raise exception 'Issued or assigned orders must be cancelled through Ceriga; history cannot be deleted';end if;
 return old;
end $$;
drop trigger if exists orders_retention_guard on public.orders;
create trigger orders_retention_guard before delete on public.orders for each row execute function public.protect_issued_order_deletion();
revoke all on function public.protect_issued_order_deletion()from public,anon,authenticated;

-- Policies with order subqueries must use the role-safe projection after raw SELECT is removed.
do $$declare p record;q text;w text;begin
 for p in select *from pg_policies where schemaname in('public','storage')and tablename<>'orders'and(coalesce(qual,'')~'\morders\M'or coalesce(with_check,'')~'\morders\M')loop
  q:=regexp_replace(p.qual,'\morders\M','account_orders','g');w:=regexp_replace(p.with_check,'\morders\M','account_orders','g');
  execute format('alter policy %I on %I.%I %s %s',p.policyname,p.schemaname,p.tablename,case when q is not null then 'using ('||q||')'else ''end,case when w is not null then 'with check ('||w||')'else ''end);
 end loop;
end $$;
-- Keep this migration-only helper complete, including future application tables.
create or replace function public.apply_superadmin_access()returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare t record;
begin
 for t in select tablename from pg_tables where schemaname='public'loop
  execute format('alter table public.%I enable row level security',t.tablename);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t.tablename);
  if not exists(select 1 from pg_policies where schemaname='public'and tablename=t.tablename and policyname='superadmin_full_access')then execute format('create policy superadmin_full_access on public.%I for all to authenticated using(public.is_superadmin())with check(public.is_superadmin())',t.tablename);end if;
 end loop;
 revoke select on public.orders,public.order_quote_currency_snapshots from public,anon,authenticated;
 grant select(id)on public.orders to authenticated;
end $$;
revoke all on function public.apply_superadmin_access()from public,anon,authenticated;
grant execute on function public.apply_superadmin_access()to service_role;
select public.apply_superadmin_access();

-- Canonical rejection history consumed by both existing assignment implementations.
do $$declare d text;begin
 select pg_get_functiondef('public.review_manufacturer_quotation(uuid,text,text)'::regprocedure)into d;
 d:=replace(d,'''manufacturer_quotation_rejected''','''admin_rejected''');execute d;
end $$;
-- Reject unavailable/oversized assignments on the server as well as in recommendations.
create or replace function public.check_factory_assignment(p_order uuid,p_factory uuid,p_due date)returns void language plpgsql stable security definer set search_path=public as $$
declare s jsonb;o public.orders%rowtype;line jsonb;quantity numeric;ceiling numeric;capacity numeric;
begin
 select * into o from public.orders where id=p_order;
 select settings into s from public.manufacturer_customisation_settings where user_id=p_factory;
 if s->>'acceptingNewOrders'='false'then raise exception 'Manufacturer is not accepting new orders';end if;
 if coalesce(s->>'maxSingleOrderQuantity','')~'^[0-9]+$'then ceiling:=(s->>'maxSingleOrderQuantity')::numeric;end if;
 if coalesce(s->>'currentAvailableMonthlyCapacity','')~'^[0-9]+$'then capacity:=(s->>'currentAvailableMonthlyCapacity')::numeric;end if;
 for line in select value from jsonb_array_elements(coalesce(o.order_quantities->'bulkRuns','[]')||case when o.order_quantities->'sample' is not null then jsonb_build_array(o.order_quantities->'sample')else '[]'end)loop
  quantity:=coalesce((line->>'targetTotal')::numeric,(select sum(value::numeric)from jsonb_each_text(coalesce(line->'bySize','{}'))));
  if ceiling is not null and quantity>ceiling then raise exception 'Order quantity exceeds the manufacturer single-order ceiling';end if;
  if capacity is not null and quantity>capacity then raise exception 'Order quantity exceeds available factory capacity';end if;
 end loop;
end $$;
revoke all on function public.check_factory_assignment(uuid,uuid,date)from public,anon,authenticated;
do $$declare d text;begin
 select pg_get_functiondef('public.assign_order_manufacturer(uuid,uuid,date)'::regprocedure)into d;
 if position('check_factory_assignment' in d)=0 then d:=replace(d,'perform set_config(''app.routing_write''','perform public.check_factory_assignment(p_order_id,p_manufacturer,p_due); perform set_config(''app.routing_write''');end if;
 -- Live-only legacy guards require this authorised RPC to mark its own writes.
 if position('app.workflow_write'in d)=0 then d:=replace(d,'perform set_config(''app.routing_write''','perform set_config(''app.workflow_write'',p_order_id::text,true); perform set_config(''app.routing_write''');end if;
 execute d;
end $$;
-- Reproduce lifecycle notification functions on older live deployments.
create or replace function public.orders_after_insert_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_superadmin(
    'order',
    case when new.kind = 'tech-pack' then 'New tech pack order' else 'New production order' end,
    new.product_name || ' submitted — needs review.',
    '/superadmin/orders',
    new.id
  );
  return new;
end;
$$;
create or replace function public.orders_after_update_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  brand_href text := '/orders/' || new.id::text;
begin
  -- Order assigned to a manufacturer
  if new.assigned_manufacturer_id is not null
     and (old.assigned_manufacturer_id is null or old.assigned_manufacturer_id <> new.assigned_manufacturer_id) then
    if new.factory_status is null then
      new.factory_status := 'new';
    end if;
    perform public.notify_manufacturer(
      new.assigned_manufacturer_id,
      'order',
      'New order assigned',
      new.product_name || ' — quote due ' || coalesce(new.due_quote_by::text, 'soon') || '.',
      '/manufacturer/orders',
      new.id
    );
  end if;

  -- Manufacturer submitted a quote
  if new.factory_status = 'quoted' and coalesce(old.factory_status, '') <> 'quoted' then
    perform public.notify_superadmin(
      'pricing',
      'Manufacturer quoted order',
      new.product_name || ' — review pricing before sending to brand.',
      '/superadmin/orders/review',
      new.id
    );
  end if;

  -- Manufacturer declined
  if new.factory_status = 'rejected' and coalesce(old.factory_status, '') <> 'rejected' then
    perform public.notify_superadmin(
      'order',
      'Manufacturer declined order',
      new.product_name || coalesce(' — ' || new.factory_reject_reason, ''),
      '/superadmin/assignment',
      new.id
    );
  end if;

  -- Quote/pricing sent to the brand (status -> priced): tell them it is ready to pay
  if new.status = 'priced' and coalesce(old.status, '') <> 'priced' then
    perform public.notify_brand(
      new.user_id,
      'order',
      'Your quote is ready',
      new.product_name || ' — review pricing and pay from your order page.',
      brand_href
    );
  end if;

  -- Brand paid
  if new.status = 'paid' and coalesce(old.status, '') <> 'paid' then
    perform public.notify_brand(
      new.user_id,
      'payment',
      'Payment received',
      new.product_name || ' — we are getting started.',
      brand_href
    );
    perform public.notify_superadmin(
      'order',
      'Order paid',
      new.product_name || ' paid by brand.',
      '/superadmin/orders/' || new.id::text,
      new.id
    );
  end if;

  -- Shipped with tracking
  if new.status = 'shipping' and coalesce(old.status, '') <> 'shipping' then
    perform public.notify_brand(
      new.user_id,
      'shipping',
      'Order shipped',
      coalesce('Tracking: ' || new.tracking, new.product_name || ' is on its way.'),
      brand_href
    );
  end if;

  -- Completed
  if new.status = 'completed' and coalesce(old.status, '') <> 'completed' then
    perform public.notify_brand(
      new.user_id,
      'order',
      'Order completed',
      new.product_name || ' is complete.',
      brand_href
    );
  end if;

  return new;
end;
$$;
drop trigger if exists orders_after_insert_notify on public.orders;
create trigger orders_after_insert_notify after insert on public.orders for each row execute function public.orders_after_insert_notify();
-- Repeated deployments replace, rather than multiply, notifications.
drop trigger if exists orders_after_update_notify on public.orders;
create trigger orders_after_update_notify after update on public.orders for each row execute function public.orders_after_update_notify();
revoke all on function public.orders_after_insert_notify(),public.orders_after_update_notify()from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
