begin;

create or replace function public.account_order_projection(p_order public.orders) returns public.orders
language plpgsql stable security definer set search_path=public as $$
declare result public.orders%rowtype; factory boolean; bulk_run record;
begin
  if auth.uid() is null then raise exception 'Sign in to view orders'; end if;
  if not(public.is_superadmin() or p_order.user_id=auth.uid() or public.factory_order_visible(p_order.id)) then
    raise exception 'Order access denied';
  end if;
  result := p_order;
  if public.is_superadmin() then return result; end if;
  factory := public.factory_order_visible(p_order.id) and p_order.user_id <> auth.uid();
  result.ops_notes := null;
  result.price_options := public.public_price_options(p_order.price_options,coalesce(factory,false));
  if factory then
    result.paid_amount_cents := null; result.total := null; result.paid_currency := null; result.total_currency := null;
    if not public.factory_has_permission(p_order.assigned_manufacturer_id,'view_financial') then
      result.manufacturer_quote := null;
      select jsonb_agg(jsonb_build_object('id',x->'id','kind',x->'kind','label',x->'label','totalUnits',x->'totalUnits','leadTimeDays',x->'leadTimeDays'))
      into result.price_options from jsonb_array_elements(coalesce(p_order.price_options,'[]')) x;
    end if;
    result.specifications := public.factory_safe_specification(p_order.specifications,p_order.user_id,p_order.contact_name,p_order.contact_email);
    result.order_quantities := public.factory_safe_specification(p_order.order_quantities,p_order.user_id,p_order.contact_name,p_order.contact_email);
    -- Builder bulk IDs contain a timestamp that the free-text privacy scrubber
    -- treats as a phone number. Preserve this exact format only at the bulk ID field.
    if jsonb_typeof(result.order_quantities->'bulkRuns') = 'array' then
      for bulk_run in
        select value->>'id' as id, (position - 1)::text as idx
        from jsonb_array_elements(p_order.order_quantities->'bulkRuns') with ordinality as runs(value, position)
        where value->>'id' ~ '^bulk-[0-9]{13}-[a-z0-9]{1,5}$'
      loop
        result.order_quantities := jsonb_set(result.order_quantities, array['bulkRuns',bulk_run.idx,'id'], to_jsonb(bulk_run.id));
      end loop;
    end if;
    result.user_id := null; result.product_id := null; result.contact_name := null; result.contact_email := null; result.contact_phone := null;
    result.delivery_confirmed_by := null; result.delivery_confirmation_note := null;
    result.product_name := public.factory_safe_order_title(p_order.product_name,p_order.garment_type,p_order.user_id,p_order.contact_name,p_order.contact_email);
    result.quote_request := jsonb_strip_nulls(jsonb_build_object(
      'quantity',case when p_order.quote_request->>'quantity' ~ '^[0-9]{1,12}$' then p_order.quote_request->'quantity' end,
      'timeline',case when p_order.quote_request->>'timeline' ~ '^[0-9]{1,3} (day|days|week|weeks|month|months)$' then p_order.quote_request->'timeline' end));
    if p_order.delivery_address is not null then
      if p_order.production_released_at is not null and p_order.qc_status='approved'
        and public.factory_has_permission(p_order.assigned_manufacturer_id,'shipping') then
        result.delivery_address := p_order.delivery_address - array['firstName','lastName','email','phone','instructions'];
      else result.delivery_address := jsonb_strip_nulls(jsonb_build_object('country',p_order.delivery_address->'country'));
      end if;
    end if;
  else
    result.manufacturer_quote := null; result.factory_reject_reason := null;
  end if;
  return result;
end
$$;

-- Match the form, which omits zero-quantity sample and bulk placeholders.
do $migration$
declare
  definition text := pg_get_functiondef('public.team_impl_submit_manufacturer_quote(uuid,jsonb)'::regprocedure);
  original text := $original$requirements := jsonb_build_array(target.order_quantities->'sample') || coalesce(target.order_quantities->'bulkRuns','[]'::jsonb);$original$;
  replacement text := $replacement$select coalesce(jsonb_agg(value order by position),'[]'::jsonb) into requirements
  from jsonb_array_elements(jsonb_build_array(target.order_quantities->'sample') || coalesce(target.order_quantities->'bulkRuns','[]'::jsonb))
    with ordinality as options(value, position)
  where coalesce((value->>'targetTotal')::numeric,
    (select sum(size.value::numeric) from jsonb_each_text(coalesce(options.value->'bySize','{}'::jsonb)) as size)) is distinct from 0;$replacement$;
begin
  if strpos(definition,replacement)>0 then return; end if;
  if strpos(definition,original)=0 then raise exception 'Unexpected quotation requirements definition'; end if;
  execute replace(definition,original,replacement);
end
$migration$;

notify pgrst, 'reload schema';

commit;
