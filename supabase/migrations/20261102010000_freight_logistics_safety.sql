-- Enforce logistics progression even for direct admin table writes. Preserve all previous events.
create or replace function public.freight_logistics_guard()returns trigger language plpgsql security definer set search_path=public as $$
declare o orders%rowtype;previous text;latest_status text;allowed text[];
begin
 select *into o from orders where id=new.order_id for update;
 if o.kind is distinct from 'production'or o.payment_verified_at is null or o.qc_status is distinct from 'approved'or o.status not in('processing','shipping')then raise exception 'Paid production and approved QC are required before shipping';end if;
 select status into previous from order_logistics_events where order_id=new.order_id and status<>'exception'order by created_at desc,id desc limit 1;
 select status into latest_status from order_logistics_events where order_id=new.order_id order by created_at desc,id desc limit 1;
 allowed:=case previous
 when 'collection_scheduled'then array['ready_for_collection','collected','in_transit','exception']
 when 'ready_for_collection'then array['collection_scheduled','collected','in_transit','exception']
 when 'collected'then array['in_transit','customs_clearance','out_for_delivery','exception']
 when 'in_transit'then array['customs_clearance','out_for_delivery','delivered','exception']
 when 'customs_clearance'then array['in_transit','out_for_delivery','delivered','exception']
 when 'out_for_delivery'then array['delivered','exception']
 when 'delivered'then array[]::text[]
 else array['collection_scheduled','ready_for_collection','collected','in_transit','exception']end;
 if latest_status='exception'and previous is not null then allowed:=array_prepend(previous,allowed);end if;
 if not(new.status=any(allowed))then raise exception 'Shipping changed or this transition would move backwards. Refresh and choose the next shipping status';end if;
 if new.status in('collected','in_transit','customs_clearance','out_for_delivery','delivered')and o.status<>'shipping'then raise exception 'Record the approved QC release handover before advancing tracking';end if;
 return new;
end$$;
revoke all on function public.freight_logistics_guard()from public,anon,authenticated;
drop trigger if exists freight_logistics_progression_guard on public.order_logistics_events;
create trigger freight_logistics_progression_guard before insert on public.order_logistics_events for each row execute function public.freight_logistics_guard();
