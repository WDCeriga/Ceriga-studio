import { useEffect, useRef, useState } from 'react';
import { ArrowBigUp } from 'lucide-react';
import { usePrintsStudio } from '../printsStudio/PrintsStudioContext';
import type { DrawHistory } from './DrawPaintStudio';
import './tablet-canvas.css';

/** Shift held by the on-screen modifier. Read through MouseEvent.shiftKey so every tool honours it unchanged. */
let modifierShift = false;
const nativeShift = Object.getOwnPropertyDescriptor(MouseEvent.prototype, 'shiftKey');
function setModifier(on: boolean) {
  if (!nativeShift?.get) return;
  modifierShift = on;
  if (on) Object.defineProperty(MouseEvent.prototype, 'shiftKey', { configurable: true, get() { return modifierShift || nativeShift.get!.call(this); } });
  else Object.defineProperty(MouseEvent.prototype, 'shiftKey', nativeShift);
}

const TAP_TIME = 320, TAP_MOVE = 14;

/**
 * iPad canvas habits from Procreate, Fresco and Illustrator:
 * two-finger tap undoes, three-finger tap redoes, Apple Pencil draws while fingers pan and zoom,
 * the Pencil shows the brush before it touches down, and a modifier key stands in for Shift.
 */
export function TabletCanvasGestures({ history }: { history?: DrawHistory }) {
  const anchor = useRef<HTMLSpanElement>(null), studio = usePrintsStudio(), studioRef = useRef(studio); studioRef.current = studio;
  const historyRef = useRef(history); historyRef.current = history;
  const [flash, setFlash] = useState<{ text: string; key: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; size: number } | null>(null);
  const [modifier, setModifierState] = useState<'off' | 'held' | 'locked'>('off');
  const lastModifierTap = useRef(0);

  const say = (text: string) => setFlash({ text, key: performance.now() });
  useEffect(() => { if (!flash) return; const timer = setTimeout(() => setFlash(null), 900); return () => clearTimeout(timer); }, [flash]);
  useEffect(() => { setModifier(modifier !== 'off'); }, [modifier]);
  useEffect(() => () => setModifier(false), []);

  useEffect(() => {
    const canvas = anchor.current?.closest<HTMLElement>('.print-design-canvas');
    if (!canvas) return;
    let tap: { count: number; start: number; points: Map<number, { x: number; y: number }>; moved: boolean } | null = null;
    const touchStart = (event: TouchEvent) => {
      if (!tap || event.touches.length === 1 && event.changedTouches.length === event.touches.length) tap = { count: 0, start: performance.now(), points: new Map(), moved: false };
      for (const touch of Array.from(event.changedTouches)) tap.points.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
      tap.count = Math.max(tap.count, event.touches.length);
    };
    const touchMove = (event: TouchEvent) => {
      if (!tap) return;
      for (const touch of Array.from(event.changedTouches)) { const from = tap.points.get(touch.identifier); if (from && Math.hypot(touch.clientX - from.x, touch.clientY - from.y) > TAP_MOVE) tap.moved = true; }
    };
    const touchEnd = (event: TouchEvent) => {
      if (!tap || event.touches.length) return;
      const done = tap; tap = null;
      if (done.moved || performance.now() - done.start > TAP_TIME) return;
      const actions = historyRef.current;
      if (done.count === 2 && actions?.canUndo) { actions.onUndo(); say('Undo'); }
      else if (done.count === 3 && actions?.canRedo) { actions.onRedo(); say('Redo'); }
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'pen') return;
      const current = studioRef.current;
      if (!current.pencil.pencilOnly) {
        current.patchPencil({ pencilOnly: true });
        try { if (!sessionStorage.getItem('ceriga.pencil.noticed')) { sessionStorage.setItem('ceriga.pencil.noticed', '1'); say('Apple Pencil draws. Fingers pan and zoom.'); } } catch { /* storage can be blocked */ }
      }
    };
    const pointerMove = (event: PointerEvent) => {
      const current = studioRef.current, painting = ['brush', 'eraser', 'distress', 'distressEraser'].includes(current.tool), drawing = painting || ['shapePencil', 'shapePolygon'].includes(current.tool);
      if (event.pointerType !== 'pen' || event.buttons || !drawing) { setHover(null); return; }
      const zone = canvas.querySelector<HTMLElement>('[data-print-design-zone]');
      const scale = zone ? zone.getBoundingClientRect().width / Math.max(1, zone.offsetWidth) : 1;
      // Brushes show their real size; the vector pencil and pen show a small precise point.
      const size = painting ? (current.tool === 'brush' || current.tool === 'distress' ? current.brushSize : current.eraserSize) * scale : 6;
      setHover({ x: event.clientX, y: event.clientY, size: Math.max(4, size) });
    };
    const pointerLeave = (event: PointerEvent) => { if (event.pointerType === 'pen') setHover(null); };
    canvas.addEventListener('touchstart', touchStart, { passive: true });
    canvas.addEventListener('touchmove', touchMove, { passive: true });
    canvas.addEventListener('touchend', touchEnd, { passive: true });
    canvas.addEventListener('touchcancel', () => { tap = null; }, { passive: true });
    canvas.addEventListener('pointerdown', pointerDown, true);
    canvas.addEventListener('pointermove', pointerMove, { passive: true });
    canvas.addEventListener('pointerleave', pointerLeave);
    return () => {
      canvas.removeEventListener('touchstart', touchStart); canvas.removeEventListener('touchmove', touchMove); canvas.removeEventListener('touchend', touchEnd);
      canvas.removeEventListener('pointerdown', pointerDown, true); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerleave', pointerLeave);
    };
  }, []);

  const pressModifier = () => {
    const now = performance.now();
    if (modifier === 'locked') { setModifierState('off'); return; }
    if (now - lastModifierTap.current < 300) { setModifierState('locked'); lastModifierTap.current = 0; return; }
    lastModifierTap.current = now; setModifierState('held');
  };
  const releaseModifier = () => setModifierState(state => state === 'held' ? 'off' : state);

  return <>
    <span ref={anchor} hidden />
    <button type="button" className="tablet-modifier" data-state={modifier} aria-pressed={modifier !== 'off'} aria-label={modifier === 'locked' ? 'Shift locked. Tap to release' : 'Hold for Shift. Double-tap to lock'}
      onPointerDown={event => { event.preventDefault(); event.stopPropagation(); try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is optional */ } pressModifier(); }}
      onPointerUp={releaseModifier} onPointerCancel={releaseModifier} onContextMenu={event => event.preventDefault()}>
      <ArrowBigUp size={22} strokeWidth={1.6} />
    </button>
    {hover && <span className="tablet-pencil-hover" aria-hidden="true" style={{ left: hover.x, top: hover.y, width: hover.size, height: hover.size }} />}
    {flash && <span key={flash.key} className="tablet-gesture-flash" role="status">{flash.text}</span>}
  </>;
}
