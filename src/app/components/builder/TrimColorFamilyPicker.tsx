import { Fragment, type RefObject, useEffect, useRef, useState } from 'react';
import { FABRIC_COLOR_FAMILIES } from '../../data/builderSteps';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';

export function TrimColorFamilyPicker({
  label,
  value,
  onChange,
  onClear,
  /** When set, only collapse expanded colours if the tap is inside this region (e.g. builder form) but outside the picker. */
  collapseBoundsRef,
}: {
  label: string;
  value?: string;
  onChange: (hex: string) => void;
  onClear?: () => void;
  collapseBoundsRef?: RefObject<HTMLElement | null>;
}) {
  const [expandedFamily, setExpandedFamily] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expandedFamily === null) return;
    const collapseIfOutside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (collapseBoundsRef?.current && !collapseBoundsRef.current.contains(t)) return;
      setExpandedFamily(null);
    };
    document.addEventListener('pointerdown', collapseIfOutside, true);
    return () => document.removeEventListener('pointerdown', collapseIfOutside, true);
  }, [expandedFamily, collapseBoundsRef]);

  return (
    <div ref={rootRef} className="mb-4">
      <Label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
        {label}
      </Label>
      <div className="grid grid-cols-2 gap-2">
        {FABRIC_COLOR_FAMILIES.map((family, familyIndex) => (
          <Fragment key={family.name}>
            {expandedFamily !== null &&
            expandedFamily % 2 === 1 &&
            familyIndex === expandedFamily ? (
              <div
                role="presentation"
                className="min-h-[2.35rem] w-full touch-manipulation"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setExpandedFamily(null);
                }}
              />
            ) : null}
            <div
              className={cn(expandedFamily === familyIndex && 'col-span-2')}
            >
            {expandedFamily === familyIndex ? (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">
                    {family.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedFamily(null)}
                    className="rounded px-1.5 py-0.5 text-[9px] text-white/40 hover:bg-white/5 hover:text-white/60"
                  >
                    Collapse
                  </button>
                </div>
                <div className="-mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-0.5 [-webkit-overflow-scrolling:touch]">
                  {family.colors.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => {
                        if (value === color.hex) {
                          onClear?.();
                        } else {
                          onChange(color.hex);
                        }
                      }}
                      className={cn(
                        'relative h-11 w-11 shrink-0 rounded-xl border transition-all',
                        value === color.hex
                          ? 'border-[#FF3B30] ring-1 ring-[#FF3B30]'
                          : 'border-white/20 hover:border-white/40',
                      )}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    >
                      {value === color.hex ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="h-1.5 w-1.5 rounded-full bg-white shadow-lg" />
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setExpandedFamily(familyIndex)}
                className="flex min-h-[2.35rem] w-full items-center gap-1.5 rounded border border-white/10 bg-white/5 px-1.5 py-1 transition-all hover:bg-white/10"
              >
                <div
                  className="h-5 w-5 flex-shrink-0 rounded border border-white/20"
                  style={{ backgroundColor: family.baseColor.hex }}
                />
                <span className="min-w-0 flex-1 truncate text-left text-[9px] text-white/60">{family.name}</span>
                <span className="shrink-0 text-[8px] text-white/30">Expand</span>
              </button>
            )}
            </div>
          </Fragment>
        ))}
      </div>

      {value ? (
        <div className="mt-2 flex items-center gap-2 rounded border border-white/10 bg-white/5 p-2">
          <div
            className="h-6 w-6 flex-shrink-0 rounded border border-white/20"
            style={{ backgroundColor: value }}
          />
          <div className="min-w-0">
            <div className="text-[9px] uppercase tracking-wider text-white/40">Selected trim</div>
            <div className="truncate text-[11px] font-semibold text-white">{value}</div>
          </div>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="ml-auto shrink-0 rounded px-2 py-1 text-[9px] text-white/45 hover:bg-white/10 hover:text-white/70"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
