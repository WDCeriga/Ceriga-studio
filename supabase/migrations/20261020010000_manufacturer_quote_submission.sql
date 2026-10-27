begin;
create or replace function public.submit_manufacturer_quote(p_order_id uuid, p_tiers jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare target public.orders%rowtype; tier jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to submit a quotation'; end if;
 select * into target from public.orders where id=p_order_id for update;
 if not found or target.assigned_manufacturer_id is distinct from auth.uid() then
  raise exception 'This order is not assigned to your factory';
 end if;
 if target.status not in ('submitted','awaiting_payment') or coalesce(target.factory_status,'new') not in ('new','reviewing','clarifying','quoted') then
  raise exception 'This order is no longer accepting manufacturer quotations';
 end if;
 if jsonb_typeof(p_tiers) is distinct from 'array' or jsonb_array_length(p_tiers) not between 1 and 20 then raise exception 'Provide at least one quotation tier'; end if;
 for tier in select value from jsonb_array_elements(p_tiers) loop
  if jsonb_typeof(tier) is distinct from 'object'
    or coalesce(tier->>'id','')='' or coalesce(tier->>'label','')=''
    or coalesce(tier->>'kind','') not in ('sample','bulk')
    or coalesce(tier->>'currency','')<>'GBP'
    or coalesce(tier->>'totalUnits','') !~ '^[1-9][0-9]*$'
    or coalesce(tier->>'manufacturerQuoteCents','') !~ '^[1-9][0-9]*$'
    or coalesce(tier->>'leadTimeDays','') !~ '^[1-9][0-9]*$'
  then raise exception 'Each tier requires quantity, a positive GBP total and lead time'; end if;
  if (tier->>'manufacturerQuoteCents')::numeric>100000000000 or (tier->>'totalUnits')::numeric>100000000 or (tier->>'leadTimeDays')::numeric>3650 then raise exception 'Quotation values exceed supported limits';end if;
 end loop;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_tiers))<>jsonb_array_length(p_tiers) then raise exception 'Quotation tier IDs must be unique'; end if;
 update public.orders set manufacturer_quote=p_tiers, factory_status='quoted', quoted_at=now() where id=p_order_id;
 return p_order_id;
end $$;
revoke all on function public.submit_manufacturer_quote(uuid,jsonb) from public,anon;
grant execute on function public.submit_manufacturer_quote(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
