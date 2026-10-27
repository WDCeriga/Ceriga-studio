-- Run after the messaging migration. All writes are rolled back; no messages are delivered.
begin;
select set_config('app.chat_a',(select jsonb_build_object('email',p.email,'sub',p.id::text,'role','authenticated')::text from public.profiles p where p.role='brand' and not exists(select 1 from public.superadmin_emails a where lower(a.email)=lower(p.email)) order by p.created_at limit 1),true);
select set_config('app.chat_b',(select jsonb_build_object('email',p.email,'sub',p.id::text,'role','authenticated')::text from public.profiles p where p.role='manufacturer' order by p.created_at limit 1),true);
select set_config('app.chat_admin',(select jsonb_build_object('email',email,'sub',id::text,'role','authenticated')::text from public.profiles where lower(email)='superadmin@ceriga.co'),true);
set local role authenticated;
select set_config('request.jwt.claims',current_setting('app.chat_a'),true);
do $$ declare t uuid; m uuid; b uuid:=(current_setting('app.chat_b')::jsonb->>'sub')::uuid;
begin
  t:=public.start_chat(b);
  if public.start_chat(b)<>t then raise exception 'Duplicate direct conversation'; end if;
  perform public.start_chat(null);
  insert into public.admin_chat_messages(thread_id,sender,sender_user_id,body) values(t,'admin',b,'__rollback_brand_message') returning id into m;
  if not exists(select 1 from public.admin_chat_messages where id=m and sender='participant' and sender_user_id=auth.uid()) then raise exception 'Sender identity was not enforced'; end if;
  insert into storage.objects(bucket_id,name) values('chat-attachments',t::text||'/__rollback_attachment.txt');
  perform set_config('app.chat_thread',t::text,true);
  perform set_config('app.chat_message',m::text,true);
end $$;
select set_config('request.jwt.claims',current_setting('app.chat_b'),true);
do $$ declare t uuid:=current_setting('app.chat_thread')::uuid;
begin
  if not public.can_access_chat(t) then raise exception 'Recipient cannot access conversation'; end if;
  if not exists(select 1 from public.admin_chat_messages where id=current_setting('app.chat_message')::uuid) then raise exception 'Recipient cannot read message'; end if;
  if not exists(select 1 from storage.objects where bucket_id='chat-attachments' and name=t::text||'/__rollback_attachment.txt') then raise exception 'Recipient cannot read attachment'; end if;
  if public.start_chat((current_setting('app.chat_a')::jsonb->>'sub')::uuid)<>t then raise exception 'Reverse direction created duplicate thread'; end if;
  insert into public.admin_chat_messages(thread_id,sender,body) values(t,'participant','__rollback_factory_reply');
end $$;
select set_config('request.jwt.claims','{"email":"unrelated@example.invalid","sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}',true);
do $$ declare t uuid:=current_setting('app.chat_thread')::uuid; denied boolean:=false;
begin
  if public.can_access_chat(t) or exists(select 1 from public.admin_chat_messages where thread_id=t) then raise exception 'Nonparticipant can read private messages'; end if;
  if exists(select 1 from storage.objects where bucket_id='chat-attachments' and name=t::text||'/__rollback_attachment.txt') then raise exception 'Nonparticipant can read private attachment'; end if;
  begin
    insert into public.admin_chat_messages(thread_id,sender,body) values(t,'participant','__must_be_denied');
  exception when others then
    if sqlerrm='Conversation access denied' or sqlstate='42501' then denied:=true; else raise; end if;
  end;
  if not denied then raise exception 'Nonparticipant can send messages'; end if;
end $$;
select set_config('request.jwt.claims',current_setting('app.chat_admin'),true);
do $$ declare t uuid:=current_setting('app.chat_thread')::uuid; m uuid;
begin
  if not public.can_access_chat(t) then raise exception 'Admin cannot access conversation'; end if;
  insert into public.admin_chat_messages(thread_id,sender,body) values(t,'participant','__rollback_admin_reply') returning id into m;
  if not exists(select 1 from public.admin_chat_messages where id=m and sender='admin' and sender_user_id=auth.uid()) then raise exception 'Admin sender was not enforced'; end if;
  if not exists(select 1 from public.admin_chat_threads where id=t and last_message='__rollback_admin_reply') then raise exception 'Conversation preview was not updated'; end if;
end $$;
rollback;
select 'PASS: two-way delivery, sender identity, thread reuse, admin access and private attachment isolation; all test data rolled back' as verification;
