import { PATTERN_CATALOG } from '../../../lib/patternCatalog';
import { shapeIsClosed, type ShapeGeometryElement } from '../../../lib/shapeGeometry';
import { patternAppearance, type PatternPatch } from '../../../lib/patternEditing';

export type StudioAssetKind = 'shape' | 'pattern' | 'distress';

export interface StudioAsset {
  id: string;
  label: string;
  kind: StudioAssetKind;
}

export const SHAPE_ASSETS: StudioAsset[] = [
  { id: 'ellipse', label: 'Ellipse', kind: 'shape' },
  { id: 'rect', label: 'Rectangle', kind: 'shape' },
  { id: 'line', label: 'Line', kind: 'shape' },
  { id: 'zigzag', label: 'Zigzag', kind: 'shape' },
  { id: 'squiggly', label: 'Squiggly', kind: 'shape' },
  { id: 'triangle', label: 'Triangle', kind: 'shape' },
  { id: 'star', label: 'Star', kind: 'shape' },
  { id: 'arrow', label: 'Arrow', kind: 'shape' },
  { id: 'polygon', label: 'Polygon', kind: 'shape' },
  { id: 'diamond', label: 'Diamond', kind: 'shape' },
  { id: 'rounded-rect', label: 'Rounded Rectangle', kind: 'shape' },
  { id: 'arc', label: 'Arc', kind: 'shape' },
  { id: 'ring', label: 'Ring', kind: 'shape' },
  { id: 'semicircle', label: 'Semi-Circle', kind: 'shape' },
  { id: 'cross', label: 'Cross / Plus', kind: 'shape' },
  { id: 'chevron', label: 'Chevron', kind: 'shape' },
  { id: 'trapezoid', label: 'Trapezoid', kind: 'shape' },
  { id: 'parallelogram', label: 'Parallelogram', kind: 'shape' },
  { id: 'heart', label: 'Heart', kind: 'shape' },
  { id: 'lightning-bolt', label: 'Lightning Bolt', kind: 'shape' },
  { id: 'crescent', label: 'Crescent', kind: 'shape' },
  { id: 'spiral', label: 'Spiral', kind: 'shape' },
  { id: 'wave', label: 'Wave', kind: 'shape' },
  { id: 'burst', label: 'Burst / Sunburst', kind: 'shape' },
  { id: 'badge', label: 'Badge / Seal', kind: 'shape' },
  { id: 'speech-bubble', label: 'Speech Bubble', kind: 'shape' },
  { id: 'cloud', label: 'Cloud', kind: 'shape' },
  { id: 'blob', label: 'Blob', kind: 'shape' },
  { id: 'custom-polygon', label: 'Custom Polygon', kind: 'shape' },
];

export function canFillShape(element: ShapeGeometryElement) {
  return element.type === 'shape' && shapeIsClosed(element);
}

export const PATTERN_ASSETS: StudioAsset[] = PATTERN_CATALOG.map(({ id, label }) => ({ id, label, kind: 'pattern' }));

export const DISTRESS_ASSETS: StudioAsset[] = [
  { id: 'holes', label: 'Holes', kind: 'distress' },
  { id: 'abrasion', label: 'Abrasion', kind: 'distress' },
  { id: 'rips', label: 'Rips & tears', kind: 'distress' },
];

export const STUDIO_DRAG_MIME = 'application/x-ceriga-asset';

export function encodeStudioDrag(kind: StudioAssetKind, id: string, settings?: PatternPatch) {
  return JSON.stringify({ kind, id, ...(kind === 'pattern' && settings ? { settings: patternAppearance(settings) } : {}) });
}

export function decodeStudioDrag(raw: string | undefined | null): { kind: StudioAssetKind; id: string; settings?: PatternPatch } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { kind?: StudioAssetKind; id?: string; settings?: unknown };
    if (!parsed || ![...SHAPE_ASSETS, ...PATTERN_ASSETS, ...DISTRESS_ASSETS].some(asset => asset.kind === parsed.kind && asset.id === parsed.id)) return null;
    return { kind: parsed.kind!, id: parsed.id!, ...(parsed.kind === 'pattern' && parsed.settings ? { settings: patternAppearance(parsed.settings) } : {}) };
  } catch {
    return null;
  }
}

export function defaultStudioSize(kind: StudioAssetKind, id?: string): { width: number; height: number } {
  if (kind === 'shape' && (id === 'line' || id === 'zigzag' || id === 'squiggly' || id === 'wave')) {
    return { width: 120, height: id === 'line' ? 22 : 40 };
  }
  if (kind === 'shape') return { width: 88, height: 88 };
  if (kind === 'distress') return { width: 110, height: 90 };
  return { width: 140, height: 90 };
}

export function defaultPatternCount(id: string) {
  if (id === 'checks' || id === 'dots') return 4;
  return 5;
}

export function patternDensityOptions(id: string): { value: number; label: string }[] | null {
  if (id === 'checks' || id === 'dots') {
    return [2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} × ${n}` }));
  }
  if (id === 'stripes' || id === 'stripes-h' || id === 'diagonal') {
    return [3, 4, 5, 6, 8].map((n) => ({ value: n, label: `${n} lines` }));
  }
  return null;
}
