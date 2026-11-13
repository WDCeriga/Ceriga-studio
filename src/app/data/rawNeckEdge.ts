type Point = { x: number; y: number };

/** Sample the front cut or the exposed upper edge of the back fabric. */
export function rawNeckBoundary(rings: Point[][], edge: 'front' | 'back'): Point[] {
  const points = rings.flat();
  if (!points.length) return [];
  const left = Math.min(...points.map(point => point.x));
  const right = Math.max(...points.map(point => point.x));
  const intervals = Math.max(2, Math.ceil((right - left) / 2.5));
  return Array.from({ length: intervals + 1 }, (_, index) => {
    const x = left + .1 + (right - left - .2) * index / intervals;
    let y = edge === 'front' ? -Infinity : Infinity;
    for (const ring of rings) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if ((a.x > x) !== (b.x > x)) {
        const crossing = a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
        y = edge === 'front' ? Math.max(y, crossing) : Math.min(y, crossing);
      }
    }
    return { x, y };
  }).filter(point => Number.isFinite(point.y));
}

export function frontRawNeckEdge(rings: Point[][]): Point[] {
  return rawNeckBoundary(rings, 'front');
}

export function rawNeckEdgeInk(edge: Point[], depthScale = 1) {
  let ink = '';
  let spacing = 0;
  let fibre = 0;
  for (let i = 1; i < edge.length; i++) {
    const start = edge[i - 1], end = edge[i];
    const dx = end.x - start.x, dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    while (spacing < length) {
      const x = start.x + dx * spacing / length;
      const y = start.y + dy * spacing / length;
      const depth = (.8 + (fibre * 37 % 11) * .17) * depthScale;
      const tipX = x + dy / length * depth;
      const tipY = y - dx / length * depth;
      ink += `M${x.toFixed(2)},${y.toFixed(2)}l${(tipX - x).toFixed(2)},${(tipY - y).toFixed(2)}`;
      spacing += 2.1 + (fibre++ * 19 % 9) * .24;
    }
    spacing -= length;
  }
  return ink;
}
