import { useEffect, useRef, useState } from 'react';
import { Download, Maximize, Minus, Plus, RotateCcw } from 'lucide-react';
import { isInteriorLabel, labelSpecification, LABEL_POSITIONS, type GarmentLabel } from '../../data/garmentLabels';
import { TshirtSvgPreview, type TshirtSvgPreviewProps } from './TshirtSvgPreview';
import { LabelArtwork } from './LabelArtwork';

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
  const [mode, setMode] = useState<'garment' | 'closeup'>('garment');
  const [interior, setInterior] = useState(false);
  const [showGarment, setShowGarment] = useState(true);
  const [background, setBackground] = useState<'light' | 'dark' | 'checker'>('light');
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState({ x: 1024, y: 1024 });
  const rootRef = useRef<HTMLDivElement>(null);
  const [exportError, setExportError] = useState('');
  useEffect(() => {
    if (!selected) return;
    setInterior(!selected.position.startsWith('neck-') && isInteriorLabel(selected));
    setMode('closeup'); setZoom(1);
  }, [selectedId, selected?.position]);
  const scale = mode === 'closeup' && selected ? 3 * zoom : zoom;
  const point = mode === 'closeup' && selected ? focus : { x: 1024, y: 1024 };
  const controlClass = 'rounded px-2 py-1.5 text-[11px] text-white/70 hover:bg-white/10 aria-pressed:bg-white/15 aria-pressed:text-white';
  const neckSelected = selected?.category === 'neck' || selected?.position.startsWith('neck-');
  const view = neckSelected ? 'front' : interior ? 'back' : selected?.category === 'tag' ? selected.exteriorView : garmentProps.detailView;
  const downloadPlacement = async () => {
    try {
      await document.fonts.ready;
      const svg = labelPlacementSheet(rootRef.current!, labels, interior ? 'inside back' : `${view} outside`);
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `label-placement-${interior ? 'inside' : view}.svg`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setExportError('');
    } catch { setExportError('Placement export failed'); }
  };
  return <div ref={rootRef} className="flex h-full min-h-0 w-full flex-col" data-label-editing-surface="" onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
    <div className="z-10 flex shrink-0 flex-wrap items-center justify-center gap-1 border-b border-white/10 bg-[#111113] p-1.5">
      <div role="group" aria-label="Label preview mode"><button type="button" className={controlClass} aria-pressed={mode === 'garment'} onClick={() => { setMode('garment'); setZoom(1); }}>Garment</button><button type="button" className={controlClass} aria-pressed={mode === 'closeup'} onClick={() => setMode('closeup')}>Label Close-up</button></div>
      {!neckSelected && <div role="group" aria-label="Garment surface"><button type="button" className={controlClass} aria-pressed={!interior} onClick={() => setInterior(false)}>Outside</button><button type="button" className={controlClass} aria-pressed={interior} onClick={() => setInterior(true)}>Inside</button></div>}
      <label className="flex items-center gap-1 px-2 text-[11px] text-white/70"><input type="checkbox" checked={showGarment} onChange={event => setShowGarment(event.target.checked)} />Show Garment</label>
      <button type="button" title="Download placement SVG" aria-label="Download placement SVG" disabled={!showGarment || !labels.length} className={`${controlClass} disabled:opacity-30`} onClick={() => void downloadPlacement()}><Download size={14} /></button>
      <div className="flex items-center">{[{ Icon: Minus, title: 'Zoom out label editor', action: () => setZoom(value => Math.max(.5, value - .25)) }, { Icon: Plus, title: 'Zoom in label editor', action: () => setZoom(value => Math.min(4, value + .25)) }, { Icon: RotateCcw, title: 'Reset editing zoom', action: () => setZoom(1) }, { Icon: Maximize, title: 'Whole garment', action: () => { setMode('garment'); setShowGarment(true); setZoom(1); } }].map(({ Icon, title, action }) => <button key={title} type="button" title={title} aria-label={title} onClick={action} className={controlClass}><Icon size={14} /></button>)}</div>
    </div>
    {!showGarment && <div className="flex shrink-0 justify-center gap-2 p-2">{(['light', 'dark', 'checker'] as const).map(value => <button key={value} type="button" title={`${value} preview background`} aria-label={`${value} preview background`} aria-pressed={background === value} onClick={() => setBackground(value)} className="h-6 w-6 rounded border border-white/40 aria-pressed:ring-2 aria-pressed:ring-red-400" style={{ background: value === 'light' ? '#f4f4f4' : value === 'dark' ? '#191919' : 'repeating-conic-gradient(#ddd 0% 25%, #999 0% 50%) 0 / 8px 8px' }} />)}</div>}
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden [container-type:size]" style={!showGarment ? { background: background === 'light' ? '#f4f4f4' : background === 'dark' ? '#191919' : 'repeating-conic-gradient(#ddd 0% 25%, #aaa 0% 50%) 0 / 20px 20px' } : undefined}>
      {showGarment ? <div className="relative h-[min(100cqh,100cqw)] w-[min(100cqh,100cqw)] shrink-0 transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `scale(${scale}) translate(${(1024 - point.x) / 2048 * 100}%, ${(1024 - point.y) / 2048 * 100}%)` }}>
        <TshirtSvgPreview {...garmentProps} detailView={view} garmentLabels={labels} onLayerTransformChange={undefined} onSelectedLayerChange={undefined} selectedLayerId={null}
          onDetailsChange={undefined} onDetailSelect={undefined} selectedDetailId={null} labelEditor={{ interior, selectedId, onSelect, onChange, onFocus: setFocus }} />
      </div> : selected ? <svg data-isolated-label="" viewBox={`-3 -3 ${selected.widthMm + 6} ${selected.heightMm + 6}`} className="h-full max-h-full w-full max-w-full p-8" style={{ transform: `scale(${zoom})` }}><LabelArtwork label={selected} guide={selected.construction === 'printed'} /></svg> : null}
    </div>
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-white/10 bg-[#111113] px-2 py-2 text-[10px] text-white/65">
      {selected ? <><span>{selected.widthMm} x {selected.heightMm} mm</span><span>{LABEL_POSITIONS[selected.position]}</span></> : <span>No label selected</span>}
      <span>{interior ? 'Interior attachment view' : `${view === 'back' ? 'Back' : 'Front'} exterior`}</span>
      {!garmentProps.labelReferenceWidthMm && <span className="text-amber-300">Preview scale estimated at 500 mm chest width</span>}
      {exportError && <span role="alert" className="text-red-300">{exportError}</span>}
    </div>
  </div>;
}