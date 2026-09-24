import type { ResolvedGarmentLayer } from './garmentSvgCatalog';

const namespace = 'http://www.w3.org/2000/svg';
const cache = new Map<string, Map<string, string>>();

function contours(data: string) {
  return data.includes('m') ? [data] : data.match(/M[^M]*/g) ?? [];
}

function cleanFabric(raw: string, probe: SVGPathElement) {
  const parsed = new DOMParser().parseFromString(raw, 'image/svg+xml');
  const group = parsed.querySelector('g[transform]');
  let changed = false;
  for (const path of Array.from(group?.children ?? []).filter(child => child.tagName === 'path')) {
    const parts = contours(path.getAttribute('d') ?? '');
    if (parts.length < 3) continue;
    const measured = parts.map(data => {
      probe.setAttribute('d', data);
      const bounds = probe.getBBox();
      return { data, width: bounds.width, height: bounds.height };
    });
    const largest = measured.reduce((first, second) => first.width * first.height > second.width * second.height ? first : second);
    probe.setAttribute('d', largest.data);
    const boundary = probe.getBBox();
    const kept = measured.filter(part => {
      if (part === largest || part.width >= 700 || part.height >= 700) return true;
      const contour = document.createElementNS(namespace, 'path');
      contour.setAttribute('d', part.data);
      const length = contour.getTotalLength();
      return Array.from({ length: 8 }, (_, index) => contour.getPointAtLength(length * index / 8)).some(point =>
        point.x <= boundary.x || point.x >= boundary.x + boundary.width ||
        point.y <= boundary.y || point.y >= boundary.y + boundary.height || !probe.isPointInFill(point));
    });
    if (kept.length === parts.length) continue;
    path.setAttribute('d', kept.map(part => part.data).join(''));
    changed = true;
  }
  return changed ? new XMLSerializer().serializeToString(parsed.documentElement) : raw;
}

function separateScoopStitches(outline: string, stitching: string, neck: string, probe: SVGPathElement) {
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
      const kept = contours(data).filter(part => {
        probe.setAttribute('d', part);
        const box = probe.getBBox();
        const nearCollar = box.x >= bounds.x - 160 && box.x + box.width <= bounds.x + bounds.width + 160 &&
          box.y >= bounds.y - 160 && box.y + box.height <= bounds.y + bounds.height + 160;
        if (!nearCollar || box.width > 700 || box.height > 700 ||
          !ink.isPointInFill(new DOMPoint(box.x + box.width / 2, box.y + box.height / 2))) return true;
        moved.push(part);
        return false;
      });
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

export function withTshirtCollarContours(layers: ResolvedGarmentLayer[]): ResolvedGarmentLayer[] {
  const neck = layers.find(layer => layer.id === 'neck');
  const base = layers.find(layer => layer.id === 'base');
  const outline = layers.find(layer => layer.id === 'outline');
  const stitching = layers.find(layer => layer.id === 'stitching');
  if (!neck || !base || !outline || typeof document === 'undefined' ||
    !/^(crew neck|thin crew neck|deep v-neck|v-neck|scoop neck)( \(.+\))?$/i.test(neck.displayName)) return layers;
  const key = base.svgRaw + neck.svgRaw + outline.svgRaw + stitching?.svgRaw + base.tint;
  let repaired = cache.get(key);
  if (!repaired) {
    const mounted = document.createElementNS(namespace, 'svg');
    mounted.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden';
    const probe = document.createElementNS(namespace, 'path');
    mounted.append(probe);
    document.body.append(mounted);
    try {
      repaired = new Map([['base', cleanFabric(base.svgRaw, probe)]]);
      const ribbed = !neck.displayName.toLowerCase().includes('scoop');
      if (!ribbed && stitching) {
        const separated = separateScoopStitches(outline.svgRaw, stitching.svgRaw, neck.svgRaw, probe);
        if (separated) {
          repaired.set('outline', separated.outline);
          repaired.set('stitching', separated.stitching);
        }
      }
      cache.set(key, repaired);
      if (cache.size > 24) cache.delete(cache.keys().next().value!);
    } finally {
      mounted.remove();
    }
  }
  return layers.map(layer => repaired!.has(layer.id) ? { ...layer, svgRaw: repaired!.get(layer.id)! } : layer);
}