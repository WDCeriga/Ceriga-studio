import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
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
  useCerigaTranslation();

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
        if (!data) throw new Error("No matching factory account was found.");
        if (active) {
          setChecklist(data);
          setError('');
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : cerigaTranslate("interface.text_eea4fb33efd38283"));
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
        <span>{cerigaTranslate("interface.text_0e469680e675b11f")}</span>
        <ChevronDown size={14} className="md-onboarding-chevron" aria-hidden />
      </summary>
      <div className="md-onboarding-content">
        {error ? (
          <div role="alert">
            <p>{cerigaTranslate("interface.text_80be3c3dab2d590b")}{" "}{cerigaTranslateLabel(error)}</p>
            <button type="button" onClick={() => { setError(''); setChecklist(null); setAttempt(value => value + 1); }}>{cerigaTranslate("interface.text_942087cc2d41e013")}</button>
          </div>
        ) : !checklist ? (
          <p role="status">{cerigaTranslate("interface.text_7bd44b721abda129")}</p>
        ) : (
          <dl>
            <div>
              <dt>{cerigaTranslate("interface.text_a81c0c8e9743c0ef")}</dt>
              <dd>
                {checklist.setup_complete ? cerigaTranslate("interface.text_ec093813d485bde8") : (
                  <>
                    {remaining.length > 0 && <ul>{remaining.map(step => <li key={step}>{step}</li>)}</ul>}
                    <p>{cerigaTranslate("interface.text_c9f909b502f8ae62")}</p>
                    {!hasSavedSteps && <small>{cerigaTranslate("interface.text_259f43a9e971a674")}</small>}
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>{cerigaTranslate("interface.text_f9a0e7ca499dd4f2")}</dt>
              <dd><a href="#factory-verification">{cerigaTranslateLabel(verificationLabels[checklist.verification_status])}</a></dd>
            </div>
          </dl>
        )}
      </div>
    </details>
  );
}
