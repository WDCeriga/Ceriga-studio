import { Link } from 'react-router';
import { Check, Layers, Ruler, Palette, Printer, Package, Save, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { MarketingShell, MarketingPageHeader } from '../components/marketing/MarketingShell';
import imgHoodie from 'figma:asset/e0dc3efd38af4977ac2c46a590f5ec2a037cce25.png';
import imgBlueTshirt from 'figma:asset/f00825900c95df312eb3b002c75207b61c243d55.png';

const spotlight = [
  {
    icon: Layers,
    title: 'Live flat-lay preview',
    body: 'Silhouette updates as you choose fabrics, trims, and construction — no guesswork before sign-off.',
  },
  {
    icon: Ruler,
    title: 'Graded measurement tables',
    body: 'Industry-norm curves you can edit, tolerance-aware, with reset when you need a clean slate.',
  },
  {
    icon: Sparkles,
    title: 'Auto-generated callouts',
    body: 'Annotations follow your choices so PDFs read like they came from a senior product developer.',
  },
];

const moreFeatures = [
  {
    icon: Printer,
    title: 'Print placement zones',
    body: 'Position artwork, dimensions, and methods so printers know exactly what to run.',
  },
  {
    icon: Palette,
    title: 'Fabric & trim logic',
    body: 'Colour families, GSM, and trims stay tied to the spec for bulk production.',
  },
  {
    icon: Package,
    title: 'Packaging mode',
    body: 'Polybags and labels without the full garment path when branding ships first.',
  },
  {
    icon: Save,
    title: 'Drafts & autosave',
    body: 'Pick up from dashboard or drafts exactly where you left off.',
  },
];

export function Features() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        eyebrow="Platform"
        title="Everything in one spec"
        subtitle="Ceriga is built for people who need manufacturers to say yes — clear visuals, structured data, and exports that match how factories work."
      />

      <section className="px-[max(1rem,env(safe-area-inset-left))] py-10 pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:py-14 md:px-8 lg:px-10">
        <div className="mx-auto grid min-w-0 max-w-[1100px] grid-cols-1 items-center gap-5 min-[560px]:grid-cols-2 min-[560px]:gap-4 md:gap-8 lg:gap-12">
          <div className="relative mx-auto min-w-0 w-full max-w-[280px] overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#0a0a0b] min-[560px]:mx-0 min-[560px]:max-w-none">
            <div className="relative aspect-[3/4] max-h-[220px] w-full sm:max-h-[240px] md:max-h-[300px] lg:aspect-[4/5] lg:max-h-[380px] xl:max-h-[460px]">
              <img
                src={imgHoodie}
                alt="Garment specification preview in Ceriga Studio"
                className="h-full w-full object-cover object-[center_18%]"
                width={640}
                height={720}
                loading="lazy"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-t from-[#0a0a0b] via-transparent to-transparent" />
            <p className="absolute bottom-2 left-2 right-2 text-[8px] font-semibold uppercase tracking-wider text-white/40 sm:bottom-3 sm:left-3 sm:text-[9px] md:text-[10px]">
              Visual builder · Flat-lay sync
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#CC2D24]">Core workflow</p>
            <h2 className="mt-1.5 font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-[#F2F0EC] sm:text-xl md:text-2xl">
              Spec once. Hand off with confidence.
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-white/45 sm:mt-3 sm:text-sm">
              The builder mirrors how product teams think: silhouette and measurements first, then materials, details,
              graphics, and packaging — all tied to the same export.
            </p>
            <ul className="mt-5 space-y-3 sm:mt-6 sm:space-y-4 md:mt-8 md:space-y-5">
              {spotlight.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3 sm:gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-[#CC2D24] sm:h-9 sm:w-9 sm:rounded-xl md:h-10 md:w-10">
                    <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px] md:h-5 md:w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#F2F0EC] sm:text-[15px]">{title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/42 sm:mt-1 sm:text-sm">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] bg-[#0a0a0b] px-[max(1rem,env(safe-area-inset-left))] py-12 pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:py-16 md:px-8 lg:px-10">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#CC2D24]">Also included</p>
          <h2 className="mt-2 font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[#F2F0EC] sm:text-xl">
            The rest of the platform
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {moreFeatures.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="rounded-[14px] border border-white/[0.08] bg-[#111113] p-5 sm:p-6"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-[#CC2D24]">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-[#F2F0EC]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/42">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-[max(1rem,env(safe-area-inset-left))] py-12 pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:py-16 md:px-8 lg:px-10">
        <div className="mx-auto grid min-w-0 max-w-[1100px] grid-cols-1 items-center gap-5 min-[560px]:grid-cols-2 min-[560px]:gap-4 md:gap-10 lg:gap-14">
          <div className="order-2 min-w-0 min-[560px]:order-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#CC2D24]">Quality bar</p>
            <h2 className="mt-1.5 font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold tracking-tight text-[#F2F0EC] sm:text-xl md:text-2xl">
              Output your partners can quote from
            </h2>
            <ul className="mt-5 max-w-md space-y-2 text-xs text-white/50 sm:mt-6 sm:space-y-2.5 sm:text-sm md:mt-8 md:space-y-3">
              {[
                'Flattened visuals with consistent scale and labelling',
                'Bill-of-materials style clarity for fabrics and trims',
                'Packaging artwork isolated when you do not need a full style',
              ].map((line) => (
                <li key={line} className="flex gap-2 sm:gap-3">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#CC2D24] sm:h-4 sm:w-4" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:gap-3 md:mt-10 md:gap-4">
              <Button asChild className="h-9 bg-[#CC2D24] px-5 text-xs font-semibold hover:bg-[#CC2D24]/90 sm:h-10 sm:px-6">
                <Link to="/signup">Create account</Link>
              </Button>
              <Button asChild variant="outline" className="h-9 border-white/15 text-white/85 hover:bg-white/5 sm:h-10">
                <Link to="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
          <div className="order-1 mx-auto min-w-0 w-full max-w-[280px] overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#111113] min-[560px]:order-2 min-[560px]:mx-0 min-[560px]:max-w-none">
            <div className="relative aspect-[4/5] max-h-[220px] w-full sm:max-h-[240px] md:max-h-[300px] lg:max-h-[400px] xl:max-h-[460px]">
              <img
                src={imgBlueTshirt}
                alt="Technical garment flat sketch in studio"
                className="h-full w-full object-cover object-center"
                width={640}
                height={560}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
