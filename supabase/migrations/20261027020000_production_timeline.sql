begin;
select pg_advisory_xact_lock(7271027002);
create table if not exists public.manufacturer_production_timelines(
 manufacturer_id uuid primary key references public.manufacturer_profiles(user_id)on delete cascade,
 config jsonb not null,revision integer not null default 1,updated_at timestamptz not null default now(),updated_by uuid references public.profiles(id)on delete set null);
create table if not exists public.order_production_timelines(
 order_id uuid not null references public.orders(id)on delete cascade,manufacturer_id uuid not null references public.manufacturer_profiles(user_id)on delete cascade,
 config jsonb not null,template_revision integer not null default 0,facts jsonb not null default '{}',blocks jsonb not null default '[]',
 stage_started_at timestamptz not null,revision integer not null default 1,estimated_stage text,expected_completion timestamptz,
 schedule jsonb not null default '[]',uncertain boolean not null default false,override_completion timestamptz,
 updated_at timestamptz not null default now(),legacy_delay text,automation_paused boolean not null default false,primary key(order_id,manufacturer_id),check(jsonb_typeof(config)='object'and jsonb_typeof(facts)='object'and jsonb_typeof(blocks)='array'));
alter table public.order_production_timelines add column if not exists legacy_delay text;
alter table public.order_production_timelines add column if not exists automation_paused boolean not null default false;
create index if not exists production_timeline_due_idx on public.order_production_timelines(expected_completion)where not uncertain;
create index if not exists production_timeline_factory_idx on public.order_production_timelines(manufacturer_id,updated_at desc);
create table if not exists public.production_timeline_events(
 id uuid primary key default gen_random_uuid(),order_id uuid not null,manufacturer_id uuid not null,
 actor_id uuid references public.profiles(id)on delete set null,kind text not null check(kind in('manual','automatic','schedule','block','resume','undo','rules')),
 explanation text not null,details jsonb not null default '{}',request_id uuid,request_hash text,dedupe text,created_at timestamptz not null default now(),
 foreign key(order_id,manufacturer_id)references public.order_production_timelines(order_id,manufacturer_id)on delete cascade,
 unique(order_id,manufacturer_id,request_id),unique(order_id,manufacturer_id,dedupe));
create index if not exists production_timeline_history_idx on public.production_timeline_events(order_id,manufacturer_id,created_at desc);
create or replace function public.production_stages()returns text[]language sql immutable set search_path=public as $$select array['preparation','cutting','sewing','finishing','quality_control']$$;
create or replace function public.production_default_timeline(p_factory uuid)returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('timezone',m.calendar_timezone,'workdays',to_jsonb(coalesce(m.calendar_workdays,array[1,2,3,4,5])),'workStart','09:00','workEnd','17:00','startEvent','production_approval','factors','[]'::jsonb,
 'stages',(select jsonb_agg(jsonb_build_object('id',s,'duration',greatest(1,round(coalesce(m.typical_lead_days,10)*case s when 'preparation'then .1 when 'cutting'then .2 when 'sewing'then .4 when 'finishing'then .2 else .1 end)),'unit','working_days','starts',case when s='preparation'then 'production_approval'else 'previous_stage'end,'automatic',false)order by n)from unnest(public.production_stages())with ordinality x(s,n)))from manufacturer_profiles m where user_id=p_factory
