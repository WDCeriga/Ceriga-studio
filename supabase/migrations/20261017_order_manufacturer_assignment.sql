-- Narrow repair for deployments missing the order-to-manufacturer assignment.
alter table public.orders
  add column if not exists assigned_manufacturer_id uuid
  references auth.users(id) on delete set null;

notify pgrst, 'reload schema';
