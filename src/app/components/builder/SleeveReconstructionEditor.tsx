import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FlipHorizontal2, RotateCcw } from 'lucide-react';
import type { CustomAssetDefinition } from '../../data/customAssets';
import { defaultSleeveEdits, sleeveGeometry, type SleeveContourHandle, type SleeveEdits, type SleevePoint, type SleeveReconstruction, type SleeveStyle } from '../../data/sleeveReconstruction';

const fieldClass = 'min-h-9 w-full min-w-0 rounded border border-white/20 bg-[#252527] px-2 py-1 text-xs text-white';
function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(Number(value.toFixed(2))));
  useEffect(() => setDraft(String(Number(value.toFixed(2)))), [value]);
  return <label className="grid min-w-0 gap-1 text-[11px] text-white/70">{label}<input aria-label={label} type="number" className={fieldClass} min={min} max={max} step={step} value={draft}
    onChange={event => { setDraft(event.target.value); const parsed = Number(event.target.value); if (event.target.value.trim() && Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed); }}
    onBlur={() => setDraft(String(Number(value.toFixed(2))))}/></label>;
}

export function SleeveReconstructionEditor({ assets, applyBoth, onApplyBoth, onChange, renderPreview }: {
  assets: CustomAssetDefinition[]; applyBoth: boolean; onApplyBoth: (value: boolean) => void;
  onChange: (id: string, model: SleeveReconstruction) => void; renderPreview: (overlay: ReactNode) => ReactNode;
}) {
  const [selected, setSelected] = useState(assets[0]?.id);
  const [selectedHandle, setSelectedHandle] = useState('shoulder');
  const asset = assets.find(item => item.id === selected) ?? assets[0];
  const model = asset?.sleeveReconstruction;
  const drag = useRef<{ name: string; start: SleevePoint; model: SleeveReconstruction }>();
  if (!model) return null;
  const geometry = sleeveGeometry(model);
  const edit = (change: Partial<SleeveEdits>) => onChange(asset.id, { ...model, edits: { ...model.edits, ...change } });
  const style = (change: Partial<SleeveStyle>) => {
    const next = { ...model.style, ...change };
    next.taper = next.openingWidth / next.upperWidth;
    next.sleeveType = next.cuffStyle !== 'plain' ? 'cuffed' : next.silhouette !== 'straight' ? next.silhouette : next.lengthClass;
    onChange(asset.id, { ...model, style: next });
  };
  const handles: Record<string, SleevePoint> = { shoulder: geometry.shoulder, frontJoin: geometry.frontJoin, backJoin: geometry.backJoin, underarm: geometry.underarm,
    upperOuter: geometry.upperOuter, upperInner: geometry.upperInner, midOuter: geometry.midOuter, midInner: geometry.midInner,
    cuffTop: geometry.cuffTop, cuffBottom: geometry.cuffBottom, endpoint: geometry.endpoint, hemTilt: geometry.hemTilt,
    opening: [geometry.cuffBottom[0] + geometry.axis[0] * 85, geometry.cuffBottom[1] + geometry.axis[1] * 85] };
  const handleLabels: Record<string, string> = { shoulder: 'Shoulder peak', frontJoin: 'Front armhole join', backJoin: 'Back armhole join', underarm: 'Underarm attach point',
    upperOuter: 'Upper outer sleeve curve', upperInner: 'Upper inner sleeve curve', midOuter: 'Mid outer sleeve', midInner: 'Mid inner sleeve',
    cuffTop: geometry.cuffTop[0] <= geometry.cuffBottom[0] ? 'Cuff left' : 'Cuff right', cuffBottom: geometry.cuffTop[0] <= geometry.cuffBottom[0] ? 'Cuff right' : 'Cuff left',
    endpoint: 'Sleeve length endpoint', hemTilt: 'Cuff angle / hem tilt', opening: 'Sleeve opening width' };
  const handleRadius = 22;
  const move = (name: string, delta: SleevePoint, original: SleeveReconstruction) => {
    const edits = { ...original.edits };
    if (name === 'hemTilt') {
      const before = sleeveGeometry(original);
      const vector: SleevePoint = [before.hemTilt[0] + delta[0] - before.endpoint[0], before.hemTilt[1] + delta[1] - before.endpoint[1]];
      const angle = Math.atan2(vector[0] * before.across[0] + vector[1] * before.across[1], vector[0] * before.axis[0] + vector[1] * before.axis[1]) * 180 / Math.PI;
      const previous = Math.atan2((before.hemTilt[0] - before.endpoint[0]) * before.across[0] + (before.hemTilt[1] - before.endpoint[1]) * before.across[1], (before.hemTilt[0] - before.endpoint[0]) * before.axis[0] + (before.hemTilt[1] - before.endpoint[1]) * before.axis[1]) * 180 / Math.PI;
      onChange(asset.id, { ...original, style: { ...original.style, hemAngle: Math.max(-60, Math.min(60, original.style.hemAngle + (angle - previous) * (original.edits.mirror ? -1 : 1))) } });
      return;
    } else if (name === 'opening') {
      const before = sleeveGeometry(original);
      const horizontal = before.cuffBottom[0] - before.cuffTop[0];
      const vertical = before.cuffBottom[1] - before.cuffTop[1];
      const width = Math.hypot(horizontal, vertical);
      const distance = (delta[0] * horizontal + delta[1] * vertical) / Math.max(1, width);
      edits.openingWidth = Math.max(.25, Math.min(3, edits.openingWidth * (1 + 2 * distance / Math.max(1, width))));
    } else if (name === 'endpoint') {
      const originalGeometry = sleeveGeometry(original);
      const distance = delta[0] * originalGeometry.axis[0] + delta[1] * originalGeometry.axis[1];
      edits.length = Math.max(.25, Math.min(3, edits.length * (1 + distance / originalGeometry.length)));
    } else if (['shoulder', 'underarm', 'cuffTop', 'cuffBottom'].includes(name)) {
      const key = name as 'shoulder' | 'underarm' | 'cuffTop' | 'cuffBottom';
      edits[key] = [Math.max(-500, Math.min(500, edits[key][0] + delta[0])), Math.max(-500, Math.min(500, edits[key][1] + delta[1]))];
    } else {
      const key = name as SleeveContourHandle;
      const point = edits.contourOffsets?.[key] ?? [0, 0];
      edits.contourOffsets = { ...edits.contourOffsets, [key]: [Math.max(-500, Math.min(500, point[0] + delta[0])), Math.max(-500, Math.min(500, point[1] + delta[1]))] };
    }
    onChange(asset.id, { ...original, edits });
  };
  const pointAt = (svg: SVGSVGElement, clientX: number, clientY: number): SleevePoint => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return [0, 0];
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return [point.x, point.y];
  };
  const overlay = <svg aria-label="Editable sleeve preview" viewBox="0 0 2048 2048" className="pointer-events-none absolute inset-0 z-[300] h-full w-full touch-none"
    onPointerMove={event => { if (!drag.current) return; const point = pointAt(event.currentTarget, event.clientX, event.clientY); move(drag.current.name, [point[0] - drag.current.start[0], point[1] - drag.current.start[1]], drag.current.model); }}
    onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }} onLostPointerCapture={() => { drag.current = undefined; }}>
    <polyline points={[...geometry.outerContour, ...geometry.innerContour.slice().reverse()].map(point => point.join(',')).join(' ')} fill="none" stroke="#047857" strokeWidth="3"/>
    <polyline points={model.socket.join.map(point => point.join(',')).join(' ')} fill="none" stroke="#777" strokeWidth="4" strokeDasharray="10 10"/>
    <line x1={geometry.endpoint[0]} y1={geometry.endpoint[1]} x2={geometry.hemTilt[0]} y2={geometry.hemTilt[1]} stroke="#b45309" strokeWidth="3"/>
    <line x1={geometry.cuffBottom[0]} y1={geometry.cuffBottom[1]} x2={handles.opening[0]} y2={handles.opening[1]} stroke="#b45309" strokeWidth="3"/>
    {Object.entries(handles).sort(([first], [second]) => Number(first === selectedHandle) - Number(second === selectedHandle)).map(([name, point]) => <g key={name}>
      <circle cx={point[0]} cy={point[1]} r={handleRadius} fill={['hemTilt', 'endpoint', 'opening'].includes(name) ? '#b45309' : '#047857'} stroke={name === selectedHandle ? '#111' : 'white'} strokeWidth="4"/>
      <circle cx={point[0]} cy={point[1]} r="44" fill="transparent" pointerEvents="all" tabIndex={0} role="slider" aria-label={handleLabels[name]} aria-valuetext={`${Math.round(point[0])}, ${Math.round(point[1])}`} style={{ cursor: 'grab' }}
        onFocus={() => setSelectedHandle(name)}
        onPointerDown={event => { event.preventDefault(); event.stopPropagation(); setSelectedHandle(name); const svg = event.currentTarget.ownerSVGElement!; drag.current = { name, start: pointAt(svg, event.clientX, event.clientY), model: structuredClone(model) }; svg.setPointerCapture(event.pointerId); }}
        onKeyDown={event => { const delta = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] }[event.key]; if (delta) { event.preventDefault(); move(name, delta as SleevePoint, model); } }}><title>{handleLabels[name]}</title></circle>
    </g>)}
  </svg>;
  return <section aria-label="Refine sleeve" className="space-y-3 border-t border-white/15 pt-3">
    <div className="flex flex-wrap items-center gap-2"><h3 className="mr-auto text-sm font-medium">Refine sleeve</h3>
      <div role="group" aria-label="Edit sleeve side" className="flex gap-1">{assets.map(item => <button key={item.id} type="button" aria-pressed={item.id === asset.id} className={`rounded border px-3 py-2 text-xs ${item.id === asset.id ? 'border-emerald-400' : 'border-white/20'}`} onClick={() => setSelected(item.id)}>{item.registration.side === 'left' ? 'Left' : 'Right'}</button>)}</div>
      <button type="button" title="Mirror sleeve style" aria-label="Mirror sleeve style" aria-pressed={model.edits.mirror} className="rounded border border-white/20 p-2" onClick={() => edit({ mirror: !model.edits.mirror })}><FlipHorizontal2 className="size-4"/></button>
      <button type="button" title="Reset sleeve refinement" aria-label="Reset sleeve refinement" className="rounded border border-white/20 p-2" onClick={() => onChange(asset.id, { ...model, style: structuredClone(model.detectedStyle), edits: defaultSleeveEdits() })}><RotateCcw className="size-4"/></button>
    </div>
    <div className="flex flex-wrap justify-between gap-2 text-xs"><span className="text-white/60">Detected: {model.detectedStyle.lengthClass} / {model.detectedStyle.silhouette} / {model.detectedStyle.cuffStyle} / {model.detectedStyle.confidence} confidence</span>
      <label className="flex items-center gap-2"><input type="checkbox" checked={applyBoth} onChange={event => onApplyBoth(event.target.checked)}/>Apply to both sleeves</label>
    </div>
    <div role="tabpanel" aria-label="FINAL ASSET" className="h-[min(60dvh,560px)] min-h-72 overflow-hidden rounded-md bg-[#eeeeec]">{renderPreview(overlay)}</div>
    <div className="grid grid-cols-2 gap-3 border-b border-white/15 pb-3">
      {(['bodyColor', 'cuffColor'] as const).filter(key => key !== 'cuffColor' || model.style.cuff).map(key => <label key={key} className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
        <input type="color" aria-label={key === 'bodyColor' ? 'Sleeve body color' : 'Cuff color'} value={model.edits[key] ?? model.edits.bodyColor ?? '#ffffff'} className="h-8 w-10 shrink-0 cursor-pointer bg-transparent" onChange={event => edit({ [key]: event.target.value })}/>
        <span>{key === 'bodyColor' ? 'Sleeve body color' : 'Cuff color'}</span>
        <button type="button" title={key === 'bodyColor' ? 'Use garment color' : 'Use sleeve body color'} aria-label={key === 'bodyColor' ? 'Use garment color' : 'Use sleeve body color'} className="rounded border border-white/20 p-1.5" onClick={() => edit({ [key]: undefined })}><RotateCcw className="size-3.5"/></button>
      </label>)}
      <p role="status" aria-label="Cuff detection" className="col-span-2 text-xs text-white/70">{model.style.cuff ? `${model.style.cuffStyle} cuff / ${model.style.cuff.confidence} confidence / depth ${(model.style.cuff.depth / model.detectedStyle.length * 100).toFixed(1)}% of sleeve. ${model.style.cuff.evidence}` : model.style.cuffStyle === 'plain' ? 'Plain sleeve hem. No separate cuff.' : 'Cuff boundary unresolved. Source construction retained; no replacement cuff added.'}</p>
    </div>
    {model.detectedStyle.sourceGarment && model.socket.garment && <details className="text-xs text-white/70">
      <summary className="cursor-pointer py-1">Source / {model.fit} construction</summary>
      <dl className="grid grid-cols-2 gap-2 py-2">
        {([['Body length / width', 'bodyAspectRatio'], ['Shoulder span / body', 'shoulderSpanToBodyWidth'], ['Shoulder drop / body', 'shoulderDrop'], ['Armhole / body', 'armholeToBodyWidth']] as const).map(([label, key]) => <div key={key}><dt>{label}</dt><dd>{model.detectedStyle.sourceGarment![key].toFixed(2)} / {model.socket.garment![key].toFixed(2)}</dd></div>)}
      </dl>
    </details>}
    <div>
      <div className="grid content-start grid-cols-2 gap-2">
        <label className="col-span-2 grid gap-1 text-[11px] text-white/70">Edit point<select aria-label="Edit point" className={fieldClass} value={selectedHandle} onChange={event => setSelectedHandle(event.target.value)}>{Object.entries(handleLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        {!['hemTilt', 'endpoint', 'opening'].includes(selectedHandle) && ([0, 1] as const).map(axis => {
          const point = model.edits.contourOffsets?.[selectedHandle as SleeveContourHandle] ?? model.edits[selectedHandle as 'shoulder' | 'underarm' | 'cuffTop' | 'cuffBottom'] ?? [0, 0];
          return <NumberField key={`${selectedHandle}-${axis}`} label={`Point offset ${axis ? 'Y' : 'X'}`} value={point[axis]} min={-500} max={500} onChange={value => move(selectedHandle, axis ? [0, value - point[axis]] : [value - point[axis], 0], model)}/>;
        })}
        <label className="grid gap-1 text-[11px] text-white/70">Sleeve length type<select aria-label="Sleeve length type" className={fieldClass} value={model.style.lengthClass} onChange={event => style({ lengthClass: event.target.value as SleeveStyle['lengthClass'] })}><option value="short">Short</option><option value="long">Long</option></select></label>
        <label className="grid gap-1 text-[11px] text-white/70">Silhouette<select aria-label="Sleeve silhouette" className={fieldClass} value={model.style.silhouette} onChange={event => style({ silhouette: event.target.value as SleeveStyle['silhouette'] })}>{['straight', 'tapered', 'flared'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="grid gap-1 text-[11px] text-white/70">Construction<select aria-label="Sleeve construction" className={fieldClass} value={model.style.construction} onChange={event => style({ construction: event.target.value as SleeveStyle['construction'] })}>{['unknown', 'set-in', 'dropped-shoulder', 'raglan', 'dolman'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="grid gap-1 text-[11px] text-white/70">Cuff style<select aria-label="Sleeve cuff style" disabled={!!model.style.artwork} className={fieldClass} value={model.style.cuffStyle} onChange={event => style({ cuffStyle: event.target.value as SleeveStyle['cuffStyle'] })}>{['plain', 'band', 'ribbed', 'rolled', 'elastic'].map(value => <option key={value}>{value}</option>)}</select></label>
        {([['Overall scale (%)', 'scale'], ['Sleeve length (%)', 'length'], ['Opening width (%)', 'openingWidth'], ['Upper sleeve width (%)', 'upperWidth']] as const).map(([label, key]) => <NumberField key={key} label={label} value={model.edits[key] * 100} min={25} max={300} onChange={value => edit({ [key]: value / 100 })}/>)}
        <NumberField label="Rotation (deg)" value={model.edits.rotation} min={-90} max={90} onChange={rotation => edit({ rotation })}/>
        <NumberField label="Hem angle (deg)" value={model.style.hemAngle} min={-60} max={60} onChange={hemAngle => style({ hemAngle })}/>
        <NumberField label="Looseness (%)" value={model.style.looseness * 100} min={75} max={140} onChange={looseness => style({ looseness: looseness / 100 })}/>
        <NumberField label="Taper (%)" value={model.style.taper * 100} min={30} max={160} onChange={taper => style({ openingWidth: model.style.upperWidth * taper / 100 })}/>
        {(['shoulder', 'underarm'] as const).flatMap(key => ([0, 1] as const).map(axis => <NumberField key={`${key}-${axis}`} label={`${key === 'shoulder' ? 'Shoulder join' : 'Armhole join'} ${axis ? 'Y' : 'X'}`} value={model.edits[key][axis]} min={-500} max={500} onChange={value => { const point: SleevePoint = [...model.edits[key]]; point[axis] = value; edit({ [key]: point }); }}/>))}
      </div>
    </div>
    {geometry.issues.map(issue => <p role="alert" key={issue} className="text-xs text-amber-200">{issue}</p>)}
  </section>;
}