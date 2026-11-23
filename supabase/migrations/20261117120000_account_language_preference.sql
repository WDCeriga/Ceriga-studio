begin;

alter table public.profiles add column if not exists preferred_language text
  check (preferred_language in ('en','zh-CN','tr','pt','es','fr'));

create or replace function public.account_language_preference(p_account uuid, p_language text default null)
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare saved text;
begin
  if auth.uid() is null or auth.uid() is distinct from p_account then
    raise exception 'Language preference access denied' using errcode='42501';
  end if;
  if p_language is null then
    select preferred_language into saved from public.profiles where id=auth.uid();
  else
    if p_language not in ('en','zh-CN','tr','pt','es','fr') then
      raise exception 'Unsupported language' using errcode='22023';
    end if;
    update public.profiles set preferred_language=p_language where id=auth.uid()
      returning preferred_language into saved;
    if not found then raise exception 'Account profile unavailable'; end if;
  end if;
  return saved;
end $$;

revoke all on function public.account_language_preference(uuid,text) from public,anon,authenticated;
grant execute on function public.account_language_preference(uuid,text) to authenticated;

notify pgrst,'reload schema';
commit;
