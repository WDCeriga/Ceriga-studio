import type { AiCursorAction } from './types';

/** Match an AI_ACTIONS line anywhere (streaming or final). */
const ACTIONS_ANYWHERE = /(?:^|\n)\s*AI_ACTIONS:\s*([^\n]*)/i;
const ACTIONS_LINE = /\n?\s*AI_ACTIONS:\s*([^\n]*)\s*$/i;

const ALLOWED = new Set(['move_cursor', 'highlight', 'clear_cursor']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOne(raw: unknown): AiCursorAction | null {
  if (!isRecord(raw)) return null;
  const action = typeof raw.action === 'string' ? raw.action.trim() : '';
  if (!ALLOWED.has(action)) return null;

  if (action === 'clear_cursor') {
    return { action: 'clear_cursor' };
  }

  const target = typeof raw.target === 'string' ? raw.target.trim() : '';
  if (!target) return null;

  if (action === 'highlight') {
    return { action: 'highlight', target };
  }

  if (action === 'move_cursor') {
    const highlight =
      typeof raw.highlight === 'boolean' ? raw.highlight : undefined;
    return { action: 'move_cursor', target, highlight };
  }

  return null;
}

function parsePayload(payload: string): AiCursorAction[] {
  const trimmed = payload.trim();
  if (!trimmed || trimmed.toLowerCase() === 'none' || trimmed === '[]') return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list
      .map(parseOne)
      .filter((a): a is AiCursorAction => a !== null)
      .slice(0, 6);
  } catch {
    return [];
  }
}

/**
 * Strip a trailing `AI_ACTIONS: [...]` line from an assistant reply and
 * return the structured actions. Malformed payloads yield an empty list.
 */
export function parseAiCursorActions(raw: string): {
  text: string;
  actions: AiCursorAction[];
} {
  const match = raw.match(ACTIONS_LINE);
  if (!match) return { text: raw.trim(), actions: [] };

  const actions = parsePayload(match[1]);
  const text = raw.slice(0, match.index).trim();
  return { text, actions };
}

/**
 * Extract cursor actions from a partial or complete stream as soon as a
 * complete `AI_ACTIONS: [...]` line appears (not only at the end).
 */
export function extractAiCursorActionsFromStream(raw: string): AiCursorAction[] {
  const match = raw.match(ACTIONS_ANYWHERE);
  if (!match) return [];
  return parsePayload(match[1]);
}

/** Remove any AI_ACTIONS line(s) from display text (leading, middle, or trailing). */
export function stripAiCursorActionLines(raw: string): string {
  return raw
    .replace(/(?:^|\n)\s*AI_ACTIONS:\s*[^\n]*/gi, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
