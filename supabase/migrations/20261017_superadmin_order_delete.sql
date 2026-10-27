drop policy if exists "orders_delete_superadmin" on public.orders;
create policy "orders_delete_superadmin"
  on public.orders for delete
  to authenticated
  using (public.is_superadmin());
