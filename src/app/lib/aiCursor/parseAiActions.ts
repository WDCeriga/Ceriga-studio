import type { AiCursorAction } from './types';

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

  const payload = match[1].trim();
  const text = raw.slice(0, match.index).trim();
  if (!payload || payload.toLowerCase() === 'none' || payload === '[]') {
    return { text, actions: [] };
  }

  try {
    const parsed: unknown = JSON.parse(payload);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const actions = list
      .map(parseOne)
      .filter((a): a is AiCursorAction => a !== null)
      .slice(0, 6);
    return { text, actions };
  } catch {
    return { text, actions: [] };
  }
}
