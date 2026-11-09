import type { SurfaceArtwork, SvgSceneNode } from './artworkSurface';

/** Direct printing keeps editable artwork while excluding the sewn label construction. */
export function directPrintArtwork(value: SurfaceArtwork): SurfaceArtwork {
  const elements = value.document.elements.filter(element => {
    if (element.surfaceRole === 'border') return false;
    const source = element.svgPrecision;
    if (!source || element.type === 'text') return true;
    const physical = source.parents.some(parent =>
      'data-label-fabric' in parent.attrs || 'data-label-print-background' in parent.attrs);
    return !physical && !(element.locked && !source.owner);
  });
  const ids = new Set(elements.map(element => element.id));
  const pruneScene = (nodes: SvgSceneNode[]): SvgSceneNode[] => nodes.flatMap(node => {
    if (node.artworkId) return ids.has(node.artworkId) ? [node] : [];
    if (!node.children) return [node];
    const children = pruneScene(node.children);
    return children.length ? [{ ...node, children }] : [];
  });
  return {
    surface: { ...value.surface, background: 'transparent', clip: false },
    document: { ...value.document, elements, scene: pruneScene(value.document.scene) },
  };
}
