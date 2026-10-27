import {
  Gauge,
  Calendar,
  Clock,
  Coins,
  Check,
  HelpCircle,
  AlertCircle,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Switch } from '../../../components/ui/switch';
import { cn } from '../../../components/ui/utils';
import type {
  CompleteManufacturerProfile,
  PricingStructure,
} from '../../../data/manufacturerOnboardingTypes';
import { MethodMoqConstraints } from './MethodMoqConstraints';
import { IndicativePricingGuidance } from '../../../components/manufacturer/IndicativePricingGuidance';
import { normalizePricing } from '../../../data/manufacturerPricingModel';

type Props = {
  profile: CompleteManufacturerProfile;
  onChange: (patch: Partial<CompleteManufacturerProfile>) => void;
  onNext: () => void;
  onBack: () => void;
  errors: Record<string, string>;
};

export function StepCapacityPricing({
  profile,
  onChange,
  onNext,
  onBack,
  errors,
}: Props) {

  const pricing = normalizePricing(profile.pricing);

  const updatePricing = (patch: Partial<PricingStructure>) => {
    onChange({
      pricing: {
        ...pricing,
        ...patch,
      },
    });
  };

  const updateGarmentMoq = (garment: string, value: number) => {
    onChange({
      garmentMoqOverrides: {
        ...(profile.garmentMoqOverrides || {}),
        [garment]: value,
      },
      confirmedGarmentMoqOverrides: [...new Set([...(profile.confirmedGarmentMoqOverrides ?? []), garment])],
    });
  };

  const resetGarmentMoq = (garment: string) => {
    const overrides = { ...profile.garmentMoqOverrides };
    delete overrides[garment];
    onChange({
      garmentMoqOverrides: overrides,
      confirmedGarmentMoqOverrides: (profile.confirmedGarmentMoqOverrides ?? []).filter(name => name !== garment),
    });
  };


  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">4. Capacity, Timelines & Pricing</h2>
        <p className="mt-1 text-sm text-white/50">
          Configure baseline minimum order quantities (MOQ), monthly line capacity, sample/bulk turnarounds, and indicative cost ranges.
        </p>
      </div>

      {/* General Production Capacity Section */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-6">
        <div className="flex items-center gap-2 text-white">
          <Gauge className="h-4 w-4 text-[#CC2D24]" />
          <h3 className="text-sm font-semibold">Volume Limits & Line Capacity</h3>
          <span className="text-xs text-[#CC2D24] font-medium">* Required</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* General MOQ */}
          <div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-white/80 font-medium">
                General MOQ (Units) <span className="text-[#CC2D24]">*</span>
              </Label>
            </div>
            <p className="text-[11px] text-white/40 mb-1.5">Default minimum across styles</p>
            <Input
              type="number"
              min="1"
              value={profile.generalMoq || ''}
              onChange={(e) => onChange({ generalMoq: Number(e.target.value) || 0 })}
              className={cn(
                'border-white/10 bg-white/[0.03] text-white',
                errors.generalMoq && 'border-red-500/80',
              )}
            />
            {errors.generalMoq && <p className="mt-1 text-xs text-red-400">{errors.generalMoq}</p>}
          </div>

          {/* Monthly Capacity */}
          <div>
            <Label className="text-xs text-white/80 font-medium">
              Monthly Capacity (Units) <span className="text-[#CC2D24]">*</span>
            </Label>
            <p className="text-[11px] text-white/40 mb-1.5">Total monthly output ceiling</p>
            <Input
              type="number"
              min="1"
              value={profile.monthlyCapacity || ''}
              onChange={(e) => onChange({ monthlyCapacity: Number(e.target.value) || 0 })}
              className={cn(
                'border-white/10 bg-white/[0.03] text-white',
                errors.monthlyCapacity && 'border-red-500/80',
              )}
            />
            {errors.monthlyCapacity && (
              <p className="mt-1 text-xs text-red-400">{errors.monthlyCapacity}</p>
            )}
          </div>

          {/* Currently Available Monthly Capacity */}
          <div>
            <Label className="text-xs text-white/80 font-medium">
              Available Monthly Units
            </Label>
            <p className="text-[11px] text-white/40 mb-1.5">Free line space for new runs</p>
            <Input
              type="number"
              min="0"
              value={profile.currentAvailableMonthlyCapacity ?? ''}
              onChange={(e) =>
                onChange({
                  currentAvailableMonthlyCapacity: Number(e.target.value) || 0,
                })
              }
              className={cn(
                'border-white/10 bg-white/[0.03] text-white',
                errors.currentAvailableMonthlyCapacity && 'border-red-500/80',
              )}
            />
            {errors.currentAvailableMonthlyCapacity && (
              <p className="mt-1 text-xs text-red-400">
                {errors.currentAvailableMonthlyCapacity}
              </p>
            )}
          </div>

          {/* Max Single Order Quantity */}
          <div>
            <Label className="text-xs text-white/80 font-medium">Max Single Order</Label>
            <p className="text-[11px] text-white/40 mb-1.5">Maximum units per single run</p>
            <Input
              type="number"
              min="1"
              value={profile.maxSingleOrderQuantity || ''}
              onChange={(e) =>
                onChange({ maxSingleOrderQuantity: Number(e.target.value) || undefined })
              }
              placeholder="e.g. 10000"
              className={cn(
                'border-white/10 bg-white/[0.03] text-white',
                errors.maxSingleOrderQuantity && 'border-red-500/80',
              )}
            />
            {errors.maxSingleOrderQuantity && (
              <p className="mt-1 text-xs text-red-400">{errors.maxSingleOrderQuantity}</p>
            )}
          </div>
        </div>

        {/* Accepting New Orders Toggle */}
        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] p-3.5">
          <div>
            <span className="text-xs font-semibold text-white">Accepting New Brand Orders</span>
            <p className="text-[11px] text-white/40">
              When disabled, Ceriga will temporarily pause automated assignment to your inbox.
            </p>
          </div>
          <Switch
            checked={profile.acceptingNewOrders}
            onCheckedChange={(checked) => onChange({ acceptingNewOrders: checked })}
          />
        </div>
      </div>

      {/* Garment-Specific MOQ & Customisation MOQ */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-white">Garment & Method MOQ Overrides</h3>
          <p className="text-xs text-white/40">
            Define specific minimums for more complex categories or specialised treatments.
          </p>
        </div>

        {/* Garment-Specific Overrides */}
        {profile.garments.length > 0 && (
          <div>
            <Label className="text-xs text-white/70 font-medium">Garment Category MOQs</Label>
            <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {profile.garments.map((garment) => {
                const override = profile.garmentMoqOverrides?.[garment];
                const hasOverride = override !== undefined;
                const confirmed = profile.confirmedGarmentMoqOverrides?.includes(garment);
                const currentVal = override ?? profile.generalMoq;
                return (
                  <div
                    key={garment}
                    className="rounded-xl border border-[#252528] bg-white/[0.02] p-3"
                  >
                    <span className="text-xs font-medium text-white">{garment}</span>
                    <p className="mt-1 text-[10px] text-white/45">
                      {!hasOverride ? 'Using General MOQ' : confirmed ? 'Custom MOQ' : 'Saved MOQ — review required'}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Input
                        type="number"
                        aria-label={`${garment} MOQ`}
                        min="1"
                        step="1"
                        value={currentVal}
                        onChange={(e) => updateGarmentMoq(garment, Number(e.target.value) || 1)}
                        className="h-8 text-xs border-white/10 bg-black/40 text-white"
                      />
                      <span className="text-[10px] text-white/40">units</span>
                    </div>
                    {hasOverride && (
                      <div className="mt-2 space-y-1 text-[10px]">
                        {!confirmed && <>
                          <p className="text-white/45">This older value may have been a default. Confirm it or reset to inherit.</p>
                          <button type="button" className="block text-white/70 hover:text-white" onClick={() => updateGarmentMoq(garment, currentVal)}>Keep as Custom MOQ</button>
                        </>}
                        <button type="button" onClick={() => resetGarmentMoq(garment)} className="block text-[#CC2D24] hover:underline">Reset to General MOQ</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <MethodMoqConstraints profile={profile} onChange={onChange} />
      </div>

      {/* Production Timelines Section */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Clock className="h-4 w-4 text-[#CC2D24]" />
            <h3 className="text-sm font-semibold">Production Turnaround Timelines</h3>
            <span className="text-xs text-[#CC2D24] font-medium">* Required</span>
          </div>

          {/* Working days vs Calendar days selector */}
          <div className="flex items-center rounded-lg border border-[#252528] bg-black/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => onChange({ timeUnit: 'working_days' })}
              className={cn(
                'px-2.5 py-1 rounded text-[11px] font-medium transition',
                profile.timeUnit === 'working_days'
                  ? 'bg-[#CC2D24] text-white'
                  : 'text-white/40 hover:text-white',
              )}
            >
              Working Days
            </button>
            <button
              type="button"
              onClick={() => onChange({ timeUnit: 'calendar_days' })}
              className={cn(
                'px-2.5 py-1 rounded text-[11px] font-medium transition',
                profile.timeUnit === 'calendar_days'
                  ? 'bg-[#CC2D24] text-white'
                  : 'text-white/40 hover:text-white',
              )}
            >
              Calendar Days
            </button>
          </div>
        </div>

        <p className="text-sm text-white/50">Set separate turnaround times for samples and bulk production. Each quotation uses the matching saved lead time.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['sample', 'bulk'] as const).map(kind => {
            const minimum = kind === 'sample' ? 'sampleLeadTimeMinDays' : 'bulkLeadTimeMinDays';
            const maximum = kind === 'sample' ? 'sampleLeadTimeMaxDays' : 'bulkLeadTimeMaxDays';
            const error = kind === 'sample' ? errors.sampleLead : errors.bulkLead;
            return <fieldset key={kind} className="rounded-xl border border-white/10 p-4">
              <legend className="px-2 text-sm font-semibold text-white">{kind === 'sample' ? 'Sample lead time' : 'Bulk production lead time'}</legend>
              <div className="grid grid-cols-2 gap-3">
                {([minimum, maximum] as const).map((field, index) => <div key={field}>
                  <Label htmlFor={field} className="text-xs text-white/70">{index === 0 ? 'Minimum' : 'Maximum'} {profile.timeUnit === 'working_days' ? 'working days' : 'calendar days'}</Label>
                  <Input id={field} type="number" min="1" max="3650" step="1" value={profile[field] || ''} onChange={event => onChange({ [field]: Number(event.target.value) || 0 })} aria-invalid={Boolean(error)} className={cn('mt-2 border-white/10 bg-white/[0.03] text-white', error && 'border-red-500/80')} />
                </div>)}
              </div>
              <p className="mt-3 text-xs text-white/40">Used for {kind === 'sample' ? 'sample quotations' : 'bulk quotation options'}. The maximum prefills the quotation and can be adjusted per order.</p>
            </fieldset>;
          })}
        </div>

        {(errors.sampleLead || errors.bulkLead) && (
          <p className="text-xs text-red-400">{errors.sampleLead || errors.bulkLead}</p>
        )}
      </div>

      <IndicativePricingGuidance value={pricing} onChange={value => updatePricing(value)} />

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-white/15 text-white hover:bg-white/5"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={onNext}
          className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90 px-6 font-semibold"
        >
          Continue to Shipping
        </Button>
      </div>
    </div>
  );
}
