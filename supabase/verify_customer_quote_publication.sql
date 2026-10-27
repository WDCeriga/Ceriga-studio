begin;
do $$
declare target public.orders%rowtype; options jsonb; actual jsonb; unrelated uuid;
begin
 select * into target from public.orders where kind='production' and status in('submitted','awaiting_payment','priced') and jsonb_typeof(manufacturer_quote)='array' and jsonb_array_length(manufacturer_quote)>0 and not workflow_managed order by created_at limit 1;
 if not found then raise exception 'No eligible quoted order for verification';end if;
 select jsonb_agg(jsonb_build_object('id',value->>'id','kind',value->>'kind','label',value->>'label','description','Rollback verification only','totalUnits',(value->>'totalUnits')::numeric,'priceCents',34104,'currency',coalesce(value->>'currency','GBP'),'leadTimeDays',value->'leadTimeDays')) into options from jsonb_array_elements(target.manufacturer_quote);
 select user_id into unrelated from public.manufacturer_profiles where user_id is distinct from target.user_id and user_id is distinct from target.assigned_manufacturer_id limit 1;
 perform set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","email":"owner@ceriga.io","role":"authenticated"}',true);
 execute 'set local role authenticated';
 if not public.is_superadmin() then raise exception 'Superadmin authorization failed';end if;
 update public.orders set price_options=options,priced_at=now(),status='priced',status_label='Quote ready' where id=target.id;
 if not found then raise exception 'Admin publication did not persist';end if;
 execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',target.user_id,'email','customer-check@example.invalid','role','authenticated')::text,true);
 execute 'set local role authenticated';
 select price_options into actual from public.orders where id=target.id and status='priced' and priced_at is not null;
 if actual is distinct from options then raise exception 'Customer cannot read approved options';end if;
 if exists(select 1 from public.orders where id=target.id and paid_amount_cents is distinct from target.paid_amount_cents) then raise exception 'Publication changed payment';end if;
 execute 'reset role';
 if unrelated is not null then
  perform set_config('request.jwt.claims',jsonb_build_object('sub',unrelated,'email','unrelated-factory@example.invalid','role','authenticated')::text,true);
  execute 'set local role authenticated';
  if exists(select 1 from public.orders where id=target.id)then raise exception 'Unrelated factory can see quote';end if;
  execute 'reset role';
 end if;
end $$;
select 'PASS: admin publishes approved price options atomically; owner reads quote/currency/lead time; unrelated factory isolated; payment unchanged. All test changes rolled back.' as verification;
rollback;
