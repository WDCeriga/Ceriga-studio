import { useRef, useState, type PointerEvent } from 'react';
import { Move, RotateCcw, RotateCw, Scaling } from 'lucide-react';
import { collarEditGeometry, editedCollarPoint, validCollarEdits, type CollarHandle, type CollarManualEdits, type CollarPoint } from '../../data/customCollarEditing';
import type { CustomAssetDefinition, CustomAssetInstance } from '../../data/customAssets';

const names: Record<CollarHandle, string> = {
  topLeft: 'Top left collar edge', topRight: 'Top right collar edge', dip: 'Front opening / central dip',
  flareLeft: 'Left side flare', flareRight: 'Right side flare', attachmentLeft: 'Left attachment point',
  attachmentRight: 'Right attachment point', height: 'Overall height', scale: 'Overall scale', move: 'Move collar', rotate: 'Rotate collar',
};
const tools = { move: Move, rotate: RotateCw, scale: Scaling };

export function CustomCollarEditor({ definition, instance, selected, canvasSize, cameraScale, onSelect, onChange }: {
  definition: CustomAssetDefinition; instance: CustomAssetInstance; selected: boolean; canvasSize: number; cameraScale: number;
  onSelect: () => void; onChange: (edits?: CollarManualEdits) => void;
}) {
  const gesture = useRef<{ pointerId: number; handle: CollarHandle; start: CollarPoint; edits: CollarManualEdits }>();
  const [limited, setLimited] = useState(false);
  const geometry = collarEditGeometry(definition.svg);
  if (!geometry) return null;
  const edits = instance.collarEdits ?? { version: 1 as const, offsets: {} };
  const unit = 2048 / (canvasSize * cameraScale);
  const radius = 6 * unit;
  const center = geometry.left + geometry.width / 2;
  const toolbarY = geometry.top - 44 * unit;
  const point = (event: PointerEvent<SVGElement>) => {
    const svg = event.currentTarget instanceof SVGSVGElement ? event.currentTarget : event.currentTarget.ownerSVGElement!;
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
  };
  const update = (handle: CollarHandle, original: CollarManualEdits, horizontal: number, vertical: number) => {
    if (handle === 'move') {
      const translation = original.translation ?? { x: 0, y: 0 };
      onChange({ ...original, translation: {
        x: Math.max(-2048, Math.min(2048, translation.x + horizontal)),
        y: Math.max(-2048, Math.min(2048, translation.y + vertical)),
      } });
      setLimited(false);
      return;
    }
    const offset = original.offsets[handle] ?? { x: 0, y: 0 };
    const limit = handle.startsWith('attachment') ? .08 : handle === 'rotate' ? .12 : .35;
    const bound = (value: number, size: number) => Math.max(-size * limit, Math.min(size * limit, value));
    const next: CollarManualEdits = { ...original, offsets: { ...original.offsets, [handle]: {
      x: handle === 'height' || handle === 'dip' ? 0 : bound(offset.x + horizontal, geometry.width),
      y: handle === 'scale' || handle === 'rotate' ? 0 : bound(offset.y + vertical, geometry.height),
    } } };
    const valid = validCollarEdits(geometry, next);
    setLimited(!valid);
    if (valid) onChange(next);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const position = point(event);
    update(current.handle, current.edits, position.x - current.start.x, position.y - current.start.y);
  };
  const cancel = () => {
    const current = gesture.current;
    gesture.current = undefined;
    if (current) onChange(current.edits);
    setLimited(false);
  };
  return <svg viewBox="0 0 2048 2048" data-custom-collar-editor={definition.id}
    className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" style={{ zIndex: 240, touchAction: 'none' }}
    onPointerMove={move} onPointerUp={event => {
      if (gesture.current?.pointerId !== event.pointerId) return;
      move(event); gesture.current = undefined; event.currentTarget.releasePointerCapture(event.pointerId);
    }} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); cancel(); } }}>
    <rect x={geometry.left + (edits.translation?.x ?? 0)} y={geometry.top + (edits.translation?.y ?? 0)} width={geometry.width} height={geometry.height}
      fill="transparent" pointerEvents="all" role="button" tabIndex={0} aria-label="Drag collar on garment" style={{ cursor: 'move' }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault(); event.stopPropagation(); onSelect();
        gesture.current = { pointerId: event.pointerId, handle: 'move', start: point(event), edits };
        event.currentTarget.ownerSVGElement!.setPointerCapture(event.pointerId);
      }} onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(); }
      }} />
    {selected && <>
      <polyline points={geometry.attachment.map(anchor => {
        const mapped = editedCollarPoint(geometry, edits, anchor); return `${mapped.x},${mapped.y}`;
      }).join(' ')} fill="none" stroke="#087e8b" strokeWidth={unit} strokeDasharray={`${3 * unit} ${3 * unit}`} />
      {(Object.keys(names) as CollarHandle[]).map(handle => {
        const anchor = editedCollarPoint(geometry, edits, geometry.handles[handle]);
        const tool = handle === 'move' || handle === 'rotate' || handle === 'scale';
        const position = tool ? { x: center + (['move', 'rotate', 'scale'].indexOf(handle) - 1.5) * 34 * unit, y: toolbarY }
          : handle === 'flareLeft' || handle === 'flareRight' ? { x: anchor.x + (handle === 'flareLeft' ? -20 : 20) * unit, y: anchor.y - 12 * unit } : anchor;
        const Icon = tool ? tools[handle as keyof typeof tools] : undefined;
        const color = handle.startsWith('attachment') ? '#087e8b' : '#c02e28';
        return <g key={handle} className="group" role="button" tabIndex={0} aria-label={names[handle]} data-collar-handle={handle}
          pointerEvents="all" style={{ cursor: handle === 'height' || handle === 'dip' ? 'ns-resize' : 'move', outline: 'none' }}
          onPointerDown={event => {
            if (event.button !== 0) return;
            event.preventDefault(); event.stopPropagation(); event.currentTarget.focus();
            gesture.current = { pointerId: event.pointerId, handle, start: point(event), edits };
            event.currentTarget.ownerSVGElement!.setPointerCapture(event.pointerId);
          }} onKeyDown={event => {
            const amount = event.shiftKey ? 5 : 1;
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            update(handle, edits, event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0,
              event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0);
          }}>
          <title>{names[handle]}</title>
          {!tool && position !== anchor && <line x1={anchor.x} y1={anchor.y} x2={position.x} y2={position.y} stroke={color} strokeWidth={unit} pointerEvents="none" />}
          <circle cx={position.x} cy={position.y} r={tool ? 14 * unit : 11 * unit} fill="transparent" />
          <circle className="group-focus:fill-[#ffe3df]" cx={position.x} cy={position.y} r={tool ? 13 * unit : radius} fill="white" stroke={color} strokeWidth={1.5 * unit} />
          {Icon && <Icon x={position.x - 8 * unit} y={position.y - 8 * unit} width={16 * unit} height={16 * unit} color={color} />}
        </g>;
      })}
      <g role="button" tabIndex={0} aria-label="Reset collar to registered default" pointerEvents="all" style={{ cursor: 'pointer' }}
        onPointerDown={event => event.stopPropagation()} onClick={() => { gesture.current = undefined; onChange(); setLimited(false); }}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onChange(); setLimited(false); } }}>
        <title>Reset collar to registered default</title>
        <circle cx={center + 51 * unit} cy={toolbarY} r={13 * unit} fill="white" stroke="#3e484c" strokeWidth={unit} />
        <RotateCcw x={center + 43 * unit} y={toolbarY - 8 * unit} width={16 * unit} height={16 * unit} color="#3e484c" />
      </g>
      {limited && <text role="status" x={center} y={geometry.bottom + 30 * unit} textAnchor="middle" fill="#c02e28" fontSize={11 * unit}>Shape limit reached</text>}
    </>}
  </svg>;
}