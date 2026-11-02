begin;
-- Platform workers are independent of manufacturer teams and protected Super Admin identities.
select pg_advisory_xact_lock(7271027001);
create or replace function public.platform_worker_catalog()returns jsonb language sql immutable set search_path=public as $$select '[{"id":"orders","label":"Orders","description":"Operational notes and existing manufacturer/worker assignments.","scoped":true,"actions":["view","edit","assign","export"]},{"id":"quality","label":"Quality control","description":"Review existing production submissions; factory self-review is blocked.","scoped":true,"actions":["view","edit"]},{"id":"manufacturers","label":"Manufacturers","description":"Operational factory directory; financial and private verification details are excluded.","scoped":true,"actions":["view"]},{"id":"reports","label":"Reports","description":"Order-stage summaries from records you may access.","scoped":true,"actions":["view","export"]},{"id":"workers","label":"Workers","description":"View the staff directory or suspend/reactivate authorised workers.","scoped":false,"actions":["view","edit"]},{"id":"invitations","label":"Invitations","description":"Generate, copy/regenerate and revoke staff invitations.","scoped":false,"actions":["view","create","edit","delete"]},{"id":"roles","label":"Roles & permissions","description":"Maintain role definitions. Assign roles separately.","scoped":false,"actions":["view","create","edit","delete","assign"]}]'::jsonb$$;
revoke all on function public.platform_worker_catalog()from public,anon;grant execute on function public.platform_worker_catalog()to authenticated;
create table if not exists public.platform_worker_roles(id uuid primary key default gen_random_uuid(),name text not null check(length(btrim(name))between 1 and 60),description text not null default ''check(length(description)<=1000),permissions jsonb not null default '{}',is_default boolean not null default false,revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references public.profiles(id)on delete set null,archived_at timestamptz);
create unique index if not exists platform_worker_role_name_idx on public.platform_worker_roles(lower(btrim(name)))where archived_at is null;
create table if not exists public.platform_workers(user_id uuid primary key references public.profiles(id)on delete cascade,role_id uuid not null references public.platform_worker_roles(id)on delete restrict,status text not null default 'active'check(status in('active','suspended')),joined_at timestamptz not null default now(),updated_at timestamptz not null default now(),revision integer not null default 1);
create index if not exists platform_worker_role_idx on public.platform_workers(role_id,status);
create table if not exists public.platform_worker_invitations(id uuid primary key default gen_random_uuid(),email text not null,role_id uuid not null references public.platform_worker_roles(id)on delete restrict,token_hash text not null unique,token_value text not null,invited_by uuid references public.profiles(id)on delete set null,created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '7 days'),accepted_at timestamptz,accepted_by uuid references public.profiles(id)on delete set null,revoked_at timestamptz,revision integer not null default 1);
create unique index if not exists platform_worker_pending_email_idx on public.platform_worker_invitations(lower(email))where accepted_at is null and revoked_at is null;
create index if not exists platform_worker_inviter_idx on public.platform_worker_invitations(invited_by,created_at desc);
create index if not exists platform_worker_invite_role_idx on public.platform_worker_invitations(role_id);
create table if not exists public.platform_worker_assignments(order_id uuid not null references public.orders(id)on delete cascade,worker_id uuid not null references public.platform_workers(user_id)on delete cascade,assigned_by uuid references public.profiles(id)on delete set null,created_at timestamptz not null default now(),primary key(order_id,worker_id));
create index if not exists platform_worker_assignment_user_idx on public.platform_worker_assignments(worker_id,order_id);
create table if not exists public.platform_worker_audit(id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles(id)on delete set null,action text not null,subject_id uuid,details jsonb not null default '{}',created_at timestamptz not null default now());
create index if not exists platform_worker_audit_subject_idx on public.platform_worker_audit(subject_id,created_at desc);
insert into public.platform_worker_roles(id,name,description,permissions,is_default)values('a0000000-0000-0000-0000-000000000001','Administrator','Manage operations, staff, invitations and assignable roles. No protected system or Super Admin access.','{"orders.view":"all","orders.edit":"all","orders.assign":"all","orders.export":"all","quality.view":"all","quality.edit":"all","manufacturers.view":"all","reports.view":"all","reports.export":"all","workers.view":"all","workers.edit":"all","invitations.view":"all","invitations.create":"all","invitations.edit":"all","invitations.delete":"all","roles.view":"all","roles.create":"all","roles.edit":"all","roles.delete":"all","roles.assign":"all"}',true)on conflict(id)do nothing;
insert into public.platform_worker_roles(id,name,description,permissions,is_default)values('a0000000-0000-0000-0000-000000000002','Manager','Manage operational records and assignments; view operational reports.','{"orders.view":"all","orders.edit":"all","orders.assign":"all","orders.export":"all","quality.view":"all","quality.edit":"all","manufacturers.view":"all","reports.view":"all","reports.export":"all","workers.view":"all"}',true)on conflict(id)do nothing;
insert into public.platform_worker_roles(id,name,description,permissions,is_default)values('a0000000-0000-0000-0000-000000000003','Worker','View assigned orders, update operational notes and inspect assigned QC.','{"orders.view":"assigned","orders.edit":"assigned","quality.view":"assigned"}',true)on conflict(id)do nothing;
insert into public.platform_worker_roles(id,name,description,permissions,is_default)values('a0000000-0000-0000-0000-000000000004','Viewer','Read-only access to assigned orders.','{"orders.view":"assigned"}',true)on conflict(id)do nothing;
-- Preserve legacy workers with minimum access. An allowlisted identity is never an assignable worker.
insert into public.platform_workers(user_id,role_id)select p.id,'a0000000-0000-0000-0000-000000000003'from profiles p where p.role='worker'and not exists(select 1 from manufacturer_team_members m where m.user_id=p.id)and not exists(select 1 from superadmin_emails s where lower(s.email)=lower(p.email))on conflict do nothing;
-- Permissions always resolve from the current database row, never JWT role claims or local storage.
create or replace function public.platform_worker_authority(p_actor uuid)returns jsonb language sql stable security definer set search_path=public as $$
 select case when exists(select 1 from auth.users u join superadmin_emails s on lower(s.email)=lower(u.email)where u.id=p_actor)then(select jsonb_object_agg((f->>'id')||'.'||a,'all')from jsonb_array_elements(public.platform_worker_catalog())f cross join lateral jsonb_array_elements_text(f->'actions')a)
 else coalesce((select r.permissions from platform_workers w join platform_worker_roles r on r.id=w.role_id where w.user_id=p_actor and w.status='active'and r.archived_at is null and public.factory_password_ready(p_actor)),'{}'::jsonb)end
