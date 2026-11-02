-- Freight is approved with each quotation option; existing issued offers remain untouched.
create table if not exists public.freight_forwarders(
 id uuid primary key default gen_random_uuid(), company_name text not null check(length(trim(company_name)) between 1 and 200),
 contact_details text not null default '',countries text not null default '',routes text not null default '',methods text not null default '',
 typical_delivery text not null default '',terms text not null default '',active boolean not null default true,updated_at timestamptz not null default now()
);
create table if not exists public.order_freight_quotes(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),option_id text not null,
 manufacturer_id uuid not null references public.profiles(id),tier_snapshot jsonb not null,
 forwarder_id uuid references public.freight_forwarders(id),source text not null check(source in('manufacturer','forwarder')),
 terms jsonb not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
alter table public.order_freight_quotes add column if not exists manufacturer_quoted_at timestamptz;
create index if not exists freight_order_option_idx on public.order_freight_quotes(order_id,option_id,created_at desc);
create index if not exists freight_forwarder_history_idx on public.order_freight_quotes(forwarder_id,created_at desc);
create table if not exists public.order_freight_selections(
 order_id uuid not null references public.orders(id),option_id text not null,quote_id uuid not null references public.order_freight_quotes(id),
 selected_by uuid not null references auth.users(id),selected_at timestamptz not null default now(),primary key(order_id,option_id)
);
create table if not exists public.order_logistics_events(
 id uuid primary key,order_id uuid not null references public.orders(id),status text not null check(status in('collection_scheduled','ready_for_collection','collected','in_transit','customs_clearance','out_for_delivery','delivered','exception')),
 details jsonb not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index if not exists logistics_order_history_idx on public.order_logistics_events(order_id,created_at desc);
create table if not exists public.order_shipping_amendments(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id),quote_id uuid not null references public.order_freight_quotes(id),
 reason text not null check(length(trim(reason))>=3),approved_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index if not exists shipping_amendment_order_idx on public.order_shipping_amendments(order_id,created_at desc);
do $$declare d text;t text;begin
 select pg_get_functiondef('public.apply_superadmin_access()'::regprocedure)into d;
 if position('''freight_forwarders'''in d)=0 then d:=replace(d,'''projects''','''freight_forwarders'',''order_freight_quotes'',''order_freight_selections'',''order_logistics_events'',''order_shipping_amendments'',''projects''');execute d;end if;
 foreach t in array array['freight_forwarders','order_freight_quotes','order_freight_selections','order_logistics_events','order_shipping_amendments']loop
 execute format('alter table public.%I enable row level security',t);execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;perform public.apply_superadmin_access();end$$;
revoke all on function public.apply_superadmin_access()from public,anon,authenticated;

create or replace function public.freight_validate(p jsonb)returns jsonb language plpgsql immutable set search_path=public as $$begin
 if jsonb_typeof(p)is distinct from 'object' or coalesce(p->>'currency','')not in('EUR','USD','GBP')or coalesce(p->>'priceCents','')!~'^[0-9]+$'or(p->>'priceCents')::numeric>100000000000 then raise exception 'Enter a valid shipping amount and currency';end if;
 if exists(select 1 from unnest(array['provider','method','origin','destination','insurance','services','tradeTerms'])k where length(trim(coalesce(p->>k,'')))not between 1 and 2000)then raise exception 'Complete provider, method, route, insurance, services and duty terms';end if;
 if coalesce(p->>'transitDays','')!~'^[1-9][0-9]*$'or(p->>'transitDays')::numeric>3650 or coalesce(p->>'cartons','')!~'^[1-9][0-9]*$'or(p->>'cartons')::numeric>1000000 then raise exception 'Enter valid transit days and carton count';end if;
 if exists(select 1 from unnest(array['weightKg','lengthCm','widthCm','heightCm'])k where coalesce(p->>k,'')!~'^[0-9]+(\.[0-9]{1,3})?$'or(p->>k)::numeric<=0 or(p->>k)::numeric>1000000)then raise exception 'Enter positive shipment weight and carton dimensions';end if;
 if coalesce(p->>'validUntil','')!~'^\d{4}-\d{2}-\d{2}$'then raise exception 'Enter shipping quote validity';end if;
 perform(p->>'validUntil')::date;
 return jsonb_build_object('priceCents',(p->>'priceCents')::bigint,'currency',p->>'currency','provider',p->>'provider','method',p->>'method','origin',p->>'origin','destination',p->>'destination','insurance',p->>'insurance','services',p->>'services','tradeTerms',p->>'tradeTerms','transitDays',(p->>'transitDays')::integer,'cartons',(p->>'cartons')::integer,'weightKg',(p->>'weightKg')::numeric,'lengthCm',(p->>'lengthCm')::numeric,'widthCm',(p->>'widthCm')::numeric,'heightCm',(p->>'heightCm')::numeric,'validUntil',p->>'validUntil');
end$$;
revoke all on function public.freight_validate(jsonb)from public,anon,authenticated;
-- Extend the existing team-authorised quotation implementation, retaining its validation and revisions.
do $$declare d text;begin
 select pg_get_functiondef('public.team_impl_submit_manufacturer_quote(uuid,jsonb)'::regprocedure)into d;
 if position('public.freight_validate'in d)=0 then
 d:=replace(d,'unit_price := (tier->>''unitPriceCents'')::numeric;', 'perform public.freight_validate(tier->''shipping''); if (tier->''shipping''->>''validUntil'')::date<current_date then raise exception ''Shipping quote has expired'';end if; unit_price := (tier->>''unitPriceCents'')::numeric;');
 d:=replace(d,'''leadTimeDays'',days)', '''leadTimeDays'',days,''shipping'',public.freight_validate(tier->''shipping''))');execute d;
 end if;end$$;
create or replace function public.freight_context(p_order uuid)returns jsonb language plpgsql stable security definer set search_path=public as $$declare o orders%rowtype;opt jsonb;events jsonb;begin
 select *into o from orders where id=p_order;
 if not found or not(public.is_superadmin()or o.user_id=auth.uid()or public.factory_order_visible(o.id))then raise exception 'Order access denied';end if;
 select value->'shipping' into opt from jsonb_array_elements(coalesce(o.price_options,'[]'))where value->>'id'=o.selected_price_option_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'details',e.details,'created_at',e.created_at)order by e.created_at desc),'[]')into events from order_logistics_events e where order_id=p_order;
 return jsonb_build_object('approved',case when public.is_superadmin()or o.user_id=auth.uid()then opt else opt-array['priceCents','manufacturingCents','serviceFeeCents','taxCents','dutiesCents','otherCents','roundingCents','totalCents','currency']end,'events',events,'operational',(select q.terms-array['priceCents','currency']from order_freight_selections s join order_freight_quotes q on q.id=s.quote_id where s.order_id=p_order and s.option_id=o.selected_price_option_id),'canManage',public.is_superadmin(),'paid',o.payment_verified_at is not null,'qcApproved',o.qc_status='approved','manufacturerQuotes',case when public.is_superadmin()or(public.factory_order_visible(o.id)and public.factory_has_permission(o.assigned_manufacturer_id,'view_financial'))then o.manufacturer_quote else null end,
 'quotes',case when public.is_superadmin()then(select coalesce(jsonb_agg(to_jsonb(q)order by created_at desc),'[]')from order_freight_quotes q where order_id=p_order)else '[]'end,
 'selections',case when public.is_superadmin()then(select coalesce(jsonb_agg(to_jsonb(s)),'[]')from order_freight_selections s where order_id=p_order)else '[]'end,
 'amendments',case when public.is_superadmin()then(select coalesce(jsonb_agg(to_jsonb(a)order by created_at desc),'[]')from order_shipping_amendments a where order_id=p_order)else '[]'end);
