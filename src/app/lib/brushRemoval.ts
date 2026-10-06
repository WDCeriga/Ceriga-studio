import { quadMap, type Quad } from './designGeometry';
import { normalizeCrop, type CropInsets } from './artworkCrop';
import { interpolateWarpGrid, warpGrid, type WarpSettings } from './warpGeometry';

interface DrawingPlacement extends Partial<CropInsets> {
  x: number; y: number; width: number; height: number; rotation: number;
  flipHorizontal?: boolean; flipVertical?: boolean; perspective?: Quad; warp?: WarpSettings;
}

/** Map the garment-space brush mask back into source pixels without flattening layer transforms. */
export function removeBrushMask(source: HTMLCanvasElement, mask: ImageData, element: DrawingPlacement, scaleX: number, scaleY: number, opacity: number): boolean {
  const context = source.getContext('2d', { willReadFrequently: true });
  if (!context || !element.width || !element.height) return false;
  const pixels = context.getImageData(0, 0, source.width, source.height);
  const map = quadMap(element.perspective);
  const grid = element.warp ? warpGrid(element.warp) : null;
  const gridSize = element.warp?.mode === 'freeform' ? element.warp.gridSize : 3;
  const crop = normalizeCrop(element);
  const angle = element.rotation * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const alpha = Math.max(0, Math.min(1, opacity));
  let changed = false;
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const index = (y * source.width + x) * 4 + 3;
    if (!pixels.data[index]) continue;
    let u = (x + .5) / source.width, v = (y + .5) / source.height;
    if (element.flipHorizontal) u = 1 - u;
    if (element.flipVertical) v = 1 - v;
    const warped = grid ? interpolateWarpGrid(grid, gridSize, u, v) : { x: u, y: v };
    if (warped.x < crop.cropLeft / 100 || warped.x > 1 - crop.cropRight / 100 || warped.y < crop.cropTop / 100 || warped.y > 1 - crop.cropBottom / 100) continue;
    const point = map.project(warped);
    const dx = (point.x - .5) * element.width, dy = (point.y - .5) * element.height;
    const mx = Math.floor((element.x + dx * cos - dy * sin) * scaleX);
    const my = Math.floor((element.y + dx * sin + dy * cos) * scaleY);
    if (mx < 0 || my < 0 || mx >= mask.width || my >= mask.height) continue;
    const next = Math.round(pixels.data[index] * (1 - mask.data[(my * mask.width + mx) * 4 + 3] / 255 * alpha));
    if (next !== pixels.data[index]) { pixels.data[index] = next; changed = true; }
  }
  if (changed) context.putImageData(pixels, 0, 0);
  return changed;
}
