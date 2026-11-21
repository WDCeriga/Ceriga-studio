import { useSyncExternalStore } from 'react';

/** Shape builder session (plan F.1 / ref 15): which selected objects are being rebuilt, or null when off. */
let ids: string[] | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

export const getShapeBuilder = () => ids;
export function startShapeBuilder(next: string[]) { ids = next.length > 1 ? [...next] : null; emit(); }
export function stopShapeBuilder() { if (ids) { ids = null; emit(); } }
export function useShapeBuilder(): string[] | null {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, getShapeBuilder, getShapeBuilder);
}
