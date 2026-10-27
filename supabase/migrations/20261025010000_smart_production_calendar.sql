begin;
-- Older deployed profiles lack a column used by the existing profile-sync trigger.
alter table public.manufacturer_profiles add column if not exists city text;
update public.manufacturer_profiles set city=nullif(profile_details->>'city','')where city is null and coalesce(profile_details->>'city','')<>'';
-- Extend the existing availability source; no order commitments are changed.
alter table public.manufacturer_availability add column if not exists updated_at timestamptz not null default now();
alter table public.manufacturer_availability add column if not exists revision integer not null default 0;
alter table public.manufacturer_availability add column if not exists created_by uuid references auth.users(id)on delete set null;
alter table public.manufacturer_availability add column if not exists timezone text not null default 'UTC';
alter table public.manufacturer_availability add column if not exists history jsonb not null default '[]';
do $$declare c record;begin for c in select conname from pg_constraint where conrelid='public.manufacturer_availability'::regclass and contype='c' and pg_get_constraintdef(oid)like '%btrim(reason)%'loop execute format('alter table public.manufacturer_availability drop constraint %I',c.conname);end loop;end $$;
alter table public.manufacturer_availability drop constraint if exists calendar_reason_length;
alter table public.manufacturer_availability add constraint calendar_reason_length check(length(reason)<=2000);
alter table public.manufacturer_profiles add column if not exists calendar_workdays integer[];
alter table public.manufacturer_profiles add column if not exists calendar_timezone text not null default 'UTC';
alter table public.manufacturer_profiles add column if not exists calendar_revision integer not null default 0;
create index if not exists calendar_effective_ranges on public.manufacturer_availability(manufacturer_id,starts_on,ends_on)where status in('approved','pending');
create index if not exists calendar_processing_factories on public.orders(assigned_manufacturer_id,production_released_at)where status='processing';
create or replace function public.guard_calendar_schedule()returns trigger language plpgsql set search_path=public as $$begin
 if not exists(select 1 from pg_timezone_names where name=new.calendar_timezone)then raise exception 'Choose a valid factory time zone';end if;
 if new.calendar_workdays is not null and(cardinality(new.calendar_workdays)not between 1 and 7 or exists(select 1 from unnest(new.calendar_workdays)d where d is null or d not between 1 and 7)or cardinality(new.calendar_workdays)<>(select count(distinct d)from unnest(new.calendar_workdays)d))then raise exception 'Select distinct working weekdays';end if;
 if tg_op='UPDATE'and(new.calendar_workdays,new.calendar_timezone)is distinct from(old.calendar_workdays,old.calendar_timezone)then new.calendar_revision:=old.calendar_revision+1;end if;return new;end $$;
drop trigger if exists manufacturer_calendar_schedule_guard on public.manufacturer_profiles;
create trigger manufacturer_calendar_schedule_guard before insert or update on public.manufacturer_profiles for each row execute function public.guard_calendar_schedule();
insert into public.platform_settings(key,value)values('calendar_thresholds','{"busy":70,"full":90,"warning":30,"critical":60}')on conflict(key)do nothing;
create or replace function public.calendar_garment_key(value text)returns text language sql immutable parallel safe set search_path=public as $$
 select case k when 'tshirts'then 'tshirt'when 'tees'then 'tshirt'when 'hoodies'then 'hoodie'when 'polos'then 'polo'when 'poloshirts'then 'polo'when 'zipups'then 'zipuphoodie'when 'zipuphoodies'then 'zipuphoodie'else regexp_replace(k,'s$','')end from(select lower(regexp_replace(coalesce(value,''),'[^a-zA-Z0-9]','','g'))k)s;
$$;

