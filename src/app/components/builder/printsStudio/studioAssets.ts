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
];

export const PATTERN_ASSETS: StudioAsset[] = [
  { id: 'stripes', label: 'Stripes', kind: 'pattern' },
  { id: 'stripes-h', label: 'H-Stripes', kind: 'pattern' },
  { id: 'checks', label: 'Checks', kind: 'pattern' },
  { id: 'dots', label: 'Dots', kind: 'pattern' },
  { id: 'diagonal', label: 'Diagonal', kind: 'pattern' },
];

export const DISTRESS_ASSETS: StudioAsset[] = [
  { id: 'holes', label: 'Holes', kind: 'distress' },
  { id: 'abrasion', label: 'Abrasion', kind: 'distress' },
  { id: 'rips', label: 'Rips & tears', kind: 'distress' },
];

export const STUDIO_DRAG_MIME = 'application/x-ceriga-asset';

export function encodeStudioDrag(kind: StudioAssetKind, id: string) {
  return JSON.stringify({ kind, id });
}

export function decodeStudioDrag(raw: string | undefined | null): { kind: StudioAssetKind; id: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { kind?: StudioAssetKind; id?: string };
    if (!parsed.kind || !parsed.id) return null;
    return { kind: parsed.kind, id: parsed.id };
  } catch {
    return null;
  }
}

export function defaultStudioSize(kind: StudioAssetKind, id?: string): { width: number; height: number } {
  if (kind === 'shape' && (id === 'line' || id === 'zigzag' || id === 'squiggly')) {
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
