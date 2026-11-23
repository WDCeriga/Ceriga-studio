import { useEffect, useRef, useState, type ReactNode } from 'react';

/** One preview draws at a time, with a painted frame between each, so the page stays responsive. */
const waiting: (() => void)[] = [];
let drawing = false;
function next() {
  if (drawing) return;
  const start = waiting.shift();
  if (!start) return;
  drawing = true;
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(start, { timeout: 120 });
  else window.setTimeout(start, 16);
}
function finished() { drawing = false; next(); }

export function LazyPatternPreview({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null), holding = useRef(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = host.current;
    if (visible || !node) return;
    let queued = false, cancelled = false;
    const start = () => { if (cancelled) { finished(); return; } holding.current = true; setVisible(true); };
    const observer = new IntersectionObserver(entries => {
      if (queued || !entries.some(entry => entry.isIntersecting)) return;
      queued = true; observer.disconnect(); waiting.push(start); next();
    }, { rootMargin: '240px 0px' });
    observer.observe(node);
    return () => {
      cancelled = true; observer.disconnect();
      const index = waiting.indexOf(start);
      if (index >= 0) waiting.splice(index, 1);
    };
  }, [visible]);
  useEffect(() => {
    if (!visible || !holding.current) return;
    const frame = requestAnimationFrame(() => { holding.current = false; finished(); });
    return () => { cancelAnimationFrame(frame); if (holding.current) { holding.current = false; finished(); } };
  }, [visible]);
  return <div ref={host} className="h-full w-full">{visible && children}</div>;
}
