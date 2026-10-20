import type { ResolvedGarmentLayer } from './garmentSvgCatalog';
import { rearCollarProfile } from './tshirtBackView';
import { getPotraceSvgBBox } from '../lib/tshirtSvgUtils';

export type NeckFinish = 'ribbed' | 'clean' | 'raw';
export const NECK_FINISH_OPTIONS = [
  { value: 'ribbed', label: 'Ribbed' },
  { value: 'clean', label: 'No ribbing' },
  { value: 'raw', label: 'No neck' },
] as const;

const namespace = 'http://www.w3.org/2000/svg';
const cache = new Map<string, { outline: string; neck: string; stitching?: string; cutout?: { path: string; transform: string; id: string } }>();
const pending = new Map<string, Promise<boolean>>();

function neckFinishContext(layers: ResolvedGarmentLayer[], finish?: NeckFinish) {
  if (!finish || finish === 'ribbed' || typeof document === 'undefined') return undefined;
  const neck = layers.find(layer => layer.id === 'neck');
  const outline = layers.find(layer => layer.id === 'outline');
  const stitching = layers.find(layer => layer.id === 'stitching');
  const base = layers.find(layer => layer.id === 'base');
  if (!neck || !outline || !base || (finish === 'raw' && /polo/i.test(neck.displayName))) return undefined;
  const key = `${finish}:${neck.svgRaw}:${outline.svgRaw}:${base.svgRaw}:${stitching?.svgRaw}`;
  const raw = finish === 'raw';
  if (cache.has(key)) return { neck, outline, stitching, base, rearEdge: undefined, raw, key };
  const original = new DOMParser().parseFromString(outline.svgRaw, 'image/svg+xml');
  const rearEdge = original.querySelector('[data-rear-collar-outline]');
  if (!rearEdge && !rearCollarProfile(neck, 0, 0, outline)) return undefined;
  return { neck, outline, stitching, base, rearEdge, raw, key };
}

function applyNeckFinish(layers: ResolvedGarmentLayer[], result: NonNullable<ReturnType<typeof cache.get>>, raw: boolean) {
  return layers.filter(layer => !raw || layer.id !== 'neck').map(layer => layer.id === 'neck' ? { ...layer, svgRaw: result.neck }
    : layer.id === 'outline' ? { ...layer, svgRaw: result.outline }
    : layer.id === 'stitching' && result.stitching ? { ...layer, svgRaw: result.stitching }
    : layer.id === 'innerBackNeck' ? layer
    : result.cutout ? { ...layer, svgRaw: clearNeckArea(layer.svgRaw, result.cutout.path, result.cutout.transform, `${result.cutout.id}-${layer.id}`, 0) } : layer);
}

function clearNeckArea(source: string, path: string, transform: string, id: string, padding = 110) {
  const mask = `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:luminance"><rect width="2048" height="2048" fill="white"/><path transform="${transform}" d="${path}" fill="black" fill-rule="evenodd" stroke="black" stroke-width="${padding}" stroke-linejoin="round"/></mask></defs>`;
  return source.replace(/(<svg[^>]*>)/, `$1${mask}<g mask="url(#${id})">`).replace(/<\/svg>\s*$/, '</g></svg>');
}

export function withTshirtNeckFinish(layers: ResolvedGarmentLayer[], finish?: NeckFinish): ResolvedGarmentLayer[] {
  const context = neckFinishContext(layers, finish);
  if (!context) return layers;
  const result = cache.get(context.key);
  return result ? applyNeckFinish(layers, result, context.raw) : layers;
}

export async function prepareTshirtNeckFinish(layers: ResolvedGarmentLayer[], finish?: NeckFinish): Promise<boolean> {
  const context = neckFinishContext(layers, finish);
  if (!context || cache.has(context.key)) return false;
  const existing = pending.get(context.key);
  if (existing) return existing;
  const task = prepareNeckFinish(context, finish!).finally(() => pending.delete(context.key));
  pending.set(context.key, task);
  return task;
}

