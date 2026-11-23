import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../../i18n/i18n';
import {
  Building2,
  Shirt,
  Wrench,
  Gauge,
  Truck,
  CheckCircle2,
  Edit2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../components/ui/utils';
import type { CompleteManufacturerProfile } from '../../../data/manufacturerOnboardingTypes';
import { isGarmentConfirmed } from '../../../data/manufacturerGarmentDefaults';

type Props = {
  profile: CompleteManufacturerProfile;
  onEditStep: (stepIndex: number) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  validationErrors: string[];
};

export function StepReviewComplete({
  profile,
  onEditStep,
  onSubmit,
  onBack,
  submitting,
  validationErrors,
}: Props) {
  useCerigaTranslation();

  const hasErrors = validationErrors.length > 0;
  const inHouseCaps = Object.entries(profile.capabilitiesMap || {})
    .filter(([_, src]) => src === 'in_house')
    .map(([name]) => name);
  const outsourcedCaps = Object.entries(profile.capabilitiesMap || {})
    .filter(([_, src]) => src === 'outsourced')
    .map(([name]) => name);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">{cerigaTranslate("interface.text_8e51159d3fee9771")}</h2>
        <p className="mt-1 text-sm text-white/50">{cerigaTranslate("interface.text_514990946ddb1b11")}</p>
      </div>

      {/* Validation Errors Notice */}
      {hasErrors && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 space-y-2">
          <div className="flex items-center gap-2 text-red-300 font-semibold text-sm">
            <AlertTriangle className="h-4 w-4" />{cerigaTranslate("interface.text_cab6e10870bb6f42")}</div>
          <ul className="list-disc list-inside space-y-1 text-xs text-red-200">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{cerigaTranslateLabel(err)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-5">
        {/* Step 1: Factory Profile Summary */}
        <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#252528] pb-4">
            <div className="flex items-center gap-2.5">
              <Building2 className="h-4 w-4 text-[#CC2D24]" />
              <h3 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_12588d1d5fedf08e")}</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditStep(0)}
              className="text-xs text-[#CC2D24] hover:bg-white/5"
            >
              <Edit2 className="h-3 w-3 mr-1" />{" "}{cerigaTranslate("common.edit")}</Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 text-xs">
            <div>
              <span className="text-white/40">{cerigaTranslate("interface.text_e1acd20f00c82431")}</span>
              <p className="font-semibold text-white mt-0.5">{profile.factoryName}</p>
            </div>
            <div>
              <span className="text-white/40">{cerigaTranslate("interface.text_0f2d8f45f9e50c65")}</span>
              <p className="font-semibold text-white mt-0.5">{profile.contactName}</p>
            </div>
            <div>
              <span className="text-white/40">{cerigaTranslate("authentication.email")}</span>
              <p className="font-semibold text-white mt-0.5">{profile.contactEmail}</p>
            </div>
            <div>
              <span className="text-white/40">{cerigaTranslate("interface.text_15b61974b2707a7b")}</span>
              <p className="font-semibold text-white mt-0.5">
                {profile.city}, {profile.country}
              </p>
            </div>
          </div>

          <div>
            <span className="text-xs text-white/40">{cerigaTranslate("interface.text_a61b8af59fed644b")}</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {profile.manufacturerTypes?.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-white/70"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Step 2: Garment Specialisations Summary */}
        <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#252528] pb-4">
            <div className="flex items-center gap-2.5">
              <Shirt className="h-4 w-4 text-[#CC2D24]" />
              <h3 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_07d0371fafc1134f")}{profile.garments.length})
              </h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditStep(1)}
              className="text-xs text-[#CC2D24] hover:bg-white/5"
            >
              <Edit2 className="h-3 w-3 mr-1" />{" "}{cerigaTranslate("common.edit")}</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {profile.garments.map((g) => {
              const detail = profile.garmentDetails?.[g];
              return (
                <div
                  key={g}
                  className="rounded-xl border border-[#252528] bg-white/[0.02] p-3 text-xs min-w-[140px]"
                >
                  <span className="font-semibold text-white">{g}</span>
                  <p className={cn('mt-0.5 text-[10px]', isGarmentConfirmed(detail) ? 'text-emerald-300' : 'text-amber-300')}>
                    {isGarmentConfirmed(detail) ? cerigaTranslate("interface.text_905fbfe495473574") : cerigaTranslate("interface.text_efc75196d4d7d61b")}
                  </p>
                  {detail?.minGsm && detail?.maxGsm && (
                    <p className="text-[10px] text-white/40 mt-0.5">
                      {detail.minGsm}-{detail.maxGsm}{" "}{cerigaTranslate("interface.text_569a327df59b4b88")}</p>
                  )}
                  {detail?.styles && detail.styles.length > 0 && (
                    <p className="text-[10px] text-white/50 truncate max-w-[150px]">
                      {detail.styles.slice(0, 2).join(', ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 3: Production Capabilities Summary */}
        <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#252528] pb-4">
            <div className="flex items-center gap-2.5">
              <Wrench className="h-4 w-4 text-[#CC2D24]" />
              <h3 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_a9eb716c19c6ac05")}</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditStep(2)}
              className="text-xs text-[#CC2D24] hover:bg-white/5"
            >
              <Edit2 className="h-3 w-3 mr-1" />{" "}{cerigaTranslate("common.edit")}</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <div>
              <span className="font-medium text-emerald-400">{cerigaTranslate("interface.text_e90b17659035887a")}{inHouseCaps.length})
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {inHouseCaps.map((c) => (
                  <span
                    key={c}
                    className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-200"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <span className="font-medium text-amber-400">{cerigaTranslate("interface.text_645c569e0fa8beaf")}{outsourcedCaps.length})
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {outsourcedCaps.map((c) => (
                  <span
                    key={c}
                    className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] text-amber-200"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Capacity & Timelines Summary */}
        <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#252528] pb-4">
            <div className="flex items-center gap-2.5">
              <Gauge className="h-4 w-4 text-[#CC2D24]" />
              <h3 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_912d5823376841d5")}</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditStep(3)}
              className="text-xs text-[#CC2D24] hover:bg-white/5"
            >
              <Edit2 className="h-3 w-3 mr-1" />{" "}{cerigaTranslate("common.edit")}</Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 text-xs">
            <div>
              <span className="text-white/40">{cerigaTranslate("interface.text_8de7e49610b81fc3")}</span>
              <p className="font-semibold text-white mt-0.5">{profile.generalMoq}{" "}{cerigaTranslate("interface.text_c981a30c0e7b420b")}</p>
              <p className="mt-1 text-[10px] text-white/50">{cerigaTranslate("interface.text_a2a738cc7274b7ce")}{" "}{profile.pricing.preferredCurrency}</p>
            </div>
            <div>
              <span className="text-white/40">{cerigaTranslate("interface.text_65cccfc655e5f28b")}</span>
              <p className="font-semibold text-white mt-0.5">
                {profile.monthlyCapacity?.toLocaleString()}{" "}{cerigaTranslate("interface.text_c981a30c0e7b420b")}</p>
            </div>
            <div>
              <button type="button" onClick={() => onEditStep(4)} className="text-white/40 hover:text-white underline underline-offset-4">{cerigaTranslate("interface.text_d4653fa108bf6a4a")}</button>
              <p className="font-semibold text-white mt-0.5">
                {profile.sampleLeadTimeMinDays} - {profile.sampleLeadTimeMaxDays}{' '}
                {profile.timeUnit === 'working_days' ? cerigaTranslate("interface.text_baf107a2403f7ee1") : cerigaTranslate("interface.text_ab51004e9d71a485")}
              </p>
            </div>
            <div>
              <button type="button" onClick={() => onEditStep(4)} className="text-white/40 hover:text-white underline underline-offset-4">{cerigaTranslate("interface.text_5feecef9eee287fc")}</button>
              <p className="font-semibold text-white mt-0.5">
                {profile.bulkLeadTimeMinDays} - {profile.bulkLeadTimeMaxDays}{' '}
                {profile.timeUnit === 'working_days' ? cerigaTranslate("interface.text_baf107a2403f7ee1") : cerigaTranslate("interface.text_ab51004e9d71a485")}
              </p>
            </div>
          </div>
        </div>

        {/* Step 5: Shipping Summary */}
        <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#252528] pb-4">
            <div className="flex items-center gap-2.5">
              <Truck className="h-4 w-4 text-[#CC2D24]" />
              <h3 className="text-sm font-semibold text-white">{cerigaTranslate("nav.shipping")}</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditStep(5)}
              className="text-xs text-[#CC2D24] hover:bg-white/5"
            >
              <Edit2 className="h-3 w-3 mr-1" />{" "}{cerigaTranslate("common.edit")}</Button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-white/40">{cerigaTranslate("interface.text_72eb63f032e47e34")}</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {profile.shippingDestinations.map((d) => (
                  <span
                    key={d}
                    className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/70"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation & Submission */}
      <div className="onboarding-actions flex items-center justify-between pt-4 border-t border-[#252528]">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={submitting}
          className="border-white/15 text-white hover:bg-white/5"
        >{cerigaTranslate("common.back")}</Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={submitting || hasErrors}
          className="onboarding-primary bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90 px-8 font-semibold shadow-lg shadow-red-900/30"
        >
          {submitting ? cerigaTranslate("interface.text_6667ab417ab2a850") : cerigaTranslate("interface.text_fe3da4e70bf34564")}
        </Button>
      </div>
    </div>
  );
}
