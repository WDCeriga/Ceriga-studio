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
export const getGuides = () => guides;
/** Vanishing point handles show only while the Guides menu is open, so they never block drawing. */
let editing = false;
const editingListeners = new Set<() => void>();
export function setGuideEditing(next: boolean) { if (next === editing) return; editing = next; editingListeners.forEach(listener => listener()); }
export const useGuideEditing = () => useSyncExternalStore(listener => { editingListeners.add(listener); return () => editingListeners.delete(listener); }, () => editing, () => editing);
export const useGuides = () => useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => guides, () => guides);
