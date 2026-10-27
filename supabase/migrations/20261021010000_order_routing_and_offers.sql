begin;
-- Existing records retain NULL version and their original status/price/assignment/timestamps.
alter table public.orders add column if not exists routing_version integer;
alter table public.orders alter column routing_version set default 2;
alter table public.orders add column if not exists quote_expires_at timestamptz;
alter table public.orders add column if not exists offer_issued_at timestamptz;
alter table public.orders add column if not exists payment_verified_at timestamptz;
alter table public.orders add column if not exists production_released_at timestamptz;
create index if not exists orders_offer_expiry_idx on public.orders(quote_expires_at) where status='priced';
create table if not exists public.order_routing_events(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,event_type text not null,
 manufacturer_id uuid references auth.users(id) on delete set null,details jsonb not null default '{}',created_at timestamptz not null default now());
create index if not exists order_routing_events_order_idx on public.order_routing_events(order_id,created_at);
create table if not exists public.order_payment_controls(id boolean primary key default true check(id),enabled boolean not null default false);
insert into public.order_payment_controls(id,enabled)values(true,false)on conflict(id)do nothing;
create table if not exists public.order_verified_payments(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),provider_event_id text not null unique,
 option_id text not null,amount_cents bigint not null check(amount_cents>0),currency text not null check(currency in('GBP','USD','EUR')),
 provider_paid_at timestamptz not null,verified_at timestamptz not null default now());
create unique index if not exists order_verified_payment_order_idx on public.order_verified_payments(order_id);
-- Only the existing migration-only superadmin helper supplies application-wide admin access.
create or replace function public.apply_superadmin_access()
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare table_name text;
begin
  foreach table_name in array array[
    'projects','orders','packaging_library','brand_notifications','profiles',
    'manufacturer_profiles','manufacturer_invites','factory_materials',
    'factory_capacity_blocks','portal_notifications','measurement_guide_packs',
    'platform_settings','admin_chat_threads','admin_chat_messages',
    'manufacturer_customisation_settings','superadmin_emails',
    'order_routing_events','order_payment_controls','order_verified_payments'
  ] loop
    if to_regclass(format('public.%I',table_name)) is not null then
      execute format('alter table public.%I enable row level security',table_name);
      execute format('grant select,insert,update,delete on public.%I to authenticated',table_name);
      if not exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename=table_name and p.policyname='superadmin_full_access') then
        execute format('create policy superadmin_full_access on public.%I for all to authenticated using(public.is_superadmin()) with check(public.is_superadmin())',table_name);
      end if;
    end if;
  end loop;
end $$;
revoke all on function public.apply_superadmin_access() from public,anon,authenticated;
grant execute on function public.apply_superadmin_access() to service_role;
select public.apply_superadmin_access();
create or replace function public.guard_routing_order_v2()
returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' then
  if old.routing_version=2 and (new.kind,new.user_id,new.id) is distinct from (old.kind,old.user_id,old.id) then raise exception 'Order identity cannot be changed';end if;
 end if;
 if new.kind<>'production' then return new;end if;
 if tg_op='INSERT' then
  new.routing_version:=2;
  if auth.uid() is not null and not public.is_superadmin() and (new.status not in('submitted','awaiting_payment') or new.assigned_manufacturer_id is not null or new.manufacturer_quote is not null or new.price_options is not null or new.paid_amount_cents is not null)then raise exception 'New production orders must enter admin review';end if;
 elsif old.routing_version=2 then
  if (new.status,new.assigned_manufacturer_id,new.assigned_at,new.due_quote_by,new.manufacturer_quote,new.factory_status,new.factory_reject_reason,new.quoted_at,new.price_options,new.priced_at,new.quote_expires_at,new.offer_issued_at,new.paid_amount_cents,new.selected_price_option_id,new.payment_verified_at,new.production_released_at,new.routing_version) is distinct from (old.status,old.assigned_manufacturer_id,old.assigned_at,old.due_quote_by,old.manufacturer_quote,old.factory_status,old.factory_reject_reason,old.quoted_at,old.price_options,old.priced_at,old.quote_expires_at,old.offer_issued_at,old.paid_amount_cents,old.selected_price_option_id,old.payment_verified_at,old.production_released_at,old.routing_version)
    and current_setting('app.routing_write',true) is distinct from new.id::text then raise exception 'Use the authorised order routing actions';end if;
  if auth.uid() is not null and not public.is_superadmin() and (new.order_quantities,new.specifications) is distinct from (old.order_quantities,old.specifications) and (old.assigned_manufacturer_id is not null or old.status<>'submitted')then raise exception 'Ask Ceriga to revise an assigned order';end if;
 end if;
 return new;
