import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Building2,
  FileText,
  ImagePlus,
  MessageSquare,
  Paperclip,
  Search,
  Send,
  Shield,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  listFactoryMessageThreads,
  markFactoryThreadRead,
  sendFactoryThreadMessage,
  type FactoryChatAttachment,
  type FactoryChatMessage,
  type FactoryChatThread,
} from '../../data/manufacturerPortalMock';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ScrollArea } from '../../components/ui/scroll-area';
import { cn } from '../../components/ui/utils';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const FILE_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/zip';

type PendingAttachment = FactoryChatAttachment & { id: string };

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function threadRoleLabel(thread: FactoryChatThread) {
  return thread.type === 'ceriga' ? 'Ceriga' : 'Worker';
}

function threadAccent(thread: FactoryChatThread) {
  return thread.type === 'ceriga' ? '#CC2D24' : '#a78bfa';
}

function revokeBlobUrl(url?: string) {
  if (url?.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

function formatFileSize(bytes?: number) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ThreadAvatar({ thread, size = 'md' }: { thread: FactoryChatThread; size?: 'sm' | 'md' }) {
  const accent = threadAccent(thread);
  const dim = size === 'sm' ? 'h-10 w-10 text-xs' : 'h-11 w-11 text-sm';

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full border font-semibold text-white',
        dim,
      )}
      style={{
        borderColor: `${accent}44`,
        background: `linear-gradient(145deg, ${accent}22 0%, rgba(0,0,0,0.45) 100%)`,
      }}
    >
      {initials(thread.name)}
      <span
        className={cn(
          'absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border border-[#111113] bg-[#111113]',
          size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
        )}
      >
        {thread.type === 'ceriga' ? (
          <Shield className={cn('text-red-300', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        ) : (
          <User className={cn('text-violet-300', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        )}
      </span>
    </div>
  );
}

function AttachmentPreview({
  attachment,
  outbound,
}: {
  attachment: FactoryChatAttachment;
  outbound: boolean;
}) {
  if (attachment.kind === 'image') {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-lg border border-white/15"
      >
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-h-52 w-full max-w-[16rem] object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={attachment.url}
      download={attachment.name}
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition hover:bg-white/[0.06]',
        outbound ? 'border-white/20 bg-black/15' : 'border-white/10 bg-black/25',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          outbound ? 'bg-white/10' : 'bg-white/[0.06]',
        )}
      >
        <FileText className="h-4 w-4 text-white/70" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">{attachment.name}</span>
        {attachment.size != null ? (
          <span className="text-[10px] text-white/40">{formatFileSize(attachment.size)}</span>
        ) : null}
      </span>
    </a>
  );
}

function MessageBubble({ message }: { message: FactoryChatMessage }) {
  const outbound = message.from === 'factory';
  const hasText = message.text.trim().length > 0;
  const attachments = message.attachments ?? [];

  return (
    <div className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[min(100%,28rem)] px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
          outbound
            ? 'rounded-2xl rounded-br-md bg-gradient-to-br from-[#CC2D24] to-[#a8241c] text-white'
            : 'rounded-2xl rounded-bl-md border border-white/[0.08] bg-[#141416] text-white/90',
        )}
      >
        {attachments.length > 0 ? (
          <div className={cn('space-y-2', hasText && 'mb-2')}>
            {attachments.map((attachment, index) => (
              <AttachmentPreview
                key={`${message.id}-att-${index}`}
                attachment={attachment}
                outbound={outbound}
              />
            ))}
          </div>
        ) : null}
        {hasText ? <p>{message.text}</p> : null}
        <time
          className={cn(
            'mt-1.5 block text-[10px] tabular-nums',
            outbound ? 'text-white/55' : 'text-white/35',
          )}
        >
          {message.at}
        </time>
      </div>
    </div>
  );
}