async function prepareNeckFinish(
  context: NonNullable<ReturnType<typeof neckFinishContext>>,
  finish: NeckFinish,
): Promise<boolean> {
  const { neck, outline, stitching, base, rearEdge, raw, key } = context;
  let nextYieldAt = performance.now() + 8;
  const yieldForPaint = async () => {
    if (performance.now() < nextYieldAt) return;
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    nextYieldAt = performance.now() + 8;
  };
  const existing = cache.get(key);
  if (existing) return false;
  {
    const parsed = new DOMParser().parseFromString(neck.svgRaw, 'image/svg+xml');
    const group = parsed.querySelector('g[transform]');
    if (!group) return false;
    const transform = group.getAttribute('transform')!;
    const paths = Array.from(group.querySelectorAll('path')).filter(path => !path.closest('defs'));
    const band = paths.map(path => path.getAttribute('d') ?? '').join(' ');
    const bounds = getPotraceSvgBBox(neck.svgRaw);
    if (!bounds) return false;
    const profile = rearEdge ? undefined : rearCollarProfile(neck, bounds.minX, bounds.maxX, outline);
    if (!rearEdge && !profile) return false;
    const edgeWidth = rearEdge ? Number(rearEdge.getAttribute('stroke-width')) * 10 : profile!.collarWeight * 10;
    const mounted = document.createElementNS(namespace, 'svg');
    mounted.style.cssText = 'position:fixed;left:-10000px;visibility:hidden';
    document.body.append(mounted);
    let border = band;
    let joins = '';
    let openArea = '';
    let lowerEdge = '';
    try {
      const contours = paths.flatMap(path => {
        const data = path.getAttribute('d') ?? '';
        return /m/.test(data) ? [data] : data.match(/M[^M]*/g) ?? [];
      }).map(data => {
        const probe = document.createElementNS(namespace, 'path');
        probe.setAttribute('d', data);
        mounted.append(probe);
        const bounds = probe.getBBox();
        return { data, probe, area: bounds.width * bounds.height };
      }).sort((first, second) => second.area - first.area);
      if (raw) border = contours[0]?.data ?? band;
      if (raw && contours.length) {
        const probe = contours[0].probe;
        const length = probe.getTotalLength();
        const count = Math.ceil(length / 8);
        const points: DOMPoint[] = [];
        for (let index = 0; index < count; index++) {
          points.push(probe.getPointAtLength(index * length / count));
          await yieldForPaint();
        }
        const center = (bounds.minX + bounds.maxX) * 5;
        const corner = (left: boolean) => points.reduce((best, point, index) =>
          (left ? point.x < center : point.x >= center) && (best < 0 || point.y > points[best].y) ? index : best, -1);
        const left = corner(true);
        const right = corner(false);
        const arc = (start: number, stop: number) => Array.from({ length: (stop - start + count) % count + 1 }, (_, index) => points[(start + index) % count]);
        const candidates = [arc(left, right), arc(right, left)];
        const lower = candidates.sort((first, second) => first.reduce((sum, point) => sum + point.y, 0) / first.length - second.reduce((sum, point) => sum + point.y, 0) / second.length)[0];
        lowerEdge = lower.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join('');
        openArea = `${lowerEdge}L${lower[lower.length - 1].x},20480L${lower[0].x},20480Z`;
      }
      if (!raw && contours.length === 2 && !rearEdge) {
        const center = (bounds.minX + bounds.maxX) * 5;
        const corners: DOMPoint[][] = [];
        for (const contour of contours) {
          const length = contour.probe.getTotalLength();
          const points: DOMPoint[] = [];
          for (let index = 0; index < Math.ceil(length / 8); index++) {
            points.push(contour.probe.getPointAtLength(index * 8));
            await yieldForPaint();
          }
          corners.push([points.filter(point => point.x < center), points.filter(point => point.x >= center)]
            .map(side => side.reduce((highest, point) => point.y > highest.y ? point : highest)));
        }
        joins = corners[0].map((point, index) => `M${point.x},${point.y}L${corners[1][index].x},${corners[1][index].y}`).join('');
      }
    } finally { mounted.remove(); }
    let geometryId = 0;
    for (let index = 0; index < band.length; index++) geometryId = (Math.imul(geometryId, 31) + band.charCodeAt(index)) | 0;
    const id = `neck-finish-${neck.assetId.replace(/[^a-z0-9]/gi, '-')}-${finish}-${geometryId >>> 0}`;
    const clear = (source: string, suffix: string) => clearNeckArea(source, raw ? border : band, transform, `${id}-${suffix}`);
    const body = new DOMParser().parseFromString(base.svgRaw, 'image/svg+xml');
    const bodyPath = Array.from(body.querySelectorAll('g[transform] > path')).map(path => path.getAttribute('d') ?? '').join(' ');
    const neckRegion = `M${bounds.minX - 20},${bounds.minY - 20}H${bounds.maxX + 20}V${bounds.maxY + 20}H${bounds.minX - 20}Z`;
    const retainedInk = raw
      ? `<rect width="2048" height="2048" fill="white"/><path transform="${transform}" d="${openArea}" fill="black"/><path transform="${transform}" d="${lowerEdge}" fill="none" stroke="white" stroke-width="${edgeWidth * 2}"/>`
      : `<rect width="2048" height="2048" fill="white"/><path transform="${transform}" d="${band}" fill="black" fill-rule="evenodd"/><path transform="${transform}" d="${band}" fill="none" stroke="white" stroke-width="${edgeWidth * 2}"/><path transform="${transform}" d="${bodyPath}" fill="none" stroke="white" stroke-width="${edgeWidth * 2}"/><path transform="${transform}" d="${joins}" fill="none" stroke="white" stroke-width="${edgeWidth}"/>`;
    const bodyMask = raw ? `<mask id="${id}-body-ink" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:luminance"><path d="M0,0H2048V2048H0Z ${neckRegion}" fill="white" fill-rule="evenodd"/><path transform="${transform}" d="${bodyPath}" fill="white" stroke="white" stroke-width="${edgeWidth * 2}"/></mask>` : '';
    const inkMask = `<defs><mask id="${id}-source-ink" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:luminance">${retainedInk}</mask>${bodyMask}</defs>`;
    const bodyClip = raw ? ` mask="url(#${id}-body-ink)"` : '';
    const result = {
      outline: outline.svgRaw.replace(/(<svg[^>]*>)/, `$1${inkMask}<g${bodyClip}><g data-neck-finish="${finish}" mask="url(#${id}-source-ink)">`).replace(/<\/svg>\s*$/, '</g></g></svg>'),
      neck: neck.svgRaw.replace('<svg ', `<svg data-neck-finish="${raw ? 'raw' : finish}" `),
      stitching: raw && stitching ? clear(stitching.svgRaw, 'stitching') : stitching?.svgRaw,
      cutout: raw ? { path: border, transform, id } : undefined,
    };
    if (cache.size >= 48) cache.clear();
    cache.set(key, result);
  }
  return true;
}