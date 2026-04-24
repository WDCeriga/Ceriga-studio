import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type SetStateAction,
} from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Download,
  Droplets,
  FileCheck,
  Hash,
  History,
  ImageIcon,
  Layers,
  Link2,
  Minus,
  Package,
  Palette,
  Plus,
  Pocket,
  Redo2,
  RotateCcw,
  Ruler,
  Save,
  Scissors,
  Tag,
  Trash2,
  Undo2,
  X,
  SquarePen,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';

import { getProductById } from '../data/products';
import {
  builderSteps,
  TECHPACK_SPEC_FLOW_ORDER,
  type BuilderStep,
  cuffOptions,
  fabricColors,
  ORDER_SIZE_KEYS,
  fadingOptions,
  hemOptions,
  neckOptions,
  pocketOptions,
  sleeveLengthOptions,
  sleeveTypeOptions,
  stitchingOptions,
  zipOptions,
  type GarmentType,
  type OrderSizeKey,
} from '../data/builderSteps';
import { STUDIO_MAIN_COLORS, STUDIO_POPULAR_COLORS } from '../data/studioColorPresets';
import { normalizeHex6 } from '../lib/colorUtils';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from 'react-resizable-panels';

import imgBlueTshirt from 'figma:asset/f00825900c95df312eb3b002c75207b61c243d55.png';

import { MeasurementsStep, MeasurementPreview } from '../components/builder/MeasurementsStep';
import { TrimColorFamilyPicker } from '../components/builder/TrimColorFamilyPicker';
import { StudioColorField } from '../components/builder/StudioColorField';
import {
  DEFAULT_PRINT_METHOD,
  PRINT_METHOD_DESCRIPTIONS,
  DesignElement,
  PrintsDesignPreview,
  PrintsDesignStep,
} from '../components/builder/PrintsDesignStep';
import { PageLoadingFallback } from '../components/PageLoadingFallback';
import { TechPackReferenceUpload } from '../components/builder/TechPackReferenceUpload';
import {
  LabelPreview,
  LabelsPackagingStep,
  PackagingPreview,
} from '../components/builder/LabelsPackagingStep';
import { DownloadTechPackModal } from '../components/builder/DownloadTechPackModal';
import { cn } from '../components/ui/utils';
import type { MeasurementUnit } from '../lib/measurements';

const HISTORY_MAX = 50;
/** Keep a short queue of named versions (auto + manual). Oldest get evicted past this.
 *  Kept deliberately small — version history lives entirely in tab RAM (nothing is
 *  persisted to localStorage / backend) and image payloads are de-duplicated via
 *  the registry below, so the cost of each extra snapshot is tiny.
 */
const VERSION_HISTORY_MAX = 15;
/** Auto-snapshot at most this often so a flurry of edits doesn't flood the list. */
const VERSION_AUTOSNAP_COOLDOWN_MS = 30_000;
/** Wait this long after the last edit before auto-snapping (debounce). */
const VERSION_AUTOSAVE_DEBOUNCE_MS = 12_000;
/** Even during continuous editing, force a snapshot after this long since the first unsaved edit. */
const VERSION_AUTOSAVE_MAX_INTERVAL_MS = 90_000;

interface BuilderVersion {
  id: string;
  createdAt: number;
  label: string;
  /** Short preview text summarizing step + any custom note. */
  summary: string;
  /** true for user-initiated "Save version"; false for auto-snapshots. */
  manual: boolean;
  /** Step the user was on when this snapshot was taken — used to pick which layer to thumbnail. */
  currentStep: number;
  /** Front vs back view so thumbnails match what the user saw. */
  showFront: boolean;
  state: BuilderState;
}

function describePrintMethodLabel(method: string | undefined) {
  const k = method ?? DEFAULT_PRINT_METHOD;
  return (PRINT_METHOD_DESCRIPTIONS as Record<string, string>)[k] ?? k;
}

/** When a side panel crosses below this % while shrinking, snap to fully collapsed (see minSize on Panel). */
const PANEL_SNAP_COLLAPSE_BELOW_PCT = 22;

/** Minimum width (%) for side panels — prevents the editor column from shrinking into broken layouts. */
const SIDE_PANEL_MIN_PCT = 22;

type DetailKey =
  | 'measurements'
  | 'fabric'
  | 'neck'
  | 'sleeves'
  | 'hem'
  | 'pockets';

interface BuilderState {
  productId: string;
  garmentType: GarmentType;
  fit?: string;
  /** Display/export preference; stored values in `measurements` are always cm. */
  measurementUnit: MeasurementUnit;
  measurements: Record<string, Record<string, string>>;
  fabricType?: string;
  gsm?: string;
  colors: Array<{ hex: string; pantone: string }>;
  neckType?: string;
  sleeveType?: string;
  sleeveLength?: string;
  hemType?: string;
  cuffType?: string;
  pocketType?: string;
  zipType?: string;
  fadingType?: string;
  stitchingType?: string;
  /** Thread / contrast stitch colour (hex) */
  stitchingColor?: string;
  neckTrimColor?: string;
  sleeveTrimColor?: string;
  pocketTrimColor?: string;
  extraDetails: Partial<
    Record<
      DetailKey | 'labels' | 'packaging' | 'fading' | 'stitching' | 'referenceUploadNotes',
      string
    >
  >;
  /** Comma-separated filenames from the spec-only upload step (display / export only). */
  referenceUploadFileNames?: string;
  detailPositions: Partial<Record<DetailKey, { top: string; left: string }>>;
  prints: DesignElement[];
  labels: DesignElement[];
  packaging: DesignElement[];
  /** Neck label product option; `none` = skip custom label */
  labelType?: string;
  /** Packaging product option; `none` = skip custom packaging */
  packagingType?: string;
  /** Sync label/packaging layer selection between editor panel and preview */
  labelLayerSelectedId: string | null;
  packagingLayerSelectedId: string | null;
  /** Sync prints layer selection between editor and live preview */
  printsLayerSelectedId: string | null;
  /** Label material / print colour (hex) */
  labelColor?: string;
  /** Packaging (e.g. bag) colour (hex) */
  packagingColor?: string;
  /** Units per size for ordering */
  quantityBySize: Record<OrderSizeKey, number>;
}

function cloneBuilderState(s: BuilderState): BuilderState {
  return JSON.parse(JSON.stringify(s)) as BuilderState;
}

function builderStatesEqual(a: BuilderState, b: BuilderState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ── Image-payload registry ─────────────────────────────────────────────
 * Uploaded images are stored as base64 data URLs inside DesignElement.content.
 * These strings are big (often 1–5 MB each) and a naive snapshot would clone
 * every byte into every version / undo entry.
 *
 * This registry is an in-memory, ref-counted cache keyed by the full data URL
 * string. When we stash a snapshot we swap each image's content for a short
 * "__imgRef:<token>" placeholder and bump the ref count; when a snapshot is
 * evicted we release the refs; when refs hit zero the payload is removed and
 * the bytes are eligible for GC. Live state always holds the real data URL.
 *
 * Nothing here is persisted — it's all plain JS `Map`s that die with the tab.
 */
const IMG_REF_PREFIX = '__imgRef:';

interface ImageRegistryEntry {
  token: string;
  refs: number;
  payload: string;
}

const imageRegistryByPayload = new Map<string, ImageRegistryEntry>();
const imageRegistryByToken = new Map<string, ImageRegistryEntry>();
let nextImageRefId = 1;

function isRefToken(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith(IMG_REF_PREFIX);
}

function stashDataUrl(dataUrl: string): string {
  let entry = imageRegistryByPayload.get(dataUrl);
  if (!entry) {
    const token = `v${nextImageRefId++}`;
    entry = { token, refs: 0, payload: dataUrl };
    imageRegistryByPayload.set(dataUrl, entry);
    imageRegistryByToken.set(token, entry);
  }
  entry.refs += 1;
  return IMG_REF_PREFIX + entry.token;
}

function resolveImageRef(content: string | undefined): string | undefined {
  if (!content || !isRefToken(content)) return content;
  const token = content.slice(IMG_REF_PREFIX.length);
  return imageRegistryByToken.get(token)?.payload ?? content;
}

function releaseImageRef(content: string | undefined) {
  if (!content || !isRefToken(content)) return;
  const token = content.slice(IMG_REF_PREFIX.length);
  const entry = imageRegistryByToken.get(token);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    imageRegistryByPayload.delete(entry.payload);
    imageRegistryByToken.delete(entry.token);
  }
}

function mapElements(
  list: DesignElement[] | undefined,
  fn: (el: DesignElement) => DesignElement,
): DesignElement[] {
  if (!list) return [];
  return list.map(fn);
}

/** Walk a cloned state's print / label / packaging layers and swap each image's
 *  base64 data URL for a short ref token, so heavy payloads aren't duplicated. */
function stashBuilderState(s: BuilderState): BuilderState {
  const cloned = cloneBuilderState(s);
  const stash = (el: DesignElement): DesignElement => {
    if (el.type === 'image' && typeof el.content === 'string' && el.content.startsWith('data:')) {
      return { ...el, content: stashDataUrl(el.content) };
    }
    return el;
  };
  cloned.prints = mapElements(cloned.prints, stash);
  cloned.labels = mapElements(cloned.labels, stash);
  cloned.packaging = mapElements(cloned.packaging, stash);
  return cloned;
}

/** Inverse of stash — produces a fresh state with full image payloads resolved. */
function resolveBuilderState(s: BuilderState): BuilderState {
  const cloned = cloneBuilderState(s);
  const resolve = (el: DesignElement): DesignElement => {
    if (el.type === 'image' && isRefToken(el.content)) {
      return { ...el, content: resolveImageRef(el.content) ?? el.content };
    }
    return el;
  };
  cloned.prints = mapElements(cloned.prints, resolve);
  cloned.labels = mapElements(cloned.labels, resolve);
  cloned.packaging = mapElements(cloned.packaging, resolve);
  return cloned;
}

/** Decrement refs for every image token in a stashed state — call when evicting. */
function releaseBuilderState(s: BuilderState) {
  const release = (list: DesignElement[] | undefined) => {
    if (!list) return;
    for (const el of list) {
      if (el.type === 'image' && isRefToken(el.content)) {
        releaseImageRef(el.content);
      }
    }
  };
  release(s.prints);
  release(s.labels);
  release(s.packaging);
}

/** Equality check that compares two states without caring whether either side
 *  carries raw data URLs or ref tokens — used when deduplicating auto-snapshots. */
function builderStatesEqualResolved(a: BuilderState, b: BuilderState): boolean {
  return JSON.stringify(resolveBuilderState(a)) === JSON.stringify(resolveBuilderState(b));
}

/** Vertical rail icons (desktop / tablet) — short labels come from `stepTabTitle`. */
const BUILDER_STEP_ICONS: Record<number, LucideIcon> = {
  1: Ruler,
  2: Palette,
  3: CircleDot,
  4: Scissors,
  5: Layers,
  6: Pocket,
  7: Droplets,
  8: Link2,
  9: ImageIcon,
  10: Tag,
  11: Package,
  12: Hash,
  13: FileCheck,
};

const PREVIEW_ZOOM_MIN = 50;
const PREVIEW_ZOOM_MAX = 175;
/** On narrow phones the canvas is already large; capping zoom keeps controls readable. */
const PREVIEW_ZOOM_MAX_PHONE = 120;
const PREVIEW_ZOOM_DEFAULT = 100;

const FABRIC_OPTIONS = [
  { value: 'jersey', label: 'Jersey' },
  { value: 'fleece', label: 'Fleece' },
  { value: 'french-terry', label: 'French Terry' },
  { value: 'twill', label: 'Twill' },
  { value: 'interlock', label: 'Interlock' },
  { value: 'piqué', label: 'Piqué' },
];

const DETAIL_META: Record<
  DetailKey,
  { title: string; defaultTop: string; defaultLeft: string; lineSide: 'left' | 'right' }
> = {
  measurements: { title: 'Measurement', defaultTop: '16%', defaultLeft: '14px', lineSide: 'left' },
  fabric: { title: 'Fabric & Colour', defaultTop: '22%', defaultLeft: 'auto', lineSide: 'right' },
  neck: { title: 'Neck / Collar', defaultTop: '10%', defaultLeft: '14px', lineSide: 'left' },
  sleeves: { title: 'Sleeves', defaultTop: '34%', defaultLeft: 'auto', lineSide: 'right' },
  hem: { title: 'Hem & Cuffs', defaultTop: '78%', defaultLeft: '14px', lineSide: 'left' },
  pockets: { title: 'Pockets & Zips', defaultTop: '48%', defaultLeft: '14px', lineSide: 'left' },
};

/** Pixels of movement before a detail callout counts as a drag (tap/click does not move it). */
const DETAIL_DRAG_THRESHOLD_PX = 8;

/**
 * Phone garment / guide images: never force both axes to 100% (avoids squashed look).
 * Let object-contain fit inside the preview panel; cap width by vw so small phones still scale.
 */
const PREVIEW_STAGE_CLASS_PHONE =
  'relative z-[1] mx-auto block h-auto w-auto max-h-full max-w-[min(100%,92vw,420px)] shrink-0 object-contain';
/** Step 1 diagram: a bit smaller on phone so the form gets more vertical room. */
const MEASUREMENT_GUIDE_CLASS_PHONE =
  'relative z-[1] mx-auto block h-auto w-auto max-h-[min(40dvh,280px)] max-w-[min(100%,85vw,320px)] shrink-0 object-contain';
/** One consistent frame for garment / design previews on phone (centered, proportional). */
const PHONE_PREVIEW_FRAME_CLASS =
  'mx-auto w-full min-h-0 min-w-0 max-w-[min(100%,88vw,300px)] max-h-[min(42dvh,360px)]';
/** Slightly larger preview when the config sheet is fully collapsed (more shirt visible). */
const PHONE_PREVIEW_FRAME_EXPANDED_CLASS =
  'mx-auto w-full min-h-0 min-w-0 max-w-[min(100%,92vw,360px)] max-h-[min(50dvh,440px)]';
/** Tablet/desktop: capped height so the guide does not dominate very tall viewports. */
const PREVIEW_STAGE_CLASS =
  'relative z-[1] mx-auto h-auto w-full max-w-[min(100%,300px)] max-h-[min(50dvh,380px)] object-contain md:h-full md:max-h-[min(38vh,340px)] md:max-w-[min(100%,360px)] lg:max-h-[min(42vh,400px)] lg:max-w-[min(100%,400px)] xl:max-h-[min(46vh,460px)] xl:max-w-[min(100%,440px)] 2xl:max-h-[min(52vh,540px)] 2xl:max-w-[min(100%,480px)]';

function formatPlanSummary(kind: 'label' | 'packaging', value?: string): string {
  const fallback = kind === 'label' ? 'woven' : 'polybag';
  const v = value ?? fallback;
  if (v === 'none') return 'None';
  return v.replace(/-/g, ' ');
}

function isTechpackSpecUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('flow') === 'techpack-spec';
}

function stepTabTitle(item: BuilderStep, techpackSpecFlow: boolean): string {
  if (techpackSpecFlow && item.id === 9) return 'Upload design';
  return item.title;
}

