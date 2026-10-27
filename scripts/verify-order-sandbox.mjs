import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {PGlite} from '../.tmp-workflow-test/node_modules/@electric-sql/pglite/dist/index.js';
import {asAccount} from './support/testDatabase.mjs';
const root=path.resolve(process.argv[2]||'.sandbox/order-batch-20261025');
if(!root.startsWith(path.resolve('.sandbox')+path.sep))throw Error('Choose a dedicated .sandbox batch');
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8')),db=new PGlite(path.join(root,'database'));
try{
 const count=async table=>Number((await db.query(`select count(*) n from public.${table}`)).rows[0].n);
 assert.equal(await count('orders'),40);assert.equal(await count('profiles'),5);assert.equal(await count('order_verified_payments'),0);
 assert.equal((await db.query("select count(*)::int n from public.orders where status='completed'")).rows[0].n,1);
 assert.equal((await db.query("select count(*)::int n from public.orders where qc_status='pending_review'")).rows[0].n,2);
 const completed=(await db.query("select id from public.orders where status='completed'")).rows[0].id;
 assert.equal((await db.query('select count(*)::int n from public.qc_inspections where order_id=$1',[completed])).rows[0].n,2);
 const evidence=(await db.query('select path,byte_size from public.qc_evidence')).rows;
 for(const file of evidence){const stat=await fs.stat(path.join(root,'storage','qc-evidence',file.path));assert.equal(stat.size,Number(file.byte_size));}
 for(const account of manifest.accounts){await asAccount(db,account.id,account.email);const rows=(await db.query('select id,user_id,assigned_manufacturer_id from public.account_orders')).rows;if(account.role==='brand'){assert.equal(rows.length,20);assert.ok(rows.every(o=>o.user_id===account.id));}else if(account.role==='manufacturer')assert.ok(rows.every(o=>o.assigned_manufacturer_id===account.id));else assert.equal(rows.length,40);}
 const summary={passed:true,persistedOrders:40,accounts:5,qcEvidenceFiles:evidence.length,completedOrderVersions:2,realPayments:0,accountIsolation:true};
 await fs.writeFile(path.join(root,'verification.json'),JSON.stringify(summary,null,2));console.log('PASS: reopened persistent database and verified '+JSON.stringify(summary));
}finally{await db.close();}
