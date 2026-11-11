import assert from 'node:assert/strict';import fs from 'node:fs/promises';import{testDatabase,asAccount}from'./support/testDatabase.mjs';
const db=await testDatabase();const factory='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222',admin='33333333-3333-3333-3333-333333333333';
try{
for(const[id,email]of[[factory,'factory@example.invalid'],[other,'other@example.invalid'],[admin,'owner@ceriga.io']])await db.query('insert into auth.users(id,email)values($1,$2)',[id,email]);
for(const id of[factory,other])await db.query("insert into manufacturer_profiles(user_id,factory_name,onboarding_complete,status)values($1,'Batch test factory',true,'active')",[id]);
const paths=Array.from({length:100},(_,i)=>factory+'/batch/'+i+'.webp');for(const path of paths)await db.query("insert into storage.objects(bucket_id,name,metadata)values('manufacturer-assets',$1,'{\"mimetype\":\"image/webp\"}')",[path]);
await asAccount(db,factory);const save=async(item,id=null,version=null)=>(await db.query('select public.save_portfolio_item($1,$2,$3) id',[JSON.stringify(item),id,version])).rows[0].id;
assert.equal((await db.query('select * from manufacturer_portfolio_items')).rows.length,0);
const item={title:'Folder batch',garment_type:'T-shirts',description:'General batch comment',image_paths:paths,image_comments:{[paths[0]]:'Stitching detail',[paths[99]]:'Final photo'}};
const id=await save(item);let row=(await db.query('select * from manufacturer_portfolio_items where id=$1',[id])).rows[0];assert.equal(row.image_paths.length,100);assert.deepEqual(row.image_comments,item.image_comments);assert.equal(row.description,item.description);
await assert.rejects(save({...item,image_paths:[...paths,'extra']}),/100/);await assert.rejects(save({...item,image_comments:{unknown:'Wrong image'}}),/attached image/);await assert.rejects(save({...item,image_comments:{[paths[0]]:'x'.repeat(2001)}}),/2000/);await assert.rejects(save({...item,image_comments:[]}),/object/);await assert.rejects(save({...item,image_comments:{[paths[0]]:4}}),/2000/);
await save({...item,image_paths:[paths[0]],image_comments:{[paths[0]]:'Updated'}},id,1);await assert.rejects(save(item,id,1),/changed/);
await save({title:'Older client',image_paths:[paths[0]]},id,2);row=(await db.query('select * from manufacturer_portfolio_items where id=$1',[id])).rows[0];assert.deepEqual(row.image_comments,{[paths[0]]:'Updated'});
await asAccount(db,other);assert.equal((await db.query('select * from manufacturer_portfolio_items')).rows.length,0);await assert.rejects(save(item),/belonging/);await assert.rejects(save({title:'Attack',image_paths:[]},id,3),/not found/);
await asAccount(db,admin,'owner@ceriga.io');assert.equal((await db.query('select id from manufacturer_portfolio_items where id=$1',[id])).rows.length,1);await db.query('update manufacturer_portfolio_items set description=$2 where id=$1',[id,'Admin update']);
await db.exec('reset role');await db.exec(await fs.readFile('supabase/migrations/20261108020000_portfolio_batch_comments.sql','utf8'));assert.equal((await db.query('select image_comments from manufacturer_portfolio_items where id=$1',[id])).rows[0].image_comments[paths[0]],'Updated');
assert.equal((await db.query("select has_function_privilege('authenticated','public.team_impl_save_portfolio_item(jsonb,uuid,integer)','execute') allowed")).rows[0].allowed,false);
console.log('PASS portfolio batch DB: 100 images, general/per-photo comments, invalid and unrelated comments rejected, old-client preservation, stale saves, ownership isolation, superadmin access and repeatable migration.');
}finally{await db.close();}
