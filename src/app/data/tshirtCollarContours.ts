import type { ResolvedGarmentLayer } from './garmentSvgCatalog';

const namespace = 'http://www.w3.org/2000/svg';
const cache: { context: ContourContext; repaired: Map<string, string> }[] = [];
const pending: { context: ContourContext; task: Promise<Map<string, string>> }[] = [];
const cleanFabricCache = new Map<string, string>();
const pendingCleanFabric = new Map<string, Promise<string>>();

type ContourContext = {
  neck: ResolvedGarmentLayer;
  base: ResolvedGarmentLayer;
  outline: ResolvedGarmentLayer;
  stitching?: ResolvedGarmentLayer;
};

function contours(data: string) {
  return data.includes('m') ? [data] : data.match(/M[^M]*/g) ?? [];
}

function createWorkYield() {
  let nextYieldAt = performance.now() + 8;
  return async () => {
    if (performance.now() < nextYieldAt) return;
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    nextYieldAt = performance.now() + 8;
  };
}

async function cleanFabric(raw: string, probe: SVGPathElement, yieldForPaint: () => Promise<void>) {
  const parsed = new DOMParser().parseFromString(raw, 'image/svg+xml');
  const group = parsed.querySelector('g[transform]');
  let changed = false;
  for (const path of Array.from(group?.children ?? []).filter(child => child.tagName === 'path')) {
    const parts = contours(path.getAttribute('d') ?? '');
    if (parts.length < 3) continue;
    const measured: { data: string; width: number; height: number }[] = [];
    for (const data of parts) {
      probe.setAttribute('d', data);
      const bounds = probe.getBBox();
      measured.push({ data, width: bounds.width, height: bounds.height });
      await yieldForPaint();
    }
    const largest = measured.reduce((first, second) => first.width * first.height > second.width * second.height ? first : second);
    probe.setAttribute('d', largest.data);
    const boundary = probe.getBBox();
    const kept: typeof measured = [];
    for (const part of measured) {
      let keep = part === largest || part.width >= 700 || part.height >= 700;
      if (!keep) {
        const contour = document.createElementNS(namespace, 'path');
        contour.setAttribute('d', part.data);
        const length = contour.getTotalLength();
        for (let index = 0; index < 8; index++) {
          const point = contour.getPointAtLength(length * index / 8);
          if (point.x <= boundary.x || point.x >= boundary.x + boundary.width ||
            point.y <= boundary.y || point.y >= boundary.y + boundary.height || !probe.isPointInFill(point)) {
            keep = true;
            break;
          }
          await yieldForPaint();
        }
      }
      if (keep) kept.push(part);
      await yieldForPaint();
    }
    if (kept.length === parts.length) continue;
    path.setAttribute('d', kept.map(part => part.data).join(''));
    changed = true;
  }
  return changed ? new XMLSerializer().serializeToString(parsed.documentElement) : raw;
}

async function separateScoopStitches(
  outline: string,
  stitching: string,
  neck: string,
  probe: SVGPathElement,
  yieldForPaint: () => Promise<void>,
) {
  const parsed = new DOMParser().parseFromString(outline, 'image/svg+xml');
  const collar = new DOMParser().parseFromString(neck, 'image/svg+xml');
  probe.setAttribute('d', collar.querySelector('g[transform] > path')!.getAttribute('d')!);
  const bounds = probe.getBBox();
  const moved: string[] = [];
  const ink = document.createElementNS(namespace, 'path');
  ink.setAttribute('fill-rule', 'evenodd');
  probe.parentElement!.append(ink);
  try {
    for (const path of Array.from(parsed.querySelectorAll('g[transform] > path'))) {
      const data = path.getAttribute('d') ?? '';
      ink.setAttribute('d', data);
      const kept: string[] = [];
      for (const part of contours(data)) {
        probe.setAttribute('d', part);
        const box = probe.getBBox();
        const nearCollar = box.x >= bounds.x - 160 && box.x + box.width <= bounds.x + bounds.width + 160 &&
          box.y >= bounds.y - 160 && box.y + box.height <= bounds.y + bounds.height + 160;
        if (!nearCollar || box.width > 700 || box.height > 700 ||
          !ink.isPointInFill(new DOMPoint(box.x + box.width / 2, box.y + box.height / 2))) kept.push(part);
        else moved.push(part);
        await yieldForPaint();
      }
      path.setAttribute('d', kept.join(''));
    }
  } finally {
    ink.remove();
  }
  return moved.length ? {
    outline: new XMLSerializer().serializeToString(parsed.documentElement),
    stitching: stitching.replace(/(<g transform="[^"]+"[^>]*>)/,
      `$1<path data-collar-stitches="true" d="${moved.join('')}"/>`),
  } : undefined;
}

