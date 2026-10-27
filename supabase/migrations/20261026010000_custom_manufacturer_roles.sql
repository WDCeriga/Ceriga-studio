begin;
create table if not exists public.manufacturer_team_roles (
 id text primary key default ('custom_'||gen_random_uuid()::text),
 manufacturer_id uuid not null references public.manufacturer_profiles(user_id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 60),
 permissions text[] not null default '{}', revision integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 created_by uuid references public.profiles(id) on delete set null,
 check(id like 'custom_%'),check(array_position(permissions,null) is null));
create unique index if not exists team_roles_name_idx on public.manufacturer_team_roles(manufacturer_id,lower(btrim(name)));
alter table public.manufacturer_team_roles enable row level security;
grant select,insert,update,delete on public.manufacturer_team_roles to authenticated;
drop policy if exists team_roles_read on public.manufacturer_team_roles;
create policy team_roles_read on public.manufacturer_team_roles for select to authenticated using(manufacturer_id=public.current_factory_id() and public.factory_has_permission(manufacturer_id,'team'));
do $$declare d text;begin select pg_get_functiondef('public.apply_superadmin_access()'::regprocedure)into d;if position('''manufacturer_team_roles'''in d)=0 then d:=replace(d,'''projects''','''manufacturer_team_roles'',''projects''');execute d;end if;perform public.apply_superadmin_access();end$$;
alter table public.manufacturer_team_members drop constraint if exists manufacturer_team_members_role_check;
alter table public.manufacturer_team_invitations drop constraint if exists manufacturer_team_invitations_role_check;
create or replace function public.factory_role_valid(p_factory uuid,p_role text)returns boolean language sql stable security definer set search_path=public as $$select coalesce(p_role in('owner','admin','production','sales','staff')or exists(select 1 from manufacturer_team_roles where id=p_role and manufacturer_id=p_factory),false)$$;
revoke all on function public.factory_role_valid(uuid,text)from public,anon;grant execute on function public.factory_role_valid(uuid,text)to authenticated;
create or replace function public.team_validate_role()returns trigger language plpgsql security definer set search_path=public as $$begin if not public.factory_role_valid(new.manufacturer_id,new.role)or(tg_table_name='manufacturer_team_invitations'and new.role='owner')then raise exception 'Invalid organisation role';end if;return new;end$$;
revoke all on function public.team_validate_role()from public,anon,authenticated;
drop trigger if exists team_validate_role on public.manufacturer_team_members;
create trigger team_validate_role before insert or update of role,manufacturer_id on public.manufacturer_team_members for each row execute function public.team_validate_role();
drop trigger if exists team_validate_role on public.manufacturer_team_invitations;
create trigger team_validate_role before insert or update of role,manufacturer_id on public.manufacturer_team_invitations for each row execute function public.team_validate_role();
create or replace function public.factory_role_permissions(p_role text)returns text[]language sql stable security definer set search_path=public as $$select case p_role
 when 'owner'then array['view_orders','view_financial','quote','production','qc','shipping','calendar','inventory','customers','analytics','team','settings','portfolio','verification','messages']
 when 'admin'then array['view_orders','view_financial','quote','production','qc','shipping','calendar','inventory','customers','analytics','team','portfolio','verification','messages']
 when 'production'then array['view_orders','production','qc','shipping','calendar','inventory','messages']
 when 'sales'then array['view_orders','view_financial','quote','customers','messages']
 when 'staff'then array['view_orders','production']else coalesce((select permissions from manufacturer_team_roles where id=p_role),'{}'::text[])end$$;
