begin;
create or replace function public.wf_protect_order()returns trigger language plpgsql set search_path=public as $$
begin
 if current_user not in('authenticated','anon')or public.is_superadmin()then return new;end if;
 if tg_op='INSERT'then
  if new.status not in('submitted','awaiting_payment')or new.paid_amount_cents is not null or new.payment_verified_at is not null or new.production_released_at is not null or new.workflow_managed then raise exception 'Use the controlled order workflow';end if;
 elsif (to_jsonb(new)-array['updated_at','quote_request','specifications','order_quantities','contact_name','contact_email','contact_phone','delivery_address']) is distinct from(to_jsonb(old)-array['updated_at','quote_request','specifications','order_quantities','contact_name','contact_email','contact_phone','delivery_address'])then
  raise exception 'Use authorised order actions';
 elsif old.user_id is distinct from auth.uid()or old.status not in('submitted','awaiting_payment')or old.assigned_manufacturer_id is not null then raise exception 'Ask Ceriga to revise an assigned order';end if;
 return new;
end $$;
create or replace function public.portal_report(p_days integer default 30)returns jsonb language plpgsql security definer set search_path=public as $$
declare admin boolean:=public.is_superadmin();since_at timestamptz;result jsonb;
begin
 if auth.uid()is null or(not admin and not exists(select 1 from public.profiles where id=auth.uid()and role='manufacturer'))then raise exception 'Portal access required';end if;
 if p_days is null or p_days not between 1 and 3650 then raise exception 'Choose a reporting period between 1 and 3650 days';end if;
 since_at:=now()-make_interval(days=>p_days);
 with scoped as(select *from public.orders where created_at>=since_at and(admin or assigned_manufacturer_id=auth.uid())),
 pipeline as(select status,count(*) n from scoped group by status),
 monthly as(select to_char(created_at,'YYYY-MM') as "month",count(*) orders from scoped group by 1),
 payments as(select currency,sum(amount_cents)::text cents,count(*) payments from public.order_verified_payments where admin and provider_paid_at>=since_at group by currency),
 paid_monthly as(select to_char(provider_paid_at,'YYYY-MM') as "month",currency,sum(amount_cents)::text cents from public.order_verified_payments where admin and provider_paid_at>=since_at group by 1,2)
 select jsonb_build_object('days',p_days,'since',since_at,'generatedAt',now(),'admin',admin,'orders',(select count(*)from scoped),'production',(select count(*)from scoped where status='processing'),'completed',(select count(*)from scoped where status='completed'),'quotesSubmitted',(select count(*)from scoped where quoted_at is not null),'quoteDeadlineSamples',(select count(*)from scoped where quoted_at is not null and due_quote_by is not null),'quotesOnTime',(select count(*)from scoped where quoted_at is not null and due_quote_by is not null and quoted_at<due_quote_by::date+interval '1 day'),'awaitingAssignment',(select count(*)from scoped where assigned_manufacturer_id is null),'pendingQc',(select count(*)from scoped where qc_status='pending_review'),'changesRequired',(select count(*)from scoped where qc_status='changes_required'),'pipeline',coalesce((select jsonb_agg(to_jsonb(pipeline))from pipeline),'[]'),'monthlyOrders',coalesce((select jsonb_agg(to_jsonb(monthly)order by "month")from monthly),'[]'),'verifiedRevenue',coalesce((select jsonb_agg(to_jsonb(payment_row))from payments payment_row),'[]'),'monthlyVerifiedRevenue',coalesce((select jsonb_agg(to_jsonb(paid_monthly)order by "month")from paid_monthly),'[]'),'users',case when admin then(select count(*)from public.profiles where created_at>=since_at)else null end,'manufacturers',case when admin then(select count(*)from public.manufacturer_profiles)else null end,'unreadNotifications',(select count(*)from public.portal_notifications where read=false and((admin and audience='superadmin')or(not admin and audience='manufacturer'and user_id=auth.uid()))))into result;
 return result;
end $$;
revoke all on function public.portal_report(integer)from public,anon;grant execute on function public.portal_report(integer)to authenticated;
notify pgrst,'reload schema';
commit;