$$;
revoke all on function public.production_default_timeline(uuid)from public,anon,authenticated;
create or replace function public.production_validate_timeline(c jsonb)returns void language plpgsql stable set search_path=public as $$
declare s jsonb;r jsonb;ids text[];begin
 if c is null or jsonb_typeof(c)<>'object'or length(c::text)>30000 then raise exception 'Invalid production timeline';end if;
 if not exists(select 1 from pg_timezone_names where name=c->>'timezone')then raise exception 'Choose a valid timezone';end if;
 if coalesce(c->>'workStart','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$'or coalesce(c->>'workEnd','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$'or(c->>'workEnd')::time<=(c->>'workStart')::time then raise exception 'Choose a daytime working shift (start before end)';end if;
 if jsonb_typeof(c->'workdays')is distinct from 'array'or jsonb_array_length(c->'workdays')not between 1 and 7 then raise exception 'Select working weekdays';end if;
 if exists(select 1 from jsonb_array_elements_text(c->'workdays')d where d!~'^[1-7]$')or(select count(distinct value)from jsonb_array_elements_text(c->'workdays'))<>jsonb_array_length(c->'workdays')then raise exception 'Choose distinct weekdays (Monday–Sunday)';end if;
 if coalesce(c->>'startEvent','')not in('production_approval','materials')then raise exception 'Choose a scheduling start event';end if;
 if jsonb_typeof(c->'stages')is distinct from 'array'or jsonb_array_length(c->'stages')<>5 then raise exception 'Configure all five existing production stages';end if;
 select array_agg(value->>'id'order by ordinality)into ids from jsonb_array_elements(c->'stages')with ordinality;
 if ids is distinct from public.production_stages()then raise exception 'Use the existing stages in order';end if;
 for s in select value from jsonb_array_elements(c->'stages')loop
 if coalesce(s->>'duration','')!~'^[0-9]+(\.[0-9]{1,2})?$'or(s->>'duration')::numeric not between .01 and 3650 or coalesce(s->>'unit','')not in('working_days','calendar_days','hours','working_hours')or coalesce(s->>'starts','')not in('production_approval','previous_stage','previous_estimate','materials','sample_approval','customer_approval')or jsonb_typeof(s->'automatic')is distinct from 'boolean'then raise exception 'Choose a duration, unit, start condition and confirmation mode for each stage';end if;
 end loop;
 if jsonb_typeof(c->'factors')is distinct from 'array'or jsonb_array_length(c->'factors')>20 then raise exception 'Use at most 20 timing factors';end if;
 for r in select value from jsonb_array_elements(c->'factors')loop
 if coalesce(r->>'id','')=''or coalesce(r->>'factor','')not in('quantity','complexity','materials','sample_approval','customer_approval','quality_checks','capacity')or not(r->>'stage'=any(public.production_stages()))or coalesce(r->>'effect','')not in('add_time','pause','confirm')or coalesce(r->>'op','')not in('eq','gte')or not(r?'value')then raise exception 'Complete each structured timing rule';end if;
 if r->>'factor'in('quantity','capacity')and(coalesce(r->>'value','')!~'^[0-9]+(\.[0-9]{1,2})?$'or(r->>'value')::numeric>1000000000)then raise exception 'Quantity/capacity rules require a numeric threshold';end if;
 if r->>'factor'in('materials','sample_approval','customer_approval','quality_checks')and(jsonb_typeof(r->'value')<>'boolean'or r->>'op'<>'eq')then raise exception 'Approval/material rules require Yes/No conditions';end if;
 if r->>'factor'='complexity'and(coalesce(r->>'value','')not in('simple','standard','complex')or r->>'op'<>'eq')then raise exception 'Choose a complexity level';end if;
 if r->>'effect'='add_time'and(coalesce(r->>'duration','')!~'^[0-9]+(\.[0-9]{1,2})?$'or(r->>'duration')::numeric not between .01 and 3650 or coalesce(r->>'unit','')not in('working_days','calendar_days','hours','working_hours'))then raise exception 'Time additions need a positive duration and unit';end if;
 if length(coalesce(r->>'notes',''))>1000 then raise exception 'Keep exception notes under 1,000 characters';end if;
 end loop;
 if(select count(distinct value->>'id')from jsonb_array_elements(c->'factors'))<>jsonb_array_length(c->'factors')then raise exception 'Timing rule identifiers must be unique';end if;
end$$;
revoke all on function public.production_validate_timeline(jsonb)from public,anon,authenticated;
-- Local-day shifts respect DST. Calendar days keep local wall-clock time; hours use elapsed time.
-- Working units skip weekends/closures. Explicit order blockers pause every unit type.
create or replace function public.production_add_time(p_factory uuid,c jsonb,p_start timestamptz,p_duration numeric,p_unit text,p_blocks jsonb default '[]')returns timestamptz language plpgsql stable security definer set search_path=public as $$
declare cur timestamptz:=p_start;remaining numeric;local_day date;opening timestamptz;closing timestamptz;boundary timestamptz;b jsonb;steps integer:=0;days integer[];begin
 if p_start is null then return null;end if;
 select array_agg(value::integer)into days from jsonb_array_elements_text(c->'workdays');
 remaining:=case p_unit when 'working_days'then p_duration*extract(epoch from((c->>'workEnd')::time-(c->>'workStart')::time))when 'calendar_days'then extract(epoch from((((p_start at time zone(c->>'timezone'))+p_duration*interval '1 day')at time zone(c->>'timezone'))-p_start))else p_duration*3600 end;
 while remaining>.001 loop
 steps:=steps+1;if steps>20000 then raise exception 'Timeline exceeds the supported scheduling horizon';end if;
 if p_unit in('working_days','working_hours')then
 local_day:=(cur at time zone(c->>'timezone'))::date;
 if not(extract(isodow from local_day)::integer=any(days))or exists(select 1 from manufacturer_availability where manufacturer_id=p_factory and status='approved'and local_day between starts_on and ends_on)then cur:=((local_day+1)+(c->>'workStart')::time)at time zone(c->>'timezone');continue;end if;
 opening:=(local_day+(c->>'workStart')::time)at time zone(c->>'timezone');closing:=(local_day+(c->>'workEnd')::time)at time zone(c->>'timezone');cur:=greatest(cur,opening);
 if cur>=closing then cur:=((local_day+1)+(c->>'workStart')::time)at time zone(c->>'timezone');continue;end if;
 else closing:=cur+remaining*interval '1 second';end if;
 select value into b from jsonb_array_elements(p_blocks)where(value->>'start')::timestamptz<=cur and(coalesce((value->>'end')::timestamptz,'infinity')>cur)order by(value->>'start')::timestamptz limit 1;
 if b is not null then if b->>'end'is null then return null;end if;cur:=(b->>'end')::timestamptz;continue;end if;
 select min((value->>'start')::timestamptz)into boundary from jsonb_array_elements(p_blocks)where(value->>'start')::timestamptz>cur and(value->>'start')::timestamptz<closing;
 closing:=least(closing,coalesce(boundary,closing));
 if remaining<=extract(epoch from(closing-cur))then return cur+remaining*interval '1 second';end if;
 remaining:=remaining-extract(epoch from(closing-cur));cur:=closing;
 end loop;return cur;end$$;
revoke all on function public.production_add_time(uuid,jsonb,timestamptz,numeric,text,jsonb)from public,anon,authenticated;
create or replace function public.production_fact_values(p_order uuid,p_factory uuid,p_facts jsonb)returns jsonb language sql stable security definer set search_path=public as $$
 with active as(select case when coalesce(opt.value->>'totalUnits','')~'^[1-9][0-9]*$'then(opt.value->>'totalUnits')::numeric end units from orders x left join lateral(select value from jsonb_array_elements(coalesce(x.price_options,'[]'))where value->>'id'=x.selected_price_option_id limit 1)opt on true where x.assigned_manufacturer_id=p_factory and x.status='processing'and x.production_released_at is not null and x.factory_status='in_production'and coalesce(x.qc_status,'not_submitted')<>'approved')
 select p_facts||jsonb_build_object('quantity',case when coalesce(selected.value->>'totalUnits','')~'^[1-9][0-9]*$'then(selected.value->>'totalUnits')::numeric end,'capacity',case when m.monthly_capacity>0 and not exists(select 1 from active where units is null)then(select round(100*sum(units)/m.monthly_capacity,2)from active)end)from orders o join manufacturer_profiles m on m.user_id=p_factory left join lateral(select value from jsonb_array_elements(coalesce(o.price_options,'[]'))where value->>'id'=o.selected_price_option_id limit 1)selected on true where o.id=p_order
$$;
revoke all on function public.production_fact_values(uuid,uuid,jsonb)from public,anon,authenticated;
create or replace function public.production_schedule(p_factory uuid,c jsonb,p_start timestamptz,p_stage text,p_facts jsonb,p_blocks jsonb)returns jsonb language plpgsql stable security definer set search_path=public as $$
declare s jsonb;r jsonb;cursor_at timestamptz:=p_start;ends_at timestamptz;result jsonb:='[]';reason text;v jsonb;matches boolean;blocked boolean;begin
 for s in select value from jsonb_array_elements(c->'stages')with ordinality where ordinality>=coalesce(array_position(public.production_stages(),p_stage),1)order by ordinality loop
 reason:=null;blocked:=false;
 if(c->>'startEvent'='materials'or s->>'starts'='materials')and p_facts->'materials'is distinct from 'true'::jsonb then reason:='Confirm material availability';blocked:=true;end if;
 if s->>'starts'in('sample_approval','customer_approval')and p_facts->(s->>'starts')is distinct from 'true'::jsonb then reason:='Confirm '||replace(s->>'starts','_',' ');blocked:=true;end if;
 if cursor_at is not null then
 if(c->>'startEvent'='materials'or s->>'starts'='materials')and p_facts->'materials'='true'::jsonb then cursor_at:=greatest(cursor_at,(p_facts->>'_materialsAt')::timestamptz);end if;
 if s->>'starts'in('sample_approval','customer_approval')then cursor_at:=greatest(cursor_at,(p_facts->>('_'||(s->>'starts')||'At'))::timestamptz);end if;end if;
 ends_at:=public.production_add_time(p_factory,c,cursor_at,(s->>'duration')::numeric,s->>'unit',p_blocks);
 for r in select value from jsonb_array_elements(c->'factors')where value->>'stage'=s->>'id'loop
 v:=p_facts->(r->>'factor');matches:=false;
 if v is null or v='null'::jsonb then reason:='Confirm '||replace(r->>'factor','_',' ');blocked:=true;
 else matches:=case when r->>'op'='gte'then(v#>>'{}')::numeric>=(r->>'value')::numeric else v=r->'value'end;end if;
 if matches then
 if r->>'effect'='add_time'then ends_at:=public.production_add_time(p_factory,c,ends_at,(r->>'duration')::numeric,r->>'unit',p_blocks);
 elsif r->>'effect'='pause'then reason:='Resolve '||replace(r->>'factor','_',' ');blocked:=true;
 elsif coalesce(p_facts->'confirmedRules','[]') ? (r->>'id')is not true then reason:='Confirm timing rule: '||replace(r->>'factor','_',' ');blocked:=true;end if;end if;
 end loop;
 if blocked then ends_at:=null;end if;
 if exists(select 1 from jsonb_array_elements(p_blocks)b where b->>'end'is null or(b->>'resolved'is distinct from 'true'and(b->>'end')::timestamptz<=now()))then ends_at:=null;reason:=coalesce(reason,'Production is blocked; completion is uncertain');blocked:=true;end if;
 result:=result||jsonb_build_array(jsonb_build_object('stage',s->>'id','start',cursor_at,'end',ends_at,'automatic',s->'automatic','starts',s->>'starts','duration',s->'duration','unit',s->>'unit','blocked',blocked,'reason',reason,'ready',ends_at is not null and ends_at<=now()));cursor_at:=ends_at;
 end loop;return result;end$$;
revoke all on function public.production_schedule(uuid,jsonb,timestamptz,text,jsonb,jsonb)from public,anon,authenticated;
create or replace function public.production_ensure_plan(p_order uuid)returns void language plpgsql security definer set search_path=public as $$
declare o orders%rowtype;c jsonb;rev integer;started timestamptz;legacy_expected date;legacy_reason text;begin
 select *into o from orders where id=p_order for update;
 if o.kind<>'production'or o.status<>'processing'or o.production_released_at is null or o.assigned_manufacturer_id is null or o.factory_status<>'in_production'then return;end if;
 select config,revision into c,rev from manufacturer_production_timelines where manufacturer_id=o.assigned_manufacturer_id;
 c:=coalesce(c,public.production_default_timeline(o.assigned_manufacturer_id));
 select created_at,expected_completion,delay_reason into started,legacy_expected,legacy_reason from order_production_updates where order_id=p_order and manufacturer_id=o.assigned_manufacturer_id order by version desc limit 1;
 insert into order_production_timelines(order_id,manufacturer_id,config,template_revision,stage_started_at,override_completion,legacy_delay)values(p_order,o.assigned_manufacturer_id,c,coalesce(rev,0),coalesce(started,o.production_released_at),case when legacy_expected is not null then(legacy_expected+(c->>'workEnd')::time)at time zone(c->>'timezone')end,nullif(legacy_reason,''))on conflict do nothing;
end$$;
revoke all on function public.production_ensure_plan(uuid)from public,anon,authenticated;
create or replace function public.production_refresh(p_order uuid,p_factory uuid)returns void language plpgsql security definer set search_path=public as $$
declare p order_production_timelines%rowtype;s jsonb;stage text;due timestamptz;begin
 select *into p from order_production_timelines where order_id=p_order and manufacturer_id=p_factory for update;
 if not found then return;end if;
 select u.stage into stage from order_production_updates u where order_id=p_order and manufacturer_id=p_factory order by version desc limit 1;stage:=coalesce(stage,'preparation');
 s:=public.production_schedule(p_factory,p.config,p.stage_started_at,stage,public.production_fact_values(p_order,p_factory,p.facts),p.blocks);
 due:=(s->-1->>'end')::timestamptz;
 update order_production_timelines set estimated_stage=case when not coalesce((s->0->>'ready')::boolean,false)or coalesce((s->0->>'blocked')::boolean,false)then null else estimated_stage end,schedule=s,expected_completion=case when due is null then null else coalesce(p.override_completion,due)end,uncertain=due is null where order_id=p_order and manufacturer_id=p_factory and(schedule,expected_completion,uncertain)is distinct from(s,case when due is null then null else coalesce(p.override_completion,due)end,due is null);
 due:=case when due is null then null else coalesce(p.override_completion,due)end;
 if jsonb_array_length(p.schedule)>0 and current_setting('app.production_action',true)is distinct from p_order::text and(((p.expected_completion is null)<>(due is null))or abs(extract(epoch from(due-p.expected_completion)))>=86400)then
 insert into production_timeline_events(order_id,manufacturer_id,kind,explanation,details,dedupe)values(p_order,p_factory,'schedule','Expected completion changed using saved working hours and factory closures',jsonb_build_object('previous',p.expected_completion,'revised',due),'recalculation:'||encode(sha256(convert_to(coalesce(p.expected_completion::text,'unknown')||'>'||coalesce(due::text,'unknown'),'UTF8')),'hex'))on conflict do nothing;
 if found then
 perform public.notify_superadmin('order','Production completion estimate changed','Working calendar or scheduling prerequisites changed. Review the saved production timeline.','/superadmin/orders/'||p_order,p_order);
 insert into brand_notifications(user_id,category,title,body,href)select user_id,'order','Production schedule update','Your order completion estimate has changed. Ceriga is reviewing the production timeline.','/orders/'||p_order from orders where id=p_order;
 end if;end if;
end$$;
revoke all on function public.production_refresh(uuid,uuid)from public,anon,authenticated;
create or replace function public.production_release_plan()returns trigger language plpgsql security definer set search_path=public as $$begin perform public.production_ensure_plan(new.id);if new.assigned_manufacturer_id is not null then perform public.production_refresh(new.id,new.assigned_manufacturer_id);end if;return new;end$$;
revoke all on function public.production_release_plan()from public,anon,authenticated;
drop trigger if exists production_release_plan on public.orders;
create trigger production_release_plan after insert or update of production_released_at,assigned_manufacturer_id,status,factory_status on public.orders for each row execute function public.production_release_plan();
do $$declare o record;begin for o in select id from orders where kind='production'and status='processing'and production_released_at is not null and assigned_manufacturer_id is not null and factory_status='in_production'loop perform public.production_ensure_plan(o.id);end loop;end$$;
-- Preserve pre-existing date-only manual estimates when adopting the new schedule projection.
do $$declare row record;begin
 for row in select t.order_id,t.manufacturer_id,t.revision,u.expected_completion,u.delay_reason from order_production_timelines t join lateral(select expected_completion,delay_reason from order_production_updates where order_id=t.order_id and manufacturer_id=t.manufacturer_id order by version desc limit 1)u on true where t.template_revision=0 and t.override_completion is null and u.expected_completion is not null and not exists(select 1 from production_timeline_events e where e.order_id=t.order_id and e.manufacturer_id=t.manufacturer_id)loop
 update order_production_timelines set override_completion=(row.expected_completion+(config->>'workEnd')::time)at time zone(config->>'timezone'),legacy_delay=nullif(row.delay_reason,'')where order_id=row.order_id and manufacturer_id=row.manufacturer_id and revision=row.revision;
 perform set_config('app.production_action',row.order_id::text,true);perform public.production_refresh(row.order_id,row.manufacturer_id);
 end loop;end$$;
-- Migration-only Super Admin full access plus ordinary assigned-factory isolation.
do $$declare d text;t text;begin
 select pg_get_functiondef('public.apply_superadmin_access()'::regprocedure)into d;
 if position('''manufacturer_production_timelines'''in d)=0 then d:=replace(d,'''projects''','''manufacturer_production_timelines'',''order_production_timelines'',''production_timeline_events'',''projects''');execute d;end if;
 foreach t in array array['manufacturer_production_timelines','order_production_timelines','production_timeline_events']loop execute format('alter table public.%I enable row level security',t);execute format('grant select,insert,update,delete on public.%I to authenticated',t);end loop;perform public.apply_superadmin_access();end$$;
drop policy if exists production_template_read on public.manufacturer_production_timelines;
create policy production_template_read on public.manufacturer_production_timelines for select to authenticated using(manufacturer_id=public.current_factory_id()and(public.factory_has_permission(manufacturer_id,'settings')or public.factory_has_permission(manufacturer_id,'production')));
drop policy if exists production_plan_read on public.order_production_timelines;
create policy production_plan_read on public.order_production_timelines for select to authenticated using(manufacturer_id=public.current_factory_id()and public.factory_order_visible(order_id));
drop policy if exists production_event_read on public.production_timeline_events;
create policy production_event_read on public.production_timeline_events for select to authenticated using(manufacturer_id=public.current_factory_id()and public.factory_order_visible(order_id));
create or replace function public.production_calendar_defaults_sync()returns trigger language plpgsql security definer set search_path=public as $$begin
 if(new.calendar_workdays,new.calendar_timezone)is not distinct from(old.calendar_workdays,old.calendar_timezone)then return new;end if;
 if exists(select 1 from manufacturer_production_timelines where manufacturer_id=new.user_id)then
 if new.calendar_workdays is null then raise exception 'Keep a confirmed working week while a production timeline is configured. Edit its weekdays in the calendar or turnaround settings';end if;
 update manufacturer_production_timelines set config=config||jsonb_build_object('workdays',to_jsonb(new.calendar_workdays),'timezone',new.calendar_timezone),revision=revision+1,updated_at=now(),updated_by=public.team_actor()where manufacturer_id=new.user_id and(config->'workdays',config->>'timezone')is distinct from(to_jsonb(new.calendar_workdays),new.calendar_timezone);
 end if;return new;end$$;
revoke all on function public.production_calendar_defaults_sync()from public,anon,authenticated;
drop trigger if exists production_calendar_defaults_sync on public.manufacturer_profiles;
create trigger production_calendar_defaults_sync after update of calendar_workdays,calendar_timezone on public.manufacturer_profiles for each row execute function public.production_calendar_defaults_sync();
create or replace function public.production_template(p_config jsonb default null,p_revision integer default null,p_save boolean default false)returns jsonb language plpgsql security definer set search_path=public as $$
declare f uuid:=public.current_factory_id();c jsonb;rev integer;preview jsonb;begin
 if f is null or not(public.factory_has_permission(f,'production')or public.factory_has_permission(f,'settings'))then raise exception 'Production or factory settings permission required';end if;
 select config,revision into c,rev from manufacturer_production_timelines where manufacturer_id=f;
 if p_config is not null then
 if not public.factory_has_permission(f,'settings')then raise exception 'Factory settings permission required';end if;
 if p_config->>'manufacturerId'is not null and p_config->>'manufacturerId'<>f::text then raise exception 'Factory workspace changed. Reload this timeline before saving';end if;
 perform public.production_validate_timeline(p_config);c:=p_config;
 if p_save then
 perform pg_advisory_xact_lock(hashtextextended(f::text,17));
 perform 1 from manufacturer_profiles where user_id=f for update;
 if coalesce((select revision from manufacturer_production_timelines where manufacturer_id=f),0)is distinct from coalesce(p_revision,0)then raise exception 'Timeline changed on another device. Reload before saving';end if;
 insert into manufacturer_production_timelines(manufacturer_id,config,updated_by)values(f,c,public.team_actor())on conflict(manufacturer_id)do update set config=excluded.config,revision=manufacturer_production_timelines.revision+1,updated_at=now(),updated_by=excluded.updated_by returning revision into rev;
 update manufacturer_profiles set calendar_timezone=c->>'timezone',calendar_workdays=(select array_agg(value::integer)from jsonb_array_elements_text(c->'workdays'))where user_id=f;
 end if;end if;
 c:=coalesce(c,public.production_default_timeline(f))||jsonb_build_object('manufacturerId',f);
 preview:=public.production_schedule(f,c,now(),'preparation','{"materials":true,"sample_approval":true,"customer_approval":true,"quality_checks":true,"complexity":"standard","quantity":100,"capacity":50}','[]');
 return jsonb_build_object('config',c,'revision',coalesce(rev,0),'saved',coalesce(rev,0)>0,'preview',preview,'canEdit',public.factory_has_permission(f,'settings'));
end$$;
revoke all on function public.production_template(jsonb,integer,boolean)from public,anon;grant execute on function public.production_template(jsonb,integer,boolean)to authenticated;
create or replace function public.production_board(p_order uuid default null)returns jsonb language plpgsql security definer set search_path=public as $$
declare f uuid:=public.current_factory_id();o record;begin
 if f is null or not public.factory_has_permission(f,'production')then raise exception 'Production permission required';end if;
 for o in select x.id from orders x where(p_order is null or x.id=p_order)and x.assigned_manufacturer_id=f and x.status='processing'and x.production_released_at is not null and x.factory_status='in_production'and public.factory_order_visible(x.id)order by x.id loop perform public.production_ensure_plan(o.id);perform public.production_refresh(o.id,f);end loop;
 return jsonb_build_object('orders',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.product_name,'garment',x.garment_type,'quantity',public.production_fact_values(x.id,f,p.facts)->'quantity','qcStatus',x.qc_status,'stage',coalesce(u.stage,'preparation'),'version',coalesce(u.version,0),'plan',to_jsonb(p),'history',(select coalesce(jsonb_agg(to_jsonb(e)order by e.created_at desc),'[]')from(select *from production_timeline_events where order_id=x.id and manufacturer_id=f order by created_at desc limit 30)e),'updates',(select coalesce(jsonb_agg(to_jsonb(h)order by h.version desc),'[]')from(select id,stage,version,note,created_at,delay_reason,expected_completion from order_production_updates where order_id=x.id and manufacturer_id=f order by version desc limit 30)h))order by p.uncertain desc,p.expected_completion nulls first,x.id)
 from orders x join order_production_timelines p on p.order_id=x.id and p.manufacturer_id=f left join lateral(select *from order_production_updates where order_id=x.id and manufacturer_id=f order by version desc limit 1)u on true
 where(p_order is null or x.id=p_order)and x.assigned_manufacturer_id=f and x.status='processing'and x.production_released_at is not null and x.factory_status='in_production'and x.qc_status not in('pending_review','approved')and public.factory_order_visible(x.id)),'[]'),'templateRevision',coalesce((select revision from manufacturer_production_timelines where manufacturer_id=f),0));
