import { fabricCategoryForPart, type FabricPart } from './garmentFabrics';

export interface GarmentColourDefaults {
  categoryDefaults?: Record<string, string>;
  unlinkedGroups: string[];
}

/** Resolve colours at render time; inherited values are never saved as part overrides. */
export function resolveGarmentColours(
  parts: FabricPart[], mainColour: string, overrides: Partial<Record<string, string>> = {},
  defaults?: GarmentColourDefaults,
): Record<string, string> {
  const byId = new Map(parts.map(part => [part.id, part]));
  const result: Record<string, string> = {};
  const explicit = (part: FabricPart, visited = new Set<string>()): string | undefined => {
    if (visited.has(part.id)) return undefined;
    visited.add(part.id);
    if (overrides[part.id]) return overrides[part.id];
    const sourceId = part.defaultFromId ?? part.parentId;
    if (!sourceId) return undefined;
    return overrides[sourceId] ?? (byId.has(sourceId) ? explicit(byId.get(sourceId)!, visited) : undefined);
  };
  const resolve = (part: FabricPart, visited = new Set<string>()): string => {
    if (visited.has(part.id)) return mainColour;
    const seen = new Set(visited).add(part.id);
    const fallback = part.fallbackFromId ? byId.get(part.fallbackFromId) : undefined;
    return explicit(part) ?? defaults?.categoryDefaults?.[fabricCategoryForPart(part)]
      ?? (fallback ? resolve(fallback, seen) : mainColour);
  };
  for (const part of parts) result[part.id] = resolve(part);
  return { ...result, ...Object.fromEntries(Object.entries(overrides).filter((entry): entry is [string, string] => !!entry[1])) };
}

export function setPartColours(
  overrides: Partial<Record<string, string>> | undefined, partIds: string[], colour?: string,
): Partial<Record<string, string>> {
  const next = { ...overrides };
  for (const id of partIds) {
    if (colour) next[id] = colour;
    else delete next[id];
  }
  return next;
}
