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
  canTransform = true,
  className,
}: {
  selectedLayerId: string | null;
  selectedAssetName?: string;
  garmentType?: GarmentSvgGarmentType;
  onResetTransform: () => void;
  onClearSelection: () => void;
  canTransform?: boolean;
  className?: string;
}) {
  const hasSelection = Boolean(selectedLayerId);

  return (
    <div
      role="status"
      aria-label="Selected garment part"
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
          <span className="text-white/40">Click a part to select</span>
        )}
      </span>

      {hasSelection ? (
        <>
          <div className="h-3.5 w-px shrink-0 bg-white/15" />

          {canTransform && <button
            type="button"
            title="Reset position & scale"
            onClick={onResetTransform}
            className="builder-focus flex shrink-0 items-center gap-1 text-[9px] font-semibold text-white/50 transition hover:text-white sm:text-[10px]"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={2} />
            <span>Reset</span>
          </button>}

          <button
            type="button"
            aria-label="Deselect"
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