$$;
revoke all on function public.platform_worker_authority(uuid)from public,anon,authenticated;
create or replace function public.platform_worker_can(p_permission text,p_order uuid default null)returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid()is not null and(public.is_superadmin()or case public.platform_worker_authority(auth.uid())->>p_permission when 'all'then true when 'assigned'then p_order is null or exists(select 1 from platform_worker_assignments where worker_id=auth.uid()and order_id=p_order)else false end)
$$;
revoke all on function public.platform_worker_can(text,uuid)from public,anon;grant execute on function public.platform_worker_can(text,uuid)to authenticated;
create or replace function public.platform_worker_grantable(p_permissions jsonb,p_actor uuid default auth.uid())returns boolean language sql stable security definer set search_path=public as $$
 select not exists(select 1 from jsonb_each_text(p_permissions)e where coalesce(public.platform_worker_authority(p_actor)->>e.key,'')not in('all',e.value))
$$;
revoke all on function public.platform_worker_grantable(jsonb,uuid)from public,anon,authenticated;
create or replace function public.platform_worker_validate_permissions(p_permissions jsonb)returns void language plpgsql immutable set search_path=public as $$
declare item record;feature jsonb;area text;action text;v text;begin
 if p_permissions is null or jsonb_typeof(p_permissions)<>'object'then raise exception 'Choose a valid permission set';end if;
 for item in select *from jsonb_each_text(p_permissions)loop
 area:=split_part(item.key,'.',1);action:=split_part(item.key,'.',2);select x into feature from jsonb_array_elements(public.platform_worker_catalog())x where x->>'id'=area;
 if feature is null or item.key<>area||'.'||action or not(feature->'actions' ? action)or item.value not in('all','assigned')or(item.value='assigned'and not(feature->>'scoped')::boolean)then raise exception 'Unknown or invalid permission: %',item.key;end if;
 if action<>'view'then v:=p_permissions->>(area||'.view');if v is null or(item.value='all'and v<>'all')then raise exception '% requires View with equal or broader record access',item.key;end if;end if;
 end loop;
 if p_permissions ? 'roles.assign'and not(p_permissions ? 'workers.view')then raise exception 'Assign roles also requires View workers';end if;
 if p_permissions ? 'orders.assign'and not(p_permissions ? 'workers.view')then raise exception 'Assign work also requires View workers';end if;
 if p_permissions ? 'invitations.create'and not(p_permissions ? 'roles.assign')then raise exception 'Inviting requires separate Assign roles permission';end if;
end$$;
revoke all on function public.platform_worker_validate_permissions(jsonb)from public,anon,authenticated;
create or replace function public.platform_worker_is_administrator(p_permissions jsonb)returns boolean language sql immutable set search_path=public as $$select p_permissions ?&array['workers.edit','roles.edit','roles.assign','invitations.create']$$;
revoke all on function public.platform_worker_is_administrator(jsonb)from public,anon,authenticated;
create or replace function public.platform_worker_role_guard()returns trigger language plpgsql security definer set search_path=public as $$begin
 perform pg_advisory_xact_lock(7271027001);
 if tg_op<>'DELETE'then perform public.platform_worker_validate_permissions(new.permissions);if lower(regexp_replace(new.name,'[^a-zA-Z]','','g'))='superadmin'then raise exception 'Super Admin is protected and cannot be assigned as a role';end if;end if;
 if tg_op='DELETE'or(new.archived_at is not null and old.archived_at is null)then
 if old.is_default then raise exception 'Default roles may be edited but not deleted';end if;
 if exists(select 1 from platform_workers where role_id=old.id)or exists(select 1 from platform_worker_invitations where role_id=old.id and accepted_at is null and revoked_at is null and expires_at>now())then raise exception 'Reassign workers and pending invitations before deleting this role';end if;
 end if;
 if tg_op in('UPDATE','DELETE')and public.platform_worker_is_administrator(old.permissions)and(tg_op='DELETE'or not public.platform_worker_is_administrator(new.permissions))and exists(select 1 from platform_workers where role_id=old.id and status='active')and not exists(select 1 from platform_workers w join platform_worker_roles r on r.id=w.role_id where w.status='active'and r.id<>old.id and r.archived_at is null and public.platform_worker_is_administrator(r.permissions))then raise exception 'Keep at least one active authorised Administrator';end if;
 return case when tg_op='DELETE'then old else new end;end$$;
