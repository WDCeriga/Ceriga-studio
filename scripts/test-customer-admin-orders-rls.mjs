// Isolated fixtures only; never connects to production.
// Runtime: npm install --prefix .tmp-workflow-test --no-save --package-lock=false @electric-sql/pglite@0.3.14
import fs from 'node:fs/promises';
import {PGlite} from '../.tmp-workflow-test/node_modules/@electric-sql/pglite/dist/index.js';
const {testDatabase}=await import('./support/testDatabase.mjs');
const db=await testDatabase();
await db.exec(`insert into auth.users(email)values('buyer1@example.invalid'),('buyer2@example.invalid'),('owner@ceriga.io');
insert into public.orders(user_id,kind,product_name,garment_type,status,status_label)select id,'production','Customer saved order','Hoodies','submitted','Awaiting quote'from auth.users where email='buyer1@example.invalid';`);
await db.exec(await fs.readFile('supabase/verify_customer_admin_orders.sql','utf8'));
console.log('PASS canonical RLS: customer isolation, own saved order, allowlisted admin visibility, empty lookup; rollback verification');
await db.close();
