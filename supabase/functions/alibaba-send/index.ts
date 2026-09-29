import {
  errorResponse,
  handleCors,
  jsonResponse,
  requireSuperadmin,
} from '../_shared/superadminAuth.ts';
import { readTopCredentials, topCall } from '../_shared/topClient.ts';

type SendBody = {
  threadId?: string;
  body?: string;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const auth = await requireSuperadmin(req);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  const creds = readTopCredentials();
  if (!creds) {
    return errorResponse(
      'Alibaba is not connected. Set ALIBABA_APP_KEY, ALIBABA_APP_SECRET, ALIBABA_SESSION, and ALIBABA_ACCOUNT_ID on the Edge Function secrets.',
      503,
    );
  }

  let payload: SendBody;
  try {
    payload = (await req.json()) as SendBody;
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const threadId = payload.threadId?.trim();
  const text = payload.body?.trim() ?? '';
  if (!threadId) return errorResponse('threadId is required', 400);
  if (!text) return errorResponse('body is required (text only for Alibaba send)', 400);

  const { data: thread, error: threadError } = await supabase
    .from('admin_chat_threads')
    .select(
      'id, channel, external_conversation_id, external_peer_account_id, external_peer_name',
    )
    .eq('id', threadId)
    .maybeSingle();

  if (threadError) return errorResponse(threadError.message, 500);
  if (!thread || thread.channel !== 'alibaba') {
    return errorResponse('Thread is not an Alibaba conversation', 400);
  }
  if (!thread.external_peer_account_id) {
    return errorResponse('Alibaba peer account id is missing on this thread', 400);
  }

  try {
    await topCall(
      'alibaba.interaction.im.assistant.message.send',
      {
        param: {
          sender_account_id: Number(creds.accountId),
          receiver_account_id: Number(thread.external_peer_account_id),
          content: text,
          message_type: 2030,
          scene: 1,
          ext_param: JSON.stringify({
            ext_biz_id: thread.external_conversation_id ?? threadId,
            ext_biz_type: '1',
          }),
          client_info: 'ceriga-superadmin',
          entrance_source: 'ceriga',
        },
      },
      creds,
    );

    const nowIso = new Date().toISOString();
    const { data: message, error: insertError } = await supabase
      .from('admin_chat_messages')
      .insert({
        thread_id: threadId,
        sender: 'admin',
        body: text,
        attachments: [],
      })
      .select('id, body, created_at')
      .single();

    if (insertError) return errorResponse(insertError.message, 500);

    await supabase
      .from('admin_chat_threads')
      .update({
        last_message: text.slice(0, 200),
        last_message_at: nowIso,
        unread_admin: 0,
        updated_at: nowIso,
      })
      .eq('id', threadId);

    return jsonResponse({
      ok: true,
      message: {
        id: message.id,
        from: 'ceriga',
        text: message.body,
        at: message.created_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Alibaba send failed';
    return errorResponse(message, 502);
  }
});
