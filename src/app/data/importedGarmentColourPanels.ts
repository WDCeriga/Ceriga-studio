import polygonClipping, { type MultiPolygon, type Pair } from 'polygon-clipping';
import type { ImportedGarment, ImportedPart } from './importedGarment';

type Point = Pair;
export interface ImportedColourPanel {
  id: string;
  partId: string;
  name: string;
  svg: string;
  polygons: MultiPolygon;
}
const epsilon = 1e-8;
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];
const subtract = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const interpolate = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const closeRing = (points: Point[]) => distance(points[0], points.at(-1)!) < epsilon ? points : [...points, points[0]];
const ringArea = (ring: Point[]) => Math.abs(ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + cross(p, q); }, 0) / 2);
export const colourPanelArea = (polygons: MultiPolygon) => polygons.reduce((sum, polygon) => sum + ringArea(polygon[0]) - polygon.slice(1).reduce((holes, ring) => holes + ringArea(ring), 0), 0);

function onBoundary(point: Point, ring: Point[]) {
  let best = { point, distance: Infinity, edge: 0, t: 0 };
  for (let edge = 0; edge < ring.length - 1; edge++) {
    const a = ring[edge], b = ring[edge + 1], delta = subtract(b, a);
    const lengthSquared = delta[0] ** 2 + delta[1] ** 2;
    const offset = subtract(point, a);
    const t = lengthSquared ? Math.max(0, Math.min(1, (offset[0] * delta[0] + offset[1] * delta[1]) / lengthSquared)) : 0;
    const candidate = interpolate(a, b, t), gap = distance(point, candidate);
    if (gap < best.distance) best = { point: candidate, distance: gap, edge, t };
  }
  return best;
}

function partition(polygons: MultiPolygon, mask: MultiPolygon): MultiPolygon[] {
  const inside = polygonClipping.intersection(polygons, mask), outside = polygonClipping.difference(polygons, mask);
  const minimum = Math.max(.00001, colourPanelArea(polygons) * .005);
  return colourPanelArea(inside) >= minimum && colourPanelArea(outside) >= minimum ? [inside, outside] : [polygons];
}

/** Only boundary-to-boundary paths (or closed seams) divide colour, never unfinished interior strokes. */
export function splitColourPanel(polygons: MultiPolygon, seam: Point[]): MultiPolygon[] {
  if (seam.length < 2 || seam.some(point => point.length !== 2 || !point.every(Number.isFinite))) return [polygons];
  const path = seam.filter((point, i) => !i || distance(point, seam[i - 1]) > epsilon);
  if (path.length < 2) return [polygons];
  if (path.length > 3 && distance(path[0], path.at(-1)!) < epsilon) return partition(polygons, [[closeRing(path)]]);
  for (const polygon of polygons) {
    const ring = closeRing(polygon[0]);
    const points = path.map(point => [...point] as Point);
    // AI polylines can stop a few pixels short of the traced edge. Bridge only this local registration gap.
    for (const index of [0, points.length - 1]) {
      const nearest = onBoundary(points[index], ring);
      if (nearest.distance <= .012) points[index] = nearest.point;
    }
    const hits: { point: Point; station: number; edge: number; t: number }[] = [];
    for (let segment = 0; segment < points.length - 1; segment++) {
      const a = points[segment], direction = subtract(points[segment + 1], a);
      for (let edge = 0; edge < ring.length - 1; edge++) {
        const b = ring[edge], boundary = subtract(ring[edge + 1], b), denominator = cross(direction, boundary);
        if (Math.abs(denominator) < epsilon) continue;
        const offset = subtract(b, a), t = cross(offset, boundary) / denominator, u = cross(offset, direction) / denominator;
        if (t >= -epsilon && t <= 1 + epsilon && u >= -epsilon && u <= 1 + epsilon)
          hits.push({ point: interpolate(a, points[segment + 1], Math.max(0, Math.min(1, t))), station: segment + Math.max(0, Math.min(1, t)), edge, t: Math.max(0, Math.min(1, u)) });
      }
    }
    hits.sort((a, b) => a.station - b.station);
    const unique = hits.filter((hit, i) => !i || Math.abs(hit.station - hits[i - 1].station) > epsilon);
    let pieces = [polygons];
    for (let index = 0; index < unique.length - 1; index++) {
      const start = unique[index], end = unique[index + 1];
      const cut = [start.point, ...points.filter((_, station) => station > start.station + epsilon && station < end.station - epsilon), end.point];
      const boundaryWalk: Point[] = [];
      const count = ring.length - 1;
      let from = end.edge + end.t, to = start.edge + start.t;
      if (to <= from + epsilon) to += count;
      for (let vertex = Math.floor(from) + 1; vertex < to - epsilon; vertex++) boundaryWalk.push(ring[vertex % count]);
      const candidate = closeRing([...cut, ...boundaryWalk, start.point]);
      if (ringArea(candidate) > epsilon) pieces = pieces.flatMap(piece => partition(piece, [[candidate]]));
    }
    if (pieces.length > 1) return pieces;
  }
  return [polygons];
}