end$$;
revoke all on function public.production_board(uuid)from public,anon;grant execute on function public.production_board(uuid)to authenticated;
-- All mutations serialize by order, validate factory/team permissions and optimistic revisions.
create or replace function public.production_action(p_order uuid,p_action text,p_data jsonb,p_revision integer,p_version integer,p_request uuid)returns jsonb language plpgsql security definer set search_path=public as $$
#variable_conflict use_column
declare f uuid:=public.current_factory_id();o orders%rowtype;p order_production_timelines%rowtype;u order_production_updates%rowtype;e production_timeline_events%rowtype;
 target text;old_stage text;new_version integer;reason text:=btrim(coalesce(p_data->>'reason',''));kind text:='schedule';info text;before_state jsonb;c jsonb;rev integer;v_blocks jsonb;v_facts jsonb;block_item jsonb;calc_start timestamptz;due timestamptz;id uuid;event_time timestamptz:=clock_timestamp();req_hash text;begin
 if f is null or not public.factory_has_permission(f,'production')or not public.factory_order_visible(p_order)then raise exception 'Only authorised production staff for the assigned factory may update this order';end if;
 if p_request is null or p_data is null or jsonb_typeof(p_data)<>'object'or length(p_data::text)>20000 then raise exception 'Invalid production update';end if;
 select *into o from orders where orders.id=p_order for update;
 if not found or o.assigned_manufacturer_id is distinct from f or o.kind<>'production'or o.status<>'processing'or o.production_released_at is null or o.factory_status<>'in_production'or o.qc_status in('pending_review','approved')then raise exception 'Production must be authorised and not awaiting or past QC review';end if;
 req_hash:=encode(sha256(convert_to(p_action||p_data::text,'UTF8')),'hex');
 select *into e from production_timeline_events where order_id=p_order and manufacturer_id=f and request_id=p_request;
 if found then if e.actor_id is distinct from public.team_actor()or e.request_hash is distinct from req_hash then raise exception 'This request identifier has already been used for a different update';end if;return jsonb_build_object('id',e.id,'replayed',true);end if;
 perform public.production_ensure_plan(p_order);select *into p from order_production_timelines where order_id=p_order and manufacturer_id=f for update;
 select *into u from order_production_updates where order_id=p_order and manufacturer_id=f order by version desc limit 1;
 if p.revision is distinct from p_revision or coalesce(u.version,0)is distinct from p_version then raise exception 'Production changed on another device. Refresh before retrying';end if;
 old_stage:=coalesce(u.stage,'preparation');target:=old_stage;new_version:=coalesce(u.version,0);before_state:=jsonb_build_object('stage',u.stage,'started',p.stage_started_at,'version',new_version,'planRevision',p.revision);
 perform set_config('app.production_action',p_order::text,true);perform public.production_refresh(p_order,f);select *into p from order_production_timelines where order_id=p_order and manufacturer_id=f;
 if length(reason)>1000 then raise exception 'Keep reasons under 1,000 characters';end if;
 if p_action in('advance','stage')then
 if exists(select 1 from jsonb_array_elements(p.blocks)b where b->>'resolved'is distinct from 'true')or coalesce((p.schedule->0->>'blocked')::boolean,false)then raise exception 'Resolve production blockers and prerequisites first';end if;
 if p_action='advance'then target:=case when u.id is null then 'preparation'else(public.production_stages())[array_position(public.production_stages(),old_stage)+1]end;else target:=p_data->>'stage';end if;
 if target is null or not(target=any(public.production_stages()))then raise exception 'Quality Control is the last production stage. Submit the QC report on its existing page';end if;
 if u.id is not null and target=old_stage then raise exception 'This stage is already current';end if;
 if array_position(public.production_stages(),target)>array_position(public.production_stages(),old_stage)+(case when u.id is null then 0 else 1 end)then raise exception 'Confirm each prerequisite stage in order; stages cannot be skipped';end if;
 if p_action='stage'and length(reason)<3 then raise exception 'Explain the status correction and schedule effect';end if;
 if coalesce((public.production_schedule(f,p.config,event_time,target,public.production_fact_values(p_order,f,p.facts),p.blocks)->0->>'blocked')::boolean,false)then raise exception 'The next stage has unresolved prerequisites. Update its timing factors first';end if;
 perform set_config('app.production_action',p_order::text,true);
 -- Actual movement is an explicit manufacturer confirmation, never a timer's assertion.
 insert into order_production_updates(order_id,manufacturer_id,submitted_by,version,stage,note,expected_completion,delay_reason)values(p_order,f,public.team_actor(),new_version+1,target,case when p_action='advance'then 'Manufacturer confirmed move to '||replace(target,'_',' ')else reason end,null,case when p_action='stage'then reason else ''end)returning id into id;
 update order_production_timelines set stage_started_at=event_time,estimated_stage=null,override_completion=null,legacy_delay=null where order_id=p_order and manufacturer_id=f;kind:='manual';info:=case when p_action='advance'then 'Manufacturer confirmed '||replace(target,'_',' ')else 'Stage corrected: '||reason end;new_version:=new_version+1;
 elsif p_action in('block','pause','preview_block','revise_block')then
 if length(reason)<3 then raise exception 'Explain the production delay or pause';end if;
 select value into block_item from jsonb_array_elements(p.blocks)where value->>'resolved'is distinct from 'true'limit 1;
 if block_item is not null and p_action in('block','pause')then raise exception 'Edit or resolve the current blocker before reporting another';end if;
 if block_item is null and p_action='revise_block'then raise exception 'There is no active blocker to edit';end if;
 if coalesce(p_data->>'category','other')not in('materials','approval','quality','capacity','maintenance','other')then raise exception 'Choose a delay reason';end if;
 due:=nullif(p_data->>'until','')::timestamptz;if due is not null and(due<=event_time or due>event_time+interval '3650 days')then raise exception 'Choose a future estimate for resolving this blocker';end if;
 calc_start:=case when(p.schedule->0->>'end')::timestamptz<event_time then event_time else p.stage_started_at end;
 v_blocks:=case when block_item is null then p.blocks||jsonb_build_array(jsonb_build_object('id',p_request,'start',event_time,'end',due,'resolved',false,'category',coalesce(p_data->>'category','other'),'reason',reason))else(select jsonb_agg(case when value->>'resolved'is distinct from 'true'then value||jsonb_build_object('end',due,'reason',reason,'category',coalesce(p_data->>'category','other'))else value end)from jsonb_array_elements(p.blocks))end;
 if p_action='preview_block'then v_blocks:=public.production_schedule(f,p.config,calc_start,old_stage,public.production_fact_values(p_order,f,p.facts),v_blocks);return jsonb_build_object('current',p.expected_completion,'proposed',v_blocks->-1->'end','schedule',v_blocks);end if;
 if v_blocks=p.blocks then return jsonb_build_object('saved',true,'unchanged',true);end if;
 update order_production_timelines set blocks=v_blocks,stage_started_at=calc_start,override_completion=null,estimated_stage=null where order_id=p_order and manufacturer_id=f;
 kind:='block';info:=case when due is null then 'Production blocked; completion estimate is uncertain. 'else 'Production delayed until '||due::text||'. 'end||reason||case when calc_start>p.stage_started_at then ' · Overdue, unconfirmed stage re-estimated from this delay report.'else ''end;
 elsif p_action='resume'then
 if not exists(select 1 from jsonb_array_elements(p.blocks)b where b->>'resolved'is distinct from 'true')then raise exception 'Production is not paused or blocked';end if;
 select coalesce(jsonb_agg(case when value->>'resolved'is distinct from 'true'then value||jsonb_build_object('end',event_time,'resolved',true)else value end),'[]')into v_blocks from jsonb_array_elements(p.blocks);
 update order_production_timelines set blocks=v_blocks,estimated_stage=null,legacy_delay=null where order_id=p_order and manufacturer_id=f;kind:='resume';info:='Manufacturer confirmed blocker resolved; remaining schedule recalculated';
 elsif p_action='facts'then
 v_facts:=p_data->'facts';if jsonb_typeof(v_facts)is distinct from 'object'or v_facts-array['complexity','materials','sample_approval','customer_approval','quality_checks','confirmedRules']<>'{}'then raise exception 'Choose supported order timing factors';end if;
 if v_facts?'complexity'and v_facts->>'complexity'not in('simple','standard','complex')then raise exception 'Choose product complexity';end if;
 if exists(select 1 from jsonb_each(v_facts)x where x.key in('materials','sample_approval','customer_approval','quality_checks')and jsonb_typeof(x.value)<>'boolean')then raise exception 'Approval/material factors require Yes/No values';end if;
 if v_facts?'confirmedRules'and(jsonb_typeof(v_facts->'confirmedRules')<>'array'or exists(select 1 from jsonb_array_elements_text(v_facts->'confirmedRules')r where not exists(select 1 from jsonb_array_elements(p.config->'factors')x where x->>'id'=r and x->>'effect'='confirm')))then raise exception 'Confirm only configured timing rules';end if;
 v_facts:=v_facts;
 for target in select unnest(array['materials','sample_approval','customer_approval'])loop
 if v_facts->target='true'::jsonb then v_facts:=v_facts||jsonb_build_object('_'||target||'At',case when p.facts->target='true'::jsonb then coalesce(p.facts->>('_'||target||'At'),event_time::text)else event_time::text end);end if;end loop;
 update order_production_timelines set facts=v_facts,estimated_stage=null where order_id=p_order and manufacturer_id=f;info:='Structured timing factors updated; remaining dates recalculated';
 elsif p_action='automation'then
 if jsonb_typeof(p_data->'enabled')is distinct from 'boolean'then raise exception 'Choose whether automated estimates are enabled';end if;
 update order_production_timelines set automation_paused=not(p_data->>'enabled')::boolean,estimated_stage=null where order_id=p_order and manufacturer_id=f;info:=case when(p_data->>'enabled')::boolean then 'Manufacturer resumed automatic estimates'else 'Manufacturer paused automatic estimates; confirmed work and manual updates remain available'end;
 elsif p_action='estimate'then
 if length(reason)<3 then raise exception 'Explain the updated completion estimate';end if;due:=nullif(p_data->>'completion','')::timestamptz;
 if due is not null and(due<=event_time or due>event_time+interval '3650 days')then raise exception 'Choose a valid future estimate';end if;
 update order_production_timelines set override_completion=due where order_id=p_order and manufacturer_id=f;info:='Completion estimate overridden: '||reason;
 elsif p_action in('preview_rules','apply_rules')then
 select config,revision into c,rev from manufacturer_production_timelines where manufacturer_id=f;if not found then raise exception 'Save your factory timeline first';end if;
 v_blocks:=public.production_schedule(f,c,p.stage_started_at,old_stage,public.production_fact_values(p_order,f,p.facts),p.blocks);
 if p_action='preview_rules'then return jsonb_build_object('current',p.expected_completion,'proposed',v_blocks->-1->'end','schedule',v_blocks,'templateRevision',rev,'previewHash',encode(sha256(convert_to(v_blocks::text,'UTF8')),'hex'));end if;
 if p_data->>'previewHash'is distinct from encode(sha256(convert_to(v_blocks::text,'UTF8')),'hex')then raise exception 'The proposed schedule changed after preview. Preview again before applying';end if;
 if coalesce((p_data->>'templateRevision')::integer,-1)<>rev then raise exception 'Default rules changed after the preview. Preview again';end if;
 update order_production_timelines set config=c,template_revision=rev,override_completion=null,estimated_stage=null where order_id=p_order and manufacturer_id=f;kind:='rules';info:='Manufacturer explicitly applied timeline revision '||rev||' to remaining production';
 elsif p_action='undo'then
 select *into e from production_timeline_events where order_id=p_order and manufacturer_id=f and id=(p_data->>'event')::uuid;
 if not found or e.kind<>'manual'or e.actor_id is distinct from public.team_actor()or e.created_at<event_time-interval '30 seconds'or coalesce((e.details->>'afterVersion')::integer,-1)<>new_version or coalesce((e.details->>'afterRevision')::integer,-1)<>p.revision or e.details->'before'->>'stage'is null then raise exception 'Undo is no longer safe. Use a reasoned stage correction';end if;
 target:=e.details->'before'->>'stage';perform set_config('app.production_action',p_order::text,true);
 insert into order_production_updates(order_id,manufacturer_id,submitted_by,version,stage,note)values(p_order,f,public.team_actor(),new_version+1,target,'Undo of the last manual stage transition');
 update order_production_timelines set stage_started_at=(e.details->'before'->>'started')::timestamptz,estimated_stage=null where order_id=p_order and manufacturer_id=f;new_version:=new_version+1;kind:='undo';info:='Last manual stage transition undone; history retained';
 else raise exception 'Unknown production action';end if;
 update order_production_timelines set revision=revision+1,updated_at=event_time where order_id=p_order and manufacturer_id=f;
 perform public.production_refresh(p_order,f);
 insert into production_timeline_events(order_id,manufacturer_id,actor_id,kind,explanation,details,request_id,request_hash)values(p_order,f,public.team_actor(),kind,info,jsonb_build_object('before',before_state,'afterVersion',new_version,'afterRevision',p.revision+1,'data',p_data),p_request,req_hash)returning id into id;
 if p_action in('block','pause','revise_block','resume','estimate','apply_rules','facts','advance','stage','undo')then
 select expected_completion into due from order_production_timelines where order_id=p_order and manufacturer_id=f;
 if p_action in('block','pause','revise_block','resume')or((p.expected_completion is null)<>(due is null))or abs(extract(epoch from(due-p.expected_completion)))>=86400 then
 perform public.notify_superadmin('order','Production schedule changed',o.product_name||' · '||info,'/superadmin/orders/'||p_order,p_order);
 insert into brand_notifications(user_id,category,title,body,href)values(o.user_id,'order','Production schedule update',o.product_name||' · '||info,'/orders/'||p_order);
 end if;end if;
 return jsonb_build_object('id',id,'version',new_version,'revision',p.revision+1,'undoAvailable',kind='manual'and u.id is not null,'saved',true);
