import { bodyPanelSeams, hoodieNecklineLandmarks } from '../../data/hoodieAuthoredSeams';
import { hoodieNeckGeometry } from '../../data/hoodieNeckGeometry';
import { washSource } from '../../data/garmentWash';

export interface MeasurementPoint { x: number; y: number }
export interface MeasurementSource { id: string; assetId: string; svgRaw: string; matrix: string; displayName?: string }
export interface GeometryMeasurement {
  id: string; label: string; start: MeasurementPoint; end: MeasurementPoint;
  valueCm: number; view: 'front' | 'back'; sourceId: string;
}
export interface HoodieMeasurementSnapshot { measurements: GeometryMeasurement[]; referenceWidthCm: number; view: 'front' | 'back' }
type Raster = { pixels: Uint8ClampedArray; boundary: MeasurementPoint[]; minX: number; maxX: number; minY: number; maxY: number };
const size = 2048;
const cache = new Map<string, Promise<Raster>>();

export function sampleMeasurementShape(raw: string): Promise<Raster> {
  const cached = cache.get(raw);
  if (cached) return cached;
  const pending = (async () => {
    const image = new Image();
    image.src = washSource(raw);
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(image, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    const boundary: MeasurementPoint[] = [];
    let minX = size, minY = size, maxX = 0, maxY = 0;
    for (let row = 0; row < size; row++) {
      let left = size, right = -1;
      for (let column = 0; column < size; column++) {
        if (pixels[(row * size + column) * 4 + 3] < 128) continue;
        left = Math.min(left, column); right = column;
      }
      if (right < left) continue;
      boundary.push({ x: left, y: row }, { x: right, y: row });
      minX = Math.min(minX, left); maxX = Math.max(maxX, right);
      minY = Math.min(minY, row); maxY = row;
    }
    if (!boundary.length) throw new Error('Empty measurement source');
    return { pixels, boundary, minX, maxX, minY, maxY };
  })();
  cache.set(raw, pending);
  if (cache.size > 50) cache.delete(cache.keys().next().value!);
  pending.catch(() => cache.delete(raw));
  return pending;
}

function nearest(points: MeasurementPoint[], target: MeasurementPoint) {
  return points.reduce((best, point) => Math.hypot(point.x - target.x, point.y - target.y) < Math.hypot(best.x - target.x, best.y - target.y) ? point : best);
}

function pathEnds(pathData: string) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  return [path.getPointAtLength(0), path.getPointAtLength(path.getTotalLength())];
}

function verticalEdges(raster: Raster, column: number): [MeasurementPoint, MeasurementPoint] | undefined {
  const horizontal = Math.round(column);
  let top = size, bottom = -1;
  for (let row = raster.minY; row <= raster.maxY; row++) {
    if (raster.pixels[(row * size + horizontal) * 4 + 3] < 128) continue;
    top = Math.min(top, row); bottom = row;
  }
  return bottom > top ? [{ x: horizontal, y: top }, { x: horizontal, y: bottom }] : undefined;
}

function widestRow(raster: Raster) {
  let start = raster.boundary[0], end = raster.boundary[1];
  for (let index = 0; index < raster.boundary.length; index += 2) {
    if (raster.boundary[index + 1].x - raster.boundary[index].x <= end.x - start.x) continue;
    start = raster.boundary[index]; end = raster.boundary[index + 1];
  }
  return { start, end };
}

