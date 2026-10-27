-- Permission checks only: all temporary messages and team changes are rolled back.
begin;
do $$ begin
 perform set_config('app.factory',(select jsonb_build_object('email',p.email,'sub',p.id,'role','authenticated')::text from public.profiles p join public.manufacturer_profiles m on m.user_id=p.id limit 1),true);
 perform set_config('app.brand',(select jsonb_build_object('email',p.email,'sub',p.id,'role','authenticated')::text from public.profiles p join auth.users u on u.id=p.id where p.role='brand' and u.email_confirmed_at is not null and not exists(select 1 from public.superadmin_emails a where lower(a.email)=lower(p.email)) limit 1),true);
 perform set_config('app.admin',(select jsonb_build_object('email',p.email,'sub',p.id,'role','authenticated')::text from public.profiles p join public.superadmin_emails a on lower(a.email)=lower(p.email) limit 1),true);
 if current_setting('app.factory',true) is null or current_setting('app.brand',true) is null or current_setting('app.admin',true) is null then raise exception 'Required test accounts missing'; end if;
 perform set_config('request.jwt.claims',current_setting('app.factory'),true);
end $$;
set local role authenticated;
do $$ declare t uuid; denied boolean:=false; begin
 if not public.messaging_enabled() then raise exception 'Factory is blocked'; end if;
 t:=public.start_chat(null);
 perform set_config('app.thread',t::text,true);
 if public.start_chat(null)<>t then raise exception 'Duplicate support thread'; end if;
 begin perform public.start_chat((current_setting('app.brand')::jsonb->>'sub')::uuid); exception when others then denied:=true; end;
 if not denied then raise exception 'Factory can contact a brand'; end if;
 insert into public.admin_chat_messages(thread_id,sender,body) values(t,'admin','__rollback_factory_message');
 if not exists(select 1 from public.admin_chat_messages where thread_id=t and body='__rollback_factory_message' and sender='participant' and sender_user_id=auth.uid()) then raise exception 'Sender spoofing permitted'; end if;
 insert into storage.objects(bucket_id,name) values('chat-attachments',t::text||'/__restricted_test.txt');
end $$;
do $$ begin perform set_config('request.jwt.claims',current_setting('app.brand'),true); end $$;
do $$ declare denied boolean:=false; begin
 if public.messaging_enabled() or exists(select 1 from public.chat_contacts()) then raise exception 'Brand has messaging access'; end if;
 if exists(select 1 from public.admin_chat_threads where id=current_setting('app.thread')::uuid) then raise exception 'Brand can read factory thread'; end if;
 if exists(select 1 from storage.objects where name=current_setting('app.thread')||'/__restricted_test.txt') then raise exception 'Brand can read attachment'; end if;
 begin perform public.start_chat(null); exception when others then denied:=true; end;
 if not denied then raise exception 'Brand can start chat'; end if;
 denied:=false;
 begin insert into public.admin_chat_messages(thread_id,sender,body) values(current_setting('app.thread')::uuid,'participant','__must_fail'); exception when others then denied:=true; end;
 if not denied then raise exception 'Brand can send'; end if;
 denied:=false;
 begin perform public.set_messaging_teammate('someone@example.invalid',true); exception when others then denied:=true; end;
 if not denied then raise exception 'Brand can grant membership'; end if;
end $$;
do $$ begin
 perform set_config('request.jwt.claims',current_setting('app.factory'),true);
 perform public.set_messaging_teammate(current_setting('app.brand')::jsonb->>'email',true);
 perform set_config('request.jwt.claims',current_setting('app.brand'),true);
end $$;
do $$ declare t uuid:=current_setting('app.thread')::uuid; begin
 if not public.messaging_enabled() or public.start_chat(null)<>t then raise exception 'Teammate cannot share factory conversation'; end if;
 if not exists(select 1 from public.admin_chat_messages where thread_id=t and body='__rollback_factory_message') then raise exception 'Teammate cannot read history'; end if;
 if not exists(select 1 from storage.objects where name=t::text||'/__restricted_test.txt') then raise exception 'Teammate cannot read attachment'; end if;
 insert into public.admin_chat_messages(thread_id,sender,body) values(t,'participant','__rollback_team_reply');
end $$;
do $$ begin
 perform set_config('request.jwt.claims',current_setting('app.factory'),true);
 perform public.set_messaging_teammate(current_setting('app.brand')::jsonb->>'email',false);
 perform set_config('request.jwt.claims',current_setting('app.brand'),true);
 if public.messaging_enabled() or public.can_access_chat(current_setting('app.thread')::uuid) then raise exception 'Revoked teammate retains access'; end if;
 perform set_config('request.jwt.claims',current_setting('app.admin'),true);
end $$;
do $$ declare t uuid:=current_setting('app.thread')::uuid; denied boolean:=false; begin
 if public.start_chat((current_setting('app.factory')::jsonb->>'sub')::uuid)<>t then raise exception 'Admin conversation does not match factory'; end if;
 insert into public.admin_chat_messages(thread_id,sender,body) values(t,'participant','__rollback_admin_reply');
 if not exists(select 1 from public.admin_chat_messages where thread_id=t and body='__rollback_admin_reply' and sender='admin') then raise exception 'Admin reply missing'; end if;
 begin perform public.start_chat((current_setting('app.brand')::jsonb->>'sub')::uuid); exception when others then denied:=true; end;
 if not denied then raise exception 'Admin can create brand conversation'; end if;
end $$;
rollback;
select 'PASS: brand isolation, factory/admin replies, shared teammate history and attachments, revocation, sender protection and thread reuse; all test writes rolled back' as verification;
