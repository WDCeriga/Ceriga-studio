import { useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import {
  GARMENT_NONE,
  getDefaultGarmentSelection,
  getGarmentAsset,
  getGarmentAssets,
  getGarmentSvgConfig,
  type GarmentAssetSelection,
  type GarmentSvgGarmentType,
} from '../../data/garmentSvgCatalog';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import {
  deleteMeasurementGuidePack,
  fetchAllMeasurementGuidePacks,
  upsertMeasurementGuidePack,
} from '../../lib/measurementGuidesDb';
import { cn } from '../ui/utils';

export const MEASUREMENT_GUIDE_GARMENTS: {
  id: GarmentSvgGarmentType;
  label: string;
}[] = [
  { id: 'tshirt', label: 'T-shirt' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'trousers', label: 'Trousers' },
];

export type MeasurementGuideGarmentId = GarmentSvgGarmentType;

export const MEASUREMENT_GUIDE_VIEWBOX = 1000;

/** Always a concrete SVG asset id. */
export type MeasurementGuideScopeId = string;

/** @deprecated Legacy virtual body pack — migrated onto the base garment asset. */
export const MEASUREMENT_GUIDE_BODY_SCOPE = 'body' as const;
/** @deprecated */
export const MEASUREMENT_GUIDE_BASE_SCOPE = MEASUREMENT_GUIDE_BODY_SCOPE;

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

export type MeasurementGuideId = string;

export function measurementGuideLetterAt(index: number): string {
  if (index < 0) return '?';
  if (index < 26) return String.fromCharCode(65 + index);
  return String(index + 1);
}

/** @deprecated Prefer measurementGuideLetterAt(index) */
export function measurementGuideLetter(id: MeasurementGuideId): string {
  const entry = MEASUREMENT_GUIDE_LABELS.find((item) => item.id === id);
  const match = entry?.label.match(/^([A-Z])\./);
  return match?.[1] ?? id.charAt(0).toUpperCase();
}

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

/** Guide plus which asset owns it. */
export type ResolvedMeasurementGuide = MeasurementGuideDef & {
  assignedTo: MeasurementGuideScopeId;
  assignedLabel: string;
};

type MeasurementGuideGarmentBucket = {
  byAsset: Record<string, MeasurementGuideDef[]>;
};

type MeasurementGuideStore = Record<MeasurementGuideGarmentId, MeasurementGuideGarmentBucket>;

const DEFAULT_BASE_GUIDES: MeasurementGuideDef[] = [
  { id: 'shoulderWidth', label: 'Shoulder to Shoulder', x1: 372, y1: 176, x2: 628, y2: 176, labelX: 500, labelY: 122, labelAlign: 'center' },
  { id: 'halfLength', label: 'Half Length', x1: 500, y1: 188, x2: 500, y2: 842, labelX: 570, labelY: 520, labelAlign: 'left' },
  { id: 'chestWidth', label: 'Chest Width', x1: 300, y1: 365, x2: 700, y2: 365, labelX: 710, labelY: 343, labelAlign: 'left' },
  { id: 'bottomWidth', label: 'Bottom Width', x1: 320, y1: 854, x2: 680, y2: 854, labelX: 500, labelY: 910, labelAlign: 'center' },
];

export const SUGGESTED_NECK_GUIDES: MeasurementGuideDef[] = [
  { id: 'neckOpening', label: 'Neck Opening', x1: 434, y1: 128, x2: 566, y2: 128, labelX: 500, labelY: 82, labelAlign: 'center' },
  { id: 'neckDrop', label: 'Neck Drop', x1: 500, y1: 128, x2: 500, y2: 198, labelX: 564, labelY: 150, labelAlign: 'left' },
];

export const SUGGESTED_SLEEVE_GUIDES: MeasurementGuideDef[] = [
  { id: 'armhole', label: 'Armhole', x1: 340, y1: 294, x2: 296, y2: 476, labelX: 250, labelY: 386, labelAlign: 'right' },
  { id: 'sleeveLength', label: 'Sleeve Length', x1: 336, y1: 298, x2: 156, y2: 470, labelX: 86, labelY: 276, labelAlign: 'left' },
  { id: 'sleeveOpening', label: 'Sleeve Opening', x1: 132, y1: 478, x2: 248, y2: 478, labelX: 256, labelY: 498, labelAlign: 'left' },
];

function cloneGuides(guides: MeasurementGuideDef[]): MeasurementGuideDef[] {
  return guides.map((guide) => ({ ...guide }));
}

/** First required asset in the garment’s primary/base category. */
export function getMeasurementGuideDefaultAssetId(
  garmentType: MeasurementGuideGarmentId,
): string | null {
  const config = getGarmentSvgConfig(garmentType);
  for (const category of config.categoryOrder) {
    if (config.optionalCategories.includes(category)) continue;
    const first = getGarmentAssets(garmentType, category)[0];
    if (first) return first.id;
  }
  return getGarmentAssets(garmentType, config.categoryOrder[0] ?? '')[0]?.id ?? null;
}

function categoryLooksLike(label: string, ...needles: string[]) {
  const lower = label.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function buildDefaultAssetPacks(garmentType: MeasurementGuideGarmentId): Record<string, MeasurementGuideDef[]> {
  const packs: Record<string, MeasurementGuideDef[]> = {};
  const config = getGarmentSvgConfig(garmentType);

  for (const category of config.categoryOrder) {
    const assets = getGarmentAssets(garmentType, category);
    const first = assets[0];
    if (!first) continue;
    const label = measurementGuideCategoryLabel(garmentType, category);
    if (categoryLooksLike(label, 'base') || category === config.categoryOrder[0]) {
      if (!packs[first.id]) packs[first.id] = cloneGuides(DEFAULT_BASE_GUIDES);
    } else if (categoryLooksLike(label, 'neck')) {
      if (!packs[first.id]) packs[first.id] = cloneGuides(SUGGESTED_NECK_GUIDES);
    } else if (categoryLooksLike(label, 'sleeve') && !categoryLooksLike(label, 'hem')) {
      if (!packs[first.id]) packs[first.id] = cloneGuides(SUGGESTED_SLEEVE_GUIDES);
    }
  }

  const fallback = getMeasurementGuideDefaultAssetId(garmentType);
  if (fallback && Object.keys(packs).length === 0) {
    packs[fallback] = cloneGuides(DEFAULT_BASE_GUIDES);
  }
  return packs;
}

function emptyBucket(garmentType: MeasurementGuideGarmentId): MeasurementGuideGarmentBucket {
  return { byAsset: buildDefaultAssetPacks(garmentType) };
}

function buildDefaultStore(): MeasurementGuideStore {
  return {
    tshirt: emptyBucket('tshirt'),
    hoodie: emptyBucket('hoodie'),
    trousers: emptyBucket('trousers'),
  };
}

const STORAGE_KEY = 'ceriga_measurement_guides_v6';
const LEGACY_KEYS = [
  'ceriga_measurement_guides_v5',
  'ceriga_measurement_guides_v4',
  'ceriga_measurement_guides_v3',
  'ceriga_measurement_guides_v2',
  'ceriga_measurement_guides_v1',
] as const;

const MIN_COORD = 0;
const MAX_COORD = MEASUREMENT_GUIDE_VIEWBOX;
const REMOTE_SAVE_DEBOUNCE_MS = 350;

export type MeasurementGuideSyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'local';

let measurementGuideStore: MeasurementGuideStore = buildDefaultStore();
let measurementGuideStoreVersion = 0;
let measurementGuideHydratedFromRemote = false;
let measurementGuideSyncStatus: MeasurementGuideSyncStatus = isSupabaseConfigured ? 'idle' : 'local';
let measurementGuideSyncError: string | null = null;
let measurementGuideHydratePromise: Promise<void> | null = null;
let measurementGuideSyncSnapshot: {
  status: MeasurementGuideSyncStatus;
  error: string | null;
  usingCloud: boolean;
} = {
  status: measurementGuideSyncStatus,
  error: measurementGuideSyncError,
  usingCloud: isSupabaseConfigured,
};

const listeners = new Set<() => void>();
const syncListeners = new Set<() => void>();
const EMPTY_GUIDES: MeasurementGuideDef[] = [];
const resolvedGuideCache = new Map<string, { version: number; guides: ResolvedMeasurementGuide[] }>();
const remoteSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingRemoteDeletes = new Set<string>();

function packKey(garmentType: MeasurementGuideGarmentId, assetId: string): string {
  return `${garmentType}::${assetId}`;
}

function setSyncStatus(status: MeasurementGuideSyncStatus, error: string | null = null) {
  measurementGuideSyncStatus = status;
  measurementGuideSyncError = error;
  measurementGuideSyncSnapshot = {
    status,
    error,
    usingCloud: isSupabaseConfigured,
  };
  for (const listener of syncListeners) listener();
}

export function getMeasurementGuideSyncStatus(): MeasurementGuideSyncStatus {
  return measurementGuideSyncStatus;
}

export function getMeasurementGuideSyncError(): string | null {
  return measurementGuideSyncError;
}

export function useMeasurementGuideSyncStatus(): {
  status: MeasurementGuideSyncStatus;
  error: string | null;
  usingCloud: boolean;
} {
  return useSyncExternalStore(
    (listener) => {
      syncListeners.add(listener);
      return () => syncListeners.delete(listener);
    },
    () => measurementGuideSyncSnapshot,
    () => measurementGuideSyncSnapshot,
  );
}

function clamp(value: number, min = MIN_COORD, max = MAX_COORD): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeGuide(guide: MeasurementGuideDef): MeasurementGuideDef {
  return {
    id: guide.id,
    label: typeof guide.label === 'string' ? guide.label : '',
    x1: clamp(Number(guide.x1) || 0),
    y1: clamp(Number(guide.y1) || 0),
    x2: clamp(Number(guide.x2) || 0),
    y2: clamp(Number(guide.y2) || 0),
    labelX: clamp(Number(guide.labelX) || 0),
    labelY: clamp(Number(guide.labelY) || 0),
    labelAlign:
      guide.labelAlign === 'left' || guide.labelAlign === 'right' || guide.labelAlign === 'center'
        ? guide.labelAlign
        : 'center',
  };
}

function normalizeGuides(guides: unknown): MeasurementGuideDef[] {
  if (!Array.isArray(guides)) return [];
  const seen = new Set<string>();
  const next: MeasurementGuideDef[] = [];
  for (const raw of guides) {
    if (!raw || typeof raw !== 'object') continue;
    const guide = raw as Partial<MeasurementGuideDef>;
    if (typeof guide.id !== 'string' || !guide.id.trim()) continue;
    const id = guide.id.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(
      normalizeGuide({
        id,
        label: typeof guide.label === 'string' ? guide.label : '',
        x1: Number.isFinite(Number(guide.x1)) ? Number(guide.x1) : 300,
        y1: Number.isFinite(Number(guide.y1)) ? Number(guide.y1) : 400,
        x2: Number.isFinite(Number(guide.x2)) ? Number(guide.x2) : 700,
        y2: Number.isFinite(Number(guide.y2)) ? Number(guide.y2) : 400,
        labelX: Number.isFinite(Number(guide.labelX)) ? Number(guide.labelX) : 500,
        labelY: Number.isFinite(Number(guide.labelY)) ? Number(guide.labelY) : 360,
        labelAlign:
          guide.labelAlign === 'left' || guide.labelAlign === 'right' || guide.labelAlign === 'center'
            ? guide.labelAlign
            : 'center',
      }),
    );
  }
  return next;
}

function isGarmentId(value: string): value is MeasurementGuideGarmentId {
  return value === 'tshirt' || value === 'hoodie' || value === 'trousers';
}

function legacyPackKeyToAssetId(key: string): string | null {
  if (!key || key === 'body' || key === 'base') return null;
  if (key.startsWith('pair:')) return null;
  for (const prefix of ['neck:', 'sleeve:', 'hem:'] as const) {
    if (key.startsWith(prefix)) {
      const assetId = key.slice(prefix.length);
      return getGarmentAsset(assetId) ? assetId : null;
    }
  }
  return getGarmentAsset(key) ? key : null;
}

function normalizeBucket(
  raw: unknown,
  garmentType: MeasurementGuideGarmentId,
): MeasurementGuideGarmentBucket {
  const defaults = emptyBucket(garmentType);
  if (!raw || typeof raw !== 'object') return defaults;

  if (Array.isArray(raw)) {
    const baseId = getMeasurementGuideDefaultAssetId(garmentType);
    return {
      byAsset: baseId ? { [baseId]: normalizeGuides(raw) } : {},
    };
  }

  const record = raw as Record<string, unknown>;
  const byAsset: Record<string, MeasurementGuideDef[]> = {};

  if (record.byAsset && typeof record.byAsset === 'object' && !Array.isArray(record.byAsset)) {
    for (const [assetId, guides] of Object.entries(record.byAsset as Record<string, unknown>)) {
      if (!assetId || assetId === GARMENT_NONE || !Array.isArray(guides)) continue;
      byAsset[assetId] = normalizeGuides(guides);
    }
  }

  // Legacy body / base → primary garment asset
  const legacyBody = Array.isArray(record.body)
    ? normalizeGuides(record.body)
    : Array.isArray(record.base)
      ? normalizeGuides(record.base)
      : null;
  if (legacyBody?.length) {
    const baseId = getMeasurementGuideDefaultAssetId(garmentType);
    if (baseId && !byAsset[baseId]?.length) byAsset[baseId] = legacyBody;
  }

  // Legacy v4 packs
  if (record.packs && typeof record.packs === 'object' && !Array.isArray(record.packs)) {
    for (const [key, guides] of Object.entries(record.packs as Record<string, unknown>)) {
      if (!Array.isArray(guides)) continue;
      if (key === 'body' || key === 'base') {
        const baseId = getMeasurementGuideDefaultAssetId(garmentType);
        if (baseId && !byAsset[baseId]?.length) byAsset[baseId] = normalizeGuides(guides);
        continue;
      }
      const assetId = legacyPackKeyToAssetId(key);
      if (!assetId || byAsset[assetId]?.length) continue;
      byAsset[assetId] = normalizeGuides(guides);
    }
  }

  if (Object.keys(byAsset).length === 0) return defaults;
  return { byAsset };
}

function normalizeStore(raw: unknown): MeasurementGuideStore {
  const defaults = buildDefaultStore();
  if (!raw || typeof raw !== 'object') return defaults;

  if (Array.isArray(raw)) {
    const baseId = getMeasurementGuideDefaultAssetId('tshirt');
    return {
      ...defaults,
      tshirt: { byAsset: baseId ? { [baseId]: normalizeGuides(raw) } : {} },
    };
  }

  const next = { ...defaults };
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isGarmentId(key)) continue;
    if (Array.isArray(value)) {
      const baseId = getMeasurementGuideDefaultAssetId(key);
      next[key] = { byAsset: baseId ? { [baseId]: normalizeGuides(value) } : {} };
      continue;
    }
    next[key] = normalizeBucket(value, key);
  }
  return next;
}

