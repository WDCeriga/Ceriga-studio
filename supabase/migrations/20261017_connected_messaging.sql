-- Connect existing admin threads to authenticated peer replies and direct messaging.
begin;
alter table public.admin_chat_threads add column if not exists recipient_user_id uuid references auth.users(id) on delete cascade;
alter table public.admin_chat_messages add column if not exists sender_user_id uuid references auth.users(id) on delete set null;
update public.admin_chat_messages m set sender_user_id=t.participant_user_id from public.admin_chat_threads t
  where m.thread_id=t.id and m.sender='participant' and m.sender_user_id is null and t.channel='ceriga' and t.recipient_user_id is null;
create index if not exists admin_chat_recipient_idx on public.admin_chat_threads(recipient_user_id,last_message_at desc);
create unique index if not exists admin_chat_direct_pair_idx on public.admin_chat_threads
  (least(participant_user_id,recipient_user_id),greatest(participant_user_id,recipient_user_id))
  where channel='ceriga' and recipient_user_id is not null;

create or replace function public.can_access_chat(p_thread uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists(select 1 from public.admin_chat_threads t where t.id=p_thread
    and (public.is_superadmin() or (t.channel='ceriga' and auth.uid() in (t.participant_user_id,t.recipient_user_id))));
$$;
revoke all on function public.can_access_chat(uuid) from public,anon;
grant execute on function public.can_access_chat(uuid) to authenticated;
drop policy if exists admin_chat_threads_participant on public.admin_chat_threads;
create policy admin_chat_threads_participant on public.admin_chat_threads for select to authenticated
  using(channel='ceriga' and auth.uid() in (participant_user_id,recipient_user_id));
drop policy if exists admin_chat_messages_participant on public.admin_chat_messages;
create policy admin_chat_messages_participant on public.admin_chat_messages for select to authenticated using(public.can_access_chat(thread_id));
drop policy if exists admin_chat_messages_reply on public.admin_chat_messages;
create policy admin_chat_messages_reply on public.admin_chat_messages for insert to authenticated
  with check(public.can_access_chat(thread_id) and sender_user_id=auth.uid() and sender=case when public.is_superadmin() then 'admin' else 'participant' end);

create or replace function public.chat_contacts()
returns table(id uuid,name text,role text) language sql stable security definer set search_path=public as $$
  select p.id,coalesce(nullif(p.full_name,''),'Studio member'),p.role from public.profiles p
  where auth.uid() is not null and p.id<>auth.uid()
    and not exists(select 1 from public.superadmin_emails a where lower(a.email)=lower(p.email))
  order by p.full_name nulls last;
$$;
revoke all on function public.chat_contacts() from public,anon;
grant execute on function public.chat_contacts() to authenticated;

create or replace function public.start_chat(p_recipient uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare caller uuid:=auth.uid(); target uuid:=p_recipient; caller_role text; thread_id uuid;
begin
  if caller is null then raise exception 'Sign in to start a conversation'; end if;
  if target=caller then raise exception 'Choose another account'; end if;
  select role into caller_role from public.profiles where id=caller;
  if caller_role is null then raise exception 'Account profile is missing'; end if;
  if target is not null and not exists(select 1 from public.profiles where id=target) then raise exception 'Account not found'; end if;
  if target is not null and exists(select 1 from public.profiles p join public.superadmin_emails a on lower(p.email)=lower(a.email) where p.id=target) then target:=null; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(caller::text,coalesce(target::text,'support'))||':'||greatest(caller::text,coalesce(target::text,'support')),0));
  select id into thread_id from public.admin_chat_threads t where t.channel='ceriga'
    and ((target is null and t.participant_user_id=caller and t.recipient_user_id is null)
      or (target is not null and ((t.participant_user_id=caller and t.recipient_user_id=target) or (t.participant_user_id=target and t.recipient_user_id=caller))))
    order by t.created_at limit 1;
  if thread_id is null then
    insert into public.admin_chat_threads(channel,participant_user_id,recipient_user_id,participant_type,subject)
    values('ceriga',caller,target,case when caller_role='manufacturer' then 'manufacturer' else 'brand' end,'Conversation') returning id into thread_id;
  end if;
  return thread_id;
end;
$$;
revoke all on function public.start_chat(uuid) from public,anon;
grant execute on function public.start_chat(uuid) to authenticated;

create or replace function public.stamp_chat_sender()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null then
    if not public.can_access_chat(new.thread_id) then raise exception 'Conversation access denied'; end if;
    new.sender_user_id:=auth.uid();
    new.sender:=case when public.is_superadmin() then 'admin' else 'participant' end;
  end if;
  return new;
end;
$$;
drop trigger if exists chat_stamp_sender on public.admin_chat_messages;
create trigger chat_stamp_sender before insert on public.admin_chat_messages for each row execute function public.stamp_chat_sender();
create or replace function public.update_chat_summary()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.admin_chat_threads set last_message=coalesce(nullif(left(new.body,200),''),'Attachment'),last_message_at=new.created_at,
    updated_at=now(),unread_admin=case when new.sender='admin' then 0 else unread_admin+1 end where id=new.thread_id;
  return new;
end;
$$;
drop trigger if exists chat_update_summary on public.admin_chat_messages;
create trigger chat_update_summary after insert on public.admin_chat_messages for each row execute function public.update_chat_summary();

insert into storage.buckets(id,name,public,file_size_limit) values('chat-attachments','chat-attachments',false,10485760) on conflict(id) do nothing;
drop policy if exists chat_attachment_read on storage.objects;
create policy chat_attachment_read on storage.objects for select to authenticated
  using(bucket_id='chat-attachments' and public.can_access_chat(((storage.foldername(name))[1])::uuid));
drop policy if exists chat_attachment_insert on storage.objects;
create policy chat_attachment_insert on storage.objects for insert to authenticated
  with check(bucket_id='chat-attachments' and public.can_access_chat(((storage.foldername(name))[1])::uuid));
grant select,insert,update,delete on public.admin_chat_threads,public.admin_chat_messages to authenticated;
alter table public.admin_chat_threads replica identity full;
alter table public.admin_chat_messages replica identity full;
do $$ declare table_name text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach table_name in array array['admin_chat_threads','admin_chat_messages'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
        execute format('alter publication supabase_realtime add table public.%I',table_name);
      end if;
    end loop;
  end if;
end $$;
notify pgrst,'reload schema';
commit;