create or replace function public.factory_team_invite(p_email text,p_role text,p_resend uuid default null)returns jsonb language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();m manufacturer_team_members%rowtype;i manufacturer_team_invitations%rowtype;token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');address text:=lower(btrim(p_email));begin
 perform 1 from manufacturer_profiles where user_id=f for update;
 select *into m from manufacturer_team_members where manufacturer_id=f and user_id=auth.uid()and removed_at is null;
 if not public.factory_has_permission(f,'team')or not(public.factory_role_permissions(p_role)<@case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end)then raise exception 'You cannot grant permissions you do not possess';end if;
 if (p_role='owner'or not public.factory_role_valid(f,p_role))or address!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'or length(address)>254 then raise exception 'Enter a valid email and role';end if;
 if exists(select 1 from manufacturer_team_members t join profiles p on p.id=t.user_id where t.manufacturer_id=f and t.removed_at is null and lower(p.email)=address)then raise exception 'This user is already a team member';end if;
 if(select count(*)from manufacturer_team_audit where manufacturer_id=f and action in('invite','resend')and created_at>now()-interval '1 hour')>=30 then raise exception 'Invitation limit reached; try again later';end if;
 if p_resend is not null then
 select *into i from manufacturer_team_invitations where id=p_resend and manufacturer_id=f for update;
 if not found or i.accepted_at is not null or i.revoked_at is not null then raise exception 'Only pending or expired invitations can be resent';end if;
 if i.email<>address or i.role<>p_role then raise exception 'Invitation details changed; refresh first';end if;
 update manufacturer_team_invitations set token_hash=encode(sha256(token::bytea),'hex'),invited_by=auth.uid(),expires_at=now()+interval '7 days',revision=revision+1,delivery_status='link_created',delivery_error=null where id=i.id;
 else
 update manufacturer_team_invitations set revoked_at=now()where manufacturer_id=f and lower(email)=address and accepted_at is null and revoked_at is null and expires_at<=now();
 if exists(select 1 from manufacturer_team_invitations where manufacturer_id=f and lower(email)=address and accepted_at is null and revoked_at is null)then raise exception 'A pending invitation already exists; resend or revoke it';end if;
 insert into manufacturer_team_invitations(manufacturer_id,email,role,token_hash,invited_by,expires_at)values(f,address,p_role,encode(sha256(token::bytea),'hex'),auth.uid(),now()+interval '7 days')returning *into i;
 end if;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id,details)values(f,auth.uid(),case when p_resend is null then 'invite'else 'resend'end,i.id,jsonb_build_object('email',address,'role',p_role));
 return jsonb_build_object('id',i.id,'token',token,'email',address,'factoryName',(select factory_name from manufacturer_profiles where user_id=f),'expiresAt',now()+interval '7 days');end$$;
create or replace function public.factory_team_change(p_id uuid,p_revision integer,p_action text,p_role text default null,p_permissions text[] default null)returns uuid language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();actor manufacturer_team_members%rowtype;m manufacturer_team_members%rowtype;allowed text[];begin
 perform 1 from manufacturer_profiles where user_id=f for update;
 select *into actor from manufacturer_team_members where manufacturer_id=f and user_id=auth.uid()and removed_at is null;
 if not public.factory_has_permission(f,'team')then raise exception 'Manage team permission required';end if;
 if p_action='revoke'then
 update manufacturer_team_invitations set revoked_at=now(),revision=revision+1 where id=p_id and manufacturer_id=f and revision=p_revision and accepted_at is null and revoked_at is null;
 if not found then raise exception 'Invitation changed; refresh first';end if;
 else
 select *into m from manufacturer_team_members where id=p_id and manufacturer_id=f and removed_at is null for update;
 if not found or m.revision is distinct from p_revision then raise exception 'Member changed; refresh first';end if;
 if m.role='owner'and actor.role<>'owner'then raise exception 'Only owners can change owner access';end if;
 allowed:=case when actor.role='owner'then public.factory_role_permissions('owner')else coalesce(actor.permissions,public.factory_role_permissions(actor.role))end;
 if not(coalesce(m.permissions,public.factory_role_permissions(m.role))<@allowed)then raise exception 'You cannot manage a member with greater permissions';end if;
 if p_action not in('role','permissions','remove')then raise exception 'Unknown team action';end if;
 if p_action='role'and(p_role is null or not public.factory_role_valid(f,p_role)or(p_role='owner'and actor.role<>'owner')or not(public.factory_role_permissions(p_role)<@allowed))then raise exception 'You cannot grant this role';end if;
 if p_action='permissions'and(m.role='owner'or not(coalesce(p_permissions,public.factory_role_permissions(m.role))<@allowed and coalesce(p_permissions,'{}')<@public.factory_role_permissions('owner'))or(p_permissions is not null and(cardinality(p_permissions)>16 or cardinality(p_permissions)<>(select count(distinct x)from unnest(p_permissions)x))))then raise exception 'Invalid permission override';end if;
 if m.role='owner'and(p_action='remove'or(p_action='role'and p_role<>'owner'))and(select count(*)from manufacturer_team_members where manufacturer_id=f and role='owner'and removed_at is null)<=1 then raise exception 'The last owner cannot be removed or demoted';end if;
 update manufacturer_team_members set role=case when p_action='role'then p_role else role end,permissions=case when p_action='role'then null when p_action='permissions'then p_permissions else permissions end,removed_at=case when p_action='remove'then now()else removed_at end,revision=revision+1 where id=m.id;
 if p_action='remove'then delete from manufacturer_team_order_assignments where manufacturer_id=f and user_id=m.user_id;update manufacturer_team_invitations set revoked_at=now(),revision=revision+1 where manufacturer_id=f and invited_by=m.user_id and accepted_at is null and revoked_at is null;end if;
 end if;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id,details)values(f,auth.uid(),p_action,p_id,jsonb_build_object('role',p_role,'permissions',p_permissions));return p_id;end$$;
