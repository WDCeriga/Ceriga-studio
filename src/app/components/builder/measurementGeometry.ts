import type { MeasurementGuideDef } from './measurementGuides';
import type { LabelAttachmentLayer } from './GarmentLabelOverlay';

export interface MeasurementPoint { x: number; y: number }
export interface MeasurementShape { id: string; contours: MeasurementPoint[][] }
export type MeasurementSource = LabelAttachmentLayer & { assetName?: string };

const contourCache = new Map<string, MeasurementPoint[][]>();

export function sampleMeasurementShapes(sources: MeasurementSource[]): MeasurementShape[] {
  const base = sources.find(source => source.id === 'base');
  const cutout = !sources.some(source => source.id === 'neck') && base?.svgRaw.includes('neck-finish-') ? [{ ...base, id: 'neckCutout' }] : [];
  return [...sources, ...cutout].filter(source => !['outline', 'stitching'].includes(source.id)).map(source => {
    const cacheKey = `${source.id === 'neckCutout' ? 'cutout:' : ''}${source.svgRaw}`;
    let contours = contourCache.get(cacheKey);
    if (!contours) {
      const parsed = new DOMParser().parseFromString(source.svgRaw, 'image/svg+xml');
      const holder = document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
      holder.style.cssText = 'position:fixed;left:-10000px;visibility:hidden';
      holder.setAttribute('width', '2048');
      holder.setAttribute('height', '2048');
      document.body.append(holder);
      try {
        const paths = source.id === 'neckCutout' ? holder.querySelectorAll<SVGPathElement>('mask[id*="neck-finish-"] path[fill="black"]') : holder.querySelectorAll<SVGPathElement>('path');
        contours = Array.from(paths).filter(path => source.id === 'neckCutout' || !path.closest('defs')).flatMap(path => {
          const data = path.getAttribute('d') ?? '';
          const matrix = holder.getCTM()!.inverse().multiply(path.getCTM()!);
          return (/m/.test(data) ? [data] : data.match(/M[^M]*/g) ?? []).map(contour => {
            const probe = document.createElementNS(holder.namespaceURI, 'path') as SVGPathElement;
            probe.setAttribute('d', contour);
            holder.append(probe);
            const length = probe.getTotalLength();
            const count = Math.min(6000, Math.max(32, Math.ceil(length * Math.hypot(matrix.a, matrix.b) / 2)));
            return Array.from({ length: count }, (_, index) => {
              const point = probe.getPointAtLength(length * index / count).matrixTransform(matrix);
              return { x: point.x, y: point.y };
            });
          });
        });
      } finally { holder.remove(); }
      if (contourCache.size > 80) contourCache.clear();
      contourCache.set(cacheKey, contours);
    }
    const matrix = new DOMMatrix(source.matrix);
    return { id: source.id, contours: contours.map(contour => contour.map(point => {
      const mapped = matrix.transformPoint(point);
      return { x: mapped.x * 1000 / 2048, y: mapped.y * 1000 / 2048 };
    })) };
  });
}

export function measurementExtent(points: MeasurementPoint[]) {
  return { left: Math.min(...points.map(point => point.x)), right: Math.max(...points.map(point => point.x)),
    top: Math.min(...points.map(point => point.y)), bottom: Math.max(...points.map(point => point.y)) };
}

const extent = measurementExtent;

function largest(contours: MeasurementPoint[][]) {
  const area = (points: MeasurementPoint[]) => Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0));
  return [...contours].sort((first, second) => area(second) - area(first));
}

function openingEdge(points: MeasurementPoint[], shoulder: MeasurementPoint): [MeasurementPoint, MeasurementPoint] {
  const bounds = extent(points);
  const center = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
  let varianceX = 0; let varianceY = 0; let covariance = 0;
  for (const point of points) {
    varianceX += (point.x - center.x) ** 2;
    varianceY += (point.y - center.y) ** 2;
    covariance += (point.x - center.x) * (point.y - center.y);
  }
  const angle = Math.atan2(2 * covariance, varianceX - varianceY) / 2;
  const projection = (point: MeasurementPoint) => point.x * Math.cos(angle) + point.y * Math.sin(angle);
  const distal = (point: MeasurementPoint) => (point.x - center.x) * (center.x - shoulder.x) + (point.y - center.y) * (center.y - shoulder.y);
  const projected = points.map(projection);
  const endpoint = (edge: number) => points.filter(point => Math.abs(projection(point) - edge) <= 1.5)
    .reduce((best, point) => distal(point) > distal(best) ? point : best);
  return [endpoint(Math.min(...projected)), endpoint(Math.max(...projected))].sort((first, second) => second.x - first.x) as [MeasurementPoint, MeasurementPoint];
}

