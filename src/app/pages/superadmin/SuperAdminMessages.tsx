import { useState } from 'react';
import { Send, User, Factory } from 'lucide-react';
import { toast } from 'sonner';
import { MOCK_THREADS } from '../../data/superadminMock';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cn } from '../../components/ui/utils';

export function SuperAdminMessages() {
  const [active, setActive] = useState(MOCK_THREADS[0]?.id ?? '');
  const thread = MOCK_THREADS.find((t) => t.id === active);

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-4 lg:min-h-[calc(100dvh-6rem)] lg:flex-row lg:gap-0">
      <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-white/[0.08] bg-[#111113] lg:w-[min(100%,320px)] lg:rounded-r-none lg:border-r-0">
        <div className="border-b border-white/10 p-4">
          <h1 className="text-lg font-semibold text-white">Messages</h1>
          <p className="mt-1 text-xs text-white/45">WhatsApp-style threads with manufacturers and brands.</p>
          <Button
            size="sm"
            className="mt-3 w-full bg-[#CC2D24] hover:bg-[#CC2D24]/90"
            onClick={() => toast.success('Mock: invite flow')}
          >
            Invite to chat
          </Button>
        </div>
        <div className="max-h-[40vh] overflow-y-auto lg:max-h-none lg:flex-1">
          {MOCK_THREADS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                'flex w-full gap-3 border-b border-white/[0.06] px-4 py-3 text-left transition hover:bg-white/[0.04]',
                active === t.id && 'bg-[#CC2D24]/15',
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5',
                  t.type === 'manufacturer' ? 'text-amber-300/90' : 'text-sky-300/90',
                )}
              >
                {t.type === 'manufacturer' ? <Factory className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-white">{t.name}</span>
                  <span className="shrink-0 text-[10px] text-white/40">{t.lastAt}</span>
                </div>
                <div className="truncate text-xs text-white/45">{t.lastMessage}</div>
              </div>
              {t.unread > 0 && (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#CC2D24] px-1 text-[10px] font-bold text-white">
                  {t.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-[320px] flex-1 flex-col rounded-2xl border border-white/[0.08] bg-[#0a0a0a] lg:rounded-l-none">
        {thread ? (
          <>
            <div className="border-b border-white/10 px-4 py-3 sm:px-6">
              <h2 className="font-medium text-white">{thread.name}</h2>
              <p className="text-xs text-white/45">{thread.subtitle}</p>
            </div>
            <div className="flex flex-1 flex-col justify-end p-4 sm:p-6">
              <div className="mb-4 space-y-3">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#CC2D24] px-3 py-2 text-sm text-white">
                  Hi — can you confirm thread gauge for the rib?
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85">
                  {thread.lastMessage}
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message…"
                  className="border-white/15 bg-white/5 text-white placeholder:text-white/35"
                  onKeyDown={(e) => e.key === 'Enter' && toast.success('Mock: message sent')}
                />
                <Button className="shrink-0 bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={() => toast.success('Mock: message sent')}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-white/45">Select a thread</div>
        )}
      </section>
    </div>
  );
}