end$$;
revoke all on function public.production_action(uuid,text,jsonb,integer,integer,uuid)from public,anon;grant execute on function public.production_action(uuid,text,jsonb,integer,integer,uuid)to authenticated;
create or replace function public.production_bulk(p_orders jsonb,p_request uuid)returns integer language plpgsql security definer set search_path=public as $$
declare x jsonb;stage text;current_stage text;n integer:=0;begin
 if jsonb_typeof(p_orders)is distinct from 'array'or jsonb_array_length(p_orders)not between 1 and 100 or(select count(distinct value->>'id')from jsonb_array_elements(p_orders))<>jsonb_array_length(p_orders)then raise exception 'Select 1–100 distinct production orders';end if;
 -- Consistent lock order prevents deadlocks. A failed item rolls the entire batch back.
 for x in select value from jsonb_array_elements(p_orders)order by value->>'id'loop
 select coalesce((select u.stage from order_production_updates u where u.order_id=(x->>'id')::uuid order by version desc limit 1),'preparation')into current_stage;
 current_stage:=current_stage||case when(x->>'version')::integer=0 then ':start'else ':next'end;
 if stage is null then stage:=current_stage;elsif stage<>current_stage then raise exception 'Bulk updates require the same eligible next stage';end if;
 perform public.production_action((x->>'id')::uuid,'advance','{}',(x->>'revision')::integer,(x->>'version')::integer,p_request);n:=n+1;
 end loop;return n;end$$;
