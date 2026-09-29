/** Structured AI → frontend cursor actions (not OS mouse control). */

export type AiCursorAction =
  | { action: 'move_cursor'; target: string; highlight?: boolean }
  | { action: 'highlight'; target: string }
  | { action: 'clear_cursor' };

export type AiCursorActionResult =
  | { ok: true; action: AiCursorAction['action']; target?: string }
  | { ok: false; action: AiCursorAction['action']; target?: string; error: string };

export type AiCursorPoint = { x: number; y: number };

export type AiCursorVisualState = {
  visible: boolean;
  point: AiCursorPoint;
  /** Currently highlighted `data-ai-target` id, if any. */
  highlightTarget: string | null;
  /** True while an animation / scroll is in flight. */
  busy: boolean;
};
