import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { transformWithEsbuild } from 'vite';

const path = 'supabase/functions/workspace-team-invite/index.ts';
const { code } = await transformWithEsbuild(await fs.readFile(path, 'utf8'), path, { format: 'cjs' });
const env = { SUPABASE_URL:'https://db.example.invalid', SUPABASE_ANON_KEY:'anon', SUPABASE_SERVICE_ROLE_KEY:'service' };
const token = 'a'.repeat(64);
let handler;
let signedIn = true, permitted = true, accountExists = true, needsPassword = false, renew = false, providerOK = true;
const rpcCalls = [], emails = [], authTypes = [];
const client = {
  auth: {
    getUser: async () => signedIn ? { data:{user:{id:'actor'}},error:null } : { data:{user:null},error:new Error('Expired') },
    admin:{generateLink: async ({type}) => {
      authTypes.push(type);
      return { data:{properties:{hashed_token:'auth-token'},user:{id:'recipient'}},error:null };
    }},
  },
  rpc: async (name, args) => {
    rpcCalls.push({name,args});
    if (name==='issue_workspace_invitation') return permitted
      ? { data:{id:'invite',email:'member@example.invalid',factoryName:'Fixture factory',token,revision:1},error:null }
      : { error:{message:'Permission denied'} };
    if (['factory_invitation_details','platform_worker_invitation_details'].includes(name)) return { data:{accountExists,needsPassword,canRenewInvite:renew},error:null };
    return { data:true,error:null };
  },
};
new Function('require','Deno','fetch',code)(()=>({createClient:()=>client}),{env:{get:key=>env[key]},serve:fn=>{handler=fn;}},async (_url,init)=>{
  emails.push(JSON.parse(init.body));
  return new Response(null,{status:providerOK?200:503});
});
const payload = { workspace:'factory',name:'Fixture Member',email:'member@example.invalid',role:'staff',factoryId:'fixture-factory' };
const send = body => handler(new Request('https://db.example.invalid/functions/v1/team-invite',{method:'POST',headers:{Authorization:'Bearer actor'},body:JSON.stringify(body)}));
signedIn=false;
assert.equal((await send(payload)).status,401);
signedIn=true;
assert.equal((await send({...payload,name:undefined})).status,400);
assert.equal((await send(payload)).status,503);
assert.equal(rpcCalls.length,0);
Object.assign(env,{CERIGA_APP_URL:'https://ceriga.example.invalid',RESEND_API_KEY:'key',CERIGA_INVITE_FROM:'team@ceriga.example.invalid'});
permitted=false;
assert.equal((await send({...payload,workspace:'internal'})).status,400);
assert.equal(emails.length,0);
permitted=true;
const factory = await (await send({...payload,origin:'https://untrusted.example.invalid'})).json();
assert.deepEqual(factory,{id:'invite',delivery:'sent'});
assert.match(emails.at(-1).text,/https:\/\/ceriga.example.invalid\/team-invite#/);
assert.deepEqual(emails.at(-1).to,[payload.email]);
assert.equal(rpcCalls.at(-1).args.p_sent,true);
await send({...payload,workspace:'internal'});
assert.match(emails.at(-1).text,/\/worker-invite#/);
assert.equal(rpcCalls.findLast(call=>call.name==='issue_workspace_invitation').args.p_factory,null);
accountExists=false;
await send(payload);
assert.match(emails.at(-1).text,/&invite=auth-token&type=invite/);
assert.equal(authTypes.at(-1),'invite');
accountExists=true;needsPassword=true;renew=true;
await send({...payload,resend:'invite'});
assert.equal(authTypes.at(-1),'invite');
renew=false;
await send({...payload,resend:'invite'});
assert.equal(authTypes.at(-1),'recovery');
providerOK=false;
assert.deepEqual(await (await send(payload)).json(),{id:'invite',delivery:'failed'});
assert.equal(rpcCalls.at(-1).args.p_sent,false);
console.log('PASS automatic workspace invitation emails, authorisation, activation and failed delivery');