revoke all on function public.production_bulk(jsonb,uuid)from public,anon;grant execute on function public.production_bulk(jsonb,uuid)to authenticated;
-- Protect legacy detail/API updates with the same adjacent-stage and blocker rules.
create or replace function public.production_update_guard()returns trigger language plpgsql security definer set search_path=public as $$
declare p order_production_timelines%rowtype;prior order_production_updates%rowtype;begin
 if public.is_superadmin()then return new;end if;
 if not public.factory_has_permission(new.manufacturer_id,'production')or not public.factory_order_visible(new.order_id)then raise exception 'Assigned production permission required';end if;
 select *into p from order_production_timelines where order_id=new.order_id and manufacturer_id=new.manufacturer_id for update;
 select *into prior from order_production_updates where order_id=new.order_id and manufacturer_id=new.manufacturer_id order by version desc limit 1;
 if new.stage is distinct from prior.stage then
 if p.order_id is not null and coalesce((public.production_schedule(new.manufacturer_id,p.config,p.stage_started_at,coalesce(prior.stage,'preparation'),public.production_fact_values(new.order_id,new.manufacturer_id,p.facts),p.blocks)->0->>'blocked')::boolean,false)then raise exception 'Resolve current stage prerequisites before updating production';end if;
 if p.order_id is not null and coalesce((public.production_schedule(new.manufacturer_id,p.config,now(),new.stage,public.production_fact_values(new.order_id,new.manufacturer_id,p.facts),p.blocks)->0->>'blocked')::boolean,false)then raise exception 'Resolve stage prerequisites before updating production';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p.blocks,'[]'))b where b->>'resolved'is distinct from 'true')then raise exception 'Resolve production blockers first';end if;
 if array_position(public.production_stages(),new.stage)>coalesce(array_position(public.production_stages(),prior.stage),0)+1 then raise exception 'Confirm each prerequisite production stage in order';end if;
 if prior.id is not null and array_position(public.production_stages(),new.stage)<array_position(public.production_stages(),prior.stage)and length(btrim(new.note))<3 then raise exception 'Explain the backwards stage correction';end if;
 end if;return new;end$$;