create or replace function public.calendar_order_facts(p_factory uuid default null)
returns table(id uuid,manufacturer_id uuid,product text,garment text,quantity numeric,starts_on date,due_on date,stage text,status text,delay_reason text,effort_active boolean)
language sql stable security definer set search_path=public as $$
 select o.id,o.assigned_manufacturer_id,o.product_name,o.garment_type,
 case when coalesce(selected.value->>'totalUnits','')~'^[0-9]+$'then(selected.value->>'totalUnits')::numeric
 when jsonb_array_length(coalesce(o.order_quantities->'bulkRuns','[]'))=0 and coalesce(o.order_quantities->'sample'->>'targetTotal','')~'^[0-9]+$'then(o.order_quantities->'sample'->>'targetTotal')::numeric else null end,
 first_update.started,p.expected_completion,coalesce(p.stage,'not_updated'),o.status,p.delay_reason,o.qc_status<>'approved'
 from public.orders o
 left join lateral(select value from jsonb_array_elements(coalesce(o.price_options,'[]'))where value->>'id'=o.selected_price_option_id limit 1)selected on true
 left join lateral(select min((u.created_at at time zone m.calendar_timezone)::date)started from public.order_production_updates u join public.manufacturer_profiles m on m.user_id=u.manufacturer_id where u.order_id=o.id and u.manufacturer_id=o.assigned_manufacturer_id)first_update on true
 left join lateral(select u.expected_completion,u.stage,u.delay_reason from public.order_production_updates u where u.order_id=o.id and u.manufacturer_id=o.assigned_manufacturer_id order by u.version desc limit 1)p on true
 where o.status='processing'and o.production_released_at is not null and(p_factory is null or o.assigned_manufacturer_id=p_factory);
$$;
revoke all on function public.calendar_order_facts(uuid)from public,anon,authenticated;

create or replace function public.save_calendar_schedule(p_days integer[],p_timezone text,p_revision integer)returns integer
language plpgsql security definer set search_path=public as $$declare result integer;begin
 if auth.uid()is null or not exists(select 1 from public.profiles where id=auth.uid()and role='manufacturer')then raise exception 'Manufacturer access required';end if;
 if p_days is null or cardinality(p_days)not between 1 and 7 or exists(select 1 from unnest(p_days)d where d is null or d not between 1 and 7)or cardinality(p_days)<>(select count(distinct d)from unnest(p_days)d)then raise exception 'Select distinct working weekdays';end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone)then raise exception 'Choose a valid time zone';end if;
 update public.manufacturer_profiles set calendar_workdays=p_days,calendar_timezone=p_timezone,calendar_revision=calendar_revision+1 where user_id=auth.uid()and calendar_revision=p_revision returning calendar_revision into result;
 if not found then raise exception 'Schedule changed; refresh before saving';end if;
 perform public.notify_superadmin('capacity','Factory working schedule changed','Review the production calendar for availability and order conflicts.','/superadmin/time-off',null);
 return result;end $$;
revoke all on function public.save_calendar_schedule(integer[],text,integer)from public,anon;
grant execute on function public.save_calendar_schedule(integer[],text,integer)to authenticated;

