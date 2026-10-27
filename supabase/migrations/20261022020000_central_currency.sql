begin;
-- One backend preference; seed only explicitly recorded manufacturer preferences.
alter table public.profiles add column if not exists preferred_currency text;
update public.profiles p set preferred_currency=m.pricing->>'preferredCurrency' from public.manufacturer_profiles m where m.user_id=p.id and p.preferred_currency is null and m.pricing->>'preferredCurrency' in('EUR','GBP','USD');
update public.profiles set preferred_currency='EUR' where preferred_currency is null;
alter table public.profiles alter column preferred_currency set default 'EUR',alter column preferred_currency set not null;
alter table public.profiles drop constraint if exists profiles_preferred_currency_check;
alter table public.profiles add constraint profiles_preferred_currency_check check(preferred_currency in('EUR','USD','GBP'));
create or replace function public.set_account_currency(p_currency text) returns text language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in to save currency';end if;
 if p_currency is null or p_currency not in('EUR','USD','GBP')then raise exception 'Unsupported currency';end if;
 insert into public.profiles(id,email,preferred_currency) values(auth.uid(),coalesce(auth.jwt()->>'email',''),p_currency) on conflict(id)do update set preferred_currency=excluded.preferred_currency;
 return p_currency;
end $$;
revoke all on function public.set_account_currency(text)from public,anon;grant execute on function public.set_account_currency(text)to authenticated;
-- Keep old onboarding clients compatible with the single authoritative preference.
create or replace function public.sync_account_currency()returns trigger language plpgsql security definer set search_path=public as $$
begin
 if pg_trigger_depth()>1 then return new;end if;
 if tg_table_name='profiles' then
  update public.manufacturer_profiles set pricing=jsonb_set(coalesce(pricing,'{}'),'{preferredCurrency}',to_jsonb(new.preferred_currency),true)where user_id=new.id and pricing->>'preferredCurrency' is distinct from new.preferred_currency;
 elsif new.pricing->>'preferredCurrency' in('EUR','USD','GBP')then
  update public.profiles set preferred_currency=new.pricing->>'preferredCurrency' where id=new.user_id and preferred_currency is distinct from new.pricing->>'preferredCurrency';
 end if;return new;
end $$;
drop trigger if exists profiles_currency_sync on public.profiles;
create trigger profiles_currency_sync after insert or update of preferred_currency on public.profiles for each row execute function public.sync_account_currency();
drop trigger if exists manufacturer_currency_sync on public.manufacturer_profiles;
create trigger manufacturer_currency_sync after insert or update of pricing on public.manufacturer_profiles for each row execute function public.sync_account_currency();
revoke all on function public.sync_account_currency()from public,anon,authenticated;

create table if not exists public.currency_rate_cache(
 id boolean primary key default true check(id),rates jsonb,rate_date date,retrieved_at timestamptz,provider text not null default 'Frankfurter / ECB',
 refresh_seconds integer not null default 86400 check(refresh_seconds between 3600 and 604800),max_age_seconds integer not null default 259200 check(max_age_seconds between 3600 and 604800),
 binding_max_age_seconds integer not null default 86400 check(binding_max_age_seconds between 3600 and 86400),
 request_id bigint,requested_at timestamptz,last_error text,
 check(rates is null or (jsonb_typeof(rates)='object' and rates?'EUR' and rates?'USD' and rates?'GBP' and (rates->>'EUR')::numeric=1 and (rates->>'USD')::numeric>0 and (rates->>'GBP')::numeric>0))
);
alter table public.currency_rate_cache drop constraint if exists currency_rate_cache_shape;
alter table public.currency_rate_cache add constraint currency_rate_cache_shape check(rates is null or ((jsonb_typeof(rates)='object' and (rates->>'EUR')::numeric=1 and (rates->>'GBP')::numeric>0 and (rates->>'USD')::numeric>0 and rate_date is not null and retrieved_at is not null) is true));
insert into public.currency_rate_cache(id)values(true)on conflict(id)do nothing;
alter table public.currency_rate_cache enable row level security;
-- Reuse the migration-only helper, including all its existing application tables.
do $$declare def text;begin
 select pg_get_functiondef('public.apply_superadmin_access()'::regprocedure)into def;
 if position('currency_rate_cache' in def)=0 then def:=replace(def,'''qc_defect_events''','''qc_defect_events'',''currency_rate_cache''');execute def;end if;
