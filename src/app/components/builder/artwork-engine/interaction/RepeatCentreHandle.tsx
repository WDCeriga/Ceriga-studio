import { useRef } from 'react';
import type { DesignElement } from '../../PrintStudioEditor';
import { updateRepeat } from '../geometry/repeat';
import './repeat-centre.css';

/** Where the repeat centre sits on the garment (group source space → garment space). */
export function repeatCentreOnGarment(group: DesignElement) {
  const s = group.artworkRepeat; if (!s) return null;
  const sw = group.groupSourceWidth ?? group.width, sh = group.groupSourceHeight ?? group.height;
  const sx = group.width / Math.max(1, sw), sy = group.height / Math.max(1, sh), a = group.rotation * Math.PI / 180;
  const dx = (s.centre.x - sw / 2) * sx * (group.flipHorizontal ? -1 : 1), dy = (s.centre.y - sh / 2) * sy * (group.flipVertical ? -1 : 1);
  return { x: group.x + dx * Math.cos(a) - dy * Math.sin(a), y: group.y + dx * Math.sin(a) + dy * Math.cos(a) };
}

/**
 * Drag the repeat's centre on the canvas (plan E: "drag the centre"). Copies follow live.
 * Rendered inside the design zone, so it lives in garment coordinates.
 */
export function RepeatCentreHandle({ group, inverseScale, onChange }: { group: DesignElement; inverseScale: number; onChange: (next: DesignElement) => void }) {
  const drag = useRef<{ x: number; y: number; ratio: number; start: DesignElement } | null>(null);
  const at = repeatCentreOnGarment(group);
  if (!at || !group.artworkRepeat) return null;
  return <button type="button" className="cx-repeat-centre" data-editor-chrome aria-label="Repeat centre — drag to move"
    style={{ left: at.x, top: at.y, transform: `translate(-50%, -50%) scale(${inverseScale})` }}
    onPointerDown={event => {
      event.stopPropagation(); event.preventDefault();
      const zone = (event.currentTarget.offsetParent as HTMLElement | null);
      const ratio = zone ? zone.getBoundingClientRect().width / Math.max(1, zone.offsetWidth) : 1;
      drag.current = { x: event.clientX, y: event.clientY, ratio, start: group };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const d = drag.current; if (!d) return;
      const start = d.start, s = start.artworkRepeat!;
      // Screen delta → garment delta → group source delta (undo rotation, flip and envelope scale).
      const gx = (event.clientX - d.x) / d.ratio, gy = (event.clientY - d.y) / d.ratio, a = -start.rotation * Math.PI / 180;
      const lx = gx * Math.cos(a) - gy * Math.sin(a), ly = gx * Math.sin(a) + gy * Math.cos(a);
      const sw = start.groupSourceWidth ?? start.width, sh = start.groupSourceHeight ?? start.height;
      const sx = start.width / Math.max(1, sw) * (start.flipHorizontal ? -1 : 1), sy = start.height / Math.max(1, sh) * (start.flipVertical ? -1 : 1);
      onChange(updateRepeat(start, { settings: { centre: { x: s.centre.x + lx / sx, y: s.centre.y + ly / sy } } }));
    }}
    onPointerUp={event => { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
    onPointerCancel={() => { drag.current = null; }}>
    <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="5.5" /><path d="M10 1.5v4M10 14.5v4M1.5 10h4M14.5 10h4" /></svg>
  </button>;
}
