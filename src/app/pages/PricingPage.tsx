import { Link } from 'react-router';
import { Check } from 'lucide-react';
import { MarketingShell, MarketingPageHeader } from '../components/marketing/MarketingShell';
import { MarketingFaq } from '../components/marketing/MarketingFaq';

const RED = '#CC2D24';

const tiers = [
  {
    tier: 'Pay per export',
    price: '€29',
    priceSub: 'per tech pack',
    sub: 'No subscription — pay only when you download a finished PDF.',
    cta: 'Create account',
    ctaTo: '/signup',
    featured: false,
    features: [
      'Full builder & packaging mode',
      'Billed per tech pack at checkout',
      'Core garment templates',
      'Email support',
    ],
  },
  {
    tier: 'Studio',
    price: '€49',
    priceSub: '/month',
    sub: 'Small labels shipping a steady number of styles.',
    cta: 'Subscribe',
    ctaTo: '/signup',
    featured: false,
    features: [
      '10 tech pack downloads / month included',
      'Extra exports €19 each',
      'All templates & measurement sets',
      'Packaging-only designer',
    ],
  },
  {
    tier: 'Scale',
    price: '€99',
    priceSub: '/month',
    sub: 'Growing brands with seasonal drops and reorders.',
    cta: 'Subscribe',
    ctaTo: '/signup',
    featured: true,
    features: [
      '30 tech pack downloads / month included',
      'Extra exports €14 each',
      'Priority support',
      'Custom PDF branding',
      'Advanced measurement tooling',
    ],
  },
  {
    tier: 'Business',
    price: '€199',
    priceSub: '/month',
    sub: 'High volume, multiple lines, or agency throughput.',
    cta: 'Subscribe',
    ctaTo: '/signup',
    featured: false,
    features: [
      '100 tech pack downloads / month included',
      'Extra exports €9 each',
      'Shared workspace (coming soon)',
      'Quarterly usage reviews',
    ],
  },
];

type Cell = 'yes' | 'no' | 'partial';

const comparisonRows: {
  feature: string;
  note?: string;
  payPer: Cell | string;
  studio: Cell | string;
  scale: Cell | string;
  business: Cell | string;
}[] = [
  {
    feature: 'Monthly fee',
    payPer: '—',
    studio: '€49',
    scale: '€99',
    business: '€199',
  },
  {
    feature: 'Included downloads / month',
    payPer: '0 (pay each)',
    studio: '10',
    scale: '30',
    business: '100',
  },
  {
    feature: 'Price per extra export',
    payPer: '€29 each',
    studio: '€19',
    scale: '€14',
    business: '€9',
  },
  {
    feature: 'Garment templates',
    payPer: 'yes',
    studio: 'yes',
    scale: 'yes',
    business: 'yes',
  },
  { feature: 'Packaging-only designer', payPer: 'yes', studio: 'yes', scale: 'yes', business: 'yes' },
  { feature: 'Custom PDF branding', payPer: 'no', studio: 'no', scale: 'yes', business: 'yes' },
  { feature: 'Advanced measurements', payPer: 'yes', studio: 'yes', scale: 'yes', business: 'yes' },
  { feature: 'Priority support', payPer: 'no', studio: 'no', scale: 'yes', business: 'yes' },
  {
    feature: 'Enterprise (SSO, API, SLA)',
    payPer: 'no',
    studio: 'no',
    scale: 'no',
    business: 'partial',
    note: 'Contact sales for Enterprise contracts beyond Business.',
  },
];

function CompareCell({ value }: { value: Cell | string }) {
  if (typeof value === 'string')
    return <span className="text-[11px] font-medium tabular-nums text-white/65">{value}</span>;
  if (value === 'yes')
    return (
      <span className="inline-flex items-center justify-center text-[#CC2D24]" aria-label="Included">
        <Check className="h-4 w-4" />
      </span>
    );
  if (value === 'no') return <span className="text-white/22">—</span>;
  return <span className="text-[11px] font-medium text-amber-200/80">Add-on</span>;
}

