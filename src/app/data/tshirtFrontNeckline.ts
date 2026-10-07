import type { ResolvedGarmentLayer } from './garmentSvgCatalog';
import type { NeckFinish } from './tshirtNeckFinish';
import { getPotraceSvgBBox } from '../lib/tshirtSvgUtils';

const namespace = 'http://www.w3.org/2000/svg';
const cache = new Map<string, ResolvedGarmentLayer[]>();
const n = (value: number) => Number(value.toFixed(3));
type Point = { x: number; y: number };
const line = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${n(p.x)},${n(p.y)}`).join('');
const svg = (content: string) => `<svg xmlns="${namespace}" width="2048" height="2048" viewBox="0 0 2048 2048">${content}</svg>`;
const local = (points: Point[]) => points.map(p => ({ x: p.x * 10, y: (2048 - p.y) * 10 }));

/** One front opening, shared by the body cut, finish, construction ink and zip contours. */
export function withTshirtFrontNeckline(layers: ResolvedGarmentLayer[], finish: NeckFinish): ResolvedGarmentLayer[] {
  const neck = layers.find(layer => layer.id === 'neck');
  const base = layers.find(layer => layer.id === 'base');
  if (!neck || !base || typeof document === 'undefined' || neck.assetId.endsWith(':back') ||
    !/^(crew neck|thin crew neck|deep v-neck|v-neck|scoop neck)( \(.+\))?$/i.test(neck.displayName)) return layers;
  const key = `${finish}:${layers.map(layer => `${layer.id}:${layer.svgRaw}:${layer.tint}`).join('|')}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const bounds = getPotraceSvgBBox(neck.svgRaw);
  if (!bounds) return layers;
  const left = bounds.minX, right = bounds.maxX, top = bounds.minY + 3, bottom = bounds.maxY;
  const center = (left + right) / 2;
  const v = /v-neck/i.test(neck.displayName);
  const thin = /thin/i.test(neck.displayName);
  const width = finish === 'raw' ? 0 : finish === 'clean' ? 12 : thin ? 16 : 30;
  const segments = 128;
  const outer: Point[] = Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    if (v) return { x: left + (right - left) * t, y: top + (bottom - top) * (1 - Math.abs(2 * t - 1)) };
    // Two cubic quarters keep a rounded bottom and naturally upright shoulder ends.
    const side = t <= .5 ? -1 : 1;
    const u = t <= .5 ? t * 2 : (1 - t) * 2;
    const half = (right - left) / 2;
    return { x: center + side * half * (1 - 3 * u * u + 2 * u * u * u),
      y: top + (bottom - top) * (1 - (1 - u) ** 3) };
  });
  const inner = outer.map((p, i) => {
    const before = outer[Math.max(0, i - 1)], after = outer[Math.min(segments, i + 1)];
    const dx = after.x - before.x, dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    // Miter the V point rather than leaving two offset ends or a flat cap.
    if (v && i === segments / 2) return { x: p.x, y: p.y - width * Math.hypot(1, (bottom - top) / ((right - left) / 2)) };
    return { x: p.x + width * dy / length, y: p.y - width * dx / length };
  });
  const regionLeft = left - 18, regionRight = right + 18, regionBottom = bottom + 24;
  const mounted = document.importNode(new DOMParser().parseFromString(base.svgRaw, 'image/svg+xml').documentElement, true);
  mounted.setAttribute('style', 'position:fixed;left:-10000px;visibility:hidden');
  document.body.append(mounted);
  let shoulderLeft = top, shoulderRight = top;
  try {
    const paths = Array.from(mounted.querySelectorAll<SVGPathElement>('g[transform] > path'));
    const shoulder = (x: number) => {
      let y = Math.max(0, top - 80);
      while (y < top + 120 && !paths.some(path => path.isPointInFill(new DOMPoint(x * 10, (2048 - y) * 10)))) y += .25;
      return y;
    };
    shoulderLeft = shoulder(regionLeft); shoulderRight = shoulder(regionRight);
  } finally { mounted.remove(); }
  const bodyTop = [{ x: regionLeft, y: shoulderLeft }, ...outer, { x: regionRight, y: shoulderRight }];
  const patch = [...bodyTop, { x: regionRight, y: regionBottom }, { x: regionLeft, y: regionBottom }];
  const cut = `M${regionLeft},0H${regionRight}V${regionBottom}H${regionLeft}Z`;
  let hash = 0;
  for (const char of neck.assetId + finish) hash = Math.imul(hash, 31) + char.charCodeAt(0) | 0;
  const prefix = `front-neck-${hash >>> 0}`;
  const clear = (raw: string, id: string) => raw.replace(/(<svg[^>]*>)/, `$1<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:luminance"><rect width="2048" height="2048" fill="white"/><path d="${cut}" fill="black"/></mask></defs><g mask="url(#${id})">`).replace(/<\/svg>\s*$/, '</g></svg>');
  const append = (raw: string, content: string) => raw.replace(/<\/svg>\s*$/, `${content}</svg>`);
  const band = [...outer, ...inner.slice().reverse()];
  const shoulderInk = `M${regionLeft},${shoulderLeft}L${left},${top}M${right},${top}L${regionRight},${shoulderRight}`;
  const ribs = finish === 'ribbed' ? outer.filter((_, i) => i > 0 && i < segments && i % 4 === 0).map(p => {
    const i = outer.indexOf(p);
    return `M${n(p.x)},${n(p.y)}L${n(inner[i].x)},${n(inner[i].y)}`;
  }).join('') : '';
  const construction = `<g data-construction="neckline" data-neck-finish="${finish}" fill="none" stroke="#000000" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"${finish === 'raw' ? ' data-fixed-ink="true"' : ''}><path data-neckline-opening="${finish}" d="${line(finish === 'raw' ? outer : inner)}"/><path data-neckline-shoulders="true" d="${shoulderInk}"/>${width ? `<path data-neckline-seam="true" d="${line(outer)}M${n(outer[0].x)},${n(outer[0].y)}L${n(inner[0].x)},${n(inner[0].y)}M${n(outer[segments].x)},${n(outer[segments].y)}L${n(inner[segments].x)},${n(inner[segments].y)}"/>` : ''}${ribs ? `<path data-neckline-ribs="true" d="${ribs}" stroke-width="1.2"/>` : ''}</g>`;
  const result = layers.filter(layer => layer.id !== 'innerBackNeck' && !(finish === 'raw' && layer.id === 'neck')).map(layer => {
    if (layer.id === 'base') return { ...layer, svgRaw: append(clear(layer.svgRaw, `${prefix}-body`), `<g transform="translate(0,2048) scale(0.1,-0.1)" data-shared-fabric="true" fill="#000000"><path data-front-neck-body="true" d="${line(local(patch))}Z"/></g>`) };
    if (layer.id === 'neck') return { ...layer, svgRaw: svg(`<g transform="translate(0,2048) scale(0.1,-0.1)" fill="#000000"><path data-neckline-band="${finish}" d="${line(local(band))}Z"/></g>`) };
    if (layer.id === 'outline') return { ...layer, svgRaw: append(clear(layer.svgRaw, `${prefix}-ink`), construction) };
    if (layer.id === 'stitching') return { ...layer, svgRaw: clear(layer.svgRaw, `${prefix}-stitch`) };
    return layer;
  });
  cache.set(key, result);
  if (cache.size > 48) cache.delete(cache.keys().next().value!);
  return result;
}
