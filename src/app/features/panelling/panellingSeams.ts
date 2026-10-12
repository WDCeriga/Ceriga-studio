import { bezierSplit, closestBoundaryPoint, distance, flattenSeam, projectToSegment } from './panellingGeometry';
import type { BoundaryLoop, PanellingPoint, PanellingSeam, SeamAnchor } from './panellingTypes';

export function snapAnchor(point: PanellingPoint, boundaries: BoundaryLoop[], seams: PanellingSeam[], radius = 28): SeamAnchor {
  let nearest: { point: PanellingPoint; distance: number; boundaryId?: string } | undefined = closestBoundaryPoint(point, boundaries);
  for (const seam of seams) {
    const line = flattenSeam(seam);
    for (let index = 0; index < line.length - 1; index++) {
      const projected = projectToSegment(point, line[index], line[index + 1]).point;
      const candidateDistance = distance(point, projected);
      if (!nearest || candidateDistance < nearest.distance) nearest = { point: projected, distance: candidateDistance };
    }
  }
  if (nearest && nearest.distance <= radius) return { id: crypto.randomUUID(), ...nearest.point, boundaryId: nearest.boundaryId };
  return { id: crypto.randomUUID(), ...point };
}

export function insertSeamAnchor(seam: PanellingSeam, point: PanellingPoint): PanellingSeam {
  let closest = { distance: Infinity, segment: 0, t: .5, point };
  for (let segment = 0; segment < seam.anchors.length - 1; segment++) {
    const start = seam.anchors[segment], end = seam.anchors[segment + 1];
    const curved = Boolean(start.outgoing || end.incoming);
    const steps = curved ? 48 : 1;
    for (let step = 0; step < steps; step++) {
      const t0 = step / steps, t1 = (step + 1) / steps;
      const first = curved ? pointOnCurve(start, end, t0) : start;
      const second = curved ? pointOnCurve(start, end, t1) : end;
      const projected = projectToSegment(point, first, second).point;
      const candidateDistance = distance(point, projected);
      if (candidateDistance < closest.distance) {
        const local = distance(first, second) ? distance(first, projected) / distance(first, second) : 0;
        closest = { distance: candidateDistance, segment, t: t0 + (t1 - t0) * local, point: projected };
      }
    }
  }
  const segmentIndex = closest.segment, t = closest.t;
  const start = seam.anchors[segmentIndex], end = seam.anchors[segmentIndex + 1];
  const anchor: SeamAnchor = { id: crypto.randomUUID(), handleMode: start.outgoing || end.incoming ? 'smooth' : 'corner', ...closest.point };
  const anchors = [...seam.anchors];
  if (start.outgoing || end.incoming) {
    const split = bezierSplit(start, end, t);
    anchors[segmentIndex] = split.start;
    anchors[segmentIndex + 1] = split.end;
    anchors.splice(segmentIndex + 1, 0, { ...anchor, incoming: split.inserted.incoming, outgoing: split.inserted.outgoing });
  } else anchors.splice(segmentIndex + 1, 0, anchor);
  return { ...seam, anchors };
}

function pointOnCurve(start: SeamAnchor, end: SeamAnchor, t: number): PanellingPoint {
  const p0 = { x: start.x, y: start.y }, p1 = start.outgoing ?? p0, p3 = { x: end.x, y: end.y }, p2 = end.incoming ?? p3;
  const u = 1 - t;
  return { x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
    y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y };
}

export function moveSeamAnchor(seam: PanellingSeam, anchorId: string, point: PanellingPoint): PanellingSeam {
  return { ...seam, anchors: seam.anchors.map(anchor => {
    if (anchor.id !== anchorId) return anchor;
    const dx = point.x - anchor.x, dy = point.y - anchor.y;
    return { ...anchor, x: point.x, y: point.y,
      incoming: anchor.incoming ? { x: anchor.incoming.x + dx, y: anchor.incoming.y + dy } : undefined,
      outgoing: anchor.outgoing ? { x: anchor.outgoing.x + dx, y: anchor.outgoing.y + dy } : undefined };
  }) };
}

export function setAnchorMode(seam: PanellingSeam, anchorId: string, mode: NonNullable<SeamAnchor['handleMode']>): PanellingSeam {
  return { ...seam, anchors: seam.anchors.map((anchor, index) => {
    if (anchor.id !== anchorId) return anchor;
    if (mode === 'corner') return { ...anchor, handleMode: mode, incoming: undefined, outgoing: undefined };
    const previous = seam.anchors[index - 1], next = seam.anchors[index + 1];
    const incomingLength = previous ? distance(previous, anchor) / 3 : 0;
    const outgoingLength = next ? distance(anchor, next) / 3 : 0;
    let dx = (next?.x ?? anchor.x) - (previous?.x ?? anchor.x), dy = (next?.y ?? anchor.y) - (previous?.y ?? anchor.y);
    const magnitude = Math.hypot(dx, dy) || 1;
    dx /= magnitude; dy /= magnitude;
    const incoming = previous ? { x: anchor.x - dx * incomingLength, y: anchor.y - dy * incomingLength } : anchor.incoming;
    const outgoing = next ? { x: anchor.x + dx * outgoingLength, y: anchor.y + dy * outgoingLength } : anchor.outgoing;
    return { ...anchor, handleMode: mode, incoming, outgoing };
  }) };
}

export function convertSeamToCurve(seam: PanellingSeam, segmentIndex: number): PanellingSeam {
  if (segmentIndex < 0 || segmentIndex >= seam.anchors.length - 1) return seam;
  const start = seam.anchors[segmentIndex], end = seam.anchors[segmentIndex + 1];
  if (start.outgoing || end.incoming) return seam;
  const dx = (end.x - start.x) / 3, dy = (end.y - start.y) / 3;
  const anchors = [...seam.anchors];
  anchors[segmentIndex] = { ...start, handleMode: start.handleMode === 'independent' ? 'independent' : 'smooth', outgoing: { x: start.x + dx, y: start.y + dy } };
  anchors[segmentIndex + 1] = { ...end, handleMode: end.handleMode === 'independent' ? 'independent' : 'smooth', incoming: { x: end.x - dx, y: end.y - dy } };
  return { ...seam, anchors };
}