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

export function buildArtworkClipPath(
  element: Partial<CropInsets> & { cornerRadius?: number },
  opts?: { ignoreCrop?: boolean },
): string | undefined {
  const { cropTop: t, cropRight: r, cropBottom: b, cropLeft: l } = normalizeCrop(opts?.ignoreCrop ? {} : element);
  const radius = clamp(finite(element.cornerRadius), 0, 50);
  if (!t && !r && !b && !l && !radius) return undefined;
  return `inset(${t}% ${r}% ${b}% ${l}%${radius ? ` round ${radius}px` : ''})`;
}
