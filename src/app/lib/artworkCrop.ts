export interface CropInsets {
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  cropLeft: number;
}

const finite = (value: number | undefined) => Number.isFinite(value) ? value! : 0;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Crop percentages always leave at least one percent visible on each axis. */
export function normalizeCrop(element: Partial<CropInsets>): CropInsets {
  const cropTop = clamp(finite(element.cropTop), 0, 99);
  const cropLeft = clamp(finite(element.cropLeft), 0, 99);
  return {
    cropTop,
    cropRight: clamp(finite(element.cropRight), 0, 99 - cropLeft),
    cropBottom: clamp(finite(element.cropBottom), 0, 99 - cropTop),
    cropLeft,
  };
}

export type CropHandle = 'move' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

/** Apply a gesture delta in artwork-local percentage coordinates. */
export function adjustCrop(element: Partial<CropInsets>, handle: CropHandle, dx: number, dy: number): CropInsets {
  const crop = normalizeCrop(element);
  dx = finite(dx);
  dy = finite(dy);
  if (handle === 'move') {
    dx = clamp(dx, -crop.cropLeft, crop.cropRight);
    dy = clamp(dy, -crop.cropTop, crop.cropBottom);
    return { cropTop: crop.cropTop + dy, cropRight: crop.cropRight - dx, cropBottom: crop.cropBottom - dy, cropLeft: crop.cropLeft + dx };
  }
  if (handle.includes('n')) crop.cropTop = clamp(crop.cropTop + dy, 0, 99 - crop.cropBottom);
  if (handle.includes('s')) crop.cropBottom = clamp(crop.cropBottom - dy, 0, 99 - crop.cropTop);
  if (handle.includes('w')) crop.cropLeft = clamp(crop.cropLeft + dx, 0, 99 - crop.cropRight);
  if (handle.includes('e')) crop.cropRight = clamp(crop.cropRight - dx, 0, 99 - crop.cropLeft);
  return crop;
}

export const CROP_RATIOS: { id: string; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Free', ratio: null }, { id: '1:1', label: '1:1', ratio: 1 }, { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 }, { id: '3:2', label: '3:2', ratio: 3 / 2 }, { id: '16:9', label: '16:9', ratio: 16 / 9 },
];

/** The largest crop of this ratio that fits the artwork, kept around the current centre. */
export function cropToRatio(element: Partial<CropInsets>, width: number, height: number, ratio: number): CropInsets {
  const crop = normalizeCrop(element), cx = (crop.cropLeft + 100 - crop.cropRight) / 2, cy = (crop.cropTop + 100 - crop.cropBottom) / 2;
  const fitWidth = Math.min(width, height * ratio), w = fitWidth / width * 100, h = fitWidth / ratio / height * 100, left = clamp(cx - w / 2, 0, 100 - w), top = clamp(cy - h / 2, 0, 100 - h);
  return normalizeCrop({ cropLeft: left, cropTop: top, cropRight: 100 - left - w, cropBottom: 100 - top - h });
}

/** Crop gesture that holds a ratio. `ratio` is width / height in the crop's percentage units. */
export function adjustCropToRatio(element: Partial<CropInsets>, handle: CropHandle, dx: number, dy: number, ratio: number): CropInsets {
  const start = normalizeCrop(element), raw = adjustCrop(start, handle, dx, dy);
  if (handle === 'move') return raw;
  const left = raw.cropLeft, top = raw.cropTop, right = 100 - raw.cropRight, bottom = 100 - raw.cropBottom, rawW = right - left, rawH = bottom - top;
  const edgeY = handle === 'n' || handle === 's', edgeX = handle === 'e' || handle === 'w';
  const startRight = 100 - start.cropRight, startBottom = 100 - start.cropBottom, cx = (start.cropLeft + startRight) / 2, cy = (start.cropTop + startBottom) / 2;
  const maxW = handle.includes('w') ? startRight : handle.includes('e') ? 100 - start.cropLeft : 2 * Math.min(cx, 100 - cx);
  const maxH = handle.includes('n') ? startBottom : handle.includes('s') ? 100 - start.cropTop : 2 * Math.min(cy, 100 - cy);
  let w = edgeY ? rawH * ratio : edgeX ? rawW : Math.max(rawW, rawH * ratio);
  w = clamp(w, Math.max(1, ratio), Math.min(maxW, maxH * ratio));
  const h = w / ratio, x = handle.includes('w') ? startRight - w : handle.includes('e') ? start.cropLeft : cx - w / 2, y = handle.includes('n') ? startBottom - h : handle.includes('s') ? start.cropTop : cy - h / 2;
  return normalizeCrop({ cropLeft: x, cropTop: y, cropRight: 100 - x - w, cropBottom: 100 - y - h });
}

