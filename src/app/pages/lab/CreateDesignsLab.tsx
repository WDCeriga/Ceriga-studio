import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  ChevronRight,
  FileText,
  Package,
  Upload,
} from 'lucide-react';
import { cn } from '../../components/ui/utils';

type DesignId = 'shipped' | 'intent' | 'paths' | 'wizard';

const DESIGNS: { id: DesignId; title: string; blurb: string }[] = [
  {
    id: 'shipped',
    title: '0. Shipped Create (3 intents)',
    blurb: 'Live on /create — hero tech pack + upload quote + packaging only.',
  },
  {
    id: 'intent',
    title: '1. Intent list (alt)',
    blurb: 'Same three jobs as a stacked question list.',
  },
  {
    id: 'paths',
    title: '2. Path crumbs (alt)',
    blurb: 'Same three jobs with step trails.',
  },
  {
    id: 'wizard',
    title: '3. Wizard (alt)',
    blurb: 'Category first — tech pack then PDF vs Ceriga order.',
  },
];

function Frame({ children, label }: { children: ReactNode; label: string }) {
  useCerigaTranslation();

  return (
    <div className="overflow-hidden rounded-[8px] border border-[#252528] bg-[#09090B]">
      <div className="flex items-center justify-between border-b border-[#252528] bg-[#111113] px-3 py-2">
        <span className="ceriga-mono text-[10px] uppercase tracking-[0.1em] text-[#6B6B72]">{cerigaTranslate("interface.text_d51722434ea5fb8e")}{" "}{cerigaTranslateLabel(label)}
        </span>
      </div>
      <div className="p-5 sm:p-8">{children}</div>
    </div>
  );
}

function MockHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="mb-7">
      <div className="ceriga-page-eyebrow">{cerigaTranslateLabel(eyebrow)}</div>
      <h2 className="ceriga-page-title">{title}</h2>
      <p className="ceriga-page-sub">{sub}</p>
    </div>
  );
}