revoke all on function public.platform_worker_role_guard()from public,anon,authenticated;
drop trigger if exists platform_worker_role_guard on public.platform_worker_roles;
create trigger platform_worker_role_guard before insert or update or delete on public.platform_worker_roles for each row execute function public.platform_worker_role_guard();
create or replace function public.platform_worker_member_guard()returns trigger language plpgsql security definer set search_path=public as $$begin
 perform pg_advisory_xact_lock(7271027001);
 if tg_op<>'DELETE'and(exists(select 1 from profiles p join superadmin_emails s on lower(s.email)=lower(p.email)where p.id=new.user_id)or not exists(select 1 from platform_worker_roles where id=new.role_id and archived_at is null))then raise exception 'Choose an assignable worker account and active role; Super Admin remains protected';end if;
 if tg_op in('UPDATE','DELETE')and old.status='active'and exists(select 1 from platform_worker_roles where id=old.role_id and public.platform_worker_is_administrator(permissions))and(tg_op='DELETE'or new.status<>'active'or not exists(select 1 from platform_worker_roles where id=new.role_id and public.platform_worker_is_administrator(permissions)))and not exists(select 1 from platform_workers w join platform_worker_roles r on r.id=w.role_id where w.user_id<>old.user_id and w.status='active'and r.archived_at is null and public.platform_worker_is_administrator(r.permissions))then raise exception 'Keep at least one active authorised Administrator';end if;
 return case when tg_op='DELETE'then old else new end;end$$;
revoke all on function public.platform_worker_member_guard()from public,anon,authenticated;
drop trigger if exists platform_worker_member_guard on public.platform_workers;
create trigger platform_worker_member_guard before insert or update or delete on public.platform_workers for each row execute function public.platform_worker_member_guard();
-- Read-only own membership. Management writes go through narrow, revision-checked APIs.
do $$declare t text;d text;begin
 select pg_get_functiondef('public.apply_superadmin_access()'::regprocedure)into d;
 if position('''platform_worker_roles'''in d)=0 then d:=replace(d,'''projects''','''platform_worker_roles'',''platform_workers'',''platform_worker_invitations'',''platform_worker_assignments'',''platform_worker_audit'',''projects''');execute d;end if;
 foreach t in array array['platform_worker_roles','platform_workers','platform_worker_invitations','platform_worker_assignments','platform_worker_audit']loop execute format('alter table public.%I enable row level security',t);execute format('grant select,insert,update,delete on public.%I to authenticated',t);end loop;
 perform public.apply_superadmin_access();end$$;
drop policy if exists platform_worker_self on public.platform_workers;
create policy platform_worker_self on public.platform_workers for select to authenticated using(user_id=auth.uid());
drop policy if exists platform_worker_own_assignments on public.platform_worker_assignments;
create policy platform_worker_own_assignments on public.platform_worker_assignments for select to authenticated using(worker_id=auth.uid()and public.platform_worker_can('orders.view',order_id));
create or replace function public.platform_worker_context()returns jsonb language plpgsql stable security definer set search_path=public as $$declare result jsonb;begin
 if auth.uid()is null then raise exception 'Sign in required';end if;
 select jsonb_build_object('status',w.status,'roleId',r.id,'roleName',r.name,'permissions',case when w.status='active'and r.archived_at is null and public.factory_password_ready(auth.uid())then r.permissions else '{}'::jsonb end,'needsPassword',not public.factory_password_ready(auth.uid()),'name',p.full_name,'email',p.email)into result from platform_workers w join platform_worker_roles r on r.id=w.role_id join profiles p on p.id=w.user_id where w.user_id=auth.uid();
 return coalesce(result,jsonb_build_object('status','none','permissions','{}'::jsonb))||jsonb_build_object('superadmin',public.is_superadmin())||case when public.is_superadmin()then jsonb_build_object('permissions',public.platform_worker_authority(auth.uid()))else '{}'::jsonb end;end$$;
