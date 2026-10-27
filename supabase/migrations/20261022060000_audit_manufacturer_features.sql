begin;
alter table public.manufacturer_profiles add column if not exists profile_details jsonb not null default '{}';
create or replace function public.sync_factory_profile_details()returns trigger language plpgsql set search_path=public as $$begin
 new.profile_details:=(new.profile_details-array['verification','portfolio','pricing','status','commission_plan_id'])||jsonb_build_object('factoryName',new.factory_name,'contactName',coalesce(new.contact_name,''),'contactEmail',coalesce(new.contact_email,''),'contactPhone',coalesce(new.contact_phone,''),'website',coalesce(new.website,''),'addressLine',coalesce(new.address_line,''),'city',coalesce(new.city,''),'country',coalesce(new.country,''),'garments',new.garments,'generalMoq',new.moq,'monthlyCapacity',new.monthly_capacity,'shippingDestinations',new.shipping_regions,'onboardingComplete',new.onboarding_complete,'updatedAt',now());return new;
end $$;
drop trigger if exists zz_factory_profile_details_sync on public.manufacturer_profiles;
create trigger zz_factory_profile_details_sync before insert or update on public.manufacturer_profiles for each row execute function public.sync_factory_profile_details();
revoke all on function public.sync_factory_profile_details()from public,anon,authenticated;
create or replace function public.save_manufacturer_profile(p_profile jsonb,p_complete boolean default false)returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();details jsonb;category text;capacity numeric;moq_value numeric;
begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and role='manufacturer')then raise exception 'A manufacturer account is required';end if;
 if jsonb_typeof(p_profile)is distinct from 'object'or octet_length(p_profile::text)>500000 then raise exception 'Invalid factory profile';end if;
 details:=p_profile-array['verification','portfolio','pricing','status','commission_plan_id','userId'];
 if p_complete then
  if length(btrim(coalesce(p_profile->>'factoryName','')))<1 or length(btrim(coalesce(p_profile->>'contactName','')))<1 or coalesce(p_profile->>'contactEmail','')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'or length(btrim(coalesce(p_profile->>'contactPhone','')))<1 or length(btrim(coalesce(p_profile->>'country','')))<1 or length(btrim(coalesce(p_profile->>'city','')))<1 then raise exception 'Complete factory name, contact, valid email, phone, country and city';end if;
  if jsonb_array_length(coalesce(p_profile->'manufacturerTypes','[]'))<1 or jsonb_array_length(coalesce(p_profile->'garments','[]'))<1 or jsonb_array_length(coalesce(p_profile->'shippingMethods','[]'))<1 or jsonb_array_length(coalesce(p_profile->'shippingDestinations','[]'))<1 or coalesce(p_profile->'capabilitiesMap','{}')='{}'then raise exception 'Select manufacturer type, garments, capabilities, shipping methods and destinations';end if;
  for category in select jsonb_array_elements_text(p_profile->'garments')loop if coalesce(p_profile->'garmentDetails'->category->>'confirmed','false')<>'true'then raise exception 'Confirm the specifications for every selected garment';end if;end loop;
  if coalesce(p_profile->>'generalMoq','')!~'^[1-9][0-9]*$'or coalesce(p_profile->>'monthlyCapacity','')!~'^[1-9][0-9]*$'then raise exception 'MOQ and capacity must be positive whole numbers';end if;
  foreach category in array array['sample','bulk']loop
   if coalesce(p_profile->>(category||'LeadTimeMinDays'),'')!~'^[1-9][0-9]*$'or coalesce(p_profile->>(category||'LeadTimeMaxDays'),'')!~'^[1-9][0-9]*$'then raise exception 'Enter valid sample and bulk lead-time ranges';end if;
   if(p_profile->>(category||'LeadTimeMinDays'))::integer>(p_profile->>(category||'LeadTimeMaxDays'))::integer or(p_profile->>(category||'LeadTimeMaxDays'))::integer>3650 then raise exception 'Lead-time ranges must be ordered and no greater than 3650 days';end if;
  end loop;
 end if;
 if coalesce(p_profile->>'monthlyCapacity','')~'^[0-9]+$'then capacity:=(p_profile->>'monthlyCapacity')::numeric;end if;
 if coalesce(p_profile->>'generalMoq','')~'^[0-9]+$'then moq_value:=(p_profile->>'generalMoq')::numeric;end if;
 if capacity>1000000000 or moq_value>1000000000 then raise exception 'Factory quantities exceed supported limits';end if;
 if coalesce(p_profile->>'currentAvailableMonthlyCapacity','')~'^[0-9]+$'and(p_profile->>'currentAvailableMonthlyCapacity')::numeric>capacity then raise exception 'Available capacity cannot exceed monthly capacity';end if;
 insert into public.manufacturer_profiles(user_id,factory_name,contact_name,contact_email,contact_phone,website,address_line,city,country,garments,capabilities,shipping_regions,moq,monthly_capacity,onboarding_complete,profile_details)
 values(uid,coalesce(nullif(btrim(p_profile->>'factoryName'),''),'My factory'),p_profile->>'contactName',p_profile->>'contactEmail',p_profile->>'contactPhone',p_profile->>'website',p_profile->>'addressLine',p_profile->>'city',p_profile->>'country',array(select jsonb_array_elements_text(coalesce(p_profile->'garments','[]'))),array(select jsonb_object_keys(coalesce(p_profile->'capabilitiesMap','{}'))),array(select jsonb_array_elements_text(coalesce(p_profile->'shippingDestinations','[]'))),coalesce(moq_value,50),coalesce(capacity,0),p_complete,details||jsonb_build_object('updatedAt',now()))
 on conflict(user_id)do update set factory_name=excluded.factory_name,contact_name=excluded.contact_name,contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,website=excluded.website,address_line=excluded.address_line,city=excluded.city,country=excluded.country,garments=excluded.garments,capabilities=excluded.capabilities,shipping_regions=excluded.shipping_regions,moq=excluded.moq,monthly_capacity=excluded.monthly_capacity,onboarding_complete=public.manufacturer_profiles.onboarding_complete or p_complete,profile_details=excluded.profile_details;
 return uid;
