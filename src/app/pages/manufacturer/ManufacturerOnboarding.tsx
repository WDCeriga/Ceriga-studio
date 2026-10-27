import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Sparkles, Check, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  loadCompleteManufacturerProfile,
  saveCompleteManufacturerProfile,
  getProfileStorageKey,
} from '../../data/manufacturerOnboardingStore';
import type { CompleteManufacturerProfile } from '../../data/manufacturerOnboardingTypes';
import { garmentReviewError, isGarmentConfirmed } from '../../data/manufacturerGarmentDefaults';
import { completeOnboardingInDb } from '../../data/manufacturerOnboarding';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { loadCustomisationSettingsFromDb, saveCustomisationSettingsToDb } from '../../data/manufacturerCustomisationDb';
import { loadManufacturerPricingFromDb, saveManufacturerPricingToDb } from '../../data/manufacturerPricing';
import { normalizePricing, pricingValidationError } from '../../data/manufacturerPricingModel';

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
  const profileRef = useRef(profile);

  const initialStepParam = searchParams.has('step')?Number(searchParams.get('step')):NaN;
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
  const saveSequence = useRef(0);
  const pendingSnapshot = useRef<{ profile: CompleteManufacturerProfile; owner: string } | null>(null);
  // A failed cloud read must not hide the local onboarding draft or permit a
  // blind overwrite of settings that have not been loaded successfully.
  const syncReady = useRef({ methods: !isSupabaseConfigured, pricing: !isSupabaseConfigured });
  const [customisationLoadError, setCustomisationLoadError] = useState('');
  const [syncRetry, setSyncRetry] = useState(0);

  useEffect(() => () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const pending = pendingSnapshot.current;
    if (pending && pending.owner === getProfileStorageKey()) {
      saveCompleteManufacturerProfile(pending.profile);
      void Promise.allSettled([
        ...(syncReady.current.methods ? [saveCustomisationSettingsToDb(pending.profile)] : []),
        ...(syncReady.current.pricing ? [saveManufacturerPricingToDb(pending.profile.pricing)] : []),
      ]);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    setCustomisationLoadError('');
    const owner = getProfileStorageKey();
    void Promise.allSettled([loadCustomisationSettingsFromDb(), loadManufacturerPricingFromDb()]).then(async ([methodsResult, pricingResult]) => {
      if (cancelled || owner !== getProfileStorageKey()) return;
      syncReady.current = { methods: methodsResult.status === 'fulfilled', pricing: pricingResult.status === 'fulfilled' };
      const remote = methodsResult.status === 'fulfilled' ? methodsResult.value : null;
      const remotePricing = pricingResult.status === 'fulfilled' ? pricingResult.value : null;
      const local = profileRef.current;
      const profileBase=remote?.factoryProfile&&(!local.updatedAt||String(remote.factoryProfile.updatedAt||'')>local.updatedAt)?{...local,...remote.factoryProfile}:local;
      let merged = remote && (!local.customisationUpdatedAt || remote.customisationUpdatedAt! > local.customisationUpdatedAt)
        ? { ...profileBase, ...remote } : profileBase;
      if (remotePricing) merged = { ...merged, pricing: remotePricing };
      profileRef.current = merged;
      if (pendingSnapshot.current?.owner === owner) pendingSnapshot.current.profile = merged;
      setProfile(merged);
      if(!searchParams.has('step')&&merged.onboardingStep!=null)setStep(Math.max(0,Math.min(5,merged.onboardingStep)));
      saveCompleteManufacturerProfile(merged);
      const failures = [methodsResult, pricingResult].filter(result => result.status === 'rejected');
      setCustomisationLoadError(failures.map(result => String(result.reason?.message ?? result.reason)).join(' '));
      if (failures.length) setSaveStatus('error');
      // Retry first reads the cloud, merges newer data, then saves the retained
      // draft. Never write an unread resource after a failed load.
      if (syncRetry > 0) {
        const sequence = saveSequence.current;
        const writes = await Promise.allSettled([
          ...(syncReady.current.methods ? [saveCustomisationSettingsToDb(merged)] : []),
          ...(syncReady.current.pricing ? [saveManufacturerPricingToDb(merged.pricing)] : []),
        ]);
        if (!cancelled && owner === getProfileStorageKey() && sequence === saveSequence.current) {
          setSaveStatus(failures.length || writes.some(result => result.status === 'rejected') ? 'error' : 'saved');
        }
      }
    }).catch(error => {
      if (!cancelled) setCustomisationLoadError(error instanceof Error ? error.message : 'Could not load saved method settings.');
    });
    return () => { cancelled = true; };
  }, [syncRetry]);

  // Sync step changes into URL for back/forward navigation
  const goToStep = (nextStep: number) => {
    setStep(nextStep);
    setSearchParams({ step: String(nextStep) }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Autosave implementation with debouncing
  const persistChanges = useCallback((updated: CompleteManufacturerProfile) => {
    const sequence = ++saveSequence.current;
    const owner = getProfileStorageKey();
    pendingSnapshot.current = { profile: updated, owner };
    setSaveStatus('saving');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      if (owner !== getProfileStorageKey()) return;
      pendingSnapshot.current = null;
      try {
        const saved = saveCompleteManufacturerProfile(profileRef.current);
        const results = await Promise.allSettled([
          ...(syncReady.current.methods ? [saveCustomisationSettingsToDb(saved)] : []),
          ...(syncReady.current.pricing ? [saveManufacturerPricingToDb(saved.pricing)] : []),
        ]);
        if (!syncReady.current.methods || !syncReady.current.pricing || results.some(result => result.status === 'rejected')) {
          throw new Error('Cloud sync is unavailable. Your draft is saved on this device.');
        }
        if (sequence === saveSequence.current) setSaveStatus('saved');
      } catch (err) {
        console.error('[ManufacturerOnboarding] Autosave failed:', err);
        if (sequence === saveSequence.current) setSaveStatus('error');
      }
    }, 600);
  }, []);

  const handleProfileChange = (patch: Partial<CompleteManufacturerProfile>) => {
    const customisationChanged = ['capabilitiesMap', 'customCapabilities', 'capabilityCatalog', 'customMethodMoqs', 'generalMoq', 'garmentMoqOverrides', 'confirmedGarmentMoqOverrides'].some(key => Object.prototype.hasOwnProperty.call(patch, key));
    const next = { ...profileRef.current, ...patch, ...(patch.pricing ? { pricing: normalizePricing({ ...patch.pricing, updatedAt: new Date().toISOString() }) } : {}), ...(customisationChanged ? { customisationUpdatedAt: new Date().toISOString() } : {}) };
    profileRef.current = next;
    setProfile(next);
    saveCompleteManufacturerProfile(next);
    persistChanges(next);
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
    for (const category of profile.garments) {
      const detail = profile.garmentDetails?.[category];
      if (!isGarmentConfirmed(detail)) {
        errs[category] = garmentReviewError(detail) ?? 'Review and confirm these garment specifications.';
      }
    }
    if (Object.keys(errs).length && !errs.garments) {
      errs.garments = 'Review and confirm each selected garment category before continuing.';
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
    const pricingError = pricingValidationError(profile.pricing);
    if (pricingError) errs.pricing = pricingError;
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
    for (const kind of ['sample', 'bulk'] as const) {
      const min = kind === 'sample' ? profile.sampleLeadTimeMinDays : profile.bulkLeadTimeMinDays;
      const max = kind === 'sample' ? profile.sampleLeadTimeMaxDays : profile.bulkLeadTimeMaxDays;
      if (![min,max].every(value => Number.isInteger(value) && value >= 1 && value <= 3650) || min > max) {
        errs[kind === 'sample' ? 'sampleLead' : 'bulkLead'] = 'Enter a valid minimum and maximum lead time (1–3650 days).';
      }
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
    const pricingError = pricingValidationError(profile.pricing);
    if (pricingError) list.push(pricingError);
    if (!profile.factoryName.trim()) list.push('Facility name is missing');
    if (!profile.contactName.trim()) list.push('Primary contact person is missing');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.contactEmail.trim())) list.push('A valid business email is required');
    if(!profile.contactPhone.trim())list.push('Business phone is required');
    if(!profile.manufacturerTypes?.length)list.push('Select a manufacturer type');
    if(!profile.shippingMethods?.length)list.push('Select a shipping method');
    if (!profile.country.trim()) list.push('Country is missing');
    if (!profile.city.trim()) list.push('City is missing');
    if (profile.garments.length === 0) list.push('At least one garment category must be selected');
    for (const category of profile.garments) {
      if (!isGarmentConfirmed(profile.garmentDetails?.[category])) {
        list.push(`${category}: review and confirm the garment specifications`);
      }
    }
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
    for (const kind of ['sample','bulk'] as const) {
      const min=kind==='sample'?profile.sampleLeadTimeMinDays:profile.bulkLeadTimeMinDays;
      const max=kind==='sample'?profile.sampleLeadTimeMaxDays:profile.bulkLeadTimeMaxDays;
      if(![min,max].every(value=>Number.isInteger(value)&&value>=1&&value<=3650)||min>max) list.push(`Enter a valid ${kind} lead-time range`);
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

      // Never report onboarding as complete while method constraints failed to sync.
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      pendingSnapshot.current = null;
      if (!syncReady.current.methods || !syncReady.current.pricing) {
        saveCompleteManufacturerProfile(profileRef.current);
        throw new Error('Your draft is saved on this device. Restore cloud sync using Retry sync before completing onboarding.');
      }
      await saveCustomisationSettingsToDb(completedProfile);
      await saveManufacturerPricingToDb(completedProfile.pricing);
      saveCompleteManufacturerProfile(completedProfile);

      // Persist via existing database bridge for backward-compatibility
      await completeOnboardingInDb(completedProfile);

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
      {customisationLoadError && (
        <div role="alert" className="rounded-2xl border border-[#252528] bg-[#111113] p-6 text-sm text-white/70">
          <p>You can continue editing. Your draft is saved on this device, but cloud sync needs attention before final submission.</p>
          <p className="mt-2">{customisationLoadError}</p>
          <button type="button" onClick={() => setSyncRetry(value => value + 1)} className="mt-3 text-[#CC2D24]">Retry sync</button>
        </div>
      )}
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
                <span className="text-red-400">Saved on this device; sync failed</span>
                <button type="button" onClick={() => setSyncRetry(value => value + 1)} className="ml-1 text-[#CC2D24]">Retry</button>
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
