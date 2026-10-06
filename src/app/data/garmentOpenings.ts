import polygonClipping, { type MultiPolygon, type Ring } from 'polygon-clipping';
import svgpath from 'svgpath';
import { detailPlacement, detailRotation, type DetailBounds, type GarmentDetail } from './garmentDetails';

export type OpeningPlacement = 'neckline' | 'shoulder' | 'side-seam' | 'hem' | 'full-front' | 'free';
export type OpeningPoint = { x: number; y: number };
export interface OpeningDefaults {
  start: OpeningPoint; end: OpeningPoint; width: number; attachment: OpeningPlacement; facingColor: string;
}
export interface GarmentOpening extends OpeningDefaults {
  version: 1;
  closure: 'zip';
  defaults: OpeningDefaults;
}
export interface OpeningSource {
  id: string;
  raw: string;
  role: 'body' | 'neck' | 'hem';
  matrix?: DOMMatrix;
}
export interface OpeningGeometry {
  version: 1;
  panels: { id: string; role: OpeningSource['role']; polygons: MultiPolygon }[];
  fabric: MultiPolygon;
  unavailableReason?: string;
}
export interface OpeningConstructionGeometry {
  removed: MultiPolygon;
  inkCut: MultiPolygon;
  remaining: MultiPolygon;
  facing: MultiPolygon;
  panels: Record<string, MultiPolygon>;
  active: GarmentDetail[];
}
const rawCache = new Map<string, MultiPolygon>();
const compiledGeometryCache: { sources: { id: string; role: OpeningSource['role']; raw: string; matrix: number[] }[]; geometry: OpeningGeometry }[] = [];
const constructionCache = new WeakMap<OpeningGeometry, WeakMap<GarmentDetail, { signature: string; result: OpeningConstructionGeometry }>>();
const precision = (value: number) => Math.round(value * 1000) / 1000;
const distance = (a: OpeningPoint, b: OpeningPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const finite = (point: OpeningPoint | null | undefined) => Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
export const openingArea = (polygons: MultiPolygon) => polygons.reduce((sum, polygon) => sum + polygon.reduce((area, ring, index) => {
  const value = Math.abs(ring.reduce((total, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return total + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2;
  return area + (index ? -value : value);
}, 0), 0);

/** Flatten source curves after their SVG transforms, not bounding boxes or a guessed neck. */
export function openingSourcePolygons(raw: string): MultiPolygon {
  const cached = rawCache.get(raw);
  if (cached) return cached;
  const parsed = new DOMParser().parseFromString(raw, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) return [];
  const root = parsed.documentElement;
  const viewBox = (root.getAttribute('viewBox') ?? '0 0 2048 2048').split(/[\s,]+/).map(Number);
  const viewport = new DOMMatrix().scale(2048 / viewBox[2], 2048 / viewBox[3]).translate(-viewBox[0], -viewBox[1]);
  let result: MultiPolygon = [];
  for (const element of root.querySelectorAll('path[d]')) {
    if (element.closest('defs, clipPath, mask') || element.getAttribute('fill') === 'none' || element.closest('[data-construction], [data-topology="attachmentInk"], [data-topology="innerBoundary"]')) continue;
    const ancestors: Element[] = [];
    for (let parent: Element | null = element; parent && parent !== root; parent = parent.parentElement) ancestors.unshift(parent);
    // Separate construction groups are not fabric; keep only the source's filled material.
    const fill = [...ancestors].reverse().map(parent => parent.getAttribute('fill')).find(Boolean);
    if (fill === 'none' || (fill && !['#000000', '#000', 'black', '#ffffff', '#fff', 'white'].includes(fill.toLowerCase()) && element.closest('g') !== root.querySelector('g'))) continue;
    let matrix = viewport;
    for (const parent of ancestors) {
      const transform = (parent as SVGGraphicsElement).transform?.baseVal.consolidate()?.matrix;
      if (transform) matrix = matrix.multiply(DOMMatrix.fromMatrix(transform));
    }
    const path = svgpath(element.getAttribute('d')!).matrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]).abs().unshort().unarc();
    const rings: Ring[] = [];
    let ring: Ring = [];
    let start = [0, 0];
    const finish = () => { if (ring.length >= 3) { if (ring[0][0] !== ring.at(-1)![0] || ring[0][1] !== ring.at(-1)![1]) ring.push([...ring[0]]); rings.push(ring); } ring = []; };
    path.iterate((segment, _index, x, y) => {
      const command = segment[0];
      const values = segment.slice(1) as number[];
      if (command === 'M') { finish(); start = [values[0], values[1]]; ring.push([precision(values[0]), precision(values[1])]); return; }
      const end = command === 'Z' ? start : command === 'H' ? [values[0], y] : command === 'V' ? [x, values[0]] : values.slice(-2);
      const controls = command === 'C' ? [[x, y], values.slice(0, 2), values.slice(2, 4), end] : command === 'Q' ? [[x, y], values.slice(0, 2), end] : [[x, y], end];
      const length = controls.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - controls[i][0], p[1] - controls[i][1]), 0);
      const steps = command === 'C' || command === 'Q' ? Math.max(1, Math.ceil(length / 2)) : 1;
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        let curve = controls;
        while (curve.length > 1) curve = curve.slice(1).map((p, i) => [curve[i][0] * (1 - t) + p[0] * t, curve[i][1] * (1 - t) + p[1] * t]);
        ring.push([precision(curve[0][0]), precision(curve[0][1])]);
      }
      if (command === 'Z') finish();
    });
    finish();
    // Garment fabric is rendered with even-odd winding; preserve apertures and compound paths.
    let filled: MultiPolygon = [];
    for (const contour of rings) if (openingArea([[contour]]) > .02) filled = filled.length ? polygonClipping.xor(filled, [contour]) : [[contour]];
    for (const ancestor of ancestors) {
      if (ancestor.hasAttribute('clip-path')) throw new Error('This source uses an unsupported fabric clip.');
      const reference = ancestor.getAttribute('mask')?.match(/^url\(#(.+)\)$/)?.[1];
      if (!reference) continue;
      const mask = parsed.getElementById(reference);
      const background = mask?.querySelector('rect[fill="white"]');
      const cutouts = Array.from(mask?.querySelectorAll('path') ?? []);
      if (!mask || mask.getAttribute('maskUnits') !== 'userSpaceOnUse' || !background || cutouts.some(cutout => cutout.getAttribute('fill') !== 'black' || Number(cutout.getAttribute('stroke-width') ?? 0) !== 0)
        || ancestors.slice(0, ancestors.indexOf(ancestor) + 1).some(parent => parent.hasAttribute('transform'))) throw new Error('This source uses an unsupported fabric mask.');
      const cutRaw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(' ')}">${cutouts.map(cutout => new XMLSerializer().serializeToString(cutout)).join('')}</svg>`;
      const maskCut = openingSourcePolygons(cutRaw);
      if (maskCut.length && filled.length) filled = polygonClipping.difference(filled, maskCut);
    }
    if (filled.length) result = result.length ? polygonClipping.union(result, filled) : filled;
  }
  if (rawCache.size > 80) rawCache.delete(rawCache.keys().next().value!);
  rawCache.set(raw, result);
  return result;
}
export function transformOpeningPolygons(polygons: MultiPolygon, matrix: DOMMatrix): MultiPolygon {
  return polygons.map(polygon => polygon.map(ring => ring.map(([x, y]) => {
    const point = matrix.transformPoint({ x, y });
    return [point.x, point.y];
  })));
}
export function compileOpeningGeometry(sources: OpeningSource[]): OpeningGeometry {
  const signature = sources.map(source => { const m = source.matrix ?? new DOMMatrix();
    return { id: source.id, role: source.role, raw: source.raw, matrix: [m.a, m.b, m.c, m.d, m.e, m.f] }; });
  const cached = compiledGeometryCache.find(entry => entry.sources.length === signature.length && entry.sources.every((source, index) => {
    const other = signature[index];
    return source.id === other.id && source.role === other.role && source.raw === other.raw && source.matrix.every((value, axis) => value === other.matrix[axis]);
  }));
  if (cached) return cached.geometry;
  let geometry: OpeningGeometry;
  try {
    const panels = sources.map(source => ({ id: source.id, role: source.role,
      polygons: transformOpeningPolygons(openingSourcePolygons(source.raw), source.matrix ?? new DOMMatrix()) })).filter(panel => panel.polygons.length);
    if (sources.some(source => source.role === 'body') && !panels.some(panel => panel.role === 'body')) throw new Error('Body contour is unavailable.');
    geometry = { version: 1, panels, fabric: panels.length ? polygonClipping.union(panels[0].polygons, ...panels.slice(1).map(panel => panel.polygons)) : [] };
  } catch {
    geometry = { version: 1, panels: [], fabric: [], unavailableReason: 'The source contour or mask is unsupported; fabric cutting is disabled for this template.' };
  }
  compiledGeometryCache.push({ sources: signature, geometry });
  if (compiledGeometryCache.length > 24) compiledGeometryCache.shift();
  return geometry;
}
export function openingPolygonPath(polygons: MultiPolygon): string {
  return polygons.map(polygon => polygon.map(ring => `M${ring.map(([x, y]) => `${+x.toFixed(3)},${+y.toFixed(3)}`).join('L')}Z`).join('')).join('');
}
/** The saved slider position is also the construction's open amount; no second state can drift. */
export function openingOpenAmount(detail: GarmentDetail): number {
  const value = detail.zipSliderPosition ?? (detail.variant === 'zip-05' ? .34 : 0);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** Shared local coordinates for fabric separation, zipper tapes, teeth and slider. */
export function openingGapProfile(detail: GarmentDetail, width: number, height: number) {
  const amount = openingOpenAmount(detail);
  const tip = Math.max(height * .04, height * amount);
  // Opening travel controls depth; tape width caps separation even on full-length zips.
  const spread = Math.min(width * .65, height * .045) * amount;
  const halfGap = (y: number) => width * .025 + spread * Math.pow(Math.max(0, 1 - Math.max(0, y) / tip), 1.25);
  const stations = [...Array.from({ length: 17 }, (_, index) => tip * index / 16), height];
  return { amount, tip, halfGap, stations };
}

function strip(opening: OpeningDefaults, width = opening.width, extend = true): MultiPolygon {
  const length = distance(opening.start, opening.end);
  if (!length || !Number.isFinite(length) || !Number.isFinite(width) || width <= 0) return [];
  const dx = (opening.end.x - opening.start.x) / length, dy = (opening.end.y - opening.start.y) / length;
  const before = extend ? 2 : 0;
  const after = extend ? 2 : 0;
  const start = { x: opening.start.x - dx * before, y: opening.start.y - dy * before };
  const end = { x: opening.end.x + dx * after, y: opening.end.y + dy * after };
  const ring: Ring = [[start.x - dy * width / 2, start.y + dx * width / 2], [start.x + dy * width / 2, start.y - dx * width / 2],
    [end.x + dy * width / 2, end.y - dx * width / 2], [end.x - dy * width / 2, end.y + dx * width / 2]];
  return [[ [...ring, ring[0]] ]];
}
function intersections(polygons: MultiPolygon, value: number, axis: 'x' | 'y'): number[] {
  const index = axis === 'x' ? 0 : 1;
  const result: number[] = [];
  for (const polygon of polygons) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i];
    if ((a[index] <= value && b[index] > value) || (b[index] <= value && a[index] > value)) result.push(a[1 - index] + (value - a[index]) / (b[index] - a[index]) * (b[1 - index] - a[1 - index]));
  }
  return result.sort((a, b) => a - b);
}
/** Extend the insertion to the actual neck edge across the tape width, not a flat cap at its centre. */
export function openingNecklineReach(detail: GarmentDetail, bounds: DetailBounds): number {
  const opening = detail.opening;
  const geometry = bounds.openingGeometry;
  if (!opening || !geometry) return 0;
  const neck = geometry.panels.filter(panel => panel.role === 'neck').flatMap(panel => panel.polygons);
  if (!neck.length) return 0;
  const length = distance(opening.start, opening.end);
  if (!length) return 0;
  const axis = { x: (opening.end.x - opening.start.x) / length, y: (opening.end.y - opening.start.y) / length };
  const local = new DOMMatrix([axis.y, -axis.x, axis.x, axis.y, 0, 0]).translate(-opening.start.x, -opening.start.y);
  const localNeck = transformOpeningPolygons(neck, local);
  const central = intersections(localNeck, 0, 'x');
  if (!central.some(y => Math.abs(y) <= opening.width)) return 0;
  const profile = openingGapProfile(detail, opening.width, length);
  const radius = profile.halfGap(0) + opening.width * .5;
  const localFabric = transformOpeningPolygons(geometry.fabric, local);
  let top = 0;
  for (let i = 0; i <= 24; i++) {
    const hits = intersections(localFabric, -radius + 2 * radius * i / 24, 'x');
    // Select the torso interval, not a disconnected rear neck band.
    const intervals: number[][] = [];
    for (let j = 0; j + 1 < hits.length; j += 2) {
      const previous = intervals.at(-1);
      if (previous && hits[j] - previous[1] <= 3) previous[1] = hits[j + 1];
      else intervals.push([hits[j], hits[j + 1]]);
    }
    const torso = intervals.filter(([a, b]) => a <= length / 2 && b >= length / 2).sort((a, b) => b[1] - a[1])[0];
    if (torso) top = Math.min(top, torso[0]);
  }
  return Math.max(0, -top) + 2;
}

