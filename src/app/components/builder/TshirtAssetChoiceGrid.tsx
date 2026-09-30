import {
  GARMENT_NONE,
  getGarmentAsset,
  getGarmentAssetOptionLabel,
  getGarmentAssets,
  getGarmentAssetsForFit,
  isGarmentCategoryOptional,
  type GarmentSvgGarmentType,
} from '../../data/garmentSvgCatalog';
import { getHoodBundleAsset, getHoodFrontConstructionOptions } from '../../data/hoodBundles';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';

export function GarmentAssetChoiceGrid({
  garmentType,
  category,
  selected,
  onSelect,
  fit,
  extraAssets,
}: {
  garmentType: GarmentSvgGarmentType;
  category: string;
  selected?: string;
  onSelect: (assetId: string) => void;
  fit?: string;
  extraAssets?: Array<{ id: string; displayName: string }>;
}) {
  const isHood = garmentType === 'hoodie' && category === 'Hood';
  const selectedHood = isHood ? getHoodBundleAsset(selected) : undefined;
  const availableAssets = [
    ...getGarmentAssetsForFit(garmentType, category, fit),
    ...(extraAssets ?? []),
  ];
  const assets = availableAssets.filter((asset, index) => {
    const hood = isHood ? getHoodBundleAsset(asset.id) : undefined;
    return !hood || availableAssets.findIndex(candidate =>
      getHoodBundleAsset(candidate.id)?.bundle.styleId === hood.bundle.styleId) === index;
  });
  const frontOptions = selectedHood
    ? getHoodFrontConstructionOptions(selectedHood.bundle.styleId, fit ?? selectedHood.variant.fit)
    : [];
  const allowNone = isGarmentCategoryOptional(garmentType, category);

  return (
    <div>
      <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
        {garmentType === 'hoodie' && category === 'Hood' ? 'Hood Type' : garmentType === 'hoodie' && category === 'Left sleeve' ? 'Sleeve Construction' : category}
      </Label>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {allowNone ? (
          <button
            type="button"
            onClick={() => onSelect(GARMENT_NONE)}
            className={cn(
              'rounded-md border px-2 py-1.5 text-center transition sm:rounded-lg sm:px-2.5 sm:py-2',
              selected === GARMENT_NONE || !selected
                ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-white'
                : 'border-[#252528] bg-white/5 text-white/60 hover:border-white/20 hover:text-white',
            )}
          >
            <div className="text-[10px] font-medium leading-snug sm:text-[11px]">None</div>
          </button>
        ) : null}
        {assets.map((asset) => {
          const hood = isHood ? getHoodBundleAsset(asset.id) : undefined;
          const active = hood ? selectedHood?.bundle.styleId === hood.bundle.styleId : selected === asset.id;
          const construction = hood?.bundle.styleId === 'scuba' ? 'standard' : selectedHood?.variant.frontConstruction ?? 'standard';
          const matching = hood && getHoodFrontConstructionOptions(hood.bundle.styleId, fit ?? hood.variant.fit)
            .find(option => option.frontConstruction === construction && option.selectable);
          const targetId = hood ? matching && matching.variant?.views.front.assetId : asset.id;
          const selectable = Boolean(targetId && (getGarmentAsset(targetId) || !hood));
          return (
          <button
            key={asset.id}
            type="button"
            aria-pressed={active}
            disabled={!selectable}
            title={!selectable ? 'Construction unavailable for this fit' : hood?.bundle.styleId === 'scuba' ? 'Scuba Hood - Standard' : undefined}
            onClick={() => {
              if (selectable && targetId) onSelect(targetId);
            }}
            className={cn(
              'rounded-md border px-2 py-1.5 text-center transition sm:rounded-lg sm:px-2.5 sm:py-2',
              active
                ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-white'
                : 'border-[#252528] bg-white/5 text-white/60 hover:border-white/20 hover:text-white',
            )}
          >
            <div className={cn('text-[10px] font-medium leading-snug sm:text-[11px]', garmentType === 'hoodie' && (category === 'Left sleeve' || category === 'Hood') ? 'break-normal' : 'break-all')}>
              {getGarmentAssetOptionLabel(asset)}
            </div>
          </button>
          );
        })}
      </div>
      {frontOptions.length > 0 ? (
        <fieldset className="mt-3 min-w-0">
          <legend className="mb-1.5 text-[10px] uppercase tracking-wider text-white/60">Front Construction</legend>
          <div className="flex overflow-hidden rounded-md border border-[#252528]">
            {frontOptions.map(option => {
              const assetId = option.variant?.views.front.assetId;
              const selectable = option.selectable && Boolean(assetId && getGarmentAsset(assetId));
              return (
                <button
                  key={option.frontConstruction}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={selectedHood?.variant.frontConstruction === option.frontConstruction}
                  disabled={!selectable}
                  title={selectable ? option.label : 'Awaiting approved asset'}
                  onClick={() => { if (selectable && assetId) onSelect(assetId); }}
                  className={cn(
                    'min-w-0 flex-1 px-2 py-2 text-[11px] leading-snug transition disabled:cursor-not-allowed disabled:text-white/30',
                    selectedHood?.variant.frontConstruction === option.frontConstruction
                      ? 'bg-[#FF3B30]/10 text-white' : 'bg-white/5 text-white/60 enabled:hover:bg-white/10',
                  )}
                >
                  {option.label}
                  {!selectable ? <span className="mt-0.5 block text-[9px]">Awaiting approval</span> : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

/** @deprecated Use GarmentAssetChoiceGrid */
export function TshirtAssetChoiceGrid({
  category,
  selected,
  onSelect,
  allowNone = false,
}: {
  category: string;
  selected?: string;
  onSelect: (assetId: string) => void;
  allowNone?: boolean;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
        {category}
      </Label>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {allowNone ? (
          <button
            type="button"
            onClick={() => onSelect(GARMENT_NONE)}
            className={cn(
              'rounded-md border px-2 py-1.5 text-center transition sm:rounded-lg sm:px-2.5 sm:py-2',
              selected === GARMENT_NONE || !selected
                ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-white'
                : 'border-[#252528] bg-white/5 text-white/60 hover:border-white/20 hover:text-white',
            )}
          >
            <div className="text-[10px] font-medium leading-snug sm:text-[11px]">None</div>
          </button>
        ) : null}
        {getGarmentAssets('tshirt', category).map((asset) => (
          <button
            key={asset.id}
            type="button"
            onClick={() => onSelect(asset.id)}
            className={cn(
              'rounded-md border px-2 py-1.5 text-center transition sm:rounded-lg sm:px-2.5 sm:py-2',
              selected === asset.id
                ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-white'
                : 'border-[#252528] bg-white/5 text-white/60 hover:border-white/20 hover:text-white',
            )}
          >
            <div className="break-all text-[10px] font-medium leading-snug sm:text-[11px]">
              {asset.displayName}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