revoke all on function public.production_update_guard()from public,anon,authenticated;
drop trigger if exists production_update_guard on public.order_production_updates;
create trigger production_update_guard before insert on public.order_production_updates for each row execute function public.production_update_guard();
create or replace function public.production_update_sync()returns trigger language plpgsql security definer set search_path=public as $$begin
 if current_setting('app.production_action',true)=new.order_id::text then return new;end if;
 update order_production_timelines set stage_started_at=case when new.stage is distinct from(select stage from order_production_updates where order_id=new.order_id and manufacturer_id=new.manufacturer_id and version<new.version order by version desc limit 1)then new.created_at else stage_started_at end,estimated_stage=null,override_completion=case when new.expected_completion is not null then(new.expected_completion+(config->>'workEnd')::time)at time zone(config->>'timezone')else override_completion end,legacy_delay=nullif(new.delay_reason,''),revision=revision+1,updated_at=now()where order_id=new.order_id and manufacturer_id=new.manufacturer_id;
 perform public.production_refresh(new.order_id,new.manufacturer_id);return new;end$$;
revoke all on function public.production_update_sync()from public,anon,authenticated;
-- The new action owns its revision; only legacy writes use this synchronisation trigger.
drop trigger if exists production_update_sync on public.order_production_updates;
create trigger production_update_sync after insert on public.order_production_updates for each row execute function public.production_update_sync();
create or replace function public.production_scheduler()returns integer language plpgsql security definer set search_path=public as $$
declare p record;s jsonb;next_info jsonb;next_stage text;actual_stage text;forecast_stage text;remaining jsonb;position integer;n integer:=0;visited boolean;can_advance boolean;explanation text;begin
 for p in select t.*from order_production_timelines t join orders o on o.id=t.order_id and o.assigned_manufacturer_id=t.manufacturer_id where o.status='processing'and o.factory_status='in_production'and o.production_released_at is not null and o.qc_status not in('pending_review','approved')order by t.updated_at limit 250 for update of o skip locked loop
 perform public.production_refresh(p.order_id,p.manufacturer_id);
 select schedule into remaining from order_production_timelines where order_id=p.order_id and manufacturer_id=p.manufacturer_id;
 actual_stage:=coalesce((select stage from order_production_updates where order_id=p.order_id and manufacturer_id=p.manufacturer_id order by version desc limit 1),'preparation');forecast_stage:=actual_stage;visited:=false;
 if not p.automation_paused and not exists(select 1 from jsonb_array_elements(p.blocks)b where b->>'resolved'is distinct from 'true')then
 for position in 0..greatest(0,jsonb_array_length(remaining)-1)loop
 s:=remaining->position;
 exit when s is null or not coalesce((s->>'automatic')::boolean,false)or not coalesce((s->>'ready')::boolean,false)or coalesce((s->>'blocked')::boolean,false);
 next_info:=remaining->(position+1);next_stage:=next_info->>'stage';
 can_advance:=next_stage is not null and next_info->>'starts'<>'previous_stage'and not coalesce((next_info->>'blocked')::boolean,false);
 if can_advance then forecast_stage:=next_stage;explanation:='Estimated progress advanced automatically to '||replace(next_stage,'_',' ')||' using the configured '||(s->>'stage')||' duration: '||(s->>'duration')||' '||replace(s->>'unit','_',' ')||'. ';
 else forecast_stage:=s->>'stage';explanation:='Configured '||replace(s->>'stage','_',' ')||' duration elapsed. Ready for manufacturer confirmation; the next stage or QC review still requires its prerequisites. ';end if;
 explanation:=explanation||'Physical completion still requires manufacturer confirmation.';
 insert into production_timeline_events(order_id,manufacturer_id,kind,explanation,details,dedupe)values(p.order_id,p.manufacturer_id,'automatic',explanation,jsonb_build_object('estimatedStage',forecast_stage,'configuredStage',s->>'stage','confirmedStage',actual_stage),'estimate:'||(s->>'stage')||'>'||forecast_stage||':'||p.stage_started_at::text||':'||p.template_revision||':'||(s->>'end'))on conflict do nothing;
 if found then n:=n+1;end if;visited:=true;
 exit when not can_advance;
 end loop;
 if visited then update order_production_timelines set estimated_stage=forecast_stage where order_id=p.order_id and manufacturer_id=p.manufacturer_id;end if;
 end if;
 -- Bounded fair sweeps, safe when jobs run late: every forecast step has its own dedupe key.
 update order_production_timelines set updated_at=now()where order_id=p.order_id and manufacturer_id=p.manufacturer_id;
 end loop;return n;end$$;
