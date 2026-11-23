import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../../i18n/i18n';
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
  useCerigaTranslation();


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
        <h2 className="text-xl font-semibold text-white">{cerigaTranslate("interface.text_92a675a5445ae214")}</h2>
        <p className="mt-1 text-sm text-white/50">{cerigaTranslate("interface.text_60978b6ef31b03a6")}</p>
      </div>

      {/* General Production Capacity Section */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-6">
        <div className="flex items-center gap-2 text-white">
          <Gauge className="h-4 w-4 text-[#CC2D24]" />
          <h3 className="text-sm font-semibold">{cerigaTranslate("interface.text_8a5f75aee13ed2a2")}</h3>
          <span className="text-xs text-[#CC2D24] font-medium">{cerigaTranslate("interface.text_b62a197611d03b4d")}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* General MOQ */}
          <div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-white/80 font-medium">{cerigaTranslate("interface.text_d136fc2fce7c0f3b")}{" "}<span className="text-[#CC2D24]">*</span>
              </Label>
            </div>
            <p className="text-[11px] text-white/40 mb-1.5">{cerigaTranslate("interface.text_5f0b29fb686530d4")}</p>
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
            {errors.generalMoq && <p className="mt-1 text-xs text-red-400">{cerigaTranslateLabel(errors.generalMoq)}</p>}
          </div>

          {/* Monthly Capacity */}
          <div>
            <Label className="text-xs text-white/80 font-medium">{cerigaTranslate("interface.text_bccb78d090e1d8eb")}{" "}<span className="text-[#CC2D24]">*</span>
            </Label>
            <p className="text-[11px] text-white/40 mb-1.5">{cerigaTranslate("interface.text_afb4aeabf7bab2a4")}</p>
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
              <p className="mt-1 text-xs text-red-400">{cerigaTranslateLabel(errors.monthlyCapacity)}</p>
            )}
          </div>

          {/* Currently Available Monthly Capacity */}
          <div>
            <Label className="text-xs text-white/80 font-medium">{cerigaTranslate("interface.text_42587d1a42dd418e")}</Label>
            <p className="text-[11px] text-white/40 mb-1.5">{cerigaTranslate("interface.text_b47b5a54542b492b")}</p>
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
                {cerigaTranslateLabel(errors.currentAvailableMonthlyCapacity)}
              </p>
            )}
          </div>

          {/* Max Single Order Quantity */}
          <div>
            <Label className="text-xs text-white/80 font-medium">{cerigaTranslate("interface.text_26356cdd2461ee63")}</Label>
            <p className="text-[11px] text-white/40 mb-1.5">{cerigaTranslate("interface.text_92da213ad8e89b15")}</p>
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
              <p className="mt-1 text-xs text-red-400">{cerigaTranslateLabel(errors.maxSingleOrderQuantity)}</p>
            )}
          </div>
        </div>

        {/* Accepting New Orders Toggle */}
        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] p-3.5">
          <div>
            <span className="text-xs font-semibold text-white">{cerigaTranslate("interface.text_b60f8dc8e4c7e6cd")}</span>
            <p className="text-[11px] text-white/40">{cerigaTranslate("interface.text_d38c8bf0480068fd")}</p>
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
          <h3 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_dd1c7c25bc83528e")}</h3>
          <p className="text-xs text-white/40">{cerigaTranslate("interface.text_7185bb1a161edab2")}</p>
        </div>

        {/* Garment-Specific Overrides */}
        {profile.garments.length > 0 && (
          <div>
            <Label className="text-xs text-white/70 font-medium">{cerigaTranslate("interface.text_a92339fedb4824ee")}</Label>
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
                      {!hasOverride ? cerigaTranslate("interface.text_16d27cf9281cdc51") : confirmed ? cerigaTranslate("interface.text_cd0fa22404eebb5a") : cerigaTranslate("interface.text_155186ddae4fe83e")}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Input
                        type="number"
                        aria-label={cerigaTranslate("interface.text_fbb9a7f576d05aee",{value0:(garment)})}
                        min="1"
                        step="1"
                        value={currentVal}
                        onChange={(e) => updateGarmentMoq(garment, Number(e.target.value) || 1)}
                        className="h-8 text-xs border-white/10 bg-black/40 text-white"
                      />
                      <span className="text-[10px] text-white/40">{cerigaTranslate("interface.text_c981a30c0e7b420b")}</span>
                    </div>
                    {hasOverride && (
                      <div className="mt-2 space-y-1 text-[10px]">
                        {!confirmed && <>
                          <p className="text-white/45">{cerigaTranslate("interface.text_4f870688a5dd2225")}</p>
                          <button type="button" className="block text-white/70 hover:text-white" onClick={() => updateGarmentMoq(garment, currentVal)}>{cerigaTranslate("interface.text_36c839ec64d0cd58")}</button>
                        </>}
                        <button type="button" onClick={() => resetGarmentMoq(garment)} className="block text-[#CC2D24] hover:underline">{cerigaTranslate("interface.text_5ed5122c3e5934f9")}</button>
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

      <IndicativePricingGuidance selectedGarments={profile.garments} value={pricing} onChange={value => updatePricing(value)} />

      {/* Navigation */}
      <div className="onboarding-actions flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-white/15 text-white hover:bg-white/5"
        >{cerigaTranslate("common.back")}</Button>
        <Button
          type="button"
          onClick={onNext}
          className="onboarding-primary bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90 px-6 font-semibold"
        >{cerigaTranslate("interface.text_6b5f080b1b0d4d0a")}</Button>
      </div>
    </div>
  );
}
