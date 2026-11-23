import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import {
  GARMENT_NONE,
  getGarmentAssets,
  isGarmentCategoryOptional,
  type GarmentSvgGarmentType,
} from '../../data/garmentSvgCatalog';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';

/** Filename placeholders are catalogue metadata; keep stored asset IDs unchanged. */
export function garmentAssetLabel(displayName: string): string {
  const placeholder = /^Untitled[_ ]Artwork[-_ ](\d+)$/i.exec(displayName);
  return placeholder
    ? cerigaTranslate('interface.garmentStyle', { number: placeholder[1] })
    : cerigaTranslateLabel(displayName);
}

export function GarmentAssetChoiceGrid({
  garmentType,
  category,
  selected,
  onSelect,
}: {
  garmentType: GarmentSvgGarmentType;
  category: string;
  selected?: string;
  onSelect: (assetId: string) => void;
}) {
  useCerigaTranslation();

  const assets = getGarmentAssets(garmentType, category);
  const allowNone = isGarmentCategoryOptional(garmentType, category);

  return (
    <div>
      <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
        {cerigaTranslateLabel(category)}
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
            <div className="text-[10px] font-medium leading-snug sm:text-[11px]">{cerigaTranslate("interface.text_dc937b59892604f5")}</div>
          </button>
        ) : null}
        {assets.map((asset) => (
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
            <div className="break-words text-[10px] font-medium leading-snug sm:text-[11px]">
              {garmentAssetLabel(asset.displayName)}
            </div>
          </button>
        ))}
      </div>
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
  useCerigaTranslation();

  return (
    <div>
      <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
        {cerigaTranslateLabel(category)}
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
            <div className="text-[10px] font-medium leading-snug sm:text-[11px]">{cerigaTranslate("interface.text_dc937b59892604f5")}</div>
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
            <div className="break-words text-[10px] font-medium leading-snug sm:text-[11px]">
              {garmentAssetLabel(asset.displayName)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
