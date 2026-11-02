import './superadmin-pricing.css';
import { formatAccountTotal,displayMoney,useCurrency } from '../../lib/accountCurrency';
import { QuoteCalculatorSection } from "../../components/superadmin/QuoteCalculator";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
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
  getDefaultPricingConfig,
  getPricingConfig,
  getRevenueSummary,
  inputToCents,
  ledgerProfit,
  normalizePricingConfig,
  REVENUE_SOURCE_LABELS,
  upsertPricingConfig,
  type ManufacturerPlanMargin,
  type PlatformPricingConfig,
  type RevenueLedgerRow,
  type RevenueSource,
} from '../../data/superadminPricingMock';
import { MANUFACTURER_PLANS } from '../../data/crmAccessMock';
import { getPlatformSetting, setPlatformSetting } from '../../lib/superadminDb';
import { useSuperadminData } from '../../hooks/useSuperadminData';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageLoadingFallback } from '../../components/PageLoadingFallback';
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
  const currencyState=useCurrency();
  const [draft,setDraft]=useState<string|null>(null);
  return (
    <div className="space-y-1.5">
      <Label className="text-white/55">{label}</Label>
      <Input
        type="text" inputMode="decimal" aria-label={label}
        value={draft??value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {const v=e.target.value.replace(',','.');if(!/^\d*(\.\d{0,2})?$/.test(v))return;const normalized=v===''||v==='.'?'0':v.endsWith('.')?v.slice(0,-1):v.startsWith('.')?'0'+v:v;if(inputToCents(normalized)==null)return;setDraft(v);onChange(normalized);}}
        onBlur={()=>setDraft(null)}
        className="border-white/15 bg-white/5 text-white tabular-nums"
      />
    </div>
  );
}

