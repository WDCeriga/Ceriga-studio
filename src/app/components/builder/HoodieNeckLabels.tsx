import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { normalizeLabel, type GarmentLabel } from '../../data/garmentLabels';
import { hoodieNeckLabelPlacement, isHoodieNeckLabel, type HoodieInnerBackNeck } from '../../data/hoodieLabels';
import { LabelArtwork } from './LabelArtwork';
import { labelDragUpdate, type LabelFocus } from './GarmentLabelOverlay';

type Mode = 'move' | 'resize' | 'rotate';
export function HoodieNeckLabels({ labels, region, bodyWidth, interior, selectedId, onSelect, onChange, onFocus }: {
  labels: GarmentLabel[]; region: HoodieInnerBackNeck; bodyWidth: number; interior: boolean;
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
  useEffect(cancel, [selectedId, region.innerBackNeck, region.hoodStyle, region.construction, interior]);
  const selected = labels.find(label => label.id === selectedId && isHoodieNeckLabel(label));
  const focused = selected && hoodieNeckLabelPlacement(selected, region, bodyWidth);
  useEffect(() => {
    if (focused && selected) onFocus?.({ id: selected.id, x: focused.x, y: focused.y, width: focused.width, height: focused.height,
      context: { x: region.center.x, y: (region.openingBounds.minY + region.openingBounds.maxY) / 2,
        width: region.openingBounds.maxX - region.openingBounds.minX + 160,
        height: region.openingBounds.maxY - region.openingBounds.minY + 120 } });
  }, [selected?.id, focused?.x, focused?.y, focused?.width, focused?.height, region.center.x, region.seamY, onFocus]);
  const commit = (label: GarmentLabel) => onChange?.(labels.map(saved => saved.id === label.id ? label : saved));
  const start = (event: PointerEvent<SVGElement>, label: GarmentLabel, mode: Mode) => {
    if (!onChange || event.button !== 0) return;
    const screen = svg.current?.getScreenCTM();
    const placement = hoodieNeckLabelPlacement(label, region, bodyWidth);
    if (!screen || !placement) return;
    event.preventDefault(); event.stopPropagation(); onSelect?.(label.id);
    const matrix = new DOMMatrix([screen.a, screen.b, screen.c, screen.d, screen.e, screen.f]);
    const inverse = (mode === 'resize' ? matrix.translate(placement.x, placement.y).rotate(placement.rotation) : matrix).inverse();
    gesture.current = { mode, label, pointer: event.pointerId, inverse, placement,
      start: inverse.transformPoint(new DOMPoint(event.clientX, event.clientY)) };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    const point = active.inverse.transformPoint(new DOMPoint(event.clientX, event.clientY));
    const { label, placement, start } = active;
    const unit = placement.unit * (active.mode === 'resize' ? placement.scale : 1);
    const next = active.mode === 'rotate'
      ? normalizeLabel({ ...label, rotation: placement.rotation + (Math.atan2(point.y - placement.y, point.x - placement.x) - Math.atan2(start.y - placement.y, start.x - placement.x)) * 180 / Math.PI })
      : labelDragUpdate({ ...label, offsetXmm: placement.offsetXmm, offsetYmm: placement.offsetYmm },
        (point.x - start.x) / unit, (point.y - start.y) / unit, active.mode === 'resize');
    const constrained = hoodieNeckLabelPlacement(next, region, bodyWidth);
    if (!constrained) return;
    draftRef.current = { ...next, neckScale: constrained.scale, offsetXmm: constrained.offsetXmm, offsetYmm: constrained.offsetYmm };
    setDraft(draftRef.current);
  };
  return <div className="pointer-events-none absolute inset-0 z-20" data-hoodie-neck-context="innerBackNeck"
    data-hood-style={region.hoodStyle} data-hood-construction={region.construction}>
    <svg ref={svg} viewBox="0 0 2048 2048" className="absolute inset-0 h-full w-full overflow-visible" onPointerMove={move}
      onPointerCancel={cancel} onLostPointerCapture={cancel} onPointerUp={event => {
        if (gesture.current?.pointer !== event.pointerId) return;
        if (draftRef.current) commit(draftRef.current);
        cancel();
      }} aria-label="Hoodie inside back-neck view">
      <defs><mask id={clipId} maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style={{ maskType: 'alpha' }}>
        <image href={region.innerBackNeck} width="2048" height="2048" />
      </mask><mask id={`${clipId}-opening`} maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style={{ maskType: 'alpha' }}>
        <image href={interior ? region.innerBackNeck : region.hoodOpeningMask} width="2048" height="2048" />
      </mask></defs>
      <g mask={interior ? undefined : `url(#${clipId}-opening)`}>
      <g mask={`url(#${clipId})`}>
      {labels.filter(isHoodieNeckLabel).map(saved => {
        const label = draft?.id === saved.id ? draft : saved;
        const placement = hoodieNeckLabelPlacement(label, region, bodyWidth);
        if (!placement) return null;
        const { x, y, width, height, unit, scale, rotation } = placement;
        return <g key={label.id}>
          <g transform={`translate(${x} ${y}) rotate(${rotation})`} data-garment-label={label.id} data-attachment-layer="innerBackNeck"
            data-neck-scale={scale} data-neck-rotation={rotation}>
            <g transform={`translate(${-width / 2} ${-height / 2}) scale(${unit * scale})`}>
              <LabelArtwork label={label} guide={Boolean(interior && onChange && selectedId === label.id)} />
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
      </g>
      {interior && onChange && labels.filter(label => isHoodieNeckLabel(label) && label.id === selectedId).map(saved => {
        const label = draft?.id === saved.id ? draft : saved;
        const placement = hoodieNeckLabelPlacement(label, region, bodyWidth);
        if (!placement) return null;
        return <g key={label.id} transform={`translate(${placement.x} ${placement.y}) rotate(${placement.rotation})`}>
          <rect x={-placement.width / 2} y={-placement.height / 2} width={placement.width} height={placement.height} fill="none" stroke="#cf342b" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <g data-label-handle="" data-neck-handle="resize" className="pointer-events-auto" style={{ touchAction: 'none', cursor: 'nwse-resize' }}
            role="button" tabIndex={0} aria-label="Resize neck label" onPointerDown={event => start(event, label, 'resize')}
            onKeyDown={event => {
              const offsets: Record<string, [number, number]> = { ArrowLeft: [-.5, 0], ArrowRight: [.5, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
              const offset = offsets[event.key];
              if (offset) { event.preventDefault(); commit(labelDragUpdate(label, offset[0], offset[1], true)); }
            }}>
            <title>Resize label</title>
            <rect x={placement.width / 2 - 12} y={placement.height / 2 - 12} width="24" height="24" fill="transparent" />
            <rect x={placement.width / 2 - 3} y={placement.height / 2 - 3} width="6" height="6" rx=".4" fill="white" stroke="#8f5551" strokeWidth=".8" vectorEffect="non-scaling-stroke" />
          </g>
          {(['rotate'] as const).map(mode => <circle key={mode} cx={0}
            cy={-placement.height / 2 - 24} r="9" fill="white" stroke="#cf342b" strokeWidth="2"
            className="pointer-events-auto" style={{ touchAction: 'none', cursor: 'grab' }}
            data-neck-handle={mode} role="button" tabIndex={0} aria-label="Rotate neck label"
            onPointerDown={event => start(event, label, mode)} onKeyDown={event => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault(); const direction = event.key === 'ArrowRight' ? 1 : -1;
              commit(normalizeLabel({ ...label, rotation: placement.rotation + direction }));
            }}><title>Rotate neck label</title></circle>)}
          <g transform={`translate(${-placement.width / 2 - 22} ${-placement.height / 2 - 24})`} className="pointer-events-auto cursor-pointer"
            role="button" tabIndex={0} aria-label="Reset neck placement" onPointerDown={event => event.stopPropagation()}
            onClick={() => commit({ ...label, position: 'neck-inside', offsetXmm: 0, offsetYmm: 0, neckScale: 1, rotation: 0 })}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commit({ ...label, position: 'neck-inside', offsetXmm: 0, offsetYmm: 0, neckScale: 1, rotation: 0 }); } }}>
            <circle r="11" fill="white" stroke="#cf342b" strokeWidth="2" /><RotateCcw x={-7} y={-7} width={14} height={14} color="#cf342b" /><title>Reset neck placement</title>
          </g>
        </g>;
      })}
      </g>
    </svg>
  </div>;
}

export function HoodieNeckDebug({ region, source }: { region: HoodieInnerBackNeck; source: string }) {
  const identifier = useId();
  const { minX, minY, maxX, maxY } = region.bounds;
  return <svg viewBox="0 0 2048 2048" className="pointer-events-none absolute inset-0 z-40 h-full w-full" data-neck-debug="" aria-label="Neck geometry debug overlays">
    <defs>{[['opening', region.hoodOpeningMask], ['surface', region.innerBackNeck], ['front', region.frontOcclusionMask]].map(([name, mask]) =>
      <mask key={name} id={`${identifier}-${name}`} maskUnits="userSpaceOnUse" width="2048" height="2048" x="0" y="0" style={{ maskType: 'alpha' }}>
        <image href={mask} width="2048" height="2048" />
      </mask>)}</defs>
    <rect width="2048" height="2048" fill="#00b8d9" opacity=".3" mask={`url(#${identifier}-opening)`} data-debug-opening="" />
    <rect width="2048" height="2048" fill="#00cc66" opacity=".4" mask={`url(#${identifier}-surface)`} data-debug-surface="" />
    <image href={source} width="2048" height="2048" opacity=".35" mask={`url(#${identifier}-front)`} data-debug-front-occlusion="" />
    <g stroke="#de9500" fill="none" strokeWidth="2" data-debug-anchor="">
      <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} strokeDasharray="6 4" />
      <path d={`M${region.center.x - 12} ${region.seamY}h24 M${region.center.x} ${region.seamY - 12}v24`} />
    </g>
  </svg>;
}