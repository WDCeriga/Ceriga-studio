import { useEffect, useRef, useState } from 'react';
import { Maximize, Minus, Plus, RotateCcw, Tag } from 'lucide-react';
import { createGarmentLabel, isInteriorLabel, LABEL_POSITIONS, type GarmentLabel } from '../../data/garmentLabels';
import { TshirtSvgPreview, type TshirtSvgPreviewProps } from './TshirtSvgPreview';
import { LabelArtwork } from './LabelArtwork';
import type { LabelFocus } from './GarmentLabelOverlay';

export function GarmentLabelsPreview({ labels, selectedId, onSelect, onChange, garmentProps, animateEntry = false }: {
  labels: GarmentLabel[]; selectedId: string | null; onSelect: (id: string | null) => void;
  onChange: (labels: GarmentLabel[]) => void; garmentProps: TshirtSvgPreviewProps; animateEntry?: boolean;
}) {
  const selected = labels.find(label => label.id === selectedId);
  const tagEditing = selected?.category === 'tag';
  const [mode, setMode] = useState<'garment' | 'closeup'>(animateEntry ? 'garment' : 'closeup');
  const [entryPending, setEntryPending] = useState(animateEntry);
  const [animatedTarget, setAnimatedTarget] = useState<string | null>(null);
  const [showGarment, setShowGarment] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState<LabelFocus | null>(null);
  const previousSelectedId = useRef(selectedId);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panGesture = useRef<{ pointer: number; x: number; y: number; origin: typeof pan } | null>(null);
  useEffect(() => { setPan({ x: 0, y: 0 }); }, [selectedId, selected?.position]);
  const handSelected = selected?.category === 'hand';
  const neckSelected = selected?.category === 'neck' || selected?.position.startsWith('neck-');
  const ready = focus?.id === selected?.id && Boolean(focus?.width && focus?.height);
  const targetKey = `${selectedId}:${selected?.position}`;
  useEffect(() => {
    if (previousSelectedId.current === selectedId) return;
    previousSelectedId.current = selectedId;
    setAnimatedTarget(targetKey);
  }, [selectedId, targetKey]);
  useEffect(() => {
    if (!entryPending || !ready || handSelected) return;
    const timer = window.setTimeout(() => { setAnimatedTarget(targetKey); setMode('closeup'); setEntryPending(false); }, 180);
    return () => window.clearTimeout(timer);
  }, [entryPending, ready, handSelected, targetKey]);
  useEffect(() => {
    if (!animatedTarget) return;
    const timer = window.setTimeout(() => setAnimatedTarget(null), 1850);
    return () => window.clearTimeout(timer);
  }, [animatedTarget, mode]);
  const closeup = mode === 'closeup' || handSelected;
  const careCloseup = closeup && selected?.category === 'care';
  const cameraFocus = selected && focus?.id === selected.id && focus.width && focus.height ? focus : null;
  const framing = cameraFocus?.context ?? cameraFocus;
  const scale = closeup && framing ? Math.min(tagEditing ? 22 : 18, 2048 * (cameraFocus?.context ? (tagEditing ? .9 : .8) : (tagEditing ? .64 : .68 * .8)) / Math.max(framing.width, framing.height)) * zoom : zoom;
  const point = closeup && framing ? framing : { x: 1024, y: 1024 };
  const contextVisible = !closeup || showGarment;
  const interior = Boolean(selected && !neckSelected && isInteriorLabel(selected));
  const controlClass = 'rounded px-2 py-1.5 text-[11px] text-white/70 hover:bg-white/10 aria-pressed:bg-white/15 aria-pressed:text-white';
  return <div className="flex h-full min-h-0 w-full flex-col" data-label-editing-surface="" data-label-preview-behavior="tshirt" onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
    <div className="z-10 flex shrink-0 flex-wrap items-center justify-center gap-1 border-b border-white/10 bg-[#111113] p-1.5">
      {!handSelected && selected && <>
        <div role="group" aria-label="Label preview mode"><button type="button" className={controlClass} aria-pressed={!closeup} onClick={() => { setEntryPending(false); setAnimatedTarget(targetKey); setMode('garment'); setZoom(1); }}>Garment</button><button type="button" className={controlClass} aria-pressed={closeup} onClick={() => { setEntryPending(false); setAnimatedTarget(targetKey); setMode('closeup'); setZoom(1); }}>Label Close-up</button></div>
        <span className="px-2 text-[11px] text-white/50">{interior || neckSelected ? 'Inside' : 'Outside'}</span>
        <label className="flex items-center gap-1.5 px-2 text-[11px] text-white/70"><input type="checkbox" checked={contextVisible} disabled={!closeup} onChange={event => setShowGarment(event.target.checked)} />Show Garment</label>
      </>}
      <div className="flex items-center">{[{ Icon: Minus, title: 'Zoom out label editor', action: () => setZoom(value => Math.max(.5, value - .25)) }, { Icon: Plus, title: 'Zoom in label editor', action: () => setZoom(value => Math.min(2, value + .25)) }, { Icon: RotateCcw, title: 'Reset editing zoom', action: () => { setZoom(1); setPan({ x: 0, y: 0 }); } }, { Icon: Maximize, title: 'Fit active label', action: () => { setEntryPending(false); setAnimatedTarget(null); setMode('closeup'); setZoom(1); setPan({ x: 0, y: 0 }); } }].map(({ Icon, title, action }) => <button key={title} type="button" title={title} aria-label={title} onClick={action} className={controlClass}><Icon size={14} /></button>)}</div>
    </div>
    <div data-label-stage="" tabIndex={careCloseup ? 0 : undefined} aria-label={careCloseup ? 'Care label pan area' : undefined} onKeyDown={event => { if (careCloseup && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); setPan(value => ({ x: value.x + (event.key === 'ArrowLeft' ? 40 : event.key === 'ArrowRight' ? -40 : 0), y: value.y + (event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0) })); } }}
      onWheel={event => { if (careCloseup) setPan(value => ({ x: value.x - event.deltaX, y: value.y - event.deltaY })); }}
      onPointerDown={event => { if (!careCloseup || event.button !== 0 || (event.target as Element).closest('[data-garment-label]')) return; panGesture.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, origin: pan }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { const gesture = panGesture.current; if (gesture?.pointer === event.pointerId) setPan({ x: gesture.origin.x + event.clientX - gesture.x, y: gesture.origin.y + event.clientY - gesture.y }); }}
      onPointerUp={() => { panGesture.current = null; }} onPointerCancel={() => { panGesture.current = null; }} onLostPointerCapture={() => { panGesture.current = null; }}
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden [container-type:size]" style={{ touchAction: careCloseup ? 'none' : undefined, cursor: careCloseup ? 'grab' : undefined, backgroundColor: '#e7e9ec', backgroundImage: 'radial-gradient(#cdd1d6 .6px, transparent .6px)', backgroundSize: '16px 16px' }}>
      {!handSelected && <div data-label-camera="" className={`relative h-[min(100cqh,100cqw)] w-[min(100cqh,100cqw)] shrink-0 ${animatedTarget === targetKey ? 'transition-transform duration-[1800ms] ease-in-out motion-reduce:transition-none' : 'transition-none'} ${!contextVisible ? 'invisible [&_[data-garment-label-overlay]]:visible [&_[data-hoodie-neck-context]]:visible' : ''}`} style={{ transform: `translate(${careCloseup ? pan.x : 0}px, ${careCloseup ? pan.y : 0}px) scale(${scale}) translate(${(1024 - point.x) / 2048 * 100}%, ${(1024 - point.y) / 2048 * 100}%)` }}>
        <TshirtSvgPreview {...garmentProps} garmentLabels={labels} onLayerTransformChange={undefined} onSelectedLayerChange={undefined} selectedLayerId={null}
          onDetailsChange={undefined} onDetailSelect={undefined} selectedDetailId={null} selectedLabelId={selected?.id ?? null}
          labelInterior={interior} onLabelSelect={onSelect} onLabelsChange={onChange} onLabelFocus={setFocus} />
      </div>}
      {selected && handSelected && <svg data-isolated-label="" aria-label="Active label close-up" viewBox={`-${selected.widthMm * .2} -${selected.heightMm * .2} ${selected.widthMm * 1.4} ${selected.heightMm * 1.4}`} className="absolute h-[85%] w-[85%] transition-transform duration-[650ms] ease-in-out motion-reduce:transition-none" style={{ transform: `scale(${zoom * .8})` }}><LabelArtwork label={selected} guide={selected.construction === 'printed'} /></svg>}
      {!selected && <button type="button" onClick={() => { const label = createGarmentLabel('neck'); onChange([...labels, label]); onSelect(label.id); }} className="absolute z-10 flex items-center gap-2 rounded border border-black/20 bg-white px-4 py-3 text-sm text-[#252528]"><Tag size={18} />Add label</button>}
    </div>
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-white/10 bg-[#111113] px-2 py-2 text-[10px] text-white/65">
      {selected ? <><span>{selected.widthMm} x {selected.heightMm} mm</span><span>{LABEL_POSITIONS[selected.position]}</span><span>{handSelected ? 'Hand tag' : interior || neckSelected ? 'Interior attachment' : 'Front exterior'}</span></> : <span>No label selected</span>}
    </div>
  </div>;
}