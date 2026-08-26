/** Prepare potrace SVG exports for inline rendering. */
export function tintPotraceSvg(
  raw: string,
  fill: string,
  mode: 'solid' | 'outline' | 'detail' = 'solid',
  interactive = false,
): string {
  let svg = raw
    .replace(/width="2048[^"]*"/i, 'width="100%"')
    .replace(/height="2048[^"]*"/i, 'height="100%"');

  if (mode === 'outline') {
    return svg
      .replace(/fill="#000000"/gi, 'fill="none"')
      .replace(/fill="#000"/gi, 'fill="none"')
      .replace(/fill="black"/gi, 'fill="none"')
      .replace(
        /(<g transform="[^"]+")[^>]*>/,
        `$1 fill="none" stroke="${fill}" stroke-width="12" stroke-linejoin="round" stroke-linecap="round">`,
      );
  }

  let result = svg
    .replace(/fill="#000000"/gi, `fill="${fill}"`)
    .replace(/fill="#000"/gi, `fill="${fill}"`)
    .replace(/fill="black"/gi, `fill="${fill}"`)
    .replace(
      /(<g transform="[^"]+")[^>]*>/,
      `$1 fill="${fill}" stroke="none" fill-rule="evenodd">`,
    );

  if (interactive) {
    result = result.replace(/<path /gi, '<path pointer-events="all" ');
  }

  return result;
}

/** Construction lines drawn on top of solid fills. */
export const TSHIRT_OUTLINE_COLOR = 'rgba(255,255,255,0.55)';

/** Zip / hardware when no trim colour is set. */
export const TSHIRT_DETAIL_COLOR = '#B0B0B0';

export interface PotraceSvgBBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerY: number;
}

const bboxCache = new Map<string, PotraceSvgBBox | null>();
const splitBBoxCache = new Map<string, { left: PotraceSvgBBox | null; right: PotraceSvgBBox | null }>();

interface PotraceSvgMetrics {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  vbW: number;
  vbH: number;
}

function parsePotraceGroupTransform(tfm: string) {
  const tMatch = tfm.match(/translate\s*\(\s*([^,)]+)\s*,\s*([^)]+)\)/);
  const sMatch = tfm.match(/scale\s*\(\s*([^,)]+)\s*,\s*([^)]+)\)/);
  return {
    tx: tMatch ? parseFloat(tMatch[1]) : 0,
    ty: tMatch ? parseFloat(tMatch[2]) : 2048,
    sx: sMatch ? parseFloat(sMatch[1]) : 0.1,
    sy: sMatch ? parseFloat(sMatch[2]) : -0.1,
  };
}

