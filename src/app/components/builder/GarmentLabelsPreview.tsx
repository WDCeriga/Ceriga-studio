import { useEffect, useRef, useState } from 'react';
import { Download, Maximize, Minus, Plus, RotateCcw, Tag } from 'lucide-react';
import { createGarmentLabel, isInteriorLabel, labelSpecification, LABEL_POSITIONS, type GarmentLabel } from '../../data/garmentLabels';
import { TshirtSvgPreview, type TshirtSvgPreviewProps } from './TshirtSvgPreview';
import { LabelArtwork } from './LabelArtwork';
import type { LabelFocus } from './GarmentLabelOverlay';

export function labelPlacementSheet(root: HTMLElement, labels: GarmentLabel[], surface: string) {
  const overlay = root.querySelector<SVGSVGElement>('[data-garment-label-overlay]');
  const canvas = overlay?.parentElement;
  const screen = overlay?.getScreenCTM();
  if (!canvas || !screen) throw new Error('Garment preview is not ready');
  const toCanvas = new DOMMatrix([screen.a, screen.b, screen.c, screen.d, screen.e, screen.f]).inverse();
  const namespace = 'http://www.w3.org/2000/svg';
  const output = document.createElementNS(namespace, 'svg');
  output.setAttribute('viewBox', '0 0 2048 2048');
  output.setAttribute('width', '2048'); output.setAttribute('height', '2048');
  const title = document.createElementNS(namespace, 'title'); title.textContent = `Label placement - ${surface}`; output.append(title);
  const metadata = document.createElementNS(namespace, 'metadata');
  metadata.textContent = JSON.stringify({ surface, labels: labels.map(labelSpecification) }); output.append(metadata);
  const sources = Array.from(canvas.querySelectorAll<SVGSVGElement>('svg')).filter(source => !source.parentElement?.closest('svg'));
  const order = (source: SVGSVGElement) => {
    let child: Element = source;
    while (child.parentElement && child.parentElement !== canvas) child = child.parentElement;
    return Number(getComputedStyle(child).zIndex) || 0;
  };
  for (const source of sources.sort((first, second) => order(first) - order(second))) {
    const matrix = source.getScreenCTM(); if (!matrix) continue;
    const group = document.createElementNS(namespace, 'g');
    group.setAttribute('transform', toCanvas.multiply(new DOMMatrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f])).toString());
    group.setAttribute('fill', getComputedStyle(source).fill);
    for (const child of Array.from(source.childNodes)) group.append(child.cloneNode(true));
    group.querySelectorAll('[data-label-guide], [data-label-handle]').forEach(element => element.remove());
    group.querySelectorAll('[role], [tabindex], [style]').forEach(element => {
      element.removeAttribute('role'); element.removeAttribute('tabindex'); element.removeAttribute('style');
    });
    const layerId = source.closest('[data-layer-id]')?.getAttribute('data-layer-id');
    if (layerId && /^(sleeve|sleeveHem)(Left|Right)$/.test(layerId)) {
      const clipId = `placement-${layerId}`;
      const clip = document.createElementNS(namespace, 'clipPath'); clip.id = clipId;
      const rectangle = document.createElementNS(namespace, 'rect');
      rectangle.setAttribute('x', layerId.endsWith('Left') ? '0' : '1024');
      rectangle.setAttribute('width', '1024'); rectangle.setAttribute('height', '2048'); clip.append(rectangle);
      const clipped = document.createElementNS(namespace, 'g'); clipped.setAttribute('clip-path', `url(#${clipId})`);
      while (group.firstChild) clipped.append(group.firstChild);
      group.append(clip, clipped);
    }
    output.append(group);
  }
  return new XMLSerializer().serializeToString(output);
}

