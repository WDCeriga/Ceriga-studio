begin;
-- The stable organisation key remains manufacturer_profiles.user_id.
create table if not exists public.manufacturer_team_members(
 id uuid primary key default gen_random_uuid(), manufacturer_id uuid not null references public.manufacturer_profiles(user_id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade, role text not null check(role in('owner','admin','production','sales','staff')),
 permissions text[], joined_at timestamptz not null default now(), last_active_at timestamptz, removed_at timestamptz, revision integer not null default 1,
 unique(manufacturer_id,user_id));
create index if not exists team_members_user_idx on public.manufacturer_team_members(user_id,manufacturer_id)where removed_at is null;
create table if not exists public.manufacturer_team_invitations(
 id uuid primary key default gen_random_uuid(),manufacturer_id uuid not null references public.manufacturer_profiles(user_id)on delete cascade,
 email text not null, role text not null check(role in('admin','production','sales','staff')),token_hash text not null unique,
 invited_by uuid references public.profiles(id)on delete set null,created_at timestamptz not null default now(),expires_at timestamptz not null,
 accepted_at timestamptz,accepted_by uuid references public.profiles(id)on delete set null,revoked_at timestamptz,
 delivery_status text not null default 'link_created' check(delivery_status in('link_created','sent','failed')),delivery_error text,
 revision integer not null default 1);
create index if not exists team_invites_factory_idx on public.manufacturer_team_invitations(manufacturer_id,created_at desc);
create unique index if not exists team_invites_pending_idx on public.manufacturer_team_invitations(manufacturer_id,lower(email))where accepted_at is null and revoked_at is null;
create table if not exists public.manufacturer_team_contexts(user_id uuid primary key references public.profiles(id)on delete cascade,manufacturer_id uuid references public.manufacturer_profiles(user_id)on delete cascade);
create table if not exists public.manufacturer_team_audit(id uuid primary key default gen_random_uuid(),manufacturer_id uuid not null references public.manufacturer_profiles(user_id)on delete cascade,actor_id uuid references public.profiles(id)on delete set null,action text not null,subject_id uuid,details jsonb not null default '{}',created_at timestamptz not null default now());
create index if not exists team_audit_factory_idx on public.manufacturer_team_audit(manufacturer_id,created_at desc);
create table if not exists public.manufacturer_team_order_assignments(manufacturer_id uuid not null references public.manufacturer_profiles(user_id)on delete cascade,user_id uuid not null references public.profiles(id)on delete cascade,order_id uuid not null references public.orders(id)on delete cascade,assigned_by uuid references public.profiles(id)on delete set null,created_at timestamptz not null default now(),primary key(manufacturer_id,user_id,order_id),foreign key(manufacturer_id,user_id)references public.manufacturer_team_members(manufacturer_id,user_id)on delete cascade);
create index if not exists team_order_assignment_order_idx on public.manufacturer_team_order_assignments(order_id,user_id);
insert into public.manufacturer_team_members(manufacturer_id,user_id,role)select user_id,user_id,'owner'from public.manufacturer_profiles on conflict do nothing;
create or replace function public.team_seed_owner()returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.manufacturer_team_members(manufacturer_id,user_id,role)values(new.user_id,new.user_id,'owner')on conflict do nothing;return new;end$$;
revoke all on function public.team_seed_owner()from public,anon,authenticated;
drop trigger if exists team_seed_owner on public.manufacturer_profiles;
create trigger team_seed_owner after insert on public.manufacturer_profiles for each row execute function public.team_seed_owner();
create or replace function public.team_actor()returns uuid language sql stable set search_path=public as $$select coalesce(nullif(current_setting('app.team_actor',true),'')::uuid,auth.uid())$$;
revoke all on function public.team_actor()from public,anon,authenticated;
create or replace function public.factory_role_permissions(p_role text)returns text[]language sql immutable set search_path=public as $$select case p_role
 when 'owner'then array['view_orders','view_financial','quote','production','qc','shipping','calendar','inventory','customers','analytics','team','settings','portfolio','verification','messages']
 when 'admin'then array['view_orders','view_financial','quote','production','qc','shipping','calendar','inventory','customers','analytics','team','portfolio','verification','messages']
 when 'production'then array['view_orders','production','qc','shipping','calendar','inventory','messages']
 when 'sales'then array['view_orders','view_financial','quote','customers','messages']
 when 'staff'then array['view_orders','production']else '{}'::text[]end$$;
revoke all on function public.factory_role_permissions(text)from public,anon;grant execute on function public.factory_role_permissions(text)to authenticated;
create or replace function public.factory_has_permission(p_factory uuid,p_permission text)returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from manufacturer_team_members where manufacturer_id=p_factory and user_id=public.team_actor()and removed_at is null and p_permission=any(case when role='owner'then public.factory_role_permissions('owner')else coalesce(permissions,public.factory_role_permissions(role))end))$$;
revoke all on function public.factory_has_permission(uuid,text)from public,anon;grant execute on function public.factory_has_permission(uuid,text)to authenticated;
create or replace function public.current_factory_id()returns uuid language sql stable security definer set search_path=public as $$with requested as(select nullif(lower(btrim(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-ceriga-factory')),'')id),chosen as(select coalesce((select id from requested),(select manufacturer_id::text from manufacturer_team_contexts where user_id=public.team_actor()),(select manufacturer_id::text from manufacturer_team_members where user_id=public.team_actor()and removed_at is null order by(manufacturer_id=user_id)desc,joined_at,manufacturer_id limit 1))id)select m.manufacturer_id from manufacturer_team_members m,chosen c where m.manufacturer_id::text=c.id and m.user_id=public.team_actor()and m.removed_at is null$$;
revoke all on function public.current_factory_id()from public,anon;grant execute on function public.current_factory_id()to authenticated;
create or replace function public.factory_order_visible(p_order uuid)returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from orders o join manufacturer_team_members m on m.manufacturer_id=o.assigned_manufacturer_id where o.id=p_order and m.manufacturer_id=public.current_factory_id()and m.user_id=public.team_actor()and m.removed_at is null and public.factory_has_permission(m.manufacturer_id,'view_orders')and(m.role<>'staff'or exists(select 1 from manufacturer_team_order_assignments a where a.manufacturer_id=m.manufacturer_id and a.user_id=m.user_id and a.order_id=o.id)))$$;
revoke all on function public.factory_order_visible(uuid)from public,anon;grant execute on function public.factory_order_visible(uuid)to authenticated;
create or replace function public.factory_team_context()returns jsonb language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();result jsonb;begin
 if auth.uid()is null then raise exception 'Sign in required';end if;
 update manufacturer_team_members set last_active_at=now()where user_id=auth.uid()and manufacturer_id=f and(last_active_at is null or last_active_at<now()-interval '5 minutes');
 select jsonb_build_object('factoryId',f,'role',m.role,'permissions',case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end,'organisations',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'name',p.factory_name))from manufacturer_team_members a join manufacturer_profiles p on p.user_id=a.manufacturer_id where a.user_id=auth.uid()and a.removed_at is null),'[]'))into result from manufacturer_team_members m where m.manufacturer_id=f and m.user_id=auth.uid()and m.removed_at is null;
 return coalesce(result,jsonb_build_object('factoryId',null,'permissions','[]'::jsonb,'hadMembership',exists(select 1 from manufacturer_team_members where user_id=auth.uid()),'organisations',coalesce((select jsonb_agg(jsonb_build_object('id',p.user_id,'name',p.factory_name))from manufacturer_team_members a join manufacturer_profiles p on p.user_id=a.manufacturer_id where a.user_id=auth.uid()and a.removed_at is null),'[]'::jsonb)));end$$;