export function Builder() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const techpackSpecFlow =
    searchParams.get('flow') === 'techpack-spec' ||
    (location.state as { builderFlow?: string } | null)?.builderFlow === 'techpack-spec';
  const techpackFlowInitRef = useRef(false);
  const product = productId ? getProductById(productId) : null;

  const [currentStep, setCurrentStep] = useState(() => (isTechpackSpecUrl() ? 9 : 1));
  const [visitedSteps, setVisitedSteps] = useState<number[]>(() =>
    isTechpackSpecUrl() ? [9] : [1],
  );
  const [showFront, setShowFront] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectName, setProjectName] = useState(product?.name || 'Untitled Project');
  const [isEditingName, setIsEditingName] = useState(false);
  const [showExtraDetails, setShowExtraDetails] = useState(false);
  const [previewBackground, setPreviewBackground] = useState<'black' | 'white' | 'transparent'>('black');
  const [previewZoom, setPreviewZoom] = useState(PREVIEW_ZOOM_DEFAULT);
  /** When true, the phone configuration sheet (not the step icons) is fully collapsed. */
  const [phoneEditorCollapsed, setPhoneEditorCollapsed] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [showReviewDrawer, setShowReviewDrawer] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<BuilderVersion[]>([]);
  const [draggingDetail, setDraggingDetail] = useState<DetailKey | null>(null);
  const [isOverDeleteZone, setIsOverDeleteZone] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  /** phone: preview + editor stack; tablet: 3 columns narrow; desktop: full */
  const [layoutTier, setLayoutTier] = useState<'phone' | 'tablet' | 'desktop'>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    if (w < 768) return 'phone';
    if (w < 1280) return 'tablet';
    return 'desktop';
  });

  const previewShellRef = useRef<HTMLDivElement>(null);
  /** Scaled canvas stage (transform: scale); detail callouts live inside it so they scale with the garment. */
  const previewStageRef = useRef<HTMLDivElement>(null);
  /** Same box as detail callout `position:absolute` (inside the scaled stage); drag math reads this and divides by current scale. */
  const detailPositionRootRef = useRef<HTMLDivElement>(null);
  /** Latest scale factor (previewZoom / 100); read inside pointer handlers without retriggering listeners. */
  const previewScaleRef = useRef(PREVIEW_ZOOM_DEFAULT / 100);
  const previewZoomRef = useRef(PREVIEW_ZOOM_DEFAULT);
  const deleteZoneRef = useRef<HTMLDivElement>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const detailOverDeleteRef = useRef(false);
  const detailPendingDragRef = useRef<{
    key: DetailKey;
    startX: number;
    startY: number;
    offset: { x: number; y: number };
    initialLeftPx: number;
    initialTopPx: number;
  } | null>(null);
  const activeDetailDragKeyRef = useRef<DetailKey | null>(null);
  const detailDragOffsetRef = useRef({ x: 0, y: 0 });
  /** Shell-relative px; matches clamped position applied to the card (see pointermove). */
  const detailLastClampedPosRef = useRef<{ left: number; top: number } | null>(null);
  const detailGestureCleanupRef = useRef<(() => void) | null>(null);
  const detailPointerCaptureRef = useRef<{ el: HTMLElement; pointerId: number } | null>(null);
  const detailMoveRafRef = useRef<number | null>(null);
  const detailMovePendingRef = useRef<{ key: DetailKey; left: number; top: number } | null>(null);
  const prevExtraTextByDetailKeyRef = useRef<Partial<Record<DetailKey, string>>>({});
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const phoneEditorPanelRef = useRef<ImperativePanelHandle>(null);
  /** Scrollable step editor (left / phone bottom sheet); reset to top when the step changes. */
  const editorScrollRef = useRef<HTMLDivElement>(null);

  const [state, _setStateRaw] = useState<BuilderState>({
    productId: productId || '',
    garmentType: product?.garmentType || 'tshirt',
    fit: 'regular',
    measurementUnit: 'cm',
    measurements: {},
    colors: [],
    extraDetails: {},
    referenceUploadFileNames: undefined,
    prints: [],
    labels: [],
    packaging: [],
    labelLayerSelectedId: null,
    packagingLayerSelectedId: null,
    printsLayerSelectedId: null,
    quantityBySize: { xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0 },
    detailPositions: {
      measurements: { top: '16%', left: '14px' },
      fabric: { top: '22%', left: 'auto' },
      neck: { top: '10%', left: '14px' },
      sleeves: { top: '34%', left: 'auto' },
      hem: { top: '78%', left: '14px' },
      pockets: { top: '48%', left: '14px' },
    },
  });

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const undoStackRef = useRef<BuilderState[]>([]);
  const redoStackRef = useRef<BuilderState[]>([]);
  const dragUndoSnapshotRef = useRef<BuilderState | null>(null);

  const [undoAvailable, setUndoAvailable] = useState(false);
  const [redoAvailable, setRedoAvailable] = useState(false);

  const syncHistoryAvailability = useCallback(() => {
    setUndoAvailable(undoStackRef.current.length > 0);
    setRedoAvailable(redoStackRef.current.length > 0);
  }, []);

  const setState = useCallback(
    (updater: SetStateAction<BuilderState>) => {
      _setStateRaw((prev) => {
        const next =
          typeof updater === 'function'
            ? (updater as (p: BuilderState) => BuilderState)(prev)
            : updater;
        if (builderStatesEqual(prev, next)) return prev;
        undoStackRef.current.push(cloneBuilderState(prev));
        if (undoStackRef.current.length > HISTORY_MAX) undoStackRef.current.shift();
        redoStackRef.current = [];
        return next;
      });
      queueMicrotask(syncHistoryAvailability);
    },
    [syncHistoryAvailability],
  );

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    _setStateRaw((current) => {
      const prev = undoStackRef.current.pop()!;
      redoStackRef.current.push(cloneBuilderState(current));
      if (redoStackRef.current.length > HISTORY_MAX) redoStackRef.current.shift();
      syncHistoryAvailability();
      return prev;
    });
  }, [syncHistoryAvailability]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    _setStateRaw((current) => {
      const next = redoStackRef.current.pop()!;
      undoStackRef.current.push(cloneBuilderState(current));
      if (undoStackRef.current.length > HISTORY_MAX) undoStackRef.current.shift();
      syncHistoryAvailability();
      return next;
    });
  }, [syncHistoryAvailability]);

  /* ── Version history ─────────────────────────────────────────────
   * Sibling of undo/redo: long-term named snapshots users can jump back to.
   * Auto-snapshots are rate-limited (VERSION_AUTOSNAP_COOLDOWN_MS) so a burst
   * of edits doesn't flood the list. Manual "Save version" always stores.
   */
  const lastAutoSnapshotAtRef = useRef(0);
  const currentStepRef = useRef(currentStep);
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  const showFrontRef = useRef(showFront);
  useEffect(() => {
    showFrontRef.current = showFront;
  }, [showFront]);

  const firstUnsavedEditAtRef = useRef<number | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);

  const captureVersion = useCallback(
    ({ manual, label }: { manual: boolean; label?: string }) => {
      const now = Date.now();
      if (!manual && now - lastAutoSnapshotAtRef.current < VERSION_AUTOSNAP_COOLDOWN_MS) {
        return;
      }
      let inserted = false;
      let stashedForThisCapture: BuilderState | null = null;
      setVersions((prev) => {
        // Skip if the most recent version already matches (user pressed undo back to it,
        // or debounce fired after a no-op edit). Compare resolved forms so the ref-token
        // swap inside stored versions doesn't falsely diverge from the live state.
        if (prev.length && builderStatesEqualResolved(prev[0].state, stateRef.current)) {
          return prev;
        }
        // Only stash (and ref-count) if we're actually going to store this snapshot.
        const snap = stashBuilderState(stateRef.current);
        stashedForThisCapture = snap;
        const step = builderSteps.find((s) => s.id === currentStepRef.current);
        const summary = manual
          ? label ?? 'Manual save'
          : step?.title
            ? `Auto — ${step.title}`
            : 'Auto snapshot';
        const version: BuilderVersion = {
          id: `v_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          createdAt: now,
          label: label ?? (manual ? 'Saved version' : 'Auto snapshot'),
          summary,
          manual,
          currentStep: currentStepRef.current,
          showFront: showFrontRef.current,
          state: snap,
        };
        inserted = true;
        const nextList = [version, ...prev];
        // Release image refs for any snapshots that fall off the tail so the
        // underlying bytes become eligible for GC.
        while (nextList.length > VERSION_HISTORY_MAX) {
          const evicted = nextList.pop();
          if (evicted) releaseBuilderState(evicted.state);
        }
        return nextList;
      });
      if (inserted) {
        lastAutoSnapshotAtRef.current = now;
        firstUnsavedEditAtRef.current = null;
      } else if (stashedForThisCapture) {
        // We stashed but then bailed — release the refs we just took.
        releaseBuilderState(stashedForThisCapture);
      }
    },
    [],
  );

  const saveManualVersion = useCallback(() => {
    captureVersion({ manual: true });
    toast.success('Version saved');
  }, [captureVersion]);

  const restoreVersion = useCallback(
    (versionId: string) => {
      const target = versions.find((v) => v.id === versionId);
      if (!target) return;
      const resolved = resolveBuilderState(target.state);
      _setStateRaw((current) => {
        if (!builderStatesEqual(current, resolved)) {
          undoStackRef.current.push(cloneBuilderState(current));
          if (undoStackRef.current.length > HISTORY_MAX) undoStackRef.current.shift();
          redoStackRef.current = [];
          syncHistoryAvailability();
        }
        return resolved;
      });
      toast.success('Restored version');
    },
    [versions, syncHistoryAvailability],
  );

  const removeVersion = useCallback((versionId: string) => {
    setVersions((prev) => {
      const target = prev.find((v) => v.id === versionId);
      if (target) releaseBuilderState(target.state);
      return prev.filter((v) => v.id !== versionId);
    });
  }, []);

  /* Auto-save on edit.
   * Strategy:
   *   - Skip until at least one real edit has landed (undo stack non-empty).
   *   - Debounce by VERSION_AUTOSAVE_DEBOUNCE_MS after the last state change so
   *     typing bursts collapse into a single snapshot.
   *   - Cap total deferral at VERSION_AUTOSAVE_MAX_INTERVAL_MS so continuous
   *     dragging / editing still gets periodic snapshots.
   * The cooldown inside captureVersion handles the "I just saved manually"
   * case so we don't immediately double-save.
   */
  useEffect(() => {
    if (undoStackRef.current.length === 0) return;

    const now = Date.now();
    if (firstUnsavedEditAtRef.current === null) {
      firstUnsavedEditAtRef.current = now;
    }
    const elapsed = now - firstUnsavedEditAtRef.current;
    const remainingToMax = Math.max(0, VERSION_AUTOSAVE_MAX_INTERVAL_MS - elapsed);
    const delay = Math.min(VERSION_AUTOSAVE_DEBOUNCE_MS, remainingToMax);

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    if (delay <= 0) {
      captureVersion({ manual: false });
      return;
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      captureVersion({ manual: false });
    }, delay);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [state, captureVersion]);

  /* Flush any pending autosave on unmount / navigation. */
  useEffect(
    () => () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    },
    [],
  );

  /**
   * Snap-collapse only when the user crosses from >= threshold to below it while shrinking.
   * Avoids calling collapse() on every resize tick while already below the threshold (reduces jank).
   */
  const handleLeftPanelResize = useCallback((size: number, prevSize: number | undefined) => {
    const panel = leftPanelRef.current;
    if (!panel || panel.isCollapsed()) return;
    if (prevSize === undefined) return;
    if (size > prevSize) return;
    if (prevSize < PANEL_SNAP_COLLAPSE_BELOW_PCT) return;
    if (size >= PANEL_SNAP_COLLAPSE_BELOW_PCT) return;
    queueMicrotask(() => {
      const p = leftPanelRef.current;
      if (p && !p.isCollapsed()) p.collapse();
    });
  }, []);

  useEffect(() => {
    syncHistoryAvailability();
  }, [syncHistoryAvailability, state]);

  useEffect(() => {
    if (!productId || !product) return;
    if (searchParams.get('flow') === 'packaging') {
      navigate('/packaging', { replace: true });
    }
  }, [productId, product, searchParams, navigate]);

  useEffect(() => {
    if (!product) return;
    /** Spec-only flow always opens on upload (step 9); do not restore a saved step from history. */
    if (techpackSpecFlow) return;

    const st = location.state as { builderFlow?: string; currentStep?: number } | undefined;

    const stepFromLocation = st?.currentStep;
    const stepFromHistory = window.history.state?.usr?.currentStep;
    const requestedStep =
      typeof stepFromLocation === 'number' ? stepFromLocation : stepFromHistory;

    if (typeof requestedStep === 'number' && requestedStep >= 1 && requestedStep <= builderSteps.length) {
      setCurrentStep(requestedStep);
      setVisitedSteps((prev) => {
        const visibleVisited = builderSteps
          .filter((item) => item.id <= requestedStep)
          .map((item) => item.id);
        return Array.from(new Set([...prev, ...visibleVisited]));
      });
    }
  }, [product, location.state, techpackSpecFlow]);

  useEffect(() => {
    if (!product) navigate('/catalog');
  }, [navigate, product]);

  useEffect(() => {
    const sync = () => {
      const w = window.innerWidth;
      if (w < 768) setLayoutTier('phone');
      else if (w < 1280) setLayoutTier('tablet');
      else setLayoutTier('desktop');
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  useEffect(() => {
    if (layoutTier === 'phone') {
      setLeftPanelCollapsed(false);
    }
  }, [layoutTier]);

  useEffect(() => {
    const id = `builder-step-${currentStep}`;
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    });
  }, [currentStep]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = editorScrollRef.current;
      if (el) el.scrollTop = 0;
    });
    return () => cancelAnimationFrame(id);
  }, [currentStep]);

  useEffect(() => {
    previewScaleRef.current = previewZoom / 100;
    previewZoomRef.current = previewZoom;
  }, [previewZoom]);

  useEffect(() => {
    if (layoutTier === 'phone') {
      setPreviewZoom((z) => Math.min(PREVIEW_ZOOM_MAX_PHONE, z));
    }
  }, [layoutTier]);

  useEffect(() => {
    const shell = previewShellRef.current;
    if (!shell) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const cap = layoutTier === 'phone' ? PREVIEW_ZOOM_MAX_PHONE : PREVIEW_ZOOM_MAX;
      setPreviewZoom((z) => {
        const d = e.deltaY > 0 ? -6 : 6;
        return Math.min(cap, Math.max(PREVIEW_ZOOM_MIN, z + d));
      });
    };
    shell.addEventListener('wheel', onWheel, { passive: false });
    return () => shell.removeEventListener('wheel', onWheel);
  }, [currentStep, layoutTier]);

  /** Phone: two-finger pinch to zoom the preview. */
  useEffect(() => {
    if (layoutTier !== 'phone') return;
    const el = previewShellRef.current;
    if (!el) return;
    const pinchRef = { d0: 0, z0: PREVIEW_ZOOM_DEFAULT, active: false };
    const dist = (t: TouchList) => {
      if (t.length < 2) return 0;
      const a = t[0];
      const b = t[1];
      return Math.hypot(a!.clientX - b!.clientX, a!.clientY - b!.clientY);
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const d = dist(e.touches);
        if (d > 0) {
          pinchRef.active = true;
          pinchRef.d0 = d;
          pinchRef.z0 = previewZoomRef.current;
        }
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!pinchRef.active || e.touches.length !== 2) return;
      const d = dist(e.touches);
      if (pinchRef.d0 < 8) return;
      const next = Math.round(pinchRef.z0 * (d / pinchRef.d0));
      const cap = PREVIEW_ZOOM_MAX_PHONE;
      setPreviewZoom(() => Math.min(cap, Math.max(PREVIEW_ZOOM_MIN, next)));
      e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchRef.active = false;
        pinchRef.d0 = 0;
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [layoutTier]);

  const prevPhoneEditorCollapsed = useRef(phoneEditorCollapsed);
  useEffect(() => {
    if (layoutTier === 'phone' && phoneEditorCollapsed && !prevPhoneEditorCollapsed.current) {
      setPreviewZoom((z) => Math.min(PREVIEW_ZOOM_MAX_PHONE, Math.max(z, 96)));
    }
    prevPhoneEditorCollapsed.current = phoneEditorCollapsed;
  }, [layoutTier, phoneEditorCollapsed]);

  const [networkOnline, setNetworkOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine,
  );
  const [saveError, setSaveError] = useState<'offline' | 'failed' | null>(null);

  useEffect(() => {
    const on = () => {
      setNetworkOnline(true);
      setSaveError((e) => (e === 'offline' ? null : e));
    };
    const off = () => setNetworkOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const handleSave = useCallback(
    async (showToast = true) => {
      if (!navigator.onLine) {
        setSaveError('offline');
        if (showToast) toast.error('Offline — draft not synced. Reconnect and try again.');
        return;
      }
      setSaveError(null);
      setSaving(true);
      try {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 420);
        });
        captureVersion({ manual: false });
        if (showToast) toast.success('Draft saved');
      } catch {
        setSaveError('failed');
        if (showToast) toast.error('Could not save — try again');
      } finally {
        setSaving(false);
      }
    },
    [captureVersion],
  );

  const retrySave = useCallback(() => {
    handleSave(true);
  }, [handleSave]);

  const shouldSkipStep = (stepId: number) =>
    builderSteps.find((item) => item.id === stepId)?.skipForGarmentTypes?.includes(state.garmentType);

  const techpackNavigationList = useMemo(() => {
    if (!techpackSpecFlow) return null as number[] | null;
    return TECHPACK_SPEC_FLOW_ORDER.filter(
      (id) =>
        !builderSteps
          .find((item) => item.id === id)
          ?.skipForGarmentTypes?.includes(state.garmentType),
    );
  }, [techpackSpecFlow, state.garmentType]);

  const firstBuilderNavStepId =
    techpackSpecFlow && techpackNavigationList && techpackNavigationList.length > 0
      ? techpackNavigationList[0]!
      : 1;

  useEffect(() => {
    techpackFlowInitRef.current = false;
  }, [productId]);

  useEffect(() => {
    if (!product || !techpackSpecFlow || techpackFlowInitRef.current) return;
    techpackFlowInitRef.current = true;
    setCurrentStep(9);
    setVisitedSteps((prev) => Array.from(new Set([...prev, 9])));
  }, [product, techpackSpecFlow]);

  const ensurePhoneEditorExpanded = useCallback(() => {
    if (layoutTier !== 'phone') return;
    setPhoneEditorCollapsed(false);
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        phoneEditorPanelRef.current?.expand();
        requestAnimationFrame(() => phoneEditorPanelRef.current?.expand());
      });
    });
  }, [layoutTier]);

  if (!product) return <PageLoadingFallback />;

  const step = builderSteps.find((item) => item.id === currentStep);
  const stepTitleLabel =
    techpackSpecFlow && currentStep === 9 ? 'Upload design' : step?.title ?? '';
  const stepDescriptionLabel =
    techpackSpecFlow && currentStep === 9
      ? 'Attach reference artwork or notes for your factory (spec-only — no on-shirt placement editor).'
      : step?.description ?? '';
  const progress =
    techpackSpecFlow && techpackNavigationList && techpackNavigationList.length > 0
      ? ((Math.max(0, techpackNavigationList.indexOf(currentStep)) + 1) /
          techpackNavigationList.length) *
        100
      : (currentStep / builderSteps.length) * 100;
  const primaryColor = state.colors[0]?.hex || '#5C7FB6';

  const visibleDetailKey = useMemo<DetailKey | null>(() => {
    if (currentStep === 1) return 'measurements';
    if (currentStep === 2) return 'fabric';
    if (currentStep === 3) return 'neck';
    if (currentStep === 4) return 'sleeves';
    if (currentStep === 5) return 'hem';
    if (currentStep === 6) return 'pockets';
    return null;
  }, [currentStep]);

  const visibleDetailText = visibleDetailKey ? state.extraDetails[visibleDetailKey] || '' : '';

  useEffect(() => {
    if (!visibleDetailKey) return;
    const key = visibleDetailKey;
    const curr = state.extraDetails[key] ?? '';
    const prevStored = prevExtraTextByDetailKeyRef.current[key];

    if (prevStored === undefined) {
      prevExtraTextByDetailKeyRef.current[key] = curr;
      return;
    }

    const wasEmpty = !prevStored.trim();
    const nowHas = !!curr.trim();
    prevExtraTextByDetailKeyRef.current[key] = curr;

    if (wasEmpty && nowHas) {
      const meta = DETAIL_META[key];
      setState((prevState) => ({
        ...prevState,
        detailPositions: {
          ...prevState.detailPositions,
          [key]: { top: meta.defaultTop, left: meta.defaultLeft },
        },
      }));
    }
  }, [visibleDetailKey, state.extraDetails]);

  const summaryStepNotes = useMemo(() => {
    const fromDetail = visibleDetailKey ? (state.extraDetails[visibleDetailKey] || '').trim() : '';
    if (fromDetail) return fromDetail;
    if (currentStep === 7) return (state.extraDetails.fading || '').trim();
    if (currentStep === 8) return (state.extraDetails.stitching || '').trim();
    if (currentStep === 10) return (state.extraDetails.labels || '').trim();
    if (currentStep === 11) return (state.extraDetails.packaging || '').trim();
    return '';
  }, [visibleDetailKey, currentStep, state.extraDetails]);

  const skipInitialAutoSave = useRef(true);
  useEffect(() => {
    if (skipInitialAutoSave.current) {
      skipInitialAutoSave.current = false;
      return;
    }
    const id = window.setTimeout(() => handleSave(false), 1200);
    return () => window.clearTimeout(id);
  }, [state, handleSave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        const t = e.target as HTMLElement | null;
        if (t?.closest('input, textarea, [contenteditable="true"]')) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave, undo, redo]);

  const markVisitedThrough = (stepId: number) => {
    if (techpackSpecFlow && techpackNavigationList && techpackNavigationList.length > 0) {
      const idx = techpackNavigationList.indexOf(stepId);
      if (idx >= 0) {
        const upThrough = techpackNavigationList.slice(0, idx + 1);
        setVisitedSteps((prev) => Array.from(new Set([...prev, ...upThrough])));
        return;
      }
    }
    const visibleUpTo = builderSteps
      .filter((item) => item.id <= stepId && !shouldSkipStep(item.id))
      .map((item) => item.id);

    setVisitedSteps((prev) => Array.from(new Set([...prev, ...visibleUpTo, stepId])));
  };

  const handleNext = () => {
    if (currentStep === 13) {
      navigate('/delivery', { state: { productId } });
      return;
    }

    if (techpackSpecFlow && techpackNavigationList && techpackNavigationList.length > 0) {
      const idx = techpackNavigationList.indexOf(currentStep);
      if (idx >= 0 && idx < techpackNavigationList.length - 1) {
        const next = techpackNavigationList[idx + 1]!;
        setCurrentStep(next);
        markVisitedThrough(next);
        handleSave(false);
        ensurePhoneEditorExpanded();
      }
      return;
    }

    let next = currentStep + 1;
    while (next <= builderSteps.length && shouldSkipStep(next)) next += 1;

    if (next <= builderSteps.length) {
      setCurrentStep(next);
      markVisitedThrough(next);
      handleSave(false);
      ensurePhoneEditorExpanded();
    }
  };

  const handleBack = () => {
    if (techpackSpecFlow && techpackNavigationList && techpackNavigationList.length > 0) {
      const idx = techpackNavigationList.indexOf(currentStep);
      if (idx > 0) {
        const prev = techpackNavigationList[idx - 1]!;
        setCurrentStep(prev);
        markVisitedThrough(prev);
        ensurePhoneEditorExpanded();
      }
      return;
    }

    let prev = currentStep - 1;
    while (prev >= 1 && shouldSkipStep(prev)) prev -= 1;
    if (prev >= 1) {
      setCurrentStep(prev);
      markVisitedThrough(prev);
      ensurePhoneEditorExpanded();
    }
  };

  useEffect(() => {
    if (currentStep === 9) return;
    setState((p) => (p.printsLayerSelectedId ? { ...p, printsLayerSelectedId: null } : p));
  }, [currentStep]);
  useEffect(() => {
    if (currentStep === 10) return;
    setState((p) => (p.labelLayerSelectedId ? { ...p, labelLayerSelectedId: null } : p));
  }, [currentStep]);
  useEffect(() => {
    if (currentStep === 11) return;
    setState((p) => (p.packagingLayerSelectedId ? { ...p, packagingLayerSelectedId: null } : p));
  }, [currentStep]);

  /** Continue / Back can change step while the phone sheet is collapsed; expand so the new step is visible. */
  const previousStepForPhoneExpandRef = useRef<number | null>(null);
  useEffect(() => {
    if (layoutTier !== 'phone') {
      previousStepForPhoneExpandRef.current = currentStep;
      return;
    }
    if (
      previousStepForPhoneExpandRef.current !== null &&
      previousStepForPhoneExpandRef.current !== currentStep
    ) {
      requestAnimationFrame(() => {
        phoneEditorPanelRef.current?.expand();
        requestAnimationFrame(() => phoneEditorPanelRef.current?.expand());
      });
    }
    previousStepForPhoneExpandRef.current = currentStep;
  }, [currentStep, layoutTier]);

  const handleStepClick = (stepId: number) => {
    if (!(visitedSteps.includes(stepId) && !shouldSkipStep(stepId))) return;
    /**
     * Canva-style sidebar: the configuration drawer only appears when you click a step on the rail.
     * Clicking the step that is already open toggles the drawer closed. Phone: bottom step icons
     * stay visible; the collapsible part is the configuration sheet, which opens when you pick a step.
     */
    if (layoutTier === 'phone') {
      const p = phoneEditorPanelRef.current;
      if (p?.isCollapsed()) p.expand();
    }
    const panel = leftPanelRef.current;
    if (layoutTier !== 'phone' && panel) {
      if (currentStep === stepId && !panel.isCollapsed()) {
        panel.collapse();
        return;
      }
      if (panel.isCollapsed()) {
        panel.expand();
      }
    }
    setCurrentStep(stepId);
  };

  const flushPendingDetailMove = () => {
    if (detailMoveRafRef.current != null) {
      cancelAnimationFrame(detailMoveRafRef.current);
      detailMoveRafRef.current = null;
    }
    const p = detailMovePendingRef.current;
    detailMovePendingRef.current = null;
    if (!p) return;
    _setStateRaw((prev) => ({
      ...prev,
      detailPositions: {
        ...prev.detailPositions,
        [p.key]: {
          top: `${Math.round(p.top)}px`,
          left: `${Math.round(p.left)}px`,
        },
      },
    }));
  };

  const scheduleDetailPositionUpdate = (key: DetailKey, left: number, top: number) => {
    detailMovePendingRef.current = { key, left, top };
    if (detailMoveRafRef.current != null) {
      cancelAnimationFrame(detailMoveRafRef.current);
    }
    detailMoveRafRef.current = requestAnimationFrame(() => {
      detailMoveRafRef.current = null;
      const pending = detailMovePendingRef.current;
      if (!pending) return;
      detailMovePendingRef.current = null;
      _setStateRaw((prev) => ({
        ...prev,
        detailPositions: {
          ...prev.detailPositions,
          [pending.key]: {
            top: `${Math.round(pending.top)}px`,
            left: `${Math.round(pending.left)}px`,
          },
        },
      }));
    });
  };

  const handleDetailPointerDown = (e: React.PointerEvent, key: DetailKey) => {
    e.preventDefault();
    e.stopPropagation();

    const positionRoot = detailPositionRootRef.current ?? previewShellRef.current;
    if (!positionRoot) return;

    detailGestureCleanupRef.current?.();
    detailGestureCleanupRef.current = null;
    if (detailMoveRafRef.current != null) {
      cancelAnimationFrame(detailMoveRafRef.current);
      detailMoveRafRef.current = null;
    }
    detailMovePendingRef.current = null;
    detailLastClampedPosRef.current = null;

    const shellRect = positionRoot.getBoundingClientRect();
    const card = e.currentTarget as HTMLElement;
    const cardRect = card.getBoundingClientRect();
    /** `shellRect` / `cardRect` are screen px (already include any CSS scale above). Convert to stage-local px by dividing by scale. */
    const s = Math.max(0.0001, previewScaleRef.current);

    try {
      card.setPointerCapture(e.pointerId);
      detailPointerCaptureRef.current = { el: card, pointerId: e.pointerId };
    } catch {
      detailPointerCaptureRef.current = null;
    }

    detailPendingDragRef.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      offset: {
        x: (e.clientX - cardRect.left) / s,
        y: (e.clientY - cardRect.top) / s,
      },
      initialLeftPx: Math.round((cardRect.left - shellRect.left) / s),
      initialTopPx: Math.round((cardRect.top - shellRect.top) / s),
    };
    activeDetailDragKeyRef.current = null;

    const thresholdPx =
      layoutTier === 'phone' ? Math.max(4, DETAIL_DRAG_THRESHOLD_PX - 4) : DETAIL_DRAG_THRESHOLD_PX;
    const thresholdSq = thresholdPx * thresholdPx;

    const onPointerMove = (ev: PointerEvent) => {
      let dragKey = activeDetailDragKeyRef.current;

      if (!dragKey) {
        const pending = detailPendingDragRef.current;
        if (!pending) return;
        const dx = ev.clientX - pending.startX;
        const dy = ev.clientY - pending.startY;
        if (dx * dx + dy * dy < thresholdSq) return;

        const keyForDrag = pending.key;
        dragKey = keyForDrag;
        activeDetailDragKeyRef.current = keyForDrag;
        detailPendingDragRef.current = null;
        detailDragOffsetRef.current = pending.offset;

        if (!dragUndoSnapshotRef.current) {
          dragUndoSnapshotRef.current = cloneBuilderState(stateRef.current);
          redoStackRef.current = [];
          queueMicrotask(syncHistoryAvailability);
        }
        _setStateRaw((prev) => ({
          ...prev,
          detailPositions: {
            ...prev.detailPositions,
            [keyForDrag]: {
              left: `${pending.initialLeftPx}px`,
              top: `${pending.initialTopPx}px`,
            },
          },
        }));
        setDraggingDetail(keyForDrag);
        if (typeof document !== 'undefined') {
          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';
          document.body.style.touchAction = 'none';
        }
      }

      const boundsEl = detailPositionRootRef.current ?? previewShellRef.current;
      if (!boundsEl || !dragKey) return;

      const bounds = boundsEl.getBoundingClientRect();
      const deleteRect = deleteZoneRef.current?.getBoundingClientRect();
      const off = detailDragOffsetRef.current;
      /** Convert screen px → stage-local px (CSS scale on the stage wrapper affects getBoundingClientRect output). */
      const s = Math.max(0.0001, previewScaleRef.current);

      /** Intentionally unclamped — user can drag details freely anywhere on (or off) the stage. */
      const newLeft = (ev.clientX - bounds.left) / s - off.x;
      const newTop = (ev.clientY - bounds.top) / s - off.y;

      detailLastClampedPosRef.current = { left: newLeft, top: newTop };
      lastPointerRef.current = { x: ev.clientX, y: ev.clientY };

      scheduleDetailPositionUpdate(dragKey, newLeft, newTop);

      /** Pointer-based delete test is zoom-independent and generous (works even when zoomed-out card is tiny). */
      const padHit = 36;
      if (deleteRect) {
        const over =
          ev.clientX >= deleteRect.left - padHit &&
          ev.clientX <= deleteRect.right + padHit &&
          ev.clientY >= deleteRect.top - padHit &&
          ev.clientY <= deleteRect.bottom + padHit;
        detailOverDeleteRef.current = over;
        setIsOverDeleteZone(over);
      }
    };

    const releasePointerCaptureIfNeeded = () => {
      const cap = detailPointerCaptureRef.current;
      detailPointerCaptureRef.current = null;
      if (!cap) return;
      try {
        if (cap.el.hasPointerCapture(cap.pointerId)) {
          cap.el.releasePointerCapture(cap.pointerId);
        }
      } catch {
        /* ignore */
      }
    };

    const detachDetailGesture = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUpOrCancel);
      window.removeEventListener('pointercancel', onPointerUpOrCancel);
      detailGestureCleanupRef.current = null;
      if (typeof document !== 'undefined') {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.style.touchAction = '';
      }
      releasePointerCaptureIfNeeded();
    };

    const onPointerUpOrCancel = () => {
      flushPendingDetailMove();
      const snap = dragUndoSnapshotRef.current;
      dragUndoSnapshotRef.current = null;
      if (snap) {
        _setStateRaw((current) => {
          if (!builderStatesEqual(snap, current)) {
            undoStackRef.current.push(snap);
            if (undoStackRef.current.length > HISTORY_MAX) undoStackRef.current.shift();
            redoStackRef.current = [];
            queueMicrotask(syncHistoryAvailability);
          }
          return current;
        });
      }
      const endedKey = activeDetailDragKeyRef.current;
      const dzEl = deleteZoneRef.current;
      const lp = lastPointerRef.current;
      const padHit = 36;
      let shouldDelete = detailOverDeleteRef.current;
      if (endedKey && dzEl) {
        const dr = dzEl.getBoundingClientRect();
        shouldDelete =
          lp.x >= dr.left - padHit &&
          lp.x <= dr.right + padHit &&
          lp.y >= dr.top - padHit &&
          lp.y <= dr.bottom + padHit;
      }
      detailLastClampedPosRef.current = null;
      if (endedKey && shouldDelete) {
        const meta = DETAIL_META[endedKey];
        setState((prev) => ({
          ...prev,
          extraDetails: { ...prev.extraDetails, [endedKey]: '' },
          detailPositions: {
            ...prev.detailPositions,
            [endedKey]: { top: meta.defaultTop, left: meta.defaultLeft },
          },
        }));
        toast.success('Detail removed');
      }
      detailOverDeleteRef.current = false;
      activeDetailDragKeyRef.current = null;
      detailPendingDragRef.current = null;
      setDraggingDetail(null);
      setIsOverDeleteZone(false);
      detachDetailGesture();
    };

    detailGestureCleanupRef.current = detachDetailGesture;

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUpOrCancel);
    window.addEventListener('pointercancel', onPointerUpOrCancel);
  };

  const renderAnnotation = (key: DetailKey, text: string) => {
    const position = state.detailPositions[key] || {
      top: DETAIL_META[key].defaultTop,
      left: DETAIL_META[key].defaultLeft,
    };
    const lineRight = DETAIL_META[key].lineSide === 'right';

    return (
      <div
        className={`pointer-events-auto absolute z-20 touch-none select-none will-change-transform ${
          draggingDetail === key
            ? 'z-[60] cursor-grabbing scale-[1.01] opacity-[0.98] shadow-[0_20px_50px_rgba(0,0,0,0.5)]'
            : 'cursor-grab transition-shadow duration-200 active:cursor-grabbing'
        }`}
        style={{
          top: position.top,
          left: position.left,
          WebkitTouchCallout: 'none',
          touchAction: 'none',
        }}
        onPointerDown={(e) => handleDetailPointerDown(e, key)}
      >
        {lineRight ? (
          <svg
            className="pointer-events-none absolute -right-12 top-1/2 -translate-y-1/2"
            width="48"
            height="2"
          >
            <line
              x1="0"
              y1="1"
              x2="48"
              y2="1"
              stroke="#FF3B30"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          </svg>
        ) : (
          <svg
            className="pointer-events-none absolute -left-12 top-1/2 -translate-y-1/2"
            width="48"
            height="2"
          >
            <line
              x1="0"
              y1="1"
              x2="48"
              y2="1"
              stroke="#FF3B30"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          </svg>
        )}
        <div
          /* `w-max` is the important bit: absolutely-positioned elements default
           * to `width: auto`, which is shrink-to-fit based on the *available*
           * horizontal space inside the containing block. So the same card
           * squashes as you drag it toward the right edge because there's less
           * room there. Using `max-content` makes the card size to its text
           * first and only get clipped by the max-width cap, no matter where
           * on the canvas it lives. */
          className="w-max max-w-[min(88vw,200px)] min-w-0 rounded-lg border border-dashed border-[#FF3B30] bg-black/88 px-2.5 py-1.5 backdrop-blur-md sm:max-w-[min(92vw,220px)] sm:rounded-xl sm:px-3 sm:py-2"
        >
          <div className="mb-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-[#FF3B30] sm:mb-1 sm:text-[9px] sm:tracking-[0.18em]">
            {DETAIL_META[key].title}
          </div>
          <div className="break-words text-[10px] leading-snug text-white [overflow-wrap:anywhere] sm:text-[11px] sm:leading-relaxed">
            {text.trim()}
          </div>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <MeasurementsStep
              garmentType={state.garmentType}
              fit={state.fit || 'regular'}
              onFitChange={(fit) =>
                setState((prev) => ({ ...prev, fit, measurements: prev.measurements }))
              }
              measurements={state.measurements}
              measurementUnit={state.measurementUnit}
              onMeasurementUnitChange={(unit) =>
                setState((prev) =>
                  prev.measurementUnit === unit ? prev : { ...prev, measurementUnit: unit },
                )
              }
              onMeasurementChange={(measurementId, size, value) =>
                setState((prev) => ({
                  ...prev,
                  measurements: {
                    ...prev.measurements,
                    [measurementId]: {
                      ...prev.measurements[measurementId],
                      [size]: value,
                    },
                  },
                }))
              }
            />
            <div>
              <Label
                htmlFor="measurements-notes"
                className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60"
              >
                Extra Details
              </Label>
              <Textarea
                id="measurements-notes"
                value={state.extraDetails.measurements || ''}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    extraDetails: {
                      ...prev.extraDetails,
                      measurements: e.target.value,
                    },
                  }))
                }
                className="min-h-[82px] border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/30"
                placeholder="Add any specific measurement requirements..."
              />
            </div>
          </div>
        );

      case 2: {
        const applyFabricHex = (hex: string) => {
          const n = normalizeHex6(hex);
          const match = fabricColors.find((c) => normalizeHex6(c.hex) === n);
          setState((prev) => ({ ...prev, colors: [{ hex: n, pantone: match?.pantone ?? '' }] }));
        };

        return (
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
                Fabric Type
              </Label>
              <Select
                value={state.fabricType}
                onValueChange={(value) => setState((prev) => ({ ...prev, fabricType: value }))}
              >
                <SelectTrigger className="h-9 border-white/10 bg-white/5 text-[11px] text-white">
                  <SelectValue placeholder="Select fabric" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#1A1A1A] text-white">
                  {FABRIC_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!techpackSpecFlow ? (
            <div>
              <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
                Colour Selection
              </Label>
              <StudioColorField
                value={state.colors[0]?.hex ?? '#FFFFFF'}
                onChange={applyFabricHex}
                mainColors={STUDIO_MAIN_COLORS}
                popularColors={STUDIO_POPULAR_COLORS}
                onClear={() => setState((prev) => ({ ...prev, colors: [] }))}
                clearVisible={!!state.colors[0]}
                clearLabel="Clear fabric colour"
              />
              {state.colors[0]?.pantone ? (
                <p className="mt-1 text-[10px] text-white/45">
                  Pantone reference: {state.colors[0].pantone}
                </p>
              ) : null}
            </div>
            ) : (
              <p className="text-[11px] leading-relaxed text-white/42">
                Fabric colour is specified in your notes or uploaded files. Use the first step to attach artwork
                and the fabric notes below for dye or Pantone callouts.
              </p>
            )}

            <div>
              <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
                GSM
              </Label>
              <Input
                value={state.gsm || ''}
                onChange={(e) => setState((prev) => ({ ...prev, gsm: e.target.value }))}
                className="h-8 border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/30 md:h-9"
                placeholder="180"
                type="number"
              />
            </div>

            <div>
              <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
                Extra Details
              </Label>
              <Textarea
                value={state.extraDetails.fabric || ''}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    extraDetails: { ...prev.extraDetails, fabric: e.target.value },
                  }))
                }
                className="min-h-[82px] border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/30"
                placeholder="Add specific fabric or colour requirements..."
              />
            </div>
          </div>
        );
      }

      case 3:
        if (shouldSkipStep(3)) return <EmptyStep text="No neck step for this garment type" />;
        return (
          <div className="space-y-4">
            <ChoiceStep
              label="Neck / Collar Type"
              options={neckOptions[state.garmentType] || []}
              selected={state.neckType}
              onSelect={(value) => setState((prev) => ({ ...prev, neckType: value }))}
              notes={state.extraDetails.neck || ''}
              onNotes={(value) =>
                setState((prev) => ({
                  ...prev,
                  extraDetails: { ...prev.extraDetails, neck: value },
                }))
              }
              placeholder="Add any specific neck or collar requirements..."
            />
            {!techpackSpecFlow ? (
              <TrimColorFamilyPicker
                label="Neck / collar trim colour"
                value={state.neckTrimColor}
                onChange={(hex) => setState((prev) => ({ ...prev, neckTrimColor: hex }))}
                onClear={() => setState((prev) => ({ ...prev, neckTrimColor: undefined }))}
              />
            ) : null}
          </div>
        );

      case 4:
        if (shouldSkipStep(4)) return <EmptyStep text="No sleeve step for this garment type" />;
        return (
          <div className="space-y-4">
            <ChoiceGrid
              label="Sleeve Type"
              options={sleeveTypeOptions.map((item) => ({ id: item.id, name: item.name }))}
              selected={state.sleeveType}
              onSelect={(value) => setState((prev) => ({ ...prev, sleeveType: value }))}
              columns="grid-cols-2"
            />
            {state.sleeveType !== 'sleeveless' && (
              <ChoiceGrid
                label="Sleeve Length"
                options={sleeveLengthOptions.map((item) => ({ id: item.id, name: item.name }))}
                selected={state.sleeveLength}
                onSelect={(value) => setState((prev) => ({ ...prev, sleeveLength: value }))}
                columns="grid-cols-3"
              />
            )}
            {!techpackSpecFlow ? (
              <TrimColorFamilyPicker
                label="Sleeve trim colour"
                value={state.sleeveTrimColor}
                onChange={(hex) => setState((prev) => ({ ...prev, sleeveTrimColor: hex }))}
                onClear={() => setState((prev) => ({ ...prev, sleeveTrimColor: undefined }))}
              />
            ) : null}
            <div>
              <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
                Extra Details
              </Label>
              <Textarea
                value={state.extraDetails.sleeves || ''}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    extraDetails: { ...prev.extraDetails, sleeves: e.target.value },
                  }))
                }
                className="min-h-[82px] border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/30"
                placeholder="Add sleeve requirements..."
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <ChoiceGrid
              label="Hem Type"
              options={hemOptions.map((item) => ({ id: item.id, name: item.name }))}
              selected={state.hemType}
              onSelect={(value) => setState((prev) => ({ ...prev, hemType: value }))}
              columns="grid-cols-2"
            />
            {state.sleeveType !== 'sleeveless' && (
              <ChoiceGrid
                label="Cuff Type"
                options={cuffOptions.map((item) => ({ id: item.id, name: item.name }))}
                selected={state.cuffType}
                onSelect={(value) => setState((prev) => ({ ...prev, cuffType: value }))}
                columns="grid-cols-2"
              />
            )}
            <div>
              <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
                Extra Details
              </Label>
              <Textarea
                value={state.extraDetails.hem || ''}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    extraDetails: { ...prev.extraDetails, hem: e.target.value },
                  }))
                }
                className="min-h-[82px] border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/30"
                placeholder="Add hem or cuff requirements..."
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <ChoiceGrid
              label="Pocket Type"
              options={pocketOptions.map((item) => ({ id: item.id, name: item.name }))}
              selected={state.pocketType}
              onSelect={(value) => setState((prev) => ({ ...prev, pocketType: value }))}
              columns="grid-cols-2"
            />
            <ChoiceGrid
              label="Zip Type"
              options={zipOptions.map((item) => ({ id: item.id, name: item.name }))}
              selected={state.zipType}
              onSelect={(value) => setState((prev) => ({ ...prev, zipType: value }))}
              columns="grid-cols-2"
            />
            {!techpackSpecFlow ? (
              <TrimColorFamilyPicker
                label="Pocket & zip trim colour"
                value={state.pocketTrimColor}
                onChange={(hex) => setState((prev) => ({ ...prev, pocketTrimColor: hex }))}
                onClear={() => setState((prev) => ({ ...prev, pocketTrimColor: undefined }))}
              />
            ) : null}
            <div>
              <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
                Extra Details
              </Label>
              <Textarea
                value={state.extraDetails.pockets || ''}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    extraDetails: { ...prev.extraDetails, pockets: e.target.value },
                  }))
                }
                className="min-h-[82px] border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/30"
                placeholder="Add pocket or zip requirements..."
              />
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <ChoiceGrid
              label="Fading treatment"
              options={fadingOptions.map((item) => ({ id: item.id, name: item.name }))}
              selected={state.fadingType}
              onSelect={(value) => setState((prev) => ({ ...prev, fadingType: value }))}
              columns="grid-cols-2"
            />
            <div>
              <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
                Extra Details
              </Label>
              <Textarea
                value={state.extraDetails.fading || ''}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    extraDetails: { ...prev.extraDetails, fading: e.target.value },
                  }))
                }
                className="min-h-[82px] border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/30"
                placeholder="Describe fade zones, intensity, or wash instructions..."
              />
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-4">
            <ChoiceGrid
              label="Stitching"
              options={stitchingOptions.map((item) => ({ id: item.id, name: item.name }))}
              selected={state.stitchingType}
              onSelect={(value) => setState((prev) => ({ ...prev, stitchingType: value }))}
              columns="grid-cols-2"
            />
            {!techpackSpecFlow ? (
              <TrimColorFamilyPicker
                label="Stitch / thread colour"
                value={state.stitchingColor}
                onChange={(hex) => setState((prev) => ({ ...prev, stitchingColor: hex }))}
                onClear={() => setState((prev) => ({ ...prev, stitchingColor: undefined }))}
              />
            ) : null}
            <div>
              <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
                Extra Details
              </Label>
              <Textarea
                value={state.extraDetails.stitching || ''}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    extraDetails: { ...prev.extraDetails, stitching: e.target.value },
                  }))
                }
                className="min-h-[82px] border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/30"
                placeholder="SPI, seam notes, contrast stitching details, etc..."
              />
            </div>
          </div>
        );

      case 9:
        if (techpackSpecFlow) {
          return (
            <TechPackReferenceUpload
              fileNamesText={state.referenceUploadFileNames ?? ''}
              notes={state.extraDetails.referenceUploadNotes ?? ''}
              onFileNamesChange={(names) =>
                setState((prev) => ({ ...prev, referenceUploadFileNames: names || undefined }))
              }
              onNotesChange={(value) =>
                setState((prev) => ({
                  ...prev,
                  extraDetails: { ...prev.extraDetails, referenceUploadNotes: value },
                }))
              }
            />
          );
        }
        return (
          <PrintsDesignStep
            elements={state.prints}
            onChange={(prints) => setState((prev) => ({ ...prev, prints }))}
            selectedLayerId={state.printsLayerSelectedId}
            onSelectedLayerIdChange={(id) =>
              setState((prev) => ({ ...prev, printsLayerSelectedId: id }))
            }
            usePhoneStrips={isPhone}
          />
        );

      case 10:
        return (
          <div className="space-y-4">
            <LabelsPackagingStep
              subStep="label"
              elements={state.labels}
              onElementsChange={(labels) => setState((prev) => ({ ...prev, labels }))}
              notes={state.extraDetails.labels || ''}
              onNotesChange={(value) =>
                setState((prev) => ({
                  ...prev,
                  extraDetails: { ...prev.extraDetails, labels: value },
                }))
              }
              planValue={state.labelType ?? 'woven'}
              onPlanChange={(labelType) =>
                setState((prev) => ({
                  ...prev,
                  labelType,
                  labels: labelType === 'none' ? [] : prev.labels,
                  labelLayerSelectedId: labelType === 'none' ? null : prev.labelLayerSelectedId,
                }))
              }
              selectedLayerId={state.labelLayerSelectedId}
              onSelectedLayerIdChange={(id) =>
                setState((prev) => ({ ...prev, labelLayerSelectedId: id }))
              }
              previewBaseColor={state.labelColor ?? '#FFFFFF'}
              onPreviewBaseColorChange={(hex) =>
                setState((prev) => ({ ...prev, labelColor: hex }))
              }
              usePhoneStrips={isPhone}
            />
          </div>
        );

      case 11:
        return (
          <div className="space-y-4">
            <LabelsPackagingStep
              subStep="packaging"
              elements={state.packaging}
              onElementsChange={(packaging) => setState((prev) => ({ ...prev, packaging }))}
              notes={state.extraDetails.packaging || ''}
              onNotesChange={(value) =>
                setState((prev) => ({
                  ...prev,
                  extraDetails: { ...prev.extraDetails, packaging: value },
                }))
              }
              planValue={state.packagingType ?? 'polybag'}
              onPlanChange={(packagingType) =>
                setState((prev) => ({
                  ...prev,
                  packagingType,
                  packaging: packagingType === 'none' ? [] : prev.packaging,
                  packagingLayerSelectedId: packagingType === 'none' ? null : prev.packagingLayerSelectedId,
                }))
              }
              selectedLayerId={state.packagingLayerSelectedId}
              onSelectedLayerIdChange={(id) =>
                setState((prev) => ({ ...prev, packagingLayerSelectedId: id }))
              }
              previewBaseColor={state.packagingColor ?? '#F5F5F5'}
              onPreviewBaseColorChange={(hex) =>
                setState((prev) => ({ ...prev, packagingColor: hex }))
              }
              usePhoneStrips={isPhone}
            />
          </div>
        );

      case 12: {
        const totalQty = ORDER_SIZE_KEYS.reduce(
          (sum, k) => sum + (state.quantityBySize[k] ?? 0),
          0,
        );
        return (
          <div className="space-y-4">
            <p className="text-[11px] leading-relaxed text-white/55">
              Enter how many units you want per size. Use 0 for sizes you do not need.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ORDER_SIZE_KEYS.map((size) => (
                <div key={size}>
                  <Label className="mb-1 block text-[9px] uppercase tracking-wider text-white/50">
                    {size.toUpperCase()}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="0"
                    value={
                      (state.quantityBySize[size] ?? 0) === 0
                        ? ''
                        : String(state.quantityBySize[size] ?? 0)
                    }
                    onChange={(e) => {
                      const t = e.target.value.trim();
                      if (t === '') {
                        setState((prev) => ({
                          ...prev,
                          quantityBySize: { ...prev.quantityBySize, [size]: 0 },
                        }));
                        return;
                      }
                      const raw = parseInt(t, 10);
                      const v = Number.isFinite(raw) ? Math.max(0, raw) : 0;
                      setState((prev) => ({
                        ...prev,
                        quantityBySize: { ...prev.quantityBySize, [size]: v },
                      }));
                    }}
                    className="h-9 border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/30"
                  />
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/80">
              Total units: <span className="font-semibold text-white">{totalQty}</span>
            </div>
          </div>
        );
      }

      case 13:
        return (
          <div className="space-y-4">
            <div className="space-y-2.5 rounded-lg border border-white/10 bg-white/5 p-4">
              <ReviewRow label="Garment Type" value={state.garmentType} />
              <ReviewRow label="Fit" value={state.fit || 'Not selected'} />
              <ReviewRow
                label="Measure in"
                value={state.measurementUnit === 'in' ? 'Inches' : 'Centimeters'}
              />
              <ReviewRow
                label="Colour"
                value={state.colors[0]?.hex || 'Not selected'}
                swatch={state.colors[0]?.hex}
              />
              <ReviewRow
                label="Fabric"
                value={state.fabricType?.replace('-', ' ') || 'Not selected'}
              />
              <ReviewRow
                label="Neck"
                value={state.neckType?.replace('-', ' ') || 'Not selected'}
                hidden={shouldSkipStep(3)}
              />
              <ReviewRow
                label="Sleeves"
                value={
                  state.sleeveType
                    ? `${state.sleeveType}${state.sleeveLength ? ` (${state.sleeveLength})` : ''}`
                    : 'Not selected'
                }
                hidden={shouldSkipStep(4)}
              />
              {state.fadingType ? (
                <ReviewRow label="Fading" value={state.fadingType.replace('-', ' ')} />
              ) : null}
              {state.stitchingType ? (
                <ReviewRow label="Stitching" value={state.stitchingType.replace('-', ' ')} />
              ) : null}
              {state.stitchingColor ? (
                <ReviewRow
                  label="Stitch / thread colour"
                  value={state.stitchingColor}
                  swatch={state.stitchingColor}
                />
              ) : null}
              {state.prints.length > 0
                ? state.prints.map((p, i) => (
                    <ReviewRow
                      key={p.id}
                      label={`Print ${i + 1}`}
                      value={`${describePrintMethodLabel(p.printMethod)} · ${
                        p.type === 'image'
                          ? 'Artwork'
                          : p.content.trim().slice(0, 36) + (p.content.trim().length > 36 ? '…' : '')
                      }`}
                    />
                  ))
                : null}
              <ReviewRow label="Neck label" value={formatPlanSummary('label', state.labelType)} />
              {state.labelColor ? (
                <ReviewRow label="Label colour" value={state.labelColor} swatch={state.labelColor} />
              ) : null}
              <ReviewRow label="Packaging" value={formatPlanSummary('packaging', state.packagingType)} />
              {state.packagingColor ? (
                <ReviewRow
                  label="Packaging colour"
                  value={state.packagingColor}
                  swatch={state.packagingColor}
                />
              ) : null}
              <ReviewRow
                label="Order quantities (total units)"
                value={String(
                  ORDER_SIZE_KEYS.reduce((sum, k) => sum + (state.quantityBySize[k] ?? 0), 0),
                )}
              />
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => setShowDownloadModal(true)}
                className="h-11 w-full bg-[#FF3B30] text-xs font-semibold hover:bg-[#FF3B30]/90"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                DOWNLOAD TECH PACK PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSave(true)}
                className="h-11 w-full border-white/20 text-xs !text-white hover:bg-white/10"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                SAVE AS DRAFT
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const isPhone = layoutTier === 'phone';
  /** Uniform square hit areas for phone top bar (Canva-style); preview swatches stay smaller in the center. */
  const phoneNavIconCell =
    'flex size-14 min-h-14 min-w-14 shrink-0 items-center justify-center rounded-xl';
  /** `size-*` so Button’s svg rule does not force Lucide icons to `size-4`. */
  const phoneNavIconClass = 'size-8';
  const phoneFrameClass = isPhone
    ? phoneEditorCollapsed
      ? PHONE_PREVIEW_FRAME_EXPANDED_CLASS
      : PHONE_PREVIEW_FRAME_CLASS
    : '';
  const previewZoomMax = isPhone ? PREVIEW_ZOOM_MAX_PHONE : PREVIEW_ZOOM_MAX;
  /** Prints / label / packaging editors extend below the canvas (delete zone, handles); hidden overflow would clip them. */
  const previewSurfaceNeedsVisibleOverflow =
    draggingDetail ||
    (!techpackSpecFlow && currentStep === 9) ||
    currentStep === 10 ||
    currentStep === 11;

  const visibleBuilderSteps =
    techpackSpecFlow && techpackNavigationList && techpackNavigationList.length > 0
      ? techpackNavigationList
          .map((id) => builderSteps.find((s) => s.id === id))
          .filter((s): s is (typeof builderSteps)[number] => Boolean(s))
      : builderSteps.filter((item) => !shouldSkipStep(item.id));

  const phoneProcessStepCount =
    techpackSpecFlow && techpackNavigationList && techpackNavigationList.length > 0
      ? `${Math.max(0, techpackNavigationList.indexOf(currentStep)) + 1} / ${techpackNavigationList.length}`
      : `${currentStep} / ${builderSteps.length}`;

  const currentVisibleStep = useMemo(
    () => visibleBuilderSteps.find((s) => s.id === currentStep),
    [visibleBuilderSteps, currentStep],
  );
  const phoneProcessTitle = currentVisibleStep
    ? stepTabTitle(currentVisibleStep, techpackSpecFlow)
    : 'Step';

  const renderSummaryBody = () => (
    <div className="space-y-4 text-sm">
        <SpecRow label="Product" value={product.name} />
        <SpecRow label="Garment Type" value={state.garmentType} capitalize />
        {state.fit ? <SpecRow label="Fit" value={state.fit} capitalize /> : null}
        <SpecRow
          label="Measurement"
          value={state.measurementUnit === 'in' ? 'Inches' : 'Centimeters'}
        />
        {state.fabricType ? (
          <SpecRow label="Fabric" value={state.fabricType.replace('-', ' ')} capitalize />
        ) : null}
        {state.gsm ? <SpecRow label="GSM" value={state.gsm} /> : null}

        {state.colors[0] ? (
          <div className="border-b border-white/10 pb-4">
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">Colour</div>
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 flex-shrink-0 rounded border border-white/20"
                style={{ backgroundColor: state.colors[0].hex }}
              />
              <div>
                <div className="text-xs font-semibold text-white">{state.colors[0].hex}</div>
                {state.colors[0].pantone ? (
                  <div className="text-[10px] text-white/50">{state.colors[0].pantone}</div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {state.neckType ? (
          <SpecRow label="Neck" value={state.neckType.replace('-', ' ')} capitalize />
        ) : null}
        {state.sleeveType ? (
          <SpecRow
            label="Sleeves"
            value={`${state.sleeveType}${
              state.sleeveLength ? ` (${state.sleeveLength})` : ''
            }`}
            capitalize
          />
        ) : null}
        {state.hemType ? <SpecRow label="Hem" value={state.hemType} capitalize /> : null}
        {state.cuffType ? <SpecRow label="Cuffs" value={state.cuffType} capitalize /> : null}
        {state.pocketType ? <SpecRow label="Pockets" value={state.pocketType} capitalize /> : null}
        {state.zipType ? <SpecRow label="Zip" value={state.zipType} capitalize /> : null}
        {state.fadingType ? (
          <SpecRow label="Fading" value={state.fadingType.replace('-', ' ')} capitalize />
        ) : null}
        {state.stitchingType ? (
          <SpecRow label="Stitching" value={state.stitchingType.replace('-', ' ')} capitalize />
        ) : null}
        {state.stitchingColor ? (
          <div className="border-b border-white/10 pb-4">
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">Stitch colour</div>
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 flex-shrink-0 rounded border border-white/20"
                style={{ backgroundColor: state.stitchingColor }}
              />
              <span className="text-sm font-semibold text-white">{state.stitchingColor}</span>
            </div>
          </div>
        ) : null}
        {state.neckTrimColor ? (
          <div className="border-b border-white/10 pb-4">
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">Neck trim</div>
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 flex-shrink-0 rounded border border-white/20"
                style={{ backgroundColor: state.neckTrimColor }}
              />
              <span className="text-sm font-semibold text-white">{state.neckTrimColor}</span>
            </div>
          </div>
        ) : null}
        {state.sleeveTrimColor ? (
          <div className="border-b border-white/10 pb-4">
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">Sleeve trim</div>
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 flex-shrink-0 rounded border border-white/20"
                style={{ backgroundColor: state.sleeveTrimColor }}
              />
              <span className="text-sm font-semibold text-white">{state.sleeveTrimColor}</span>
            </div>
          </div>
        ) : null}
        {state.pocketTrimColor ? (
          <div className="border-b border-white/10 pb-4">
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">Pocket / zip trim</div>
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 flex-shrink-0 rounded border border-white/20"
                style={{ backgroundColor: state.pocketTrimColor }}
              />
              <span className="text-sm font-semibold text-white">{state.pocketTrimColor}</span>
            </div>
          </div>
        ) : null}
        {state.prints.length > 0
          ? state.prints.map((p, i) => (
              <SpecRow
                key={p.id}
                label={`Print ${i + 1}`}
                value={`${describePrintMethodLabel(p.printMethod)} — ${
                  p.type === 'image'
                    ? 'Artwork'
                    : p.content.trim().slice(0, 48) + (p.content.trim().length > 48 ? '…' : '')
                }`}
              />
            ))
          : null}
        <SpecRow label="Neck label" value={formatPlanSummary('label', state.labelType)} />
        {state.labelColor ? (
          <div className="border-b border-white/10 pb-4">
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">Label colour</div>
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 flex-shrink-0 rounded border border-white/20"
                style={{ backgroundColor: state.labelColor }}
              />
              <span className="text-sm font-semibold text-white">{state.labelColor}</span>
            </div>
          </div>
        ) : null}
        <SpecRow label="Packaging" value={formatPlanSummary('packaging', state.packagingType)} />
        {state.packagingColor ? (
          <div className="border-b border-white/10 pb-4">
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">Packaging colour</div>
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 flex-shrink-0 rounded border border-white/20"
                style={{ backgroundColor: state.packagingColor }}
              />
              <span className="text-sm font-semibold text-white">{state.packagingColor}</span>
            </div>
          </div>
        ) : null}
        <div className="border-b border-white/10 pb-4">
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">Order quantities</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-white/85 sm:grid-cols-3">
            {ORDER_SIZE_KEYS.map((k) => (
              <div key={k}>
                <span className="text-white/50">{k.toUpperCase()}</span>{' '}
                <span className="font-medium text-white">{state.quantityBySize[k] ?? 0}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-sm font-semibold text-white">
            Total units:{' '}
            {ORDER_SIZE_KEYS.reduce((sum, k) => sum + (state.quantityBySize[k] ?? 0), 0)}
          </div>
        </div>

        {summaryStepNotes ? (
          <div className="border-b border-white/10 pb-4">
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">
              Step notes
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-white/80">
              {summaryStepNotes}
            </div>
          </div>
        ) : null}
    </div>
  );

  const previewSurfaceStyle: CSSProperties = {
    backgroundColor:
      previewBackground === 'transparent'
        ? 'transparent'
        : previewBackground === 'white'
          ? '#FFFFFF'
          : '#000000',
    backgroundImage:
      previewBackground === 'transparent'
        ? 'linear-gradient(45deg, #2a2a2a 25%, transparent 25%, transparent 75%, #2a2a2a 75%, #2a2a2a), linear-gradient(45deg, #2a2a2a 25%, transparent 25%, transparent 75%, #2a2a2a 75%, #2a2a2a)'
        : 'none',
    backgroundSize: previewBackground === 'transparent' ? '20px 20px' : 'auto',
    backgroundPosition: previewBackground === 'transparent' ? '0 0, 10px 10px' : '0 0',
  };

  const renderEditorMain = (opts?: { leftPanelCollapse?: boolean }) => {
    const showLeftCollapse = Boolean(opts?.leftPanelCollapse);
    /** Laptop / tablet: pinned to the bottom of the sidebar (not inside the scroll stack). Phone: stays below step content inside the scroll area. */
    const editorNavFooter = (
      <div
        className={cn(
          'border-t border-white/[0.08] bg-[#0a0a0a]/50 pt-4',
          isPhone
            ? 'mt-5 mb-[max(0.5rem,env(safe-area-inset-bottom,0px))] rounded-xl px-0.5 pb-1'
            : 'shrink-0 px-3 pb-4 pt-3.5 sm:px-4 md:px-4 lg:px-5',
        )}
      >
        <div className="flex gap-2.5">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === firstBuilderNavStepId}
            className={cn(
              'h-9 flex-1 rounded-xl border-white/15 bg-white/[0.04] text-[11px] font-semibold !text-white hover:bg-white/10 disabled:opacity-30',
              isPhone && 'min-h-11',
            )}
          >
            <ChevronLeft className="mr-0.5 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            className={cn(
              'h-9 flex-1 rounded-xl bg-[#CC2D24] text-[11px] font-semibold hover:bg-[#CC2D24]/90',
              isPhone && 'min-h-11',
            )}
          >
            {currentStep === 13 ? 'Order' : 'Continue'}
            <ChevronRight className="ml-0.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    );

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={editorScrollRef}
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-4 lg:p-5',
            isPhone && 'px-3.5 py-3',
          )}
        >
          {isPhone ? (
            <div className="mb-3 flex min-w-0 items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
              <div className="min-w-0 text-[8px] font-bold uppercase tracking-[0.2em] text-[#CC2D24]">
                Step {phoneProcessStepCount}
              </div>
              <button
                type="button"
                onClick={() => phoneEditorPanelRef.current?.collapse()}
                className="builder-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/55 hover:bg-white/[0.06] hover:text-white"
                aria-label="Close configuration panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          {showLeftCollapse && !isPhone ? (
            <div className="mb-3 min-w-0 sm:mb-4">
                <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24] md:text-[10px]">
                  {stepTitleLabel}
                </div>
                <button
                  type="button"
                  onClick={() => leftPanelRef.current?.collapse()}
                  className={cn(
                    'builder-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/55 hover:bg-white/[0.06] hover:text-white md:h-9 md:w-9',
                  )}
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4 md:h-[18px] md:w-[18px]" />
                </button>
              </div>
              <h2 className="break-words font-['Plus_Jakarta_Sans',sans-serif] text-[15px] font-extrabold leading-tight tracking-[-0.5px] text-white sm:text-[16px] md:text-[17px] xl:text-[18px]">
                {stepTitleLabel.toUpperCase()}
              </h2>
            </div>
          ) : !isPhone ? (
            <>
              <div className="mb-1 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24] md:text-[10px]">
                {stepTitleLabel}
              </div>
              <h2 className="mb-1.5 font-['Plus_Jakarta_Sans',sans-serif] text-[16px] font-extrabold tracking-[-0.5px] text-white md:mb-2.5 md:text-[17px] xl:text-[18px]">
                {stepTitleLabel.toUpperCase()}
              </h2>
            </>
          ) : (
            <div className="mb-3 min-w-0">
              <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-[15px] font-extrabold leading-tight tracking-[-0.4px] text-white">
                {stepTitleLabel.toUpperCase()}
              </h2>
            </div>
          )}
          <p
            className={cn(
              'mb-4 text-[11px] leading-relaxed text-white/55 md:mb-5 md:text-[11px]',
              isPhone && 'mb-3',
            )}
          >
            {stepDescriptionLabel}
          </p>
          {renderStepContent()}
          {isPhone ? editorNavFooter : null}
        </div>
        {!isPhone ? editorNavFooter : null}
      </div>
    );
  };

  const livePreviewBlock = (
    <div
      className={cn(
        'flex min-h-0 flex-col bg-[#0F0F0F]',
        previewSurfaceNeedsVisibleOverflow && 'overflow-visible',
        isPhone ? 'h-full min-h-0 w-full min-w-0 flex-1' : 'h-full min-h-0 min-w-0 flex-1',
      )}
    >
      <div
        ref={previewShellRef}
        className={cn(
          'relative flex min-h-0 flex-1 flex-col',
          isPhone && draggingDetail && 'touch-none',
        )}
        style={previewSurfaceStyle}
      >
        <div
          className={cn(
            'pointer-events-none absolute z-[38] flex flex-col gap-1',
            isPhone ? 'right-3 top-1.5' : 'right-2 top-2 sm:right-3 sm:top-3',
          )}
        >
          <div
            className={cn(
              'pointer-events-auto flex flex-col gap-1 rounded-xl border border-white/10 bg-black/45 shadow-[0_6px_20px_rgba(0,0,0,0.35)] backdrop-blur-md',
              isPhone ? 'p-1.5' : 'p-1',
            )}
          >
            <button
              type="button"
              onClick={() => setShowFront(true)}
              className={cn(
                'builder-focus flex flex-col items-center justify-center rounded-lg font-bold uppercase leading-tight tracking-wide transition-colors',
                isPhone
                  ? 'min-h-[2.35rem] min-w-[3.1rem] px-2 py-1 text-[9px]'
                  : 'min-h-[1.75rem] min-w-[2.6rem] px-1.5 py-0.5 text-[7px] sm:min-h-[2rem] sm:min-w-[2.85rem] sm:px-2 sm:py-1 sm:text-[8px]',
                showFront
                  ? 'bg-[#CC2D24] text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white',
              )}
            >
              Front
            </button>
            <button
              type="button"
              onClick={() => setShowFront(false)}
              className={cn(
                'builder-focus flex flex-col items-center justify-center rounded-lg font-bold uppercase leading-tight tracking-wide transition-colors',
                isPhone
                  ? 'min-h-[2.35rem] min-w-[3.1rem] px-2 py-1 text-[9px]'
                  : 'min-h-[1.75rem] min-w-[2.6rem] px-1.5 py-0.5 text-[7px] sm:min-h-[2rem] sm:min-w-[2.85rem] sm:px-2 sm:py-1 sm:text-[8px]',
                !showFront
                  ? 'bg-[#CC2D24] text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white',
              )}
            >
              Back
            </button>
          </div>
        </div>

        <div
          className={cn(
            'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
            previewSurfaceNeedsVisibleOverflow && 'overflow-visible',
          )}
        >
          <div
            className={cn(
              'relative flex min-h-full min-w-full flex-1 items-center justify-center px-2 py-6 sm:px-4 sm:py-8',
              isPhone && 'px-1.5 py-5',
            )}
            onPointerDown={(e) => {
              if (currentStep !== 9 && currentStep !== 10 && currentStep !== 11) return;
              const t = e.target as HTMLElement;
              if (
                t.closest('[data-print-id]') ||
                t.closest('[data-surface-id]') ||
                t.closest('[data-handles]') ||
                t.closest('[data-inline-toolbar]')
              ) {
                return;
              }
              if (currentStep === 9) {
                setState((prev) => ({ ...prev, printsLayerSelectedId: null }));
              } else if (currentStep === 10) {
                setState((prev) => ({ ...prev, labelLayerSelectedId: null }));
              } else {
                setState((prev) => ({ ...prev, packagingLayerSelectedId: null }));
              }
            }}
          >
          <div
            ref={previewStageRef}
            className="relative flex items-center justify-center"
            style={{
              transform: `scale(${previewZoom / 100})`,
              transformOrigin: 'center center',
              transition: draggingDetail ? 'none' : 'transform 120ms ease-out',
            }}
          >
        <div className="relative flex min-h-0 w-full max-w-full min-w-0 flex-col items-center justify-center">
        {currentStep !== 1 &&
        currentStep !== 9 &&
        currentStep !== 10 &&
        currentStep !== 11 &&
        currentStep !== 12 ? (
          <div
            ref={detailPositionRootRef}
            className="pointer-events-none absolute inset-0 z-[30] overflow-visible"
          >
            {showExtraDetails && visibleDetailKey && visibleDetailText.trim()
              ? renderAnnotation(visibleDetailKey, visibleDetailText)
              : null}
          </div>
        ) : null}
        <div
          className={cn(
            'relative z-20 flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col items-center justify-center sm:py-1',
            isPhone ? 'py-0' : 'py-0.5',
            previewSurfaceNeedsVisibleOverflow ? 'overflow-visible' : 'overflow-hidden',
          )}
        >
          {currentStep === 1 ? (
            <div
              className={cn(
                'flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-1',
                isPhone && 'px-0',
              )}
            >
              <MeasurementPreview
                imgClassName={isPhone ? MEASUREMENT_GUIDE_CLASS_PHONE : PREVIEW_STAGE_CLASS}
              />
            </div>
          ) : currentStep === 9 ? (
            <div
              className={cn(
                'relative flex h-full min-h-0 w-full min-w-0 flex-1 items-center justify-center overflow-visible px-1',
                isPhone && `relative ${phoneFrameClass} overflow-visible`,
                !isPhone &&
                  'max-md:max-w-[min(100%,260px)] max-md:max-h-[min(44dvh,360px)] md:max-w-[min(100%,340px)] md:max-h-[min(44vh,380px)] lg:max-w-[min(100%,380px)] lg:max-h-[min(46vh,420px)] xl:max-w-[min(100%,420px)] xl:max-h-[min(50vh,460px)] 2xl:max-w-[min(100%,460px)] 2xl:max-h-[min(56vh,520px)] mx-auto',
              )}
            >
              <PrintsDesignPreview
                className="h-full max-h-full w-full max-w-full"
                elements={state.prints}
                onChange={(prints) => setState((prev) => ({ ...prev, prints }))}
                selectedLayerId={state.printsLayerSelectedId}
                onSelectedLayerIdChange={(id) =>
                  setState((prev) => ({ ...prev, printsLayerSelectedId: id }))
                }
                liveCanvasScale={previewZoom / 100}
                phoneConfigSheetCollapsed={isPhone && phoneEditorCollapsed}
                editable
              />
            </div>
          ) : currentStep === 10 ? (
            <div
              className={cn(
                'flex max-h-full w-full min-w-0 max-w-full flex-1 cursor-default items-center justify-center overflow-visible px-1',
                isPhone && phoneFrameClass,
              )}
            >
              <LabelPreview
                color={state.labelColor ?? '#FFFFFF'}
                elements={state.labels}
                onElementsChange={(labels) => setState((prev) => ({ ...prev, labels }))}
                selectedId={state.labelLayerSelectedId}
                onSelectedIdChange={(id) =>
                  setState((prev) => ({ ...prev, labelLayerSelectedId: id }))
                }
                liveCanvasScale={previewZoom / 100}
                phoneConfigSheetCollapsed={isPhone && phoneEditorCollapsed}
              />
            </div>
          ) : currentStep === 11 ? (
            <div
              className={cn(
                'flex max-h-full w-full min-w-0 max-w-full flex-1 cursor-default items-center justify-center overflow-visible px-1',
                isPhone && phoneFrameClass,
              )}
            >
              <PackagingPreview
                color={state.packagingColor ?? '#F5F5F5'}
                elements={state.packaging}
                onElementsChange={(packaging) =>
                  setState((prev) => ({ ...prev, packaging }))
                }
                selectedId={state.packagingLayerSelectedId}
                onSelectedIdChange={(id) =>
                  setState((prev) => ({ ...prev, packagingLayerSelectedId: id }))
                }
                liveCanvasScale={previewZoom / 100}
                phoneConfigSheetCollapsed={isPhone && phoneEditorCollapsed}
              />
            </div>
          ) : (
            <div
              className={cn(
                'relative flex min-h-0 w-full flex-1 items-center justify-center px-1',
                draggingDetail ? 'overflow-visible' : 'overflow-hidden',
                isPhone && 'px-0',
              )}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-radial from-white/5 to-transparent blur-3xl" />
              <img
                src={imgBlueTshirt}
                alt="Tech pack preview"
                className={cn(
                  'relative z-[1] object-contain',
                  isPhone
                    ? phoneEditorCollapsed
                      ? 'h-auto w-auto max-h-[min(50dvh,420px)] max-w-[min(100%,92vw,360px)]'
                      : 'h-auto w-auto max-h-[min(42dvh,340px)] max-w-[min(100%,88vw,300px)]'
                    : PREVIEW_STAGE_CLASS,
                )}
                style={{ filter: `hue-rotate(${getHueRotation(primaryColor)}deg)` }}
              />
            </div>
          )}
        </div>
          </div>
          </div>
          </div>
        </div>

        {!isPhone ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[36] flex flex-wrap items-end justify-between gap-1.5 px-1.5 pb-1.5 sm:gap-2 sm:px-3 sm:pb-3">
            <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/12 bg-black/55 px-1.5 py-1 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:gap-2 sm:px-2.5 sm:py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Zoom out"
                className="h-7 w-7 shrink-0 p-0 !text-white/80 hover:bg-white/10 hover:!text-white sm:h-8 sm:w-8"
                onClick={() => setPreviewZoom((z) => Math.max(PREVIEW_ZOOM_MIN, z - 10))}
              >
                <Minus className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              </Button>
              <input
                aria-label="Canvas zoom"
                className="h-1 w-[3rem] cursor-pointer accent-[#CC2D24] sm:w-[5.5rem]"
                type="range"
                min={PREVIEW_ZOOM_MIN}
                max={previewZoomMax}
                step={1}
                value={Math.min(previewZoom, previewZoomMax)}
                onChange={(e) => setPreviewZoom(Number(e.target.value))}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Zoom in"
                className="h-7 w-7 shrink-0 p-0 !text-white/80 hover:bg-white/10 hover:!text-white sm:h-8 sm:w-8"
                onClick={() => setPreviewZoom((z) => Math.min(previewZoomMax, z + 10))}
              >
                <Plus className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              </Button>
              <span className="min-w-0 min-w-[2.5rem] text-center text-[10px] font-semibold tabular-nums text-white/75 sm:min-w-[2.75rem] sm:text-[11px]">
                {Math.min(previewZoom, previewZoomMax)}%
              </span>
              <span className="hidden max-w-[5.5rem] border-l border-white/10 pl-2 text-[8px] leading-tight text-white/35 lg:inline">
                Ctrl + scroll
              </span>
            </div>
            <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-white/12 bg-black/55 px-2 py-1 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:gap-2.5 sm:px-3 sm:py-2">
              <CircularProgress value={progress} compact />
              <div>
                <div className="text-[11px] font-bold tabular-nums text-white sm:text-xs">
                  {Math.round(progress)}%
                </div>
                <div className="hidden text-[7px] font-semibold uppercase tracking-wider text-white/35 sm:block sm:text-[8px]">
                  Complete
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {draggingDetail && currentStep < 9 ? (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 z-[55] flex justify-center px-2',
              isPhone ? 'bottom-8' : 'bottom-16 sm:bottom-20',
            )}
          >
            <div
              ref={deleteZoneRef}
              className={cn(
                'builder-delete-zone pointer-events-auto flex min-w-[160px] items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.28)] transition-all duration-200 max-md:min-w-[128px] max-md:gap-1.5 max-md:rounded-xl max-md:px-2.5 max-md:py-1.5 max-md:shadow-[0_8px_24px_rgba(0,0,0,0.25)] motion-reduce:transition-none motion-reduce:transform-none',
                isOverDeleteZone
                  ? 'scale-105 border-[#FF3B30] bg-[#FF3B30]/15 text-white max-md:scale-100'
                  : 'border-white/20 bg-black/50 text-white/70',
              )}
            >
              <Trash2
                className={cn(
                  'h-4 w-4 max-md:h-3 max-md:w-3',
                  isOverDeleteZone && 'animate-pulse',
                )}
              />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] max-md:text-[8px] max-md:tracking-[0.14em]">
                {isOverDeleteZone ? 'Release to delete' : 'Drag here'}
              </span>
            </div>
          </div>
        ) : null}

        {isPhone && phoneEditorCollapsed ? (
          <div className="pointer-events-auto absolute inset-x-0 bottom-12 z-[37] flex justify-center px-4">
            <Button
              type="button"
              onClick={() => phoneEditorPanelRef.current?.expand()}
              className="h-9 min-h-9 rounded-full border border-white/18 bg-[#141414]/95 px-5 text-[11px] font-semibold text-white shadow-[0_8px_28px_rgba(0,0,0,0.4)] backdrop-blur-md"
            >
              Edit step
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'builder-surface flex min-h-0 min-w-0 max-w-[100vw] flex-col overflow-x-clip bg-[#0F0F0F]',
        'h-[100dvh] max-h-[100dvh] min-h-0 pt-[max(0px,env(safe-area-inset-top))] pb-[max(0px,env(safe-area-inset-bottom))] pl-[max(0px,env(safe-area-inset-left))] pr-[max(0px,env(safe-area-inset-right))]',
      )}
    >
      {!(isPhone && currentStep === 13) ? (
      <div
        className={cn(
          'relative flex border-b border-white/[0.09] bg-[#0c0c0c]',
          /** Above portaled design toolbars (z-[200]) so nav + dropdown trigger stay tappable. */
          isPhone && 'z-[220]',
          isPhone
            ? 'min-h-[5.25rem] items-center border-white/[0.06] py-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]'
            : 'flex-wrap items-center gap-2 px-2 py-2 sm:gap-3 sm:px-4 sm:py-2.5 md:px-5',
        )}
      >
        {isPhone ? (
          <div
            className="no-scrollbar flex w-full min-w-0 flex-1 items-center gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch]"
          >
            <div className="grid shrink-0 grid-cols-2 gap-0.5" role="toolbar" aria-label="Project">
              <Button
                variant="ghost"
                size="sm"
                asChild
                aria-label="Back to catalog"
                className={cn(
                  phoneNavIconCell,
                  'p-0 !text-white/60 hover:bg-white/10 hover:!text-white active:bg-white/[0.08]',
                )}
              >
                <Link to="/catalog" className="flex size-full items-center justify-center">
                  <ArrowLeft className={phoneNavIconClass} strokeWidth={2.25} />
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  phoneNavIconCell,
                  'relative z-[1] p-0 !text-white/75 hover:bg-white/10 hover:!text-white active:bg-white/[0.08]',
                )}
                aria-label="Edit project name"
                title="Edit name"
                onClick={() => setIsEditingName(true)}
              >
                <SquarePen className={phoneNavIconClass} strokeWidth={2.25} />
              </Button>
            </div>

            {isEditingName ? (
              <div className="flex min-w-0 flex-1 justify-center px-2">
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onBlur={() => setIsEditingName(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                  className="h-11 min-h-11 w-full max-w-[min(100%,18rem)] rounded-xl border-white/20 bg-white/5 px-3 text-[14px] font-semibold text-white"
                  autoFocus
                />
              </div>
            ) : (
              <div
                className="flex min-w-0 flex-1 justify-center px-2"
                role="group"
                aria-label="Preview background"
              >
                <div className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl border border-white/12 bg-white/[0.06] px-1.5 shadow-inner">
                  {(['black', 'white', 'transparent'] as const).map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => setPreviewBackground(bg)}
                      title={bg}
                      aria-label={`Background ${bg}`}
                      className={cn(
                        'builder-focus press-feedback size-8 shrink-0 rounded-md border-2 transition-transform active:scale-95',
                        previewBackground === bg
                          ? 'border-[#CC2D24] ring-1 ring-[#CC2D24]/35'
                          : 'border-transparent hover:border-white/25',
                      )}
                      style={
                        bg === 'transparent'
                          ? {
                              backgroundImage:
                                'linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%, #666), linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%, #666)',
                              backgroundSize: '8px 8px',
                              backgroundPosition: '0 0, 4px 4px',
                            }
                          : { backgroundColor: bg === 'white' ? '#FFFFFF' : '#000000' }
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            <div
              className="grid shrink-0 grid-cols-4 gap-0.5"
              aria-live="polite"
              role="toolbar"
              aria-label="Editor actions"
            >
              <button
                type="button"
                onClick={() => setShowExtraDetails((prev) => !prev)}
                className={cn(
                  phoneNavIconCell,
                  'builder-focus press-feedback transition-colors',
                  showExtraDetails
                    ? 'bg-white/10 text-white'
                    : 'text-white/55 hover:bg-white/[0.06] hover:text-white',
                )}
                title={showExtraDetails ? 'Hide measurement callouts' : 'Show details on preview'}
                aria-label={showExtraDetails ? 'Hide details' : 'Show details'}
                aria-pressed={showExtraDetails}
              >
                <Info className={phoneNavIconClass} strokeWidth={2.25} />
              </button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={undo}
                disabled={!undoAvailable}
                aria-label="Undo"
                className={cn(phoneNavIconCell, 'p-0 !text-white/70 hover:!text-white disabled:opacity-30')}
              >
                <Undo2 className={phoneNavIconClass} strokeWidth={2.25} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={redo}
                disabled={!redoAvailable}
                aria-label="Redo"
                className={cn(phoneNavIconCell, 'p-0 !text-white/70 hover:!text-white disabled:opacity-30')}
              >
                <Redo2 className={phoneNavIconClass} strokeWidth={2.25} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowVersionHistory(true)}
                aria-label="Version history"
                title="Version history"
                className={cn(phoneNavIconCell, 'p-0 !text-white/70 hover:!text-white')}
              >
                <History className={phoneNavIconClass} strokeWidth={2.25} />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                asChild
                aria-label="Back to catalog"
                className="h-8 w-8 shrink-0 p-0 !text-white/60 hover:bg-white/10 hover:!text-white sm:h-7 sm:w-auto sm:px-2 sm:text-[10px]"
              >
                <Link to="/catalog">
                  <ArrowLeft className="h-4 w-4 sm:mr-1 sm:h-3 sm:w-3" />
                  <span className="hidden sm:inline">BACK</span>
                </Link>
              </Button>
            </div>

            <div
              className={cn(
                'order-last flex min-w-0 flex-1 basis-full flex-col items-center justify-center gap-1 sm:order-none sm:basis-auto sm:flex-row sm:gap-3',
              )}
            >
              <div className="min-w-0 max-w-full">
                {isEditingName ? (
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                    className="h-8 border-white/20 bg-white/5 text-center text-[13px] font-semibold text-white sm:h-7"
                    autoFocus
                  />
                ) : (
                  <div
                    className="cursor-pointer truncate text-center text-[13px] font-semibold text-white hover:text-white/85"
                    onClick={() => setIsEditingName(true)}
                    title="Rename project"
                  >
                    {projectName}
                  </div>
                )}
              </div>

              <div className="hidden h-5 w-px bg-white/10 sm:block" aria-hidden />

              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setShowExtraDetails((prev) => !prev)}
                  className={cn(
                    'builder-focus press-feedback shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider sm:px-2.5',
                    showExtraDetails
                      ? 'bg-white/10 text-white hover:bg-white/15'
                      : 'text-white/55 hover:bg-white/[0.06] hover:text-white',
                  )}
                >
                  {showExtraDetails ? 'Hide details' : 'Show details'}
                </button>
                <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.04] p-0.5">
                  {(['black', 'white', 'transparent'] as const).map((bg) => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => setPreviewBackground(bg)}
                      title={bg}
                      aria-label={`Background ${bg}`}
                      className={cn(
                        'builder-focus press-feedback h-5 w-5 shrink-0 rounded border',
                        previewBackground === bg
                          ? 'border-[#FF3B30] ring-1 ring-[#FF3B30]'
                          : 'border-white/15 hover:border-white/30',
                      )}
                      style={
                        bg === 'transparent'
                          ? {
                              backgroundImage:
                                'linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%, #666), linear-gradient(45deg, #666 25%, transparent 25%, transparent 75%, #666 75%, #666)',
                              backgroundSize: '8px 8px',
                              backgroundPosition: '0 0, 4px 4px',
                            }
                          : { backgroundColor: bg === 'white' ? '#FFFFFF' : '#000000' }
                      }
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2" aria-live="polite">
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={undo}
                  disabled={!undoAvailable}
                  aria-label="Undo"
                  className="h-8 w-8 shrink-0 p-0 !text-white/70 hover:!text-white disabled:opacity-30"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={redo}
                  disabled={!redoAvailable}
                  aria-label="Redo"
                  className="h-8 w-8 shrink-0 p-0 !text-white/70 hover:!text-white disabled:opacity-30"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowVersionHistory(true)}
                  aria-label="Version history"
                  title="Version history"
                  className="h-8 w-8 shrink-0 p-0 !text-white/70 hover:!text-white"
                >
                  <History className="h-4 w-4" />
                </Button>
              </div>
              <span className="text-[9px] font-medium uppercase tracking-wider text-white/35">
                {saving ? 'Saving…' : !networkOnline ? 'Offline' : saveError ? 'Not synced' : 'Saved'}
              </span>
              <button
                type="button"
                onClick={() => setShowReviewDrawer(true)}
                className="builder-focus press-feedback flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-black hover:bg-white/90"
              >
                <FileCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
                Review
              </button>
            </div>
          </>
        )}
      </div>
      ) : null}

      {(!networkOnline || saveError) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#CC2D24]/25 bg-[#CC2D24]/[0.07] px-3 py-2 sm:px-5">
          <p className="max-w-[min(100%,560px)] text-[11px] leading-snug text-white/82">
            {!networkOnline
              ? 'You appear to be offline. Edits stay in this session; reconnect, then use Save or Continue.'
              : saveError === 'failed'
                ? 'Last save did not finish. Check your connection, then retry.'
                : 'Save again to sync your draft to the server.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 border-white/22 text-[10px] !text-white hover:bg-white/10"
            onClick={retrySave}
            disabled={saving || !networkOnline}
          >
            Retry save
          </Button>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        {!isPhone ? (
          <aside
            className="flex w-[4.5rem] shrink-0 flex-col bg-[#0a0a0a] py-2 md:w-[5rem] lg:w-[5.75rem]"
            aria-label="Builder steps"
          >
            <div className="scrollbar-dark flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden pb-3 pl-1.5 pr-0">
              {visibleBuilderSteps.map((item) => {
                const current = currentStep === item.id;
                const enabled = visitedSteps.includes(item.id);
                const StepIcon = BUILDER_STEP_ICONS[item.id] ?? Hash;
                return (
                  <button
                    key={item.id}
                    id={`builder-step-${item.id}`}
                    type="button"
                    onClick={() => handleStepClick(item.id)}
                    disabled={!enabled}
                    title={stepTabTitle(item, techpackSpecFlow)}
                    aria-current={current ? 'step' : undefined}
                    className={cn(
                      'builder-focus press-feedback group relative flex w-full shrink-0 flex-col items-center gap-1 px-1 py-2.5 text-center',
                      current
                        ? 'rounded-l-lg bg-[#0F0F0F] text-white'
                        : enabled
                          ? 'mr-1.5 rounded-lg text-white/60 hover:bg-white/[0.04] hover:text-white'
                          : 'mr-1.5 cursor-not-allowed rounded-lg text-white/22',
                    )}
                  >
                    <StepIcon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0 transition-colors md:h-5 md:w-5',
                        current
                          ? 'text-white'
                          : enabled
                            ? 'text-white/55 group-hover:text-white'
                            : 'text-white/25',
                      )}
                      strokeWidth={1.75}
                    />
                    <span className="max-w-[4.75rem] text-[7.5px] font-semibold uppercase leading-tight tracking-[0.06em] md:max-w-none md:text-[9px] md:leading-snug">
                      {stepTabTitle(item, techpackSpecFlow)}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {isPhone ? (
          currentStep === 13 ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0F0F0F]">
              <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden border-t border-white/[0.04] bg-[#0c0c0c]">
                {renderEditorMain()}
              </div>
            </div>
          ) : (
            <PanelGroup
              key="builder-phone-panels"
              direction="vertical"
              className="flex min-h-0 flex-1 flex-col"
              // Bump when phone panel constraints change so saved % from localStorage cannot block collapse.
              autoSaveId="ceriga-builder-phone-v12"
            >
              {/*
              Top: min ~48% keeps the garment visible; bottom max 52% caps how far the editor can slide up.
            */}
              <Panel
                id="phone-builder-preview"
                defaultSize={42}
                minSize={48}
                maxSize={100}
                className={cn(
                  'relative z-10 flex min-h-0 min-w-0 overflow-hidden',
                  draggingDetail && 'z-40 overflow-visible',
                )}
              >
                {livePreviewBlock}
              </Panel>
              <PanelResizeHandle
                title="Drag to resize preview and configure"
                className={cn(
                  'group relative z-20 flex shrink-0 cursor-ns-resize items-center justify-center bg-[#0F0F0F] transition-colors hover:bg-[#141414] data-[resize-handle-state=drag]:bg-[#1a1010]',
                  isPhone ? 'min-h-10 py-2' : 'h-3 py-0.5',
                  isPhone && phoneEditorCollapsed && 'pointer-events-none h-0 min-h-0 overflow-hidden !py-0 opacity-0',
                )}
              >
                <div className="h-1 w-[4.5rem] rounded-full bg-white/20 transition-colors group-hover:bg-white/35 group-data-[resize-handle-state=drag]:bg-[#CC2D24]/80" aria-hidden />
                <span className="sr-only">Drag to resize preview and configure panels</span>
              </PanelResizeHandle>
              <Panel
                id="phone-builder-editor"
                ref={phoneEditorPanelRef}
                defaultSize={50}
                minSize={18}
                maxSize={52}
                collapsible
                collapsedSize={0}
                onCollapse={() => setPhoneEditorCollapsed(true)}
                onExpand={() => setPhoneEditorCollapsed(false)}
                className="relative z-0 flex min-h-0 min-w-0 overflow-hidden"
              >
                <div
                  className={cn(
                    'flex h-full min-h-0 w-full flex-col border-t border-white/[0.04] bg-[#0c0c0c]',
                    // Softer upward shadow on phone so it does not visually cover the live preview toolbar.
                    'rounded-t-[1.25rem] shadow-[0_-4px_28px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:rounded-t-2xl sm:shadow-[0_-12px_40px_rgba(0,0,0,0.5)]',
                  )}
                >
                  {renderEditorMain()}
                </div>
              </Panel>
            </PanelGroup>
          )
        ) : (
          <PanelGroup
            key="builder-desktop-panels"
            direction="horizontal"
            className="flex min-h-0 min-w-0 flex-1"
            autoSaveId="ceriga-builder-panels-v4"
          >
            <Panel
              ref={leftPanelRef}
              defaultSize={26}
              minSize={SIDE_PANEL_MIN_PCT}
              maxSize={42}
              collapsible
              collapsedSize={0}
              onCollapse={() => setLeftPanelCollapsed(true)}
              onExpand={() => setLeftPanelCollapsed(false)}
              onResize={handleLeftPanelResize}
              className="flex min-h-0"
            >
              <div
                key={leftPanelCollapsed ? 'collapsed' : `open-${currentStep}`}
                className={cn(
                  'flex h-full min-h-0 w-full min-w-0 flex-col bg-[#0F0F0F]',
                  !leftPanelCollapsed && 'animate-builder-slide-up-in',
                )}
              >
                {!leftPanelCollapsed ? renderEditorMain({ leftPanelCollapse: true }) : null}
              </div>
            </Panel>
            <PanelResizeHandle
              className={cn(
                'group relative z-10 flex w-3 max-w-[12px] shrink-0 cursor-col-resize items-stretch justify-center bg-transparent before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-white/12 before:content-[""] before:transition-colors hover:before:bg-white/22 data-[resize-handle-state=drag]:before:bg-[#FF3B30]/45',
                leftPanelCollapsed && 'pointer-events-none w-0 max-w-0 opacity-0',
              )}
            />
            <Panel
              defaultSize={74}
              minSize={40}
              className={cn(
                'flex min-h-0 min-w-0',
                draggingDetail && 'z-40 overflow-visible',
              )}
            >
              {livePreviewBlock}
            </Panel>
          </PanelGroup>
        )}
        </div>
      </div>

      {isPhone ? (
        <div
          className="z-[25] flex shrink-0 flex-col border-t border-white/[0.1] bg-[#080808] shadow-[0_-2px_20px_rgba(0,0,0,0.35)]"
        >
          <div className="px-2.5 pt-1.5">
            <div className="text-[7px] font-bold uppercase tracking-[0.2em] text-[#CC2D24]">Process</div>
            <div className="truncate text-[10px] text-white/50">
              Step {phoneProcessStepCount} · {phoneProcessTitle}
            </div>
          </div>
          <div className="scrollbar-dark flex min-h-[4.25rem] touch-pan-x gap-0 overflow-x-auto overflow-y-hidden overscroll-x-contain px-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-1.5 [-webkit-overflow-scrolling:touch]">
            {visibleBuilderSteps.map((item) => {
              const current = currentStep === item.id;
              const enabled = visitedSteps.includes(item.id);
              const StepIcon = BUILDER_STEP_ICONS[item.id] ?? Hash;
              return (
                <button
                  key={item.id}
                  id={`builder-step-${item.id}`}
                  type="button"
                  onClick={() => handleStepClick(item.id)}
                  disabled={!enabled}
                  title={stepTabTitle(item, techpackSpecFlow)}
                  className={cn(
                    'builder-focus press-feedback flex min-h-[4rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1.5 text-center',
                    item.id === 10 || item.id === 11
                      ? 'w-[min(8.5rem,calc((100vw-1rem)/4.25))] min-w-[min(7rem,calc((100vw-1rem)/4.25))] max-w-[9rem]'
                      : 'w-[calc((100vw-1.25rem)/5)] min-w-[calc((100vw-1.25rem)/5)] max-w-[5.25rem]',
                    current
                      ? 'bg-[#0F0F0F] text-white'
                      : enabled
                        ? 'text-white/60 active:text-white'
                        : 'cursor-not-allowed text-white/25',
                  )}
                >
                  <StepIcon
                    className={cn('h-8 w-8 shrink-0', current ? 'text-white' : 'text-white/50')}
                    strokeWidth={1.9}
                  />
                  <span className="line-clamp-2 w-full text-[8px] font-bold uppercase leading-tight tracking-wide">
                    {stepTabTitle(item, techpackSpecFlow)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showDownloadModal && (
        <DownloadTechPackModal
          onClose={() => setShowDownloadModal(false)}
          availableColors={state.colors}
          measurementUnit={state.measurementUnit}
        />
      )}

      {showReviewDrawer ? (
        <div className={cn('fixed inset-0 flex justify-end', isPhone ? 'z-[300]' : 'z-[70]')}>
          <button
            type="button"
            aria-label="Close review"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={() => setShowReviewDrawer(false)}
          />
          <aside
            role="dialog"
            aria-label="Tech pack review"
            className="relative z-10 flex h-full w-full max-w-[min(420px,94vw)] flex-col border-l border-white/10 bg-[#0F0F0F] shadow-[0_-8px_60px_rgba(0,0,0,0.55)] animate-in slide-in-from-right duration-200"
          >
            {isPhone ? (
              <div className="flex shrink-0 border-b border-white/[0.08] bg-black/40 px-2 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 min-h-11 shrink-0 gap-1.5 rounded-xl px-3 !text-white hover:bg-white/10"
                  onClick={() => setShowReviewDrawer(false)}
                >
                  <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
                  <span className="text-[13px] font-semibold">Back</span>
                </Button>
              </div>
            ) : null}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.07] px-4 pb-3.5 pt-3.5 sm:px-5 sm:pt-4 sm:pb-4">
              <div className="min-w-0">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
                  Specification
                </div>
                <h3 className="text-balance text-[16px] font-bold leading-snug text-white">
                  Review tech pack
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewDrawer(false)}
                aria-label="Close"
                className="builder-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-white/[0.06] hover:text-white md:h-9 md:w-9"
              >
                <X className="h-4 w-4 md:h-[18px] md:w-[18px]" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
              {renderSummaryBody()}
            </div>
          </aside>
        </div>
      ) : null}

      {showVersionHistory ? (
        <div
          className={cn(
            'fixed inset-0 flex justify-end',
            isPhone ? 'z-[320]' : 'z-[70]',
          )}
        >
          <button
            type="button"
            aria-label="Close version history"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={() => setShowVersionHistory(false)}
          />
          <aside
            role="dialog"
            aria-label="Version history"
            className="relative z-10 flex h-full w-full max-w-[min(440px,96vw)] flex-col border-l border-white/10 bg-[#0F0F0F] shadow-[0_-8px_60px_rgba(0,0,0,0.55)] animate-in slide-in-from-right duration-200"
          >
            {isPhone ? (
              <div className="flex shrink-0 border-b border-white/[0.08] bg-black/40 px-2 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 min-h-11 shrink-0 gap-1.5 rounded-xl px-3 !text-white hover:bg-white/10"
                  onClick={() => setShowVersionHistory(false)}
                >
                  <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
                  <span className="text-[13px] font-semibold">Back</span>
                </Button>
              </div>
            ) : null}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.07] px-4 pb-3.5 pt-3.5 sm:px-5 sm:pt-4 sm:pb-4">
              <div className="min-w-0">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
                  Timeline
                </div>
                <h3 className="text-balance text-[17px] font-bold leading-snug text-white">
                  Version history
                </h3>
                <div className="mt-0.5 text-[11px] text-white/50">
                  {versions.length === 0
                    ? 'No versions yet — save one to start the timeline.'
                    : `${versions.length + 1} version${versions.length + 1 === 1 ? '' : 's'}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVersionHistory(false)}
                aria-label="Close"
                className="builder-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-white/[0.06] hover:text-white md:h-9 md:w-9"
              >
                <X className="h-4 w-4 md:h-[18px] md:w-[18px]" />
              </button>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.05] bg-black/30 px-4 py-2.5 sm:px-5">
              <div className="text-[10px] leading-snug text-white/45">
                Auto-saves every few minutes
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 min-h-10 shrink-0 border-white/18 bg-white/[0.04] px-3.5 text-[11px] font-semibold uppercase tracking-wider !text-white hover:!bg-white/[0.1] sm:h-9 sm:min-h-9 sm:px-3 sm:text-[10px]"
                onClick={saveManualVersion}
              >
                <Save className="mr-2 h-4 w-4 sm:mr-1.5 sm:h-3 sm:w-3" />
                Save version
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
              <ol className="flex flex-col gap-2.5">
                {/* Current (live) version — always pinned at top */}
                <li className="relative overflow-hidden rounded-xl border border-[#FF3B30]/55 bg-[#FF3B30]/[0.06] p-2.5 ring-1 ring-[#FF3B30]/25">
                  <div className="flex items-stretch gap-3">
                    <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-lg border border-white/15 bg-[#0a0a0a]">
                      <VersionThumbnail
                        state={state}
                        currentStep={currentStep}
                        showFront={showFront}
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-[#FF3B30]/25 px-2 py-[2px] text-[9px] font-bold uppercase tracking-wider text-[#FF8C85]">
                          Current
                        </span>
                      </div>
                      <div className="mt-1 text-[12px] font-semibold text-white">
                        {formatVersionDate(Date.now())}
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-white/55">
                        Live — all unsaved changes
                      </div>
                    </div>
                  </div>
                </li>

                {versions.length === 0 ? (
                  <li className="mx-auto my-6 max-w-[260px] rounded-lg border border-dashed border-white/12 px-3 py-6 text-center text-[11px] leading-relaxed text-white/45">
                    Your saves land here. We also snapshot automatically as you edit.
                  </li>
                ) : (
                  versions.map((v, idx) => (
                    <li
                      key={v.id}
                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/30 p-2.5 transition hover:border-white/22 hover:bg-white/[0.04]"
                    >
                      <div className="flex items-stretch gap-3">
                        <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-lg border border-white/12 bg-[#0a0a0a]">
                          <VersionThumbnail
                            state={v.state}
                            currentStep={v.currentStep}
                            showFront={v.showFront}
                          />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-center gap-1.5">
                            {idx === 0 ? (
                              <span className="rounded-full bg-white/10 px-1.5 py-[1px] text-[8.5px] font-bold uppercase tracking-wider text-white/75">
                                Latest
                              </span>
                            ) : null}
                            <span className="rounded-full bg-white/[0.04] px-1.5 py-[1px] text-[8.5px] font-bold uppercase tracking-wider text-white/55">
                              {v.manual ? 'Saved' : 'Auto'}
                            </span>
                          </div>
                          <div className="mt-1 text-[12px] font-semibold text-white">
                            {formatVersionDate(v.createdAt)}
                          </div>
                          <div className="mt-0.5 truncate text-[10.5px] text-white/55">
                            {v.summary}
                          </div>
                          <div className="mt-auto flex items-center gap-2 pt-1.5 opacity-90 transition group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => restoreVersion(v.id)}
                              className="builder-focus press-feedback flex min-h-10 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white hover:bg-white/[0.1] sm:h-8 sm:min-h-0 sm:gap-1 sm:rounded-md sm:px-2 sm:py-1 sm:text-[10px]"
                              title="Restore this version"
                            >
                              <RotateCcw className="h-4 w-4 sm:h-3 sm:w-3" strokeWidth={2.25} />
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => removeVersion(v.id)}
                              aria-label="Delete version"
                              title="Delete"
                              className="builder-focus flex min-h-10 min-w-10 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-[#FF3B30] sm:h-8 sm:min-h-0 sm:min-w-0 sm:w-8 sm:rounded-md"
                            >
                              <Trash2 className="h-4 w-4 sm:h-3 sm:w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ol>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function formatVersionDate(ts: number): string {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleString(undefined, { month: 'short' });
  const year = d.getFullYear();
  const time = d.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day} ${month} ${year}, ${time}`;
}

/** Which elements to thumbnail based on the step the user was on. */
function pickThumbnailElements(state: BuilderState, step: number): DesignElement[] {
  const prints = state.prints ?? [];
  const labels = state.labels ?? [];
  const packaging = state.packaging ?? [];
  // Rough step mapping: 5 = Labels, 6 = Packaging. Anything else → prints (with a
  // fallback to whichever array has content so empty-prints states still get a preview).
  if (step === 5 && labels.length) return labels;
  if (step === 6 && packaging.length) return packaging;
  if (prints.length) return prints;
  if (labels.length) return labels;
  if (packaging.length) return packaging;
  return prints;
}

function pickLayerLabel(step: number): string {
  if (step === 5) return 'Labels';
  if (step === 6) return 'Packaging';
  return 'Prints';
}

interface VersionThumbnailProps {
  state: BuilderState;
  currentStep: number;
  showFront: boolean;
}

/**
 * Lightweight SVG preview of a BuilderState — renders the garment silhouette, layered
 * design elements in their saved positions, and text content so users can recognise
 * a version at a glance (like Canva / Figma version history cards).
 */
function VersionThumbnail({ state, currentStep }: VersionThumbnailProps) {
  const garmentColor = state.colors?.[0]?.hex || '#2e2e2e';
  const elements = pickThumbnailElements(state, currentStep);
  const layerLabel = pickLayerLabel(currentStep);

  const VB_W = 520;
  const VB_H = 560;

  const tshirtPath =
    'M 110 90 L 190 60 C 210 90 250 105 260 105 C 270 105 310 90 330 60 L 410 90 L 460 175 L 410 200 L 410 510 L 110 510 L 110 200 L 60 175 Z';

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      style={{ background: '#141414' }}
      aria-hidden
    >
      <defs>
        <linearGradient id="vh-garment-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      <rect x={0} y={0} width={VB_W} height={VB_H} fill="#141414" />

      <g>
        <path d={tshirtPath} fill={garmentColor} />
        <path d={tshirtPath} fill="url(#vh-garment-light)" />
        <path
          d={tshirtPath}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={2}
        />
      </g>

      <g>
        {elements.map((el) => {
          const opacity = Math.max(0, Math.min(1, (el.opacity ?? 100) / 100));
          const cx = el.x;
          const cy = el.y;
          const x = cx - el.width / 2;
          const y = cy - el.height / 2;
          const transform = el.rotation
            ? `rotate(${el.rotation} ${cx} ${cy})`
            : undefined;

          if (el.type === 'image' && el.content) {
            const src = isRefToken(el.content)
              ? resolveImageRef(el.content) ?? ''
              : el.content;
            if (!src) return null;
            return (
              <g key={el.id} transform={transform} opacity={opacity}>
                <image
                  href={src}
                  x={x}
                  y={y}
                  width={el.width}
                  height={el.height}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            );
          }

          if (el.type === 'text') {
            const fontSize = Math.max(8, el.fontSize ?? 28);
            const content = (el.content ?? '').slice(0, 80);
            const transformed =
              el.textTransform === 'uppercase'
                ? content.toUpperCase()
                : el.textTransform === 'lowercase'
                  ? content.toLowerCase()
                  : content;
            return (
              <g key={el.id} transform={transform} opacity={opacity}>
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={el.color ?? '#FFFFFF'}
                  stroke={
                    el.borderWidth && el.borderWidth > 0
                      ? el.borderColor ?? '#000000'
                      : undefined
                  }
                  strokeWidth={el.borderWidth ?? 0}
                  paintOrder="stroke"
                  fontSize={fontSize}
                  fontFamily={el.fontFamily ?? 'Inter, system-ui, sans-serif'}
                  fontWeight={600}
                  fontStyle={el.fontStyle ?? 'normal'}
                  letterSpacing={el.letterSpacing ?? 0}
                >
                  {transformed}
                </text>
              </g>
            );
          }

          return null;
        })}
      </g>

      <g>
        <rect
          x={10}
          y={VB_H - 38}
          rx={8}
          ry={8}
          width={106}
          height={24}
          fill="rgba(0,0,0,0.55)"
        />
        <text
          x={20}
          y={VB_H - 22}
          fontFamily="Inter, system-ui, sans-serif"
          fontSize={14}
          fontWeight={700}
          fill="rgba(255,255,255,0.85)"
          letterSpacing={1}
        >
          {layerLabel.toUpperCase()}
        </text>
      </g>
    </svg>
  );
}

function CircularProgress({ value, compact }: { value: number; compact?: boolean }) {
  const radius = compact ? 15 : 22;
  const stroke = compact ? 3 : 4;
  const vb = compact ? 38 : 52;
  const c = vb / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg
      width={vb}
      height={vb}
      viewBox={`0 0 ${vb} ${vb}`}
      className="shrink-0"
      aria-hidden
    >
      <circle
        cx={c}
        cy={c}
        r={radius}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={c}
        cy={c}
        r={radius}
        stroke="#CC2D24"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </svg>
  );
}

function ChoiceStep({
  label,
  options,
  selected,
  onSelect,
  notes,
  onNotes,
  placeholder,
}: {
  label: string;
  options: Array<{ id: string; name: string }>;
  selected?: string;
  onSelect: (value: string) => void;
  notes: string;
  onNotes: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-4">
      <ChoiceGrid
        label={label}
        options={options}
        selected={selected}
        onSelect={onSelect}
        columns="grid-cols-2"
      />
      <div>
        <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
          Extra Details
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          className="min-h-[68px] border-white/10 bg-white/5 text-[10px] text-white placeholder:text-white/30 md:min-h-[82px] md:text-[11px]"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function ChoiceGrid({
  label,
  options,
  selected,
  onSelect,
  columns,
}: {
  label: string;
  options: Array<{ id: string; name: string }>;
  selected?: string;
  onSelect: (value: string) => void;
  columns: string;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/60">
        {label}
      </Label>
      <div className={`grid ${columns} gap-1.5 sm:gap-2`}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={`rounded-md border px-2 py-1.5 text-center transition sm:rounded-lg sm:px-2.5 sm:py-2 md:py-1.5 xl:px-2.5 ${
              selected === option.id
                ? 'border-[#FF3B30] bg-[#FF3B30]/10 text-white'
                : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white'
            }`}
          >
            <div className="text-[10px] font-medium leading-snug sm:text-[11px]">{option.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyStep({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
      {text}
    </div>
  );
}

function ReviewRow({
  label,
  value,
  swatch,
  hidden,
}: {
  label: string;
  value: string;
  swatch?: string;
  hidden?: boolean;
}) {
  if (hidden) return null;

  return (
    <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
      <span className="text-xs text-white/50">{label}:</span>
      {swatch ? (
        <div className="flex items-center gap-2">
          <div
            className="h-5 w-5 rounded border border-white/20"
            style={{ backgroundColor: swatch }}
          />
          <span className="text-xs font-medium text-white">{value}</span>
        </div>
      ) : (
        <span className="text-xs font-medium capitalize text-white">{value}</span>
      )}
    </div>
  );
}

function SpecRow({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="border-b border-white/10 pb-4">
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div
        className={`flex items-center gap-2 text-sm font-semibold text-white ${
          capitalize ? 'capitalize' : ''
        }`}
      >
        <span>{value}</span>
      </div>
    </div>
  );
}

function getHueRotation(hex: string) {
  const map: Record<string, number> = {
    '#3B82F6': 0,
    '#10B981': 60,
    '#8B5CF6': -40,
    '#EF4444': 140,
    '#FFFFFF': -180,
    '#000000': -180,
    '#FF0000': 140,
    '#00FF00': -120,
  };

  return map[hex] || 0;
}