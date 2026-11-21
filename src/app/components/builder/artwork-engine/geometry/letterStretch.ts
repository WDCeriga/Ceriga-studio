/**
 * Per-letter stretching (reference 19). Pure. A letter's transform scales about its pivot, so to keep the
 * opposite edge fixed the pivot has to move with the scale. All values are in the text's own axes.
 */
export type LetterTransform = { x: number; y: number; rotation: number; scaleX: number; scaleY: number };
export type LetterBox = { left: number; top: number; right: number; bottom: number };
export type Handle = { x: -1 | 0 | 1; y: -1 | 0 | 1 };
export const IDENTITY_LETTER: LetterTransform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
export const LETTER_HANDLES: (Handle & { id: string; cursor: string })[] = [
  { id: 'nw', x: -1, y: -1, cursor: 'nwse-resize' }, { id: 'n', x: 0, y: -1, cursor: 'ns-resize' }, { id: 'ne', x: 1, y: -1, cursor: 'nesw-resize' },
  { id: 'e', x: 1, y: 0, cursor: 'ew-resize' }, { id: 'se', x: 1, y: 1, cursor: 'nwse-resize' }, { id: 's', x: 0, y: 1, cursor: 'ns-resize' },
  { id: 'sw', x: -1, y: 1, cursor: 'nesw-resize' }, { id: 'w', x: -1, y: 0, cursor: 'ew-resize' },
];
const MIN_SCALE = .05;

export function stretchLetter(start: LetterTransform, box: LetterBox, pivot: { x: number; y: number }, handle: Handle, dx: number, dy: number,
  options: { proportional?: boolean; fromCentre?: boolean; flipX?: boolean; flipY?: boolean } = {}): LetterTransform {
  const w = Math.max(.01, box.right - box.left), h = Math.max(.01, box.bottom - box.top), cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
  const reach = options.fromCentre ? 2 : 1;
  let kx = handle.x ? (w + dx * handle.x * reach) / w : 1, ky = handle.y ? (h + dy * handle.y * reach) / h : 1;
  if (options.proportional) {
    const k = !handle.x ? ky : !handle.y ? kx : Math.abs(kx - 1) >= Math.abs(ky - 1) ? kx : ky;
    kx = k; ky = k;
  }
  kx = Math.max(MIN_SCALE / Math.max(MIN_SCALE, start.scaleX), kx);
  ky = Math.max(MIN_SCALE / Math.max(MIN_SCALE, start.scaleY), ky);
  const anchorX = options.fromCentre || !handle.x ? cx : handle.x > 0 ? box.left : box.right;
  const anchorY = options.fromCentre || !handle.y ? cy : handle.y > 0 ? box.top : box.bottom;
  const movedX = anchorX - (anchorX - pivot.x) * kx - pivot.x, movedY = anchorY - (anchorY - pivot.y) * ky - pivot.y;
  return { ...start, x: start.x + movedX * (options.flipX ? -1 : 1), y: start.y + movedY * (options.flipY ? -1 : 1), scaleX: start.scaleX * kx, scaleY: start.scaleY * ky };
}
