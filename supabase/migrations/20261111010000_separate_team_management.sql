begin;

alter table public.manufacturer_team_members add column if not exists member_name text;
alter table public.manufacturer_team_invitations add column if not exists member_name text;
alter table public.platform_workers add column if not exists member_name text;
alter table public.platform_worker_invitations add column if not exists member_name text;
alter table public.platform_worker_invitations add column if not exists delivery_status text not null default 'not_sent';

do $$begin
  if to_regprocedure('public.internal_worker_manage(text,jsonb)') is null then
    alter function public.platform_worker_manage(text,jsonb) rename to internal_worker_manage;
  end if;
end$$;
revoke all on function public.internal_worker_manage(text,jsonb) from public,anon,authenticated;
create or replace function public.platform_worker_manage(p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public as $$
declare member platform_workers%rowtype;
begin
  if p_action in ('regenerate','copy_invite') and exists (
    select 1 from platform_worker_invitations where id=(p_data->>'id')::uuid and member_name is not null
  ) then raise exception 'Use the team invitation email service'; end if;
  if p_action='remove' then
    if not public.platform_worker_can('workers.edit') then raise exception 'Manage workers permission required'; end if;
    perform pg_advisory_xact_lock(7271027001);
    select * into member from platform_workers where user_id=(p_data->>'user_id')::uuid for update;
    if not found or member.revision is distinct from (p_data->>'revision')::integer then
      raise exception 'Worker changed; refresh and retry';
    end if;
    if member.status<>'suspended' then raise exception 'Disable this member before removing access'; end if;
    if not public.platform_worker_grantable((select permissions from platform_worker_roles where id=member.role_id)) then
      raise exception 'Cannot manage a worker with greater authority';
    end if;
    update platform_worker_invitations set revoked_at=now(),revision=revision+1,token_value=''
      where invited_by=member.user_id and accepted_at is null and revoked_at is null;
    delete from platform_workers where user_id=member.user_id;
    insert into platform_worker_audit(actor_id,action,subject_id) values(auth.uid(),'remove',member.user_id);
    return jsonb_build_object('id',member.user_id);
  end if;
  return public.internal_worker_manage(p_action,p_data);
end$$;
revoke all on function public.platform_worker_manage(text,jsonb) from public,anon;
grant execute on function public.platform_worker_manage(text,jsonb) to authenticated;

do $$begin
  if to_regprocedure('public.factory_team_invite_impl(text,text,uuid)') is null then
    alter function public.factory_team_invite(text,text,uuid) rename to factory_team_invite_impl;
  end if;
end$$;
revoke all on function public.factory_team_invite_impl(text,text,uuid) from public,anon,authenticated;
create or replace function public.factory_team_invite(p_email text,p_role text,p_resend uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if exists (select 1 from manufacturer_team_invitations
    where id=p_resend and manufacturer_id=public.current_factory_id() and member_name is not null) then
    raise exception 'Use the team invitation email service';
  end if;
  return public.factory_team_invite_impl(p_email,p_role,p_resend);
end$$;
revoke all on function public.factory_team_invite(text,text,uuid) from public,anon;
grant execute on function public.factory_team_invite(text,text,uuid) to authenticated;
create or replace function public.issue_workspace_invitation(
  p_actor uuid,p_internal boolean,p_email text,p_name text,p_role text,p_factory uuid default null,
  p_resend uuid default null,p_revision integer default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  actor_email text;
  result jsonb;
  invitation_id uuid;
  full_name text := nullif(btrim(p_name),'');
begin
  select email into actor_email from auth.users where id=p_actor and email_confirmed_at is not null;
  if actor_email is null then raise exception 'Sign in with a verified email'; end if;
  if length(full_name)>100 or (p_resend is null and full_name is null) then raise exception 'Enter a full name (1–100 characters)'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'email',actor_email,'role','authenticated')::text,true);
  perform set_config('request.headers',jsonb_strip_nulls(jsonb_build_object('x-ceriga-factory',p_factory))::text,true);
  if p_internal then
    if not(public.platform_worker_can('invitations.create') and public.platform_worker_can('roles.assign')) then
      raise exception 'Internal team invitation permission required';
    end if;
    result := case when p_resend is null then
      public.internal_worker_manage('invite',jsonb_build_object('email',p_email,'role_id',p_role))
      else public.internal_worker_manage('regenerate',jsonb_build_object('id',p_resend,'revision',p_revision)) end;
    invitation_id := (result->>'id')::uuid;
    update platform_worker_invitations i set member_name=coalesce(full_name,i.member_name),delivery_status='not_sent',token_value=''
      where i.id=invitation_id returning result || jsonb_build_object('email',i.email,'revision',i.revision) into result;
  else
    result := public.factory_team_invite_impl(p_email,p_role,p_resend);
    invitation_id := (result->>'id')::uuid;
    update manufacturer_team_invitations i set member_name=coalesce(full_name,i.member_name)
      where i.id=invitation_id returning result || jsonb_build_object('revision',i.revision) into result;
  end if;
  return result;
end$$;
revoke all on function public.issue_workspace_invitation(uuid,boolean,text,text,text,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.issue_workspace_invitation(uuid,boolean,text,text,text,uuid,uuid,integer) to service_role;

create or replace function public.finish_workspace_invitation_delivery(p_internal boolean,p_id uuid,p_revision integer,p_sent boolean)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if p_internal then
    update platform_worker_invitations set delivery_status=case when p_sent then 'sent' else 'failed' end
      where id=p_id and revision=p_revision;
  else
    update manufacturer_team_invitations set delivery_status=case when p_sent then 'sent' else 'failed' end,
      delivery_error=case when p_sent then null else 'Invitation email could not be delivered' end
      where id=p_id and revision=p_revision;
  end if;
  return found;
end$$;
revoke all on function public.finish_workspace_invitation_delivery(boolean,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.finish_workspace_invitation_delivery(boolean,uuid,integer,boolean) to service_role;

create or replace function public.save_workspace_invited_name()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.accepted_at is null and new.accepted_at is not null and new.member_name is not null then
    if tg_table_name='platform_worker_invitations' then
      update platform_workers set member_name=new.member_name where user_id=new.accepted_by;
    else
      update manufacturer_team_members set member_name=new.member_name
        where user_id=new.accepted_by and manufacturer_id=new.manufacturer_id;
    end if;
  end if;
  return new;
end$$;
revoke all on function public.save_workspace_invited_name() from public,anon,authenticated;
drop trigger if exists save_workspace_invited_name on public.platform_worker_invitations;
create trigger save_workspace_invited_name after update of accepted_at on public.platform_worker_invitations
  for each row execute function public.save_workspace_invited_name();
drop trigger if exists save_workspace_invited_name on public.manufacturer_team_invitations;
create trigger save_workspace_invited_name after update of accepted_at on public.manufacturer_team_invitations
  for each row execute function public.save_workspace_invited_name();

-- Existing activation links still resolve by their hashes.

create or replace function public.admin_factory_team(p_factory uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare factory_name text;
begin
  if not public.platform_worker_can('manufacturer_teams.view') then raise exception 'Manufacturer team access denied'; end if;
  select p.factory_name into factory_name from manufacturer_profiles p where p.user_id=p_factory;
  if not found then raise exception 'Manufacturer not found'; end if;
  return jsonb_build_object(
    'factoryName',factory_name,'canManage',public.platform_worker_can('manufacturer_teams.edit'),
    'roles',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name)
      from manufacturer_team_roles where manufacturer_id=p_factory),'[]'),
    'members',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.id,'name',coalesce(m.member_name,p.full_name),'email',p.email,'role',m.role,'revision',m.revision,
      'status',case when m.removed_at is null then 'Active' else 'Disabled' end,
      'added',m.joined_at,'lastActive',m.last_active_at) order by (m.role='owner') desc,m.joined_at)
      from manufacturer_team_members m join profiles p on p.id=m.user_id where m.manufacturer_id=p_factory),'[]'),
    'invitations',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'name',i.member_name,'email',i.email,'role',i.role,'added',i.created_at,'delivery',i.delivery_status,
      'status',case when i.accepted_at is not null then 'Accepted' when i.revoked_at is not null then 'Cancelled'
        when i.expires_at<=now() then 'Expired' else 'Pending' end) order by i.created_at desc)
      from (select * from manufacturer_team_invitations where manufacturer_id=p_factory order by created_at desc limit 200) i),'[]'));