end $$;
select public.apply_superadmin_access();
create extension if not exists pg_net with schema extensions;
-- This internal worker only fetches a fixed public provider URL; callers cannot supply URLs/rates.
create or replace function public.refresh_currency_rates()returns void language plpgsql security definer set search_path=public,net as $$
declare c public.currency_rate_cache%rowtype;r record;payload jsonb;item jsonb;v_rates jsonb:='{"EUR":"1"}';d date;rid bigint;
begin
 select * into c from public.currency_rate_cache where id=true for update;
 if c.request_id is not null then
  select * into r from net._http_response where id=c.request_id;
  if found then
   begin
    if r.status_code is distinct from 200 or r.error_msg is not null then raise exception 'Exchange rate provider unavailable';end if;
    payload:=r.content::jsonb;if jsonb_typeof(payload)<>'array' or jsonb_array_length(payload)<>2 then raise exception 'Invalid exchange rate response';end if;
    for item in select value from jsonb_array_elements(payload)loop
     if item->>'base' is distinct from 'EUR' or coalesce(item->>'quote','') not in('USD','GBP') or (item->>'rate')::numeric<=0 or (item->>'rate')::numeric>1000 then raise exception 'Invalid exchange rate';end if;
     if item->>'date' is null or (item->>'date')::date>current_date or (item->>'date')::date<current_date-7 then raise exception 'Provider rates are outdated';end if;
     if d is not null and d<>(item->>'date')::date then raise exception 'Rate dates do not match';end if;d:=(item->>'date')::date;
     v_rates:=jsonb_set(v_rates,array[item->>'quote'],to_jsonb(item->>'rate'));
    end loop;
    if not(v_rates?'GBP' and v_rates?'USD')then raise exception 'Missing currency rates';end if;
    update public.currency_rate_cache set rates=v_rates,rate_date=d,retrieved_at=now(),last_error=null,request_id=null where id=true;
   exception when others then update public.currency_rate_cache set last_error=sqlerrm,request_id=null where id=true;end;
  elsif c.requested_at<now()-interval '2 minutes'then update public.currency_rate_cache set request_id=null,last_error='Exchange rate request timed out'where id=true;
  end if;
 end if;
 select * into c from public.currency_rate_cache where id=true;
 if c.request_id is null and (c.retrieved_at is null or c.retrieved_at<now()-make_interval(secs=>least(c.refresh_seconds,c.binding_max_age_seconds))) and (c.requested_at is null or c.requested_at<now()-interval '5 minutes')then
  select net.http_get(url:='https://api.frankfurter.dev/v2/providers/ecb/rates?base=EUR&quotes=USD,GBP',timeout_milliseconds:=10000)into rid;
  update public.currency_rate_cache set request_id=rid,requested_at=now()where id=true;
 end if;
exception when others then update public.currency_rate_cache set last_error='Exchange rates are temporarily unavailable'where id=true;
end $$;
revoke all on function public.refresh_currency_rates()from public,anon,authenticated;
create or replace function public.currency_context()returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.currency_rate_cache%rowtype;preferred text;
begin
 if auth.uid() is null then raise exception 'Sign in to load currency';end if;
 select preferred_currency into preferred from public.profiles where id=auth.uid();
 if preferred is null then perform public.set_account_currency('EUR');preferred:='EUR';end if;
 perform public.refresh_currency_rates();select * into c from public.currency_rate_cache where id=true;
 return jsonb_build_object('currency',preferred,'rates',case when c.retrieved_at>now()-make_interval(secs=>c.max_age_seconds)and c.rate_date>=current_date-7 then jsonb_build_object('rates',c.rates,'retrieved_at',c.retrieved_at,'rate_date',c.rate_date,'provider',c.provider,'valid_until',least(c.retrieved_at+make_interval(secs=>c.max_age_seconds),(c.rate_date+8)::timestamptz))else null end,'rate_error',case when c.retrieved_at is null then coalesce(c.last_error,'Exchange rates are loading') when c.retrieved_at<=now()-make_interval(secs=>c.max_age_seconds)or c.rate_date<current_date-7 then 'Cached exchange rates have expired'else c.last_error end);
