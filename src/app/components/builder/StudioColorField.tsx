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
    <div className="grid grid-cols-5 gap-1 sm:grid-cols-10 sm:gap-1.5">
      {colors.map((color) => {
        const norm = normalizeHex6(color);
        const active = normalizeHex6(selected) === norm;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onSelect(norm)}
            className={cn(
              'h-6 w-full min-w-0 shrink-0 rounded-md border transition-all sm:h-7',
              active
                ? 'border-[#FF3B30] ring-1 ring-[#FF3B30]/50'
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
    <div className={cn('space-y-2', className)}>
      <div className="flex min-w-0 items-stretch gap-2">
        <AdvancedColorPopover value={hex} onChange={onChange}>
          <button
            type="button"
            className="group relative aspect-[5/3] w-[5.25rem] shrink-0 overflow-hidden rounded-xl border border-white/18 bg-black/30 shadow-inner transition hover:border-white/32 sm:w-[5.75rem]"
            aria-label="Open colour picker"
          >
            <span className="absolute inset-0" style={{ backgroundColor: hex }} aria-hidden />
            <span
              className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/12 bg-black/55 text-white shadow-sm backdrop-blur-sm transition group-hover:bg-black/65"
              aria-hidden
            >
              <Palette className="h-3 w-3" strokeWidth={2} />
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
        <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-white/40">{mainLabel}</div>
        <PresetGrid colors={mainColors} selected={hex} onSelect={onChange} />
      </div>

      <div>
        <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-white/40">{popularLabel}</div>
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
