-- R07/R10: explicit advanced settings and non-price freight reuse.
begin;
create or replace function public.admin_matching_settings(p_value jsonb default null,p_expected jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare saved jsonb;k text;
begin
 if not coalesce(public.is_superadmin(),false)then raise exception 'Superadmin authorization required'using errcode='42501';end if;
 select value into saved from public.platform_settings where key='manufacturer_matching'for update;
 if p_value is not null then
  if p_expected is distinct from saved then raise exception 'Matching settings changed. Reload before saving.'using errcode='40001';end if;
  if jsonb_typeof(p_value)<>'object'or not(p_value?&array['windowDays','similarityPoints','workloadWeight','paidWeight','opportunityWeight','outstandingWeight'])or exists(select 1 from jsonb_object_keys(p_value)x where x not in('windowDays','similarityPoints','workloadWeight','paidWeight','opportunityWeight','outstandingWeight'))then raise exception 'Invalid matching settings';end if;
  foreach k in array array['windowDays','similarityPoints','workloadWeight','paidWeight','opportunityWeight','outstandingWeight']loop
   if jsonb_typeof(p_value->k)<>'number'or(p_value->>k)::numeric<0 or(p_value->>k)::numeric>365 then raise exception 'Invalid matching setting: %',k;end if;
  end loop;
  if(p_value->>'windowDays')::numeric not between 7 and 365 or trunc((p_value->>'windowDays')::numeric)<>(p_value->>'windowDays')::numeric or(p_value->>'similarityPoints')::numeric>25 then raise exception 'Invalid matching window or similarity';end if;
  foreach k in array array['workloadWeight','paidWeight','opportunityWeight','outstandingWeight']loop if(p_value->>k)::numeric>10 then raise exception 'Matching weights must be between 0 and 10';end if;end loop;
  update public.platform_settings set value=p_value,updated_at=now()where key='manufacturer_matching';
  if not found then raise exception 'Matching configuration is missing';end if;
  insert into public.admin_record_activity(entity,record_id,actor_id,action,previous,updated,reason)values('customer',auth.uid(),auth.uid(),'matching_settings',saved,p_value,'Advanced matching configuration');
  saved:=p_value;
 end if;
 return saved;
end$$;
revoke all on function public.admin_matching_settings(jsonb,jsonb)from public,anon;
grant execute on function public.admin_matching_settings(jsonb,jsonb)to authenticated;

create or replace function public.freight_apply_common_terms(p_order uuid,p_source uuid,p_targets uuid[])
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare o public.orders;s public.order_freight_quotes;q public.order_freight_quotes;v_id uuid;ids jsonb:='[]';tier jsonb;terms jsonb;
begin
 if not coalesce(public.is_superadmin(),false)then raise exception 'Superadmin authorization required'using errcode='42501';end if;
 select *into o from public.orders where id=p_order for update;
 if o.id is null or o.offer_issued_at is not null or o.payment_verified_at is not null or o.production_released_at is not null then raise exception 'Common terms are only editable before the customer quotation is issued';end if;
 if coalesce(cardinality(p_targets),0)not between 1 and 20 or p_source=any(p_targets)or cardinality(p_targets)<>(select count(distinct x)from unnest(p_targets)x)then raise exception 'Choose distinct target quotations';end if;
 select *into s from public.order_freight_quotes where id=p_source and order_id=p_order;
 if s.id is null or s.source<>'forwarder'or s.forwarder_id is null then raise exception 'Choose a saved forwarder quotation';end if;
 foreach v_id in array array_prepend(p_source,p_targets)loop
  select *into q from public.order_freight_quotes where order_id=p_order and order_freight_quotes.id=v_id;
  select value into tier from jsonb_array_elements(coalesce(o.manufacturer_quote,'[]'))where value->>'id'=q.option_id;
  if q.id is null or q.forwarder_id is distinct from s.forwarder_id or q.manufacturer_id is distinct from o.assigned_manufacturer_id or q.manufacturer_quoted_at is distinct from o.quoted_at or q.tier_snapshot is distinct from tier or(q.terms->>'validUntil')::date<current_date then raise exception 'Quotations must be current, valid and from the same forwarder';end if;
 end loop;
 foreach v_id in array p_targets loop
  select *into q from public.order_freight_quotes where order_freight_quotes.id=v_id;
  -- Prices, currencies, quantities, dimensions, routes, methods and validity remain independent.
  terms:=q.terms||jsonb_build_object('insurance',s.terms->'insurance','services',s.terms->'services','tradeTerms',s.terms->'tradeTerms');
  ids:=ids||jsonb_build_array(public.freight_add_quote(p_order,q.option_id,terms,q.forwarder_id));
 end loop;
 insert into public.admin_record_activity(entity,record_id,actor_id,action,previous,updated,reason)values('order',p_order,auth.uid(),'freight_common_terms',jsonb_build_object('source',p_source,'targets',p_targets),jsonb_build_object('quotes',ids),'Copied insurance, services and duty terms; prices unchanged. Selection remains separate.');
 return ids;
end$$;
revoke all on function public.freight_apply_common_terms(uuid,uuid,uuid[])from public,anon;
grant execute on function public.freight_apply_common_terms(uuid,uuid,uuid[])to authenticated;

-- The timestamp is evidence freshness, not a declaration of verified factory capacity.
create or replace function public.admin_manufacturer_matching(p_order uuid,p_due date)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare result jsonb;
begin
 if not coalesce(public.is_superadmin(),false)then raise exception 'Superadmin authorization required'using errcode='42501';end if;
 result:=public.rank_manufacturers_for_order(p_order,p_due);
 return result||jsonb_build_object('comparisonReleaseReady',coalesce((select enabled from public.order_payment_controls where id=true),false),
 'evidenceUpdatedAt',(select coalesce(jsonb_object_agg(m.user_id,m.updated_at),'{}')from public.manufacturer_profiles m));
end$$;
notify pgrst,'reload schema';
commit;
