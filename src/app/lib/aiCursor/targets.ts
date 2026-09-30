export type AiTargetInfo = {
  id: string;
  label: string;
};

const HIGHLIGHT_ATTR = 'data-ai-highlighted';

/** Find the first element tagged for AI guidance. */
export function findAiTarget(targetId: string): HTMLElement | null {
  if (!targetId || typeof document === 'undefined') return null;
  const safe =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(targetId)
      : targetId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return document.querySelector<HTMLElement>(`[data-ai-target="${safe}"]`);
}

/** Snapshot of currently mounted AI targets (for the model context block). */
export function listAiTargets(): AiTargetInfo[] {
  if (typeof document === 'undefined') return [];
  const seen = new Set<string>();
  const out: AiTargetInfo[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('[data-ai-target]')) {
    const id = el.getAttribute('data-ai-target')?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label =
      el.getAttribute('data-ai-label')?.trim() ||
      el.getAttribute('aria-label')?.trim() ||
      el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 60) ||
      id;
    out.push({ id, label });
  }
  return out;
}

export function formatAiTargetsForPrompt(targets: AiTargetInfo[]): string {
  if (targets.length === 0) {
    return 'No AI-targetable UI elements are currently on screen.';
  }
  return [
    'AI-targetable UI elements currently on screen (use these exact target ids):',
    ...targets.map((t) => `- ${t.id}: ${t.label}`),
  ].join('\n');
}

/** Centre point of an element in viewport coordinates. */
export function getElementCenter(el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/**
 * Scroll a target into view if needed, then wait briefly for layout to settle.
 */
export async function ensureTargetVisible(el: HTMLElement): Promise<void> {
  const rect = el.getBoundingClientRect();
  const margin = 48;
  const fullyVisible =
    rect.top >= margin &&
    rect.left >= margin &&
    rect.bottom <= window.innerHeight - margin &&
    rect.right <= window.innerWidth - margin;

  if (!fullyVisible) {
    el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
    await waitForScrollSettle(el, 280);
  }
}

function waitForScrollSettle(el: HTMLElement, timeoutMs = 280): Promise<void> {
  return new Promise((resolve) => {
    let last = `${el.getBoundingClientRect().top},${el.getBoundingClientRect().left}`;
    let stableFrames = 0;
    const started = performance.now();

    const tick = () => {
      const rect = el.getBoundingClientRect();
      const key = `${rect.top},${rect.left}`;
      if (key === last) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
        last = key;
      }
      if (stableFrames >= 3 || performance.now() - started > timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export function setTargetHighlighted(targetId: string | null): void {
  if (typeof document === 'undefined') return;
  for (const el of document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`)) {
    el.removeAttribute(HIGHLIGHT_ATTR);
  }
  if (!targetId) return;
  const el = findAiTarget(targetId);
  if (el) el.setAttribute(HIGHLIGHT_ATTR, 'true');
}

export { HIGHLIGHT_ATTR };
