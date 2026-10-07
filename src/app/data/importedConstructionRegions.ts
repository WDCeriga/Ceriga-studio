import polygonClipping, { type MultiPolygon, type Pair } from 'polygon-clipping';
import { normalizeImportedGarment, type ImportedGarment, type ImportedGarmentView, type ImportedPart, type ImportedRegionType, type importedBuilderCategories } from './importedGarment';

export interface ConstructionRegion {
  id: string;
  label: string;
  semanticType: ImportedRegionType;
  builderCategory: keyof typeof importedBuilderCategories;
  view: ImportedGarmentView;
  /** SVG path data in the shared 2048 × 2048 coordinate system. */
  path: string;
  confidence: number;
  parentRegionId: string | null;
  mirroredPairId: string | null;
  colourGroupId: string;
  fabricGroupId: string;
  editableIndependently: boolean;
  zIndex: number;
  candidateIds?: string[];
  decorative?: boolean;
  geometrySource?: 'manual';
}
export interface ConstructionSeam {
  id: string;
  label: string;
  regionId: string;
  parts: ConstructionRegion[];
}
export interface ConstructionCandidate {
  id: string;
  label: string;
  path: string;
  bounds: number[];
  area: number;
  confidence: number;
  regionId: string | null;
}
export interface ConstructionRegions {
  candidates?: ConstructionCandidate[];
  version: 1;
  status: 'needs-review' | 'reviewed';
  regions: ConstructionRegion[];
  constructionInk: string;
  stitchingPaths: unknown[];
  hardware: unknown[];
  closures: unknown[];
  seams: ConstructionSeam[];
  warnings: string[];
}
export function constructionRegionsForView(garment: ImportedGarment, view: ImportedGarmentView): ConstructionRegions | undefined {
  return garment.manifest[view === 'front' ? 'frontView' : 'backView']?.constructionRegions ??
    (garment.manifest.view === view ? garment.constructionRegions : undefined);
}
export const isConstructionInk = (part: ImportedPart) => part.structuralRole === 'source-ink';
export const constructionRegionCategory = (type: ImportedRegionType): keyof typeof importedBuilderCategories => {
  if (['hood', 'collar', 'neckband'].includes(type)) return 'neck-hood';
  if (type === 'sleeve') return 'sleeves';
  if (['cuff', 'hem', 'waistband'].includes(type)) return 'hem-cuffs';
  if (['pocket', 'flap', 'placket', 'fly', 'zip'].includes(type)) return 'pockets-zips';
  if (['button', 'rivet', 'belt-loop', 'label', 'decoration', 'drawstring'].includes(type)) return 'trims-details';
  return 'fabric-colour';
};
export function normalizeConstructionRegions(data: ConstructionRegions): ConstructionRegions {
  return { ...data, seams: data.seams ?? [], warnings: data.warnings ?? [], regions: data.regions.map(region => {
    const partner = data.regions.find(other => other.id !== region.id && other.view === region.view &&
      (other.id === region.mirroredPairId && (!other.mirroredPairId || other.mirroredPairId === region.id) ||
        !region.mirroredPairId && other.mirroredPairId === region.id));
    const group = partner ? [region.id, partner.id].sort().join(':') : region.id;
    const parent = data.regions.find(other => other.id === region.parentRegionId && other.view === region.view);
    const category = region.semanticType === 'panel' && parent?.semanticType === 'sleeve' ? 'sleeves'
      : region.semanticType === 'pocket' ? 'pockets-zips'
      : region.builderCategory ?? constructionRegionCategory(region.semanticType);
    return { ...region, builderCategory: category,
      colourGroupId: region.colourGroupId || `colour:${group}`, fabricGroupId: region.fabricGroupId || `fabric:${group}`,
      mirroredPairId: partner?.id ?? null, parentRegionId: region.parentRegionId ?? null };
  }) };
}
export function constructionNeedsReview(garment: ImportedGarment) {
  return (['front', 'back'] as const).some(view => constructionRegionsForView(garment, view)?.status === 'needs-review');
}

