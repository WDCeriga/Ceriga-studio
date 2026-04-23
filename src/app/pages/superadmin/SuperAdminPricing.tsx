import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { MOCK_SUPER_ORDERS, formatMoney } from '../../data/superadminMock';

export function SuperAdminPricing() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Pricing</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/45">
          Tech pack list price, platform margin over manufacturer quotes, and revenue tracking. Manual orders for offline
          deals.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Tech pack retail</h2>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-white/55">PDF tech pack (GBP)</Label>
              <Input defaultValue="49.00" className="border-white/15 bg-white/5 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/55">ZIP + extras bundle (GBP)</Label>
              <Input defaultValue="79.00" className="border-white/15 bg-white/5 text-white" />
            </div>
            <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={() => toast.success('Mock: prices saved')}>
              Save
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Margin over manufacturer</h2>
          <p className="mt-2 text-xs text-white/45">Applied when composing final price from mfg quote + tax + platform fee.</p>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-white/55">Platform margin (%)</Label>
              <Input defaultValue="18" type="number" className="border-white/15 bg-white/5 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/55">Estimated tax / duties (%)</Label>
              <Input defaultValue="12" type="number" className="border-white/15 bg-white/5 text-white" />
            </div>
            <Button variant="outline" className="border-white/15 text-white" onClick={() => toast.success('Mock: margin rules saved')}>
              Save rules
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Order revenue</h2>
            <p className="text-xs text-white/45">All paid orders — add manual rows for invoices raised outside the app.</p>
          </div>
          <Button size="sm" className="bg-white/10 text-white hover:bg-white/15" onClick={() => toast.success('Mock: manual order')}>
            Add manual order
          </Button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/45">
                <th className="py-2 pr-4 font-medium">Order</th>
                <th className="py-2 pr-4 font-medium">Customer</th>
                <th className="py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_SUPER_ORDERS.filter((o) => o.finalPriceCents != null).map((o) => (
                <tr key={o.id} className="border-b border-white/[0.06]">
                  <td className="py-2 pr-4 font-mono text-xs text-white/70">{o.id}</td>
                  <td className="py-2 pr-4 text-white/85">{o.userName}</td>
                  <td className="py-2 tabular-nums text-white">{formatMoney(o.finalPriceCents!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