function loadMeasurementGuideStore(): MeasurementGuideStore {
  if (typeof window === 'undefined') return buildDefaultStore();
  // Cloud is source of truth when Supabase is configured; skip local hydrate.
  if (isSupabaseConfigured) return buildDefaultStore();
  try {
    const rawV6 = window.localStorage.getItem(STORAGE_KEY);
    if (rawV6) return normalizeStore(JSON.parse(rawV6));

    for (const key of LEGACY_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const migrated = normalizeStore(JSON.parse(raw));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return buildDefaultStore();
  } catch {
    return buildDefaultStore();
  }
}

function persistMeasurementGuideStoreLocal() {
  if (typeof window === 'undefined' || isSupabaseConfigured) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(measurementGuideStore));
  } catch {
    /* ignore */
  }
}

function emitMeasurementGuideStoreChange() {
  measurementGuideStoreVersion += 1;
  resolvedGuideCache.clear();
  for (const listener of listeners) listener();
}

function refreshMeasurementGuideStoreFromStorage() {
  if (isSupabaseConfigured) return;
  measurementGuideStore = loadMeasurementGuideStore();
  emitMeasurementGuideStoreChange();
}

async function flushRemotePack(garmentType: MeasurementGuideGarmentId, assetId: string) {
  const key = packKey(garmentType, assetId);
  try {
    setSyncStatus('saving');
    if (pendingRemoteDeletes.has(key)) {
      await deleteMeasurementGuidePack(garmentType, assetId);
      pendingRemoteDeletes.delete(key);
    } else {
      const guides = getBucket(garmentType).byAsset[assetId] ?? [];
      if (guides.length === 0) {
        await deleteMeasurementGuidePack(garmentType, assetId);
      } else {
        await upsertMeasurementGuidePack(garmentType, assetId, guides);
      }
    }
    setSyncStatus('saved');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save measurement guides';
    setSyncStatus('error', message);
    throw err;
  }
}