create or replace function public.switch_factory_organisation(p_factory uuid)returns uuid language plpgsql security definer set search_path=public as $$begin
 if not exists(select 1 from manufacturer_team_members where user_id=auth.uid()and manufacturer_id=p_factory and removed_at is null)then raise exception 'Organisation access denied';end if;
 insert into manufacturer_team_contexts(user_id,manufacturer_id)values(auth.uid(),p_factory)on conflict(user_id)do update set manufacturer_id=excluded.manufacturer_id;return p_factory;end$$;
create or replace function public.factory_team_list()returns jsonb language plpgsql stable security definer set search_path=public as $$declare f uuid:=public.current_factory_id();begin
 if not public.factory_has_permission(f,'team')then raise exception 'Manage team permission required';end if;
 return jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('email',p.email,'name',p.full_name)order by m.joined_at)from manufacturer_team_members m join profiles p on p.id=m.user_id where m.manufacturer_id=f and m.removed_at is null),'[]'),
 'invitations',coalesce((select jsonb_agg((to_jsonb(i)-'token_hash')||jsonb_build_object('status',case when accepted_at is not null then 'Accepted'when revoked_at is not null then 'Revoked'when expires_at<=now()then 'Expired'else 'Pending'end)order by created_at desc)from(select *from manufacturer_team_invitations where manufacturer_id=f order by created_at desc limit 200)i),'[]'),
 'audit',coalesce((select jsonb_agg(to_jsonb(a))from(select *from manufacturer_team_audit where manufacturer_id=f order by created_at desc limit 30)a),'[]'),
 'orders',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',product_name))from(select id,product_name from orders where assigned_manufacturer_id=f and status not in('completed','cancelled')order by created_at desc limit 200)o),'[]'),
 'assignments',coalesce((select jsonb_agg(to_jsonb(a))from manufacturer_team_order_assignments a where manufacturer_id=f),'[]'));end$$;
create or replace function public.factory_team_invite(p_email text,p_role text,p_resend uuid default null)returns jsonb language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();m manufacturer_team_members%rowtype;i manufacturer_team_invitations%rowtype;token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');address text:=lower(btrim(p_email));begin
 perform 1 from manufacturer_profiles where user_id=f for update;
 select *into m from manufacturer_team_members where manufacturer_id=f and user_id=auth.uid()and removed_at is null;
 if not public.factory_has_permission(f,'team')or not(public.factory_role_permissions(p_role)<@case when m.role='owner'then public.factory_role_permissions('owner')else coalesce(m.permissions,public.factory_role_permissions(m.role))end)then raise exception 'You cannot grant permissions you do not possess';end if;
 if p_role not in('admin','production','sales','staff')or address!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'or length(address)>254 then raise exception 'Enter a valid email and role';end if;
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
create or replace function public.accept_factory_invitation(p_token text)returns uuid language plpgsql security definer set search_path=public as $$declare i manufacturer_team_invitations%rowtype;f uuid;verified_email text;begin
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
 if p_action='role'and(p_role is null or p_role not in('owner','admin','production','sales','staff')or(p_role='owner'and actor.role<>'owner')or not(public.factory_role_permissions(p_role)<@allowed))then raise exception 'You cannot grant this role';end if;
 if p_action='permissions'and(m.role='owner'or not(coalesce(p_permissions,public.factory_role_permissions(m.role))<@allowed and coalesce(p_permissions,'{}')<@public.factory_role_permissions('owner'))or(p_permissions is not null and(cardinality(p_permissions)>16 or cardinality(p_permissions)<>(select count(distinct x)from unnest(p_permissions)x))))then raise exception 'Invalid permission override';end if;
 if m.role='owner'and(p_action='remove'or(p_action='role'and p_role<>'owner'))and(select count(*)from manufacturer_team_members where manufacturer_id=f and role='owner'and removed_at is null)<=1 then raise exception 'The last owner cannot be removed or demoted';end if;
 update manufacturer_team_members set role=case when p_action='role'then p_role else role end,permissions=case when p_action='role'then null when p_action='permissions'then p_permissions else permissions end,removed_at=case when p_action='remove'then now()else removed_at end,revision=revision+1 where id=m.id;
 if p_action='remove'then delete from manufacturer_team_order_assignments where manufacturer_id=f and user_id=m.user_id;update manufacturer_team_invitations set revoked_at=now(),revision=revision+1 where manufacturer_id=f and invited_by=m.user_id and accepted_at is null and revoked_at is null;end if;
 end if;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id,details)values(f,auth.uid(),p_action,p_id,jsonb_build_object('role',p_role,'permissions',p_permissions));return p_id;end$$;