end $$;
drop trigger if exists orders_guard_routing_v2 on public.orders;
create trigger orders_guard_routing_v2 before insert or update on public.orders for each row execute function public.guard_routing_order_v2();
create or replace function public.audit_order_routing()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.routing_version=2 and (tg_op='INSERT' or (new.status,new.assigned_manufacturer_id,new.factory_status,new.quoted_at,new.priced_at) is distinct from (old.status,old.assigned_manufacturer_id,old.factory_status,old.quoted_at,old.priced_at))then
  insert into public.order_routing_events(order_id,actor_id,event_type,manufacturer_id,details)values(new.id,(select id from auth.users where id=auth.uid()),case when tg_op='INSERT' then 'submitted' else coalesce(nullif(current_setting('app.routing_action',true),''),'updated')end,new.assigned_manufacturer_id,jsonb_build_object('status',new.status,'factoryStatus',new.factory_status,'reason',new.factory_reject_reason));
 end if;return new;
end $$;
drop trigger if exists orders_audit_routing on public.orders;
create trigger orders_audit_routing after insert or update on public.orders for each row execute function public.audit_order_routing();

create or replace function public.assign_order_manufacturer(p_order_id uuid,p_manufacturer uuid,p_due date)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype;
begin
 if not public.is_superadmin() then raise exception 'Superadmin authorization required';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.kind<>'production' or target.status not in('submitted','awaiting_payment','priced') then raise exception 'Order cannot be assigned at this stage';end if;
 if p_due is null or p_due<current_date then raise exception 'Choose a future quotation deadline';end if;
 if not exists(select 1 from public.manufacturer_profiles where user_id=p_manufacturer and onboarding_complete and status is distinct from 'paused')then raise exception 'Choose an active onboarded manufacturer';end if;
 if exists(select 1 from public.order_routing_events where order_id=p_order_id and manufacturer_id=p_manufacturer and event_type in('manufacturer_declined','admin_rejected')) or (target.factory_status='rejected' and target.assigned_manufacturer_id=p_manufacturer)then raise exception 'Choose another manufacturer after rejection';end if;
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.routing_action','assigned',true);
 update public.orders set assigned_manufacturer_id=p_manufacturer,assigned_at=now(),due_quote_by=p_due,factory_status='new',factory_reject_reason=null,manufacturer_quote=null,quoted_at=null,price_options=null,priced_at=null,offer_issued_at=null,quote_expires_at=null,status='submitted',status_label='Assigned to manufacturer' where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.assign_order_manufacturer(uuid,uuid,date)from public,anon;
grant execute on function public.assign_order_manufacturer(uuid,uuid,date)to authenticated;