function scheduleRemotePackPersist(garmentType: MeasurementGuideGarmentId, assetId: string) {
  if (!isSupabaseConfigured) {
    persistMeasurementGuideStoreLocal();
    setSyncStatus('local');
    return;
  }
  const key = packKey(garmentType, assetId);
  const existing = remoteSaveTimers.get(key);
  if (existing) clearTimeout(existing);
  setSyncStatus('saving');
  remoteSaveTimers.set(
    key,
    setTimeout(() => {
      remoteSaveTimers.delete(key);
      void flushRemotePack(garmentType, assetId).catch(() => {
        /* status already set */
      });
    }, REMOTE_SAVE_DEBOUNCE_MS),
  );
}

function applyRemotePacksToStore(
  packs: { garmentType: MeasurementGuideGarmentId; assetId: string; guides: MeasurementGuideDef[] }[],
) {
  const next = buildDefaultStore();
  // Start empty when cloud has data; keep seeded defaults only if remote is empty.
  if (packs.length > 0) {
    next.tshirt = { byAsset: {} };
    next.hoodie = { byAsset: {} };
    next.trousers = { byAsset: {} };
  }
  for (const pack of packs) {
    if (!isGarmentId(pack.garmentType) || !pack.assetId) continue;
    next[pack.garmentType] = {
      byAsset: {
        ...next[pack.garmentType].byAsset,
        [pack.assetId]: normalizeGuides(pack.guides),
      },
    };
  }
  measurementGuideStore = next;
  measurementGuideHydratedFromRemote = true;
  emitMeasurementGuideStoreChange();
}

