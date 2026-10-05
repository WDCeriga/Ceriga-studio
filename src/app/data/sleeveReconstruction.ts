import type { CustomAssetDefinition } from './customAssets';
import { contours } from 'd3-contour';
import simplify from 'simplify-js';
import polygonClipping from 'polygon-clipping';

export type SleevePoint = [number, number];
export type SleeveSide = 'left' | 'right';
export type SleeveContourHandle = 'frontJoin' | 'backJoin' | 'upperOuter' | 'upperInner' | 'midOuter' | 'midInner';
export interface SleeveContours { outer: SleevePoint[]; inner: SleevePoint[]; opening?: SleevePoint[] }
export interface SleeveCuff {
  detected: true; confidence: 'high' | 'medium' | 'low'; evidence: string;
  depth: number; boundary: SleevePoint[]; outline: SleevePoint[];
}
export interface SleeveArtwork { polygons: SleevePoint[][][]; cleanupTolerance: number }
export interface SleeveGarmentContext {
  armholeToBodyWidth: number;
  bodyAspectRatio: number;
  shoulderSpanToBodyWidth: number;
  shoulderDrop: number;
  sleeveAngle: number;
}
export interface SleeveStyle {
  version: 1;
  lengthClass: 'short' | 'long';
  sleeveType: 'short' | 'long' | 'cuffed' | 'flared' | 'tapered';
  construction: 'set-in' | 'dropped-shoulder' | 'raglan' | 'dolman' | 'unknown';
  constructionNotes: string;
  length: number;
  openingWidth: number;
  upperWidth: number;
  taper: number;
  hemAngle: number;
  cuffStyle: 'plain' | 'band' | 'ribbed' | 'rolled' | 'elastic';
  sourceCuff?: { style: SleeveStyle['cuffStyle']; confidence: 'high' | 'medium' | 'low'; evidence: string };
  looseness: number;
  silhouette: 'straight' | 'flared' | 'tapered';
  confidence: 'high' | 'medium' | 'low';
  measurementBasis: 'armhole-relative';
  method: string;
  sourceMeasurements: { length: number; openingWidth: number; upperWidth: number };
  needsReview: boolean;
  contours?: SleeveContours;
  artwork?: SleeveArtwork;
  cuff?: SleeveCuff;
  sourceGarment?: SleeveGarmentContext;
}
export interface SleeveSocket { side: SleeveSide; join: SleevePoint[]; keepSvg: string; bodyWidth?: number; garment?: Omit<SleeveGarmentContext, 'sleeveAngle'> }
export interface SleeveEdits {
  scale: number; length: number; openingWidth: number; upperWidth: number; rotation: number;
  shoulder: SleevePoint; underarm: SleevePoint; cuffTop: SleevePoint; cuffBottom: SleevePoint; mirror: boolean;
  contourOffsets?: Partial<Record<SleeveContourHandle, SleevePoint>>;
  bodyColor?: string; cuffColor?: string;
}
export interface SleeveReconstruction {
  version: 1; fit: string; sourceImageHash: string; detectedStyle: SleeveStyle; style: SleeveStyle;
  socket: SleeveSocket; edits: SleeveEdits;
}
export interface SleeveDraft {
  reconstructionDraft: true; id: string; fit: string; side: SleeveSide; source: 'photo' | 'drawing';
  style: SleeveStyle; sockets: Record<SleeveSide, SleeveSocket>; analysis: CustomAssetDefinition['analysis'];
  stageProvenance: Record<string, string>;
}

const fitEase: Record<string, number> = { slim: .94, regular: 1, boxy: 1.12, oversized: 1.24 };
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const add = (first: SleevePoint, second: SleevePoint): SleevePoint => [first[0] + second[0], first[1] + second[1]];
const mix = (first: SleevePoint, second: SleevePoint, amount: number): SleevePoint => [first[0] + (second[0] - first[0]) * amount, first[1] + (second[1] - first[1]) * amount];
const coordinate = (point: SleevePoint) => point.map(value => Number(value.toFixed(3))).join(' ');