end$$;
create or replace function public.freight_add_quote(p_order uuid,p_option text,p_terms jsonb,p_forwarder uuid default null)returns uuid language plpgsql security definer set search_path=public as $$declare o orders%rowtype;t jsonb;validated_terms jsonb;v uuid;begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 select *into o from orders where id=p_order for update;select value into t from jsonb_array_elements(coalesce(o.manufacturer_quote,'[]'))where value->>'id'=p_option;
 if t is null then raise exception 'Manufacturer quotation option is missing';end if;
 if p_forwarder is null then validated_terms:=public.freight_validate(t->'shipping');else
 if not exists(select 1 from freight_forwarders where id=p_forwarder and active)then raise exception 'Select an active forwarder';end if;validated_terms:=public.freight_validate(p_terms);end if;
 if(validated_terms->>'validUntil')::date<current_date then raise exception 'Shipping quote has expired';end if;
 select id into v from order_freight_quotes where order_id=p_order and option_id=p_option and tier_snapshot=t and manufacturer_quoted_at=o.quoted_at and terms=validated_terms and forwarder_id is not distinct from p_forwarder order by created_at desc limit 1;
 if v is not null then return v;end if;
 insert into order_freight_quotes(order_id,option_id,manufacturer_id,tier_snapshot,manufacturer_quoted_at,forwarder_id,source,terms,created_by)values(p_order,p_option,o.assigned_manufacturer_id,t,o.quoted_at,p_forwarder,case when p_forwarder is null then 'manufacturer'else 'forwarder'end,validated_terms,auth.uid())returning id into v;return v;
