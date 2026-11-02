begin;
-- Workspace membership, not a legacy profile label, authorises the factory dashboard.
-- The public wrapper still enters the factory context and the projection retains record-level filtering.
do $migration$
declare definition text;old_guard text:='not p_admin and not exists(select 1 from public.profiles where id=uid and role=''manufacturer'')';new_guard text:='not p_admin and not (exists(select 1 from public.manufacturer_profiles where user_id=uid) and public.factory_has_permission(uid,''view_orders''))';
begin
 select pg_get_functiondef('public.team_impl_portal_dashboard(boolean,integer,text,text,text)'::regprocedure) into definition;
 if position(old_guard in definition)>0 then execute replace(definition,old_guard,new_guard);
 elsif position(new_guard in definition)=0 then raise exception 'Unrecognised dashboard authorisation guard';end if;
end $migration$;
revoke all on function public.team_impl_portal_dashboard(boolean,integer,text,text,text) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
