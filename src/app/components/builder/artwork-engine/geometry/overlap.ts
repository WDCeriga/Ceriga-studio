import clipping from 'polygon-clipping';
import type { DesignElement } from '../../PrintStudioEditor';
import { fitPenPath, pathPolygons, shapeWorldPath } from '../../../../lib/artworkPathOperations';
import { outlineLettering } from '../../../../lib/editableLettering';
import type { ShapePath } from '../../../../lib/shapeGeometry';
import { inkOf } from '../state/sharedProperties';

/**
 * Overlap colour (reference 19): where two objects cross, a third colour appears. The overlap is its own
 * object linked to both sources, so moving or editing either one reshapes it, and its colour stays editable.
 */
export type OverlapLink = { a: string; b: string; key?: string; frame?: { x: number; y: number; width: number; height: number } };
type FontImports = { family: string; dataUrl: string }[];
const canOverlap = (element?: DesignElement) => Boolean(element && (element.type === 'text' || (element.type === 'shape' && !element.shapeBrush)) && !element.hidden);

export function overlapIssue(elements: DesignElement[], ids: string[]): string | null {
  if (ids.length !== 2) return 'Select two objects.';
  const [a, b] = ids.map(id => elements.find(element => element.id === id));
  if (!canOverlap(a) || !canOverlap(b)) return 'Overlap works on shapes and text.';
  if (a!.overlapOf || b!.overlapOf) return 'Choose the original objects.';
  if ((a!.side ?? 'front') !== (b!.side ?? 'front')) return 'Choose objects on the same garment side.';
  return null;
}

const hex = (value: string) => /^#[0-9a-f]{6}$/i.test(value) ? [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)) : [120, 120, 120];
/** A starting colour clearly different from both inks: their mix, lifted towards white. */
export function overlapColour(a: string, b: string) {
  if (a.toLowerCase() === b.toLowerCase()) return '#ff6b6b';
  const x = hex(a), y = hex(b);
  return '#' + x.map((v, i) => Math.round((v + y[i]) / 2 + (255 - (v + y[i]) / 2) * .45).toString(16).padStart(2, '0')).join('');
}

const sourceKey = (a: DesignElement, b: DesignElement) => JSON.stringify([a, b]);

async function geometry(element: DesignElement, fonts: FontImports) {
  if (element.type !== 'text') return pathPolygons(shapeWorldPath(element));
  return pathPolygons(shapeWorldPath({ ...element, ...await outlineLettering(element, fonts), shapeFilled: true, borderWidth: 0 } as DesignElement));
}

/** The overlap's shape right now; null when the two objects no longer touch. */
export async function overlapShape(a: DesignElement, b: DesignElement, fonts: FontImports = []) {
  const shared = clipping.intersection(await geometry(a, fonts), await geometry(b, fonts));
  if (!shared.length) return null;
  const rings: ShapePath[] = shared.flatMap(polygon => polygon.map(ring => ({ closed: true, nodes: ring.slice(0, -1).map(([x, y]) => ({ x, y })) })));
  return fitPenPath({ ...rings[0], subpaths: rings.slice(1) });
}

export async function createOverlap(elements: DesignElement[], ids: string[], id: string, fonts: FontImports = []): Promise<DesignElement[]> {
  const issue = overlapIssue(elements, ids); if (issue) throw new Error(issue);
  const [a, b] = ids.map(item => elements.find(element => element.id === item)!);
  const fitted = await overlapShape(a, b, fonts);
  if (!fitted) throw new Error('Move the two objects so they overlap.');
  const colour = overlapColour(inkOf(a), inkOf(b));
  const overlap = {
    ...fitted, id, type: 'shape', content: 'custom-path', shapeGeometry: 'bounds', shapeFillRule: 'evenodd', rotation: 0, color: colour, shapeFilled: true, shapeFillColor: colour,
    borderWidth: 0, opacity: 100, side: a.side, printMethod: a.printMethod, layerName: 'Overlap colour',
    overlapOf: { a: a.id, b: b.id, key: sourceKey(a, b), frame: { x: fitted.x, y: fitted.y, width: fitted.width, height: fitted.height } },
  } as DesignElement;
  const top = Math.max(elements.indexOf(a), elements.indexOf(b));
  return [...elements.slice(0, top + 1), overlap, ...elements.slice(top + 1)];
}

/** Does this overlap need rebuilding from its sources? */
export function overlapIsStale(overlap: DesignElement, a?: DesignElement, b?: DesignElement) {
  const link = overlap.overlapOf;
  if (!link || !a || !b) return false;
  const frame = link.frame;
  return link.key !== sourceKey(a, b) || !frame || Math.abs(overlap.x - frame.x) > .01 || Math.abs(overlap.y - frame.y) > .01 || Math.abs(overlap.width - frame.width) > .01 || Math.abs(overlap.height - frame.height) > .01;
}

/** Patch for a stale overlap. If the objects no longer touch it hides until they do. */
export async function refreshOverlap(overlap: DesignElement, a: DesignElement, b: DesignElement, fonts: FontImports = []): Promise<Partial<DesignElement>> {
  const fitted = await overlapShape(a, b, fonts), key = sourceKey(a, b);
  if (!fitted) return { hidden: true, overlapOf: { ...overlap.overlapOf!, key, frame: { x: overlap.x, y: overlap.y, width: overlap.width, height: overlap.height } } };
  return { ...fitted, hidden: false, rotation: 0, overlapOf: { ...overlap.overlapOf!, key, frame: { x: fitted.x, y: fitted.y, width: fitted.width, height: fitted.height } } };
}
