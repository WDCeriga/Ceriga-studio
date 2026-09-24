import type { ResolvedGarmentLayer } from './garmentSvgCatalog';
import { rearCollarProfile } from './tshirtBackView';
import { getPotraceSvgBBox } from '../lib/tshirtSvgUtils';

export type NeckFinish = 'ribbed' | 'clean' | 'raw';
export const NECK_FINISH_OPTIONS = [
  { value: 'ribbed', label: 'Ribbed' },
  { value: 'clean', label: 'No rib / clean band' },
  { value: 'raw', label: 'No neck / raw finish' },
] as const;

const namespace = 'http://www.w3.org/2000/svg';
const cache = new Map<string, { outline: string; neck: string; stitching?: string; cutout?: { path: string; transform: string; id: string } }>();

function clearNeckArea(source: string, path: string, transform: string, id: string, padding = 110) {
  const mask = `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:luminance"><rect width="2048" height="2048" fill="white"/><path transform="${transform}" d="${path}" fill="black" fill-rule="evenodd" stroke="black" stroke-width="${padding}" stroke-linejoin="round"/></mask></defs>`;
  return source.replace(/(<svg[^>]*>)/, `$1${mask}<g mask="url(#${id})">`).replace(/<\/svg>\s*$/, '</g></svg>');
}

export function withTshirtNeckFinish(layers: ResolvedGarmentLayer[], finish?: NeckFinish): ResolvedGarmentLayer[] {
  if (!finish || finish === 'ribbed' || typeof document === 'undefined') return layers;
  const neck = layers.find(layer => layer.id === 'neck');
  const outline = layers.find(layer => layer.id === 'outline');
  const stitching = layers.find(layer => layer.id === 'stitching');
  if (!neck || !outline) return layers;
  const raw = finish === 'raw';
  const key = `${finish}:${neck.svgRaw}:${outline.svgRaw}:${stitching?.svgRaw}`;
  let result = cache.get(key);
  if (!result) {
    const parsed = new DOMParser().parseFromString(neck.svgRaw, 'image/svg+xml');
    const group = parsed.querySelector('g[transform]');
    if (!group) return layers;
    const transform = group.getAttribute('transform')!;
    const paths = Array.from(group.querySelectorAll('path')).filter(path => !path.closest('defs'));
    const band = paths.map(path => path.getAttribute('d') ?? '').join(' ');
    const bounds = getPotraceSvgBBox(neck.svgRaw);
    if (!bounds) return layers;
    const original = new DOMParser().parseFromString(outline.svgRaw, 'image/svg+xml');
    const rearEdge = original.querySelector('[data-rear-collar-outline]');
    const profile = rearEdge ? undefined : rearCollarProfile(neck, bounds.minX, bounds.maxX, outline);
    const edgeWidth = rearEdge ? Number(rearEdge.getAttribute('stroke-width')) * 10 : profile!.collarWeight * 10;
    const ribWidth = (profile?.ribWidth ?? 1.8) * 10;
    const ribPitch = (profile?.ribPitch ?? 7) * 10;
    const mounted = document.createElementNS(namespace, 'svg');
    mounted.style.cssText = 'position:fixed;left:-10000px;visibility:hidden';
    document.body.append(mounted);
    let border = band;
    let ribs = '';
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
      const opening = contours[1] ?? contours[0];
      if (raw) border = contours[0]?.data ?? band;
      if (finish === 'ribbed' && opening) {
        const fabric = document.createElementNS(namespace, 'path');
        fabric.setAttribute('d', band);
        fabric.setAttribute('fill-rule', 'evenodd');
        mounted.append(fabric);
        const length = opening.probe.getTotalLength();
        for (let distance = 0; distance < length; distance += ribPitch) {
          const point = opening.probe.getPointAtLength(distance);
          const before = opening.probe.getPointAtLength(Math.max(0, distance - 12));
          const after = opening.probe.getPointAtLength(Math.min(length, distance + 12));
          const magnitude = Math.hypot(after.x - before.x, after.y - before.y) || 1;
          const normalX = -(after.y - before.y) / magnitude;
          const normalY = (after.x - before.x) / magnitude;
          for (const direction of [-1, 1]) {
            let start: DOMPoint | undefined;
            let end: DOMPoint | undefined;
            for (let offset = 8; offset <= 1400; offset += 12) {
              const sample = new DOMPoint(point.x + normalX * offset * direction, point.y + normalY * offset * direction);
              if (!fabric.isPointInFill(sample)) {
                if (start || offset > 32) break;
                continue;
              }
              start ??= sample;
              end = sample;
            }
            if (start && end) ribs += `M${start.x},${start.y}L${end.x},${end.y}`;
          }
        }
      }
    } finally { mounted.remove(); }
    let geometryId = 0;
    for (let index = 0; index < band.length; index++) geometryId = (Math.imul(geometryId, 31) + band.charCodeAt(index)) | 0;
    const id = `neck-finish-${neck.assetId.replace(/[^a-z0-9]/gi, '-')}-${finish}-${geometryId >>> 0}`;
    const clear = (source: string, suffix: string) => clearNeckArea(source, raw ? border : band, transform, `${id}-${suffix}`);
    const clip = `<defs><clipPath id="${id}-band"><path transform="${transform}" d="${band}" clip-rule="evenodd"/></clipPath></defs>`;
    const ribbing = ribs ? `<g clip-path="url(#${id}-band)"><path data-neck-ribbing="true" transform="${transform}" d="${ribs}" fill="none" stroke="#141414" stroke-width="${ribWidth}"/></g>` : '';
    const edge = `<path data-neck-edge="true" transform="${transform}" d="${border}" fill="none" stroke="#141414" stroke-width="${edgeWidth}" stroke-linejoin="round"/>`;
    result = {
      outline: clear(outline.svgRaw, 'outline').replace(/<\/svg>\s*$/, `${clip}<g data-neck-finish="${finish}">${ribbing}${edge}</g></svg>`),
      neck: neck.svgRaw.replace('<svg ', `<svg data-neck-finish="${raw ? 'raw' : finish}" `),
      stitching: raw && stitching ? clear(stitching.svgRaw, 'stitching') : stitching?.svgRaw,
      cutout: raw ? { path: border, transform, id } : undefined,
    };
    if (cache.size >= 48) cache.clear();
    cache.set(key, result);
  }
  return layers.filter(layer => !raw || !['neck', 'innerBackNeck'].includes(layer.id)).map(layer => layer.id === 'neck' ? { ...layer, svgRaw: result!.neck }
    : layer.id === 'outline' ? { ...layer, svgRaw: result!.outline }
    : layer.id === 'stitching' && result!.stitching ? { ...layer, svgRaw: result!.stitching }
    : result!.cutout ? { ...layer, svgRaw: clearNeckArea(layer.svgRaw, result!.cutout.path, result!.cutout.transform, `${result!.cutout.id}-${layer.id}`, 0) } : layer);
}