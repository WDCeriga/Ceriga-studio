import { Palette } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../ui/utils';
import { Input } from '../ui/input';
import { AdvancedColorPopover } from './AdvancedColorPopover';
import { normalizeHex6 } from '../../lib/colorUtils';

function PresetGrid({
  colors,
  selected,
  onSelect,
}: {
  colors: readonly string[];
  selected: string;
  onSelect: (hex: string) => void;
}) {
  return (
    <div
      className={cn(
        // One horizontal row of 10 (not 5×2 — that looked like odd vertical “pairs” on phone).
        'grid grid-cols-10 gap-1 sm:gap-1.5',
      )}
    >
      {colors.map((color) => {
        const norm = normalizeHex6(color);
        const active = normalizeHex6(selected) === norm;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onSelect(norm)}
            className={cn(
              'aspect-square w-full min-w-0 rounded-lg border transition-all active:scale-[0.97]',
              active
                ? 'border-[#FF3B30] ring-1 ring-[#FF3B30]/45'
                : 'border-white/15 hover:border-white/35',
            )}
            style={{ backgroundColor: norm }}
            aria-label={`Colour ${norm}`}
          />
        );
      })}
    </div>
  );
}

export function StudioColorField({
  value,
  onChange,
  mainColors,
  popularColors,
  mainLabel = 'Main colours',
  popularLabel = 'Popular',
  className,
  onClear,
  clearLabel = 'Clear',
  clearVisible = true,
}: {
  value: string;
  onChange: (hex: string) => void;
  mainColors: readonly string[];
  popularColors: readonly string[];
  mainLabel?: string;
  popularLabel?: string;
  className?: string;
  onClear?: () => void;
  clearLabel?: string;
  clearVisible?: boolean;
}) {
  const hex = normalizeHex6(value);
  const [hexDraft, setHexDraft] = useState(hex);

  useEffect(() => {
    setHexDraft(hex);
  }, [hex]);

  const commitHexInput = () => {
    onChange(normalizeHex6(hexDraft));
  };

  return (
    <div className={cn('space-y-1.5 sm:space-y-2', className)}>
      <div className="flex min-w-0 items-stretch gap-2">
        <AdvancedColorPopover value={hex} onChange={onChange}>
          <button
            type="button"
            className="group relative aspect-square w-[3.25rem] shrink-0 overflow-hidden rounded-xl border border-white/18 bg-black/30 shadow-inner transition hover:border-white/32 sm:aspect-[5/3] sm:w-[5.5rem]"
            aria-label="Open colour picker"
          >
            <span className="absolute inset-0" style={{ backgroundColor: hex }} aria-hidden />
            <span
              className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/12 bg-black/55 text-white shadow-sm backdrop-blur-sm transition group-hover:bg-black/65 sm:h-6 sm:w-6"
              aria-hidden
            >
              <Palette className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={2} />
            </span>
          </button>
        </AdvancedColorPopover>
        <Input
          value={hexDraft}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={commitHexInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitHexInput();
              (e.target as HTMLInputElement).blur();
            }
          }}
          spellCheck={false}
          placeholder="#FFFFFF"
          className="h-9 min-w-0 flex-1 rounded-full border-white/12 bg-black/35 px-3 font-mono text-[11px] text-white placeholder:text-white/28"
          aria-label="Hex colour"
        />
      </div>

      <div>
        <div className="mb-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-white/40 sm:mb-1">{mainLabel}</div>
        <PresetGrid colors={mainColors} selected={hex} onSelect={onChange} />
      </div>

      <div>
        <div className="mb-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-white/40 sm:mb-1">{popularLabel}</div>
        <PresetGrid colors={popularColors} selected={hex} onSelect={onChange} />
      </div>

      {onClear && clearVisible ? (
        <button
          type="button"
          onClick={onClear}
          className="text-[9px] font-medium text-white/40 underline-offset-2 hover:text-white/65 hover:underline"
        >
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}