function bboxFromExtents(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): PotraceSvgBBox | null {
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function potraceLocalBBoxToViewBox(
  b: DOMRect,
  metrics: PotraceSvgMetrics,
): PotraceSvgBBox | null {
  const minX = Math.max(0, Math.min(metrics.vbW, metrics.tx + metrics.sx * b.x));
  const maxX = Math.max(0, Math.min(metrics.vbW, metrics.tx + metrics.sx * (b.x + b.width)));
  const minY = Math.max(0, Math.min(metrics.vbH, metrics.ty + metrics.sy * (b.y + b.height)));
  const maxY = Math.max(0, Math.min(metrics.vbH, metrics.ty + metrics.sy * b.y));
  return bboxFromExtents(minX, minY, maxX, maxY);
}

function splitPathSubpaths(d: string): string[] {
  const trimmed = d.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/(?=[Mm])/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [trimmed];
}

function potracePointToViewBox(
  px: number,
  py: number,
  metrics: PotraceSvgMetrics,
) {
  return {
    x: Math.max(0, Math.min(metrics.vbW, metrics.tx + metrics.sx * px)),
    y: Math.max(0, Math.min(metrics.vbH, metrics.ty + metrics.sy * py)),
  };
}

export type SleeveSide = 'left' | 'right';

function parseSubpathMoveto(d: string): { px: number; py: number } | null {
  const match = d.trim().match(/^M\s*([-\d.eE+]+)\s*,?\s*([-\d.eE+]+)/i);
  if (!match) return null;
  return { px: parseFloat(match[1]), py: parseFloat(match[2]) };
}

function bboxArea(box: PotraceSvgBBox): number {
  return (box.maxX - box.minX) * (box.maxY - box.minY);
}

function intersectBBoxes(a: PotraceSvgBBox, b: PotraceSvgBBox): PotraceSvgBBox | null {
  return bboxFromExtents(
    Math.max(a.minX, b.minX),
    Math.max(a.minY, b.minY),
    Math.min(a.maxX, b.maxX),
    Math.min(a.maxY, b.maxY),
  );
}

function pickTighterVerticalBBox(primary: PotraceSvgBBox, candidate: PotraceSvgBBox | null): PotraceSvgBBox {
  if (!candidate) return primary;
  const primaryHeight = primary.maxY - primary.minY;
  const candidateHeight = candidate.maxY - candidate.minY;
  if (candidateHeight <= primaryHeight) return candidate;
  return primary;
}

interface SubpathEntry {
  d: string;
  viewBox: PotraceSvgBBox;
  start: { x: number; y: number };
  area: number;
}

const MIN_SIDE_SUBPATH_AREA = 2000;
const MAX_SIDE_SAMPLE_STEPS = 256;

function measureSampledSideBBox(
  group: SVGGElement,
  d: string,
  metrics: PotraceSvgMetrics,
  side: SleeveSide,
  mid: number,
): PotraceSvgBBox | null {
  const temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  temp.setAttribute('d', d);
  group.appendChild(temp);

  try {
    const total = temp.getTotalLength();
    if (!Number.isFinite(total) || total <= 0) return null;

    const steps = Math.min(MAX_SIDE_SAMPLE_STEPS, Math.max(32, Math.ceil(total / 16)));
    const isLeft = side === 'left';
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let count = 0;

    for (let i = 0; i <= steps; i += 1) {
      const pt = temp.getPointAtLength((i / steps) * total);
      const { x, y } = potracePointToViewBox(pt.x, pt.y, metrics);
      const onSide = isLeft ? x < mid : x >= mid;
      if (!onSide) continue;
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    if (count < 4) return null;
    return bboxFromExtents(minX, minY, maxX, maxY);
  } catch {
    return null;
  } finally {
    temp.remove();
  }
}

function pickPrimarySubpath(
  entries: SubpathEntry[],
  side: SleeveSide,
  mid: number,
  canvas: number,
): SubpathEntry | null {
  const bottomStartY = canvas * 0.92;
  const candidates = entries.filter(({ start, area }) => {
    const onSide = side === 'left' ? start.x < mid : start.x >= mid;
    return onSide && start.y < bottomStartY && area >= MIN_SIDE_SUBPATH_AREA;
  });

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.area - a.area)[0] ?? null;
}

function sideSliceFromViewBox(
  viewBox: PotraceSvgBBox,
  side: SleeveSide,
  mid: number,
): PotraceSvgBBox | null {
  if (side === 'left') {
    if (viewBox.minX >= mid) return null;
    return bboxFromExtents(
      viewBox.minX,
      viewBox.minY,
      Math.min(viewBox.maxX, mid),
      viewBox.maxY,
    );
  }

  if (viewBox.maxX <= mid) return null;
  return bboxFromExtents(
    Math.max(viewBox.minX, mid),
    viewBox.minY,
    viewBox.maxX,
    viewBox.maxY,
  );
}

function measurePrimarySideBBox(
  group: SVGGElement,
  metrics: PotraceSvgMetrics,
  entries: SubpathEntry[],
  side: SleeveSide,
  mid: number,
  canvas: number,
): PotraceSvgBBox | null {
  const primary = pickPrimarySubpath(entries, side, mid, canvas);
  if (!primary) return null;

  const sliced = sideSliceFromViewBox(primary.viewBox, side, mid);
  if (!sliced) return null;

  const sampled = measureSampledSideBBox(group, primary.d, metrics, side, mid);
  const tighter = pickTighterVerticalBBox(sliced, sampled);
  return intersectBBoxes(sliced, tighter) ?? tighter;
}

function unionIntoExtents(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  box: PotraceSvgBBox,
) {
  return {
    minX: Math.min(minX, box.minX),
    maxX: Math.max(maxX, box.maxX),
    minY: Math.min(minY, box.minY),
    maxY: Math.max(maxY, box.maxY),
  };
}

function measureAllPotraceBBoxes(
  svgRaw: string,
  canvas = 2048,
): {
  full: PotraceSvgBBox | null;
  left: PotraceSvgBBox | null;
  right: PotraceSvgBBox | null;
} {
  if (typeof document === 'undefined') {
    return { full: null, left: null, right: null };
  }

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;left:-32000px;top:0;width:200px;height:200px;visibility:hidden;pointer-events:none;overflow:hidden;';

  const markup = svgRaw
    .replace(/width="[^"]*"/i, 'width="200"')
    .replace(/height="[^"]*"/i, 'height="200"');
  host.innerHTML = markup;
  document.body.appendChild(host);

  try {
    const svg = host.querySelector('svg');
    const group = svg?.querySelector('g[transform]') as SVGGElement | null;
    const paths = Array.from(host.querySelectorAll('svg path')) as SVGPathElement[];
    if (!group || paths.length === 0) return { full: null, left: null, right: null };

    const { tx, ty, sx, sy } = parsePotraceGroupTransform(group.getAttribute('transform') ?? '');
    const vbParts = svg?.getAttribute('viewBox')?.trim().split(/\s+|,/).map(Number);
    const metrics: PotraceSvgMetrics = {
      tx,
      ty,
      sx,
      sy,
      vbW: vbParts?.[2] ?? 2048,
      vbH: vbParts?.[3] ?? 2048,
    };
    const mid = canvas / 2;

    let fullMinX = Infinity;
    let fullMaxX = -Infinity;
    let fullMinY = Infinity;
    let fullMaxY = -Infinity;
    const subpathEntries: SubpathEntry[] = [];

    const measureTempPath = (d: string): PotraceSvgBBox | null => {
      const temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      temp.setAttribute('d', d);
      group.appendChild(temp);
      try {
        const b = temp.getBBox();
        if (!(b.width > 0 || b.height > 0 || b.x !== 0 || b.y !== 0)) return null;
        return potraceLocalBBoxToViewBox(b, metrics);
      } catch {
        return null;
      } finally {
        temp.remove();
      }
    };

    paths.forEach((path) => {
      try {
        const b = path.getBBox();
        if (b.width > 0 || b.height > 0 || b.x !== 0 || b.y !== 0) {
          const viewBox = potraceLocalBBoxToViewBox(b, metrics);
          if (viewBox) {
            ({ minX: fullMinX, maxX: fullMaxX, minY: fullMinY, maxY: fullMaxY } = unionIntoExtents(
              fullMinX,
              fullMaxX,
              fullMinY,
              fullMaxY,
              viewBox,
            ));
          }
        }
      } catch { /* ignore */ }

      splitPathSubpaths(path.getAttribute('d') ?? '').forEach((subpath) => {
        const viewBox = measureTempPath(subpath);
        if (!viewBox) return;

        const moveto = parseSubpathMoveto(subpath);
        if (!moveto) return;

        subpathEntries.push({
          d: subpath,
          viewBox,
          start: potracePointToViewBox(moveto.px, moveto.py, metrics),
          area: bboxArea(viewBox),
        });
      });
    });

    const full = bboxFromExtents(fullMinX, fullMinY, fullMaxX, fullMaxY);
    let left = measurePrimarySideBBox(group, metrics, subpathEntries, 'left', mid, canvas);
    let right = measurePrimarySideBBox(group, metrics, subpathEntries, 'right', mid, canvas);

    if (full) {
      const split = splitBBoxAtCenter(full, canvas);
      left = left ?? split.left;
      right = right ?? split.right;
    }

    return { full, left, right };
  } catch {
    return { full: null, left: null, right: null };
  } finally {
    if (host.parentNode) document.body.removeChild(host);
  }
}

function getPotraceGeometry(svgRaw: string, canvas = 2048) {
  if (bboxCache.has(svgRaw) && splitBBoxCache.has(svgRaw)) {
    return {
      full: bboxCache.get(svgRaw)!,
      left: splitBBoxCache.get(svgRaw)!.left,
      right: splitBBoxCache.get(svgRaw)!.right,
    };
  }

  const measured = measureAllPotraceBBoxes(svgRaw, canvas);
  bboxCache.set(svgRaw, measured.full);
  splitBBoxCache.set(svgRaw, { left: measured.left, right: measured.right });
  return measured;
}

/**
 * Get the exact bounding box of a potrace SVG in its 0–2048 viewBox coordinate space.
 *
 * Strategy:
 * 1. Insert the SVG into an offscreen 200×200 div so the browser can compute geometry.
 * 2. Call getBBox() on each <path> — paths have no transform, so getBBox() returns
 *    coordinates in the <g>'s local space (potrace space, scale 10×, Y-flipped).
 * 3. Read the <g> transform attributes and apply them to convert to viewBox space.
 *
 * Results are cached per raw SVG string.
 */
export function getPotraceSvgBBox(svgRaw: string): PotraceSvgBBox | null {
  return getPotraceGeometry(svgRaw).full;
}

export function splitBBoxAtCenter(bbox: PotraceSvgBBox, canvas = 2048): {
  left: PotraceSvgBBox;
  right: PotraceSvgBBox;
} {
  const mid = canvas / 2;
  const leftMaxX = Math.min(mid, bbox.maxX);
  const rightMinX = Math.max(mid, bbox.minX);

  const left: PotraceSvgBBox = {
    minX: bbox.minX,
    maxX: leftMaxX,
    minY: bbox.minY,
    maxY: bbox.maxY,
    centerX: (bbox.minX + leftMaxX) / 2,
    centerY: bbox.centerY,
  };

  const right: PotraceSvgBBox = {
    minX: rightMinX,
    maxX: bbox.maxX,
    minY: bbox.minY,
    maxY: bbox.maxY,
    centerX: (rightMinX + bbox.maxX) / 2,
    centerY: bbox.centerY,
  };

  return { left, right };
}

/** Tight left/right bboxes from actual path geometry on each canvas half. */
export function splitPotraceSvgBBoxAtCenter(
  svgRaw: string,
  canvas = 2048,
): { left: PotraceSvgBBox | null; right: PotraceSvgBBox | null } {
  const { left, right } = getPotraceGeometry(svgRaw, canvas);
  return { left, right };
}

export function isValidBBox(bbox: PotraceSvgBBox): boolean {
  return bbox.maxX > bbox.minX && bbox.maxY > bbox.minY;
}

/** Shift sleeve hem so its top edge sits on the active sleeve asset's bottom edge. */
export function computeSleeveHemAlignOffset(
  sleeveSvgRaw: string,
  hemSvgRaw: string,
): { x: number; y: number } {
  const sleeve = getPotraceSvgBBox(sleeveSvgRaw);
  const hem = getPotraceSvgBBox(hemSvgRaw);
  if (!sleeve || !hem) return { x: 0, y: 0 };

  return {
    x: sleeve.centerX - hem.centerX,
    y: sleeve.maxY - hem.minY,
  };
}

/** Per-side cuff alignment after splitting sleeve + hem down the canvas center. */
export function computeSleeveHemAlignOffsetForSide(
  sleeveSvgRaw: string,
  hemSvgRaw: string,
  side: SleeveSide,
): { x: number; y: number } {
  const sleeveBBox = getPotraceSvgBBox(sleeveSvgRaw);
  const hemBBox = getPotraceSvgBBox(hemSvgRaw);
  if (!sleeveBBox || !hemBBox) return { x: 0, y: 0 };

  const { left: sleeveLeft, right: sleeveRight } = splitPotraceSvgBBoxAtCenter(sleeveSvgRaw);
  const { left: hemLeft, right: hemRight } = splitPotraceSvgBBoxAtCenter(hemSvgRaw);
  const sleeve = side === 'left' ? sleeveLeft : sleeveRight;
  const hem = side === 'left' ? hemLeft : hemRight;

  if (!sleeve || !hem || !isValidBBox(sleeve) || !isValidBBox(hem)) return { x: 0, y: 0 };

  return {
    x: sleeve.centerX - hem.centerX,
    y: sleeve.maxY - hem.minY,
  };
}

function hexToRgba(hex: string): [number, number, number, number] {
  const n = hex.replace('#', '').trim();
  const full =
    n.length === 3
      ? n
          .split('')
          .map((c) => c + c)
          .join('')
      : n.padStart(6, '0').slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
    255,
  ];
}

