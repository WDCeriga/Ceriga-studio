import type { ResolvedGarmentLayer } from './garmentSvgCatalog';
import { deriveImportedMeasurementSchema } from './importedGarmentMeasurements';
import { importedNeckBackingLayer } from './importedGarmentNeckBacking';

export type ImportedGarmentView = 'front' | 'back';
export type ImportedPoint = [number, number];
export const importedRegionTypes = ['panel', 'waistband', 'pocket', 'flap', 'fly', 'belt-loop', 'hem', 'button', 'rivet', 'zip', 'label', 'decoration', 'body', 'sleeve', 'cuff', 'collar', 'neckband', 'hood', 'yoke', 'placket', 'skirt', 'lining'] as const;
export type ImportedRegionType = typeof importedRegionTypes[number];
export const importedBuilderCategories = {
  'fabric-colour': { title: 'Fabric & Colour', step: 2 },
  'hem-cuffs': { title: 'Hem & Cuffs', step: 5 },
  'pockets-zips': { title: 'Pockets & Zips', step: 6 },
  'trims-details': { title: 'Trims & Details', step: 6 },
  'neck-hood': { title: 'Neck / Hood', step: 3 },
  sleeves: { title: 'Sleeves', step: 4 },
  'custom-details': { title: 'Garment Details', step: 6 },
} as const;
export interface ConstructionBoundary {
  boundaryType: 'silhouette' | 'seam' | 'panel-edge' | 'pocket-edge' | 'waistband-edge' | 'hem-edge' | 'overlay-edge' | 'fly-edge' | 'hardware-edge';
  confidence: number;
  evidence: string;
}
export interface ImportedRegion {
  id: string;
  name: string;
  semanticType: ImportedRegionType;
  material: string;
  evidence: string;
  colorable: boolean;
  structural: boolean;
  bounds: number[];
  seed: number[];
  attachmentTo: string | null;
  symmetryPartner: string | null;
  outline?: [number, number][];
  boundary?: ConstructionBoundary;
  layerKind?: 'structural' | 'detail';
  structuralRole?: string;
  builderCategory?: keyof typeof importedBuilderCategories;
  userFacingName?: string;
  colourGroup?: string;
  measurementRole?: string;
  editableIndependently?: boolean;
  view?: ImportedGarmentView;
}
export interface ImportedViewMetadata {
  view: ImportedGarmentView;
  partIds: string[];
  detailLayerIds: string[];
  sourceImageHash?: string;
  sourceImage?: string;
  cleanDrawing?: string;
  lineArtSvg?: string;
  stitchSvg?: string;
  /** Explicit user-requested geometry estimate, never an observed/source-backed view. */
  inference?: {
    kind: 'estimated-back';
    method: 'conservative-outline-v1';
    basedOnView: 'front';
    notice: string;
    limitations: string[];
  };
  provenance?: ImportedGarment['provenance'];
}
export interface ImportedPartGroup {
  id: string;
  partIds: string[];
  role?: string;
  material?: string;
}
export interface ImportedManifest {
  garmentType: string;
  material: string;
  subtype: string;
  fit: string;
  construction: string;
  materialEvidence: string;
  confidence: number;
  view: 'front' | 'back';
  uncertainties: string[];
  regions: ImportedRegion[];
  views?: ImportedGarmentView[];
  frontView?: ImportedViewMetadata;
  backView?: ImportedViewMetadata;
  measurementSchema?: ImportedMeasurementDefinition[];
  builderCategories?: (keyof typeof importedBuilderCategories)[];
  structuralParts?: string[];
  detailLayers?: string[];
  colourGroups?: ImportedPartGroup[];
  symmetryGroups?: ImportedPartGroup[];
}
export interface ImportedPart extends ImportedRegion {
  svg: string;
  constructionSvg: string;
  stitchSvg: string;
  area: number;
  color: string;
  parentGarment: string;
  layerOrder: number;
  view: 'front' | 'back';
  geometryBounds: number[];
  measurement: { unit: 'relative'; width: number; height: number };
  transform: { x: number; y: number; scale: number; rotation: number };
}
export interface ImportedStitchSettings {
  visible: boolean;
  color: string;
  weight: number;
}
export interface ImportedConstructionDetail {
  id: string;
  partId: string;
  name: string;
  builderCategory: keyof typeof importedBuilderCategories;
  userFacingName: string;
  view: 'front' | 'back';
  constructionSvg: string;
  stitchSvg: string;
  visibleEdges: (ConstructionBoundary & { id: string; points: [number, number][]; style: 'solid' | 'stitch' })[];
}
export type ImportedMeasurementId = 'waist' | 'hip' | 'front-rise' | 'back-rise' | 'outseam' | 'inseam' | 'leg-opening' | 'waistband-height' | 'pocket-opening' | 'chest' | 'body-length' | 'shoulder-width' | 'sleeve-length' | 'cuff-opening' | 'hem-width' | 'neck-opening' | 'hood-height' | 'skirt-length' | 'dress-length' | (string & {});
export interface ImportedMeasurementLandmark {
  id: string;
  partId: string;
  point: ImportedPoint;
  source: 'outline' | 'detail-edge';
  edgeId?: string;
}
export interface ImportedMeasurementDefinition {
  id: ImportedMeasurementId;
  label: string;
  view: ImportedGarmentView;
  startLandmark: ImportedMeasurementLandmark | null;
  endLandmark: ImportedMeasurementLandmark | null;
  measurementType: 'width' | 'length' | 'contour';
  unit: 'mm';
  confidence: number;
  calibrationDependency: { view: ImportedGarmentView; kind: 'view-scale' };
  /** Normalized SVG coordinates; multiply by 2048 for the existing Builder canvas. */
  points: ImportedPoint[];
  method: string;
}
export interface ImportedMeasurementCalibration {
  measurementId: ImportedMeasurementId;
  millimetres: number;
  /** Omitted means the primary manifest view, not whichever view is displayed. */
  view?: ImportedGarmentView;
}
export interface ImportedCommonCalibrationDimension {
  measurementId: ImportedMeasurementId;
  views: ImportedGarmentView[];
  /** Explicit evidence that this dimension is physically identical in both images. */
  evidence: string;
}
export const importedGarmentSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export type ImportedGarmentSize = typeof importedGarmentSizes[number];
export type ImportedSizeMeasurements = Partial<Record<ImportedGarmentView, Record<string, Partial<Record<ImportedGarmentSize, number>>>>>;

