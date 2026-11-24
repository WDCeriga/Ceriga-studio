/** Brush tips made from uploaded images. Kept full size in this browser and stamped along each stroke. */
const DB = 'ceriga-brush-tips', STORE = 'tips', MAX_SIDE = 1600, MAX_BYTES = 20 * 1024 * 1024;
export type BrushTip = { id: string; width: number; height: number; levels: HTMLCanvasElement[] };
const tips = new Map<string, BrushTip>(), loading = new Map<string, Promise<BrushTip | null>>();

/**
 * Turns image pixels into brush ink. Transparent images keep their alpha.
 * Solid images use the distance from their border colour, so dark-on-light and light-on-dark both work.
 */
export function tipAlphaFromPixels(data: ArrayLike<number>, width: number, height: number) {
  const count = width * height, alpha = new Uint8ClampedArray(count);
  let clear = 0;
  for (let i = 0; i < count; i++) if (data[i * 4 + 3] < 250) clear++;
  if (clear / Math.max(1, count) >= .02) { for (let i = 0; i < count; i++) alpha[i] = data[i * 4 + 3]; return alpha; }
  const light = (i: number) => .2126 * data[i * 4] + .7152 * data[i * 4 + 1] + .0722 * data[i * 4 + 2];
  let edge = 0, edges = 0;
  for (let x = 0; x < width; x++) { edge += light(x) + light((height - 1) * width + x); edges += 2; }
  for (let y = 0; y < height; y++) { edge += light(y * width) + light(y * width + width - 1); edges += 2; }
  const background = edge / Math.max(1, edges), range = Math.max(1, Math.max(background, 255 - background));
  for (let i = 0; i < count; i++) alpha[i] = Math.min(255, Math.abs(light(i) - background) / range * 255);
  return alpha;
}

function canvasOf(width: number, height: number) { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; }
function register(id: string, base: HTMLCanvasElement) {
  const levels = [base];
  while (Math.max(levels[levels.length - 1].width, levels[levels.length - 1].height) > 32) {
    const last = levels[levels.length - 1], next = canvasOf(Math.max(1, last.width >> 1), Math.max(1, last.height >> 1)), ctx = next.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(last, 0, 0, next.width, next.height); levels.push(next);
  }
  const tip = { id, width: base.width, height: base.height, levels };
  tips.set(id, tip);
  return tip;
}
function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => { const tx = open.result.transaction(STORE, mode), request = run(tx.objectStore(STORE)); tx.oncomplete = () => { open.result.close(); resolve(request.result); }; tx.onerror = () => { open.result.close(); reject(tx.error); }; };
  });
}

export const brushTip = (id?: string) => id ? tips.get(id) ?? null : null;
export function loadBrushTip(id: string) {
  const ready = tips.get(id);
  if (ready) return Promise.resolve(ready);
  let pending = loading.get(id);
  if (!pending) {
    pending = withStore<Blob | undefined>('readonly', store => store.get(id)).then(async blob => {
      if (!blob) return null;
      const bitmap = await createImageBitmap(blob), base = canvasOf(bitmap.width, bitmap.height);
      base.getContext('2d')!.drawImage(bitmap, 0, 0); bitmap.close();
      return register(id, base);
    }).catch(() => null).finally(() => loading.delete(id));
    loading.set(id, pending);
  }
  return pending;
}
/** Loads every tip a recorded drawing needs. Throws when one is gone, so the saved image is shown instead. */
export async function ensureDrawingTips(strokes: { settings: { brushTip?: string } }[]) {
  for (const id of new Set(strokes.map(stroke => stroke.settings.brushTip).filter(Boolean) as string[])) if (!await loadBrushTip(id)) throw new Error('Brush tip is not available');
}

export async function createBrushTip(file: File) {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) throw new Error('Use a PNG, JPG, WebP or SVG.');
  if (file.size > MAX_BYTES) throw new Error('Use an image under 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const sourceWidth = image.naturalWidth || 1024, sourceHeight = image.naturalHeight || 1024, fit = Math.min(1, MAX_SIDE / Math.max(sourceWidth, sourceHeight));
    const scale = file.type === 'image/svg+xml' ? MAX_SIDE / Math.max(sourceWidth, sourceHeight) : fit;
    const width = Math.max(1, Math.round(sourceWidth * scale)), height = Math.max(1, Math.round(sourceHeight * scale)), base = canvasOf(width, height), ctx = base.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height), alpha = tipAlphaFromPixels(pixels.data, width, height);
    for (let i = 0; i < alpha.length; i++) { pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = 255; pixels.data[i * 4 + 3] = alpha[i]; }
    ctx.putImageData(pixels, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => base.toBlob(value => value ? resolve(value) : reject(new Error('Could not read this image.')), 'image/png'));
    const id = `tip-${crypto.randomUUID()}`;
    await withStore('readwrite', store => store.put(blob, id));
    return register(id, base);
  } finally { URL.revokeObjectURL(url); }
}

type TipSample = { x: number; y: number; opacity: number; radius: number; rotation: number };
let stampLayer: HTMLCanvasElement | null = null;
/** Stamps the tip from the mip level closest to its drawn size, then colours the whole stroke at once. */
export function renderTipStamps(context: CanvasRenderingContext2D, tip: BrushTip, samples: TipSample[]) {
  const target = context.canvas as HTMLCanvasElement;
  stampLayer ??= document.createElement('canvas');
  if (stampLayer.width !== target.width || stampLayer.height !== target.height) { stampLayer.width = target.width; stampLayer.height = target.height; }
  const layer = stampLayer.getContext('2d')!, long = Math.max(tip.width, tip.height);
  layer.setTransform(1, 0, 0, 1, 0, 0); layer.globalCompositeOperation = 'source-over'; layer.globalAlpha = 1; layer.clearRect(0, 0, stampLayer.width, stampLayer.height);
  layer.imageSmoothingEnabled = true; layer.imageSmoothingQuality = 'high';
  for (const point of samples) {
    const drawn = point.radius * 2, width = drawn * tip.width / long, height = drawn * tip.height / long;
    let level = tip.levels[0];
    for (const candidate of tip.levels) { if (Math.max(candidate.width, candidate.height) >= drawn) level = candidate; else break; }
    layer.setTransform(1, 0, 0, 1, point.x, point.y); layer.rotate(point.rotation); layer.globalAlpha = point.opacity;
    layer.drawImage(level, -width / 2, -height / 2, width, height);
  }
  layer.setTransform(1, 0, 0, 1, 0, 0); layer.globalAlpha = 1; layer.globalCompositeOperation = 'source-in'; layer.fillStyle = context.fillStyle; layer.fillRect(0, 0, stampLayer.width, stampLayer.height);
  context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.globalAlpha = 1; context.drawImage(stampLayer, 0, 0); context.restore();
}
