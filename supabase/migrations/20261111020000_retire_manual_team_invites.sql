begin;
revoke all on function public.factory_team_invite(text,text,uuid) from public,anon,authenticated;
do $$
declare definition text;
begin
  select pg_get_functiondef('public.platform_worker_manage(text,jsonb)'::regprocedure) into definition;
  if strpos(definition,'if p_action in (''invite'',''regenerate'',''copy_invite'')')=0 then
    execute replace(definition,'  if p_action in (''regenerate'',''copy_invite'') and exists (',
      '  if p_action in (''invite'',''regenerate'',''copy_invite'') then raise exception ''Use the team invitation email service''; end if; if false and exists (');
  end if;
end$$;
update public.platform_worker_invitations set token_value='' where token_value<>'';
notify pgrst, 'reload schema';
commit;
