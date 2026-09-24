import hemGeometry from '../../assets/studio-tshirt/hem-styles.json';
import type { ResolvedGarmentLayer } from './garmentSvgCatalog';
import type { TshirtHemStyles } from './tshirtHemStyles';
import { hemGroupEnabled, resolveHemSettings } from './tshirtHemStyles';
import { constructionColor, getPotraceSvgBBox } from '../lib/tshirtSvgUtils';

export const TSHIRT_STITCH_OPTIONS = [
  { value: 'standard', label: 'Standard Stitch' },
  { value: 'double', label: 'Double Stitch' },
  { value: 'triple', label: 'Triple Stitch' },
  { value: 'zigzag', label: 'Zigzag Stitch' },
  { value: 'overlock', label: 'Overlock Stitch' },
  { value: 'coverstitch', label: 'Coverstitch' },
  { value: 'none', label: 'No Stitching' },
] as const;
export const TSHIRT_STITCH_REGIONS = {
  neckline: 'Neck / collar', sleeve: 'Sleeve hem', bottom: 'Bottom hem',
  shoulder: 'Shoulder', armhole: 'Armhole', side: 'Side seam',
  undersleeve: 'Underlayer cuff',
} as const;
export type StitchRegion = keyof typeof TSHIRT_STITCH_REGIONS;
export type StitchStyle = typeof TSHIRT_STITCH_OPTIONS[number]['value'];
export const STITCH_THREAD_OPTIONS = { fine: 'Fine', regular: 'Regular', heavy: 'Heavy' } as const;
export type StitchSettings = { style?: StitchStyle; color?: string; thread?: keyof typeof STITCH_THREAD_OPTIONS };
export type TshirtStitching = Partial<Record<StitchRegion, StitchSettings>> & { global?: StitchSettings };
export function updateStitchSettings(settings: TshirtStitching, patch: StitchSettings, region: StitchRegion, applyToAll: boolean): TshirtStitching {
  if (!applyToAll) return { ...settings, [region]: { ...resolveStitchSettings(settings, region), ...patch } };
  const global = { style: 'standard' as const, thread: 'regular' as const, ...settings.global, ...patch };
  return { ...settings, global, ...Object.fromEntries(Object.keys(TSHIRT_STITCH_REGIONS).map(key => [key, { ...global }])) };
}
type Point = { x: number; y: number };
type Mark = Point & { tangent: Point };
export type StitchGeometry = { clips: Record<StitchRegion, string>; rows: Record<StitchRegion, Point[][]>; hemClips?: Record<string, { stitchCut: string }> };
const cache = new Map<string, Promise<StitchGeometry>>();
const namespace = 'http://www.w3.org/2000/svg';
const regions = Object.keys(TSHIRT_STITCH_REGIONS) as StitchRegion[];
const emptyRows = (): StitchGeometry['rows'] => ({ sleeve: [], bottom: [], shoulder: [], neckline: [], undersleeve: [], armhole: [], side: [] });
const distance = (first: Point, second: Point) => Math.hypot(first.x - second.x, first.y - second.y);
const colorValue = (value?: string) => /^#[\da-f]{6}$/i.test(value ?? '') ? value! : '#B0B0B0';

export function stitchVariant(layers: ResolvedGarmentLayer[]) {
  if (layers.some(layer => layer.id === 'underSleeveLeft')) return 'layered-long';
  const sleeve = layers.find(layer => layer.id === 'sleeveLeft')?.assetId ?? '';
  return ['longer-short', 'cap', 'long'].find(variant => sleeve.endsWith(`:${variant}`)) ?? 'short';
}

export function stitchRegionClips(layers: ResolvedGarmentLayer[], fit: string): StitchGeometry['clips'] {
  const geometry = (hemGeometry as Record<string, Record<string, { stitchCut: string }>>)[`${fit}:${stitchVariant(layers)}`] ?? {};
  const clips = { sleeve: '', bottom: '', shoulder: '', neckline: '', undersleeve: '', armhole: '', side: '' };
  for (const [id, region] of Object.entries(geometry)) {
    const area = id === 'bodyHem' ? 'bottom' : id.startsWith('underlayer') ? 'undersleeve' : 'sleeve';
    clips[area] += ` ${region.stitchCut}`;
  }
  const neck = layers.find(layer => layer.id === 'neck');
  const bounds = neck && getPotraceSvgBBox(neck.svgRaw);
  if (bounds) {
    const left = bounds.minX * .75 - 12;
    const top = bounds.minY * .75 - 12;
    const right = bounds.maxX * .75 + 12;
    const bottom = bounds.maxY * .75 + 12;
    clips.neckline = `M${left},${top}H${right}V${bottom}H${left}Z`;
  }
  clips.shoulder = `M0,0H1536V1536H0Z ${clips.sleeve} ${clips.bottom} ${clips.undersleeve} ${clips.neckline}`;
  clips.armhole = clips.shoulder;
  clips.side = clips.shoulder;
  return clips;
}

