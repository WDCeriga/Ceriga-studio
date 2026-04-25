"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ChevronLeft,
  Copy,
  ExternalLink,
  ImagePlus,
  Maximize2,
  Minimize2,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router";
import { SUPPORT_FAQS, type SupportFaq } from "../data/supportChatFaq";
import {
  loadSupportChatSession,
  persistSupportChatSession,
  type SupportChatStoredMessage,
} from "../data/supportChatSession";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "./ui/utils";

export type SupportChatMessage =
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

function getMessageCopyText(msg: SupportChatMessage): string {
  if (msg.role === "assistant") return msg.text;
  const parts: string[] = [];
  if (msg.text.trim()) parts.push(msg.text);
  if (msg.imageSrc) parts.push("[Image attachment]");
  return parts.join(parts.length > 1 ? "\n" : "") || "";
}

const WELCOME: SupportChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Hi — ask us anything, send a photo, or tap a quick question below. We’ll reply with guidance right away.",
};

const TYPING_DURATION_MS = 3500;

function initialMessages(): SupportChatMessage[] {
  const loaded = loadSupportChatSession();
  if (!loaded?.length) return [WELCOME];
  return loaded.map((m) =>
    m.role === "assistant"
      ? { id: m.id, role: "assistant", text: m.text }
      : { id: m.id, role: "user", text: m.text, imageSrc: m.imageSrc },
  );
}

export type SupportChatPanelProps = {
  layout: "sheet" | "page";
  /** When embedded in the dashboard sheet, pass open state so typing timers cancel when closed. */
  sheetOpen?: boolean;
  onClose: () => void;
  desktopExpanded?: boolean;
  onDesktopExpandedChange?: (next: boolean) => void;
  className?: string;
};

export function SupportChatPanel({
  layout,
  sheetOpen = true,
  onClose,
  desktopExpanded = false,
  onDesktopExpandedChange,
  className,
}: SupportChatPanelProps) {
  const [messages, setMessages] = useState<SupportChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formId = useId();
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    persistSupportChatSession(messages as SupportChatStoredMessage[]);
  }, [messages]);

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
    if (layout === "sheet" && !sheetOpen) {
      cancelPendingReply();
    }
  }, [layout, sheetOpen, cancelPendingReply]);

  useEffect(() => {
    return () => cancelPendingReply();
  }, [cancelPendingReply]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (layout === "page") {
      setKeyboardInset(0);
      return;
    }
    if (!sheetOpen) {
      setKeyboardInset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const updateInset = () => {
      const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const bottomOverlap = Math.max(0, window.innerHeight - vv.bottom);
      setKeyboardInset(Math.max(gap, bottomOverlap));
    };
    updateInset();
    vv.addEventListener("resize", updateInset);
    vv.addEventListener("scroll", updateInset);
    return () => {
      vv.removeEventListener("resize", updateInset);
      vv.removeEventListener("scroll", updateInset);
    };
  }, [layout, sheetOpen]);

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

  const startEdit = useCallback((msg: SupportChatMessage) => {
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

  const copyMessageText = useCallback((msg: SupportChatMessage) => {
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
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden bg-[#111113] text-white", className)}>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-3 sm:px-4 lg:pt-3">
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "flex shrink-0 items-center gap-0.5 rounded-lg py-1.5 pl-0.5 pr-2 text-white/90 transition-colors hover:bg-white/10",
            layout === "sheet" && "lg:hidden",
          )}
          aria-label="Back"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={2} />
          <span className="text-base font-medium">Back</span>
        </button>

        <div className="min-w-0 flex-1 lg:text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#CC2D24]">Ceriga</p>
          <p className="truncate font-semibold text-white">Chat with us</p>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {layout === "sheet" ? (
            <>
              <Link
                to="/support"
                onClick={() => onClose()}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 text-xs font-semibold text-white/85 transition-colors hover:bg-white/10 sm:px-2.5"
                title="Open full chat page"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                <span className="hidden sm:inline">Full chat</span>
              </Link>
              {onDesktopExpandedChange ? (
                <button
                  type="button"
                  onClick={() => onDesktopExpandedChange(!desktopExpanded)}
                  className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/80 transition-colors hover:bg-white/10 lg:flex"
                  aria-label={desktopExpanded ? "Use narrow chat panel" : "Widen chat panel"}
                  title={desktopExpanded ? "Narrow panel" : "Widen panel"}
                >
                  {desktopExpanded ? (
                    <Minimize2 className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <Maximize2 className="h-4 w-4" strokeWidth={2} />
                  )}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/80 transition-colors hover:bg-white/10 lg:flex"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </>
          ) : null}
        </div>
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
                      <img src={msg.imageSrc} alt="" className="max-h-48 w-full object-cover" />
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

      <div
        className="border-t border-white/10 bg-[#0d0d0f] px-3 pt-2"
        style={{
          paddingBottom: `max(0.75rem, env(safe-area-inset-bottom, 0px), ${keyboardInset}px)`,
        }}
      >
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
    </div>
  );
}
