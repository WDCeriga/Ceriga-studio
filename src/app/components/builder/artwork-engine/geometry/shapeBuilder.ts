import clipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import type { DesignElement } from '../../PrintStudioEditor';
import { fitPenPath, pathPolygons, shapeWorldPath } from '../../../../lib/artworkPathOperations';
import type { ShapePath } from '../../../../lib/shapeGeometry';
import { restoreLiveText } from '../../../../lib/booleanArtwork';

/**
 * Shape builder geometry (Illustrator's Shift+M). Pure.
 * The selection is divided into every visible piece; pieces can be merged or removed, then rebuilt as shapes.
 * Each piece remembers its owner — the top-most source covering it — which supplies colour and finish.
 */
export type BuilderPiece = { id: string; polygon: Polygon; owner: string };

const ringArea = (ring: [number, number][]) => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]); return Math.abs(a / 2); };
const polygonArea = (polygon: Polygon) => polygon.reduce((sum, ring, index) => sum + (index ? -1 : 1) * ringArea(ring as [number, number][]), 0);
const multiArea = (multi: MultiPolygon) => multi.reduce((sum, polygon) => sum + polygonArea(polygon), 0);

export function builderPieces(elements: DesignElement[], ids: string[]): BuilderPiece[] {
  const sources = elements.filter(element => ids.includes(element.id) && !element.hidden).map(element => ({ id: element.id, geometry: pathPolygons(shapeWorldPath(element)) }));
  let pieces: MultiPolygon[] = [];
  for (const { geometry } of sources) {
    const covered = pieces.length ? clipping.union(pieces[0], ...pieces.slice(1)) : [];
    const next: MultiPolygon[] = [];
    for (const piece of pieces) {
      const outside = clipping.difference(piece, geometry), inside = clipping.intersection(piece, geometry);
      if (outside.length) next.push(outside); if (inside.length) next.push(inside);
    }
    const extra = covered.length ? clipping.difference(geometry, covered) : geometry;
    if (extra.length) next.push(extra);
    pieces = next;
  }
  const minArea = 0.5; // ignore numeric slivers
  return pieces.flat().filter(polygon => polygonArea(polygon) > minArea).map((polygon, index) => {
    const area = polygonArea(polygon);
    const owner = [...sources].reverse().find(source => multiArea(clipping.intersection([polygon], source.geometry)) > area * .5)?.id ?? sources[0]?.id ?? '';
    return { id: `piece-${index}`, polygon, owner };
  });
}

/** Merge pieces into one; the first piece's owner keeps the paint. */
export function mergePieces(pieces: BuilderPiece[], mergeIds: string[]): BuilderPiece[] {
  const chosen = pieces.filter(piece => mergeIds.includes(piece.id));
  if (chosen.length < 2) return pieces;
  const merged = clipping.union([chosen[0].polygon], ...chosen.slice(1).map(piece => [piece.polygon] as MultiPolygon));
  const replacement = merged.map((polygon, index) => ({ id: `${chosen[0].id}+${index}-${Date.now()}`, polygon, owner: chosen[0].owner }));
  const at = pieces.indexOf(chosen[0]);
  const rest = pieces.filter(piece => !mergeIds.includes(piece.id));
  return [...rest.slice(0, at), ...replacement, ...rest.slice(at)];
}

export const pieceSvgPath = (polygon: Polygon) => polygon.map(ring => `M${ring.slice(0, -1).map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}Z`).join('');

/** Rebuild: every piece becomes a filled shape painted like its owner; the sources are replaced in place. */
export function rebuildFromPieces(elements: DesignElement[], ids: string[], pieces: BuilderPiece[], newId: () => string): { elements: DesignElement[]; created: string[] } {
  const sources = new Map(elements.filter(element => ids.includes(element.id)).map(element => [element.id, element]));
  // Every piece remembers the originals, so the build can be reopened or undone at any time.
  const builtFrom = { id: newId(), sources: [...sources.values()].map(element => element.builtFrom ? { ...element, builtFrom: undefined } : element) };
  const created: DesignElement[] = pieces.map(piece => {
    const base = sources.get(piece.owner) ?? [...sources.values()][0];
    const rings: ShapePath[] = piece.polygon.map(ring => ({ closed: true, nodes: ring.slice(0, -1).map(([x, y]) => ({ x, y })) }));
    const fitted = fitPenPath({ ...rings[0], subpaths: rings.slice(1) });
    return {
      ...base, ...fitted, id: newId(), type: 'shape', content: 'custom-path', shapeGeometry: 'bounds', shapeFillRule: 'evenodd',
      rotation: 0, flipHorizontal: false, flipVertical: false, children: undefined, booleanOperation: undefined, booleanSourceKey: undefined, booleanStyleKey: undefined,
      drawingVectorSource: undefined, shapeBrush: undefined, letteringParts: undefined, letteringPaints: undefined, shapeOperationSources: undefined, shapeOperationFrame: undefined,
      shapeParameters: undefined, shapeCornerRadius: 0, shapeFilled: true, shapeFillColor: base.shapeFillColor ?? base.color, layerName: 'Built shape', builtFrom,
    } as DesignElement;
  });
  const first = elements.findIndex(element => ids.includes(element.id));
  const rest = elements.filter(element => !ids.includes(element.id));
  const insertAt = elements.slice(0, first).filter(element => !ids.includes(element.id)).length;
  return { elements: [...rest.slice(0, insertAt), ...created, ...rest.slice(insertAt)], created: created.map(element => element.id) };
}

/** Replace every piece of a build with its original shapes (words come back as live text). */
export function restoreBuiltShapes(elements: DesignElement[], builtId: string): { elements: DesignElement[]; restored: string[] } {
  const first = elements.findIndex(element => element.builtFrom?.id === builtId);
  if (first < 0) return { elements, restored: [] };
  const originals = elements[first].builtFrom!.sources.map(restoreLiveText);
  const before = elements.slice(0, first).filter(element => element.builtFrom?.id !== builtId), after = elements.slice(first).filter(element => element.builtFrom?.id !== builtId);
  return { elements: [...before, ...originals, ...after], restored: originals.map(element => element.id) };
}
