begin;
select pg_advisory_xact_lock(7271028001);
alter table public.order_production_updates drop constraint if exists order_production_updates_stage_check;
alter table public.order_production_updates add constraint order_production_updates_stage_check check(stage in('preparation','cutting','sewing','cutting_sewing','finishing','quality_control'));
alter table public.order_production_updates add column if not exists source text not null default 'manual' check(source in('manual','automatic'));
alter table public.order_production_timelines add column if not exists original_completion timestamptz;
alter table public.order_production_timelines add column if not exists stage_delays jsonb not null default '[]' check(jsonb_typeof(stage_delays)='array');
alter table public.order_production_timelines add column if not exists next_transition timestamptz;
alter table public.order_production_timelines add column if not exists needs_review text;
alter table public.order_production_timelines add column if not exists workflow_version integer not null default 1;
create index if not exists production_automatic_due_idx on public.order_production_timelines(next_transition) where next_transition is not null;

create or replace function public.production_stage_key(s text)returns text language sql immutable set search_path=public as $$select case when s in('cutting','sewing')then 'cutting_sewing'else s end$$;
create or replace function public.production_stages()returns text[]language sql immutable set search_path=public as $$select array['preparation','cutting_sewing','finishing','quality_control']$$;
-- Preserve the old configuration alongside the mapped durations. QC remains outside production.
create or replace function public.production_three_config(c jsonb,active_stage text default null)returns jsonb language plpgsql immutable set search_path=public as $$
declare result jsonb:=c;stages jsonb:='[]';item jsonb;parts jsonb;old_stage jsonb;auto boolean;factors jsonb;
begin
 if c is null then return null;end if;
 if jsonb_array_length(c->'stages')=3 and c->'stages'->1->>'id'='cutting_sewing' then return c;end if;
 if jsonb_array_length(c->'stages')<>5 or c->'stages'->0->>'id'<>'preparation' or c->'stages'->1->>'id'<>'cutting' or c->'stages'->2->>'id'<>'sewing' or c->'stages'->3->>'id'<>'finishing' or c->'stages'->4->>'id'<>'quality_control' then raise exception 'Unrecognised legacy timeline; manual scheduling review required';end if;
 for item in select value from jsonb_array_elements(c->'stages') where value->>'id' in('preparation','cutting','finishing') loop
  if item->>'id'='cutting' then
   parts:=jsonb_build_array(item,c->'stages'->2);
   if active_stage='sewing' then parts:=jsonb_build_array(c->'stages'->2);end if;
   select bool_and((value->>'automatic')::boolean) into auto from jsonb_array_elements(parts);
   item:=item||jsonb_build_object('id','cutting_sewing','duration',(select sum((value->>'duration')::numeric)from jsonb_array_elements(parts)),'automatic',auto,'segments',parts);
  end if;
  stages:=stages||jsonb_build_array(item);
 end loop;
 select coalesce(jsonb_agg(value||jsonb_build_object('stage',public.production_stage_key(value->>'stage'))),'[]')into factors from jsonb_array_elements(c->'factors') where value->>'stage'<>'quality_control';
 return result||jsonb_build_object('stages',stages,'factors',factors,'legacyTimeline',c,'separateQcTiming',c->'stages'->4,'schemaVersion',2);
end$$;
revoke all on function public.production_three_config(jsonb,text)from public,anon,authenticated;

-- Capture commitments before changing any estimates; do not rewrite historical stage events.
do $$declare t record;begin
 for t in select *from manufacturer_production_timelines where jsonb_array_length(config->'stages')<>3 loop
  update manufacturer_production_timelines set config=public.production_three_config(t.config),revision=revision+1,updated_at=now() where manufacturer_id=t.manufacturer_id;
 end loop;
 for t in select p.*,(select stage from order_production_updates u where u.order_id=p.order_id and u.manufacturer_id=p.manufacturer_id order by version desc limit 1)old_stage from order_production_timelines p where workflow_version=1 loop
  begin
   update order_production_timelines set original_completion=coalesce(original_completion,expected_completion,override_completion),config=public.production_three_config(t.config,t.old_stage),workflow_version=2,estimated_stage=null,revision=revision+1 where order_id=t.order_id and manufacturer_id=t.manufacturer_id;
   insert into production_timeline_events(order_id,manufacturer_id,kind,explanation,details,dedupe)values(t.order_id,t.manufacturer_id,'rules','Production mapped to Preparations, Cutting & Sewing, and Finishing. Historical updates and the original completion estimate were retained.',jsonb_build_object('legacyStage',t.old_stage,'originalCompletion',t.expected_completion),'three-stage-migration')on conflict do nothing;
  exception when others then
   update order_production_timelines set needs_review='Legacy scheduling needs review: '||sqlerrm,automation_paused=true,workflow_version=2 where order_id=t.order_id and manufacturer_id=t.manufacturer_id;
  end;
 end loop;