create or replace function public.publish_order_quote(p_order_id uuid,p_prices jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; tier jsonb; approved jsonb; options jsonb:='[]';
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.kind<>'production' or target.status not in('submitted','awaiting_payment','priced') or target.factory_status is distinct from 'quoted' then raise exception 'Review a submitted manufacturer quotation first';end if;
 if target.status='priced' and jsonb_array_length(coalesce(target.price_options,'[]'))>0 and target.quote_expires_at>now() then raise exception 'The current offer has already been published';end if;
 if jsonb_typeof(p_prices) is distinct from 'array' or jsonb_array_length(p_prices)=0 or jsonb_array_length(p_prices)<>jsonb_array_length(coalesce(target.manufacturer_quote,'[]')) or (select count(distinct value->>'id')from jsonb_array_elements(p_prices))<>jsonb_array_length(p_prices)then raise exception 'Approve each quotation option exactly once';end if;
 for tier in select value from jsonb_array_elements(target.manufacturer_quote)loop
  select value into approved from jsonb_array_elements(p_prices)where value->>'id'=tier->>'id';
  if approved is null or coalesce(approved->>'cents','')!~'^[1-9][0-9]*$' or (approved->>'cents')::numeric>100000000000 then raise exception 'Enter valid approved prices';end if;
  options:=options||jsonb_build_array(jsonb_build_object('id',tier->>'id','kind',tier->>'kind','label',tier->>'label','description',(tier->>'totalUnits')||' units','totalUnits',tier->'totalUnits','priceCents',(approved->>'cents')::numeric,'currency',coalesce(tier->>'currency','GBP'),'leadTimeDays',tier->'leadTimeDays'));
 end loop;
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.routing_action','offer_published',true);
 update public.orders set price_options=options,priced_at=now(),offer_issued_at=now(),quote_expires_at=now()+interval '30 days',status='priced',status_label='Quote ready — valid for 30 days'where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.publish_order_quote(uuid,jsonb)from public,anon;
grant execute on function public.publish_order_quote(uuid,jsonb)to authenticated;

-- Derive every quantity and extended price from the saved customer request.
create or replace function public.submit_manufacturer_quote(p_order_id uuid, p_tiers jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; requirement jsonb; tier jsonb; requirements jsonb; normalized jsonb := '[]'; units numeric; unit_price numeric; days numeric; line_id text; line_kind text; quote_currency text;
begin
 if auth.uid() is null then raise exception 'Sign in to submit a quotation';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.assigned_manufacturer_id is distinct from auth.uid() then raise exception 'This order is not assigned to your factory';end if;
 if target.status not in('submitted','awaiting_payment') or coalesce(target.factory_status,'new') not in('new','reviewing','clarifying','quoted') then raise exception 'This order is no longer accepting manufacturer quotations';end if;
 if jsonb_array_length(coalesce(target.manufacturer_quote,'[]'::jsonb))>0 then
  quote_currency := coalesce(target.manufacturer_quote->0->>'currency','GBP');
 else
  select coalesce(pricing->>'preferredCurrency','GBP') into quote_currency from public.manufacturer_profiles where user_id=auth.uid();
 end if;
 if quote_currency is null or quote_currency not in('GBP','USD','EUR') then quote_currency:='GBP';end if;
 if jsonb_typeof(target.order_quantities->'sample')='object' then
  requirements := case when coalesce((target.order_quantities->'sample'->>'targetTotal')::numeric,(select sum(value::numeric) from jsonb_each_text(coalesce(target.order_quantities->'sample'->'bySize','{}'::jsonb))),0)>0 then jsonb_build_array(target.order_quantities->'sample') else '[]'::jsonb end || coalesce(target.order_quantities->'bulkRuns','[]'::jsonb);
 elsif coalesce(target.quote_request->>'quantity','') ~ '^[1-9][0-9]*$' then
  requirements := jsonb_build_array(jsonb_build_object('id','factory-quote','kind','bulk','targetTotal',(target.quote_request->>'quantity')::numeric));
 else raise exception 'The customer quantity is missing. Ask Ceriga to complete the order quantities';end if;
 if jsonb_typeof(p_tiers) is distinct from 'array' or jsonb_array_length(p_tiers)<>jsonb_array_length(requirements) or jsonb_array_length(p_tiers) not between 1 and 20 then raise exception 'Quote every customer quantity option';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_tiers))<>jsonb_array_length(p_tiers) then raise exception 'Quotation tier IDs must be unique';end if;
 for requirement in select value from jsonb_array_elements(requirements) loop
  line_id := requirement->>'id'; line_kind := requirement->>'kind';
  units := coalesce((requirement->>'targetTotal')::numeric,(select sum(value::numeric) from jsonb_each_text(coalesce(requirement->'bySize','{}'::jsonb))));
  if units is null or units<=0 or units<>trunc(units) or units>100000000 then raise exception 'The customer quantity is missing or invalid';end if;
  select value into tier from jsonb_array_elements(p_tiers) where value->>'id'=line_id;
  if tier is null or coalesce(tier->>'currency','')<>quote_currency or coalesce(tier->>'unitPriceCents','') !~ '^[1-9][0-9]*$' or coalesce(tier->>'leadTimeDays','') !~ '^[1-9][0-9]*$' then raise exception 'Each option requires a positive unit price in the quotation currency and a lead time';end if;
  unit_price := (tier->>'unitPriceCents')::numeric; days := (tier->>'leadTimeDays')::numeric;
  if days>3650 or unit_price*units>100000000000 then raise exception 'Quotation values exceed supported limits';end if;
  normalized := normalized || jsonb_build_array(jsonb_build_object('id',line_id,'kind',line_kind,'label',case when line_kind='sample' then 'Samples' else 'Bulk · '||units::text||' units' end,'totalUnits',units,'unitPriceCents',unit_price,'manufacturerQuoteCents',unit_price*units,'currency',quote_currency,'leadTimeDays',days));
 end loop;
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.routing_action','quoted',true);
 update public.orders set manufacturer_quote=normalized,factory_status='quoted',factory_reject_reason=null,quoted_at=now() where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.submit_manufacturer_quote(uuid,jsonb) from public,anon;
