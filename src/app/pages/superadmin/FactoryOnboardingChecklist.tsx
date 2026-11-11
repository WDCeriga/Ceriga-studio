import { useEffect, useState } from 'react';
import { ChevronDown, ClipboardList } from 'lucide-react';
import { getSupabase } from '../../lib/supabaseClient';

const setupSteps = [
  'Factory and contact details',
  'Garments and specifications',
  'Production capabilities',
  'Capacity and pricing',
  'Production timeline',
  'Shipping methods and destinations',
];

type Checklist = {
  setup_complete: boolean;
  completed_steps: number[] | null;
  onboarding_step: number | null;
  verification_status: 'not_submitted' | 'pending_review' | 'changes_required' | 'verified';
};

const verificationLabels = {
  not_submitted: 'Submit business verification documents',
  pending_review: 'Verification submitted · awaiting Ceriga review',
  changes_required: 'Update and resubmit verification documents',
  verified: 'Business verification approved',
};

export function FactoryOnboardingChecklist({ manufacturerId }: { manufacturerId: string }) {
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error } = await getSupabase().rpc('factory_onboarding_checklist', {
          p_manufacturer: manufacturerId,
        });
        if (error) throw new Error(error.message);
        if (!data) throw new Error('No matching factory account was found.');
        if (active) {
          setChecklist(data);
          setError('');
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Please try again.');
      }
    }
    void load();
    window.addEventListener('ceriga-manufacturer-data-updated', load);
    return () => {
      active = false;
      window.removeEventListener('ceriga-manufacturer-data-updated', load);
    };
  }, [manufacturerId, attempt]);

  const completedSteps = checklist?.completed_steps;
  const hasSavedSteps = Array.isArray(completedSteps);
  const remaining = hasSavedSteps ? setupSteps.filter((_, index) => {
    // New drafts start with step zero marked. Advancing confirms that first step.
    return !completedSteps.includes(index) || (index === 0 && !checklist?.onboarding_step);
  }) : [];

  return (
    <details className="md-onboarding-checklist">
      <summary>
        <ClipboardList size={16} aria-hidden />
        <span>Onboarding checklist</span>
        <ChevronDown size={14} className="md-onboarding-chevron" aria-hidden />
      </summary>
      <div className="md-onboarding-content">
        {error ? (
          <div role="alert">
            <p>Could not load onboarding progress. {error}</p>
            <button type="button" onClick={() => { setError(''); setChecklist(null); setAttempt(value => value + 1); }}>Retry</button>
          </div>
        ) : !checklist ? (
          <p role="status">Loading onboarding progress…</p>
        ) : (
          <dl>
            <div>
              <dt>Factory setup</dt>
              <dd>
                {checklist.setup_complete ? 'Setup submitted' : (
                  <>
                    {remaining.length > 0 && <ul>{remaining.map(step => <li key={step}>{step}</li>)}</ul>}
                    <p>Submit the completed factory setup.</p>
                    {!hasSavedSteps && <small>Step-by-step progress has not been recorded.</small>}
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>Business verification</dt>
              <dd><a href="#factory-verification">{verificationLabels[checklist.verification_status]}</a></dd>
            </div>
          </dl>
        )}
      </div>
    </details>
  );
}