export function ManufacturerMessages() {
  const [tick, setTick] = useState(0);
  const threads = useMemo(() => listFactoryMessageThreads(), [tick]);
  const [active, setActive] = useState(threads[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(pendingAttachments);

  const thread = threads.find((t) => t.id === active) ?? threads[0];
  const messages = thread?.messages ?? [];
  const totalUnread = threads.reduce((sum, t) => sum + t.unread, 0);
  const canSend = draft.trim().length > 0 || pendingAttachments.length > 0;

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.lastMessage.toLowerCase().includes(q) ||
        t.subtitle.toLowerCase().includes(q) ||
        threadRoleLabel(t).toLowerCase().includes(q),
    );
  }, [search, threads]);

  useEffect(() => {
    pendingRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    return () => {
      pendingRef.current.forEach((a) => revokeBlobUrl(a.url));
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active, messages.length]);

  useEffect(() => {
    if (thread && !threads.some((t) => t.id === active) && threads[0]) {
      setActive(threads[0].id);
    }
  }, [threads, active, thread]);

  const clearPendingAttachments = () => {
    pendingAttachments.forEach((a) => revokeBlobUrl(a.url));
    setPendingAttachments([]);
  };

  const selectThread = (threadId: string) => {
    if (threadId === active) return;
    clearPendingAttachments();
    setDraft('');
    setActive(threadId);
    markFactoryThreadRead(threadId);
    setTick((n) => n + 1);
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      revokeBlobUrl(target?.url);
      return prev.filter((a) => a.id !== id);
    });
  };

  const addFiles = (files: FileList | null, kind: 'image' | 'file') => {
    if (!files?.length || !thread) return;

    const next: PendingAttachment[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} exceeds 10 MB`);
        continue;
      }

      if (kind === 'image' && !file.type.startsWith('image/')) {
        toast.error(`${file.name} is not a supported image`);
        continue;
      }

      next.push({
        id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: kind === 'image' || file.type.startsWith('image/') ? 'image' : 'file',
        name: file.name,
        url: URL.createObjectURL(file),
        size: file.size,
        mimeType: file.type,
      });
    }

    if (next.length === 0) return;

    setPendingAttachments((prev) => [...prev, ...next]);
    toast.success(next.length === 1 ? 'Attachment added' : `${next.length} attachments added`);
  };

  const onImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files, 'image');
    e.target.value = '';
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files, 'file');
    e.target.value = '';
  };

  const sendMessage = () => {
    if (!thread || !canSend) return;

    const text = draft.trim();
    const attachments: FactoryChatAttachment[] = pendingAttachments.map(
      ({ id: _id, ...rest }) => rest,
    );

    sendFactoryThreadMessage(
      thread.id,
      text,
      attachments.length > 0 ? attachments : undefined,
    );
    setDraft('');
    setPendingAttachments([]);
    setTick((n) => n + 1);
    toast.success(
      thread.type === 'ceriga' ? 'Sent to Ceriga ops' : `Sent to ${thread.name}`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#CC2D24]">
            Inbox
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Messages
          </h1>
          <p className="mt-1 max-w-xl text-sm text-white/45">
            Message Ceriga operations or Ceriga workers. Brand chat stays on each order.
          </p>
        </div>
        {totalUnread > 0 ? (
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#CC2D24]/30 bg-[#CC2D24]/10 px-3 py-1.5 text-xs font-medium text-red-100">
            <span className="h-1.5 w-1.5 rounded-full bg-[#CC2D24]" />
            {totalUnread} unread
          </span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113]">
        <div className="grid min-h-[620px] lg:grid-cols-[minmax(260px,320px)_1fr]">
          <aside className="flex flex-col border-b border-white/[0.06] lg:border-b-0 lg:border-r">
            <div className="border-b border-white/[0.06] p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations…"
                  className="h-10 border-white/10 bg-black/30 pl-9 text-sm text-white placeholder:text-white/30"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-0.5 p-2">
                {filteredThreads.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-white/40">No conversations</p>
                ) : (
                  filteredThreads.map((t) => {
                    const selected = t.id === thread?.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectThread(t.id)}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition',
                          selected ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
                        )}
                      >
                        <ThreadAvatar thread={t} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-white">{t.name}</p>
                            <span className="shrink-0 text-[10px] tabular-nums text-white/35">
                              {t.lastAt}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span
                              className={cn(
                                'rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide',
                                t.type === 'ceriga'
                                  ? 'bg-[#CC2D24]/15 text-red-200'
                                  : 'bg-violet-500/15 text-violet-200',
                              )}
                            >
                              {threadRoleLabel(t)}
                            </span>
                            <p className="truncate text-[11px] text-white/40">{t.subtitle}</p>
                          </div>
                          <p
                            className={cn(
                              'mt-1 truncate text-[12px]',
                              t.unread > 0 ? 'font-medium text-white/80' : 'text-white/45',
                            )}
                          >
                            {t.lastMessage}
                          </p>
                        </div>
                        {t.unread > 0 ? (
                          <span className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#CC2D24] px-1 text-[10px] font-semibold text-white">
                            {t.unread}
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </aside>

          <section className="flex min-h-[420px] flex-col">
            {thread ? (
              <>
                <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5 sm:px-6">
                  <ThreadAvatar thread={thread} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{thread.name}</p>
                    <p className="truncate text-[11px] text-white/40">
                      {thread.subtitle}
                      {thread.type === 'ceriga'
                        ? ' · Usually replies within a few hours on weekdays'
                        : ''}
                    </p>
                  </div>
                  <span className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/45 sm:inline-flex">
                    {thread.type === 'ceriga' ? (
                      <Building2 className="h-3 w-3" />
                    ) : (
                      <MessageSquare className="h-3 w-3" />
                    )}
                    {threadRoleLabel(thread)}
                  </span>
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-4 px-4 py-5 sm:px-6">
                    {messages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))}
                    <div ref={bottomRef} />
                  </div>
                </ScrollArea>

                <div className="border-t border-white/[0.06] bg-[#111113]/80 p-4 backdrop-blur-sm sm:px-6">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    multiple
                    className="hidden"
                    onChange={onImageChange}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={FILE_ACCEPT}
                    multiple
                    className="hidden"
                    onChange={onFileChange}
                  />

                  {pendingAttachments.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {pendingAttachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="group relative flex max-w-[10rem] items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-2 py-2"
                        >
                          {attachment.kind === 'image' ? (
                            <img
                              src={attachment.url}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                              <FileText className="h-4 w-4 text-white/60" />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-medium text-white">
                              {attachment.name}
                            </span>
                            <span className="text-[10px] text-white/35">
                              {formatFileSize(attachment.size)}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removePendingAttachment(attachment.id)}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-[#1a1a1a] text-white/60 transition hover:text-white"
                            aria-label={`Remove ${attachment.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/40 p-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10 shrink-0 rounded-xl text-white/55 hover:bg-white/10 hover:text-white"
                      onClick={() => imageInputRef.current?.click()}
                      aria-label="Upload image"
                    >
                      <ImagePlus className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10 shrink-0 rounded-xl text-white/55 hover:bg-white/10 hover:text-white"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Upload file"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={
                        thread.type === 'ceriga'
                          ? 'Message Ceriga ops…'
                          : `Message ${thread.name}…`
                      }
                      className="min-h-10 flex-1 border-0 bg-transparent text-sm text-white shadow-none placeholder:text-white/30 focus-visible:ring-0"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      disabled={!canSend}
                      className="h-10 w-10 shrink-0 rounded-xl bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90 disabled:opacity-40"
                      onClick={sendMessage}
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-white/40">
                Select a conversation
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
