import { Link } from 'react-router';
import { Factory, User } from 'lucide-react';
import { toast } from 'sonner';
import { MOCK_SUPER_ORDERS, STATUS_LABELS, formatMoney, type OrderKind } from '../../data/superadminMock';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { useState } from 'react';
import { cn } from '../../components/ui/utils';

const KIND_LABEL: Record<OrderKind, string> = {
  techpack: 'Tech pack',
  custom_clothing: 'Custom clothing',
};

export function SuperAdminOrders() {
  const [kindFilter, setKindFilter] = useState<'all' | OrderKind>('all');

  const rows = MOCK_SUPER_ORDERS.filter((o) => (kindFilter === 'all' ? true : o.kind === kindFilter));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Orders</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            Tech pack and custom clothing orders. Assign manufacturers, track pricing workflow, delivery, and status.
            Manufacturer pricing UI will plug in here later.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
            <SelectTrigger className="w-[180px] border-white/15 bg-white/5 text-white">
              <SelectValue placeholder="Filter type" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="techpack">Tech pack only</SelectItem>
              <SelectItem value="custom_clothing">Custom clothing</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/45">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Manufacturer</th>
                <th className="px-4 py-3 font-medium">Delivery</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-white/[0.06] hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-white/70">{o.id}</div>
                    <div className="max-w-[220px] truncate text-white/90">{o.productName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="border-white/15 text-white/75">
                      {KIND_LABEL[o.kind]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-white/90">
                      <User className="h-3.5 w-3.5 text-white/40" />
                      {o.userName}
                    </div>
                    <div className="text-xs text-white/45">{o.userEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        o.status === 'priced' && 'bg-emerald-500/15 text-emerald-300',
                        o.status === 'assigned' && 'bg-amber-500/15 text-amber-200',
                        !['priced', 'assigned'].includes(o.status) && 'bg-white/10 text-white/70',
                      )}
                    >
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {o.manufacturerName ? (
                      <span className="inline-flex items-center gap-1 text-white/80">
                        <Factory className="h-3.5 w-3.5 text-white/40" />
                        {o.manufacturerName}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-white/15 text-[11px] text-white"
                        onClick={() => toast.success('Mock: assign manufacturer')}
                      >
                        Assign
                      </Button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/60">
                    {o.deliveryCity}, {o.deliveryCountry}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/70">
                    {o.finalPriceCents != null ? formatMoney(o.finalPriceCents) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Button asChild size="sm" variant="ghost" className="text-[#CC2D24] hover:bg-white/5">
                      <Link to={`/superadmin/orders/${o.id}`}>Open</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
