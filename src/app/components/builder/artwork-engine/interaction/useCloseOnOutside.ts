import { useEffect, useRef } from 'react';

/** The canvas stops pointer events, so floating menus listen before it does to close on an outside click. */
export function useCloseOnOutside(open: boolean, close: () => void) {
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    if (!open) return;
    const down = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.('[data-radix-popper-content-wrapper],[data-guide-handle],[data-guide-control],[aria-expanded="true"]')) return;
      latest.current();
    };
    document.addEventListener('pointerdown', down, true);
    return () => document.removeEventListener('pointerdown', down, true);
  }, [open]);
}