end $$;
revoke all on function public.save_manufacturer_profile(jsonb,boolean)from public,anon;
grant execute on function public.save_manufacturer_profile(jsonb,boolean)to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('manufacturer-assets','manufacturer-assets',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])on conflict(id)do nothing;
drop policy if exists manufacturer_assets_owner on storage.objects;
create policy manufacturer_assets_owner on storage.objects for all to authenticated using(bucket_id='manufacturer-assets'and((storage.foldername(name))[1]=auth.uid()::text or public.is_superadmin()))with check(bucket_id='manufacturer-assets'and((storage.foldername(name))[1]=auth.uid()::text or public.is_superadmin()));
create table if not exists public.manufacturer_portfolio_items(
 id uuid primary key default gen_random_uuid(),manufacturer_id uuid not null references public.manufacturer_profiles(user_id)on delete cascade,
 title text not null check(length(btrim(title))between 1 and 200),garment_type text not null,description text not null default ''check(length(description)<=6000),materials text not null default '',gsm integer check(gsm between 1 and 5000),methods text[]not null default '{}',image_paths text[]not null default '{}',
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists manufacturer_portfolio_owner_idx on public.manufacturer_portfolio_items(manufacturer_id,created_at desc);
alter table public.manufacturer_portfolio_items enable row level security;
drop policy if exists portfolio_owner_read on public.manufacturer_portfolio_items;
create policy portfolio_owner_read on public.manufacturer_portfolio_items for select to authenticated using(manufacturer_id=auth.uid());
create or replace function public.save_portfolio_item(p_item jsonb,p_id uuid default null,p_version integer default null)returns uuid language plpgsql security definer set search_path=public as $$
declare row public.manufacturer_portfolio_items%rowtype;paths text[];path text;
begin
 if auth.uid()is null or not exists(select 1 from public.manufacturer_profiles where user_id=auth.uid())then raise exception 'A manufacturer account is required';end if;
 paths:=array(select jsonb_array_elements_text(coalesce(p_item->'image_paths','[]')));
 if cardinality(paths)>20 then raise exception 'Use no more than 20 images';end if;
 foreach path in array paths loop if split_part(path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='manufacturer-assets'and name=path and metadata->>'mimetype'in('image/jpeg','image/png','image/webp'))then raise exception 'Portfolio images must be valid uploads belonging to your factory';end if;end loop;
 if p_id is null then
  insert into public.manufacturer_portfolio_items(manufacturer_id,title,garment_type,description,materials,gsm,methods,image_paths)values(auth.uid(),btrim(p_item->>'title'),coalesce(p_item->>'garment_type',''),coalesce(p_item->>'description',''),coalesce(p_item->>'materials',''),nullif(p_item->>'gsm','')::integer,array(select jsonb_array_elements_text(coalesce(p_item->'methods','[]'))),paths)returning *into row;
 else
  select *into row from public.manufacturer_portfolio_items where id=p_id for update;
  if not found or row.manufacturer_id<>auth.uid()then raise exception 'Portfolio item not found';end if;
  if p_version is distinct from row.version then raise exception 'This item changed on another device; refresh before saving';end if;
  update public.manufacturer_portfolio_items set title=btrim(p_item->>'title'),garment_type=coalesce(p_item->>'garment_type',''),description=coalesce(p_item->>'description',''),materials=coalesce(p_item->>'materials',''),gsm=nullif(p_item->>'gsm','')::integer,methods=array(select jsonb_array_elements_text(coalesce(p_item->'methods','[]'))),image_paths=paths,version=version+1,updated_at=now()where id=p_id;
 end if;
 return row.id;
end $$;
revoke all on function public.save_portfolio_item(jsonb,uuid,integer)from public,anon;
grant execute on function public.save_portfolio_item(jsonb,uuid,integer)to authenticated;
create or replace function public.remove_portfolio_item(p_id uuid,p_version integer)returns uuid language plpgsql security definer set search_path=public as $$begin
 delete from public.manufacturer_portfolio_items where id=p_id and manufacturer_id=auth.uid()and version=p_version;
 if not found then raise exception 'Item unavailable or changed; refresh and try again';end if;return p_id;
end $$;
revoke all on function public.remove_portfolio_item(uuid,integer)from public,anon;
grant execute on function public.remove_portfolio_item(uuid,integer)to authenticated;

create table if not exists public.manufacturer_verification_submissions(
 id uuid primary key default gen_random_uuid(),manufacturer_id uuid not null references public.manufacturer_profiles(user_id)on delete cascade,version integer not null,
 registration_number text not null check(length(btrim(registration_number))between 1 and 200),registered_address text not null check(length(btrim(registered_address))between 1 and 2000),certifications text[]not null default '{}',document_paths text[]not null,
 status text not null default 'pending_review'check(status in('pending_review','verified','changes_required')),submitted_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid references auth.users(id)on delete set null,feedback text,
 unique(manufacturer_id,version));
create index if not exists verification_pending_idx on public.manufacturer_verification_submissions(status,submitted_at);
alter table public.manufacturer_verification_submissions enable row level security;
drop policy if exists verification_owner_read on public.manufacturer_verification_submissions;
create policy verification_owner_read on public.manufacturer_verification_submissions for select to authenticated using(manufacturer_id=auth.uid());
create or replace function public.submit_factory_verification(p_registration text,p_address text,p_certifications text[],p_documents text[])returns uuid language plpgsql security definer set search_path=public as $$
declare previous public.manufacturer_verification_submissions%rowtype;result uuid;path text;
begin
 perform 1 from public.manufacturer_profiles where user_id=auth.uid()for update;if not found then raise exception 'A manufacturer account is required';end if;
 select *into previous from public.manufacturer_verification_submissions where manufacturer_id=auth.uid()order by version desc limit 1;
 if previous.status='pending_review'then
  if(previous.registration_number,previous.registered_address,previous.document_paths)is not distinct from(btrim(p_registration),btrim(p_address),p_documents)then return previous.id;end if;
  raise exception 'A verification submission is already pending review';
 end if;
 if cardinality(p_documents)not between 1 and 20 or p_documents is null then raise exception 'Attach 1–20 supporting documents';end if;
 foreach path in array p_documents loop if split_part(path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='manufacturer-assets'and name=path and metadata->>'mimetype'in('image/jpeg','image/png','image/webp','application/pdf'))then raise exception 'Upload valid documents belonging to your factory';end if;end loop;
 insert into public.manufacturer_verification_submissions(manufacturer_id,version,registration_number,registered_address,certifications,document_paths)values(auth.uid(),coalesce(previous.version,0)+1,btrim(p_registration),btrim(p_address),coalesce(p_certifications,'{}'),p_documents)returning id into result;
 perform public.notify_superadmin('system','Factory verification ready for review',(select factory_name from public.manufacturer_profiles where user_id=auth.uid()),'/superadmin/manufacturers/'||auth.uid(),null);
 return result;
end $$;
revoke all on function public.submit_factory_verification(text,text,text[],text[])from public,anon;
grant execute on function public.submit_factory_verification(text,text,text[],text[])to authenticated;
create or replace function public.review_factory_verification(p_id uuid,p_approved boolean,p_feedback text default '')returns uuid language plpgsql security definer set search_path=public as $$
declare row public.manufacturer_verification_submissions%rowtype;
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 select *into row from public.manufacturer_verification_submissions where id=p_id for update;
 if not found or row.status<>'pending_review'then raise exception 'Only a pending submission can be reviewed';end if;
 if row.manufacturer_id=auth.uid()then raise exception 'You cannot review your own factory verification';end if;
 if p_approved is null or(not p_approved and length(btrim(coalesce(p_feedback,'')))<3)or length(coalesce(p_feedback,''))>6000 then raise exception 'Provide feedback when requesting changes';end if;
 update public.manufacturer_verification_submissions set status=case when p_approved then 'verified'else 'changes_required'end,reviewed_at=now(),reviewed_by=auth.uid(),feedback=btrim(p_feedback)where id=p_id;
 perform public.notify_manufacturer(row.manufacturer_id,'system',case when p_approved then 'Factory verified'else 'Verification changes requested'end,p_feedback,'/manufacturer/verification',null);return p_id;
end $$;
revoke all on function public.review_factory_verification(uuid,boolean,text)from public,anon;
grant execute on function public.review_factory_verification(uuid,boolean,text)to authenticated;

create table if not exists public.manufacturer_availability(
 id uuid primary key default gen_random_uuid(),manufacturer_id uuid not null references public.manufacturer_profiles(user_id)on delete cascade,kind text not null check(kind in('capacity_block','time_off')),
 starts_on date not null,ends_on date not null,reason text not null check(length(btrim(reason))between 1 and 2000),status text not null check(status in('pending','approved','declined','withdrawn')),
 created_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid references auth.users(id)on delete set null,feedback text,
 check(ends_on>=starts_on and ends_on<=starts_on+365));
create index if not exists factory_availability_owner_dates on public.manufacturer_availability(manufacturer_id,starts_on,ends_on)where status='approved';
create index if not exists factory_availability_pending on public.manufacturer_availability(status,created_at);
alter table public.manufacturer_availability enable row level security;
drop policy if exists availability_owner_read on public.manufacturer_availability;
create policy availability_owner_read on public.manufacturer_availability for select to authenticated using(manufacturer_id=auth.uid());
create or replace function public.request_factory_availability(p_kind text,p_start date,p_end date,p_reason text)returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if auth.uid()is null or not exists(select 1 from public.manufacturer_profiles where user_id=auth.uid())then raise exception 'A manufacturer account is required';end if;
 if p_kind not in('time_off','capacity_block')or p_start is null or p_start<current_date or p_end is null then raise exception 'Choose valid future availability dates';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_kind||p_start::text,0));
 select id into result from public.manufacturer_availability where manufacturer_id=auth.uid()and kind=p_kind and starts_on=p_start and ends_on=p_end and status in('pending','approved');if found then return result;end if;
 insert into public.manufacturer_availability(manufacturer_id,kind,starts_on,ends_on,reason,status)values(auth.uid(),p_kind,p_start,p_end,btrim(p_reason),case when p_kind='capacity_block'then 'approved'else 'pending'end)returning id into result;
 perform public.notify_superadmin('capacity',case when p_kind='time_off'then 'Factory time off requested'else 'Factory capacity blocked'end,p_reason,'/superadmin/time-off',null);return result;
