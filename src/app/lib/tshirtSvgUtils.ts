export function fabricLuminance(color: string): number {
  const expanded = color.replace(/^#([\da-f])([\da-f])([\da-f])$/i, '#$1$1$2$2$3$3');
  if (!/^#[\da-f]{6}$/i.test(expanded)) return 1;
  const channels = [1, 3, 5].map(offset => {
    const channel = parseInt(expanded.slice(offset, offset + 2), 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

export function constructionColor(fabric: string, preferred = '#141414'): string {
  const background = fabricLuminance(fabric);
  const contrast = (color: string) => {
    const ink = fabricLuminance(color);
    return (Math.max(background, ink) + .05) / (Math.min(background, ink) + .05);
  };
  if (contrast(preferred) >= 3) return preferred;
  return contrast('#929292') > contrast('#242424') ? '#929292' : '#242424';
}

export function renderFabricSvg(raw: string, fill: string): string {
  const tinted = tintPotraceSvg(raw, fill);
  if (typeof DOMParser === 'undefined') return tinted;
  const parsed = new DOMParser().parseFromString(tinted, 'image/svg+xml');
  const fabric = parsed.querySelector('g[transform]');
  for (const element of parsed.querySelectorAll('[stroke]')) {
    if (element.closest('defs')) continue;
    const stroke = element.getAttribute('stroke')!;
    if (/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(stroke)) element.setAttribute('stroke', constructionColor(fill, stroke));
  }
  if (fabric && fabricLuminance(fill) < .06 && parsed.documentElement.getAttribute('data-neck-finish') !== 'raw') {
    fabric.setAttribute('stroke', '#505050');
    fabric.setAttribute('stroke-width', '12');
    fabric.setAttribute('stroke-linejoin', 'round');
    fabric.setAttribute('paint-order', 'stroke fill');
    fabric.setAttribute('data-fabric-edge-highlight', 'true');
  }
  return new XMLSerializer().serializeToString(parsed.documentElement);
}

export function renderConstructionSvg(
  raw: string, fabric: string, preferred: string, id: string,
  regions: { raw: string; color: string }[] = [],
): string {
  const ink = constructionColor(fabric, preferred);
  const tinted = tintPotraceSvg(raw, ink);
  if (typeof DOMParser === 'undefined') return tinted;
  const parsed = new DOMParser().parseFromString(tinted, 'image/svg+xml');
  const root = parsed.documentElement;
  const namespace = 'http://www.w3.org/2000/svg';
  for (const element of parsed.querySelectorAll('[fill], [stroke]')) {
    if (element.closest('defs')) continue;
    for (const attribute of ['fill', 'stroke']) {
      const value = element.getAttribute(attribute);
      if (value && /^(?:#[\da-f]{3}(?:[\da-f]{3})?|black|white)$/i.test(value)) element.setAttribute(attribute, 'currentColor');
    }
  }
  const drawing = parsed.createElementNS(namespace, 'g');
  drawing.setAttribute('id', `${id}-ink`);
  for (const child of Array.from(root.childNodes)) drawing.append(child);
  root.append(drawing);
  root.setAttribute('color', ink);
  regions.forEach((region, index) => {
    const color = constructionColor(region.color, preferred);
    if (color === ink) return;
    const mask = parsed.createElementNS(namespace, 'mask');
    mask.setAttribute('id', `${id}-region-${index}`);
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('x', '0'); mask.setAttribute('y', '0');
    mask.setAttribute('width', '2048'); mask.setAttribute('height', '2048');
    mask.setAttribute('style', 'mask-type:alpha');
    const image = parsed.createElementNS(namespace, 'image');
    image.setAttribute('href', `data:image/svg+xml,${encodeURIComponent(region.raw)}`);
    image.setAttribute('width', '2048'); image.setAttribute('height', '2048');
    mask.append(image);
    const defs = parsed.createElementNS(namespace, 'defs');
    defs.append(mask);
    root.append(defs);
    const overlay = parsed.createElementNS(namespace, 'use');
    overlay.setAttribute('href', `#${id}-ink`);
    overlay.setAttribute('mask', `url(#${id}-region-${index})`);
    overlay.setAttribute('color', color);
    root.append(overlay);
  });
  return new XMLSerializer().serializeToString(root);
}

/** Prepare potrace SVG exports for inline rendering. */
export function tintPotraceSvg(
  raw: string,
  fill: string,
  mode: 'solid' | 'outline' | 'detail' = 'solid',
  interactive = false,
  edgeSealWidth = 0,
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

  // Only the first (fabric) group is tinted. Construction ink stays #141414.
  const edgeSeal = edgeSealWidth > 0
    ? ` stroke="${fill}" stroke-width="${edgeSealWidth}" stroke-linejoin="round" stroke-linecap="round"`
    : ' stroke="none"';
  let result = svg.replace(
    /(<g transform="[^"]+")[^>]*fill="#000000"[^>]*>/i,
    `$1 fill="${fill}"${edgeSeal} fill-rule="evenodd">`,
  );
  if (result === svg) {
    result = svg
      .replace(/fill="#000000"/i, `fill="${fill}"`)
      .replace(
        /(<g transform="[^"]+")[^>]*>/,
        `$1 fill="${fill}"${edgeSeal} fill-rule="evenodd">`,
      );
  }

  result = result.replace(
    /(<g transform="[^"]+") data-shared-fabric="true"[^>]*>/gi,
    `$1 data-shared-fabric="true" fill="${fill}"${edgeSeal} fill-rule="evenodd">`,
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
    const paths = Array.from(host.querySelectorAll<SVGPathElement>('svg path'))
      .filter(path => !path.closest('defs, [data-hem-decoration]'));
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
