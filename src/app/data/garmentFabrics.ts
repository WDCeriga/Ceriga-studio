import { getGarmentSvgConfig, garmentLayerLabel, type GarmentSvgGarmentType, type ResolvedGarmentLayer } from './garmentSvgCatalog';

export type FabricTextureType = 'jersey' | 'interlock' | 'terry' | 'loopback' | 'fleece' | 'brushed-fleece' | 'rib-1x1' | 'rib-2x2' | 'waffle' | 'pique' | 'twill' | 'denim' | 'taslan' | 'mesh';
export interface GarmentFabric {
  id: string;
  name: string;
  category: string;
  composition: string;
  gsm: number;
  textureType: FabricTextureType;
  /** Legacy specification scale; actual map repeats live in fabricMaterial(). */
  scale: number;
  roughness: number;
  drape: string;
  thickness: string;
  stretch: string;
  sheen: number;
  structure: string;
  interiorTexture?: 'loops' | 'brushed';
}

/** Representative specifications, not claims about a supplier's actual fabric. */
export const FABRIC_LIBRARY: GarmentFabric[] = [
  { id: 'single-jersey', name: 'Single jersey', category: 'Jersey', composition: '100% cotton', gsm: 180, textureType: 'jersey', scale: 14, roughness: .35, drape: 'Fluid', thickness: 'Light', stretch: 'Moderate crosswise', sheen: .08, structure: 'Single-knit V stitches' },
  { id: 'interlock-jersey', name: 'Interlock jersey', category: 'Jersey', composition: '100% cotton', gsm: 220, textureType: 'interlock', scale: 12, roughness: .2, drape: 'Soft, stable', thickness: 'Medium', stretch: 'Moderate crosswise', sheen: .12, structure: 'Dense double knit' },
  { id: 'french-terry', name: 'French terry', category: 'Sweatshirt', composition: '100% cotton', gsm: 320, textureType: 'terry', scale: 16, roughness: .42, drape: 'Relaxed', thickness: 'Medium', stretch: 'Low to moderate', sheen: .05, structure: 'Smooth knit face; looped reverse', interiorTexture: 'loops' },
  { id: 'loopback-jersey', name: 'Loopback jersey', category: 'Sweatshirt', composition: '95% cotton / 5% elastane', gsm: 260, textureType: 'loopback', scale: 14, roughness: .3, drape: 'Fluid', thickness: 'Medium', stretch: 'Four-way', sheen: .07, structure: 'Fine jersey face; small reverse loops', interiorTexture: 'loops' },
  { id: 'heavyweight-fleece', name: 'Heavyweight fleece', category: 'Sweatshirt', composition: '80% cotton / 20% polyester', gsm: 450, textureType: 'fleece', scale: 16, roughness: .65, drape: 'Structured', thickness: 'Heavy', stretch: 'Low crosswise', sheen: .03, structure: 'Dense sweatshirt face; lofted reverse', interiorTexture: 'brushed' },
  { id: 'brushed-fleece', name: 'Brushed fleece', category: 'Sweatshirt', composition: '80% cotton / 20% polyester', gsm: 340, textureType: 'brushed-fleece', scale: 14, roughness: .8, drape: 'Soft', thickness: 'Heavy', stretch: 'Moderate crosswise', sheen: .02, structure: 'Soft knit face; brushed reverse', interiorTexture: 'brushed' },
  { id: 'rib-1x1', name: 'Rib 1×1', category: 'Rib', composition: '95% cotton / 5% elastane', gsm: 280, textureType: 'rib-1x1', scale: 18, roughness: .4, drape: 'Elastic', thickness: 'Medium', stretch: 'High crosswise', sheen: .08, structure: 'Alternating single knit and purl columns' },
  { id: 'rib-2x2', name: 'Rib 2×2', category: 'Rib', composition: '95% cotton / 5% elastane', gsm: 320, textureType: 'rib-2x2', scale: 26, roughness: .45, drape: 'Elastic, substantial', thickness: 'Heavy', stretch: 'High crosswise', sheen: .07, structure: 'Paired knit and purl columns' },
  { id: 'waffle', name: 'Waffle knit', category: 'Textured knit', composition: '100% cotton', gsm: 260, textureType: 'waffle', scale: 24, roughness: .7, drape: 'Soft, dimensional', thickness: 'Medium', stretch: 'Moderate crosswise', sheen: .03, structure: 'Recessed cellular knit' },
  { id: 'pique', name: 'Piqué', category: 'Textured knit', composition: '100% cotton', gsm: 220, textureType: 'pique', scale: 18, roughness: .55, drape: 'Stable', thickness: 'Medium', stretch: 'Low crosswise', sheen: .06, structure: 'Fine raised tuck-knit cells' },
  { id: 'cotton-twill', name: 'Cotton twill', category: 'Woven', composition: '100% cotton', gsm: 280, textureType: 'twill', scale: 14, roughness: .4, drape: 'Structured', thickness: 'Medium', stretch: 'Minimal', sheen: .12, structure: 'Fine diagonal woven ribs' },
  { id: 'denim-twill', name: 'Denim twill', category: 'Woven', composition: '100% cotton', gsm: 400, textureType: 'denim', scale: 18, roughness: .65, drape: 'Firm', thickness: 'Heavy', stretch: 'Minimal', sheen: .06, structure: 'Pronounced warp-faced diagonal twill' },
  { id: 'nylon-taslan', name: 'Nylon taslan', category: 'Technical', composition: '100% nylon', gsm: 140, textureType: 'taslan', scale: 20, roughness: .3, drape: 'Crisp, light', thickness: 'Light', stretch: 'Minimal', sheen: .3, structure: 'Air-textured plain weave' },
  { id: 'mesh', name: 'Mesh', category: 'Technical', composition: '100% polyester', gsm: 150, textureType: 'mesh', scale: 24, roughness: .45, drape: 'Fluid', thickness: 'Light', stretch: 'Moderate', sheen: .15, structure: 'Open-knit cells (visual shading only)' },
];

