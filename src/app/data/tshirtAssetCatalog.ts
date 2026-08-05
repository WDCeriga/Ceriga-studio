import type { GarmentSvgGarmentType } from './garmentSvgCatalog';
import {
  GARMENT_NONE,
  getDefaultGarmentSelection,
  getGarmentAsset,
  getGarmentAssets,
  getGarmentCategoriesForStep,
  getGarmentSelectionLabel,
  getGarmentSvgConfig,
  resolveGarmentLayers,
  garmentBuilderStepForLayerId,
  garmentLayerForBuilderStep,
  type GarmentAsset,
  type GarmentAssetSelection,
  type ResolvedGarmentLayer,
} from './garmentSvgCatalog';
import type { TshirtLayerId } from './tshirtLayerAssets';

const TSHIRT = 'tshirt' as const satisfies GarmentSvgGarmentType;

export const TSHIRT_CATEGORY_ORDER = getGarmentSvgConfig(TSHIRT).categoryOrder;
export type TshirtCategoryId = (typeof TSHIRT_CATEGORY_ORDER)[number];
export const TSHIRT_NONE = GARMENT_NONE;

export type TshirtAsset = GarmentAsset;
export type TshirtAssetSelection = GarmentAssetSelection;
export type ResolvedTshirtLayer = ResolvedGarmentLayer & { id: TshirtLayerId };

export function fileNameToDisplayName(fileName: string): string {
  return fileName.replace(/\.svg$/i, '');
}

export function getTshirtAssets(category: TshirtCategoryId) {
  return getGarmentAssets(TSHIRT, category);
}

export function getTshirtAsset(assetId: string) {
  return getGarmentAsset(assetId);
}

export function getDefaultTshirtSelection(): Record<TshirtCategoryId, string> {
  return getDefaultGarmentSelection(TSHIRT) as Record<TshirtCategoryId, string>;
}

export function getTshirtCategoriesForStep(step: number): TshirtCategoryId[] {
  return getGarmentCategoriesForStep(TSHIRT, step) as TshirtCategoryId[];
}

export const TSHIRT_CATEGORY_LAYER_ID = getGarmentSvgConfig(TSHIRT)
  .categoryLayerId as Record<TshirtCategoryId, TshirtLayerId>;
export const TSHIRT_CATEGORY_Z_INDEX = getGarmentSvgConfig(TSHIRT)
  .categoryZIndex as Record<TshirtCategoryId, number>;

export function tshirtLayerForBuilderStep(step: number): TshirtLayerId | null {
  return garmentLayerForBuilderStep(TSHIRT, step) as TshirtLayerId | null;
}

export function tshirtBuilderStepForLayerId(id: TshirtLayerId): number | null {
  return garmentBuilderStepForLayerId(TSHIRT, id);
}

export function tshirtLayerLabelForStep(step: number): string | null {
  return getGarmentCategoriesForStep(TSHIRT, step)[0] ?? null;
}

export function resolveTshirtLayers(input: {
  selection: TshirtAssetSelection;
  neckTrimColor?: string;
  sleeveTrimColor?: string;
  cuffTrimColor?: string;
  pocketTrimColor?: string;
}): ResolvedTshirtLayer[] {
  return resolveGarmentLayers({ garmentType: TSHIRT, ...input }) as ResolvedTshirtLayer[];
}

export function getSelectionLabel(selection: TshirtAssetSelection, category: TshirtCategoryId): string {
  return getGarmentSelectionLabel(TSHIRT, selection, category);
}