/** Load shared packs from Supabase (no-op / local defaults when not configured). */
export async function hydrateMeasurementGuidesFromRemote(force = false): Promise<void> {
  if (!isSupabaseConfigured) {
    setSyncStatus('local');
    return;
  }
  if (measurementGuideHydratePromise && !force) return measurementGuideHydratePromise;
  if (measurementGuideHydratedFromRemote && !force) return;

  measurementGuideHydratePromise = (async () => {
    setSyncStatus('loading');
    try {
      const packs = await fetchAllMeasurementGuidePacks();
      applyRemotePacksToStore(packs);
      setSyncStatus(packs.length > 0 ? 'saved' : 'idle');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load measurement guides';
      setSyncStatus('error', message);
    } finally {
      measurementGuideHydratePromise = null;
    }
  })();

  return measurementGuideHydratePromise;
}

if (typeof window !== 'undefined') {
  measurementGuideStore = loadMeasurementGuideStore();
  if (!isSupabaseConfigured) {
    setSyncStatus('local');
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY || LEGACY_KEYS.includes(event.key as (typeof LEGACY_KEYS)[number])) {
        refreshMeasurementGuideStoreFromStorage();
      }
    });
  }
}

function getBucket(garmentType: MeasurementGuideGarmentId): MeasurementGuideGarmentBucket {
  return measurementGuideStore[garmentType] ?? measurementGuideStore.tshirt;
}

