import { useState } from 'react';
import {
  Gauge,
  Calendar,
  Clock,
  Coins,
  Check,
  HelpCircle,
  AlertCircle,
  Plus,
  Trash2,
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
  CustomMethodMoq,
  PricingStructure,
} from '../../../data/manufacturerOnboardingTypes';

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
  const [newMethodName, setNewMethodName] = useState('');
  const [newMethodMoq, setNewMethodMoq] = useState('');

  const pricing = profile.pricing || {
    preferredCurrency: 'GBP',
    samplePricingApproach: 'multiplier_2x',
    indicativePriceRanges: {},
    quantityTierDiscount: true,
    requiresCustomQuotation: true,
  };

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
    });
  };

  const addMethodMoq = () => {
    if (!newMethodName.trim() || !newMethodMoq.trim()) return;
    const moqVal = Number(newMethodMoq) || 50;
    const current = profile.customMethodMoqs || [];
    onChange({
      customMethodMoqs: [
        ...current.filter((m) => m.method.toLowerCase() !== newMethodName.trim().toLowerCase()),
        { method: newMethodName.trim(), moq: moqVal },
      ],
    });
    setNewMethodName('');
    setNewMethodMoq('');
  };

  const removeMethodMoq = (method: string) => {
    onChange({
      customMethodMoqs: (profile.customMethodMoqs || []).filter((m) => m.method !== method),
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
                const currentVal =
                  profile.garmentMoqOverrides?.[garment] ?? profile.generalMoq ?? 50;
                return (
                  <div
                    key={garment}
                    className="rounded-xl border border-[#252528] bg-white/[0.02] p-3"
                  >
                    <span className="text-xs font-medium text-white">{garment}</span>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Input
                        type="number"
                        min="1"
                        value={currentVal}
                        onChange={(e) => updateGarmentMoq(garment, Number(e.target.value) || 1)}
                        className="h-8 text-xs border-white/10 bg-black/40 text-white"
                      />
                      <span className="text-[10px] text-white/40">units</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Customisation Technique MOQs */}
        <div className="pt-3 border-t border-[#252528]">
          <Label className="text-xs text-white/70 font-medium">
            Customisation Method Constraints (e.g. Embroidery: 20 units, Acid wash: 100 units)
          </Label>

          <div className="mt-2.5 flex flex-wrap gap-2">
            {profile.customMethodMoqs?.map((m) => (
              <div
                key={m.method}
                className="flex items-center gap-2 rounded-xl border border-[#CC2D24]/30 bg-[#CC2D24]/10 px-3 py-1.5 text-xs text-white"
              >
                <span>
                  <strong>{m.method}</strong>: {m.moq} pcs
                </span>
                <button
                  type="button"
                  onClick={() => removeMethodMoq(m.method)}
                  className="text-white/40 hover:text-red-300 ml-1"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex max-w-md gap-2">
            <Input
              value={newMethodName}
              onChange={(e) => setNewMethodName(e.target.value)}
              placeholder="Treatment name (e.g. Tie dye)..."
              className="h-8 text-xs border-white/10 bg-white/[0.03] text-white"
            />
            <Input
              type="number"
              value={newMethodMoq}
              onChange={(e) => setNewMethodMoq(e.target.value)}
              placeholder="MOQ (e.g. 100)"
              className="h-8 w-28 text-xs border-white/10 bg-white/[0.03] text-white"
            />
            <Button
              type="button"
              size="sm"
              onClick={addMethodMoq}
              className="h-8 text-xs bg-white/10 text-white hover:bg-white/20"
            >
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
        </div>
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-xs text-white/80 font-medium">Sample Lead Time (Min)</Label>
            <Input
              type="number"
              min="1"
              value={profile.sampleLeadTimeMinDays || ''}
              onChange={(e) =>
                onChange({ sampleLeadTimeMinDays: Number(e.target.value) || 0 })
              }
              className={cn(
                'mt-1.5 border-white/10 bg-white/[0.03] text-white',
                errors.sampleLead && 'border-red-500/80',
              )}
            />
          </div>

          <div>
            <Label className="text-xs text-white/80 font-medium">Sample Lead Time (Max)</Label>
            <Input
              type="number"
              min="1"
              value={profile.sampleLeadTimeMaxDays || ''}
              onChange={(e) =>
                onChange({ sampleLeadTimeMaxDays: Number(e.target.value) || 0 })
              }
              className={cn(
                'mt-1.5 border-white/10 bg-white/[0.03] text-white',
                errors.sampleLead && 'border-red-500/80',
              )}
            />
          </div>

          <div>
            <Label className="text-xs text-white/80 font-medium">Bulk Production (Min)</Label>
            <Input
              type="number"
              min="1"
              value={profile.bulkLeadTimeMinDays || ''}
              onChange={(e) =>
                onChange({ bulkLeadTimeMinDays: Number(e.target.value) || 0 })
              }
              className={cn(
                'mt-1.5 border-white/10 bg-white/[0.03] text-white',
                errors.bulkLead && 'border-red-500/80',
              )}
            />
          </div>

          <div>
            <Label className="text-xs text-white/80 font-medium">Bulk Production (Max)</Label>
            <Input
              type="number"
              min="1"
              value={profile.bulkLeadTimeMaxDays || ''}
              onChange={(e) =>
                onChange({ bulkLeadTimeMaxDays: Number(e.target.value) || 0 })
              }
              className={cn(
                'mt-1.5 border-white/10 bg-white/[0.03] text-white',
                errors.bulkLead && 'border-red-500/80',
              )}
            />
          </div>
        </div>

        {(errors.sampleLead || errors.bulkLead) && (
          <p className="text-xs text-red-400">{errors.sampleLead || errors.bulkLead}</p>
        )}
      </div>

      {/* Indicative Pricing Section (Optional) */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Coins className="h-4 w-4 text-[#CC2D24]" />
            <h3 className="text-sm font-semibold">Indicative Pricing Guidance</h3>
          </div>
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-white/40">
            Optional / Non-binding
          </span>
        </div>

        <p className="text-xs text-white/40">
          Provides brands with ballpark estimates. Every order receives a formal quotation based on final tech pack specs.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Preferred Currency */}
          <div>
            <Label className="text-xs text-white/70 font-medium">Quoting Currency</Label>
            <div className="mt-1.5 flex gap-2">
              {(['GBP', 'USD', 'EUR'] as const).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => updatePricing({ preferredCurrency: curr })}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg border text-xs font-semibold transition',
                    pricing.preferredCurrency === curr
                      ? 'border-[#CC2D24] bg-[#CC2D24]/15 text-white'
                      : 'border-[#252528] bg-white/[0.02] text-white/50 hover:text-white',
                  )}
                >
                  {curr}
                </button>
              ))}
            </div>
          </div>

          {/* Sample Pricing Approach */}
          <div className="sm:col-span-2">
            <Label className="text-xs text-white/70 font-medium">Sample Pricing Structure</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { id: 'flat_fee', label: 'Flat sample fee' },
                { id: 'multiplier_2x', label: '2x bulk unit rate' },
                { id: 'multiplier_3x', label: '3x bulk unit rate' },
                { id: 'custom_quote', label: 'Custom per sample' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updatePricing({ samplePricingApproach: opt.id as any })}
                  className={cn(
                    'py-2 px-2.5 rounded-lg border text-xs text-center transition font-medium',
                    pricing.samplePricingApproach === opt.id
                      ? 'border-[#CC2D24] bg-[#CC2D24]/15 text-white'
                      : 'border-[#252528] bg-white/[0.02] text-white/50 hover:text-white',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Indicative Garment Price Ranges */}
        <div>
          <Label className="text-xs text-white/70 font-medium">Typical Unit Price Ranges</Label>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <span className="text-[11px] text-white/50">Hoodie (380-450 GSM)</span>
              <Input
                value={pricing.indicativePriceRanges?.hoodie || ''}
                onChange={(e) =>
                  updatePricing({
                    indicativePriceRanges: {
                      ...pricing.indicativePriceRanges,
                      hoodie: e.target.value,
                    },
                  })
                }
                placeholder="e.g. £18 - £25"
                className="mt-1 h-8 text-xs border-white/10 bg-white/[0.03] text-white"
              />
            </div>
            <div>
              <span className="text-[11px] text-white/50">T-shirt (200-280 GSM)</span>
              <Input
                value={pricing.indicativePriceRanges?.tshirt || ''}
                onChange={(e) =>
                  updatePricing({
                    indicativePriceRanges: {
                      ...pricing.indicativePriceRanges,
                      tshirt: e.target.value,
                    },
                  })
                }
                placeholder="e.g. £7 - £12"
                className="mt-1 h-8 text-xs border-white/10 bg-white/[0.03] text-white"
              />
            </div>
            <div>
              <span className="text-[11px] text-white/50">Sweatshirt (350 GSM)</span>
              <Input
                value={pricing.indicativePriceRanges?.sweatshirt || ''}
                onChange={(e) =>
                  updatePricing({
                    indicativePriceRanges: {
                      ...pricing.indicativePriceRanges,
                      sweatshirt: e.target.value,
                    },
                  })
                }
                placeholder="e.g. £15 - £22"
                className="mt-1 h-8 text-xs border-white/10 bg-white/[0.03] text-white"
              />
            </div>
            <div>
              <span className="text-[11px] text-white/50">Joggers (380 GSM)</span>
              <Input
                value={pricing.indicativePriceRanges?.jogger || ''}
                onChange={(e) =>
                  updatePricing({
                    indicativePriceRanges: {
                      ...pricing.indicativePriceRanges,
                      jogger: e.target.value,
                    },
                  })
                }
                placeholder="e.g. £14 - £20"
                className="mt-1 h-8 text-xs border-white/10 bg-white/[0.03] text-white"
              />
            </div>
          </div>
        </div>
      </div>

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
          Continue to Shipping & Services
        </Button>
      </div>
    </div>
  );
}