export function availableStitchRegions(geometry: StitchGeometry, hems?: TshirtHemStyles): StitchRegion[] {
  return regions.filter(region => geometry.rows[region].length > 0 && hemGroupEnabled(hems, region));
}

export function resolveStitchSettings(settings: TshirtStitching, region: StitchRegion): StitchSettings {
  return settings[region] ?? settings.global ?? (region === 'armhole' || region === 'side' ? settings.shoulder : undefined) ?? {};
}

export function stitchFocus(geometry: StitchGeometry, region: StitchRegion) {
  const row = [...geometry.rows[region]].sort((first, second) => second.length - first.length)[0];
  if (!row?.length) return { x: 1024, y: 1024, scale: 1 };
  const middle = row[Math.floor(row.length / 2)];
  return { x: middle.x, y: middle.y, scale: 3.4 };
}

export function stitchRegionPath(geometry: StitchGeometry, region: StitchRegion) {
  return geometry.rows[region].map(row => curvePath(row)).join('');
}

function traceRows(marks: Mark[]): Point[][] {
  const edges: { first: number; second: number; length: number }[] = [];
  for (let first = 0; first < marks.length; first++) {
    for (let second = first + 1; second < marks.length; second++) {
      const length = distance(marks[first], marks[second]);
      if (length < 3 || length > 34) continue;
      const direction = { x: (marks[second].x - marks[first].x) / length, y: (marks[second].y - marks[first].y) / length };
      const aligned = [marks[first], marks[second]].every(mark =>
        Math.abs(mark.tangent.x * direction.x + mark.tangent.y * direction.y) > .72);
      if (aligned) edges.push({ first, second, length });
    }
  }
  edges.sort((first, second) => first.length - second.length);
  const neighbors: number[][] = marks.map(() => []);
  for (const edge of edges) {
    const compatible = (source: number, target: number) => neighbors[source].length < 2 && neighbors[source].every(other =>
      (marks[other].x - marks[source].x) * (marks[target].x - marks[source].x) +
      (marks[other].y - marks[source].y) * (marks[target].y - marks[source].y) < 0);
    if (compatible(edge.first, edge.second) && compatible(edge.second, edge.first)) {
      neighbors[edge.first].push(edge.second);
      neighbors[edge.second].push(edge.first);
    }
  }
  const seen = new Set<number>();
  const rows: Point[][] = [];
  const starts = marks.map((_, index) => index).sort((first, second) => neighbors[first].length - neighbors[second].length);
  for (const start of starts) {
    if (seen.has(start)) continue;
    const row: Point[] = [];
    let index: number | undefined = start;
    while (index !== undefined && !seen.has(index)) {
      seen.add(index);
      row.push({ x: marks[index].x, y: marks[index].y });
      index = neighbors[index].find(next => !seen.has(next));
    }
    if (row.length >= 2) rows.push(row);
    else {
      const mark = marks[start];
      rows.push([{ x: mark.x - mark.tangent.x * 4, y: mark.y - mark.tangent.y * 4 },
        { x: mark.x + mark.tangent.x * 4, y: mark.y + mark.tangent.y * 4 }]);
    }
  }
  const merged: Point[][] = [];
  for (const row of rows) {
    const partner = merged.findIndex(other => row.length > 3 && other.length > 3 &&
      Math.min(distance(row[0], other[0]) + distance(row.at(-1)!, other.at(-1)!),
        distance(row[0], other.at(-1)!) + distance(row.at(-1)!, other[0])) < 38);
    if (partner < 0) { merged.push(row); continue; }
    let other = merged[partner];
    if (distance(row[0], other[0]) > distance(row[0], other.at(-1)!)) other = [...other].reverse();
    merged[partner] = row.map((point, index) => {
      const position = index / (row.length - 1) * (other.length - 1);
      const start = other[Math.floor(position)], end = other[Math.ceil(position)];
      const fraction = position % 1;
      return { x: (point.x + start.x + (end.x - start.x) * fraction) / 2,
        y: (point.y + start.y + (end.y - start.y) * fraction) / 2 };
    });
  }
  return merged;
}

