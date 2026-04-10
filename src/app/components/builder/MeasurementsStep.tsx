import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { fitOptions } from '../../data/builderSteps';
import imgMeasurementShirt from 'figma:asset/5b6aa44da573021b0c90863e5a2fb7c1e84cf0a9.png';
import type { MeasurementUnit } from '../../lib/measurements';
import {
  formatMeasurementDisplay,
  measurementUnitLabel,
  parseMeasurementInput,
} from '../../lib/measurements';
import { cn } from '../ui/utils';

interface MeasurementsStepProps {
  garmentType: string;
  fit: string;
  onFitChange: (fit: string) => void;
  measurements: Record<string, Record<string, string>>;
  onMeasurementChange: (measurementId: string, size: string, value: string) => void;
  measurementUnit: MeasurementUnit;
  onMeasurementUnitChange: (unit: MeasurementUnit) => void;
}

function MeasurementUnitToggle({
  unit,
  onChange,
}: {
  unit: MeasurementUnit;
  onChange: (u: MeasurementUnit) => void;
}) {
  return (
    <div
      className={cn(
        'inline-flex min-w-[5.75rem] shrink-0 rounded-full border border-white/12 bg-[#0a0a0a] p-0.5 touch-manipulation',
        'md:min-w-[4.25rem] md:p-px',
      )}
      role="group"
      aria-label="Measurement unit"
    >
      {(['cm', 'in'] as const).map((u) => {
        const active = unit === u;
        return (
          <button
            key={u}
            type="button"
            onClick={() => onChange(u)}
            className={cn(
              'builder-focus relative z-0 min-h-9 min-w-[2.5rem] flex-1 rounded-full px-2 text-center text-[10px] font-bold uppercase leading-none tracking-[0.08em] transition-colors',
              'md:min-h-[1.5rem] md:min-w-0 md:px-2.5 md:py-0.5 md:text-[9px] md:tracking-[0.08em]',
              active
                ? u === 'cm'
                  ? 'rounded-l-full bg-[#CC2D24] text-white shadow-[0_1px_4px_rgba(204,45,36,0.4)]'
                  : 'rounded-r-full bg-[#CC2D24] text-white shadow-[0_1px_4px_rgba(204,45,36,0.4)]'
                : 'text-[#8b9aad]/90 hover:text-white/75',
            )}
          >
            {u}
          </button>
        );
      })}
    </div>
  );
}

const measurementLabels = [
  { id: 'halfLength', label: 'A. Half Length' },
  { id: 'chestWidth', label: 'B. Chest Width' },
  { id: 'bottomWidth', label: 'C. Bottom Width' },
  { id: 'sleeveLength', label: 'D. Sleeve Length' },
  { id: 'armhole', label: 'E. Armhole' },
  { id: 'sleeveOpening', label: 'F. Sleeve Opening' },
  { id: 'neckOpening', label: 'G. Neck Opening' },
  { id: 'neckDrop', label: 'H. Neck Drop' },
  { id: 'shoulderWidth', label: 'I. Shoulder to Shoulder' }
];

