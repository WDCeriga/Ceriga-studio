import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

/** User-scoped client (respects RLS) + verified superadmin. */
export async function requireSuperadmin(
  req: Request,
): Promise<{ supabase: SupabaseClient } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse('Missing Authorization header', 401);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    return errorResponse('Supabase env is not configured on the function', 500);
  }

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return errorResponse('Unauthorized', 401);
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc('is_superadmin');
  if (adminError) {
    return errorResponse(adminError.message, 500);
  }
  if (!isAdmin) {
    return errorResponse('Forbidden — superadmin only', 403);
  }

  return { supabase };
}