create or replace function public.factory_team_assign_order(p_user uuid,p_order uuid,p_enabled boolean)returns uuid language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();begin
 perform 1 from manufacturer_profiles where user_id=f for update;
 if p_enabled is null or not public.factory_has_permission(f,'team')or not exists(select 1 from orders where id=p_order and assigned_manufacturer_id=f)or not exists(select 1 from manufacturer_team_members where manufacturer_id=f and user_id=p_user and removed_at is null)then raise exception 'Invalid team or order assignment';end if;
 if p_enabled then insert into manufacturer_team_order_assignments(manufacturer_id,user_id,order_id,assigned_by)values(f,p_user,p_order,auth.uid())on conflict do nothing;else delete from manufacturer_team_order_assignments where manufacturer_id=f and user_id=p_user and order_id=p_order;end if;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id,details)values(f,auth.uid(),'assign_order',p_user,jsonb_build_object('order',p_order,'enabled',p_enabled));return p_order;end$$;
-- Authorisation adapter reuses the existing validated workflow implementations. The
-- original authenticated actor is retained separately from the factory principal.
create or replace function public.team_enter(p_permission text,p_order uuid default null)returns jsonb language plpgsql security definer set search_path=public as $$declare claims jsonb:=auth.jwt();actor uuid:=public.team_actor();f uuid:=public.current_factory_id();email_value text;begin
 if auth.uid()is null then raise exception 'Sign in required';end if;
 if public.is_superadmin()and nullif(current_setting('app.team_actor',true),'')is null then return claims;end if;
 if f is null and p_permission='settings'and not exists(select 1 from manufacturer_profiles where user_id=actor)and exists(select 1 from profiles where id=actor and role='manufacturer')then f:=actor;
 else
 perform 1 from manufacturer_profiles where user_id=f for share;
 perform 1 from manufacturer_team_members where manufacturer_id=f and user_id=actor and removed_at is null for share;
 if not found or not public.factory_has_permission(f,p_permission)then raise exception 'Permission denied: %',p_permission;end if;
 end if;
 if p_order is not null and not public.factory_order_visible(p_order)then raise exception 'Order access denied';end if;
 select email into email_value from auth.users where id=f;
 perform set_config('app.team_actor',actor::text,true);
 perform set_config('request.jwt.claims',(claims||jsonb_build_object('sub',f,'email',email_value))::text,true);
 return claims;end$$;
