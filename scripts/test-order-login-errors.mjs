import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithEsbuild } from 'vite';

async function load(path, imports = {}) {
  const { code } = await transformWithEsbuild(await readFile(path, 'utf8'), path, { format: 'cjs', target: 'es2022' });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (!(name in imports)) throw Error(`Unexpected import: ${name}`);
    return imports[name];
  }, module, module.exports);
  return module.exports;
}
const errors = await load('src/app/lib/requestErrors.ts');
let client;
const supabase = { isSupabaseConfigured: true, getSupabase: () => client };
const { passwordLogin } = await load('src/app/lib/passwordLogin.ts', { './supabaseClient': supabase, './requestErrors': errors });
let calls = 0;
client = { auth: { signInWithPassword: async () => ({ error: ++calls === 1 ? { message: 'Failed to fetch' } : null }) } };
await passwordLogin('test@example.invalid', 'test-only'); assert.equal(calls, 2);
calls = 0;
client.auth.signInWithPassword = async () => { calls++; return { error: { message: 'Invalid login credentials' } }; };
await assert.rejects(passwordLogin('test@example.invalid', 'test-only'), /Invalid login credentials/); assert.equal(calls, 1);
calls = 0;
client.auth.signInWithPassword = async () => { calls++; throw new TypeError('Failed to fetch'); };
await assert.rejects(passwordLogin('test@example.invalid', 'test-only'), /Unable to reach the server/); assert.equal(calls, 2);

let payload, insertCalls = 0, insertError = null;
client = {
 rpc:async(name,args)=>{assert.equal(name,'create_customer_order');insertCalls++;payload=args.p_input;return{data:{id:'order-id',created_at:'2026-10-18T00:00:00Z',...payload},error:insertError};},
 auth:{getUser:async()=>({data:{user:{id:'owner-id'}},error:null})},
};
const { insertOrder } = await load('src/app/lib/ordersDb.ts', { './supabaseClient': supabase, './requestErrors': errors });
const input = { kind: 'production', productName: 'Hoodie', garmentType: 'Hoodie', status: 'submitted', statusLabel: 'Awaiting quote', contactName: 'Test buyer', contactEmail: 'buyer@example.invalid', contactPhone: '0000', delivery: { country: 'GB' } };
const order = await insertOrder(input);
assert.equal(order.contactName, input.contactName); assert.deepEqual(order.delivery, input.delivery);
assert.equal(payload.user_id, 'owner-id'); assert.equal(payload.contact_email, input.contactEmail); assert.equal(payload.contact_phone, '0000');
insertError = { message: 'column orders.contact_name does not exist', code: '42703' };
await assert.rejects(insertOrder(input), error => error instanceof Error && /contact_name/.test(error.message));
insertError = { message: 'TypeError: Failed to fetch' }; const before = insertCalls;
await assert.rejects(insertOrder(input), /Unable to reach the server/); assert.equal(insertCalls, before + 1, 'order writes must not be automatically retried');
console.log('PASS: order payload/read-back, useful database errors, safe login connection retry, invalid credentials and no automatic order retry');
