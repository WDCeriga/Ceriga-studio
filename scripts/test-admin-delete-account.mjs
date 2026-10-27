import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transformWithEsbuild } from 'vite';

let handler;
let state;
const reset = () => {
  state = { signedIn: true, isAdmin: true, callerId: '11111111-1111-1111-1111-111111111111', orders: 0, deleted: [], deleteError: null };
};
reset();
const context = vm.createContext({
  Response, Request, console,
  Deno: { env: { get: (name) => ({ SUPABASE_URL:'https://example.test', SUPABASE_ANON_KEY:'anon', SUPABASE_SERVICE_ROLE_KEY:'service' })[name] }, serve: (fn) => { handler = fn; } },
  createClient: (_url, key) => key === 'service' ? {
    from: () => ({ select: () => ({ eq: async () => ({ count:state.orders,error:null }) }) }),
    auth: { admin: { deleteUser:async id => {state.deleted.push(id);return {error:state.deleteError};} } },
  } : {
    auth: { getUser:async()=>({data:{user:state.signedIn?{id:state.callerId}:null},error:null}) },
    rpc: async()=>({data:state.isAdmin,error:null}),
  },
});
for (const path of ['supabase/functions/_shared/superadminAuth.ts','supabase/functions/admin-delete-account/index.ts']) {
  const source = (await readFile(path,'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
  const {code}=await transformWithEsbuild(source,path,{loader:'ts',target:'es2022'});
  vm.runInContext(code,context,{filename:path});
}
const target='22222222-2222-2222-2222-222222222222';
const request = (body, auth=true, method='POST') => new Request('https://example.test/admin-delete-account',{
  method,headers:auth?{Authorization:'Bearer fixture','Content-Type':'application/json'}:{},
  ...(method==='POST'?{body:JSON.stringify(body)}:{}),
});
assert.equal((await handler(request({},false))).status,401);
assert.deepEqual(state.deleted,[]);
state.signedIn=false;
assert.equal((await handler(request({userId:target}))).status,401);
reset();state.isAdmin=false;
assert.equal((await handler(request({userId:target}))).status,403);
assert.deepEqual(state.deleted,[]);
reset();
assert.equal((await handler(request({userId:state.callerId}))).status,400);
assert.equal((await handler(request({userId:'invalid'}))).status,400);
assert.deepEqual(state.deleted,[]);
state.orders=1;
assert.equal((await handler(request({userId:target}))).status,409);
assert.deepEqual(state.deleted,[]);
reset();state.deleteError={message:'Foreign key dependency'};
const blocked=await handler(request({userId:target}));
assert.equal(blocked.status,409);
assert.equal((await blocked.json()).error,'Foreign key dependency');
reset();
const deleted=await handler(request({userId:target}));
assert.equal(deleted.status,200);
assert.deepEqual(await deleted.json(),{deleted:true});
assert.deepEqual(state.deleted,[target]);
assert.equal((await handler(request({},false,'OPTIONS'))).status,200);
assert.equal((await handler(request({},true,'GET'))).status,405);
console.log('PASS: account deletion authentication, super admin authorization, self protection, order dependency, database errors, success and CORS');
