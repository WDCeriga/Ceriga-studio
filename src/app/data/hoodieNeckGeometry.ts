import { getHoodBundleAsset } from './hoodBundles';
import { deepHoodSeams, hoodieNecklineLandmarks, regularHoodSeams, scubaHoodSeams } from './hoodieAuthoredSeams';
import { washSource } from './garmentWash';

const cache = new Map<string, Promise<HoodieNeckGeometry>>();
const size = 2048;
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
export interface HoodieNeckGeometry {
  assetId: string;
  hoodStyle: string;
  construction: string;
  hoodOpeningMask: string;
  innerBackNeck: string;
  frontOcclusionMask: string;
  rearHoodMask: string;
  blockingFrontMask: string;
  openingBounds: Bounds;
  bounds: Bounds;
  labelAnchor: { center: { x: number; y: number }; bounds: Bounds };
  center: { x: number; y: number };
  seamY: number;
  rotation: { min: number; max: number };
  scale: { min: number; max: number };
  pixelCount: number;
  backNeckSeam: string;
}

export function hoodieNeckGeometry(raw: string, assetId: string): Promise<HoodieNeckGeometry> {
  const key = `${assetId}:${raw}`;
  const saved = cache.get(key);
  if (saved) return saved;
  const pending = deriveGeometry(raw, assetId);
  if (cache.size >= 30) cache.delete(cache.keys().next().value!);
  cache.set(key, pending);
  return pending;
}

async function deriveGeometry(raw: string, assetId: string): Promise<HoodieNeckGeometry> {
  const descriptor = getHoodBundleAsset(assetId);
  if (!descriptor) throw new Error(`Unknown hood: ${assetId}`);
  const { fit, frontConstruction } = descriptor.variant;
  const style = descriptor.bundle.styleId;
  const seams = style === 'regular' ? regularHoodSeams(fit, frontConstruction)
    : style === 'scuba' ? scubaHoodSeams(fit) : deepHoodSeams(fit, frontConstruction);
  const points = seams.filter(seam => seam.region === 'hoodOpening').flatMap(seam => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', seam.path);
    const length = path.getTotalLength();
    return Array.from({ length: 65 }, (_, index) => path.getPointAtLength(length * index / 64));
  });
  if (!points.length) throw new Error(`Missing opening seeds: ${assetId}`);
  const left = Math.min(...points.map(point => point.x));
  const right = Math.max(...points.map(point => point.x));
  const top = Math.min(...points.map(point => point.y));
  const bottom = Math.max(...points.map(point => point.y));
  const image = new Image();
  image.src = washSource(raw);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, size, size).data;
  const region = new Uint8Array(size * size);
  const queue = new Int32Array(size * size);
  let count = 0;
  const add = (index: number) => {
    if (index < 0 || index >= region.length || region[index]) return;
    const offset = index * 4;
    if (pixels[offset] < 200 || pixels[offset + 3] < 250) return;
    region[index] = 1;
    queue[count++] = index;
  };
  const seedY = Math.round(top + (bottom - top) * .35);
  for (const fraction of [.42, .58]) add(seedY * size + Math.round(left + (right - left) * fraction));
  for (let cursor = 0; cursor < count; cursor++) {
    const index = queue[cursor];
    if (index % size > 0) add(index - 1);
    if (index % size < size - 1) add(index + 1);
    add(index - size);
    add(index + size);
  }
  const openingBounds = { minX: size, minY: size, maxX: 0, maxY: 0 };
  for (let cursor = 0; cursor < count; cursor++) {
    const horizontal = queue[cursor] % size;
    const vertical = Math.floor(queue[cursor] / size);
    openingBounds.minX = Math.min(openingBounds.minX, horizontal);
    openingBounds.maxX = Math.max(openingBounds.maxX, horizontal);
    openingBounds.minY = Math.min(openingBounds.minY, vertical);
    openingBounds.maxY = Math.max(openingBounds.maxY, vertical);
  }
  if (count < 500 || openingBounds.minX < left - 80 || openingBounds.maxX > right + 80
    || openingBounds.minY < top - 80 || openingBounds.maxY > bottom + 80) {
    throw new Error(`Opening isolation failed: ${assetId} (${count}, ${JSON.stringify(openingBounds)}, seed bounds ${left},${top},${right},${bottom})`);
  }
  for (let vertical = openingBounds.minY; vertical <= openingBounds.maxY; vertical++) {
    let rowLeft = openingBounds.maxX;
    let rowRight = openingBounds.minX;
    for (let horizontal = openingBounds.minX; horizontal <= openingBounds.maxX; horizontal++) {
      if (region[vertical * size + horizontal]) {
        rowLeft = Math.min(rowLeft, horizontal);
        rowRight = Math.max(rowRight, horizontal);
      }
    }
    for (let horizontal = rowLeft; horizontal <= rowRight; horizontal++) region[vertical * size + horizontal] = 1;
  }
  const neckline = hoodieNecklineLandmarks(fit);
  if (!neckline) throw new Error(`Missing neckline: ${assetId}`);
  const centerX = neckline.center;
  const depth = neckline.frontY - neckline.sideY;
  const neckHalfWidth = centerX - neckline.sideX;
  const endY = Math.round(neckline.frontY - depth * .3 - 4);
  const seamY = Math.min(Math.round(neckline.frontY - depth * .8), endY - 40);
  const halfWidth = Math.floor(neckHalfWidth * .62);
  const cavity = new Uint8Array(size * size);
  const backNeckSeam = `M${centerX - halfWidth} ${seamY - depth * .12} Q${centerX} ${seamY + depth * .12} ${centerX + halfWidth} ${seamY - depth * .12}`;
  for (let index = 0; index < cavity.length; index++) cavity[index] = pixels[index * 4 + 3] > 0 ? 1 : 0;
  const mask = (kind: 'opening' | 'surface' | 'front' | 'rear' | 'blocking') => {
    const output = context.createImageData(size, size);
    for (let index = 0; index < region.length; index++) {
      const blocking = !region[index] && Math.floor(index / size) >= openingBounds.minY;
      const visible = kind === 'opening' ? region[index] : kind === 'surface' ? cavity[index]
        : kind === 'rear' ? !blocking : kind === 'blocking' ? blocking : !region[index];
      output.data[index * 4] = output.data[index * 4 + 1] = output.data[index * 4 + 2] = 255;
      output.data[index * 4 + 3] = visible ? 255 : 0;
    }
    context.putImageData(output, 0, 0);
    return canvas.toDataURL('image/png');
  };
  const bounds = { minX: centerX - halfWidth, maxX: centerX + halfWidth, minY: seamY + 4, maxY: endY };
  const openingMask = mask('opening');
  return {
    assetId, hoodStyle: style, construction: frontConstruction,
    hoodOpeningMask: openingMask, innerBackNeck: mask('surface'), frontOcclusionMask: mask('front'),
    rearHoodMask: mask('rear'), blockingFrontMask: mask('blocking'),
    openingBounds, bounds, labelAnchor: { center: { x: centerX, y: seamY }, bounds },
    center: { x: centerX, y: (seamY + endY) / 2 }, seamY,
    rotation: { min: -10, max: 10 }, scale: { min: .5, max: 2 }, pixelCount: count, backNeckSeam,
  };
}