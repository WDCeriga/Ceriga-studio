import { useSyncExternalStore } from 'react';

/**
 * What the Artwork engine knows about the surface it is drawing on, set by the host context
 * (garment, asset, label, packaging). Phase 0 carries the garment colour so new objects start readable.
 */
export type ArtworkScene = { surfaceColour?: string };

let scene: ArtworkScene = {};
const listeners = new Set<() => void>();

export function setArtworkScene(next: ArtworkScene) {
  if (next.surfaceColour === scene.surfaceColour) return;
  scene = { ...scene, ...next };
  // Exposed to CSS so previews (layer thumbnails) can show light artwork on the garment colour.
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--cx-artwork-surface', scene.surfaceColour ?? '#f5f5f4');
  listeners.forEach(listener => listener());
}

export function getArtworkScene(): ArtworkScene { return scene; }

export function useArtworkScene(): ArtworkScene {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, getArtworkScene, getArtworkScene);
}
