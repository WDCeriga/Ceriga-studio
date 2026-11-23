-- Validate new or changed structured quantity plans without rewriting existing orders.
create or replace function public.validate_order_run_quantities()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  plan jsonb := new.order_quantities;
  sample jsonb := plan->'sample';
  bulk jsonb := plan->'bulkRuns';
  run jsonb;
  sizes jsonb;
  quantity numeric;
  target numeric;
  sample_units numeric := 0;
  run_index integer := 0;
begin
  if tg_op = 'UPDATE' and new.order_quantities is not distinct from old.order_quantities then
    return new;
  end if;
  if coalesce(plan->>'mode', '') not in ('custom_clothing', 'techpack') then
    return new;
  end if;
  if jsonb_typeof(sample) is distinct from 'object'
    or jsonb_typeof(bulk) is distinct from 'array' then
    raise exception 'A sample and bulk quantity plan is required' using errcode = '23514';
  end if;

  for run in select value from jsonb_array_elements(jsonb_build_array(sample) || bulk)
  loop
    if jsonb_typeof(run->'bySize') is distinct from 'object' then
      raise exception 'A size breakdown is required' using errcode = '23514';
    end if;
    if exists (
      select 1 from jsonb_each_text(run->'bySize') as entry(size, units)
      where entry.units is not null and entry.units !~ '^[0-9]{0,12}$'
    ) then
      raise exception 'Size quantities must be nonnegative whole numbers' using errcode = '23514';
    end if;
    select coalesce(sum(nullif(value, '')::numeric), 0),
           coalesce(jsonb_object_agg(key, coalesce(nullif(value, '')::numeric, 0)), '{}'::jsonb)
      into quantity, sizes from jsonb_each_text(run->'bySize');

    if run_index = 0 then
      sample_units := quantity;
      sample := jsonb_set(sample, '{bySize}', sizes);
    else
      if coalesce(run->>'targetTotal', '') !~ '^[0-9]{0,12}$' then
        raise exception 'Bulk quote quantities must be nonnegative whole numbers' using errcode = '23514';
      end if;
      target := coalesce(nullif(run->>'targetTotal', '')::numeric, 0);
      if greatest(quantity, target) < 1 then
        raise exception 'Each bulk quote needs at least 1 unit' using errcode = '23514';
      end if;
      run := jsonb_set(run, '{bySize}', sizes);
      run := jsonb_set(run, '{targetTotal}', to_jsonb(coalesce(nullif(target, 0), quantity)));
      bulk := jsonb_set(bulk, array[(run_index - 1)::text], run);
    end if;
    run_index := run_index + 1;
  end loop;

  if sample_units < 1 and run_index = 1 then
    raise exception 'Enter at least 1 sample or bulk unit' using errcode = '23514';
  end if;
  -- Quote and routing functions prefer targetTotal when present.
  sample := jsonb_set(sample, '{targetTotal}', to_jsonb(sample_units));
  new.order_quantities := jsonb_set(jsonb_set(plan, '{sample}', sample), '{bulkRuns}', bulk);
  return new;
end;
$$;

revoke all on function public.validate_order_run_quantities() from public, anon, authenticated;

drop trigger if exists validate_order_run_quantities on public.orders;
create trigger validate_order_run_quantities
before insert or update of order_quantities on public.orders
for each row execute function public.validate_order_run_quantities();
