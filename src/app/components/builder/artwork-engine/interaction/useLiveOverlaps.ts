import { useEffect, useRef } from 'react';
import type { DesignElement } from '../../PrintStudioEditor';
import { loadFontLibrary } from '../../printsStudio/designLibrary';
import { overlapIsStale, refreshOverlap } from '../geometry/overlap';

/** Keeps every overlap colour in step with its two source objects. */
export function useLiveOverlaps(elements: DesignElement[], commit: (next: DesignElement[]) => void) {
  const latest = useRef({ elements, commit }); latest.current = { elements, commit };
  useEffect(() => {
    const stale = elements.filter(element => element.overlapOf && overlapIsStale(element, elements.find(item => item.id === element.overlapOf!.a), elements.find(item => item.id === element.overlapOf!.b)));
    if (!stale.length) return;
    let live = true;
    const timer = window.setTimeout(async () => {
      try {
        const patches = await Promise.all(stale.map(async overlap => [overlap.id, await refreshOverlap(overlap, elements.find(item => item.id === overlap.overlapOf!.a)!, elements.find(item => item.id === overlap.overlapOf!.b)!, loadFontLibrary())] as const));
        if (!live) return;
        const byId = new Map(patches);
        latest.current.commit(latest.current.elements.map(element => byId.has(element.id) ? { ...element, ...byId.get(element.id) } : element));
      } catch { /* keep the last good overlap */ }
    }, 40);
    return () => { live = false; window.clearTimeout(timer); };
  }, [elements]);
}