function connectedSeams(seams: Point[][]) {
  const paths = seams.filter(path => path.length >= 2).map(path => [...path]);
  for (let index = 0; index < paths.length; index++) {
    if (paths[index].length < 2) continue;
    let joined = true;
    while (joined && distance(paths[index][0], paths[index].at(-1)!) > epsilon) {
      joined = false;
      for (const atStart of [false, true]) {
        const endpoint = atStart ? paths[index][0] : paths[index].at(-1)!;
        const matches = paths.flatMap((path, other) => other === index || !path.length || distance(path[0], path.at(-1)!) < epsilon ? [] :
          ([true, false] as const).filter(start => distance(endpoint, start ? path[0] : path.at(-1)!) < epsilon).map(start => ({ other, start })));
        if (!matches.length) continue;
        const { other, start } = matches[0];
        const extension = start !== atStart ? paths[other] : [...paths[other]].reverse();
        paths[index] = atStart ? [...extension.slice(0, -1), ...paths[index]] : [...paths[index], ...extension.slice(1)];
        paths[other] = [];
        joined = true;
        break;
      }
    }
  }
  return paths.filter(path => path.length >= 2);
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return (result >>> 0).toString(36);
}

function panelSvg(part: ImportedPart, polygons: MultiPolygon, id: string) {
  const path = polygons.map(polygon => polygon.map(ring => `M${ring.map(([x, y]) => `${(x * 2048).toFixed(4)},${(y * 2048).toFixed(4)}`).join('L')}Z`).join('')).join('');
  const source = part.svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><g clip-path="url(#clip-${id})">${source}</g><defs><clipPath id="clip-${id}"><path d="${path}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath></defs></svg>`;
}

const cache = new WeakMap<ImportedGarment, ImportedColourPanel[]>();
export function importedColourPanels(garment: ImportedGarment): ImportedColourPanel[] {
  const cached = cache.get(garment);
  if (cached) return cached;
  const panels: ImportedColourPanel[] = [];
  if (garment.constructionVersion === 2) for (const part of garment.parts) {
    const mode = garment.manifest[part.view === 'front' ? 'frontView' : 'backView']?.processingMode ?? (garment.manifest.view === part.view ? garment.processingMode : undefined);
    if (mode === 'trace-only') continue;
    if (!part.colorable || !part.structural || !part.outline || part.outline.length < 3) continue;
    const seams = (garment.detailLayers ?? []).filter(detail => {
      if (detail.view !== part.view) return false;
      if (garment.parts.some(owner => owner.id === detail.partId)) return detail.partId === part.id;
      const proposal = garment.proposedBoundaries?.find(region => region.id === detail.partId);
      if (proposal?.attachmentTo && garment.parts.some(owner => owner.id === proposal.attachmentTo)) return proposal.attachmentTo === part.id;
      return detail.builderCategory === part.builderCategory;
    }).flatMap(detail => detail.visibleEdges)
      .filter(edge => edge.style === 'solid' && ['seam', 'panel-edge'].includes(edge.boundaryType) && edge.evidence?.trim())
      .sort((a, b) => a.id.localeCompare(b.id));
    let pieces: MultiPolygon[] = [[[closeRing(part.outline)]]];
    try {
      const paths = connectedSeams(seams.map(seam => seam.points));
      // A seam ending at another seam becomes a complete cut only after that other seam is applied.
      for (let pass = 0; pass < paths.length; pass++) {
        const count = pieces.length;
        for (const path of paths) pieces = pieces.flatMap(piece => splitColourPanel(piece, path));
        if (pieces.length === count) break;
      }
    } catch { continue; } // Invalid imported geometry must not prevent the original garment rendering.
    if (pieces.length < 2) continue;
    pieces.sort((a, b) => {
      const centre = (p: MultiPolygon) => { const points = p.flatMap(polygon => polygon[0]); return [points.reduce((s, v) => s + v[1], 0) / points.length, points.reduce((s, v) => s + v[0], 0) / points.length]; };
      const ac = centre(a), bc = centre(b);
      return ac[0] - bc[0] || ac[1] - bc[1];
    });
    pieces.forEach((polygons, index) => {
      const id = `colour-${hash(`${part.view}:${part.id}:${JSON.stringify(polygons)}`)}`;
      panels.push({ id, partId: part.id, name: `${part.name} · panel ${index + 1}`, svg: panelSvg(part, polygons, id), polygons });
    });
  }
  cache.set(garment, panels);
  return panels;
}

/** Colour-only proxies leave structural outlines, measurements and attachment identities intact. */
export function importedColourParts(garment: ImportedGarment, colors?: Partial<Record<string, string>>): ImportedPart[] {
  const panels = importedColourPanels(garment);
  return garment.parts.flatMap(part => {
    const children = panels.filter(panel => panel.partId === part.id);
    return children.length ? children.map(panel => ({ ...part, id: panel.id, name: panel.name, userFacingName: panel.name,
      colourGroup: panel.id, editableIndependently: true, symmetryPartner: null, svg: panel.svg, color: colors?.[part.id] ?? part.color })) : [part];
  });
}