export interface ImportedGarment {
  source: 'azure-garment-reconstruction-v1';
  parts: ImportedPart[];
  lineArtSvg: string;
  stitchSvg: string;
  partCount: number;
  manifest: ImportedManifest;
  sourceManifest: ImportedManifest;
  sourceImage: string;
  sourceImages?: Partial<Record<ImportedGarmentView, string>>;
  cleanDrawing: string;
  reviewNotes: string[];
  provenance: { sourceImageHash: string; analysisId: string; drawingId: string; segmentationId: string; garmentVersion: string };
  accepted: boolean;
  constructionVersion?: 2;
  proposedBoundaries?: ImportedRegion[];
  detailLayers?: ImportedConstructionDetail[];
  hiddenDetailGroups?: string[];
  revision?: number;
  reviewed?: boolean;
  stitches?: ImportedStitchSettings;
  stitchOverrides?: Record<string, Partial<ImportedStitchSettings>>;
  calibration?: { partId: string; axis: 'width' | 'height'; millimetres: number };
  measurementCalibration?: ImportedMeasurementCalibration;
  measurementCalibrations?: Partial<Record<ImportedGarmentView, ImportedMeasurementCalibration>>;
  /** User-supplied size specifications in millimetres, independent of photo calibration. */
  sizeMeasurements?: ImportedSizeMeasurements;
  commonCalibrationDimensions?: ImportedCommonCalibrationDimension[];
  fixtureProvenance?: { synthetic: true; description: string };
}

