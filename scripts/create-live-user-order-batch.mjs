import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const password=process.env.CERIGA_TEST_ACCOUNT_PASSWORD;
if(!password)throw Error('Provide CERIGA_TEST_ACCOUNT_PASSWORD in the process environment; it is never saved to disk.');
const envText=await fs.readFile('.env.local','utf8'),env=Object.fromEntries(envText.split(/\r?\n/).filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];}));
const url=env.NEXT_PUBLIC_SUPABASE_URL||env.VITE_SUPABASE_URL,key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY;
if(new URL(url).hostname!=='yzpahvwywvalegsztnif.supabase.co')throw Error('Refusing an unexpected Supabase project');
const folder=path.resolve('.sandbox/live-user-orders-20261025');await fs.mkdir(folder,{recursive:true});const file=path.join(folder,'manifest.json');
let manifest;try{manifest=JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;manifest={project:'yzpahvwywvalegsztnif',batch:'live-user-orders-20261025',createdAt:new Date().toISOString(),accounts:[],orders:[]};}
const checkpoint=()=>fs.writeFile(file,JSON.stringify(manifest,null,2));
async function request(route,{token,body,method='GET'}={}){const response=await fetch(url+route,{method,headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok){const error=new Error(data.msg||data.error_description||data.message||'Supabase request failed');error.status=response.status;throw error;}return data;}
const settings=await request('/auth/v1/settings');if(!settings.mailer_autoconfirm||settings.disable_signup)throw Error('Account creation requires confirmation or is disabled; no email will be sent by this script.');
const sessions=new Map();
for(const label of ['User2','User3','User4']){
 const email=label.toLowerCase()+'@user.com';let account=manifest.accounts.find(a=>a.email===email),login;
 if(!account){
  try{const signup=await request('/auth/v1/signup',{method:'POST',body:{email,password,data:{full_name:label,name:label,role:'brand'}}});assert.ok(signup.user?.id&&signup.user?.email_confirmed_at,'Account was not confirmed');account={id:signup.user.id,email,name:label,newlyCreated:true};manifest.accounts.push(account);await checkpoint();}
  catch(error){if(!/already.*registered|already.*exists/i.test(error.message))throw error;login=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});account={id:login.user.id,email,name:label,newlyCreated:false};manifest.accounts.push(account);await checkpoint();}
 }
 login??=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});assert.equal(login.user.id,account.id);assert.ok(login.access_token);sessions.set(account.id,login.access_token);
 const profiles=await request(`/rest/v1/profiles?id=eq.${account.id}&select=id,email,role`,{token:login.access_token});assert.equal(profiles.length,1);assert.equal(profiles[0].role,'brand');console.log('Verified account: '+email);
}
const stages=[['Awaiting assignment',3],['Quotation requested',3],['Reassignment required',1],['Quotation revision requested',2],['Quotation awaiting admin review',2],['Awaiting customer submission',3],['Production: preparation',2],['Production: cutting',2],['Production: sewing',2],['Production: finishing',1],['QC awaiting submission',2],['QC pending review',2],['QC changes required',2],['Ready for dispatch',1],['Shipping',1],['Completed',1]];
let sequence=0;
for(const [target,count]of stages)for(let n=0;n<count;n++,sequence++){
 if(manifest.orders.some(o=>o.sequence===sequence))continue;
 const account=manifest.accounts[sequence%3],token=sessions.get(account.id),bulk=sequence%2===0,quantity=bulk?[100,150,250][sequence%3]:6,option=bulk?'bulk-1':'sample',garment=sequence%3?'T-shirts':'Hoodies';
 const sizes=n=>Object.fromEntries(['xs','s','m','l','xl','xxl'].map((key,i)=>[key,Math.floor(n/6)+(i<n%6?1:0)]));
 const sample={id:'sample',kind:'sample',targetTotal:6,bySize:sizes(6)},plan={mode:'custom_clothing',sample,bulkRuns:bulk?[{id:option,kind:'bulk',targetTotal:quantity,bySize:sizes(quantity)}]:[]};
 const product=`TEST ${account.name.toUpperCase()} ${String(sequence+1).padStart(3,'0')} — ${garment==='Hoodies'?'Heavyweight Hoodie':'Cotton T-Shirt'}`;
 // Recover a successful request whose response/checkpoint may have been interrupted.
 const prior=await request(`/rest/v1/account_orders?product_name=eq.${encodeURIComponent(product)}&select=id,user_id`,{token});
 let orderId;if(prior.length){assert.equal(prior.length,1,'Duplicate test order label');orderId=prior[0].id;}else{
  const order=await request('/rest/v1/rpc/create_customer_order',{method:'POST',token,body:{p_input:{kind:'production',product_name:product,garment_type:garment,order_quantities:plan,specifications:{requiredCapabilities:[]},contact_name:account.name,contact_email:account.email,delivery_address:{name:account.name,addressLine1:'TEST ORDER — DO NOT SHIP',city:'Test City',country:'UK',postalCode:'TEST ONLY'}}}});orderId=order.id;assert.ok(orderId);
 }
 manifest.orders.push({id:orderId,sequence,target,userId:account.id,email:account.email,product,garment,quantity,option});await checkpoint();console.log('Submitted '+product+' → '+target);
}
assert.equal(manifest.orders.length,30);manifest.userCreationVerified=true;await checkpoint();
console.log('Created/verified three real brand accounts and 30 real customer orders. Stage progression remains pending. Manifest: '+file);