revoke all on function public.platform_worker_context()from public,anon;grant execute on function public.platform_worker_context()to authenticated;
create or replace function public.platform_worker_management()returns jsonb language plpgsql stable security definer set search_path=public as $$begin
 if not(public.platform_worker_can('workers.view')or public.platform_worker_can('invitations.view')or public.platform_worker_can('roles.view'))then raise exception 'Worker management access denied';end if;
 return jsonb_build_object('catalog',public.platform_worker_catalog(),'workers',case when public.platform_worker_can('workers.view')then coalesce((select jsonb_agg(to_jsonb(w)||jsonb_build_object('name',p.full_name,'email',p.email,'role_name',r.name)order by p.full_name)from platform_workers w join profiles p on p.id=w.user_id join platform_worker_roles r on r.id=w.role_id),'[]'::jsonb)else '[]'::jsonb end,
 'invitations',case when public.platform_worker_can('invitations.view')then coalesce((select jsonb_agg(to_jsonb(i)-array['token_hash','token_value']||jsonb_build_object('role_name',r.name,'state',case when i.accepted_at is not null then 'Accepted'when i.revoked_at is not null then 'Revoked'when i.expires_at<=now()then 'Expired'else 'Invited'end)order by i.created_at desc)from(select *from platform_worker_invitations order by created_at desc limit 200)i join platform_worker_roles r on r.id=i.role_id),'[]'::jsonb)else '[]'::jsonb end,
 'roles',case when(public.platform_worker_can('roles.view')or public.platform_worker_can('roles.assign'))then coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('assignable',public.platform_worker_grantable(r.permissions),'worker_count',(select count(*)from platform_workers where role_id=r.id))order by r.is_default desc,r.name)from platform_worker_roles r where archived_at is null),'[]'::jsonb)else '[]'::jsonb end);
