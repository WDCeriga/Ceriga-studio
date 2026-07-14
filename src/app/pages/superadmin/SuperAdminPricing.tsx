import { useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Calculator,
  DollarSign,
  FileText,
  MessageSquare,
  Package,
  Plus,
  Shirt,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  addManualLedgerRow,
  applyProductionMargin,
  buildRevenueLedger,
  centsToInput,
  countPendingReviews,
  formatPricingMoney,
  getPricingConfig,
  getRevenueSummary,
  inputToCents,
  ledgerProfit,
  REVENUE_SOURCE_LABELS,
  upsertPricingConfig,
  type ManufacturerPlanMargin,
  type PlatformPricingConfig,
  type RevenueLedgerRow,
  type RevenueSource,
} from '../../data/superadminPricingMock';
import { MANUFACTURER_PLANS } from '../../data/crmAccessMock';
import { MOCK_SUPER_ORDERS } from '../../data/superadminMock';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { cn } from '../../components/ui/utils';

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-white/55">{label}</Label>
      <Input
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="border-white/15 bg-white/5 text-white tabular-nums"
      />
    </div>
  );
}

export function SuperAdminPricing() {
  const [config, setConfig] = useState<PlatformPricingConfig>(() => getPricingConfig());
  const [ledgerVersion, setLedgerVersion] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<RevenueSource | 'all'>('all');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState({
    date: new Date().toISOString().slice(0, 10),
    customerName: '',
    description: '',
    quantity: '1',
    revenue: '',
    manufacturerCost: '0',
    manufacturerShipping: '0',
  });

  const ledger = useMemo(
    () => buildRevenueLedger(MOCK_SUPER_ORDERS),
    [ledgerVersion],
  );
  const summary = useMemo(() => getRevenueSummary(ledger), [ledger]);
  const pendingReviews = countPendingReviews(MOCK_SUPER_ORDERS);

  const filteredLedger = useMemo(() => {
    if (sourceFilter === 'all') return ledger;
    return ledger.filter((r) => r.source === sourceFilter);
  }, [ledger, sourceFilter]);

  const previewQuote = 100000;

  const updatePlanMargin = (planId: string, platformMarginPercent: number) => {
    setConfig((c) => ({
      ...c,
      production: {
        ...c.production,
        planMargins: c.production.planMargins.map((p) =>
          p.planId === planId ? { ...p, platformMarginPercent } : p,
        ),
      },
    }));
  };

  const saveConfig = () => {
    upsertPricingConfig(config);
    setConfig(getPricingConfig());
    toast.success('Pricing rules saved');
  };

  const updateTechPack = (patch: Partial<PlatformPricingConfig['techPack']>) => {
    setConfig((c) => ({ ...c, techPack: { ...c.techPack, ...patch } }));
  };

  const updateProduction = (patch: Partial<PlatformPricingConfig['production']>) => {
    setConfig((c) => ({ ...c, production: { ...c.production, ...patch } }));
  };

  const updateChatPlan = (id: string, patch: Partial<PlatformPricingConfig['chatPlans'][0]>) => {
    setConfig((c) => ({
      ...c,
      chatPlans: c.chatPlans.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };

  const submitManual = () => {
    if (!manualDraft.customerName.trim() || !manualDraft.description.trim()) {
      toast.error('Customer and description are required');
      return;
    }
    const revenueCents = inputToCents(manualDraft.revenue);
    if (revenueCents == null) {
      toast.error('Enter a valid customer paid amount');
      return;
    }
    addManualLedgerRow({
      date: manualDraft.date,
      customerName: manualDraft.customerName.trim(),
      description: manualDraft.description.trim(),
      quantity: Number(manualDraft.quantity) || undefined,
      revenueCents,
      manufacturerCostCents: inputToCents(manualDraft.manufacturerCost) ?? 0,
      manufacturerShippingCents: inputToCents(manualDraft.manufacturerShipping) ?? 0,
      currency: 'GBP',
    });
    setLedgerVersion((v) => v + 1);
    setManualOpen(false);
    setManualDraft({
      date: new Date().toISOString().slice(0, 10),
      customerName: '',
      description: '',
      quantity: '1',
      revenue: '',
      manufacturerCost: '0',
      manufacturerShipping: '0',
    });
    toast.success('Manual revenue row added');
  };

  const manualProfitPreview = useMemo(() => {
    const rev = inputToCents(manualDraft.revenue) ?? 0;
    const cost = inputToCents(manualDraft.manufacturerCost) ?? 0;
    const ship = inputToCents(manualDraft.manufacturerShipping) ?? 0;
    return rev - cost - ship;
  }, [manualDraft]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <DollarSign className="h-5 w-5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Billing</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Pricing
          </h1>
        </div>
        <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={saveConfig}>
          Save all rules
        </Button>
      </div>

      {/* Snapshot */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Tech pack revenue',
            value: formatPricingMoney(summary.techPackRevenueEur, 'EUR'),
            icon: FileText,
          },
          {
            label: 'Production revenue',
            value: formatPricingMoney(summary.productionRevenueGbp, 'GBP'),
            icon: Shirt,
          },
          {
            label: 'Ceriga margin (production)',
            value: formatPricingMoney(summary.productionMarginGbp, 'GBP'),
            icon: Calculator,
          },
          {
            label: 'Pending price reviews',
            value: String(pendingReviews),
            icon: Package,
            link: pendingReviews > 0 ? '/superadmin/orders/review' : undefined,
          },
        ].map((card) => {
          const Icon = card.icon;
          const inner = (
            <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-4 transition hover:border-white/[0.12]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    {card.label}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-white">{card.value}</p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-white/45">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              {card.link ? (
                <p className="mt-3 flex items-center gap-1 text-[11px] font-medium text-[#CC2D24]">
                  Open review queue
                  <ArrowRight className="h-3 w-3" />
                </p>
              ) : null}
            </div>
          );
          return card.link ? (
            <Link key={card.label} to={card.link}>
              {inner}
            </Link>
          ) : (
            <div key={card.label}>{inner}</div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Tech pack exports</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <MoneyInput
              label="Standard PDF (EUR)"
              value={centsToInput(config.techPack.pdfCents)}
              onChange={(v) => {
                const c = inputToCents(v);
                if (c != null) updateTechPack({ pdfCents: c });
              }}
            />
            <MoneyInput
              label="PDF + asset bundle (EUR)"
              value={centsToInput(config.techPack.bundleCents)}
              onChange={(v) => {
                const c = inputToCents(v);
                if (c != null) updateTechPack({ bundleCents: c });
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Estimated duties / tax (%)</h2>
          <div className="mt-4">
            <Input
              type="number"
              step="0.1"
              min="0"
              value={config.production.estimatedDutiesPercent}
              onChange={(e) =>
                updateProduction({ estimatedDutiesPercent: Number(e.target.value) || 0 })
              }
              className="border-white/15 bg-white/5 text-white"
            />
          </div>
        </div>
      </div>

      {/* Production margins per manufacturer plan */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-white">Production order markup by plan</h2>
          <Link
            to="/superadmin/crm/access/manufacturers"
            className="text-[11px] font-medium text-[#CC2D24] hover:underline"
          >
            Assign plans
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {config.production.planMargins.map((planMargin) => (
            <ManufacturerPlanMarginCard
              key={planMargin.planId}
              planMargin={planMargin}
              meta={MANUFACTURER_PLANS.find((p) => p.id === planMargin.planId)}
              previewQuote={previewQuote}
              onMarginChange={(pct) => updatePlanMargin(planMargin.planId, pct)}
            />
          ))}
        </div>
      </div>

      {/* AI chat plans */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-white">AI assistant plans</h2>
          <Link
            to="/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-[#CC2D24] hover:underline"
          >
            Public pricing
          </Link>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/45">
                <th className="py-2 pr-4 font-medium">Plan</th>
                <th className="py-2 pr-4 font-medium">Monthly (EUR)</th>
                <th className="py-2 pr-4 font-medium">Messages / mo</th>
                <th className="py-2 pr-4 font-medium">Public</th>
              </tr>
            </thead>
            <tbody>
              {config.chatPlans.map((plan) => (
                <tr key={plan.id} className="border-b border-white/[0.06]">
                  <td className="py-3 pr-4">
                    <span className="font-medium text-white">{plan.tier}</span>
                    {plan.featured ? (
                      <span className="ml-2 rounded-full bg-[#CC2D24]/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#CC2D24]">
                        Featured
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">
                    <Input
                      value={centsToInput(plan.monthlyCents)}
                      onChange={(e) => {
                        const c = inputToCents(e.target.value);
                        if (c != null) updateChatPlan(plan.id, { monthlyCents: c });
                      }}
                      className="h-8 w-24 border-white/12 bg-white/[0.03] text-xs tabular-nums text-white"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <Input
                      type="number"
                      min="0"
                      value={plan.messageLimit}
                      onChange={(e) =>
                        updateChatPlan(plan.id, { messageLimit: Number(e.target.value) || 0 })
                      }
                      className="h-8 w-28 border-white/12 bg-white/[0.03] text-xs tabular-nums text-white"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <Switch
                      checked={plan.published}
                      onCheckedChange={(v) => updateChatPlan(plan.id, { published: v })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue ledger */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#111113] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Revenue ledger</h2>
          </div>
          <Button
            size="sm"
            className="bg-white/10 text-white hover:bg-white/15"
            onClick={() => setManualOpen(true)}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add manual entry
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(['all', 'techpack', 'custom_clothing', 'chat_subscription', 'manual'] as const).map(
            (key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSourceFilter(key)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition',
                  sourceFilter === key
                    ? 'border-[#CC2D24]/50 bg-[#CC2D24]/15 text-white'
                    : 'border-white/10 bg-black/20 text-white/40 hover:border-white/20',
                )}
              >
                {key === 'all' ? 'All' : REVENUE_SOURCE_LABELS[key]}
              </button>
            ),
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/25 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-white/35">GBP revenue</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">
              {formatPricingMoney(summary.totalRevenueGbp, 'GBP')}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/25 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-white/35">GBP profit</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-300">
              {formatPricingMoney(summary.totalProfitGbp, 'GBP')}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/25 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-white/35">Ledger rows</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">{summary.rowCount}</p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/45">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 pr-3 font-medium">Paid</th>
                <th className="py-2 pr-3 font-medium">Mfg cost</th>
                <th className="py-2 font-medium">Profit</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-white/40">
                    No rows for this filter.
                  </td>
                </tr>
              ) : (
                filteredLedger.map((row) => (
                  <LedgerRow key={row.id} row={row} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="border-white/10 bg-[#111113] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Manual revenue entry</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-white/55">Date</Label>
                <Input
                  type="date"
                  value={manualDraft.date}
                  onChange={(e) => setManualDraft((d) => ({ ...d, date: e.target.value }))}
                  className="border-white/15 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/55">Quantity</Label>
                <Input
                  value={manualDraft.quantity}
                  onChange={(e) => setManualDraft((d) => ({ ...d, quantity: e.target.value }))}
                  className="border-white/15 bg-white/5 text-white"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/55">Customer</Label>
              <Input
                value={manualDraft.customerName}
                onChange={(e) => setManualDraft((d) => ({ ...d, customerName: e.target.value }))}
                className="border-white/15 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/55">Description</Label>
              <Input
                value={manualDraft.description}
                onChange={(e) => setManualDraft((d) => ({ ...d, description: e.target.value }))}
                className="border-white/15 bg-white/5 text-white"
              />
            </div>
            <MoneyInput
              label="Customer paid (GBP)"
              value={manualDraft.revenue}
              onChange={(v) => setManualDraft((d) => ({ ...d, revenue: v }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyInput
                label="Manufacturer cost (GBP)"
                value={manualDraft.manufacturerCost}
                onChange={(v) => setManualDraft((d) => ({ ...d, manufacturerCost: v }))}
              />
              <MoneyInput
                label="Mfg shipping (GBP)"
                value={manualDraft.manufacturerShipping}
                onChange={(v) => setManualDraft((d) => ({ ...d, manufacturerShipping: v }))}
              />
            </div>
            <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200/90">
              Profit: {formatPricingMoney(manualProfitPreview, 'GBP')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/15 text-white" onClick={() => setManualOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={submitManual}>
              Add entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ManufacturerPlanMarginCard({
  planMargin,
  meta,
  previewQuote,
  onMarginChange,
}: {
  planMargin: ManufacturerPlanMargin;
  meta?: (typeof MANUFACTURER_PLANS)[number];
  previewQuote: number;
  onMarginChange: (percent: number) => void;
}) {
  const brandPrice = applyProductionMargin(previewQuote, planMargin.platformMarginPercent);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/25 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white">{planMargin.planName}</p>
        {meta ? (
          <span className="shrink-0 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium text-amber-200/80">
            {meta.commission}
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-1.5">
        <Label className="text-white/55">Platform margin (%)</Label>
        <Input
          type="number"
          step="0.1"
          min="0"
          value={planMargin.platformMarginPercent}
          onChange={(e) => onMarginChange(Number(e.target.value) || 0)}
          className="border-white/15 bg-white/5 text-white"
        />
      </div>

      <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs tabular-nums text-white">
        {formatPricingMoney(brandPrice, 'GBP')}
      </div>
    </div>
  );
}

function LedgerRow({ row }: { row: RevenueLedgerRow }) {
  const profit = ledgerProfit(row);
  return (
    <tr className="border-b border-white/[0.06] hover:bg-white/[0.02]">
      <td className="py-2.5 pr-3 text-xs text-white/50">{row.date}</td>
      <td className="py-2.5 pr-3">
        <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-white/55">
          {REVENUE_SOURCE_LABELS[row.source]}
        </span>
      </td>
      <td className="py-2.5 pr-3">
        <p className="text-white/85">{row.customerName}</p>
        <p className="text-[11px] text-white/40">{row.description}</p>
        {row.orderId ? (
          <Link
            to={`/superadmin/orders/${row.orderId}`}
            className="text-[10px] font-mono text-[#CC2D24] hover:underline"
          >
            {row.orderId}
          </Link>
        ) : null}
      </td>
      <td className="py-2.5 pr-3 tabular-nums text-white">
        {formatPricingMoney(row.revenueCents, row.currency)}
      </td>
      <td className="py-2.5 pr-3 tabular-nums text-white/55">
        {row.manufacturerCostCents > 0
          ? formatPricingMoney(row.manufacturerCostCents, row.currency)
          : '—'}
      </td>
      <td
        className={cn(
          'py-2.5 tabular-nums font-medium',
          profit >= 0 ? 'text-emerald-300/90' : 'text-red-300/90',
        )}
      >
        {formatPricingMoney(profit, row.currency)}
      </td>
    </tr>
  );
}