end $$;
revoke all on function public.request_factory_availability(text,date,date,text)from public,anon;
grant execute on function public.request_factory_availability(text,date,date,text)to authenticated;
create or replace function public.review_factory_availability(p_id uuid,p_approved boolean,p_feedback text default '')returns uuid language plpgsql security definer set search_path=public as $$
declare row public.manufacturer_availability%rowtype;
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 select *into row from public.manufacturer_availability where id=p_id for update;
 if not found or row.status<>'pending'or p_approved is null then raise exception 'Only pending time off can be reviewed';end if;
 if not p_approved and length(btrim(coalesce(p_feedback,'')))<3 then raise exception 'Give a reason for declining';end if;
 update public.manufacturer_availability set status=case when p_approved then 'approved'else 'declined'end,reviewed_at=now(),reviewed_by=auth.uid(),feedback=p_feedback where id=p_id;
 perform public.notify_manufacturer(row.manufacturer_id,'capacity',case when p_approved then 'Time off approved'else 'Time off declined'end,p_feedback,'/manufacturer/capacity',null);return p_id;
end $$;
revoke all on function public.review_factory_availability(uuid,boolean,text)from public,anon;
grant execute on function public.review_factory_availability(uuid,boolean,text)to authenticated;
create or replace function public.withdraw_factory_availability(p_id uuid)returns uuid language plpgsql security definer set search_path=public as $$begin
 update public.manufacturer_availability set status='withdrawn'where id=p_id and manufacturer_id=auth.uid()and(status in('pending','declined')or kind='capacity_block');if not found then raise exception 'This availability record cannot be withdrawn';end if;return p_id;
