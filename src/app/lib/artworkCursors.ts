import { BUILDER_CURSORS, resizeCursorAt } from './builderCursors';
/** Keep resize arrows aligned with the handles when artwork is rotated. */
export function artworkResizeCursor(handle: string, rotation = 0) {
  const angles: Record<string, number> = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 };
  return resizeCursorAt((angles[handle] ?? 0) + rotation);
}

export const ARTWORK_ROTATE_CURSOR = BUILDER_CURSORS.rotate;