export interface FabricAssignments { assignments: Record<string, string>; unlinkedGroups: string[] }
export interface FabricPart { id: string; label: string; role: string; group?: string; interior?: boolean; parentId?: string }
export interface FabricTarget { id: string; label: string; partIds: string[]; group?: string }

const fabricById = new Map(FABRIC_LIBRARY.map(fabric => [fabric.id, fabric]));
const words = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[^a-z0-9]+/gi, ' ').toLowerCase();

function partRole(layer: ResolvedGarmentLayer, id: string): string {
  const name = words(`${id} ${layer.category} ${layer.displayName}`);
  if (/\b(lining|interior|inner|backing)\b/.test(name)) return 'interior';
  if (/\b(cuff|cuffs)\b|sleeve hem|underlayer hem/.test(name)) return 'cuff';
  if (/waistband|waist band/.test(name)) return 'waistband';
  if (/\bhood\b/.test(name)) return 'hood';
  if (/\b(sleeve|sleeves)\b/.test(name)) return 'sleeve';
  if (/\b(neck|neckband|neckline|collar|binding)\b/.test(name)) return 'neck';
  if (/\bpocket/.test(name)) return 'pocket';
  if (/\bhem\b/.test(name)) return 'hem';
  if (/\b(body|base|bodice)\b/.test(name)) return 'body';
  return layer.category || 'panel';
}

/** Uses resolved source identities, never asset filenames, fit names or a fixed tee part list. */
export function fabricPartsFromLayers(layers: ResolvedGarmentLayer[], garmentType: string): FabricPart[] {
  const config = getGarmentSvgConfig(garmentType as GarmentSvgGarmentType);
  const result: FabricPart[] = [];
  for (const layer of layers) {
    const name = words(`${layer.id} ${layer.category}`);
    if (layer.kind !== 'solid' || layer.washable === false && partRole(layer, layer.id) !== 'interior' || /\b(outline|stitching|stitch|fading|zip|zips|zipper|button|rivet|hardware|label|decoration|print|drawstring|drawstrings)\b/.test(name) || layer.id === 'fabric') continue;
    const ids = config?.splitSleeves && layer.id === 'sleeves' ? ['sleeveLeft', 'sleeveRight']
      : config?.splitSleeveHems && layer.id === 'sleeveHem' ? ['sleeveHemLeft', 'sleeveHemRight'] : [layer.id];
    for (const id of ids) {
      const role = partRole(layer, id);
      const knownLabel = config ? garmentLayerLabel(id, garmentType as GarmentSvgGarmentType) : id;
      const underlayer = /underlayer/i.test(id);
      const group = role === 'sleeve' ? underlayer ? 'underlayer-sleeves' : 'sleeves'
        : role === 'cuff' ? underlayer ? 'underlayer-cuffs' : 'cuffs' : undefined;
      const label = knownLabel === id ? layer.displayName : knownLabel;
      if (!result.some(part => part.id === id)) result.push({ id, label, role, group, interior: role === 'interior' });
      for (const [index, panel] of (layer.colourPanels ?? []).entries()) {
        if (!result.some(part => part.id === panel.id)) result.push({ id: panel.id, label: `${label} panel ${index + 1}`, role, parentId: id, interior: role === 'interior' });
      }
    }
  }
  // Only infer other pairs when both explicit sides share the same source identity stem.
  const pairs = new Map<string, { part: FabricPart; side: string }[]>();
  for (const part of result) {
    if (part.group || part.parentId) continue;
    const identity = words(part.id), side = identity.match(/\b(left|right)\b/)?.[1];
    if (!side) continue;
    const stem = identity.replace(/\b(left|right)\b/g, '').trim().replace(/\s+/g, '-');
    const key = `${part.role}:${stem}`;
    pairs.set(key, [...(pairs.get(key) ?? []), { part, side }]);
  }
  for (const [key, pair] of pairs) {
    if (pair.length === 2 && pair[0].side !== pair[1].side) for (const { part } of pair) part.group = `pair:${key}`;
  }
  return result;
}