end$$;


create or replace function public.production_default_timeline(p_factory uuid)returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('timezone',m.calendar_timezone,'workdays',to_jsonb(coalesce(m.calendar_workdays,array[1,2,3,4,5])),'workStart','09:00','workEnd','17:00','startEvent','production_approval','schemaVersion',2,'factors','[]'::jsonb,'stages',(select jsonb_agg(jsonb_build_object('id',s,'duration',greatest(1,round(coalesce(m.typical_lead_days,10)*case s when 'preparation'then .2 when 'cutting_sewing'then .6 else .2 end)),'unit','working_days','starts',case when s='preparation'then 'production_approval'else 'previous_stage'end,'automatic',false)order by n)from unnest(array['preparation','cutting_sewing','finishing'])with ordinality x(s,n)))from manufacturer_profiles m where user_id=p_factory$$;
create or replace function public.production_validate_timeline(c jsonb)returns void language plpgsql stable set search_path=public as $$
declare s jsonb;r jsonb;ids text[];begin
 if c is null or jsonb_typeof(c)<>'object'or length(c::text)>30000 then raise exception 'Invalid production timeline';end if;
 if not exists(select 1 from pg_timezone_names where name=c->>'timezone')then raise exception 'Choose a valid timezone';end if;
 if coalesce(c->>'workStart','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$'or coalesce(c->>'workEnd','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$'or(c->>'workEnd')::time<=(c->>'workStart')::time then raise exception 'Choose a daytime working shift (start before end)';end if;
 if jsonb_typeof(c->'workdays')is distinct from 'array'or jsonb_array_length(c->'workdays')not between 1 and 7 then raise exception 'Select working weekdays';end if;
 if exists(select 1 from jsonb_array_elements_text(c->'workdays')d where d!~'^[1-7]$')or(select count(distinct value)from jsonb_array_elements_text(c->'workdays'))<>jsonb_array_length(c->'workdays')then raise exception 'Choose distinct weekdays (Monday–Sunday)';end if;
 if coalesce(c->>'startEvent','')not in('production_approval','materials')then raise exception 'Choose a scheduling start event';end if;
 if jsonb_typeof(c->'stages')is distinct from 'array'or jsonb_array_length(c->'stages')<>3 then raise exception 'Configure the three production stages';end if;
 select array_agg(value->>'id'order by ordinality)into ids from jsonb_array_elements(c->'stages')with ordinality;
 if ids is distinct from array['preparation','cutting_sewing','finishing']then raise exception 'Use the existing stages in order';end if;
 for s in select value from jsonb_array_elements(c->'stages')loop
 if coalesce(s->>'duration','')!~'^[0-9]+(\.[0-9]{1,2})?$'or(s->>'duration')::numeric not between .01 and 3650 or coalesce(s->>'unit','')not in('working_days','calendar_days','hours','working_hours')or coalesce(s->>'starts','')not in('production_approval','previous_stage','previous_estimate','materials','sample_approval','customer_approval')or jsonb_typeof(s->'automatic')is distinct from 'boolean'then raise exception 'Choose a duration, unit, start condition and confirmation mode for each stage';end if;
 if s?'segments' then
 if jsonb_typeof(s->'segments')<>'array' or jsonb_array_length(s->'segments')not between 1 and 2 then raise exception 'Invalid preserved stage durations';end if;
 for r in select value from jsonb_array_elements(s->'segments')loop
 if coalesce(r->>'duration','')!~'^[0-9]+(\.[0-9]{1,2})?$' or (r->>'duration')::numeric not between .01 and 3650 or coalesce(r->>'unit','')not in('working_days','calendar_days','hours','working_hours')then raise exception 'Invalid preserved duration';end if;
 end loop;end if;
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
create or replace function public.production_schedule(p_factory uuid,c jsonb,p_start timestamptz,p_stage text,p_facts jsonb,p_blocks jsonb)returns jsonb language plpgsql stable security definer set search_path=public as $$
declare s jsonb;r jsonb;segment jsonb;delay_item jsonb;cursor_at timestamptz:=p_start;ends_at timestamptz;result jsonb:='[]';reason text;v jsonb;matches boolean;blocked boolean;begin
 for s in select value from jsonb_array_elements(c->'stages')with ordinality where ordinality>=coalesce(array_position(public.production_stages(),public.production_stage_key(p_stage)),1)order by ordinality loop
 reason:=null;blocked:=false;
 if(c->>'startEvent'='materials'or s->>'starts'='materials')and p_facts->'materials'is distinct from 'true'::jsonb then reason:='Confirm material availability';blocked:=true;end if;
 if s->>'starts'in('sample_approval','customer_approval')and p_facts->(s->>'starts')is distinct from 'true'::jsonb then reason:='Confirm '||replace(s->>'starts','_',' ');blocked:=true;end if;
 if cursor_at is not null then
 if(c->>'startEvent'='materials'or s->>'starts'='materials')and p_facts->'materials'='true'::jsonb then cursor_at:=greatest(cursor_at,(p_facts->>'_materialsAt')::timestamptz);end if;
 if s->>'starts'in('sample_approval','customer_approval')then cursor_at:=greatest(cursor_at,(p_facts->>('_'||(s->>'starts')||'At'))::timestamptz);end if;end if;
 ends_at:=cursor_at;
 if s?'segments' then
 for segment in select value from jsonb_array_elements(s->'segments')loop
 if segment->>'starts' in('materials','sample_approval','customer_approval') and p_facts->(segment->>'starts')is distinct from 'true'::jsonb then reason:='Confirm '||replace(segment->>'starts','_',' ');blocked:=true;end if;
 ends_at:=public.production_add_time(p_factory,c,ends_at,(segment->>'duration')::numeric,segment->>'unit',p_blocks);
 end loop;
 else ends_at:=public.production_add_time(p_factory,c,cursor_at,(s->>'duration')::numeric,s->>'unit',p_blocks);end if;
 for r in select value from jsonb_array_elements(c->'factors')where value->>'stage'=s->>'id'loop
 v:=p_facts->(r->>'factor');matches:=false;
 if v is null or v='null'::jsonb then reason:='Confirm '||replace(r->>'factor','_',' ');blocked:=true;
 else matches:=case when r->>'op'='gte'then(v#>>'{}')::numeric>=(r->>'value')::numeric else v=r->'value'end;end if;
 if matches then
 if r->>'effect'='add_time'then ends_at:=public.production_add_time(p_factory,c,ends_at,(r->>'duration')::numeric,r->>'unit',p_blocks);
 elsif r->>'effect'='pause'then reason:='Resolve '||replace(r->>'factor','_',' ');blocked:=true;
 elsif coalesce(p_facts->'confirmedRules','[]') ? (r->>'id')is not true then reason:='Confirm timing rule: '||replace(r->>'factor','_',' ');blocked:=true;end if;end if;
 end loop;
 for delay_item in select value from jsonb_array_elements(coalesce(p_facts->'_stageDelays','[]'))where value->>'stage'=s->>'id' and (value->>'stageStartedAt')::timestamptz=p_start loop
 ends_at:=public.production_add_time(p_factory,c,ends_at,(delay_item->>'days')::numeric,'calendar_days',p_blocks);
 end loop;
 if blocked then ends_at:=null;end if;
 if exists(select 1 from jsonb_array_elements(p_blocks)b where b->>'end'is null or(b->>'resolved'is distinct from 'true'and(b->>'end')::timestamptz<=now()))then ends_at:=null;reason:=coalesce(reason,'Production is blocked; completion is uncertain');blocked:=true;end if;
 result:=result||jsonb_build_array(jsonb_build_object('stage',s->>'id','start',cursor_at,'end',ends_at,'automatic',s->'automatic','starts',s->>'starts','duration',s->'duration','unit',s->>'unit','blocked',blocked,'reason',reason,'ready',ends_at is not null and ends_at<=now()));cursor_at:=ends_at;
 end loop;return result;end$$;
create or replace function public.production_fact_values(p_order uuid,p_factory uuid,p_facts jsonb)returns jsonb language sql stable security definer set search_path=public as $$
 with active as(select case when coalesce(opt.value->>'totalUnits','')~'^[1-9][0-9]*$'then(opt.value->>'totalUnits')::numeric end units from orders x left join lateral(select value from jsonb_array_elements(coalesce(x.price_options,'[]'))where value->>'id'=x.selected_price_option_id limit 1)opt on true where x.assigned_manufacturer_id=p_factory and x.status='processing'and x.production_released_at is not null and x.factory_status='in_production'and coalesce(x.qc_status,'not_submitted')<>'approved')
 select p_facts||jsonb_build_object('_stageDelays',coalesce((select stage_delays from order_production_timelines where order_id=p_order and manufacturer_id=p_factory),'[]'::jsonb),'quantity',case when coalesce(selected.value->>'totalUnits','')~'^[1-9][0-9]*$'then(selected.value->>'totalUnits')::numeric end,'capacity',case when m.monthly_capacity>0 and not exists(select 1 from active where units is null)then(select round(100*sum(units)/m.monthly_capacity,2)from active)end)from orders o join manufacturer_profiles m on m.user_id=p_factory left join lateral(select value from jsonb_array_elements(coalesce(o.price_options,'[]'))where value->>'id'=o.selected_price_option_id limit 1)selected on true where o.id=p_order
$$;
create or replace function public.production_refresh(p_order uuid,p_factory uuid)returns void language plpgsql security definer set search_path=public as $$
declare p order_production_timelines%rowtype;s jsonb;stage text;due timestamptz;begin
 select *into p from order_production_timelines where order_id=p_order and manufacturer_id=p_factory for update;
 if not found then return;end if;
 select u.stage into stage from order_production_updates u where order_id=p_order and manufacturer_id=p_factory order by version desc limit 1;stage:=public.production_stage_key(coalesce(stage,'preparation'));
 if stage='quality_control'then update order_production_timelines set next_transition=null,schedule='[]'where order_id=p_order and manufacturer_id=p_factory;return;end if;
 s:=public.production_schedule(p_factory,p.config,p.stage_started_at,stage,public.production_fact_values(p_order,p_factory,p.facts),p.blocks);
 due:=(s->-1->>'end')::timestamptz;
 update order_production_timelines set original_completion=coalesce(original_completion,case when p.workflow_version=2 then due end),next_transition=case when not p.automation_paused and p.needs_review is null and (s->0->>'automatic')::boolean and not coalesce((s->0->>'blocked')::boolean,false)and not exists(select 1 from jsonb_array_elements(p.blocks)b where b->>'resolved'is distinct from 'true')then(s->0->>'end')::timestamptz end,estimated_stage=case when not coalesce((s->0->>'ready')::boolean,false)or coalesce((s->0->>'blocked')::boolean,false)then null else estimated_stage end,schedule=s,expected_completion=case when due is null then null else coalesce(p.override_completion,due)end,uncertain=due is null where order_id=p_order and manufacturer_id=p_factory;
 due:=case when due is null then null else coalesce(p.override_completion,due)end;
 if jsonb_array_length(p.schedule)>0 and current_setting('app.production_action',true)is distinct from p_order::text and(((p.expected_completion is null)<>(due is null))or abs(extract(epoch from(due-p.expected_completion)))>=86400)then
 insert into production_timeline_events(order_id,manufacturer_id,kind,explanation,details,dedupe)values(p_order,p_factory,'schedule','Expected completion changed using saved working hours and factory closures',jsonb_build_object('previous',p.expected_completion,'revised',due),'recalculation:'||encode(sha256(convert_to(coalesce(p.expected_completion::text,'unknown')||'>'||coalesce(due::text,'unknown'),'UTF8')),'hex'))on conflict do nothing;
 if found then
 perform public.notify_superadmin('order','Production completion estimate changed','Working calendar or scheduling prerequisites changed. Review the saved production timeline.','/superadmin/orders/'||p_order,p_order);
 insert into brand_notifications(user_id,category,title,body,href)select user_id,'order','Production schedule update','Your order completion estimate has changed. Ceriga is reviewing the production timeline.','/orders/'||p_order from orders where id=p_order;
 end if;end if;
end$$;
create or replace function public.production_ensure_plan(p_order uuid)returns void language plpgsql security definer set search_path=public as $$
declare o orders%rowtype;c jsonb;rev integer;started timestamptz;legacy_expected date;legacy_reason text;begin
 select *into o from orders where id=p_order for update;
 if o.kind<>'production'or o.status<>'processing'or o.production_released_at is null or o.assigned_manufacturer_id is null or o.factory_status<>'in_production'then return;end if;
 select config,revision into c,rev from manufacturer_production_timelines where manufacturer_id=o.assigned_manufacturer_id;
 c:=coalesce(c,public.production_default_timeline(o.assigned_manufacturer_id));
 select created_at,expected_completion,delay_reason into started,legacy_expected,legacy_reason from order_production_updates where order_id=p_order and manufacturer_id=o.assigned_manufacturer_id order by version desc limit 1;
 insert into order_production_timelines(order_id,manufacturer_id,config,template_revision,stage_started_at,override_completion,legacy_delay,workflow_version)values(p_order,o.assigned_manufacturer_id,c,coalesce(rev,0),coalesce(started,o.production_released_at),case when legacy_expected is not null then(legacy_expected+(c->>'workEnd')::time)at time zone(c->>'timezone')end,nullif(legacy_reason,''),2)on conflict do nothing;
end$$;
create or replace function public.production_template(p_config jsonb default null,p_revision integer default null,p_save boolean default false)returns jsonb language plpgsql security definer set search_path=public as $$
declare f uuid:=public.current_factory_id();c jsonb;rev integer;preview jsonb;begin
 if f is null or not(public.factory_has_permission(f,'production')or public.factory_has_permission(f,'settings'))then raise exception 'Production or factory settings permission required';end if;
 select config,revision into c,rev from manufacturer_production_timelines where manufacturer_id=f;
 if p_config is not null then
 if not public.factory_has_permission(f,'settings')then raise exception 'Factory settings permission required';end if;
 if p_config->>'manufacturerId'is not null and p_config->>'manufacturerId'<>f::text then raise exception 'Factory workspace changed. Reload this timeline before saving';end if;
 c:=public.production_three_config(p_config);perform public.production_validate_timeline(c);
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
create or replace function public.production_board(p_order uuid default null)returns jsonb language plpgsql security definer set search_path=public as $$
declare f uuid:=public.current_factory_id();o record;begin
 if f is null or not public.factory_has_permission(f,'production')then raise exception 'Production permission required';end if;
 for o in select x.id from orders x where(p_order is null or x.id=p_order)and x.assigned_manufacturer_id=f and x.status='processing'and x.production_released_at is not null and x.factory_status='in_production'and public.factory_order_visible(x.id)order by x.id loop perform public.production_ensure_plan(o.id);perform public.production_refresh(o.id,f);end loop;
 return jsonb_build_object('orders',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.product_name,'garment',x.garment_type,'quantity',public.production_fact_values(x.id,f,p.facts)->'quantity','qcStatus',x.qc_status,'stage',public.production_stage_key(coalesce(u.stage,'preparation')),'productionStartedAt',x.production_released_at,'version',coalesce(u.version,0),'plan',to_jsonb(p),'history',(select coalesce(jsonb_agg(to_jsonb(e)order by e.created_at desc),'[]')from(select *from production_timeline_events where order_id=x.id and manufacturer_id=f order by created_at desc limit 30)e),'updates',(select coalesce(jsonb_agg(to_jsonb(h)order by h.version desc),'[]')from(select id,stage,version,note,created_at,delay_reason,expected_completion from order_production_updates where order_id=x.id and manufacturer_id=f order by version desc limit 30)h))order by p.uncertain desc,p.expected_completion nulls first,x.id)
 from orders x join order_production_timelines p on p.order_id=x.id and p.manufacturer_id=f left join lateral(select *from order_production_updates where order_id=x.id and manufacturer_id=f order by version desc limit 1)u on true
 where(p_order is null or x.id=p_order)and x.assigned_manufacturer_id=f and x.status='processing'and x.production_released_at is not null and x.factory_status='in_production'and x.qc_status not in('pending_review','approved')and public.factory_order_visible(x.id)),'[]'),'templateRevision',coalesce((select revision from manufacturer_production_timelines where manufacturer_id=f),0));
