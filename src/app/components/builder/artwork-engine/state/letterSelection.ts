import { useSyncExternalStore } from 'react';

/** The letter being stretched, shared by the canvas handles and the exact values in the panel. */
let selection: { elementId: string; key: string } | null = null;
const listeners = new Set<() => void>();

export function setLetterSelection(next: { elementId: string; key: string } | null) {
  if (next?.elementId === selection?.elementId && next?.key === selection?.key) return;
  selection = next; listeners.forEach(listener => listener());
}
export const getLetterSelection = () => selection;
export function useLetterSelection() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, getLetterSelection, getLetterSelection);
}
