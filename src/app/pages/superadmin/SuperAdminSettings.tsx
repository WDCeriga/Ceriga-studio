import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';

export function SuperAdminSettings() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-white/45">Owner preferences and integration placeholders.</p>
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Notifications</h2>
        <div className="mt-4 space-y-4">
          <label className="flex items-center justify-between gap-4 rounded-lg border border-white/10 px-3 py-3">
            <div>
              <div className="text-sm text-white">Email for new orders</div>
              <div className="text-xs text-white/45">Superadmin inbox</div>
            </div>
            <Switch defaultChecked />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-lg border border-white/10 px-3 py-3">
            <div>
              <div className="text-sm text-white">Slack webhook</div>
              <div className="text-xs text-white/45">Post critical events</div>
            </div>
            <Switch />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">API keys (mock)</h2>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-white/55">SendGrid / email provider</Label>
            <Input placeholder="••••••••" className="border-white/15 bg-white/5 font-mono text-sm text-white" />
          </div>
          <Button variant="outline" className="border-white/15 text-white" onClick={() => toast.success('Mock: saved')}>
            Save
          </Button>
        </div>
      </section>
    </div>
  );
}
