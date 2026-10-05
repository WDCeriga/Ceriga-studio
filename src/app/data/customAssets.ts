import svgpath from 'svgpath';
import { collarBackFabric, collarBodyFabric, collarEditGeometry, editedCollarPoint, editedCollarSvg, validCollarEdits, type CollarManualEdits } from './customCollarEditing';
import type { TshirtLayerTransform } from './tshirtLayerAssets';
import type { ResolvedGarmentLayer } from './garmentSvgCatalog';
import { DEFAULT_TSHIRT_LAYER_TRANSFORM } from './garmentLayerTransform';
import { createGarmentDetail, detailPlacement, type DetailBounds, type GarmentDetail } from './garmentDetails';
import { filledFabricSilhouette, getPotraceSvgBBox } from '../lib/tshirtSvgUtils';
import { assetUserPlacement } from './customAssetEditing';
import { sleeveGeometry, validateSleeveReconstruction, type SleeveReconstruction } from './sleeveReconstruction';
import { resolveHemSettings, type TshirtHemStyles } from './tshirtHemStyles';

export type CustomAssetCategory = 'collar' | 'sleeve' | 'pocket';
export type CustomDetailType = 'pocket' | 'button' | 'zip' | 'patch';
export type AssetView = 'front' | 'back';
const sleeveMetricKeys = ['lengthRatio', 'upperWidthRatio', 'cuffWidthRatio', 'armholeWidthRatio', 'taperRatio', 'aspectRatio'] as const;
type SleeveMetrics = Record<typeof sleeveMetricKeys[number], number>;
export interface SleeveDrawingReview {
  status: 'Good match' | 'Needs review' | 'Rejected';
  reference: SleeveMetrics & { confidence: 'high' | 'medium' | 'low' };
  generated: SleeveMetrics & { confidence: 'high' | 'medium' | 'low' };
  relativeDrift: SleeveMetrics;
  thresholds: { goodMatch: number; majorMismatch: number };
  issues: string[];
  rejections: string[];
}

export interface CollarDrawingReview {
  status: 'Good Match' | 'Needs Review' | 'Rejected';
  confidence: 'high' | 'medium' | 'low';
  reference: Record<'construction' | 'texture' | 'opening' | 'height' | 'attachment' | 'seams', string>;
  generated: CollarDrawingReview['reference'];
  differences: { feature: string; referenceEvidence: string; drawingEvidence: string; severity: 'minor' | 'moderate' | 'major'; confidence: 'high' | 'medium' | 'low'; basis: 'visible' | 'ambiguous' | 'preset' }[];
}

export function validateCollarReview(value: CollarDrawingReview): CollarDrawingReview {
  const text = (item: unknown) => typeof item === 'string' && !!item.trim() && item.length <= 4000;
  if (!value || !['high', 'medium', 'low'].includes(value.confidence)
    || ![value.reference, value.generated].every(image => image && ['construction', 'texture', 'opening', 'height', 'attachment', 'seams'].every(key => text(image[key as keyof typeof image])))
    || !Array.isArray(value.differences) || value.differences.length > 32 || value.differences.some(difference => !difference
      || ![difference.feature, difference.referenceEvidence, difference.drawingEvidence].every(text)
      || !['minor', 'moderate', 'major'].includes(difference.severity) || !['high', 'medium', 'low'].includes(difference.confidence)
      || !['visible', 'ambiguous', 'preset'].includes(difference.basis))) throw new Error('Incomplete collar comparison. Retry processing.');
  const rejected = value.differences.some(difference => difference.basis === 'visible' && difference.severity === 'major' && difference.confidence === 'high');
  const uncertain = value.confidence !== 'high' || value.differences.some(difference => difference.basis !== 'preset');
  const status = rejected ? 'Rejected' : uncertain ? 'Needs Review' : 'Good Match';
  if (value.status !== status) throw new Error('Collar comparison status does not match its evidence. Retry processing.');
  return structuredClone(value);
}

