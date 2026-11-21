import { useSyncExternalStore } from 'react';
import type { GarmentEdge } from '../geometry/garmentEdges';

/** The edges of the garment side on screen, published by the canvas for the text panel. */
let state: { side: 'front' | 'back'; edges: GarmentEdge[] } = { side: 'front', edges: [] };
const listeners = new Set<() => void>();

export function setGarmentEdges(side: 'front' | 'back', edges: GarmentEdge[]) { state = { side, edges }; listeners.forEach(listener => listener()); }
export const getGarmentEdges = () => state;
export function useGarmentEdges() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, getGarmentEdges, getGarmentEdges);
}