end$$;
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
 old_stage:=public.production_stage_key(coalesce(u.stage,'preparation'));if p.needs_review is not null then raise exception 'Scheduling review required: %',p.needs_review;end if;target:=old_stage;new_version:=coalesce(u.version,0);before_state:=jsonb_build_object('stage',u.stage,'started',p.stage_started_at,'version',new_version,'planRevision',p.revision);
 perform set_config('app.production_action',p_order::text,true);perform public.production_refresh(p_order,f);select *into p from order_production_timelines where order_id=p_order and manufacturer_id=f;
 if length(reason)>1000 then raise exception 'Keep reasons under 1,000 characters';end if;
 if p_action in('advance','stage')then
 if exists(select 1 from jsonb_array_elements(p.blocks)b where b->>'resolved'is distinct from 'true')or coalesce((p.schedule->0->>'blocked')::boolean,false)then raise exception 'Resolve production blockers and prerequisites first';end if;
 if p_action='advance'then target:=(public.production_stages())[array_position(public.production_stages(),old_stage)+1];else target:=public.production_stage_key(p_data->>'stage');end if;
 if target is null or not(target=any(public.production_stages()))then raise exception 'Quality Control is the last production stage. Submit the QC report on its existing page';end if;
 if u.id is not null and target=old_stage then raise exception 'This stage is already current';end if;
 if array_position(public.production_stages(),target)>array_position(public.production_stages(),old_stage)+1 then raise exception 'Confirm each prerequisite stage in order; stages cannot be skipped';end if;
 if p_action='stage'and length(reason)<3 then raise exception 'Explain the status correction and schedule effect';end if;
 if coalesce((public.production_schedule(f,p.config,event_time,target,public.production_fact_values(p_order,f,p.facts),p.blocks)->0->>'blocked')::boolean,false)then raise exception 'The next stage has unresolved prerequisites. Update its timing factors first';end if;
 perform set_config('app.production_action',p_order::text,true);
 -- Actual movement is an explicit manufacturer confirmation, never a timer's assertion.
 insert into order_production_updates(order_id,manufacturer_id,submitted_by,version,stage,note,expected_completion,delay_reason)values(p_order,f,public.team_actor(),new_version+1,target,case when p_action='advance'then 'Completed '||replace(old_stage,'_',' ')||'; '||case when target='quality_control'then 'ready for QC submission'else 'started '||replace(target,'_',' ')end else reason end,null,case when p_action='stage'then reason else ''end)returning id into id;
 update order_production_timelines set stage_started_at=event_time,estimated_stage=null,override_completion=null,legacy_delay=null where order_id=p_order and manufacturer_id=f;kind:='manual';info:=case when p_action='advance'then 'Manufacturer confirmed '||replace(target,'_',' ')else 'Stage corrected: '||reason end;new_version:=new_version+1;
 elsif p_action in('delay','preview_delay')then
 if old_stage='quality_control' then raise exception 'Production is complete; use the QC workflow';end if;
 if length(reason)<3 then raise exception 'Enter a short reason for the delay';end if;
 if coalesce(p_data->>'days','')!~'^[1-9][0-9]*$'or(p_data->>'days')::numeric>3650 then raise exception 'Delay days must be a positive whole number, at most 3650';end if;
 block_item:=jsonb_build_object('id',p_request,'stage',old_stage,'stageStartedAt',p.stage_started_at,'days',(p_data->>'days')::integer,'reason',reason,'actor',public.team_actor(),'at',event_time,'unit','calendar_days');
 v_facts:=public.production_fact_values(p_order,f,p.facts)||jsonb_build_object('_stageDelays',p.stage_delays||jsonb_build_array(block_item));
 v_blocks:=public.production_schedule(f,p.config,p.stage_started_at,old_stage,v_facts,p.blocks);
 due:=(v_blocks->-1->>'end')::timestamptz;
 if p.override_completion is not null then due:=public.production_add_time(f,p.config,p.override_completion,(p_data->>'days')::numeric,'calendar_days');end if;
 if p_action='preview_delay'then return jsonb_build_object('current',p.expected_completion,'proposed',due,'stageCompletion',v_blocks->0->'end','schedule',v_blocks);end if;
 update order_production_timelines set stage_delays=stage_delays||jsonb_build_array(block_item),override_completion=case when override_completion is not null then due end,estimated_stage=null where order_id=p_order and manufacturer_id=f;
 kind:='block';info:=(p_data->>'days')||' calendar-day delay added to '||replace(old_stage,'_',' ')||': '||reason;
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
 update order_production_timelines set config=case when(p_data->>'enabled')::boolean then jsonb_set(config,'{stages}',(select jsonb_agg(value||jsonb_build_object('automatic',true))from jsonb_array_elements(config->'stages')))else config end,automation_paused=not(p_data->>'enabled')::boolean,estimated_stage=null where order_id=p_order and manufacturer_id=f;info:=case when(p_data->>'enabled')::boolean then 'Manufacturer resumed automatic estimates'else 'Manufacturer paused automatic estimates; confirmed work and manual updates remain available'end;
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
 target:=public.production_stage_key(e.details->'before'->>'stage');perform set_config('app.production_action',p_order::text,true);
 insert into order_production_updates(order_id,manufacturer_id,submitted_by,version,stage,note)values(p_order,f,public.team_actor(),new_version+1,target,'Undo of the last manual stage transition');
 update order_production_timelines set stage_started_at=(e.details->'before'->>'started')::timestamptz,estimated_stage=null where order_id=p_order and manufacturer_id=f;new_version:=new_version+1;kind:='undo';info:='Last manual stage transition undone; history retained';
 else raise exception 'Unknown production action';end if;
 update order_production_timelines set revision=revision+1,updated_at=event_time where order_id=p_order and manufacturer_id=f;
 perform public.production_refresh(p_order,f);
 insert into production_timeline_events(order_id,manufacturer_id,actor_id,kind,explanation,details,request_id,request_hash)values(p_order,f,public.team_actor(),kind,info,jsonb_build_object('completedStage',case when p_action='advance'then old_stage end,'completedAt',case when p_action='advance'then event_time end,'source','manual','before',before_state,'afterVersion',new_version,'afterRevision',p.revision+1,'data',p_data),p_request,req_hash)returning id into id;
 if p_action in('delay','block','pause','revise_block','resume','estimate','apply_rules','facts','advance','stage','undo')then
 select expected_completion into due from order_production_timelines where order_id=p_order and manufacturer_id=f;
 if p_action in('delay','advance','stage','undo','block','pause','revise_block','resume')or((p.expected_completion is null)<>(due is null))or abs(extract(epoch from(due-p.expected_completion)))>=86400 then
 perform public.notify_superadmin('order','Production schedule changed',o.product_name||' · '||info,'/superadmin/orders/'||p_order,p_order);
 insert into brand_notifications(user_id,category,title,body,href)values(o.user_id,'order','Production schedule update',o.product_name||' · '||info,'/orders/'||p_order);
 end if;end if;
 return jsonb_build_object('id',id,'version',new_version,'revision',p.revision+1,'undoAvailable',kind='manual'and u.id is not null,'saved',true);
