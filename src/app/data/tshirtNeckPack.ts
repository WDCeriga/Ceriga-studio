import type { ResolvedGarmentLayer } from './garmentSvgCatalog';
import type { NeckFinish } from './tshirtNeckFinish';

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

export async function preloadTshirtNeckPack(
  fit: string, neckName: string, view: View, finish: Finish = 'ribbed',
): Promise<boolean> {
  const kind = tshirtNeckPackKind(neckName);
  if (!kind) return false;
  const keys = needed(view, finish).flatMap(part => {
    const key = candidates(fit, kind, view, finish, part).find(candidate => loaders.has(candidate));
    return key && !loaded.has(key) ? [key] : [];
  });
  await Promise.all(keys.map(key => {
    let task = pending.get(key);
    if (!task) {
      task = loaders.get(key)!().then(svg => { loaded.set(key, svg); }).finally(() => pending.delete(key));
      pending.set(key, task);
    }
    return task;
  }));
  return keys.length > 0;
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
    const svgRaw = parts.get(part);
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
