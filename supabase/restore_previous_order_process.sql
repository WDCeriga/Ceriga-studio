begin;
-- Restore only the guards installed by the abandoned workflow. No rows or tables are deleted.
do $$ begin
 if exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='wf_protect_order') then
  alter table public.orders disable trigger wf_protect_order;
 end if;
 if exists(select 1 from pg_trigger where tgrelid='public.manufacturer_profiles'::regclass and tgname='wf_guard_factory_status') then
  alter table public.manufacturer_profiles disable trigger wf_guard_factory_status;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
select 'Previous order process restored; existing data retained' result,
 not exists(select 1 from pg_trigger where tgname in('wf_protect_order','wf_guard_factory_status') and tgenabled<>'D') guards_restored;
