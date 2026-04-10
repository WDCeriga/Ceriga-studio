/** Brand red — matches transform overlay / Ceriga accents */
export const GUIDE_COLOR = '#CC2D24';
export const SNAP_GUIDE_PX = 8;

export type SnapBox = { id: string; x: number; y: number; width: number; height: number };

/**
 * Snap drag position to canvas centre, zone edges, and other elements' centres & edges.
 * Returns line positions in zone coordinates (0…zoneW / 0…zoneH) for drawing guides.
 */
export type SnapDragOptions = {
  /** Shift snap “canvas centre” as a fraction of zone width (e.g. -0.01 ≈ 1% left). */
  centerNudgeFractionX?: number;
  /** Shift snap “canvas centre” as a fraction of zone height. */
  centerNudgeFractionY?: number;
  /** Inset from zone edges (px, zone coordinates) so layers stay inside the visible area (same idea as extra-details clamp). */
  edgeInsetPx?: number;
};

export function snapDragInZone(
  nx: number,
  ny: number,
  halfW: number,
  halfH: number,
  zoneW: number,
  zoneH: number,
  movingId: string,
  boxes: SnapBox[],
  options?: SnapDragOptions,
): { x: number; y: number; verticalLines: number[]; horizontalLines: number[] } {
  const SNAP = SNAP_GUIDE_PX;
  const others = boxes.filter((b) => b.id !== movingId);
  const nxFrac = options?.centerNudgeFractionX ?? 0;
  const nyFrac = options?.centerNudgeFractionY ?? 0;
  const midX = zoneW * (0.5 + nxFrac);
  const midY = zoneH * (0.5 + nyFrac);

  const centerXTargets: number[] = [midX, ...others.map((o) => o.x)];
  const centerYTargets: number[] = [midY, ...others.map((o) => o.y)];

  const edgeXTargets: number[] = [0, zoneW];
  const edgeYTargets: number[] = [0, zoneH];
  for (const o of others) {
    const ohw = o.width / 2;
    const ohh = o.height / 2;
    edgeXTargets.push(o.x - ohw, o.x + ohw);
    edgeYTargets.push(o.y - ohh, o.y + ohh);
  }

  let sx = nx;
  let sy = ny;
  const verticalLines: number[] = [];
  const horizontalLines: number[] = [];

  let bestCx: { lx: number; d: number } | null = null;
  for (const lx of centerXTargets) {
    const d = Math.abs(nx - lx);
    if (d <= SNAP && (!bestCx || d < bestCx.d)) bestCx = { lx, d };
  }
  if (bestCx) {
    sx = bestCx.lx;
    verticalLines.push(bestCx.lx);
  } else {
    for (const lx of edgeXTargets) {
      if (Math.abs(nx - halfW - lx) <= SNAP) {
        sx = lx + halfW;
        verticalLines.push(lx);
        break;
      }
    }
    if (verticalLines.length === 0) {
      for (const lx of edgeXTargets) {
        if (Math.abs(nx + halfW - lx) <= SNAP) {
          sx = lx - halfW;
          verticalLines.push(lx);
          break;
        }
      }
    }
  }

  let bestCy: { ly: number; d: number } | null = null;
  for (const ly of centerYTargets) {
    const d = Math.abs(ny - ly);
    if (d <= SNAP && (!bestCy || d < bestCy.d)) bestCy = { ly, d };
  }
  if (bestCy) {
    sy = bestCy.ly;
    horizontalLines.push(bestCy.ly);
  } else {
    for (const ly of edgeYTargets) {
      if (Math.abs(ny - halfH - ly) <= SNAP) {
        sy = ly + halfH;
        horizontalLines.push(ly);
        break;
      }
    }
    if (horizontalLines.length === 0) {
      for (const ly of edgeYTargets) {
        if (Math.abs(ny + halfH - ly) <= SNAP) {
          sy = ly - halfH;
          horizontalLines.push(ly);
          break;
        }
      }
    }
  }

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const inset = Math.max(0, options?.edgeInsetPx ?? 0);
  let minX = halfW + inset;
  let maxX = zoneW - halfW - inset;
  let minY = halfH + inset;
  let maxY = zoneH - halfH - inset;
  if (minX > maxX) {
    const cx = zoneW / 2;
    minX = cx;
    maxX = cx;
  }
  if (minY > maxY) {
    const cy = zoneH / 2;
    minY = cy;
    maxY = cy;
  }
  return {
    x: clamp(sx, minX, maxX),
    y: clamp(sy, minY, maxY),
    verticalLines: [...new Set(verticalLines)],
    horizontalLines: [...new Set(horizontalLines)],
  };
}

/**
 * Half extents of an element in the zone’s coordinate system (same mapping as pointer → zone).
 * For text layers, stored `width` / `height` are layout caps while the box is `max-content`, so drag
 * clamping must use the rendered rect — otherwise short text cannot reach the zone edges.
 */
export function measureHalfExtentsInZone(zone: HTMLElement, element: HTMLElement): {
  halfW: number;
  halfH: number;
} {
  const zr = zone.getBoundingClientRect();
  const er = element.getBoundingClientRect();
  const zw = zone.offsetWidth;
  const zh = zone.offsetHeight;
  if (zr.width < 1 || zr.height < 1 || zw < 1 || zh < 1) {
    return { halfW: Math.max(1, er.width / 2), halfH: Math.max(1, er.height / 2) };
  }
  const wInZone = (er.width / zr.width) * zw;
  const hInZone = (er.height / zr.height) * zh;
  return { halfW: Math.max(1, wInZone / 2), halfH: Math.max(1, hInZone / 2) };
}
