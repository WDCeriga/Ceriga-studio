begin;
create or replace function public.review_manufacturer_quotation(p_order_id uuid,p_reason text,p_next_action text)
returns text language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;next_state text;
begin
 if not public.is_superadmin()then raise exception 'Superadmin authorization required';end if;
 if p_next_action not in('revise','reassign')or p_next_action is null then raise exception 'Choose revised quotation or another manufacturer';end if;
 if length(btrim(coalesce(p_reason,'')))not between 3 and 2000 then raise exception 'Give a reason between 3 and 2000 characters';end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.kind<>'production'or o.assigned_manufacturer_id is null or o.factory_status is distinct from 'quoted'then raise exception 'Only a received manufacturer quotation can be rejected';end if;
 if o.status not in('submitted','awaiting_payment')or o.production_released_at is not null or o.payment_verified_at is not null or o.paid_amount_cents is not null or o.offer_issued_at is not null then raise exception 'Issued customer quotations and released or paid orders cannot be rejected here';end if;
 next_state:=case when p_next_action='revise'then 'clarifying'else 'rejected'end;
 perform set_config('app.routing_write',p_order_id::text,true);perform set_config('app.workflow_write',p_order_id::text,true);perform set_config('app.routing_action','manufacturer_quotation_rejected',true);
 insert into public.order_routing_events(order_id,actor_id,event_type,manufacturer_id,details)values(p_order_id,auth.uid(),'manufacturer_quotation_rejected',o.assigned_manufacturer_id,jsonb_build_object('reason',btrim(p_reason),'nextAction',p_next_action,'previousManufacturerQuote',o.manufacturer_quote,'previousQuotedAt',o.quoted_at,'previousPriceOptions',o.price_options));
 update public.orders set factory_status=next_state,factory_reject_reason=btrim(p_reason),manufacturer_quote=null,quoted_at=null,price_options=null,priced_at=null,selected_price_option_id=null,quote_expires_at=null,status='submitted',status_label=case when p_next_action='revise'then 'Revised manufacturer quotation requested'else 'Awaiting manufacturer reassignment'end where id=p_order_id;
 perform public.notify_manufacturer(o.assigned_manufacturer_id,'order',case when p_next_action='revise'then 'Revised quotation requested'else 'Quotation rejected'end,btrim(p_reason),'/manufacturer/orders/'||p_order_id,p_order_id);
 return p_next_action;
end $$;
revoke all on function public.review_manufacturer_quotation(uuid,text,text)from public,anon;
grant execute on function public.review_manufacturer_quotation(uuid,text,text)to authenticated;
notify pgrst,'reload schema';
commit;
