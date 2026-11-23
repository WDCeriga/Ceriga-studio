import { useSyncExternalStore } from 'react';
import { readGuides, type StudioGuides } from '../geometry/studioGuides';

/** Guides belong to the workspace, not the artwork, so they are remembered on this device only. */
const KEY = 'ceriga.assetStudio.guides.v1';
let guides = readGuides(typeof localStorage === 'undefined' ? null : safeRead());
const listeners = new Set<() => void>();
function safeRead() { try { return localStorage.getItem(KEY); } catch { return null; } }
export function setGuides(next: StudioGuides) {
  guides = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Guides still work for this session. */ }
  listeners.forEach(listener => listener());
}
export const useGuides = () => useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => guides, () => guides);
