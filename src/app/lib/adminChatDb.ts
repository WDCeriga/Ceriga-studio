import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import type { ChatAttachment, ChatMessage, ChatThread } from '../data/superadminMock';

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
  participant_user_id: string;
  participant_type: 'brand' | 'manufacturer';
  subject: string;
  last_message: string;
  last_message_at: string;
  unread_admin: number;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender: 'admin' | 'participant';
  body: string;
  attachments: ChatAttachment[] | null;
  created_at: string;
};

export async function listAdminChatThreads(): Promise<ChatThread[]> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('admin_chat_threads')
    .select(
      'id, participant_user_id, participant_type, subject, last_message, last_message_at, unread_admin',
    )
    .order('last_message_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as ThreadRow[];
  const userIds = [...new Set(rows.map((r) => r.participant_user_id))];
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);
    for (const p of (profiles ?? []) as {
      id: string;
      email: string;
      full_name: string | null;
    }[]) {
      names.set(p.id, p.full_name || p.email);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    type: row.participant_type === 'manufacturer' ? 'manufacturer' : 'user',
    name: names.get(row.participant_user_id) || row.subject,
    subtitle: row.participant_type === 'manufacturer' ? 'Manufacturer' : 'Brand',
    lastMessage: row.last_message || 'No messages yet',
    lastAt: formatLastAt(row.last_message_at),
    unread: row.unread_admin,
    messages: [],
  }));
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

  return ((data ?? []) as MessageRow[]).map((row) => ({
    id: row.id,
    from: row.sender === 'admin' ? 'ceriga' : 'contact',
    text: row.body,
    at: formatAt(row.created_at),
    attachments: row.attachments ?? undefined,
  }));
}

export async function createAdminChatThread(input: {
  participantUserId: string;
  participantType: 'brand' | 'manufacturer';
  subject?: string;
}): Promise<ChatThread> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('admin_chat_threads')
    .insert({
      participant_user_id: input.participantUserId,
      participant_type: input.participantType,
      subject: input.subject ?? 'Conversation',
      last_message: '',
    })
    .select('id, participant_type, subject, last_message_at')
    .single();
  if (error) throw error;

  return {
    id: data.id,
    type: data.participant_type === 'manufacturer' ? 'manufacturer' : 'user',
    name: data.subject,
    subtitle: data.participant_type === 'manufacturer' ? 'Manufacturer' : 'Brand',
    lastMessage: 'No messages yet',
    lastAt: formatLastAt(data.last_message_at),
    unread: 0,
    messages: [],
  };
}

export async function sendAdminChatMessage(input: {
  threadId: string;
  body: string;
  attachments?: ChatAttachment[];
}): Promise<ChatMessage> {
  requireConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('admin_chat_messages')
    .insert({
      thread_id: input.threadId,
      sender: 'admin',
      body: input.body,
      attachments: input.attachments ?? [],
    })
    .select('*')
    .single();
  if (error) throw error;

  await supabase
    .from('admin_chat_threads')
    .update({
      last_message: input.body.slice(0, 200) || 'Attachment',
      last_message_at: new Date().toISOString(),
      unread_admin: 0,
    })
    .eq('id', input.threadId);

  const row = data as MessageRow;
  return {
    id: row.id,
    from: 'ceriga',
    text: row.body,
    at: formatAt(row.created_at),
    attachments: row.attachments ?? undefined,
  };
}

export async function markAdminThreadRead(threadId: string): Promise<void> {
  requireConfigured();
  const supabase = getSupabase();
  const { error } = await supabase
    .from('admin_chat_threads')
    .update({ unread_admin: 0 })
    .eq('id', threadId);
  if (error) throw error;
}