function scan(contours: MeasurementPoint[][], height: number): number[] {
  return contours.flatMap(points => points.flatMap((start, index) => {
    const end = points[(index + 1) % points.length];
    return (start.y <= height && end.y > height) || (end.y <= height && start.y > height)
      ? [start.x + (height - start.y) * (end.x - start.x) / (end.y - start.y)] : [];
  })).sort((first, second) => first - second);
}

export function buildGeometryGuides(shapes: MeasurementShape[]): MeasurementGuideDef[] {
  const contours = (id: string) => shapes.filter(shape => shape.id === id || shape.id.startsWith(`${id}-`)).flatMap(shape => shape.contours);
  const body = contours('base');
  if (!body.length) return [];
  const bodyPoints = largest(body)[0];
  const bounds = extent(bodyPoints);
  const center = (bounds.left + bounds.right) / 2;
  const rawNeck = contours('neckCutout');
  const neck = largest(rawNeck.length ? rawNeck : contours('neck'));
  const neckPoints = neck[0] ?? [];
  const topPoint = (points: MeasurementPoint[]) => points.reduce((best, point) => point.y < best.y ? point : best);
  const highLeft = neckPoints.length ? neckPoints.reduce((best, point) => point.x < best.x ? point : best) : topPoint(bodyPoints.filter(point => point.x < center));
  const highRight = neckPoints.length ? neckPoints.reduce((best, point) => point.x > best.x ? point : best) : topPoint(bodyPoints.filter(point => point.x >= center));
  const rightSleeve = largest(contours('sleeveRight'))[0] ?? [];
  const leftSleeve = largest(contours('sleeveLeft'))[0] ?? [];
  const shoulderRight = rightSleeve.length ? topPoint(rightSleeve) : highRight;
  const shoulderLeft = leftSleeve.length ? topPoint(leftSleeve) : highLeft;
  const sleeveInnerX = rightSleeve.length ? extent(rightSleeve).left : shoulderRight.x;
  const underarm = rightSleeve.length ? rightSleeve.filter(point => point.x <= sleeveInnerX + 1.5).reduce((best, point) => point.y > best.y ? point : best) : shoulderRight;
  const chestY = Math.min(bounds.bottom, Math.max(underarm.y, shoulderRight.y) + 1);
  const chest = scan([bodyPoints, ...contours('sleeveLeft'), ...contours('sleeveRight'), ...contours('sleeveHemLeft'), ...contours('sleeveHemRight')], chestY);
  const chestLeft = chest.filter(x => x < center).at(-1) ?? bounds.left;
  const chestRight = chest.find(x => x > center) ?? bounds.right;
  const hem = contours('bodyHem');
  const hemPoints = hem.length ? largest(hem)[0] : bodyPoints.filter(point => point.y > bounds.bottom - (bounds.bottom - bounds.top) * .1);
  const hemBounds = extent(hemPoints);
  const lowerPoint = (points: MeasurementPoint[]) => points.reduce((best, point) => point.y > best.y ? point : best);
  const hemLeft = lowerPoint(hemPoints.filter(point => point.x <= hemBounds.left + 1.5));
  const hemRight = lowerPoint(hemPoints.filter(point => point.x >= hemBounds.right - 1.5));
  const cuff = largest(contours('underlayerHemRight'))[0] ?? largest(contours('sleeveHemRight'))[0];
  const cuffPoints = cuff ?? rightSleeve;
  const [cuffTop, cuffBottom] = cuffPoints.length ? openingEdge(cuffPoints, shoulderRight) : [shoulderRight, underarm];
  const inner = rawNeck.length ? neckPoints : neck[1] ?? largest(contours('innerBackNeck'))[0] ?? neckPoints;
  const neckBottom = inner.length ? inner.reduce((best, point) => point.y > best.y ? point : best) : highLeft;
  const openingLeft = inner.length ? inner.reduce((best, point) => point.x < best.x ? point : best) : highLeft;
  const openingRight = inner.length ? inner.reduce((best, point) => point.x > best.x ? point : best) : highRight;
  const neckReference = openingLeft.y + (openingRight.y - openingLeft.y) * (neckBottom.x - openingLeft.x) / Math.max(1, openingRight.x - openingLeft.x);
  const leftLabel = Math.max(90, bounds.left - 135);
  const rightLabel = Math.min(910, extent([...rightSleeve, cuffTop]).right + 90);
  const topLabel = Math.max(22, Math.min(highLeft.y, highRight.y) - 65);
  const guide = (id: MeasurementGuideDef['id'], label: string, start: MeasurementPoint, end: MeasurementPoint, labelX: number, labelY: number, dimensionY?: number, dimensionX?: number): MeasurementGuideDef => ({
    id, label, x1: start.x, y1: start.y, x2: end.x, y2: end.y, labelX, labelY, labelAlign: 'center', dimensionX, dimensionY,
  });
  return [
    guide('halfLength', 'Half Length', highLeft, { x: highLeft.x, y: measurementHemAt(shapes, highLeft.x) ?? hemBounds.bottom }, leftLabel, (highLeft.y + hemBounds.bottom) / 2, undefined, bounds.left - 25),
    guide('chestWidth', 'Chest Width', { x: chestLeft, y: chestY }, { x: chestRight, y: chestY }, rightLabel, Math.min(955, Math.max(chestY + 65, cuffBottom.y + 65))),
    guide('bottomWidth', 'Bottom Width', hemLeft, hemRight, center, Math.min(978, hemBounds.bottom + 50), hemBounds.bottom + 20),
    guide('sleeveLength', 'Sleeve Length', shoulderRight, cuffTop, rightLabel, (shoulderRight.y + cuffTop.y) / 2 - 35),
    guide('armhole', 'Armhole', shoulderRight, underarm, shoulderRight.x - 85, (shoulderRight.y + underarm.y) / 2),
    guide('sleeveOpening', 'Sleeve Opening', cuffTop, cuffBottom, rightLabel, cuffBottom.y + 20),
    guide('neckOpening', 'Neck Opening', openingLeft, openingRight, center, topLabel, topLabel + 22),
    guide('neckDrop', 'Neck Drop', { x: neckBottom.x, y: neckReference }, neckBottom, openingLeft.x - 95, (neckReference + neckBottom.y) / 2),
    guide('shoulderWidth', 'Shoulder to Shoulder', shoulderLeft, shoulderRight, center, topLabel + 36, Math.min(shoulderLeft.y, shoulderRight.y) - 12),
  ];
}

