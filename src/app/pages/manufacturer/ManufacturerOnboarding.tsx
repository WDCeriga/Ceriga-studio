import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Sparkles, Check, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  loadCompleteManufacturerProfile,
  saveCompleteManufacturerProfile,
} from '../../data/manufacturerOnboardingStore';
import type { CompleteManufacturerProfile } from '../../data/manufacturerOnboardingTypes';
import { completeOnboardingInDb } from '../../data/manufacturerOnboarding';

import { OnboardingProgress } from './onboarding/OnboardingProgress';
import { StepFactoryProfile } from './onboarding/StepFactoryProfile';
import { StepProductsGarments } from './onboarding/StepProductsGarments';
import { StepProductionCapabilities } from './onboarding/StepProductionCapabilities';
import { StepCapacityPricing } from './onboarding/StepCapacityPricing';
import { StepShippingServices } from './onboarding/StepShippingServices';
import { StepReviewComplete } from './onboarding/StepReviewComplete';

export function ManufacturerOnboarding() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Load persisted state or bootstrap
  const [profile, setProfile] = useState<CompleteManufacturerProfile>(() =>
    loadCompleteManufacturerProfile(),
  );

  const initialStepParam = Number(searchParams.get('step'));
  const [step, setStep] = useState<number>(
    !Number.isNaN(initialStepParam) && initialStepParam >= 0 && initialStepParam < 6
      ? initialStepParam
      : profile.onboardingStep || 0,
  );

  const [completedSteps, setCompletedSteps] = useState<number[]>(
    profile.completedSteps?.length ? profile.completedSteps : [0],
  );

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync step changes into URL for back/forward navigation
  const goToStep = (nextStep: number) => {
    setStep(nextStep);
    setSearchParams({ step: String(nextStep) }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Autosave implementation with debouncing
  const persistChanges = useCallback((updated: CompleteManufacturerProfile) => {
    setSaveStatus('saving');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      try {
        saveCompleteManufacturerProfile(updated);
        setSaveStatus('saved');
      } catch (err) {
        console.error('[ManufacturerOnboarding] Autosave failed:', err);
        setSaveStatus('error');
      }
    }, 600);
  }, []);

  const handleProfileChange = (patch: Partial<CompleteManufacturerProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      persistChanges(next);
      return next;
    });
  };

  // Validation functions per step
  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!profile.factoryName.trim()) errs.factoryName = 'Facility name is required';
    if (!profile.contactName.trim()) errs.contactName = 'Primary contact person is required';
    if (!profile.contactEmail.trim() || !profile.contactEmail.includes('@')) {
      errs.contactEmail = 'A valid business email is required';
    }
    if (!profile.contactPhone.trim()) errs.contactPhone = 'Phone number with country code is required';
    if (!profile.country.trim()) errs.country = 'Country is required';
    if (!profile.city.trim()) errs.city = 'City is required';
    if (!profile.manufacturerTypes || profile.manufacturerTypes.length === 0) {
      errs.manufacturerTypes = 'Select at least one manufacturer type';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!profile.garments || profile.garments.length === 0) {
      errs.garments = 'Select at least one garment category (e.g. Hoodies, T-shirts)';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!profile.capabilitiesMap || Object.keys(profile.capabilitiesMap).length === 0) {
      errs.capabilities = 'Select at least one relevant production capability';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep4 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!profile.generalMoq || profile.generalMoq <= 0) {
      errs.generalMoq = 'MOQ must be greater than 0';
    }
    if (!profile.monthlyCapacity || profile.monthlyCapacity <= 0) {
      errs.monthlyCapacity = 'Monthly capacity must be greater than 0';
    }
    if (
      profile.currentAvailableMonthlyCapacity &&
      profile.currentAvailableMonthlyCapacity > profile.monthlyCapacity
    ) {
      errs.currentAvailableMonthlyCapacity =
        'Available capacity cannot exceed total monthly capacity';
    }
    if (
      profile.sampleLeadTimeMinDays &&
      profile.sampleLeadTimeMaxDays &&
      profile.sampleLeadTimeMinDays > profile.sampleLeadTimeMaxDays
    ) {
      errs.sampleLead = 'Minimum sample lead time cannot exceed maximum';
    }
    if (
      profile.bulkLeadTimeMinDays &&
      profile.bulkLeadTimeMaxDays &&
      profile.bulkLeadTimeMinDays > profile.bulkLeadTimeMaxDays
    ) {
      errs.bulkLead = 'Minimum bulk lead time cannot exceed maximum';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep5 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!profile.shippingDestinations || profile.shippingDestinations.length === 0) {
      errs.destinations = 'Select at least one destination country or region';
    }
    if (!profile.shippingMethods || profile.shippingMethods.length === 0) {
      errs.methods = 'Select at least one shipping method';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    let isValid = true;
    if (step === 0) isValid = validateStep1();
    else if (step === 1) isValid = validateStep2();
    else if (step === 2) isValid = validateStep3();
    else if (step === 3) isValid = validateStep4();
    else if (step === 4) isValid = validateStep5();

    if (!isValid) {
      toast.error('Please complete the required fields before continuing');
      return;
    }

    // Mark current step as completed
    if (!completedSteps.includes(step)) {
      const nextCompleted = [...completedSteps, step];
      setCompletedSteps(nextCompleted);
      handleProfileChange({ completedSteps: nextCompleted, onboardingStep: step + 1 });
    } else {
      handleProfileChange({ onboardingStep: step + 1 });
    }

    setFieldErrors({});
    goToStep(Math.min(5, step + 1));
  };

  const handleBack = () => {
    setFieldErrors({});
    goToStep(Math.max(0, step - 1));
  };

  // Step 6 Final Submission
  const getFullValidationErrors = (): string[] => {
    const list: string[] = [];
    if (!profile.factoryName.trim()) list.push('Facility name is missing');
    if (!profile.contactName.trim()) list.push('Primary contact person is missing');
    if (!profile.contactEmail.trim()) list.push('Business email is missing');
    if (!profile.country.trim()) list.push('Country is missing');
    if (!profile.city.trim()) list.push('City is missing');
    if (profile.garments.length === 0) list.push('At least one garment category must be selected');
    if (Object.keys(profile.capabilitiesMap || {}).length === 0) {
      list.push('At least one production capability must be selected');
    }
    if (profile.generalMoq <= 0) list.push('General MOQ must be greater than 0');
    if (profile.monthlyCapacity <= 0) list.push('Monthly capacity must be greater than 0');
    if (
      profile.currentAvailableMonthlyCapacity &&
      profile.currentAvailableMonthlyCapacity > profile.monthlyCapacity
    ) {
      list.push('Available monthly capacity cannot exceed total monthly capacity');
    }
    if (profile.shippingDestinations.length === 0) {
      list.push('At least one shipping destination must be selected');
    }
    return list;
  };

  const handleFinishOnboarding = async () => {
    const errors = getFullValidationErrors();
    if (errors.length > 0) {
      toast.error('Please resolve the errors highlighted on the review page');
      return;
    }

    setSubmitting(true);
    try {
      const completedProfile: CompleteManufacturerProfile = {
        ...profile,
        onboardingComplete: true,
        completedSteps: [0, 1, 2, 3, 4, 5],
        onboardingStep: 5,
      };

      // Persist in comprehensive store
      saveCompleteManufacturerProfile(completedProfile);

      // Persist via existing database bridge for backward-compatibility
      await completeOnboardingInDb({
        factoryName: completedProfile.factoryName.trim(),
        garments: completedProfile.garments,
        capabilities: Object.keys(completedProfile.capabilitiesMap || {}),
        shippingRegions: completedProfile.shippingDestinations,
        moq: completedProfile.generalMoq || 50,
        monthlyCapacity: completedProfile.monthlyCapacity || 1000,
      });

      toast.success('Manufacturer setup complete! Welcome to your factory portal.');
      navigate('/manufacturer', {
        replace: true,
        state: { manufacturerOnboardingComplete: true },
      });
    } catch (err) {
      console.error('[ManufacturerOnboarding] Final submit failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to complete onboarding');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Top Banner with Auto-Save Indicator */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#252528] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <Sparkles className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Factory Partner Onboarding
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {profile.factoryName ? `Set up ${profile.factoryName}` : 'Set Up Your Factory'}
          </h1>
          <p className="mt-1 text-sm text-white/45">
            Configure detailed production specs, capabilities, and capacity to receive matched brand orders.
          </p>
        </div>

        {/* Status Pill & Resume Info */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/60">
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                <span>Saving progress...</span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <AlertCircle className="h-3 w-3 text-red-400" />
                <span className="text-red-400">Autosave failed</span>
              </>
            ) : (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span>All changes autosaved</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 6-Step Horizontal Progress Navigation */}
      <OnboardingProgress
        currentStep={step}
        completedSteps={completedSteps}
        onSelectStep={(target) => {
          if (completedSteps.includes(target) || target <= step) {
            goToStep(target);
          }
        }}
      />

      {/* Step Content */}
      <div className="pt-2">
        {step === 0 && (
          <StepFactoryProfile
            profile={profile}
            onChange={handleProfileChange}
            onNext={handleNext}
            errors={fieldErrors}
          />
        )}

        {step === 1 && (
          <StepProductsGarments
            profile={profile}
            onChange={handleProfileChange}
            onNext={handleNext}
            onBack={handleBack}
            errors={fieldErrors}
          />
        )}

        {step === 2 && (
          <StepProductionCapabilities
            profile={profile}
            onChange={handleProfileChange}
            onNext={handleNext}
            onBack={handleBack}
            errors={fieldErrors}
          />
        )}

        {step === 3 && (
          <StepCapacityPricing
            profile={profile}
            onChange={handleProfileChange}
            onNext={handleNext}
            onBack={handleBack}
            errors={fieldErrors}
          />
        )}

        {step === 4 && (
          <StepShippingServices
            profile={profile}
            onChange={handleProfileChange}
            onNext={handleNext}
            onBack={handleBack}
            errors={fieldErrors}
          />
        )}

        {step === 5 && (
          <StepReviewComplete
            profile={profile}
            onEditStep={(s) => goToStep(s)}
            onSubmit={handleFinishOnboarding}
            onBack={handleBack}
            submitting={submitting}
            validationErrors={getFullValidationErrors()}
          />
        )}
      </div>
    </div>
  );
}
