import type { TextEffect } from './textEffects';
import type { DesignElement } from '../components/builder/PrintsDesignStep';
import { shapeToEditablePath, type ShapePath } from './shapeGeometry';
import { customAreaBounds, customAreaViewport } from './customAreaGeometry';

export type TextPixels = { data: Uint8ClampedArray; width: number; height: number };
const expanding = new Set(['shadow', 'spray-paint', 'ink-bleed', 'puff-print', 'extrude', 'glow', 'neon', 'long-shadow', 'offset-print', 'rgb-split', 'glitch', 'blur', 'motion-blur']);
export function textEffectPadding(effects: TextEffect[] = []) {
  const active = effects.filter(effect => effect.enabled && effect.intensity > 0);
  return active.length ? 64 * Math.max(1, active.filter(effect => expanding.has(effect.type)).length) : 0;
}

export function shapeArtworkPadding(element: DesignElement): number {
  if (element.type === 'customArea') {
    const bounds = customAreaBounds(element.customAreaPoints ?? []), viewport = customAreaViewport(element);
    const sx = element.width / viewport.width, sy = element.height / viewport.height;
    return Math.ceil(Math.max(0, (bounds.width / 2 - bounds.x) * sx, (bounds.x + bounds.width / 2 - viewport.width) * sx,
      (bounds.height / 2 - bounds.y) * sy, (bounds.y + bounds.height / 2 - viewport.height) * sy));
  }
  if (element.type !== 'shape') return 0;
  const stroke = Math.max(0, element.borderWidth ?? 4) / 2 * (element.content === 'zigzag' ? 8 : 1);
  const strokeX = element.shapeGeometry === 'bounds' ? stroke : stroke * element.width / 100;
  const strokeY = element.shapeGeometry === 'bounds' ? stroke : stroke * element.height / 100;
  let padding = 0;
  const visit = (path: ShapePath) => {
    for (const anchor of path.nodes) for (const point of [anchor, anchor.in, anchor.out]) {
      if (!point) continue;
      const x = point.x * element.width / 100, y = point.y * element.height / 100;
      padding = Math.max(padding, strokeX - x, x + strokeX - element.width, strokeY - y, y + strokeY - element.height);
    }
    path.subpaths?.forEach(visit);
  };
  // Bézier control hulls conservatively include paths moved beyond their original dimensions.
  visit(shapeToEditablePath(element));
  return Math.ceil(padding);
}

export function artworkEffectPadding(element: DesignElement): number {
  const own = shapeArtworkPadding(element) + textEffectPadding([...(element.textEffects ?? []), ...(element.shapeEffects ?? [])]);
  const ratio = element.type === 'group' ? Math.max(element.width / (element.groupSourceWidth || element.width), element.height / (element.groupSourceHeight || element.height)) : 1;
  return Math.ceil(Math.max(own, ...(element.children ?? []).map(child => artworkEffectPadding(child) * ratio), 0));
}

const assets = new Map<string, Promise<TextPixels>>();
export function loadTextEffectImage(source: string): Promise<TextPixels> {
  const cached = assets.get(source);
  if (cached) return cached;
  const promise = (async () => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = source;
    await image.decode();
    const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Text effects require canvas support.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { data: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
  })();
  assets.set(source, promise);
  if (assets.size > 8) assets.delete(assets.keys().next().value!);
  void promise.catch(() => { if (assets.get(source) === promise) assets.delete(source); });
  return promise;
}

type Job = { lane: string; source: TextPixels; effects: TextEffect[]; assets: Record<string, TextPixels>; scale: number; resolve: (data: Uint8ClampedArray) => void; reject: (error: Error) => void };
let worker: Worker | undefined;
let running: Job | undefined;
const queued = new Map<string, Job>();
function pump() {
  if (running || !queued.size) return;
  const job = queued.values().next().value!;
  queued.delete(job.lane);
  running = job;
  const complete = (data?: Uint8ClampedArray, error?: Error) => {
    running = undefined;
    if (error) job.reject(error); else job.resolve(data!);
    pump();
  };
  if (typeof Worker === 'undefined') {
    void import('./textEffects').then(({ applyTextEffects }) => complete(applyTextEffects(job.source.data, job.source.width, job.source.height, job.effects, job.assets, job.scale))).catch(error => complete(undefined, error));
    return;
  }
  try {
    worker ??= new Worker(new URL('./textEffects.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = event => complete(event.data.data, event.data.error ? new Error(event.data.error) : undefined);
    worker.onerror = () => { worker?.terminate(); worker = undefined; complete(undefined, new Error('Text effects could not be rendered. Retry the effect.')); };
    const data = job.source.data.slice();
    worker.postMessage({ data, width: job.source.width, height: job.source.height, effects: job.effects, assets: job.assets, scale: job.scale }, [data.buffer]);
  } catch (error) { complete(undefined, error instanceof Error ? error : new Error(String(error))); }
}

export function renderTextEffects(lane: string, source: TextPixels, effects: TextEffect[], images: Record<string, TextPixels>, scale: number) {
  return new Promise<Uint8ClampedArray>((resolve, reject) => {
    // Keep only the newest pending slider position for each text layer.
    queued.get(lane)?.reject(new DOMException('Superseded text effect render', 'AbortError'));
    queued.set(lane, { lane, source, effects, assets: images, scale, resolve, reject });
    pump();
  });
}

export function cancelTextEffects(lane: string) {
  queued.get(lane)?.reject(new DOMException('Text layer removed', 'AbortError'));
  queued.delete(lane);
}
