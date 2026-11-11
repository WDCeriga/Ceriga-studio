create or replace function public.admin_statistics_insights(p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  current_report jsonb;
  end_at timestamp := now() at time zone 'UTC';
  period_length interval;
  start_at timestamp;
  previous_start timestamp;
  grain text;
  bucket_length interval;
  comparison jsonb;
  series jsonb;
begin
  if auth.uid() is null or not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;
  if p_days is null or p_days not between 1 and 3650 then
    raise exception 'Choose a reporting period between 1 and 3650 days';
  end if;

  current_report := public.portal_report(p_days);
  period_length := make_interval(days => p_days);
  start_at := (current_report->>'since')::timestamptz at time zone 'UTC';
  previous_start := start_at - period_length;
  grain := case when p_days <= 30 then 'day' when p_days <= 90 then 'week'
    when p_days <= 365 then 'month' else 'year' end;
  bucket_length := ('1 ' || grain)::interval;

  with scoped as (
    select status, quoted_at, due_quote_by from public.orders
    where created_at >= (previous_start at time zone 'UTC')
      and created_at < (start_at at time zone 'UTC')
  ), payments as (
    select currency, sum(amount_cents)::text as cents, count(*) as payments
    from public.order_verified_payments
    where provider_paid_at >= (previous_start at time zone 'UTC')
      and provider_paid_at < (start_at at time zone 'UTC')
    group by currency
  )
  select jsonb_build_object(
    'orders', count(*),
    'completed', count(*) filter (where status = 'completed'),
    'quoteDeadlineSamples', count(*) filter (where quoted_at is not null and due_quote_by is not null),
    'quotesOnTime', count(*) filter (where quoted_at < due_quote_by::date + interval '1 day'),
    'verifiedRevenue', coalesce((select jsonb_agg(to_jsonb(payment_row) order by currency) from payments payment_row), '[]')
  ) into comparison from scoped;

  with buckets as (
    select generate_series(date_trunc(grain, start_at), date_trunc(grain, end_at), bucket_length) as bucket
  ), aligned_orders as (
    select created_at >= (start_at at time zone 'UTC') as current_period,
      date_trunc(grain, (created_at at time zone 'UTC') +
        case when created_at < (start_at at time zone 'UTC') then period_length else interval '0' end) as bucket,
      status, quoted_at
    from public.orders
    where created_at >= (previous_start at time zone 'UTC') and created_at < (end_at at time zone 'UTC')
  ), totals as (
    select bucket,
      count(*) filter (where current_period) as orders,
      count(*) filter (where not current_period) as previous_orders,
      count(*) filter (where current_period and quoted_at is not null) as quotes,
      count(*) filter (where not current_period and quoted_at is not null) as previous_quotes,
      count(*) filter (where current_period and status = 'completed') as completed,
      count(*) filter (where not current_period and status = 'completed') as previous_completed
    from aligned_orders group by bucket
  )
  select jsonb_agg(jsonb_build_object(
    'date', to_char(b.bucket, 'YYYY-MM-DD'),
    'orders', coalesce(t.orders, 0), 'previousOrders', coalesce(t.previous_orders, 0),
    'quotes', coalesce(t.quotes, 0), 'previousQuotes', coalesce(t.previous_quotes, 0),
    'completed', coalesce(t.completed, 0), 'previousCompleted', coalesce(t.previous_completed, 0)
  ) order by b.bucket) into series
  from buckets b left join totals t using (bucket);

  return current_report || jsonb_build_object('comparison', comparison, 'trend', series, 'grain', grain);
end;
$$;

revoke all on function public.admin_statistics_insights(integer) from public, anon, authenticated;
grant execute on function public.admin_statistics_insights(integer) to authenticated;
notify pgrst, 'reload schema';
