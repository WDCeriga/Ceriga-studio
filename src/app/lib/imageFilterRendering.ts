import { applyImageFilter, type ImageFilterSettings } from './imageFilters';

type Pixels = { data: Uint8ClampedArray; width: number; height: number };
type FilteredPixels = Pixels & { original: Uint8ClampedArray };
const sources = new Map<string, Promise<Pixels>>();
const thumbnails = new Map<string, Promise<FilteredPixels>>();
const artwork = new Map<string, Promise<FilteredPixels>>();
let worker: Worker | undefined;
let nextId = 0;
const requests = new Map<number, { resolve: (pixels: Uint8ClampedArray) => void; reject: (error: Error) => void }>();

function remember<T>(cache: Map<string, Promise<T>>, key: string, limit: number, load: () => Promise<T>) {
  const existing = cache.get(key);
  if (existing) { cache.delete(key); cache.set(key, existing); return existing; }
  const value = load();
  cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value!);
  void value.catch(() => { if (cache.get(key) === value) cache.delete(key); });
  return value;
}

function sourcePixels(source: string, size: number) {
  return remember(sources, `${size}:${source}`, 4, async () => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = source;
    await image.decode();
    const ratio = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Image processing is unavailable in this browser.');
    context.drawImage(image, 0, 0, width, height);
    return { data: context.getImageData(0, 0, width, height).data, width, height };
  });
}

function processPixels(pixels: Pixels, settings: ImageFilterSettings): Promise<Uint8ClampedArray> {
  if (typeof Worker === 'undefined') return Promise.resolve(applyImageFilter(pixels.data, pixels.width, pixels.height, settings));
  if (!worker) {
    worker = new Worker(new URL('./imageFilter.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = event => {
      const request = requests.get(event.data.id);
      requests.delete(event.data.id);
      if (event.data.error) request?.reject(new Error(event.data.error));
      else request?.resolve(event.data.pixels);
    };
    worker.onerror = () => {
      for (const request of requests.values()) request.reject(new Error('Image filter processing failed. Choose the filter again to retry.'));
      requests.clear(); worker?.terminate(); worker = undefined;
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const data = pixels.data.slice();
    requests.set(id, { resolve, reject });
    try {
      worker!.postMessage({ id, data, width: pixels.width, height: pixels.height, settings }, [data.buffer]);
    } catch (error) {
      requests.delete(id);
      reject(error);
    }
  });
}

export function filteredImagePixels(source: string, settings: ImageFilterSettings, size = 1600) {
  const full = { ...settings, intensity: 100 };
  const key = JSON.stringify([source, full, size]);
  return remember(size <= 96 ? thumbnails : artwork, key, size <= 96 ? 40 : 2, async () => {
    const original = await sourcePixels(source, size);
    const data = await processPixels(original, full);
    return { ...original, original: original.data, data };
  });
}

export function paintFilteredImage(canvas: HTMLCanvasElement, pixels: FilteredPixels, intensity: number) {
  const amount = Math.max(0, Math.min(100, Number.isFinite(intensity) ? intensity : 100)) / 100;
  const data = new Uint8ClampedArray(pixels.data.length);
  for (let index = 0; index < data.length; index += 4) {
    for (let channel = 0; channel < 3; channel++) data[index + channel] = pixels.original[index + channel] + (pixels.data[index + channel] - pixels.original[index + channel]) * amount;
    data[index + 3] = pixels.original[index + 3];
  }
  canvas.width = pixels.width; canvas.height = pixels.height;
  canvas.getContext('2d')!.putImageData(new ImageData(data, pixels.width, pixels.height), 0, 0);
}

export async function waitForImageFilters(root: Element, timeout = 15000) {
  const deadline = performance.now() + timeout;
  while (true) {
    if (!root.isConnected) throw new Error('The artwork is no longer visible. Retry when the editor is open.');
    if (root.querySelector('[data-image-filter-error]')) throw new Error('An image filter could not be rendered. Retry it or choose Original before saving.');
    if (root.querySelector('[data-text-effects-error]')) throw new Error('Text effects could not be rendered. Retry or remove the effect before saving.');
    // A filtered child must finish its warp before its parent group can be captured.
    const pendingWarp = [...root.querySelectorAll<HTMLCanvasElement>('[data-warp-expected]')]
      .some(canvas => canvas.dataset.warpReady !== canvas.dataset.warpExpected);
    if (!root.querySelector('[data-image-filter-pending="true"], [data-text-effects-pending="true"]') && !pendingWarp) return;
    if (performance.now() > deadline) throw new Error('Image filters, text effects or warped artwork are still rendering. Wait, then retry.');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
