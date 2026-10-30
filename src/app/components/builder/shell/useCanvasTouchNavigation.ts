import { useEffect, useRef, useState, type RefObject } from 'react';

type TouchGesture = { count: number; x: number; y: number; distance: number; zoom: number; pan: { x: number; y: number } };
export function resolveCanvasTouchTransform(gesture: TouchGesture, point: { x: number; y: number }, distance: number, bounds: { width: number; height: number }, limits={min:50,max:200}) {
  const zoom = gesture.count === 2 && gesture.distance > 8 ? Math.min(limits.max, Math.max(limits.min, gesture.zoom * distance / gesture.distance)) : gesture.zoom;
  const ratio = zoom / gesture.zoom;
  return { zoom, pan: { x: Math.max(-bounds.width, Math.min(bounds.width, point.x - (gesture.x - gesture.pan.x) * ratio)), y: Math.max(-bounds.height, Math.min(bounds.height, point.y - (gesture.y - gesture.pan.y) * ratio)) } };
}

/** View-mode gestures never change artwork; animation frames keep touch movement smooth. */
export function useCanvasTouchNavigation(surface: RefObject<HTMLDivElement>, enabled: boolean, zoom: number, onZoom: (value: number) => void, limits={min:50,max:200}) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const current = useRef({ pan, zoom, onZoom, limits });
  current.current = { pan, zoom, onZoom, limits };
  useEffect(() => {
    const node = surface.current;
    if (!node || !enabled) return;
    let frame: number | undefined;
    let gesture: TouchGesture | undefined;
    let pending = { pan: current.current.pan, zoom: current.current.zoom };
    const center = (touches: TouchList) => {
      const bounds = node.getBoundingClientRect();
      return { x: (touches[0].clientX + (touches[1]?.clientX ?? touches[0].clientX)) / 2 - bounds.left - bounds.width / 2,
        y: (touches[0].clientY + (touches[1]?.clientY ?? touches[0].clientY)) / 2 - bounds.top - bounds.height / 2 };
    };
    const start = (event: TouchEvent) => {
      if (event.touches.length < 1 || event.touches.length > 2) { gesture = undefined; return; }
      const point = center(event.touches);
      gesture = { count: event.touches.length, ...point, distance: event.touches.length === 2 ? Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY) : 0, zoom: current.current.zoom, pan: current.current.pan };
    };
    const flush = () => { frame = undefined; current.current.pan = pending.pan; current.current.zoom = pending.zoom; setPan(pending.pan); current.current.onZoom(pending.zoom); };
    const move = (event: TouchEvent) => {
      if (!gesture || event.touches.length !== gesture.count) return;
      event.preventDefault();
      const point = center(event.touches);
      const distance = event.touches.length === 2 ? Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY) : 0;
      pending = resolveCanvasTouchTransform(gesture, point, distance, node.getBoundingClientRect(), current.current.limits);
      if (frame === undefined) frame = requestAnimationFrame(flush);
    };
    const end = (event: TouchEvent) => { if (frame !== undefined) { cancelAnimationFrame(frame); flush(); } start(event); };
    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchmove', move, { passive: false });
    node.addEventListener('touchend', end);
    node.addEventListener('touchcancel', end);
    return () => { node.removeEventListener('touchstart', start); node.removeEventListener('touchmove', move); node.removeEventListener('touchend', end); node.removeEventListener('touchcancel', end); if (frame !== undefined) cancelAnimationFrame(frame); };
  }, [enabled, surface]);
  return { pan, setPan, reset: () => setPan({ x: 0, y: 0 }) };
}