export function referenceSleeveStyle(style: SleeveStyle, pixels: ImageData, landmarks: { armhole: number[][]; cuff: number[][] }): SleeveStyle {
  const values = Array.from({ length: pixels.width * pixels.height }, (_, index) => {
    const offset = index * 4;
    return pixels.data[offset + 3] > 0 && (pixels.data[offset] + pixels.data[offset + 1] + pixels.data[offset + 2]) / 3 < 168 ? 1 : 0;
  });
  const polygons = contours().size([pixels.width, pixels.height]).thresholds([.5])(values)[0]?.coordinates ?? [];
  const rings = polygons.map(polygon => polygon[0]);
  const area = (ring: number[][]) => Math.abs(ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0));
  const ring = rings.sort((first, second) => area(second) - area(first))[0]?.slice(0, -1) as SleevePoint[];
  if (!ring?.length || landmarks.armhole.length < 2 || landmarks.cuff.length !== 2) throw new Error('The sleeve outline could not be recovered. Review the sleeve isolation.');
  const nearest = (point: number[]) => ring.reduce((best, candidate, index) => Math.hypot(candidate[0] - point[0], candidate[1] - point[1]) < Math.hypot(ring[best][0] - point[0], ring[best][1] - point[1]) ? index : best, 0);
  const shoulder = landmarks.armhole[0];
  const underarm = landmarks.armhole.at(-1)!;
  const shoulderIndex = nearest(shoulder), underarmIndex = nearest(underarm);
  const cuffIndices = landmarks.cuff.map(nearest);
  const walk = (direction: number) => {
    const indices = [shoulderIndex];
    while (indices.at(-1) !== underarmIndex && indices.length <= ring.length) indices.push((indices.at(-1)! + direction + ring.length) % ring.length);
    return indices;
  };
  const sleeve = [walk(1), walk(-1)].find(indices => cuffIndices.every(index => indices.includes(index)));
  if (!sleeve || cuffIndices[0] === cuffIndices[1]) throw new Error('The cuff and armhole must identify separate edges of the sleeve.');
  const cuffPositions = cuffIndices.map(index => sleeve.indexOf(index)).sort((first, second) => first - second);
  const outer = sleeve.slice(0, cuffPositions[0] + 1).map(index => ring[index]);
  const inner = sleeve.slice(cuffPositions[1]).reverse().map(index => ring[index]);
  if (outer.length < 2 || inner.length < 2) throw new Error('The sleeve needs distinct outer and inner contours.');
  const armhole = Math.hypot(underarm[0] - shoulder[0], underarm[1] - shoulder[1]);
  const origin: SleevePoint = [0, 0];
  let total = 0;
  landmarks.armhole.slice(1).forEach((point, index) => {
    const previous = landmarks.armhole[index];
    const weight = Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    origin[0] += (point[0] + previous[0]) / 2 * weight;
    origin[1] += (point[1] + previous[1]) / 2 * weight;
    total += weight;
  });
  if (armhole < 8 || total < 8) throw new Error('The sleeve attachment is too small to measure.');
  origin[0] /= total; origin[1] /= total;
  const cuffCenter = mix(outer.at(-1)!, inner.at(-1)!, .5);
  const length = Math.hypot(cuffCenter[0] - origin[0], cuffCenter[1] - origin[1]);
  if (length < 8) throw new Error('The cuff is too close to the sleeve attachment.');
  const axis: SleevePoint = [(cuffCenter[0] - origin[0]) / length, (cuffCenter[1] - origin[1]) / length];
  let across: SleevePoint = [-axis[1], axis[0]];
  if ((underarm[0] - shoulder[0]) * across[0] + (underarm[1] - shoulder[1]) * across[1] < 0) across = [-across[0], -across[1]];
  const normalized = (point: number[]): SleevePoint => [((point[0] - origin[0]) * axis[0] + (point[1] - origin[1]) * axis[1]) / armhole,
    ((point[0] - origin[0]) * across[0] + (point[1] - origin[1]) * across[1]) / armhole];
  const clean = (path: number[][], tolerance: number): SleevePoint[] => simplify(path.map(point => ({ x: point[0], y: point[1] })), tolerance, true).map(point => [point.x, point.y]);
  const sample = (path: SleevePoint[]) => {
    path = clean(path, Math.max(1, armhole * .006));
    const distances = [0];
    for (let index = 1; index < path.length; index++) distances.push(distances.at(-1)! + Math.hypot(path[index][0] - path[index - 1][0], path[index][1] - path[index - 1][1]));
    const count = Math.max(2, Math.min(256, Math.ceil(distances.at(-1)! / 2)));
    let cursor = 1;
    return Array.from({ length: count }, (_, index): SleevePoint => {
      const distance = distances.at(-1)! * index / (count - 1);
      while (cursor < path.length - 1 && distances[cursor] < distance) cursor++;
      const point = mix(path[cursor - 1], path[cursor], (distance - distances[cursor - 1]) / Math.max(.001, distances[cursor] - distances[cursor - 1]));
      return normalized(point);
    });
  };
  const reference = { outer: sample(outer), inner: sample(inner), opening: sample(sleeve.slice(cuffPositions[0], cuffPositions[1] + 1).map(index => ring[index])) };
  const upper = (path: SleevePoint[]) => path.reduce((best, point) => Math.abs(point[0] - length / armhole * .25) < Math.abs(best[0] - length / armhole * .25) ? point : best)[1];
  const upperWidth = Math.abs(upper(reference.inner) - upper(reference.outer));
  const outerCuff = reference.outer.at(-1)!, innerCuff = reference.inner.at(-1)!;
  const openingWidth = Math.hypot(innerCuff[0] - outerCuff[0], innerCuff[1] - outerCuff[1]);
  const hemAngle = Math.atan2(outerCuff[0] - innerCuff[0], innerCuff[1] - outerCuff[1]) * 180 / Math.PI;
  if (upperWidth <= 0 || Math.abs(hemAngle) > 60) throw new Error('Review the sleeve outline and cuff landmarks before adapting this sleeve.');
  const silhouette = openingWidth / upperWidth > 1.12 ? 'flared' : openingWidth / upperWidth < .85 ? 'tapered' : 'straight';
  const artwork: SleeveArtwork = { polygons: polygons.filter(polygon => area(polygon[0]) > 3).map(polygon => polygon.map(path => clean(path, .65).map(normalized))), cleanupTolerance: Math.max(1, armhole * .006) / armhole };
  const cuffRegions = artwork.polygons.flatMap(polygon => polygon.slice(1)).filter(path => {
    const longitudinal = path.map(point => point[0]), lateral = path.map(point => point[1]);
    return Math.min(...longitudinal) > length / armhole * .6 && Math.min(...longitudinal) < length / armhole * .96
      && Math.max(...lateral) - Math.min(...lateral) > openingWidth * .6
      && Math.max(...longitudinal) - Math.min(...longitudinal) > length / armhole * .025;
  }).sort((first, second) => Math.min(...first.map(point => point[0])) - Math.min(...second.map(point => point[0])));
  let cuff: SleeveCuff | undefined;
  if (cuffRegions.length && style.cuffStyle !== 'plain') {
    const region = cuffRegions[0];
    const lateralMin = Math.min(...region.map(point => point[1])), lateralMax = Math.max(...region.map(point => point[1]));
    const boundary = Array.from({ length: 25 }, (_, index): SleevePoint => {
      const lateral = lateralMin + (lateralMax - lateralMin) * index / 24;
      const intersections: number[] = [];
      for (let position = 1; position < region.length; position++) {
        const first = region[position - 1], second = region[position];
        if (first[1] !== second[1] && lateral >= Math.min(first[1], second[1]) && lateral <= Math.max(first[1], second[1]))
          intersections.push(first[0] + (second[0] - first[0]) * (lateral - first[1]) / (second[1] - first[1]));
      }
      return [intersections.length ? Math.min(...intersections) : region.reduce((best, point) => Math.abs(point[1] - lateral) < Math.abs(best[1] - lateral) ? point : best)[0], lateral];
    });
    const outerStart = reference.outer.findIndex(point => point[0] >= boundary[0][0]);
    const innerStart = reference.inner.findIndex(point => point[0] >= boundary.at(-1)![0]);
    if (outerStart > 0 && innerStart > 0) {
      boundary[0] = reference.outer[outerStart]; boundary[boundary.length - 1] = reference.inner[innerStart];
      cuff = { detected: true, confidence: 'medium', evidence: 'Enclosed transverse seam near the sleeve opening.',
        depth: length / armhole - boundary.reduce((sum, point) => sum + point[0], 0) / boundary.length, boundary,
        outline: [...reference.outer.slice(outerStart), ...reference.opening.slice(1), ...reference.inner.slice(innerStart).reverse(), ...boundary.slice().reverse()] };
    }
  }
  return { ...style, contours: reference, length: length / armhole, openingWidth, upperWidth, taper: openingWidth / upperWidth, hemAngle, silhouette,
    artwork, cuff,
    sleeveType: style.cuffStyle !== 'plain' ? 'cuffed' : silhouette !== 'straight' ? silhouette : style.lengthClass,
    method: 'source-raster-contours', sourceMeasurements: { length, openingWidth: openingWidth * armhole, upperWidth: upperWidth * armhole } };
}

