import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { RotateCcw, X } from 'lucide-react';
import { garmentLayerLabel } from '../../data/garmentSvgCatalog';
import type { GarmentSvgGarmentType } from '../../data/garmentSvgCatalog';
import { cn } from '../ui/utils';

export function garmentLayerDisplayName(id: string, garmentType?: GarmentSvgGarmentType): string {
  return garmentLayerLabel(id, garmentType);
}

export function TshirtLayerToolbar({
  selectedLayerId,
  selectedAssetName,
  garmentType,
  onResetTransform,
  onClearSelection,
  className,
}: {
  selectedLayerId: string | null;
  selectedAssetName?: string;
  garmentType?: GarmentSvgGarmentType;
  onResetTransform: () => void;
  onClearSelection: () => void;
  className?: string;
}) {
  useCerigaTranslation();

  const hasSelection = Boolean(selectedLayerId);

  return (
    <div
      role="status"
      aria-label={cerigaTranslate("interface.text_8f0a2ad327ca0d08")}
      className={cn(
        'flex items-center gap-2 rounded-2xl border border-white/12 bg-black/60 px-3 py-2 shadow-[0_6px_20px_rgba(0,0,0,0.35)] backdrop-blur-xl',
        className,
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="min-w-0 truncate text-[10px] font-semibold text-white/90 sm:text-[11px]">
        {hasSelection ? (
          <>
            {garmentLayerDisplayName(selectedLayerId!, garmentType)}
            {selectedAssetName ? (
              <span className="ml-1 font-normal text-white/45">({selectedAssetName})</span>
            ) : null}
          </>
        ) : (
          <span className="text-white/40">{cerigaTranslate("interface.text_76b9f09410972fec")}</span>
        )}
      </span>

      {hasSelection ? (
        <>
          <div className="h-3.5 w-px shrink-0 bg-white/15" />

          <button
            type="button"
            title={cerigaTranslate("interface.text_4936c80204067920")}
            onClick={onResetTransform}
            className="builder-focus flex shrink-0 items-center gap-1 text-[9px] font-semibold text-white/50 transition hover:text-white sm:text-[10px]"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={2} />
            <span>{cerigaTranslate("interface.text_daee7606b339f3c3")}</span>
          </button>

          <button
            type="button"
            aria-label={cerigaTranslate("interface.text_142174c194577c23")}
            onClick={onClearSelection}
            className="builder-focus -mr-0.5 shrink-0 text-white/35 transition hover:text-white"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </>
      ) : null}
    </div>
  );
}