export function measurementGuideCategoryLabel(
  garmentType: MeasurementGuideGarmentId,
  category: string,
): string {
  const config = getGarmentSvgConfig(garmentType);
  const layerId = config.categoryLayerId[category];
  if (layerId && config.layerLabels[layerId]) return config.layerLabels[layerId];
  return category;
}

export function measurementGuideScopeLabel(
  garmentType: MeasurementGuideGarmentId,
  scope: MeasurementGuideScopeId,
): string {
  if (scope === MEASUREMENT_GUIDE_BODY_SCOPE || scope === 'base') {
    const baseId = getMeasurementGuideDefaultAssetId(garmentType);
    if (baseId) return measurementGuideScopeLabel(garmentType, baseId);
    return 'Base';
  }
  const asset = getGarmentAsset(scope);
  if (!asset || asset.garmentType !== garmentType) return scope;
  return `${measurementGuideCategoryLabel(garmentType, asset.category)} · ${asset.displayName}`;
}

/** Resolve legacy `body` to the real base asset id. */
export function resolveMeasurementGuideScopeId(
  garmentType: MeasurementGuideGarmentId,
  scope: MeasurementGuideScopeId | typeof MEASUREMENT_GUIDE_BODY_SCOPE,
): string | null {
  if (scope === MEASUREMENT_GUIDE_BODY_SCOPE || scope === 'base') {
    return getMeasurementGuideDefaultAssetId(garmentType);
  }
  return getGarmentAsset(scope)?.garmentType === garmentType ? scope : null;
}

export function getMeasurementGuideAssignableAssets(garmentType: MeasurementGuideGarmentId) {
  const config = getGarmentSvgConfig(garmentType);
  return config.categoryOrder.flatMap((category) =>
    getGarmentAssets(garmentType, category).map((asset) => ({
      id: asset.id,
      displayName: asset.displayName,
      category,
      categoryLabel: measurementGuideCategoryLabel(garmentType, category),
    })),
  );
}

export function getMeasurementGuideDefs(
  garmentType: MeasurementGuideGarmentId = 'tshirt',
  scope: MeasurementGuideScopeId = '',
): MeasurementGuideDef[] {
  const assetId =
    resolveMeasurementGuideScopeId(garmentType, scope) ??
    getMeasurementGuideDefaultAssetId(garmentType);
  if (!assetId) return EMPTY_GUIDES;
  return getBucket(garmentType).byAsset[assetId] ?? EMPTY_GUIDES;
}

function appendAssetGuides(
  merged: ResolvedMeasurementGuide[],
  guides: MeasurementGuideDef[],
  assetId: string,
  garmentType: MeasurementGuideGarmentId,
) {
  const assignedLabel = measurementGuideScopeLabel(garmentType, assetId);
  for (const guide of guides) {
    merged.push({ ...guide, assignedTo: assetId, assignedLabel });
  }
}

/**
 * Lines from every selected asset, combined for the builder preview / table.
 */
export function resolveMeasurementGuides(
  garmentType: MeasurementGuideGarmentId = 'tshirt',
  selection?: GarmentAssetSelection | null,
): ResolvedMeasurementGuide[] {
  const sel = selection ?? getDefaultGarmentSelection(garmentType);
  const cacheKey = `${garmentType}:${JSON.stringify(sel)}`;
  const cached = resolvedGuideCache.get(cacheKey);
  if (cached && cached.version === measurementGuideStoreVersion) return cached.guides;

  const bucket = getBucket(garmentType);
  const merged: ResolvedMeasurementGuide[] = [];
  const seen = new Set<string>();

  for (const assetId of Object.values(sel)) {
    if (!assetId || assetId === GARMENT_NONE || seen.has(assetId)) continue;
    seen.add(assetId);
    const pack = bucket.byAsset[assetId];
    if (pack?.length) appendAssetGuides(merged, pack, assetId, garmentType);
  }

  resolvedGuideCache.set(cacheKey, { version: measurementGuideStoreVersion, guides: merged });
  return merged;
}

