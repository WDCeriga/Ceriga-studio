import { getHoodBundleAsset } from './hoodBundles';
import { deepHoodSeams, regularHoodSeams, scubaHoodSeams } from './hoodieAuthoredSeams';
import { washSource } from './garmentWash';

const sources = new Map<string, Promise<string>>();

export function hoodExteriorWashSource(raw: string, assetId: string): Promise<string> {
  const cached = sources.get(raw);
  if (cached) return cached;
  const result = buildExteriorSource(raw, assetId);
  if (sources.size >= 32) sources.delete(sources.keys().next().value!);
  sources.set(raw, result);
  return result;
}

async function buildExteriorSource(raw: string, assetId: string): Promise<string> {
  const descriptor = getHoodBundleAsset(assetId);
  if (!descriptor) throw new Error('Unknown hood lining');
  const { fit, frontConstruction } = descriptor.variant;
  const seams = descriptor.bundle.styleId === 'regular' ? regularHoodSeams(fit, frontConstruction)
    : descriptor.bundle.styleId === 'scuba' ? scubaHoodSeams(fit) : deepHoodSeams(fit, frontConstruction);
  const points = seams.filter(seam => seam.region === 'hoodOpening').flatMap(seam => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', seam.path);
    const length = path.getTotalLength();
    return Array.from({ length: 33 }, (_, index) => path.getPointAtLength(length * index / 32));
  });
  if (!points.length) throw new Error('Missing hood opening');
  const left = Math.min(...points.map(point => point.x));
  const right = Math.max(...points.map(point => point.x));
  const top = Math.min(...points.map(point => point.y));
  const bottom = Math.max(...points.map(point => point.y));
  const image = new Image();
  image.src = washSource(raw);
  await image.decode();
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size);
  const lining = new Uint8Array(size * size);
  const queue = new Int32Array(size * size);
  let count = 0;
  const add = (index: number) => {
    if (index < 0 || index >= lining.length || lining[index]) return;
    const offset = index * 4;
    if (pixels.data[offset] < 128 || pixels.data[offset + 3] < 128) return;
    lining[index] = 1;
    queue[count++] = index;
  };
  const row = Math.round(top + (bottom - top) * .35);
  for (const fraction of [.42, .58]) add(row * size + Math.round(left + (right - left) * fraction));
  for (let cursor = 0; cursor < count; cursor++) {
    const index = queue[cursor];
    if (index % size > 0) add(index - 1);
    if (index % size < size - 1) add(index + 1);
    add(index - size);
    add(index + size);
  }
  if (count < 100) throw new Error('Hood lining could not be isolated');
  for (let cursor = 0; cursor < count; cursor++) {
    const index = queue[cursor];
    for (const offset of [0, -1, 1, -size, size]) {
      const pixel = (index + offset) * 4;
      pixels.data[pixel] = pixels.data[pixel + 1] = pixels.data[pixel + 2] = 0;
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/png');
}