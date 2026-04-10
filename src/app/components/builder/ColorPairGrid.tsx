import { cn } from '../ui/utils';

/** Renders hex swatches in a single horizontal row (scroll when needed). */
export function ColorPairGrid({
  colors,
  selected,
  onSelect,
  sizeClass = 'h-9 w-9 rounded-xl',
  selectedRingClass = 'border-[#FF3B30] ring-1 ring-[#FF3B30]',
}: {
  colors: string[];
  selected: string;
  onSelect: (hex: string) => void;
  sizeClass?: string;
  selectedRingClass?: string;
}) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [-webkit-overflow-scrolling:touch]">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onSelect(color)}
          className={cn(
            'shrink-0 border transition-all',
            sizeClass,
            selected === color ? selectedRingClass : 'border-white/20 hover:border-white/40',
          )}
          style={{ backgroundColor: color }}
          aria-label={`Colour ${color}`}
        />
      ))}
    </div>
  );
}
