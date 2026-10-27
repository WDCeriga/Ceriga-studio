import { Link } from 'react-router';
import { useManufacturerLeadTimes } from '../../hooks/useManufacturerLeadTimes';
import { onboardingLeadRange } from '../../data/manufacturerLeadTimes';
export function ManufacturerLeadTimeSummary() {
 const {profile,error}=useManufacturerLeadTimes();
 return <section className="rounded-2xl border border-[#252528] bg-[#111113] p-5 text-white">
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Sample & bulk lead times</h2><Link to="/manufacturer/onboarding?step=3" className="text-xs text-red-300 hover:underline">Edit in onboarding</Link></div>
  {error&&<p role="alert" className="mt-3 text-xs text-amber-200">{error}</p>}
  <dl className="mt-4 grid gap-4 sm:grid-cols-2">{(['sample','bulk'] as const).map(kind=><div key={kind}><dt className="text-xs text-white/45">{kind==='sample'?'Samples':'Bulk production'}</dt><dd className="mt-1 text-lg font-semibold">{onboardingLeadRange(profile,kind)}{onboardingLeadRange(profile,kind)!=='Not set'?' days':''}</dd></div>)}</dl>
  <p className="mt-3 text-xs text-white/40">Quotations start with the matching sample or bulk lead time.</p>
 </section>;
}
