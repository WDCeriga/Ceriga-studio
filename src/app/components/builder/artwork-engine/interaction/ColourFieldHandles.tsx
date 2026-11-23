import { useRef } from 'react';
import type { DesignElement } from '../../PrintStudioEditor';
import { setFieldPoint, useFieldPoint } from '../state/fieldPointSelection';
import './colour-field-handles.css';

/** Drag a colour directly on the artwork. Lives in garment coordinates, sized to the object. */
export function ColourFieldHandles({ element, inverseScale, onChange }: { element: DesignElement; inverseScale: number; onChange: (patch: Partial<DesignElement>, transient: boolean) => void }) {
  const active = useFieldPoint(), host = useRef<HTMLDivElement>(null), field = element.colourField;
  if (!field) return null;
  const start = (event: React.PointerEvent, id: string) => {
    event.preventDefault(); event.stopPropagation(); setFieldPoint(id);
    const zone = host.current?.offsetParent as HTMLElement | null, ratio = zone ? zone.getBoundingClientRect().width / Math.max(1, zone.offsetWidth) : 1;
    const origin = field.points.find(item => item.id === id)!, startX = event.clientX, startY = event.clientY, a = -element.rotation * Math.PI / 180;
    let latest = field, frame = 0, moved = false;
    const write = (transient: boolean) => onChange({ colourField: latest }, transient);
    const move = (e: PointerEvent) => {
      const gx = (e.clientX - startX) / ratio, gy = (e.clientY - startY) / ratio, lx = (gx * Math.cos(a) - gy * Math.sin(a)) * (element.flipHorizontal ? -1 : 1), ly = (gx * Math.sin(a) + gy * Math.cos(a)) * (element.flipVertical ? -1 : 1);
      const x = Math.max(-20, Math.min(120, origin.x + lx / Math.max(1, element.width) * 100)), y = Math.max(-20, Math.min(120, origin.y + ly / Math.max(1, element.height) * 100));
      latest = { ...field, points: field.points.map(item => item.id === id ? { ...item, x, y } : item) }; moved = true;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; write(true); });
    };
    const up = () => { if (frame) cancelAnimationFrame(frame); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (moved) write(false); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  return <div ref={host} data-editor-chrome className="cx-field-handles" style={{ left: element.x, top: element.y, width: element.width, height: element.height, transform: `translate(-50%,-50%) rotate(${element.rotation}deg) scale(${element.flipHorizontal ? -1 : 1},${element.flipVertical ? -1 : 1})` }}>
    {field.points.map((item, index) => <button key={item.id} type="button" aria-label={`Colour point ${index + 1}`} aria-pressed={active === item.id} style={{ left: `${item.x}%`, top: `${item.y}%`, background: item.colour, transform: `translate(-50%,-50%) scale(${inverseScale})` }} onPointerDown={event => start(event, item.id)} />)}
  </div>;
}