end $$;
revoke all on function public.currency_context()from public,anon;grant execute on function public.currency_context()to authenticated;
create or replace function public.currency_convert_minor(p_amount bigint,p_source text,p_target text,p_binding boolean default false)returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.currency_rate_cache%rowtype;rate numeric;converted numeric;
begin
 if p_amount is null or abs(p_amount::numeric)>9007199254740991 or p_source is null or p_target is null or p_source not in('EUR','USD','GBP')or p_target not in('EUR','USD','GBP')then raise exception 'Currency needs review';end if;
 if p_source=p_target then return jsonb_build_object('amount',p_amount,'rate','1','source_rate','1','target_rate','1','provider','same currency','rate_date',null,'retrieved_at',null);end if;
 select * into c from public.currency_rate_cache where id=true;
 if c.rates is null or c.rate_date is null or c.retrieved_at is null or c.retrieved_at>now()+interval '5 minutes' or c.retrieved_at<now()-make_interval(secs=>case when p_binding then c.binding_max_age_seconds else c.max_age_seconds end)or c.rate_date<current_date-7 then raise exception 'A current exchange rate is required; try again after refreshing rates';end if;
 rate:=(c.rates->>p_target)::numeric/(c.rates->>p_source)::numeric;converted:=round(p_amount::numeric*(c.rates->>p_target)::numeric/(c.rates->>p_source)::numeric);
 if abs(converted)>9007199254740991 then raise exception 'Converted amount exceeds supported limits';end if;
 return jsonb_build_object('amount',converted,'rate',rate::text,'source_rate',c.rates->>p_source,'target_rate',c.rates->>p_target,'provider',c.provider,'rate_date',c.rate_date,'retrieved_at',c.retrieved_at);
end $$;
revoke all on function public.currency_convert_minor(bigint,text,text,boolean)from public,anon,authenticated;

-- Additive immutable quotation history; keep old price_options untouched.
create table if not exists public.order_quote_currency_snapshots(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id)on delete cascade,created_by uuid references auth.users(id)on delete set null,
 created_at timestamptz not null,expires_at timestamptz not null,target_currency text not null check(target_currency in('EUR','USD','GBP')),options jsonb not null check(jsonb_typeof(options)='array'),manufacturer_quote jsonb not null,
 unique(order_id,created_at)
);
create index if not exists order_quote_currency_order_idx on public.order_quote_currency_snapshots(order_id,created_at desc);
alter table public.order_quote_currency_snapshots enable row level security;
drop policy if exists quote_currency_owner_read on public.order_quote_currency_snapshots;
create policy quote_currency_owner_read on public.order_quote_currency_snapshots for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
do $$declare def text;begin select pg_get_functiondef('public.apply_superadmin_access()'::regprocedure)into def;if position('order_quote_currency_snapshots' in def)=0 then def:=replace(def,'''currency_rate_cache''','''currency_rate_cache'',''order_quote_currency_snapshots''');execute def;end if;end $$;
select public.apply_superadmin_access();
create or replace function public.guard_quote_currency_history()returns trigger language plpgsql set search_path=public as $$begin
 if tg_op='INSERT' and current_setting('app.currency_quote_write',true)=new.order_id::text then return new;end if;
 if tg_op='DELETE' and not exists(select 1 from public.orders where id=old.order_id)then return old;end if;
 if tg_op='UPDATE' and pg_trigger_depth()>1 and new.created_by is null and (to_jsonb(new)-'created_by')=(to_jsonb(old)-'created_by')then return new;end if;
 raise exception 'Issued quotation currency snapshots are immutable';end $$;