export interface CustomAssetDefinition {
  version: 1;
  id: string;
  category: CustomAssetCategory;
  detailType?: CustomDetailType;
  name: string;
  svg: string;
  bodySvg?: string;
  keepSvg?: string;
  provenance: AssetView | 'shared' | 'derived';
  source: 'photo' | 'drawing';
  analysis: { category: string; name: string; construction: string; provider: string };
  compatibility: { garmentTypes: string[]; fits: string[]; views: AssetView[] };
  registration: {
    profile: string;
    version: 1;
    layerId: string;
    socket: string;
    defaultTransform: TshirtLayerTransform;
    side?: 'left' | 'right';
    cuff?: 'integrated';
    status?: 'Exact registration' | 'Adaptive registration' | 'Needs review' | 'Rejected';
    adaptation?: { capFraction: number; scaleReduction: number; minimumScaleReduction: number; uniformScale: number; rotation: number; bodyArmholeAdjusted: boolean; rigidPixels: number };
    width?: number;
    ratio?: number;
    relativePlacement?: { parentId: string; x: number; y: number; width: number };
    anchors?: Record<string, unknown>;
  };
  validation: { version: 1; status: 'passed'; checks: string[] };
  sleeveReview?: SleeveDrawingReview;
  collarReview?: CollarDrawingReview;
  sleeveReconstruction?: SleeveReconstruction;
  colorBindings: { fabric: string; ink: string };
}

export interface CustomAssetInstance {
  definitionId: string;
  view: AssetView;
  userTransform: TshirtLayerTransform & { mirror?: boolean };
  userTransformVersion?: 2;
  collarEdits?: CollarManualEdits;
}

export interface CustomAssetState {
  importedGarment?: import('./importedGarment').ImportedGarment;
  customAssets?: CustomAssetDefinition[];
  customAssetInstances?: Record<string, CustomAssetInstance>;
  customSleevesLinked?: boolean;
  customAssetAspectLocked?: boolean;
}

export const customAssetKey = (view: AssetView, layerId: string) => `${view}:${layerId}`;

export function setCustomCollarEdits(state: CustomAssetState, garmentType: string, fit: string, view: AssetView, layerId: string, edits?: CollarManualEdits): CustomAssetState {
  const asset = activeCustomAssets(state, garmentType, fit, view).find(item => item.definition.category === 'collar' && item.definition.registration.layerId === layerId);
  if (!asset) return state;
  const geometry = collarEditGeometry(asset.definition.svg);
  if (!geometry || (edits && !validCollarEdits(geometry, edits))) return state;
  return { ...state, customAssetInstances: { ...state.customAssetInstances, [customAssetKey(view, layerId)]: {
    ...asset.instance, collarEdits: edits ? structuredClone(edits) : undefined,
    userTransform: { ...DEFAULT_TSHIRT_LAYER_TRANSFORM }, userTransformVersion: 2,
  } } };
}

export function compatibleAsset(asset: CustomAssetDefinition, garmentType: string, fit: string, view: AssetView): boolean {
  return asset.version === 1 && asset.validation.status === 'passed'
    && asset.compatibility.garmentTypes.includes(garmentType)
    && asset.compatibility.fits.includes(fit) && asset.compatibility.views.includes(view)
    && (asset.provenance === view || asset.provenance === 'shared' || asset.provenance === 'derived');
}

export function activeCustomAssets(state: CustomAssetState, garmentType: string, fit: string, view: AssetView) {
  return Object.values(state.customAssetInstances ?? {}).flatMap(instance => {
    const definition = state.customAssets?.find(asset => asset.id === instance.definitionId);
    return instance.view === view && definition && compatibleAsset(definition, garmentType, fit, view)
      ? [{ definition, instance }] : [];
  });
}

