-- Accept a core shipping quote without inventing freight measurements or terms.
create or replace function public.freight_validate(p jsonb)returns jsonb language plpgsql immutable set search_path=public as $$begin
 if jsonb_typeof(p)is distinct from 'object' or coalesce(p->>'currency','')not in('EUR','USD','GBP')or coalesce(p->>'priceCents','')!~'^[0-9]+$'or(p->>'priceCents')::numeric>100000000000 then raise exception 'Enter a valid shipping amount and currency';end if;
 if not (p ?| array['insurance','services','tradeTerms','transitDays','cartons','weightKg','lengthCm','widthCm','heightCm','validUntil']) then
  if exists(select 1 from unnest(array['provider','method','origin','destination']) k
    where jsonb_typeof(p->k) is distinct from 'string' or length(trim(p->>k)) not between 1 and 2000)
  then raise exception 'Complete shipping provider, method, origin and destination'; end if;
  return jsonb_build_object('priceCents',(p->>'priceCents')::bigint,'currency',p->>'currency',
    'provider',trim(p->>'provider'),'method',trim(p->>'method'),
    'origin',trim(p->>'origin'),'destination',trim(p->>'destination'));
 end if;
 if exists(select 1 from unnest(array['provider','method','origin','destination','insurance','services','tradeTerms'])k where length(trim(coalesce(p->>k,'')))not between 1 and 2000)then raise exception 'Complete provider, method, route, insurance, services and duty terms';end if;
 if coalesce(p->>'transitDays','')!~'^[1-9][0-9]*$'or(p->>'transitDays')::numeric>3650 or coalesce(p->>'cartons','')!~'^[1-9][0-9]*$'or(p->>'cartons')::numeric>1000000 then raise exception 'Enter valid transit days and carton count';end if;
 if exists(select 1 from unnest(array['weightKg','lengthCm','widthCm','heightCm'])k where coalesce(p->>k,'')!~'^[0-9]+(\.[0-9]{1,3})?$'or(p->>k)::numeric<=0 or(p->>k)::numeric>1000000)then raise exception 'Enter positive shipment weight and carton dimensions';end if;
 if coalesce(p->>'validUntil','')!~'^\d{4}-\d{2}-\d{2}$'then raise exception 'Enter shipping quote validity';end if;
 perform(p->>'validUntil')::date;
 return jsonb_build_object('priceCents',(p->>'priceCents')::bigint,'currency',p->>'currency','provider',p->>'provider','method',p->>'method','origin',p->>'origin','destination',p->>'destination','insurance',p->>'insurance','services',p->>'services','tradeTerms',p->>'tradeTerms','transitDays',(p->>'transitDays')::integer,'cartons',(p->>'cartons')::integer,'weightKg',(p->>'weightKg')::numeric,'lengthCm',(p->>'lengthCm')::numeric,'widthCm',(p->>'widthCm')::numeric,'heightCm',(p->>'heightCm')::numeric,'validUntil',p->>'validUntil');
end$$;
revoke all on function public.freight_validate(jsonb)from public,anon,authenticated;