/** Polygon-only edits preserve the exact locally-derived paths; curves are never approximated to invent a cut. */
function polygons(path: string): MultiPolygon {
  if (!path.trim() || /[^\d\s.,+eEMmLlHhVvZz-]/.test(path)) throw new Error('This path needs a local polygon candidate before geometry editing.');
  const tokens = path.match(/[MLHVZmlhvz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) ?? [];
  const result: MultiPolygon = [];
  let ring: Pair[] = [], point: Pair = [0, 0], command = '', index = 0;
  while (index < tokens.length) {
    if (/^[MLHVZ]$/i.test(tokens[index])) command = tokens[index++];
    const relative = command === command.toLowerCase(), upper = command.toUpperCase();
    if (upper === 'Z') {
      if (ring.length < 3) throw new Error('Region boundary is not a polygon.');
      ring.push([...ring[0]]); result.push([ring]); point = ring[0]; ring = []; command = ''; continue;
    }
    if (!command || !['M', 'L', 'H', 'V'].includes(upper)) throw new Error('Invalid region path.');
    const number = () => { const token = tokens[index++]; if (!token || /^[MLHVZ]$/i.test(token) || !Number.isFinite(Number(token))) throw new Error('Invalid region coordinate.'); return Number(token); };
    let x = point[0], y = point[1];
    if (upper === 'H') x = number() + (relative ? x : 0);
    else if (upper === 'V') y = number() + (relative ? y : 0);
    else { x = number() + (relative ? x : 0); y = number() + (relative ? y : 0); }
    if (upper === 'M' && ring.length) throw new Error('Region boundaries must be closed.');
    point = [x, y]; ring.push(point);
    if (upper === 'M') command = relative ? 'l' : 'L';
  }
  if (ring.length || !result.length) throw new Error('Region boundaries must be closed.');
  // Source candidates use even-odd fill: XOR preserves nested holes and disconnected cells exactly.
  return result.length > 1 ? polygonClipping.xor([result[0]], ...result.slice(1).map(polygon => [polygon])) : result;
}
const pathFor = (geometry: MultiPolygon) => geometry.map(polygon => polygon.map(ring => `M${ring.map(point => point.join(',')).join('L')}Z`).join('')).join('');
const area = (geometry: MultiPolygon) => geometry.reduce((sum, polygon) => sum + polygon.reduce((total, ring, index) => total + (index ? -1 : 1) * Math.abs(ring.reduce((value, p, i) => { const next = ring[(i + 1) % ring.length]; return value + p[0] * next[1] - p[1] * next[0]; }, 0) / 2), 0), 0);
const emptySvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"/>';
export function constructionRegionSvg(path: string): string {
  const escaped = path.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path fill="#000000" fill-rule="evenodd" d="${escaped}"/></svg>`;
}
function regionPart(region: ConstructionRegion, template: ImportedPart): ImportedPart {
  const geometry = polygons(region.path), points = geometry.flat(2), xs = points.map(p => p[0] / 2048), ys = points.map(p => p[1] / 2048);
  const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  return { ...template, id: region.id, name: region.label, userFacingName: region.label, semanticType: region.semanticType,
    builderCategory: region.builderCategory, view: region.view, colourGroup: region.colourGroupId, fabricGroup: region.fabricGroupId,
    symmetryPartner: region.mirroredPairId, attachmentTo: region.parentRegionId, editableIndependently: region.editableIndependently,
    colorable: region.editableIndependently && !region.decorative && !['decoration', 'label'].includes(region.semanticType),
    structuralRole: region.semanticType, layerKind: 'structural', structural: true, layerOrder: region.zIndex,
    svg: constructionRegionSvg(region.path),
    constructionSvg: emptySvg, stitchSvg: emptySvg, outline: geometry[0][0].map(([x, y]) => [x / 2048, y / 2048]),
    geometryBounds: bounds, bounds, seed: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2],
    area: area(geometry) / 2048 ** 2, measurement: { unit: 'relative', width: bounds[2] - bounds[0], height: bounds[3] - bounds[1] },
    boundary: { boundaryType: 'seam', confidence: region.confidence, evidence: template.boundary?.evidence || 'Locally derived construction boundary reviewed against source ink.' } };
}
function update(garment: ImportedGarment, view: ImportedGarmentView, data: ConstructionRegions, parts = garment.parts): ImportedGarment {
  const key = view === 'front' ? 'frontView' : 'backView';
  const current = constructionRegionsForView(garment, view);
  if (!current || current.constructionInk !== data.constructionInk) throw new Error('Source construction ink is immutable.');
  const next = normalizeConstructionRegions({ ...data, status: 'needs-review' });
  return normalizeImportedGarment({ ...garment, parts, accepted: false, reviewed: false, revision: (garment.revision ?? 0) + 1,
    ...(garment.manifest.view === view ? { constructionRegions: next } : {}),
    manifest: { ...garment.manifest, [key]: { ...garment.manifest[key], constructionRegions: next } } });
}
function selectedRegion(garment: ImportedGarment, view: ImportedGarmentView, id: string) {
  const data = constructionRegionsForView(garment, view), region = data?.regions.find(item => item.id === id && item.view === view);
  const part = garment.parts.find(item => item.id === id && item.view === view && !isConstructionInk(item));
  if (!data || !region || !part) throw new Error('Select a semantic construction region, not source ink.');
  return { data, region, part };
}
export function patchConstructionRegion(garment: ImportedGarment, view: ImportedGarmentView, id: string,
  patch: Partial<Pick<ConstructionRegion, 'label' | 'semanticType' | 'builderCategory' | 'editableIndependently' | 'decorative' | 'colourGroupId' | 'fabricGroupId'>>) {
  const { data } = selectedRegion(garment, view, id);
  if (patch.label !== undefined && !patch.label.trim()) throw new Error('A region needs a name.');
  return update(garment, view, { ...data, regions: data.regions.map(region => region.id === id ? { ...region, ...patch } : region) });
}
export function separateConstructionControls(garment: ImportedGarment, view: ImportedGarmentView, id: string) {
  const { data, region } = selectedRegion(garment, view, id);
  const next = { ...data, regions: data.regions.map(item => item.view === view && item.colourGroupId === region.colourGroupId
    ? { ...item, colourGroupId: `colour:${item.id}`, fabricGroupId: `fabric:${item.id}` } : item) };
  // Control links do not alter geometry or invalidate the construction review.
  return normalizeImportedGarment({ ...garment, revision: (garment.revision ?? 0) + 1,
    ...(garment.manifest.view === view ? { constructionRegions: next } : {}),
    manifest: { ...garment.manifest, [view === 'front' ? 'frontView' : 'backView']: {
      ...garment.manifest[view === 'front' ? 'frontView' : 'backView'], constructionRegions: next,
    } } });
}
export function linkConstructionRegions(garment: ImportedGarment, view: ImportedGarmentView, id: string, partnerId: string | null) {
  const { data } = selectedRegion(garment, view, id);
  if (partnerId === id) throw new Error('Choose a different region.');
  if (partnerId) selectedRegion(garment, view, partnerId);
  return update(garment, view, { ...data, regions: data.regions.map(region => {
    const pair = region.id === id ? partnerId : region.id === partnerId ? id : region.mirroredPairId === id || region.mirroredPairId === partnerId ? null : region.mirroredPairId;
    if (pair === region.mirroredPairId) return region;
    const group = pair ? [region.id, pair].sort().join(':') : region.id;
    return { ...region, mirroredPairId: pair, colourGroupId: `colour:${group}`, fabricGroupId: `fabric:${group}` };
  }) });
}
export function mergeConstructionRegions(garment: ImportedGarment, view: ImportedGarmentView, id: string, otherId: string) {
  const { data, region, part } = selectedRegion(garment, view, id), other = selectedRegion(garment, view, otherId).region;
  if (id === otherId) throw new Error('Choose two different regions.');
  if ([region, other].some(item => ['button', 'rivet', 'zip'].includes(item.semanticType))) throw new Error('Hardware must remain separate from fabric regions.');
  const union = polygonClipping.union(polygons(region.path), polygons(other.path));
  if (union.length !== 1 || union[0].length !== 1) throw new Error('Merge only adjoining construction regions without holes.');
  const merged = { ...region, path: pathFor(union), confidence: Math.min(region.confidence, other.confidence), mirroredPairId: null,
    colourGroupId: `colour:${id}`, fabricGroupId: `fabric:${id}`, candidateIds: [...new Set([...(region.candidateIds ?? []), ...(other.candidateIds ?? [])])] };
  const regions = data.regions.filter(item => item.id !== otherId).map(item => item.id === id ? merged : { ...item,
    ...([id, otherId].includes(item.mirroredPairId ?? '') ? { mirroredPairId: null, colourGroupId: `colour:${item.id}`, fabricGroupId: `fabric:${item.id}` } : {}),
    parentRegionId: item.parentRegionId === otherId ? id : item.parentRegionId });
  return update(garment, view, { ...data, regions, seams: data.seams.filter(seam => ![id, otherId].includes(seam.regionId)),
    candidates: data.candidates?.map(candidate => candidate.regionId === otherId ? { ...candidate, regionId: id } : candidate) },
    garment.parts.filter(item => item.id !== otherId).map(item => item.id === id ? regionPart(merged, part) : item));
}
export function canPaintConstructionRegion(region: ConstructionRegion) {
  return region.editableIndependently && !region.decorative && !['button', 'rivet', 'zip', 'label', 'decoration', 'drawstring'].includes(region.semanticType);
}

/** Manual fills change ownership, never the original ink or source evidence. */
export function paintConstructionRegion(garment: ImportedGarment, view: ImportedGarmentView,
  id: string | null, path: string, mode: 'paint' | 'erase', label = 'New fabric region'): { garment: ImportedGarment; regionId: string } {
  const data = constructionRegionsForView(garment, view);
  if (!data) throw new Error('No construction regions for this view.');
  const selected = id ? selectedRegion(garment, view, id) : undefined;
  if (selected && !canPaintConstructionRegion(selected.region)) throw new Error('Select an independently editable fabric region. Hardware and ink are protected.');
  if (!id && mode === 'erase') throw new Error('Select a region to erase from.');
  if (!id && !label.trim()) throw new Error('Give the new region a name.');
  if (!id && garment.parts.length >= 128) throw new Error('The garment has reached its 128-part limit. Merge regions before adding another.');
  let mask = polygonClipping.intersection(polygons(path), polygons('M0 0H2048V2048H0Z'));
  for (const region of data.regions.filter(region => region.view === view && !canPaintConstructionRegion(region))) {
    if (mask.length) mask = polygonClipping.difference(mask, polygons(region.path));
  }
  if (area(mask) <= 1e-4) throw new Error('This area is empty or protected. Paint over fabric instead.');
  let regionId = id ?? `${view}-manual-1`;
  for (let index = 2; !id && garment.parts.some(part => part.id === regionId); index++) regionId = `${view}-manual-${index}`;
  const changed = new Set<string>();
  const regions = data.regions.map(region => {
    if (region.view !== view || !canPaintConstructionRegion(region) || mode === 'erase' && region.id !== id) return region;
    const original = polygons(region.path);
    const geometry = region.id === id && mode === 'paint' ? polygonClipping.union(original, mask) : polygonClipping.difference(original, mask);
    if (area(polygonClipping.xor(original, geometry)) <= 1e-4) return region;
    if (area(geometry) <= 1e-4) throw new Error(`This would remove all of ${region.label}. Use a smaller brush or merge regions instead.`);
    changed.add(region.id);
    return { ...region, path: pathFor(geometry), candidateIds: [], geometrySource: 'manual' as const };
  });
  if (!id) {
    changed.add(regionId);
    regions.push({ id: regionId, label: label.trim(), semanticType: 'panel', builderCategory: 'fabric-colour', view,
      path: pathFor(mask), confidence: .5, parentRegionId: null, mirroredPairId: null,
      colourGroupId: `colour:${regionId}`, fabricGroupId: `fabric:${regionId}`, editableIndependently: true,
      zIndex: Math.max(0, ...data.regions.filter(region => region.view === view).map(region => region.zIndex)) + 1,
      geometrySource: 'manual', candidateIds: [] });
  }
  if (!changed.size) return { garment, regionId };
  const template = selected?.part ?? garment.parts.find(part => part.view === view && !isConstructionInk(part) && data.regions.some(region => region.id === part.id && canPaintConstructionRegion(region)));
  if (!template) throw new Error('No fabric template is available in this view.');
  const makePart = (region: ConstructionRegion, base: ImportedPart) => regionPart(region, { ...base,
    boundary: { boundaryType: 'seam', confidence: region.confidence, evidence: 'Manually corrected fabric boundary; review against the unchanged source ink.' } });
  const parts = garment.parts.map(part => changed.has(part.id) ? makePart(regions.find(region => region.id === part.id)!, part) : part);
  if (!id) parts.push(makePart(regions.find(region => region.id === regionId)!, { ...template, color: '#ffffff',
    transform: { x: 0, y: 0, scale: 1, rotation: 0 } }));
  return { regionId, garment: update(garment, view, { ...data, regions,
    seams: data.seams.filter(seam => !changed.has(seam.regionId)),
    candidates: data.candidates?.filter(candidate => !candidate.regionId || !changed.has(candidate.regionId)),
  }, parts) };
}

export function constructionSplitCandidates(data: ConstructionRegions, id: string) {
  const region = data.regions.find(item => item.id === id);
  return [...data.seams.filter(item => item.regionId === id).map(item => ({ id: item.id, label: item.label })),
    ...(data.candidates ?? []).filter(item => item.regionId === id && region?.candidateIds?.includes(item.id))
      .map(item => ({ id: item.id, label: `Source cell boundary ${item.label}` }))];
}
export function splitConstructionRegion(garment: ImportedGarment, view: ImportedGarmentView, id: string, seamId: string) {
  const { data, region, part } = selectedRegion(garment, view, id);
  let seam = data.seams.find(item => item.id === seamId && item.regionId === id);
  if (!seam) {
    const candidate = data.candidates?.find(item => item.id === seamId && item.regionId === id && region.candidateIds?.includes(item.id));
    if (candidate) {
      const original = polygons(region.path), cell = polygons(candidate.path), remainder = polygonClipping.difference(original, cell);
      if (area(cell) <= 0 || area(remainder) <= 0 || area(polygonClipping.difference(cell, original)) > Math.max(1e-4, area(original) * 1e-6))
        throw new Error('The selected source cell does not split this region into two non-empty pieces.');
      const newId = `${candidate.id.slice(0,56)}-region`;
      seam = { id: candidate.id, label: candidate.label, regionId: id, parts: [
        { ...region, path: pathFor(remainder), candidateIds: region.candidateIds?.filter(item => item !== candidate.id), colourGroupId: `colour:${id}`, fabricGroupId: `fabric:${id}` },
        { ...region, id: newId, label: `${region.label} — ${candidate.label}`, path: candidate.path, confidence: Math.min(region.confidence, candidate.confidence),
          candidateIds: [candidate.id], colourGroupId: `colour:${newId}`, fabricGroupId: `fabric:${newId}` },
      ] };
    }
  }
  if (['button', 'rivet', 'zip'].includes(region.semanticType)) throw new Error('Hardware cannot be split into fabric.');
  if (!seam || seam.parts.length < 2 || seam.parts.some(item => item.view !== view || !Number.isFinite(item.confidence) || item.confidence <= 0 || item.confidence > 1 || ['button', 'rivet', 'zip'].includes(item.semanticType))) throw new Error('Select an evidenced local seam candidate.');
  const existing = new Set(garment.parts.filter(item => item.id !== id).map(item => item.id));
  if (new Set(seam.parts.map(item => item.id)).size !== seam.parts.length || seam.parts.some(item => existing.has(item.id))) throw new Error('Seam candidate region identities collide.');
  const source = polygons(region.path), pieces = seam.parts.map(item => polygons(item.path));
  const union = polygonClipping.union(pieces[0], ...pieces.slice(1));
  const tolerance = Math.max(1e-4, area(source) * 1e-6);
  if (area(polygonClipping.xor(source, union)) > tolerance || Math.abs(pieces.reduce((total, piece) => total + area(piece), 0) - area(union)) > tolerance)
    throw new Error('Seam candidates must partition the original region without overlaps or missing fabric.');
  const replacements = seam.parts.map(item => ({ ...item, parentRegionId: region.parentRegionId, mirroredPairId: null }));
  return update(garment, view, { ...data, regions: data.regions.flatMap(item => item.id === id ? replacements : [{ ...item,
    ...(item.mirroredPairId === id ? { mirroredPairId: null, colourGroupId: `colour:${item.id}`, fabricGroupId: `fabric:${item.id}` } : {}),
    parentRegionId: item.parentRegionId === id ? region.parentRegionId : item.parentRegionId }]),
    seams: data.seams.filter(item => item.regionId !== id),
    candidates: data.candidates?.map(candidate => candidate.regionId === id ? { ...candidate, regionId: replacements.find(replacement => replacement.candidateIds?.includes(candidate.id))?.id ?? null } : candidate),
  }, garment.parts.flatMap(item => item.id === id ? replacements.map(candidate => regionPart(candidate, part)) : [item]));
}
export function reviewConstructionRegions(garment: ImportedGarment, view: ImportedGarmentView): ImportedGarment {
  const data = constructionRegionsForView(garment, view);
  if (!data?.regions.length) throw new Error('No construction regions to review.');
  const reviewed = { ...data, status: 'reviewed' as const }, key = view === 'front' ? 'frontView' : 'backView';
  return normalizeImportedGarment({ ...garment, ...(garment.manifest.view === view ? { constructionRegions: reviewed } : {}),
    manifest: { ...garment.manifest, [key]: { ...garment.manifest[key], constructionRegions: reviewed } } });
}
