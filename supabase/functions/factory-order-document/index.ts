import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Cache-Control': 'private, no-store',
  'Access-Control-Expose-Headers': 'x-ceriga-file-type',
};
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const types = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/zip']);
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: cors });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return fail(405, 'POST required');
  try {
    const { orderId, documentId, factoryId } = await request.json();
    if (![orderId, documentId, factoryId].every(id => typeof id === 'string' && uuid.test(id))) return fail(400, 'Invalid file request');
    const url = Deno.env.get('SUPABASE_URL')!;
    const authorization = request.headers.get('Authorization');
    if (!authorization) return fail(401, 'Sign in required');
    const actor = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization, 'x-ceriga-factory': factoryId } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const identity = await actor.auth.getUser();
    if (identity.error || !identity.data.user) return fail(401, 'Sign in required');
    const allowed = await actor.rpc('factory_authorize_order_document', { p_order: orderId, p_document: documentId });
    if (allowed.error || allowed.data !== factoryId) return fail(403, 'File access denied');
    const server = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const document = await server.from('factory_order_documents').select('storage_path').eq('id', documentId)
      .eq('order_id', orderId).eq('manufacturer_id', factoryId).maybeSingle();
    if (document.error || !document.data) return fail(404, 'File unavailable');
    const file = await server.storage.from('order-uploads').download(document.data.storage_path);
    if (file.error || !file.data) return fail(404, 'File unavailable');
    return new Response(file.data, { headers: { ...cors, 'Content-Type': 'application/octet-stream',
      'X-Ceriga-File-Type': types.has(file.data.type) ? file.data.type : 'application/octet-stream',
      'Content-Disposition': 'attachment', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return fail(400, 'Could not retrieve file');
  }
});
