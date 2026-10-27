-- Keep existing history, but limit active messaging to factories, their teams and Ceriga.
begin;
alter table public.manufacturer_profiles add column if not exists messaging_team_emails text[] not null default '{}';
create index if not exists manufacturer_messaging_team_idx on public.manufacturer_profiles using gin(messaging_team_emails);

create or replace function public.chat_factory_ids()
returns setof uuid language sql stable security definer set search_path=public as $$
  select m.user_id from public.manufacturer_profiles m
  where auth.uid() is not null and (m.user_id=auth.uid() or exists(
    select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null
      and lower(u.email)=any(m.messaging_team_emails)));
$$;
revoke all on function public.chat_factory_ids() from public,anon;
grant execute on function public.chat_factory_ids() to authenticated;

create or replace function public.messaging_enabled()
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (public.is_superadmin() or exists(select 1 from public.chat_factory_ids()));
$$;
revoke all on function public.messaging_enabled() from public,anon;
grant execute on function public.messaging_enabled() to authenticated;

create or replace function public.set_messaging_teammate(p_email text,p_enabled boolean)
returns void language plpgsql security definer set search_path=public as $$
declare normalized text:=lower(trim(p_email));
begin
 if normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid teammate email'; end if;
 update public.manufacturer_profiles set messaging_team_emails=case when p_enabled then
   array(select distinct unnest(messaging_team_emails||array[normalized]))
   else array_remove(messaging_team_emails,normalized) end where user_id=auth.uid();
 if not found then raise exception 'Only the manufacturer account owner can manage messaging teammates'; end if;
end;
$$;
revoke all on function public.set_messaging_teammate(text,boolean) from public,anon;
grant execute on function public.set_messaging_teammate(text,boolean) to authenticated;

create or replace function public.can_access_chat(p_thread uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.admin_chat_threads t where t.id=p_thread
 and (public.is_superadmin() or (t.channel='ceriga' and t.recipient_user_id is null
   and t.participant_user_id in(select public.chat_factory_ids()))));
$$;
drop policy if exists admin_chat_threads_participant on public.admin_chat_threads;
create policy admin_chat_threads_participant on public.admin_chat_threads for select to authenticated using(public.can_access_chat(id));

create or replace function public.chat_contacts()
returns table(id uuid,name text,role text) language sql stable security definer set search_path=public as $$
 select p.id,case when public.is_superadmin() then coalesce(nullif(p.full_name,''),'Manufacturer')
   else 'Ceriga Support — '||coalesce(nullif(p.full_name,''),'Your factory') end,
   case when public.is_superadmin() then 'manufacturer' else 'superadmin' end
 from public.manufacturer_profiles m join public.profiles p on p.id=m.user_id
 where public.is_superadmin() or m.user_id in(select public.chat_factory_ids()) order by p.full_name nulls last;
$$;

create or replace function public.start_chat(p_recipient uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare factory uuid; thread_id uuid;
begin
 if not public.messaging_enabled() then raise exception 'Messaging is available only to manufacturers, their teams and Ceriga administrators'; end if;
 if public.is_superadmin() then
   select user_id into factory from public.manufacturer_profiles where user_id=p_recipient;
 else
   select id into factory from public.chat_factory_ids() id where p_recipient is null or id=p_recipient order by id limit 1;
 end if;
 if factory is null then raise exception 'Choose an authorized manufacturer conversation'; end if;
 perform pg_advisory_xact_lock(hashtextextended('factory-support:'||factory::text,0));
 select id into thread_id from public.admin_chat_threads where channel='ceriga' and participant_user_id=factory and recipient_user_id is null order by created_at limit 1;
 if thread_id is null then
   insert into public.admin_chat_threads(channel,participant_user_id,participant_type,subject)
   values('ceriga',factory,'manufacturer','Manufacturer conversation') returning id into thread_id;
 end if;
 return thread_id;
end;
$$;

-- Even privileged UI inserts must not create a new brand conversation.
create or replace function public.check_chat_participants()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.channel='ceriga' and (new.recipient_user_id is not null or not exists(
   select 1 from public.manufacturer_profiles where user_id=new.participant_user_id)) then
   raise exception 'Messaging is restricted to manufacturer conversations with Ceriga';
 end if;
 return new;
end;
$$;
drop trigger if exists chat_check_participants on public.admin_chat_threads;
create trigger chat_check_participants before insert or update of participant_user_id,recipient_user_id,channel
 on public.admin_chat_threads for each row execute function public.check_chat_participants();
create or replace function public.stamp_chat_sender()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null then
   if not public.can_access_chat(new.thread_id) or exists(select 1 from public.admin_chat_threads t
     where t.id=new.thread_id and t.channel='ceriga' and (t.recipient_user_id is not null or not exists(
       select 1 from public.manufacturer_profiles m where m.user_id=t.participant_user_id))) then
     raise exception 'Conversation access denied';
   end if;
   new.sender_user_id:=auth.uid();
   new.sender:=case when public.is_superadmin() then 'admin' else 'participant' end;
 end if;
 return new;
end;
$$;
notify pgrst,'reload schema';
commit;
