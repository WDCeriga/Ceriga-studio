begin;
update public.platform_settings set value=jsonb_build_object('quietStartUTC',0,'quietEndUTC',0)||value where key='internal_workflow_reminders';
create or replace function public.internal_reminder_quiet(p_settings jsonb,p_at timestamptz default now())
returns boolean language sql immutable set search_path=pg_catalog as $$
 select case when coalesce((p_settings->>'quietStartUTC')::integer,0)=coalesce((p_settings->>'quietEndUTC')::integer,0)then false
 when (p_settings->>'quietStartUTC')::integer<(p_settings->>'quietEndUTC')::integer then extract(hour from p_at at time zone 'UTC')>=(p_settings->>'quietStartUTC')::integer and extract(hour from p_at at time zone 'UTC')<(p_settings->>'quietEndUTC')::integer
 else extract(hour from p_at at time zone 'UTC')>=(p_settings->>'quietStartUTC')::integer or extract(hour from p_at at time zone 'UTC')<(p_settings->>'quietEndUTC')::integer end
$$;
revoke all on function public.internal_reminder_quiet(jsonb,timestamptz)from public,anon,authenticated;
do $patch$
declare d text;
begin
 d:=pg_get_functiondef('public.internal_workflow_reminders()'::regprocedure);
 if position('public.internal_reminder_quiet'in d)=0 then
  d:=replace(d,'-- One notification per event','if public.internal_reminder_quiet(reminder_config,now())then return 0;end if; -- One notification per event');execute d;
 end if;
 d:=pg_get_functiondef('public.admin_workflow_health(jsonb)'::regprocedure);
 if position('Reminder settings changed'in d)=0 then
  d:=replace(d,'if p_settings is not null then',
  'if p_settings is not null then
   select value into reminder_config from public.platform_settings where key=''internal_workflow_reminders''for update;
   if p_settings->''_expected'' is distinct from reminder_config then raise exception ''Reminder settings changed. Reload before saving.''using errcode=''40001'';end if;
   p_settings:=p_settings-''_expected'';
   if coalesce(p_settings->>''quietStartUTC'','''')!~''^[0-9]+$''or coalesce(p_settings->>''quietEndUTC'','''')!~''^[0-9]+$''or(p_settings->>''quietStartUTC'')::integer not between 0 and 23 or(p_settings->>''quietEndUTC'')::integer not between 0 and 23 then raise exception ''Choose quiet hours from 0 to 23 UTC'';end if;');
  d:=replace(d,'''enabled'',''reviewHours'',''quoteHours'',''repeatHours'',''shippingDays''','''enabled'',''reviewHours'',''quoteHours'',''repeatHours'',''shippingDays'',''quietStartUTC'',''quietEndUTC''');
  execute d;
 end if;
end$patch$;
notify pgrst,'reload schema';
commit;
