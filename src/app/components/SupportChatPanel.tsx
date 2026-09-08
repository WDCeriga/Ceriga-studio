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
  ThumbsDown,
  ThumbsUp,
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
import { askOpenRouter, type ChatTurn, type ChatTextPart, type ChatImagePart } from "../lib/openrouterChat";
import { getBuilderChatContext } from "../lib/builderChatContext";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "./ui/utils";

export type SupportChatMessage =
  | { id: string; role: "user"; text: string; imageSrc?: string }
  | { id: string; role: "assistant"; text: string; feedback?: "up" | "down" };

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

/** Fallback replies when the AI service is unreachable or not configured. */
const FALLBACK_REPLIES = {
  noKey:
    "Our AI assistant isn't configured right now. Try a quick question below for instant answers, or reach the team via Studio messaging or email support.",
  generic:
    "Sorry — I couldn't reach the AI service just now. Try again in a moment, or use a quick question below. For anything account-specific, Studio messaging or email support will get you a human.",
};

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
  /** Message currently streaming in — rendered with progressive text. */
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  /** Follow-up chips from the latest assistant reply. */
  const [followUps, setFollowUps] = useState<string[]>([]);
  /** The user's current builder project, fetched when the chat opens. */
  const [builderContext, setBuilderContext] = useState<string | null>(null);
  /** True while a reply is pending or streaming — blocks new sends. */
  const busy = isTyping || streamingId !== null;
  /** Image attached but not yet sent — composed with the next message. */
  const [pendingImage, setPendingImage] = useState<{ src: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const builderContextRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
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
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    setIsTyping(false);
    setStreamingId(null);
    setStreamingText("");
  }, []);

  const appendAssistantMessage = useCallback((text: string) => {
    setMessages((m) => [...m, { id: newId(), role: "assistant", text }]);
  }, []);
  /**
   * Ask the OpenRouter-backed Ceriga assistant for a reply to the latest
   * user message(s) and stream the result in token-by-token. Falls back to
   * a canned reply if the service is unreachable or unconfigured.
   */
  const requestAssistantReply = useCallback(
    (history: ChatTurn[]) => {
      cancelPendingReply();
      setIsTyping(true);
      setStreamingText("");
      setFollowUps([]);
      const controller = new AbortController();
      requestAbortRef.current = controller;
      void (async () => {
        let streamId: string | null = null;
        try {
          const result = await askOpenRouter(history, {
            signal: controller.signal,
            contextBlock: builderContextRef.current,
            onDelta: (accumulated) => {
              if (controller.signal.aborted) return;
              if (!streamId) {
                streamId = newId();
                setStreamingId(streamId);
                setIsTyping(false);
              }
              setStreamingText(accumulated);
            },
          });
          if (controller.signal.aborted) return;
          const fallbackText =
            result.error === "no-key" || result.error === "invalid-key"
              ? FALLBACK_REPLIES.noKey
              : FALLBACK_REPLIES.generic;
          const finalText = result.ok ? result.text : fallbackText;
          // Promote whatever was streamed (or the fallback) to a persisted
          // message and surface its follow-up suggestions.
          setMessages((m) => [...m, { id: streamId ?? newId(), role: "assistant", text: finalText }]);
          if (result.ok) setFollowUps(result.followUps);
        } finally {
          if (!controller.signal.aborted) {
            requestAbortRef.current = null;
            setStreamingId(null);
            setStreamingText("");
            setIsTyping(false);
          }
        }
      })();
    },
    [cancelPendingReply],
  );

  /** Convert the visible message list into chat history for the model.
   * User messages with images become multimodal text+image parts. */
  const historyFromMessages = useCallback((msgs: SupportChatMessage[]): ChatTurn[] => {
    return msgs
      .filter((m) => m.id !== WELCOME.id)
      .map((m): ChatTurn | null => {
        if (m.role === "assistant") return { role: "assistant", content: m.text };
        const text = m.text.trim();
        if (m.imageSrc && !m.imageSrc.startsWith("blob:")) {
          const parts: Array<ChatTextPart | ChatImagePart> = [
            { type: "image_url", image_url: { url: m.imageSrc } },
          ];
          if (text) parts.push({ type: "text", text });
          return { role: "user", content: parts };
        }
        if (m.imageSrc) return { role: "user", content: text || "[Photo attachment]" };
        return text ? { role: "user", content: text } : null;
      })
      .filter((t): t is ChatTurn => t !== null);
  }, []);

  useEffect(() => {
    if (layout === "sheet" && !sheetOpen) {
      cancelPendingReply();
    }
  }, [layout, sheetOpen, cancelPendingReply]);

  /** Fetch builder context when the chat becomes visible; refetch per open
   * so the context tracks the project the user last touched. */
  useEffect(() => {
    if (layout === "sheet" && !sheetOpen) return;
    let cancelled = false;
    void getBuilderChatContext().then((ctx) => {
      if (!cancelled) {
        builderContextRef.current = ctx;
        setBuilderContext(ctx);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [layout, sheetOpen]);

  useEffect(() => {
    return () => cancelPendingReply();
  }, [cancelPendingReply]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, isTyping, streamingText]);

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
      if (busy) return;
      setMessages((m) => [...m, { id: newId(), role: "user", text: faq.question }]);
      requestAssistantReply([...historyFromMessages(messages), { role: "user", content: faq.question }]);
    },
    [busy, messages, historyFromMessages, requestAssistantReply],
  );

  /**
   * Downscale an picked image file to a JPEG data URL (max 1024px) so it is
   * small enough to display, persist, and send to the model.
   */
  const fileToDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read failed"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("decode failed"));
        img.onload = () => {
          const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const onPickImage = useCallback(
    (file: File | null) => {
      if (!file || !file.type.startsWith("image/") || busy) return;
      if (fileInputRef.current) fileInputRef.current.value = "";
      void fileToDataUrl(file)
        .then((dataUrl) => setPendingImage({ src: dataUrl, name: file.name }))
        .catch(() => {
          /* unreadable file — ignore */
        });
    },
    [busy, fileToDataUrl],
  );

  const removePendingImage = useCallback(() => setPendingImage(null), []);

  /**
   * Send the composed message: optional text, optional attached image —
   * at least one must be present. Both travel together in one user turn.
   */
  const sendCompose = useCallback(() => {
    const t = draft.trim();
    if ((!t && !pendingImage) || busy) return;
    const imageSrc = pendingImage?.src;
    setMessages((m) => [...m, { id: newId(), role: "user", text: t, imageSrc }]);
    setDraft("");
    setPendingImage(null);

    let turn: ChatTurn;
    if (imageSrc) {
      const parts: Array<ChatTextPart | ChatImagePart> = [
        { type: "image_url", image_url: { url: imageSrc } },
      ];
      if (t) parts.push({ type: "text", text: t });
      turn = { role: "user", content: parts };
    } else {
      turn = { role: "user", content: t };
    }
    requestAssistantReply([...historyFromMessages(messages), turn]);
  }, [draft, pendingImage, busy, messages, historyFromMessages, requestAssistantReply]);

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

  /** Rate an assistant reply; clicking the active thumb clears it. */
  const rateMessage = useCallback((id: string, value: "up" | "down") => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== id || m.role !== "assistant") return m;
        return { ...m, feedback: m.feedback === value ? undefined : value };
      }),
    );
  }, []);

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
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden bg-[#09090B] text-[#F0EEEE]", className)}>
      <div className="flex items-center gap-2 border-b border-[#252528] px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-3 sm:px-4 lg:pt-3">
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "flex shrink-0 items-center gap-0.5 rounded-[4px] py-1.5 pl-0.5 pr-2 text-[#F0EEEE] transition-colors hover:bg-[#1C1C1E]",
            layout === "sheet" && "lg:hidden",
          )}
          aria-label="Back"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={2} />
          <span className="text-base font-medium">Back</span>
        </button>

        <div className="min-w-0 flex-1 lg:text-left">
          <p className="ceriga-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[#CC2D24]">Ceriga</p>
          <p className="truncate font-semibold text-[#F0EEEE]">Chat with us</p>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {layout === "sheet" ? (
            <>
              <Link
                to="/support"
                onClick={() => onClose()}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-[4px] border border-[#252528] bg-[#161618] px-2 text-xs font-semibold text-[#A3A3A8] transition-colors hover:border-[#333338] hover:text-[#F0EEEE] sm:px-2.5"
                title="Open full chat page"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                <span className="hidden sm:inline">Full chat</span>
              </Link>
              {onDesktopExpandedChange ? (
                <button
                  type="button"
                  onClick={() => onDesktopExpandedChange(!desktopExpanded)}
                  className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-[#252528] bg-[#161618] text-[#8A8A90] transition-colors hover:border-[#333338] hover:text-[#F0EEEE] lg:flex"
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
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-[#252528] bg-[#161618] text-[#8A8A90] transition-colors hover:border-[#333338] hover:text-[#F0EEEE] lg:flex"
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
                    "rounded-[6px] px-3.5 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "rounded-br-sm bg-[#CC2D24] text-white"
                      : "rounded-bl-sm border border-[#252528] bg-[#161618] text-[#A3A3A8]",
                  )}
                >
                  {msg.role === "user" && msg.imageSrc && (
                    <div className="mb-2 overflow-hidden rounded-[4px] border border-white/15">
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
                        className="w-full resize-y rounded-[4px] border border-[#3A3A40] bg-[#09090B]/50 px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#CC2D24]/50 focus:ring-1 focus:ring-[#CC2D24]/30"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-[4px] px-2 py-1 text-[11px] font-medium text-white/70 hover:bg-black/20 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="rounded-[4px] bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/30"
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
                        className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#6B6B72] transition-colors hover:bg-[#1C1C1E] hover:text-[#F0EEEE]"
                        aria-label="Copy message"
                      >
                        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    )}
                    {msg.role === "assistant" && (
                      <>
                        <button
                          type="button"
                          onClick={() => rateMessage(msg.id, "up")}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-[4px] transition-colors",
                            msg.feedback === "up"
                              ? "bg-[#1C0F0F] text-[#E5534A]"
                              : "text-[#6B6B72] hover:bg-[#1C1C1E] hover:text-[#F0EEEE]",
                          )}
                          aria-label="Helpful reply"
                          aria-pressed={msg.feedback === "up"}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => rateMessage(msg.id, "down")}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-[4px] transition-colors",
                            msg.feedback === "down"
                              ? "bg-[#1C0F0F] text-[#E5534A]"
                              : "text-[#6B6B72] hover:bg-[#1C1C1E] hover:text-[#F0EEEE]",
                          )}
                          aria-label="Not helpful"
                          aria-pressed={msg.feedback === "down"}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </>
                    )}
                    {msg.role === "user" && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(msg)}
                          className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#6B6B72] transition-colors hover:bg-[#1C1C1E] hover:text-[#F0EEEE]"
                          aria-label="Edit message"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMessage(msg.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#6B6B72] transition-colors hover:bg-[#1C0F0F] hover:text-[#E5534A]"
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
          {streamingId !== null && (
            <div
              className="mr-auto flex max-w-[92%] flex-col gap-1"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="rounded-[6px] rounded-bl-sm border border-[#252528] bg-[#161618] px-3.5 py-2.5 text-sm leading-relaxed text-[#A3A3A8]">
                <span className="whitespace-pre-wrap">{streamingText}</span>
                <span
                  className="ml-0.5 inline-block h-3.5 w-[7px] translate-y-[2px] animate-pulse rounded-[1px] bg-[#CC2D24]/70"
                  aria-hidden
                />
              </div>
            </div>
          )}
          {isTyping && (
            <div
              className="mr-auto flex max-w-[92%] flex-col gap-1"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="rounded-[6px] rounded-bl-sm border border-[#252528] bg-[#161618] px-4 py-3">
                <div className="flex items-center gap-1.5" role="status">
                  <span className="sr-only">Ceriga is typing</span>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="inline-block h-2 w-2 animate-bounce rounded-full bg-[#8A8A90]"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
              <p className="pl-0.5 text-[10px] text-[#45454B]">Typing…</p>
            </div>
          )}
          {followUps.length > 0 && !busy && (
            <div className="flex flex-wrap gap-1.5 pl-0.5">
              {followUps.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (busy) return;
                    setFollowUps([]);
                    setMessages((m) => [...m, { id: newId(), role: "user", text: s }]);
                    requestAssistantReply([...historyFromMessages(messages), { role: "user", content: s }]);
                  }}
                  className="rounded-full border border-[#252528] bg-[#161618] px-3 py-1.5 text-[11px] font-medium text-[#A3A3A8] transition-colors hover:border-[#CC2D24]/40 hover:bg-[#1C0F0F] hover:text-[#F0EEEE]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div
        className="border-t border-[#252528] bg-[#111113] px-3 pt-2"
        style={{
          paddingBottom: `max(0.75rem, env(safe-area-inset-bottom, 0px), ${keyboardInset}px)`,
        }}
      >
        <p className="ceriga-mono mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[#6B6B72]">
          Quick questions
        </p>
        <div className="scrollbar-dark mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {SUPPORT_FAQS.map((faq) => (
            <button
              key={faq.id}
              type="button"
              disabled={busy}
              onClick={() => pushPair(faq)}
              className="shrink-0 rounded-[4px] border border-[#252528] bg-[#161618] px-2.5 py-1.5 text-left text-[11px] font-medium text-[#A3A3A8] transition-colors hover:border-[#CC2D24]/40 hover:bg-[#1C0F0F] hover:text-[#F0EEEE] disabled:cursor-not-allowed disabled:opacity-40"
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
            sendCompose();
          }}
        >
          {pendingImage && (
            <div className="flex items-center gap-2 rounded-[4px] border border-[#252528] bg-[#09090B] px-2 py-1.5">
              <div className="relative shrink-0">
                <img
                  src={pendingImage.src}
                  alt=""
                  className="h-10 w-10 rounded-[3px] border border-[#333338] object-cover"
                />
                <button
                  type="button"
                  onClick={removePendingImage}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-[#333338] bg-[#161618] text-[#A3A3A8] transition-colors hover:text-[#E5534A]"
                  aria-label="Remove attached image"
                >
                  <X className="h-2.5 w-2.5" strokeWidth={2.5} />
                </button>
              </div>
              <div className="min-w-0">
                <p className="ceriga-mono text-[9px] uppercase tracking-[0.08em] text-[#CC2D24]">
                  Image attached
                </p>
                <p className="truncate text-[11px] text-[#A3A3A8]">{pendingImage.name}</p>
              </div>
              <span className="ml-auto shrink-0 text-[10px] text-[#6B6B72]">
                Add a note or send as-is
              </span>
            </div>
          )}
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
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] border border-[#252528] bg-[#161618] text-[#8A8A90] transition-colors hover:border-[#333338] hover:text-[#F0EEEE] disabled:cursor-not-allowed disabled:opacity-40"
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
                  sendCompose();
                }
              }}
              placeholder={pendingImage ? "Describe what you need help with…" : "Type a message…"}
              rows={2}
              disabled={busy}
              className="min-h-[2.75rem] flex-1 resize-none rounded-[4px] border border-[#252528] bg-[#09090B] px-3 py-2 text-sm text-[#F0EEEE] placeholder:text-[#6B6B72] outline-none focus:border-[#CC2D24]/50 focus:ring-1 focus:ring-[#CC2D24]/25 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={(!draft.trim() && !pendingImage) || busy}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-[#CC2D24] text-white transition-colors hover:bg-[#E5534A] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
        <p className="mt-2 text-center text-[10px] text-[#45454B]">
          AI assistant with Ceriga Studio knowledge · A human can follow up on your account when needed
        </p>
      </div>
    </div>
  );
}
