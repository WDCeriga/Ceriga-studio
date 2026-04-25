const STORAGE_KEY = "ceriga-support-chat-v1";

export type SupportChatStoredMessage =
  | { id: string; role: "user"; text: string; imageSrc?: string }
  | { id: string; role: "assistant"; text: string };

function isUserRow(row: unknown): row is SupportChatStoredMessage & { role: "user" } {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  return (
    r.role === "user" &&
    typeof r.id === "string" &&
    typeof r.text === "string" &&
    (r.imageSrc === undefined || typeof r.imageSrc === "string")
  );
}

function isAssistantRow(row: unknown): row is SupportChatStoredMessage & { role: "assistant" } {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  return r.role === "assistant" && typeof r.id === "string" && typeof r.text === "string";
}

export function loadSupportChatSession(): SupportChatStoredMessage[] | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data) || data.length === 0) return null;
    const out: SupportChatStoredMessage[] = [];
    for (const row of data) {
      if (isAssistantRow(row)) {
        out.push({ id: row.id, role: "assistant", text: row.text });
      } else if (isUserRow(row)) {
        const src =
          typeof row.imageSrc === "string" && row.imageSrc.length > 0 && !row.imageSrc.startsWith("blob:")
            ? row.imageSrc
            : undefined;
        out.push({ id: row.id, role: "user", text: row.text, imageSrc: src });
      }
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export function persistSupportChatSession(messages: SupportChatStoredMessage[]): void {
  try {
    const storable = messages.map((m) => {
      if (m.role === "user" && m.imageSrc?.startsWith("blob:")) {
        return { ...m, imageSrc: undefined, text: m.text.trim() ? m.text : "Photo" };
      }
      return m;
    });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(storable));
  } catch {
    /* quota / private mode */
  }
}
