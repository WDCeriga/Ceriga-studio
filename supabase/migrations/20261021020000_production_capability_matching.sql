-- Detailed capability matching reuses existing, owner-isolated JSONB documents.
-- manufacturer_customisation_settings.settings.garmentDetails stores the manufacturer's
-- reviewed styles, materials, construction details, GSM range and confirmed flag.
-- orders.specifications stores the customer's actual fabric, GSM, styles,
-- constructionDetails and explicit requiredCapabilities (including [] for plain garments).
-- Historical documents are not backfilled with suggestions or invented confirmations.
-- No tables, grants, RLS, storage policies or records need changing for these fields.
begin read only;
do $$
begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='manufacturer_customisation_settings' and column_name='settings' and data_type='jsonb')
 or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='specifications' and data_type='jsonb') then raise exception 'Capability matching requires the existing JSONB settings and order specifications columns';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in('orders','manufacturer_customisation_settings') and not c.relrowsecurity)then raise exception 'Capability matching requires existing RLS protections';end if;
end $$;
commit;