drop trigger if exists quote_currency_history_guard on public.order_quote_currency_snapshots;
create trigger quote_currency_history_guard before insert or update or delete on public.order_quote_currency_snapshots for each row execute function public.guard_quote_currency_history();
revoke all on function public.guard_quote_currency_history()from public,anon,authenticated;
create or replace function public.publish_order_quote(p_order_id uuid,p_prices jsonb)returns uuid language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;tier jsonb;approved jsonb;options jsonb:='[]';target text;source text;fx jsonb;source_amount bigint;manufacturer_amount bigint;markup bigint;shipping bigint;tax bigint;fees bigint;issued timestamptz:=now();
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.kind<>'production' or o.status not in('submitted','awaiting_payment','priced')or o.factory_status is distinct from 'quoted'then raise exception 'Review a submitted manufacturer quotation first';end if;
 if o.status='priced'and jsonb_array_length(coalesce(o.price_options,'[]'))>0 and o.quote_expires_at>now()then raise exception 'The current offer has already been published';end if;
 select preferred_currency into target from public.profiles where id=o.user_id;if target is null then raise exception 'Customer currency needs review';end if;
 if jsonb_typeof(p_prices)is distinct from 'array'or jsonb_array_length(p_prices)=0 or jsonb_array_length(p_prices)<>jsonb_array_length(coalesce(o.manufacturer_quote,'[]'))or(select count(distinct value->>'id')from jsonb_array_elements(p_prices))<>jsonb_array_length(p_prices)then raise exception 'Approve each quotation option exactly once';end if;
 for tier in select value from jsonb_array_elements(o.manufacturer_quote)loop
  select value into approved from jsonb_array_elements(p_prices)where value->>'id'=tier->>'id';source:=tier->>'currency';
  if approved is null or source is null or source not in('EUR','USD','GBP')or coalesce(approved->>'cents','')!~'^[1-9][0-9]*$'or(approved->>'cents')::numeric>100000000000 or coalesce(tier->>'manufacturerQuoteCents','')!~'^[1-9][0-9]*$'then raise exception 'Valid original amounts and currency are required; ambiguous historical quotes need review';end if;
  -- Admin inputs remain explicitly in the original quote currency. Existing margins are already in this total.
  source_amount:=(approved->>'cents')::bigint;manufacturer_amount:=(tier->>'manufacturerQuoteCents')::bigint;
  shipping:=coalesce((approved->>'shippingCents')::bigint,0);tax:=coalesce((approved->>'taxCents')::bigint,0);fees:=coalesce((approved->>'feesCents')::bigint,0);
  if least(shipping,tax,fees)<0 then raise exception 'Costs cannot be negative';end if;
  markup:=source_amount-manufacturer_amount-shipping-tax-fees;
  fx:=public.currency_convert_minor(source_amount,source,target,true);
  options:=options||jsonb_build_array(jsonb_build_object('id',tier->>'id','kind',tier->>'kind','label',tier->>'label','description',(tier->>'totalUnits')||' units','totalUnits',tier->'totalUnits','priceCents',fx->'amount','currency',target,'leadTimeDays',tier->'leadTimeDays','currencySnapshot',jsonb_build_object('originalManufacturerCents',manufacturer_amount,'originalCurrency',source,'approvedOriginalCents',source_amount,'markupCents',markup,'shippingCents',shipping,'taxCents',tax,'feesCents',fees,'costsCurrency',source,'shippingIncludedInManufacturerQuote',true,'rate',fx->>'rate','sourceRate',fx->>'source_rate','targetRate',fx->>'target_rate','rateDate',fx->'rate_date','retrievedAt',fx->'retrieved_at','provider',fx->>'provider','issuedAt',issued,'expiresAt',issued+interval '30 days')));
 end loop;
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.workflow_write',p_order_id::text,true);perform set_config('app.routing_action','offer_published',true);perform set_config('app.currency_quote_write',p_order_id::text,true);
 update public.orders set price_options=options,priced_at=issued,offer_issued_at=issued,quote_expires_at=issued+interval '30 days',status='priced',status_label='Quote ready — valid for 30 days'where id=p_order_id;
 insert into public.order_quote_currency_snapshots(order_id,created_by,created_at,expires_at,target_currency,options,manufacturer_quote)values(p_order_id,auth.uid(),issued,issued+interval '30 days',target,options,o.manufacturer_quote);
 return p_order_id;
