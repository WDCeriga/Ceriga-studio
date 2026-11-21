import { useEffect, useSyncExternalStore } from 'react';

/**
 * Focus mode (plan §4.2 FOCUS, rule R11): hides the left rail and the right panel so the canvas fills
 * the screen. The escape path always stays: current tool, context toolbar, zoom, undo/redo, Exit focus.
 * Exposed as `data-artwork-focus` on <html> so the shell's CSS can collapse its columns.
 */
let focused = false;
const listeners = new Set<() => void>();

export function setArtworkFocus(next: boolean) {
  if (next === focused) return;
  focused = next;
  if (typeof document !== 'undefined') {
    if (next) document.documentElement.dataset.artworkFocus = 'true';
    else delete document.documentElement.dataset.artworkFocus;
  }
  listeners.forEach(listener => listener());
}

export const isArtworkFocus = () => focused;

export function useArtworkFocus(): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, isArtworkFocus, isArtworkFocus);
  return [value, setArtworkFocus];
}

/** Binds F to toggle focus and always leaves focus when the host canvas unmounts. */
export function useArtworkFocusShortcut(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      if (event.key.toLowerCase() === 'f') { event.preventDefault(); setArtworkFocus(!focused); }
      else if (event.key === 'Escape' && focused && !document.querySelector('.cx-selection-chrome')) { setArtworkFocus(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); setArtworkFocus(false); };
  }, [enabled]);
}