const groupLabel = (group: string) => (group.startsWith('pair:') ? group.split(':').slice(2).join(' ') || group.split(':')[1] : group).replace(/-/g, ' ').replace(/^./, letter => letter.toUpperCase());
const copyState = (current?: FabricAssignments): FabricAssignments => ({ assignments: { ...current?.assignments }, unlinkedGroups: [...(current?.unlinkedGroups ?? [])] });
const members = (parts: FabricPart[], group: string) => parts.filter(part => part.group === group).sort((a, b) => a.id.localeCompare(b.id));

/** Group rows and individual rows remain available in both linked and unlinked modes. */
export function fabricTargets(parts: FabricPart[], _state?: FabricAssignments): FabricTarget[] {
  const groups = [...new Set(parts.map(part => part.group).filter((group): group is string => !!group))];
  return [
    ...groups.filter(group => members(parts, group).length > 1).map(group => ({ id: `group:${group}`, label: groupLabel(group), partIds: members(parts, group).map(part => part.id), group })),
    ...parts.map(part => ({ id: part.id, label: part.label, partIds: [part.id], group: part.group })),
  ];
}

export function assignFabric(current: FabricAssignments | undefined, parts: FabricPart[], targetId: string, fabricId: string): FabricAssignments {
  const next = copyState(current);
  if (!fabricById.has(fabricId)) return next;
  const target = fabricTargets(parts).find(candidate => candidate.id === targetId);
  if (!target) return next;
  const linked = target.group && !next.unlinkedGroups.includes(target.group);
  const ids = linked ? members(parts, target.group!).map(part => part.id) : target.partIds;
  for (const part of parts) if (ids.includes(part.id) || part.parentId && ids.includes(part.parentId)) next.assignments[part.id] = fabricId;
  return next;
}

/** Relinking chooses the lexicographically first assigned member, independent of layer paint order. */
export function setFabricGroupLinked(current: FabricAssignments | undefined, parts: FabricPart[], group: string, linked: boolean): FabricAssignments {
  const next = copyState(current), grouped = members(parts, group);
  if (!grouped.length) return next;
  next.unlinkedGroups = next.unlinkedGroups.filter(candidate => candidate !== group);
  if (!linked) next.unlinkedGroups.push(group);
  else {
    const fabricId = grouped.map(part => next.assignments[part.id]).find(id => fabricById.has(id));
    if (fabricId) {
      const ids = grouped.map(part => part.id);
      for (const part of parts) if (ids.includes(part.id) || part.parentId && ids.includes(part.parentId)) next.assignments[part.id] = fabricId;
    }
  }
  return next;
}

export const FABRIC_PRESETS = [
  { id: 'hoodie-default', name: 'Hoodie default' },
  { id: 'tshirt-default', name: 'T-shirt default' },
  { id: 'heavy-sweatshirt', name: 'Heavy sweatshirt' },
  { id: 'jersey-mesh', name: 'Jersey body · mesh sleeves · rib neck' },
  { id: 'terry-fleece', name: 'Terry body & hood · fleece sleeves · rib trims' },
  { id: 'all-single-jersey', name: 'All single jersey' },
];

export function applyFabricPreset(current: FabricAssignments | undefined, parts: FabricPart[], presetId: string): FabricAssignments {
  const next = copyState(current);
  if (!FABRIC_PRESETS.some(preset => preset.id === presetId)) return next;
  for (const part of parts) {
    const trim = ['cuff', 'waistband'].includes(part.role);
    const ribTrim = trim || part.role === 'neck' || part.role === 'hem';
    const fabricId = presetId === 'hoodie-default' ? trim || part.role === 'hem' ? 'rib-1x1' : 'french-terry'
      : presetId === 'tshirt-default' ? part.role === 'neck' ? 'rib-1x1' : 'single-jersey'
      : presetId === 'heavy-sweatshirt' ? ribTrim ? 'rib-2x2' : 'heavyweight-fleece'
      : presetId === 'all-single-jersey' ? 'single-jersey'
      : presetId === 'jersey-mesh' ? part.role === 'sleeve' ? 'mesh' : part.role === 'neck' || trim ? 'rib-1x1' : 'single-jersey'
      : part.role === 'sleeve' ? 'heavyweight-fleece' : trim ? 'rib-1x1' : 'french-terry';
    next.assignments[part.id] = fabricId;
  }
  return next;
}

export function resolvePartFabric(current: FabricAssignments | undefined, part: FabricPart): GarmentFabric | undefined {
  return fabricById.get(current?.assignments?.[part.id] ?? '') ?? (part.parentId ? fabricById.get(current?.assignments?.[part.parentId] ?? '') : undefined);
}
