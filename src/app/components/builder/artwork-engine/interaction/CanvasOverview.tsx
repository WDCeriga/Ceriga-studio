import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import type { AssetProject } from '../../../../lib/assetLibrary';
import { exportAssetArtboard } from '../../../../lib/exportAssetArtboard';
import { overviewPan, overviewViewport } from '../geometry/canvasOverview';
import './canvas-overview.css';

let open = false;
const listeners = new Set<() => void>();
const setOverviewOpen = (next: boolean) => { open = next; listeners.forEach(listener => listener()); };
const useOverviewOpen = () => useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => open, () => open);

export function OverviewToggle() {
  const active = useOverviewOpen();
  return <button type="button" className="cx-dock-toggle" aria-pressed={active} title="Canvas overview" onClick={() => setOverviewOpen(!active)}>Overview</button>;
}

const rects = () => {
  const artboard = document.querySelector<HTMLElement>('[data-asset-artboard]'), stage = document.querySelector<HTMLElement>('.print-garment-stage');
  if (!artboard || !stage) return null;
  const stageBox = stage.getBoundingClientRect();
  return { artboard: artboard.getBoundingClientRect(), stage: stageBox, uiScale: stageBox.width / Math.max(1, stage.offsetWidth) || 1 };
};

/** A live map of the artboard. It reads the canvas but never changes the artwork. */
export function CanvasOverview({ project, pan, onPan }: { project: AssetProject; pan: { x: number; y: number }; onPan: (pan: { x: number; y: number }) => void }) {
  const active = useOverviewOpen(), [preview, setPreview] = useState<string | null>(null), map = useRef<HTMLDivElement>(null), view = useRef<HTMLDivElement>(null), latestPan = useRef(pan);
  latestPan.current = pan;
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    // Wait for edits to settle so the map never slows down drawing.
    const timer = window.setTimeout(() => { void exportAssetArtboard(project.width, project.height, project.elements, undefined, Math.min(1, 368 / Math.max(project.width, project.height))).then(url => { if (!cancelled) setPreview(url); }).catch(() => { /* Keep the last good map. */ }); }, 450);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [active, project.elements, project.width, project.height]);
  useEffect(() => {
    if (!active) return;
    let frame = 0, last = '';
    const update = () => {
      const box = rects(), node = view.current;
      if (box && node) { const v = overviewViewport(box.artboard, box.stage), next = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.width.toFixed(4)},${v.height.toFixed(4)}`; if (next !== last) { last = next; node.style.left = `${v.x * 100}%`; node.style.top = `${v.y * 100}%`; node.style.width = `${v.width * 100}%`; node.style.height = `${v.height * 100}%`; } }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [active]);
  if (!active) return null;
  const startMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !map.current) return;
    event.preventDefault(); event.stopPropagation();
    const start = rects(); if (!start) return;
    const mapBox = map.current.getBoundingClientRect(), startPan = latestPan.current, id = event.pointerId;
    const go = (clientX: number, clientY: number) => onPan(overviewPan(startPan, start.artboard, start.stage, (clientX - mapBox.left) / mapBox.width, (clientY - mapBox.top) / mapBox.height, start.uiScale));
    go(event.clientX, event.clientY);
    const move = (next: PointerEvent) => { if (next.pointerId === id) go(next.clientX, next.clientY); };
    const end = (next: PointerEvent) => { if (next.pointerId !== id) return; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  };
  const landscape = project.width >= project.height;
  return <div data-editor-chrome data-canvas-overview className="cx-overview" role="group" aria-label="Canvas overview" onPointerDown={event => event.stopPropagation()}>
    <div ref={map} className="cx-overview-map" role="presentation" style={{ aspectRatio: `${project.width} / ${project.height}`, width: landscape ? '100%' : undefined, height: landscape ? undefined : 164, background: project.background ?? '#fff' }} onPointerDown={startMove}>
      {preview && <img src={preview} alt="" draggable={false} />}
      <div ref={view} className="cx-overview-view" />
    </div>
  </div>;
}