export function SuperAdminPricing() {
  const currencyState=useCurrency();
  const { orders, error:ordersError, loading: ordersLoading } = useSuperadminData();
  const [config, setConfig] = useState<PlatformPricingConfig>(() => getDefaultPricingConfig());
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
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
  const [publishConfirm, setPublishConfirm] = useState<{
    planId: string;
    planName: string;
    next: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab,setTab]=useState('rules'),[saveError,setSaveError]=useState(''),[savedConfig,setSavedConfig]=useState(''),[ledgerPage,setLedgerPage]=useState(1);const saveLock=useRef(false),manualLock=useRef(false);
  const dirty=savedConfig!==JSON.stringify(config);


  useEffect(() => {
    let cancelled = false;
    setConfigLoading(true);
    setConfigError(null);
    void (async () => {
      try {
        const remote = await getPlatformSetting<PlatformPricingConfig>('pricing');
        if (cancelled) return;
        if (remote) {
          upsertPricingConfig(remote);
          const loaded=getPricingConfig();setConfig(loaded);setSavedConfig(JSON.stringify(loaded));
        } else {
          const defaults=getDefaultPricingConfig();setConfig(defaults);setSavedConfig('');
        }
      } catch (err) {
        if (!cancelled) setConfigError((err as { message?: string })?.message || 'Failed to load pricing');
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const ledger = useMemo(
    () => buildRevenueLedger(orders),
    [orders, ledgerVersion],
  );
  const summary = useMemo(() => getRevenueSummary(ledger), [ledger,currencyState.currency,currencyState.rates]);
  const pendingReviews = countPendingReviews(orders);

  const filteredLedger = useMemo(() => {
    if (sourceFilter === 'all') return ledger;
    return ledger.filter((r) => r.source === sourceFilter);
  }, [ledger, sourceFilter]);

  const ledgerPages=Math.max(1,Math.ceil(filteredLedger.length/20)),currentLedgerPage=Math.min(ledgerPage,ledgerPages),visibleLedger=filteredLedger.slice((currentLedgerPage-1)*20,currentLedgerPage*20);
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

  const saveConfig = async () => {
    if (saveLock.current || configError) return;
    setSaveError('');
    const money=[config.techPack.pdfCents,config.techPack.bundleCents,...config.chatPlans.map(p=>p.monthlyCents)];
    if(money.some(n=>!Number.isSafeInteger(n)||n<0)||config.chatPlans.some(p=>!Number.isSafeInteger(p.messageLimit)||p.messageLimit<0)||!Number.isFinite(config.production.estimatedDutiesPercent)||config.production.estimatedDutiesPercent<0||config.production.planMargins.some(p=>!Number.isFinite(p.platformMarginPercent)||p.platformMarginPercent<0)){setSaveError('Enter non-negative prices and whole-number message limits. Markup and estimated tax must be non-negative percentages.');return;}
    if(!config.production.planMargins.every(p=>{try{return Number.isSafeInteger(applyProductionMargin(100000,p.platformMarginPercent));}catch{return false;}})){setSaveError('Enter a supported markup percentage.');return;}
    saveLock.current=true;
    setSaving(true);
    try {
      const normalized = normalizePricingConfig(structuredClone(config));
      await setPlatformSetting('pricing', normalized);
      upsertPricingConfig(normalized);
      setConfig(normalized);setSavedConfig(JSON.stringify(normalized));
      toast.success('Pricing rules saved');
    } catch (err) {
      const message=(err as { message?: string })?.message || 'Save failed';setSaveError(message);toast.error(message);
    } finally {
      saveLock.current=false;setSaving(false);
    }
  };

  const manualProfitPreview = useMemo(() => {
    const rev = inputToCents(manualDraft.revenue) ?? 0;
    const cost = inputToCents(manualDraft.manufacturerCost) ?? 0;
    const ship = inputToCents(manualDraft.manufacturerShipping) ?? 0;
    return rev - cost - ship;
  }, [manualDraft]);

  if (ordersLoading || configLoading) {
    return <div className="admin-pricing"><h1>Pricing</h1><p role="status" className="pricing-loading">Loading saved pricing rules…</p></div>;
  }

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
    if(manualLock.current)return;
    if (!manualDraft.customerName.trim() || !manualDraft.description.trim()) {
      toast.error('Customer and description are required');
      return;
    }
    const revenueCents = inputToCents(manualDraft.revenue);
    if (revenueCents == null) {
      toast.error('Enter a valid customer paid amount');
      return;
    }
    const cost=inputToCents(manualDraft.manufacturerCost),shipping=inputToCents(manualDraft.manufacturerShipping),quantity=Number(manualDraft.quantity);
    if(revenueCents<0||cost==null||cost<0||shipping==null||shipping<0||!Number.isSafeInteger(quantity)||quantity<=0||!/^\d{4}-\d{2}-\d{2}$/.test(manualDraft.date)||!Number.isFinite(Date.parse(manualDraft.date+'T12:00:00Z'))||new Date(manualDraft.date+'T12:00:00Z').toISOString().slice(0,10)!==manualDraft.date){toast.error('Enter a valid date, positive whole quantity, and non-negative monetary amounts.');return;}
    manualLock.current=true;
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
    toast.message('Temporary entry added for this session. It is not saved to the database.');
  };

  return (
    <div className="admin-pricing space-y-8">
      {configError && (
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          Could not load saved pricing: {configError}
          <button type="button" className="ml-3 underline" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry</button>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <DollarSign className="h-5 w-5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">CERIGA / PRICING</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Pricing
          </h1>
          <p className="pricing-intro">Clear rules. Transparent estimates. Confident pricing decisions.</p>
        </div>
        <Button
          className="bg-[#CC2D24] hover:bg-[#CC2D24]/90"
          disabled={saving || Boolean(configError)||!dirty}
          onClick={() => void saveConfig()}
        >{saving?'Saving…':dirty?'Save pricing rules':'Rules saved'}
        </Button>
      </div>

      <nav className="pricing-tabs" aria-label="Pricing views">{[{id:'rules',label:'Pricing rules'},{id:'calculator',label:'Quote calculator'},{id:'estimates',label:'Order estimates'}].map(t=><button type="button" key={t.id} aria-pressed={tab===t.id} onClick={()=>setTab(t.id)}>{t.label}{t.id==='rules'&&dirty&&<span>Unsaved</span>}</button>)}</nav>
      {ordersError&&<p role="alert" className="pricing-error">Could not load order estimates: {ordersError}</p>}
      {saveError&&<p role="alert" className="pricing-error">{saveError}</p>}
      {tab==='estimates'&&<><p className="pricing-guidance">These are indicative order values and estimated differences, including unpaid quotations. They are not verified received revenue. <Link to="/superadmin/statistics">View verified payment revenue in Statistics.</Link></p>
      {/* Snapshot */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Tech pack order value',
            value: formatAccountTotal(summary.techPackRevenueEur),
            icon: FileText,
          },
          {
            label: 'Production order value',
            value: formatAccountTotal(summary.productionRevenueGbp),
            icon: Shirt,
          },
          {
            label: 'Estimated production difference',
            value: formatAccountTotal(summary.productionMarginGbp),
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
            <div className="rounded-2xl border border-[#252528] bg-[#111113] p-4 transition hover:border-white/[0.12]">
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

      </>}
      {tab==='calculator'&&<QuoteCalculatorSection />}
      {tab==='rules'&&<fieldset className="pricing-rule-fields" disabled={saving||!!configError}><p className="pricing-guidance">{dirty?'Changes are not saved yet.':'Saved rules are loaded.'} Tech pack and assistant prices are entered in EUR. Markup examples use an original GBP manufacturer price. Changing your display currency does not rewrite these rules.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
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

        <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Estimated duties / tax (%)</h2>
          <div className="mt-4">
            <Input
              aria-label="Estimated duties and tax percentage"
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
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-white">Production order markup by plan</h2>
          <Link
            to="/superadmin/manufacturers"
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
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
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
              <tr className="border-b border-[#252528] text-[11px] uppercase tracking-wider text-white/45">
                <th className="py-2 pr-4 font-medium">Plan</th>
                <th className="py-2 pr-4 font-medium">Monthly (EUR)</th>
                <th className="py-2 pr-4 font-medium">Messages / mo</th>
                <th className="py-2 pr-4 font-medium">Public</th>
              </tr>
            </thead>
            <tbody>
              {config.chatPlans.map((plan) => (
                <tr key={plan.id} className="border-b border-[#252528]">
                  <td className="py-3 pr-4">
                    <span className="font-medium text-white">{plan.tier}</span>
                    {plan.featured ? (
                      <span className="ml-2 rounded-full bg-[#CC2D24]/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#CC2D24]">
                        Featured
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">
                    <MoneyInput label={plan.tier+' monthly price (EUR)'} value={centsToInput(plan.monthlyCents)} onChange={v=>{const c=inputToCents(v);if(c!=null)updateChatPlan(plan.id,{monthlyCents:c});}}/>
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
                      onCheckedChange={(v) =>
                        setPublishConfirm({
                          planId: plan.id,
                          planName: plan.tier,
                          next: v,
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      </fieldset>}
      {tab==='estimates'&&<>
      {/* Revenue ledger */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Order estimates & session notes</h2>
          </div>
          <Button
            size="sm"
            className="bg-white/10 text-white hover:bg-white/15"
            onClick={() => {manualLock.current=false;setManualOpen(true);}}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add temporary entry
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(['all', 'techpack', 'custom_clothing', 'chat_subscription', 'manual'] as const).map(
            (key) => (
              <button
                key={key}
                type="button"
                aria-pressed={sourceFilter===key} onClick={() => {setSourceFilter(key);setLedgerPage(1);}}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition',
                  sourceFilter === key
                    ? 'border-[#CC2D24]/50 bg-[#CC2D24]/15 text-white'
                    : 'border-[#252528] bg-black/20 text-white/40 hover:border-white/20',
                )}
              >
                {key === 'all' ? 'All' : REVENUE_SOURCE_LABELS[key]}
              </button>
            ),
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#252528] bg-black/25 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-white/35">Estimated order value ({currencyState.currency})</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">
              {formatAccountTotal(summary.totalRevenueGbp)}
            </p>
          </div>
          <div className="rounded-xl border border-[#252528] bg-black/25 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-white/35">Estimated difference ({currencyState.currency})</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-300">
              {formatAccountTotal(summary.totalProfitGbp)}
            </p>
          </div>
          <div className="rounded-xl border border-[#252528] bg-black/25 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-white/35">Ledger rows</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">{summary.rowCount}</p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#252528] text-[11px] uppercase tracking-wider text-white/45">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 pr-3 font-medium">Order value</th>
                <th className="py-2 pr-3 font-medium">Mfg cost</th>
                <th className="py-2 font-medium">Est. difference</th>
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
                visibleLedger.map((row) => (
                  <LedgerRow key={row.id} row={row} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <nav className="pricing-pagination" aria-label="Order estimate pages"><span>{filteredLedger.length?(currentLedgerPage-1)*20+1:0}–{Math.min(currentLedgerPage*20,filteredLedger.length)} of {filteredLedger.length}</span><div><button type="button" disabled={currentLedgerPage<=1} onClick={()=>setLedgerPage(currentLedgerPage-1)}>Previous</button><span>{currentLedgerPage} / {ledgerPages}</span><button type="button" disabled={currentLedgerPage>=ledgerPages} onClick={()=>setLedgerPage(currentLedgerPage+1)}>Next</button></div></nav></>}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="pricing-manual-dialog border-[#252528] bg-[#111113] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Temporary estimate (GBP)</DialogTitle>
          </DialogHeader>
          <p className="pricing-guidance">For this browser session only. This is not a saved financial record or payment confirmation.</p>
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
              label="Estimated order value (GBP)"
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
              Profit: {displayMoney(manualProfitPreview,'GBP')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/15 text-white" onClick={() => setManualOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={submitManual}>
              Add session estimate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog className="pricing-confirmation"
        open={publishConfirm != null}
        onOpenChange={(open) => {
          if (!open) setPublishConfirm(null);
        }}
        title={
          publishConfirm?.next
            ? `Publish ${publishConfirm.planName}?`
            : `Unpublish ${publishConfirm?.planName ?? 'plan'}?`
        }
        description={
          publishConfirm?.next
            ? 'This plan will appear on the public pricing page after you save pricing rules.'
            : 'This plan will be hidden after you save pricing rules. Existing subscribers are unaffected.'
        }
        confirmLabel={publishConfirm?.next ? 'Publish' : 'Unpublish'}
        tone={publishConfirm?.next ? 'default' : 'danger'}
        onConfirm={() => {
          if (!publishConfirm) return;
          updateChatPlan(publishConfirm.planId, { published: publishConfirm.next });
        }}
      />
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
  const currencyState=useCurrency();
  let brandPrice:number|undefined;try{const amount=applyProductionMargin(previewQuote,planMargin.platformMarginPercent);if(Number.isSafeInteger(amount)&&amount>=0)brandPrice=amount;}catch{/* Keep invalid drafts editable without crashing the page. */}

  return (
    <div className="rounded-xl border border-[#252528] bg-black/25 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white">{planMargin.planName}</p>
        {meta ? (
          <span className="shrink-0 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium text-amber-200/80">
            {meta.commission}
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-1.5">
        <Label className="text-white/55">Markup on manufacturer price (%)</Label>
        <Input
          type="number"
          step="0.1"
          min="0" aria-label={planMargin.planName+' markup percentage'}
          value={planMargin.platformMarginPercent}
          onChange={(e) => onMarginChange(Number(e.target.value) || 0)}
          className="border-white/15 bg-white/5 text-white"
        />
      </div>

      <div className="mt-4 rounded-lg border border-[#252528] bg-white/[0.02] px-3 py-2.5 text-xs tabular-nums text-white">
        <p className="pricing-example-label">Example: original manufacturer price {displayMoney(previewQuote,'GBP')}</p>{brandPrice===undefined?'Enter a supported markup percentage':displayMoney(brandPrice,'GBP')}
      </div>
    </div>
  );
}

function LedgerRow({ row }: { row: RevenueLedgerRow }) {
  const currencyState=useCurrency();
  const profit = ledgerProfit(row);
  return (
    <tr className="border-b border-[#252528] hover:bg-white/[0.02]">
      <td className="py-2.5 pr-3 text-xs text-white/50">{row.date}</td>
      <td className="py-2.5 pr-3">
        <span className="rounded-md border border-[#252528] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-white/55">
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
        {displayMoney(row.revenueCents,row.currency)}
      </td>
      <td className="py-2.5 pr-3 tabular-nums text-white/55">
        {row.manufacturerCostCents > 0
          ? displayMoney(row.manufacturerCostCents,row.currency)
          : '—'}
      </td>
      <td
        className={cn(
          'py-2.5 tabular-nums font-medium',
          profit >= 0 ? 'text-emerald-300/90' : 'text-red-300/90',
        )}
      >
        {displayMoney(profit,row.currency)}
      </td>
    </tr>
  );
}