export async function traceSleeveDraft(draft: SleeveDraft, imageUrl: string, landmarks: { armhole: number[][]; cuff: number[][] }): Promise<SleeveDraft> {
  const image = await createImageBitmap(await (await fetch(imageUrl)).blob());
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context || canvas.width * canvas.height > 16_000_000) { image.close(); throw new Error('The sleeve reference cannot be traced.'); }
  context.drawImage(image, 0, 0);
  image.close();
  const style = referenceSleeveStyle(draft.style, context.getImageData(0, 0, canvas.width, canvas.height), landmarks);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(style)));
  const contourStyleId = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  return { ...draft, style, stageProvenance: { ...draft.stageProvenance, contourStyleId } };
}

export function defaultSleeveEdits(): SleeveEdits {
  return { scale: 1, length: 1, openingWidth: 1, upperWidth: 1, rotation: 0,
    shoulder: [0, 0], underarm: [0, 0], cuffTop: [0, 0], cuffBottom: [0, 0], mirror: false };
}

export function validateSleeveReconstruction(value: SleeveReconstruction) {
  const fail = () => { throw new Error('Invalid sleeve reconstruction parameters.'); };
  if (!value || value.version !== 1 || !Object.hasOwn(fitEase, value.fit) || !/^[a-f0-9]{64}$/.test(value.sourceImageHash)) fail();
  for (const style of [value.style, value.detectedStyle]) {
    if (!style || style.version !== 1 || !['short', 'long'].includes(style.lengthClass)
      || !['short', 'long', 'cuffed', 'flared', 'tapered'].includes(style.sleeveType)
      || !['set-in', 'dropped-shoulder', 'raglan', 'dolman', 'unknown'].includes(style.construction)
      || !['plain', 'band', 'ribbed', 'rolled', 'elastic'].includes(style.cuffStyle)
      || !['straight', 'flared', 'tapered'].includes(style.silhouette)
      || !['high', 'medium', 'low'].includes(style.confidence)
      || typeof style.constructionNotes !== 'string' || style.constructionNotes.length > 1200
      || ![style.length, style.openingWidth, style.upperWidth, style.taper, style.looseness].every(number => Number.isFinite(number) && number > 0 && number < 100)
      || !Number.isFinite(style.hemAngle) || Math.abs(style.hemAngle) > 60) fail();
    if (style.contours && [style.contours.outer, style.contours.inner, ...(style.contours.opening ? [style.contours.opening] : [])].some(points => !Array.isArray(points) || points.length < 2 || points.length > 256
      || points.some(point => !Array.isArray(point) || point.length !== 2 || point.some(number => !Number.isFinite(number) || Math.abs(number) > 20)))) fail();
    if (style.sourceCuff !== undefined && (!style.sourceCuff || !['plain', 'band', 'ribbed', 'rolled', 'elastic'].includes(style.sourceCuff.style)
      || !['high', 'medium', 'low'].includes(style.sourceCuff.confidence) || typeof style.sourceCuff.evidence !== 'string'
      || !style.sourceCuff.evidence.trim().length || style.sourceCuff.evidence.trim().length > 1200)) fail();
    const validPath = (path: SleevePoint[]) => Array.isArray(path) && path.length >= 2 && path.length <= 8192 && path.every(point => Array.isArray(point) && point.length === 2 && point.every(number => Number.isFinite(number) && Math.abs(number) <= 20));
    if (style.artwork && (!style.contours || !Number.isFinite(style.artwork.cleanupTolerance) || style.artwork.cleanupTolerance <= 0 || style.artwork.cleanupTolerance > .1
      || !Array.isArray(style.artwork.polygons) || style.artwork.polygons.length > 2048 || style.artwork.polygons.some(polygon => !Array.isArray(polygon) || !polygon.length || polygon.length > 2048 || polygon.some(path => !validPath(path)))
      || style.artwork.polygons.flat().reduce((sum, path) => sum + path.length, 0) > 100000)) fail();
    if (style.cuff && (!style.artwork || style.cuff.detected !== true || !['high', 'medium', 'low'].includes(style.cuff.confidence)
      || typeof style.cuff.evidence !== 'string' || style.cuff.evidence.length > 1200 || !Number.isFinite(style.cuff.depth) || style.cuff.depth <= 0 || style.cuff.depth >= style.length
      || !validPath(style.cuff.boundary) || !validPath(style.cuff.outline))) fail();
    if (style.sourceGarment) {
      const source = style.sourceGarment;
      if (![source.armholeToBodyWidth, source.bodyAspectRatio, source.shoulderSpanToBodyWidth].every(number => Number.isFinite(number) && number > 0 && number < 5)
        || !Number.isFinite(source.shoulderDrop) || Math.abs(source.shoulderDrop) > 2
        || !Number.isFinite(source.sleeveAngle) || Math.abs(source.sleeveAngle) > 90
        || !Number.isFinite(value.socket?.bodyWidth) || value.socket.bodyWidth! <= 0 || value.socket.bodyWidth! > 2048) fail();
    }
  }
  const target = value.socket?.garment;
  if (target && (![target.armholeToBodyWidth, target.bodyAspectRatio, target.shoulderSpanToBodyWidth].every(number => Number.isFinite(number) && number > 0 && number < 5)
    || !Number.isFinite(target.shoulderDrop) || Math.abs(target.shoulderDrop) > 2)) fail();
  const edits = value.edits;
  if (edits && [edits.bodyColor, edits.cuffColor].some(color => color !== undefined && !/^#[a-f0-9]{6}$/i.test(color))) fail();
  if (!edits || ![edits.scale, edits.length, edits.openingWidth, edits.upperWidth].every(number => Number.isFinite(number) && number >= .25 && number <= 3)
    || !Number.isFinite(edits.rotation) || Math.abs(edits.rotation) > 90 || typeof edits.mirror !== 'boolean') fail();
  const points = [edits.shoulder, edits.underarm, edits.cuffTop, edits.cuffBottom, ...(value.socket?.join ?? [])];
  if (edits.contourOffsets) {
    if (Object.keys(edits.contourOffsets).some(key => !['frontJoin', 'backJoin', 'upperOuter', 'upperInner', 'midOuter', 'midInner'].includes(key))) fail();
    points.push(...Object.values(edits.contourOffsets) as SleevePoint[]);
  }
  if (!['left', 'right'].includes(value.socket?.side) || !Array.isArray(value.socket.join) || value.socket.join.length < 2 || value.socket.join.length > 256
    || points.some(point => !Array.isArray(point) || point.length !== 2 || point.some(number => !Number.isFinite(number) || Math.abs(number) > 4096))) fail();
  return structuredClone(value);
}

export function sleeveGeometry(model: SleeveReconstruction) {
  const { style, edits, socket } = model;
  const sign = socket.side === 'left' ? -1 : 1;
  const originShoulder = socket.join[0];
  const originUnderarm = socket.join.at(-1)!;
  const armhole = Math.hypot(originUnderarm[0] - originShoulder[0], originUnderarm[1] - originShoulder[1]);
  const shoulder = add(originShoulder, edits.shoulder);
  const underarm = add(originUnderarm, edits.underarm);
  const source = model.detectedStyle.sourceGarment;
  const proportionScale = source && socket.bodyWidth ? socket.bodyWidth * source.armholeToBodyWidth : armhole;
  const angle = ((source?.sleeveAngle ?? (style.lengthClass === 'long' ? 78 : 32)) + edits.rotation) * Math.PI / 180;
  const axis: SleevePoint = [sign * Math.cos(angle), Math.sin(angle)];
  const across: SleevePoint = [-sign * Math.sin(angle), Math.cos(angle)];
  let center = mix(shoulder, underarm, .5);
  if (source && model.detectedStyle.contours) {
    const referenceShoulder = model.detectedStyle.contours[edits.mirror ? 'inner' : 'outer'][0];
    const lateral = referenceShoulder[1] * (edits.mirror ? -1 : 1);
    center = [originShoulder[0] - proportionScale * edits.scale * (axis[0] * referenceShoulder[0] + across[0] * lateral),
      originShoulder[1] - proportionScale * edits.scale * (axis[1] * referenceShoulder[0] + across[1] * lateral)];
  }
  const ease = fitEase[model.fit] * clamp(style.looseness, .75, 1.4);
  const length = proportionScale * (style.contours ? style.length : clamp(style.length, style.lengthClass === 'short' ? .35 : 1.6, style.lengthClass === 'short' ? 1.15 : 2.6)) * edits.length * edits.scale;
  const upperWidth = armhole * ease * clamp(style.upperWidth, .65, 1.4) * edits.upperWidth * edits.scale;
  const openingWidth = armhole * ease * clamp(style.openingWidth, .3, 1.6) * edits.openingWidth * edits.scale;
  let endpoint: SleevePoint = [center[0] + axis[0] * length, center[1] + axis[1] * length];
  const upperCenter: SleevePoint = [center[0] + axis[0] * length * .3, center[1] + axis[1] * length * .3];
  const offset = (key: SleeveContourHandle): SleevePoint => edits.contourOffsets?.[key] ?? [0, 0];
  let upperTop = add([upperCenter[0] - across[0] * upperWidth / 2, upperCenter[1] - across[1] * upperWidth / 2], offset('upperOuter'));
  let upperBottom = add([upperCenter[0] + across[0] * upperWidth / 2, upperCenter[1] + across[1] * upperWidth / 2], offset('upperInner'));
  const slant = Math.tan(style.hemAngle * Math.PI / 180) * openingWidth / 2 * (edits.mirror ? -1 : 1);
  const topOffset = edits.cuffTop;
  const bottomOffset = edits.cuffBottom;
  let cuffTop = add([endpoint[0] - across[0] * openingWidth / 2 + axis[0] * slant, endpoint[1] - across[1] * openingWidth / 2 + axis[1] * slant], topOffset);
  let cuffBottom = add([endpoint[0] + across[0] * openingWidth / 2 - axis[0] * slant, endpoint[1] + across[1] * openingWidth / 2 - axis[1] * slant], bottomOffset);
  const joinAt = (amount: number) => {
    const position = amount * (socket.join.length - 1);
    let point = add(mix(socket.join[Math.floor(position)], socket.join[Math.ceil(position)], position % 1), mix(edits.shoulder, edits.underarm, amount));
    for (const [key, center] of [['frontJoin', 1 / 3], ['backJoin', 2 / 3]] as const) {
      const weight = Math.max(0, 1 - Math.abs(amount - center) * 3);
      point = add(point, offset(key).map(value => value * weight) as SleevePoint);
    }
    return point;
  };
  const join = [...new Set([...socket.join.map((_, index) => index / (socket.join.length - 1)), 1 / 3, 2 / 3])].sort((first, second) => first - second).map(joinAt);
  let midOuter = add(mix(upperTop, cuffTop, .55), offset('midOuter'));
  let midInner = add(mix(upperBottom, cuffBottom, .55), offset('midInner'));
  let outerContour: SleevePoint[] = [shoulder, upperTop, midOuter, cuffTop];
  let innerContour: SleevePoint[] = [underarm, upperBottom, midInner, cuffBottom];
  let outline = `M${coordinate(shoulder)} Q${coordinate(upperTop)} ${coordinate(midOuter)} L${coordinate(cuffTop)} L${coordinate(cuffBottom)} L${coordinate(midInner)} Q${coordinate(upperBottom)} ${coordinate(underarm)} ${join.slice(0, -1).reverse().map(point => `L${coordinate(point)}`).join(' ')} Z`;
  let mapDetail = (point: SleevePoint): SleevePoint => point;
  if (style.contours) {
    const reference = model.detectedStyle;
    const lengthScale = length / reference.length;
    const widthScale = proportionScale * edits.scale * style.looseness / reference.looseness;
    const upperScale = style.upperWidth / reference.upperWidth * edits.upperWidth;
    const openingScale = style.openingWidth / reference.openingWidth * edits.openingWidth;
    const hemDelta = (style.hemAngle - reference.hemAngle) * Math.PI / 180 * (edits.mirror ? -1 : 1);
    const buildContour = (outer: boolean) => {
      const path = style.contours![edits.mirror ? outer ? 'inner' : 'outer' : outer ? 'outer' : 'inner'];
      const upperKey = outer ? 'upperOuter' : 'upperInner', midKey = outer ? 'midOuter' : 'midInner';
      const mapSource = (point: SleevePoint, amount: number): SleevePoint => {
        let longitudinal = point[0] * lengthScale;
        let lateral = point[1] * widthScale * (edits.mirror ? -1 : 1) * (upperScale + (openingScale - upperScale) * clamp((amount - .28) / .72, 0, 1));
        const rotation = hemDelta * clamp((amount - .62) / .38, 0, 1);
        const relative = longitudinal - length;
        longitudinal = length + relative * Math.cos(rotation) - lateral * Math.sin(rotation);
        lateral = relative * Math.sin(rotation) + lateral * Math.cos(rotation);
        return [center[0] + axis[0] * longitudinal + across[0] * lateral, center[1] + axis[1] * longitudinal + across[1] * lateral];
      };
      const target = outer ? shoulder : underarm;
      const start = mapSource(path[0], 0);
      const mapPoint = (sourcePoint: SleevePoint, amount: number) => {
        let point = mapSource(sourcePoint, amount);
        const joinWeight = Math.max(0, 1 - amount / .35) ** 2;
        point = add(point, [(target[0] - start[0]) * joinWeight, (target[1] - start[1]) * joinWeight]);
        const weights = [amount <= .28 ? amount / .28 : Math.max(0, (.62 - amount) / .34),
          amount <= .62 ? Math.max(0, (amount - .28) / .34) : (1 - amount) / .38,
          Math.max(0, (amount - .62) / .38)];
        const keys = [upperKey, midKey] as const;
        for (let index = 0; index < keys.length; index++) point = add(point, offset(keys[index]).map(value => value * weights[index]) as SleevePoint);
        const cuffOffset = outer ? edits.cuffTop : edits.cuffBottom;
        return add(point, cuffOffset.map(value => value * weights[2]) as SleevePoint);
      };
      const at = (amount: number) => {
        const position = amount * (path.length - 1);
        return mapPoint(mix(path[Math.floor(position)], path[Math.ceil(position)], position % 1), amount);
      };
      const samples = [...new Set([...path.map((_, index) => index / (path.length - 1)), .28, .62])].sort((first, second) => first - second).map(at);
      return { samples, path, mapPoint, upper: at(.28), mid: at(.62), cuff: at(1) };
    };
    const outer = buildContour(true), inner = buildContour(false);
    mapDetail = (point: SleevePoint): SleevePoint => {
      const locate = (path: SleevePoint[]) => {
        let best = { distance: Infinity, amount: 0, lateral: path[0][1] };
        for (let index = 1; index < path.length; index++) {
          const previous = path[index - 1], next = path[index];
          const fraction = clamp((point[0] - previous[0]) / (next[0] - previous[0] || .00001), 0, 1);
          const candidate = mix(previous, next, fraction), distance = Math.abs(candidate[0] - point[0]);
          if (distance < best.distance) best = { distance, amount: (index - 1 + fraction) / (path.length - 1), lateral: candidate[1] };
        }
        return best;
      };
      const first = locate(outer.path), second = locate(inner.path);
      const fraction = clamp((point[1] - first.lateral) / (second.lateral - first.lateral || .00001), 0, 1);
      return mix(outer.mapPoint(point, first.amount), inner.mapPoint(point, second.amount), fraction);
    };
    outerContour = outer.samples; innerContour = inner.samples;
    upperTop = outer.upper; upperBottom = inner.upper; midOuter = outer.mid; midInner = inner.mid;
    cuffTop = outer.cuff; cuffBottom = inner.cuff; endpoint = mix(cuffTop, cuffBottom, .5);
    const opening = style.contours.opening?.map(mapDetail) ?? [];
    if (edits.mirror) opening.reverse();
    outline = `M${coordinate(shoulder)} ${[...outerContour.slice(1), ...opening, ...innerContour.slice().reverse(), ...join.slice(0, -1).reverse()].map(point => `L${coordinate(point)}`).join(' ')} Z`;
  }
  const bandDepth = style.cuffStyle === 'plain' ? 9 : style.cuffStyle === 'rolled' ? 28 : 40;
  const innerTop: SleevePoint = [cuffTop[0] - axis[0] * bandDepth, cuffTop[1] - axis[1] * bandDepth];
  const innerBottom: SleevePoint = [cuffBottom[0] - axis[0] * bandDepth, cuffBottom[1] - axis[1] * bandDepth];
  let seams = `M${coordinate(innerTop)} L${coordinate(innerBottom)}`;
  if (style.cuffStyle === 'ribbed' || style.cuffStyle === 'elastic') {
    for (let index = 1; index < 18; index++) seams += ` M${coordinate(mix(innerTop, innerBottom, index / 18))} L${coordinate(mix(cuffTop, cuffBottom, index / 18))}`;
  }
  if (style.cuffStyle === 'rolled') seams += ` M${coordinate(mix(innerTop, cuffTop, .45))} L${coordinate(mix(innerBottom, cuffBottom, .45))}`;
  if (style.artwork) seams = '';
  const points = [...outerContour, ...innerContour, ...join];
  const issues: string[] = [];
  if (points.some(point => point.some(number => !Number.isFinite(number) || number < 8 || number > 2040))) issues.push('Sleeve extends outside the garment canvas. Reduce length, width or rotation.');
  if (underarm[1] - shoulder[1] < 30 || (cuffBottom[0] - cuffTop[0]) * across[0] + (cuffBottom[1] - cuffTop[1]) * across[1] < 30) issues.push('Attachment points or cuff corners are crossed.');
  if (['raglan', 'dolman'].includes(style.construction)) issues.push('This construction requires a different body pattern. Choose a set-in or dropped-shoulder adaptation before accepting.');
  const cuffLongitudinal = (cuffBottom[0] - cuffTop[0]) * axis[0] + (cuffBottom[1] - cuffTop[1]) * axis[1];
  const cuffLateral = (cuffBottom[0] - cuffTop[0]) * across[0] + (cuffBottom[1] - cuffTop[1]) * across[1];
  const hemAngle = Math.atan2(-cuffLongitudinal, cuffLateral);
  const bridge = `M${coordinate(socket.join[0])} ${[...socket.join.slice(1), ...join.slice().reverse()].map(point => `L${coordinate(point)}`).join(' ')} Z`;
  const pathData = (path: SleevePoint[]) => `M${path.map(mapDetail).map(coordinate).join(' L')} Z`;
  const inkPaths = (polygons: SleevePoint[][][]) => polygons.map(polygon => `<path fill="#141414" fill-rule="evenodd" d="${polygon.map(pathData).join(' ')}"/>`).join('');
  const wrap = (content: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" width="2048" height="2048"><g transform="translate(0 0)">${content}</g></svg>`;
  const fixedColor = (color: string) => `rgb(${[1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16)).join(',')})`;
  const bodyFill = edits.bodyColor ? fixedColor(edits.bodyColor) : '#000000';
  const cuffFill = edits.cuffColor ? fixedColor(edits.cuffColor) : bodyFill;
  const cuffPath = style.cuff ? pathData(style.cuff.outline) : '';
  const cuffInk = style.cuff && style.artwork ? polygonClipping.intersection(style.artwork.polygons, [[style.cuff.outline]]) as SleevePoint[][][] : [];
  const cuffSvg = cuffPath ? wrap(`<g transform="translate(0 0)" fill="#000000"><path d="${cuffPath}"/></g>${inkPaths(cuffInk)}`) : undefined;
  const svg = wrap(`<g ${edits.bodyColor ? '' : 'transform="translate(0 0)"'} fill="${bodyFill}"><path d="${bridge}"/><path d="${outline}"/></g>${cuffPath ? `<g ${!edits.cuffColor && !edits.bodyColor ? 'transform="translate(0 0)" data-shared-fabric="true"' : ''} fill="${cuffFill}"><path d="${cuffPath}"/></g>` : ''}${style.artwork ? inkPaths(style.artwork.polygons) : `<g fill="none" stroke="#141414" stroke-width="3" stroke-linejoin="round"><path d="${outline}"/><path d="${seams}"/></g>`}`);
  return { svg, cuffSvg, shoulder, underarm, cuffTop, cuffBottom, endpoint, axis, across, length, armhole, issues,
    frontJoin: joinAt(1 / 3), backJoin: joinAt(2 / 3), upperOuter: upperTop, upperInner: upperBottom, midOuter, midInner,
    outerContour, innerContour, join, hemTilt: add(endpoint, [(axis[0] * Math.cos(hemAngle) + across[0] * Math.sin(hemAngle)) * 95, (axis[1] * Math.cos(hemAngle) + across[1] * Math.sin(hemAngle)) * 95]) };
}

export function reconstructSleeve(asset: CustomAssetDefinition, model: SleeveReconstruction): CustomAssetDefinition {
  const checked = validateSleeveReconstruction(model);
  const geometry = sleeveGeometry(checked);
  return { ...asset, svg: geometry.svg, sleeveReconstruction: checked,
    registration: { ...asset.registration, status: 'Needs review', anchors: { target: [geometry.shoulder, geometry.underarm].map(point => point.map(value => value / 2)) } } };
}

export function sleeveFromDraft(draft: SleeveDraft, side: SleeveSide): CustomAssetDefinition {
  const model: SleeveReconstruction = { version: 1, fit: draft.fit, sourceImageHash: draft.stageProvenance.sourceImageHash,
    detectedStyle: structuredClone(draft.style), style: structuredClone(draft.style), socket: draft.sockets[side], edits: defaultSleeveEdits() };
  const base: CustomAssetDefinition = { version: 1, id: `${draft.id}-${side}`, category: 'sleeve', name: `${draft.style.lengthClass === 'long' ? 'Long' : 'Short'} sleeve - ${side}`,
    svg: '', keepSvg: model.socket.keepSvg, provenance: side === draft.side ? 'front' : 'derived', source: draft.source, analysis: draft.analysis,
    compatibility: { garmentTypes: ['tshirt'], fits: [draft.fit], views: ['front'] },
    registration: { version: 1, profile: 'SleeveRegistrationProfile', layerId: side === 'left' ? 'sleeveLeft' : 'sleeveRight', side,
      socket: `studio-${draft.fit}-${side}-armhole-v1`, cuff: 'integrated', defaultTransform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0 }, status: 'Needs review' },
    validation: { version: 1, status: 'passed', checks: ['boundary', 'registration', 'render-nonempty', 'canvas-bounds'] }, colorBindings: { fabric: '#000000', ink: '#141414' } };
  return reconstructSleeve(base, model);
}

export function mirroredSleeveEdits(edits: SleeveEdits): SleeveEdits {
  const mirrorPoint = (point: SleevePoint): SleevePoint => [-point[0], point[1]];
  return { ...edits, shoulder: mirrorPoint(edits.shoulder), underarm: mirrorPoint(edits.underarm), cuffTop: mirrorPoint(edits.cuffTop), cuffBottom: mirrorPoint(edits.cuffBottom),
    ...(edits.contourOffsets ? { contourOffsets: Object.fromEntries(Object.entries(edits.contourOffsets).map(([key, point]) => [key, mirrorPoint(point!)])) } : {}) };
}

export function sleeveCuffPreview(style: SleeveStyle): string | undefined {
  if (!style.cuff || !style.artwork) return undefined;
  const pathData = (path: SleevePoint[]) => `M${path.map(point => coordinate([point[1], point[0]])).join(' L')} Z`;
  const ink = polygonClipping.intersection(style.artwork.polygons, [[style.cuff.outline]]) as SleevePoint[][][];
  const horizontal = style.cuff.outline.map(point => point[1]), vertical = style.cuff.outline.map(point => point[0]);
  const viewBox = [Math.min(...horizontal) - .03, Math.min(...vertical) - .03, Math.max(...horizontal) - Math.min(...horizontal) + .06, Math.max(...vertical) - Math.min(...vertical) + .06].join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path fill="#b8ddd3" d="${pathData(style.cuff.outline)}"/>${ink.map(polygon => `<path fill="#141414" fill-rule="evenodd" d="${polygon.map(pathData).join(' ')}"/>`).join('')}</svg>`;
}