export function measurementHemAt(shapes: MeasurementShape[], x: number): number | undefined {
  const contours = shapes.filter(shape => shape.id === 'bodyHem' || shape.id === 'base').flatMap(shape => shape.contours);
  const crossings = scan(contours.map(points => points.map(point => ({ x: point.y, y: point.x }))), x);
  return crossings.length ? crossings[crossings.length - 1] : undefined;
}

export function measurementSideClearance(shapes: MeasurementShape[], corners: MeasurementPoint[]): number | undefined {
  const body = largest(shapes.filter(shape => shape.id === 'base').flatMap(shape => shape.contours))[0];
  if (!body?.length || corners.length < 3) return undefined;
  const bounds = extent(corners);
  const heights = [...corners, ...body].map(point => point.y).filter(height => height >= bounds.top && height <= bounds.bottom);
  let clearance = Infinity;
  for (const height of heights) {
    const sampleY = Math.max(bounds.top + .0001, Math.min(bounds.bottom - .0001, height));
    const patchEdges = scan([corners], sampleY);
    const bodyEdges = scan([body], sampleY);
    if (patchEdges.length < 2 || bodyEdges.length < 2) continue;
    const left = patchEdges[0], right = patchEdges[patchEdges.length - 1];
    const center = (left + right) / 2;
    const pair = bodyEdges.findIndex((edge, index) => index % 2 === 0 && edge <= center && bodyEdges[index + 1] >= center);
    if (pair < 0) return undefined;
    clearance = Math.min(clearance, left - bodyEdges[pair], bodyEdges[pair + 1] - right);
  }
  return Number.isFinite(clearance) ? clearance : undefined;
}