// Preset measurement data for different fits
const fitMeasurements: Record<string, Record<string, Record<string, string>>> = {
  custom: {
    halfLength: { xs: '0', s: '0', m: '0', l: '0', xl: '0', xxl: '0' },
    chestWidth: { xs: '0', s: '0', m: '0', l: '0', xl: '0', xxl: '0' },
    bottomWidth: { xs: '0', s: '0', m: '0', l: '0', xl: '0', xxl: '0' },
    sleeveLength: { xs: '0', s: '0', m: '0', l: '0', xl: '0', xxl: '0' },
    armhole: { xs: '0', s: '0', m: '0', l: '0', xl: '0', xxl: '0' },
    sleeveOpening: { xs: '0', s: '0', m: '0', l: '0', xl: '0', xxl: '0' },
    neckOpening: { xs: '0', s: '0', m: '0', l: '0', xl: '0', xxl: '0' },
    neckDrop: { xs: '0', s: '0', m: '0', l: '0', xl: '0', xxl: '0' },
    shoulderWidth: { xs: '0', s: '0', m: '0', l: '0', xl: '0', xxl: '0' }
  },
  slim: {
    halfLength: { xs: '64', s: '66', m: '68', l: '70', xl: '72', xxl: '74' },
    chestWidth: { xs: '47', s: '49', m: '51', l: '54', xl: '57', xxl: '60' },
    bottomWidth: { xs: '43', s: '45', m: '47', l: '50', xl: '53', xxl: '56' },
    sleeveLength: { xs: '21', s: '22', m: '23', l: '24', xl: '25', xxl: '26' },
    armhole: { xs: '21', s: '22.5', m: '24', l: '25.5', xl: '27', xxl: '28.5' },
    sleeveOpening: { xs: '16', s: '16.5', m: '17', l: '17.5', xl: '18', xxl: '18.5' },
    neckOpening: { xs: '17.5', s: '17.5', m: '18', l: '18.5', xl: '19', xxl: '19.5' },
    neckDrop: { xs: '2', s: '2', m: '2', l: '2', xl: '2', xxl: '2' },
    shoulderWidth: { xs: '37', s: '39', m: '41', l: '43', xl: '45', xxl: '47' }
  },
  regular: {
    halfLength: { xs: '65', s: '67', m: '69', l: '71', xl: '73', xxl: '75' },
    chestWidth: { xs: '49', s: '51', m: '53', l: '56', xl: '59', xxl: '62' },
    bottomWidth: { xs: '44', s: '46', m: '48', l: '51', xl: '54', xxl: '57' },
    sleeveLength: { xs: '22', s: '23', m: '24', l: '25', xl: '26', xxl: '27' },
    armhole: { xs: '22', s: '23.5', m: '25', l: '26.5', xl: '28', xxl: '29.5' },
    sleeveOpening: { xs: '17', s: '17.5', m: '18', l: '18.5', xl: '19', xxl: '19.5' },
    neckOpening: { xs: '18', s: '18', m: '18.5', l: '19', xl: '19.5', xxl: '20' },
    neckDrop: { xs: '2', s: '2', m: '2', l: '2', xl: '2', xxl: '2' },
    shoulderWidth: { xs: '38', s: '40', m: '42', l: '44', xl: '46', xxl: '48' }
  },
  relaxed: {
    halfLength: { xs: '66', s: '68', m: '70', l: '72', xl: '74', xxl: '76' },
    chestWidth: { xs: '51', s: '53', m: '55', l: '58', xl: '61', xxl: '64' },
    bottomWidth: { xs: '46', s: '48', m: '50', l: '53', xl: '56', xxl: '59' },
    sleeveLength: { xs: '23', s: '24', m: '25', l: '26', xl: '27', xxl: '28' },
    armhole: { xs: '23', s: '24.5', m: '26', l: '27.5', xl: '29', xxl: '30.5' },
    sleeveOpening: { xs: '18', s: '18.5', m: '19', l: '19.5', xl: '20', xxl: '20.5' },
    neckOpening: { xs: '18.5', s: '18.5', m: '19', l: '19.5', xl: '20', xxl: '20.5' },
    neckDrop: { xs: '2', s: '2', m: '2', l: '2', xl: '2', xxl: '2' },
    shoulderWidth: { xs: '40', s: '42', m: '44', l: '46', xl: '48', xxl: '50' }
  },
  oversized: {
    halfLength: { xs: '68', s: '70', m: '72', l: '74', xl: '76', xxl: '78' },
    chestWidth: { xs: '54', s: '56', m: '58', l: '61', xl: '64', xxl: '67' },
    bottomWidth: { xs: '49', s: '51', m: '53', l: '56', xl: '59', xxl: '62' },
    sleeveLength: { xs: '24', s: '25', m: '26', l: '27', xl: '28', xxl: '29' },
    armhole: { xs: '25', s: '26.5', m: '28', l: '29.5', xl: '31', xxl: '32.5' },
    sleeveOpening: { xs: '19', s: '19.5', m: '20', l: '20.5', xl: '21', xxl: '21.5' },
    neckOpening: { xs: '19', s: '19', m: '19.5', l: '20', xl: '20.5', xxl: '21' },
    neckDrop: { xs: '2', s: '2', m: '2', l: '2', xl: '2', xxl: '2' },
    shoulderWidth: { xs: '42', s: '44', m: '46', l: '48', xl: '50', xxl: '52' }
  }
};

