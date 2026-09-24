import type { MeasurementGuideDef } from './measurementGuides';

export interface MeasurementPoint { x: number; y: number }
export interface MeasurementShape { id: string; contours: MeasurementPoint[][] }
export interface MeasurementSource { id: string; svgRaw: string; matrix: string }

const contourCache = new Map<string, MeasurementPoint[][]>();

export function sampleMeasurementShapes(sources: MeasurementSource[]): MeasurementShape[] {
  return sources.map(source => {
    let contours = contourCache.get(source.svgRaw);
    if (!contours) {
      const parsed = new DOMParser().parseFromString(source.svgRaw, 'image/svg+xml');
      const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      holder.style.cssText = 'position:fixed;left:-10000px;visibility:hidden';
      document.body.append(holder);
      try {
        contours = Array.from(parsed.querySelectorAll('path')).filter(path => !path.closest('defs')).flatMap(path => {
          const data = path.getAttribute('d') ?? '';
          return (/m/.test(data) ? [data] : data.match(/M[^M]*/g) ?? []).map(contour => {
            const probe = document.createElementNS(holder.namespaceURI, 'path') as SVGPathElement;
            probe.setAttribute('d', contour);
            holder.append(probe);
            const length = probe.getTotalLength();
            const count = Math.min(1600, Math.max(16, Math.ceil(length / 40)));
            return Array.from({ length: count }, (_, index) => {
              const point = probe.getPointAtLength(length * index / count);
              return { x: point.x / 10, y: 2048 - point.y / 10 };
            });
          });
        });
      } finally { holder.remove(); }
      if (contourCache.size > 80) contourCache.clear();
      contourCache.set(source.svgRaw, contours);
    }
    const matrix = new DOMMatrix(source.matrix);
    return { id: source.id, contours: contours.map(contour => contour.map(point => {
      const mapped = matrix.transformPoint(point);
      return { x: mapped.x * 1000 / 2048, y: mapped.y * 1000 / 2048 };
    })) };
  });
}

function extent(points: MeasurementPoint[]) {
  return { left: Math.min(...points.map(point => point.x)), right: Math.max(...points.map(point => point.x)),
    top: Math.min(...points.map(point => point.y)), bottom: Math.max(...points.map(point => point.y)) };
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
  const bodyPoints = body.flat();
  const bounds = extent(bodyPoints);
  const center = (bounds.left + bounds.right) / 2;
  const neck = contours('neck');
  const neckPoints = neck.flat();
  const sleeves = contours('sleeves').flat();
  const topPoint = (points: MeasurementPoint[]) => points.reduce((best, point) => point.y < best.y ? point : best);
  const bodyTop = bodyPoints.filter(point => point.x < center);
  const highLeft = topPoint(neckPoints.filter(point => point.x < center).length ? neckPoints.filter(point => point.x < center) : bodyTop);
  const highRight = topPoint(neckPoints.filter(point => point.x >= center).length ? neckPoints.filter(point => point.x >= center) : bodyPoints.filter(point => point.x >= center));
  const rightSleeve = sleeves.filter(point => point.x > center);
  const leftSleeve = sleeves.filter(point => point.x < center);
  const shoulderRight = rightSleeve.length ? topPoint(rightSleeve) : highRight;
  const shoulderLeft = leftSleeve.length ? topPoint(leftSleeve) : highLeft;
  const underarm = rightSleeve.length ? rightSleeve.reduce((best, point) => point.x < best.x ? point : best) : shoulderRight;
  const chestY = Math.min(bounds.bottom - 15, Math.max(underarm.y, shoulderRight.y) + 12);
  const chest = scan(body, chestY);
  const hem = contours('bodyHem');
  const hemPoints = hem.length ? hem.flat() : bodyPoints.filter(point => point.y > bounds.bottom - (bounds.bottom - bounds.top) * .1);
  const hemLeft = hemPoints.reduce((best, point) => point.x < best.x ? point : best);
  const hemRight = hemPoints.reduce((best, point) => point.x > best.x ? point : best);
  const cuff = contours('sleeveHem').flat().filter(point => point.x > center);
  const cuffPoints = cuff.length ? cuff : rightSleeve.filter(point => point.x > (shoulderRight.x + extent(rightSleeve.length ? rightSleeve : [shoulderRight]).right) / 2);
  const cuffTop = cuffPoints.length ? topPoint(cuffPoints) : shoulderRight;
  const cuffBottom = cuffPoints.length ? cuffPoints.reduce((best, point) => point.y > best.y ? point : best) : underarm;
  const inner = [...neck].sort((first, second) => {
    const firstBounds = extent(first); const secondBounds = extent(second);
    return (secondBounds.right - secondBounds.left) * (secondBounds.bottom - secondBounds.top) - (firstBounds.right - firstBounds.left) * (firstBounds.bottom - firstBounds.top);
  })[1] ?? neckPoints;
  const neckBottom = inner.length ? inner.reduce((best, point) => point.y > best.y ? point : best) : highLeft;
  const guide = (id: MeasurementGuideDef['id'], label: string, start: MeasurementPoint, end: MeasurementPoint, labelX: number, labelY: number, dimensionY?: number, dimensionX?: number): MeasurementGuideDef => ({
    id, label, x1: start.x, y1: start.y, x2: end.x, y2: end.y, labelX, labelY, labelAlign: 'center', dimensionX, dimensionY,
  });
  return [
    guide('halfLength', 'A', highLeft, { x: highLeft.x, y: extent(hemPoints).bottom }, 75, 650, undefined, 125),
    guide('chestWidth', 'B', { x: chest[0] ?? bounds.left, y: chestY }, { x: chest[chest.length - 1] ?? bounds.right, y: chestY }, 850, 510),
    guide('bottomWidth', 'C', hemLeft, hemRight, 500, 945, 915),
    guide('sleeveLength', 'D', shoulderRight, cuffTop, 850, 220),
    guide('armhole', 'E', shoulderRight, underarm, 850, 415),
    guide('sleeveOpening', 'F', cuffTop, cuffBottom, 865, 320),
    guide('neckOpening', 'G', highLeft, highRight, 360, 55, 90),
    guide('neckDrop', 'H', { x: neckBottom.x, y: Math.min(highLeft.y, highRight.y) }, neckBottom, 170, 220),
    guide('shoulderWidth', 'I', shoulderLeft, shoulderRight, 640, 55, 115),
  ];
}