function shadeTowardBlack(hex: string, amount: number): string {
  const [r, g, b] = hexToRgba(hex);
  const t = Math.min(1, Math.max(0, amount));
  const mix = (c: number) => Math.round(c * (1 - t));
  const to = (c: number) => mix(c).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function dilateAlphaMask(data: Uint8ClampedArray, width: number, height: number, radius: number) {
  if (radius <= 0) return;
  for (let pass = 0; pass < radius; pass += 1) {
    const copy = new Uint8ClampedArray(data);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4;
        if (copy[i + 3] > 32) continue;
        let hit = false;
        for (let dy = -1; dy <= 1 && !hit; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const j = ((y + dy) * width + (x + dx)) * 4;
            if (copy[j + 3] > 32) {
              hit = true;
              break;
            }
          }
        }
        if (hit) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 255;
        }
      }
    }
  }
}

function inkMaskFromImageData(data: Uint8ClampedArray, size: number): Uint8Array {
  const mask = new Uint8Array(size * size);
  for (let idx = 0; idx < size * size; idx += 1) {
    if (data[idx * 4 + 3] > 32) mask[idx] = 1;
  }
  return mask;
}

function stampInk(mask: Uint8Array, size: number, x: number, y: number, radius: number) {
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > r2) continue;
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
      mask[yy * size + xx] = 1;
    }
  }
}

