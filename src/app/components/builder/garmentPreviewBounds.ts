import { getPotraceSvgBBox, isValidBBox, type PotraceSvgBBox } from '../../lib/tshirtSvgUtils';
import type { ImportedGarment } from '../../data/importedGarment';
import type { ResolvedGarmentLayer } from '../../data/garmentSvgCatalog';

export function garmentPreviewLayerBounds(layer: Pick<ResolvedGarmentLayer, 'id' | 'svgRaw'>, importedGarment?: ImportedGarment): PotraceSvgBBox | null {
  const part = importedGarment?.parts.find(part => part.id === layer.id);
  if (part) {
    // Imported polygons/paths need not contain the transformed group required by the Potrace measurer.
    const outlineBounds = part.outline?.length ? [
      Math.min(...part.outline.map(point => point[0])), Math.min(...part.outline.map(point => point[1])),
      Math.max(...part.outline.map(point => point[0])), Math.max(...part.outline.map(point => point[1])),
    ] : undefined;
    for (const bounds of [part.geometryBounds, outlineBounds, part.bounds]) {
      if (!bounds || bounds.length !== 4 || !bounds.every(Number.isFinite)) continue;
      const [minX, minY, maxX, maxY] = bounds.map(value => value * 2048);
      if (maxX > minX && maxY > minY) return { minX, minY, maxX, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
    }
  }
  return getPotraceSvgBBox(layer.svgRaw);
}

export function garmentPreviewBounds(candidates: (PotraceSvgBBox | null)[]) {
  const bounds = candidates.filter((bound): bound is PotraceSvgBBox => bound !== null && isValidBBox(bound));
  return bounds.length ? {
    minX: Math.min(...bounds.map(bound => bound.minX)),
    minY: Math.min(...bounds.map(bound => bound.minY)),
    maxX: Math.max(...bounds.map(bound => bound.maxX)),
    maxY: Math.max(...bounds.map(bound => bound.maxY)),
  } : undefined;
}
