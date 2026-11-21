/**
 * Equal-spacing smart guides (plan C.3, Illustrator/Figma-style). Pure: given the dragged box (centre + half
 * sizes) and the other objects, find where the moving object sits at an equal distance between neighbours,
 * or continues an existing even rhythm. Only snaps an axis that hasn't already snapped to an edge/centre.
 */
export type SpacingBox = { id: string; x: number; y: number; width: number; height: number };
/** One measured gap to draw: along `axis`, from → to, positioned at `at` on the other axis. */
export type SpacingGap = { axis: 'x' | 'y'; from: number; to: number; at: number };
export type SpacingHint = { axis: 'x' | 'y'; gap: number; gaps: SpacingGap[] };

type Moving = { x: number; y: number; halfW: number; halfH: number };
type Edges = { lo: number; hi: number; cross0: number; cross1: number; id: string };

function axisCandidates(moving: Moving, others: SpacingBox[], axis: 'x' | 'y', tolerance: number) {
  const half = axis === 'x' ? moving.halfW : moving.halfH, crossHalf = axis === 'x' ? moving.halfH : moving.halfW;
  const centre = axis === 'x' ? moving.x : moving.y, cross = axis === 'x' ? moving.y : moving.x;
  // Only neighbours that overlap the moving object on the other axis are "in a row" with it.
  const row: Edges[] = others.map(o => {
    const c = axis === 'x' ? o.x : o.y, h = (axis === 'x' ? o.width : o.height) / 2;
    const cc = axis === 'x' ? o.y : o.x, ch = (axis === 'x' ? o.height : o.width) / 2;
    return { lo: c - h, hi: c + h, cross0: cc - ch, cross1: cc + ch, id: o.id };
  }).filter(e => e.cross1 > cross - crossHalf && e.cross0 < cross + crossHalf).sort((a, b) => a.lo - b.lo);
  const lo = centre - half, hi = centre + half;
  const before = row.filter(e => e.hi <= lo + tolerance).sort((a, b) => b.hi - a.hi);
  const after = row.filter(e => e.lo >= hi - tolerance).sort((a, b) => a.lo - b.lo);
  const options: { centre: number; gap: number; gaps: (c: number) => [number, number][] }[] = [];
  const L = before[0], R = after[0];
  if (L && R) {
    const gap = (R.lo - L.hi - 2 * half) / 2;
    if (gap > 0) options.push({ centre: L.hi + gap + half, gap, gaps: c => [[L.hi, c - half], [c + half, R.lo]] });
  }
  if (L && before[1] && before[1].hi <= L.lo) { // continue the rhythm to the right of two objects
    const gap = L.lo - before[1].hi;
    if (gap > 0) options.push({ centre: L.hi + gap + half, gap, gaps: c => [[before[1].hi, L.lo], [L.hi, c - half]] });
  }
  if (R && after[1] && after[1].lo >= R.hi) { // continue the rhythm to the left
    const gap = after[1].lo - R.hi;
    if (gap > 0) options.push({ centre: R.lo - gap - half, gap, gaps: c => [[c + half, R.lo], [R.hi, after[1].lo]] });
  }
  let best: { centre: number; hint: SpacingHint; distance: number } | null = null;
  for (const option of options) {
    const distance = Math.abs(option.centre - centre);
    if (distance > tolerance || (best && distance >= best.distance)) continue;
    best = { centre: option.centre, distance, hint: { axis, gap: option.gap, gaps: option.gaps(option.centre).map(([from, to]) => ({ axis, from, to, at: cross })) } };
  }
  return best;
}

export function equalSpacingSnap(moving: Moving, others: SpacingBox[], tolerance: number, alreadySnapped: { x: boolean; y: boolean }): { x: number; y: number; hints: SpacingHint[] } {
  const hints: SpacingHint[] = [];
  let { x, y } = moving;
  if (!alreadySnapped.x) { const h = axisCandidates(moving, others, 'x', tolerance); if (h) { x = h.centre; hints.push(h.hint); } }
  if (!alreadySnapped.y) { const v = axisCandidates({ ...moving, x }, others, 'y', tolerance); if (v) { y = v.centre; hints.push(v.hint); } }
  return { x, y, hints };
}

/** Stable signature so the editor only re-renders when the hints actually change. */
export const spacingSignature = (hints: SpacingHint[] | undefined) => (hints ?? []).map(h => `${h.axis}${Math.round(h.gap)}:${h.gaps.map(g => `${Math.round(g.from)}-${Math.round(g.to)}@${Math.round(g.at)}`).join(',')}`).join('|');