end $$;
revoke all on function public.withdraw_factory_availability(uuid)from public,anon;
grant execute on function public.withdraw_factory_availability(uuid)to authenticated;
do $$declare d text;begin
 select pg_get_functiondef('public.check_factory_assignment(uuid,uuid,date)'::regprocedure)into d;
 if position('manufacturer_availability'in d)=0 then d:=replace(d,'select * into o from public.orders',
 'if exists(select 1 from public.manufacturer_availability where manufacturer_id=p_factory and status=''approved''and(current_date between starts_on and ends_on or p_due between starts_on and ends_on))then raise exception ''Factory is unavailable during this assignment window'';end if; select * into o from public.orders');execute d;end if;
end $$;

create or replace function public.dismiss_portal_notifications(p_audience text,p_id uuid default null)returns integer language plpgsql security definer set search_path=public as $$
declare removed integer;
begin
 if auth.uid()is null or p_audience not in('manufacturer','superadmin')or(p_audience='superadmin'and not public.is_superadmin())then raise exception 'Notification access denied';end if;
 delete from public.portal_notifications where audience=p_audience and(p_id is null or id=p_id)and(p_audience='superadmin'or user_id=auth.uid());get diagnostics removed=row_count;return removed;
end $$;
revoke all on function public.dismiss_portal_notifications(text,uuid)from public,anon;
grant execute on function public.dismiss_portal_notifications(text,uuid)to authenticated;
create index if not exists portal_notifications_unread_idx on public.portal_notifications(audience,user_id,created_at desc)where not read;
-- Retain documents referenced by historical verification decisions.
drop policy if exists manufacturer_assets_owner on storage.objects;
drop policy if exists manufacturer_assets_read on storage.objects;
create policy manufacturer_assets_read on storage.objects for select to authenticated using(bucket_id='manufacturer-assets'and((storage.foldername(name))[1]=auth.uid()::text or public.is_superadmin()));
drop policy if exists manufacturer_assets_upload on storage.objects;
create policy manufacturer_assets_upload on storage.objects for insert to authenticated with check(bucket_id='manufacturer-assets'and((storage.foldername(name))[1]=auth.uid()::text or public.is_superadmin()));
drop policy if exists manufacturer_assets_remove_unused on storage.objects;
create policy manufacturer_assets_remove_unused on storage.objects for delete to authenticated using(bucket_id='manufacturer-assets'and(public.is_superadmin()or((storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.manufacturer_verification_submissions v where name=any(v.document_paths))and not exists(select 1 from public.manufacturer_portfolio_items p where name=any(p.image_paths)))));
select public.apply_superadmin_access();
notify pgrst,'reload schema';
commit;
