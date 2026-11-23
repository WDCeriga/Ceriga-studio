import { activeLocale as cerigaLocale } from '../i18n/i18n';
import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../i18n/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useMessagingAccess } from '../lib/useMessagingAccess';
import { messageContacts, sharedThreads, sharedMessages, startSharedChat, sendSharedMessage, subscribeChatUpdates, type MessageContact, type SharedThread, type SharedMessage } from '../lib/sharedMessages';
import type { ChatAttachment } from '../data/superadminMock';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MessageImagePreview } from './MessageImagePreview';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

const errorText = (error: unknown) => (error as { message?: string })?.message || 'Unable to load messages';
export function MemberMessages() {
  useCerigaTranslation();

  const { user, isAuthenticated, usingSupabase, authReady } = useAuth();
  const access = useMessagingAccess();
  const accountId = user?.id || null;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [contacts, setContacts] = useState<MessageContact[]>([]);
  const [threads, setThreads] = useState<SharedThread[]>([]);
  const [messages, setMessages] = useState<SharedMessage[]>([]);
  const [active, setActive] = useState('');
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const pending = useRef(attachments); pending.current = attachments;
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [search, setSearch] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const refresh = useCallback(() => setTick(value => value + 1), []);
  const connected = Boolean(authReady && isAuthenticated && usingSupabase && user?.id && access.allowed);
  useEffect(() => {
    pending.current.forEach(file => URL.revokeObjectURL(file.url));
    setContacts([]); setThreads([]); setMessages([]); setActive(''); setDraft(''); setAttachments([]); setLoadedFor(null); setLoading(true);
  }, [accountId]);
  useEffect(() => {
    if (!connected) return;
    return subscribeChatUpdates(refresh);
  }, [connected, refresh, accountId]);
  useEffect(() => {
    if (!connected) return;
    let current = true;
    void Promise.all([messageContacts(), sharedThreads()]).then(([people, rows]) => {
      if (!current) return;
      setContacts(people); setThreads(rows); setError('');
      setActive(previous => rows.some(row => row.id === previous) ? previous : rows[0]?.id || '');
    }).catch(cause => { if (current) setError(errorText(cause)); }).finally(() => { if (current) { setLoading(false); setLoadedFor(accountId); } });
    return () => { current = false; };
  }, [connected, tick, accountId]);
  useEffect(() => {
    let current = true;
    if (active && connected) void sharedMessages(active).then(rows => { if (current) setMessages(rows); }).catch(cause => { if (current) setError(errorText(cause)); });
    return () => { current = false; };
  }, [active, connected, tick, accountId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages.length]);
  useEffect(() => () => pending.current.forEach(file => URL.revokeObjectURL(file.url)), []);
  const nameFor = (thread: SharedThread) => {
    if (thread.recipient_user_id === null) return 'Ceriga Support';
    const peer = thread.participant_user_id === user?.id ? thread.recipient_user_id : thread.participant_user_id;
    return peer ? contacts.find(contact => contact.id === peer)?.name || 'Studio member' : 'Ceriga Support';
  };
  const clearAttachments = () => { attachments.forEach(file => URL.revokeObjectURL(file.url)); setAttachments([]); };
  const chooseThread = (id: string) => { setMessages([]); setActive(id); setDraft(''); clearAttachments(); };
  const create = async (contact: MessageContact) => {
    if (creating) return;
    setCreating(true);
    try {
      const id = await startSharedChat(contact.id);
      const rows = await sharedThreads(); setThreads(rows); chooseThread(id); setNewOpen(false); setSearch(''); refresh();
    } catch (cause) { toast.error(cerigaTranslateLabel(errorText(cause))); } finally { setCreating(false); }
  };
  const send = async () => {
    if (!active || sending || (!draft.trim() && !attachments.length)) return;
    setSending(true);
    try { await sendSharedMessage(active, draft, attachments); setDraft(''); clearAttachments(); refresh(); }
    catch (cause) { toast.error(cerigaTranslateLabel(errorText(cause))); }
    finally { setSending(false); }
  };
  if (!authReady) return <p className="text-white/50">{cerigaTranslate("interface.text_3a496d425b0f4530")}</p>;
  if (access.loading) return <p className="text-white/50">{cerigaTranslate("interface.text_d2fa315bc9fda192")}</p>;
  if (access.error) return <p role="alert" className="text-red-300">{cerigaTranslate("interface.text_b2b1a48989a32826")}{" "}{access.error}</p>;
  if (isAuthenticated && !access.allowed) return <p className="text-white/60">{cerigaTranslate("interface.text_93d6129191fb7c4d")}</p>;
  if (!connected) return <p className="text-white/60">{cerigaTranslate("interface.text_7250971af00d47b7")}</p>;
  if (loadedFor !== accountId) return <p className="text-white/50">{cerigaTranslate("interface.text_3a496d425b0f4530")}</p>;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-semibold text-white">{cerigaTranslate("nav.messages")}</h1><Button disabled={sending || creating} onClick={() => setNewOpen(true)}>{cerigaTranslate("interface.text_396c946f0c795aa6")}</Button></div>
      {error && <div role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{cerigaTranslateLabel(error)} <button className="underline" onClick={refresh}>{cerigaTranslate("interface.text_942087cc2d41e013")}</button></div>}
      <div className="grid min-h-[65vh] overflow-hidden rounded-xl border border-[#252528] bg-[#111113] md:grid-cols-[260px_1fr]">
        <aside aria-label={cerigaTranslate("interface.text_1d432f58690c2b4a")} className="max-h-64 overflow-y-auto border-b border-[#252528] p-3 md:max-h-[75vh] md:border-b-0 md:border-r">
          {loading && <p className="text-sm text-white/40">{cerigaTranslate("interface.text_1eec1dfc13a43e8f")}</p>}
          {!loading && !threads.length && <p className="text-sm text-white/40">{cerigaTranslate("interface.text_28382a07fe6f671e")}</p>}
          {threads.map(thread => <button key={thread.id} disabled={sending || creating} aria-pressed={active === thread.id} onClick={() => chooseThread(thread.id)} className={`mb-1 block w-full rounded-lg p-3 text-left text-white hover:bg-white/5 ${active === thread.id ? 'bg-white/10' : ''}`}><span className="block text-sm font-medium">{nameFor(thread)}</span><span className="block truncate text-xs text-white/40">{thread.last_message || cerigaTranslate("interface.text_f42e0f66017d9937")}</span></button>)}
        </aside>
        <section aria-label={cerigaTranslate("interface.text_95ae8355923fb801")} className="flex min-h-96 min-w-0 flex-col">
          {active ? <>
            <h2 className="border-b border-[#252528] p-4 font-semibold text-white">{threads.find(row => row.id === active) ? nameFor(threads.find(row => row.id === active)!) : cerigaTranslate("interface.text_ccca181757536587")}</h2>
            <div className="max-h-[55vh] flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite">
              {messages.map(message => <div key={message.id} className={`max-w-[85%] rounded-xl p-3 text-sm text-white ${message.sender_user_id === user?.id ? 'ml-auto bg-[#CC2D24]' : 'mr-auto bg-white/10'}`}>
                <p className="mb-1 text-[10px] text-white/60">{message.sender_user_id === user?.id ? cerigaTranslate("interface.text_08b041935798fbf6") : message.sender === 'admin' ? cerigaTranslate("interface.text_49c6fd48ec76ae54") : cerigaTranslate("interface.text_7c968fb71f50e335")}</p>
                {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
                {message.attachments.map((file, index) => file.kind === 'image'
                  ? <MessageImagePreview key={index} url={file.url} name={file.name} className="mt-2 block max-w-full" imageClassName="max-h-48 rounded object-contain" />
                  : <a key={index} href={file.url} target="_blank" rel="noreferrer" className="mt-2 block underline">{file.name}</a>)}
                <time className="mt-1 block text-[10px] text-white/50">{new Date(message.created_at).toLocaleString(cerigaLocale())}</time>
              </div>)}<div ref={bottom} />
            </div>
            <div className="border-t border-[#252528] p-3">
              {attachments.map((file,index) => <button key={file.url} aria-label={cerigaTranslate("interface.text_e224cf245aada55a",{value0:(file.name)})} className="mb-2 mr-2 text-xs text-white/60" onClick={() => { URL.revokeObjectURL(file.url); setAttachments(previous => previous.filter((_,i) => i !== index)); }}>{file.name} ×</button>)}
              <div className="flex gap-2"><Input aria-label={cerigaTranslate("interface.text_2f77668a9dfbf8d5")} value={draft} disabled={sending} placeholder={cerigaTranslate("interface.text_dc9f3f9fa011a11e")} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} className="border-white/15 text-white" /><Button disabled={sending || (!draft.trim() && !attachments.length)} onClick={() => void send()}>{sending ? cerigaTranslate("authentication.sending") : cerigaTranslate("interface.text_f6f4688ff23d50c6")}</Button></div>
              <label className="mt-2 inline-block cursor-pointer text-xs text-white/50">{cerigaTranslate("messages.attachment")}<input aria-label={cerigaTranslate("messages.attachment")} type="file" multiple className="sr-only" disabled={sending} onChange={event => {
                const selected = Array.from(event.target.files || []);
                if (selected.some(file => file.size > 10 * 1024 * 1024)) { toast.error(cerigaTranslate("interface.text_2e97288310ec2a09")); event.target.value = ''; return; }
                setAttachments(previous => [...previous, ...selected.map(file => ({ kind: file.type.startsWith('image/') ? 'image' as const : 'file' as const, name: file.name, size: file.size, mimeType: file.type, url: URL.createObjectURL(file) }))]); event.target.value = '';
              }} /></label>
            </div>
          </> : <p className="m-auto p-5 text-center text-sm text-white/40">{cerigaTranslate("interface.text_5712927fdfd833e1")}</p>}
        </section>
      </div>
      <Dialog open={newOpen} onOpenChange={open => { if (!creating) setNewOpen(open); }}><DialogContent className="border-[#252528] bg-[#111113] text-white"><DialogHeader><DialogTitle>{cerigaTranslate("interface.text_396c946f0c795aa6")}</DialogTitle></DialogHeader><Input aria-label={cerigaTranslate("interface.text_f863aac2492efb3e")} placeholder={cerigaTranslate("interface.text_1116b26144c43358")} value={search} onChange={event => setSearch(event.target.value)} /><div className="max-h-80 space-y-1 overflow-y-auto">{contacts.filter(contact => `${contact.name} ${contact.role}`.toLowerCase().includes(search.toLowerCase())).map(contact => <button key={contact.id} disabled={creating} onClick={() => void create(contact)} className="flex w-full items-center justify-between rounded-lg p-3 text-left hover:bg-white/5 disabled:opacity-50"><span>{contact.name}</span><span className="text-xs text-white/40">{contact.role}</span></button>)}</div>{creating && <p role="status" className="text-xs text-white/50">{cerigaTranslate("interface.text_12a7ad1d379e91a6")}</p>}</DialogContent></Dialog>
    </div>
  );
}
