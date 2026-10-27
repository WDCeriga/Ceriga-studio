-- Exercise the same fields sent by the app, without leaving test orders behind.
begin;
do $$ begin
 perform set_config('app.order_owner',(select jsonb_build_object('sub',p.id,'email',p.email,'role','authenticated')::text
   from public.profiles p where p.role='brand' and not exists(select 1 from public.superadmin_emails a where lower(a.email)=lower(p.email)) limit 1),true);
 if current_setting('app.order_owner',true) is null then raise exception 'A brand test account is required'; end if;
 perform set_config('request.jwt.claims',current_setting('app.order_owner'),true);
end $$;
set local role authenticated;
do $$ declare order_id uuid; begin
 insert into public.orders(user_id,kind,product_name,garment_type,product_id,status,status_label,total,
   order_quantities,price_options,export_format,priced_at,quote_request,specifications,download_ready,revision_used,
   contact_name,contact_email,contact_phone,delivery_address)
 values(auth.uid(),'production','__rollback_order_test','Hoodie','test-product','submitted','Awaiting quote',null,
   '{"mode":"custom_clothing"}',null,null,null,null,null,false,false,
   'Test buyer','buyer@example.invalid','0000000000','{"firstName":"Test","lastName":"Buyer","country":"GB","address1":"Test address","city":"Test city","postcode":"TEST"}')
 returning id into order_id;
 if not exists(select 1 from public.orders where id=order_id and contact_name='Test buyer' and delivery_address->>'country'='GB') then raise exception 'Order contact or delivery data was not saved'; end if;
 perform set_config('app.created_order',order_id::text,true);
 insert into public.orders(user_id,kind,product_name,garment_type,status,status_label,total,export_format,priced_at,contact_name)
 values(auth.uid(),'tech-pack','__rollback_techpack_test','T-shirt','awaiting_payment','Awaiting payment',29,'pdf',current_date,'Test buyer');
end $$;
do $$ begin perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","email":"unrelated@example.invalid","role":"authenticated"}',true); end $$;
do $$ declare denied boolean:=false; begin
 if exists(select 1 from public.orders where id=current_setting('app.created_order')::uuid) then raise exception 'Another account can read the order'; end if;
 begin
  insert into public.orders(user_id,kind,product_name,garment_type,status,status_label)
  values((current_setting('app.order_owner')::jsonb->>'sub')::uuid,'production','__must_fail','Garment','submitted','Awaiting quote');
 exception when insufficient_privilege then denied:=true;
 end;
 if not denied then raise exception 'An account can create orders for another user'; end if;
end $$;
reset role;
rollback;
select 'PASS: production and tech-pack creation, saved contact/delivery details, owner read-back and cross-account isolation; all test orders rolled back' as verification;