create or replace function public.save_calendar_availability(p_ranges jsonb,p_reason text default '',p_id uuid default null,p_revision integer default null,p_remove boolean default false)returns jsonb
language plpgsql security definer set search_path=public as $$
declare factory public.manufacturer_profiles%rowtype;old public.manufacturer_availability%rowtype;r jsonb;first_date date;last_date date;result uuid;ids jsonb:='[]';changed boolean:=false;affected integer;
begin
 select m.*into factory from public.manufacturer_profiles m join public.profiles p on p.id=m.user_id where m.user_id=auth.uid()and p.role='manufacturer';
 if not found then raise exception 'Manufacturer access required';end if;
 if p_remove is null or p_reason is null or length(p_reason)>2000 then raise exception 'Invalid availability details';end if;
 perform pg_advisory_xact_lock(hashtextextended('calendar:'||auth.uid()::text,0));
 if p_id is not null then
  select *into old from public.manufacturer_availability where id=p_id and manufacturer_id=auth.uid()for update;
  if not found or old.revision is distinct from p_revision then raise exception 'Availability changed or inaccessible; refresh before saving';end if;
  if old.status='withdrawn'then raise exception 'This period was already removed';end if;
  if p_remove then
   update public.manufacturer_availability set status='withdrawn',updated_at=now(),revision=revision+1,history=history||jsonb_build_array(to_jsonb(old)-'history')where id=p_id;changed:=true;ids:=jsonb_build_array(p_id);
  end if;
 elsif p_remove then raise exception 'Select an existing period';end if;
 if not p_remove then
  if jsonb_typeof(p_ranges)is distinct from 'array'or jsonb_array_length(p_ranges)not between 1 and 366 or(p_id is not null and jsonb_array_length(p_ranges)<>1)then raise exception 'Select valid dates or a range';end if;
  for r in select value from jsonb_array_elements(p_ranges)loop
   first_date:=(r->>'start')::date;last_date:=(r->>'end')::date;
   if first_date is null or last_date is null or last_date<first_date or last_date>first_date+365 or(last_date<(now()at time zone factory.calendar_timezone)::date and p_id is null)then raise exception 'Choose a valid current or future range of at most 366 days';end if;
   if p_id is not null then
    result:=p_id;
    if old.starts_on is distinct from first_date or old.ends_on is distinct from last_date or old.reason is distinct from btrim(p_reason)or old.status<>'approved'then
     update public.manufacturer_availability set starts_on=first_date,ends_on=last_date,reason=btrim(p_reason),status='approved',updated_at=now(),revision=revision+1,timezone=factory.calendar_timezone,history=history||jsonb_build_array(to_jsonb(old)-'history')where id=p_id;changed:=true;
    end if;
   else
    select id into result from public.manufacturer_availability where manufacturer_id=auth.uid()and starts_on=first_date and ends_on=last_date and reason=btrim(p_reason)and status='approved'limit 1;
    if not found then insert into public.manufacturer_availability(manufacturer_id,kind,starts_on,ends_on,reason,status,created_by,timezone)values(auth.uid(),'time_off',first_date,last_date,btrim(p_reason),'approved',auth.uid(),factory.calendar_timezone)returning id into result;changed:=true;end if;
   end if;
   ids:=ids||jsonb_build_array(result);
  end loop;
 end if;
 select count(*)into affected from public.calendar_order_facts(auth.uid())o where exists(select 1 from public.manufacturer_availability a where a.id in(select value::text::uuid from jsonb_array_elements_text(ids))and a.status='approved'and(o.due_on between a.starts_on and a.ends_on or(o.starts_on is not null and o.due_on is not null and daterange(o.starts_on,greatest(o.starts_on,o.due_on),'[]')&&daterange(a.starts_on,a.ends_on,'[]'))));
 if changed then perform public.notify_superadmin('capacity',case when p_remove then 'Factory unavailable dates removed'else 'Factory unavailable dates changed'end,factory.factory_name||': '||affected||' active order conflicts. '||coalesce(p_reason,''),'/superadmin/time-off',null);end if;
 return jsonb_build_object('ids',ids,'conflicts',affected,'changed',changed);
end $$;
revoke all on function public.save_calendar_availability(jsonb,text,uuid,integer,boolean)from public,anon;
grant execute on function public.save_calendar_availability(jsonb,text,uuid,integer,boolean)to authenticated;

-- Keep callers of the old interface compatible with immediate self-managed closures.
create or replace function public.request_factory_availability(p_kind text,p_start date,p_end date,p_reason text)returns uuid language plpgsql security definer set search_path=public as $$declare r jsonb;begin
 if p_kind not in('time_off','capacity_block')then raise exception 'Invalid availability type';end if;
 r:=public.save_calendar_availability(jsonb_build_array(jsonb_build_object('start',p_start,'end',p_end)),coalesce(p_reason,''));return(r->'ids'->>0)::uuid;end $$;
create or replace function public.withdraw_factory_availability(p_id uuid)returns uuid language plpgsql security definer set search_path=public as $$declare v integer;begin select revision into v from public.manufacturer_availability where id=p_id and manufacturer_id=auth.uid();perform public.save_calendar_availability('[]','',p_id,v,true);return p_id;end $$;
-- A quotation due date is not a confirmed production window: closure conflicts must not reject quote assignment.
do $$declare d text;begin select pg_get_functiondef('public.check_factory_assignment(uuid,uuid,date)'::regprocedure)into d;
 d:=replace(d,'if exists(select 1 from public.manufacturer_availability where manufacturer_id=p_factory and status=''approved''and(current_date between starts_on and ends_on or p_due between starts_on and ends_on))then raise exception ''Factory is unavailable during this assignment window'';end if; ','');execute d;end $$;

