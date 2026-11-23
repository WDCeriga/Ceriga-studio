import { useSyncExternalStore } from 'react';

/** The colour-field point being edited, shared by the canvas handles and the panel. */
let selected: string | null = null;
const listeners = new Set<() => void>();
export function setFieldPoint(id: string | null) { if (id !== selected) { selected = id; listeners.forEach(listener => listener()); } }
export const useFieldPoint = () => useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => selected, () => selected);