revoke all on function public.team_enter(text,uuid)from public,anon,authenticated;
-- Controlled wrappers retain existing API signatures, defaults and validations.
do $wrap$declare spec record;p record;signature text;arguments text;names text;result_type text;gate text;after_call text;definition text;legacy text;
begin
 for spec in select *from(values
 ('submit_manufacturer_quote','quote','p_order_id'),('reject_order_quotation','quote','p_order_id'),
 ('update_order_production','production','p_order'),('qc_action','qc','p_order'),('qc_report_context','view_orders','p_order'),
 ('portal_dashboard','view_orders',null),('portal_report','analytics',null),('production_calendar','calendar',null),
 ('save_calendar_schedule','calendar',null),('save_calendar_availability','calendar',null),('request_factory_availability','calendar',null),('withdraw_factory_availability','calendar',null),
 ('dismiss_portal_notifications','view_orders',null),('save_manufacturer_profile','settings',null),('save_portfolio_item','portfolio',null),('remove_portfolio_item','portfolio',null),('submit_factory_verification','verification',null)
 )s(name,permission,order_arg)loop
 select pg.*into p from pg_proc pg join pg_namespace n on n.oid=pg.pronamespace where n.nspname='public'and pg.proname=spec.name;
 if not found then raise exception 'Missing existing API: %',spec.name;end if;
 signature:=pg_get_function_identity_arguments(p.oid);arguments:=pg_get_function_arguments(p.oid);result_type:=pg_get_function_result(p.oid);names:=array_to_string(p.proargnames,',');legacy:='team_impl_'||spec.name;
 if not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname=legacy)then
 execute format('alter function public.%I(%s)rename to %I',spec.name,signature,legacy);
 end if;
 execute format('revoke all on function public.%I(%s)from public,anon,authenticated',legacy,signature);
 gate:=format('claims:=public.team_enter(%L,%s);',spec.permission,coalesce(spec.order_arg,'null'));
 if spec.name='qc_action'then gate:='if p_action in(''approve_report'',''request_report_changes'')then if not public.is_superadmin()or nullif(current_setting(''app.team_actor'',true),'''')is not null then raise exception ''Superadmin review required'';end if;end if;claims:=public.team_enter(case when p_action=''dispatch''then ''shipping''else ''qc''end,p_order);';end if;
 if spec.name in('portal_dashboard','production_calendar')then gate:='if p_admin then if not public.is_superadmin()or nullif(current_setting(''app.team_actor'',true),'''')is not null then raise exception ''Superadmin access required'';end if;claims:=auth.jwt();else '||gate||'end if;';end if;
 after_call:='';
 if spec.name='update_order_production'then after_call:='update public.order_production_updates set submitted_by=actor where id=result;';end if;
 if spec.name='qc_action'then after_call:='if not public.is_superadmin()then update public.qc_inspections set inspector_id=actor where id=result and manufacturer_id=public.current_factory_id();update public.qc_evidence set uploaded_by=actor where id=result;update public.qc_audit_events set actor_id=actor where order_id=p_order and created_at=now()and actor_id=public.current_factory_id();end if;';end if;
 if spec.name='qc_report_context'then after_call:='result:=result||jsonb_build_object(''can_submit'',coalesce((result->>''can_submit'')::boolean,false)and public.factory_has_permission(public.current_factory_id(),''qc''));';end if;
 if spec.name not in('portal_dashboard','portal_report','production_calendar','qc_report_context')then after_call:=after_call||format('insert into public.manufacturer_team_audit(manufacturer_id,actor_id,action,subject_id)select public.current_factory_id(),actor,%L,%s where public.current_factory_id()is not null;',spec.name,coalesce(spec.order_arg,'null'));end if;
 definition:=format('create or replace function public.%I(%s)returns %s language plpgsql security definer set search_path=public as $body$declare claims jsonb;outer_actor text:=current_setting(''app.team_actor'',true);actor uuid:=public.team_actor();result %s;begin %s result:=public.%I(%s);%s perform set_config(''request.jwt.claims'',claims::text,true);perform set_config(''app.team_actor'',coalesce(outer_actor,''''),true);return result;end$body$',spec.name,arguments,result_type,result_type,gate,legacy,names,after_call);
 definition:=regexp_replace(definition,'\mresult\M','v_result','g');execute definition;
 execute format('revoke all on function public.%I(%s)from public,anon;grant execute on function public.%I(%s)to authenticated',spec.name,signature,spec.name,signature);
 end loop;
 -- Dashboard queries must scope every count, task and activity to authorised orders.
 select pg_get_functiondef('public.team_impl_portal_dashboard(boolean,integer,text,text,text)'::regprocedure)into definition;
 definition:=replace(definition,'not p_admin and assigned_manufacturer_id=uid)','not p_admin and assigned_manufacturer_id=uid and public.factory_order_visible(id))');execute definition;
end$wrap$;
-- Secure read projections use the real account actor, never raw factory credentials.
create or replace function public.account_order_projection(p_order public.orders)returns public.orders language plpgsql stable security definer set search_path=public as $$declare result public.orders%rowtype;factory boolean;begin
 if auth.uid()is null then raise exception 'Sign in to view orders';end if;
 if not(public.is_superadmin()or p_order.user_id=auth.uid()or public.factory_order_visible(p_order.id))then raise exception 'Order access denied';end if;
 result:=p_order;if public.is_superadmin()then return result;end if;
 factory:=public.factory_order_visible(p_order.id)and p_order.user_id<>auth.uid();result.ops_notes:=null;
 result.price_options:=public.public_price_options(p_order.price_options,coalesce(factory,false));
 if factory then result.paid_amount_cents:=null;result.total:=null;result.paid_currency:=null;result.total_currency:=null;
 if not public.factory_has_permission(p_order.assigned_manufacturer_id,'view_financial')then result.manufacturer_quote:=null;select jsonb_agg(jsonb_build_object('id',x->'id','kind',x->'kind','label',x->'label','totalUnits',x->'totalUnits','leadTimeDays',x->'leadTimeDays'))into result.price_options from jsonb_array_elements(coalesce(p_order.price_options,'[]'))x;end if;
 if not(public.factory_has_permission(p_order.assigned_manufacturer_id,'customers')or public.factory_has_permission(p_order.assigned_manufacturer_id,'shipping'))then result.contact_email:=null;result.contact_phone:=null;result.delivery_address:=null;end if;
 else result.manufacturer_quote:=null;result.factory_reject_reason:=null;end if;return result;end$$;
create or replace view public.account_orders with(security_barrier=true)as select projected.*from public.orders o cross join lateral public.account_order_projection(o)projected where auth.uid()is not null and(public.is_superadmin()or o.user_id=auth.uid()or public.factory_order_visible(o.id));
create or replace function public.qc_can_access(p_order uuid)returns boolean language sql stable security definer set search_path=public as $$select auth.uid()is not null and exists(select 1 from orders where id=p_order and(public.is_superadmin()or user_id=auth.uid()or public.factory_order_visible(id)))$$;
create or replace function public.factory_workspace_profile()returns jsonb language plpgsql stable security definer set search_path=public as $$declare f uuid:=public.current_factory_id();result jsonb;begin
 if f is null then return null;end if;
 select to_jsonb(m)into result from manufacturer_profiles m where user_id=f;
 if not public.factory_has_permission(f,'settings')then result:=result-array['internal_notes','messaging_team_emails','commission_plan_id'];result:=jsonb_set(result,'{profile_details}',coalesce(result->'profile_details','{}')-array['internalNotes','contactEmail','contactPhone','pricing']);end if;
 if not public.factory_has_permission(f,'view_financial')then result:=result-'pricing';end if;return result;end$$;
-- Raw table writes remain unavailable for team records: management is via locked RPCs.
do $$declare t text;definition text;begin
 select pg_get_functiondef('public.apply_superadmin_access()'::regprocedure)into definition;
 definition:=replace(definition,'''projects''','''manufacturer_team_members'',''manufacturer_team_invitations'',''manufacturer_team_contexts'',''manufacturer_team_audit'',''manufacturer_team_order_assignments'',''projects''');execute definition;perform public.apply_superadmin_access();
 foreach t in array array['manufacturer_team_members','manufacturer_team_invitations','manufacturer_team_contexts','manufacturer_team_audit','manufacturer_team_order_assignments']loop
 execute format('drop policy if exists team_management_read on public.%I',t);
 if t not in('manufacturer_team_contexts','manufacturer_team_invitations')then execute format('create policy team_management_read on public.%I for select to authenticated using(manufacturer_id=public.current_factory_id()and public.factory_has_permission(manufacturer_id,''team''))',t);end if;
 end loop;
end$$;
-- Only allowlisted superadmins read raw invitation records. Organisation managers use the token-free list RPC.
grant select on public.manufacturer_team_invitations to authenticated;
-- Existing owners retain profile editing; removed or demoted owners cannot use legacy table routes.
drop policy if exists team_profile_restriction on public.manufacturer_profiles;
create policy team_profile_restriction on public.manufacturer_profiles as restrictive for all to authenticated using(public.is_superadmin()or public.factory_has_permission(user_id,'settings'))with check(public.is_superadmin()or public.factory_has_permission(user_id,'settings')or(user_id=auth.uid()and not exists(select 1 from public.manufacturer_team_members where manufacturer_id=user_id)));
drop policy if exists team_materials on public.factory_materials;
create policy team_materials on public.factory_materials for all to authenticated using(user_id=public.current_factory_id()and public.factory_has_permission(user_id,'inventory'))with check(user_id=public.current_factory_id()and public.factory_has_permission(user_id,'inventory'));
drop policy if exists team_materials_restriction on public.factory_materials;
create policy team_materials_restriction on public.factory_materials as restrictive for all to authenticated using(public.is_superadmin()or public.factory_has_permission(user_id,'inventory'))with check(public.is_superadmin()or public.factory_has_permission(user_id,'inventory'));
drop policy if exists team_assets_upload on storage.objects;
create policy team_assets_upload on storage.objects for insert to authenticated with check(bucket_id='manufacturer-assets'and split_part(name,'/',1)=public.current_factory_id()::text and(public.factory_has_permission(public.current_factory_id(),'portfolio')or public.factory_has_permission(public.current_factory_id(),'verification')));
drop policy if exists team_assets_read on storage.objects;
create policy team_assets_read on storage.objects for select to authenticated using(bucket_id='manufacturer-assets'and split_part(name,'/',1)=public.current_factory_id()::text and(public.factory_has_permission(public.current_factory_id(),'portfolio')or public.factory_has_permission(public.current_factory_id(),'verification')));
-- QC upload paths use the factory namespace; backend wrappers retain the actual uploader.
drop policy if exists team_qc_upload on storage.objects;
create policy team_qc_upload on storage.objects for insert to authenticated with check(bucket_id='qc-evidence'and split_part(name,'/',2)=public.current_factory_id()::text and public.factory_has_permission(public.current_factory_id(),'qc')and exists(select 1 from public.account_orders o where o.id::text=split_part(name,'/',1)and o.assigned_manufacturer_id=public.current_factory_id()and o.status='processing'));
drop policy if exists team_order_files_read on storage.objects;
create policy team_order_files_read on storage.objects for select to authenticated using(bucket_id='order-uploads'and exists(select 1 from public.account_orders o where o.id::text=split_part(name,'/',2)and o.assigned_manufacturer_id=public.current_factory_id()));
-- Team member reads remain capability-specific, and account/order RLS still applies.
drop policy if exists team_portfolio_read on public.manufacturer_portfolio_items;
create policy team_portfolio_read on public.manufacturer_portfolio_items for select to authenticated using(manufacturer_id=public.current_factory_id()and public.factory_has_permission(manufacturer_id,'portfolio'));
drop policy if exists team_verification_read on public.manufacturer_verification_submissions;
create policy team_verification_read on public.manufacturer_verification_submissions for select to authenticated using(manufacturer_id=public.current_factory_id()and public.factory_has_permission(manufacturer_id,'verification'));
drop policy if exists team_availability_read on public.manufacturer_availability;
create policy team_availability_read on public.manufacturer_availability for select to authenticated using(manufacturer_id=public.current_factory_id()and public.factory_has_permission(manufacturer_id,'calendar'));
-- Lock down the former email-only messaging grant; existing entries are preserved,
-- but new operational membership must be accepted through the invitation workflow.
create or replace function public.set_messaging_teammate(p_email text,p_enabled boolean)returns void language plpgsql security definer set search_path=public as $$begin raise exception 'Manage team membership through Team & roles invitations';end$$;
do $$declare p record;begin for p in select oid,proname from pg_proc where pronamespace='public'::regnamespace and proname in('factory_team_context','switch_factory_organisation','factory_team_list','factory_team_invite','accept_factory_invitation','factory_team_change','factory_team_assign_order','factory_workspace_profile')loop execute format('revoke all on function %s from public,anon;grant execute on function %s to authenticated',p.oid::regprocedure,p.oid::regprocedure);end loop;end$$;
create or replace function public.record_team_invite_delivery(p_id uuid,p_status text,p_error text default null)returns uuid language plpgsql security definer set search_path=public as $$begin if p_status not in('sent','failed')then raise exception 'Invalid delivery status';end if;update manufacturer_team_invitations set delivery_status=p_status,delivery_error=left(p_error,500)where id=p_id;if not found then raise exception 'Invitation not found';end if;return p_id;end$$;
revoke all on function public.record_team_invite_delivery(uuid,text,text)from public,anon,authenticated;grant execute on function public.record_team_invite_delivery(uuid,text,text)to service_role;
create or replace function public.chat_factory_ids()returns setof uuid language sql stable security definer set search_path=public as $$select public.current_factory_id()where public.factory_has_permission(public.current_factory_id(),'messages')$$;
-- Guards also cover old direct table endpoints for the factory's original account.
do $$begin if to_regclass('public.factory_capacity_blocks')is not null then drop policy if exists team_capacity_restriction on public.factory_capacity_blocks;
create policy team_capacity_restriction on public.factory_capacity_blocks as restrictive for all to authenticated using(public.is_superadmin()or public.factory_has_permission(user_id,'calendar'))with check(public.is_superadmin()or public.factory_has_permission(user_id,'calendar')); end if;end$$;
drop policy if exists team_customisation_restriction on public.manufacturer_customisation_settings;
create policy team_customisation_restriction on public.manufacturer_customisation_settings as restrictive for all to authenticated using(public.is_superadmin()or public.factory_has_permission(user_id,'settings'))with check(public.is_superadmin()or public.factory_has_permission(user_id,'settings'));


create or replace function public.patch_factory_workspace(p_patch jsonb)returns uuid language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();m manufacturer_profiles%rowtype;begin
 perform 1 from manufacturer_profiles where user_id=f for update;
 if not public.factory_has_permission(f,'settings')or jsonb_typeof(p_patch)is distinct from 'object'or p_patch-array['factory_name','contact_name','contact_email','contact_phone','website','address_line','typical_lead_days','garments','capabilities','shipping_regions','moq','monthly_capacity','internal_notes','pricing']<>'{}'then raise exception 'Invalid profile permission or fields';end if;
 if p_patch?'pricing'and not public.factory_has_permission(f,'view_financial')then raise exception 'Financial permission required';end if;
 if f<>auth.uid()and jsonb_typeof(p_patch->'pricing')='object'then p_patch:=jsonb_set(p_patch,'{pricing,preferredCurrency}',to_jsonb((select preferred_currency from profiles where id=f)),true);end if;
 select *into m from manufacturer_profiles where user_id=f; m:=jsonb_populate_record(m,p_patch);
 if length(btrim(m.factory_name))not between 1 and 200 or m.moq<=0 or m.monthly_capacity<0 then raise exception 'Invalid factory name, MOQ or capacity';end if;
 update manufacturer_profiles set factory_name=m.factory_name,contact_name=m.contact_name,contact_email=m.contact_email,contact_phone=m.contact_phone,website=m.website,address_line=m.address_line,typical_lead_days=m.typical_lead_days,garments=m.garments,capabilities=m.capabilities,shipping_regions=m.shipping_regions,moq=m.moq,monthly_capacity=m.monthly_capacity,internal_notes=m.internal_notes,pricing=m.pricing where user_id=f;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action)values(f,auth.uid(),'update_factory_settings');return f;end$$;
revoke all on function public.patch_factory_workspace(jsonb)from public,anon;grant execute on function public.patch_factory_workspace(jsonb)to authenticated;
create or replace function public.team_require_owner()returns trigger language plpgsql security definer set search_path=public as $$declare f uuid:=coalesce(new.manufacturer_id,old.manufacturer_id);begin
 if tg_op='UPDATE'and(new.role,new.removed_at)is not distinct from(old.role,old.removed_at)then return null;end if;
 perform 1 from manufacturer_profiles where user_id=f for update;
 if exists(select 1 from manufacturer_profiles where user_id=f)and not exists(select 1 from manufacturer_team_members where manufacturer_id=f and role='owner'and removed_at is null)then raise exception 'Every factory must retain an active owner';end if;return null;end$$;
revoke all on function public.team_require_owner()from public,anon,authenticated;
drop trigger if exists team_require_owner on manufacturer_team_members;
create constraint trigger team_require_owner after insert or update or delete on manufacturer_team_members deferrable initially deferred for each row execute function public.team_require_owner();
drop policy if exists team_orders_restriction on public.orders;
create policy team_orders_restriction on public.orders as restrictive for select to authenticated using(public.is_superadmin()or user_id=auth.uid()or public.factory_order_visible(id));
drop policy if exists team_assets_restriction on storage.objects;
create policy team_assets_restriction on storage.objects as restrictive for all to authenticated using(bucket_id<>'manufacturer-assets'or public.is_superadmin()or(split_part(name,'/',1)=public.current_factory_id()::text and(public.factory_has_permission(public.current_factory_id(),'portfolio')or public.factory_has_permission(public.current_factory_id(),'verification'))))with check(bucket_id<>'manufacturer-assets'or public.is_superadmin()or(split_part(name,'/',1)=public.current_factory_id()::text and(public.factory_has_permission(public.current_factory_id(),'portfolio')or public.factory_has_permission(public.current_factory_id(),'verification'))));


drop policy if exists team_qc_reports_read on qc_inspections;
create policy team_qc_reports_read on qc_inspections for select to authenticated using(public.factory_order_visible(order_id)and manufacturer_id=public.current_factory_id());
drop policy if exists team_qc_evidence_read on qc_evidence;
create policy team_qc_evidence_read on qc_evidence for select to authenticated using(public.factory_order_visible(order_id)and exists(select 1 from qc_inspections i where i.id=inspection_id and i.manufacturer_id=public.current_factory_id()));
drop policy if exists team_qc_releases_read on qc_shipment_releases;
create policy team_qc_releases_read on qc_shipment_releases for select to authenticated using(public.factory_order_visible(order_id)and exists(select 1 from qc_inspections i where i.id=inspection_id and i.manufacturer_id=public.current_factory_id()));
drop policy if exists team_qc_audit_read on qc_audit_events;
create policy team_qc_audit_read on qc_audit_events for select to authenticated using(public.factory_order_visible(order_id)and details->>'manufacturer_id'=public.current_factory_id()::text);


create or replace function public.factory_operational_settings()returns jsonb language plpgsql stable security definer set search_path=public as $$declare f uuid:=public.current_factory_id();s jsonb;begin
 if f is null and exists(select 1 from profiles where id=auth.uid()and role='manufacturer')and not exists(select 1 from manufacturer_team_members where user_id=auth.uid())then return null;end if;
 if not public.factory_has_permission(f,'view_orders')then raise exception 'Factory access required';end if;
 select settings into s from manufacturer_customisation_settings where user_id=f;
 return s-array['factoryProfile','pricing','internalNotes'];end$$;
revoke all on function public.factory_operational_settings()from public,anon;grant execute on function public.factory_operational_settings()to authenticated;


create or replace function public.save_factory_operational_settings(p_settings jsonb)returns uuid language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();begin
 perform 1 from manufacturer_profiles where user_id=f for update;
 if not public.factory_has_permission(f,'settings')or jsonb_typeof(p_settings)is distinct from 'object'or octet_length(p_settings::text)>500000 then raise exception 'Factory settings permission required';end if;
 insert into manufacturer_customisation_settings(user_id,settings)values(f,p_settings)on conflict(user_id)do update set settings=excluded.settings,updated_at=now();
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action)values(f,auth.uid(),'update_capability_settings');return f;end$$;
revoke all on function public.save_factory_operational_settings(jsonb)from public,anon;grant execute on function public.save_factory_operational_settings(jsonb)to authenticated;
drop policy if exists team_notifications_read on public.portal_notifications;
create policy team_notifications_read on public.portal_notifications for select to authenticated using(audience='manufacturer'and user_id=public.current_factory_id()and public.factory_has_permission(user_id,'view_orders')and(order_id is null or public.factory_order_visible(order_id)));


create or replace function public.save_factory_pricing(p_pricing jsonb)returns uuid language plpgsql security definer set search_path=public as $$declare f uuid:=public.current_factory_id();begin
 if jsonb_typeof(p_pricing)is distinct from 'object'or octet_length(p_pricing::text)>500000 then raise exception 'Invalid pricing settings';end if;
 if f is null then
 if auth.uid()is null or not exists(select 1 from profiles where id=auth.uid()and role='manufacturer')or exists(select 1 from manufacturer_team_members where user_id=auth.uid())then raise exception 'Factory settings permission required';end if;
 insert into manufacturer_profiles(user_id,factory_name,pricing)values(auth.uid(),'My factory',p_pricing);f:=auth.uid();
 else
 perform 1 from manufacturer_profiles where user_id=f for update;
 if not(public.factory_has_permission(f,'settings')and public.factory_has_permission(f,'view_financial'))then raise exception 'Factory financial settings permission required';end if;
 if f<>auth.uid()then p_pricing:=p_pricing||jsonb_build_object('preferredCurrency',(select preferred_currency from profiles where id=f));end if;
 update manufacturer_profiles set pricing=p_pricing where user_id=f;
 end if;
 insert into manufacturer_team_audit(manufacturer_id,actor_id,action)values(f,auth.uid(),'update_factory_pricing');return f;end$$;
revoke all on function public.save_factory_pricing(jsonb)from public,anon;grant execute on function public.save_factory_pricing(jsonb)to authenticated;
drop policy if exists team_notifications_update on public.portal_notifications;
create policy team_notifications_update on public.portal_notifications for update to authenticated using(audience='manufacturer'and user_id=public.current_factory_id()and public.factory_has_permission(user_id,'view_orders')and(order_id is null or public.factory_order_visible(order_id)))with check(audience='manufacturer'and user_id=public.current_factory_id()and public.factory_has_permission(user_id,'view_orders')and(order_id is null or public.factory_order_visible(order_id)));
drop policy if exists team_notifications_scope on public.portal_notifications;
create policy team_notifications_scope on public.portal_notifications as restrictive for select to authenticated using(public.is_superadmin()or(audience='manufacturer'and user_id=public.current_factory_id()and public.factory_has_permission(user_id,'view_orders')and(order_id is null or public.factory_order_visible(order_id))));


-- Delegating a factory principal must never inherit a factory owner's platform-admin identity.
create or replace function public.is_superadmin()returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.superadmin_emails s where lower(s.email)=lower(case when nullif(current_setting('app.team_actor',true),'')is null then coalesce(auth.jwt()->>'email','')else coalesce((select email from auth.users where id=public.team_actor()),'')end));
$$;
revoke all on function public.is_superadmin()from public,anon;grant execute on function public.is_superadmin()to authenticated;
do $$declare definition text;begin
 select pg_get_functiondef('public.team_impl_portal_report(integer)'::regprocedure)into definition;
 definition:=replace(definition,'admin or assigned_manufacturer_id=auth.uid()','admin or (assigned_manufacturer_id=auth.uid()and public.factory_order_visible(id))');execute definition;
 select pg_get_functiondef('public.calendar_order_facts(uuid)'::regprocedure)into definition;
 if position('app.team_actor'in definition)=0 then definition:=replace(definition,'and(p_factory is null or o.assigned_manufacturer_id=p_factory)','and(p_factory is null or o.assigned_manufacturer_id=p_factory)and(nullif(current_setting(''app.team_actor'',true),'''')is null or public.factory_order_visible(o.id))');execute definition;end if;
