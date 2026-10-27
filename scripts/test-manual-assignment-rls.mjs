// Isolated fixtures only; never connects to production.
// Runtime: npm install --prefix .tmp-workflow-test --no-save --package-lock=false @electric-sql/pglite@0.3.14
import fs from 'node:fs/promises';
import {PGlite} from '../.tmp-workflow-test/node_modules/@electric-sql/pglite/dist/index.js';
const {testDatabase}=await import('./support/testDatabase.mjs');
const db=await testDatabase();
await db.exec(`insert into auth.users(id,email)values('11111111-1111-1111-1111-111111111111','buyer@example.invalid'),('22222222-2222-2222-2222-222222222222','factory-a@example.invalid'),('33333333-3333-3333-3333-333333333333','factory-b@example.invalid'),('44444444-4444-4444-4444-444444444444','owner@ceriga.io');
insert into public.manufacturer_profiles(user_id,factory_name,onboarding_complete,status)values('22222222-2222-2222-2222-222222222222','Factory A',true,'active'),('33333333-3333-3333-3333-333333333333','Factory B',true,'active');
insert into public.orders(id,user_id,kind,product_name,garment_type,status,status_label,quote_request)values('55555555-5555-5555-5555-555555555555','11111111-1111-1111-1111-111111111111','production','Manual assignment test','Hoodies','submitted','Awaiting quote','{"storagePaths":["11111111-1111-1111-1111-111111111111/test/file.pdf"]}');
insert into storage.objects(bucket_id,name)values('order-uploads','11111111-1111-1111-1111-111111111111/test/file.pdf');
begin;set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","email":"buyer@example.invalid","role":"authenticated"}',true);
do $$declare denied boolean:=false;begin
 if exists(select 1 from public.account_orders where assigned_manufacturer_id is not null)then raise exception 'An order was automatically assigned';end if;
 begin update public.orders set assigned_manufacturer_id='22222222-2222-2222-2222-222222222222'where id='55555555-5555-5555-5555-555555555555';exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Customer self-assignment was permitted';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444","email":"owner@ceriga.io","role":"authenticated"}',true);
select public.assign_order_manufacturer('55555555-5555-5555-5555-555555555555','22222222-2222-2222-2222-222222222222',current_date+3);
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","email":"factory-a@example.invalid","role":"authenticated"}',true);
do $$begin if(select count(*)from public.account_orders)<>1 then raise exception 'Assigned factory cannot see the order';end if;if(select count(*)from storage.objects)<>1 then raise exception 'Assigned factory cannot read supporting files';end if;end $$;
select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333","email":"factory-b@example.invalid","role":"authenticated"}',true);
do $$begin if exists(select 1 from public.account_orders)or exists(select 1 from storage.objects)then raise exception 'Unassigned factory can see private order/files';end if;end $$;
rollback;`);
console.log('PASS: new orders remain unassigned, customer cannot self-assign, exact-email admin assigns, selected manufacturer sees order/files, other manufacturers isolated');
await db.close();
