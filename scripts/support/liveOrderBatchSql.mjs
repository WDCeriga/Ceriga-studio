export function phaseOneSql(manifest){
 const batch=JSON.stringify(manifest.orders);if(batch.includes('$ceriga_batch$'))throw Error('Invalid batch');
 return `begin;
do $$declare item jsonb;o public.orders%rowtype;factory uuid:='37b48b96-cc06-4b79-af77-890ff6d00153';factory_email text;admin_id uuid;admin_email text;target text;option jsonb;tiers jsonb;prices jsonb;unit integer;units integer;stage text;stages text[];version integer;report uuid;
begin
 select u.id,u.email into admin_id,admin_email from auth.users u join public.superadmin_emails a on lower(u.email)=lower(a.email)limit 1;
 if admin_id is null then raise exception 'An existing allowlisted admin is required';end if;
 select u.email into factory_email from auth.users u join public.manufacturer_profiles m on m.user_id=u.id where u.id=factory and m.onboarding_complete and m.status is distinct from 'paused';
 if factory_email is null then raise exception 'The selected existing manufacturer is unavailable';end if;
 for item in select value from jsonb_array_elements($ceriga_batch$${batch}$ceriga_batch$::jsonb)loop
  select *into o from public.orders where id=(item->>'id')::uuid for update;
  if not found or o.user_id<>(item->>'userId')::uuid or o.product_name<>item->>'product'or o.product_name not like 'TEST USER%'or o.status<>'submitted'or o.assigned_manufacturer_id is not null then raise exception 'Order changed or is outside this exact test batch: %',item->>'id';end if;
  target:=item->>'target';if target='Awaiting assignment'then continue;end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'email',admin_email,'role','authenticated')::text,true);
  perform public.assign_order_manufacturer(o.id,factory,current_date+3+(item->>'sequence')::integer%4);
  if target='Quotation requested'then continue;end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',factory,'email',factory_email,'role','authenticated')::text,true);
  if target='Reassignment required'then perform public.reject_order_quotation(o.id,'TEST — Factory cannot meet this test production window.');continue;end if;
  tiers:='[]';prices:='[]';
  for option in select value from jsonb_array_elements(jsonb_build_array(o.order_quantities->'sample')||coalesce(o.order_quantities->'bulkRuns','[]'))loop
   unit:=case when o.garment_type='Hoodies'then 2500 else 1200 end+case when option->>'kind'='sample'then 1200 else 0 end;units:=(option->>'targetTotal')::integer;
   tiers:=tiers||jsonb_build_array(jsonb_build_object('id',option->>'id','kind',option->>'kind','unitPriceCents',unit,'currency','EUR','leadTimeDays',10+(item->>'sequence')::integer%15));
   prices:=prices||jsonb_build_array(jsonb_build_object('id',option->>'id','cents',round(units*unit*1.3)));
  end loop;
  perform public.submit_manufacturer_quote(o.id,tiers);if target='Quotation awaiting admin review'then continue;end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'email',admin_email,'role','authenticated')::text,true);
  if target='Quotation revision requested'then perform public.review_manufacturer_quotation(o.id,'TEST — Please revise lead time and packaging costs.','revise');continue;end if;
  perform public.publish_order_quote(o.id,prices);if target='Awaiting customer submission'then continue;end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',o.user_id,'email',item->>'email','role','authenticated')::text,true);
  perform public.submit_order_to_manufacturer(o.id,item->>'option');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',factory,'email',factory_email,'role','authenticated')::text,true);
  stages:=array['preparation','cutting','sewing','finishing','quality_control'];version:=0;
  foreach stage in array stages loop
   perform public.update_order_production(o.id,stage,'TEST — Automated test-order production update.',current_date+5+(item->>'sequence')::integer%22,case when target='Production: sewing'then 'TEST — Fabric delivery needs review.'else ''end,version);version:=version+1;
   if target='Production: '||stage then exit;end if;
  end loop;
  if target like 'Production: %'or target='QC awaiting submission'then continue;end if;
  report:=public.qc_action(o.id,'start_report','{}');
 end loop;
end $$;
select status,factory_status,qc_status,count(*)from public.orders where id in(select(value->>'id')::uuid from jsonb_array_elements($ceriga_batch$${batch}$ceriga_batch$::jsonb))group by status,factory_status,qc_status order by status,factory_status,qc_status;
commit;
`;
}