end$$;
create or replace function public.production_bulk(p_orders jsonb,p_request uuid)returns integer language plpgsql security definer set search_path=public as $$
declare x jsonb;stage text;current_stage text;n integer:=0;begin
 if jsonb_typeof(p_orders)is distinct from 'array'or jsonb_array_length(p_orders)not between 1 and 100 or(select count(distinct value->>'id')from jsonb_array_elements(p_orders))<>jsonb_array_length(p_orders)then raise exception 'Select 1–100 distinct production orders';end if;
 -- Consistent lock order prevents deadlocks. A failed item rolls the entire batch back.
 for x in select value from jsonb_array_elements(p_orders)order by value->>'id'loop
 select public.production_stage_key(coalesce((select u.stage from order_production_updates u where u.order_id=(x->>'id')::uuid order by version desc limit 1),'preparation'))into current_stage;
 current_stage:=current_stage||':next';
 if stage is null then stage:=current_stage;elsif stage<>current_stage then raise exception 'Bulk updates require the same eligible next stage';end if;
 perform public.production_action((x->>'id')::uuid,'advance','{}',(x->>'revision')::integer,(x->>'version')::integer,p_request);n:=n+1;
 end loop;return n;end$$;
do $$declare d text;begin select pg_get_functiondef('public.team_impl_update_order_production(uuid,text,text,date,text,integer)'::regprocedure)into d;d:=replace(d,'''cutting'',''sewing'',''finishing''','''cutting'',''sewing'',''cutting_sewing'',''finishing''');execute d;end$$;
create or replace function public.production_update_guard()returns trigger language plpgsql security definer set search_path=public as $$
declare p order_production_timelines%rowtype;prior order_production_updates%rowtype;begin
 if current_setting('app.production_automatic',true)=new.order_id::text then return new;end if;
 if public.is_superadmin()then return new;end if;
 if not public.factory_has_permission(new.manufacturer_id,'production')or not public.factory_order_visible(new.order_id)then raise exception 'Assigned production permission required';end if;
 select *into p from order_production_timelines where order_id=new.order_id and manufacturer_id=new.manufacturer_id for update;
 select *into prior from order_production_updates where order_id=new.order_id and manufacturer_id=new.manufacturer_id order by version desc limit 1;
 if new.stage is distinct from prior.stage then
 if p.order_id is not null and coalesce((public.production_schedule(new.manufacturer_id,p.config,p.stage_started_at,coalesce(prior.stage,'preparation'),public.production_fact_values(new.order_id,new.manufacturer_id,p.facts),p.blocks)->0->>'blocked')::boolean,false)then raise exception 'Resolve current stage prerequisites before updating production';end if;
 if p.order_id is not null and coalesce((public.production_schedule(new.manufacturer_id,p.config,now(),new.stage,public.production_fact_values(new.order_id,new.manufacturer_id,p.facts),p.blocks)->0->>'blocked')::boolean,false)then raise exception 'Resolve stage prerequisites before updating production';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p.blocks,'[]'))b where b->>'resolved'is distinct from 'true')then raise exception 'Resolve production blockers first';end if;
 if array_position(public.production_stages(),public.production_stage_key(new.stage))>coalesce(array_position(public.production_stages(),public.production_stage_key(prior.stage)),case when current_setting('app.production_action',true)=new.order_id::text then 1 else 0 end)+1 then raise exception 'Confirm each prerequisite production stage in order';end if;
 if prior.id is not null and array_position(public.production_stages(),public.production_stage_key(new.stage))<array_position(public.production_stages(),public.production_stage_key(prior.stage))and length(btrim(new.note))<3 then raise exception 'Explain the backwards stage correction';end if;
 end if;return new;end$$;