export function acceptedDefinition(value: CustomAssetDefinition & { cleanDrawing?: string }): CustomAssetDefinition {
  const invalid = () => { throw new Error('Incomplete or unsupported custom asset. Retry processing.'); };
  const text = (candidate: unknown, maximum: number): string => typeof candidate === 'string' && candidate.trim() && candidate.length <= maximum ? candidate : invalid();
  const svg = (candidate: unknown): string => {
    const source = text(candidate, 4_000_000);
    const document = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (document.querySelector('parsererror') || document.documentElement.localName !== 'svg' || !document.querySelector('path[d]') || document.querySelectorAll('path').length > 5000) invalid();
    for (const element of Array.from(document.querySelectorAll('*'))) {
      if (element.namespaceURI !== 'http://www.w3.org/2000/svg' || !['svg', 'g', 'path', 'title', 'desc', 'metadata'].includes(element.localName)) invalid();
      for (const attribute of Array.from(element.attributes)) {
        if (/^on|href/i.test(attribute.localName) || /url\s*\(/i.test(attribute.value)) invalid();
      }
    }
    return source;
  };
  if (!value || value.version !== 1 || !['collar', 'sleeve', 'pocket'].includes(value.category)
    || value.validation?.status !== 'passed' || value.validation.version !== 1
    || value.registration?.version !== 1 || !value.compatibility?.fits?.length
    || !['front', 'back', 'shared', 'derived'].includes(value.provenance) || !['photo', 'drawing'].includes(value.source)
    || (value.category === 'collar' && !value.bodySvg)
    || (value.category === 'sleeve' && !value.keepSvg)) invalid();
  const registration = value.registration;
  const collarReview = value.collarReview && validateCollarReview(value.collarReview);
  if (collarReview && (value.category !== 'collar' || collarReview.status === 'Rejected')) invalid();
  const sleeveReview = value.sleeveReview;
  if (sleeveReview && (value.category !== 'sleeve' || !['Good match', 'Needs review'].includes(sleeveReview.status)
    || ![sleeveReview.reference, sleeveReview.generated].every(metrics => metrics && ['high', 'medium', 'low'].includes(metrics.confidence)
      && sleeveMetricKeys.every(key => Number.isFinite(metrics[key]) && metrics[key] > 0))
    || !sleeveReview.relativeDrift || !sleeveMetricKeys.every(key => Number.isFinite(sleeveReview.relativeDrift[key]) && sleeveReview.relativeDrift[key] >= 0)
    || sleeveReview.thresholds?.goodMatch !== .2 || sleeveReview.thresholds?.majorMismatch !== .5
    || !Array.isArray(sleeveReview.issues) || sleeveReview.issues.length > 20 || sleeveReview.issues.some(issue => typeof issue !== 'string' || issue.length > 1000)
    || !Array.isArray(sleeveReview.rejections) || sleeveReview.rejections.length)) invalid();
  if (value.category === 'sleeve' && registration.status !== undefined
    && !['Exact registration', 'Adaptive registration', 'Needs review'].includes(registration.status)) invalid();
  const adaptation = value.category === 'sleeve' ? registration.adaptation : undefined;
  if (adaptation && (![adaptation.capFraction, adaptation.scaleReduction, adaptation.minimumScaleReduction, adaptation.uniformScale, adaptation.rotation, adaptation.rigidPixels].every(Number.isFinite)
    || adaptation.capFraction < .1 || adaptation.capFraction > .2 || adaptation.minimumScaleReduction < .4
    || adaptation.scaleReduction < adaptation.minimumScaleReduction || adaptation.scaleReduction > 1 || adaptation.uniformScale <= 0
    || adaptation.rigidPixels <= 0 || typeof adaptation.bodyArmholeAdjusted !== 'boolean')) invalid();
  const relative = registration.relativePlacement;
  if (relative && (value.category !== 'pocket' || ![relative.x, relative.y, relative.width].every(Number.isFinite)
    || Math.abs(relative.x) > 10 || Math.abs(relative.y) > 10 || relative.width <= 0 || relative.width > 10)) invalid();
  if (value.detailType !== undefined && (value.category !== 'pocket' || !['pocket', 'button', 'zip', 'patch'].includes(value.detailType))) invalid();
  const expectedLayer = value.category === 'sleeve' ? registration.side === 'left' ? 'sleeveLeft' : registration.side === 'right' ? 'sleeveRight' : '' : value.category === 'collar' ? 'neck' : 'pocket';
  const expectedProfile = { collar: 'CollarRegistrationProfile', sleeve: 'SleeveRegistrationProfile', pocket: 'PocketPlacementProfile' }[value.category];
  if (!expectedLayer || registration.layerId !== expectedLayer || registration.profile !== expectedProfile) invalid();
  const transform = registration.defaultTransform;
  if (!transform || !['x', 'y', 'scale', 'rotation'].every(key => Number.isFinite(transform[key as keyof TshirtLayerTransform]))
    || ![transform.scale, transform.scaleX ?? transform.scale, transform.scaleY ?? transform.scale].every(scale => Number.isFinite(scale) && scale > 0 && scale <= 20)) invalid();
  if (value.category === 'pocket' && (![registration.width, registration.ratio].every(number => typeof number === 'number' && Number.isFinite(number) && number > 0)
    || registration.width! > 1)) invalid();
  const list = (items: unknown, allowed: string[]) => {
    if (!Array.isArray(items) || !items.length || items.some(item => !allowed.includes(item))) invalid();
    return [...new Set(items as string[])];
  };
  const anchors: Record<string, unknown> = {};
  for (const key of ['left', 'right', 'source', 'target']) {
    const points = registration.anchors?.[key];
    if (points === undefined) continue;
    if (!Array.isArray(points) || points.length !== 2 || !points.flat().every(number => typeof number === 'number' && Number.isFinite(number))) invalid();
    anchors[key] = structuredClone(points);
  }
  return {
    version: 1, id: text(value.id, 100), category: value.category, name: text(value.name, 60), svg: svg(value.svg),
    ...(value.category === 'pocket' ? { detailType: value.detailType ?? 'pocket' } : {}),
    ...(value.category === 'collar' ? { bodySvg: svg(value.bodySvg) } : {}),
    ...(value.category === 'sleeve' ? { keepSvg: svg(value.keepSvg) } : {}),
    provenance: value.provenance, source: value.source,
    analysis: { category: text(value.analysis?.category, 30), name: text(value.analysis?.name, 60), construction: text(value.analysis?.construction, 1200), provider: text(value.analysis?.provider, 30) },
    compatibility: { garmentTypes: list(value.compatibility.garmentTypes, ['tshirt', 'tshirtTest']), fits: list(value.compatibility.fits, ['slim', 'regular', 'boxy', 'oversized']), views: list(value.compatibility.views, ['front', 'back']) as AssetView[] },
    registration: { profile: expectedProfile, version: 1, layerId: expectedLayer, socket: text(registration.socket, 100),
      defaultTransform: { x: transform.x, y: transform.y, scale: transform.scale, scaleX: transform.scaleX ?? transform.scale, scaleY: transform.scaleY ?? transform.scale, rotation: transform.rotation },
      ...(value.category === 'sleeve' ? { side: registration.side, cuff: 'integrated' as const, status: registration.status ?? 'Exact registration',
        ...(adaptation ? { adaptation: { ...adaptation } } : {}) } : {}),
      ...(value.category === 'pocket' ? { width: registration.width, ratio: registration.ratio } : {}),
      ...(relative ? { relativePlacement: { parentId: text(relative.parentId, 100), x: relative.x, y: relative.y, width: relative.width } } : {}), anchors },
    validation: { version: 1, status: 'passed', checks: list(value.validation.checks, ['boundary', 'trace', 'registration', 'render-nonempty', 'canvas-bounds', 'drawing-fidelity']) },
    ...(sleeveReview ? { sleeveReview: structuredClone(sleeveReview) } : {}),
    ...(collarReview ? { collarReview } : {}),
    ...(value.sleeveReconstruction ? { sleeveReconstruction: validateSleeveReconstruction(value.sleeveReconstruction) } : {}),
    colorBindings: { fabric: '#000000', ink: '#141414' },
  };
}

export function acceptedAssetBundle(value: CustomAssetDefinition & { additionalAssets?: CustomAssetDefinition[] }): CustomAssetDefinition[] {
  if (value.additionalAssets !== undefined && (!Array.isArray(value.additionalAssets) || value.additionalAssets.length > 16)) {
    throw new Error('Invalid component list. Nothing was installed.');
  }
  const definitions = [value, ...(value.additionalAssets ?? [])].map(acceptedDefinition);
  if (new Set(definitions.map(asset => asset.id)).size !== definitions.length || definitions.slice(1).some(asset => asset.category !== 'pocket'
    || asset.registration.relativePlacement?.parentId !== definitions[0].id)) {
    throw new Error('Invalid component bundle. Nothing was installed.');
  }
  return definitions;
}

export function deriveOppositeSleeve(definitions: CustomAssetDefinition[], registeredSleeve?: CustomAssetDefinition): CustomAssetDefinition[] {
  const [sleeve, ...components] = definitions.map(acceptedDefinition);
  if (!sleeve || sleeve.category !== 'sleeve' || components.some(asset => asset.category !== 'pocket' || asset.registration.relativePlacement?.parentId !== sleeve.id)) {
    throw new Error('A validated sleeve bundle is required for mirroring.');
  }
  const mirror = (source: string) => {
    const document = new DOMParser().parseFromString(source, 'image/svg+xml');
    const root = document.documentElement as unknown as SVGSVGElement;
    const box = root.viewBox.baseVal;
    for (const element of Array.from(root.children)) {
      if (!['g', 'path'].includes(element.localName)) continue;
      const matrix = (element as SVGGraphicsElement).transform.baseVal.consolidate()?.matrix;
      if (matrix && (matrix.b !== 0 || matrix.c !== 0)) throw new Error('Sleeve SVG has an unsupported transform.');
      const horizontalScale = matrix?.a ?? 1;
      if (horizontalScale === 0) throw new Error('Sleeve SVG has a degenerate transform.');
      const offset = (2 * box.x + box.width - 2 * (matrix?.e ?? 0)) / horizontalScale;
      const paths = element.localName === 'path' ? [element] : Array.from(element.querySelectorAll('path'));
      for (const path of paths) {
        path.setAttribute('d', svgpath(path.getAttribute('d') ?? '').matrix([-1, 0, 0, 1, offset, 0]).toString());
      }
    }
    return new XMLSerializer().serializeToString(root);
  };
  const side = sleeve.registration.side === 'left' ? 'right' : 'left';
  const registered = registeredSleeve ? acceptedDefinition(registeredSleeve) : undefined;
  if (registered && (registered.category !== 'sleeve' || registered.registration.side !== side || registered.id === sleeve.id
    || registered.provenance !== 'derived' || JSON.stringify(registered.compatibility) !== JSON.stringify(sleeve.compatibility))) {
    throw new Error('Opposite sleeve does not match the requested garment socket.');
  }
  const id = registered?.id ?? crypto.randomUUID();
  const target = sleeve.registration.anchors?.target as number[][] | undefined;
  const rasterWidth = sleeve.registration.adaptation ? 1536 : 1024;
  const opposite = registered ?? acceptedDefinition({ ...sleeve, id, provenance: 'derived', svg: mirror(sleeve.svg), keepSvg: mirror(sleeve.keepSvg!),
    registration: { ...sleeve.registration, side, layerId: side === 'left' ? 'sleeveLeft' : 'sleeveRight',
      socket: `studio-${sleeve.compatibility.fits[0]}-${side}-armhole-v1`,
      defaultTransform: { ...sleeve.registration.defaultTransform, x: -sleeve.registration.defaultTransform.x, rotation: -sleeve.registration.defaultTransform.rotation },
      anchors: { ...sleeve.registration.anchors, ...(target ? { target: target.map(([horizontal, vertical]) => [rasterWidth - 1 - horizontal, vertical]) } : {}) } } });
  return [opposite, ...components.map(asset => acceptedDefinition({ ...asset, id: crypto.randomUUID(), provenance: 'derived', svg: mirror(asset.svg),
    registration: { ...asset.registration, relativePlacement: { ...asset.registration.relativePlacement!, parentId: id } } }))];
}

export function withCustomAssets(layers: ResolvedGarmentLayer[], state: CustomAssetState, garmentType: string, fit: string, view: AssetView, hemStyles?: TshirtHemStyles): ResolvedGarmentLayer[] {
  let resolved = layers;
  for (const { definition, instance } of activeCustomAssets(state, garmentType, fit, view)) {
    if (definition.category === 'pocket') continue;
    const layerId = definition.registration.layerId;
    if (definition.category === 'collar') {
      const neck = resolved.find(layer => layer.id === 'neck');
      const collarSvg = editedCollarSvg(definition.svg, instance.collarEdits);
      const translated = Boolean(instance.collarEdits?.translation?.x || instance.collarEdits?.translation?.y);
      const geometry = collarEditGeometry(definition.svg);
      const movedPoints = geometry?.paths.flatMap(path => path.points.map(item => editedCollarPoint(geometry, instance.collarEdits, item.point)));
      const movedBounds = movedPoints?.length ? {
        minX: Math.min(...movedPoints.map(point => point.x)), minY: Math.min(...movedPoints.map(point => point.y)),
        maxX: Math.max(...movedPoints.map(point => point.x)), maxY: Math.max(...movedPoints.map(point => point.y)),
      } : undefined;
      const bounds = [neck && getPotraceSvgBBox(neck.svgRaw), getPotraceSvgBBox(definition.svg), movedBounds].filter(Boolean);
      if (garmentType === 'tshirt' && bounds.length) {
        const left = Math.min(...bounds.map(box => box!.minX));
        const top = Math.min(...bounds.map(box => box!.minY)) - 8;
        const right = Math.max(...bounds.map(box => box!.maxX));
        const bottom = Math.max(...bounds.map(box => box!.maxY)) + 8;
        resolved = resolved.filter(layer => layer.id !== 'innerBackNeck').map(layer => {
          if (!['outline', 'stitching'].includes(layer.id)) return layer;
          const padding = layer.id === 'stitching' ? 24 : translated ? 8 : 0;
          const keep = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path fill="white" fill-rule="evenodd" d="M0 0H2048V2048H0Z M${left - padding} ${top - padding}H${right + padding}V${bottom + padding}H${left - padding}Z"/></svg>`;
          const maskId = `custom-collar-${definition.id.replace(/[^a-z0-9-]/gi, '')}-${layer.id}`;
          const defs = `<defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:alpha"><image href="data:image/svg+xml;base64,${btoa(keep)}" width="2048" height="2048"/></mask></defs>`;
          const joins = layer.id === 'outline' && !translated ? customCollarShoulderJoins(layer.svgRaw, definition.svg, left, right, top, bottom) : '';
          return { ...layer, svgRaw: layer.svgRaw.replace(/(<svg[^>]*>)/, `$1${defs}<g mask="url(#${maskId})">`).replace('</svg>', `</g>${joins}</svg>`) };
        });
      }
      const hasExplicitOpening = definition.svg.includes('data-topology="collar-fabric-minus-opening"');
      resolved = [...resolved.filter(layer => layer.id !== 'innerBackNeck'), {
        id: 'innerBackNeck', category: 'Inner back neck', assetId: definition.id,
        displayName: 'Custom collar backing', svgRaw: hasExplicitOpening
          ? collarBackFabric(definition.svg, instance.collarEdits) ?? definition.svg
          : filledFabricSilhouette(definition.svg, true),
        kind: 'solid' as const, colorBinding: 'body' as const, zIndex: (neck?.zIndex ?? 45) - 1,
      }];
      resolved = resolved.map(layer => layer.id === 'neck' || layer.id === 'base'
        ? { ...layer, assetId: definition.id, displayName: definition.name, svgRaw: layer.id === 'neck' ? collarSvg
          : bounds.length ? collarBodyFabric(layer.svgRaw, definition.bodySvg!, geometry, instance.collarEdits, {
            minX: Math.min(...bounds.map(box => box!.minX)), minY: Math.min(...bounds.map(box => box!.minY)),
            maxX: Math.max(...bounds.map(box => box!.maxX)), maxY: Math.max(...bounds.map(box => box!.maxY)),
          }) : layer.svgRaw }
        : layer);
      continue;
    }
    const side = definition.registration.side === 'left' ? 'Left' : 'Right';
    const sleeve = resolved.find(layer => layer.id === layerId);
    const cuffId = `sleeveHem${side}`;
    const cuffSettings = resolveHemSettings(hemStyles, cuffId);
    const model = definition.sleeveReconstruction;
    const geometry = model ? sleeveGeometry({ ...model, edits: { ...model.edits,
      bodyColor: sleeve?.tint || model.edits.bodyColor } }) : undefined;
    const keepUrl = `data:image/svg+xml;base64,${btoa(definition.keepSvg!)}`;
    resolved = resolved.filter(layer => ![`sleeveHem${side}`, `underSleeve${side}`, `underlayerHem${side}`].includes(layer.id)).map(layer => {
      if (layer.id === layerId) {
        const svgRaw = geometry?.svg ?? definition.svg;
        return { ...layer, assetId: definition.id, displayName: definition.name, svgRaw };
      }
      if (!['base', 'outline', 'stitching'].includes(layer.id)) return layer;
      const maskId = `custom-${definition.id.replace(/[^a-z0-9-]/gi, '')}-${layer.id}`;
      const defs = `<defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:alpha"><image href="${keepUrl}" width="2048" height="2048"/></mask></defs>`;
      return { ...layer, svgRaw: layer.svgRaw.replace(/(<svg[^>]*>)/, `$1${defs}<g mask="url(#${maskId})">`).replace('</svg>', '</g></svg>') };
    });
    if (geometry?.cuffSvg && sleeve) {
      const cuffSvg = new DOMParser().parseFromString(geometry.cuffSvg, 'image/svg+xml');
      for (const ink of cuffSvg.querySelectorAll('[fill="#141414"]')) ink.setAttribute('fill', cuffSettings.stitchColor || '#141414');
      resolved.push({ id: cuffId, category: 'Sleeve hem', assetId: definition.id,
        displayName: `${side} uploaded cuff`, svgRaw: new XMLSerializer().serializeToString(cuffSvg.documentElement),
        kind: 'solid', hemSource: 'uploaded', tint: cuffSettings.color || model?.edits.cuffColor || sleeve.tint || model?.edits.bodyColor,
        zIndex: sleeve.zIndex + 1 });
    }
  }
  return resolved;
}

export function customAssetTransforms(state: CustomAssetState, garmentType: string, fit: string, view: AssetView,
  builtins?: Partial<Record<string, TshirtLayerTransform>>, canvasSize = 2048) {
  const transforms = { ...builtins };
  for (const { definition, instance } of activeCustomAssets(state, garmentType, fit, view)) {
    const base = definition.registration.defaultTransform;
    const user = instance.userTransform;
    transforms[definition.registration.layerId] = instance.userTransformVersion === 2 ? assetUserPlacement(definition, user, canvasSize) : { x: base.x + user.x, y: base.y + user.y,
      scale: base.scale * user.scale, scaleX: (base.scaleX ?? base.scale) * (user.scaleX ?? user.scale),
      scaleY: (base.scaleY ?? base.scale) * (user.scaleY ?? user.scale), rotation: base.rotation + user.rotation };
    if (definition.sleeveReconstruction?.style.cuff) {
      const cuffSvg = sleeveGeometry(definition.sleeveReconstruction).cuffSvg;
      const cuff = cuffSvg && getPotraceSvgBBox(cuffSvg);
      const sleeve = getPotraceSvgBBox(definition.svg);
      if (cuff && sleeve) {
        const transform = transforms[definition.registration.layerId]!;
        const horizontal = cuff.centerX - sleeve.centerX;
        const vertical = cuff.centerY - sleeve.centerY;
        const radians = transform.rotation * Math.PI / 180;
        const scaledX = horizontal * (transform.scaleX ?? transform.scale);
        const scaledY = vertical * (transform.scaleY ?? transform.scale);
        const side = definition.registration.side === 'left' ? 'Left' : 'Right';
        transforms[`sleeveHem${side}`] = { ...transform,
          x: transform.x + (scaledX * Math.cos(radians) - scaledY * Math.sin(radians) - horizontal) * canvasSize / 2048,
          y: transform.y + (scaledX * Math.sin(radians) + scaledY * Math.cos(radians) - vertical) * canvasSize / 2048 };
      }
    }
    if (definition.category === 'collar') transforms.innerBackNeck = { ...transforms.neck! };
  }
  return transforms;
}

export function installCustomAsset<State extends CustomAssetState & { garmentDetails?: GarmentDetail[] }>(state: State,
  definition: CustomAssetDefinition, garmentType: string, fit: string, view: AssetView, color: string, bounds?: DetailBounds): State {
  let asset = acceptedDefinition(definition);
  if (!compatibleAsset(asset, garmentType, fit, view)) throw new Error('Asset is incompatible with this garment, fit or view.');
  const relative = asset.registration.relativePlacement;
  const parent = relative && state.customAssets?.find(item => item.id === relative.parentId);
  const parentDetail = relative && state.garmentDetails?.findLast(item => item.customAsset?.id === relative.parentId && (item.view ?? 'front') === view);
  if (relative && parent && bounds) {
    const bodyWidth = bounds.maxX - bounds.minX;
    const bodyHeight = bounds.maxY - bounds.minY;
    const placed = parentDetail ? detailPlacement(parentDetail, bounds) : undefined;
    const box = placed ? { minX: placed.left, minY: placed.top, maxX: placed.left + placed.width, maxY: placed.top + placed.height } : getPotraceSvgBBox(parent.svg);
    if (box) {
      const parentWidth = box.maxX - box.minX;
      const positionX = parent.category === 'sleeve' && parent.registration.side === 'right' ? 1 - relative.x : relative.x;
      asset = { ...asset, registration: { ...asset.registration,
        width: Math.min(1, parentWidth * relative.width / bodyWidth),
        defaultTransform: { ...asset.registration.defaultTransform,
          x: (box.minX + positionX * parentWidth - bounds.minX) / bodyWidth,
          y: (box.minY + relative.y * (box.maxY - box.minY) - bounds.minY) / bodyHeight } } };
    }
  }
  const customAssets = [...(state.customAssets ?? []).filter(item => item.id !== asset.id), asset];
  if (asset.category === 'pocket') {
    const detail = createGarmentDetail(asset.detailType ?? 'pocket', state.garmentDetails ?? [], color);
    return { ...state, customAssets, garmentDetails: [...(state.garmentDetails ?? []).map(item => ({ ...item, selected: false })),
      { ...detail, name: asset.name, view, customAsset: asset, ...(parent?.category === 'sleeve' ? { placementArea: 'canvas' as const } : {}),
        x: asset.registration.defaultTransform.x, y: asset.registration.defaultTransform.y }] };
  }
  return { ...state, customAssets, customAssetInstances: { ...state.customAssetInstances,
    [customAssetKey(view, asset.registration.layerId)]: { definitionId: asset.id, view, userTransform: { ...DEFAULT_TSHIRT_LAYER_TRANSFORM } } } };
}

export function updateCustomAssetTransform(state: CustomAssetState, garmentType: string, fit: string, view: AssetView,
  layerId: string, transform?: TshirtLayerTransform) {
  const active = activeCustomAssets(state, garmentType, fit, view).find(item => item.definition.registration.layerId === layerId);
  if (!active) return undefined;
  const base = active.definition.registration.defaultTransform;
  const userTransform = transform ? { x: transform.x - base.x, y: transform.y - base.y,
    scale: transform.scale / base.scale, scaleX: (transform.scaleX ?? transform.scale) / (base.scaleX ?? base.scale),
    scaleY: (transform.scaleY ?? transform.scale) / (base.scaleY ?? base.scale), rotation: transform.rotation - base.rotation }
    : { ...DEFAULT_TSHIRT_LAYER_TRANSFORM };
  return { ...state.customAssetInstances, [customAssetKey(view, layerId)]: { ...active.instance, userTransform, userTransformVersion: undefined } };
}

const shoulderJoinCache = new Map<string, string>();

function customCollarShoulderJoins(outline: string, collar: string, left: number, right: number, top: number, bottom: number) {
  const key = outline + collar;
  const cached = shoulderJoinCache.get(key);
  if (cached !== undefined) return cached;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;visibility:hidden';
  host.innerHTML = outline + collar;
  document.body.append(host);
  try {
    const roots = host.querySelectorAll('svg');
    const sample = (root: SVGSVGElement, column: number, inkOnly = false) => {
      const paths = Array.from(root.querySelectorAll<SVGPathElement>('path')).filter(path => !path.closest('defs')
        && (!inkOnly || path.closest('g')?.getAttribute('fill') === '#141414'));
      const probes = paths.map(path => ({ path, inverse: path.getCTM()?.inverse() })).filter(probe => probe.inverse);
      let start: number | undefined;
      for (let row = Math.max(0, top - 24); row < bottom; row += .5) {
        const point = new DOMPoint(column, row);
        const filled = probes.some(probe => probe.path.isPointInFill(point.matrixTransform(probe.inverse)));
        if (filled && start === undefined) start = row;
        if (!filled && start !== undefined) return { row: (start + row) / 2, width: row - start };
      }
      return undefined;
    };
    const bounds = getPotraceSvgBBox(collar);
    const nativeGroup = roots[0].querySelector<SVGGElement>('g[transform]');
    const inverse = nativeGroup?.getCTM()?.inverse();
    const joins = bounds ? [[left - .5, bounds.minX + 2], [right + .5, bounds.maxX - 2]].map(([from, to]) => {
      const source = sample(roots[0], from);
      const target = sample(roots[1], to, true);
      if (!source || !target || !inverse || Math.abs(from - to) > 80 || Math.abs(source.row - target.row) > 80) return '';
      const start = new DOMPoint(from, source.row).matrixTransform(inverse);
      const end = new DOMPoint(to, target.row).matrixTransform(inverse);
      const width = Math.max(3, Math.min(8, source.width)) * Math.hypot(inverse.a, inverse.b);
      return `<path data-custom-shoulder-join="true" d="M${start.x} ${start.y}L${end.x} ${end.y}" fill="none" stroke="#141414" stroke-width="${width}" stroke-linecap="round"/>`;
    }).join('') : '';
    const result = joins ? `<g transform="${nativeGroup!.getAttribute('transform')}">${joins}</g>` : '';
    if (shoulderJoinCache.size >= 24) shoulderJoinCache.clear();
    shoulderJoinCache.set(key, result);
    return result;
  } finally { host.remove(); }
}