end$$;
revoke all on function public.admin_factory_team(uuid) from public,anon;
grant execute on function public.admin_factory_team(uuid) to authenticated;

create or replace function public.admin_change_factory_team(p_factory uuid,p_member uuid,p_revision integer,p_role text default null,p_remove boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare member manufacturer_team_members%rowtype;
begin
  if not (public.platform_worker_can('manufacturer_teams.view') and public.platform_worker_can('manufacturer_teams.edit')) then
    raise exception 'Manufacturer team management permission required';
  end if;
  perform 1 from manufacturer_profiles where user_id=p_factory for update;
  select * into member from manufacturer_team_members
    where id=p_member and manufacturer_id=p_factory and removed_at is null for update;
  if not found or member.revision is distinct from p_revision then raise exception 'Member changed; refresh first'; end if;
  if member.role='owner' or member.user_id=p_factory then raise exception 'Factory ownership is protected'; end if;
  if not p_remove and (p_role is null or p_role='owner' or not public.factory_role_valid(p_factory,p_role)) then
    raise exception 'Choose a role belonging to this factory';
  end if;
  if p_remove then
    update manufacturer_team_members set removed_at=now(),revision=revision+1 where id=member.id;
    delete from manufacturer_team_order_assignments where manufacturer_id=p_factory and user_id=member.user_id;
    update manufacturer_team_invitations set revoked_at=now(),revision=revision+1
      where manufacturer_id=p_factory and invited_by=member.user_id and accepted_at is null and revoked_at is null;
  else
    update manufacturer_team_members set role=p_role,permissions=null,revision=revision+1 where id=member.id;
  end if;
  insert into manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id,details)
    values(p_factory,auth.uid(),case when p_remove then 'admin_remove' else 'admin_role' end,member.id,jsonb_build_object('role',p_role));
  return member.id;