export function importedGarmentLayers(garment: ImportedGarment, view: 'front' | 'back', colors?: Partial<Record<string, string>>): ResolvedGarmentLayer[] {
  const layers: ResolvedGarmentLayer[] = garment.parts.filter(part => part.view === view).map(part => {
    const stitches = { visible: true, color: '#b09c72', weight: 1, ...garment.stitches, ...garment.stitchOverrides?.[part.id] };
    return {
      id: part.id, assetId: `${garment.provenance.garmentVersion}:${part.id}`, category: part.semanticType,
      displayName: part.name, svgRaw: part.svg, kind: 'solid', zIndex: part.layerOrder,
      tint: part.colorable ? colors?.[part.id] ?? part.color : part.color,
      constructionSvg: part.constructionSvg, stitchSvg: stitches.visible ? part.stitchSvg : undefined,
      stitchColor: stitches.color, stitchWeight: stitches.weight,
      washable: !['button', 'rivet', 'zip', 'label', 'decoration'].includes(part.semanticType),
    };
  });
  const backing = importedNeckBackingLayer(garment, view, colors);
  if (backing) layers.unshift(backing);
  const detailOrder = Math.max(0, ...garment.parts.map(part => part.layerOrder)) + 1;
  return layers.concat((garment.detailLayers ?? []).filter(detail => detail.view === view && !garment.hiddenDetailGroups?.includes(`${detail.builderCategory}:${detail.userFacingName}`)).map((detail, index) => {
    const stitches = { visible: true, color: '#b09c72', weight: 1, ...garment.stitches, ...garment.stitchOverrides?.[detail.partId], ...garment.stitchOverrides?.[detail.id] };
    return { id: detail.id, assetId: `${garment.provenance.garmentVersion}:${detail.id}`, category: 'construction-detail',
      displayName: detail.name, svgRaw: detail.constructionSvg, kind: 'detail' as const, tint: '#141414', washable: false,
      zIndex: detailOrder + index, stitchSvg: stitches.visible ? detail.stitchSvg : undefined,
      stitchColor: stitches.color, stitchWeight: stitches.weight };
  }));
}

export function recolorImportedParts(garment: ImportedGarment, id: string, color: string, scope: 'part' | 'symmetry' | 'material' | 'group', previous: Partial<Record<string, string>> = {}) {
  const selected = garment.parts.find(part => part.id === id);
  if (!selected) return previous;
  return { ...previous, ...Object.fromEntries(garment.parts.filter(part => part.colorable &&
    (part.id === id || scope === 'group' && !selected.editableIndependently && !part.editableIndependently &&
      Boolean(selected.colourGroup) && selected.colourGroup === part.colourGroup && constructionRole(selected) === constructionRole(part) ||
      scope === 'symmetry' && selected.symmetryPartner === part.id || scope === 'material' && selected.material === part.material))
    .map(part => [part.id, color])) };
}

export function importedPartDimensions(garment: ImportedGarment, part: ImportedPart) {
  const calibration = garment.calibration;
  const reference = garment.parts.find(item => item.id === calibration?.partId);
  const extent = reference && calibration ? reference.measurement[calibration.axis] : 0;
  if (!calibration || reference?.view !== part.view || !Number.isFinite(calibration.millimetres) || calibration.millimetres <= 0 || !extent) return null;
  const scale = calibration.millimetres / extent;
  return { width: part.measurement.width * scale, height: part.measurement.height * scale };
}

export function importedControlGroups(garment: ImportedGarment) {
  const groups = new Map<string, { id: string; name: string; category: keyof typeof importedBuilderCategories; parts: ImportedPart[]; details: ImportedConstructionDetail[] }>();
  if (garment.constructionVersion !== 2) return [];
  for (const part of garment.parts) {
    const category = part.builderCategory ?? 'custom-details';
    const name = part.editableIndependently ? part.name : part.userFacingName ?? part.name;
    const id = `${category}:${name}`;
    const group = groups.get(id) ?? { id, name, category, parts: [], details: [] };
    group.parts.push(part);
    groups.set(id, group);
  }
  for (const detail of garment.detailLayers ?? []) {
    const category = detail.builderCategory;
    const name = detail.userFacingName;
    const id = `${category}:${name}`;
    const group = groups.get(id) ?? { id, name, category, parts: [], details: [] };
    group.details.push(detail);
    groups.set(id, group);
  }
  return [...groups.values()];
}

export function canAcceptImportedConstruction(garment: ImportedGarment) {
  return garment.constructionVersion === 2 && garment.parts.some(part => part.layerKind === 'structural') &&
    garment.parts.every(part => part.boundary && Number.isFinite(part.boundary.confidence) &&
          (part.boundary.confidence >= .8 || part.view === 'back' && garment.manifest.backView?.inference?.kind === 'estimated-back' && part.boundary.confidence > 0) &&
          part.boundary.evidence.trim() && part.layerKind && part.builderCategory && part.outline?.length &&
      (!['button', 'rivet', 'zip'].includes(part.semanticType) || part.layerKind === 'detail'));
}