export type CropShapeId = 'circle' | 'arch' | 'hexagon' | 'diamond' | 'triangle' | 'star' | 'shield' | 'heart';
const arc = (cx: number, cy: number, rx: number, ry: number, from: number, to: number, steps: number): [number, number][] =>
  Array.from({ length: steps + 1 }, (_, i) => { const a = (from + (to - from) * i / steps) * Math.PI / 180; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
const heart = (): [number, number][] => {
  const raw = Array.from({ length: 96 }, (_, i) => {
    const t = i / 96 * Math.PI * 2;
    return [16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))];
  }), xs = raw.map(p => p[0]), ys = raw.map(p => p[1]), left = Math.min(...xs), top = Math.min(...ys), w = Math.max(...xs) - left, h = Math.max(...ys) - top;
  return raw.map(([x, y]) => [(x - left) / w, (y - top) / h]);
};
const star = (): [number, number][] => Array.from({ length: 10 }, (_, i) => { const a = (-90 + i * 36) * Math.PI / 180, r = i % 2 ? .22 : .5; return [.5 + Math.cos(a) * r, .53 + Math.sin(a) * r]; });
const POLYGONS: Record<CropShapeId, [number, number][]> = {
  circle: arc(.5, .5, .5, .5, 0, 359, 96),
  arch: [...arc(.5, .5, .5, .5, 180, 360, 64), [1, 1], [0, 1]],
  hexagon: [[.25, 0], [.75, 0], [1, .5], [.75, 1], [.25, 1], [0, .5]],
  diamond: [[.5, 0], [1, .5], [.5, 1], [0, .5]],
  triangle: [[.5, 0], [1, 1], [0, 1]],
  star: star(),
  shield: [[0, .04], [.5, 0], [1, .04], [1, .52], ...arc(.5, .52, .5, .48, 0, 90, 24).slice(1), ...arc(.5, .52, .5, .48, 90, 180, 24).slice(1)],
  heart: heart(),
};
export const CROP_SHAPES: { id: CropShapeId; label: string }[] = [
  { id: 'circle', label: 'Circle' }, { id: 'arch', label: 'Arch' }, { id: 'hexagon', label: 'Hexagon' }, { id: 'diamond', label: 'Diamond' },
  { id: 'triangle', label: 'Triangle' }, { id: 'star', label: 'Star' }, { id: 'shield', label: 'Shield' }, { id: 'heart', label: 'Heart' },
];
/** Shape outline as points in 0–100 of the artwork, fitted to the crop rectangle. */
export function cropShapePoints(element: Partial<CropInsets>, shape: CropShapeId): [number, number][] {
  const crop = normalizeCrop(element), w = 100 - crop.cropLeft - crop.cropRight, h = 100 - crop.cropTop - crop.cropBottom;
  return (POLYGONS[shape] ?? []).map(([x, y]) => [crop.cropLeft + x * w, crop.cropTop + y * h]);
}
export const cropShapeIcon = (shape: CropShapeId, size = 16) => 'M' + POLYGONS[shape].map(([x, y]) => `${(x * size).toFixed(2)} ${(y * size).toFixed(2)}`).join('L') + 'Z';

export function buildArtworkClipPath(
  element: Partial<CropInsets> & { cornerRadius?: number; cropShape?: CropShapeId },
  opts?: { ignoreCrop?: boolean },
): string | undefined {
  if (element.cropShape && !opts?.ignoreCrop && POLYGONS[element.cropShape]) return `polygon(${cropShapePoints(element, element.cropShape).map(([x, y]) => `${x.toFixed(3)}% ${y.toFixed(3)}%`).join(',')})`;
  const { cropTop: t, cropRight: r, cropBottom: b, cropLeft: l } = normalizeCrop(opts?.ignoreCrop ? {} : element);
  const radius = clamp(finite(element.cornerRadius), 0, 50);
  if (!t && !r && !b && !l && !radius) return undefined;
  return `inset(${t}% ${r}% ${b}% ${l}%${radius ? ` round ${radius}px` : ''})`;
}