end$$;
create or replace function public.freight_select(p_order uuid,p_quote uuid,p_amendment_reason text default null)returns uuid language plpgsql security definer set search_path=public as $$declare o orders%rowtype;q order_freight_quotes%rowtype;t jsonb;begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 select *into o from orders where id=p_order for update;select *into q from order_freight_quotes where id=p_quote and order_id=p_order;
 select value into t from jsonb_array_elements(coalesce(o.manufacturer_quote,'[]'))where value->>'id'=q.option_id;
 if q.id is null or q.manufacturer_id is distinct from o.assigned_manufacturer_id or q.manufacturer_quoted_at is distinct from o.quoted_at or t is distinct from q.tier_snapshot or(q.terms->>'validUntil')::date<current_date then raise exception 'Shipping quote is expired or belongs to an earlier manufacturer quotation';end if;
 if o.payment_verified_at is not null then
 if o.status not in('processing','shipping')then raise exception 'Shipping can only be amended for active paid orders';end if;
 if q.option_id<>o.selected_price_option_id or length(trim(coalesce(p_amendment_reason,'')))<3 then raise exception 'A paid shipping change requires an admin-approved amendment and reason';end if;
 -- The customer obligation never changes: Ceriga absorbs any cost difference. A customer price change requires a new approved quote.
 insert into order_shipping_amendments(order_id,quote_id,reason,approved_by)values(p_order,p_quote,p_amendment_reason,auth.uid());
 elsif o.status='priced'and o.quote_expires_at>now()then raise exception 'An issued offer is locked; revise or expire it before changing shipping';end if;
 insert into order_freight_selections(order_id,option_id,quote_id,selected_by)values(p_order,q.option_id,q.id,auth.uid())on conflict(order_id,option_id)do update set quote_id=excluded.quote_id,selected_by=excluded.selected_by,selected_at=now();return q.id;
