import { handleCors, jsonResponse, requireSuperadmin, errorResponse } from '../_shared/superadminAuth.ts';
import { getTopConnectionStatus } from '../_shared/topClient.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const auth = await requireSuperadmin(req);
  if (auth instanceof Response) return auth;

  return jsonResponse(getTopConnectionStatus());
});
