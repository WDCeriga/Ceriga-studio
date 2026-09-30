export type {
  AiCursorAction,
  AiCursorActionResult,
  AiCursorPoint,
  AiCursorVisualState,
} from './types';
export { parseAiCursorActions, extractAiCursorActionsFromStream } from './parseAiActions';
export { guessCursorActionsFromUserMessage } from './eager';
export {
  findAiTarget,
  listAiTargets,
  formatAiTargetsForPrompt,
  ensureTargetVisible,
  getElementCenter,
  setTargetHighlighted,
} from './targets';
export { executeAiCursorAction, executeAiCursorActions } from './execute';
