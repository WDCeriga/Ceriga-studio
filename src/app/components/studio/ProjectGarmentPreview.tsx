import { useMemo } from 'react';
import type { TshirtHemStyles } from '../../data/tshirtHemStyles';
import type { TshirtStitching } from '../../data/tshirtStitching';
import type { GarmentDetail } from '../../data/garmentDetails';
import type { GarmentType } from '../../data/builderSteps';
import {
  applyGarmentFitAndLinks,
  getDefaultGarmentSelection,
  resolveProductSvgType,
  type CustomCollarSvgs,
  type GarmentAssetSelection,
  type GarmentSvgGarmentType,
} from '../../data/garmentSvgCatalog';
import type { TshirtLayerTransform } from '../../data/tshirtLayerAssets';
import { BuilderGarmentPreview } from '../builder/BuilderGarmentPreview';
import { TshirtSvgPreview } from '../builder/TshirtSvgPreview';
import { GarmentFlatIcon } from './GarmentFlatIcon';
import { cn } from '../ui/utils';

/** Subset of builder state needed to render a draft/dashboard preview. */
export type ProjectPreviewState = {
  garmentType?: string;
  colors?: Array<{ hex?: string; pantone?: string }>;
  neckType?: string;
  sleeveType?: string;
  sleeveLength?: string;
  hemType?: string;
  cuffType?: string;
  pocketType?: string;
  zipType?: string;
  fadingType?: string;
  stitchingType?: string;
  stitchingColor?: string;
  neckTrimColor?: string;
  sleeveTrimColor?: string;
  cuffTrimColor?: string;
  pocketTrimColor?: string;
  tshirtAssetSelection?: GarmentAssetSelection;
  tshirtLayerTransforms?: Partial<Record<string, TshirtLayerTransform>>;
  svgPack?: GarmentSvgGarmentType;
  fit?: string;
  partColors?: Partial<Record<string, string>>;
  tshirtHemStyles?: TshirtHemStyles;
  tshirtStitching?: TshirtStitching;
  garmentDetails?: GarmentDetail[];
  customCollar?: CustomCollarSvgs | null;
  customCollars?: CustomCollarSvgs[];
};

function asGarmentType(value: string | undefined, fallback: string): GarmentType {
  const candidate = (value || fallback || 'tshirt') as GarmentType;
  return candidate;
}

type ProjectGarmentPreviewProps = {
  garmentType: string;
  state?: ProjectPreviewState | Record<string, unknown> | null;
  className?: string;
  /** When true, fill the parent (card media area). */
  fill?: boolean;
};

/**
 * Read-only garment preview from a saved project `state` blob —
 * same SVG compositor / fallback silhouette as the builder canvas.
 */
export function ProjectGarmentPreview({
  garmentType,
  state,
  className,
  fill = true,
}: ProjectGarmentPreviewProps) {
  const preview = (state ?? {}) as ProjectPreviewState;
  const type = asGarmentType(preview.garmentType, garmentType);
  const color = preview.colors?.[0]?.hex || '#5C7FB6';

  const svgType = resolveProductSvgType(type, preview.svgPack);

  const selection = useMemo(() => {
    if (!svgType) return null;
    return applyGarmentFitAndLinks(
      svgType,
      {
        ...getDefaultGarmentSelection(svgType, preview.fit),
        ...preview.tshirtAssetSelection,
      },
      preview.fit,
    );
  }, [svgType, preview.tshirtAssetSelection, preview.fit]);

  if (svgType && selection) {
    return (
      <div
        className={cn(
          'pointer-events-none relative overflow-hidden',
          fill && 'absolute inset-0',
          className,
        )}
        aria-hidden
      >
        <TshirtSvgPreview
          garmentType={svgType}
          color={color}
          selection={selection}
          fit={preview.fit}
          neckTrimColor={preview.neckTrimColor}
          sleeveTrimColor={preview.sleeveTrimColor}
          cuffTrimColor={preview.cuffTrimColor}
          pocketTrimColor={preview.pocketTrimColor}
          stitchingColor={preview.stitchingColor}
          partColors={preview.partColors}
          tshirtHemStyles={preview.tshirtHemStyles}
          tshirtStitching={preview.tshirtStitching}
          garmentDetails={preview.garmentDetails}
          customCollar={preview.customCollar}
          customCollars={preview.customCollars}
          layerTransforms={preview.tshirtLayerTransforms}
          className="h-full w-full min-h-0 scale-[0.92]"
        />
      </div>
    );
  }

  if (type) {
    return (
      <div
        className={cn(
          'pointer-events-none relative flex items-center justify-center overflow-hidden p-4',
          fill && 'absolute inset-0',
          className,
        )}
        aria-hidden
      >
        <BuilderGarmentPreview
          garmentType={type}
          color={color}
          neckType={preview.neckType}
          sleeveType={preview.sleeveType}
          sleeveLength={preview.sleeveLength}
          hemType={preview.hemType}
          cuffType={preview.cuffType}
          pocketType={preview.pocketType}
          zipType={preview.zipType}
          fadingType={preview.fadingType}
          stitchingType={preview.stitchingType}
          stitchingColor={preview.stitchingColor}
          neckTrimColor={preview.neckTrimColor}
          sleeveTrimColor={preview.sleeveTrimColor}
          pocketTrimColor={preview.pocketTrimColor}
          className="mx-auto h-full max-h-full w-auto max-w-[85%]"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'pointer-events-none flex items-center justify-center p-7',
        fill && 'absolute inset-0',
        className,
      )}
      aria-hidden
    >
      <GarmentFlatIcon type={garmentType} className="max-h-full max-w-[80px]" />
    </div>
  );
}
