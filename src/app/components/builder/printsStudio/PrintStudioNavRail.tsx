import { Brush, Grid3x3, ImageIcon, Shapes, Sparkles, Type, X, type LucideIcon } from 'lucide-react';
import { cn } from '../../ui/utils';
import {
  usePrintsStudio,
  type PrintsStudioPanel,
} from './PrintsStudioContext';

export const PRINT_STUDIO_NAV: {
  id: PrintsStudioPanel;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  { id: 'brush', label: 'Drawing tools', hint: 'Brush, eraser, and Pencil', icon: Brush },
  { id: 'shapes', label: 'Shapes and lines', hint: 'Place graphics on the garment', icon: Shapes },
  { id: 'upload', label: 'Images', hint: 'Upload and reuse artwork', icon: ImageIcon },
  { id: 'text', label: 'Typography', hint: 'Add and style type', icon: Type },
  { id: 'patterns', label: 'Patterns', hint: 'Stripes and repeats', icon: Grid3x3 },
  { id: 'distress', label: 'Distressing', hint: 'Holes, abrasion, and rips', icon: Sparkles },
];

export const BUILDER_FLOW_PHASES = [
  { id: 'setup', label: 'Garment setup', shortLabel: 'Setup' },
  { id: 'design', label: 'Print & Design', shortLabel: 'Design' },
  { id: 'review', label: 'Review', shortLabel: 'Review' },
  { id: 'order', label: 'Order', shortLabel: 'Order' },
] as const;

export type BuilderFlowPhase = (typeof BUILDER_FLOW_PHASES)[number]['id'];