/** Bresenham line stamped with thickness onto a binary mask. */
function drawBridge(
  mask: Uint8Array,
  size: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness: number,
) {
  let x = x0 | 0;
  let y = y0 | 0;
  const xEnd = x1 | 0;
  const yEnd = y1 | 0;
  const dx = Math.abs(xEnd - x);
  const dy = Math.abs(yEnd - y);
  const sx = x < xEnd ? 1 : -1;
  const sy = y < yEnd ? 1 : -1;
  let err = dx - dy;
  const radius = Math.max(1, Math.round(thickness / 2));

  for (;;) {
    stampInk(mask, size, x, y, radius);
    if (x === xEnd && y === yEnd) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

type InkComponent = {
  id: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixels: number[];
};

function labelInkComponents(mask: Uint8Array, size: number): {
  labels: Int32Array;
  components: InkComponent[];
} {
  const labels = new Int32Array(size * size);
  const components: InkComponent[] = [];
  let nextId = 1;
  const queue: number[] = [];

  for (let start = 0; start < size * size; start += 1) {
    if (!mask[start] || labels[start]) continue;
    const id = nextId++;
    let minX = size;
    let minY = size;
    let maxX = 0;
    let maxY = 0;
    const pixels: number[] = [];
    labels[start] = id;
    queue.length = 0;
    queue.push(start);

    while (queue.length) {
      const idx = queue.pop()!;
      pixels.push(idx);
      const x = idx % size;
      const y = (idx / size) | 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const nidx = ny * size + nx;
          if (!mask[nidx] || labels[nidx]) continue;
          labels[nidx] = id;
          queue.push(nidx);
        }
      }
    }

    if (pixels.length < 24) continue;
    components.push({ id, minX, minY, maxX, maxY, pixels });
  }

  return { labels, components };
}