end $$;
revoke all on function public.publish_order_quote(uuid,jsonb)from public,anon;grant execute on function public.publish_order_quote(uuid,jsonb)to authenticated;
-- Preserve old data and expose unknown currency records for authorised review.
create or replace function public.currency_review_orders()returns table(order_id uuid,reason text)language plpgsql security definer set search_path=public as $$begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 return query select o.id,'Original currency is missing or unsupported; do not infer from an account preference.'::text from public.orders o where exists(select 1 from jsonb_array_elements(coalesce(o.manufacturer_quote,'[]')) t where coalesce(t->>'currency','')not in('EUR','GBP','USD'))or exists(select 1 from jsonb_array_elements(coalesce(o.price_options,'[]')) t where coalesce(t->>'currency','')not in('EUR','GBP','USD'));
end $$;
revoke all on function public.currency_review_orders()from public,anon;grant execute on function public.currency_review_orders()to authenticated;
create or replace function public.submit_manufacturer_quote(p_order_id uuid, p_tiers jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.orders%rowtype; requirement jsonb; tier jsonb; requirements jsonb; normalized jsonb := '[]'; units numeric; unit_price numeric; days numeric; line_id text; line_kind text; quote_currency text;
begin
 if auth.uid() is null then raise exception 'Sign in to submit a quotation';end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.assigned_manufacturer_id is distinct from auth.uid() then raise exception 'This order is not assigned to your factory';end if;
 if target.status not in('submitted','awaiting_payment') or coalesce(target.factory_status,'new') not in('new','reviewing','clarifying','quoted') then raise exception 'This order is no longer accepting manufacturer quotations';end if;
 if jsonb_array_length(coalesce(target.manufacturer_quote,'[]'::jsonb))>0 then
  quote_currency := target.manufacturer_quote->0->>'currency';
 else
  select preferred_currency into quote_currency from public.profiles where id=auth.uid();
 end if;
 if quote_currency is null or quote_currency not in('GBP','USD','EUR') then raise exception 'Original quotation currency needs review';end if;
 if jsonb_typeof(target.order_quantities->'sample')='object' then
  requirements := jsonb_build_array(target.order_quantities->'sample') || coalesce(target.order_quantities->'bulkRuns','[]'::jsonb);
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
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.workflow_write',p_order_id::text,true);
 update public.orders set manufacturer_quote=normalized,factory_status='quoted',factory_reject_reason=null,quoted_at=now() where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.submit_manufacturer_quote(uuid,jsonb) from public,anon;
grant execute on function public.submit_manufacturer_quote(uuid,jsonb) to authenticated;


alter table public.orders add column if not exists paid_currency text check(paid_currency in('EUR','USD','GBP')),
 add column if not exists total_currency text check(total_currency in('EUR','USD','GBP'));
-- Receipts and selected options provide evidence; ambiguous totals remain null.
do $$declare receipt record;begin for receipt in select p.order_id,p.currency from public.order_verified_payments p join public.orders o on o.id=p.order_id where o.paid_currency is null and p.currency in('EUR','USD','GBP')loop perform set_config('app.routing_write',receipt.order_id::text,true);perform set_config('app.workflow_write',receipt.order_id::text,true);update public.orders set paid_currency=receipt.currency where id=receipt.order_id;end loop;end $$;
create or replace function public.guard_order_money_currency()returns trigger language plpgsql set search_path=public as $$begin
 if tg_op='INSERT' then if new.kind='tech-pack' then new.total_currency:='EUR';end if;return new;end if;
 if new.paid_currency is distinct from old.paid_currency and current_setting('app.routing_write',true)is distinct from old.id::text then raise exception 'Payment currency is controlled by verified payments';end if;
 if old.price_options is not null and exists(select 1 from jsonb_array_elements(old.price_options) v where v?'currencySnapshot') and new.price_options is distinct from old.price_options and current_setting('app.routing_write',true)is distinct from old.id::text then raise exception 'Issued quotation prices and currencies are locked; use the approved quote workflow';end if;
 if old.total is not null and new.total_currency is distinct from old.total_currency then raise exception 'Original monetary currency cannot be relabelled';end if;return new;
end $$;
drop trigger if exists orders_money_currency_guard on public.orders;
create trigger orders_money_currency_guard before insert or update on public.orders for each row execute function public.guard_order_money_currency();
revoke all on function public.guard_order_money_currency()from public,anon,authenticated;
do $$begin if to_regprocedure('public.confirm_order_payment_currency_legacy(uuid,text,text,bigint,text,timestamptz)')is null then alter function public.confirm_order_payment(uuid,text,text,bigint,text,timestamptz)rename to confirm_order_payment_currency_legacy;end if;end $$;
revoke all on function public.confirm_order_payment_currency_legacy(uuid,text,text,bigint,text,timestamptz)from public,anon,authenticated,service_role;
create or replace function public.confirm_order_payment(p_order_id uuid,p_option_id text,p_event_id text,p_amount bigint,p_currency text,p_paid_at timestamptz)returns uuid language plpgsql security definer set search_path=public as $$begin
 if p_currency is null or p_currency not in('EUR','USD','GBP')then raise exception 'Unsupported payment currency';end if;
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.workflow_write',p_order_id::text,true);
 perform public.confirm_order_payment_currency_legacy(p_order_id,p_option_id,p_event_id,p_amount,p_currency,p_paid_at);
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.workflow_write',p_order_id::text,true);
 update public.orders set paid_currency=p_currency where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.confirm_order_payment(uuid,text,text,bigint,text,timestamptz)from public,anon,authenticated;grant execute on function public.confirm_order_payment(uuid,text,text,bigint,text,timestamptz)to service_role;

-- Explicit admin review path for ambiguous, unpaid legacy quotes. Never relabel an amount.
create or replace function public.request_currency_requote(p_order_id uuid,p_reason text)returns uuid language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 if length(btrim(coalesce(p_reason,'')))not between 5 and 6000 then raise exception 'Explain the currency review and evidence needed';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.assigned_manufacturer_id is null or o.status not in('submitted','awaiting_payment','priced')or o.production_released_at is not null or o.paid_amount_cents is not null then raise exception 'Only unpaid, unreleased quotations can be returned for currency review';end if;
 if not exists(select 1 from public.currency_review_orders() r where r.order_id=p_order_id)then raise exception 'This quote has explicit currencies; use the existing quote review process';end if;
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.workflow_write',p_order_id::text,true);perform set_config('app.routing_action','currency_requote_requested',true);
 insert into public.order_routing_events(order_id,actor_id,event_type,manufacturer_id,details)values(p_order_id,auth.uid(),'currency_requote_requested',o.assigned_manufacturer_id,jsonb_build_object('reason',btrim(p_reason),'previousManufacturerQuote',o.manufacturer_quote,'previousPriceOptions',o.price_options,'previousIssuedAt',o.offer_issued_at,'previousExpiresAt',o.quote_expires_at));
 update public.orders set manufacturer_quote=null,price_options=null,priced_at=null,offer_issued_at=null,quote_expires_at=null,status='submitted',status_label='Currency review — revised manufacturer quotation required',factory_status='clarifying'where id=p_order_id;
 perform public.notify_manufacturer(o.assigned_manufacturer_id,'order','Revised quotation required',p_reason,'/manufacturer/orders/'||p_order_id,p_order_id);
 return p_order_id;
end $$;
revoke all on function public.request_currency_requote(uuid,text)from public,anon;grant execute on function public.request_currency_requote(uuid,text)to authenticated;

select public.refresh_currency_rates();
notify pgrst,'reload schema';
commit;