end$$;


create or replace function public.factory_asset_can_read(p_path text,p_owner uuid)returns boolean language sql stable security definer set search_path=public as $$
 select split_part(p_path,'/',1)=public.current_factory_id()::text and(
 (p_owner=public.team_actor()and(public.factory_has_permission(public.current_factory_id(),'portfolio')or public.factory_has_permission(public.current_factory_id(),'verification'))and not exists(select 1 from manufacturer_portfolio_items where p_path=any(image_paths))and not exists(select 1 from manufacturer_verification_submissions where p_path=any(document_paths)))
 or(public.factory_has_permission(public.current_factory_id(),'portfolio')and exists(select 1 from manufacturer_portfolio_items where manufacturer_id=public.current_factory_id()and p_path=any(image_paths)))
 or(public.factory_has_permission(public.current_factory_id(),'verification')and exists(select 1 from manufacturer_verification_submissions where manufacturer_id=public.current_factory_id()and p_path=any(document_paths))));
$$;
revoke all on function public.factory_asset_can_read(text,uuid)from public,anon;grant execute on function public.factory_asset_can_read(text,uuid)to authenticated;
drop policy if exists team_assets_read on storage.objects;
create policy team_assets_read on storage.objects for select to authenticated using(bucket_id='manufacturer-assets'and public.factory_asset_can_read(name,owner));
drop policy if exists team_assets_restriction on storage.objects;
create policy team_assets_restriction on storage.objects as restrictive for all to authenticated using(bucket_id<>'manufacturer-assets'or public.is_superadmin()or public.factory_asset_can_read(name,owner))with check(bucket_id<>'manufacturer-assets'or public.is_superadmin()or(split_part(name,'/',1)=public.current_factory_id()::text and(public.factory_has_permission(public.current_factory_id(),'portfolio')or public.factory_has_permission(public.current_factory_id(),'verification'))));
drop policy if exists team_qc_staged_read on storage.objects;
create policy team_qc_staged_read on storage.objects for select to authenticated using(bucket_id='qc-evidence'and owner=auth.uid()and split_part(name,'/',2)=public.current_factory_id()::text and public.factory_has_permission(public.current_factory_id(),'qc')and exists(select 1 from public.account_orders where id::text=split_part(name,'/',1)));
drop policy if exists team_qc_cleanup on storage.objects;
create policy team_qc_cleanup on storage.objects for delete to authenticated using(bucket_id='qc-evidence'and owner=auth.uid()and split_part(name,'/',2)=public.current_factory_id()::text and public.factory_has_permission(public.current_factory_id(),'qc')and not exists(select 1 from qc_evidence where path=name));
drop policy if exists team_assets_cleanup on storage.objects;
create policy team_assets_cleanup on storage.objects for delete to authenticated using(bucket_id='manufacturer-assets'and owner=auth.uid()and public.factory_asset_can_read(name,owner)and not exists(select 1 from manufacturer_portfolio_items where name=any(image_paths))and not exists(select 1 from manufacturer_verification_submissions where name=any(document_paths)));