/** Simple iterative thinning toward a 1px skeleton (enough for endpoint finding). */
function thinInkSkeleton(mask: Uint8Array, size: number, maxPasses = 12): Uint8Array {
  const skel = new Uint8Array(mask);
  const neighbors = (idx: number) => {
    const x = idx % size;
    const y = (idx / size) | 0;
    let count = 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        if (skel[ny * size + nx]) count += 1;
      }
    }
    return count;
  };

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const toClear: number[] = [];
    for (let idx = 0; idx < size * size; idx += 1) {
      if (!skel[idx]) continue;
      const n = neighbors(idx);
      // Keep endpoints and junctions; peel thick boundaries.
      if (n >= 3 && n <= 7) {
        const x = idx % size;
        const y = (idx / size) | 0;
        // Only remove if it's a boundary-ish pixel (has empty neighbor)
        let empty = false;
        for (let dy = -1; dy <= 1 && !empty; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size || !skel[ny * size + nx]) {
              empty = true;
              break;
            }
          }
        }
        if (empty) toClear.push(idx);
      }
    }
    if (!toClear.length) break;
    for (const idx of toClear) skel[idx] = 0;
  }
  return skel;
}

function findSkeletonEndpoints(skel: Uint8Array, size: number, labels: Int32Array): {
  x: number;
  y: number;
  componentId: number;
}[] {
  const ends: { x: number; y: number; componentId: number }[] = [];
  for (let idx = 0; idx < size * size; idx += 1) {
    if (!skel[idx]) continue;
    const x = idx % size;
    const y = (idx / size) | 0;
    let n = 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        if (skel[ny * size + nx]) n += 1;
      }
    }
    if (n === 1) {
      ends.push({ x, y, componentId: labels[idx] });
    }
  }
  return ends;
}