revoke all on function public.production_scheduler()from public,anon,authenticated;grant execute on function public.production_scheduler()to service_role;

-- Existing calendar/dashboard projections consume the same saved dates, including uncertainty.
create or replace function public.production_effective_date(p_order uuid,p_fallback date)returns date language sql stable security definer set search_path=public as $$select case when t.order_id is not null then(t.expected_completion at time zone(t.config->>'timezone'))::date else p_fallback end from orders o left join order_production_timelines t on t.order_id=o.id and t.manufacturer_id=o.assigned_manufacturer_id where o.id=p_order$$;
revoke all on function public.production_effective_date(uuid,date)from public,anon,authenticated;
create or replace function public.production_effective_delay(p_order uuid,p_fallback text)returns text language sql stable security definer set search_path=public as $$select case when t.order_id is null then p_fallback else coalesce((select string_agg(b->>'reason','; ')from jsonb_array_elements(t.blocks)b where b->>'resolved'is distinct from 'true'),case when t.uncertain then coalesce(t.schedule->0->>'reason','Completion estimate is uncertain')end,t.legacy_delay)end from orders o left join order_production_timelines t on t.order_id=o.id and t.manufacturer_id=o.assigned_manufacturer_id where o.id=p_order$$;
revoke all on function public.production_effective_delay(uuid,text)from public,anon,authenticated;
do $$declare d text;f regprocedure;begin
 f:='public.calendar_order_facts(uuid)'::regprocedure;select pg_get_functiondef(f)into d;
 if position('production_effective_date'in d)=0 then d:=replace(d,'first_update.started,p.expected_completion,','first_update.started,public.production_effective_date(o.id,p.expected_completion),');d:=replace(d,'o.status,p.delay_reason,','o.status,public.production_effective_delay(o.id,p.delay_reason),');execute d;end if;
 f:=coalesce(to_regprocedure('public.team_impl_portal_dashboard(boolean,integer,text,text,text)'),to_regprocedure('public.portal_dashboard(boolean,integer,text,text,text)'));select pg_get_functiondef(f)into d;
 if position('production_effective_date'in d)=0 then d:=replace(d,'u.stage,u.expected_completion,u.delay_reason,u.created_at','u.stage,public.production_effective_date(o.id,u.expected_completion)as expected_completion,public.production_effective_delay(o.id,u.delay_reason)as delay_reason,u.created_at');execute d;end if;
end$$;
select cron.schedule('ceriga-production-timeline','*/5 * * * *','select public.production_scheduler();');
commit;
