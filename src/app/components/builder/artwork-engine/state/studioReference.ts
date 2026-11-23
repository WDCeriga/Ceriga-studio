import { useSyncExternalStore } from 'react';

/** A reference belongs to the workspace, never to the asset, so it cannot reach a saved design or print file. */
export type StudioReference = { open: boolean; image: string | null; name: string; aspect: number; x: number; y: number; width: number; opacity: number };
export const DEFAULT_REFERENCE: StudioReference = { open: false, image: null, name: '', aspect: 1, x: 72, y: 72, width: 260, opacity: 100 };
export const REFERENCE_MIN_WIDTH = 160;
export const REFERENCE_MAX_WIDTH = 640;
const HEADER = 38;

/** Keeps the window's header reachable inside the canvas area at any size. */
export function clampReferenceFrame(frame: { x: number; y: number; width: number }, areaWidth: number, areaHeight: number) {
  const width = Math.round(Math.max(REFERENCE_MIN_WIDTH, Math.min(REFERENCE_MAX_WIDTH, Math.min(frame.width, Math.max(REFERENCE_MIN_WIDTH, areaWidth - 16)))));
  return { width, x: Math.round(Math.max(8, Math.min(Math.max(8, areaWidth - width - 8), frame.x))), y: Math.round(Math.max(8, Math.min(Math.max(8, areaHeight - HEADER - 8), frame.y))) };
}
export function readReference(raw: string | null): StudioReference {
  try {
    const v = JSON.parse(raw ?? 'null');
    if (!v || typeof v !== 'object') return DEFAULT_REFERENCE;
    const number = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    return { open: v.open === true, image: typeof v.image === 'string' && v.image.startsWith('data:image/') ? v.image : null, name: typeof v.name === 'string' ? v.name.slice(0, 120) : '', aspect: Math.max(.1, Math.min(10, number(v.aspect, 1))), x: number(v.x, DEFAULT_REFERENCE.x), y: number(v.y, DEFAULT_REFERENCE.y), width: Math.max(REFERENCE_MIN_WIDTH, Math.min(REFERENCE_MAX_WIDTH, number(v.width, DEFAULT_REFERENCE.width))), opacity: Math.max(20, Math.min(100, number(v.opacity, 100))) };
  } catch { return DEFAULT_REFERENCE; }
}

const KEY = 'ceriga.assetStudio.reference.v1';
const safeRead = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
let reference = readReference(typeof localStorage === 'undefined' ? null : safeRead());
const listeners = new Set<() => void>();
/** Returns false when the browser could not remember it; the reference still works until reload. */
export function setReference(patch: Partial<StudioReference>) {
  reference = { ...reference, ...patch };
  let remembered = true;
  try { localStorage.setItem(KEY, JSON.stringify(reference)); } catch { remembered = false; }
  listeners.forEach(listener => listener());
  return remembered;
}
export const getReference = () => reference;
export const useReference = () => useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => reference, () => reference);
