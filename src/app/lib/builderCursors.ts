/**
 * Ceriga canvas cursors. Ink-coloured shapes with a white edge, so they read on light and dark garments.
 * The hands, move, text and rotate shapes use the same icon set as the Builder UI. Panels and buttons keep the system cursors.
 */
const INK = '#1f1f1d';
const encode = (body: string, size = 24) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 24 24'>${body}</svg>`)}`;
const cursor = (body: string, x: number, y: number, fallback: string) => `url("${encode(body)}") ${x} ${y}, ${fallback}`;
/** Line icons: a wide white stroke underneath, then the ink stroke. */
const line = (paths: string) => `<g fill='none' stroke-linecap='round' stroke-linejoin='round'><g stroke='white' stroke-width='4.4'>${paths}</g><g stroke='${INK}' stroke-width='1.7'>${paths}</g></g>`;

const HAND = "<path d='M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2'/><path d='M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2'/><path d='M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8'/><path d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'/>";
const GRAB = "<path d='M18 11.5V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4'/><path d='M14 10V8a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2'/><path d='M10 9.9V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v5'/><path d='M6 14a2 2 0 0 0-2-2a2 2 0 0 0-2 2'/><path d='M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8 2 2 0 1 1 4 0'/>";
const MOVE = "<path d='M12 2v20'/><path d='m15 19-3 3-3-3'/><path d='m19 9 3 3-3 3'/><path d='M2 12h20'/><path d='m5 9-3 3 3 3'/><path d='m9 5 3-3 3 3'/>";
const TEXT = "<path d='M17 22h-1a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h1'/><path d='M7 22h1a4 4 0 0 0 4-4v-1'/><path d='M7 2h1a4 4 0 0 1 4 4v1'/>";
const ROTATE = "<path d='M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8'/><path d='M21 3v5h-5'/>";

export const BUILDER_CURSORS = {
  /** A slimmer pointer with a soft white edge. */
  arrow: cursor(`<path d='M5 2.6v15.6l4-3.8 2.7 6 2.6-1.2-2.7-5.9h5.6z' fill='${INK}' stroke='white' stroke-width='1.4' stroke-linejoin='round'/>`, 5, 3, 'default'),
  grab: cursor(line(HAND), 12, 10, 'grab'),
  grabbing: cursor(line(GRAB), 12, 12, 'grabbing'),
  move: cursor(line(MOVE), 12, 12, 'move'),
  text: cursor(line(TEXT), 12, 12, 'text'),
  rotate: cursor(line(ROTATE), 12, 12, 'alias'),
  /** Fine crosshair with an open centre, so the exact point stays visible while drawing. */
  crosshair: cursor(line("<path d='M12 2.5v6M12 15.5v6M2.5 12h6M15.5 12h6'/>") + `<circle cx='12' cy='12' r='1.1' fill='${INK}' stroke='white' stroke-width='.8'/>`, 12, 12, 'crosshair'),
};

const resizeCache = new Map<number, string>();
/** A double arrow at any angle, so resizing rotated artwork points exactly along its edge. */
export function resizeCursorAt(angle: number) {
  const snapped = ((Math.round(angle / 15) * 15) % 180 + 180) % 180;
  let value = resizeCache.get(snapped);
  if (!value) {
    const keyword = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][Math.round(snapped / 45) % 4];
    value = cursor(`<g transform='rotate(${snapped} 12 12)'>${line("<path d='M4 12h16'/><path d='m7 9-3 3 3 3'/><path d='m17 9 3 3-3 3'/>")}</g>`, 12, 12, keyword);
    resizeCache.set(snapped, value);
  }
  return value;
}

let installed = false;
/** Shares the cursors with CSS as custom properties on the page root. */
export function installBuilderCursors() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const root = document.documentElement.style;
  for (const [name, value] of Object.entries(BUILDER_CURSORS)) root.setProperty(`--cx-cursor-${name}`, value);
  for (const [name, angle] of [['ew', 0], ['nwse', 45], ['ns', 90], ['nesw', 135]] as const) root.setProperty(`--cx-cursor-${name}`, resizeCursorAt(angle));
}
