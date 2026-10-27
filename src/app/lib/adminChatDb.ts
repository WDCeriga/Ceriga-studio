import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import type { ChatAttachment, ChatMessage, ChatThread } from '../data/superadminMock';
import { sendAlibabaMessage } from './alibabaChat';
import { persistChatAttachments, resolveChatAttachments } from './sharedMessages';

function requireConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Database is not configured. Add Supabase keys to .env');
  }
}

function formatAt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLastAt(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

type ThreadRow = {
  id: string;
  channel: 'ceriga' | 'alibaba' | null;
  participant_user_id: string | null;
  recipient_user_id: string | null;
  participant_type: 'brand' | 'manufacturer' | 'alibaba';
  subject: string;
  last_message: string;
  last_message_at: string;
  unread_admin: number;
  external_conversation_id: string | null;
  external_peer_account_id: string | null;
  external_peer_name: string | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender: 'admin' | 'participant';
  body: string;
  attachments: ChatAttachment[] | null;
  created_at: string;
};

function mapThreadType(row: ThreadRow): ChatThread['type'] {
  if (row.channel === 'alibaba' || row.participant_type === 'alibaba') return 'alibaba';
  return row.participant_type === 'manufacturer' ? 'manufacturer' : 'user';
}

function mapThreadSubtitle(row: ThreadRow): string {
  if (row.channel === 'alibaba' || row.participant_type === 'alibaba') return 'Alibaba';
  return row.participant_type === 'manufacturer' ? 'Manufacturer' : 'Brand';
}

export async function listAdminChatThreads(): Promise<ChatThread[]> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('admin_chat_threads')
    .select(
      'id, channel, participant_user_id, recipient_user_id, participant_type, subject, last_message, last_message_at, unread_admin, external_conversation_id, external_peer_account_id, external_peer_name',
    )
    .order('last_message_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as ThreadRow[];
  const userIds = [
    ...new Set(
      rows
        .map((r) => r.participant_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const names = new Map<string, string>();
  const roles = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .in('id', userIds);
    for (const p of (profiles ?? []) as {
      id: string;
      email: string;
      full_name: string | null;
      role: string;
    }[]) {
      names.set(p.id, p.full_name || p.email);
      roles.set(p.id, p.role);
    }
  }

  return rows.filter(row => row.channel === 'alibaba' || (row.participant_type === 'manufacturer' && row.recipient_user_id === null)).map((row) => {
    const type = mapThreadType(row);
    const channel = row.channel === 'alibaba' || type === 'alibaba' ? 'alibaba' : 'ceriga';
    const name =
      type === 'alibaba'
        ? row.external_peer_name || row.subject || 'Alibaba contact'
        : names.get(row.participant_user_id ?? '') || row.subject;

    return {
      id: row.id,
      type,
      channel,
      name,
      subtitle: roles.get(row.participant_user_id || '') === 'worker' ? 'Worker' : mapThreadSubtitle(row),
      lastMessage: row.last_message || 'No messages yet',
      lastAt: formatLastAt(row.last_message_at),
      unread: row.unread_admin,
      messages: [],
      externalConversationId: row.external_conversation_id ?? undefined,
      externalPeerAccountId: row.external_peer_account_id ?? undefined,
    };
  });
}

export async function listAdminChatMessages(threadId: string): Promise<ChatMessage[]> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('admin_chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  return Promise.all(((data ?? []) as MessageRow[]).map(async (row) => ({
    id: row.id,
    from: row.sender === 'admin' ? 'ceriga' : 'contact',
    text: row.body,
    at: formatAt(row.created_at),
    attachments: await resolveChatAttachments(row.attachments ?? []),
  })));
}

export async function createAdminChatThread(input: {
  participantUserId: string;
  participantType: 'brand' | 'manufacturer';
  subject?: string;
}): Promise<ChatThread> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('start_chat', { p_recipient: input.participantUserId });
  if (error) throw error;
  const threads = await listAdminChatThreads();
  const thread = threads.find(item => item.id === data);
  if (!thread) throw new Error('Could not load the manufacturer conversation');
  return thread;
}

export async function sendAdminChatMessage(input: {
  threadId: string;
  body: string;
  attachments?: ChatAttachment[];
  channel?: 'ceriga' | 'alibaba';
}): Promise<ChatMessage> {
  requireConfigured();
  if (input.channel === 'alibaba') {
    if (input.attachments?.length) throw new Error('Alibaba send supports text only for now');
    return sendAlibabaMessage({ threadId: input.threadId, body: input.body });
  }
  const attachments = await persistChatAttachments(input.threadId, input.attachments ?? []);
  const { data, error } = await getSupabase().from('admin_chat_messages')
    .insert({ thread_id: input.threadId, sender: 'admin', body: input.body, attachments }).select('*').single();
  if (error) throw error;
  return { id: data.id, from: 'ceriga', text: data.body, at: formatAt(data.created_at), attachments: await resolveChatAttachments(data.attachments || []) };
}

export async function markAdminThreadRead(threadId: string): Promise<void> {
  requireConfigured();
  const { error } = await getSupabase().from('admin_chat_threads').update({ unread_admin: 0 }).eq('id', threadId).neq('unread_admin', 0);
  if (error) throw error;
}
