begin;
create index if not exists order_verified_payments_paid_idx on public.order_verified_payments(provider_paid_at,currency);
create index if not exists orders_factory_created_idx on public.orders(assigned_manufacturer_id,created_at desc);
create index if not exists orders_created_status_idx on public.orders(created_at desc,status);
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
