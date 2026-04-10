import { Link } from 'react-router';
import { FileStack, FileInput, Package, Factory, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';

const workflows = [
  {
    title: 'Tech pack (spec only)',
    description:
      'Upload artwork first, then fill measurements and construction — no on-shirt colour or placement editor. For factories that only need a spec.',
    to: '/catalog?flow=techpack-spec',
    icon: FileInput,
    accent: '#A855F7',
  },
  {
    title: 'Design tech pack',
    description:
      'Full builder: measurements, fabric & colour, prints on garment, labels, and export.',
    to: '/catalog',
    icon: FileStack,
    accent: '#3B82F6',
  },
  {
    title: 'Design packaging',
    description:
      'Polybags, labels, and artwork on a focused canvas — then straight to delivery. No garment selection.',
    to: '/packaging',
    icon: Package,
    accent: '#06B6D4',
  },
  {
    title: 'Order from manufacturers',
    description:
      'Upload your existing tech pack, add quantity and dates, and continue to delivery.',
    to: '/studio/manufacturer',
    icon: Factory,
    accent: '#F59E0B',
  },
];

export function Studio() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#0F0F0F]">
      <div className="border-b border-white/10 px-[max(1rem,env(safe-area-inset-left))] pb-3 pt-4 pr-[max(1rem,env(safe-area-inset-right))] sm:px-5 md:px-7">
        <div className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">
          Workflows
        </div>
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-[clamp(1.35rem,5vw,1.65rem)] font-extrabold uppercase leading-tight tracking-[-0.03em] text-white">
          Studio
        </h1>
        <p className="mt-2 max-w-lg text-xs leading-relaxed text-white/50 sm:text-sm">
          Start a tech pack, packaging-only job, or a manufacturing order — all from one place.
        </p>
      </div>

      <div className="p-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:p-5 md:px-7 md:py-6">
        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {workflows.map(({ title, description, to, icon: Icon, accent }) => (
            <Link
              key={title}
              to={to}
              className="group flex flex-col overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#111113] transition-all duration-200 hover:border-white/[0.14] hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
            >
              <div
                className="relative flex min-h-[140px] flex-1 flex-col p-5 sm:p-6"
                style={{
                  background: `linear-gradient(145deg, ${accent}12 0%, transparent 55%), #111113`,
                }}
              >
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/35 text-[#CC2D24] transition-colors group-hover:border-[#CC2D24]/30"
                  style={{ color: accent }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="mb-2 text-base font-semibold tracking-tight text-[#F2F0EC] sm:text-[17px]">
                  {title}
                </h2>
                <p className="mb-5 flex-1 text-xs leading-relaxed text-white/45 sm:text-[13px]">
                  {description}
                </p>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#CC2D24]">
                  Open
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-[14px] border border-white/[0.08] bg-[#111113]/80 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs text-white/45 sm:max-w-md sm:text-sm">
            New to Ceriga? Browse the catalog for garment templates, or jump into packaging if you only need bags and labels.
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-3 h-9 border-white/15 text-white/85 hover:bg-white/5 sm:mt-0 sm:shrink-0"
          >
            <Link to="/catalog">Browse catalog</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
