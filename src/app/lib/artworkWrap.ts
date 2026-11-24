/** Print that runs off a sleeve or shoulder continues on the other side of the garment. */
export type WrapBox = { x: number; y: number; width: number; height: number; rotation?: number };
export type WrapEdges = { left: number; right: number; top: number; centre: number };
export type WrapCopy = { dx: number; mirrorOver?: { centre: number; top: number } };

export function rotatedExtent(box: WrapBox) {
  const angle = (box.rotation ?? 0) * Math.PI / 180, cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle)), halfWidth = (box.width * cos + box.height * sin) / 2, halfHeight = (box.width * sin + box.height * cos) / 2;
  return { left: box.x - halfWidth, right: box.x + halfWidth, top: box.y - halfHeight, bottom: box.y + halfHeight };
}

/**
 * Around a sleeve the art keeps its direction and moves across the garment's width.
 * Over a shoulder it turns upside down, as it does when the fabric folds to the back.
 * The neck opening is excluded because print cannot cross it.
 */
export function wrapCopies(box: WrapBox, edges: WrapEdges, tolerance = .5): WrapCopy[] {
  const extent = rotatedExtent(box), span = edges.right - edges.left, copies: WrapCopy[] = [];
  if (span <= 0) return copies;
  if (extent.right > edges.right + tolerance) copies.push({ dx: -span });
  if (extent.left < edges.left - tolerance) copies.push({ dx: span });
  const clearOfNeck = Math.abs(box.x - edges.centre) > span * .12;
  if (clearOfNeck && extent.top < edges.top - tolerance) copies.push({ dx: 0, mirrorOver: { centre: edges.centre, top: edges.top } });
  return copies;
}

export function placeWrapCopy<T extends { x: number; y: number; rotation: number }>(element: T, copy: WrapCopy): T {
  if (!copy.mirrorOver) return { ...element, x: element.x + copy.dx };
  return { ...element, x: 2 * copy.mirrorOver.centre - element.x, y: 2 * copy.mirrorOver.top - element.y, rotation: element.rotation + 180 };
}

/** Garment edges around a point, read from a mask's alpha. Coordinates are in mask pixels. */
export function maskEdges(alpha: ArrayLike<number>, width: number, height: number, x: number, y: number): WrapEdges | null {
  const row = Math.max(0, Math.min(height - 1, Math.round(y))), column = Math.max(0, Math.min(width - 1, Math.round(x)));
  let left = -1, right = -1, top = -1;
  for (let px = 0; px < width; px++) if (alpha[(row * width + px) * 4 + 3] > 32) { if (left < 0) left = px; right = px; }
  for (let py = 0; py < height; py++) if (alpha[(py * width + column) * 4 + 3] > 32) { top = py; break; }
  if (left < 0 || top < 0) return null;
  return { left, right: right + 1, top, centre: (left + right + 1) / 2 };
}

/** The garment's outer edges for every row and its top for every column, in mask pixels. */
export type MaskOutline = { width: number; height: number; left: Int32Array; right: Int32Array; top: Int32Array; minX: number; maxX: number };
export function maskOutline(alpha: ArrayLike<number>, width: number, height: number): MaskOutline {
  const left = new Int32Array(height).fill(-1), right = new Int32Array(height).fill(-1), top = new Int32Array(width).fill(-1);
  let minX = width, maxX = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (alpha[(y * width + x) * 4 + 3] > 32) {
    if (left[y] < 0) left[y] = x;
    right[y] = x + 1;
    if (top[x] < 0) top[x] = y;
    if (x < minX) minX = x;
    if (x + 1 > maxX) maxX = x + 1;
  }
  return { width, height, left, right, top, minX, maxX };
}

