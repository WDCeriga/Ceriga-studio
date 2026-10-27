import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors, requireSuperadmin, errorResponse, jsonResponse } from '../_shared/superadminAuth.ts';

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
  try {
    const auth = await requireSuperadmin(req);
    if (auth instanceof Response) return auth;
    const { userId } = await req.json();
    if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return errorResponse('Invalid account ID');
    }
    const { data: caller, error: callerError } = await auth.supabase.auth.getUser();
    if (callerError || !caller.user) return errorResponse('Unauthorized', 401);
    if (caller.user.id === userId) return errorResponse('You cannot delete your own account');
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return errorResponse('Account deletion is not configured', 503);
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { count, error: orderError } = await admin.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', userId);
    if (orderError) throw orderError;
    if (count) return errorResponse('This account owns orders. Delete those orders before deleting the account.', 409);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return errorResponse(error.message, 409);
    return jsonResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Account deletion failed', 500);
  }
});
