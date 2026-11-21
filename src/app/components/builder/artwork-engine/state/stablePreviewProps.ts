import { isValidElement, useRef } from 'react';

/**
 * Keeps an expensive preview from re-rendering when its parent re-renders with equal data.
 * Event handlers (on*) get a stable wrapper that always calls the latest handler.
 * Anything else that may produce output, such as render props and React elements, must be identical to skip.
 */
type Props = Record<string, unknown>;
const isHandlerKey = (key: string) => /^on[A-Z]/.test(key);
const isPlain = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || isValidElement(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** Structural equality for plain data. Functions, elements and class instances must be the same object. */
export function sameData(a: unknown, b: unknown, depth = 0): boolean {
  if (Object.is(a, b)) return true;
  if (depth > 10) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameData(a[i], b[i], depth + 1)) return false;
    return true;
  }
  if (!isPlain(a) || !isPlain(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(b, key) || !sameData(a[key], b[key], depth + 1)) return false;
  return true;
}

/** Fields of the builder state that are artwork only; the garment drawing never reads them. */
const ARTWORK_ONLY = ['prints', 'studioArtwork', 'artworkPlacements', 'artworkSlotOverrides', 'printsLayerSelectedId'];
export function withoutArtwork<T>(state: T): T {
  if (!isPlain(state)) return state;
  const out: Record<string, unknown> = { ...state };
  for (const key of ARTWORK_ONLY) delete out[key];
  return out as T;
}
const comparable = (key: string, value: unknown) => key === 'customAssetState' ? withoutArtwork(value) : key === 'sharedGarmentProps' && isPlain(value) ? { ...value, customAssetState: withoutArtwork(value.customAssetState) } : value;

const comparableDeps = (deps: unknown) => Array.isArray(deps) ? deps.map(item => comparable('sharedGarmentProps', item)) : deps;

/** Which props differ. A render prop counts as unchanged when its declared data is unchanged. */
export function changedPreviewProps(previous: Props, next: Props) {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  const renderSame = 'renderMeasurementsDeps' in next && sameData(comparableDeps(previous.renderMeasurementsDeps), comparableDeps(next.renderMeasurementsDeps));
  return [...keys].filter(key => {
    if (key === 'renderMeasurements' && renderSame) return false;
    return !sameData(comparable(key, previous[key]), comparable(key, next[key]));
  });
}
export const samePreviewProps = (previous: Props, next: Props) => changedPreviewProps(previous, next).length === 0;

/** Replace top-level event handlers with stable wrappers that call the latest version. */
export function useStableHandlers<T extends object>(props: T): T {
  const latest = useRef(props as Props), wrappers = useRef(new Map<string, (...args: unknown[]) => unknown>());
  latest.current = props as Props;
  const out: Props = {};
  for (const [key, value] of Object.entries(props as Props)) {
    if (typeof value !== 'function' || !isHandlerKey(key)) { out[key] = value; continue; }
    if (!wrappers.current.has(key)) wrappers.current.set(key, (...args) => (latest.current[key] as ((...a: unknown[]) => unknown) | undefined)?.(...args));
    out[key] = wrappers.current.get(key);
  }
  return out as T;
}