export function MeasurementsStep({
  garmentType,
  fit,
  onFitChange,
  measurements,
  onMeasurementChange,
  measurementUnit,
  onMeasurementUnitChange,
}: MeasurementsStepProps) {
  const currentMeasurements = fit && fitMeasurements[fit] ? fitMeasurements[fit] : fitMeasurements.regular;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Fit Selector */}
      <div>
        <Label className="mb-2 block text-[10px] uppercase tracking-wider text-white/60 md:mb-3 md:text-xs">
          Fit Type
        </Label>
        <Select value={fit} onValueChange={onFitChange}>
          <SelectTrigger
            className={cn(
              'min-h-10 touch-manipulation border-white/12 bg-white/[0.06] px-2.5 py-2 text-[13px] leading-tight text-white',
              'data-[placeholder]:text-white/45 [&_svg]:text-white/55',
              'focus-visible:border-[#CC2D24]/50 focus-visible:ring-[#CC2D24]/25',
              'sm:min-h-9 sm:px-3 sm:py-2 sm:text-sm',
            )}
          >
            <SelectValue placeholder="Select fit" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            sideOffset={6}
            align="start"
            collisionPadding={12}
            className={cn(
              'z-[300] max-h-[min(50vh,22rem)] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)]',
              'border border-white/12 bg-[#141416] text-white shadow-[0_16px_48px_rgba(0,0,0,0.55)]',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
            )}
          >
            {fitOptions.map((option) => (
              <SelectItem
                key={option.id}
                value={option.id}
                className={cn(
                  'min-h-10 cursor-pointer py-2.5 pl-3 pr-9 text-[13px] leading-snug text-white',
                  'focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[state=checked]:bg-white/[0.08]',
                  'data-[disabled]:text-white/35',
                  '[&_svg]:text-[#CC2D24]',
                  'sm:min-h-8 sm:py-2 sm:pr-8 sm:text-sm',
                )}
              >
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Measurement Table */}
      <div>
        <div className="mb-1.5 flex min-w-0 flex-row items-center justify-between gap-2 md:mb-2 md:gap-3">
          <Label className="min-w-0 flex-1 truncate pr-1 text-[10px] uppercase leading-snug tracking-wider text-white/60 md:text-[10px]">
            Measurements ({measurementUnitLabel(measurementUnit)})
          </Label>
          <div className="shrink-0">
            <MeasurementUnitToggle unit={measurementUnit} onChange={onMeasurementUnitChange} />
          </div>
        </div>
        <p className="mb-1.5 text-[9px] leading-snug text-white/38 md:mb-2 md:text-[9px]">
          Values are stored in centimetres; when you pick {measurementUnit === 'in' ? 'inches' : 'cm'}, we
          convert for display. Each cell is one measurement in {measurementUnitLabel(measurementUnit)}.
        </p>
        <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-1 py-1 text-left text-[10px] font-semibold text-white/70 md:px-2 md:py-1.5 md:text-[10px] md:font-medium md:text-white/60">
                    Size
                  </th>
                  <th className="px-0.5 py-1 text-[10px] font-semibold text-white/70 md:px-1 md:py-1.5 md:text-[10px] md:font-medium md:text-white/60">
                    XS
                  </th>
                  <th className="px-0.5 py-1 text-[10px] font-semibold text-white/70 md:px-1 md:py-1.5 md:text-[10px] md:font-medium md:text-white/60">
                    S
                  </th>
                  <th className="px-0.5 py-1 text-[10px] font-semibold text-white/70 md:px-1 md:py-1.5 md:text-[10px] md:font-medium md:text-white/60">
                    M
                  </th>
                  <th className="px-0.5 py-1 text-[10px] font-semibold text-white/70 md:px-1 md:py-1.5 md:text-[10px] md:font-medium md:text-white/60">
                    L
                  </th>
                  <th className="px-0.5 py-1 text-[10px] font-semibold text-white/70 md:px-1 md:py-1.5 md:text-[10px] md:font-medium md:text-white/60">
                    XL
                  </th>
                  <th className="px-0.5 py-1 text-[10px] font-semibold text-white/70 md:px-1 md:py-1.5 md:text-[10px] md:font-medium md:text-white/60">
                    XXL
                  </th>
                </tr>
              </thead>
              <tbody>
                {measurementLabels.map((measurement) => (
                  <tr key={measurement.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="max-w-[5.75rem] px-1 py-0.5 text-left text-[10px] font-semibold leading-tight text-white/90 md:max-w-none md:px-2 md:py-1.5 md:text-[10px] md:font-medium md:text-white/80">
                      {measurement.label}
                    </td>
                    {['xs', 's', 'm', 'l', 'xl', 'xxl'].map((size) => (
                      <td key={size} className="px-0.5 py-px md:px-1 md:py-1">
                        <Input
                          type="text"
                          inputMode="decimal"
                          aria-label={`${measurement.label} ${size.toUpperCase()} in ${measurementUnitLabel(measurementUnit)}`}
                          title={`${measurementUnitLabel(measurementUnit)}`}
                          value={formatMeasurementDisplay(
                            measurements[measurement.id]?.[size] ||
                              currentMeasurements[measurement.id]?.[size] ||
                              '0',
                            measurementUnit,
                          )}
                          onChange={(e) =>
                            onMeasurementChange(
                              measurement.id,
                              size,
                              parseMeasurementInput(e.target.value, measurementUnit),
                            )
                          }
                          className="h-6 min-h-[26px] w-full min-w-0 touch-manipulation rounded border border-white/20 bg-white/10 px-px py-0 text-center text-[9px] tabular-nums text-white/90 hover:bg-white/15 focus:bg-white/20 md:h-7 md:min-h-0 md:rounded-md md:px-2 md:text-[10px]"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MeasurementPreview({ imgClassName }: { imgClassName?: string }) {
  return (
    <div className="relative mx-auto flex h-full min-h-0 w-full max-w-full flex-1 items-center justify-center">
      <img
        src={imgMeasurementShirt}
        alt="Measurement guide"
        className={imgClassName ?? 'h-auto w-full max-w-md object-contain'}
      />
    </div>
  );
}