export function openingGap(detail: GarmentDetail, padding = 0, reach = 2): MultiPolygon {
  const opening = detail.opening!;
  const height = distance(opening.start, opening.end);
  const profile = openingGapProfile(detail, opening.width, height);
  const dx = (opening.end.x - opening.start.x) / height, dy = (opening.end.y - opening.start.y) / height;
  const point = (y: number, side: number): [number, number] => [
    opening.start.x + dx * y - dy * side * (profile.halfGap(y) + padding),
    opening.start.y + dy * y + dx * side * (profile.halfGap(y) + padding),
  ];
  const stations = [-Math.max(2, reach), ...profile.stations, height + 2];
  const ring = [...stations.map(y => point(y, -1)), ...stations.slice().reverse().map(y => point(y, 1))];
  return [[ [...ring, ring[0]] ]];
}
function sync(detail: GarmentDetail, bounds: DetailBounds): GarmentDetail {
  const opening = detail.opening!;
  return { ...detail, x: ((opening.start.x + opening.end.x) / 2 - bounds.minX) / (bounds.maxX - bounds.minX),
    y: ((opening.start.y + opening.end.y) / 2 - bounds.minY) / (bounds.maxY - bounds.minY),
    rotation: (Math.atan2(opening.end.y - opening.start.y, opening.end.x - opening.start.x) * 180 / Math.PI - 90 + 360) % 360 };
}
export function createOpening(detail: GarmentDetail, bounds: DetailBounds, placement: OpeningPlacement): GarmentDetail {
  if (detail.type !== 'zip' || detail.customAsset) return detail;
  const geometry = bounds.openingGeometry;
  const fabric = geometry?.fabric ?? [];
  const body = geometry?.panels.find(panel => panel.role === 'body')?.polygons ?? fabric;
  const center = (bounds.minX + bounds.maxX) / 2;
  const vertical = intersections(fabric, center, 'x');
  const bottom = vertical.at(-1) ?? bounds.maxY;
  // Ignore rear-band islands and merge sampling-scale joins between neck/body/hem.
  const intervals: number[][] = [];
  for (let i = 0; i + 1 < vertical.length; i += 2) {
    const previous = intervals.at(-1);
    if (previous && vertical[i] - previous[1] <= 3) previous[1] = vertical[i + 1];
    else intervals.push([vertical[i], vertical[i + 1]]);
  }
  const torso = intervals.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
  const top = torso?.[0] ?? bounds.necklineY ?? bounds.minY;
  const height = bottom - top;
  const original = detailPlacement(detail, bounds);
  let start = { x: center, y: top }, end = { x: center, y: top + height * .32 };
  if (placement === 'full-front') end.y = bottom;
  if (placement === 'hem') { start.y = bottom; end.y = bottom - height * .27; }
  if (placement === 'shoulder') {
    const x = bounds.minX + (bounds.maxX - bounds.minX) * .22;
    start = { x, y: intersections(body, x, 'x')[0] ?? bounds.minY };
    end = { x: x + (center - x) * .3, y: start.y + height * .19 };
  }
  if (placement === 'side-seam') {
    const y = top + height * .65;
    start = { x: intersections(body, y, 'y').at(-1) ?? bounds.maxX, y };
    end = { x: start.x - (bounds.maxX - bounds.minX) * .22, y: y - height * .08 };
  }
  if (placement === 'free') {
    const radians = detailRotation(detail) * Math.PI / 180;
    const cx = original.left + original.width / 2, cy = original.top + original.height / 2;
    start = { x: cx + Math.sin(radians) * original.height / 2, y: cy - Math.cos(radians) * original.height / 2 };
    end = { x: cx - Math.sin(radians) * original.height / 2, y: cy + Math.cos(radians) * original.height / 2 };
  }
  const defaults: OpeningDefaults = { start, end, width: Math.max(12, Math.min(original.width, 80)), attachment: placement, facingColor: detail.fill };
  return sync({ ...detail, lockProportions: false, opening: { ...defaults, version: 1, closure: 'zip', defaults: structuredClone(defaults) } }, bounds);
}
export function setOpeningEndpoint(detail: GarmentDetail, bounds: DetailBounds, endpoint: 'start' | 'end', point: OpeningPoint): GarmentDetail {
  if (!detail.opening || !finite(point)) return detail;
  return sync({ ...detail, opening: { ...detail.opening, [endpoint]: { x: point.x, y: point.y } } }, bounds);
}
export function resetOpening(detail: GarmentDetail): GarmentDetail {
  if (!detail.opening) return detail;
  const current = detail.opening;
  const saved: Partial<OpeningDefaults> = current.defaults ?? {};
  const coordinate = (value: number | undefined, fallback: number | undefined, safe: number) =>
    Number.isFinite(value) ? value! : Number.isFinite(fallback) ? fallback! : safe;
  const start = { x: coordinate(saved.start?.x, current.start?.x, 1024), y: coordinate(saved.start?.y, current.start?.y, 512) };
  const end = { x: coordinate(saved.end?.x, current.end?.x, start.x), y: coordinate(saved.end?.y, current.end?.y, start.y + 320) };
  const usableWidth = (value: number | undefined) => Number.isFinite(value) && value! >= 2 && value! <= 600;
  const placements: OpeningPlacement[] = ['neckline', 'shoulder', 'side-seam', 'hem', 'full-front', 'free'];
  const attachment = placements.includes(saved.attachment!) ? saved.attachment! : placements.includes(current.attachment) ? current.attachment : 'free';
  const facingColor = [saved.facingColor, current.facingColor, detail.fill].find(color => typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)) ?? '#777777';
  // Older saved defaults may be partial; never replace complete endpoints with partial objects.
  const defaults: OpeningDefaults = { start, end, width: usableWidth(saved.width) ? saved.width! : usableWidth(current.width) ? current.width : 32, attachment, facingColor };
  const opening: GarmentOpening = { ...current, ...defaults, defaults: structuredClone(defaults) };
  return { ...detail, opening, rotation: (Math.atan2(opening.end.y - opening.start.y, opening.end.x - opening.start.x) * 180 / Math.PI - 90 + 360) % 360 };
}
export function transformOpening(detail: GarmentDetail, bounds: DetailBounds, patch: Partial<{ x: number; y: number; width: number; height: number; rotation: number }>): GarmentDetail {
  if (!detail.opening || Object.values(patch).some(value => !Number.isFinite(value))) return detail;
  const current = detailPlacement(detail, bounds);
  const width = patch.width ?? current.width, height = patch.height ?? current.height;
  if (width < 2 || height < 2 || width > 600 || height > 4096) return detail;
  const angle = (patch.rotation ?? detailRotation(detail)) * Math.PI / 180;
  const x = bounds.minX + (patch.x ?? current.x) * (bounds.maxX - bounds.minX);
  const y = bounds.minY + (patch.y ?? current.y) * (bounds.maxY - bounds.minY);
  return sync({ ...detail, opening: { ...detail.opening, width,
    start: { x: x + Math.sin(angle) * height / 2, y: y - Math.cos(angle) * height / 2 },
    end: { x: x - Math.sin(angle) * height / 2, y: y + Math.cos(angle) * height / 2 } } }, bounds);
}
export function validateOpening(detail: GarmentDetail, bounds: DetailBounds): { status: 'Valid' | 'Needs Review' | 'Invalid'; reasons: string[] } {
  const opening = detail.opening;
  if (!opening) return { status: 'Needs Review', reasons: ['Overlay zip: convert explicitly to cut the garment.'] };
  if (opening.version !== 1 || opening.closure !== 'zip' || !finite(opening.start) || !finite(opening.end) || !Number.isFinite(opening.width) || opening.width < 2 || opening.width > 600 || distance(opening.start, opening.end) < Math.max(8, opening.width * 1.2)) return { status: 'Invalid', reasons: ['The opening needs finite, distinct endpoints and a usable width smaller than its length.'] };
  const fabric = bounds.openingGeometry?.fabric;
  if (!fabric?.length) return { status: 'Needs Review', reasons: [bounds.openingGeometry?.unavailableReason ?? 'Actual garment contour geometry is not available; no fabric cut is applied.'] };
  try {
    const cut = polygonClipping.intersection(fabric, strip(opening, opening.width, false));
    const coverage = openingArea(cut) / (opening.width * distance(opening.start, opening.end));
    if (coverage < .12) return { status: 'Invalid', reasons: ['The opening does not intersect enough garment fabric.'] };
    const reasons: string[] = [];
    if (coverage < .8) reasons.push('The opening crosses an existing aperture or extends outside the fabric.');
    // Attachment records the creation preset, not a constraint on later moves or rotations.
    return { status: reasons.length ? 'Needs Review' : 'Valid', reasons };
  } catch { return { status: 'Invalid', reasons: ['The contour cannot produce a reliable opening.'] }; }
}
export function constructOpenings(details: GarmentDetail[], bounds: DetailBounds): OpeningConstructionGeometry {
  const geometry = bounds.openingGeometry;
  const fabric = geometry?.fabric ?? [];
  const candidates = details.filter(detail => !detail.hidden && detail.opening && fabric.length);
  const single = candidates.length === 1 ? candidates[0] : undefined;
  const signature = single ? JSON.stringify([single.opening, openingOpenAmount(single)]) : '';
  const cached = geometry && single ? constructionCache.get(geometry)?.get(single) : undefined;
  if (cached?.signature === signature) return cached.result;
  const active = candidates.filter(detail => validateOpening(detail, bounds).status !== 'Invalid');
  let removed: MultiPolygon = [], facing: MultiPolygon = [], inkCut: MultiPolygon = [];
  for (const detail of active) {
    const opening = detail.opening!;
    const reach = openingNecklineReach(detail, bounds);
    let cut = polygonClipping.intersection(fabric, openingGap(detail, 0, reach));
    if (reach > 0) {
      const neck = geometry!.panels.filter(panel => panel.role === 'neck').flatMap(panel => panel.polygons);
      const insertion = polygonClipping.intersection(neck, openingGap(detail, opening.width * .45, reach));
      if (insertion.length) cut = polygonClipping.union(cut, insertion);
    }
    removed = removed.length ? polygonClipping.union(removed, cut) : cut;
    // Ink extends beyond filled contours; clear the entire tape footprint, not only removed fabric.
    const ink = openingGap(detail, opening.width * .45 + 1, reach);
    inkCut = inkCut.length ? polygonClipping.union(inkCut, ink) : ink;
    const band = polygonClipping.intersection(fabric, openingGap(detail, opening.width / 2 + 9, reach));
    facing = facing.length ? polygonClipping.union(facing, band) : band;
  }
  let remaining: MultiPolygon | undefined;
  let panels: Record<string, MultiPolygon> | undefined;
  // The live renderer clips original layers with `removed`; only exports/tests need full panel reconstruction.
  const result: OpeningConstructionGeometry = { active, removed, inkCut, facing: facing.length ? polygonClipping.difference(facing, removed) : [],
    get remaining() { return remaining ??= removed.length ? polygonClipping.difference(fabric, removed) : fabric; },
    get panels() { return panels ??= Object.fromEntries((geometry?.panels ?? []).map(panel => [panel.id, removed.length ? polygonClipping.difference(panel.polygons, removed) : panel.polygons])); } };
  if (geometry && single) {
    let cache = constructionCache.get(geometry);
    if (!cache) constructionCache.set(geometry, cache = new WeakMap());
    cache.set(single, { signature, result });
  }
  return result;
}
/** Inverse-map the actual removed fabric into each independent layer, including its ink and wash. */
export function openingLayerClip(removed: MultiPolygon, inverse = new DOMMatrix()): string {
  const viewport: MultiPolygon = [[[[0, 0], [2048, 0], [2048, 2048], [0, 2048], [0, 0]]]];
  return openingPolygonPath(polygonClipping.difference(viewport, transformOpeningPolygons(removed, inverse)));
}
