import { useMemo } from 'react';
import type { GarmentType } from '../../data/builderSteps';
import {
  applyGarmentFitAndLinks,
  getDefaultGarmentSelection,
  resolveGarmentPackFit,
  resolveProductSvgType,
  type CustomCollarSvgs,
  type GarmentAssetSelection,
  type GarmentSvgGarmentType,
} from '../../data/garmentSvgCatalog';
import type { TshirtLayerTransform } from '../../data/tshirtLayerAssets';
import { BuilderGarmentPreview } from '../builder/BuilderGarmentPreview';
import { TshirtSvgPreview } from '../builder/TshirtSvgPreview';
import { PrintsDesignPreview, type DesignElement } from '../builder/PrintsDesignStep';
import { cn } from '../ui/utils';

/** Subset of builder state needed to render a draft/dashboard preview. */
export type ProjectPreviewState = {
  garmentType?: string;
  prints?: DesignElement[];
  printsCanvasSize?: { width: number; height: number };
  fit?: string;
  hoodieAssemblyVersion?: number;
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
  partColors?: Partial<Record<string, string>>;
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
  garmentSide?: 'front' | 'back';
};

/** Render saved artwork through the editor compositor, never a reduced thumbnail or screenshot. */
export function ProjectGarmentPreview({
  garmentType,
  state,
  className,
  fill = true,
  garmentSide = 'front',
}: ProjectGarmentPreviewProps) {
  const preview = (state ?? {}) as ProjectPreviewState;
  const type = asGarmentType(preview.garmentType, garmentType);
  const color = preview.colors?.[0]?.hex || '#5C7FB6';
  const svgType = resolveProductSvgType(type, preview.svgPack);
  const fit = svgType ? resolveGarmentPackFit(svgType, preview.fit) ?? preview.fit : preview.fit;
  const selection = useMemo(() => {
    if (!svgType) return null;
    return applyGarmentFitAndLinks(svgType, {
      ...getDefaultGarmentSelection(svgType, fit),
      ...preview.tshirtAssetSelection,
    }, fit);
  }, [svgType, preview.tshirtAssetSelection, fit]);

  return (
    <div
      className={cn(
        'pointer-events-none relative flex items-center justify-center overflow-hidden',
        fill && 'absolute inset-0',
        className,
      )}
      data-project-garment-side={garmentSide}
      aria-hidden
    >
      <PrintsDesignPreview
        canvasSize={preview.printsCanvasSize ?? { width: 520, height: 560 }}
        className="h-full max-h-full w-full max-w-full"
        elements={preview.prints ?? []}
        garmentSide={garmentSide}
        garmentPreview={svgType && selection ? (
          <TshirtSvgPreview
            garmentType={svgType}
            color={color}
            selection={selection}
            fit={fit}
            hoodieAssemblyVersion={preview.hoodieAssemblyVersion}
            neckTrimColor={preview.neckTrimColor}
            sleeveTrimColor={preview.sleeveTrimColor}
            cuffTrimColor={preview.cuffTrimColor}
            pocketTrimColor={preview.pocketTrimColor}
            partColors={preview.partColors}
            customCollar={preview.customCollar}
            customCollars={preview.customCollars}
            layerTransforms={preview.tshirtLayerTransforms}
            className="h-full w-full min-h-0"
          />
        ) : (
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
            className="h-full max-h-full w-full object-contain"
          />
        )}
      />
    </div>
  );
}

export function ProjectGarmentViews({ garmentType, state }: Pick<ProjectGarmentPreviewProps, 'garmentType' | 'state'>) {
  return (
    <div className="grid grid-cols-2 gap-3" aria-label="Garment artwork preview">
      {(['front', 'back'] as const).map((side) => (
        <figure key={side}>
          <div className="relative aspect-square overflow-hidden rounded-lg bg-black/20">
            <ProjectGarmentPreview garmentType={garmentType} state={state} garmentSide={side} />
          </div>
          <figcaption className="mt-2 text-center text-xs capitalize text-white/55">{side}</figcaption>
        </figure>
      ))}
    </div>
  );
}
