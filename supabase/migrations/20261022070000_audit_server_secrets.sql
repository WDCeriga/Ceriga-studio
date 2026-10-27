begin;
create schema if not exists ceriga_private;
revoke all on schema ceriga_private from public,anon,authenticated;
create table if not exists ceriga_private.integration_settings(key text primary key,value jsonb not null,updated_at timestamptz not null default now());
alter table ceriga_private.integration_settings enable row level security;
revoke all on ceriga_private.integration_settings from public,anon,authenticated;
insert into ceriga_private.integration_settings(key,value)select key,value from public.platform_settings where key='api_keys' on conflict(key)do nothing;
update public.platform_settings set value='{}'::jsonb where key='api_keys' and exists(select 1 from ceriga_private.integration_settings where key='api_keys');
drop policy if exists platform_settings_protect_credentials on public.platform_settings;
create policy platform_settings_protect_credentials on public.platform_settings as restrictive for all to authenticated using(key<>'api_keys')with check(key<>'api_keys');
create or replace function public.admin_integration_status()returns jsonb language plpgsql security definer set search_path=public as $$begin
 if not public.is_superadmin()then raise exception 'Super admin access required';end if;
 return jsonb_build_object('emailConfigured',exists(select 1 from ceriga_private.integration_settings where key='api_keys'and length(coalesce(value->>'sendgridKey',''))>0));
end $$;
revoke all on function public.admin_integration_status()from public,anon;grant execute on function public.admin_integration_status()to authenticated;
create table if not exists ceriga_private.ai_request_windows(user_id uuid primary key references auth.users(id)on delete cascade,window_start timestamptz not null,requests integer not null);
alter table ceriga_private.ai_request_windows enable row level security;
revoke all on ceriga_private.ai_request_windows from public,anon,authenticated;
create or replace function public.authorise_ai_request(p_user uuid)returns boolean language plpgsql security definer set search_path=public as $$declare n integer;begin
 if current_user<>'postgres'and coalesce(auth.jwt()->>'role','')<>'service_role'then raise exception 'Server access required';end if;
 if not exists(select 1 from auth.users where id=p_user)then return false;end if;
 insert into ceriga_private.ai_request_windows(user_id,window_start,requests)values(p_user,now(),1)on conflict(user_id)do update set window_start=case when ceriga_private.ai_request_windows.window_start<now()-interval '1 minute'then now()else ceriga_private.ai_request_windows.window_start end,requests=case when ceriga_private.ai_request_windows.window_start<now()-interval '1 minute'then 1 else ceriga_private.ai_request_windows.requests+1 end returning requests into n;
 return n<=6;
end $$;
revoke all on function public.authorise_ai_request(uuid)from public,anon,authenticated;grant execute on function public.authorise_ai_request(uuid)to service_role;
notify pgrst,'reload schema';
commit;