end$$;
revoke all on function public.platform_worker_management()from public,anon;grant execute on function public.platform_worker_management()to authenticated;
create or replace function public.platform_worker_manage(p_action text,p_data jsonb default '{}')returns jsonb language plpgsql security definer set search_path=public as $$
#variable_conflict use_variable
declare r platform_worker_roles%rowtype;w platform_workers%rowtype;i platform_worker_invitations%rowtype;id uuid;token text;desired jsonb;email text;begin
 perform pg_advisory_xact_lock(7271027001);
 if p_data is null or length(p_data::text)>20000 or jsonb_typeof(p_data)<>'object'then raise exception 'Invalid request';end if;
 if p_action in('save_role','delete_role')then
 if nullif(p_data->>'id','')is not null then select *into r from platform_worker_roles where platform_worker_roles.id=(p_data->>'id')::uuid and archived_at is null for update;if not found or r.revision is distinct from(p_data->>'revision')::integer then raise exception 'Role changed; refresh and retry';end if;if not public.platform_worker_grantable(r.permissions)then raise exception 'Cannot manage a role with greater authority';end if;end if;
 if not public.platform_worker_can('roles.'||case when p_action='delete_role'then 'delete'when r.id is null then 'create'else 'edit'end)then raise exception 'Role management permission required';end if;
 if p_action='delete_role'then if r.id is null then raise exception 'Choose a role';end if;update platform_worker_roles set archived_at=now(),revision=revision+1 where platform_worker_roles.id=r.id;id:=r.id;
 else desired:=p_data->'permissions';perform public.platform_worker_validate_permissions(desired);if not public.platform_worker_grantable(desired)then raise exception 'Cannot grant permissions beyond your own authority';end if;
 if r.id is null then insert into platform_worker_roles(name,description,permissions,created_by)values(btrim(p_data->>'name'),coalesce(p_data->>'description',''),desired,auth.uid())returning platform_worker_roles.id into id;
 else update platform_worker_roles set name=btrim(p_data->>'name'),description=coalesce(p_data->>'description',''),permissions=desired,updated_at=now(),revision=revision+1 where platform_worker_roles.id=r.id returning platform_worker_roles.id into id;end if;end if;
 elsif p_action in('change_role','suspend','reactivate','rename')then
 select *into w from platform_workers where user_id=(p_data->>'user_id')::uuid for update;if not found or w.revision is distinct from(p_data->>'revision')::integer then raise exception 'Worker changed; refresh and retry';end if;
 if not public.platform_worker_grantable((select permissions from platform_worker_roles where platform_worker_roles.id=w.role_id))then raise exception 'Cannot manage a worker with greater authority';end if;
 if p_action='change_role'then
 if not(public.platform_worker_can('roles.assign')and public.platform_worker_can('workers.view'))then raise exception 'Assign roles permission required';end if;
 select *into r from platform_worker_roles where platform_worker_roles.id=(p_data->>'role_id')::uuid and archived_at is null;if not found or not public.platform_worker_grantable(r.permissions)then raise exception 'Role is not assignable';end if;
 update platform_workers set role_id=r.id,updated_at=now(),revision=revision+1 where user_id=w.user_id;
 else if not public.platform_worker_can('workers.edit')then raise exception 'Manage workers permission required';end if;if p_action='rename'then if length(btrim(coalesce(p_data->>'name','')))not between 1 and 100 then raise exception 'Enter a name (1–100 characters)';end if;update profiles set full_name=btrim(p_data->>'name')where profiles.id=w.user_id;update platform_workers set revision=revision+1,updated_at=now()where user_id=w.user_id;else update platform_workers set status=case when p_action='suspend'then 'suspended'else 'active'end,updated_at=now(),revision=revision+1 where user_id=w.user_id;end if;end if;id:=w.user_id;
 elsif p_action in('invite','copy_invite','regenerate','revoke')then
 if not public.platform_worker_can('invitations.'||case p_action when 'invite'then 'create'when 'revoke'then 'delete'else 'edit'end)then raise exception 'Invitation permission required';end if;
 if p_action='invite'then
 if not public.platform_worker_can('roles.assign')then raise exception 'Assign roles permission required';end if;
 email:=lower(btrim(p_data->>'email'));
 if email is null or length(email)>254 or email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'then raise exception 'Enter a valid email address';end if;
 if exists(select 1 from superadmin_emails where lower(superadmin_emails.email)=email)then raise exception 'Super Admin identities cannot be invited or assigned a worker role';end if;
 if exists(select 1 from platform_workers w join profiles p on p.id=w.user_id where lower(p.email)=email)then raise exception 'This account is already a worker. Change their role or reactivate them instead';end if;
 select *into r from platform_worker_roles where platform_worker_roles.id=(p_data->>'role_id')::uuid and archived_at is null;if not found or not public.platform_worker_grantable(r.permissions)then raise exception 'Role is not assignable';end if;
 update platform_worker_invitations set revoked_at=now(),revision=revision+1 where platform_worker_invitations.email=email and accepted_at is null and revoked_at is null and expires_at<=now();
 if exists(select 1 from platform_worker_invitations where platform_worker_invitations.email=email and accepted_at is null and revoked_at is null)then raise exception 'A pending invitation exists. Copy or regenerate its link';end if;
 if(select count(*)from platform_worker_audit where actor_id=auth.uid()and action in('invite','regenerate')and created_at>now()-interval '1 hour')>=30 then raise exception 'Invitation limit reached. Try again later';end if;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into platform_worker_invitations(email,role_id,token_hash,token_value,invited_by)values(email,r.id,encode(sha256(token::bytea),'hex'),token,auth.uid())returning *into i;
 else
 select *into i from platform_worker_invitations where platform_worker_invitations.id=(p_data->>'id')::uuid for update;
 if not found or i.revision is distinct from(p_data->>'revision')::integer then raise exception 'Invitation changed; refresh and retry';end if;
 if i.accepted_at is not null or i.revoked_at is not null then raise exception 'This invitation was accepted or revoked';end if;
 select *into r from platform_worker_roles where platform_worker_roles.id=i.role_id and archived_at is null;
 if not found or not public.platform_worker_grantable(r.permissions)then raise exception 'Cannot manage an invitation with greater authority';end if;
 if p_action='revoke'then update platform_worker_invitations set revoked_at=now(),revision=revision+1 where platform_worker_invitations.id=i.id;
 elsif p_action='regenerate'then
 if not public.platform_worker_can('roles.assign')then raise exception 'Assign roles permission required';end if;
 if(select count(*)from platform_worker_audit where actor_id=auth.uid()and action in('invite','regenerate')and created_at>now()-interval '1 hour')>=30 then raise exception 'Invitation limit reached. Try again later';end if;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');update platform_worker_invitations set token_value=token,token_hash=encode(sha256(token::bytea),'hex'),expires_at=now()+interval '7 days',invited_by=auth.uid(),revision=revision+1 where platform_worker_invitations.id=i.id returning *into i;
 else if i.expires_at<=now()then raise exception 'Invitation expired. Regenerate the link';end if;if not public.platform_worker_can('roles.assign')then raise exception 'Assign roles permission required to copy an invitation';end if;token:=i.token_value;end if;
 end if;id:=i.id;
 else raise exception 'Unknown worker management action';end if;
 insert into platform_worker_audit(actor_id,action,subject_id,details)values(auth.uid(),p_action,id,p_data-array['token','password']);
 return jsonb_build_object('id',id,'token',token,'expiresAt',i.expires_at);
end$$;
revoke all on function public.platform_worker_manage(text,jsonb)from public,anon;grant execute on function public.platform_worker_manage(text,jsonb)to authenticated;
create or replace function public.platform_worker_invitation_details(p_token text)returns jsonb language plpgsql stable security definer set search_path=public as $$declare i platform_worker_invitations%rowtype;r platform_worker_roles%rowtype;begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$'then raise exception 'Invalid invitation link';end if;
 select *into i from platform_worker_invitations where token_hash=encode(sha256(p_token::bytea),'hex');
 if not found or i.accepted_at is not null or i.revoked_at is not null or i.expires_at<=now()then raise exception 'Invitation expired, revoked or already used. Ask for a new link';end if;
 if exists(select 1 from superadmin_emails where lower(email)=i.email)then raise exception 'Super Admin identities cannot use worker invitations';end if;
 select *into r from platform_worker_roles where id=i.role_id and archived_at is null;
 if not found or i.invited_by is null or not(public.platform_worker_authority(i.invited_by) ?&array['invitations.create','roles.assign'])or not public.platform_worker_grantable(r.permissions,i.invited_by)then raise exception 'Invitation is no longer authorised. Ask an administrator for a new link';end if;
 return jsonb_build_object('email',i.email,'roleName',r.name,'expiresAt',i.expires_at,'accountExists',exists(select 1 from auth.users where lower(email)=i.email));
