"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, Copy, ImagePlus, MessageCircle, Pencil, Send, Trash2, User, X } from "lucide-react";
import { SUPPORT_FAQS, type SupportFaq } from "../data/supportChatFaq";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "./ui/utils";

type ChatMessage =
  | { id: string; role: "user"; text: string; imageSrc?: string }
  | { id: string; role: "assistant"; text: string };

function newId() {
  return crypto.randomUUID();
}

function revokeBlobUrl(src?: string) {
  if (src?.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(src);
    } catch {
      /* ignore */
    }
  }
}

function getMessageCopyText(msg: ChatMessage): string {
  if (msg.role === "assistant") return msg.text;
  const parts: string[] = [];
  if (msg.text.trim()) parts.push(msg.text);
  if (msg.imageSrc) parts.push("[Image attachment]");
  return parts.join(parts.length > 1 ? "\n" : "") || "";
}

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Hi — ask us anything, send a photo, or tap a quick question below. We’ll reply with guidance right away.",
};

/** Pause before automated replies — typing dots show during this window. */
const TYPING_DURATION_MS = 3500;

export function DashboardLiveChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formId = useId();

  const cancelPendingReply = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setIsTyping(false);
  }, []);

  const scheduleAssistantReply = useCallback(
    (text: string) => {
      cancelPendingReply();
      setIsTyping(true);
      typingTimerRef.current = setTimeout(() => {
        typingTimerRef.current = null;
        setIsTyping(false);
        setMessages((m) => [...m, { id: newId(), role: "assistant", text }]);
      }, TYPING_DURATION_MS);
    },
    [cancelPendingReply],
  );

  useEffect(() => {
    if (!open) {
      cancelPendingReply();
      return;
    }
    setMessages((prev) => {
      prev.forEach((m) => {
        if (m.role === "user" && m.imageSrc) revokeBlobUrl(m.imageSrc);
      });
      return [WELCOME];
    });
    setDraft("");
    setEditingId(null);
    setEditDraft("");
  }, [open, cancelPendingReply]);

  useEffect(() => {
    return () => cancelPendingReply();
  }, [cancelPendingReply]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, isTyping]);

  const pushPair = useCallback(
    (faq: SupportFaq) => {
      if (isTyping) return;
      setMessages((m) => [...m, { id: newId(), role: "user", text: faq.question }]);
      scheduleAssistantReply(faq.answer);
    },
    [isTyping, scheduleAssistantReply],
  );

  const sendText = useCallback(() => {
    const t = draft.trim();
    if (!t || isTyping) return;
    setMessages((m) => [...m, { id: newId(), role: "user", text: t }]);
    setDraft("");
    scheduleAssistantReply(
      "Thanks for your message. A team member can follow up for account-specific help. Meanwhile, try a quick question below for instant answers.",
    );
  }, [draft, isTyping, scheduleAssistantReply]);

  const onPickImage = useCallback(
    (file: File | null) => {
      if (!file || !file.type.startsWith("image/") || isTyping) return;
      const imageSrc = URL.createObjectURL(file);
      setMessages((m) => [...m, { id: newId(), role: "user", text: "", imageSrc }]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      scheduleAssistantReply(
        "We’ve received your image. If you need sizing or print feedback, add a short note in chat — our team reviews uploads during support hours.",
      );
    },
    [isTyping, scheduleAssistantReply],
  );

  const deleteMessage = useCallback((id: string) => {
    setMessages((prev) => {
      const target = prev.find((m) => m.id === id);
      if (target?.role === "user" && target.imageSrc) {
        revokeBlobUrl(target.imageSrc);
      }
      return prev.filter((m) => m.id !== id);
    });
    setEditingId((e) => (e === id ? null : e));
  }, []);

  const startEdit = useCallback((msg: ChatMessage) => {
    if (msg.role !== "user") return;
    setEditingId(msg.id);
    setEditDraft(msg.text || "");
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId) return;
    const next = editDraft.trim();
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== editingId || m.role !== "user") return m;
        return { ...m, text: next };
      }),
    );
    setEditingId(null);
    setEditDraft("");
  }, [editingId, editDraft]);

  const copyMessageText = useCallback((msg: ChatMessage) => {
    const t = getMessageCopyText(msg);
    if (!t) return;
    void navigator.clipboard.writeText(t).catch(() => {
      /* ignore */
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft("");
  }, []);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "fixed z-[95] flex items-center gap-2.5 rounded-2xl border border-white/12 bg-[#111113] px-3 py-2.5 text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)] transition-transform hover:border-white/18 hover:bg-[#161618] active:scale-[0.98] sm:px-3.5",
            "bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-[max(0.75rem,env(safe-area-inset-right,0px))] sm:bottom-6 sm:right-6",
          )}
          style={{ fontFamily: "'DM Sans', sans-serif" }}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#CC2D24]/30 bg-[#CC2D24]/12">
            <MessageCircle className="h-5 w-5 text-[#FCA5A5]" strokeWidth={2} aria-hidden />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-[#111113] bg-[#CC2D24]">
              <User className="h-2.5 w-2.5 text-white" strokeWidth={2.5} aria-hidden />
            </span>
          </span>
          <span className="max-w-[200px] text-left text-sm font-semibold leading-tight text-white/95 sm:max-w-none">
            Chat with us
          </span>
        </button>
      )}

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
        }}
      >
        <SheetContent
          side="right"
          className={cn(
            "flex flex-col gap-0 overflow-hidden bg-[#111113] p-0 text-white [&>button:last-child]:hidden",
            /* Phone / small tablet: full screen */
            "max-lg:!fixed max-lg:!inset-0 max-lg:!left-0 max-lg:!right-0 max-lg:!top-0 max-lg:!bottom-0 max-lg:!h-[100dvh] max-lg:!max-h-[100dvh] max-lg:!w-full max-lg:!max-w-none max-lg:!rounded-none max-lg:!border-0",
            /* Desktop: narrow panel */
            "lg:h-full lg:max-h-dvh lg:w-[min(100vw-1rem,400px)] lg:border-l lg:border-white/10",
          )}
        >
          <SheetTitle className="sr-only">Chat with us</SheetTitle>

          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:pt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex shrink-0 items-center gap-0.5 rounded-lg py-1.5 pl-0.5 pr-2 text-white/90 transition-colors hover:bg-white/10 lg:hidden"
              aria-label="Back"
            >
              <ChevronLeft className="h-7 w-7" strokeWidth={2} />
              <span className="text-base font-medium">Back</span>
            </button>
            <div className="min-w-0 flex-1 lg:text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#CC2D24]">
                Ceriga
              </p>
              <p className="truncate font-semibold text-white">Chat with us</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/80 transition-colors hover:bg-white/10 lg:flex"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ScrollArea className="min-h-0 flex-1 px-3">
            <div className="space-y-3 py-3">
              {messages.map((msg) => {
                const isEditing = editingId === msg.id && msg.role === "user";
                const canCopy = getMessageCopyText(msg).length > 0;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "group/msg flex max-w-[92%] flex-col gap-1",
                      msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "rounded-br-md bg-[#CC2D24] text-white"
                          : "rounded-bl-md border border-white/[0.08] bg-[#0D0D0F] text-white/75",
                      )}
                    >
                      {msg.role === "user" && msg.imageSrc && (
                        <div className="mb-2 overflow-hidden rounded-lg border border-white/15">
                          <img
                            src={msg.imageSrc}
                            alt=""
                            className="max-h-48 w-full object-cover"
                          />
                        </div>
                      )}

                      {isEditing ? (
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEdit();
                              }
                            }}
                            rows={Math.min(8, Math.max(2, editDraft.split("\n").length))}
                            className="w-full resize-y rounded-lg border border-white/20 bg-black/25 px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#CC2D24]/50 focus:ring-1 focus:ring-[#CC2D24]/30"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-lg px-2 py-1 text-[11px] font-medium text-white/55 hover:bg-white/10 hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={saveEdit}
                              className="rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/25"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {msg.role === "assistant" && <p>{msg.text}</p>}
                          {msg.role === "user" && (msg.text || msg.imageSrc) && (
                            <p className={!msg.text && msg.imageSrc ? "text-xs text-white/85" : ""}>
                              {msg.text || (msg.imageSrc ? "Photo attachment" : "")}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {!isEditing && (
                      <div
                        className={cn(
                          "flex items-center gap-0.5 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover/msg:opacity-100",
                          "md:group-focus-within/msg:opacity-100",
                          msg.role === "user" ? "justify-end pr-0.5" : "justify-start pl-0.5",
                        )}
                      >
                        {canCopy && (
                          <button
                            type="button"
                            onClick={() => copyMessageText(msg)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                            aria-label="Copy message"
                          >
                            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        )}
                        {msg.role === "user" && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(msg)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-black/30 hover:text-white"
                              aria-label="Edit message"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteMessage(msg.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-red-500/25 hover:text-red-200"
                              aria-label="Delete message"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {isTyping && (
                <div
                  className="mr-auto flex max-w-[92%] flex-col gap-1"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div className="rounded-2xl rounded-bl-md border border-white/[0.08] bg-[#0D0D0F] px-4 py-3">
                    <div className="flex items-center gap-1.5" role="status">
                      <span className="sr-only">Ceriga is typing</span>
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="inline-block h-2 w-2 animate-bounce rounded-full bg-white/55"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="pl-0.5 text-[10px] text-white/30">Typing…</p>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-white/10 bg-[#0d0d0f] px-3 pb-3 pt-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Quick questions
            </p>
            <div className="scrollbar-dark mb-3 flex gap-1.5 overflow-x-auto pb-1">
              {SUPPORT_FAQS.map((faq) => (
                <button
                  key={faq.id}
                  type="button"
                  disabled={isTyping}
                  onClick={() => pushPair(faq)}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-left text-[11px] font-medium text-white/80 transition-colors hover:border-[#CC2D24]/35 hover:bg-[#CC2D24]/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {faq.question}
                </button>
              ))}
            </div>

            <form
              id={formId}
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendText();
              }}
            >
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label="Upload image"
                  onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  disabled={isTyping}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white/70 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Add image"
                >
                  <ImagePlus className="h-5 w-5" />
                </button>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendText();
                    }
                  }}
                  placeholder="Type a message…"
                  rows={2}
                  disabled={isTyping}
                  className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-white/12 bg-[#111113] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-[#CC2D24]/45 focus:ring-1 focus:ring-[#CC2D24]/25 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || isTyping}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#CC2D24] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#CC2D24]/90"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
            <p className="mt-2 text-center text-[10px] text-white/30">
              Automated replies · A human can follow up on your account when needed
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
