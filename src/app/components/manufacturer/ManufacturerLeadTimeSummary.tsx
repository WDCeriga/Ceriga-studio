import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { Link } from 'react-router';
import { useManufacturerLeadTimes } from '../../hooks/useManufacturerLeadTimes';
import { onboardingLeadRange } from '../../data/manufacturerLeadTimes';
export function ManufacturerLeadTimeSummary() {
  useCerigaTranslation();

 const {profile,error}=useManufacturerLeadTimes();
 return <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5 text-white">
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{cerigaTranslate("interface.text_64e7d5088178b0c0")}</h2><Link to="/manufacturer/onboarding?step=3" className="text-xs text-red-300 hover:underline">{cerigaTranslate("interface.text_ff8c7f3e04309423")}</Link></div>
  {error&&<p role="alert" className="mt-3 text-xs text-amber-200">{cerigaTranslateLabel(error)}</p>}
  <dl className="mt-4 grid gap-4 sm:grid-cols-2">{(['sample','bulk'] as const).map(kind=><div key={kind}><dt className="text-xs text-white/45">{kind==='sample'?cerigaTranslate("interface.text_bc228b269ce0d87f"):cerigaTranslate("interface.text_a23e5cc9e908115f")}</dt><dd className="mt-1 text-lg font-semibold">{onboardingLeadRange(profile,kind)}{onboardingLeadRange(profile,kind)!=='Not set'?cerigaTranslate("interface.text_ab51004e9d71a485"):''}</dd></div>)}</dl>
  <p className="mt-3 text-xs text-white/40">{cerigaTranslate("interface.text_f9468a2ef49d873b")}</p>
 </section>;
}
