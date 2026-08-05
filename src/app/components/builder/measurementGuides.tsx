import { useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '../ui/utils';

export const MEASUREMENT_GUIDE_LABELS = [
  { id: 'halfLength', label: 'A. Half Length' },
  { id: 'chestWidth', label: 'B. Chest Width' },
  { id: 'bottomWidth', label: 'C. Bottom Width' },
  { id: 'sleeveLength', label: 'D. Sleeve Length' },
  { id: 'armhole', label: 'E. Armhole' },
  { id: 'sleeveOpening', label: 'F. Sleeve Opening' },
  { id: 'neckOpening', label: 'G. Neck Opening' },
  { id: 'neckDrop', label: 'H. Neck Drop' },
  { id: 'shoulderWidth', label: 'I. Shoulder to Shoulder' },
] as const;

export type MeasurementGuideId = (typeof MEASUREMENT_GUIDE_LABELS)[number]['id'];

export type MeasurementGuideDef = {
  id: MeasurementGuideId;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  labelAlign: 'left' | 'center' | 'right';
};

const DEFAULT_MEASUREMENT_GUIDES: MeasurementGuideDef[] = [
  { id: 'shoulderWidth', label: 'Shoulder to Shoulder', x1: 372, y1: 176, x2: 628, y2: 176, labelX: 500, labelY: 122, labelAlign: 'center' },
  { id: 'neckOpening', label: 'Neck Opening', x1: 434, y1: 128, x2: 566, y2: 128, labelX: 500, labelY: 82, labelAlign: 'center' },
  { id: 'neckDrop', label: 'Neck Drop', x1: 500, y1: 128, x2: 500, y2: 198, labelX: 564, labelY: 150, labelAlign: 'left' },
  { id: 'halfLength', label: 'Half Length', x1: 500, y1: 188, x2: 500, y2: 842, labelX: 570, labelY: 520, labelAlign: 'left' },
  { id: 'chestWidth', label: 'Chest Width', x1: 300, y1: 365, x2: 700, y2: 365, labelX: 710, labelY: 343, labelAlign: 'left' },
  { id: 'armhole', label: 'Armhole', x1: 340, y1: 294, x2: 296, y2: 476, labelX: 250, labelY: 386, labelAlign: 'right' },
  { id: 'sleeveLength', label: 'Sleeve Length', x1: 336, y1: 298, x2: 156, y2: 470, labelX: 86, labelY: 276, labelAlign: 'left' },
  { id: 'sleeveOpening', label: 'Sleeve Opening', x1: 132, y1: 478, x2: 248, y2: 478, labelX: 256, labelY: 498, labelAlign: 'left' },
  { id: 'bottomWidth', label: 'Bottom Width', x1: 320, y1: 854, x2: 680, y2: 854, labelX: 500, labelY: 910, labelAlign: 'center' },
];

const STORAGE_KEY = 'ceriga_measurement_guides_v1';
const VIEWBOX_SIZE = 1000;
const MIN_COORD = 12;
const MAX_COORD = VIEWBOX_SIZE - 12;

let measurementGuideStore: MeasurementGuideDef[] = structuredClone(DEFAULT_MEASUREMENT_GUIDES);
const listeners = new Set<() => void>();

function cloneGuides(guides: MeasurementGuideDef[]): MeasurementGuideDef[] {
  return guides.map((guide) => ({ ...guide }));
}

function clamp(value: number, min = MIN_COORD, max = MAX_COORD): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeGuide(guide: MeasurementGuideDef): MeasurementGuideDef {
  return {
    ...guide,
    x1: clamp(guide.x1),
    y1: clamp(guide.y1),
    x2: clamp(guide.x2),
    y2: clamp(guide.y2),
    labelX: clamp(guide.labelX),
    labelY: clamp(guide.labelY),
  };
}

function normalizeGuides(guides: MeasurementGuideDef[]): MeasurementGuideDef[] {
  const nextById = new Map(guides.map((guide) => [guide.id, normalizeGuide(guide)] as const));
  return DEFAULT_MEASUREMENT_GUIDES.map((guide) => nextById.get(guide.id) ?? structuredClone(guide));
}

function loadMeasurementGuideStore(): MeasurementGuideDef[] {
  if (typeof window === 'undefined') return structuredClone(DEFAULT_MEASUREMENT_GUIDES);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_MEASUREMENT_GUIDES);
    const parsed = JSON.parse(raw) as MeasurementGuideDef[];
    return normalizeGuides(Array.isArray(parsed) ? parsed : DEFAULT_MEASUREMENT_GUIDES);
  } catch {
    return structuredClone(DEFAULT_MEASUREMENT_GUIDES);
  }
}

function persistMeasurementGuideStore() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(measurementGuideStore));
  } catch {
    /* ignore */
  }
}

function emitMeasurementGuideStoreChange() {
  for (const listener of listeners) listener();
}

