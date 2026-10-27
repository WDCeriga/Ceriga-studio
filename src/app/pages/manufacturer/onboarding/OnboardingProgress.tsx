import { Check, ChevronRight } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

export type OnboardingStepDef = {
  id: number;
  label: string;
  shortLabel: string;
  description: string;
};

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    id: 0,
    label: 'Factory Profile',
    shortLabel: 'Profile',
    description: 'Facility credentials, location, and primary contacts',
  },
  {
    id: 1,
    label: 'Products & Garments',
    shortLabel: 'Garments',
    description: 'Supported categories, fits, GSM limits, and fabrications',
  },
  {
    id: 2,
    label: 'Production Capabilities',
    shortLabel: 'Capabilities',
    description: 'Printing, embroidery, wash treatments, in-house vs outsourced',
  },
  {
    id: 3,
    label: 'Capacity & Pricing',
    shortLabel: 'Capacity',
    description: 'MOQ constraints, volume ceilings, turnarounds, and pricing',
  },
  {
    id: 4,
    label: 'Shipping',
    shortLabel: 'Shipping',
    description: 'Destinations, freight modes, and customs',
  },
  {
    id: 5,
    label: 'Review & Complete',
    shortLabel: 'Review',
    description: 'Final audit of factory specifications and portal activation',
  },
];

type Props = {
  currentStep: number;
  completedSteps: number[];
  onSelectStep: (stepIndex: number) => void;
};

export function OnboardingProgress({ currentStep, completedSteps, onSelectStep }: Props) {
  return (
    <div className="w-full">
      {/* Mobile Step Header */}
      <div className="flex items-center justify-between lg:hidden mb-4 rounded-xl border border-[#252528] bg-[#111113] p-3">
        <div>
          <span className="text-[10px] uppercase font-bold text-[#CC2D24] tracking-wider">
            Step {currentStep + 1} of {ONBOARDING_STEPS.length}
          </span>
          <h2 className="text-sm font-semibold text-white">
            {ONBOARDING_STEPS[currentStep]?.label}
          </h2>
        </div>
        <div className="flex gap-1">
          {ONBOARDING_STEPS.map((s) => (
            <div
              key={s.id}
              className={cn(
                'h-1.5 w-6 rounded-full transition-all',
                s.id === currentStep
                  ? 'bg-[#CC2D24] w-8'
                  : completedSteps.includes(s.id)
                    ? 'bg-emerald-500/70'
                    : 'bg-white/10',
              )}
            />
          ))}
        </div>
      </div>

      {/* Desktop Horizontal Step Wizard */}
      <div className="hidden lg:grid grid-cols-6 gap-2">
        {ONBOARDING_STEPS.map((s, index) => {
          const isCurrent = s.id === currentStep;
          const isCompleted = completedSteps.includes(s.id);
          const isClickable = isCompleted || s.id <= currentStep;

          return (
            <button
              key={s.id}
              type="button"
              disabled={!isClickable}
              onClick={() => onSelectStep(s.id)}
              className={cn(
                'group relative flex flex-col items-start p-3.5 rounded-2xl border text-left transition',
                isCurrent
                  ? 'border-[#CC2D24] bg-[#CC2D24]/10 shadow-lg shadow-red-950/20'
                  : isCompleted
                    ? 'border-[#252528] bg-white/[0.02] hover:border-emerald-500/40 hover:bg-white/[0.04]'
                    : 'border-[#252528]/50 bg-white/[0.01] opacity-40 cursor-not-allowed',
              )}
            >
              <div className="flex w-full items-center justify-between">
                <div
                  className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition',
                    isCurrent
                      ? 'bg-[#CC2D24] text-white'
                      : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white/10 text-white/50',
                  )}
                >
                  {isCompleted && !isCurrent ? (
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  ) : (
                    index + 1
                  )}
                </div>

                {isCurrent && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#CC2D24] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#CC2D24]"></span>
                  </span>
                )}
              </div>

              <span
                className={cn(
                  'mt-2.5 text-xs font-semibold truncate w-full',
                  isCurrent ? 'text-white' : isCompleted ? 'text-white/80' : 'text-white/40',
                )}
              >
                {s.label}
              </span>
              <span className="text-[10px] text-white/40 line-clamp-1 mt-0.5">
                {s.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