grant execute on function public.submit_manufacturer_quote(uuid,jsonb) to authenticated;


create or replace function public.reject_order_quotation(p_order_id uuid,p_reason text)
returns text language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; next_status text;
begin
 if auth.uid() is null then raise exception 'Sign in to reject a quotation';end if;
 if length(btrim(coalesce(p_reason,'')))<3 or length(p_reason)>2000 then raise exception 'Give a reason between 3 and 2000 characters';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order unavailable';end if;
 if target.status not in('submitted','awaiting_payment') then raise exception 'This order is no longer accepting quotation changes';end if;
 if public.is_superadmin() then
  if target.factory_status is distinct from 'quoted' then raise exception 'Only a submitted quotation can be returned for revision';end if;
  next_status := 'rejected';
  perform set_config('app.routing_action','admin_rejected',true);
 elsif target.assigned_manufacturer_id=auth.uid() then
  if coalesce(target.factory_status,'new') not in('new','reviewing','clarifying','quoted') then raise exception 'This assignment has already been declined';end if;
  next_status := 'rejected';
  perform set_config('app.routing_action','manufacturer_declined',true);
 else raise exception 'This order is not assigned to your factory';end if;
 perform set_config('app.routing_write',p_order_id::text,true);
 update public.orders set factory_status=next_status,factory_reject_reason=btrim(p_reason),price_options=null,priced_at=null,offer_issued_at=null,quote_expires_at=null,status='submitted',status_label='Awaiting manufacturer reassignment' where id=p_order_id;
 return next_status;
end $$;
revoke all on function public.reject_order_quotation(uuid,text) from public,anon;
grant execute on function public.reject_order_quotation(uuid,text) to authenticated;

-- Service-only handoff for a future provider webhook. Browser clicks can never confirm payment.
create or replace function public.confirm_order_payment(p_order_id uuid,p_option_id text,p_event_id text,p_amount bigint,p_currency text,p_paid_at timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; option jsonb; existing public.order_verified_payments%rowtype;
begin
 if not coalesce((select enabled from public.order_payment_controls where id=true),false)then raise exception 'Payments are disabled';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order unavailable';end if;
 select * into existing from public.order_verified_payments where provider_event_id=p_event_id;
 if found then
  if existing.order_id=p_order_id and existing.option_id=p_option_id and existing.amount_cents=p_amount and existing.currency=p_currency and target.production_released_at is not null then return p_order_id;end if;
  raise exception 'Payment event has already been used';
 end if;
 if target.kind<>'production' or target.status<>'priced' or target.assigned_manufacturer_id is null or target.quote_expires_at is null or p_paid_at is null or p_paid_at>=target.quote_expires_at or p_paid_at<target.offer_issued_at or p_paid_at>now()+interval '5 minutes' then raise exception 'No valid payable offer';end if;
 if not exists(select 1 from public.manufacturer_profiles where user_id=target.assigned_manufacturer_id and onboarding_complete and status is distinct from 'paused')then raise exception 'Assigned manufacturer is unavailable; Ceriga must review this payment';end if;
 select value into option from jsonb_array_elements(target.price_options)where value->>'id'=p_option_id;
 if option is null or p_amount is distinct from (option->>'priceCents')::bigint or p_currency is distinct from option->>'currency' or length(btrim(coalesce(p_event_id,'')))<3 then raise exception 'Payment amount, currency or option does not match the approved offer';end if;
 insert into public.order_verified_payments(order_id,provider_event_id,option_id,amount_cents,currency,provider_paid_at)values(p_order_id,p_event_id,p_option_id,p_amount,p_currency,p_paid_at);
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.routing_action','production_released',true);
 update public.orders set status='processing',status_label='Payment verified — in production',factory_status='in_production',paid_amount_cents=p_amount,selected_price_option_id=p_option_id,payment_verified_at=now(),production_released_at=now()where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.confirm_order_payment(uuid,text,text,bigint,text,timestamptz)from public,anon,authenticated;
grant execute on function public.confirm_order_payment(uuid,text,text,bigint,text,timestamptz)to service_role;
notify pgrst,'reload schema';
commit;