export function listAllAssignedMeasurementGuides(
  garmentType: MeasurementGuideGarmentId,
): ResolvedMeasurementGuide[] {
  const cacheKey = `all:${garmentType}`;
  const cached = resolvedGuideCache.get(cacheKey);
  if (cached && cached.version === measurementGuideStoreVersion) return cached.guides;

  const bucket = getBucket(garmentType);
  const rows: ResolvedMeasurementGuide[] = [];
  const assetIds = Object.keys(bucket.byAsset).sort((a, b) =>
    measurementGuideScopeLabel(garmentType, a).localeCompare(
      measurementGuideScopeLabel(garmentType, b),
    ),
  );
  for (const assetId of assetIds) {
    const pack = bucket.byAsset[assetId];
    if (!pack?.length) continue;
    appendAssetGuides(rows, pack, assetId, garmentType);
  }
  resolvedGuideCache.set(cacheKey, { version: measurementGuideStoreVersion, guides: rows });
  return rows;
}

export function useAllAssignedMeasurementGuides(
  garmentType: MeasurementGuideGarmentId,
): ResolvedMeasurementGuide[] {
  return useSyncExternalStore(
    subscribeMeasurementGuides,
    () => listAllAssignedMeasurementGuides(garmentType),
    () => [],
  );
}

export function seedSuggestedGuidesForAsset(
  garmentType: MeasurementGuideGarmentId,
  assetId: string,
): MeasurementGuideDef[] | null {
  const asset = getGarmentAsset(assetId);
  if (!asset || asset.garmentType !== garmentType) return null;
  const label = measurementGuideCategoryLabel(garmentType, asset.category);
  if (categoryLooksLike(label, 'neck')) return structuredClone(SUGGESTED_NECK_GUIDES);
  if (categoryLooksLike(label, 'sleeve') && !categoryLooksLike(label, 'hem')) {
    return structuredClone(SUGGESTED_SLEEVE_GUIDES);
  }
  if (categoryLooksLike(label, 'base')) return structuredClone(DEFAULT_BASE_GUIDES);
  return null;
}

export function upsertMeasurementGuideDefs(
  garmentType: MeasurementGuideGarmentId,
  next: MeasurementGuideDef[],
  scope: MeasurementGuideScopeId,
): void {
  const assetId = resolveMeasurementGuideScopeId(garmentType, scope);
  if (!assetId) return;
  const bucket = getBucket(garmentType);
  measurementGuideStore = {
    ...measurementGuideStore,
    [garmentType]: {
      byAsset: {
        ...bucket.byAsset,
        [assetId]: normalizeGuides(cloneGuides(next)),
      },
    },
  };
  pendingRemoteDeletes.delete(packKey(garmentType, assetId));
  scheduleRemotePackPersist(garmentType, assetId);
  emitMeasurementGuideStoreChange();
}

export function updateMeasurementGuide(
  garmentType: MeasurementGuideGarmentId,
  id: MeasurementGuideId,
  patch: Partial<Omit<MeasurementGuideDef, 'id'>>,
  scope: MeasurementGuideScopeId,
): void {
  const current = getMeasurementGuideDefs(garmentType, scope);
  upsertMeasurementGuideDefs(
    garmentType,
    current.map((guide) => (guide.id === id ? normalizeGuide({ ...guide, ...patch }) : guide)),
    scope,
  );
}