/** Where the gentle shoulder line turns into the steep sleeve edge, on each side. */
export function shoulderLimits(outline: MaskOutline) {
  const step = Math.max(4, Math.round((outline.maxX - outline.minX) * .02)), steep = (a: number, b: number) => outline.top[a] < 0 || outline.top[b] < 0 || Math.abs(outline.top[b] - outline.top[a]) / step > 1.2;
  let right = outline.maxX - 1 - step, left = outline.minX + step;
  while (right > outline.minX + step && (steep(right, right + step) || steep(right - step, right))) right--;
  while (left < outline.maxX - step && (steep(left - step, left) || steep(left, left + step))) left++;
  return { left, right: right + step };
}

/**
 * Maps what is cut off to where it continues. Past a side edge, each row restarts at the opposite edge of that same row.
 * Past the shoulder, each column folds over and mirrors across the centre. The neck opening is left out.
 */
export function wrapSlices(outline: MaskOutline, artWidth: number, artHeight: number) {
  const sx = artWidth / outline.width, sy = artHeight / outline.height, rows: { y: number; sx: number; dx: number; width: number }[] = [], columns: { x: number; dx: number; flipAt: number; height: number }[] = [], shoulders = shoulderLimits(outline), shoulderLeft = Math.round(shoulders.left * sx), shoulderRight = Math.round(shoulders.right * sx);
  for (let y = 0; y < artHeight; y++) {
    const row = Math.min(outline.height - 1, Math.floor(y / sy)), left = outline.left[row], right = outline.right[row];
    if (left < 0) continue;
    const artLeft = Math.round(left * sx), artRight = Math.round(right * sx);
    const fromRight = Math.max(artRight, shoulderRight), toLeft = Math.min(artLeft, shoulderLeft);
    if (fromRight < artWidth) rows.push({ y, sx: fromRight, dx: artLeft + fromRight - artRight, width: artWidth - fromRight });
    if (toLeft > 0) rows.push({ y, sx: 0, dx: artRight - artLeft, width: toLeft });
  }
  const centre = (outline.minX + outline.maxX) / 2 * sx, neck = (outline.maxX - outline.minX) * sx * .12;
  for (let x = 0; x < artWidth; x++) {
    if (Math.abs(x - centre) <= neck || x < shoulderLeft || x >= shoulderRight) continue;
    const column = Math.min(outline.width - 1, Math.floor(x / sx)), top = outline.top[column];
    if (top <= 0) continue;
    const dx = Math.round(2 * centre - x), target = outline.top[Math.max(0, Math.min(outline.width - 1, Math.floor(dx / sx)))];
    if (target < 0) continue;
    const height = Math.round(top * sy);
    columns.push({ x, dx, flipAt: height + Math.round(target * sy), height });
  }
  return { rows, columns };
}

/** The latest garment outline for each side, so print files can include art that wraps round. */
export type WrapOutline = { outline: MaskOutline; width: number; height: number };
// Kept on the page so every copy of this module (including after a hot reload) shares the same outlines.
const rememberedOutlines: Map<string, WrapOutline> = ((globalThis as { __cerigaWrapOutlines?: Map<string, WrapOutline> }).__cerigaWrapOutlines ??= new Map());
export function rememberWrapOutline(key: string, side: 'front' | 'back', entry: WrapOutline) { rememberedOutlines.set(`${key}|${side}`, entry); }
export function wrapOutlineFor(key: string, side: 'front' | 'back') { return rememberedOutlines.get(`${key}|${side}`) ?? rememberedOutlines.get(`${key}|${side === 'front' ? 'back' : 'front'}`) ?? null; }

/** True when a box runs past the garment's side edges or over its shoulder. Coordinates are in artwork units. */
export function crossesOutline(box: WrapBox, wrap: WrapOutline) {
  const { outline } = wrap, sx = wrap.width / outline.width, sy = wrap.height / outline.height, extent = rotatedExtent(box);
  for (let row = Math.max(0, Math.floor(extent.top / sy)); row < Math.min(outline.height, Math.ceil(extent.bottom / sy)); row++) {
    if (outline.left[row] < 0) continue;
    if (extent.left < outline.left[row] * sx || extent.right > outline.right[row] * sx) return true;
  }
  for (let column = Math.max(0, Math.floor(extent.left / sx)); column < Math.min(outline.width, Math.ceil(extent.right / sx)); column++) if (outline.top[column] > 0 && extent.top < outline.top[column] * sy) return true;
  return false;
}

