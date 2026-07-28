import { Link } from 'react-router';
import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { FileStack, FileInput, Package, Factory, ArrowRight } from 'lucide-react';
import { DEFAULT_TECHPACK_SPEC_PRODUCT_ID } from '../data/products';
import { SpecGridTexture } from '../components/studio/GarmentFlatIcon';

const workflows: {
  title: string;
  description: string;
  to: string;
  state?: { builderFlow: string };
  icon: LucideIcon;
  tag: string;
}[] = [
  {
    title: 'Tech pack (spec only)',
    description:
      'Upload artwork first, then fill measurements and construction — no on-shirt colour or placement editor. For factories that only need a spec.',
    to: `/builder/${DEFAULT_TECHPACK_SPEC_PRODUCT_ID}?flow=techpack-spec`,
    state: { builderFlow: 'techpack-spec' },
    icon: FileInput,
    tag: 'Spec',
  },
  {
    title: 'Design tech pack',
    description:
      'Full builder: measurements, fabric & colour, prints on garment, labels, and export.',
    to: '/catalog',
    icon: FileStack,
    tag: 'Design',
  },
  {
    title: 'Design packaging',
    description:
      'Polybags, labels, and artwork on a focused canvas — then straight to delivery. No garment selection.',
    to: '/packaging',
    icon: Package,
    tag: 'Packaging',
  },
  {
    title: 'Order from manufacturers',
    description:
      'Upload your existing tech pack, add quantity and dates, and continue to delivery.',
    to: '/studio/manufacturer',
    icon: Factory,
    tag: 'Production',
  },
];

function WorkflowCard({
  title,
  description,
  to,
  state,
  icon: Icon,
  tag,
}: (typeof workflows)[number]) {
  const gridId = useId().replace(/:/g, '');

  return (
    <Link
      to={to}
      state={state}
      className="ceriga-card group flex flex-col overflow-hidden transition-colors hover:border-[#333338]"
    >
      <div className="relative h-[120px] border-b border-[#252528] bg-[#111113]">
        <SpecGridTexture patternId={`studio-grid-${gridId}`} />
        <div className="absolute left-2.5 right-2.5 top-2.5 z-10 flex items-center justify-between">
          <span className="ceriga-mono rounded-[3px] border border-[#5A4530] bg-[#2A2218] px-1.5 py-[3px] text-[10px] uppercase tracking-[0.06em] text-[#E8A868]">
            {tag}
          </span>
        </div>
        <div className="absolute inset-0 z-[1] flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-[6px] border border-[#3A3A40] bg-[#09090B]/80 text-[#E5534A] transition-colors group-hover:border-[#CC2D24]/50 group-hover:text-[#CC2D24]">
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <h2 className="mb-1.5 text-[15px] font-semibold tracking-tight text-[#F0EEEE]">{title}</h2>
        <p className="mb-4 flex-1 text-[12px] leading-relaxed text-[#6B6B72]">{description}</p>
        <span className="ceriga-btn-ghost">
          Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

export function Studio() {
  return (
    <div className="ceriga-page mx-auto max-w-[1240px] px-4 py-7 sm:px-8 sm:py-8 lg:px-10">
      <div className="mb-8">
        <div className="ceriga-page-eyebrow">Workflows</div>
        <h1 className="ceriga-page-title">Studio</h1>
        <p className="ceriga-page-sub">
          Start a tech pack, packaging-only job, or a manufacturing order — all from one place.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {workflows.map((workflow) => (
          <WorkflowCard key={workflow.title} {...workflow} />
        ))}
      </div>

      <div className="ceriga-card mt-8 flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="m-0 text-xs text-[#8A8A90] sm:max-w-md sm:text-[13px]">
          New to Ceriga? Browse the catalog for garment templates, or jump into packaging if you only
          need bags and labels.
        </p>
        <Link
          to="/catalog"
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-[4px] border border-[#3A3A40] px-4 text-[12px] font-medium text-[#F0EEEE] transition-colors hover:border-[#4A4A52] hover:bg-white/[0.03]"
        >
          Browse catalog
        </Link>
      </div>
    </div>
  );
}