/** A declared view without reconstructed parts is not an available view. */
export function hasImportedGarmentView(garment: ImportedGarment, view: ImportedGarmentView): boolean {
  return garment.parts.some(part => part.view === view && (Boolean(part.svg?.trim()) || Boolean(part.outline && part.outline.length >= 3)));
}

function constructionRole(part: ImportedPart): string {
  if (part.semanticType !== 'panel') return part.semanticType;
  const text = `${part.structuralRole ?? ''} ${part.measurementRole ?? ''}`.toLowerCase().replace(/[_-]/g, ' ');
  for (const [pattern, role] of [
    [/\bwaistband\b/, 'waistband'], [/\bhood\b/, 'hood'], [/\b(neckband|collar|neck)\b/, 'neck'], [/\bcuff\b/, 'cuff'],
    [/\bhem\b/, 'hem'], [/\bpocket\b/, 'pocket'], [/\bsleeve\b/, 'sleeve'], [/\bleg\b/, 'leg'], [/\bskirt\b/, 'skirt'], [/\b(body|torso|bodice|main)\b/, 'body'],
  ] as const) if (pattern.test(text)) return role;
  return part.structuralRole?.replace(/\b(front|back|left|right)[-_ ]?/g, '') || part.semanticType;
}

function categoryForPart(part: ImportedPart): keyof typeof importedBuilderCategories {
  const role = constructionRole(part);
  if (['neck', 'neckband', 'collar', 'hood'].includes(role)) return 'neck-hood';
  if (role === 'sleeve') return 'sleeves';
  if (['cuff', 'hem'].includes(role)) return 'hem-cuffs';
  if (['pocket', 'zip', 'fly', 'placket'].includes(role)) return 'pockets-zips';
  if (['button', 'rivet', 'label', 'decoration', 'belt-loop'].includes(role)) return 'trims-details';
  return part.colorable ? 'fabric-colour' : 'custom-details';
}

/** Derive editable metadata from reconstructed geometry without changing source evidence or copying views. */
export function normalizeImportedGarment(garment: ImportedGarment): ImportedGarment {
  const parts = garment.parts.map(part => ({ ...part,
    layerKind: part.layerKind ?? (part.structural ? 'structural' : 'detail'),
    builderCategory: part.builderCategory ?? categoryForPart(part),
    colourGroup: part.colourGroup ?? (part.editableIndependently ? part.id : `${constructionRole(part)}:${part.material}`),
  } satisfies ImportedPart));
  const normalized: ImportedGarment = { ...garment, parts, partCount: parts.length };
  const views = (['front', 'back'] as const).filter(view => hasImportedGarmentView(normalized, view));
  normalized.sourceImages = Object.fromEntries(views.filter(view => !garment.manifest[view === 'front' ? 'frontView' : 'backView']?.inference).map(view => [view, garment.sourceImages?.[view] ||
    garment.manifest[view === 'front' ? 'frontView' : 'backView']?.sourceImage || (view === garment.manifest.view ? garment.sourceImage : '')]));
  normalized.proposedBoundaries = garment.proposedBoundaries?.map(region => ({ ...region,
    view: region.view ?? parts.find(part => part.id === region.id || part.id === region.attachmentTo)?.view ??
      garment.sourceManifest.regions.find(source => source.id === region.id)?.view ?? (views.length === 1 ? views[0] : undefined),
  }));
  const viewMetadata = (view: ImportedGarmentView): ImportedViewMetadata | undefined => views.includes(view) ? {
    ...garment.manifest[view === 'front' ? 'frontView' : 'backView'], view, sourceImage: normalized.sourceImages?.[view],
    partIds: parts.filter(part => part.view === view).map(part => part.id),
    detailLayerIds: (garment.detailLayers ?? []).filter(detail => detail.view === view).map(detail => detail.id),
  } : undefined;
  const colourGroups = new Map<string, ImportedPartGroup>();
  const symmetryGroups = new Map<string, ImportedPartGroup>();
  for (const part of parts) {
    if (part.colorable) {
      const id = `${part.editableIndependently ? part.id : constructionRole(part)}:${part.colourGroup}:${part.material}`;
      const group = colourGroups.get(id) ?? { id, partIds: [], role: constructionRole(part), material: part.material };
      group.partIds.push(part.id);
      colourGroups.set(id, group);
    }
    const partner = parts.find(candidate => candidate.id === part.symmetryPartner && candidate.view === part.view &&
      candidate.material === part.material && constructionRole(candidate) === constructionRole(part));
    if (partner) {
      const partIds = [part.id, partner.id].sort(), id = `${part.view}:${partIds.join(':')}`;
      symmetryGroups.set(id, { id, partIds, role: constructionRole(part), material: part.material });
    }
  }
  normalized.manifest = { ...garment.manifest, views, frontView: viewMetadata('front'), backView: viewMetadata('back'),
    regions: parts, structuralParts: parts.filter(part => part.layerKind === 'structural').map(part => part.id),
    detailLayers: (garment.detailLayers ?? []).map(detail => detail.id),
    builderCategories: [...new Set([...parts.map(part => part.builderCategory), ...(garment.detailLayers ?? []).map(detail => detail.builderCategory)])],
    colourGroups: [...colourGroups.values()], symmetryGroups: [...symmetryGroups.values()],
    measurementSchema: deriveImportedMeasurementSchema(normalized),
  };
  return normalized;
}