function refreshMeasurementGuideStoreFromStorage() {
  const next = loadMeasurementGuideStore();
  measurementGuideStore = next;
  emitMeasurementGuideStoreChange();
}

if (typeof window !== 'undefined') {
  measurementGuideStore = loadMeasurementGuideStore();
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) refreshMeasurementGuideStoreFromStorage();
  });
}

export function getMeasurementGuideDefs(): MeasurementGuideDef[] {
  return measurementGuideStore;
}

export function upsertMeasurementGuideDefs(next: MeasurementGuideDef[]): void {
  measurementGuideStore = normalizeGuides(cloneGuides(next));
  persistMeasurementGuideStore();
  emitMeasurementGuideStoreChange();
}

export function updateMeasurementGuide(
  id: MeasurementGuideId,
  patch: Partial<Omit<MeasurementGuideDef, 'id' | 'label'>>,
): void {
  upsertMeasurementGuideDefs(
    measurementGuideStore.map((guide) => (guide.id === id ? normalizeGuide({ ...guide, ...patch }) : guide)),
  );
}

export function resetMeasurementGuideDefs(): void {
  measurementGuideStore = structuredClone(DEFAULT_MEASUREMENT_GUIDES);
  persistMeasurementGuideStore();
  emitMeasurementGuideStoreChange();
}

function subscribeMeasurementGuides(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMeasurementGuides(): MeasurementGuideDef[] {
  return useSyncExternalStore(
    subscribeMeasurementGuides,
    getMeasurementGuideDefs,
    () => structuredClone(DEFAULT_MEASUREMENT_GUIDES),
  );
}

export function MeasurementGuideOverlay({
  highlightedId,
  editable,
  guides,
  onGuidePointerDown,
}: {
  highlightedId?: string | null;
  editable?: boolean;
  guides?: MeasurementGuideDef[];
  onGuidePointerDown?: (guideId: MeasurementGuideId, event: ReactPointerEvent<SVGGElement>) => void;
}) {
  const storeGuides = useMeasurementGuides();
  const activeGuides = guides ?? storeGuides;

  return (
    <svg
      className={cn(
        'pointer-events-none absolute inset-0 z-30 h-full w-full',
        editable && 'pointer-events-auto',
      )}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {activeGuides.map((guide) => {
        const active = highlightedId === null || highlightedId === guide.id;
        const opacity = highlightedId && !active ? 0.22 : 0.92;
        const labelOpacity = highlightedId && !active ? 0.35 : 1;
        const width = guide.label.length > 12 ? 176 : 140;
        const x =
          guide.labelAlign === 'center'
            ? guide.labelX - width / 2
            : guide.labelAlign === 'right'
              ? guide.labelX - width
              : guide.labelX;
        const textAlign =
          guide.labelAlign === 'center'
            ? 'justify-center'
            : guide.labelAlign === 'right'
              ? 'justify-end'
              : 'justify-start';

        return (
          <g
            key={guide.id}
            opacity={opacity}
            style={{ cursor: editable ? 'grab' : 'default' }}
            onPointerDown={(event) => {
              if (!editable || !onGuidePointerDown) return;
              onGuidePointerDown(guide.id, event);
            }}
          >
            {editable ? (
              <line
                x1={guide.x1}
                y1={guide.y1}
                x2={guide.x2}
                y2={guide.y2}
                stroke="transparent"
                strokeWidth={26}
                strokeLinecap="round"
              />
            ) : null}
            <line
              x1={guide.x1}
              y1={guide.y1}
              x2={guide.x2}
              y2={guide.y2}
              stroke="#FF3B30"
              strokeWidth={3}
              strokeDasharray="8 7"
              strokeLinecap="round"
            />
            <circle cx={guide.x1} cy={guide.y1} r={4.5} fill="#F2F0EC" stroke="#FF3B30" strokeWidth={2} />
            <circle cx={guide.x2} cy={guide.y2} r={4.5} fill="#F2F0EC" stroke="#FF3B30" strokeWidth={2} />
            <circle
              cx={(guide.x1 + guide.x2) / 2}
              cy={(guide.y1 + guide.y2) / 2}
              r={editable ? 8 : 5}
              fill={editable ? '#FF3B30' : '#F2F0EC'}
              stroke="#FF3B30"
              strokeWidth={2}
            />
            <foreignObject x={x} y={guide.labelY - 16} width={width} height={34}>
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border border-[#FF3B30]/30 bg-black/55 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm',
                  textAlign,
                )}
                style={{ opacity: labelOpacity }}
              >
                <span className="text-[#FF3B30]">{guide.id.toUpperCase()}</span>
                <span>{guide.label}</span>
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}

export function getMeasurementGuideCenter(guide: MeasurementGuideDef) {
  return {
    x: (guide.x1 + guide.x2) / 2,
    y: (guide.y1 + guide.y2) / 2,
  };
}

