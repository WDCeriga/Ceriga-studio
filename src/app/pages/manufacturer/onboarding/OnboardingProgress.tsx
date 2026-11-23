import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../../i18n/i18n';
import { Check } from 'lucide-react';

export type OnboardingStepDef = {
  id: number;
  label: string;
  shortLabel: string;
  description: string;
};

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    "id": 0,
    "label": "Factory Profile",
    "shortLabel": "Profile",
    "description": "Facility credentials, location, and primary contacts"
  },
  {
    "id": 1,
    "label": "Products & Garments",
    "shortLabel": "Garments",
    "description": "Supported categories, fits, GSM limits, and fabrications"
  },
  {
    "id": 2,
    "label": "Production Capabilities",
    "shortLabel": "Capabilities",
    "description": "Printing, embroidery, wash treatments, in-house vs outsourced"
  },
  {
    "id": 3,
    "label": "Capacity & Pricing",
    "shortLabel": "Capacity",
    "description": "MOQ constraints, volume ceilings and pricing"
  },
  {
    "id": 4,
    "label": "Production Turnaround Timelines",
    "shortLabel": "Timeline",
    "description": "Sample and bulk lead times, stage durations and timing factors"
  },
  {
    "id": 5,
    "label": "Shipping",
    "shortLabel": "Shipping",
    "description": "Destinations, freight modes, and customs"
  },
  {
    "id": 6,
    "label": "Review & Complete",
    "shortLabel": "Review",
    "description": "Final audit of factory specifications and portal activation"
  }
];

type Props = {
  currentStep: number;
  completedSteps: number[];
  onSelectStep: (stepIndex: number) => void;
};

export function OnboardingProgress({currentStep,completedSteps,onSelectStep}:Props){
  useCerigaTranslation();

 const active=ONBOARDING_STEPS[currentStep]||ONBOARDING_STEPS[0];
 return <nav className="onboarding-progress" aria-label={cerigaTranslate("interface.text_ad8a0dac00a23008")}><div className="onboarding-progress-mobile"><div><span>{cerigaTranslate("interface.text_8e6a6cca7aae1d1e")}{" "}{currentStep+1}{" "}{cerigaTranslate("interface.text_28391d3bc64ec15c")}{" "}{ONBOARDING_STEPS.length}</span><label className="sr-only" htmlFor="onboarding-step-select">{cerigaTranslate("interface.text_651e3f6403fbd18a")}</label><select id="onboarding-step-select" value={currentStep} onChange={e=>onSelectStep(Number(e.target.value))}>{ONBOARDING_STEPS.map(step=><option value={step.id} key={step.id} disabled={!completedSteps.includes(step.id)&&step.id>currentStep}>{step.id+1}. {cerigaTranslateLabel(step.label)}</option>)}</select></div><p>{active.description}</p></div><ol className="onboarding-progress-desktop">{ONBOARDING_STEPS.map(step=>{const current=step.id===currentStep,completed=completedSteps.includes(step.id)&&!current,enabled=completed||step.id<=currentStep;return <li key={step.id}><button type="button" disabled={!enabled} aria-current={current?'step':undefined} aria-label={cerigaTranslate("interface.text_6b8b81cd15297283",{value0:(step.id+1),value1:(step.label),value2:(completed?cerigaTranslate("interface.text_58ed35b39e141b13"):'')})} title={cerigaTranslateLabel(step.description)} data-complete={completed} onClick={()=>onSelectStep(step.id)}><span className="onboarding-step-number">{completed?<Check size={12}/>:step.id+1}</span><span><strong>{step.shortLabel}</strong><small>{current?cerigaTranslate("interface.text_a22aa04ba67bba51"):completed?cerigaTranslate("orders.completed"):cerigaTranslate("interface.text_5f1a2542e4e4ca5e")}</small></span></button></li>;})}</ol></nav>;
}
