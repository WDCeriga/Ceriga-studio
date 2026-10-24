import type { Point } from './designGeometry';

const hitTests = new WeakMap<HTMLElement, (point: Point) => boolean>();

export function registerArtworkHitTest(root: HTMLElement, test: (point: Point) => boolean) {
  hitTests.set(root, test);
  return () => { if (hitTests.get(root) === test) hitTests.delete(root); };
}

/** Test painted pixels in stacking order, never the layer's layout rectangle. */
export function artworkAtPoint(zone: HTMLElement, clientX: number, clientY: number): HTMLElement | null {
  const layers = Array.from(zone.querySelectorAll<HTMLElement>('[data-print-id]'));
  layers.sort((a, b) => (Number(getComputedStyle(a).zIndex) || 0) - (Number(getComputedStyle(b).zIndex) || 0));
  for (const layer of layers.reverse()) {
    const style = getComputedStyle(layer);
    if (layer.hasAttribute('data-artwork-hit-disabled') || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
    if (hitTests.get(layer)?.({ x: clientX, y: clientY })) return layer;
  }
  return null;
}

export function alphaContains(image: ImageData, x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= 1 || y >= 1) return false;
  return image.data[(Math.floor(y * image.height) * image.width + Math.floor(x * image.width)) * 4 + 3] >= 8;
}