create or replace function public.production_calendar(p_start date,p_end date,p_admin boolean default false,p_factory uuid default null,p_garment text default '',p_country text default '',p_availability text default 'all',p_workload text default 'all',p_status text default 'all')returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;owner uuid;thresholds jsonb;v_busy numeric;full_at numeric;warning numeric;critical numeric;
begin
 if auth.uid()is null or p_admin is null or(p_admin and not public.is_superadmin())or(not p_admin and not exists(select 1 from public.profiles where id=auth.uid()and role='manufacturer'))then raise exception 'Calendar access denied';end if;
 if p_start is null or p_end is null or p_end<p_start or p_end>p_start+61 or p_garment is null or p_country is null or length(p_garment)>100 or length(p_country)>100 or p_availability is null or p_availability not in('all','unavailable','working','unknown')or p_workload is null or p_workload not in('all','available','busy','full','unknown')or p_status is null or p_status not in('all','not_updated','preparation','cutting','sewing','finishing','quality_control')then raise exception 'Invalid calendar range or filter';end if;
 if not p_admin and p_factory is not null and p_factory<>auth.uid()then raise exception 'Calendar access denied';end if;
 owner:=case when p_admin then p_factory else auth.uid()end;
 select value into thresholds from public.platform_settings where key='calendar_thresholds';
 v_busy:=(thresholds->>'busy')::numeric;full_at:=(thresholds->>'full')::numeric;warning:=(thresholds->>'warning')::numeric;critical:=(thresholds->>'critical')::numeric;
 if v_busy is null or v_busy<=0 or full_at<=v_busy or full_at>100 or warning<=0 or critical<=warning or critical>100 then raise exception 'Calendar thresholds are invalid; ask a super admin to configure them';end if;
 with factories as materialized(select m.user_id id,m.factory_name name,m.garments,m.country,m.monthly_capacity capacity,m.calendar_workdays workdays,m.calendar_timezone timezone,m.calendar_revision revision
 from public.manufacturer_profiles m where(owner is null or m.user_id=owner)and(not p_admin or(m.onboarding_complete and m.status is distinct from 'paused'))and(p_garment=''or exists(select 1 from unnest(m.garments)g where public.calendar_garment_key(g)=public.calendar_garment_key(p_garment)))and(p_country=''or m.country=p_country)),
 facts as materialized(select o.*from public.calendar_order_facts(owner)o join factories f on f.id=o.manufacturer_id where(p_garment=''or public.calendar_garment_key(o.garment)=public.calendar_garment_key(p_garment))and(p_status='all'or o.stage=p_status)),
 blocks as materialized(select a.*from public.manufacturer_availability a join factories f on f.id=a.manufacturer_id where a.status in('approved','pending')and a.starts_on<=p_end and a.ends_on>=p_start),
 months as(select d::date month_start from generate_series(date_trunc('month',p_start::timestamp),date_trunc('month',p_end::timestamp),interval '1 month')d),
 load as materialized(select f.id,m.month_start,wd.nominal,wd.available,wd.blocked,dem.units,dem.unknown_units,dem.unscheduled,
 case when f.workdays is not null and f.capacity>0 and wd.nominal>0 then f.capacity*wd.available/wd.nominal end capacity,
 case when f.workdays is not null and f.capacity>0 and wd.available>0 and dem.unknown_units=0 then round(100*dem.units/(f.capacity*wd.available/wd.nominal),1)end utilisation
 from factories f cross join months m
 cross join lateral(select count(*)filter(where extract(isodow from d)::integer=any(f.workdays))::numeric nominal,
 count(*)filter(where extract(isodow from d)::integer=any(f.workdays)and not exists(select 1 from public.manufacturer_availability a where a.manufacturer_id=f.id and a.status='approved'and d::date between a.starts_on and a.ends_on))::numeric available,
 count(*)filter(where exists(select 1 from public.manufacturer_availability a where a.manufacturer_id=f.id and a.status='approved'and d::date between a.starts_on and a.ends_on))blocked
 from generate_series(m.month_start::timestamp,(m.month_start+interval '1 month'-interval '1 day')::timestamp,interval '1 day')d)wd
 cross join lateral(select coalesce(sum(o.quantity)filter(where o.due_on>=m.month_start and o.due_on<m.month_start+interval '1 month'and o.effort_active),0)units,
 count(*)filter(where o.due_on>=m.month_start and o.due_on<m.month_start+interval '1 month'and o.quantity is null and o.effort_active)unknown_units,
 count(*)filter(where o.due_on is null and o.effort_active)unscheduled from facts o where o.manufacturer_id=f.id)dem),
 summary as materialized(select f.*,l.month_start,l.capacity adjusted_capacity,l.units,l.unscheduled,l.unknown_units,l.blocked,l.utilisation,
 case when l.capacity=0 and l.units>0 then 'full'when l.utilisation>=full_at then 'full'when l.utilisation>=v_busy then 'busy'when l.utilisation is not null and l.unscheduled=0 then 'available'else 'unknown'end workload,
 case when exists(select 1 from blocks a where a.manufacturer_id=f.id and a.status='approved')then 'unavailable'when f.workdays is null then 'unknown'else 'working'end availability,
 (select count(*)from facts o where o.manufacturer_id=f.id)active_orders,
 (select count(*)from facts o where o.manufacturer_id=f.id and o.due_on between p_start and p_end)deadlines
 from factories f join load l on l.id=f.id),
 selected as materialized(select distinct id from summary where(p_availability='all'or availability=p_availability)and(p_workload='all'or workload=p_workload)),
 visible_orders as materialized(select o.*,
 exists(select 1 from public.manufacturer_availability a where a.manufacturer_id=o.manufacturer_id and a.status='approved'and(o.due_on between a.starts_on and a.ends_on or(o.starts_on is not null and o.due_on is not null and daterange(o.starts_on,greatest(o.starts_on,o.due_on),'[]')&&daterange(a.starts_on,a.ends_on,'[]'))))or coalesce(length(btrim(o.delay_reason))>0,false)or o.due_on<current_date as at_risk
 from facts o join selected s on s.id=o.manufacturer_id where o.due_on is null or(o.due_on<current_date and o.effort_active)or o.due_on between p_start and p_end or(o.starts_on is not null and o.due_on is not null and daterange(o.starts_on,greatest(o.starts_on,o.due_on),'[]')&&daterange(p_start,p_end,'[]'))),
 daily as materialized(select d::date date_key,f.id,f.garments,f.capacity baseline_capacity,l.utilisation,
 (exists(select 1 from blocks a where a.manufacturer_id=f.id and a.status='approved'and d::date between a.starts_on and a.ends_on)or(f.workdays is not null and not(extract(isodow from d)::integer=any(f.workdays))))unavailable,
 (f.workdays is null)unknown_schedule,l.capacity,l.units,
 (exists(select 1 from blocks a where a.manufacturer_id=f.id and a.status='approved'and d::date between a.starts_on and a.ends_on))closure,
 (l.utilisation>=v_busy)busy,(l.utilisation>=full_at or(l.capacity=0 and l.units>0))fully_booked
 from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day')d cross join factories f join selected s on s.id=f.id join load l on l.id=f.id and l.month_start=date_trunc('month',d)::date),
 days as(select date_key,count(*)total,count(*)filter(where unavailable)unavailable,count(*)filter(where not unavailable and not unknown_schedule)working,count(*)filter(where unknown_schedule and not unavailable)unknown,
 count(*)filter(where busy)busy,count(*)filter(where fully_booked)fully_booked,
 case when count(*)filter(where capacity is null)=0 and sum(capacity)>0 then round(100*sum(units)/sum(capacity),1)end utilisation
 from daily group by date_key),
 category_days as(select distinct d.date_key,d.id,public.calendar_garment_key(g)garment,d.closure,d.baseline_capacity from daily d cross join lateral unnest(garments)g),
 categories as(select date_key,garment,count(*)total,count(*)filter(where closure)unavailable,
 case when count(*)filter(where baseline_capacity<=0)=0 and sum(baseline_capacity)>0 then round(100*coalesce(sum(baseline_capacity)filter(where closure),0)/sum(baseline_capacity),1)end capacity_loss
 from category_days group by date_key,garment),
 risks as(select *,case when unavailable=total or capacity_loss>=critical then 'critical'else 'warning'end level from categories where unavailable>0 and(100.0*unavailable/total>=warning or capacity_loss>=warning))
 select jsonb_build_object('start',p_start,'end',p_end,'thresholds',thresholds,
 'factories',coalesce((select jsonb_agg(to_jsonb(s)order by s.name,s.month_start)from summary s join selected x on x.id=s.id),'[]'),
 'filterOptions',jsonb_build_object('factories',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',m.factory_name)order by m.factory_name)from public.manufacturer_profiles m where(p_admin and m.onboarding_complete and m.status is distinct from 'paused')or m.user_id=auth.uid()),'[]'),'garments',coalesce((select jsonb_agg(g)from(select distinct unnest(m.garments)g from public.manufacturer_profiles m where p_admin or m.user_id=auth.uid())z),'[]'),'countries',coalesce((select jsonb_agg(c)from(select distinct country c from public.manufacturer_profiles m where p_admin or m.user_id=auth.uid())z),'[]')),
 'stats',jsonb_build_object('active',(select count(*)from facts o join selected x on x.id=o.manufacturer_id),'deadlines',(select count(*)from visible_orders where due_on between p_start and p_end),'upcoming',(select count(*)from visible_orders where due_on between current_date and p_end),'atRisk',(select count(*)from visible_orders where at_risk),'unscheduled',(select count(*)from visible_orders where due_on is null)),
 'orders',coalesce((select jsonb_agg(to_jsonb(o)order by o.due_on nulls last,o.id)from(select *from visible_orders order by due_on nulls last,id limit 300)o),'[]'),'orderCount',(select count(*)from visible_orders),
 'blocks',coalesce((select jsonb_agg((to_jsonb(a)-'history'-'feedback'-'reviewed_by')||jsonb_build_object('conflicts',coalesce((select jsonb_agg(o.id)from visible_orders o where o.manufacturer_id=a.manufacturer_id and(o.due_on between a.starts_on and a.ends_on or(o.starts_on is not null and o.due_on is not null and daterange(o.starts_on,greatest(o.starts_on,o.due_on),'[]')&&daterange(a.starts_on,a.ends_on,'[]')))),'[]'))order by a.starts_on)from blocks a join selected x on x.id=a.manufacturer_id),'[]'),
 'days',coalesce((select jsonb_agg(to_jsonb(d)||jsonb_build_object('production',(select count(*)from visible_orders o where o.due_on=d.date_key or(o.starts_on is not null and o.due_on is not null and d.date_key between o.starts_on and o.due_on)),'deadlines',(select count(*)from visible_orders o where o.due_on=d.date_key))order by date_key)from days d),'[]'),
 'risks',coalesce((select jsonb_agg(to_jsonb(r)order by date_key,garment)from risks r),'[]'))into result;
 return result;
end $$;
revoke all on function public.production_calendar(date,date,boolean,uuid,text,text,text,text,text)from public,anon;
grant execute on function public.production_calendar(date,date,boolean,uuid,text,text,text,text,text)to authenticated;
create or replace function public.manufacturer_calendar_signals()returns jsonb language plpgsql stable security definer set search_path=public as $$declare report jsonb;result jsonb;begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 report:=public.production_calendar(date_trunc('month',current_date)::date,(date_trunc('month',current_date)+interval '1 month'-interval '1 day')::date,true);
 select coalesce(jsonb_agg(jsonb_build_object('id',f->>'id','scheduleKnown',f->'workdays'<>'null'::jsonb,'workload',f->>'workload','utilisation',f->'utilisation','unscheduled',f->'unscheduled','closures',coalesce((select jsonb_agg(jsonb_build_object('start',a.starts_on,'end',a.ends_on)order by a.starts_on)from public.manufacturer_availability a where a.manufacturer_id=(f->>'id')::uuid and a.status='approved'and a.ends_on>=current_date and a.starts_on<=current_date+365),'[]'))),'[]')into result from jsonb_array_elements(report->'factories')f;
 return result;end $$;
revoke all on function public.manufacturer_calendar_signals()from public,anon;
grant execute on function public.manufacturer_calendar_signals()to authenticated;
notify pgrst,'reload schema';
commit;
