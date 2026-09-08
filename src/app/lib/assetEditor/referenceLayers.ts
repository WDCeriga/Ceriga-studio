import { getGarmentAssets, getGarmentAsset, getGarmentSvgConfig, type GarmentSvgGarmentType } from '../../data/garmentSvgCatalog';
import { tintPotraceSvg } from '../tshirtSvgUtils';

export interface EditorReferenceLayer {
  id: string;
  label: string;
  svgDataUrl: string;
  opacity: number;
  kind: 'base' | 'context' | 'category';
}

export function extractSvgBody(svgRaw: string): string {
  const match = svgRaw.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  return match?.[1]?.trim() ?? '';
}

export function prepareLabReferenceSvg(svgRaw: string, fillColor: string): string {
  return svgRaw
    .replace(/width="[^"]*"/i, 'width="2048"')
    .replace(/height="[^"]*"/i, 'height="2048"')
    .replace(/fill="#000000"/gi, `fill="${fillColor}"`)
    .replace(/fill="#000"/gi, `fill="${fillColor}"`)
    .replace(/fill="black"/gi, `fill="${fillColor}"`)
    .replace(
      /(<g transform="[^"]+")[^>]*>/,
      `$1 fill="${fillColor}" stroke="none" fill-rule="evenodd">`,
    )
    .replace(/<path /gi, `<path fill="${fillColor}" `);
}

export function toReferenceSvgDataUrl(svgRaw: string, fillColor: string): string {
  const tinted = prepareLabReferenceSvg(svgRaw, fillColor);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tinted)}`;
}

/** @deprecated use toReferenceSvgDataUrl */
export function toReferenceSvgBody(
  svgRaw: string,
  color: string,
  mode: 'outline' | 'solid' = 'outline',
): string {
  return extractSvgBody(tintPotraceSvg(svgRaw, color, mode));
}

function baseCategoryFor(garmentType: GarmentSvgGarmentType): string {
  const config = getGarmentSvgConfig(garmentType);
  if (garmentType === 'tshirt') return 'T-shirt Base';
  if (garmentType === 'hoodie') return 'base';
  return 'trouser base';
}

/** Extra categories shown as context when editing dependent parts. */
function contextCategoriesFor(
  garmentType: GarmentSvgGarmentType,
  category: string,
): string[] {
  if (garmentType !== 'tshirt') {
    const config = getGarmentSvgConfig(garmentType);
    if (category === config.sleeveHemCategory && config.sleeveCategory) {
      return [config.sleeveCategory];
    }
    return [];
  }

  if (category === 'T-shirt sleeve hem') return ['T-shirt sleeves'];
  if (category === 'T-shirt pockets' || category === 'T-shirt zips' || category === 'T-shirt zip pulls') {
    return ['T-shirt sleeves'];
  }
  return [];
}

export interface ResolveReferenceLayersInput {
  garmentType: GarmentSvgGarmentType;
  category: string;
  categoryReferenceAssetId?: string;
  showBase?: boolean;
  showCategoryReference?: boolean;
  showContext?: boolean;
}

export function resolveEditorReferenceLayers({
  garmentType,
  category,
  categoryReferenceAssetId,
  showBase = true,
  showCategoryReference = true,
  showContext = true,
}: ResolveReferenceLayersInput): EditorReferenceLayer[] {
  const layers: EditorReferenceLayer[] = [];
  const baseCategory = baseCategoryFor(garmentType);
  const seenAssetIds = new Set<string>();

  const pushLayer = (layer: EditorReferenceLayer, assetId: string) => {
    if (seenAssetIds.has(assetId)) return;
    seenAssetIds.add(assetId);
    layers.push(layer);
  };

  if (showBase) {
    const baseAssets = getGarmentAssets(garmentType, baseCategory);
    const baseAsset = baseAssets[0];
    if (baseAsset) {
      pushLayer(
        {
          id: `base:${baseAsset.id}`,
          label: `Base · ${baseAsset.displayName}`,
          svgDataUrl: toReferenceSvgDataUrl(baseAsset.svgRaw, '#e2e8f0'),
          opacity: category === baseCategory ? 0.85 : 0.65,
          kind: 'base',
        },
        baseAsset.id,
      );
    }
  }

  if (showContext) {
    for (const contextCategory of contextCategoriesFor(garmentType, category)) {
      if (contextCategory === category) continue;
      const contextAssets = getGarmentAssets(garmentType, contextCategory);
      const contextAsset = contextAssets[0];
      if (!contextAsset) continue;
      pushLayer(
        {
          id: `context:${contextAsset.id}`,
          label: `${contextCategory} · ${contextAsset.displayName}`,
          svgDataUrl: toReferenceSvgDataUrl(contextAsset.svgRaw, '#a5b4fc'),
          opacity: 0.6,
          kind: 'context',
        },
        contextAsset.id,
      );
    }
  }

  if (showCategoryReference) {
    const categoryAssets = getGarmentAssets(garmentType, category);
    const refAsset =
      (categoryReferenceAssetId ? getGarmentAsset(categoryReferenceAssetId) : undefined) ??
      categoryAssets[0];
    if (refAsset) {
      pushLayer(
        {
          id: `category:${refAsset.id}`,
          label: `${category} · ${refAsset.displayName}`,
          svgDataUrl: toReferenceSvgDataUrl(refAsset.svgRaw, '#22d3ee'),
          opacity: 0.75,
          kind: 'category',
        },
        refAsset.id,
      );
    }
  }

  return layers;
}

export function defaultCategoryReferenceId(
  garmentType: GarmentSvgGarmentType,
  category: string,
): string | undefined {
  return getGarmentAssets(garmentType, category)[0]?.id;
}
