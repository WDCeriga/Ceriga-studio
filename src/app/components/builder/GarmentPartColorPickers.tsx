import {
  getGarmentSvgConfig,
  type GarmentSvgGarmentType,
} from '../../data/garmentSvgCatalog';
import { Label } from '../ui/label';
import { TrimColorFamilyPicker } from './TrimColorFamilyPicker';

/**
 * One colour per garment part, for packs whose parts each carry their own fill
 * region. A part with no colour set falls back to the fabric colour.
 *
 * Pass `categories` to show only the parts that belong on the current step, so
 * neck colour lives on the neck page, sleeve colour on the sleeve page, and so on.
 */
export function GarmentPartColorPickers({
  garmentType,
  partColors,
  onChange,
  categories,
  heading = 'Part Colours',
  hint,
}: {
  garmentType: GarmentSvgGarmentType;
  partColors?: Partial<Record<string, string>>;
  onChange: (layerId: string, hex: string | undefined) => void;
  categories?: readonly string[];
  heading?: string;
  hint?: string;
}) {
  const config = getGarmentSvgConfig(garmentType);
  const wanted = categories ?? config.categoryOrder;

  const parts = wanted
    .map((category) => ({
      category,
      layerId: config.categoryLayerId[category],
    }))
    .filter((part): part is { category: string; layerId: string } => Boolean(part.layerId));

  if (parts.length === 0) return null;

  const blurb =
    hint ??
    (parts.length === 1
      ? 'Leave unset to use the fabric colour.'
      : 'Each part fills on its own. Anything left unset uses the fabric colour.');

  return (
    <div>
      <Label className="mb-1 block text-[10px] uppercase tracking-wider text-white/60">
        {heading}
      </Label>
      <p className="mb-3 text-[10px] leading-relaxed text-white/42">{blurb}</p>
      {parts.map(({ category, layerId }) => (
        <TrimColorFamilyPicker
          key={layerId}
          label={config.layerLabels[layerId] ?? category}
          value={partColors?.[layerId]}
          onChange={(hex) => onChange(layerId, hex)}
          onClear={() => onChange(layerId, undefined)}
        />
      ))}
    </div>
  );
}