export function GarmentLabelsPreview({ labels, selectedId, onSelect, onChange, garmentProps }: {
  labels: GarmentLabel[]; selectedId: string | null; onSelect: (id: string | null) => void;
  onChange: (labels: GarmentLabel[]) => void; garmentProps: TshirtSvgPreviewProps;
}) {
  const selected = labels.find(label => label.id === selectedId);
  const [mode, setMode] = useState<'garment' | 'closeup'>('closeup');
  const [showGarment, setShowGarment] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState<LabelFocus | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [exportError, setExportError] = useState('');
  useEffect(() => {
    if (!selected) return;
    setMode('closeup'); setZoom(1);
  }, [selectedId, selected?.position]);
  const handSelected = selected?.category === 'hand';
  const ready = focus?.id === selected?.id && Boolean(focus?.width && focus?.height);
  const closeup = mode === 'closeup' || handSelected;
  const scale = closeup && ready && focus ? Math.min(18, 2048 * .68 / Math.max(focus.width, focus.height)) * zoom : zoom;
  const point = closeup && ready && focus ? focus : { x: 1024, y: 1024 };
  const contextVisible = !closeup || showGarment;
  const controlClass = 'rounded px-2 py-1.5 text-[11px] text-white/70 hover:bg-white/10 aria-pressed:bg-white/15 aria-pressed:text-white';
  const neckSelected = selected?.category === 'neck' || selected?.position.startsWith('neck-');
  const interior = Boolean(selected && !neckSelected && isInteriorLabel(selected));
  const view = selected?.category === 'tag' ? selected.exteriorView : 'front';
  const downloadPlacement = async () => {
    try {
      await document.fonts.ready;
      const svg = labelPlacementSheet(rootRef.current!, labels, interior || neckSelected ? 'inside' : `${view} outside`);
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `label-placement-${interior ? 'inside' : view}.svg`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setExportError('');
    } catch { setExportError('Placement export failed'); }
  };
  return <div ref={rootRef} className="flex h-full min-h-0 w-full flex-col" data-label-editing-surface="" onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
    <div className="z-10 flex shrink-0 flex-wrap items-center justify-center gap-1 border-b border-white/10 bg-[#111113] p-1.5">
      {!handSelected && selected && <>
        <div role="group" aria-label="Label preview mode"><button type="button" className={controlClass} aria-pressed={!closeup} onClick={() => { setMode('garment'); setZoom(1); }}>Garment</button><button type="button" className={controlClass} aria-pressed={closeup} onClick={() => { setMode('closeup'); setZoom(1); }}>Label Close-up</button></div>
        {selected.category === 'tag' && <div role="group" aria-label="Tag garment side">{(['front', 'back'] as const).map(side => <button key={side} type="button" className={controlClass} aria-pressed={view === side} onClick={() => onChange(labels.map(label => label.id === selectedId ? { ...label, exteriorView: side } : label))}>{side === 'front' ? 'Front' : 'Back'}</button>)}</div>}
        <span className="px-2 text-[11px] text-white/50">{interior || neckSelected ? 'Inside' : 'Outside'}</span>
        <label className="flex items-center gap-1.5 px-2 text-[11px] text-white/70"><input type="checkbox" checked={contextVisible} disabled={!closeup} onChange={event => setShowGarment(event.target.checked)} />Show Garment</label>
        <button type="button" title="Download placement SVG" aria-label="Download placement SVG" disabled={!contextVisible || !ready} className={`${controlClass} disabled:opacity-30`} onClick={() => void downloadPlacement()}><Download size={14} /></button>
      </>}
      <div className="flex items-center">{[{ Icon: Minus, title: 'Zoom out label editor', action: () => setZoom(value => Math.max(.5, value - .25)) }, { Icon: Plus, title: 'Zoom in label editor', action: () => setZoom(value => Math.min(2, value + .25)) }, { Icon: RotateCcw, title: 'Reset editing zoom', action: () => setZoom(1) }, { Icon: Maximize, title: 'Fit active label', action: () => { setMode('closeup'); setZoom(1); } }].map(({ Icon, title, action }) => <button key={title} type="button" title={title} aria-label={title} onClick={action} className={controlClass}><Icon size={14} /></button>)}</div>
    </div>
    <div data-label-stage="" className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden [container-type:size]" style={{ backgroundColor: '#e7e9ec', backgroundImage: 'radial-gradient(#cdd1d6 .6px, transparent .6px)', backgroundSize: '16px 16px' }}>
      {!handSelected && selected && <div data-label-camera="" className={`relative h-[min(100cqh,100cqw)] w-[min(100cqh,100cqw)] shrink-0 transition-transform duration-[1100ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none ${closeup && !ready ? 'invisible' : !contextVisible ? 'invisible [&_[data-garment-label-overlay]]:visible' : ''}`} style={{ transform: `scale(${scale}) translate(${(1024 - point.x) / 2048 * 100}%, ${(1024 - point.y) / 2048 * 100}%)` }}>
        <TshirtSvgPreview {...garmentProps} detailView={view} garmentLabels={labels} onLayerTransformChange={undefined} onSelectedLayerChange={undefined} selectedLayerId={null}
          onDetailsChange={undefined} onDetailSelect={undefined} selectedDetailId={null} labelEditor={{ interior, selectedId, onSelect, onChange, onFocus: setFocus }} />
      </div>}
      {selected && (handSelected || closeup && !ready) && <svg data-isolated-label="" aria-label="Active label close-up" viewBox={`-${selected.widthMm * .2} -${selected.heightMm * .2} ${selected.widthMm * 1.4} ${selected.heightMm * 1.4}`} className="absolute h-[85%] w-[85%] transition-transform duration-700 motion-reduce:transition-none" style={{ transform: `scale(${zoom})` }}><LabelArtwork label={selected} guide={selected.construction === 'printed'} /></svg>}
      {!selected && <button type="button" onClick={() => { const label = createGarmentLabel('neck'); onChange([...labels, label]); onSelect(label.id); }} className="flex items-center gap-2 rounded border border-black/20 bg-white px-4 py-3 text-sm text-[#252528]"><Tag size={18} />Add label</button>}
    </div>
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-white/10 bg-[#111113] px-2 py-2 text-[10px] text-white/65">
      {selected ? <><span>{selected.widthMm} x {selected.heightMm} mm</span><span>{LABEL_POSITIONS[selected.position]}</span></> : <span>No label selected</span>}
      {selected && <span>{handSelected ? 'Hand tag' : interior || neckSelected ? 'Interior attachment' : `${view === 'back' ? 'Back' : 'Front'} exterior`}</span>}
      {!handSelected && !garmentProps.labelReferenceWidthMm && <span className="text-white/45">Scale reference: 500 mm chest</span>}
      {exportError && <span role="alert" className="text-red-300">{exportError}</span>}
    </div>
  </div>;
}