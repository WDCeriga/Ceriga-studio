begin;
-- Upload the initial files before creating the order so assignment sees a complete request.
create or replace function public.create_customer_order(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  o public.orders%rowtype;
  kind_value text;
  order_id uuid := coalesce(nullif(p_input->>'id','')::uuid,gen_random_uuid());
  object_path text;
begin
  if auth.uid() is null then raise exception 'Sign in to create an order'; end if;
  kind_value := p_input->>'kind';
  if kind_value not in ('production','tech-pack') or kind_value is null
    or length(btrim(coalesce(p_input->>'product_name',''))) not between 1 and 300 then
    raise exception 'A valid order type and product name are required';
  end if;
  if p_input->'quote_request'->'storagePaths' is not null
    and jsonb_typeof(p_input->'quote_request'->'storagePaths') is distinct from 'array' then
    raise exception 'Order file paths must be an array';
  end if;
  for object_path in select jsonb_array_elements_text(coalesce(p_input->'quote_request'->'storagePaths','[]'::jsonb)) loop
    if split_part(object_path,'/',1)<>auth.uid()::text or split_part(object_path,'/',2)<>order_id::text
      or not exists(select 1 from storage.objects where bucket_id='order-uploads' and name=object_path) then
      raise exception 'Files must belong to this order and customer';
    end if;
  end loop;
  insert into public.orders(id,user_id,kind,product_name,garment_type,product_id,status,status_label,
    order_quantities,quote_request,specifications,contact_name,contact_email,contact_phone,delivery_address,export_format)
  values(order_id,auth.uid(),kind_value,btrim(p_input->>'product_name'),coalesce(p_input->>'garment_type',''),
    p_input->>'product_id','submitted','Awaiting review',p_input->'order_quantities',p_input->'quote_request',
    p_input->'specifications',p_input->>'contact_name',p_input->>'contact_email',p_input->>'contact_phone',
    p_input->'delivery_address',p_input->>'export_format') returning * into o;
  select saved.* into o from public.orders saved where saved.id=order_id;
  return to_jsonb(public.account_order_projection(o));
end $$;
revoke all on function public.create_customer_order(jsonb) from public,anon;
grant execute on function public.create_customer_order(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