end$$;
revoke all on function public.platform_worker_invitation_details(text)from public;grant execute on function public.platform_worker_invitation_details(text)to anon,authenticated,service_role;
create or replace function public.accept_platform_worker_invitation(p_token text)returns uuid language plpgsql security definer set search_path=public as $$
#variable_conflict use_variable
declare i platform_worker_invitations%rowtype;email text;begin
 perform pg_advisory_xact_lock(7271027001);
 perform public.platform_worker_invitation_details(p_token);
 if auth.uid()is null then raise exception 'Sign in with the invited email';end if;
 select lower(u.email)into email from auth.users u where u.id=auth.uid()and u.email_confirmed_at is not null;
 select *into i from platform_worker_invitations where token_hash=encode(sha256(p_token::bytea),'hex')for update;
 if email is distinct from i.email then raise exception 'Sign in with the verified invited email address';end if;
 if exists(select 1 from superadmin_emails s where lower(s.email)=email)then raise exception 'Super Admin identities cannot join through worker invitations';end if;
 if exists(select 1 from platform_workers where user_id=auth.uid())then raise exception 'This account is already a worker. Ask an administrator to change its role or status';end if;
 insert into platform_workers(user_id,role_id)values(auth.uid(),i.role_id);
 -- Do not replace an existing manufacturer's account identity or any account records.
 update profiles set role='worker'where id=auth.uid()and role='brand';
 update platform_worker_invitations set accepted_at=now(),accepted_by=auth.uid(),revision=revision+1,token_value=''where id=i.id;
 insert into platform_worker_audit(actor_id,action,subject_id,details)values(auth.uid(),'accept_invitation',i.id,jsonb_build_object('role_id',i.role_id));return auth.uid();
end$$;
revoke all on function public.accept_platform_worker_invitation(text)from public,anon;grant execute on function public.accept_platform_worker_invitation(text)to authenticated;
-- A worker-safe projection: financial margins, customer contact details and private files are excluded.
create or replace view public.platform_worker_orders with(security_barrier=true)as
 select o.id,o.product_name,o.garment_type,o.kind,o.status,o.status_label,o.factory_status,o.assigned_manufacturer_id,o.due_quote_by,(select stage from order_production_updates where order_id=o.id order by version desc limit 1)as production_stage,o.qc_status,o.ops_notes,o.order_quantities,o.specifications,o.created_at,o.updated_at
 from public.orders o where public.platform_worker_can('orders.view',o.id);