export async function measureStitchGeometry(layers: ResolvedGarmentLayer[], fit: string): Promise<StitchGeometry> {
  const source = layers.find(layer => layer.id === 'stitching');
  const clips = stitchRegionClips(layers, fit);
  if (!source) return { clips, rows: emptyRows() };
  const sleeveBounds = layers.filter(layer => layer.id === 'sleeveLeft' || layer.id === 'sleeveRight')
    .map(layer => getPotraceSvgBBox(layer.svgRaw)).filter(bounds => bounds != null);
  const neckLayer = layers.find(layer => layer.id === 'neck');
  const neckBounds = neckLayer && getPotraceSvgBBox(neckLayer.svgRaw);
  const shoulderDepth = neckBounds ? neckBounds.minY + (neckBounds.maxX - neckBounds.minX) / 2 : 0;
  const sleeveTop = Math.max(Math.min(...sleeveBounds.map(bounds => bounds.minY)), shoulderDepth);
  const sleeveBottom = Math.max(...sleeveBounds.map(bounds => bounds.maxY));
  const key = source.svgRaw + JSON.stringify(clips) + sleeveTop + ':' + sleeveBottom;
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = (async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1536;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source.svgRaw)}`;
    await image.decode();
    context.drawImage(image, 0, 0, 1536, 1536);
    const pixels = context.getImageData(0, 0, 1536, 1536).data;
    const visited = new Uint8Array(1536 * 1536);
    const masks = Object.fromEntries(regions.map(region => [region, new Path2D(clips[region])])) as Record<StitchRegion, Path2D>;
    const marks: Record<StitchRegion, Mark[]> = { sleeve: [], bottom: [], shoulder: [], neckline: [], undersleeve: [], armhole: [], side: [] };
    for (let seed = 0; seed < visited.length; seed++) {
      if (visited[seed] || pixels[seed * 4 + 3] < 80) continue;
      const queue = [seed];
      visited[seed] = 1;
      let sumX = 0, sumY = 0, squareX = 0, squareY = 0, product = 0;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const offset = queue[cursor];
        const column = offset % 1536;
        const row = Math.floor(offset / 1536);
        sumX += column; sumY += row; squareX += column * column; squareY += row * row; product += column * row;
        for (const deltaY of [-1, 0, 1]) for (const deltaX of [-1, 0, 1]) {
          const nextX = column + deltaX, nextY = row + deltaY;
          const next = nextY * 1536 + nextX;
          if (nextX < 0 || nextX >= 1536 || nextY < 0 || nextY >= 1536 || visited[next] || pixels[next * 4 + 3] < 80) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
      if (queue.length < 3) continue;
      const centerX = sumX / queue.length, centerY = sumY / queue.length;
      const angle = .5 * Math.atan2(2 * (product / queue.length - centerX * centerY),
        squareX / queue.length - centerX * centerX - squareY / queue.length + centerY * centerY);
      const region = (['undersleeve', 'sleeve', 'bottom', 'neckline'] as StitchRegion[])
        .find(area => context.isPointInPath(masks[area], centerX, centerY, 'evenodd')) ??
        (centerY / .75 > sleeveBottom ? 'side' : centerY / .75 >= sleeveTop ? 'armhole' : 'shoulder');
      marks[region].push({ x: centerX / .75, y: centerY / .75, tangent: { x: Math.cos(angle), y: Math.sin(angle) } });
    }
    const rows = Object.fromEntries(regions.map(region => [region, traceRows(marks[region])])) as StitchGeometry['rows'];
    return { clips, rows };
  })();
  cache.set(key, pending);
  if (cache.size > 24) cache.delete(cache.keys().next().value!);
  pending.catch(() => cache.delete(key));
  return pending;
}

function curvePath(points: Point[]): string {
  points = points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return point;
    const before = points[index - 1], after = points[index + 1];
    const incoming = distance(before, point), outgoing = distance(point, after);
    const alignment = ((point.x - before.x) * (after.x - point.x) +
      (point.y - before.y) * (after.y - point.y)) / (incoming * outgoing || 1);
    if (alignment < .8) return point;
    const shiftX = (before.x + after.x - 2 * point.x) / 4;
    const shiftY = (before.y + after.y - 2 * point.y) / 4;
    const weight = Math.min(1, 2 / (Math.hypot(shiftX, shiftY) || 1));
    return { x: point.x + shiftX * weight, y: point.y + shiftY * weight };
  });
  let path = `M${points[0].x},${points[0].y}`;
  for (let index = 0; index < points.length - 1; index++) {
    const before = points[Math.max(0, index - 1)];
    const start = points[index], end = points[index + 1];
    const after = points[Math.min(points.length - 1, index + 2)];
    path += `C${start.x + (end.x - before.x) / 6},${start.y + (end.y - before.y) / 6} ${end.x - (after.x - start.x) / 6},${end.y - (after.y - start.y) / 6} ${end.x},${end.y}`;
  }
  return path;
}

export function stitchPatternPath(points: Point[], style: StitchStyle): string {
  if (points.length < 2 || style === 'none') return '';
  const curve = document.createElementNS(namespace, 'path');
  curve.setAttribute('d', curvePath(points));
  const length = curve.getTotalLength();
  if (length < .1) return '';
  const at = (along: number, offset: number) => {
    const position = curve.getPointAtLength(Math.max(0, Math.min(length, along)));
    const before = curve.getPointAtLength(Math.max(0, along - .5));
    const after = curve.getPointAtLength(Math.min(length, along + .5));
    const magnitude = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    return `${(position.x - (after.y - before.y) / magnitude * offset).toFixed(2)},${(position.y + (after.x - before.x) / magnitude * offset).toFixed(2)}`;
  };
  const line = (offset: number, dashed: boolean) => {
    let path = '';
    const count = dashed ? Math.max(1, Math.floor((length + 9) / 18)) : 1;
    const dashLength = dashed ? Math.min(9, length) : length;
    const margin = dashed ? (length - (count * dashLength + (count - 1) * 9)) / 2 : 0;
    for (let index = 0; index < count; index++) {
      const along = margin + index * (dashLength + 9);
      const end = along + dashLength;
      path += `M${at(along, offset)}`;
      for (let step = along + 2; step < end; step += 2) path += `L${at(step, offset)}`;
      path += `L${at(end, offset)}`;
    }
    return path;
  };
  if (style === 'standard') return line(0, true);
  if (style === 'double') return line(-2.8, true) + line(2.8, true);
  if (style === 'triple') return line(-4, true) + line(0, true) + line(4, true);
  const count = Math.max(1, Math.floor(length / 20));
  const pitch = length / count;
  if (style === 'zigzag') {
    let path = `M${at(0, -3)}`;
    for (let index = 1; index <= count * 2; index++) path += `L${at(index * pitch / 2, index % 2 ? 3 : -3)}`;
    return path;
  }
  if (style === 'coverstitch') return line(-3, false) + line(3, false);
  let path = line(-3, false);
  for (let index = 0; index < count; index++) {
    const along = index * pitch;
    path += `M${at(along + pitch * .2, -3)}L${at(along + pitch * .65, 3)}L${at(along + pitch * .8, -3)}`;
  }
  return path;
}

export function renderStitchStyles(source: ResolvedGarmentLayer, geometry: StitchGeometry, settings: TshirtStitching, hems?: TshirtHemStyles, fabricColors?: Record<string, string>, prefix = ''): string {
  const groups = regions.map(region => {
    if (!hemGroupEnabled(hems, region)) return '';
    const resolved = resolveStitchSettings(settings, region);
    const style = resolved.style ?? 'standard';
    if (style === 'none') return '';
    const width = { fine: 2.1, regular: 2.7, heavy: 3.4 }[resolved.thread ?? 'regular'];
    const path = geometry.rows[region].map(row => stitchPatternPath(row, style)).join('');
    const physical = Object.entries(geometry.hemClips ?? {}).filter(([id]) =>
      (id === 'bodyHem' ? 'bottom' : id.startsWith('underlayer') ? 'undersleeve' : 'sleeve') === region);
    const parts = physical.length ? physical.map(([id, clip]) => ({ id, clip: clip.stitchCut, hem: resolveHemSettings(hems, id) }))
      : [{ id: region, clip: geometry.clips[region], hem: undefined }];
    return parts.map(part => {
      if (part.hem?.finish === 'none') return '';
      const selectedColor = colorValue(part.hem?.stitchColor || resolved.color || source.tint);
      const fabric = fabricColors?.[part.id] ?? fabricColors?.[region] ?? fabricColors?.base;
      const color = fabric ? constructionColor(fabric, selectedColor) : selectedColor;
      const clipId = `${prefix}stitch-region-${part.id}`;
      const content = `<path d="${path}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
      return `<defs><clipPath id="${clipId}"><path transform="scale(1.333333333333)" clip-rule="evenodd" d="${part.clip}"/></clipPath></defs><g data-stitch-region="${region}" data-hem-stitch="${part.id}" data-stitch-style="${style}" clip-path="url(#${clipId})">${content}</g>`;
    }).join('');
  }).join('');
  return `<svg xmlns="${namespace}" width="2048" height="2048" viewBox="0 0 2048 2048" pointer-events="none" aria-hidden="true">${groups}</svg>`;
}