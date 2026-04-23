import { useEffect, useState } from 'react';

/**
 * Approximate height (px) of the on-screen area covered by the software keyboard
 * and browser chrome below the **visual** viewport. Used to pin toolbars just above
 * the keyboard (Canva-style) on mobile web.
 */
export function useVisualViewportBottomInset() {
  const [insetPx, setInsetPx] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) {
      setInsetPx(0);
      return;
    }
    const update = () => {
      const h = window.innerHeight;
      setInsetPx(Math.max(0, h - vv.height - vv.offsetTop));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return insetPx;
}
