-- Quote assignment evaluates the requirements actually saved on an order.
-- Missing specifications, unknown capacity and unreviewed garment details are
-- explicit review warnings, not fabricated capability mismatches. Known garment,
-- technique, confirmed fabric/style/GSM, quantity and availability mismatches still
-- block the application action. Quotation does not authorize production.
-- Existing JSONB documents and server-side superadmin assignment authorization are
-- reused unchanged; do not invent requirements or confirmations for older orders.
begin read only;
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='specifications' and data_type='jsonb')
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='manufacturer_customisation_settings' and column_name='settings' and data_type='jsonb')
 then raise exception 'Assignment review requires order specifications and manufacturer settings';end if;
 if has_function_privilege('anon','public.assign_order_manufacturer(uuid,uuid,date)','execute') then raise exception 'Anonymous clients must not assign manufacturers';end if;
end $$;
commit;