export function addMeasurementGuide(
  garmentType: MeasurementGuideGarmentId,
  scope: MeasurementGuideScopeId,
): MeasurementGuideDef {
  const guide: MeasurementGuideDef = {
    id: `guide_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    label: 'New measurement',
    x1: 320,
    y1: 420,
    x2: 680,
    y2: 420,
    labelX: 500,
    labelY: 380,
    labelAlign: 'center',
  };
  upsertMeasurementGuideDefs(
    garmentType,
    [...getMeasurementGuideDefs(garmentType, scope), guide],
    scope,
  );
  return guide;
}

export function removeMeasurementGuide(
  garmentType: MeasurementGuideGarmentId,
  id: MeasurementGuideId,
  scope: MeasurementGuideScopeId,
): void {
  upsertMeasurementGuideDefs(
    garmentType,
    getMeasurementGuideDefs(garmentType, scope).filter((guide) => guide.id !== id),
    scope,
  );
}

export function clearMeasurementGuideScope(
  garmentType: MeasurementGuideGarmentId,
  scope: MeasurementGuideScopeId,
): void {
  const assetId = resolveMeasurementGuideScopeId(garmentType, scope);
  if (!assetId) return;
  const bucket = getBucket(garmentType);
  const { [assetId]: _removed, ...rest } = bucket.byAsset;
  measurementGuideStore = {
    ...measurementGuideStore,
    [garmentType]: { byAsset: rest },
  };
  pendingRemoteDeletes.add(packKey(garmentType, assetId));
  scheduleRemotePackPersist(garmentType, assetId);
  emitMeasurementGuideStoreChange();
}

export function seedAssetMeasurementGuides(
  garmentType: MeasurementGuideGarmentId,
  assetId: string,
): boolean {
  const suggested = seedSuggestedGuidesForAsset(garmentType, assetId);
  if (!suggested?.length) return false;
  if (getMeasurementGuideDefs(garmentType, assetId).length > 0) return false;
  upsertMeasurementGuideDefs(garmentType, suggested, assetId);
  return true;
}

export function resetMeasurementGuideDefs(garmentType?: MeasurementGuideGarmentId): void {
  const previous = measurementGuideStore;
  if (garmentType) {
    measurementGuideStore = { ...measurementGuideStore, [garmentType]: emptyBucket(garmentType) };
  } else {
    measurementGuideStore = buildDefaultStore();
  }
  if (isSupabaseConfigured) {
    const types: MeasurementGuideGarmentId[] = garmentType
      ? [garmentType]
      : ['tshirt', 'hoodie', 'trousers'];
    for (const type of types) {
      const prevAssets = Object.keys(previous[type]?.byAsset ?? {});
      const nextAssets = new Set(Object.keys(measurementGuideStore[type].byAsset));
      for (const assetId of prevAssets) {
        if (!nextAssets.has(assetId)) {
          pendingRemoteDeletes.add(packKey(type, assetId));
          scheduleRemotePackPersist(type, assetId);
        }
      }
      for (const assetId of nextAssets) {
        pendingRemoteDeletes.delete(packKey(type, assetId));
        scheduleRemotePackPersist(type, assetId);
      }
    }
  } else {
    persistMeasurementGuideStoreLocal();
    setSyncStatus('local');
  }
  emitMeasurementGuideStoreChange();
}

export function selectionForGuideScope(
  garmentType: MeasurementGuideGarmentId,
  scope: MeasurementGuideScopeId,
): GarmentAssetSelection {
  const selection = getDefaultGarmentSelection(garmentType);
  const assetId = resolveMeasurementGuideScopeId(garmentType, scope);
  if (!assetId) return selection;
  const asset = getGarmentAsset(assetId);
  if (asset && asset.garmentType === garmentType) {
    selection[asset.category] = asset.id;
  }
  return selection;
}

function subscribeMeasurementGuides(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMeasurementGuides(
  garmentType: MeasurementGuideGarmentId = 'tshirt',
  scope: MeasurementGuideScopeId = '',
): MeasurementGuideDef[] {
  const assetId =
    resolveMeasurementGuideScopeId(garmentType, scope) ??
    getMeasurementGuideDefaultAssetId(garmentType) ??
    '';
  return useSyncExternalStore(
    subscribeMeasurementGuides,
    () => getMeasurementGuideDefs(garmentType, assetId),
    () => EMPTY_GUIDES,
  );
}

export function useResolvedMeasurementGuides(
  garmentType: MeasurementGuideGarmentId = 'tshirt',
  selection?: GarmentAssetSelection | null,
): ResolvedMeasurementGuide[] {
  return useSyncExternalStore(
    subscribeMeasurementGuides,
    () => resolveMeasurementGuides(garmentType, selection),
    () => [],
  );
}

export function MeasurementGuideOverlay({
  highlightedId,
  editable,
  guides,
  garmentType = 'tshirt',
  selection,
  onGuidePointerDown,
}: {
  highlightedId?: string | null;
  editable?: boolean;
  guides?: MeasurementGuideDef[];
  garmentType?: MeasurementGuideGarmentId;
  selection?: GarmentAssetSelection | null;
  onGuidePointerDown?: (guideId: MeasurementGuideId, event: ReactPointerEvent<SVGGElement>) => void;
}) {
  const storeGuides = useResolvedMeasurementGuides(garmentType, selection);
  const activeGuides = guides ?? storeGuides;

  return (
    <svg
      className={cn(
        'pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible',
        editable && 'pointer-events-auto',
      )}
      viewBox={`0 0 ${MEASUREMENT_GUIDE_VIEWBOX} ${MEASUREMENT_GUIDE_VIEWBOX}`}
      preserveAspectRatio="none"
      overflow="visible"
      aria-hidden="true"
    >
      {activeGuides.map((guide, index) => {
        const resolved = guide as MeasurementGuideDef & { assignedTo?: string };
        const rowKey = `${resolved.assignedTo ?? 'asset'}:${guide.id}:${index}`;
        const active = highlightedId === null || highlightedId === guide.id;
        const opacity = highlightedId && !active ? 0.22 : 0.92;
        const letterOpacity = highlightedId && !active ? 0.35 : 1;
        const letter = measurementGuideLetterAt(index);
        const angle = Math.atan2(guide.y2 - guide.y1, guide.x2 - guide.x1);
        const letterOffset = 20;
        const letterX = (guide.x1 + guide.x2) / 2 + Math.sin(angle) * letterOffset;
        const letterY = (guide.y1 + guide.y2) / 2 - Math.cos(angle) * letterOffset;
        const arrowLen = 5;
        const ux = Math.cos(angle);
        const uy = Math.sin(angle);
        const lineX1 = guide.x1 + ux * arrowLen;
        const lineY1 = guide.y1 + uy * arrowLen;
        const lineX2 = guide.x2 - ux * arrowLen;
        const lineY2 = guide.y2 - uy * arrowLen;

        return (
          <g
            key={rowKey}
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
              x1={lineX1}
              y1={lineY1}
              x2={lineX2}
              y2={lineY2}
              stroke="#FF3B30"
              strokeWidth={1.75}
              strokeDasharray="8 7"
              strokeLinecap="butt"
            />
            <polygon
              points={measurementGuideArrowPoints(guide.x1, guide.y1, angle + Math.PI, arrowLen)}
              fill="#FF3B30"
            />
            <polygon
              points={measurementGuideArrowPoints(guide.x2, guide.y2, angle, arrowLen)}
              fill="#FF3B30"
            />
            <g opacity={letterOpacity}>
              <circle cx={letterX} cy={letterY} r={11} fill="#09090B" stroke="#FF3B30" strokeWidth={1.25} />
              <text
                x={letterX}
                y={letterY}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#FF3B30"
                fontSize={11}
                fontWeight={700}
                style={{ fontFamily: 'system-ui, sans-serif' }}
              >
                {letter}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

function measurementGuideArrowPoints(
  tipX: number,
  tipY: number,
  directionRad: number,
  size: number,
): string {
  const back = size;
  const wing = size * 0.52;
  const baseX = tipX - Math.cos(directionRad) * back;
  const baseY = tipY - Math.sin(directionRad) * back;
  const perpX = -Math.sin(directionRad) * wing;
  const perpY = Math.cos(directionRad) * wing;
  return `${tipX},${tipY} ${baseX + perpX},${baseY + perpY} ${baseX - perpX},${baseY - perpY}`;
}

export function getMeasurementGuideCenter(guide: MeasurementGuideDef) {
  return {
    x: (guide.x1 + guide.x2) / 2,
    y: (guide.y1 + guide.y2) / 2,
  };
}

export function getMeasurementGuideAngleDegrees(guide: MeasurementGuideDef): number {
  const degrees = (Math.atan2(guide.y2 - guide.y1, guide.x2 - guide.x1) * 180) / Math.PI;
  return Math.round(degrees * 10) / 10;
}

export function getMeasurementGuideLength(guide: MeasurementGuideDef): number {
  return Math.hypot(guide.x2 - guide.x1, guide.y2 - guide.y1);
}

export function setMeasurementGuideLengthFromStart(
  guide: MeasurementGuideDef,
  length: number,
): Pick<MeasurementGuideDef, 'x1' | 'y1' | 'x2' | 'y2' | 'labelX' | 'labelY'> {
  const safeLength = Math.max(8, length);
  const angleRad = Math.atan2(guide.y2 - guide.y1, guide.x2 - guide.x1);
  const x2 = guide.x1 + Math.cos(angleRad) * safeLength;
  const y2 = guide.y1 + Math.sin(angleRad) * safeLength;
  return {
    x1: guide.x1,
    y1: guide.y1,
    x2,
    y2,
    labelX: (guide.x1 + x2) / 2,
    labelY: (guide.y1 + y2) / 2,
  };
}

export function rotateMeasurementGuideAroundCenter(
  guide: MeasurementGuideDef,
  degrees: number,
): Pick<MeasurementGuideDef, 'x1' | 'y1' | 'x2' | 'y2' | 'labelX' | 'labelY'> {
  const center = getMeasurementGuideCenter(guide);
  const halfLen = Math.hypot(guide.x2 - guide.x1, guide.y2 - guide.y1) / 2;
  const rad = (degrees * Math.PI) / 180;
  const dx = Math.cos(rad) * halfLen;
  const dy = Math.sin(rad) * halfLen;
  return {
    x1: center.x - dx,
    y1: center.y - dy,
    x2: center.x + dx,
    y2: center.y + dy,
    labelX: center.x,
    labelY: center.y,
  };
}
