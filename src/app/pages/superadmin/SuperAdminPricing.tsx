import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
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
  useCerigaTranslation();

  const currencyState=useCurrency();
  const [draft,setDraft]=useState<string|null>(null);
  return (
    <div className="space-y-1.5">
      <Label className="text-white/55">{cerigaTranslateLabel(label)}</Label>
      <Input
        type="text" inputMode="decimal" aria-label={cerigaTranslateLabel(label)}
        value={draft??value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {const v=e.target.value.replace(',','.');if(!/^\d*(\.\d{0,2})?$/.test(v))return;const normalized=v===''||v==='.'?'0':v.endsWith('.')?v.slice(0,-1):v.startsWith('.')?'0'+v:v;if(inputToCents(normalized)==null)return;setDraft(v);onChange(normalized);}}
        onBlur={()=>setDraft(null)}
        className="border-white/15 bg-white/5 text-white tabular-nums"
      />
    </div>
  );
}

export function SuperAdminPricing() {
  useCerigaTranslation();

  const currencyState=useCurrency();
  const { orders, error:ordersError, loading: ordersLoading } = useSuperadminData({scope:'orders'});
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
      toast.success(cerigaTranslate("interface.text_fc2347b4a6f58708"));
    } catch (err) {
      const message=(err as { message?: string })?.message || 'Save failed';setSaveError(message);toast.error(cerigaTranslateLabel(message));
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
    return <div className="admin-pricing"><h1>{cerigaTranslate("nav.pricing")}</h1><p role="status" className="pricing-loading">{cerigaTranslate("interface.text_b696b67d7835aadf")}</p></div>;
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
      toast.error(cerigaTranslate("interface.text_c2f8e8af6f33853d"));
      return;
    }
    const revenueCents = inputToCents(manualDraft.revenue);
    if (revenueCents == null) {
      toast.error(cerigaTranslate("interface.text_963ca42421056db4"));
      return;
    }
    const cost=inputToCents(manualDraft.manufacturerCost),shipping=inputToCents(manualDraft.manufacturerShipping),quantity=Number(manualDraft.quantity);
    if(revenueCents<0||cost==null||cost<0||shipping==null||shipping<0||!Number.isSafeInteger(quantity)||quantity<=0||!/^\d{4}-\d{2}-\d{2}$/.test(manualDraft.date)||!Number.isFinite(Date.parse(manualDraft.date+'T12:00:00Z'))||new Date(manualDraft.date+'T12:00:00Z').toISOString().slice(0,10)!==manualDraft.date){toast.error(cerigaTranslate("interface.text_32515ba8eaa06827"));return;}
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
    toast.message(cerigaTranslate("interface.text_bb411df56a96a276"));
  };

  return (
    <div className="admin-pricing space-y-8">
      {configError && (
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{cerigaTranslate("interface.text_986dcff29fbc0326")}{" "}{cerigaTranslateLabel(configError)}
          <button type="button" className="ml-3 underline" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>{cerigaTranslate("interface.text_942087cc2d41e013")}</button>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <DollarSign className="h-5 w-5" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">{cerigaTranslate("interface.text_c44db865cfc2bd19")}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{cerigaTranslate("nav.pricing")}</h1>
          <p className="pricing-intro">{cerigaTranslate("interface.text_086a9d14ced7ece0")}</p>
        </div>
        <Button
          className="bg-[#CC2D24] hover:bg-[#CC2D24]/90"
          disabled={saving || Boolean(configError)||!dirty}
          onClick={() => void saveConfig()}
        >{saving?cerigaTranslate("common.saving"):dirty?cerigaTranslate("interface.text_fbe3f05a984f3b53"):cerigaTranslate("interface.text_83a5ef6bf6b1f4cb")}
        </Button>
      </div>

      <nav className="pricing-tabs" aria-label={cerigaTranslate("interface.text_ad102b7a8acee3c2")}>{[{id:'rules',label:'Pricing rules'},{id:'calculator',label:'Quote calculator'},{id:'estimates',label:'Order estimates'}].map(t=><button type="button" key={t.id} aria-pressed={tab===t.id} onClick={()=>setTab(t.id)}>{cerigaTranslateLabel(t.label)}{t.id==='rules'&&dirty&&<span>{cerigaTranslate("interface.text_6250d5725dda6d9f")}</span>}</button>)}</nav>
      {ordersError&&<p role="alert" className="pricing-error">{cerigaTranslate("interface.text_53343a7beeee8eb8")}{" "}{cerigaTranslateLabel(ordersError)}</p>}
      {saveError&&<p role="alert" className="pricing-error">{cerigaTranslateLabel(saveError)}</p>}
      {tab==='estimates'&&<><p className="pricing-guidance">{cerigaTranslate("interface.text_38f4b92dfc2f7ef5")}{" "}<Link to="/superadmin/statistics">{cerigaTranslate("interface.text_7602bc1e6cc97cdc")}</Link></p>
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
            link: pendingReviews > 0 ? cerigaTranslate("interface.text_5776596040b675be") : undefined,
          },
        ].map((card) => {
          const Icon = card.icon;
          const inner = (
            <div className="rounded-2xl border border-[#252528] bg-[#111113] p-4 transition hover:border-white/[0.12]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    {cerigaTranslateLabel(card.label)}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-white">{card.value}</p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-white/45">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              {card.link ? (
                <p className="mt-3 flex items-center gap-1 text-[11px] font-medium text-[#CC2D24]">{cerigaTranslate("interface.text_1ea5d41a07cd7c96")}<ArrowRight className="h-3 w-3" />
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
      {tab==='rules'&&<fieldset className="pricing-rule-fields" disabled={saving||!!configError}><p className="pricing-guidance">{dirty?cerigaTranslate("interface.text_db8c2a3bb16a4ea0"):cerigaTranslate("interface.text_d5a4f0e12488ed1d")}{" "}{cerigaTranslate("interface.text_7249abf80d78865f")}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_e57695c5dc4a7bba")}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <MoneyInput
              label={cerigaTranslate("interface.text_4e5e5c853607a4bc")}
              value={centsToInput(config.techPack.pdfCents)}
              onChange={(v) => {
                const c = inputToCents(v);
                if (c != null) updateTechPack({ pdfCents: c });
              }}
            />
            <MoneyInput
              label={cerigaTranslate("interface.text_300479b47e25da65")}
              value={centsToInput(config.techPack.bundleCents)}
              onChange={(v) => {
                const c = inputToCents(v);
                if (c != null) updateTechPack({ bundleCents: c });
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[#252528] bg-[#111113] p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_b4422af514ed60fb")}</h2>
          <div className="mt-4">
            <Input
              aria-label={cerigaTranslate("interface.text_b03224b1356e4abb")}
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
          <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_72048e5fa7b59a2e")}</h2>
          <Link
            to="/superadmin/manufacturers"
            className="text-[11px] font-medium text-[#CC2D24] hover:underline"
          >{cerigaTranslate("interface.text_a8d2a15dea605eca")}</Link>
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
          <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_a618c9153a49d6fd")}</h2>
          <Link
            to="/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-[#CC2D24] hover:underline"
          >{cerigaTranslate("interface.text_128b5e974cd504e6")}</Link>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#252528] text-[11px] uppercase tracking-wider text-white/45">
                <th className="py-2 pr-4 font-medium">{cerigaTranslate("interface.text_fa8ed0bdabdd6bcb")}</th>
                <th className="py-2 pr-4 font-medium">{cerigaTranslate("interface.text_7c9b97e20a2f79ec")}</th>
                <th className="py-2 pr-4 font-medium">{cerigaTranslate("interface.text_01d6841b263e67ab")}</th>
                <th className="py-2 pr-4 font-medium">{cerigaTranslate("interface.text_591935b15b1c88e2")}</th>
              </tr>
            </thead>
            <tbody>
              {config.chatPlans.map((plan) => (
                <tr key={plan.id} className="border-b border-[#252528]">
                  <td className="py-3 pr-4">
                    <span className="font-medium text-white">{plan.tier}</span>
                    {plan.featured ? (
                      <span className="ml-2 rounded-full bg-[#CC2D24]/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#CC2D24]">{cerigaTranslate("interface.text_c533cafab69e4033")}</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">
                    <MoneyInput label={cerigaTranslate("interface.text_62d823dadb63aaac",{value0:(plan.tier)})} value={centsToInput(plan.monthlyCents)} onChange={v=>{const c=inputToCents(v);if(c!=null)updateChatPlan(plan.id,{monthlyCents:c});}}/>
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
            <h2 className="text-sm font-semibold text-white">{cerigaTranslate("interface.text_3e52c68193225c08")}</h2>
          </div>
          <Button
            size="sm"
            className="bg-white/10 text-white hover:bg-white/15"
            onClick={() => {manualLock.current=false;setManualOpen(true);}}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />{cerigaTranslate("interface.text_6204d7bb9ab28be0")}</Button>
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
                {key === 'all' ? cerigaTranslate("interface.text_a52ace420f2175d0") : REVENUE_SOURCE_LABELS[key]}
              </button>
            ),
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#252528] bg-black/25 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_2a7ea2be0841058e")}{currencyState.currency})</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">
              {formatAccountTotal(summary.totalRevenueGbp)}
            </p>
          </div>
          <div className="rounded-xl border border-[#252528] bg-black/25 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_1996676c9e0ecde8")}{currencyState.currency})</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-300">
              {formatAccountTotal(summary.totalProfitGbp)}
            </p>
          </div>
          <div className="rounded-xl border border-[#252528] bg-black/25 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-white/35">{cerigaTranslate("interface.text_95483027201a0a04")}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">{summary.rowCount}</p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#252528] text-[11px] uppercase tracking-wider text-white/45">
                <th className="py-2 pr-3 font-medium">{cerigaTranslate("interface.text_99c40ab405926cb5")}</th>
                <th className="py-2 pr-3 font-medium">{cerigaTranslate("interface.text_0e570ca6fabe24f9")}</th>
                <th className="py-2 pr-3 font-medium">{cerigaTranslate("adminOrders.customer")}</th>
                <th className="py-2 pr-3 font-medium">{cerigaTranslate("interface.text_fa10dc21c428b480")}</th>
                <th className="py-2 pr-3 font-medium">{cerigaTranslate("interface.text_173a265765581ed9")}</th>
                <th className="py-2 font-medium">{cerigaTranslate("interface.text_912bb9c1abd733dc")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-white/40">{cerigaTranslate("interface.text_2ef7d15bf46809e1")}</td>
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

      <nav className="pricing-pagination" aria-label={cerigaTranslate("interface.text_24866ea25b750160")}><span>{filteredLedger.length?(currentLedgerPage-1)*20+1:0}–{Math.min(currentLedgerPage*20,filteredLedger.length)}{" "}{cerigaTranslate("interface.text_28391d3bc64ec15c")}{" "}{filteredLedger.length}</span><div><button type="button" disabled={currentLedgerPage<=1} onClick={()=>setLedgerPage(currentLedgerPage-1)}>{cerigaTranslate("common.previous")}</button><span>{currentLedgerPage} / {ledgerPages}</span><button type="button" disabled={currentLedgerPage>=ledgerPages} onClick={()=>setLedgerPage(currentLedgerPage+1)}>{cerigaTranslate("common.next")}</button></div></nav></>}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="pricing-manual-dialog border-[#252528] bg-[#111113] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">{cerigaTranslate("interface.text_262e438eb122ac4d")}</DialogTitle>
          </DialogHeader>
          <p className="pricing-guidance">{cerigaTranslate("interface.text_17fddc0904760726")}</p>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-white/55">{cerigaTranslate("interface.text_99c40ab405926cb5")}</Label>
                <Input
                  type="date"
                  value={manualDraft.date}
                  onChange={(e) => setManualDraft((d) => ({ ...d, date: e.target.value }))}
                  className="border-white/15 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/55">{cerigaTranslate("orders.quantity")}</Label>
                <Input
                  value={manualDraft.quantity}
                  onChange={(e) => setManualDraft((d) => ({ ...d, quantity: e.target.value }))}
                  className="border-white/15 bg-white/5 text-white"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/55">{cerigaTranslate("adminOrders.customer")}</Label>
              <Input
                value={manualDraft.customerName}
                onChange={(e) => setManualDraft((d) => ({ ...d, customerName: e.target.value }))}
                className="border-white/15 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/55">{cerigaTranslate("interface.text_526e0087cc3f254d")}</Label>
              <Input
                value={manualDraft.description}
                onChange={(e) => setManualDraft((d) => ({ ...d, description: e.target.value }))}
                className="border-white/15 bg-white/5 text-white"
              />
            </div>
            <MoneyInput
              label={cerigaTranslate("interface.text_54ec65d6c9c55663")}
              value={manualDraft.revenue}
              onChange={(v) => setManualDraft((d) => ({ ...d, revenue: v }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyInput
                label={cerigaTranslate("interface.text_71498d2197733d57")}
                value={manualDraft.manufacturerCost}
                onChange={(v) => setManualDraft((d) => ({ ...d, manufacturerCost: v }))}
              />
              <MoneyInput
                label={cerigaTranslate("interface.text_841bcbcd5fe1e494")}
                value={manualDraft.manufacturerShipping}
                onChange={(v) => setManualDraft((d) => ({ ...d, manufacturerShipping: v }))}
              />
            </div>
            <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200/90">{cerigaTranslate("interface.text_ade047b888602898")}{" "}{displayMoney(manualProfitPreview,'GBP')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/15 text-white" onClick={() => setManualOpen(false)}>{cerigaTranslate("common.cancel")}</Button>
            <Button className="bg-[#CC2D24] hover:bg-[#CC2D24]/90" onClick={submitManual}>{cerigaTranslate("interface.text_253909a13b858306")}</Button>
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
            ? cerigaTranslate("interface.text_269af754050597f4",{value0:(publishConfirm.planName)})
            : cerigaTranslate("interface.text_ec98518ac534008e",{value0:(publishConfirm?.planName ?? cerigaTranslate("interface.text_64879f7d6b960a01"))})
        }
        description={
          publishConfirm?.next
            ? cerigaTranslate("interface.text_9ceb4955afcc6c7f")
            : cerigaTranslate("interface.text_3aea08ff2179d255")
        }
        confirmLabel={publishConfirm?.next ? cerigaTranslate("interface.text_859390eb495b2ead") : cerigaTranslate("interface.text_2db04a54fa743150")}
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
  useCerigaTranslation();

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
        <Label className="text-white/55">{cerigaTranslate("interface.text_b0b9125cb6883e25")}</Label>
        <Input
          type="number"
          step="0.1"
          min="0" aria-label={cerigaTranslate("interface.text_de8b8f958fd6a5c0",{value0:(planMargin.planName)})}
          value={planMargin.platformMarginPercent}
          onChange={(e) => onMarginChange(Number(e.target.value) || 0)}
          className="border-white/15 bg-white/5 text-white"
        />
      </div>

      <div className="mt-4 rounded-lg border border-[#252528] bg-white/[0.02] px-3 py-2.5 text-xs tabular-nums text-white">
        <p className="pricing-example-label">{cerigaTranslate("interface.text_4d597e4b06f49d06")}{" "}{displayMoney(previewQuote,'GBP')}</p>{brandPrice===undefined?cerigaTranslate("interface.text_f45ad8bf8cc6c0e1"):displayMoney(brandPrice,'GBP')}
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
          {cerigaTranslateLabel(REVENUE_SOURCE_LABELS[row.source])}
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
