import { preloadOversizedReference } from './oversizedReference';
import type { ResolvedGarmentLayer } from './garmentSvgCatalog';
import type { NeckFinish } from './tshirtNeckFinish';
import svgpath from 'svgpath';
import { garmentOutlineCurve } from '../features/panelling/TechnicalLinework';
import { flattenPathContours, signedArea } from '../features/panelling/panellingGeometry';

/**
 * Neck assets traced from the reference flats (scripts/collar/trace_clean_neck_masters.py).
 * Files are keyed fit.neck.view.finish.part; the builder swaps whole assets rather than morphing a shape.
 */
export type NeckPackKind = 'crew' | 'vneck' | 'deep-vneck' | 'thincrew' | 'scoop' | 'polo';
type View = 'front' | 'back';
type Finish = 'ribbed' | 'clean' | 'raw';
type Part = 'body' | 'neck' | 'inner' | 'outline' | 'stitching';

const modules = import.meta.glob('../../assets/tshirt-necks/*.svg', {
  query: '?raw',
  import: 'default',
  eager: false,
}) as Record<string, () => Promise<string>>;

const loaders = new Map<string, () => Promise<string>>();
for (const path of Object.keys(modules)) {
  loaders.set(path.slice(path.lastIndexOf('/') + 1).replace(/\.svg$/i, ''), modules[path]);
}
const loaded = new Map<string, string>();
const pending = new Map<string, Promise<void>>();

/** Refit traced edges at garment scale, retaining narrow details and fill topology. */
function refineTracedNeckSvg(raw: string): string {
  if (typeof DOMParser === 'undefined') return raw;
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return raw;
  for (const path of doc.querySelectorAll('g[transform="scale(1.0)"] > path[d]')) {
    if (path.closest('defs, mask, clipPath') || path.getAttribute('fill') === 'none') continue;
    const d = path.getAttribute('d')!;
    const sections = svgpath(d).abs().toString().match(/M[^M]+/g);
    if (!sections) continue;
    let changed = false;
    const curves = sections.map(section => {
      if (!/[zZ]$/.test(section)) return section;
      const ring = flattenPathContours(section, 2)[0];
      if (!ring || ring.length < 16 || Math.abs(signedArea(ring)) < 150) return section;
      const curve = garmentOutlineCurve(ring, true);
      if (!curve || curve.includes('NaN')) return section;
      changed = true;
      return curve;
    });
    if (changed) path.setAttribute('d', curves.join(''));
  }
  return new XMLSerializer().serializeToString(doc.documentElement);
}

export function tshirtNeckPackKind(displayName: string): NeckPackKind | undefined {
  const name = displayName.toLowerCase();
  if (/\bdeep\s+v-?neck\b/.test(name)) return 'deep-vneck';
  if (/\bv-?neck\b/.test(name)) return 'vneck';
  if (/\bthin\s+crew\b/.test(name)) return 'thincrew';
  if (/\bscoop\b/.test(name)) return 'scoop';
  if (/\bpolo\b/.test(name)) return 'polo';
  return /\bcrew\b/.test(name) ? 'crew' : undefined;
}

// Each finish falls back to the ribbed geometry for parts it does not redraw.
function candidates(fit: string, kind: NeckPackKind, view: View, finish: Finish, part: Part): string[] {
  const key = (f: Finish) => `${fit}.${kind}.${view}.${f}.${part}`;
  return finish === 'ribbed' ? [key('ribbed')] : [key(finish), key('ribbed')];
}

function needed(view: View, finish: Finish): Part[] {
  return ['body', 'outline', 'stitching', ...(finish === 'raw' ? [] : ['neck' as Part]), ...(view === 'front' ? ['inner' as Part] : [])];
}

function find(fit: string, kind: NeckPackKind, view: View, finish: Finish, part: Part): string | undefined {
  for (const key of candidates(fit, kind, view, finish, part)) {
    const svg = loaded.get(key);
    if (svg) return svg;
  }
  return undefined;
}

/** The regular T-shirt neckline pieces also serve as the hoodie collar master. */
export function tshirtNeckMaster(neckName: string, view: View, finish: Finish) {
  const kind = tshirtNeckPackKind(neckName);
  if (!kind) return undefined;
  const part = (id: Part) => find('regular', kind, view, finish, id);
  const outline = part('outline');
  const body = part('body');
  if (!outline || !body) return undefined;
  return { outline, body, neck: part('neck'), inside: view === 'front' ? part('inner') : undefined };
}

export async function preloadTshirtNeckPack(
  fit: string, neckName: string, view: View, finish: Finish = 'ribbed',
): Promise<boolean> {
  const referenceChanged = fit === 'oversized' ? await preloadOversizedReference(view,neckName) : false;
  if(fit==='oversized')await preloadTshirtNeckPack('regular',neckName,view,finish);
  const kind = tshirtNeckPackKind(neckName);
  if (!kind) return false;
  const keys = needed(view, finish).flatMap(part => {
    const key = candidates(fit, kind, view, finish, part).find(candidate => loaders.has(candidate));
    return key && !loaded.has(key) ? [key] : [];
  });
  await Promise.all(keys.map(key => {
    let task = pending.get(key);
    if (!task) {
      task = loaders.get(key)!().then(svg => {
        loaded.set(key, /\.(neck|inner|outline)$/.test(key) ? refineTracedNeckSvg(svg) : svg);
      }).finally(() => pending.delete(key));
      pending.set(key, task);
    }
    return task;
  }));
  return keys.length > 0 || referenceChanged;
}

/** Returns the layers with the pre-built neck assets applied, or undefined until they have loaded. */
export function withTshirtNeckPack(
  layers: ResolvedGarmentLayer[], fit: string, view: View, finish: NeckFinish = 'ribbed',
): ResolvedGarmentLayer[] | undefined {
  const neck = layers.find(layer => layer.id === 'neck');
  const kind = neck && tshirtNeckPackKind(neck.displayName);
  if (!neck || !kind) return undefined;
  const parts = new Map<Part, string>();
  for (const part of needed(view, finish)) {
    const svg = find(fit, kind, view, finish, part);
    if (svg) parts.set(part, svg);
  }
  if (parts.size !== needed(view, finish).length) return undefined;
  const swap = (layer: ResolvedGarmentLayer, part: Part): ResolvedGarmentLayer => {
    // A raw rear opening has no collar band. Its body silhouette supplies the
    // neckline ink; the traced rear strip would otherwise become a solid black band.
    const svgRaw = part === 'outline' && view === 'back' && finish === 'raw'
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" data-raster-neck="true">'+(parts.get('outline')?.match(/<path[^>]*data-ink-preserve[^>]*\/>/)?.[0]??'').replace('data-ink-preserve','data-shoulder-neck-boundary')+'</svg>'
      : parts.get(part);
    return svgRaw ? { ...layer, assetId: `${layer.assetId}:${view}:${finish}`, svgRaw } : layer;
  };
  const result: ResolvedGarmentLayer[] = [];
  for (const layer of layers) {
    if (layer.id === 'innerBackNeck' && view === 'back') continue;
    if (layer.id === 'neck') {
      if (finish !== 'raw') result.push(swap(layer, 'neck'));
    } else if (layer.id === 'base') result.push(swap(layer, 'body'));
    else if (layer.id === 'innerBackNeck') result.push(swap(layer, 'inner'));
    else if (layer.id === 'outline') result.push(swap(layer, 'outline'));
    else if (layer.id === 'stitching') result.push(swap(layer, 'stitching'));
    else result.push(layer);
  }
  return result;
}