/**
 * Vector version of the wrap for print files. The source art is drawn once and reused in thin bands,
 * each moved to where that slice continues on this side and clipped to just the part that was cut off.
 */
export function wrapProductionMarkup(sourceId: string, box: WrapBox, wrap: WrapOutline, prefix: string) {
  const { outline } = wrap, sx = wrap.width / outline.width, sy = wrap.height / outline.height, extent = rotatedExtent(box), defs: string[] = [], parts: string[] = [];
  const shoulders = shoulderLimits(outline), shoulderLeft = shoulders.left * sx, shoulderRight = shoulders.right * sx;
  const n = (value: number) => Number(value.toFixed(3));
  let count = 0;
  const band = (x: number, y: number, width: number, height: number, transform: string) => {
    if (width <= 0 || height <= 0) return;
    const id = `${prefix}-${count++}`;
    // A hair of overlap stops thin seams showing between neighbouring bands.
    const bleed = .3;
    defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><rect x="${n(x - bleed)}" y="${n(y - bleed)}" width="${n(width + bleed * 2)}" height="${n(height + bleed * 2)}"/></clipPath>`);
    parts.push(`<g clip-path="url(#${id})"><use href="#${sourceId}" transform="${transform}"/></g>`);
  };
  type Run = { start: number; end: number; key: string; values: number[] };
  const runs = (from: number, to: number, read: (index: number) => number[] | null) => {
    const list: Run[] = [];
    for (let index = from; index < to; index++) {
      const values = read(index);
      if (!values) continue;
      const key = values.map(value => Math.round(value * 4)).join(','), last = list[list.length - 1];
      if (last && last.key === key && last.end === index) last.end = index + 1;
      else list.push({ start: index, end: index + 1, key, values });
    }
    return list;
  };
  const rowFrom = Math.max(0, Math.floor(extent.top / sy)), rowTo = Math.min(outline.height, Math.ceil(extent.bottom / sy));
  for (const run of runs(rowFrom, rowTo, row => outline.left[row] < 0 ? null : [outline.left[row] * sx, outline.right[row] * sx])) {
    const [left, right] = run.values, top = run.start * sy, height = (run.end - run.start) * sy;
    const fromRight = Math.max(right, shoulderRight), toLeft = Math.min(left, shoulderLeft);
    if (extent.right > fromRight) band(left + fromRight - right, top, extent.right - fromRight, height, `translate(${n(left - right)} 0)`);
    if (extent.left < toLeft) band(extent.left + right - left, top, toLeft - extent.left, height, `translate(${n(right - left)} 0)`);
  }
  const centre = (outline.minX + outline.maxX) / 2 * sx, neck = (outline.maxX - outline.minX) * sx * .12;
  const columnFrom = Math.max(0, Math.floor(extent.left / sx)), columnTo = Math.min(outline.width, Math.ceil(extent.right / sx));
  for (const run of runs(columnFrom, columnTo, column => {
    const x = (column + .5) * sx, top = outline.top[column] * sy;
    if (Math.abs(x - centre) <= neck || x < shoulderLeft || x >= shoulderRight || outline.top[column] <= 0 || extent.top >= top) return null;
    const target = outline.top[Math.max(0, Math.min(outline.width - 1, Math.floor((2 * centre - x) / sx)))];
    return target < 0 ? null : [top, target * sy];
  })) {
    const [top, target] = run.values, x0 = run.start * sx, x1 = run.end * sx;
    band(2 * centre - x1, target, x1 - x0, top - extent.top, `matrix(-1 0 0 -1 ${n(2 * centre)} ${n(top + target)})`);
  }
  return { defs, markup: parts.join('') };
}
