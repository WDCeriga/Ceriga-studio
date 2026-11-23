-- R02 / R12: internal release consistency and scoped shipping defaults.
begin;

create or replace function public.production_release_authorized(o public.orders)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select o.kind='production' and o.assigned_manufacturer_id is not null
   and o.production_released_at is not null and (
     o.manufacturer_submitted_at is not null
     or (o.payment_verified_at is not null and exists(
       select 1 from public.order_verified_payments p
       join lateral jsonb_array_elements(coalesce(o.price_options,'[]')) v on v->>'id'=p.option_id
       where p.order_id=o.id and p.option_id=o.selected_price_option_id
         and p.amount_cents=o.paid_amount_cents and p.amount_cents=(v->>'priceCents')::bigint
         and p.currency=v->>'currency')));
$$;
revoke all on function public.production_release_authorized(public.orders) from public,anon,authenticated;

create or replace function public.factory_shipping_defaults(p_data jsonb default null,p_expected timestamptz default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare f uuid:=public.current_factory_id();m public.manufacturer_profiles;method text;patch jsonb;before jsonb;
begin
 if f is null or not coalesce(public.factory_has_permission(f,'settings'),false) then
  raise exception 'Factory settings permission required' using errcode='42501';
 end if;
 select *into m from public.manufacturer_profiles where user_id=f for update;
 if not found then raise exception 'Factory profile unavailable';end if;
 if p_data is not null then
  if p_expected is null or p_expected is distinct from m.updated_at then
   raise exception 'Factory settings changed. Refresh before saving.' using errcode='40001';
  end if;
  if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>5000
   or exists(select 1 from jsonb_object_keys(p_data)k where k not in ('shippingMethods','shippingProvidersByMethod'))
   or jsonb_typeof(p_data->'shippingMethods')is distinct from 'array'
   or jsonb_array_length(p_data->'shippingMethods') not between 1 and 5
   or jsonb_typeof(p_data->'shippingProvidersByMethod')is distinct from 'object' then
   raise exception 'Choose valid shipping methods and providers';
  end if;
  for method in select jsonb_array_elements_text(p_data->'shippingMethods') loop
   if method not in ('Standard shipping','Express shipping','Air freight','Sea freight','Courier shipping')
    or length(btrim(coalesce(p_data->'shippingProvidersByMethod'->>method,''))) not between 1 and 200 then
    raise exception 'Choose a shipping method and enter its provider';
   end if;
  end loop;
  if (select count(distinct value) from jsonb_array_elements_text(p_data->'shippingMethods'))<>jsonb_array_length(p_data->'shippingMethods') then
   raise exception 'Shipping methods must be distinct';
  end if;
  before:=m.profile_details;
  patch:=jsonb_build_object('shippingMethods',p_data->'shippingMethods',
    'shippingProvidersByMethod',(select jsonb_object_agg(sm.value,p_data->'shippingProvidersByMethod'->>sm.value)from jsonb_array_elements_text(p_data->'shippingMethods')sm(value)),
    'shippingProvider',p_data->'shippingProvidersByMethod'->>(p_data->'shippingMethods'->>0));
  update public.manufacturer_profiles set profile_details=coalesce(profile_details,'{}')||patch,updated_at=clock_timestamp()
   where user_id=f returning *into m;
  insert into public.manufacturer_team_audit(manufacturer_id,actor_id,action)values(f,auth.uid(),'update_shipping_defaults');
 end if;
 return jsonb_build_object('revision',m.updated_at,'shippingMethods',coalesce(m.profile_details->'shippingMethods','[]'),
  'shippingProvidersByMethod',coalesce(m.profile_details->'shippingProvidersByMethod','{}'));
end$$;
revoke all on function public.factory_shipping_defaults(jsonb,timestamptz)from public,anon;
grant execute on function public.factory_shipping_defaults(jsonb,timestamptz)to authenticated;

-- Preserve all existing freight checks and approved terms. The only eligibility
-- change is recognizing an already authorised immutable production release.
do $patch$
declare d text;
begin
 d:=pg_get_functiondef('public.freight_logistics_update(uuid,uuid,text,jsonb)'::regprocedure);
 if position('public.production_release_authorized(o)' in d)=0 then
  if position('o.payment_verified_at is null' in d)=0 then raise exception 'Unexpected freight release definition';end if;
  d:=replace(d,'o.payment_verified_at is null','not coalesce(public.production_release_authorized(o),false)');
  d:=replace(d,'Paid production and approved QC are required before shipping','Authorised production release and approved QC are required before shipping');
  execute d;
 end if;
 d:=pg_get_functiondef('public.freight_context(uuid)'::regprocedure);
 if position('releaseAuthorized' in d)=0 then
  d:=replace(d,'''canManage'',public.is_superadmin()', '''releaseAuthorized'',case when public.is_superadmin() then coalesce(public.production_release_authorized(o),false) else null end,''canManage'',public.is_superadmin()');
  execute d;
 end if;
end$patch$;

notify pgrst,'reload schema';
commit;
