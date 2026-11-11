import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
  'Cache-Control': 'no-store',
};
const authOptions = { persistSession: false, autoRefreshToken: false };

Deno.serve(async (request: Request) => {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return reply({ error: 'POST required' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const authorization = request.headers.get('Authorization') || '';
    const actor = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: authOptions, global: { headers: { Authorization: authorization } },
    });
    const { data: auth, error: authError } = await actor.auth.getUser();
    if (authError || !auth.user) return reply({ error: 'Sign in required' }, 401);

    const body = await request.json();
    const internal = body.workspace === 'internal';
    if ((body.workspace && !['factory', 'internal'].includes(body.workspace))
      || (!body.resend && (typeof body.email !== 'string' || typeof body.role !== 'string' || typeof body.name !== 'string'))) {
      return reply({ error: 'Full name, email and role are required' }, 400);
    }

    const mailKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('CERIGA_INVITE_FROM');
    const configuredOrigin = Deno.env.get('CERIGA_APP_URL');
    if (!mailKey || !from || !configuredOrigin || new URL(configuredOrigin).protocol !== 'https:') {
      return reply({ error: 'Invitation email is unavailable. Ask Ceriga to check email delivery.' }, 503);
    }

    const server = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: authOptions });
    const { data: invite, error } = await server.rpc('issue_workspace_invitation', {
      p_actor: auth.user.id, p_internal: internal, p_email: body.email ?? null,
      p_name: body.resend ? null : body.name, p_role: body.role ?? null,
      p_factory: internal ? null : body.factoryId ?? null, p_resend: body.resend ?? null,
      p_revision: body.revision ?? null,
    });
    if (error) return reply({ error: error.message }, 400);

    let sent = false;
    try {
      const fragment = await activationFragment(server, invite, internal);
      const path = internal ? '/worker-invite' : '/team-invite';
      const link = new URL(configuredOrigin).origin + path + '#' + fragment;
      const workspace = internal ? 'the Ceriga team' : invite.factoryName;
      const message = 'You have been invited to join ' + workspace + ' on Ceriga.\n\n'
        + 'Open this invitation to activate your access: ' + link
        + '\n\nIf you already use Ceriga, sign in with your existing account. Otherwise, create your password on Ceriga.';
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + mailKey, 'Content-Type': 'application/json',
          'Idempotency-Key': invite.id + ':' + invite.revision },
        body: JSON.stringify({ from, to: [invite.email], subject: 'Join your team on Ceriga', text: message }),
        signal: AbortSignal.timeout(10000),
      });
      sent = response.ok;
    } catch {
      // Keep the pending invitation available for resend.
    }

    const delivery = await server.rpc('finish_workspace_invitation_delivery', {
      p_internal: internal, p_id: invite.id, p_revision: invite.revision, p_sent: sent,
    });
    if (delivery.error) return reply({ error: 'The invitation was saved, but delivery could not be confirmed. Refresh the team list.' }, 500);
    if (!delivery.data) return reply({ error: 'The invitation changed. Refresh the team list.' }, 409);
    return reply({ id: invite.id, delivery: sent ? 'sent' : 'failed' });
  } catch {
    return reply({ error: 'The invitation could not be sent. Check the team list and try again.' }, 500);
  }
});

async function activationFragment(
  server: ReturnType<typeof createClient>,
  invite: { token: string; id: string; email: string },
  internal: boolean,
) {
  const lookup = internal ? 'platform_worker_invitation_details' : 'factory_invitation_details';
  const { data: account, error } = await server.rpc(lookup, { p_token: invite.token });
  if (error) throw error;
  if (internal && !account.needsPassword) return invite.token;
  if (account.accountExists && !account.needsPassword) return invite.token;

  const type = !internal && (!account.accountExists || account.canRenewInvite) ? 'invite' : 'recovery';
  const generated = await server.auth.admin.generateLink({ type, email: invite.email });
  if (generated.error || !generated.data.properties.hashed_token) throw new Error('Account setup link unavailable');
  if (type === 'invite') {
    const tracked = await server.rpc('record_team_account_setup', {
      p_invitation: invite.id, p_user: generated.data.user.id,
    });
    if (tracked.error) throw tracked.error;
  }
  return invite.token + '&invite=' + encodeURIComponent(generated.data.properties.hashed_token) + '&type=' + type;
}
