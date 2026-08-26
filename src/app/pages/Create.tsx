import { Link } from 'react-router';
import { ArrowRight, ChevronRight, FileText, Package, Upload } from 'lucide-react';
import { SpecGridTexture } from '../components/studio/GarmentFlatIcon';

/**
 * Create hub — three user jobs:
 * 1. Design a tech pack (PDF for own factories, or continue to order with Ceriga)
 * 2. Upload an existing pack for a Ceriga quote
 * 3. Packaging only (same designer as in the tech-pack flow; save & reuse)
 */
export function Create() {
  return (
    <div className="ceriga-page mx-auto max-w-[1240px] px-4 py-7 sm:px-8 sm:py-8 lg:px-10">
      <div className="mb-8">
        <div className="ceriga-page-eyebrow">New project</div>
        <h1 className="ceriga-page-title">Create</h1>
        <p className="ceriga-page-sub max-w-2xl">
          Build a tech pack to send out yourself, order production with Ceriga, upload a pack for a
          quote, or design packaging you can reuse.
        </p>
      </div>

      {/* Primary: design tech pack */}
      <Link
        to="/catalog"
        className="group relative mb-4 flex w-full overflow-hidden rounded-[6px] border border-[#CC2D24]/35 bg-[#111113] text-left transition-colors hover:border-[#CC2D24]/60"
      >
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <SpecGridTexture patternId="create-hero-grid" />
        </div>
        <div className="relative flex min-h-[180px] w-full flex-col justify-between gap-6 p-5 sm:flex-row sm:items-end sm:p-7">
          <div className="max-w-xl">
            <span className="ceriga-mono text-[10px] uppercase tracking-[0.1em] text-[#E5534A]">
              Most common
            </span>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#F0EEEE] sm:text-2xl">
              Design a tech pack
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[#8A8A90]">
              Choose a garment template, then build measurements, materials, construction, prints,
              labels, and packaging. When you’re done you can{' '}
              <span className="text-[#A3A3A8]">export a PDF</span> for factories you already work
              with, or <span className="text-[#A3A3A8]">order production with Ceriga</span>.
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-[#F0EEEE]">
              Choose a template
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
          <div className="flex h-[104px] w-[120px] shrink-0 flex-col items-center justify-center gap-2 self-end rounded-[6px] border border-[#2E2E32] bg-[#09090B]/85 text-[#6B6B72] sm:self-auto">
            <FileText className="h-8 w-8 text-[#E5534A]" strokeWidth={1.4} />
            <span className="ceriga-mono text-[9px] uppercase tracking-[0.08em]">PDF or order</span>
          </div>
        </div>
      </Link>

      {/* Secondary intents */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Link
          to="/create/manufacturer"
          className="group flex flex-col rounded-[6px] border border-[#252528] bg-[#161618] p-5 transition-colors hover:border-[#333338] sm:flex-row sm:items-start sm:gap-4"
        >
          <div className="mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border border-[#2E2E32] bg-[#111113] text-[#E5534A] sm:mb-0">
            <Upload className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold tracking-tight text-[#F0EEEE]">
              Upload a tech pack for a Ceriga quote
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[#6B6B72]">
              Already have a PDF, sheets, or images? Send them to us — we’ll review and quote
              samples or production. No need to rebuild the pack in the builder.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#A3A3A8] group-hover:text-[#F0EEEE]">
              Upload for quote
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </Link>

        <Link
          to="/packaging"
          className="group flex flex-col rounded-[6px] border border-[#252528] bg-[#161618] p-5 transition-colors hover:border-[#333338] sm:flex-row sm:items-start sm:gap-4"
        >
          <div className="mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border border-[#2E2E32] bg-[#111113] text-[#E5534A] sm:mb-0">
            <Package className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold tracking-tight text-[#F0EEEE]">
              Packaging only
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[#6B6B72]">
              Design polybags, labels, and packaging artwork with the same tools used inside a tech
              pack. Save and reuse later in a garment project, or order packaging on its own.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#A3A3A8] group-hover:text-[#F0EEEE]">
              Design packaging
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </Link>
      </div>

      <div className="ceriga-card mt-8 flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="m-0 text-xs leading-relaxed text-[#8A8A90] sm:max-w-lg sm:text-[13px]">
          Packaging designed here matches the packaging step in a full tech pack — one designer,
          reusable across projects.
        </p>
        <Link
          to="/projects"
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-[4px] border border-[#3A3A40] px-4 text-[12px] font-medium text-[#F0EEEE] transition-colors hover:border-[#4A4A52] hover:bg-white/[0.03]"
        >
          View projects
        </Link>
      </div>
    </div>
  );
}
