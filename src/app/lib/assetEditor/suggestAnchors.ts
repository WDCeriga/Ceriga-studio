import { createId } from './document';
import type { AnchorRole, DrawnAnchor, DrawnPoint, DrawnStroke } from './types';

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
}

function boundsFromPoints(points: DrawnPoint[]): Bounds | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function unionBounds(strokes: DrawnStroke[]): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of strokes) {
    const bounds = boundsFromPoints(stroke.points);
    if (!bounds) continue;
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  }

  if (!Number.isFinite(minX)) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function anchor(name: string, role: AnchorRole, x: number, y: number): DrawnAnchor {
  return { id: createId('anchor'), name, role, x, y };
}

/** Place standard connection anchors from traced geometry + category. */
export function suggestAnchorsForCategory(category: string, strokes: DrawnStroke[]): DrawnAnchor[] {
  const bounds = unionBounds(strokes);
  if (!bounds) return [];

  const lower = category.toLowerCase();

  if (lower.includes('sleeve hem') || lower.includes('cuff')) {
    return [
      anchor('hem-attach', 'hem-attach', bounds.centerX, bounds.minY),
      anchor('sleeve-end-left', 'sleeve-end', bounds.minX, bounds.maxY),
      anchor('sleeve-end-right', 'sleeve-end', bounds.maxX, bounds.maxY),
    ];
  }

  if (lower.includes('sleeve')) {
    return [
      anchor('shoulder-left', 'shoulder', bounds.minX, bounds.minY),
      anchor('shoulder-right', 'shoulder', bounds.maxX, bounds.minY),
      anchor('sleeve-end-left', 'sleeve-end', bounds.minX, bounds.maxY),
      anchor('sleeve-end-right', 'sleeve-end', bounds.maxX, bounds.maxY),
    ];
  }

  if (lower.includes('neck')) {
    return [
      anchor('neck-center', 'neck', bounds.centerX, bounds.minY),
      anchor('shoulder-left', 'shoulder', bounds.minX, bounds.minY + (bounds.maxY - bounds.minY) * 0.15),
      anchor('shoulder-right', 'shoulder', bounds.maxX, bounds.minY + (bounds.maxY - bounds.minY) * 0.15),
    ];
  }

  if (lower.includes('base')) {
    return [
      anchor('center', 'center', bounds.centerX, bounds.centerY),
      anchor('neck', 'neck', bounds.centerX, bounds.minY),
      anchor('hem', 'hem-attach', bounds.centerX, bounds.maxY),
    ];
  }

  return [
    anchor('center', 'center', bounds.centerX, bounds.centerY),
    anchor('top', 'edge', bounds.centerX, bounds.minY),
    anchor('bottom', 'edge', bounds.centerX, bounds.maxY),
  ];
}

export { processTracedStrokes as lightenTracedStrokes } from './traceFidelity';