end$$;
-- A wrapper reuses authoritative FX, commission and 30-day immutable quote history.
do $$begin if to_regprocedure('public.freight_publish_base(uuid,jsonb)')is null then alter function public.publish_order_quote(uuid,jsonb)rename to freight_publish_base;end if;end$$;
revoke all on function public.freight_publish_base(uuid,jsonb)from public,anon,authenticated;
-- Enrich the base issuance before its existing immutable snapshot is inserted.
do $$declare d text;begin
 select pg_get_functiondef('public.freight_publish_base(uuid,jsonb)'::regprocedure)into d;
 if position('publicShipping'in d)=0 then
 d:=replace(d,'''shippingIncludedInManufacturerQuote'',true','''shippingIncludedInManufacturerQuote'',false');
 d:=replace(d,'perform set_config(''app.routing_write'',p_order_id::text,true);','select jsonb_agg(v||jsonb_build_object(''shipping'',a->''publicShipping'',''currencySnapshot'',(v->''currencySnapshot'')||jsonb_build_object(''freight'',a->''internalFreight'')))into options from jsonb_array_elements(options)v join jsonb_array_elements(p_prices)a on a->>''id''=v->>''id''; perform set_config(''app.routing_write'',p_order_id::text,true);');execute d;
 end if;end$$;
create or replace function public.freight_prepare_prices(p_order_id uuid,p_prices jsonb)returns jsonb language plpgsql security definer set search_path=public as $$declare o orders%rowtype;t jsonb;a jsonb;q order_freight_quotes%rowtype;inputs jsonb:='[]';ship bigint;subtotal bigint;fee bigint;tax bigint;duties bigint;other bigint;total bigint;fx jsonb;target text;pub jsonb;components jsonb;k text;v bigint;rounded bigint;begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 select *into o from orders where id=p_order_id for update;select preferred_currency into target from profiles where id=o.user_id for share;perform 1 from currency_rate_cache for share;
 if jsonb_typeof(p_prices)is distinct from 'array'or jsonb_array_length(p_prices)<>jsonb_array_length(coalesce(o.manufacturer_quote,'[]'))or(select count(distinct value->>'id')from jsonb_array_elements(p_prices))<>jsonb_array_length(p_prices)then raise exception 'Approve every quotation option exactly once';end if;
 for t in select value from jsonb_array_elements(coalesce(o.manufacturer_quote,'[]'))loop
 if t->'shipping' is null or t->'shipping'='null'::jsonb then raise exception 'Request a revised manufacturer quote with separate manufacturing and shipping costs before issuing new pricing';end if;
 select value into a from jsonb_array_elements(p_prices)where value->>'id'=t->>'id';
 select f.*into q from order_freight_selections s join order_freight_quotes f on f.id=s.quote_id where s.order_id=p_order_id and s.option_id=t->>'id';
 if q.id is null or q.tier_snapshot is distinct from t or q.manufacturer_id is distinct from o.assigned_manufacturer_id or q.manufacturer_quoted_at is distinct from o.quoted_at or(q.terms->>'validUntil')::date<current_date then raise exception 'Confirm valid shipping for each option before sending the quotation';end if;
 if a is null or exists(select 1 from unnest(array['cents','feesCents','taxCents','dutiesCents','otherCents'])keys(field) where coalesce(a->>keys.field,case when keys.field='cents'then ''else '0'end)!~'^[0-9]+$')then raise exception 'Enter manufacturing subtotal and non-negative charges in the manufacturing currency';end if;
 subtotal:=(a->>'cents')::bigint;fee:=coalesce((a->>'feesCents')::bigint,0);tax:=coalesce((a->>'taxCents')::bigint,0);duties:=coalesce((a->>'dutiesCents')::bigint,0);other:=coalesce((a->>'otherCents')::bigint,0);
 fx:=public.currency_convert_minor((q.terms->>'priceCents')::bigint,q.terms->>'currency',t->>'currency',true);ship:=(fx->>'amount')::bigint;total:=subtotal+ship+fee+tax+duties+other;
 if subtotal<(t->>'manufacturerQuoteCents')::bigint or total>100000000000 then raise exception 'Manufacturing subtotal must cover the manufacturer cost and total must be within limits';end if;
 components:=jsonb_build_object('manufacturingCents',subtotal,'priceCents',ship,'serviceFeeCents',fee,'taxCents',tax,'dutiesCents',duties,'otherCents',other);pub:='{}';rounded:=0;
 foreach k in array array['manufacturingCents','priceCents','serviceFeeCents','taxCents','dutiesCents','otherCents']loop v:=((public.currency_convert_minor((components->>k)::bigint,t->>'currency',target,true))->>'amount')::bigint;pub:=pub||jsonb_build_object(k,v);rounded:=rounded+v;end loop;
 v:=((public.currency_convert_minor(total,t->>'currency',target,true))->>'amount')::bigint;
 pub:=pub||jsonb_build_object('roundingCents',v-rounded,'totalCents',v,'provider',q.terms->>'provider','method',q.terms->>'method','transitDays',q.terms->'transitDays','origin',q.terms->>'origin','destination',q.terms->>'destination','insurance',q.terms->>'insurance','services',q.terms->>'services','tradeTerms',q.terms->>'tradeTerms','currency',target,'confirmedAt',now());
 inputs:=inputs||jsonb_build_array(jsonb_build_object('id',t->>'id','cents',total,'shippingCents',ship,'taxCents',tax+duties,'feesCents',fee+other,'publicShipping',pub,'internalFreight',jsonb_build_object('quoteId',q.id,'originalTerms',q.terms,'conversion',fx,'manufacturerSubtotalCents',subtotal,'costCurrency',t->>'currency')));
 end loop;
 return inputs;
end$$;
create or replace function public.publish_order_quote(p_order_id uuid,p_prices jsonb)returns uuid language plpgsql security definer set search_path=public as $$begin
 return public.freight_publish_base(p_order_id,public.freight_prepare_prices(p_order_id,p_prices));end$$;
-- The existing temporary Submit-without-payment path cannot release freight-backed offers.
create or replace function public.freight_payment_gate()returns trigger language plpgsql security definer set search_path=public as $$begin
 if exists(select 1 from jsonb_array_elements(coalesce(new.price_options,'[]'))v where v?'shipping')and new.status in('processing','shipping','completed')and (new.payment_verified_at is null or not exists(select 1 from order_verified_payments p where p.order_id=new.id and p.option_id=new.selected_price_option_id and p.amount_cents=new.paid_amount_cents and p.currency=(select value->>'currency' from jsonb_array_elements(new.price_options)where value->>'id'=new.selected_price_option_id) and p.amount_cents=(select (value->>'priceCents')::bigint from jsonb_array_elements(new.price_options)where value->>'id'=new.selected_price_option_id)))then raise exception 'Verified full quotation payment including shipping is required before production';end if;return new;end$$;
drop trigger if exists freight_verified_payment on public.orders;
create trigger freight_verified_payment before update on public.orders for each row execute function public.freight_payment_gate();
create or replace function public.freight_logistics_update(p_order uuid,p_id uuid,p_status text,p_details jsonb)returns uuid language plpgsql security definer set search_path=public as $$declare o orders%rowtype;last_status text;begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 select *into o from orders where id=p_order for update;
 if exists(select 1 from order_logistics_events where id=p_id and order_id=p_order)then if exists(select 1 from order_logistics_events where id=p_id and status is distinct from p_status)then raise exception 'This request was already used for a different shipping update';end if;return p_id;end if;
 if o.kind<>'production'or o.payment_verified_at is null or o.qc_status<>'approved'or o.status not in('processing','shipping')then raise exception 'Paid production and approved QC are required before shipping';end if;
 if not exists(select 1 from jsonb_array_elements(coalesce(o.price_options,'[]'))v where v->>'id'=o.selected_price_option_id and v?'shipping')then raise exception 'A confirmed shipping arrangement is required';end if;
 select status into last_status from order_logistics_events where order_id=p_order order by created_at desc limit 1;
 if p_status not in('collection_scheduled','ready_for_collection','collected','in_transit','customs_clearance','out_for_delivery','delivered','exception')or p_status=last_status then raise exception 'Select a new valid shipping status';end if;
 if p_status in('collected','in_transit','customs_clearance','out_for_delivery','delivered')and(o.status<>'shipping')then raise exception 'Record the approved QC release handover before advancing tracking';end if;
 if p_status='delivered'and not exists(select 1 from order_logistics_events where order_id=p_order and status in('in_transit','out_for_delivery','customs_clearance'))then raise exception 'Record transit before delivery';end if;
 if jsonb_typeof(p_details)is distinct from 'object'or length(coalesce(p_details->>'note',''))>2000 or (p_status='exception'and length(trim(coalesce(p_details->>'note','')))<3)then raise exception 'Enter a short exception reason';end if;
 if coalesce(p_details->>'proof','')<>''and (p_details->>'proof'!~'^https://[^[:space:]]+$'or length(p_details->>'proof')>2000)then raise exception 'Proof of delivery must be a valid HTTPS document link';end if;
 if p_status='collection_scheduled'and nullif(p_details->>'collectionAt','')is null then raise exception 'Enter the collection date and time';end if;
 if nullif(p_details->>'collectionAt','')is not null then perform(p_details->>'collectionAt')::timestamp;end if;
 if nullif(p_details->>'eta','')is not null then perform(p_details->>'eta')::date;end if;
 insert into order_logistics_events(id,order_id,status,details,created_by)values(p_id,p_order,p_status,jsonb_build_object('tracking',left(coalesce(p_details->>'tracking',''),200),'carrier',left(coalesce(p_details->>'carrier',''),200),'eta',p_details->>'eta','collectionAt',p_details->>'collectionAt','note',coalesce(p_details->>'note',''),'proof',p_details->>'proof'),auth.uid());
 if p_status='delivered'then perform public.confirm_order_delivery(p_order,coalesce(p_details->>'note','Delivered by selected shipping provider'));end if;return p_id;
end$$;
do $$declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in('freight_prepare_prices','freight_context','freight_add_quote','freight_select','freight_logistics_update','publish_order_quote')loop execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);end loop;end$$;
revoke all on function public.freight_payment_gate()from public,anon,authenticated;
-- Factories receive operational shipping instructions, never the customer's payable breakdown.
do $$declare d text;begin select pg_get_functiondef('public.public_price_options(jsonb,boolean)'::regprocedure)into d;if position('''shipping'''in d)=0 then d:=replace(d,'''shippingQuoteCents'',''taxCents'',''feesCents''','''shippingQuoteCents'',''taxCents'',''feesCents'',''shipping''');execute d;end if;end$$;

do $$declare d text;begin select pg_get_functiondef('public.public_price_options(jsonb,boolean)'::regprocedure)into d;d:=replace(d,'''originalManufacturerCents'',''markupCents'',''shippingIncludedInManufacturerQuote''','''originalManufacturerCents'',''markupCents'',''shippingIncludedInManufacturerQuote'',''freight''');execute d;end$$;
create or replace function public.freight_history_immutable()returns trigger language plpgsql set search_path=public as $$begin raise exception 'Freight history is immutable; create a new quotation, amendment or tracking event';end$$;
do $$declare t text;begin foreach t in array array['order_freight_quotes','order_logistics_events','order_shipping_amendments']loop execute format('drop trigger if exists freight_preserve_history on public.%I',t);execute format('create trigger freight_preserve_history before update or delete on public.%I for each row execute function public.freight_history_immutable()',t);end loop;end$$;
revoke all on function public.freight_history_immutable()from public,anon,authenticated;
