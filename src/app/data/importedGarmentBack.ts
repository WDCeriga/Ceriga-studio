import polygonClipping from 'polygon-clipping';
import { canAcceptImportedConstruction, hasImportedGarmentView, normalizeImportedGarment, type ImportedGarment, type ImportedPart, type ImportedPoint, type ImportedViewMetadata } from './importedGarment';
import { importedGarmentFamily } from './importedGarmentMeasurements';

type Point = ImportedPoint;
export type EstimatedBackResult = { available: true; garment: ImportedGarment } | { available: false; reason: string };
export const estimatedBackNotice = 'ESTIMATED back — inferred from front geometry, not observed. Rear construction and fit are unknown; edit or replace with a real back reference.';
const emptySvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"></svg>';
const evidence = 'User-requested estimated rear outline derived from front silhouette; not back-image evidence.';
const role = (part: ImportedPart) => (part.semanticType === 'panel' ? part.structuralRole || part.measurementRole || 'panel' : part.semanticType).toLowerCase().replace(/[_-]/g, ' ');
const box = (points: Point[]) => [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
const signedArea = (points: Point[]) => points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const cross = (a: Point, b: Point, c: Point) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function validOutline(points: Point[]): boolean {
  if (points.length < 3 || points.length > 4096 || !points.every(p => p.length === 2 && p.every(n => Number.isFinite(n) && n >= 0 && n <= 1)) || Math.abs(signedArea(points)) < 1e-6) return false;
  for (let i = 0; i < points.length; i++) for (let j = i + 2; j < points.length; j++) {
    if (i === 0 && j === points.length - 1) continue;
    const a = points[i], b = points[(i + 1) % points.length], c = points[j], d = points[(j + 1) % points.length];
    if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return false;
  }
  return true;
}
function cleanOutline(points: Point[]): Point[] {
  return points.filter((p, i) => (i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]) && (i !== points.length - 1 || p[0] !== points[0][0] || p[1] !== points[0][1])).map(p => [...p]);
}
const path = (points: Point[]) => `M${points.map(([x, y]) => `${+(x * 2048).toFixed(4)},${+(y * 2048).toFixed(4)}`).join('L')}Z`;
const svg = (points: Point[], outline = false) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path d="${path(points)}" fill="${outline ? 'none' : '#000000'}"${outline ? ' stroke="#172033" stroke-width="2"' : ''}/></svg>`;

/** Replace only the upper arc between geometric anchors; the sides and hem are untouched. */
function replaceTop(points: Point[], left: number, right: number, depth: number, maximumY: number): Point[] | undefined {
  if (left === right) return;
  const walk = (a: number, b: number) => { const result = [points[a]]; for (let i = (a + 1) % points.length; i !== b; i = (i + 1) % points.length) result.push(points[i]); return [...result, points[b]]; };
  const forward = walk(left, right), backward = walk(right, left);
  const upper = Math.max(...forward.map(p => p[1])) <= Math.max(...backward.map(p => p[1])) ? forward : backward;
  const rest = upper === forward ? backward : forward;
  if (upper.some(p => p[1] > maximumY)) return;
  const a = upper[0], b = upper[upper.length - 1];
  const edge: Point[] = depth ? [a, [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3 + depth], [a[0] + (b[0] - a[0]) * 2 / 3, a[1] + (b[1] - a[1]) * 2 / 3 + depth], b] : [a, b];
  return cleanOutline([...edge, ...rest.slice(1, -1)]);
}
function rearNeck(points: Point[], neck?: ImportedPart): Point[] | undefined {
  const [left, top, right, bottom] = box(points), width = right - left, height = bottom - top, middle = (left + right) / 2;
  const neckBounds = neck?.outline && validOutline(cleanOutline(neck.outline)) ? box(neck.outline) : undefined;
  const candidates = points.map((p, index) => ({ p, index })).filter(({ p }) => p[1] <= top + height * .22 && Math.abs(p[0] - middle) < width * .36);
  const pick = (side: 'left' | 'right') => candidates.filter(({ p }) => side === 'left' ? p[0] < middle : p[0] > middle).sort((a, b) => {
    if (neckBounds) return Math.hypot(a.p[0] - neckBounds[side === 'left' ? 0 : 2], a.p[1] - neckBounds[1]) - Math.hypot(b.p[0] - neckBounds[side === 'left' ? 0 : 2], b.p[1] - neckBounds[1]);
    return a.p[1] - b.p[1] || (side === 'left' ? a.p[0] - b.p[0] : b.p[0] - a.p[0]);
  })[0];
  const a = pick('left'), b = pick('right');
  if (!a || !b || b.p[0] - a.p[0] < width * .12 || b.p[0] - a.p[0] > width * .65) return;
  // A deliberately shallow technical rear neckline, not a prediction of exact neck depth.
  return replaceTop(points, a.index, b.index, Math.min(height * .012, (b.p[0] - a.p[0]) * .08), top + height * .28);
}
function rearWaist(points: Point[]): Point[] | undefined {
  const [left, top, right, bottom] = box(points), height = bottom - top;
  const upper = points.map((p, index) => ({ p, index })).filter(({ p }) => p[1] <= top + height * .25);
  const a = [...upper].sort((a, b) => a.p[0] - b.p[0])[0], b = [...upper].sort((a, b) => b.p[0] - a.p[0])[0];
  if (!a || !b || b.p[0] - a.p[0] < (right - left) * .35) return;
  return replaceTop(points, a.index, b.index, 0, top + height * .25);
}
function rearHood(points: Point[]): Point[] {
  // Exterior envelope only: no front opening, drawstrings, invented centre seam or rear panels.
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (input: Point[]) => { const result: Point[] = []; for (const point of input) { while (result.length >= 2 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop(); result.push(point); } return result.slice(0, -1); };
  return [...half(sorted), ...half([...sorted].reverse())];
}
function geometry(part: ImportedPart, points: Point[]): ImportedPart {
  const bounds = box(points);
  return { ...part, outline: points, bounds, geometryBounds: bounds, svg: svg(points), constructionSvg: svg(points, true), stitchSvg: emptySvg,
    seed: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2], area: Math.abs(signedArea(points)) * 2048 * 2048,
    measurement: { unit: 'relative', width: bounds[2] - bounds[0], height: bounds[3] - bounds[1] } };
}

function assembleBody(panels: ImportedPart[], source: ImportedPart[]): Point[] | undefined {
  const polygons = panels.map(part => [cleanOutline(part.outline!)]);
  const [left, top, right, bottom] = box(polygons.flat(2));
  const width = right - left, height = bottom - top;
  try {
    let merged = polygonClipping.union(polygons[0], ...polygons.slice(1));
    if (merged.length > 1) {
      // Only observed, body-attached central closures may bridge separated front halves.
      const ids = new Set(panels.map(part => part.id));
      const clip: Point[][] = [[[left, top], [right, top], [right, bottom], [left, bottom]]];
      for (const part of source) {
        if (!/\b(zip|placket)\b/.test(role(part)) || !ids.has(part.attachmentTo ?? '') || !part.outline || !validOutline(cleanOutline(part.outline))) continue;
        if (part.transform && (part.transform.x !== 0 || part.transform.y !== 0 || part.transform.scale !== 1 || part.transform.rotation !== 0)) continue;
        const bounds = box(part.outline);
        if (bounds[2] - bounds[0] > width * .15 || bounds[3] - bounds[1] < height * .5 || Math.abs(bounds[0] + bounds[2] - left - right) > width * .3) continue;
        const bridge = polygonClipping.intersection([cleanOutline(part.outline)], clip);
        if (bridge.length) merged = polygonClipping.union(merged, bridge);
      }
    }
    if (merged.length !== 1 || merged[0].length !== 1) return;
    return cleanOutline(merged[0][0]);
  } catch {
    return;
  }
}

/** Local, opt-in estimation only. It never contacts a provider or mutates the front/source record. */
export function generateEstimatedBack(value: ImportedGarment): EstimatedBackResult {
  const unavailable = (reason: string): EstimatedBackResult => ({ available: false, reason: `Estimated back unavailable: ${reason}` });
  if (hasImportedGarmentView(value, 'back')) return unavailable('a back view already exists. Upload a real back reference to replace it.');
  if (!canAcceptImportedConstruction(value) || !hasImportedGarmentView(value, 'front')) return unavailable('reviewed structural front outlines are required.');
  const family = importedGarmentFamily(value.manifest.garmentType);
  if (family === 'unknown') return unavailable('this garment family has no conservative rear-outline rule.');
  const source = value.parts.filter(part => part.view === 'front');
  const excluded = /\b(pocket|flap|fly|placket|button|rivet|zip|label|decoration|belt loop|collar|neckband|yoke|lining)\b/;
  const structural = source.filter(part => part.layerKind === 'structural' && !excluded.test(role(part)));
  const main = structural.filter(part => family === 'bifurcated' ? /\b(leg|panel)\b/.test(role(part)) : family === 'skirt' ? /\b(skirt|panel)\b/.test(role(part)) : /\b(body|torso|bodice)\b/.test(role(part)));
  if (!main.length) return unavailable('the main body or leg silhouette cannot be separated confidently.');
  if (!structural.every(part => /\b(body|torso|bodice|leg|panel|skirt|sleeve|cuff|hem|waistband|hood)\b/.test(role(part)))) return unavailable('an unidentified structural panel could change the rear silhouette.');
  for (const part of structural) {
    if (!part.outline || !validOutline(cleanOutline(part.outline))) return unavailable(`the ${part.name} outline is missing, degenerate or intersecting.`);
    if (part.transform && (part.transform.x !== 0 || part.transform.y !== 0 || part.transform.scale !== 1 || part.transform.rotation !== 0)) return unavailable('transformed front parts need resolved outlines first.');
  }
  const combinedBody = (family === 'top' || family === 'dress') && main.length > 1 ? assembleBody(main, source) : undefined;
  if ((family === 'top' || family === 'dress') && main.length > 1 && !combinedBody) return unavailable('the body panels do not form a connected silhouette with an observed closure.');
  const hoods = structural.filter(part => /\bhood\b/.test(role(part)));
  const groups: { part: ImportedPart; sourceIds: string[]; isMain: boolean }[] = [];
  for (const part of structural) {
    if (combinedBody && main.includes(part)) {
      if (part !== main[0]) continue;
      const fabric = [...main].sort((a, b) => Number(b.semanticType === 'body') - Number(a.semanticType === 'body') || Math.abs(signedArea(b.outline!)) - Math.abs(signedArea(a.outline!)))[0];
      groups.push({ part: geometry({ ...fabric, name: 'body', userFacingName: 'body', semanticType: 'body', structuralRole: 'body', measurementRole: 'body outline', attachmentTo: null, symmetryPartner: null }, combinedBody), sourceIds: main.map(item => item.id), isMain: true });
    } else if (hoods.length > 1 && hoods.includes(part)) {
      if (part !== hoods[0]) continue;
      groups.push({ part: geometry({ ...part, name: 'hood', userFacingName: 'hood', structuralRole: 'hood exterior', measurementRole: 'hood outline', attachmentTo: null, symmetryPartner: null }, rearHood(hoods.flatMap(item => item.outline!))), sourceIds: hoods.map(item => item.id), isMain: false });
    } else groups.push({ part, sourceIds: [part.id], isMain: main.includes(part) });
  }
  const neck = source.find(part => /\b(neckband|collar)\b/.test(role(part)));
  const ids = new Map(groups.flatMap(({ sourceIds }, index) => sourceIds.map(id => [id, `estimated-back-${index + 1}`] as const)));
  if ([...ids.values()].some(id => value.parts.some(part => part.id === id))) return unavailable('estimated part IDs conflict with an existing part.');
  const parts: ImportedPart[] = [];
  for (const { part, isMain } of groups) {
    let points: Point[] | undefined = cleanOutline(part.outline!);
    if (isMain && (family === 'top' || family === 'dress')) points = rearNeck(points, neck);
    else if (/\bhood\b/.test(role(part))) points = rearHood(points);
    else if (/\bwaistband\b/.test(role(part)) || family === 'skirt' && main.includes(part)) points = rearWaist(points);
    if (!points || !validOutline(points)) return unavailable(`the ${part.name} upper edge lacks usable rear anchors.`);
    const id = ids.get(part.id)!;
    parts.push(geometry({ ...part, id, view: 'back', name: `Estimated back ${part.name.replace(/\bfront\b/gi, '').trim()}`,
      userFacingName: `Estimated ${part.userFacingName ?? part.name}`, evidence, boundary: { boundaryType: 'silhouette', confidence: .35, evidence },
      structuralRole: part.structuralRole?.replace(/front/gi, 'back'), measurementRole: part.measurementRole?.replace(/front/gi, 'back'),
      attachmentTo: ids.get(part.attachmentTo ?? '') ?? null, symmetryPartner: ids.get(part.symmetryPartner ?? '') ?? null,
      layerOrder: value.parts.length + parts.length, editableIndependently: true, colourGroup: id,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 } }, points));
  }
  const inference: NonNullable<ImportedViewMetadata['inference']> = { kind: 'estimated-back', method: 'conservative-outline-v1', basedOnView: 'front', notice: estimatedBackNotice,
    limitations: ['Silhouette proportions are inherited assumptions, not back observations or production dimensions.',
      'Rear neckline/waistline is a conservative technical approximation; hood uses only its exterior envelope.',
      'Front-only details, pockets, labels, fasteners and stitching are omitted. Unknown rear details are not generated.',
      'No back photograph or physical calibration is supplied. A real back upload replaces this estimate.'] };
  const measurementCalibrations = { ...value.measurementCalibrations }; delete measurementCalibrations.back;
  return { available: true, garment: normalizeImportedGarment({ ...value, parts: [...value.parts, ...parts],
    manifest: { ...value.manifest, backView: { view: 'back', partIds: parts.map(part => part.id), detailLayerIds: [], inference }, uncertainties: [...value.manifest.uncertainties, estimatedBackNotice] },
    measurementCalibration: value.measurementCalibration && (value.measurementCalibration.view ?? value.manifest.view) === 'back' ? undefined : value.measurementCalibration,
    measurementCalibrations, commonCalibrationDimensions: value.commonCalibrationDimensions?.filter(item => !item.views.includes('back')),
    calibration: value.calibration && value.parts.some(part => part.id === value.calibration!.partId && part.view === 'front') ? value.calibration : undefined,
    reviewNotes: [...value.reviewNotes, estimatedBackNotice], revision: (value.revision ?? 0) + 1, reviewed: false,
  }) };
}

/** Explicit edits remain inferred and invalidate only this view's calibration. */
export function editEstimatedBackOutline(value: ImportedGarment, id: string, outline: Point[]): ImportedGarment {
  if (value.manifest.backView?.inference?.kind !== 'estimated-back' || !value.parts.some(part => part.id === id && part.view === 'back')) throw new Error('Select an estimated back part.');
  const points = cleanOutline(outline);
  if (!validOutline(points)) throw new Error('Outline must be a non-intersecting polygon inside the canvas.');
  const measurementCalibrations = { ...value.measurementCalibrations }; delete measurementCalibrations.back;
  return normalizeImportedGarment({ ...value, parts: value.parts.map(part => part.id === id ? geometry(part, points) : part), measurementCalibrations,
    measurementCalibration: value.measurementCalibration && (value.measurementCalibration.view ?? value.manifest.view) === 'back' ? undefined : value.measurementCalibration,
    calibration: value.calibration?.partId === id ? undefined : value.calibration,
    commonCalibrationDimensions: value.commonCalibrationDimensions?.filter(item => !item.views.includes('back')),
    revision: (value.revision ?? 0) + 1, reviewed: false });
}
