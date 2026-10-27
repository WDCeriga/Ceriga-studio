begin;
create or replace function public.wf_guard_factory_status() returns trigger
language plpgsql set search_path=public as $$
begin
 if current_user in('authenticated','anon')and not public.is_superadmin()then
  if tg_op='INSERT'then
   if new.status<>'onboarding'or new.onboarding_complete or new.commission_plan_id is not null or not exists(select 1 from public.profiles where id=auth.uid()and role='manufacturer') then raise exception 'Only Ceriga may set factory eligibility or commission plans';end if;
  elsif (new.status,new.commission_plan_id,new.onboarding_complete) is distinct from(old.status,old.commission_plan_id,old.onboarding_complete)then raise exception 'Only Ceriga may change factory eligibility or commission plans';end if;
 end if;
 return new;
end $$;
notify pgrst,'reload schema';commit;