export function PricingPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        eyebrow="Pricing"
        title="Pay per tech pack or subscribe"
        subtitle="Every PDF export uses one download credit. Buy a single pack when you need it, or choose a monthly plan with included downloads — unused allowances do not roll over unless noted on your invoice."
      />

      <section className="px-[max(1rem,env(safe-area-inset-left))] py-10 pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:py-14 md:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
          {tiers.map((t) => (
            <div
              key={t.tier}
              className={`relative flex flex-col rounded-[14px] border p-5 sm:p-6 ${
                t.featured ? 'border-[#CC2D24]/40 bg-[#141416]' : 'border-white/[0.08] bg-[#0e0e10]'
              }`}
            >
              {t.featured && (
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-white"
                  style={{ background: RED }}
                >
                  Best value
                </div>
              )}
              <div
                className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em]"
                style={{ color: t.featured ? RED : '#ffffff40' }}
              >
                {t.tier}
              </div>
              <div className="mb-1">
                <span className="text-2xl font-extrabold tracking-tight text-[#F2F0EC] sm:text-3xl">{t.price}</span>
                {t.priceSub && <span className="ml-1 text-xs text-white/45 sm:text-sm">{t.priceSub}</span>}
              </div>
              <p className="mb-5 min-h-[2.5rem] text-[11px] leading-relaxed text-white/40 sm:min-h-0 sm:text-xs">{t.sub}</p>

              {t.ctaTo ? (
                <Link
                  to={t.ctaTo}
                  className="mb-5 block rounded-lg py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide transition-opacity hover:opacity-90 sm:text-[11px]"
                  style={{
                    background: t.featured ? RED : '#ffffff0a',
                    color: t.featured ? '#fff' : '#ffffff70',
                    border: t.featured ? 'none' : '1px solid #ffffff10',
                  }}
                >
                  {t.cta}
                </Link>
              ) : null}

              <ul className="flex flex-col gap-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[11px] text-white/55 sm:text-xs">
                    <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${t.featured ? 'text-[#CC2D24]' : 'text-white/40'}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-[640px] text-center text-[11px] leading-relaxed text-white/40 sm:mt-10 sm:text-xs">
          Need SSO, regional data residency, or pooled credits across brands?{' '}
          <a href="mailto:hello@ceriga.studio" className="font-medium text-[#CC2D24] hover:text-[#CC2D24]/85">
            Contact sales
          </a>{' '}
          for Enterprise pricing.
        </p>
        <p className="mx-auto mt-4 max-w-[560px] text-center text-[10px] leading-relaxed text-white/30 sm:text-[11px]">
          Taxes may apply. Each successful tech pack PDF download consumes one credit on subscriptions, or is charged at the pay-per rate.
        </p>
      </section>

      <section className="border-t border-white/[0.06] bg-[#0a0a0b] px-[max(1rem,env(safe-area-inset-left))] py-10 pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:py-14 md:px-8 lg:px-10">
        <div className="mx-auto max-w-[960px]">
          <p className="mb-2 text-center text-[9px] font-bold uppercase tracking-[0.22em] text-[#CC2D24]">Compare</p>
          <h2 className="mb-6 text-center font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[#F2F0EC] sm:mb-8 sm:text-xl">
            Plan comparison
          </h2>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#111113] [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[600px] border-collapse text-left text-[11px] sm:text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-black/40">
                  <th className="px-3 py-2.5 font-semibold text-white/45 sm:px-4 sm:py-3">Capability</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-white/70 sm:px-3 sm:py-3">Pay per</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-white/70 sm:px-3 sm:py-3">Studio</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-[#CC2D24] sm:px-3 sm:py-3">Scale</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-white/70 sm:px-3 sm:py-3">Business</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {comparisonRows.map((row) => (
                  <tr key={row.feature} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 text-white/75 sm:px-4 sm:py-3">
                      {row.feature}
                      {row.note ? (
                        <span className="mt-0.5 block text-[9px] font-normal text-white/35 sm:text-[10px]">{row.note}</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 text-center text-white/60 sm:px-3 sm:py-3">
                      <CompareCell value={row.payPer} />
                    </td>
                    <td className="px-2 py-2.5 text-center text-white/60 sm:px-3 sm:py-3">
                      <CompareCell value={row.studio} />
                    </td>
                    <td className="px-2 py-2.5 text-center text-white/80 sm:px-3 sm:py-3">
                      <CompareCell value={row.scale} />
                    </td>
                    <td className="px-2 py-2.5 text-center text-white/80 sm:px-3 sm:py-3">
                      <CompareCell value={row.business} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <MarketingFaq
        eyebrow="Billing & plans"
        title="Pricing questions"
        items={[
          {
            q: 'Is there a free unlimited export tier?',
            a: 'No. Building and editing in the studio can be explored with an account, but each tech pack PDF download is paid — either at the per-export rate (€29) or against your subscription’s monthly download allowance.',
          },
          {
            q: 'What counts as one download?',
            a: 'Each time you generate and download a complete tech pack PDF for a project, that uses one credit on a plan, or is charged as a single pay-per export.',
          },
          {
            q: 'What happens if I exceed my monthly downloads?',
            a: 'On Studio, Scale, and Business plans, additional exports are billed at the overage rate shown for that tier. Pay-per users simply pay per file.',
          },
          {
            q: 'Can we switch plans?',
            a: 'Yes. You can move between pay-per and subscription tiers as your volume changes. Enterprise contracts are tailored separately.',
          },
        ]}
        className="border-t border-white/[0.06] bg-[#0a0a0b]"
      />
    </MarketingShell>
  );
}