type BridgeSegment = { x0: number; y0: number; x1: number; y1: number };

/**
 * Close loose outline openings:
 * For each ink blob (sleeve), treat it as a V and bridge the two open ends,
 * then flood-fill can colour the enclosed interior.
 */
function closeLooseOutlineEdges(
  mask: Uint8Array,
  size: number,
  thickness: number,
): BridgeSegment[] {
  const { components } = labelInkComponents(mask, size);
  const bridges: BridgeSegment[] = [];

  for (const comp of components) {
    const pixels = comp.pixels;
    if (pixels.length < 30) continue;

    const nearest = (tx: number, ty: number) => {
      let bestX = tx;
      let bestY = ty;
      let bestD = Infinity;
      const step = Math.max(1, (pixels.length / 400) | 0);
      for (let i = 0; i < pixels.length; i += step) {
        const x = pixels[i] % size;
        const y = (pixels[i] / size) | 0;
        const d = Math.hypot(x - tx, y - ty);
        if (d < bestD) {
          bestD = d;
          bestX = x;
          bestY = y;
        }
      }
      return { x: bestX, y: bestY };
    };

    const left = nearest(comp.minX, (comp.minY + comp.maxY) / 2);
    const right = nearest(comp.maxX, (comp.minY + comp.maxY) / 2);
    const top = nearest((comp.minX + comp.maxX) / 2, comp.minY);
    const bottom = nearest((comp.minX + comp.maxX) / 2, comp.maxY);
    const cx = (comp.minX + comp.maxX) / 2;
    const cy = (comp.minY + comp.maxY) / 2;
    const candidates = [left, right, top, bottom];

    let tip = candidates[0];
    let tipScore = -1;
    for (const t of candidates) {
      const score = Math.hypot(t.x - cx, t.y - cy);
      if (score > tipScore) {
        tipScore = score;
        tip = t;
      }
    }

    const ends = candidates
      .filter((p) => Math.hypot(p.x - tip.x, p.y - tip.y) > 4)
      .sort(
        (p, q) =>
          Math.hypot(q.x - tip.x, q.y - tip.y) - Math.hypot(p.x - tip.x, p.y - tip.y),
      );

    if (ends.length < 2) continue;
    const a = ends[0];
    const b = ends[1];
    bridges.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y });
    drawBridge(mask, size, a.x, a.y, b.x, b.y, thickness);
  }

  return bridges;
}

