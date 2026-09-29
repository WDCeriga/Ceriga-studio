import type { TshirtLayerTransform } from './tshirtLayerAssets';
import type { ResolvedGarmentLayer } from './garmentSvgCatalog';
import { DEFAULT_TSHIRT_LAYER_TRANSFORM } from './tshirtLayerAssets';
import { createGarmentDetail, detailPlacement, type DetailBounds, type GarmentDetail } from './garmentDetails';
import { filledFabricSilhouette, getPotraceSvgBBox } from '../lib/tshirtSvgUtils';

export type CustomAssetCategory = 'collar' | 'sleeve' | 'pocket';
export type CustomDetailType = 'pocket' | 'button' | 'zip' | 'patch';
export type AssetView = 'front' | 'back';

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
    width?: number;
    ratio?: number;
    relativePlacement?: { parentId: string; x: number; y: number; width: number };
    anchors?: Record<string, unknown>;
  };
  validation: { version: 1; status: 'passed'; checks: string[] };
  colorBindings: { fabric: string; ink: string };
}

export interface CustomAssetInstance {
  definitionId: string;
  view: AssetView;
  userTransform: TshirtLayerTransform;
}

export interface CustomAssetState {
  customAssets?: CustomAssetDefinition[];
  customAssetInstances?: Record<string, CustomAssetInstance>;
}

export const customAssetKey = (view: AssetView, layerId: string) => `${view}:${layerId}`;

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
      ...(value.category === 'sleeve' ? { side: registration.side, cuff: 'integrated' as const } : {}),
      ...(value.category === 'pocket' ? { width: registration.width, ratio: registration.ratio } : {}),
      ...(relative ? { relativePlacement: { parentId: text(relative.parentId, 100), x: relative.x, y: relative.y, width: relative.width } } : {}), anchors },
    validation: { version: 1, status: 'passed', checks: list(value.validation.checks, ['boundary', 'trace', 'registration', 'render-nonempty', 'canvas-bounds', 'drawing-fidelity']) },
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

export function withCustomAssets(layers: ResolvedGarmentLayer[], state: CustomAssetState, garmentType: string, fit: string, view: AssetView): ResolvedGarmentLayer[] {
  let resolved = layers;
  for (const { definition } of activeCustomAssets(state, garmentType, fit, view)) {
    if (definition.category === 'pocket') continue;
    const layerId = definition.registration.layerId;
    if (definition.category === 'collar') {
      const neck = resolved.find(layer => layer.id === 'neck');
      const bounds = [neck && getPotraceSvgBBox(neck.svgRaw), getPotraceSvgBBox(definition.svg)].filter(Boolean);
      if (garmentType === 'tshirt' && bounds.length) {
        const left = Math.min(...bounds.map(box => box!.minX));
        const top = Math.min(...bounds.map(box => box!.minY)) - 8;
        const right = Math.max(...bounds.map(box => box!.maxX));
        const bottom = Math.max(...bounds.map(box => box!.maxY)) + 8;
        resolved = resolved.filter(layer => layer.id !== 'innerBackNeck').map(layer => {
          if (!['outline', 'stitching'].includes(layer.id)) return layer;
          const padding = layer.id === 'stitching' ? 24 : 0;
          const keep = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path fill="white" fill-rule="evenodd" d="M0 0H2048V2048H0Z M${left - padding} ${top - padding}H${right + padding}V${bottom + padding}H${left - padding}Z"/></svg>`;
          const maskId = `custom-collar-${definition.id.replace(/[^a-z0-9-]/gi, '')}-${layer.id}`;
          const defs = `<defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:alpha"><image href="data:image/svg+xml;base64,${btoa(keep)}" width="2048" height="2048"/></mask></defs>`;
          const joins = layer.id === 'outline' ? customCollarShoulderJoins(layer.svgRaw, definition.svg, left, right, top, bottom) : '';
          return { ...layer, svgRaw: layer.svgRaw.replace(/(<svg[^>]*>)/, `$1${defs}<g mask="url(#${maskId})">`).replace('</svg>', `</g>${joins}</svg>`) };
        });
      }
      resolved = [...resolved.filter(layer => layer.id !== 'innerBackNeck'), {
        id: 'innerBackNeck', category: 'Inner back neck', assetId: definition.id,
        displayName: 'Custom collar backing', svgRaw: filledFabricSilhouette(definition.svg, true),
        kind: 'solid', colorBinding: 'body', zIndex: (neck?.zIndex ?? 45) - 1,
      }];
      resolved = resolved.map(layer => layer.id === 'neck' || layer.id === 'base'
        ? { ...layer, assetId: definition.id, displayName: definition.name, svgRaw: layer.id === 'neck' ? definition.svg : definition.bodySvg! }
        : layer);
      continue;
    }
    const side = definition.registration.side === 'left' ? 'Left' : 'Right';
    const keepUrl = `data:image/svg+xml;base64,${btoa(definition.keepSvg!)}`;
    resolved = resolved.filter(layer => ![`sleeveHem${side}`, `underSleeve${side}`, `underlayerHem${side}`].includes(layer.id)).map(layer => {
      if (layer.id === layerId) return { ...layer, assetId: definition.id, displayName: definition.name, svgRaw: definition.svg };
      if (!['base', 'outline', 'stitching'].includes(layer.id)) return layer;
      const maskId = `custom-${definition.id.replace(/[^a-z0-9-]/gi, '')}-${layer.id}`;
      const defs = `<defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:alpha"><image href="${keepUrl}" width="2048" height="2048"/></mask></defs>`;
      return { ...layer, svgRaw: layer.svgRaw.replace(/(<svg[^>]*>)/, `$1${defs}<g mask="url(#${maskId})">`).replace('</svg>', '</g></svg>') };
    });
  }
  return resolved;
}

export function customAssetTransforms(state: CustomAssetState, garmentType: string, fit: string, view: AssetView,
  builtins?: Partial<Record<string, TshirtLayerTransform>>) {
  const transforms = { ...builtins };
  for (const { definition, instance } of activeCustomAssets(state, garmentType, fit, view)) {
    const base = definition.registration.defaultTransform;
    const user = instance.userTransform;
    if (definition.category === 'collar') transforms.base = { ...DEFAULT_TSHIRT_LAYER_TRANSFORM };
    transforms[definition.registration.layerId] = { x: base.x + user.x, y: base.y + user.y,
      scale: base.scale * user.scale, scaleX: (base.scaleX ?? base.scale) * (user.scaleX ?? user.scale),
      scaleY: (base.scaleY ?? base.scale) * (user.scaleY ?? user.scale), rotation: base.rotation + user.rotation };
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
  return { ...state.customAssetInstances, [customAssetKey(view, layerId)]: { ...active.instance, userTransform } };
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