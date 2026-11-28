import type { ReactNode } from 'react';
import { ArrowRight, BookOpen, Blend, ChevronLeft, ChevronRight, CirclePlus, Crosshair, FileUp, FoldVertical, Package, Palette, PenLine, Ruler, Shirt, SwatchBook, TableProperties, Tag } from 'lucide-react';
import './section-pages.css';

/** One page inside a Builder section, shown as a row in the right panel. */
export type SectionPage = { id: string; label: string; hint: string; icon: ReactNode; group?: string };

/** Garment outlines the part icons are drawn on. The part a page edits is drawn bold. */
const TEE = 'M8.5 3.5 4 6l1.8 4L8 9v11.5h8V9l2.2 1L20 6l-4.5-2.5c-.8 1.6-2 2.4-3.5 2.4s-2.7-.8-3.5-2.4Z';
const TANK = 'M8.5 3c.2 2.5-1.8 3.6-1.8 6.5V21h10.6V9.5c0-2.9-2-4-1.8-6.5c-.6 2.3-1.9 3.4-3.5 3.4S9.1 5.3 8.5 3Z';
const TROUSERS = 'M7 3h10l1.2 18H14l-2-10-2 10H5.8Z';
function PartIcon({ outline, part, dashed }: { outline?: string; part: string; dashed?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {outline && <path d={outline} strokeWidth="1.3" opacity=".42" />}
    <path d={part} strokeWidth="2.1" strokeDasharray={dashed ? '2 2.4' : undefined} />
  </svg>;
}
const ICONS: Record<string, ReactNode> = {
  neck: <PartIcon outline={TEE} part="M8.5 3.5c.8 1.6 2 2.4 3.5 2.4s2.7-.8 3.5-2.4" />,
  hood: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 21v-5.5C4.5 8.6 7.8 3 12 3s7.5 5.6 7.5 12.5V21" strokeWidth="1.3" opacity=".42" /><path d="M8.6 15c0-3.6 1.5-6.2 3.4-6.2s3.4 2.6 3.4 6.2c-1 2-2.1 3-3.4 3s-2.4-1-3.4-3Z" strokeWidth="2.1" /></svg>,
  tankNeck: <PartIcon outline={TANK} part="M8.5 3c.6 2.3 1.9 3.4 3.5 3.4s2.9-1.1 3.5-3.4M8.5 3c.2 2.5-1.8 3.6-1.8 6.5M15.5 3c-.2 2.5 1.8 3.6 1.8 6.5" />,
  waistband: <PartIcon outline={TROUSERS} part="M7 3h10M6.85 5.6h10.3" />,
  sleeve: <PartIcon outline={TEE} part="M8.5 3.5 4 6l1.8 4L8 9" />,
  tankBody: <PartIcon outline={TANK} part="M6.7 12v9M17.3 12v9" />,
  leg: <PartIcon outline={TROUSERS} part="M12 3h5l1.2 18H14l-2-10Z" />,
  hem: <PartIcon outline={TEE} part="M8 18h8M8 20.5h8" />,
  tankHem: <PartIcon outline={TANK} part="M6.7 18.5h10.6M6.7 21h10.6" />,
  legHem: <PartIcon outline={TROUSERS} part="M5.9 19h4.1M14 19h4.1" />,
  details: <PartIcon outline={TEE} part="M12 6.4V20M10.6 8.5h1.4m0 2h1.4m-2.8 2h1.4m0 2h1.4m-2.8 2h1.4" />,
  seams: <PartIcon outline={TEE} part="M8 12.5h8M12 6v6.5" />,
  stitching: <PartIcon outline={TEE} part="M9.6 9.5V19M14.4 9.5V19M9.6 19h4.8" dashed />,
  wash: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3s-6.5 7.2-6.5 11.6a6.5 6.5 0 0 0 13 0C18.5 10.2 12 3 12 3Z" /><path d="M8.6 14.8a3.4 3.4 0 0 0 3.4 3.4" /></svg>,
};

const CONSTRUCTION_HINTS: Record<string, string> = {
  'Neck & Collar': 'Neckline shape, finish and size', 'Hood & neckline': 'Hood shape, lining and neckline', 'Neck & armhole': 'Neckline and armhole binding', Waistband: 'Waistband, drawcord and rise',
  Sleeves: 'Length, shape and cuffs', 'Tank construction': 'Straps, back and side seams', 'Leg construction': 'Leg shape and pockets',
  'Hem & Cuffs': 'Hem finish and cuff bands', 'Hems & cuffs': 'Leg openings and cuffs', Hem: 'Hem finish and depth',
  'Details & trims': 'Zips, pockets, buttons and patches', 'Seams & panelling': 'Draw seams and colour panels', Stitching: 'Stitch types and thread colour', 'Wash & Finish': 'Washes, dyes and wear',
};
/** Construction pages for each garment. `id` stays the tool value the Builder already uses. */
export function constructionPages(ids: readonly string[], labelFor: (id: string, index: number) => string, garment: 'tee' | 'hoodie' | 'tank' | 'trousers'): SectionPage[] {
  const first = garment === 'hoodie' ? ICONS.hood : garment === 'tank' ? ICONS.tankNeck : garment === 'trousers' ? ICONS.waistband : ICONS.neck;
  const second = garment === 'tank' ? ICONS.tankBody : garment === 'trousers' ? ICONS.leg : ICONS.sleeve;
  const third = garment === 'tank' ? ICONS.tankHem : garment === 'trousers' ? ICONS.legHem : ICONS.hem;
  const rest = garment === 'trousers'
    ? [<PartIcon key="d" outline={TROUSERS} part="M7.6 5.6c.4 2 1.5 3 3.2 3.3M16.4 5.6c-.4 2-1.5 3-3.2 3.3" />, <PartIcon key="s" outline={TROUSERS} part="M6.6 11.5h4.2M13.2 11.5h4.4" />, <PartIcon key="t" outline={TROUSERS} part="M8.3 6.5 7.4 19M15.7 6.5l.9 12.5" dashed />, ICONS.wash]
    : garment === 'tank'
      ? [<PartIcon key="d" outline={TANK} part="M12 7.5V20M10.6 9.5h1.4m0 2h1.4m-2.8 2h1.4m0 2h1.4" />, <PartIcon key="s" outline={TANK} part="M6.7 13.5h10.6M12 13.5V21" />, <PartIcon key="t" outline={TANK} part="M9 10v9M15 10v9M9 19h6" dashed />, ICONS.wash]
      : [ICONS.details, ICONS.seams, ICONS.stitching, ICONS.wash];
  return ids.map((id, index) => { const label = labelFor(id, index); return { id, label, hint: CONSTRUCTION_HINTS[label] ?? CONSTRUCTION_HINTS[id] ?? '', icon: [first, second, third, ...rest][index] ?? ICONS.details }; });
}

export const MEASUREMENT_PAGES: Record<string, { label: string; hint: string; icon: ReactNode }> = {
  'Core measurements': { label: 'Core measurements', hint: 'Fit and the key measurements', icon: <Ruler size={20} strokeWidth={1.7} /> },
  'Advanced sizing': { label: 'Advanced sizing', hint: 'Every size, side by side', icon: <TableProperties size={20} strokeWidth={1.7} /> },
  'Add custom measurement': { label: 'Custom measurement', hint: 'Add your own point of measure', icon: <CirclePlus size={20} strokeWidth={1.7} /> },
  'Import measurements': { label: 'Import measurements', hint: 'From a spec sheet or file', icon: <FileUp size={20} strokeWidth={1.7} /> },
};
export const MATERIAL_PAGES: Record<string, { hint: string; icon: ReactNode }> = {
  'Fabric & colour': { hint: 'Main fabric and colour', icon: <Palette size={20} strokeWidth={1.7} /> },
  'Part materials': { hint: 'A different fabric for any piece', icon: <Shirt size={20} strokeWidth={1.7} /> },
  Colourways: { hint: 'Save colour versions of this design', icon: <SwatchBook size={20} strokeWidth={1.7} /> },
  'Fabric library': { hint: 'Browse every fabric', icon: <BookOpen size={20} strokeWidth={1.7} /> },
  'Fabric blend': { hint: 'Mix fibres and set the weight', icon: <Blend size={20} strokeWidth={1.7} /> },
};
export const LABEL_PAGES: Record<string, { hint: string; icon: ReactNode }> = {
  'Your labels': { hint: 'Add and manage labels', icon: <Tag size={20} strokeWidth={1.7} /> },
  Design: { hint: 'Text, logo and artwork', icon: <PenLine size={20} strokeWidth={1.7} /> },
  'Construction & size': { hint: 'Fold, size and material', icon: <FoldVertical size={20} strokeWidth={1.7} /> },
  Placement: { hint: 'Where it sits on the garment', icon: <Crosshair size={20} strokeWidth={1.7} /> },
};
export const PACKAGING_PAGES: Record<string, { hint: string; icon: ReactNode }> = {
  'Packaging type': { hint: 'Polybag, mailer or box', icon: <Package size={20} strokeWidth={1.7} /> },
  Design: { hint: 'Print, logo and artwork', icon: <PenLine size={20} strokeWidth={1.7} /> },
  'Material & size': { hint: 'Material, finish and size', icon: <Ruler size={20} strokeWidth={1.7} /> },
};

/** The section's pages. Tapping one opens it in the same panel. */
export function SectionPageList({ section, step, pages, current, onOpen, next, onNext }: { section: string; step: number; pages: SectionPage[]; current?: string; onOpen: (id: string) => void; next?: string; onNext?: () => void }) {
  return <nav className="section-pages" aria-label={`${section} pages`}>
    <header className="section-pages-heading"><span>Step {step} of 7</span><h2>{section}</h2></header>
    <ul>{pages.map((page, index) => <li key={page.id}>
      {page.group && pages[index - 1]?.group !== page.group && <h3>{page.group}</h3>}
      <button type="button" data-current={page.id === current || undefined} onClick={() => onOpen(page.id)}>
        <span className="section-page-icon">{page.icon}</span>
        <span className="section-page-text"><strong>{page.label}</strong>{page.hint && <small>{page.hint}</small>}</span>
        <ChevronRight size={17} aria-hidden="true" />
      </button>
    </li>)}</ul>
    {next && onNext && <footer className="section-pages-next"><button type="button" onClick={onNext}>Next: {next}<ArrowRight size={16} aria-hidden="true" /></button></footer>}
  </nav>;
}

/** Back to the section's page list, shown above the open page. */
export function SectionPageBack({ section, page, onBack }: { section: string; page?: string; onBack: () => void }) {
  return <div className="section-pages-back">
    <button type="button" onClick={onBack} aria-label={`Back to ${section}`}><ChevronLeft size={18} aria-hidden="true" /><span>{section}</span></button>
    {page && <span className="section-pages-crumb" aria-hidden="true">{page}</span>}
  </div>;
}