revoke all on function public.production_stage_key(text)from public,anon;grant execute on function public.production_stage_key(text)to authenticated;
revoke all on function public.production_schedule(uuid,jsonb,timestamptz,text,jsonb,jsonb),public.production_fact_values(uuid,uuid,jsonb),public.production_validate_timeline(jsonb),public.production_refresh(uuid,uuid),public.production_ensure_plan(uuid),public.production_default_timeline(uuid)from public,anon,authenticated;

create or replace function public.production_scheduler()returns integer language plpgsql security definer set search_path=public as $$
declare row record;p order_production_timelines%rowtype;u order_production_updates%rowtype;current_stage text;target text;due timestamptz;ver integer;n integer:=0;attempt integer;info text;
begin
 for row in select o.id,o.assigned_manufacturer_id from orders o join order_production_timelines t on t.order_id=o.id and t.manufacturer_id=o.assigned_manufacturer_id where o.kind='production'and o.status='processing'and o.factory_status='in_production'and o.production_released_at is not null and o.qc_status not in('pending_review','approved')order by t.updated_at limit 250 for update of o skip locked loop
  for attempt in 1..3 loop
   perform set_config('app.production_action',row.id::text,true);
   perform public.production_refresh(row.id,row.assigned_manufacturer_id);
   select *into p from order_production_timelines where order_id=row.id and manufacturer_id=row.assigned_manufacturer_id for update;
   select *into u from order_production_updates where order_id=row.id and manufacturer_id=row.assigned_manufacturer_id order by version desc limit 1;
   current_stage:=public.production_stage_key(coalesce(u.stage,'preparation'));
   exit when current_stage='quality_control'or p.needs_review is not null or p.automation_paused or p.next_transition is null or p.next_transition>now();
   due:=p.next_transition;target:=(public.production_stages())[array_position(public.production_stages(),current_stage)+1];
   exit when target is null;
   -- Both current and next-stage dependencies must hold. QC itself is never auto-approved.
   exit when target<>'quality_control'and coalesce((public.production_schedule(p.manufacturer_id,p.config,due,target,public.production_fact_values(p.order_id,p.manufacturer_id,p.facts),p.blocks)->0->>'blocked')::boolean,false);
   ver:=coalesce(u.version,0)+1;
   perform set_config('app.production_automatic',row.id::text,true);
   info:='Completed '||replace(current_stage,'_',' ')||' automatically using the configured duration. '||case when target='quality_control'then 'Production ready for QC submission; QC approval is still required.'else 'Started '||replace(target,'_',' ')||'.'end;
   insert into order_production_updates(order_id,manufacturer_id,submitted_by,version,stage,note,created_at,source)values(p.order_id,p.manufacturer_id,p.manufacturer_id,ver,target,info,due,'automatic');
   update order_production_timelines set stage_started_at=due,estimated_stage=null,override_completion=null,revision=revision+1,updated_at=now()where order_id=p.order_id and manufacturer_id=p.manufacturer_id;
   insert into production_timeline_events(order_id,manufacturer_id,kind,explanation,details,dedupe)values(p.order_id,p.manufacturer_id,'automatic',info,jsonb_build_object('completedStage',current_stage,'completedAt',due,'startedStage',target,'executedAt',clock_timestamp(),'source','automatic','afterVersion',ver),'transition:'||ver||':'||current_stage||':'||due::text);
   perform public.production_refresh(p.order_id,p.manufacturer_id);
   if target='quality_control'then perform public.notify_superadmin('order','Production ready for Quality Control',info,'/superadmin/orders/'||p.order_id,p.order_id);end if;
   n:=n+1;
  end loop;
  update order_production_timelines set updated_at=now()where order_id=row.id and manufacturer_id=row.assigned_manufacturer_id;
  perform set_config('app.production_automatic','',true);
  perform set_config('app.production_action','',true);
 end loop;return n;
