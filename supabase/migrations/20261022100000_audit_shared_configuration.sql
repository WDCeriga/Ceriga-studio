begin;
create or replace function public.portal_configuration()returns jsonb language plpgsql security definer set search_path=public as $$
begin
 return coalesce((select jsonb_object_agg(key,value)from public.platform_settings where key='shipping_carriers'or key like 'catalog_base_%'or(key like 'catalog_product_%'and(public.is_superadmin()or coalesce((value->>'published')::boolean,false)))),'{}');
end $$;
revoke all on function public.portal_configuration()from public;grant execute on function public.portal_configuration()to anon,authenticated;
notify pgrst,'reload schema';
commit;