function contourContext(layers: ResolvedGarmentLayer[]) {
  const neck = layers.find(layer => layer.id === 'neck');
  const base = layers.find(layer => layer.id === 'base');
  const outline = layers.find(layer => layer.id === 'outline');
  const stitching = layers.find(layer => layer.id === 'stitching');
  if (!neck || !base || !outline || typeof document === 'undefined' ||
    !/^(crew neck|thin crew neck|deep v-neck|v-neck|scoop neck)( \(.+\))?$/i.test(neck.displayName)) return undefined;
  return { neck, base, outline, stitching };
}

function sameContext(first: ContourContext, second: ContourContext) {
  return first.base.svgRaw === second.base.svgRaw && first.neck.svgRaw === second.neck.svgRaw &&
    first.outline.svgRaw === second.outline.svgRaw && first.stitching?.svgRaw === second.stitching?.svgRaw &&
    first.base.tint === second.base.tint;
}

function applyRepairedLayers(layers: ResolvedGarmentLayer[], repaired: Map<string, string>) {
  return layers.map(layer => repaired.has(layer.id) ? { ...layer, svgRaw: repaired.get(layer.id)! } : layer);
}

function cleanFabricOnce(raw: string, probe: SVGPathElement, yieldForPaint: () => Promise<void>) {
  const cached = cleanFabricCache.get(raw);
  if (cached !== undefined) return Promise.resolve(cached);
  const existing = pendingCleanFabric.get(raw);
  if (existing) return existing;

  const task = cleanFabric(raw, probe, yieldForPaint).then(result => {
    cleanFabricCache.set(raw, result);
    if (cleanFabricCache.size > 4) cleanFabricCache.delete(cleanFabricCache.keys().next().value!);
    return result;
  }).finally(() => pendingCleanFabric.delete(raw));
  pendingCleanFabric.set(raw, task);
  return task;
}

async function prepareContours(
  base: ResolvedGarmentLayer,
  neck: ResolvedGarmentLayer,
  outline: ResolvedGarmentLayer,
  stitching: ResolvedGarmentLayer | undefined,
) {
  const mounted = document.createElementNS(namespace, 'svg');
  mounted.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden';
  const probe = document.createElementNS(namespace, 'path');
  mounted.append(probe);
  document.body.append(mounted);
  const yieldForPaint = createWorkYield();
  try {
    const repaired = new Map<string, string>([['base', await cleanFabricOnce(base.svgRaw, probe, yieldForPaint)]]);
    if (neck.displayName.toLowerCase().includes('scoop') && stitching) {
      const separated = await separateScoopStitches(outline.svgRaw, stitching.svgRaw, neck.svgRaw, probe, yieldForPaint);
      if (separated) {
        repaired.set('outline', separated.outline);
        repaired.set('stitching', separated.stitching);
      }
    }
    return repaired;
  } finally {
    mounted.remove();
  }
}

export function withTshirtCollarContours(layers: ResolvedGarmentLayer[]): ResolvedGarmentLayer[] {
  const context = contourContext(layers);
  if (!context) return layers;
  const cached = cache.find(entry => sameContext(entry.context, context));
  return cached ? applyRepairedLayers(layers, cached.repaired) : layers;
}

export async function prepareTshirtCollarContours(layers: ResolvedGarmentLayer[]): Promise<boolean> {
  const context = contourContext(layers);
  if (!context || cache.some(entry => sameContext(entry.context, context))) return false;

  let pendingEntry = pending.find(entry => sameContext(entry.context, context));
  if (!pendingEntry) {
    const task = prepareContours(context.base, context.neck, context.outline, context.stitching);
    pendingEntry = { context, task };
    pending.push(pendingEntry);
    void task.then(repaired => {
      cache.push({ context, repaired });
      if (cache.length > 24) cache.shift();
      const index = pending.indexOf(pendingEntry!);
      if (index >= 0) pending.splice(index, 1);
    }, () => {
      const index = pending.indexOf(pendingEntry!);
      if (index >= 0) pending.splice(index, 1);
    });
  }
  await pendingEntry.task;
  return true;
}