export function PrintStudioPhaseBar({
  current,
  onSelect,
  orientation = 'horizontal',
  orderUnlocked = false,
}: {
  current: BuilderFlowPhase;
  onSelect?: (id: BuilderFlowPhase) => void;
  orientation?: 'vertical' | 'horizontal';
  orderUnlocked?: boolean;
}) {
  const idx = BUILDER_FLOW_PHASES.findIndex((p) => p.id === current);
  const horizontal = orientation === 'horizontal';

  return (
    <nav
      aria-label="Clothing creation process"
      className={cn(
        horizontal
          ? 'flex items-center justify-center gap-0 overflow-x-auto px-2 py-1.5 sm:px-4'
          : 'px-1.5 pb-2 pt-1',
      )}
    >
      {!horizontal ? (
        <div className="mb-1.5 text-[7px] font-bold uppercase tracking-[0.18em] text-[#CC2D24]">Process</div>
      ) : (
        <span className="mr-2 hidden shrink-0 text-[8px] font-bold uppercase tracking-[0.16em] text-[#CC2D24] sm:inline">
          Process
        </span>
      )}
      <ol className={cn(horizontal ? 'flex min-w-0 items-center gap-0' : 'flex flex-col gap-1')}>
        {BUILDER_FLOW_PHASES.map((phase, i) => {
          const on = phase.id === current;
          const done = i < idx;
          const clickable =
            Boolean(onSelect) &&
            !on &&
            (done || phase.id === 'review' || (phase.id === 'order' && orderUnlocked));
          return (
            <li key={phase.id} className={cn(horizontal && 'flex items-center')}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onSelect?.(phase.id)}
                className={cn(
                  'rounded-md font-semibold uppercase leading-tight tracking-wide',
                  horizontal
                    ? 'px-1.5 py-1 text-[8px] sm:px-2 sm:text-[9px]'
                    : 'flex w-full items-center gap-1.5 px-1 py-0.5 text-left text-[8px]',
                  on
                    ? 'text-white'
                    : done
                      ? 'text-white/55 hover:text-white'
                      : 'text-white/28',
                  on && horizontal && 'rounded-full bg-[#FF3B30]/18 text-[#FF3B30]',
                )}
              >
                {!horizontal ? (
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      on ? 'bg-[#FF3B30]' : done ? 'bg-white/45' : 'bg-white/15',
                    )}
                  />
                ) : null}
                {horizontal ? (
                  <>
                    <span className="sm:hidden">{phase.shortLabel}</span>
                    <span className="hidden sm:inline">{phase.label}</span>
                  </>
                ) : (
                  phase.label
                )}
              </button>
              {horizontal && i < BUILDER_FLOW_PHASES.length - 1 ? (
                <span className="px-0.5 text-[9px] text-white/20 sm:px-1" aria-hidden>
                  →
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PrintStudioEditorHeading({
  isPhone = false,
  showCollapse = false,
  onCollapse,
}: {
  isPhone?: boolean;
  showCollapse?: boolean;
  onCollapse?: () => void;
}) {
  const studio = usePrintsStudio();
  const item = PRINT_STUDIO_NAV.find((n) => n.id === studio.panel) ?? PRINT_STUDIO_NAV[0]!;

  return (
    <>
      {isPhone ? (
        <div className="mb-3 min-w-0">
          <div className="mb-1 text-[8px] font-bold uppercase tracking-[0.2em] text-[#CC2D24]">Print & Design</div>
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-[15px] font-extrabold leading-tight tracking-[-0.4px] text-white">
            {item.label.toUpperCase()}
          </h2>
        </div>
      ) : (
        <div className={cn(showCollapse ? 'mb-3 min-w-0 sm:mb-4' : 'mb-1.5')}>
          <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24] md:text-[10px]">
              Print & Design
            </div>
            {showCollapse ? (
              <button
                type="button"
                onClick={onCollapse}
                className="builder-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/55 hover:bg-white/[0.06] hover:text-white md:h-9 md:w-9"
                aria-label="Close panel"
              >
                <X className="h-4 w-4 md:h-[18px] md:w-[18px]" />
              </button>
            ) : null}
          </div>
          <h2 className="break-words font-['Plus_Jakarta_Sans',sans-serif] text-[15px] font-extrabold leading-tight tracking-[-0.5px] text-white sm:text-[16px] md:text-[17px] xl:text-[18px]">
            {item.label.toUpperCase()}
          </h2>
        </div>
      )}
      <p className={cn('mb-4 text-[11px] leading-relaxed text-white/55 md:mb-5 md:text-[11px]', isPhone && 'mb-3')}>
        {item.hint}. Artwork stays on the garment as you switch tools.
      </p>
    </>
  );
}

export function PrintStudioNavRail({
  orientation = 'vertical',
  onActivate,
}: {
  orientation?: 'vertical' | 'horizontal';
  onActivate?: () => void;
}) {
  const studio = usePrintsStudio();
  const horizontal = orientation === 'horizontal';

  return (
    <div
      className={cn(
        horizontal
          ? 'flex min-h-[4.25rem] gap-0 overflow-x-auto overflow-y-hidden'
          : 'flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-3',
      )}
      role="toolbar"
      aria-label="Design tools"
    >
      {PRINT_STUDIO_NAV.map((item) => {
        const Icon = item.icon;
        const on = studio.panel === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={item.hint}
            onClick={() => {
              studio.setPanel(item.id);
              onActivate?.();
            }}
            aria-current={on ? 'true' : undefined}
            className={cn(
              'builder-focus press-feedback flex shrink-0 flex-col items-center gap-1 text-center',
              horizontal
                ? 'min-h-[4rem] min-w-[calc((100vw-1.25rem)/6)] max-w-[5.5rem] flex-1 justify-center rounded-lg px-1 py-1.5'
                : 'w-full px-1 py-2.5',
              on
                ? horizontal
                  ? 'bg-[#09090B] text-white'
                  : 'rounded-l-lg bg-[#09090B] text-white'
                : horizontal
                  ? 'text-white/60 active:text-white'
                  : 'mr-1.5 rounded-lg text-white/60 hover:bg-white/[0.04] hover:text-white',
            )}
          >
            <Icon
              className={cn(
                'shrink-0',
                horizontal ? 'h-7 w-7' : 'h-[18px] w-[18px] md:h-5 md:w-5',
                on ? 'text-white' : 'text-white/55',
              )}
              strokeWidth={on ? 2.15 : 1.75}
            />
            <span
              className={cn(
                'w-full font-semibold uppercase leading-tight tracking-[0.04em]',
                horizontal ? 'line-clamp-2 text-[8px]' : 'max-w-[4.85rem] text-[7.5px] md:text-[9px]',
              )}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
