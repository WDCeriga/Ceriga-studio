begin;

-- Return opaque IDs only. The existing document function rechecks access
-- before it streams any bytes to the selected factory.
create or replace function public.factory_order_mockups(p_orders uuid[])
returns table(order_id uuid, document_id uuid)
language sql stable security definer set search_path = public as $$
  select distinct on (requested.id) requested.id, d.id
  from unnest(p_orders[1:24]) as requested(id)
  cross join lateral jsonb_array_elements(public.factory_order_documents_list(requested.id)) as allowed(item)
  join public.factory_order_documents d on d.id = (allowed.item->>'id')::uuid
  join storage.objects obj on obj.bucket_id = 'order-uploads' and obj.name = d.storage_path
  where lower(coalesce(obj.metadata->>'mimetype', '')) in ('image/png','image/jpeg','image/webp')
     or (obj.metadata->>'mimetype' is null and d.storage_path ~* '\.(png|jpe?g|webp)$')
  order by requested.id,
    (d.storage_path ~* '/[^/]*submitted-mockup\.png$') desc,
    (d.storage_path ~* '(mockup|preview)') desc,
    d.id
$$;

revoke all on function public.factory_order_mockups(uuid[]) from public, anon;
grant execute on function public.factory_order_mockups(uuid[]) to authenticated;
notify pgrst, 'reload schema';

commit;
