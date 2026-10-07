import clipping from 'polygon-clipping';
import simplify from 'simplify-js';
import type { ImportedGarment, ImportedPart, ImportedPoint } from './importedGarment';
import { essentialBackParts } from './importedGarmentBackEssentials';

type Point = ImportedPoint;
export interface BackProportionCheck {
  label: string;
  sourceIds: string[];
  frontDerivedWidth: number;
  frontDerivedHeight: number;
  backWidth: number;
  backHeight: number;
}
export interface BackStructureReport {
  source: 'front-technical-outline-and-regions';
  category: string;
  frontRevision: number;
  sourceRegionIds: string[];
  checks: BackProportionCheck[];
  contourPointsBefore: number;
  contourPointsAfter: number;
  silhouetteDifference: number;
  attempt: number;
}
const bounds = (points: Point[]) => [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
const area = (ring: Point[]) => Math.abs(ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const geometryArea = (geometry: clipping.MultiPolygon) => geometry.reduce((sum, polygon) => sum + area(polygon[0]) - polygon.slice(1).reduce((holes, ring) => holes + area(ring), 0), 0);
const polygon = (part: ImportedPart): clipping.MultiPolygon => [[part.outline!]];
const envelope = (parts: ImportedPart[]) => clipping.union(...parts.map(polygon) as [clipping.MultiPolygon, ...clipping.MultiPolygon[]]);

/** Fair the exterior once before anatomical cuts, so neighbouring masks share exact seams. */
export function cleanBackExterior(points: Point[], tolerance: number): Point[] {
  if (points.length <= 64) return points.map(p => [...p] as Point);
  const bb = bounds(points), scale = Math.max(bb[2] - bb[0], bb[3] - bb[1]);
  let start = 0;
  points.forEach((p, i) => { if (p[1] < points[start][1] || p[1] === points[start][1] && p[0] < points[start][0]) start = i; });
  const ring = [...points.slice(start), ...points.slice(0, start)];
  let opposite = 1;
  ring.forEach((p, i) => { if (Math.hypot(p[0] - ring[0][0], p[1] - ring[0][1]) > Math.hypot(ring[opposite][0] - ring[0][0], ring[opposite][1] - ring[0][1])) opposite = i; });
  const reduce = (path: Point[]) => simplify(path.map(([x, y]) => ({ x, y })), tolerance * scale, true).map(({ x, y }): Point => [x, y]);
  const anchors = [...reduce(ring.slice(0, opposite + 1)).slice(0, -1), ...reduce([...ring.slice(opposite), ring[0]]).slice(0, -1)];
  if (anchors.length < 3 || anchors.length > 240) throw new Error('The front contour is too complex for a reliable clean back. Correct its outline first.');
  const result: Point[] = [];
  anchors.forEach((p, i) => {
    const previous = anchors[(i + anchors.length - 1) % anchors.length], next = anchors[(i + 1) % anchors.length];
    const before = Math.hypot(previous[0] - p[0], previous[1] - p[1]), after = Math.hypot(next[0] - p[0], next[1] - p[1]);
    const radius = Math.min(scale * .008, before * .2, after * .2);
    const a: Point = [p[0] + (previous[0] - p[0]) * radius / before, p[1] + (previous[1] - p[1]) * radius / before];
    const b: Point = [p[0] + (next[0] - p[0]) * radius / after, p[1] + (next[1] - p[1]) * radius / after];
    for (let step = 0; step <= 4; step++) {
      const t = step / 4;
      result.push([(1 - t) ** 2 * a[0] + 2 * t * (1 - t) * p[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * p[1] + t * t * b[1]]);
    }
  });
  const rb = bounds(result);
  return result.map(([x, y]) => [bb[0] + (x - rb[0]) * (bb[2] - bb[0]) / (rb[2] - rb[0]), bb[1] + (y - rb[1]) * (bb[3] - bb[1]) / (rb[3] - rb[1])]);
}

export function structuredBackParts(value: ImportedGarment): { parts: ImportedPart[]; report: BackStructureReport } | undefined {
  const baseline = essentialBackParts(value);
  if (!baseline) return undefined;
  const original = envelope(baseline), originalArea = geometryArea(original);
  const originalBounds = bounds(baseline.flatMap(p => p.outline!));
  const scale = Math.max(originalBounds[2] - originalBounds[0], originalBounds[3] - originalBounds[1]);
  let failure = 'The front does not support a reliable segmented back.';
  for (const [index, tolerance] of [.003, .0015].entries()) {
    try {
      const parts = essentialBackParts(value, outline => cleanBackExterior(outline, tolerance))!;
      if (parts.length !== baseline.length || parts.some(p => !p.colorable || !p.editableIndependently || !p.outline?.length || p.outline.length > 1600 || p.outline.some(v => v.some(n => !Number.isFinite(n))))) throw new Error('The clean back failed editable-region validation.');
      const checks: BackProportionCheck[] = parts.map(part => {
        const source = baseline.find(p => p.id === part.id);
        if (!source) throw new Error('The clean back lost an essential construction region.');
        const a = bounds(source.outline!), b = bounds(part.outline!);
        const frontDerivedWidth = a[2] - a[0], frontDerivedHeight = a[3] - a[1], backWidth = b[2] - b[0], backHeight = b[3] - b[1];
        if (Math.abs(frontDerivedWidth - backWidth) > scale * .012 || Math.abs(frontDerivedHeight - backHeight) > scale * .012) throw new Error(`The clean back changed ${part.name} proportions too far.`);
        return { label: part.name.replace('Estimated back ', ''), sourceIds: source.estimatedFromPartId ? [source.estimatedFromPartId] : [], frontDerivedWidth, frontDerivedHeight, backWidth, backHeight };
      });
      const cleaned = envelope(parts), totalArea = parts.reduce((sum, part) => sum + area(part.outline!), 0);
      if (Math.abs(totalArea - geometryArea(cleaned)) > 1e-7) throw new Error('The clean back contains overlapping construction regions.');
      const difference = geometryArea(clipping.xor(original, cleaned)) / originalArea;
      if (!Number.isFinite(difference) || difference > .035) throw new Error('The clean back no longer matches the front-derived silhouette.');
      return { parts, report: {
        source: 'front-technical-outline-and-regions', category: value.manifest.garmentType, frontRevision: value.revision ?? 0,
        sourceRegionIds: value.parts.filter(p => p.view === 'front' && p.structuralRole !== 'source-ink').map(p => p.id),
        checks, contourPointsBefore: baseline.reduce((sum, p) => sum + p.outline!.length, 0), contourPointsAfter: parts.reduce((sum, p) => sum + p.outline!.length, 0),
        silhouetteDifference: difference, attempt: index + 1,
      } };
    } catch (error) { failure = error instanceof Error ? error.message : failure; }
  }
  throw new Error(failure);
}