export async function buildHoodieMeasurements(sources: MeasurementSource[], fit: string, view: 'front' | 'back', referenceWidthCm: number): Promise<HoodieMeasurementSnapshot> {
  const snapshot: HoodieMeasurementSnapshot = { measurements: [], referenceWidthCm, view };
  if (view === 'back') return snapshot;
  const base = sources.find(source => source.id === 'base');
  const neck = hoodieNecklineLandmarks(fit);
  if (!base || !neck || !(referenceWidthCm > 0)) return snapshot;
  const rasters = new Map(await Promise.all(sources.map(async source => [source.id, await sampleMeasurementShape(source.svgRaw)] as const)));
  const body = rasters.get('base')!;
  const map = (source: MeasurementSource, point: MeasurementPoint) => {
    const mapped = new DOMMatrix(source.matrix).transformPoint(point);
    return { x: mapped.x, y: mapped.y };
  };
  const bodyLeft = map(base, { x: body.minX, y: body.maxY });
  const bodyRight = map(base, { x: body.maxX, y: body.maxY });
  const bodyWidth = Math.hypot(bodyRight.x - bodyLeft.x, bodyRight.y - bodyLeft.y);
  const cmPerUnit = referenceWidthCm / bodyWidth;
  const add = (id: string, label: string, source: MeasurementSource, start: MeasurementPoint, end: MeasurementPoint, endSource = source) => {
    const first = map(source, start), last = map(endSource, end);
    const valueCm = Math.hypot(last.x - first.x, last.y - first.y) * cmPerUnit;
    if (Number.isFinite(valueCm) && valueCm > 0) snapshot.measurements.push({ id, label, start: first, end: last, valueCm, view, sourceId: source.id });
  };
  const construction = base.displayName?.startsWith('Raglan') ? 'raglan' : base.displayName?.startsWith('Dropped') ? 'dropped-shoulder' : 'set-in';
  const seams = bodyPanelSeams(fit, 'base', construction);
  const joins = seams.filter(seam => seam.region === 'armhole').map(seam => pathEnds(seam.path));
  if (joins.length === 2) {
    const chestY = Math.ceil(Math.max(...joins.map(pair => pair[1].y)) + 1);
    const chest = body.boundary.filter(point => point.y === chestY);
    if (chest.length === 2) add('chestWidth', 'Chest width', base, chest[0], chest[1]);
  }
  const neckPoint = nearest(body.boundary, { x: neck.sideX, y: neck.sideY });
  const hemSource = sources.find(source => source.id === 'bodyHem');
  const hemRaster = hemSource ? rasters.get(hemSource.id)! : body;
  const hemAtNeck = verticalEdges(hemRaster, neckPoint.x);
  if (hemAtNeck) add('bodyLength', 'Body length', base, neckPoint, hemAtNeck[1], hemSource ?? base);
  const sleeves = ['sleeveLeft', 'sleeveRight'].map(id => sources.find(source => source.id === id));
  const shoulders = sleeves.map((source, index) => source && joins[index] ? nearest(rasters.get(source.id)!.boundary, joins[index][0]) : undefined);
  if (construction !== 'raglan' && shoulders[0] && shoulders[1]) add('shoulderWidth', 'Shoulder width', sleeves[0]!, shoulders[0], shoulders[1], sleeves[1]!);
  const sleeve = sleeves[1];
  const cuff = sources.find(source => source.id === 'sleeveHemRight');
  if (sleeve && shoulders[1] && cuff) {
    const raster = rasters.get(cuff.id)!;
    const lower = raster.boundary.filter(point => point.y >= (raster.minY + raster.maxY) / 2);
    const inner = nearest(lower, { x: raster.minX, y: raster.maxY });
    const outer = nearest(lower, { x: raster.maxX, y: raster.maxY });
    add('cuffWidth', 'Cuff width', cuff, inner, outer);
    add('sleeveLength', construction === 'raglan' ? 'Sleeve length (from neck)' : 'Sleeve length', sleeve, shoulders[1], outer, cuff);
  }
  if (hemSource) {
    const width = widestRow(hemRaster);
    add('waistbandWidth', 'Waistband width', hemSource, width.start, width.end);
    const height = verticalEdges(hemRaster, (hemRaster.minX + hemRaster.maxX) / 2);
    if (height) add('waistbandHeight', 'Waistband height', hemSource, ...height);
  }
  const hood = sources.find(source => source.id === 'hood');
  if (hood) {
    const raster = rasters.get(hood.id)!;
    const opening = await hoodieNeckGeometry(hood.svgRaw, hood.assetId);
    const openingImage = new Image(); openingImage.src = opening.hoodOpeningMask; await openingImage.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(openingImage, 0, 0);
    const pixels = context.getImageData(0, 0, size, size).data;
    const frontTopY = opening.openingBounds.minY;
    const frontTopColumns: number[] = [];
    for (let column = opening.openingBounds.minX; column <= opening.openingBounds.maxX; column++) {
      if (pixels[(frontTopY * size + column) * 4 + 3]) frontTopColumns.push(column);
    }
    if (frontTopColumns.length) {
      const frontTop = { x: frontTopColumns[Math.floor(frontTopColumns.length / 2)], y: frontTopY };
      const silhouette = verticalEdges(raster, frontTop.x);
      if (silhouette) {
        add('hoodHeight', 'Hood height', hood, frontTop, silhouette[1]);
        add('hoodBackToFrontLength', 'Hood back-to-front length', hood, silhouette[0], frontTop);
      }
    }
    let widest = { left: 0, right: 0, row: 0 };
    for (let row = opening.openingBounds.minY; row <= opening.openingBounds.maxY; row++) {
      let left = size, right = 0;
      for (let column = opening.openingBounds.minX; column <= opening.openingBounds.maxX; column++) {
        if (!pixels[(row * size + column) * 4 + 3]) continue;
        left = Math.min(left, column); right = column;
      }
      if (right - left > widest.right - widest.left) widest = { left, right, row };
    }
    add('hoodOpeningWidth', 'Hood opening width', hood, { x: widest.left, y: widest.row }, { x: widest.right, y: widest.row });
  }
  const pocket = sources.find(source => source.id === 'pocket' && /kangaroo/i.test(source.displayName ?? source.assetId));
  if (pocket) {
    const raster = rasters.get(pocket.id)!;
    const widest = widestRow(raster);
    add('pocketWidth', 'Kangaroo pocket width', pocket, widest.start, widest.end);
    const height = verticalEdges(raster, (raster.minX + raster.maxX) / 2);
    if (height) add('pocketHeight', 'Kangaroo pocket height', pocket, ...height);
  }
  return snapshot;
}