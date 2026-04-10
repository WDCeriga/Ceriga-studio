import { STUDIO_MAIN_COLORS, STUDIO_POPULAR_COLORS } from '../../data/studioColorPresets';
import { Label } from '../ui/label';
import { StudioColorField } from './StudioColorField';

/** Trim / thread colour — compact picker (main + popular presets only). */
export function TrimColorFamilyPicker({
  label,
  value,
  onChange,
  onClear,
}: {
  label: string;
  value?: string;
  onChange: (hex: string) => void;
  onClear?: () => void;
}) {
  return (
    <div className="mb-4">
      <Label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
        {label}
      </Label>
      <StudioColorField
        value={value ?? '#FFFFFF'}
        onChange={onChange}
        mainColors={STUDIO_MAIN_COLORS}
        popularColors={STUDIO_POPULAR_COLORS}
        mainLabel="Main colours"
        popularLabel="Popular"
        onClear={onClear}
        clearVisible={Boolean(value)}
        clearLabel="Clear trim colour"
      />
    </div>
  );
}
