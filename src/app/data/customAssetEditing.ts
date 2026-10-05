import type { CustomAssetDefinition, CustomAssetInstance, CustomAssetState, AssetView } from './customAssets';
import { activeCustomAssets, customAssetKey } from './customAssets';
import type { TshirtLayerTransform } from './tshirtLayerAssets';
import { DEFAULT_TSHIRT_LAYER_TRANSFORM } from './garmentLayerTransform';
import { getPotraceSvgBBox } from '../lib/tshirtSvgUtils';

export type AssetUserTransform = TshirtLayerTransform & { mirror?: boolean };

export function editableAssetTransform(asset: CustomAssetDefinition, instance: CustomAssetInstance, canvasSize = 2048): AssetUserTransform {
  if (instance.userTransformVersion === 2) return instance.userTransform;
  const user = instance.userTransform;
  const anchored = assetUserPlacement(asset, { ...user, x: 0, y: 0 }, canvasSize);
  return { ...user, x: (asset.registration.defaultTransform.x + user.x - anchored.x) * 2048 / canvasSize,
    y: (asset.registration.defaultTransform.y + user.y - anchored.y) * 2048 / canvasSize };
}

export function resizeAssetUserTransform(user: AssetUserTransform, factor: number, axis: 'both' | 'width' | 'height'): AssetUserTransform {
  const scaleX = user.scaleX ?? user.scale;
  const scaleY = user.scaleY ?? user.scale;
  const values = axis === 'both' ? [scaleX, scaleY, user.scale] : [axis === 'width' ? scaleX : scaleY];
  const bounded = Math.max(Math.max(...values.map(value => .05 / value)), Math.min(Math.min(...values.map(value => 20 / value)), factor));
  return { ...user, scaleX: axis === 'height' ? scaleX : scaleX * bounded,
    scaleY: axis === 'width' ? scaleY : scaleY * bounded, scale: axis === 'both' ? user.scale * bounded : user.scale };
}

export function registeredAssetGeometry(asset: CustomAssetDefinition) {
  const bounds = getPotraceSvgBBox(asset.svg);
  if (!bounds) return undefined;
  const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  let anchor = center;
  if (asset.category === 'sleeve') {
    const target = asset.registration.anchors?.target as number[][] | undefined;
    const shoulder = target?.slice().sort((first, second) => first[1] - second[1])[0];
    const rasterSize = asset.registration.adaptation ? 1536 : 1024;
    anchor = shoulder ? { x: shoulder[0] * 2048 / rasterSize, y: shoulder[1] * 2048 / rasterSize }
      : { x: asset.registration.side === 'left' ? bounds.maxX : bounds.minX, y: bounds.minY };
  }
  return { bounds, center, anchor, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY };
}

function rotatedOffset(horizontal: number, vertical: number, rotation: number) {
  const radians = rotation * Math.PI / 180;
  return { x: horizontal * Math.cos(radians) - vertical * Math.sin(radians), y: horizontal * Math.sin(radians) + vertical * Math.cos(radians) };
}

export function assetUserPlacement(asset: CustomAssetDefinition, user: AssetUserTransform, canvasSize = 2048): TshirtLayerTransform {
  const base = asset.registration.defaultTransform;
  const geometry = registeredAssetGeometry(asset);
  const scaleX = (base.scaleX ?? base.scale) * (user.scaleX ?? user.scale) * (user.mirror ? -1 : 1);
  const scaleY = (base.scaleY ?? base.scale) * (user.scaleY ?? user.scale);
  const rotation = base.rotation + user.rotation;
  let offset = { x: user.x, y: user.y };
  if (geometry) {
    const horizontal = geometry.anchor.x - geometry.center.x;
    const vertical = geometry.anchor.y - geometry.center.y;
    const before = rotatedOffset(horizontal * (base.scaleX ?? base.scale), vertical * (base.scaleY ?? base.scale), base.rotation);
    const after = rotatedOffset(horizontal * scaleX, vertical * scaleY, rotation);
    offset = { x: offset.x + before.x - after.x, y: offset.y + before.y - after.y };
  }
  return { x: base.x + offset.x * canvasSize / 2048, y: base.y + offset.y * canvasSize / 2048,
    scale: base.scale * user.scale, scaleX, scaleY, rotation };
}

export function setAssetUserTransform(state: CustomAssetState, garmentType: string, fit: string, view: AssetView,
  layerId: string, user?: AssetUserTransform, linked = true) {
  const assets = activeCustomAssets(state, garmentType, fit, view);
  const selected = assets.find(item => item.definition.registration.layerId === layerId);
  if (!selected) return state.customAssetInstances;
  if (user && (![user.x, user.y, user.scale, user.scaleX ?? user.scale, user.scaleY ?? user.scale, user.rotation].every(Number.isFinite)
    || [user.scale, user.scaleX ?? user.scale, user.scaleY ?? user.scale].some(value => value < .05 || value > 20))) return state.customAssetInstances;
  const instances = { ...state.customAssetInstances };
  for (const item of assets) {
    const opposite = linked && selected.definition.category === 'sleeve' && item.definition.category === 'sleeve'
      && item.definition.registration.side !== selected.definition.registration.side;
    if (item !== selected && !opposite) continue;
    const transform = user ? { ...user, ...(opposite ? { x: -user.x, rotation: -user.rotation } : {}) } : { ...DEFAULT_TSHIRT_LAYER_TRANSFORM };
    instances[customAssetKey(view, item.definition.registration.layerId)] = { ...item.instance, userTransform: transform, userTransformVersion: 2 };
  }
  return instances;
}