import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { normalizeLabel, type GarmentLabel } from '../../data/garmentLabels';
import { hoodieNeckLabelPlacement, isHoodieNeckLabel, type HoodieInnerBackNeck } from '../../data/hoodieLabels';
import { LabelArtwork } from './LabelArtwork';
import type { LabelFocus } from './GarmentLabelOverlay';

type Mode = 'move' | 'scale' | 'rotate';
export function HoodieNeckLabels({ labels, region, bodyWidth, color, interior, selectedId, onSelect, onChange, onFocus }: {
  labels: GarmentLabel[]; region: HoodieInnerBackNeck; bodyWidth: number; color: string; interior: boolean;
  onFocus?: (focus: LabelFocus) => void;
  selectedId?: string | null; onSelect?: (id: string | null) => void; onChange?: (labels: GarmentLabel[]) => void;
}) {
  const clipId = useId();
  const svg = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<GarmentLabel | null>(null);
  const draftRef = useRef<GarmentLabel | null>(null);
  const gesture = useRef<{ mode: Mode; pointer: number; label: GarmentLabel; start: DOMPoint; inverse: DOMMatrix;
    placement: NonNullable<ReturnType<typeof hoodieNeckLabelPlacement>> } | null>(null);
  const cancel = () => { gesture.current = null; draftRef.current = null; setDraft(null); };
  useEffect(cancel, [selectedId, region.panelPath, region.hoodStyle, region.construction]);
  const selected = labels.find(label => label.id === selectedId && isHoodieNeckLabel(label));
  const focused = selected && hoodieNeckLabelPlacement(selected, region, bodyWidth);
  useEffect(() => {
    if (focused && selected) onFocus?.({ id: selected.id, x: focused.x, y: focused.y, width: focused.width, height: focused.height,
      context: { x: region.center.x, y: region.seamY + 20, width: 420, height: 360 } });
  }, [selected?.id, focused?.x, focused?.y, focused?.width, focused?.height, region.center.x, region.seamY, onFocus]);
  const commit = (label: GarmentLabel) => onChange?.(labels.map(saved => saved.id === label.id ? label : saved));
  const start = (event: PointerEvent<SVGElement>, label: GarmentLabel, mode: Mode) => {
    if (!onChange || event.button !== 0) return;
    const screen = svg.current?.getScreenCTM();
    const placement = hoodieNeckLabelPlacement(label, region, bodyWidth);
    if (!screen || !placement) return;
    event.preventDefault(); event.stopPropagation(); onSelect?.(label.id);
    const inverse = new DOMMatrix([screen.a, screen.b, screen.c, screen.d, screen.e, screen.f]).inverse();
    gesture.current = { mode, label, pointer: event.pointerId, inverse, placement,
      start: inverse.transformPoint(new DOMPoint(event.clientX, event.clientY)) };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    const point = active.inverse.transformPoint(new DOMPoint(event.clientX, event.clientY));
    const { label, placement, start } = active;
    const patch = active.mode === 'move' ? {
      offsetXmm: placement.offsetXmm + (point.x - start.x) / placement.unit,
      offsetYmm: placement.offsetYmm + (point.y - start.y) / placement.unit,
    } : active.mode === 'scale' ? {
      neckScale: placement.scale * Math.hypot(point.x - placement.x, point.y - placement.y) / Math.max(1, Math.hypot(start.x - placement.x, start.y - placement.y)),
    } : { rotation: placement.rotation + (Math.atan2(point.y - placement.y, point.x - placement.x) - Math.atan2(start.y - placement.y, start.x - placement.x)) * 180 / Math.PI };
    const next = normalizeLabel({ ...label, ...patch });
    const constrained = hoodieNeckLabelPlacement(next, region, bodyWidth);
    if (!constrained) return;
    draftRef.current = { ...next, neckScale: constrained.scale, offsetXmm: constrained.offsetXmm, offsetYmm: constrained.offsetYmm };
    setDraft(draftRef.current);
  };
  return <div className="pointer-events-none absolute inset-0 z-0" data-hoodie-neck-context="innerBackNeck"
    data-hood-style={region.hoodStyle} data-hood-construction={region.construction}>
    <svg ref={svg} viewBox="0 0 2048 2048" className="absolute inset-0 h-full w-full overflow-visible" onPointerMove={move}
      onPointerCancel={cancel} onLostPointerCapture={cancel} onPointerUp={event => {
        if (gesture.current?.pointer !== event.pointerId) return;
        if (draftRef.current) commit(draftRef.current);
        cancel();
      }} aria-label="Hoodie inside back-neck view">
      <defs><clipPath id={clipId}><path d={region.exteriorOpeningPath} /></clipPath></defs>
      <g clipPath={`url(#${clipId})`}>
      <path d={region.panelPath} fill={color} data-inner-back-neck-panel="" />
      <path d={region.panelPath} fill="#000000" fillOpacity=".3" />
      {labels.filter(isHoodieNeckLabel).map(saved => {
        const label = draft?.id === saved.id ? draft : saved;
        const placement = hoodieNeckLabelPlacement(label, region, bodyWidth);
        if (!placement) return <text key={label.id} x={region.center.x} y={region.center.y} textAnchor="middle" fontSize="14" fill="#b91c1c">Label exceeds neck bounds</text>;
        const { x, y, width, height, unit, scale, rotation } = placement;
        return <g key={label.id} clipPath={`url(#${clipId})`}>
          <g transform={`translate(${x} ${y}) rotate(${rotation})`} data-garment-label={label.id} data-attachment-layer="innerBackNeck"
            data-neck-scale={scale} data-neck-rotation={rotation}>
            <g transform={`translate(${-width / 2} ${-height / 2}) scale(${unit * scale})`}>
              <LabelArtwork label={label} />
              {onChange && <rect width={label.widthMm} height={label.heightMm} fill="transparent" className="pointer-events-auto cursor-move"
                style={{ touchAction: 'none' }} role="button" tabIndex={0} aria-label={`Move ${label.brand || 'neck'} label`}
                onPointerDown={event => start(event, label, 'move')} onKeyDown={event => {
                  const offsets: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
                  const offset = offsets[event.key]; if (!offset) return;
                  event.preventDefault(); commit(normalizeLabel({ ...label, offsetXmm: label.offsetXmm + offset[0], offsetYmm: label.offsetYmm + offset[1] }));
                }} />}
            </g>
          </g>
        </g>;
      })}
      <g clipPath={`url(#${clipId})`} data-back-neck-occluder="">
        <path d={region.seamCoverPath} fill={color} />
        <path d={region.seamCoverPath} fill="#000000" fillOpacity=".38" />
        <path d={region.seamPath} fill="none" stroke="#14191a" strokeOpacity=".7" strokeWidth="5" />
        <path d={region.seamPath} transform="translate(0 5)" fill="none" stroke={color} strokeWidth="3" />
      </g>
      </g>
      {interior && onChange && labels.filter(label => isHoodieNeckLabel(label) && label.id === selectedId).map(saved => {
        const label = draft?.id === saved.id ? draft : saved;
        const placement = hoodieNeckLabelPlacement(label, region, bodyWidth);
        if (!placement) return null;
        return <g key={label.id} transform={`translate(${placement.x} ${placement.y}) rotate(${placement.rotation})`}>
          <rect x={-placement.width / 2} y={-placement.height / 2} width={placement.width} height={placement.height} fill="none" stroke="#cf342b" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {(['scale', 'rotate'] as const).map(mode => <circle key={mode} cx={mode === 'scale' ? placement.width / 2 : 0}
            cy={mode === 'scale' ? placement.height / 2 : -placement.height / 2 - 24} r="9" fill="white" stroke="#cf342b" strokeWidth="2"
            className="pointer-events-auto" style={{ touchAction: 'none', cursor: mode === 'scale' ? 'nwse-resize' : 'grab' }}
            data-neck-handle={mode} role="button" tabIndex={0} aria-label={`${mode === 'scale' ? 'Scale' : 'Rotate'} neck label`}
            onPointerDown={event => start(event, label, mode)} onKeyDown={event => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault(); const direction = event.key === 'ArrowRight' ? 1 : -1;
              commit(normalizeLabel({ ...label, ...(mode === 'scale' ? { neckScale: placement.scale + direction * .05 } : { rotation: placement.rotation + direction }) }));
            }}><title>{mode === 'scale' ? 'Scale neck label' : 'Rotate neck label'}</title></circle>)}
          <g transform={`translate(${-placement.width / 2 - 22} ${-placement.height / 2 - 24})`} className="pointer-events-auto cursor-pointer"
            role="button" tabIndex={0} aria-label="Reset neck placement" onPointerDown={event => event.stopPropagation()}
            onClick={() => commit({ ...label, position: 'neck-inside', offsetXmm: 0, offsetYmm: 0, neckScale: 1, rotation: 0 })}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commit({ ...label, position: 'neck-inside', offsetXmm: 0, offsetYmm: 0, neckScale: 1, rotation: 0 }); } }}>
            <circle r="11" fill="white" stroke="#cf342b" strokeWidth="2" /><RotateCcw x={-7} y={-7} width={14} height={14} color="#cf342b" /><title>Reset neck placement</title>
          </g>
        </g>;
      })}
    </svg>
  </div>;
}