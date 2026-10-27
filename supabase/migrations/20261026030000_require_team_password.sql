begin;
create table if not exists public.manufacturer_team_account_setup(user_id uuid primary key references auth.users(id)on delete cascade,created_at timestamptz not null default now(),completed_at timestamptz);
alter table public.manufacturer_team_account_setup enable row level security;
grant select,insert,update,delete on public.manufacturer_team_account_setup to authenticated;
drop policy if exists team_account_setup_self on public.manufacturer_team_account_setup;
create policy team_account_setup_self on public.manufacturer_team_account_setup for select to authenticated using(user_id=auth.uid());
do $$declare d text;begin select pg_get_functiondef('public.apply_superadmin_access()'::regprocedure)into d;if position('''manufacturer_team_account_setup'''in d)=0 then d:=replace(d,'''projects''','''manufacturer_team_account_setup'',''projects''');execute d;end if;perform public.apply_superadmin_access();end$$;
-- Previously invited team accounts must explicitly finish setup once. Never reset their credentials here.
insert into manufacturer_team_account_setup(user_id)select u.id from auth.users u where u.invited_at is not null and(exists(select 1 from manufacturer_team_members where user_id=u.id and manufacturer_id<>u.id)or exists(select 1 from manufacturer_team_invitations where email=lower(u.email)))on conflict do nothing;
create or replace function public.record_team_account_setup(p_invitation uuid,p_user uuid)returns void language plpgsql security definer set search_path=public as $$begin
 if not exists(select 1 from manufacturer_team_invitations i join auth.users u on lower(u.email)=i.email where i.id=p_invitation and u.id=p_user and u.invited_at is not null and i.accepted_at is null and i.revoked_at is null and i.expires_at>now())then raise exception 'Invitation account mismatch';end if;
 insert into manufacturer_team_account_setup(user_id)values(p_user)on conflict do nothing;end$$;
revoke all on function public.record_team_account_setup(uuid,uuid)from public,anon,authenticated;grant execute on function public.record_team_account_setup(uuid,uuid)to service_role;
create or replace function public.team_password_saved()returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.encrypted_password is distinct from old.encrypted_password and coalesce(new.encrypted_password,'')<>''then update manufacturer_team_account_setup set completed_at=now()where user_id=new.id and completed_at is null;end if;return new;end$$;
revoke all on function public.team_password_saved()from public,anon,authenticated;
drop trigger if exists team_password_saved on auth.users;
create trigger team_password_saved after update of encrypted_password on auth.users for each row execute function public.team_password_saved();
create or replace function public.factory_password_ready(p_user uuid)returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from auth.users where id=p_user and not exists(select 1 from manufacturer_team_account_setup where user_id=p_user and completed_at is null)and(invited_at is null or coalesce(encrypted_password,'')<>''))$$;
revoke all on function public.factory_password_ready(uuid)from public,anon,authenticated;
create or replace function public.factory_password_setup_context()returns jsonb language plpgsql stable security definer set search_path=public as $$begin if auth.uid()is null then raise exception 'Sign in required';end if;return jsonb_build_object('email',(select email from auth.users where id=auth.uid()),'required',not public.factory_password_ready(auth.uid()));end$$;
revoke all on function public.factory_password_setup_context()from public,anon;grant execute on function public.factory_password_setup_context()to authenticated;

create or replace function public.factory_invitation_details(p_token text)returns jsonb language plpgsql stable security definer set search_path=public as $$declare i manufacturer_team_invitations%rowtype;u auth.users%rowtype;begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$'then raise exception 'Invalid invitation link';end if;
 select *into i from manufacturer_team_invitations where token_hash=encode(sha256(p_token::bytea),'hex');
 if not found or i.revoked_at is not null or i.accepted_at is not null or i.expires_at<=now()then raise exception 'Invitation expired, revoked or already used';end if;
 if not exists(select 1 from manufacturer_team_members m where m.manufacturer_id=i.manufacturer_id and m.user_id=i.invited_by and m.removed_at is null and 'team'=any(case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end)and public.factory_role_permissions(i.role)<@case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end)then raise exception 'The inviter no longer has permission to grant this role';end if;
 select *into u from auth.users where lower(email)=i.email;
 return jsonb_build_object('email',i.email,'factoryName',(select factory_name from manufacturer_profiles where user_id=i.manufacturer_id),'accountExists',u.id is not null,'needsPassword',u.id is not null and not public.factory_password_ready(u.id) ,'canProvisionSetup',u.id is not null and u.invited_at is not null and coalesce(u.encrypted_password,'')='' and not exists(select 1 from manufacturer_team_members where user_id=u.id and removed_at is null));end$$;