create or replace function public.factory_team_list()returns jsonb language plpgsql stable security definer set search_path=public as $$declare f uuid:=public.current_factory_id();begin
 if not public.factory_has_permission(f,'team')then raise exception 'Manage team permission required';end if;
 return jsonb_build_object('roles',coalesce((select jsonb_agg(to_jsonb(r)order by name)from manufacturer_team_roles r where manufacturer_id=f),'[]'),'members',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('email',p.email,'name',p.full_name)order by m.joined_at)from manufacturer_team_members m join profiles p on p.id=m.user_id where m.manufacturer_id=f and m.removed_at is null),'[]'),
 'invitations',coalesce((select jsonb_agg((to_jsonb(i)-'token_hash')||jsonb_build_object('status',case when accepted_at is not null then 'Accepted'when revoked_at is not null then 'Revoked'when expires_at<=now()then 'Expired'else 'Pending'end)order by created_at desc)from(select *from manufacturer_team_invitations where manufacturer_id=f order by created_at desc limit 200)i),'[]'),
 'audit',coalesce((select jsonb_agg(to_jsonb(a))from(select *from manufacturer_team_audit where manufacturer_id=f order by created_at desc limit 30)a),'[]'),
 'orders',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',product_name))from(select id,product_name from orders where assigned_manufacturer_id=f and status not in('completed','cancelled')order by created_at desc limit 200)o),'[]'),
 'assignments',coalesce((select jsonb_agg(to_jsonb(a))from manufacturer_team_order_assignments a where manufacturer_id=f),'[]'));end$$;
create or replace function public.factory_team_save_role(p_name text,p_permissions text[],p_id text default null,p_revision integer default null)returns text language plpgsql security definer set search_path=public as $$
declare f uuid:=public.current_factory_id();r manufacturer_team_roles%rowtype;allowed text[];result text;begin
 perform 1 from manufacturer_profiles where user_id=f for update;
 if not public.factory_has_permission(f,'team')then raise exception 'Manage team permission required';end if;
 select case when role='owner'then public.factory_role_permissions('owner')else coalesce(permissions,public.factory_role_permissions(role))end into allowed from manufacturer_team_members where manufacturer_id=f and user_id=auth.uid()and removed_at is null;
 if p_permissions is null or array_position(p_permissions,null)is not null or not(p_permissions<@allowed)or not(p_permissions<@public.factory_role_permissions('owner'))or cardinality(p_permissions)<>(select count(distinct x)from unnest(p_permissions)x)then raise exception 'You cannot grant these permissions';end if;
 if p_name is null or length(btrim(p_name))not between 1 and 60 or lower(btrim(p_name))in('owner','admin','production manager','sales / quotations','staff')then raise exception 'Choose a distinct role name (1–60 characters)';end if;
 if p_id is null then insert into manufacturer_team_roles(manufacturer_id,name,permissions,created_by)values(f,btrim(p_name),p_permissions,auth.uid())returning id into result;
 else select *into r from manufacturer_team_roles where id=p_id and manufacturer_id=f for update;
 if not found or r.revision is distinct from p_revision then raise exception 'Role changed; refresh first';end if;
 if not(r.permissions<@allowed)then raise exception 'You cannot manage a role with greater permissions';end if;
 -- Existing individual overrides remain explicit; role defaults update immediately.
 update manufacturer_team_roles set name=btrim(p_name),permissions=p_permissions,revision=revision+1,updated_at=now()where id=r.id returning id into result;
 end if;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action,details)values(f,auth.uid(),'save_custom_role',jsonb_build_object('role',result,'name',btrim(p_name),'permissions',p_permissions));return result;end$$;
revoke all on function public.factory_team_save_role(text,text[],text,integer)from public,anon;grant execute on function public.factory_team_save_role(text,text[],text,integer)to authenticated;

create index if not exists team_members_role_idx on public.manufacturer_team_members(manufacturer_id,role);
create index if not exists team_invites_role_idx on public.manufacturer_team_invitations(manufacturer_id,role);
create or replace function public.team_protect_custom_role()returns trigger language plpgsql security definer set search_path=public as $$begin
 if exists(select 1 from manufacturer_profiles where user_id=old.manufacturer_id)and(exists(select 1 from manufacturer_team_members where role=old.id)or exists(select 1 from manufacturer_team_invitations where role=old.id))then raise exception 'This role is referenced by team records and must be retained';end if;return old;end$$;
revoke all on function public.team_protect_custom_role()from public,anon,authenticated;
drop trigger if exists team_protect_custom_role on public.manufacturer_team_roles;
create trigger team_protect_custom_role before delete or update of id,manufacturer_id on public.manufacturer_team_roles for each row execute function public.team_protect_custom_role();
commit;