grant select on public.platform_worker_orders to authenticated;
create or replace function public.platform_worker_order_json(p_order public.orders)returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',p_order.id,'product',p_order.product_name,'garment',p_order.garment_type,'status',p_order.status,'label',p_order.status_label,'factoryStatus',p_order.factory_status,'manufacturerId',p_order.assigned_manufacturer_id,'manufacturer',(select factory_name from manufacturer_profiles where user_id=p_order.assigned_manufacturer_id),'deadline',p_order.due_quote_by,'productionStage',(select stage from order_production_updates where order_id=p_order.id order by version desc limit 1),'qcStatus',p_order.qc_status,'notes',p_order.ops_notes,'quantities',p_order.order_quantities,'specifications',p_order.specifications,'updatedAt',p_order.updated_at,'createdAt',p_order.created_at)
$$;
revoke all on function public.platform_worker_order_json(public.orders)from public,anon,authenticated;
create or replace function public.platform_worker_workspace(p_feature text default 'dashboard',p_search text default '',p_offset integer default 0)returns jsonb language plpgsql stable security definer set search_path=public as $$declare feature text;result jsonb;begin
 if auth.uid()is null then raise exception 'Sign in required';end if;
 if not public.is_superadmin()and not exists(select 1 from platform_workers where user_id=auth.uid()and status='active'and public.factory_password_ready(auth.uid()))then raise exception 'Worker access is inactive or password setup is required';end if;
 if p_offset<0 or p_offset>1000000 or length(p_search)>200 then raise exception 'Invalid search or page';end if;
 feature:=case when p_feature in('dashboard','orders')then 'orders'when p_feature='quality'then 'quality'when p_feature='reports'then 'reports'else p_feature end;
 if p_feature='dashboard'and not public.platform_worker_can('orders.view')then return jsonb_build_object('orders','[]'::jsonb,'total',0,'counts','{}'::jsonb);end if;
 if not public.platform_worker_can(feature||'.view')then raise exception 'This page is not permitted by your role';end if;
 if feature='manufacturers'then
 return jsonb_build_object('manufacturers',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',m.factory_name,'status',m.status,'country',m.country,'garments',m.garments))from manufacturer_profiles m where public.platform_worker_authority(auth.uid())->>'manufacturers.view'='all'or public.is_superadmin()or exists(select 1 from orders o where o.assigned_manufacturer_id=m.user_id and public.platform_worker_can('manufacturers.view',o.id))),'[]'::jsonb));end if;
 if feature not in('orders','quality','reports')then raise exception 'Unknown operational page';end if;
 select jsonb_build_object('orders',coalesce((select jsonb_agg(public.platform_worker_order_json(o))from(select *from orders where public.platform_worker_can(feature||'.view',id)and(product_name ilike '%'||p_search||'%'or id::text ilike '%'||p_search||'%')and(feature<>'quality'or qc_required)order by updated_at desc,id limit 50 offset p_offset)o),'[]'::jsonb),'total',(select count(*)from orders where public.platform_worker_can(feature||'.view',id)and(product_name ilike '%'||p_search||'%'or id::text ilike '%'||p_search||'%')and(feature<>'quality'or qc_required)),
 'counts',(select coalesce(jsonb_object_agg(status,n),'{}'::jsonb)from(select status,count(*)n from orders where public.platform_worker_can(feature||'.view',id)group by status)c))into result;
 if p_feature='dashboard'then result:=result||jsonb_build_object('assignments',(select count(*)from platform_worker_assignments a join orders o on o.id=a.order_id where a.worker_id=auth.uid()and public.platform_worker_can('orders.view',o.id)and o.status not in('completed','cancelled')));end if;
 return result;
end$$;
revoke all on function public.platform_worker_workspace(text,text,integer)from public,anon;grant execute on function public.platform_worker_workspace(text,text,integer)to authenticated;
create or replace function public.platform_worker_order(p_order uuid,p_feature text default 'orders')returns jsonb language plpgsql stable security definer set search_path=public as $$declare o orders%rowtype;result jsonb;begin
 if p_feature not in('orders','quality')or not public.platform_worker_can(p_feature||'.view',p_order)then raise exception 'Order access denied';end if;
 select *into o from orders where id=p_order;if not found then raise exception 'Order not found';end if;
 result:=jsonb_build_object('order',public.platform_worker_order_json(o),'canEdit',public.platform_worker_can('orders.edit',p_order),'canAssign',public.platform_worker_can('orders.assign',p_order),'canReview',public.platform_worker_can_review(p_order),'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.worker_id,'name',p.full_name))from platform_worker_assignments a join profiles p on p.id=a.worker_id where a.order_id=p_order),'[]'::jsonb));
 if p_feature='quality'then result:=result||jsonb_build_object('reports',coalesce((select jsonb_agg(to_jsonb(q)order by report_version desc)from qc_inspections q where order_id=p_order and workflow_version=2),'[]'::jsonb),'evidence',coalesce((select jsonb_agg(to_jsonb(e))from qc_evidence e where order_id=p_order),'[]'::jsonb));end if;
 if public.platform_worker_can('orders.assign',p_order)then result:=result||jsonb_build_object('workers',coalesce((select jsonb_agg(jsonb_build_object('id',w.user_id,'name',p.full_name))from platform_workers w join profiles p on p.id=w.user_id where w.status='active'),'[]'::jsonb),'manufacturers',coalesce((select jsonb_agg(jsonb_build_object('id',user_id,'name',factory_name))from manufacturer_profiles where onboarding_complete and status is distinct from 'paused'),'[]'::jsonb));end if;
 return result;end$$;
revoke all on function public.platform_worker_order(uuid,text)from public,anon;grant execute on function public.platform_worker_order(uuid,text)to authenticated;
create or replace function public.platform_worker_order_action(p_order uuid,p_action text,p_data jsonb default '{}')returns uuid language plpgsql security definer set search_path=public as $$declare o orders%rowtype;id uuid;begin
 perform pg_advisory_xact_lock(7271027001);
 if p_action='assign'then
 if not public.platform_worker_can('orders.assign',p_order)then raise exception 'Assign work permission required';end if;
 select *into o from orders where orders.id=p_order for update;if not found then raise exception 'Order not found';end if;
 if not exists(select 1 from platform_workers where user_id=(p_data->>'worker_id')::uuid and status='active')then raise exception 'Choose an active worker';end if;
 if p_data->>'enabled'not in('true','false')or not(p_data ? 'enabled')then raise exception 'Choose whether the assignment is enabled';end if;
 if(p_data->>'enabled')::boolean then insert into platform_worker_assignments(order_id,worker_id,assigned_by)values(p_order,(p_data->>'worker_id')::uuid,auth.uid())on conflict do nothing;else delete from platform_worker_assignments where order_id=p_order and worker_id=(p_data->>'worker_id')::uuid;end if;
 elsif p_action='notes'then
 if not public.platform_worker_can('orders.edit',p_order)then raise exception 'Edit order permission required';end if;
 select *into o from orders where orders.id=p_order for update;if not found then raise exception 'Order not found';end if;
 if o.updated_at is distinct from(p_data->>'updatedAt')::timestamptz then raise exception 'Order changed. Refresh before saving';end if;
 if p_data->>'notes'is null or length(p_data->>'notes')>4000 then raise exception 'Operational notes must be at most 4,000 characters';end if;
 update orders set ops_notes=p_data->>'notes'where orders.id=p_order;
 elsif p_action='manufacturer'then
 if not public.platform_worker_can('orders.assign',p_order)then raise exception 'Assign manufacturer permission required';end if;
 perform public.assign_order_manufacturer(p_order,(p_data->>'manufacturer_id')::uuid,(p_data->>'deadline')::date);
 else raise exception 'Unknown order action';end if;
 insert into platform_worker_audit(actor_id,action,subject_id,details)values(auth.uid(),'order_'||p_action,p_order,p_data);return p_order;
end$$;
revoke all on function public.platform_worker_order_action(uuid,text,jsonb)from public,anon;grant execute on function public.platform_worker_order_action(uuid,text,jsonb)to authenticated;
create or replace function public.platform_worker_export(p_feature text)returns jsonb language plpgsql stable security definer set search_path=public as $$begin
 if p_feature not in('orders','reports')or not public.platform_worker_can(p_feature||'.export')then raise exception 'Export permission required';end if;
 if(select count(*)from orders where public.platform_worker_can(p_feature||'.export',id))>10000 then raise exception 'Export is limited to 10,000 records. Narrow the reporting scope';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('Order',id,'Product',product_name,'Garment',garment_type,'Status',status,'QC',qc_status,'Updated',updated_at))from orders where public.platform_worker_can(p_feature||'.export',id)),'[]'::jsonb);end$$;
