begin;
create temporary table production_live_fixture(factory uuid,buyer uuid,order_id uuid,checks jsonb default '{}');
grant select,update on production_live_fixture to authenticated;
do $$declare f uuid;b uuid;o uuid;root_claims text;begin
 select jsonb_build_object('sub',u.id,'email',u.email,'role','authenticated')::text into root_claims from auth.users u join public.superadmin_emails s on lower(s.email)=lower(u.email)limit 1;
 if root_claims is null then raise exception 'An existing protected admin is required for safe test setup';end if;perform set_config('request.jwt.claims',root_claims,true);
 select m.user_id into f from manufacturer_profiles m join auth.users u on u.id=m.user_id where public.factory_password_ready(m.user_id)and exists(select 1 from manufacturer_team_members t where t.manufacturer_id=m.user_id and t.user_id=m.user_id and t.removed_at is null and t.role='owner')and not exists(select 1 from superadmin_emails s where lower(s.email)=lower(u.email))order by m.created_at limit 1;
 select p.id into b from profiles p where p.role='brand'and not exists(select 1 from superadmin_emails s where lower(s.email)=lower(p.email))order by p.created_at limit 1;
 if f is null or b is null then raise exception 'Existing manufacturer and brand test principals are unavailable';end if;
 insert into orders(user_id,kind,product_name,garment_type,status,status_label)values(b,'production','Transactional production verification','T-shirt','submitted','Submitted')returning id into o;
 perform set_config('app.routing_write',o::text,true);perform set_config('app.workflow_write',o::text,true);
 update orders set assigned_manufacturer_id=f,status='processing',factory_status='in_production',production_released_at=now(),payment_verified_at=now(),paid_amount_cents=100,selected_price_option_id='bulk',price_options='[{"id":"bulk","totalUnits":10,"priceCents":100,"currency":"GBP"}]'where id=o;
 insert into production_live_fixture(factory,buyer,order_id)values(f,b,o);
 perform set_config('request.headers',jsonb_build_object('x-ceriga-factory',f)::text,true);
 perform set_config('request.jwt.claims',(select jsonb_build_object('sub',u.id,'email',u.email,'role','authenticated')::text from auth.users u where u.id=f),true);
end$$;
set local role authenticated;
do $$declare fixture record;settings jsonb;c jsonb;o jsonb;result jsonb;request uuid:=gen_random_uuid();old_revision integer;old_version integer;begin
 select *into fixture from production_live_fixture;
 settings:=public.production_template();c:=settings->'config';
 -- Explicitly use a simple test snapshot inside this rolled-back transaction only.
 c:=jsonb_set(c,'{startEvent}','"production_approval"');c:=jsonb_set(c,'{factors}','[]');
 c:=jsonb_set(c,'{stages}',(select jsonb_agg(value||jsonb_build_object('starts','production_approval','automatic',false))from jsonb_array_elements(c->'stages')));
 settings:=public.production_template(c,(settings->>'revision')::integer,true);
 if public.production_template()->'config'<>c then raise exception 'Timeline did not persist';end if;
 o:=public.production_board(fixture.order_id)->'orders'->0;
 if o is null then raise exception 'Authorised order did not load';end if;
 result:=public.production_action(fixture.order_id,'preview_rules','{}',(o->'plan'->>'revision')::integer,(o->>'version')::integer,gen_random_uuid());
 perform public.production_action(fixture.order_id,'apply_rules',jsonb_build_object('templateRevision',result->'templateRevision','previewHash',result->'previewHash'),(o->'plan'->>'revision')::integer,(o->>'version')::integer,gen_random_uuid());
 o:=public.production_board(fixture.order_id)->'orders'->0;old_revision:=(o->'plan'->>'revision')::integer;old_version:=(o->>'version')::integer;
 perform public.production_action(fixture.order_id,'advance','{}',old_revision,old_version,request);
 result:=public.production_action(fixture.order_id,'advance','{}',old_revision,old_version,request);
 if result->>'replayed'<>'true'then raise exception 'Duplicate request was not safely replayed';end if;
 o:=public.production_board(fixture.order_id)->'orders'->0;
 if(o->>'version')::integer<>1 or o->>'stage'<>'preparation'then raise exception 'Manual stage did not persist';end if;
 perform public.production_action(fixture.order_id,'advance','{}',(o->'plan'->>'revision')::integer,1,gen_random_uuid());
 o:=public.production_board(fixture.order_id)->'orders'->0;if o->>'stage'<>'cutting'then raise exception 'One-click next stage failed';end if;
 perform public.production_action(fixture.order_id,'block','{"reason":"Transactional delay check","category":"materials","until":null}',(o->'plan'->>'revision')::integer,2,gen_random_uuid());
 o:=public.production_board(fixture.order_id)->'orders'->0;
 if o->'plan'->>'expected_completion'is not null or o->'plan'->>'uncertain'<>'true'then raise exception 'Unknown blocker did not make completion uncertain';end if;
 begin perform public.production_action(fixture.order_id,'advance','{}',(o->'plan'->>'revision')::integer,2,gen_random_uuid());raise exception 'Blocked advance incorrectly allowed';exception when others then if sqlerrm='Blocked advance incorrectly allowed'then raise;end if;end;
 if exists(select 1 from order_production_timelines where manufacturer_id<>fixture.factory)then raise exception 'Cross-factory RLS isolation failed';end if;
 update production_live_fixture set checks='{"savedTimeline":true,"savedManualStages":true,"duplicateRetrySafe":true,"unknownDelayUncertain":true,"blockedTransitionDenied":true,"manufacturerIsolation":true}';
end$$;
reset role;
select checks,
(select count(*)=3 from pg_class where relnamespace='public'::regnamespace and relname in('manufacturer_production_timelines','order_production_timelines','production_timeline_events')and relrowsecurity)as all_tables_rls,
not has_function_privilege('authenticated','public.production_scheduler()','execute')as scheduler_private,
not has_function_privilege('authenticated','public.apply_superadmin_access()','execute')as migration_helper_private,
(select count(*)=1 from cron.job where jobname='ceriga-production-timeline'and active)as scheduled_job_live,
(select count(*)from pg_proc where pronamespace='public'::regnamespace and proname='production_board')as board_function_count,
position('calc_start'in pg_get_functiondef('public.production_action(uuid,text,jsonb,integer,integer,uuid)'::regprocedure))>0 as latest_delay_rules,
position('for update of o skip locked'in pg_get_functiondef('public.production_scheduler()'::regprocedure))>0 as safe_lock_order
from production_live_fixture;
rollback;
