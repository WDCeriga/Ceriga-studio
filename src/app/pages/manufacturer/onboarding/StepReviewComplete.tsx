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
        <h2 className="text-xl font-semibold text-white">6. Review & Complete Setup</h2>
        <p className="mt-1 text-sm text-white/50">
          Verify your factory onboarding details before entering your production portal. You can return and update any section later from Settings.
        </p>
      </div>

      {/* Validation Errors Notice */}
      {hasErrors && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 space-y-2">
          <div className="flex items-center gap-2 text-red-300 font-semibold text-sm">
            <AlertTriangle className="h-4 w-4" />
            Please resolve the following before completing onboarding:
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-red-200">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
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
              <h3 className="text-sm font-semibold text-white">Factory Profile</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditStep(0)}
              className="text-xs text-[#CC2D24] hover:bg-white/5"
            >
              <Edit2 className="h-3 w-3 mr-1" /> Edit
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 text-xs">
            <div>
              <span className="text-white/40">Facility Name</span>
              <p className="font-semibold text-white mt-0.5">{profile.factoryName}</p>
            </div>
            <div>
              <span className="text-white/40">Primary Contact</span>
              <p className="font-semibold text-white mt-0.5">{profile.contactName}</p>
            </div>
            <div>
              <span className="text-white/40">Email</span>
              <p className="font-semibold text-white mt-0.5">{profile.contactEmail}</p>
            </div>
            <div>
              <span className="text-white/40">Location</span>
              <p className="font-semibold text-white mt-0.5">
                {profile.city}, {profile.country}
              </p>
            </div>
          </div>

          <div>
            <span className="text-xs text-white/40">Business Models:</span>
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
              <h3 className="text-sm font-semibold text-white">
                Garment Specialisations ({profile.garments.length})
              </h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditStep(1)}
              className="text-xs text-[#CC2D24] hover:bg-white/5"
            >
              <Edit2 className="h-3 w-3 mr-1" /> Edit
            </Button>
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
                  {detail?.minGsm && detail?.maxGsm && (
                    <p className="text-[10px] text-white/40 mt-0.5">
                      {detail.minGsm}-{detail.maxGsm} GSM
                    </p>
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
              <h3 className="text-sm font-semibold text-white">Production Capabilities</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditStep(2)}
              className="text-xs text-[#CC2D24] hover:bg-white/5"
            >
              <Edit2 className="h-3 w-3 mr-1" /> Edit
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <div>
              <span className="font-medium text-emerald-400">
                In-House Techniques ({inHouseCaps.length})
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
              <span className="font-medium text-amber-400">
                Outsourced Partners ({outsourcedCaps.length})
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
              <h3 className="text-sm font-semibold text-white">Capacity & Turnarounds</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditStep(3)}
              className="text-xs text-[#CC2D24] hover:bg-white/5"
            >
              <Edit2 className="h-3 w-3 mr-1" /> Edit
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 text-xs">
            <div>
              <span className="text-white/40">General MOQ</span>
              <p className="font-semibold text-white mt-0.5">{profile.generalMoq} units</p>
            </div>
            <div>
              <span className="text-white/40">Monthly Output</span>
              <p className="font-semibold text-white mt-0.5">
                {profile.monthlyCapacity?.toLocaleString()} units
              </p>
            </div>
            <div>
              <span className="text-white/40">Sample Turnaround</span>
              <p className="font-semibold text-white mt-0.5">
                {profile.sampleLeadTimeMinDays} - {profile.sampleLeadTimeMaxDays}{' '}
                {profile.timeUnit === 'working_days' ? 'work days' : 'days'}
              </p>
            </div>
            <div>
              <span className="text-white/40">Bulk Turnaround</span>
              <p className="font-semibold text-white mt-0.5">
                {profile.bulkLeadTimeMinDays} - {profile.bulkLeadTimeMaxDays}{' '}
                {profile.timeUnit === 'working_days' ? 'work days' : 'days'}
              </p>
            </div>
          </div>
        </div>

        {/* Step 5: Shipping & Services Summary */}
        <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#252528] pb-4">
            <div className="flex items-center gap-2.5">
              <Truck className="h-4 w-4 text-[#CC2D24]" />
              <h3 className="text-sm font-semibold text-white">Shipping & Services</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditStep(4)}
              className="text-xs text-[#CC2D24] hover:bg-white/5"
            >
              <Edit2 className="h-3 w-3 mr-1" /> Edit
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <div>
              <span className="text-white/40">Destinations</span>
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
            <div>
              <span className="text-white/40">Services Included</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {profile.additionalServices.map((s) => (
                  <span
                    key={s}
                    className="rounded bg-emerald-500/10 text-emerald-200 px-2 py-0.5 text-[10px]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation & Submission */}
      <div className="flex items-center justify-between pt-4 border-t border-[#252528]">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={submitting}
          className="border-white/15 text-white hover:bg-white/5"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={submitting || hasErrors}
          className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90 px-8 font-semibold shadow-lg shadow-red-900/30"
        >
          {submitting ? 'Activating Profile...' : 'Complete Onboarding & Enter Portal'}
        </Button>
      </div>
    </div>
  );
}
