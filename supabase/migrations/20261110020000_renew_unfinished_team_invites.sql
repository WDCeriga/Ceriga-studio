begin;

create or replace function public.factory_invitation_details(p_token text)returns jsonb language plpgsql stable security definer set search_path=public as $$declare i manufacturer_team_invitations%rowtype;u auth.users%rowtype;can_renew boolean;begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$'then raise exception 'Invalid invitation link';end if;
 select *into i from manufacturer_team_invitations where token_hash=encode(sha256(p_token::bytea),'hex');
 if not found or i.revoked_at is not null or i.accepted_at is not null or i.expires_at<=now()then raise exception 'Invitation expired, revoked or already used';end if;
 if not exists(select 1 from manufacturer_team_members m where m.manufacturer_id=i.manufacturer_id and m.user_id=i.invited_by and m.removed_at is null and 'team'=any(case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end)and public.factory_role_permissions(i.role)<@case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end)then raise exception 'The inviter no longer has permission to grant this role';end if;
 select *into u from auth.users where lower(email)=i.email;
 -- An unconfirmed Auth invite can be renewed even if Auth initialized a hash.
 -- Reissuing an invite uses Auth's own confirmed-account check.
 can_renew := u.id is not null and u.invited_at is not null
   and not exists(select 1 from manufacturer_team_members where user_id=u.id and removed_at is null);
 return jsonb_build_object('email',i.email,'factoryName',(select factory_name from manufacturer_profiles where user_id=i.manufacturer_id),'accountExists',u.id is not null,'needsPassword',u.id is not null and not public.factory_password_ready(u.id) ,'canProvisionSetup',can_renew and coalesce(u.encrypted_password,'')='',
   'canRenewInvite',can_renew and u.email_confirmed_at is null and not public.factory_password_ready(u.id));end$$;

commit;