create or replace function public.factory_has_permission(p_factory uuid,p_permission text)returns boolean language sql stable security definer set search_path=public as $$select public.factory_password_ready(public.team_actor())and exists(select 1 from manufacturer_team_members where manufacturer_id=p_factory and user_id=public.team_actor()and removed_at is null and p_permission=any(case when role='owner'then public.factory_role_permissions('owner')else coalesce(permissions,public.factory_role_permissions(role))end))$$;
create or replace function public.factory_team_context()returns jsonb language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();result jsonb;begin
 if auth.uid()is null then raise exception 'Sign in required';end if;
 update manufacturer_team_members set last_active_at=now()where user_id=auth.uid()and manufacturer_id=f and(last_active_at is null or last_active_at<now()-interval '5 minutes');
 select jsonb_build_object('factoryId',f,'role',m.role,'permissions',case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end,'organisations',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'name',p.factory_name))from manufacturer_team_members a join manufacturer_profiles p on p.user_id=a.manufacturer_id where a.user_id=auth.uid()and a.removed_at is null),'[]'))into result from manufacturer_team_members m where m.manufacturer_id=f and m.user_id=auth.uid()and m.removed_at is null;
 if result is not null and not public.factory_password_ready(auth.uid())then result:=result||jsonb_build_object('passwordSetupRequired',true,'permissions','[]'::jsonb);end if;
 return coalesce(result,jsonb_build_object('factoryId',null,'permissions','[]'::jsonb,'hadMembership',exists(select 1 from manufacturer_team_members where user_id=auth.uid()),'organisations',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'name',p.factory_name))from manufacturer_team_members a join manufacturer_profiles p on p.user_id=a.manufacturer_id where a.user_id=auth.uid()and a.removed_at is null),'[]'::jsonb)));end$$;
create or replace function public.accept_factory_invitation(p_token text)returns uuid language plpgsql security definer set search_path=public as $$declare i manufacturer_team_invitations%rowtype;f uuid;verified_email text;begin
 if not public.factory_password_ready(auth.uid())then raise exception 'Create your password before joining the team';end if;
 if auth.uid()is null or length(coalesce(p_token,''))<>64 then raise exception 'Sign in to accept a valid invitation';end if;
 select lower(email)into verified_email from auth.users where id=auth.uid()and email_confirmed_at is not null;
 select manufacturer_id into f from manufacturer_team_invitations where token_hash=encode(sha256(p_token::bytea),'hex');
 perform 1 from manufacturer_profiles where user_id=f for update;
 select *into i from manufacturer_team_invitations where token_hash=encode(sha256(p_token::bytea),'hex')for update;
 if not found or i.revoked_at is not null or i.accepted_at is not null or i.expires_at<=now()then raise exception 'Invitation expired, revoked or already used';end if;
 if verified_email is distinct from i.email then raise exception 'Sign in with the verified invited email address';end if;
 -- Recheck the issuer: revoked administrators cannot leave invitations granting elevated access.
 if not exists(select 1 from manufacturer_team_members m where m.manufacturer_id=f and m.user_id=i.invited_by and m.removed_at is null and public.factory_role_permissions(i.role)<@case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end and 'team'=any(case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end))then raise exception 'The inviter no longer has permission to grant this role';end if;
 if exists(select 1 from manufacturer_team_members where manufacturer_id=f and user_id=auth.uid()and removed_at is null)then raise exception 'Already a member of this organisation';end if;
 insert into manufacturer_team_members(manufacturer_id,user_id,role)values(f,auth.uid(),i.role)on conflict(manufacturer_id,user_id)do update set role=excluded.role,permissions=null,removed_at=null,joined_at=now(),revision=manufacturer_team_members.revision+1;
 update manufacturer_team_invitations set accepted_at=now(),accepted_by=auth.uid(),revision=revision+1 where id=i.id;
 insert into manufacturer_team_contexts(user_id,manufacturer_id)values(auth.uid(),f)on conflict(user_id)do update set manufacturer_id=f;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id)values(f,auth.uid(),'accept_invitation',i.id);return f;end$$;
commit;
