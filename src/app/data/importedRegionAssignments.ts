import type { ImportedGarment } from './importedGarment';
import type { FabricAssignments } from './garmentFabrics';
import { constructionRegionsForView } from './importedConstructionRegions';

export function reconcileImportedRegionAssignments(
  previous: ImportedGarment | undefined,
  next: ImportedGarment,
  partColors: Record<string, string> | undefined,
  fabricAssignments: FabricAssignments | undefined,
) {
  const regions = (garment: ImportedGarment | undefined) => garment
    ? (['front', 'back'] as const).flatMap(view => constructionRegionsForView(garment, view)?.regions ?? []) : [];
  const before = regions(previous);
  const after = regions(next);
  if (!before.length) return { partColors, fabricAssignments };
  const removed = new Set(before.filter(region => !after.some(item => item.id === region.id)).map(region => region.id));
  const remap = (values: Record<string, string>) => {
    const result = Object.fromEntries(Object.entries(values).filter(([id]) => !removed.has(id)));
    for (const region of after) {
      if (result[region.id] !== undefined || !next.parts.some(part => part.id === region.id && part.colorable)) continue;
      const candidates = new Set(region.candidateIds ?? []);
      const source = before.find(item => item.view === region.view && candidates.size > 0
        && [...candidates].every(id => item.candidateIds?.includes(id)));
      if (source && values[source.id] !== undefined) result[region.id] = values[source.id];
    }
    return result;
  };
  const removedGroups = new Set(before.map(region => region.fabricGroupId).filter(group => group && !after.some(region => region.fabricGroupId === group)));
  return {
    partColors: partColors ? remap(partColors) : partColors,
    fabricAssignments: fabricAssignments ? {
      assignments: remap(fabricAssignments.assignments),
      unlinkedGroups: fabricAssignments.unlinkedGroups.filter(group => !removedGroups.has(group)),
    } : fabricAssignments,
  };
}