revoke all on function public.platform_worker_export(text)from public,anon;grant execute on function public.platform_worker_export(text)to authenticated;
-- Reuse the actual manufacturer-assignment and QC-review implementations, preserving validation/history.
do $$declare d text;begin
 select pg_get_functiondef('public.assign_order_manufacturer(uuid,uuid,date)'::regprocedure)into d;
 if position('platform_worker_can'in d)=0 then
 if position('if not public.is_superadmin()'in d)=0 then raise exception 'Assignment authorisation hook missing';end if;
 d:=replace(d,'if not public.is_superadmin()','if not(public.is_superadmin()or public.platform_worker_can(''orders.assign'',p_order_id))');execute d;end if;
end$$;
-- Retain the direct-write guard; permit only a scoped assignment RPC's marked write.
do $$declare d text;begin
 select pg_get_functiondef('public.protect_manual_order_assignment()'::regprocedure)into d;
 if position('platform_worker_can'in d)=0 then
 if position('not public.is_superadmin()'in d)=0 then raise exception 'Assignment trigger authorisation hook missing';end if;
 d:=replace(d,'not public.is_superadmin()','not(public.is_superadmin()or(current_setting(''app.routing_write'',true)=new.id::text and public.platform_worker_can(''orders.assign'',new.id)))');execute d;end if;
end$$;
create or replace function public.platform_worker_can_review(p_order uuid)returns boolean language sql stable security definer set search_path=public as $$select public.platform_worker_can('quality.edit',p_order)and not exists(select 1 from orders o where o.id=p_order and(o.assigned_manufacturer_id=auth.uid()or exists(select 1 from manufacturer_team_members m where m.manufacturer_id=o.assigned_manufacturer_id and m.user_id=auth.uid()and m.removed_at is null)))$$;
revoke all on function public.platform_worker_can_review(uuid)from public,anon;grant execute on function public.platform_worker_can_review(uuid)to authenticated;
do $$declare d text;begin
 select pg_get_functiondef('public.team_impl_qc_action(uuid,text,jsonb)'::regprocedure)into d;
 if position('platform_worker_can_review'in d)=0 then
 if position('admin:=public.is_superadmin()'in d)=0 then raise exception 'QC authorisation hook missing';end if;
 d:=replace(d,'admin:=public.is_superadmin()','admin:=public.is_superadmin()or(p_action in(''approve_report'',''request_report_changes'')and public.platform_worker_can_review(p_order))');execute d;end if;
 if not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='platform_previous_qc_action')then alter function public.qc_action(uuid,text,jsonb)rename to platform_previous_qc_action;end if;
end$$;
revoke all on function public.platform_previous_qc_action(uuid,text,jsonb)from public,anon,authenticated;
create or replace function public.qc_action(p_order uuid,p_action text,p_data jsonb default '{}')returns uuid language plpgsql security definer set search_path=public as $$declare result uuid;begin
 if not public.is_superadmin()and p_action in('approve_report','request_report_changes')and public.platform_worker_can_review(p_order)then
 perform pg_advisory_xact_lock(7271027001);
 if not public.platform_worker_can_review(p_order)then raise exception 'QC review permission revoked';end if;
 result:=public.team_impl_qc_action(p_order,p_action,p_data);
 insert into platform_worker_audit(actor_id,action,subject_id,details)values(auth.uid(),'qc_'||p_action,p_order,p_data);return result;end if;
 return public.platform_previous_qc_action(p_order,p_action,p_data);end$$;
revoke all on function public.qc_action(uuid,text,jsonb)from public,anon;grant execute on function public.qc_action(uuid,text,jsonb)to authenticated;
create or replace function public.qc_can_access(p_order uuid)returns boolean language sql stable security definer set search_path=public as $$select auth.uid()is not null and exists(select 1 from orders where id=p_order and(public.is_superadmin()or user_id=auth.uid()or public.factory_order_visible(id)or public.platform_worker_can('quality.view',id)))$$;
-- Existing QC storage/RLS policies call qc_can_access; signed evidence links remain short-lived.
commit;