export function phaseTwoSql(manifest){
 const jobs=manifest.orders.filter(o=>['QC pending review','QC changes required','Ready for dispatch','Shipping','Completed'].includes(o.target));const batch=JSON.stringify(jobs);
 return `begin;
 do $$declare item jsonb;o public.orders%rowtype;factory uuid:='37b48b96-cc06-4b79-af77-890ff6d00153';factory_email text;admin_id uuid;admin_email text;report uuid;release uuid;lines jsonb;target text;issue boolean;
 begin
 select u.id,u.email into admin_id,admin_email from auth.users u join public.superadmin_emails a on lower(u.email)=lower(a.email)limit 1;
 select email into factory_email from auth.users where id=factory;
 if admin_id is null or factory_email is null then raise exception 'Required actors unavailable';end if;
 for item in select value from jsonb_array_elements($ceriga_batch$${batch}$ceriga_batch$::jsonb)loop
 select *into o from public.orders where id=(item->>'id')::uuid for update;
 if not found or o.user_id<>(item->>'userId')::uuid or o.product_name<>item->>'product'or o.assigned_manufacturer_id<>factory or o.qc_status<>'not_submitted' or o.status<>'processing' then raise exception 'Test order changed: %',item->>'id';end if;
 target:=item->>'target';issue:=target='QC changes required';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',factory,'email',factory_email,'role','authenticated')::text,true);
 report:=public.qc_action(o.id,'start_report','{}');
 perform public.qc_action(o.id,'report_evidence',jsonb_build_object('id',report,'path',o.id::text||'/'||factory::text||'/TEST-production.png','file_name','TEST-production.png','file_role','photo'));
 select jsonb_agg(value||jsonb_build_object('produced',(value->>'ordered')::integer))into lines from jsonb_array_elements(public.qc_order_lines(o.id));
 perform public.qc_action(o.id,'submit_report',jsonb_build_object('id',report,'production_summary','TEST — Synthetic workflow report. Uploaded illustration is test evidence, not actual production.','produced_lines',lines,'has_issues',issue,'issue_description',case when issue then 'TEST — Printed alignment requires a corrected photo and inspection.'else ''end,'manufacturer_confirmed',true));
 if target='QC pending review'then continue;end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'email',admin_email,'role','authenticated')::text,true);
 if issue then perform public.qc_action(o.id,'request_report_changes',jsonb_build_object('id',report,'feedback','TEST — Correct print alignment and resubmit updated production photos.'));continue;end if;
 perform public.qc_action(o.id,'approve_report',jsonb_build_object('id',report,'feedback','TEST — Sample QC workflow approved; no actual goods.'));
 if target='Ready for dispatch'then continue;end if;
 select id into release from public.qc_shipment_releases where order_id=o.id and inspection_id=report and revoked_at is null and dispatched_at is null;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',factory,'email',factory_email,'role','authenticated')::text,true);
 perform public.qc_action(o.id,'dispatch',jsonb_build_object('id',release,'tracking','TEST-NO-CARRIER-'||left(o.id::text,8)));
 if target='Completed'then
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'email',admin_email,'role','authenticated')::text,true);
 perform public.confirm_order_delivery(o.id,'TEST — Simulated delivery for this test order only. No shipment booked.');
 end if;
 end loop;
 end $$;
 select status,qc_status,count(*)from public.orders where id in(select(value->>'id')::uuid from jsonb_array_elements($ceriga_batch$${batch}$ceriga_batch$::jsonb))group by status,qc_status;
 commit;`;
}
