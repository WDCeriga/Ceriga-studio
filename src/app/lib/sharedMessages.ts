import{privateAssetUrl}from './privateAssetUrls';
import { getSupabase } from './supabaseClient';
import type { ChatAttachment } from '../data/superadminMock';

export type MessageContact = { id: string; name: string; role: string };
export type SharedThread = { id: string; participant_user_id: string; recipient_user_id: string | null; subject: string; last_message: string; last_message_at: string };
export type SharedMessage = { id: string; sender: string; sender_user_id: string | null; body: string; created_at: string; attachments: ChatAttachment[] };
export async function messageContacts(): Promise<MessageContact[]> {
  const { data, error } = await getSupabase().rpc('chat_contacts');
  if (error) throw error;
  return data || [];
}
export async function sharedThreads(): Promise<SharedThread[]> {
  const { data, error } = await getSupabase().from('admin_chat_threads').select('*').eq('channel', 'ceriga').order('last_message_at', { ascending: false });
  if (error) throw error;
  return (data || []).filter(row => row.recipient_user_id === null && row.participant_type === 'manufacturer');
}
export async function startSharedChat(recipientId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('start_chat', { p_recipient: recipientId === 'support' ? null : recipientId });
  if (error) throw error;
  return data;
}
export async function persistChatAttachments(threadId: string, attachments: ChatAttachment[]): Promise<ChatAttachment[]> {
  return Promise.all(attachments.map(async attachment => {
    if (!attachment.url.startsWith('blob:')) return attachment;
    const blob = await (await fetch(attachment.url)).blob();
    if (blob.size > 10 * 1024 * 1024) throw new Error('Attachments must be smaller than 10 MB');
    const path = `${threadId}/${crypto.randomUUID()}/${attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await getSupabase().storage.from('chat-attachments').upload(path, blob, { contentType: attachment.mimeType || blob.type || 'application/octet-stream' });
    if (error) throw error;
    return { ...attachment, url: '', storagePath: path };
  }));
}
export async function resolveChatAttachments(attachments: ChatAttachment[] = []): Promise<ChatAttachment[]> {
  return Promise.all(attachments.map(async attachment => {
    if (!attachment.storagePath) return attachment;
    return { ...attachment, url: await privateAssetUrl('chat-attachments',attachment.storagePath,3600) };
  }));
}
export async function sharedMessages(threadId: string): Promise<SharedMessage[]> {
  const { data, error } = await getSupabase().from('admin_chat_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true });
  if (error) throw error;
  return Promise.all((data || []).map(async message => ({ ...message, attachments: await resolveChatAttachments(message.attachments || []) })));
}
export async function sendSharedMessage(threadId: string, body: string, attachments: ChatAttachment[] = []): Promise<void> {
  if (!body.trim() && !attachments.length) return;
  const { data: { user }, error: authError } = await getSupabase().auth.getUser();
  if (authError || !user) throw new Error('Sign in to send messages');
  const savedAttachments = await persistChatAttachments(threadId, attachments);
  const { error } = await getSupabase().from('admin_chat_messages').insert({ thread_id: threadId, sender: 'participant', sender_user_id: user.id, body: body.trim(), attachments: savedAttachments });
  if (error) throw error;
}
export function subscribeChatUpdates(refresh: () => void): () => void {
  const client = getSupabase();
  const channel = client.channel(`messages-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_chat_threads' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_chat_messages' }, refresh).subscribe();
  const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 10000);
  const onFocus = () => refresh();
  window.addEventListener('focus', onFocus);
  return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); void client.removeChannel(channel); };
}
