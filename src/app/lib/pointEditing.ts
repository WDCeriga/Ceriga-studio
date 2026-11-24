import type { DesignElement } from '../components/builder/PrintStudioEditor';
import { flattenBoolean } from './booleanArtwork';
import { outlineLettering } from './editableLettering';
import { shapeToEditablePath } from './shapeGeometry';
import { mapShapePath, reframeEditedPath } from './artworkPathOperations';
import { simplifyArtwork } from './artworkPathCommands';

const nodeCount = (element: DesignElement) => { const path = element.shapePath; return path ? [path, ...(path.subpaths ?? [])].reduce((sum, part) => sum + part.nodes.length, 0) : 0; };
const contourCount = (element: DesignElement) => element.shapePath ? 1 + (element.shapePath.subpaths?.length ?? 0) : 0;
/**
 * Merged shapes and outlined text come back as many short straight segments. Fit them back into smooth curves
 * so each letter or piece has a handful of points, like Illustrator's Simplify, keeping the look.
 */
function tidyPoints(element: DesignElement): DesignElement {
  if (nodeCount(element) <= contourCount(element) * 10) return element;
  try { const simple = simplifyArtwork(element, 70); return nodeCount(simple) < nodeCount(element) ? { ...simple, letteringSource: element.letteringSource } : element; } catch { return element; }
}

/** Which artwork can show its anchor points. Images and groups cannot. */
export const canEditPoints = (element?: DesignElement | null) => Boolean(element && !element.locked && (element.type === 'shape' || element.type === 'text'));

/**
 * Gives any shape or text real anchor points, so it can be reshaped point by point:
 * combined shapes become one path, text becomes outlines (it can still go back to live text), basic shapes become a path.
 */
export async function withEditablePoints(element: DesignElement, fonts: { family: string; dataUrl: string }[] = []): Promise<DesignElement | null> {
  if (element.locked) return null;
  if (element.type === 'text') {
    const outlined = { ...element, ...await outlineLettering(element, fonts) } as DesignElement;
    return outlined.type === 'shape' ? tidyPoints({ ...outlined, shapePath: outlined.shapePath ?? shapeToEditablePath(outlined) }) : null;
  }
  if (element.type !== 'shape') return null;
  if (element.booleanOperation) { const flat = flattenBoolean(element); return tidyPoints({ ...flat, shapePath: flat.shapePath ?? shapeToEditablePath(flat) }); }
  if (element.shapePath) return element.letteringSource ? tidyPoints(element) : element;
  return { ...element, shapePath: shapeToEditablePath(element), shapeCornerRadius: 0, shapeParameters: undefined };
}

/**
 * Slants a path like italic type. The amount is stored as an angle so it reads back in the panel,
 * and each change applies only the difference, so point edits made in between are kept.
 */
export function slantPatch(element: DesignElement, angle: number): Partial<DesignElement> {
  const path = element.shapePath ?? shapeToEditablePath(element), clamp = Math.max(-60, Math.min(60, angle));
  const delta = Math.tan(clamp * Math.PI / 180) - Math.tan((element.shapeSlant ?? 0) * Math.PI / 180);
  if (Math.abs(delta) < 1e-6) return { shapeSlant: clamp };
  const w = element.width, h = element.height;
  const sheared = mapShapePath(path, point => { const x = point.x / 100 * w, y = point.y / 100 * h; return { x: (x + (h / 2 - y) * delta) / w * 100, y: point.y }; });
  return { ...reframeEditedPath({ ...element, shapePath: sheared }, sheared), shapeSlant: clamp, shapeCornerRadius: 0, shapeParameters: undefined };
}
