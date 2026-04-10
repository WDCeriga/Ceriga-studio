import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ArrowUpRight, Download, Layers } from 'lucide-react';
import { Button } from '../components/ui/button';
import { MarketingShell } from '../components/marketing/MarketingShell';
import { MarketingFaq } from '../components/marketing/MarketingFaq';
import { HomeTechpackPreview } from '../components/marketing/HomeTechpackPreview';
import { products } from '../data/products';

const RED = '#CC2D24';

export function Home() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative overflow-hidden px-[max(1rem,env(safe-area-inset-left))] pb-12 pt-10 pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:pb-16 sm:pt-12 md:px-8 lg:px-10 lg:pb-20 lg:pt-16">
        <div
          className="pointer-events-none absolute -right-20 top-0 h-[min(70vw,420px)] w-[min(90vw,520px)] rounded-full opacity-90 sm:right-[5%]"
          style={{
            background: `radial-gradient(circle, ${RED}16 0%, transparent 68%)`,
          }}
        />

        <div className="relative mx-auto grid max-w-[1320px] grid-cols-1 items-start gap-6 min-[560px]:grid-cols-2 min-[560px]:items-center min-[560px]:gap-4 md:gap-8 lg:gap-12 xl:gap-16">
          <div className="order-1 min-w-0 max-w-xl min-[560px]:order-1">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#CC2D24] sm:mb-3 sm:text-[10px]">
              Precision built
            </p>
            <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-[clamp(1.35rem,4.2vw,3.75rem)] font-extrabold leading-[1.08] tracking-[-0.035em] text-[#F2F0EC] sm:leading-[1.05]">
              <span className="min-[560px]:hidden">
                Build your garment.
                <br />
                <span style={{ color: RED }}>Ship a factory-ready</span>
                <br />
                tech pack.
              </span>
              <span className="hidden min-[560px]:inline">
                Build your garment. <span style={{ color: RED }}>Ship a factory-ready</span> tech pack.
              </span>
            </h1>
            <p className="mt-3 max-w-[28rem] text-[13px] leading-relaxed text-white/50 sm:mt-4 sm:text-[clamp(0.8rem,1.6vw,1rem)]">
              Configure every detail visually, export professional PDFs (paid per download or via a subscription with
              included packs), and run packaging-only jobs when you do not need a full style spec.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                asChild
                className="h-11 min-h-[44px] w-full bg-[#CC2D24] text-xs font-semibold uppercase tracking-wider hover:bg-[#CC2D24]/90 sm:w-auto sm:px-8"
              >
                <Link to="/signup" className="inline-flex items-center justify-center gap-2">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 min-h-[44px] w-full border-white/18 bg-transparent text-xs font-semibold uppercase tracking-wider text-white/80 hover:bg-white/5 sm:w-auto sm:px-6"
              >
                <Link to="/how-it-works" className="inline-flex items-center justify-center gap-2">
                  How it works
                </Link>
              </Button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/[0.08] pt-6 sm:mt-8 sm:gap-6 sm:pt-8 lg:mt-10 lg:gap-8 lg:pt-10">
              {[
                ['500+', 'Tech packs exported'],
                ['48h', 'Avg. first review'],
                ['12+', 'Garment types'],
              ].map(([val, label]) => (
                <div key={val}>
                  <div className="text-[clamp(0.95rem,2.8vw,1.35rem)] font-bold tracking-tight text-[#F2F0EC] sm:text-[clamp(1.05rem,3vw,1.35rem)]">
                    {val}
                  </div>
                  <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-white/40 sm:mt-1 sm:text-[10px]">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="order-2 flex justify-center min-[560px]:order-2 min-[560px]:justify-end min-[560px]:pl-1">
            <HomeTechpackPreview compact />
          </div>
        </div>
      </section>

      {/* Links to deep pages */}
      <section className="border-y border-white/[0.06] bg-[#0a0a0b] px-[max(1rem,env(safe-area-inset-left))] py-12 pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:py-14 md:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
          {[
            {
              to: '/features',
              title: 'Features',
              body: 'Live preview, measurements, prints, packaging mode, and exports built for real factories.',
            },
            {
              to: '/how-it-works',
              title: 'How it works',
              body: 'Three workflows: full tech pack, packaging-only, or upload-and-order manufacturing.',
            },
            {
              to: '/pricing',
              title: 'Pricing',
              body: 'Pay per tech pack export, or subscribe for monthly download allowances on Studio, Scale, and Business.',
            },
            {
              to: '/#faq',
              title: 'FAQ',
              body: 'Quick answers on drafts, exports, packaging-only mode, and how billing works.',
            },
          ].map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="group rounded-[14px] border border-white/[0.08] bg-[#111113] p-5 transition-all hover:border-white/[0.14] sm:p-6"
            >
              <h2 className="flex items-center justify-between font-['Plus_Jakarta_Sans',sans-serif] text-base font-bold text-[#F2F0EC] sm:text-lg">
                {card.title}
                <ArrowUpRight className="h-4 w-4 text-white/35 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#CC2D24]" />
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/45">{card.body}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#CC2D24]">
                Read more
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <MarketingFaq
        id="faq"
        title="Questions, answered"
        items={[
          {
            q: 'How does the studio process work?',
            a: 'Pick a blueprint from the catalog (or open packaging-only from Studio), walk the guided steps — measurements, fabric, construction, prints, labels — then review and export or continue to delivery. You can revisit any completed step from the step strip while drafts autosave.',
          },
          {
            q: 'What is packaging-only mode?',
            a: 'A path that skips garment selection so you can design polybags and neck labels on their own canvases. Use it when branding ships before your apparel styles are locked.',
          },
          {
            q: 'How does pricing work?',
            a: 'Each tech pack PDF download is paid: either €29 per export without a plan, or included in a monthly allowance on Studio (10), Scale (30), or Business (100) — with lower overage rates on higher tiers. See the pricing page for the full comparison.',
          },
          {
            q: 'Will my drafts be saved?',
            a: 'Yes. Work is saved as you go in the builder so you can close the tab and return from Dashboard or Drafts without losing progress.',
          },
          {
            q: 'What do manufacturers get?',
            a: 'A structured PDF-style handoff with visuals, measurement tables, material notes, and print zones laid out the way factories expect — so quoting and sampling need fewer back-and-forth threads.',
          },
        ]}
        className="border-t border-white/[0.06] bg-[#0a0a0b]"
      />

      {/* Popular products — compact on small screens */}
      <section className="px-[max(0.75rem,env(safe-area-inset-left))] py-5 pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-6 sm:py-12 md:py-16 md:px-8 lg:px-10">
        <div className="mx-auto w-full max-w-[1320px]">
          <div className="mb-4 flex flex-col justify-between gap-2 sm:mb-10 sm:flex-row sm:items-end sm:gap-3">
            <div>
              <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#CC2D24] sm:mb-2 sm:text-[10px]">
                Catalog
              </p>
              <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-[clamp(0.95rem,4.2vw,1.65rem)] font-bold tracking-tight text-[#F2F0EC] sm:text-[clamp(1.35rem,3vw,1.85rem)]">
                Popular garment blueprints
              </h2>
            </div>
            <Button
              asChild
              variant="outline"
              className="h-8 w-full shrink-0 border-white/15 text-xs text-white/80 hover:bg-white/5 sm:h-9 sm:w-auto sm:text-sm"
            >
              <Link to="/signup" className="inline-flex items-center gap-1">
                Open studio
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="mx-auto grid w-full max-w-full grid-cols-1 gap-2.5 min-[440px]:grid-cols-2 min-[440px]:gap-3 xl:grid-cols-4">
            {products.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Sample CTA — bottom border matches bg to avoid a hairline gap above the footer on iOS */}
      <section
        className="border-b border-[#CC2D24] px-[max(1rem,env(safe-area-inset-left))] py-12 pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:py-16 md:px-8 lg:py-20"
        style={{ background: RED }}
      >
        <div className="mx-auto max-w-[640px] px-2 text-center">
          <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.22em] text-white/75">Proof over promises</p>
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-[clamp(1.65rem,4vw,2.25rem)] font-extrabold leading-tight tracking-[-0.03em] text-white">
            See the output quality
          </h2>
          <p className="mx-auto mt-4 max-w-[460px] text-sm leading-relaxed text-white/80">
            Download a sample tech pack to review layout, callouts, and measurement tables — the same structure your
            manufacturers receive.
          </p>
          <Button
            asChild
            className="mt-8 h-11 bg-white text-xs font-semibold uppercase tracking-wider text-[#CC2D24] hover:bg-white/95"
          >
            <a href="#" className="inline-flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download sample
            </a>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}

function ProductCard({ product }: { product: (typeof products)[number] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`overflow-hidden rounded-[10px] border bg-[#111113] transition-all duration-200 sm:rounded-[14px] ${
        hovered ? 'border-white/[0.14] shadow-[0_12px_36px_rgba(0,0,0,0.4)]' : 'border-white/[0.08]'
      }`}
      style={{ transform: hovered ? 'translateY(-2px)' : 'translateY(0)' }}
    >
      <div className="relative aspect-[5/4] w-full max-h-[min(38vw,160px)] overflow-hidden bg-[#0a0a0b] sm:aspect-square sm:max-h-[min(56vw,280px)] md:max-h-none">
        <img
          src={product.image}
          alt={product.name}
          className={`h-full w-full object-cover object-center transition-transform duration-500 ${hovered ? 'scale-105' : 'scale-100'}`}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#111113]/70" />
        <div className="absolute bottom-1 left-1 rounded border border-white/[0.08] bg-black/55 px-1 py-0.5 text-[6px] font-bold uppercase tracking-wider text-white/75 backdrop-blur-sm sm:bottom-2.5 sm:left-2.5 sm:px-2 sm:py-0.5 sm:text-[8px]">
          {product.garmentType}
        </div>
      </div>
      <div className="p-2 sm:p-4">
        <h3 className="text-[11px] font-semibold leading-snug tracking-tight text-[#F2F0EC] sm:text-sm">{product.name}</h3>
        <div className="mt-1.5 flex gap-1.5 rounded border border-white/[0.06] bg-[#0d0d0f] p-1.5 sm:mt-3 sm:gap-2 sm:p-2">
          <Layers className="mt-0.5 h-3 w-3 shrink-0 text-white/35 sm:h-3.5 sm:w-3.5" />
          <p className="text-[7px] leading-snug text-white/38 sm:text-[9px] sm:leading-relaxed">
            Guided builder for measurements, materials, and construction.
          </p>
        </div>
        <Link
          to={`/signup`}
          className={`mt-1.5 flex items-center justify-center gap-0.5 rounded py-1 text-[8px] font-semibold uppercase tracking-wider transition-colors sm:mt-3 sm:gap-1 sm:rounded-lg sm:py-2 sm:text-[10px] ${
            hovered ? 'bg-[#CC2D24] text-white' : 'border border-white/10 text-white/45'
          }`}
        >
          Configure in studio
          <ArrowUpRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
        </Link>
      </div>
    </div>
  );
}