/** Matches live /create */
function DesignShipped() {
  useCerigaTranslation();

  return (
    <Frame label={cerigaTranslate("adminOrders.shipped")}>
      <MockHeader
        eyebrow="New project"
        title={cerigaTranslate("nav.create")}
        sub="Build a tech pack to send out yourself, order production with Ceriga, upload a pack for a quote, or design packaging you can reuse."
      />
      <div className="mb-3 rounded-[6px] border border-[#CC2D24]/35 bg-[#111113] p-5">
        <span className="ceriga-mono text-[10px] uppercase text-[#E5534A]">{cerigaTranslate("interface.text_1e300bd62321d3ec")}</span>
        <h3 className="mt-2 text-lg font-semibold text-[#F0EEEE]">{cerigaTranslate("interface.text_ceea8b889f27db50")}</h3>
        <p className="mt-2 text-[12px] leading-relaxed text-[#8A8A90]">{cerigaTranslate("interface.text_f09cdcd8b9ae678a")}</p>
        <span className="mt-3 inline-flex items-center gap-2 text-[12px] text-[#F0EEEE]">{cerigaTranslate("interface.text_329a8ef36e3686e2")}{" "}<ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-[6px] border border-[#252528] bg-[#161618] p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded border border-[#2E2E32] text-[#E5534A]">
            <Upload className="h-3.5 w-3.5" />
          </div>
          <p className="text-[13px] font-semibold text-[#F0EEEE]">{cerigaTranslate("interface.text_a446e4ff6e1f3203")}</p>
          <p className="mt-1 text-[11px] text-[#6B6B72]">{cerigaTranslate("interface.text_b4b5013dd1df18a2")}</p>
        </div>
        <div className="rounded-[6px] border border-[#252528] bg-[#161618] p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded border border-[#2E2E32] text-[#E5534A]">
            <Package className="h-3.5 w-3.5" />
          </div>
          <p className="text-[13px] font-semibold text-[#F0EEEE]">{cerigaTranslate("marketing.packaging")}</p>
          <p className="mt-1 text-[11px] text-[#6B6B72]">{cerigaTranslate("interface.text_3c50430bdb953bf5")}</p>
        </div>
      </div>
    </Frame>
  );
}

function DesignIntent() {
  useCerigaTranslation();

  const intents = [
    {
      q: 'Design a tech pack',
      outcome: 'PDF for your factories, or order production with Ceriga',
      primary: true,
    },
    {
      q: 'Upload a pack for a Ceriga quote',
      outcome: 'You already have files — we price samples or bulk',
      primary: false,
    },
    {
      q: 'Packaging only',
      outcome: 'Bags & labels — same designer, save & reuse in tech packs',
      primary: false,
    },
  ];
  return (
    <Frame label={cerigaTranslate("interface.text_79393dec5782af8b")}>
      <MockHeader
        eyebrow="New project"
        title={cerigaTranslate("interface.text_18b0a637ec343825")}
        sub="Three jobs — pick an outcome."
      />
      <div className="mx-auto max-w-xl space-y-2">
        {intents.map((item) => (
          <div
            key={item.q}
            className={cn(
              'flex w-full items-center gap-4 rounded-[6px] border px-4 py-3.5',
              item.primary
                ? 'border-[#CC2D24]/45 bg-[#1C0F0F]'
                : 'border-[#252528] bg-[#161618]',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[#F0EEEE]">{cerigaTranslateLabel(item.q)}</p>
              <p className="mt-0.5 text-[12px] text-[#6B6B72]">{item.outcome}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#6B6B72]" />
          </div>
        ))}
      </div>
    </Frame>
  );
}

function DesignPaths() {
  useCerigaTranslation();

  const paths = [
    {
      title: 'Design a tech pack',
      steps: ['Template', 'Builder', 'PDF or Ceriga order'],
      accent: true,
    },
    {
      title: 'Upload for quote',
      steps: ['Upload', 'Review', 'Quote'],
      accent: false,
    },
    {
      title: 'Packaging only',
      steps: ['Canvas', 'Save / reuse', 'Order optional'],
      accent: false,
    },
  ];
  return (
    <Frame label={cerigaTranslate("interface.text_9ac46f5741aa405a")}>
      <MockHeader eyebrow="New project" title={cerigaTranslate("interface.text_89db5f9f4a3ce6af")} sub="Where each option leads." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {paths.map((p) => (
          <div
            key={p.title}
            className={cn(
              'rounded-[6px] border p-4',
              p.accent
                ? 'border-[#CC2D24]/40 bg-[#1C0F0F]/80'
                : 'border-[#252528] bg-[#161618]',
            )}
          >
            <p className="text-[14px] font-semibold text-[#F0EEEE]">{cerigaTranslateLabel(p.title)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1">
              {p.steps.map((step, i) => (
                <span key={step} className="flex items-center gap-1">
                  {i > 0 ? <ChevronRight className="h-3 w-3 text-[#45454B]" /> : null}
                  <span className="ceriga-mono rounded-[3px] border border-[#2E2E32] bg-[#09090B] px-1.5 py-0.5 text-[8px] uppercase text-[#A3A3A8]">
                    {cerigaTranslateLabel(step)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function DesignWizard() {
  useCerigaTranslation();

  const [step, setStep] = useState<1 | 2>(1);

  return (
    <Frame label={cerigaTranslate("interface.text_8816c52bc5877a2b")}>
      <div className="mb-6 flex items-center gap-2">
        <span className={cn('ceriga-mono text-[10px] uppercase', step === 1 ? 'text-[#E5534A]' : 'text-[#6B6B72]')}>{cerigaTranslate("interface.text_73faa14ebab6adb5")}</span>
        <span className="text-[#333338]">/</span>
        <span className={cn('ceriga-mono text-[10px] uppercase', step === 2 ? 'text-[#E5534A]' : 'text-[#6B6B72]')}>{cerigaTranslate("interface.text_2aa48b28840983fd")}</span>
      </div>
      {step === 1 ? (
        <>
          <MockHeader
            eyebrow="New project"
            title={cerigaTranslate("interface.text_d06df7c13088e226")}
            sub="Tech pack opens a second choice for PDF vs Ceriga order."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-[6px] border border-[#CC2D24]/40 bg-[#1C0F0F] px-4 py-5 text-left"
            >
              <FileText className="mb-2 h-4 w-4 text-[#E5534A]" />
              <p className="text-[14px] font-semibold text-[#F0EEEE]">{cerigaTranslate("adminOrders.techpack")}</p>
              <p className="mt-1 text-[11px] text-[#6B6B72]">{cerigaTranslate("interface.text_4336d40e1b5d73df")}</p>
            </button>
            <div className="rounded-[6px] border border-[#252528] bg-[#161618] px-4 py-5">
              <Upload className="mb-2 h-4 w-4 text-[#E5534A]" />
              <p className="text-[14px] font-semibold text-[#F0EEEE]">{cerigaTranslate("interface.text_421367806c9ebad4")}</p>
              <p className="mt-1 text-[11px] text-[#6B6B72]">{cerigaTranslate("interface.text_21db8dd107f388cf")}</p>
            </div>
            <div className="rounded-[6px] border border-[#252528] bg-[#161618] px-4 py-5">
              <Package className="mb-2 h-4 w-4 text-[#E5534A]" />
              <p className="text-[14px] font-semibold text-[#F0EEEE]">{cerigaTranslate("marketing.packaging")}</p>
              <p className="mt-1 text-[11px] text-[#6B6B72]">{cerigaTranslate("interface.text_4731527d3aca6d7f")}</p>
            </div>
          </div>
        </>
      ) : (
        <>
          <button type="button" onClick={() => setStep(1)} className="mb-4 text-[12px] text-[#8A8A90]">{cerigaTranslate("interface.text_aceb696a04c19971")}</button>
          <MockHeader
            eyebrow="Tech pack"
            title={cerigaTranslate("interface.text_198635aa997c7f69")}
            sub="Same builder either way — choose at the end or decide now."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[6px] border border-[#CC2D24]/40 bg-[#1C0F0F] p-5">
              <p className="text-[14px] font-semibold text-[#F0EEEE]">{cerigaTranslate("interface.text_7aad9d490352b6a7")}</p>
              <p className="mt-1 text-[12px] text-[#6B6B72]">{cerigaTranslate("interface.text_e6f20e480468e522")}</p>
            </div>
            <div className="rounded-[6px] border border-[#252528] bg-[#161618] p-5">
              <p className="text-[14px] font-semibold text-[#F0EEEE]">{cerigaTranslate("interface.text_4447a75ea4e64106")}</p>
              <p className="mt-1 text-[12px] text-[#6B6B72]">{cerigaTranslate("interface.text_16aacd479416b3c1")}</p>
            </div>
          </div>
        </>
      )}
    </Frame>
  );
}

export function CreateDesignsLab() {
  useCerigaTranslation();

  const [focus, setFocus] = useState<DesignId | 'all'>('shipped');

  const show = (id: DesignId) => focus === 'all' || focus === id;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <header className="border-b border-white/10 bg-[#111113]/90 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">{cerigaTranslate("interface.text_5d85e486cfe510a2")}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{cerigaTranslate("interface.text_3c16034b76ce45a9")}</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/55">{cerigaTranslate("interface.text_2b05ea38ff26a142")}{' '}
              <Link to="/create" className="text-white/80 underline-offset-2 hover:underline">{cerigaTranslate("interface.text_4d3cf50007aa8290")}</Link>
            </p>
          </div>
          <Link
            to="/lab"
            className="text-sm text-white/50 underline-offset-4 hover:text-white hover:underline"
          >{cerigaTranslate("interface.text_9e87d9dadae79eb5")}</Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFocus('all')}
            className={cn(
              'rounded-md border px-3 py-1.5 text-[11px]',
              focus === 'all'
                ? 'border-sky-500/40 bg-sky-500/15 text-sky-100'
                : 'border-white/10 text-white/55 hover:bg-white/[0.04]',
            )}
          >{cerigaTranslate("interface.text_2150d8df37e48957")}</button>
          {DESIGNS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setFocus(d.id)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-[11px]',
                focus === d.id
                  ? 'border-sky-500/40 bg-sky-500/15 text-sky-100'
                  : 'border-white/10 text-white/55 hover:bg-white/[0.04]',
              )}
            >
              {cerigaTranslateLabel(d.title)}
            </button>
          ))}
        </div>

        <div className="space-y-10">
          {show('shipped') ? (
            <section>
              <DesignMeta {...DESIGNS[0]!} />
              <DesignShipped />
            </section>
          ) : null}
          {show('intent') ? (
            <section>
              <DesignMeta {...DESIGNS[1]!} />
              <DesignIntent />
            </section>
          ) : null}
          {show('paths') ? (
            <section>
              <DesignMeta {...DESIGNS[2]!} />
              <DesignPaths />
            </section>
          ) : null}
          {show('wizard') ? (
            <section>
              <DesignMeta {...DESIGNS[3]!} />
              <DesignWizard />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DesignMeta({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mt-0.5 text-[12px] text-white/45">{blurb}</p>
    </div>
  );
}