end$$;
revoke all on function public.production_scheduler()from public,anon,authenticated;grant execute on function public.production_scheduler()to service_role;

create or replace function public.production_effective_delay(p_order uuid,p_fallback text)returns text language sql stable security definer set search_path=public as $$select case when t.order_id is null then p_fallback else coalesce((select string_agg((b->>'days')||' calendar days: '||(b->>'reason'),'; ')from jsonb_array_elements(t.stage_delays)b),(select string_agg(b->>'reason','; ')from jsonb_array_elements(t.blocks)b where b->>'resolved'is distinct from 'true'),case when t.uncertain then coalesce(t.schedule->0->>'reason','Completion estimate is uncertain')end,t.legacy_delay)end from orders o left join order_production_timelines t on t.order_id=o.id and t.manufacturer_id=o.assigned_manufacturer_id where o.id=p_order$$;
revoke all on function public.production_effective_delay(uuid,text)from public,anon,authenticated;

-- Existing calendars accept the combined stage filter; historical events are left intact.
do $$declare d text;begin
 select pg_get_functiondef('public.team_impl_production_calendar(date,date,boolean,uuid,text,text,text,text,text)'::regprocedure)into d;
 d:=replace(d,'''cutting'',''sewing'',''finishing''','''cutting'',''sewing'',''cutting_sewing'',''finishing''');execute d;
end$$;
select public.apply_superadmin_access();
select cron.schedule('ceriga-production-timeline','*/5 * * * *','select public.production_scheduler();');
notify pgrst,'reload schema';
commit;
