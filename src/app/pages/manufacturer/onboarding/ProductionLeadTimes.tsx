import {Clock} from 'lucide-react';
import {Input} from '../../../components/ui/input';
import {Label} from '../../../components/ui/label';
import {cn} from '../../../components/ui/utils';
import type {CompleteManufacturerProfile} from '../../../data/manufacturerOnboardingTypes';
export function ProductionLeadTimes({profile,onChange,errors}:{profile:CompleteManufacturerProfile;onChange:(patch:Partial<CompleteManufacturerProfile>)=>void;errors:Record<string,string>}){return (<>
      {/* Production Timelines Section */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white">
            <Clock className="h-4 w-4 text-[#CC2D24]" />
            <h3 className="text-sm font-semibold">Sample &amp; Bulk Lead Times</h3>
            <span className="text-xs text-[#CC2D24] font-medium">* Required</span>
          </div>

          {/* Working days vs Calendar days selector */}
          <div className="flex items-center rounded-lg border border-[#252528] bg-black/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => onChange({ timeUnit: 'working_days' })}
              className={cn(
                'px-2.5 py-1 rounded text-[11px] font-medium transition',
                profile.timeUnit === 'working_days'
                  ? 'bg-[#CC2D24] text-white'
                  : 'text-white/40 hover:text-white',
              )}
            >
              Working Days
            </button>
            <button
              type="button"
              onClick={() => onChange({ timeUnit: 'calendar_days' })}
              className={cn(
                'px-2.5 py-1 rounded text-[11px] font-medium transition',
                profile.timeUnit === 'calendar_days'
                  ? 'bg-[#CC2D24] text-white'
                  : 'text-white/40 hover:text-white',
              )}
            >
              Calendar Days
            </button>
          </div>
        </div>

        <p className="text-sm text-white/50">Set separate turnaround times for samples and bulk production. Each quotation uses the matching saved lead time.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['sample', 'bulk'] as const).map(kind => {
            const minimum = kind === 'sample' ? 'sampleLeadTimeMinDays' : 'bulkLeadTimeMinDays';
            const maximum = kind === 'sample' ? 'sampleLeadTimeMaxDays' : 'bulkLeadTimeMaxDays';
            const error = kind === 'sample' ? errors.sampleLead : errors.bulkLead;
            return <fieldset key={kind} className="rounded-xl border border-white/10 p-4">
              <legend className="px-2 text-sm font-semibold text-white">{kind === 'sample' ? 'Sample lead time' : 'Bulk production lead time'}</legend>
              <div className="grid grid-cols-2 gap-3">
                {([minimum, maximum] as const).map((field, index) => <div key={field}>
                  <Label htmlFor={field} className="text-xs text-white/70">{index === 0 ? 'Minimum' : 'Maximum'} {profile.timeUnit === 'working_days' ? 'working days' : 'calendar days'}</Label>
                  <Input id={field} type="number" min="1" max="3650" step="1" value={profile[field] || ''} onChange={event => onChange({ [field]: Number(event.target.value) || 0 })} aria-invalid={Boolean(error)} className={cn('mt-2 border-white/10 bg-white/[0.03] text-white', error && 'border-red-500/80')} />
                </div>)}
              </div>
              <p className="mt-3 text-xs text-white/40">Used for {kind === 'sample' ? 'sample quotations' : 'bulk quotation options'}. The maximum prefills the quotation and can be adjusted per order.</p>
            </fieldset>;
          })}
        </div>

        {(errors.sampleLead || errors.bulkLead) && (
          <p className="text-xs text-red-400">{errors.sampleLead || errors.bulkLead}</p>
        )}
      </div>


</>);}