end$$;
revoke all on function public.admin_change_factory_team(uuid,uuid,integer,text,boolean) from public,anon;
grant execute on function public.admin_change_factory_team(uuid,uuid,integer,text,boolean) to authenticated;

do $$
declare definition text;
begin
  select pg_get_functiondef('public.platform_worker_catalog()'::regprocedure) into definition;
  if strpos(definition,'manufacturer_teams')=0 then
    execute replace(definition,']''::jsonb',',{"id":"manufacturer_teams","label":"Manufacturer teams","description":"View factory staff and manage factory access.","scoped":false,"actions":["view","edit"]}]''::jsonb');
  end if;
  select pg_get_functiondef('public.factory_team_list()'::regprocedure) into definition;
  execute replace(definition, 'where m.manufacturer_id=f and m.removed_at is null)', 'where m.manufacturer_id=f)');
  select pg_get_functiondef('public.platform_worker_management()'::regprocedure) into definition;
  if strpos(definition,'last_sign_in_at')=0 then
    execute replace(definition,'''role_name'',r.name)order by p.full_name',
      '''role_name'',r.name,''last_active_at'',(select to_jsonb(u)->>''last_sign_in_at'' from auth.users u where u.id=w.user_id))order by p.full_name');
  end if;
  select pg_get_functiondef('public.platform_worker_invitation_details(text)'::regprocedure) into definition;
  if strpos(definition,'''needsPassword''')=0 then
    execute replace(definition,'''accountExists'',exists',
      '''name'',i.member_name,''needsPassword'',exists(select 1 from auth.users u where lower(u.email)=i.email and not public.factory_password_ready(u.id)),''accountExists'',exists');
  end if;
  select pg_get_functiondef('public.accept_platform_worker_invitation(text)'::regprocedure) into definition;
  if strpos(definition,'public.factory_password_ready')=0 then
    execute replace(definition,'select lower(u.email)into email',
      'if not public.factory_password_ready(auth.uid()) then raise exception ''Create your password before joining the team''; end if; select lower(u.email)into email');
  end if;
end$$;

notify pgrst, 'reload schema';
commit;
