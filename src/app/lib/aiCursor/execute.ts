import type { AiCursorAction, AiCursorActionResult, AiCursorPoint } from './types';
import {
  ensureTargetVisible,
  findAiTarget,
  getElementCenter,
  setTargetHighlighted,
} from './targets';

export type AiCursorDriver = {
  getPoint: () => AiCursorPoint;
  setVisible: (visible: boolean) => void;
  setBusy: (busy: boolean) => void;
  setHighlightTarget: (target: string | null) => void;
  /** Animate the overlay cursor to a viewport point. */
  animateTo: (point: AiCursorPoint, durationMs?: number) => Promise<void>;
};

const DEFAULT_MOVE_MS = 720;

export async function executeAiCursorAction(
  action: AiCursorAction,
  driver: AiCursorDriver,
): Promise<AiCursorActionResult> {
  switch (action.action) {
    case 'clear_cursor': {
      setTargetHighlighted(null);
      driver.setHighlightTarget(null);
      driver.setVisible(false);
      driver.setBusy(false);
      return { ok: true, action: 'clear_cursor' };
    }

    case 'highlight': {
      const el = findAiTarget(action.target);
      if (!el) {
        return {
          ok: false,
          action: 'highlight',
          target: action.target,
          error: `Target "${action.target}" not found on this page.`,
        };
      }
      driver.setBusy(true);
      try {
        await ensureTargetVisible(el);
        setTargetHighlighted(action.target);
        driver.setHighlightTarget(action.target);
        driver.setVisible(true);
        return { ok: true, action: 'highlight', target: action.target };
      } finally {
        driver.setBusy(false);
      }
    }

    case 'move_cursor': {
      const el = findAiTarget(action.target);
      if (!el) {
        return {
          ok: false,
          action: 'move_cursor',
          target: action.target,
          error: `Target "${action.target}" not found on this page.`,
        };
      }
      driver.setBusy(true);
      try {
        await ensureTargetVisible(el);
        const point = getElementCenter(el);
        driver.setVisible(true);
        await driver.animateTo(point, DEFAULT_MOVE_MS);
        const shouldHighlight = action.highlight !== false;
        if (shouldHighlight) {
          setTargetHighlighted(action.target);
          driver.setHighlightTarget(action.target);
        }
        return { ok: true, action: 'move_cursor', target: action.target };
      } finally {
        driver.setBusy(false);
      }
    }

    default: {
      const exhaustive: never = action;
      return {
        ok: false,
        action: 'clear_cursor',
        error: `Unsupported action: ${JSON.stringify(exhaustive)}`,
      };
    }
  }
}

export async function executeAiCursorActions(
  actions: AiCursorAction[],
  driver: AiCursorDriver,
): Promise<AiCursorActionResult[]> {
  const results: AiCursorActionResult[] = [];
  for (const action of actions) {
    results.push(await executeAiCursorAction(action, driver));
  }
  return results;
}
