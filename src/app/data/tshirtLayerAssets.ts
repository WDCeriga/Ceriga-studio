import type { GarmentType } from './builderSteps';
import { supportsGarmentSvgPreview } from './garmentSvgCatalog';

export type TshirtLayerId =
  | 'fill'
  | 'base'
  | 'sleeves'
  | 'sleeveLeft'
  | 'sleeveRight'
  | 'neck'
  | 'sleeveHem'
  | 'sleeveHemLeft'
  | 'sleeveHemRight'
  | 'bodyHem'
  | 'pocket'
  | 'placket'
  | 'zip'
  | 'zipPull';

export type GarmentLayerId = TshirtLayerId | HoodieLayerId | TrouserLayerId;

export type HoodieLayerId =
  | 'fill'
  | 'base'
  | 'sleeves'
  | 'sleeveLeft'
  | 'sleeveRight'
  | 'neck'
  | 'hood'
  | 'pocket'
  | 'drawstring'
  | 'zip'
  | 'zipPull'
  | 'fading'
  | 'stitching';

export type TrouserLayerId =
  | 'fill'
  | 'base'
  | 'fit'
  | 'fabric'
  | 'bodyHem'
  | 'trouserHem'
  | 'pocket'
  | 'drawstring'
  | 'fading';

export interface TshirtLayerTransform {
  x: number;
  y: number;
  /** Uniform scale fallback when scaleX / scaleY are unset. */
  scale: number;
  scaleX?: number;
  scaleY?: number;
  rotation: number;
}

export const DEFAULT_TSHIRT_LAYER_TRANSFORM: TshirtLayerTransform = {
  x: 0,
  y: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};

export function resolveLayerScale(t: TshirtLayerTransform): { scaleX: number; scaleY: number } {
  const fallback = t.scale ?? 1;
  return {
    scaleX: t.scaleX ?? fallback,
    scaleY: t.scaleY ?? fallback,
  };
}

export const TSHIRT_CANVAS = 2048;

/** Layer id used when persisting transforms. */
export function tshirtTransformStorageId(id: TshirtLayerId): TshirtLayerId {
  return id;
}

/** Map split sleeve/cuff ids back to their asset category layer. */
export function tshirtSourceLayerId(id: TshirtLayerId): TshirtLayerId {
  if (id === 'sleeveLeft' || id === 'sleeveRight') return 'sleeves';
  if (id === 'sleeveHemLeft' || id === 'sleeveHemRight') return 'sleeveHem';
  return id;
}

export function supportsTshirtLayerPreview(garmentType: GarmentType): boolean {
  return supportsGarmentSvgPreview(garmentType);
}

export {
  GARMENT_NONE,
  getDefaultGarmentSelection,
  getGarmentAsset,
  getGarmentAssets,
  getGarmentCategoriesForStep,
  getGarmentSelectionLabel,
  getGarmentSpecRows,
  getGarmentSvgConfig,
  garmentBuilderStepForLayerId,
  garmentLayerForBuilderStep,
  garmentLayerLabel,
  garmentSourceLayerId,
  garmentTransformStorageId,
  isGarmentCategoryOptional,
  isGarmentSvgGarmentType,
  resolveGarmentLayers,
  resolveGarmentSvgType,
  supportsGarmentSvgPreview,
  type GarmentAsset,
  type GarmentAssetSelection,
  type GarmentSvgGarmentType,
  type ResolvedGarmentLayer,
} from './garmentSvgCatalog';

export {
  getTshirtCategoriesForStep,
  getTshirtAssets,
  getDefaultTshirtSelection,
  getSelectionLabel,
  resolveTshirtLayers,
  tshirtBuilderStepForLayerId,
  tshirtLayerForBuilderStep,
  tshirtLayerLabelForStep,
  TSHIRT_NONE,
  type TshirtAsset,
  type TshirtAssetSelection,
  type TshirtCategoryId,
  type ResolvedTshirtLayer,
} from './tshirtAssetCatalog';

export {
  TSHIRT_CUFF_DEFAULTS,
  TSHIRT_DEFAULT_HEM_ASSET_ID,
  TSHIRT_HEM_ASSET_IDS,
  TSHIRT_SLEEVE_ASSET_IDS,
  mergeCuffSideTransform,
  resolveCuffAlignOffset,
  resolveTshirtCuffDefaults,
  tshirtCuffPairKey,
  type TshirtCuffAlignAdjust,
  type TshirtCuffDefaults,
  type TshirtCuffSideDefaults,
} from './tshirtCuffDefaults';
