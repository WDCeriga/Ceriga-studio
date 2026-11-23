begin;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check(status in
 ('admin_draft','customer_confirmation','submitted','awaiting_payment','priced','paid','processing','shipping','completed','ready'));
alter table public.orders add column if not exists admin_created_by uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists admin_source text;
alter table public.orders add column if not exists customer_confirmed_at timestamptz;
do $view$
declare columns text;
begin
 select string_agg(format('projected.%I',attname),', ' order by attnum)
 into columns from pg_attribute where attrelid='public.account_orders'::regclass and attnum>0 and not attisdropped;
 execute format('create or replace view public.account_orders with(security_barrier=true) as
 select %s from public.orders o cross join lateral public.account_order_projection(o) projected
 where auth.uid() is not null and (public.is_superadmin() or
 (o.status <> ''admin_draft'' and (o.user_id=auth.uid() or public.factory_order_visible(o.id))))',columns);
end;
$view$;

create table if not exists public.admin_record_activity (
 id uuid primary key default gen_random_uuid(),
 entity text not null check(entity in ('order','customer','manufacturer')),
 record_id uuid not null,
 actor_id uuid default auth.uid(),
 action text not null,
 previous jsonb,
 updated jsonb,
 reason text,
 follow_up date,
 created_at timestamptz not null default now()
);
create index if not exists admin_record_activity_lookup on public.admin_record_activity(entity,record_id,created_at desc);
select public.apply_superadmin_access();
create or replace function public.protect_admin_record_activity() returns trigger
language plpgsql set search_path='' as $$
begin
 raise exception 'Activity history is append only';
end;
$$;
drop trigger if exists protect_admin_record_activity on public.admin_record_activity;
create trigger protect_admin_record_activity before update or delete on public.admin_record_activity
for each row execute function public.protect_admin_record_activity();
drop policy if exists admin_activity_insert_via_rpc on public.admin_record_activity;
create policy admin_activity_insert_via_rpc on public.admin_record_activity as restrictive for insert to authenticated with check(false);

create or replace function public.audit_admin_factory_settings() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior jsonb; changed jsonb;
begin
 if not public.is_superadmin() then return new; end if;
 if tg_table_name='manufacturer_profiles' then
   prior:=jsonb_build_object('status',old.status,'garments',old.garments,'capabilities',old.capabilities,
     'moq',old.moq,'leadDays',old.typical_lead_days,'capacity',old.monthly_capacity,'shipping',old.shipping_regions);
   changed:=jsonb_build_object('status',new.status,'garments',new.garments,'capabilities',new.capabilities,
     'moq',new.moq,'leadDays',new.typical_lead_days,'capacity',new.monthly_capacity,'shipping',new.shipping_regions);
 else
   select jsonb_object_agg(key,value) into prior from jsonb_each(coalesce(old.settings,'{}'))
     where key in ('garmentDetails','capabilitiesMap','sampleLeadTimeMaxDays','bulkLeadTimeMaxDays',
       'garmentMoqOverrides','customMethodMoqs','acceptingNewOrders','shippingDestinations');
   select jsonb_object_agg(key,value) into changed from jsonb_each(coalesce(new.settings,'{}'))
     where key in ('garmentDetails','capabilitiesMap','sampleLeadTimeMaxDays','bulkLeadTimeMaxDays',
       'garmentMoqOverrides','customMethodMoqs','acceptingNewOrders','shippingDestinations');
 end if;
 if prior is distinct from changed then
   insert into public.admin_record_activity(entity,record_id,action,previous,updated)
   values('manufacturer',new.user_id,'factory_settings_changed',prior,changed);
 end if;
 return new;
end;
$$;
revoke all on function public.audit_admin_factory_settings() from public,anon,authenticated;
drop trigger if exists audit_admin_factory_profile on public.manufacturer_profiles;
create trigger audit_admin_factory_profile after update on public.manufacturer_profiles
for each row execute function public.audit_admin_factory_settings();
drop trigger if exists audit_admin_factory_capabilities on public.manufacturer_customisation_settings;
create trigger audit_admin_factory_capabilities after update on public.manufacturer_customisation_settings
for each row execute function public.audit_admin_factory_settings();

create or replace function public.admin_record_action(p_entity text,p_id uuid,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 o public.orders;
 c public.profiles;
 f public.manufacturer_profiles;
 before_value jsonb;
 after_value jsonb;
 result_id uuid:=p_id;
 reason text:=nullif(trim(p_data->>'reason'),'');
begin
 if p_entity not in ('order','customer','manufacturer') or (p_id is null and p_action<>'create') then
   raise exception 'Choose a record';
 end if;
 if not (public.is_superadmin() or (p_entity='order' and p_id is not null and coalesce(public.platform_worker_can(
   case when p_action in ('read','payment') then 'orders.view' else 'orders.edit' end,p_id),false))) then
   raise exception 'Administrative access required' using errcode='42501';
 end if;
 if p_entity='order' and p_id is not null then
   select * into o from public.orders where id=p_id for update;
   if not found then raise exception 'Order not found'; end if;
 elsif p_entity='customer' then
   select * into c from public.profiles where id=p_id and role='brand' for update;
   if not found then raise exception 'Customer not found'; end if;
 elsif p_entity='manufacturer' then
   select * into f from public.manufacturer_profiles where user_id=p_id for update;
   if not found then raise exception 'Manufacturer not found'; end if;
 end if;
 if p_action='read' then
   return jsonb_build_object('record',case p_entity
     when 'order' then jsonb_build_object('status',o.status,'name',o.product_name,'garment',o.garment_type,'specifications',o.specifications,
       'quantities',o.order_quantities,'delivery',o.delivery_address,'notes',o.ops_notes,'source',o.admin_source,
       'canEditDetails',public.is_superadmin() and o.status in ('admin_draft','submitted','awaiting_payment')
          and o.assigned_manufacturer_id is null and o.offer_issued_at is null
          and not exists(select 1 from public.order_factory_quotes where order_id=p_id))
     when 'customer' then jsonb_build_object('name',c.full_name,'email',c.email)
     when 'manufacturer' then jsonb_build_object('name',f.factory_name,'phone',f.contact_phone,'email',f.contact_email,
       'address',f.address_line,'city',f.city,'country',f.country)
     end,'history',coalesce((select jsonb_agg(to_jsonb(h)) from (
       select e.*,p.full_name actor_name from (
         select a.id,a.actor_id,a.action,a.previous,a.updated,a.reason,a.follow_up,a.created_at
         from public.admin_record_activity a where a.entity=p_entity and a.record_id=p_id
         union all
         select r.id,r.actor_id,r.event_type,r.details->'previousManufacturerQuote',
           jsonb_strip_nulls(jsonb_build_object('manufacturer',r.manufacturer_id,'nextAction',r.details->>'nextAction')),
           coalesce(r.details->>'reason',r.details->>'overrideReason'),null::date,r.created_at
         from public.order_routing_events r where p_entity='order' and public.is_superadmin() and r.order_id=p_id
           and r.event_type in ('assigned','comparison_preferred','offer_published','admin_rejected',
             'manufacturer_quotation_rejected','currency_requote_requested')
       ) e left join public.profiles p on p.id=e.actor_id order by e.created_at desc,e.id limit 30
     ) h),'[]'));
 end if;
 if p_action='payment' and p_entity='order' then
   if not public.is_superadmin() then raise exception 'Payment access requires Super Admin'; end if;
   return jsonb_build_object('options',o.price_options,'selected',o.selected_price_option_id,'verifiedAt',o.payment_verified_at,
     'transactions',coalesce((select jsonb_agg(to_jsonb(p) order by p.provider_paid_at desc) from public.order_verified_payments p where p.order_id=p_id),'[]'));
 end if;
 case
 when p_action='create' and p_entity='order' and p_id is null then
   if not public.is_superadmin() then raise exception 'Order creation requires Super Admin'; end if;
   select * into c from public.profiles where id=(p_data->>'customer')::uuid and role='brand';
   if not found or length(trim(coalesce(p_data->>'name',''))) not between 1 and 300
     or coalesce(p_data->>'source','') not in ('Meeting','Phone','Email','Support','Other')
     then raise exception 'Choose a customer, source and product name'; end if;
   insert into public.orders(user_id,kind,product_name,garment_type,status,status_label,admin_created_by,admin_source)
     values(c.id,'production',trim(p_data->>'name'),coalesce(p_data->>'garment',''),'admin_draft','Draft',auth.uid(),p_data->>'source')
     returning id into result_id;
   after_value:=jsonb_build_object('name',p_data->>'name','source',p_data->>'source');
 when p_action='edit' and p_entity='order' then
   before_value:=jsonb_build_object('notes',o.ops_notes,'name',o.product_name,'garment',o.garment_type,
     'specifications',o.specifications,'quantities',o.order_quantities,'delivery',o.delivery_address);
   if p_data ?| array['name','garment','specifications','quantities','delivery'] then
     if not public.is_superadmin() then raise exception 'Order specification editing requires Super Admin'; end if;
     if o.status not in ('admin_draft','submitted','awaiting_payment') or
       o.assigned_manufacturer_id is not null or o.offer_issued_at is not null or
       exists(select 1 from public.order_factory_quotes where order_id=p_id) then
       raise exception 'This order requires the existing quotation revision or amendment workflow';
     end if;
     if p_data ? 'name' and length(trim(coalesce(p_data->>'name',''))) not between 1 and 300 then raise exception 'Enter a product name'; end if;
     update public.orders set product_name=coalesce(trim(p_data->>'name'),product_name),garment_type=coalesce(p_data->>'garment',garment_type),
       specifications=coalesce(p_data->'specifications',specifications),order_quantities=coalesce(p_data->'quantities',order_quantities),
       delivery_address=coalesce(p_data->'delivery',delivery_address),ops_notes=coalesce(p_data->>'notes',ops_notes) where id=p_id;
   else
     update public.orders set ops_notes=coalesce(p_data->>'notes',ops_notes) where id=p_id;
   end if;
   after_value:=before_value || (p_data-'reason');
 when p_action='send' and p_entity='order' then
   if not public.is_superadmin() or o.status<>'admin_draft' or nullif(trim(o.garment_type),'') is null
     or nullif(trim(o.delivery_address->>'country'),'') is null
     or not exists(select 1 from jsonb_array_elements(jsonb_build_array(o.order_quantities->'sample')||
       coalesce(o.order_quantities->'bulkRuns','[]')) q where public.matching_units(q)>0)
     then raise exception 'Complete the garment, quantities and delivery country before sending'; end if;
   perform set_config('app.routing_write',p_id::text,true);
   update public.orders set status='customer_confirmation',status_label='Awaiting your confirmation' where id=p_id;
   perform public.notify_brand(o.user_id,'order','Confirm your order','Review the order details prepared by Ceriga.','/orders/'||p_id);
   after_value:=jsonb_build_object('status','customer_confirmation');
 when p_action='edit' and p_entity='customer' then
   if length(trim(coalesce(p_data->>'name',''))) not between 1 and 200 then raise exception 'Enter a customer name'; end if;
   before_value:=jsonb_build_object('name',c.full_name);
   update public.profiles set full_name=trim(p_data->>'name') where id=p_id;
   after_value:=jsonb_build_object('name',trim(p_data->>'name'));
 when p_action='edit' and p_entity='manufacturer' then
   if length(trim(coalesce(p_data->>'name',''))) not between 1 and 200 then raise exception 'Enter a factory name'; end if;
   before_value:=jsonb_build_object('name',f.factory_name,'email',f.contact_email,'phone',f.contact_phone,
     'address',f.address_line,'city',f.city,'country',f.country);
   update public.manufacturer_profiles set factory_name=trim(p_data->>'name'),contact_email=p_data->>'email',
     contact_phone=p_data->>'phone',address_line=p_data->>'address',city=p_data->>'city',country=p_data->>'country' where user_id=p_id;
   after_value:=p_data-'reason';
 when p_action='support' then
   if length(coalesce(reason,'')) not between 3 and 2000 then raise exception 'Enter a support note'; end if;
   after_value:=jsonb_build_object('attention',coalesce((p_data->>'attention')::boolean,false));
 else raise exception 'Unsupported administrative action';
 end case;
 insert into public.admin_record_activity(entity,record_id,action,previous,updated,reason,follow_up)
 values(p_entity,result_id,p_action,before_value,after_value,reason,nullif(p_data->>'followUp','')::date);
 return jsonb_build_object('id',result_id);
end;
$$;

create or replace function public.confirm_admin_created_order(p_order uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare customer uuid;
begin
 select user_id into customer from public.orders where id=p_order and status='customer_confirmation' for update;
 if not found or customer is distinct from auth.uid() then raise exception 'Order confirmation unavailable' using errcode='42501'; end if;
 perform set_config('app.routing_write',p_order::text,true);
 update public.orders set status='submitted',status_label='Awaiting review',customer_confirmed_at=now() where id=p_order;
 insert into public.admin_record_activity(entity,record_id,action) values('order',p_order,'customer_confirmed');
 if (select value #>> '{}' from public.platform_settings where key='manufacturer_assignment_mode')='automatic' then
   perform public.try_auto_assign_order(p_order);
 end if;
 return p_order;
end;
$$;
revoke all on function public.admin_record_action(text,uuid,text,jsonb),public.confirm_admin_created_order(uuid) from public,anon;
grant execute on function public.admin_record_action(text,uuid,text,jsonb),public.confirm_admin_created_order(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
