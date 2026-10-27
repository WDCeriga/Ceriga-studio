-- Exercises the configured database, including real writes, while rolling back
-- every availability change and its database notifications. No orders are changed.
begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',u.id,'email',u.email,'role','authenticated')::text,true)
from auth.users u join public.profiles p on p.id=u.id join public.manufacturer_profiles m on m.user_id=u.id
where p.role='manufacturer'and not exists(select 1 from public.superadmin_emails s where lower(s.email)=lower(u.email))limit 1;
set local role authenticated;
do $$declare saved jsonb;report jsonb;item uuid;another uuid;rev integer;before_count integer;after_count integer;begin
 if auth.uid()is null then raise exception 'A manufacturer account is required for verification';end if;
 select calendar_revision into rev from public.manufacturer_profiles where user_id=auth.uid();
 perform public.save_calendar_schedule(array[1,2,3,4,5],'Europe/London',rev);
 if not exists(select 1 from public.manufacturer_profiles where user_id=auth.uid()and calendar_timezone='Europe/London'and calendar_workdays=array[1,2,3,4,5])then raise exception 'Working schedule persistence failed';end if;
 select count(*)into before_count from public.portal_notifications;
 saved:=public.save_calendar_availability(jsonb_build_array(jsonb_build_object('start',current_date+50,'end',current_date+52)),'Calendar verification (transaction rolled back)');
 item:=(saved->'ids'->>0)::uuid;
 if not exists(select 1 from public.manufacturer_availability where id=item and manufacturer_id=auth.uid()and status='approved')then raise exception 'Availability write did not persist';end if;
 saved:=public.save_calendar_availability(jsonb_build_array(jsonb_build_object('start',current_date+50,'end',current_date+52)),'Calendar verification (transaction rolled back)');
 if(saved->>'changed')::boolean then raise exception 'Duplicate save was not idempotent';end if;
 perform public.save_calendar_availability(jsonb_build_array(jsonb_build_object('start',current_date+50,'end',current_date+53)),'Calendar verification edited',item,0,false);
 begin perform public.save_calendar_availability('[]','',item,0,true);raise exception 'STALE_ALLOWED';exception when others then if sqlerrm='STALE_ALLOWED'then raise;end if;end;
 report:=public.production_calendar(current_date+45,current_date+60,false);
 if not exists(select 1 from jsonb_array_elements(report->'blocks')b where b->>'id'=item::text)then raise exception 'Saved availability missing from calendar';end if;
 if exists(select 1 from jsonb_array_elements(report->'factories')f where f->>'id'<>auth.uid()::text)then raise exception 'Manufacturer schedule isolation failed';end if;
 if exists(select 1 from jsonb_array_elements(report->'orders')o where o->>'manufacturer_id'<>auth.uid()::text)then raise exception 'Manufacturer order isolation failed';end if;
 begin perform public.production_calendar(current_date,current_date+7,true);raise exception 'ADMIN_ALLOWED';exception when others then if sqlerrm='ADMIN_ALLOWED'then raise;end if;end;
 begin perform public.manufacturer_calendar_signals();raise exception 'SIGNALS_ALLOWED';exception when others then if sqlerrm='SIGNALS_ALLOWED'then raise;end if;end;
 perform public.save_calendar_availability('[]','',item,1,true);
 if not exists(select 1 from public.manufacturer_availability where id=item and status='withdrawn'and revision=2 and jsonb_array_length(history)=2)then raise exception 'Availability removal/history failed';end if;
 if has_function_privilege('anon','public.production_calendar(date,date,boolean,uuid,text,text,text,text,text)','execute')or has_function_privilege('authenticated','public.calendar_order_facts(uuid)','execute')then raise exception 'Unexpected calendar execution grants';end if;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',u.id,'email',u.email,'role','authenticated')::text,true)
from auth.users u join public.superadmin_emails s on lower(s.email)=lower(u.email)limit 1;
set local role authenticated;
do $$declare report jsonb;expected integer;begin
 report:=public.production_calendar(current_date,current_date+30,true);
 if public.calendar_garment_key('Hoodies')<>public.calendar_garment_key('hoodie')then raise exception 'Garment alias grouping failed';end if;
 if jsonb_typeof(report->'factories')<>'array'or jsonb_typeof(public.manufacturer_calendar_signals())<>'array'then raise exception 'Network projection failed';end if;
 if not exists(select 1 from public.portal_notifications where title='Factory unavailable dates changed'and body like '%Calendar verification%')then raise exception 'Admin change notification missing';end if;
end $$;
reset role;
rollback;
select 'PASS: real database availability save/edit/remove/history; calendar reads; manufacturer isolation; admin-only network and matching access; admin notification; all test changes rolled back' as verification;
