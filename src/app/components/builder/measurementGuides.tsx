import { useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '../ui/utils';
import type { GarmentView } from '../../data/garmentView';

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
  dimensionX?: number;
  dimensionY?: number;
};

const DEFAULT_MEASUREMENT_GUIDES: MeasurementGuideDef[] = [
  { id: 'shoulderWidth', label: 'Shoulder to Shoulder', x1: 360, y1: 148, x2: 640, y2: 148, labelX: 500, labelY: 96, labelAlign: 'center' },
  { id: 'neckOpening', label: 'Neck Opening', x1: 420, y1: 108, x2: 580, y2: 108, labelX: 500, labelY: 64, labelAlign: 'center' },
  { id: 'neckDrop', label: 'Neck Drop', x1: 500, y1: 108, x2: 500, y2: 270, labelX: 564, labelY: 180, labelAlign: 'left' },
  { id: 'halfLength', label: 'Half Length', x1: 500, y1: 160, x2: 500, y2: 850, labelX: 570, labelY: 500, labelAlign: 'left' },
  { id: 'chestWidth', label: 'Chest Width', x1: 290, y1: 380, x2: 710, y2: 380, labelX: 720, labelY: 356, labelAlign: 'left' },
  { id: 'armhole', label: 'Armhole', x1: 300, y1: 200, x2: 250, y2: 340, labelX: 200, labelY: 270, labelAlign: 'right' },
  { id: 'sleeveLength', label: 'Sleeve Length', x1: 300, y1: 200, x2: 120, y2: 350, labelX: 70, labelY: 200, labelAlign: 'left' },
  { id: 'sleeveOpening', label: 'Sleeve Opening', x1: 90, y1: 360, x2: 230, y2: 360, labelX: 240, labelY: 380, labelAlign: 'left' },
  { id: 'bottomWidth', label: 'Bottom Width', x1: 310, y1: 860, x2: 690, y2: 860, labelX: 500, labelY: 910, labelAlign: 'center' },
];

const STORAGE_KEY = 'ceriga_measurement_guides_v3';
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
  view = 'front',
  editable,
  guides,
  onGuidePointerDown,
  onSelect,
}: {
  highlightedId?: string | null;
  view?: GarmentView;
  editable?: boolean;
  guides?: MeasurementGuideDef[];
  onGuidePointerDown?: (guideId: MeasurementGuideId, event: ReactPointerEvent<SVGGElement>) => void;
  onSelect?: (guideId: MeasurementGuideId) => void;
}) {
  const storeGuides = useMeasurementGuides();
  const activeGuides = (guides ?? storeGuides).filter(guide => view !== 'back' || guide.id !== 'neckDrop');

  return (
    <svg
      className={cn(
        'pointer-events-none absolute inset-0 z-30 h-full w-full',
        editable && 'pointer-events-auto',
      )}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      aria-label="Garment measurement guides"
    >
      {activeGuides.map((guide) => {
        const active = highlightedId === null || highlightedId === guide.id;
        const opacity = highlightedId && !active ? 0.22 : 0.92;
        const labelOpacity = highlightedId && !active ? 0.35 : 1;
        const width = guides ? 112 : guide.label.length > 12 ? 176 : 140;
        const start = { x: guide.dimensionX ?? guide.x1, y: guide.dimensionY ?? guide.y1 };
        const end = { x: guide.dimensionX ?? guide.x2, y: guide.dimensionY ?? guide.y2 };
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
            data-measurement-guide={guide.id}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={`Select ${MEASUREMENT_GUIDE_LABELS.find(item => item.id === guide.id)?.label}`}
            aria-pressed={highlightedId === guide.id}
            style={{ cursor: editable ? 'grab' : onSelect ? 'pointer' : 'default', pointerEvents: onSelect || editable ? 'auto' : 'none' }}
            onClick={() => onSelect?.(guide.id)}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(guide.id); } }}
            onPointerDown={(event) => {
              if (!editable || !onGuidePointerDown) return;
              onGuidePointerDown(guide.id, event);
            }}
          >
            {editable || onSelect ? (
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="transparent"
                strokeWidth={26}
                strokeLinecap="round"
              />
            ) : null}
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#FF3B30"
              strokeWidth={highlightedId === guide.id ? 2 : 1.3}
              strokeLinecap="round"
            />
            <path d={`M${guide.x1},${guide.y1}L${start.x},${start.y}M${guide.x2},${guide.y2}L${end.x},${end.y}M${(start.x + end.x) / 2},${(start.y + end.y) / 2}L${guide.labelX},${guide.labelY}`} fill="none" stroke="#FF3B30" strokeWidth={.8} opacity={.55} />
            <circle cx={guide.x1} cy={guide.y1} r={highlightedId === guide.id ? 3.5 : 2} fill="#FFF" stroke="#FF3B30" strokeWidth={1.2} />
            <circle cx={guide.x2} cy={guide.y2} r={highlightedId === guide.id ? 3.5 : 2} fill="#FFF" stroke="#FF3B30" strokeWidth={1.2} />
            <foreignObject x={x} y={guide.labelY - 16} width={width} height={34}>
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                className={cn(
                  'flex h-8 items-center gap-1 rounded border border-[#FF3B30]/30 bg-[#171719] px-1 text-[14px] font-medium text-white',
                  textAlign,
                )}
                style={{ opacity: labelOpacity }}
              >
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

