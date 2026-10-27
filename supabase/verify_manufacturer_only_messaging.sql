begin;
do $$
declare customer record; factory record; denied boolean:=false;
begin
 select id,email into customer from auth.users where lower(email)='user@user.com' limit 1;
 if not found then raise exception 'Customer verification account unavailable';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',customer.id,'email',customer.email,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if public.messaging_enabled() or exists(select 1 from public.chat_contacts()) or exists(select 1 from public.admin_chat_threads) or exists(select 1 from public.admin_chat_messages) then raise exception 'Customer messaging access remains';end if;
 begin perform public.start_chat(null);exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Customer conversation creation was permitted';end if;
 execute 'reset role';
 select m.user_id,u.email into factory from public.manufacturer_profiles m join auth.users u on u.id=m.user_id limit 1;
 if not found then raise exception 'Manufacturer verification account unavailable';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',factory.user_id,'email',factory.email,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if not public.messaging_enabled() then raise exception 'Manufacturer messaging disabled';end if;
 if exists(select 1 from public.admin_chat_threads where channel<>'ceriga' or recipient_user_id is not null or participant_user_id not in(select public.chat_factory_ids())) then raise exception 'Manufacturer conversation isolation failed';end if;
 execute 'reset role';
 perform set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","email":"owner@ceriga.io","role":"authenticated"}',true);
 execute 'set local role authenticated';
 if not public.messaging_enabled() then raise exception 'Superadmin messaging disabled';end if;
 execute 'reset role';
end $$;
select 'PASS: customers cannot read messages/contacts or start chats; manufacturer and superadmin messaging retained. No history changed.' as verification;
rollback;