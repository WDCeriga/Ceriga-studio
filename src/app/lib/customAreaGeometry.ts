import type { DesignElement } from '../components/builder/PrintsDesignStep';
import { moveShapePoints, pathSegmentPoint, shapePointMapping, smoothShapePoints, splitShapeSegment } from './shapePathEditing';

export interface CustomAreaPoint {
  x: number;
  y: number;
  in?: { x: number; y: number };
  out?: { x: number; y: number };
  linked?: boolean;
}

export function customAreaPath(points: CustomAreaPoint[], closed = true): string {
  if (!points.length) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    d += a.out || b.in ? ` C ${(a.out ?? a).x} ${(a.out ?? a).y} ${(b.in ?? b).x} ${(b.in ?? b).y} ${b.x} ${b.y}` : ` L ${b.x} ${b.y}`;
  }
  return d + (closed ? ' Z' : '');
}

export function customAreaViewport(area: Pick<DesignElement, 'width' | 'height' | 'customAreaPoints' | 'customAreaViewWidth' | 'customAreaViewHeight'>) {
  const bounds = area.customAreaPoints?.length ? customAreaBounds(area.customAreaPoints) : area;
  return { width: area.customAreaViewWidth ?? bounds.width, height: area.customAreaViewHeight ?? bounds.height };
}

export function customAreaTransformedPath(area: DesignElement) {
  const points = area.customAreaPoints ?? [], viewport = customAreaViewport(area), mapping = shapePointMapping(area);
  const sampled = points.flatMap((a, index) => Array.from({ length: 64 }, (_, i) => {
    const p = pathSegmentPoint(a, points[(index + 1) % points.length], i / 64);
    const mapped = mapping.project({ x: p.x / viewport.width * 100, y: p.y / viewport.height * 100 });
    return { x: mapped.x / 100 * area.width, y: mapped.y / 100 * area.height };
  }));
  return customAreaPath(sampled);
}

export function nearestCustomAreaSegment(points: CustomAreaPoint[], point: CustomAreaPoint, onlyIndex?: number) {
  let result = { index: 0, t: 0.5, point: points[0] ?? point, distance: Infinity };
  const test = (index: number, t: number) => {
    const p = pathSegmentPoint(points[index], points[(index + 1) % points.length], t);
    const distance = Math.hypot(p.x - point.x, p.y - point.y);
    if (distance < result.distance) result = { index, t, point: p, distance };
  };
  for (let index = 0; index < points.length; index++) {
    if (onlyIndex !== undefined && index !== onlyIndex) continue;
    for (let step = 0; step <= 64; step++) test(index, step / 64);
  }
  let radius = 1 / 64;
  for (let pass = 0; pass < 12; pass++) {
    const { index, t } = result;
    test(index, Math.max(0, t - radius)); test(index, Math.min(1, t + radius)); radius /= 2;
  }
  return result;
}

export function splitCustomAreaSegment(points: CustomAreaPoint[], index: number, t: number) {
  // De Casteljau subdivision changes only parameterisation, never the visible curve.
  const nodes = splitShapeSegment({ nodes: points, closed: true }, index, t).nodes as CustomAreaPoint[];
  const next = (index + 2) % nodes.length;
  nodes[index] = { ...nodes[index], linked: false };
  nodes[next] = { ...nodes[next], linked: false };
  nodes[index + 1] = { ...nodes[index + 1], linked: true };
  return nodes;
}

export function moveCustomAreaPoints(points: CustomAreaPoint[], indices: number[], delta: { x: number; y: number }) {
  return moveShapePoints({ nodes: points, closed: true }, indices, delta).nodes as CustomAreaPoint[];
}

export function setCustomAreaPointType(points: CustomAreaPoint[], indices: number[], smooth: boolean) {
  return smoothShapePoints({ nodes: points, closed: true }, indices, smooth).nodes.map((node, index) =>
    indices.includes(index) ? { ...node, linked: smooth } : node) as CustomAreaPoint[];
}

export function moveCustomAreaHandle(points: CustomAreaPoint[], index: number, handle: 'in' | 'out', point: { x: number; y: number }) {
  return points.map((node, i) => {
    if (i !== index) return node;
    const opposite = handle === 'in' ? 'out' : 'in';
    if (node.linked === false) return { ...node, [handle]: point };
    const dx = point.x - node.x, dy = point.y - node.y, length = Math.hypot(dx, dy);
    const old = node[opposite] ?? node;
    const oppositeLength = Math.hypot(old.x - node.x, old.y - node.y) || length;
    return { ...node, linked: true, [handle]: point, [opposite]: length > 0 ? { x: node.x - dx * oppositeLength / length, y: node.y - dy * oppositeLength / length } : { x: node.x, y: node.y } };
  });
}

