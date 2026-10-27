-- Fields already used by the order form and order operations, missing on older deployments.
begin;
alter table public.orders
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists delivery_address jsonb,
  add column if not exists assigned_at timestamptz,
  add column if not exists due_quote_by date,
  add column if not exists manufacturer_quote jsonb,
  add column if not exists factory_status text check(factory_status is null or factory_status in
    ('new','reviewing','clarifying','quoted','rejected','in_production','completed')),
  add column if not exists factory_reject_reason text,
  add column if not exists quoted_at timestamptz,
  add column if not exists ops_notes text;
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_factory_status_idx on public.orders(factory_status);
notify pgrst,'reload schema';
commit;
