import { useSyncExternalStore } from 'react';

/** Lets the floating bar open a section of the image panel. */
export type ImageTool = 'recolour' | 'trace';
let tool: ImageTool | null = null;
const listeners = new Set<() => void>();
export function revealImageTool(next: ImageTool | null) { if (next !== tool) { tool = next; listeners.forEach(listener => listener()); } }
export const useImageTool = () => useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => tool, () => tool);