export function linkCustomAreaHandles(points: CustomAreaPoint[], indices: number[], linked: boolean) {
  let next = points.map((node, index) => indices.includes(index) ? { ...node, linked } : node);
  if (linked) for (const index of indices) {
    const node = next[index];
    if (node?.out) next = moveCustomAreaHandle(next, index, 'out', node.out);
    else if (node?.in) next = moveCustomAreaHandle(next, index, 'in', node.in);
  }
  return next;
}

export function bendCustomAreaSegment(points: CustomAreaPoint[], index: number, t: number, delta: { x: number; y: number }) {
  const nextIndex = (index + 1) % points.length;
  const a = points[index], b = points[nextIndex];
  const weightA = 3 * (1 - t) ** 2 * t, weightB = 3 * (1 - t) * t ** 2;
  const divisor = Math.max(0.0001, weightA ** 2 + weightB ** 2);
  return points.map((node, i) => i === index ? { ...node, linked: false, out: { x: (a.out ?? a).x + delta.x * weightA / divisor, y: (a.out ?? a).y + delta.y * weightA / divisor } }
    : i === nextIndex ? { ...node, linked: false, in: { x: (b.in ?? b).x + delta.x * weightB / divisor, y: (b.in ?? b).y + delta.y * weightB / divisor } } : node);
}

export function customAreaGeometryPatch(points: CustomAreaPoint[], area: DesignElement): Partial<DesignElement> {
  const viewport = customAreaViewport(area);
  // Keep the reference frame stable under non-affine transforms.
  if (area.warp || area.perspective) return { customAreaPoints: points, customAreaViewWidth: viewport.width, customAreaViewHeight: viewport.height };
  const scaleX = area.width / viewport.width, scaleY = area.height / viewport.height;
  const bounds = customAreaBounds(points);
  if (bounds.x - bounds.width / 2 >= -1e-8 && bounds.y - bounds.height / 2 >= -1e-8
    && bounds.x + bounds.width / 2 <= viewport.width + 1e-8 && bounds.y + bounds.height / 2 <= viewport.height + 1e-8) {
    return { customAreaPoints: points, customAreaViewWidth: viewport.width, customAreaViewHeight: viewport.height };
  }
  const dx = (bounds.x - viewport.width / 2) * scaleX * (area.flipHorizontal ? -1 : 1);
  const dy = (bounds.y - viewport.height / 2) * scaleY * (area.flipVertical ? -1 : 1);
  const angle = area.rotation * Math.PI / 180;
  const offset = { x: -(bounds.x - bounds.width / 2), y: -(bounds.y - bounds.height / 2) };
  return {
    x: area.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: area.y + dx * Math.sin(angle) + dy * Math.cos(angle),
    width: bounds.width * scaleX, height: bounds.height * scaleY,
    customAreaViewWidth: bounds.width, customAreaViewHeight: bounds.height,
    customAreaPoints: moveCustomAreaPoints(points, points.map((_, i) => i), offset),
  };
}

export function customAreaBounds(points: CustomAreaPoint[]) {
  const hull = points.flatMap(point => [point, ...(point.in ? [point.in] : []), ...(point.out ? [point.out] : [])]);
  if (!hull.length) return { x: 0.5, y: 0.5, width: 1, height: 1 };
  const xs = hull.map((point) => point.x);
  const ys = hull.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return {
    x: minX + width / 2,
    y: minY + height / 2,
    width,
    height,
  };
}

export function insertCustomAreaPoint(points: CustomAreaPoint[], point: CustomAreaPoint) {
  if (points.length < 2) return [...points, point];
  const nearest = nearestCustomAreaSegment(points, point);
  return splitCustomAreaSegment(points, nearest.index, nearest.t);
}

export function rebaseCustomAreaGeometry(
  points: CustomAreaPoint[],
  area: { x: number; y: number; width: number; height: number; rotation: number },
) {
  const bounds = customAreaBounds(points);
  const radians = area.rotation * Math.PI / 180;
  const dx = bounds.x - area.width / 2;
  const dy = bounds.y - area.height / 2;
  return {
    x: area.x + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: area.y + dx * Math.sin(radians) + dy * Math.cos(radians),
    width: bounds.width,
    height: bounds.height,
    points: moveCustomAreaPoints(points, points.map((_, i) => i), {
      x: -(bounds.x - bounds.width / 2), y: -(bounds.y - bounds.height / 2),
    }),
  };
}