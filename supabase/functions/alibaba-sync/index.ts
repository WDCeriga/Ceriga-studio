import {
  errorResponse,
  handleCors,
  jsonResponse,
  requireSuperadmin,
} from '../_shared/superadminAuth.ts';
import { readTopCredentials, topCall } from '../_shared/topClient.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

type ConversationDto = {
  conversation_id?: string;
  conversationId?: string;
  peer_account_id?: number | string;
  peerAccountId?: number | string;
  peer_name?: string;
  peerName?: string;
  last_message?: string;
  lastMessage?: string;
  modified_time?: number;
  modifiedTime?: number;
  unread_count?: number;
  unreadCount?: number;
};

type MessageDto = {
  message_id?: string;
  messageId?: string;
  conversation_id?: string;
  conversationId?: string;
  sender_account_id?: number | string;
  senderAccountId?: number | string;
  content?: string;
  send_time?: number;
  sendTime?: number;
  message_type?: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function pickConversations(payload: unknown): ConversationDto[] {
  const root = asRecord(payload);
  if (!root) return [];

  for (const key of Object.keys(root)) {
    const branch = asRecord(root[key]);
    if (!branch) continue;
    const result = asRecord(branch.result) ?? branch;
    const data = asRecord(result.data) ?? result;
    const list =
      (data.list as unknown) ??
      (data.conversations as unknown) ??
      (result.list as unknown);
    if (Array.isArray(list)) return list as ConversationDto[];
  }
  return [];
}

function pickMessages(payload: unknown): MessageDto[] {
  const root = asRecord(payload);
  if (!root) return [];

  for (const key of Object.keys(root)) {
    const branch = asRecord(root[key]);
    if (!branch) continue;
    const result = asRecord(branch.result) ?? branch;
    const data = asRecord(result.data) ?? result;
    const list = (data.list as unknown) ?? (result.list as unknown);
    if (Array.isArray(list)) return list as MessageDto[];
  }
  return [];
}

function conversationIdOf(c: ConversationDto): string | null {
  const id = c.conversation_id ?? c.conversationId;
  return id ? String(id) : null;
}

function messageBody(content: string | undefined): string {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed === 'string') return parsed;
    const obj = asRecord(parsed);
    if (!obj) return content;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.content === 'string') return obj.content;
    if (typeof obj.body === 'string') return obj.body;
    return content;
  } catch {
    return content;
  }
}

async function upsertThread(
  supabase: SupabaseClient,
  c: ConversationDto,
): Promise<{ id: string; created: boolean } | null> {
  const externalId = conversationIdOf(c);
  if (!externalId) return null;

  const peerId = String(c.peer_account_id ?? c.peerAccountId ?? '');
  const peerNameRaw = c.peer_name ?? c.peerName ?? peerId;
  const peerName = String(peerNameRaw || 'Alibaba contact');
  const lastMessage = String(c.last_message ?? c.lastMessage ?? '');
  const modifiedMs = Number(c.modified_time ?? c.modifiedTime ?? Date.now());
  const unread = Number(c.unread_count ?? c.unreadCount ?? 0);

  const { data: existing } = await supabase
    .from('admin_chat_threads')
    .select('id')
    .eq('external_conversation_id', externalId)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from('admin_chat_threads')
      .update({
        subject: peerName,
        external_peer_account_id: peerId || null,
        external_peer_name: peerName,
        last_message: lastMessage.slice(0, 200) || 'No messages yet',
        last_message_at: new Date(modifiedMs).toISOString(),
        unread_admin: Number.isFinite(unread) ? unread : 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return { id: existing.id as string, created: false };
  }

  const { data: inserted, error } = await supabase
    .from('admin_chat_threads')
    .insert({
      channel: 'alibaba',
      participant_type: 'alibaba',
      participant_user_id: null,
      subject: peerName,
      external_conversation_id: externalId,
      external_peer_account_id: peerId || null,
      external_peer_name: peerName,
      last_message: lastMessage.slice(0, 200) || 'No messages yet',
      last_message_at: new Date(modifiedMs).toISOString(),
      unread_admin: Number.isFinite(unread) ? unread : 0,
    })
    .select('id')
    .single();

  if (error) throw error;
  return { id: inserted.id as string, created: true };
}

async function syncMessagesForThread(
  supabase: SupabaseClient,
  threadId: string,
  conversationId: string,
  accountId: string,
  creds: NonNullable<ReturnType<typeof readTopCredentials>>,
): Promise<number> {
  const payload = await topCall(
    'alibaba.interaction.im.message.list.query',
    {
      params: {
        conversation_id: conversationId,
        count: 50,
        forward: false,
        limit_time_stamp: Date.now(),
        self_account_id: Number(accountId),
      },
    },
    creds,
  );

  const messages = pickMessages(payload);
  let inserted = 0;

  for (const msg of messages) {
    const externalMessageId = String(msg.message_id ?? msg.messageId ?? '');
    if (!externalMessageId) continue;

    const senderId = String(msg.sender_account_id ?? msg.senderAccountId ?? '');
    const fromAdmin = senderId === accountId;
    const body = messageBody(msg.content);
    const sendMs = Number(msg.send_time ?? msg.sendTime ?? Date.now());

    const { error: insertError } = await supabase.from('admin_chat_messages').insert({
      thread_id: threadId,
      sender: fromAdmin ? 'admin' : 'participant',
      body,
      attachments: [],
      external_message_id: externalMessageId,
      created_at: new Date(sendMs).toISOString(),
    });
    if (insertError) {
      if (insertError.code === '23505') continue;
      throw insertError;
    }
    inserted += 1;
  }

  return inserted;
}

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

  try {
    const listPayload = await topCall(
      'alibaba.interaction.im.conversation.list.query',
      {
        params: {
          seller_account_id: Number(creds.accountId),
          limit_time_stamp: Date.now(),
          count: 50,
        },
      },
      creds,
    );

    const conversations = pickConversations(listPayload);
    let threadsUpserted = 0;
    let messagesUpserted = 0;

    for (const conversation of conversations) {
      const externalId = conversationIdOf(conversation);
      if (!externalId) continue;
      const thread = await upsertThread(supabase, conversation);
      if (!thread) continue;
      threadsUpserted += 1;
      messagesUpserted += await syncMessagesForThread(
        supabase,
        thread.id,
        externalId,
        creds.accountId,
        creds,
      );
    }

    return jsonResponse({
      ok: true,
      conversations: conversations.length,
      threadsUpserted,
      messagesUpserted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Alibaba sync failed';
    return errorResponse(message, 502);
  }
});
