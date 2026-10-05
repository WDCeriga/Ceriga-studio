import polygonClipping from 'polygon-clipping';
import type { ResolvedGarmentLayer } from './garmentSvgCatalog';
import type { ImportedGarment, ImportedGarmentView, ImportedPart, ImportedPoint } from './importedGarment';

const cross = (a: ImportedPoint, b: ImportedPoint, c: ImportedPoint) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const bounds = (points: ImportedPoint[]) => [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
const role = (part: ImportedPart) => `${part.id} ${part.name} ${part.structuralRole ?? ''}`;

function validOutline(part: ImportedPart): part is ImportedPart & { outline: ImportedPoint[] } {
  const points = part.outline;
  if (!points || points.length < 3 || points.some(p => p.length !== 2 || p.some(n => !Number.isFinite(n) || n < 0 || n > 1))) return false;
  const transform = part.transform;
  if (transform && (transform.x !== 0 || transform.y !== 0 || transform.rotation !== 0 || transform.scale !== 1)) return false;
  for (let i = 0; i < points.length; i++) for (let j = i + 2; j < points.length; j++) {
    if (i === 0 && j === points.length - 1) continue;
    const a = points[i], b = points[(i + 1) % points.length], c = points[j], d = points[(j + 1) % points.length];
    if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return false;
  }
  return true;
}

function convexHull(points: ImportedPoint[]): ImportedPoint[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (entries: ImportedPoint[]) => {
    const result: ImportedPoint[] = [];
    for (const point of entries) {
      while (result.length > 1 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop();
      result.push(point);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

function backingLayer(garment: ImportedGarment, parts: ImportedPart[], body: ImportedPart, visible: ImportedPoint[][][], colors?: Partial<Record<string, string>>, hood = false): ResolvedGarmentLayer | null {
  if (!visible.length) return null;
  const path = visible.map(polygon => polygon.map(ring => `M${ring.map(([x, y]) => `${+(x * 2048).toFixed(3)},${+(y * 2048).toFixed(3)}`).join('L')}Z`).join('')).join('');
  return {
    id: 'innerBackNeck', category: 'imported-neck-backing', assetId: `${garment.provenance.garmentVersion}:derived-neck-backing`,
    displayName: hood ? 'Inner hood fabric (preview)' : 'Inner back-neck fabric (preview)', kind: 'solid', washable: false,
    tint: body.colorable ? colors?.[body.id] ?? body.color : body.color,
    zIndex: Math.min(...parts.map(part => part.layerOrder)) - 1,
    svgRaw: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path data-derived-neck-backing=""${hood ? ' data-derived-hood-backing=""' : ''} fill="#000000" fill-rule="evenodd" d="${path}"/></svg>`,
  };
}

function hoodBackingLayer(garment: ImportedGarment, parts: ImportedPart[], hoods: ImportedPart[], colors?: Partial<Record<string, string>>): ResolvedGarmentLayer | null {
  const bodies = parts.filter(part => part.semanticType === 'body');
  const crowns = hoods.filter(part => /\bcrown\b/i.test(role(part)));
  // A panelled torso has no single body colour; its hood crown supplies the backing fabric colour.
  const fabric = bodies.length === 1 ? bodies[0] : crowns.length === 1 ? crowns[0] : null;
  if (!fabric || !validOutline(fabric) || hoods.some(part => !validOutline(part))) return null;
  try {
    const hoodBounds = bounds(hoods.flatMap(part => part.outline!));
    const touchesHood = (part: ImportedPart) => {
      const b = part.outline?.length ? bounds(part.outline) : part.bounds;
      return !b || b.length !== 4 || b[0] <= hoodBounds[2] && b[2] >= hoodBounds[0] && b[1] <= hoodBounds[3] && b[3] >= hoodBounds[1];
    };
    const closures = parts.filter(part => ['zip', 'placket', 'neckband'].includes(part.semanticType) && touchesHood(part));
    if (closures.some(part => !validOutline(part))) return null;
    // A real high-neck zipper may complete the aperture; never bridge its gap without observed closure geometry.
    const enclosure = [...hoods, ...closures];
    const hoodFabric = polygonClipping.union([enclosure[0].outline!], ...enclosure.slice(1).map(part => [part.outline!]));
    const holes = hoodFabric.flatMap(polygon => polygon.slice(1)).filter(ring => {
      const [left, top, right, bottom] = bounds(ring);
      return left >= hoodBounds[0] && right <= hoodBounds[2] && top >= hoodBounds[1] && bottom <= hoodBounds[3];
    });
    if (holes.length !== 1) return null;
    const aperture = holes[0];
    const [left, top, right, bottom] = bounds(aperture);
    const occluders = parts.filter(part => !hoods.includes(part)).filter(part => {
      if (!part.outline?.length) return true;
      const [x1, y1, x2, y2] = bounds(part.outline);
      return x1 <= right && x2 >= left && y1 <= bottom && y2 >= top;
    });
    if (occluders.some(part => !validOutline(part))) return null;
    const visible = polygonClipping.difference([aperture], hoodFabric, ...occluders.map(part => [part.outline!]));
    return backingLayer(garment, parts, fabric, visible, colors, true);
  } catch {
    return null;
  }
}

/** A preview-only fill of an observed neckline/hood opening, never a reconstructed/source part. */
export function importedNeckBackingLayer(garment: ImportedGarment, view: ImportedGarmentView, colors?: Partial<Record<string, string>>): ResolvedGarmentLayer | null {
  if (view !== 'front') return null;
  const parts = garment.parts.filter(part => part.view === view);
  const hoods = parts.filter(part => part.semanticType === 'hood');
  if (hoods.length) return hoodBackingLayer(garment, parts, hoods, colors);
  if (!/\b(t\s?shirt|tee|top|shirt|polo|henley|sweatshirt|sweater|jersey|blouse|dress)\b/i.test(garment.manifest.garmentType.replace(/[-_]/g, ' '))) return null;
  if (parts.some(part => /inner.*neck|neck.*interior/i.test(role(part)))) return null;
  const bodies = parts.filter(part => part.semanticType === 'body');
  const bands = parts.filter(part => part.semanticType === 'neckband' && !/rear|back/i.test(role(part)));
  if (bodies.length !== 1 || bands.length !== 1 || !validOutline(bodies[0]) || !validOutline(bands[0])) return null;
  const body = bodies[0], band = bands[0];
  const [left, top, right, bottom] = bounds(band.outline!);
  const [bodyLeft, bodyTop, bodyRight, bodyBottom] = bounds(body.outline!);
  const width = right - left, height = bottom - top, center = (left + right) / 2;
  if (width <= 0 || height <= 0 || left < bodyLeft || right > bodyRight || bottom > bodyTop + (bodyBottom - bodyTop) * .35) return null;
  try {
    // Closing the traced U-shaped band across its top exposes the opening without guessing an ellipse or socket.
    const openings = polygonClipping.difference([convexHull(band.outline!)], [band.outline!]).filter(polygon => {
      const [x1, y1, x2, y2] = bounds(polygon[0]);
      return x1 < center && x2 > center && x2 - x1 > width * .35 && y1 <= top + height * .15 && y2 - y1 > height * .25;
    });
    if (openings.length !== 1) return null;
    const openingBounds = bounds(openings[0][0]);
    const overlaps = (part: ImportedPart) => {
      if (!part.outline?.length) return true;
      const [x1, y1, x2, y2] = bounds(part.outline);
      return x1 <= openingBounds[2] && x2 >= openingBounds[0] && y1 <= openingBounds[3] && y2 >= openingBounds[1];
    };
    const occluders = parts.filter(part => part !== band && overlaps(part));
    if (occluders.some(part => !validOutline(part))) return null;
    // In particular retain the rear binding and subtract the Henley placket, including its button holes.
    const visible = polygonClipping.difference(openings, ...occluders.map(part => [part.outline!]))
      .filter(polygon => bounds(polygon[0])[3] > top + height * .5);
    return backingLayer(garment, parts, body, visible, colors);
  } catch {
    return null;
  }
}
