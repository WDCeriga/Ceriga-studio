import {
  Fragment,
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
  Download,
  Redo2,
  Save,
  Trash2,
  Undo2,
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
  FABRIC_COLOR_FAMILIES,
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
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from 'react-resizable-panels';

import imgBlueTshirt from 'figma:asset/f00825900c95df312eb3b002c75207b61c243d55.png';

import { MeasurementsStep, MeasurementPreview } from '../components/builder/MeasurementsStep';
import { TrimColorFamilyPicker } from '../components/builder/TrimColorFamilyPicker';
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
  measurements: { title: 'Measurements', defaultTop: '16%', defaultLeft: '14px', lineSide: 'left' },
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

  const [expandedColorFamily, setExpandedColorFamily] = useState<number | null>(null);
  const fabricColorPickerRef = useRef<HTMLDivElement>(null);
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
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
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
  /** Same box as detail callout `position:absolute` (shell `inset-0` layer); drag math must use this, not nested garment divs. */
  const detailPositionRootRef = useRef<HTMLDivElement>(null);
  const deleteZoneRef = useRef<HTMLDivElement>(null);
  const detailCardMetricsRef = useRef({ w: 200, h: 96 });
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
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
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

  const handleRightPanelResize = useCallback((size: number, prevSize: number | undefined) => {
    const panel = rightPanelRef.current;
    if (!panel || panel.isCollapsed()) return;
    if (prevSize === undefined) return;
    if (size > prevSize) return;
    if (prevSize < PANEL_SNAP_COLLAPSE_BELOW_PCT) return;
    if (size >= PANEL_SNAP_COLLAPSE_BELOW_PCT) return;
    queueMicrotask(() => {
      const p = rightPanelRef.current;
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
      setRightPanelCollapsed(false);
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
    if (expandedColorFamily === null) return;
    const collapseIfOutside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (fabricColorPickerRef.current?.contains(t)) return;
      if (editorScrollRef.current && !editorScrollRef.current.contains(t)) return;
      setExpandedColorFamily(null);
    };
    document.addEventListener('pointerdown', collapseIfOutside, true);
    return () => document.removeEventListener('pointerdown', collapseIfOutside, true);
  }, [expandedColorFamily]);

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

  const handleSave = useCallback(async (showToast = true) => {
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
      if (showToast) toast.success('Draft saved');
    } catch {
      setSaveError('failed');
      if (showToast) toast.error('Could not save — try again');
    } finally {
      setSaving(false);
    }
  }, []);

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
      }
      return;
    }

    let next = currentStep + 1;
    while (next <= builderSteps.length && shouldSkipStep(next)) next += 1;

    if (next <= builderSteps.length) {
      setCurrentStep(next);
      markVisitedThrough(next);
      handleSave(false);
    }
  };

  const handleBack = () => {
    if (techpackSpecFlow && techpackNavigationList && techpackNavigationList.length > 0) {
      const idx = techpackNavigationList.indexOf(currentStep);
      if (idx > 0) {
        const prev = techpackNavigationList[idx - 1]!;
        setCurrentStep(prev);
        markVisitedThrough(prev);
      }
      return;
    }

    let prev = currentStep - 1;
    while (prev >= 1 && shouldSkipStep(prev)) prev -= 1;
    if (prev >= 1) {
      setCurrentStep(prev);
      markVisitedThrough(prev);
    }
  };

  const handleStepClick = (stepId: number) => {
    if (visitedSteps.includes(stepId) && !shouldSkipStep(stepId)) {
      setCurrentStep(stepId);
    }
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

    try {
      card.setPointerCapture(e.pointerId);
      detailPointerCaptureRef.current = { el: card, pointerId: e.pointerId };
    } catch {
      detailPointerCaptureRef.current = null;
    }

    detailCardMetricsRef.current = {
      w: Math.ceil(cardRect.width),
      h: Math.ceil(cardRect.height),
    };

    detailPendingDragRef.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      offset: { x: e.clientX - cardRect.left, y: e.clientY - cardRect.top },
      initialLeftPx: Math.round(cardRect.left - shellRect.left),
      initialTopPx: Math.round(cardRect.top - shellRect.top),
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
      const { w: cardW, h: cardH } = detailCardMetricsRef.current;
      const off = detailDragOffsetRef.current;

      let newLeft = ev.clientX - bounds.left - off.x;
      let newTop = ev.clientY - bounds.top - off.y;

      const pad = 6;
      newLeft = Math.max(pad, Math.min(newLeft, bounds.width - cardW - pad));
      newTop = Math.max(pad, Math.min(newTop, bounds.height - cardH - pad));

      detailLastClampedPosRef.current = { left: newLeft, top: newTop };

      scheduleDetailPositionUpdate(dragKey, newLeft, newTop);

      // Use the same clamped box that is painted (pointer can move past the clamp).
      const padHit = 10;
      if (deleteRect && cardW > 0 && cardH > 0) {
        const cardLeft = bounds.left + newLeft;
        const cardTop = bounds.top + newTop;
        const cardRight = cardLeft + cardW;
        const cardBottom = cardTop + cardH;
        const over =
          cardLeft < deleteRect.right + padHit &&
          cardRight > deleteRect.left - padHit &&
          cardTop < deleteRect.bottom + padHit &&
          cardBottom > deleteRect.top - padHit;
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
      const last = detailLastClampedPosRef.current;
      const shellEl = detailPositionRootRef.current ?? previewShellRef.current;
      const dzEl = deleteZoneRef.current;
      const { w: cw, h: ch } = detailCardMetricsRef.current;
      const padHit = 10;
      let shouldDelete = detailOverDeleteRef.current;
      if (endedKey && last && shellEl && dzEl && cw > 0 && ch > 0) {
        const sb = shellEl.getBoundingClientRect();
        const dr = dzEl.getBoundingClientRect();
        const cardLeft = sb.left + last.left;
        const cardTop = sb.top + last.top;
        const cardRight = cardLeft + cw;
        const cardBottom = cardTop + ch;
        shouldDelete =
          cardLeft < dr.right + padHit &&
          cardRight > dr.left - padHit &&
          cardTop < dr.bottom + padHit &&
          cardBottom > dr.top - padHit;
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
        <div className="max-w-[min(88vw,200px)] min-w-0 rounded-lg border border-dashed border-[#FF3B30] bg-black/88 px-2.5 py-1.5 backdrop-blur-md sm:max-w-[min(92vw,220px)] sm:rounded-xl sm:px-3 sm:py-2">
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
    /** Single fabric colour only — pick a swatch to replace; tap again to clear. */
    const toggleColor = (hex: string, pantone: string) => {
      setState((prev) => {
        const current = prev.colors[0];
        if (current?.hex === hex) {
          return { ...prev, colors: [] };
        }
        return { ...prev, colors: [{ hex, pantone }] };
      });
    };

    const isColorSelected = (hex: string) => state.colors[0]?.hex === hex;

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

      case 2:
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
              <div ref={fabricColorPickerRef} className="grid grid-cols-2 gap-2">
                {FABRIC_COLOR_FAMILIES.map((family, familyIndex) => (
                  <Fragment key={family.name}>
                    {expandedColorFamily !== null &&
                    expandedColorFamily % 2 === 1 &&
                    familyIndex === expandedColorFamily ? (
                      <div
                        role="presentation"
                        className="min-h-[2.35rem] w-full touch-manipulation"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          setExpandedColorFamily(null);
                        }}
                      />
                    ) : null}
                    <div
                      className={cn(expandedColorFamily === familyIndex && 'col-span-2')}
                    >
                    {expandedColorFamily === familyIndex ? (
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">
                            {family.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedColorFamily(null)}
                            className="rounded px-1.5 py-0.5 text-[9px] text-white/40 hover:bg-white/5 hover:text-white/60"
                          >
                            Collapse
                          </button>
                        </div>
                        <div className="-mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-0.5 [-webkit-overflow-scrolling:touch]">
                          {family.colors.map((color) => (
                            <button
                              key={color.hex}
                              type="button"
                              onClick={() => toggleColor(color.hex, color.pantone)}
                              className={`relative h-11 w-11 shrink-0 rounded-xl border transition-all ${
                                isColorSelected(color.hex)
                                  ? 'border-[#FF3B30] ring-1 ring-[#FF3B30]'
                                  : 'border-white/20 hover:border-white/40'
                              }`}
                              style={{ backgroundColor: color.hex }}
                              title={color.name}
                            >
                              {isColorSelected(color.hex) && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="h-1.5 w-1.5 rounded-full bg-white shadow-lg" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setExpandedColorFamily(familyIndex)}
                        className="flex min-h-[2.35rem] w-full items-center gap-1.5 rounded border border-white/10 bg-white/5 px-1.5 py-1 transition-all hover:bg-white/10"
                      >
                        <div
                          className="h-5 w-5 flex-shrink-0 rounded border border-white/20"
                          style={{ backgroundColor: family.baseColor.hex }}
                        />
                        <span className="min-w-0 flex-1 truncate text-left text-[9px] text-white/60">{family.name}</span>
                        <span className="shrink-0 text-[8px] text-white/30">Expand</span>
                      </button>
                    )}
                    </div>
                  </Fragment>
                ))}
              </div>

              {state.colors[0] && (
                <div className="mt-2 rounded border border-white/10 bg-white/5 p-2">
                  <div className="mb-1 text-[9px] uppercase tracking-wider text-white/40">
                    Selected colour
                  </div>
                  <div
                    className="h-8 w-8 shrink-0 rounded-xl border border-white/20"
                    style={{ backgroundColor: state.colors[0].hex }}
                    title={`${state.colors[0].hex}${
                      state.colors[0].pantone ? ` (${state.colors[0].pantone})` : ''
                    }`}
                  />
                </div>
              )}
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
                className="h-9 border-white/10 bg-white/5 text-[11px] text-white placeholder:text-white/30"
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
                collapseBoundsRef={editorScrollRef}
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
                collapseBoundsRef={editorScrollRef}
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
                collapseBoundsRef={editorScrollRef}
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
                collapseBoundsRef={editorScrollRef}
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

  const renderSummaryBody = () => (
    <div className="space-y-4 text-sm">
        <SpecRow label="Product" value={product.name} />
        <SpecRow label="Garment Type" value={state.garmentType} capitalize />
        {state.fit ? <SpecRow label="Fit" value={state.fit} capitalize /> : null}
        <SpecRow
          label="Measurements"
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
    return (
      <>
        <div
          ref={editorScrollRef}
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-4 lg:p-5',
            isPhone && 'px-3.5 py-3.5',
          )}
        >
          {showLeftCollapse ? (
            <div className="mb-3 min-w-0 sm:mb-4">
                <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24] md:text-[10px]">
                  {stepTitleLabel}
                </div>
                <button
                  type="button"
                  onClick={() => leftPanelRef.current?.collapse()}
                  className={cn(
                    'builder-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 md:h-9 md:w-9',
                  )}
                  aria-label="Collapse configuration"
                >
                  <ChevronLeft className="h-3.5 w-3.5 text-white/70 md:h-4 md:w-4" />
                </button>
              </div>
              <h2 className="break-words font-['Plus_Jakarta_Sans',sans-serif] text-[15px] font-extrabold leading-tight tracking-[-0.5px] text-white sm:text-[16px] md:text-[17px] xl:text-[18px]">
                {stepTitleLabel.toUpperCase()}
              </h2>
            </div>
          ) : (
            <>
              <div className="mb-1 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24] md:text-[10px]">
                {stepTitleLabel}
              </div>
              <h2 className="mb-1.5 font-['Plus_Jakarta_Sans',sans-serif] text-[16px] font-extrabold tracking-[-0.5px] text-white md:mb-2.5 md:text-[17px] xl:text-[18px]">
                {stepTitleLabel.toUpperCase()}
              </h2>
            </>
          )}
          <p className="mb-4 text-[11px] leading-relaxed text-white/55 md:mb-5 md:text-[11px]">
            {stepDescriptionLabel}
          </p>
          {renderStepContent()}
        </div>

        <div
          className={cn(
            'shrink-0 border-t border-white/[0.07] bg-[#0a0a0a]/95 p-3 backdrop-blur-md md:p-3.5',
            isPhone &&
              'px-3.5 pb-[max(1.25rem,calc(env(safe-area-inset-bottom,0px)+14px))] pt-3',
          )}
        >
          <div className="flex gap-2.5">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === firstBuilderNavStepId}
              className="h-10 flex-1 rounded-xl border-white/15 bg-white/[0.03] text-[10px] !text-white hover:bg-white/10 disabled:opacity-30 md:h-8 md:rounded-md md:text-[11px]"
            >
              <ChevronLeft className="mr-0.5 h-4 w-4 md:h-3.5 md:w-3.5" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              className="h-10 flex-1 rounded-xl bg-[#CC2D24] text-[10px] font-semibold hover:bg-[#CC2D24]/90 md:h-8 md:rounded-md md:text-[11px]"
            >
              {currentStep === 13 ? 'Order' : 'Continue'}
              <ChevronRight className="ml-0.5 h-4 w-4 md:h-3.5 md:w-3.5" />
            </Button>
          </div>
        </div>
      </>
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
        className={cn(
          'border-b border-white/[0.06] bg-[#0F0F0F]/90 px-2 py-2 backdrop-blur-md sm:border-white/10 sm:bg-[#0F0F0F]/85 sm:px-4 sm:py-3 lg:px-6',
          isPhone && 'border-b-0 px-3 py-1.5',
        )}
      >
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-2 sm:gap-4',
            isPhone && 'flex-row flex-wrap items-center gap-2.5',
          )}
        >
          <div
            className={cn(
              'font-semibold uppercase tracking-wider text-white/55 sm:text-[10px] sm:text-white/60 md:text-[11px]',
              isPhone ? 'text-[10px]' : 'text-[9px]',
            )}
          >
            Live preview
          </div>

            <div
              className={cn(
                'flex flex-wrap items-center justify-end gap-1.5 sm:justify-start sm:gap-3',
                isPhone && 'ml-auto flex-nowrap justify-end gap-2',
              )}
            >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExtraDetails((prev) => !prev)}
              className={cn(
                'border-white/15 bg-white/[0.04] !text-white hover:bg-white/10 sm:border-white/20 sm:px-3 sm:text-[10px]',
                isPhone ? 'h-9 min-h-0 rounded-lg px-3 text-[11px] font-medium' : 'h-8 px-2.5 text-[9px]',
              )}
            >
              {showExtraDetails ? 'Hide' : 'Details'}
            </Button>

            <div
              className={cn(
                'flex shrink-0 flex-nowrap items-center rounded-lg border border-white/10 bg-white/5 sm:gap-2 sm:rounded-xl sm:px-2.5 sm:py-1.5',
                isPhone ? 'gap-1.5 rounded-lg px-1.5 py-1' : 'gap-1 px-1.5 py-1',
              )}
            >
              {(['black', 'white', 'transparent'] as const).map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => setPreviewBackground(bg)}
                  className={cn(
                    'builder-focus shrink-0 rounded-lg border',
                    isPhone ? 'h-9 w-9 min-h-0 min-w-0' : 'h-6 w-6',
                    previewBackground === bg
                      ? 'border-[#FF3B30] ring-1 ring-[#FF3B30]'
                      : 'border-white/20',
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

            <div
              className={cn(
                'flex shrink-0 flex-nowrap items-center rounded-lg border border-white/10 bg-white/5 sm:gap-2 sm:rounded-xl sm:p-1.5',
                isPhone ? 'gap-1.5 rounded-lg p-1' : 'gap-1 p-1',
              )}
            >
              <Button
                variant={showFront ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFront(true)}
                className={
                  showFront
                    ? isPhone
                      ? 'h-9 min-h-0 min-w-[3.75rem] rounded-lg bg-[#FF3B30] px-2.5 text-[11px] font-semibold !text-white hover:bg-[#FF3B30]/90 sm:h-8 sm:min-w-[56px] sm:px-3 sm:text-[10px]'
                      : 'h-7 min-w-[44px] bg-[#FF3B30] px-2 text-[9px] !text-white hover:bg-[#FF3B30]/90 sm:h-8 sm:min-w-[56px] sm:px-3 sm:text-[10px]'
                    : isPhone
                      ? 'h-9 min-h-0 min-w-[3.75rem] rounded-lg border-white/20 px-2.5 text-[11px] font-semibold !text-white hover:bg-white/10 sm:h-8 sm:min-w-[56px] sm:px-3 sm:text-[10px]'
                      : 'h-7 min-w-[44px] border-white/20 px-2 text-[9px] !text-white hover:bg-white/10 sm:h-8 sm:min-w-[56px] sm:px-3 sm:text-[10px]'
                }
              >
                FRONT
              </Button>
              <Button
                variant={!showFront ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFront(false)}
                className={
                  !showFront
                    ? isPhone
                      ? 'h-9 min-h-0 min-w-[3.75rem] rounded-lg bg-[#FF3B30] px-2.5 text-[11px] font-semibold !text-white hover:bg-[#FF3B30]/90 sm:h-8 sm:min-w-[56px] sm:px-3 sm:text-[10px]'
                      : 'h-7 min-w-[44px] bg-[#FF3B30] px-2 text-[9px] !text-white hover:bg-[#FF3B30]/90 sm:h-8 sm:min-w-[56px] sm:px-3 sm:text-[10px]'
                    : isPhone
                      ? 'h-9 min-h-0 min-w-[3.75rem] rounded-lg border-white/20 px-2.5 text-[11px] font-semibold !text-white hover:bg-white/10 sm:h-8 sm:min-w-[56px] sm:px-3 sm:text-[10px]'
                      : 'h-7 min-w-[44px] border-white/20 px-2 text-[9px] !text-white hover:bg-white/10 sm:h-8 sm:min-w-[56px] sm:px-3 sm:text-[10px]'
                }
              >
                BACK
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={previewShellRef}
        className={cn(
          'relative flex min-h-0 flex-1 flex-col items-center justify-center px-2 py-1.5 sm:px-4 sm:py-3 lg:px-6 lg:py-4',
          isPhone && 'px-1.5 py-0',
          previewSurfaceNeedsVisibleOverflow ? 'overflow-visible' : 'overflow-hidden',
          isPhone && 'overscroll-contain',
          isPhone && draggingDetail && 'touch-none',
        )}
        style={previewSurfaceStyle}
      >
        {currentStep !== 1 &&
        currentStep !== 9 &&
        currentStep !== 10 &&
        currentStep !== 11 &&
        currentStep !== 12 ? (
          <div
            ref={detailPositionRootRef}
            className={cn(
              'pointer-events-none absolute inset-0 z-[30]',
              draggingDetail ? 'overflow-visible' : 'overflow-hidden',
            )}
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
            <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-1">
              <MeasurementPreview
                imgClassName={isPhone ? PREVIEW_STAGE_CLASS_PHONE : PREVIEW_STAGE_CLASS}
              />
            </div>
          ) : currentStep === 9 ? (
            <div className="flex h-full min-h-0 w-full min-w-0 flex-1 items-center justify-center overflow-visible px-1 max-md:max-w-[min(100%,300px)] md:max-w-full">
              <PrintsDesignPreview
                className="h-full max-h-full w-full max-w-full"
                elements={state.prints}
                onChange={(prints) => setState((prev) => ({ ...prev, prints }))}
                selectedLayerId={state.printsLayerSelectedId}
                onSelectedLayerIdChange={(id) =>
                  setState((prev) => ({ ...prev, printsLayerSelectedId: id }))
                }
                editable
              />
            </div>
          ) : currentStep === 10 ? (
            <div
              className="flex max-h-full w-full min-w-0 max-w-full flex-1 cursor-default items-center justify-center overflow-visible px-1"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) {
                  setState((prev) => ({ ...prev, labelLayerSelectedId: null }));
                }
              }}
            >
              <LabelPreview
                color={state.labelColor ?? '#FFFFFF'}
                elements={state.labels}
                onElementsChange={(labels) => setState((prev) => ({ ...prev, labels }))}
                selectedId={state.labelLayerSelectedId}
                onSelectedIdChange={(id) =>
                  setState((prev) => ({ ...prev, labelLayerSelectedId: id }))
                }
              />
            </div>
          ) : currentStep === 11 ? (
            <div
              className="flex max-h-full w-full min-w-0 max-w-full flex-1 cursor-default items-center justify-center overflow-visible px-1"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) {
                  setState((prev) => ({ ...prev, packagingLayerSelectedId: null }));
                }
              }}
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
              />
            </div>
          ) : (
            <div
              className={cn(
                'relative flex min-h-0 w-full flex-1 items-center justify-center',
                draggingDetail ? 'overflow-visible' : 'overflow-hidden',
              )}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-radial from-white/5 to-transparent blur-3xl" />
              <img
                src={imgBlueTshirt}
                alt="Tech pack preview"
                className={cn(
                  'relative z-[1] object-contain',
                  isPhone ? PREVIEW_STAGE_CLASS_PHONE : PREVIEW_STAGE_CLASS,
                )}
                style={{ filter: `hue-rotate(${getHueRotation(primaryColor)}deg)` }}
              />
            </div>
          )}
        </div>

        {draggingDetail && currentStep < 9 ? (
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-0 z-[45] flex justify-center px-2',
              isPhone ? 'pb-1' : 'pb-1',
            )}
          >
            <div
              ref={deleteZoneRef}
              className={cn(
                'builder-delete-zone pointer-events-auto flex max-w-[min(100%,320px)] min-w-0 items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.45)] transition-all duration-200 motion-reduce:transition-none motion-reduce:transform-none sm:min-w-[210px] sm:rounded-2xl sm:px-4 sm:py-2.5',
                isPhone && 'py-1.5',
                isOverDeleteZone
                  ? 'scale-105 border-[#FF3B30] bg-[#FF3B30]/15 text-white motion-reduce:scale-100'
                  : 'border-white/20 bg-black/55 text-white/70',
              )}
            >
              <Trash2 className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isOverDeleteZone ? 'animate-pulse' : ''}`} />
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] sm:text-[10px] sm:tracking-[0.18em]">
                {isOverDeleteZone ? 'Release to delete' : 'Drag detail here'}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 max-w-[100vw] flex-col overflow-x-clip bg-[#0F0F0F]',
        'h-[100dvh] max-h-[100dvh] min-h-0 pt-[max(0px,env(safe-area-inset-top))] pb-[max(0px,env(safe-area-inset-bottom))] pl-[max(0px,env(safe-area-inset-left))] pr-[max(0px,env(safe-area-inset-right))]',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0F0F0F] px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-7 px-2 text-[10px] !text-white/60 hover:bg-white/10 hover:!text-white"
          >
            <Link to="/catalog">
              <ArrowLeft className="mr-1 h-3 w-3" />
              BACK
            </Link>
          </Button>

          <div className="min-w-0">
            {isEditingName ? (
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                className="h-7 border-white/20 bg-white/5 text-sm font-semibold text-white"
                autoFocus
              />
            ) : (
              <div
                className="truncate cursor-pointer text-sm font-semibold text-white hover:text-white/80"
                onClick={() => setIsEditingName(true)}
              >
                {projectName}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3" aria-live="polite">
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
          </div>
          <span className="text-[9px] font-medium uppercase tracking-wider text-white/35">
            {saving ? 'Saving…' : !networkOnline ? 'Offline' : saveError ? 'Not synced' : 'Saved'}
          </span>
        </div>
      </div>

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

      <div
        className={cn(
          'px-3 sm:px-5',
          isPhone
            ? 'border-b-0 bg-[#0F0F0F] py-2.5'
            : 'border-b border-white/10 bg-[#0a0a0a] py-2 sm:bg-[#0F0F0F] sm:py-2.5',
        )}
      >
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className={cn('mb-1.5 flex items-center justify-between sm:mb-1.5', isPhone && 'mb-1.5')}>
              <div className="font-bold uppercase tracking-[2px] text-[9px] text-[#CC2D24] sm:text-[#FF3B30]">
                Step{' '}
                {techpackSpecFlow && techpackNavigationList && techpackNavigationList.length > 0
                  ? `${Math.max(0, techpackNavigationList.indexOf(currentStep)) + 1} / ${techpackNavigationList.length}`
                  : `${currentStep} / ${builderSteps.length}`}
              </div>
            </div>

            {isPhone ? (
              <div className="scrollbar-dark flex touch-pan-x gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory">
                {visibleBuilderSteps.map((item) => {
                  const current = currentStep === item.id;
                  const enabled = visitedSteps.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      id={`builder-step-${item.id}`}
                      type="button"
                      onClick={() => handleStepClick(item.id)}
                      disabled={!enabled}
                      className={`builder-focus flex min-h-[3.25rem] min-w-[calc((100%-1rem)/3)] max-w-[min(100%,calc((100%-1rem)/3))] shrink-0 snap-center flex-col items-center justify-center rounded-lg border px-1.5 py-2 text-center text-[9px] font-bold uppercase leading-tight tracking-wide transition-colors ${
                        current
                          ? 'border-[#CC2D24] bg-[#CC2D24] text-white shadow-[0_2px_12px_rgba(204,45,36,0.3)]'
                          : enabled
                            ? 'border-white/15 bg-white/[0.06] text-white/75 hover:border-white/25 hover:bg-white/10'
                            : 'cursor-not-allowed border-white/10 bg-white/[0.03] text-white/28'
                      }`}
                    >
                      <span className="line-clamp-2 w-full">
                        {stepTabTitle(item, techpackSpecFlow)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="scrollbar-dark flex touch-pan-x gap-1.5 overflow-x-auto pb-1 scroll-smooth">
                {visibleBuilderSteps.map((item) => {
                  const current = currentStep === item.id;
                  const enabled = visitedSteps.includes(item.id);

                  return (
                    <button
                      key={item.id}
                      id={`builder-step-${item.id}`}
                      type="button"
                      onClick={() => handleStepClick(item.id)}
                      disabled={!enabled}
                      className={`builder-focus shrink-0 whitespace-nowrap rounded px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${
                        current
                          ? 'bg-[#FF3B30] text-white'
                          : enabled
                            ? 'border border-white/20 bg-white/10 text-white/70 hover:bg-white/20'
                            : 'cursor-not-allowed border border-white/10 bg-white/5 text-white/30'
                      }`}
                    >
                      {stepTabTitle(item, techpackSpecFlow)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden w-[60px] shrink-0 flex-col items-center justify-center sm:flex sm:w-[74px]">
            <CircularProgress value={progress} />
            <div className="mt-1 text-[10px] font-semibold text-white/65">
              {Math.round(progress)}%
            </div>
            <div className="text-[9px] uppercase tracking-wider text-white/30">
              Complete
            </div>
          </div>
        </div>
        {isPhone ? (
          <p className="mt-2 text-center text-[8px] leading-snug text-white/35">Drag the handle above the form to resize preview</p>
        ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {isPhone ? (
          <PanelGroup
            key="builder-phone-panels"
            direction="vertical"
            className="flex min-h-0 flex-1 flex-col"
            autoSaveId="ceriga-builder-phone-v6"
          >
            {/*
              Keep enough height for “Live preview” toolbar (Details, swatches, Front/Back) + a strip of canvas.
              Bottom panel max 68% ⇔ top never below ~32%, so the sheet cannot swallow the preview chrome.
            */}
            <Panel
              defaultSize={38}
              minSize={32}
              maxSize={90}
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
              )}
            >
              <div className="h-1 w-[4.5rem] rounded-full bg-white/20 transition-colors group-hover:bg-white/35 group-data-[resize-handle-state=drag]:bg-[#CC2D24]/80" aria-hidden />
              <span className="sr-only">Drag to resize preview and configure panels</span>
            </PanelResizeHandle>
            <Panel
              defaultSize={62}
              minSize={10}
              maxSize={68}
              className="relative z-0 flex min-h-0 min-w-0 overflow-hidden"
            >
              <div
                className={cn(
                  'flex h-full min-h-0 w-full flex-col border-t border-white/[0.04] bg-[#0c0c0c]',
                  'rounded-t-[1.25rem] shadow-[0_-12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:rounded-t-2xl',
                )}
              >
                {renderEditorMain()}
              </div>
            </Panel>
          </PanelGroup>
        ) : (
          <PanelGroup
            key="builder-desktop-panels"
            direction="horizontal"
            className="flex min-h-0 flex-1"
            autoSaveId="ceriga-builder-panels-v3"
          >
            <Panel
              ref={leftPanelRef}
              defaultSize={26}
              minSize={SIDE_PANEL_MIN_PCT}
              maxSize={42}
              collapsible
              collapsedSize={3}
              onCollapse={() => setLeftPanelCollapsed(true)}
              onExpand={() => setLeftPanelCollapsed(false)}
              onResize={handleLeftPanelResize}
              className="flex min-h-0"
            >
              <div className="flex h-full min-h-0 w-full min-w-0 flex-col border-r border-white/10 bg-[#0F0F0F]">
                {!leftPanelCollapsed ? (
                  renderEditorMain({ leftPanelCollapse: true })
                ) : (
                  <CollapsedRailExpand
                    side="left"
                    onExpand={() => leftPanelRef.current?.expand(PANEL_SNAP_COLLAPSE_BELOW_PCT)}
                  />
                )}
              </div>
            </Panel>
            <PanelResizeHandle className="group relative z-10 flex w-3 max-w-[12px] shrink-0 cursor-col-resize items-stretch justify-center bg-transparent before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-white/12 before:content-[''] before:transition-colors hover:before:bg-white/22 data-[resize-handle-state=drag]:before:bg-[#FF3B30]/45" />
            <Panel
              defaultSize={52}
              minSize={28}
              className={cn(
                'flex min-h-0 min-w-0',
                draggingDetail && 'z-40 overflow-visible',
              )}
            >
              {livePreviewBlock}
            </Panel>
            <PanelResizeHandle className="group relative z-10 flex w-3 max-w-[12px] shrink-0 cursor-col-resize items-stretch justify-center bg-transparent before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-white/12 before:content-[''] before:transition-colors hover:before:bg-white/22 data-[resize-handle-state=drag]:before:bg-[#FF3B30]/45" />
            <Panel
              ref={rightPanelRef}
              defaultSize={26}
              minSize={SIDE_PANEL_MIN_PCT}
              maxSize={38}
              collapsible
              collapsedSize={3}
              onCollapse={() => setRightPanelCollapsed(true)}
              onExpand={() => setRightPanelCollapsed(false)}
              onResize={handleRightPanelResize}
              className="flex min-h-0"
            >
              <div className="flex h-full min-h-0 w-full min-w-0 flex-col border-l border-white/10 bg-[#0F0F0F]">
                {!rightPanelCollapsed ? (
                  <>
                    <div className="shrink-0 border-b border-white/[0.07] bg-[#0F0F0F] px-3 pb-3 pt-3 sm:px-4 sm:pb-3.5 sm:pt-3.5 md:px-5">
                      <div className="flex min-w-0 items-start gap-2 sm:gap-2.5">
                        <button
                          type="button"
                          onClick={() => rightPanelRef.current?.collapse()}
                          className={cn(
                            'builder-focus mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 md:h-9 md:w-9',
                          )}
                          aria-label="Collapse summary"
                        >
                          <ChevronRight className="h-3.5 w-3.5 text-white/70 md:h-4 md:w-4" />
                        </button>
                        <div className="min-w-0 flex-1 pr-1">
                          <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
                            Specification
                          </div>
                          <h3 className="text-balance text-[15px] font-bold leading-snug text-white">
                            Tech Pack Summary
                          </h3>
                        </div>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 md:p-5">
                      {renderSummaryBody()}
                    </div>
                  </>
                ) : (
                  <CollapsedRailExpand
                    side="right"
                    onExpand={() => rightPanelRef.current?.expand(PANEL_SNAP_COLLAPSE_BELOW_PCT)}
                  />
                )}
              </div>
            </Panel>
          </PanelGroup>
        )}
      </div>

      {showDownloadModal && (
        <DownloadTechPackModal
          onClose={() => setShowDownloadModal(false)}
          availableColors={state.colors}
          measurementUnit={state.measurementUnit}
        />
      )}
    </div>
  );
}

function CollapsedRailExpand({
  side,
  onExpand,
}: {
  side: 'left' | 'right';
  onExpand: () => void;
}) {
  return (
    <div className="relative z-20 flex h-full min-h-0 w-full min-w-0 flex-col items-stretch justify-center overflow-visible px-0 py-1 touch-manipulation">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onExpand();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={side === 'left' ? 'Expand configuration panel' : 'Expand summary panel'}
        className="builder-focus flex min-h-[44px] w-full min-w-0 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-[#1e1e1e] px-0.5 text-white/85 shadow-md transition hover:bg-[#252525] md:min-h-[3.25rem]"
      >
        {side === 'left' ? (
          <ChevronRight className="h-4 w-4 shrink-0 pointer-events-none" />
        ) : (
          <ChevronLeft className="h-4 w-4 shrink-0 pointer-events-none" />
        )}
      </button>
    </div>
  );
}

function CircularProgress({ value }: { value: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
      <circle
        cx="26"
        cy="26"
        r={radius}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="4"
        fill="none"
      />
      <circle
        cx="26"
        cy="26"
        r={radius}
        stroke="#CC2D24"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 26 26)"
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