function floodFillEnclosedFromMask(
  mask: Uint8Array,
  size: number,
  paint: (idx: number, kind: 'fill' | 'outline' | 'clear' | 'bridge') => void,
  originalInk: Uint8Array,
  bridgeMask: Uint8Array,
) {
  const exterior = new Uint8Array(size * size);
  const queue: number[] = [];
  const pushIfEmpty = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const idx = y * size + x;
    if (exterior[idx]) return;
    if (mask[idx]) return;
    exterior[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < size; x += 1) {
    pushIfEmpty(x, 0);
    pushIfEmpty(x, size - 1);
  }
  for (let y = 0; y < size; y += 1) {
    pushIfEmpty(0, y);
    pushIfEmpty(size - 1, y);
  }

  while (queue.length) {
    const idx = queue.pop()!;
    const x = idx % size;
    const y = (idx / size) | 0;
    pushIfEmpty(x - 1, y);
    pushIfEmpty(x + 1, y);
    pushIfEmpty(x, y - 1);
    pushIfEmpty(x, y + 1);
  }

  for (let idx = 0; idx < size * size; idx += 1) {
    if (bridgeMask[idx] && !originalInk[idx]) {
      paint(idx, 'bridge');
      continue;
    }
    if (originalInk[idx] || mask[idx]) {
      paint(idx, 'outline');
      continue;
    }
    if (exterior[idx]) {
      paint(idx, 'clear');
      continue;
    }
    paint(idx, 'fill');
  }
}

/**
 * Sleeve (and similar) assets are often potrace *line drawings* — thin filled ribbons.
 * Tint alone only recolors those ribbons.
 *
 * `mode: 'close-and-flood'` — connect loose outline edges with bridges, then flood-fill.
 * `mode: 'flood'` — seal gaps, mark exterior from canvas edges, paint enclosed interiors.
 * `mode: 'span'` — per scanline, fill between the first and last ink pixel.
 */