function normalizedGarmentClassification(value: string): string {
  const classification = value.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (['tee', 'tshirt', 't shirt', 't shirts', 'tees'].includes(classification)) return 'tshirt';
  if (['pant', 'pants', 'trouser', 'trousers'].includes(classification)) return 'trousers';
  if (['short', 'shorts'].includes(classification)) return 'shorts';
  if (['jean', 'jeans'].includes(classification)) return 'jeans';
  return classification;
}

/** Replace only the requested view. Existing other-view IDs, edits, colours and source evidence survive unchanged. */
export function mergeImportedGarmentView(existing: ImportedGarment, incoming: ImportedGarment, view: ImportedGarmentView): ImportedGarment {
  existing = normalizeImportedGarment(existing);
  incoming = normalizeImportedGarment(incoming);
  if (normalizedGarmentClassification(existing.manifest.garmentType) !== normalizedGarmentClassification(incoming.manifest.garmentType))
    throw new Error('Cannot merge views with mismatched garment classification.');
  if (!hasImportedGarmentView(incoming, view)) throw new Error(`The import does not contain reconstructed ${view} geometry.`);
  const retainedParts = existing.parts.filter(part => part.view !== view);
  const incomingParts = incoming.parts.filter(part => part.view === view);
  const retainedDetails = (existing.detailLayers ?? []).filter(detail => detail.view !== view);
  const incomingDetails = (incoming.detailLayers ?? []).filter(detail => detail.view === view);
  const parts = [...retainedParts, ...incomingParts], detailLayers = [...retainedDetails, ...incomingDetails];
  const allIds = [...parts, ...detailLayers].map(item => item.id);
  if (new Set(allIds).size !== allIds.length) throw new Error('Cannot merge colliding part or detail IDs; imports must use unique view-namespaced IDs.');
  const incomingIds = new Set([...incomingParts, ...incomingDetails].map(item => item.id));
  const retainedIds = new Set([...retainedParts, ...retainedDetails].map(item => item.id));
  const replacedIds = new Set([
    ...existing.parts.filter(part => part.view === view).map(part => part.id),
    ...(existing.detailLayers ?? []).filter(detail => detail.view === view).map(detail => detail.id),
    ...(existing.sourceManifest[view === 'front' ? 'frontView' : 'backView']?.partIds ?? []),
  ]);
  const regionView = (region: ImportedRegion) => region.view;
  const incomingRegions = incoming.sourceManifest.regions.filter(region => regionView(region) === view || incomingIds.has(region.id) ||
    !regionView(region) && incoming.manifest.view === view && !incoming.parts.some(part => part.id === region.id && part.view !== view))
    .map(region => ({ ...region, view }));
  const sourceRegions = [...existing.sourceManifest.regions.filter(region => regionView(region) !== view && !replacedIds.has(region.id)), ...incomingRegions];
  if (new Set(sourceRegions.map(region => region.id)).size !== sourceRegions.length)
    throw new Error('Cannot merge colliding source-region IDs; imports must use unique view-namespaced IDs.');
  const metadata = (garment: ImportedGarment, selectedView: ImportedGarmentView): ImportedViewMetadata => {
    const supplied = garment.manifest[selectedView === 'front' ? 'frontView' : 'backView'];
    return { ...(garment.manifest.view === selectedView ? {
      sourceImage: garment.sourceImage, sourceImageHash: garment.provenance.sourceImageHash, cleanDrawing: garment.cleanDrawing,
      lineArtSvg: garment.lineArtSvg, stitchSvg: garment.stitchSvg, provenance: garment.provenance,
    } : {}), ...supplied, view: selectedView,
    partIds: garment.parts.filter(part => part.view === selectedView).map(part => part.id),
    detailLayerIds: (garment.detailLayers ?? []).filter(detail => detail.view === selectedView).map(detail => detail.id) };
  };
  const viewKey = view === 'front' ? 'frontView' : 'backView';
  const otherView = view === 'front' ? 'back' : 'front';
  const otherKey = otherView === 'front' ? 'frontView' : 'backView';
  const measurementCalibration = existing.measurementCalibration && (existing.measurementCalibration.view ?? existing.manifest.view) !== view ?
    { ...existing.measurementCalibration, view: existing.measurementCalibration.view ?? existing.manifest.view } : undefined;
  const calibration = existing.calibration && retainedParts.some(part => part.id === existing.calibration!.partId) ? existing.calibration : undefined;
  const measurementCalibrations = { ...existing.measurementCalibrations };
  delete measurementCalibrations[view];
  const incomingCalibration = incoming.measurementCalibrations?.[view] ??
    ((incoming.measurementCalibration?.view ?? incoming.manifest.view) === view ? incoming.measurementCalibration : undefined);
  if (incomingCalibration && (!incomingCalibration.view || incomingCalibration.view === view)) measurementCalibrations[view] = { ...incomingCalibration, view };
  const primaryReplaced = existing.manifest.view === view;
  const incomingViewMetadata = metadata(incoming, view);
  const replacedInferenceNotice = existing.manifest[viewKey]?.inference?.notice;
  const merged: ImportedGarment = {
    ...existing, parts, detailLayers, partCount: parts.length,
    sourceImages: { ...existing.sourceImages, [view]: incoming.sourceImages?.[view] ?? '' },
    manifest: { ...existing.manifest, [viewKey]: metadata(incoming, view),
      ...(hasImportedGarmentView(existing, otherView) ? { [otherKey]: metadata(existing, otherView) } : {}),
      uncertainties: [...new Set([...existing.manifest.uncertainties.filter(note => note !== replacedInferenceNotice), ...incoming.manifest.uncertainties])] },
    sourceManifest: { ...existing.sourceManifest, regions: sourceRegions, [viewKey]: metadata(incoming, view) },
    ...(primaryReplaced ? { sourceImage: incomingViewMetadata.sourceImage ?? '', cleanDrawing: incomingViewMetadata.cleanDrawing ?? '',
      lineArtSvg: incomingViewMetadata.lineArtSvg ?? '', stitchSvg: incomingViewMetadata.stitchSvg ?? '',
      provenance: incomingViewMetadata.provenance ?? { ...incoming.provenance, sourceImageHash: incomingViewMetadata.sourceImageHash ?? '' } } : {}),
    proposedBoundaries: [
      ...(existing.proposedBoundaries ?? []).filter(region => regionView(region) !== view && !replacedIds.has(region.id)),
      ...(incoming.proposedBoundaries ?? []).filter(region => regionView(region) === view || incomingIds.has(region.id) || !regionView(region) && incoming.manifest.view === view),
    ],
    stitchOverrides: Object.fromEntries([
      ...Object.entries(existing.stitchOverrides ?? {}).filter(([id]) => retainedIds.has(id)),
      ...Object.entries(incoming.stitchOverrides ?? {}).filter(([id]) => incomingIds.has(id)),
    ]),
    measurementCalibration, measurementCalibrations, calibration,
    commonCalibrationDimensions: existing.commonCalibrationDimensions?.filter(dimension => !dimension.views.includes(view)),
    reviewNotes: [...new Set([...existing.reviewNotes.filter(note => note !== replacedInferenceNotice), ...incoming.reviewNotes, `Imported ${view} geometry requires construction review.`])],
    accepted: false, reviewed: false, revision: (existing.revision ?? 0) + 1,
    constructionVersion: existing.constructionVersion === 2 && incoming.constructionVersion === 2 ? 2 : undefined,
  };
  return normalizeImportedGarment(merged);
}