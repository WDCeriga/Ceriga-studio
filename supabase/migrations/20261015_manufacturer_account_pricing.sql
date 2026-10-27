-- One account preference inside the existing profile pricing object.
-- Old rows and historical order/quote amounts are not rewritten or converted.
alter table public.manufacturer_profiles add column if not exists pricing jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'manufacturer_profiles_pricing_object'
    and conrelid = 'public.manufacturer_profiles'::regclass) then
    alter table public.manufacturer_profiles add constraint manufacturer_profiles_pricing_object
      check (pricing is null or (jsonb_typeof(pricing) = 'object' and pricing->>'preferredCurrency' in ('GBP','USD','EUR')));
  end if;
end;
$$;