-- New quotations use the authenticated submitter's saved preference; existing
-- quotation currencies remain locked by the original validation routine.
do $$declare definition text;begin
 select pg_get_functiondef('public.team_impl_submit_manufacturer_quote(uuid,jsonb)'::regprocedure)into definition;
 definition:=replace(definition,'select preferred_currency into quote_currency from public.profiles where id=auth.uid();','select preferred_currency into quote_currency from public.profiles where id=public.team_actor();');execute definition;
end$$;


-- Cleanup checks use all historical references, even after an order is reassigned
-- or the uploader loses permission to read a particular document category.
create or replace function public.factory_asset_is_unused(p_bucket text,p_path text)returns boolean language sql stable security definer set search_path=public as $$select case p_bucket when 'qc-evidence'then not exists(select 1 from qc_evidence where path=p_path)when 'manufacturer-assets'then not exists(select 1 from manufacturer_portfolio_items where p_path=any(image_paths))and not exists(select 1 from manufacturer_verification_submissions where p_path=any(document_paths))else false end$$;
revoke all on function public.factory_asset_is_unused(text,text)from public,anon;grant execute on function public.factory_asset_is_unused(text,text)to authenticated;
drop policy if exists team_preserve_referenced_files on storage.objects;
create policy team_preserve_referenced_files on storage.objects as restrictive for delete to authenticated using(bucket_id not in('qc-evidence','manufacturer-assets')or public.is_superadmin()or public.factory_asset_is_unused(bucket_id,name));


-- Only offer dashboard actions the current teammate is allowed to complete.
do $$declare definition text;begin
 select pg_get_functiondef('public.team_impl_portal_dashboard(boolean,integer,text,text,text)'::regprocedure)into definition;
 if position('public.factory_has_permission(uid,case when task'in definition)=0 then
 definition:=replace(definition,'from classified where task is not null','from classified where task is not null and(p_admin or public.factory_has_permission(uid,case when task in(''quote'',''revise_quote'')then ''quote''when task in(''submit_qc'',''revise_qc'')then ''qc''when task=''dispatch''then ''shipping''when task in(''production_update'',''delay'')then ''production''else ''view_orders''end))');execute definition;
 end if;
end$$;

notify pgrst,'reload schema';
commit;
