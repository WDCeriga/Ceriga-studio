import type { ResolvedGarmentLayer } from './garmentSvgCatalog';
import { getHoodBundleAsset } from './hoodBundles';
import { bodyPanelSeams, deepHoodSeams, regularHoodSeams, scubaHoodSeams } from './hoodieAuthoredSeams';
import { tintPotraceSvg } from '../lib/tshirtSvgUtils';
import type { StitchRegion } from './hoodieStitching';

export type HoodieSeam = { region: StitchRegion; path: string };
export type HoodiePanelSeams = { seams: HoodieSeam[]; clearanceMask: string };
export type HoodieSeamGeometry = Record<string, HoodiePanelSeams>;
const size = 1024;
const cache = new Map<string, Promise<HoodieSeamGeometry>>();
type Raster = { pixels: Uint8ClampedArray };

async function rasterize(raw: string): Promise<Raster> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tintPotraceSvg(raw, '#ffffff'))}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  return { pixels };
}

function fabric(raster: Raster, column: number, row: number) {
  if (column < 0 || column >= size || row < 0 || row >= size) return false;
  const offset = (Math.round(row) * size + Math.round(column)) * 4;
  return raster.pixels[offset + 3] > 240 && raster.pixels[offset] > 220;
}

function clearanceMask(raster: Raster) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(size, size);
  for (let row = 2; row < size - 2; row++) for (let column = 2; column < size - 2; column++) {
    const clear = [[0, 0], [-2, 0], [2, 0], [0, -2], [0, 2]]
      .every(([horizontal, vertical]) => fabric(raster, column + horizontal, row + vertical));
    if (!clear) continue;
    const offset = (row * size + column) * 4;
    image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

export function measureHoodieSeams(layers: ResolvedGarmentLayer[]): Promise<HoodieSeamGeometry> {
  const key = layers.map(layer => layer.assetId + layer.svgRaw).join('|');
  const previous = cache.get(key);
  if (previous) return previous;
  const pending = (async () => {
    const rasters = Object.fromEntries(await Promise.all(layers.map(async layer => [layer.id, await rasterize(layer.svgRaw)] as const)));
    const descriptor = getHoodBundleAsset(layers.find(layer => layer.id === 'hood')?.assetId);
    const bodyLayer = layers.find(layer => layer.id === 'base');
    const sleeveConstruction = bodyLayer?.displayName.startsWith('Raglan') ? 'raglan'
      : bodyLayer?.displayName.startsWith('Dropped') ? 'dropped-shoulder' : 'set-in';
    const result: HoodieSeamGeometry = {};
    for (const layer of layers) {
      const raster = rasters[layer.id];
      let seams: HoodieSeam[] = [];
      if (descriptor) {
        const { fit, frontConstruction } = descriptor.variant;
        if (layer.id !== 'hood') seams = bodyPanelSeams(fit, layer.id, sleeveConstruction);
        else if (descriptor.bundle.styleId === 'oversized-deep') seams = deepHoodSeams(fit, frontConstruction);
        else if (descriptor.bundle.styleId === 'scuba') seams = scubaHoodSeams(fit);
        else if (descriptor.bundle.styleId === 'regular') seams = regularHoodSeams(fit, frontConstruction);
      }
      result[layer.id] = { seams, clearanceMask: clearanceMask(raster) };
    }
    return result;
  })();
  cache.set(key, pending);
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  pending.catch(() => cache.delete(key));
  return pending;
}