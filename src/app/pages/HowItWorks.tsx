import { Link } from 'react-router';
import { ArrowRight, Box, FileStack, Truck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { MarketingShell, MarketingPageHeader } from '../components/marketing/MarketingShell';
import { MarketingFaq } from '../components/marketing/MarketingFaq';

const flows = [
  {
    icon: FileStack,
    name: 'Full tech pack',
    steps: [
      'Pick a garment blueprint from the catalog.',
      'Walk through measurements, fabric, construction, and graphics.',
      'Download or hand off a PDF spec your factory can price and sample from.',
    ],
    cta: { to: '/signup', label: 'Start a tech pack' },
  },
  {
    icon: Box,
    name: 'Packaging only',
    steps: [
      'Open Studio → Design packaging — no garment selection.',
      'Place logos, copy, and artwork on polybag and label canvases.',
      'Continue to delivery when you are ready to fulfil.',
    ],
    cta: { to: '/signup', label: 'Try packaging mode' },
  },
  {
    icon: Truck,
    name: 'Manufacturing upload',
    steps: [
      'Bring your own tech pack files and production notes.',
      'Add quantities, timelines, and delivery preferences.',
      'Track the order through the same Orders hub as full-studio jobs.',
    ],
    cta: { to: '/signup', label: 'Upload & order' },
  },
];

export function HowItWorks() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        eyebrow="Process"
        title="Three paths, one studio"
        subtitle="Whether you are speccing a new style, refreshing packaging, or sending an existing pack to production, the steps stay short and visible."
      />

      <section className="px-[max(1rem,env(safe-area-inset-left))] py-12 pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:py-16 md:px-8 lg:px-10">
        <div className="relative mx-auto max-w-[720px]">
          <div className="absolute bottom-8 left-[19px] top-8 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent sm:left-[23px]" aria-hidden />

          <div className="space-y-14 sm:space-y-16">
            {flows.map((flow, flowIndex) => {
              const Icon = flow.icon;
              const stepNum = String(flowIndex + 1).padStart(2, '0');
              return (
                <div key={flow.name} className="relative flex gap-5 sm:gap-8">
                  <div className="relative z-[1] flex shrink-0 flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/12 bg-[#111113] text-[#CC2D24] shadow-[0_0_0_4px_#0A0A0B] sm:h-12 sm:w-12">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <span className="mt-2 font-mono text-[10px] font-bold text-white/25">{stepNum}</span>
                  </div>

                  <div className="min-w-0 flex-1 rounded-[14px] border border-white/[0.08] bg-[#111113] p-5 sm:p-7">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">Flow</span>
                    <h2 className="mt-1 font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[#F2F0EC] sm:text-xl">
                      {flow.name}
                    </h2>
                    <ol className="mt-6 space-y-4">
                      {flow.steps.map((step, j) => (
                        <li key={step} className="flex gap-3 text-sm leading-relaxed text-white/55">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#CC2D24]/12 text-[11px] font-bold text-[#CC2D24]">
                            {j + 1}
                          </span>
                          <span className="pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                    <Button
                      asChild
                      className="mt-6 h-9 bg-[#CC2D24] text-[10px] font-semibold uppercase tracking-wider hover:bg-[#CC2D24]/90"
                    >
                      <Link to={flow.cta.to} className="inline-flex items-center gap-2">
                        {flow.cta.label}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] bg-[#0a0a0b] px-[max(1rem,env(safe-area-inset-left))] py-12 pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 md:px-8 lg:px-10">
        <div className="mx-auto max-w-[560px] text-center">
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[#F2F0EC]">
            Inside the builder
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/45">
            Steps mirror how product teams think: base silhouette first, then materials, then construction details, then
            artwork and packaging. You can jump ahead where it makes sense; drafts remember your last position.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="outline" className="h-9 border-white/15 text-white/85 hover:bg-white/5">
              <Link to="/features">All capabilities</Link>
            </Button>
            <Button asChild className="h-9 bg-[#CC2D24] text-[10px] font-semibold uppercase tracking-wider hover:bg-[#CC2D24]/90">
              <Link to="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFaq
        eyebrow="Process FAQ"
        title="Common questions"
        items={[
          {
            q: 'Do I have to finish every step in order?',
            a: 'The builder suggests a logical order, but you can jump to steps you have already unlocked. Packaging-only skips garment steps entirely.',
          },
          {
            q: 'Where does my file go after I export?',
            a: 'You download a tech pack PDF from the final review step. The same project stays in Drafts if you want to tweak and export again.',
          },
          {
            q: 'Can I use Ceriga only for bags and labels?',
            a: 'Yes. From Studio, choose the packaging workflow so you never pick a garment template — you go straight to label and polybag canvases.',
          },
        ]}
        className="border-t border-white/[0.06] bg-[#0F0F0F]"
      />
    </MarketingShell>
  );
}
