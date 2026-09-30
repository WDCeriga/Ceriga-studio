import type { AiCursorAction } from './types';
import type { AiTargetInfo } from './targets';

const GUIDANCE =
  /\b(where|point|show|find|highlight|cursor|take me|how do i|how can i|guide|look at|click)\b/i;

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !['the', 'and', 'for', 'with', 'from', 'that', 'this', 'where', 'what', 'how'].includes(t));
}

/**
 * Instant client-side cursor guess so guidance feels snappy while the LLM
 * still streams the spoken reply. Returns [] when unsure.
 */
export function guessCursorActionsFromUserMessage(
  message: string,
  targets: AiTargetInfo[],
): AiCursorAction[] {
  if (!message.trim() || targets.length === 0) return [];
  if (!GUIDANCE.test(message)) return [];

  const qTokens = tokens(message);
  if (qTokens.length === 0) return [];

  let best: { id: string; score: number } | null = null;
  for (const t of targets) {
    const hay = tokens(`${t.id} ${t.label}`);
    if (hay.length === 0) continue;
    let score = 0;
    for (const qt of qTokens) {
      if (hay.some((h) => h === qt || h.includes(qt) || qt.includes(h))) {
        score += qt.length >= 5 ? 3 : 2;
      }
    }
    // Strong boosts for common Ceriga intents
    const id = t.id.toLowerCase();
    if (/\b(new project|start (a )?project|create)\b/i.test(message)) {
      if (id.includes('start-project') || id.includes('new-project') || id === 'nav-create') {
        score += 8;
      }
    }
    if (/\b(order|orders|track)\b/i.test(message) && id.includes('order')) score += 6;
    if (/\b(draft|project|projects|saved)\b/i.test(message) && (id.includes('project') || id === 'nav-home')) {
      score += 4;
    }
    if (/\bsettings?\b/i.test(message) && id.includes('settings')) score += 6;
    if (score > 0 && (!best || score > best.score)) {
      best = { id: t.id, score };
    }
  }

  if (!best || best.score < 4) return [];
  return [{ action: 'move_cursor', target: best.id }];
}