export async function rasterFillOutlineSvgInteriors(
  raw: string,
  fillHex: string,
  options?: {
    size?: number;
    dilate?: number;
    keepOutline?: boolean;
    outlineHex?: string;
    bridgeHex?: string;
    showClosingLines?: boolean;
    bridgeThickness?: number;
    mode?: 'flood' | 'span' | 'close-and-flood';
  },
): Promise<string> {
  const size = options?.size ?? 640;
  const dilate = options?.dilate ?? 2;
  const keepOutline = options?.keepOutline ?? true;
  const mode = options?.mode ?? 'close-and-flood';
  const showClosingLines = options?.showClosingLines ?? true;
  const bridgeThickness = options?.bridgeThickness ?? 3;
  const outlineHex = options?.outlineHex ?? shadeTowardBlack(fillHex, 0.35);
  const bridgeHex = options?.bridgeHex ?? '#5B8CF5';
  const [fr, fg, fb] = hexToRgba(fillHex);
  const [or_, og, ob] = hexToRgba(outlineHex);
  const [br, bg, bb] = hexToRgba(bridgeHex);

  // Fixed pixel size — percentage SVG width/height often rasterizes blank on canvas.
  let svg = raw
    .replace(/fill="#000000"/gi, 'fill="#000000"')
    .replace(/fill="#000"/gi, 'fill="#000000"')
    .replace(/fill="black"/gi, 'fill="#000000"')
    .replace(/width="[^"]*"/i, `width="${size}"`)
    .replace(/height="[^"]*"/i, `height="${size}"`);
  if (!/viewBox=/i.test(svg)) {
    svg = svg.replace(/<svg\b/i, `<svg viewBox="0 0 2048 2048"`);
  }
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas unavailable');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);

    const image = ctx.getImageData(0, 0, size, size);
    const { data } = image;
    // Convert dark ink on white → opaque black alpha mask for the rest of the pipeline.
    for (let i = 0; i < data.length; i += 4) {
      const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (luminance < 200) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      } else {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      }
    }

    dilateAlphaMask(data, size, size, dilate);

    const paintFill = (idx: number) => {
      const i = idx * 4;
      data[i] = fr;
      data[i + 1] = fg;
      data[i + 2] = fb;
      data[i + 3] = 255;
    };
    const paintOutline = (idx: number) => {
      const i = idx * 4;
      if (keepOutline) {
        data[i] = or_;
        data[i + 1] = og;
        data[i + 2] = ob;
        data[i + 3] = 255;
      } else {
        paintFill(idx);
      }
    };
    const paintBridge = (idx: number) => {
      const i = idx * 4;
      if (showClosingLines) {
        data[i] = br;
        data[i + 1] = bg;
        data[i + 2] = bb;
        data[i + 3] = 255;
      } else {
        paintOutline(idx);
      }
    };
    const clear = (idx: number) => {
      const i = idx * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    };

    if (mode === 'span') {
      const inkMask = inkMaskFromImageData(data, size);
      const mid = (size / 2) | 0;
      for (const [x0, x1] of [
        [0, mid - 1],
        [mid, size - 1],
      ] as const) {
        for (let y = 0; y < size; y += 1) {
          let minX = -1;
          let maxX = -1;
          for (let x = x0; x <= x1; x += 1) {
            if (!inkMask[y * size + x]) continue;
            if (minX < 0) minX = x;
            maxX = x;
          }
          if (minX < 0 || maxX <= minX) continue;
          for (let x = minX; x <= maxX; x += 1) paintFill(y * size + x);
        }
      }
      for (let idx = 0; idx < size * size; idx += 1) {
        if (inkMask[idx]) paintOutline(idx);
      }
    } else if (mode === 'close-and-flood') {
      const originalInk = inkMaskFromImageData(data, size);
      const closed = new Uint8Array(originalInk);
      closeLooseOutlineEdges(closed, size, bridgeThickness);
      const bridgeMask = new Uint8Array(size * size);
      for (let idx = 0; idx < size * size; idx += 1) {
        if (closed[idx] && !originalInk[idx]) bridgeMask[idx] = 1;
      }
      floodFillEnclosedFromMask(
        closed,
        size,
        (idx, kind) => {
          if (kind === 'fill') paintFill(idx);
          else if (kind === 'outline') paintOutline(idx);
          else if (kind === 'bridge') paintBridge(idx);
          else clear(idx);
        },
        originalInk,
        bridgeMask,
      );
    } else {
      const mask = inkMaskFromImageData(data, size);
      const exterior = new Uint8Array(size * size);
      const queue: number[] = [];
      const pushIfEmpty = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= size || y >= size) return;
        const idx = y * size + x;
        if (exterior[idx]) return;
        if (mask[idx]) return;
        exterior[idx] = 1;
        queue.push(idx);
      };

      for (let x = 0; x < size; x += 1) {
        pushIfEmpty(x, 0);
        pushIfEmpty(x, size - 1);
      }
      for (let y = 0; y < size; y += 1) {
        pushIfEmpty(0, y);
        pushIfEmpty(size - 1, y);
      }

      while (queue.length) {
        const idx = queue.pop()!;
        const x = idx % size;
        const y = (idx / size) | 0;
        pushIfEmpty(x - 1, y);
        pushIfEmpty(x + 1, y);
        pushIfEmpty(x, y - 1);
        pushIfEmpty(x, y + 1);
      }

      for (let idx = 0; idx < size * size; idx += 1) {
        if (mask[idx]) {
          paintOutline(idx);
          continue;
        }
        if (exterior[idx]) {
          clear(idx);
          continue;
        }
        paintFill(idx);
      }
    }

    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
