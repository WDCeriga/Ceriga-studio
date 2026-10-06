import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { adjustCrop, normalizeCrop, type CropHandle, type CropInsets } from '../../../lib/artworkCrop';
import { quadMap, type Quad } from '../../../lib/designGeometry';

const chrome = { 'data-editor-chrome': true, 'data-crop-editor': true };
const handles: { id: Exclude<CropHandle, 'move'>; name: string; x: number; y: number }[] = [
  { id: 'nw', name: 'top left', x: 0, y: 0 },
  { id: 'n', name: 'top', x: 0.5, y: 0 },
  { id: 'ne', name: 'top right', x: 1, y: 0 },
  { id: 'e', name: 'right', x: 1, y: 0.5 },
  { id: 'se', name: 'bottom right', x: 1, y: 1 },
  { id: 's', name: 'bottom', x: 0.5, y: 1 },
  { id: 'sw', name: 'bottom left', x: 0, y: 1 },
  { id: 'w', name: 'left', x: 0, y: 0.5 },
];

export function CropEditingOverlay({ element, onChange, width = 200, height = 200 }: {
  element: Partial<CropInsets>;
  onChange?: (draft: CropInsets) => void;
  width?: number;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<{ pointerId: number; handle: CropHandle; x: number; y: number; crop: CropInsets } | null>(null);
  const crop = normalizeCrop(element);
  const w = Number.isFinite(width) && width > 0 ? width : 200;
  const h = Number.isFinite(height) && height > 0 ? height : 200;
  const x = crop.cropLeft * w / 100;
  const y = crop.cropTop * h / 100;
  const rw = (100 - crop.cropLeft - crop.cropRight) * w / 100;
  const rh = (100 - crop.cropTop - crop.cropBottom) * h / 100;
  const point = (event: PointerEvent<SVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    // Screen CTMs flatten CSS perspective; measured corners retain its projective mapping.
    const corners = [...svg.querySelectorAll('[data-crop-corner]')].map(node => {
      const rect = node.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    if (corners.length !== 4) return null;
    const left = Math.min(...corners.map(p => p.x));
    const top = Math.min(...corners.map(p => p.y));
    const width = Math.max(...corners.map(p => p.x)) - left;
    const height = Math.max(...corners.map(p => p.y)) - top;
    if (!(width > 0 && height > 0)) return null;
    const quad = corners.map(p => ({ x: (p.x - left) / width, y: (p.y - top) / height })) as Quad;
    const local = quadMap(quad).inverse({ x: (event.clientX - left) / width, y: (event.clientY - top) / height });
    return Number.isFinite(local.x) && Number.isFinite(local.y) ? { x: local.x * 100, y: local.y * 100 } : null;
  };
  const start = (event: PointerEvent<SVGElement>, handle: CropHandle) => {
    event.stopPropagation();
    event.preventDefault();
    if (!onChange || event.button !== 0) return;
    const p = point(event);
    if (!p) return;
    gesture.current = { pointerId: event.pointerId, handle, ...p, crop };
    svgRef.current?.setPointerCapture(event.pointerId);
  };
  const key = (event: KeyboardEvent<SVGElement>, handle: CropHandle) => {
    if (event.key === 'Escape') return;
    event.stopPropagation();
    const step = event.shiftKey ? 5 : 1;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    if (!dx && !dy) return;
    event.preventDefault();
    onChange?.(adjustCrop(crop, handle, dx, dy));
  };
  return (
    <svg
      {...chrome}
      ref={svgRef}
      aria-label="Crop editor"
      className="absolute inset-0 h-full w-full overflow-visible"
      style={{ zIndex: 30, touchAction: 'none', pointerEvents: onChange ? 'auto' : 'none' }}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      onPointerDown={event => event.stopPropagation()}
      onDoubleClick={event => event.stopPropagation()}
      onPointerMove={event => {
        event.stopPropagation();
        const drag = gesture.current;
        if (!drag || event.pointerId !== drag.pointerId) return;
        const p = point(event);
        if (p) onChange?.(adjustCrop(drag.crop, drag.handle, p.x - drag.x, p.y - drag.y));
      }}
      onPointerUp={event => {
        event.stopPropagation();
        if (gesture.current?.pointerId !== event.pointerId) return;
        const p = point(event);
        const drag = gesture.current;
        if (p) onChange?.(adjustCrop(drag.crop, drag.handle, p.x - drag.x, p.y - drag.y));
        gesture.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={event => {
        event.stopPropagation();
        if (gesture.current?.pointerId === event.pointerId) {
          onChange?.(gesture.current.crop);
          gesture.current = null;
        }
      }}
      onLostPointerCapture={() => { gesture.current = null; }}
    >
      {[[0, 0], [w, 0], [w, h], [0, h]].map(([cx, cy], index) => <rect key={index} data-crop-corner x={cx - 0.0005} y={cy - 0.0005} width={0.001} height={0.001} fill="transparent" pointerEvents="none" />)}
      <path d={`M0 0H${w}V${h}H0Z M${x} ${y}V${y + rh}H${x + rw}V${y}Z`} fill="rgba(4,6,12,0.62)" fillRule="evenodd" pointerEvents="none" />
      <rect {...chrome} x={x} y={y} width={rw} height={rh} fill="transparent" stroke="white" strokeWidth={1.5} vectorEffect="non-scaling-stroke" style={{ cursor: 'move' }} role="button" aria-label="Move crop rectangle" tabIndex={onChange ? 0 : undefined} onPointerDown={event => start(event, 'move')} onKeyDown={event => key(event, 'move')} />
      {[1 / 3, 2 / 3].map(fraction => (
        <path key={fraction} d={`M${x + rw * fraction} ${y}V${y + rh} M${x} ${y + rh * fraction}H${x + rw}`} stroke="rgba(255,255,255,0.5)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      ))}
      {handles.map(handle => (
        <g {...chrome} key={handle.id} role="button" aria-label={`Resize crop ${handle.name}`} tabIndex={onChange ? 0 : undefined} style={{ cursor: `${handle.id}-resize` }} onPointerDown={event => start(event, handle.id)} onKeyDown={event => key(event, handle.id)}>
          <rect {...chrome} x={x + rw * handle.x - 12} y={y + rh * handle.y - 12} width={24} height={24} fill="transparent" />
          <rect x={x + rw * handle.x - 4} y={y + rh * handle.y - 4} width={8} height={8} fill="white" stroke="#111" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        </g>
      ))}
    </svg>
  );
}

export function CropEditorControls({ draft, onChange, onApply, onCancel }: {
  draft: CropInsets;
  onChange: (draft: CropInsets) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const crop = normalizeCrop(draft);
  return (
    <div {...chrome} role="group" aria-label="Crop controls" className="flex flex-wrap items-center justify-center gap-2 rounded-lg bg-[#18181b] p-2 text-xs text-white shadow-lg" onPointerDown={event => event.stopPropagation()} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); onCancel(); } }}>
      <span className="text-white/60">{Math.round(100 - crop.cropLeft - crop.cropRight)} × {Math.round(100 - crop.cropTop - crop.cropBottom)}%</span>
      <button {...chrome} type="button" className="rounded bg-[#CC2D24] px-3 py-2" onClick={onApply}>Apply crop</button>
      <button {...chrome} type="button" className="rounded bg-white/10 px-3 py-2" onClick={onCancel}>Cancel crop</button>
      <button {...chrome} type="button" className="rounded bg-white/10 px-3 py-2" onClick={() => onChange(normalizeCrop({}))}>Reset crop</button>
    </div>
  );
}
