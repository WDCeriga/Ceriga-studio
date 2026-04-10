import { useId, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { cn } from '../components/ui/utils';

const MEASUREMENT_OPTIONS = ['Metric (cm)', 'Imperial (inches)'] as const;
const CURRENCY_OPTIONS = ['€ EUR', '$ USD', '£ GBP', '$ AUD'] as const;

export default function Settings() {
  const navigate = useNavigate();
  const [measurementSystem, setMeasurementSystem] = useState<string>(MEASUREMENT_OPTIONS[0]);
  const [currency, setCurrency] = useState<string>(CURRENCY_OPTIONS[0]);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#0F0F0F] text-white">
      <div className="mx-auto max-w-[760px] px-4 py-5 sm:px-5 sm:py-8 md:px-8">
        <Button variant="outline" onClick={() => navigate(-1)} className="mb-4 h-8 border-white/20 px-3 text-[10px] !text-white hover:bg-white/10">
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
          BACK
        </Button>

        <div className="mb-6">
          <div className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">ACCOUNT</div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold uppercase tracking-[-0.5px] text-white">SETTINGS</h1>
          <p className="mt-1 text-sm text-white/55">Manage your profile, preferences and security.</p>
        </div>

        <div className="space-y-4">
          <Section title="Profile">
            <Field label="Display Name" placeholder="Your name" />
            <Field label="Email Address" placeholder="you@company.com" type="email" />
            <Field label="Company Name" placeholder="Your company" />
          </Section>

          <Section title="Preferences">
            <Toggle title="Email Notifications" subtitle="Receive updates about drafts and orders" defaultChecked />
            <Toggle title="SMS Notifications" subtitle="Get shipping and production updates" />
            <Toggle title="Marketing Emails" subtitle="Receive release notes and new features" />
          </Section>

          <Section title="Units & Measurements">
            <SettingsSelect
              label="Measurement System"
              options={[...MEASUREMENT_OPTIONS]}
              value={measurementSystem}
              onChange={setMeasurementSystem}
            />
            <SettingsSelect
              label="Currency"
              options={[...CURRENCY_OPTIONS]}
              value={currency}
              onChange={setCurrency}
            />
          </Section>

          <Section title="Security">
            <MenuRow title="Change Password" subtitle="Update your login password" />
            <MenuRow title="Two-Factor Authentication" subtitle="Add another security step" />
          </Section>

          <div className="rounded-2xl border border-red-500/25 bg-red-500/8 p-4">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-red-400">Danger Zone</div>
            <MenuRow title="Delete Account" subtitle="Permanently remove your account and all data" danger />
          </div>

          <Button className="h-10 w-full bg-[#CC2D24] text-xs font-semibold hover:bg-[#CC2D24]/90">SAVE CHANGES</Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-4 text-sm font-semibold text-white">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, placeholder, type = 'text' }: { label: string; placeholder: string; type?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/55">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-white/25 focus-visible:ring-2 focus-visible:ring-[#CC2D24]/35"
      />
    </div>
  );
}

/** Same Radix Select + dark panel pattern as MeasurementsStep (Popover+cmdk list was collapsing / filtering to zero items). */
function SettingsSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/55">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className={cn(
            'h-10 w-full rounded-lg border border-white/12 bg-black/30 px-3 text-sm font-normal text-white shadow-none',
            'data-[placeholder]:text-white/45 [&_svg]:text-white/55',
            'focus-visible:border-white/25 focus-visible:ring-2 focus-visible:ring-[#CC2D24]/35',
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          position="popper"
          side="bottom"
          sideOffset={6}
          align="start"
          collisionPadding={12}
          className={cn(
            'z-[300] max-h-[min(50vh,22rem)] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)]',
            'border border-white/12 bg-[#141416] text-white shadow-[0_16px_48px_rgba(0,0,0,0.55)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
          )}
        >
          {options.map((opt) => (
            <SelectItem
              key={opt}
              value={opt}
              className={cn(
                'cursor-pointer py-2 pl-3 pr-9 text-sm text-white',
                'focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10',
                '[&_svg]:text-[#CC2D24]',
              )}
            >
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Toggle({ title, subtitle, defaultChecked = false }: { title: string; subtitle: string; defaultChecked?: boolean }) {
  const id = useId();
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
      <Label htmlFor={id} className="min-w-0 flex-1 cursor-pointer space-y-0.5 font-normal">
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="text-xs text-white/50">{subtitle}</div>
      </Label>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => setChecked(v === true)}
        className={cn(
          'size-[18px] shrink-0 rounded-[4px] border border-white/35 bg-transparent shadow-none',
          'data-[state=checked]:border-[#CC2D24] data-[state=checked]:bg-[#CC2D24] data-[state=checked]:text-white',
          'focus-visible:border-white/40 focus-visible:ring-2 focus-visible:ring-[#CC2D24]/40',
        )}
      />
    </div>
  );
}

function MenuRow({ title, subtitle, danger = false }: { title: string; subtitle: string; danger?: boolean }) {
  return (
    <button className={`w-full rounded-xl border px-3 py-3 text-left transition ${danger ? 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}>
      <div className={`text-sm font-medium ${danger ? 'text-red-400' : 'text-white'}`}>{title}</div>
      <div className={`text-xs ${danger ? 'text-red-400/60' : 'text-white/50'}`}>{subtitle}</div>
    </button>
  );
}
