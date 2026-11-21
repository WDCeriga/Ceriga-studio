import type { DesignElement } from '../../PrintStudioEditor';
import { createBoolean, type BooleanOperation } from '../../../../lib/booleanArtwork';
import { pathOperationIssue } from '../../../../lib/artworkPathOperations';
import { canOutlineLettering, outlineLettering } from '../../../../lib/editableLettering';
import { shapePathData, type ShapePath } from '../../../../lib/shapeGeometry';

/**
 * Combine (plan Phase 1, F.2). Friendly names over Pathfinder jargon; text joins in directly —
 * it is outlined behind the scenes and keeps its `letteringSource`, so nothing asks the user to convert first.
 */
export const COMBINE_OPS: { op: BooleanOperation; label: string; hint: string }[] = [
  { op: 'join', label: 'Merge', hint: 'One shape from all of them' },
  { op: 'subtract', label: 'Cut out', hint: 'Top shapes cut the bottom one' },
  { op: 'intersect', label: 'Overlap', hint: 'Keep only where they overlap' },
  { op: 'exclude', label: 'Exclude', hint: 'Remove where they overlap' },
  { op: 'divide', label: 'Divide', hint: 'Split into every piece' },
];

type FontImports = { family: string; dataUrl: string }[];
const isText = (element: DesignElement) => element.type === 'text';

/** Text that can become outlines for combining (warped / vertical text stays out). */
export const isCombinableText = (element: DesignElement, imports: FontImports = []) =>
  isText(element) && !element.warp && !element.perspective && !element.verticalText && canOutlineLettering(element.fontFamily ?? 'Inter', imports);

/** Swap every combinable text layer in the selection for its outlined shape (same id, same place). */
export async function outlineTextForCombine(elements: DesignElement[], ids: string[], imports: FontImports = []): Promise<DesignElement[]> {
  // A filled shape's outline in the same colour adds nothing visually but would paint over knockouts (cut-out letters).
  const sameInk = (element: DesignElement) => element.type === 'shape' && element.shapeFilled && (element.borderWidth ?? 0) > 0
    && (element.shapeStrokeColor ?? element.color)?.toLowerCase() === (element.shapeFillColor ?? element.color)?.toLowerCase();
  elements = elements.map(element => ids.includes(element.id) && sameInk(element) ? { ...element, borderWidth: 0 } : element);
  const targets = elements.filter(element => ids.includes(element.id) && isCombinableText(element, imports));
  if (!targets.length) return elements;
  const outlined = new Map(await Promise.all(targets.map(async element => [element.id, { ...element, ...await outlineLettering(element, imports), shapeFilled: true, shapeFillColor: element.color, borderWidth: 0, layerName: element.layerName ?? `Text: ${element.content}` } as DesignElement] as const)));
  return elements.map(element => outlined.get(element.id) ?? element);
}

/** Why the selection can't combine, treating combinable text as if it were already outlined. */
export function combineIssue(elements: DesignElement[], ids: string[], imports: FontImports = []): string | null {
  const stand = elements.map(element => ids.includes(element.id) && isCombinableText(element, imports)
    ? { ...element, type: 'shape' as const, content: 'rect', shapeFilled: true } : element);
  return pathOperationIssue(stand, ids);
}

export type CombinePreview = { op: BooleanOperation; d: string; viewBox: string } | { op: BooleanOperation; empty: true };

/** Real result thumbnails for each operation (computed on prepared — outlined — elements). */
export function combinePreviews(prepared: DesignElement[], ids: string[]): CombinePreview[] {
  return COMBINE_OPS.map(({ op }) => {
    try {
      const result = createBoolean(prepared, ids, op, 'combine-preview').find(element => element.id === 'combine-preview');
      const path = result?.shapePath as ShapePath | undefined;
      if (!result || !path?.nodes.length) return { op, empty: true };
      const w = result.width, h = result.height, pad = Math.max(w, h) * .06;
      // shapePath is in 0–100 % of the element box; scale it to the element's aspect for the thumbnail.
      const scaled = (p: ShapePath): ShapePath => ({ ...p, nodes: p.nodes.map(n => ({ x: n.x * w / 100, y: n.y * h / 100, in: n.in && { x: n.in.x * w / 100, y: n.in.y * h / 100 }, out: n.out && { x: n.out.x * w / 100, y: n.out.y * h / 100 } })), subpaths: p.subpaths?.map(scaled) });
      return { op, d: shapePathData(scaled(path)), viewBox: `${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}` };
    } catch { return { op, empty: true }; }
  });
}
