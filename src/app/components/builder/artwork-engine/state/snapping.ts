import { useSyncExternalStore } from 'react';

/**
 * Snap priorities (plan C.3). Garment landmarks win over objects, objects over equal spacing; each source
 * can be switched off. Read at drag time (no re-render); remembered per browser as a convenience.
 */
export type SnapSettings = { garment: boolean; objects: boolean; spacing: boolean };
const KEY = 'ceriga.artwork.snapping';
const DEFAULTS: SnapSettings = { garment: true, objects: true, spacing: true };

function load(): SnapSettings {
  try { const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null; return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS; } catch { return DEFAULTS; }
}
let settings: SnapSettings = load();
const listeners = new Set<() => void>();

export const getSnapSettings = () => settings;
export function setSnapSetting(key: keyof SnapSettings, value: boolean) {
  settings = { ...settings, [key]: value };
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage unavailable: keep in memory */ }
  listeners.forEach(listener => listener());
}
export function useSnapSettings(): SnapSettings {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, getSnapSettings, getSnapSettings);
}
