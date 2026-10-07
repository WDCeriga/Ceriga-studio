import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { constructionBrushPath, selectUnassignedConstructionArea, type BrushPoint } from '../../lib/constructionRegionPainting';
import { importedBuilderCategories, importedRegionTypes, type ImportedGarment, type ImportedGarmentView } from '../../data/importedGarment';
import { canPaintConstructionRegion, paintConstructionRegion, constructionRegionCategory, constructionRegionsForView, constructionSplitCandidates, linkConstructionRegions, mergeConstructionRegions, patchConstructionRegion, reviewConstructionRegions, splitConstructionRegion } from '../../data/importedConstructionRegions';

const control = 'rounded border border-white/20 bg-[#202024] p-2 text-xs text-white disabled:opacity-40';
const palette = ['#fb7185', '#38bdf8', '#a3e635', '#c084fc', '#fbbf24', '#2dd4bf', '#fb923c', '#818cf8', '#f472b6', '#94a3b8'];
export function ImportedConstructionRegionReview({ value, view, selectedId, onSelect, onChange, onReviewed }: {
  value: ImportedGarment; view: ImportedGarmentView; selectedId: string | null; onSelect: (id: string | null) => void;
  onChange: (value: ImportedGarment) => void; onReviewed?: () => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(true);
  const [otherId, setOtherId] = useState('');
  const [seamId, setSeamId] = useState('');
  const [error, setError] = useState('');
  const [tool, setTool] = useState<'select' | 'paint' | 'erase' | 'fill'>('select');
  const [diameter, setDiameter] = useState(28);
  const [newRegion, setNewRegion] = useState(false);
  const [regionName, setRegionName] = useState('New fabric region');
  const [stroke, setStroke] = useState<BrushPoint[]>([]);
  const drawing = useRef<{ pointerId: number; points: BrushPoint[] } | null>(null);
  const [pendingArea, setPendingArea] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [history, setHistory] = useState<{ before: ImportedGarment; after: ImportedGarment; selected: string | null; view: ImportedGarmentView }[]>([]);
  const latest = useRef({ value, view, selectedId, tool, newRegion });
  latest.current = { value, view, selectedId, tool, newRegion };
  const selectionRequest = useRef(0);
  useEffect(() => {
    selectionRequest.current++;
    drawing.current = null; setStroke([]); setPendingArea(''); setSelecting(false);
    return () => { selectionRequest.current++; };
  }, [value, view, selectedId, tool, newRegion]);
  const data = constructionRegionsForView(value, view);
  if (!data) return <p>No construction regions for this view. The pristine trace is unchanged.</p>;
  const regions = [...data.regions].filter(region => region.view === view).sort((a, b) => a.zIndex - b.zIndex);
  const selected = regions.find(region => region.id === selectedId);
  const seams = selectedId ? constructionSplitCandidates(data, selectedId) : [];
  const other = regions.find(region => region.id === otherId && region.id !== selectedId);
  const selectedSeam = seams.find(seam => seam.id === seamId);
  const apply = (action: () => ImportedGarment) => {
    try {
      const next = action();
      if (next !== value) {
        setHistory(previous => [...(previous.at(-1)?.after === value ? previous : []), { before: value, after: next, selected: selectedId, view }].slice(-20));
        onChange(next);
      }
      setError(''); return true;
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Region correction failed.'); return false; }
  };
  const undo = history.at(-1);
  const targetReady = newRegion || Boolean(selected && canPaintConstructionRegion(selected));
  const commitPaint = (path: string) => {
    let result: ReturnType<typeof paintConstructionRegion> | undefined;
    if (apply(() => {
      result = paintConstructionRegion(value, view, newRegion ? null : selectedId, path, tool === 'erase' ? 'erase' : 'paint', regionName);
      return result.garment;
    }) && result) {
      onSelect(result.regionId); setNewRegion(false); setPendingArea('');
    }
  };
  const pointAt = (event: PointerEvent<SVGSVGElement>): BrushPoint => {
    const point = event.currentTarget.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) throw new Error('Drawing is not ready.');
    const local = point.matrixTransform(matrix.inverse());
    return [Math.max(0, Math.min(2047.99, local.x)), Math.max(0, Math.min(2047.99, local.y))];
  };
  const chooseArea = async (point: BrushPoint) => {
    const request = ++selectionRequest.current, snapshot = latest.current;
    setSelecting(true); setPendingArea(''); setError('');
    try {
      const path = await selectUnassignedConstructionArea(data, point);
      if (request === selectionRequest.current && latest.current.value === snapshot.value && latest.current.view === snapshot.view &&
        latest.current.selectedId === snapshot.selectedId && latest.current.tool === snapshot.tool && latest.current.newRegion === snapshot.newRegion) setPendingArea(path);
    } catch (failure) {
      if (request === selectionRequest.current) setError(failure instanceof Error ? failure.message : 'Area selection failed.');
    } finally { if (request === selectionRequest.current) setSelecting(false); }
  };
  const pointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (tool === 'select' || !event.isPrimary || event.button !== 0 || selecting) return;
    event.preventDefault();
    if (!targetReady) { setError('Select a fabric region from the list, or choose New colourable region.'); return; }
    const point = pointAt(event);
    if (tool === 'fill') { void chooseArea(point); return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = { pointerId: event.pointerId, points: [point] }; setStroke([point]); setError('');
  };
  const pointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const active = drawing.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const point = pointAt(event), previous = active.points.at(-1)!;
    if (Math.hypot(point[0] - previous[0], point[1] - previous[1]) < diameter / 4) return;
    if (active.points.length >= 4095) return;
    active.points.push(point); setStroke([...active.points]);
  };
  const pointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const active = drawing.current;
    if (!active || active.pointerId !== event.pointerId) return;
    active.points.push(pointAt(event)); drawing.current = null; setStroke([]);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    try { commitPaint(constructionBrushPath(active.points, diameter)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Brush correction failed.'); }
  };
  const patch = (update: Parameters<typeof patchConstructionRegion>[3]) => selected && apply(() => patchConstructionRegion(value, view, selected.id, update));
  const metadata = value.manifest[view === 'front' ? 'frontView' : 'backView'];
  const source = metadata?.sourceImage ?? value.sourceImages?.[view] ?? (view === value.manifest.view ? value.sourceImage : undefined);
  return <section aria-label="Construction regions review" className="space-y-3 text-xs">
    <p>{metadata?.inference ? 'ESTIMATED BACK — review essential construction inferred from front geometry. These boundaries are not observed rear seams. Hidden rear details remain unknown.' : 'Review source-derived fabric regions beneath the unchanged construction ink. Low-confidence regions require visual review; no hidden back construction is invented.'}</p>
    <div className="flex gap-3"><label><input type="checkbox" checked={overlay} onChange={event => setOverlay(event.target.checked)}/> Debug colour overlay</label><span>{regions.length} regions · {view} · {data.status}</span></div>
    {data.warnings.length > 0 && <ul className="text-amber-200" aria-label="Construction warnings">{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    <fieldset className="space-y-2 rounded border border-white/20 p-3">
      <legend className="font-semibold">Manual region correction</legend>
      <div className="flex flex-wrap gap-2">
        <button className={control} aria-pressed={tool === 'select'} onClick={() => { setTool('select'); setNewRegion(false); }}>Select regions</button>
        <button className={control} aria-pressed={tool === 'paint'} onClick={() => setTool('paint')}>Paint into region</button>
        <button className={control} aria-pressed={tool === 'erase'} disabled={newRegion || !selected || !canPaintConstructionRegion(selected)} onClick={() => setTool('erase')}>Erase from region</button>
        <button className={control} aria-pressed={tool === 'fill'} disabled={selecting} onClick={() => setTool('fill')}>Select missed area</button>
        <button className={control} aria-pressed={newRegion} onClick={() => { setNewRegion(true); setTool('paint'); }}>New colourable region</button>
        <button className={control} disabled={!undo || undo.after !== value || undo.view !== view} onClick={() => {
          if (!undo || undo.after !== value || undo.view !== view) return;
          onChange(undo.before); onSelect(undo.selected); setHistory(previous => previous.slice(0, -1)); setError('');
        }}>Undo correction</button>
      </div>
      <p>Target: <strong>{newRegion ? regionName : selected?.label ?? 'Choose a region from the list'}</strong></p>
      {newRegion && <label className="block">New region name<input aria-label="New region name" className={`${control} ml-2`} value={regionName} onChange={event => setRegionName(event.target.value)}/></label>}
      {(tool === 'paint' || tool === 'erase') && <label className="flex items-center gap-2">Brush size<input aria-label="Brush size" type="range" min="4" max="120" step="2" value={diameter} onChange={event => setDiameter(Number(event.target.value))}/>{diameter}</label>}
      <p>To repair a pocket crossing the hem: select the hem in the list, then paint over the wrongly assigned area. Paint transfers that area from the pocket; erase removes only the selected fill. Black construction lines and hardware stay protected.</p>
      <p>For white fabric: select its existing region or choose New colourable region, then paint, or use Select missed area and click an enclosed white area. Check the preview before applying; if it leaks into the background, use a small brush. Confirm review, then colour the region in the builder.</p>
      {selecting && <p role="status">Finding enclosed unassigned area…</p>}
      {pendingArea && <div className="flex gap-2"><button className={control} onClick={() => commitPaint(pendingArea)}>Apply selected area</button><button className={control} onClick={() => setPendingArea('')}>Cancel area selection</button></div>}
    </fieldset>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        {source && <details><summary>Source reference</summary><img src={source} alt={`${view} garment source reference`} className="max-h-72 w-full object-contain bg-white"/></details>}
        <div className="relative aspect-square bg-white" aria-label="Construction region overlay">
          <svg viewBox="0 0 2048 2048" className="absolute inset-0 h-full w-full" aria-label="Selectable construction regions"
            style={{ touchAction: tool === 'select' ? 'auto' : 'none', cursor: tool === 'select' ? 'pointer' : 'crosshair' }}
            onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
            onPointerCancel={() => { drawing.current = null; setStroke([]); }} onLostPointerCapture={() => { drawing.current = null; setStroke([]); }}>
            {regions.map((region, index) => <path key={region.id} d={region.path} fill={overlay ? palette[index % palette.length] : 'transparent'} fillRule="evenodd"
              fillOpacity={selectedId === region.id || hovered === region.id ? .85 : .5} stroke={selectedId === region.id || hovered === region.id ? '#111827' : 'none'} strokeWidth="7"
              role="button" tabIndex={0} aria-label={`Select ${region.label}`} aria-pressed={selectedId === region.id} data-region-id={region.id}
              onMouseEnter={() => setHovered(region.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(region.id)} onBlur={() => setHovered(null)}
              onClick={() => { if (tool === 'select') onSelect(region.id); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setNewRegion(false); onSelect(region.id); } }}>
              <title>{`${region.label} · ${region.semanticType} · ${importedBuilderCategories[region.builderCategory]?.title} · ${Math.round(region.confidence * 100)}%`}</title>
            </path>)}
            {pendingArea && <path d={pendingArea} fill="#06b6d4" fillRule="evenodd" fillOpacity=".65" stroke="#0e7490" strokeWidth="3" pointerEvents="none"/>}
            {stroke.length > 0 && <g pointerEvents="none" opacity=".7">
              <polyline points={stroke.map(point => point.join(',')).join(' ')} fill="none" stroke={tool === 'erase' ? '#ef4444' : '#06b6d4'} strokeWidth={diameter} strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx={stroke[0][0]} cy={stroke[0][1]} r={diameter / 2} fill={tool === 'erase' ? '#ef4444' : '#06b6d4'}/>
            </g>}
          </svg>
          <img src={`data:image/svg+xml,${encodeURIComponent(data.constructionInk)}`} alt={metadata?.inference ? 'Estimated essential construction lines' : 'Pristine traced construction ink'} data-construction-ink="immutable" className="pointer-events-none absolute inset-0 h-full w-full"/>
        </div>
        <p>Hardware: {data.hardware.length} · Closures: {data.closures.length} · Separate stitching paths: {data.stitchingPaths.length}</p>
      </div>
      <div className="space-y-3">
        <ul aria-label="Construction region list" className="max-h-60 overflow-auto space-y-1">{regions.map((region, index) => <li key={region.id}>
          <button className={`${control} w-full text-left ${hovered === region.id || selectedId === region.id ? 'ring-2 ring-white/60' : ''}`} aria-pressed={selectedId === region.id}
            onMouseEnter={() => setHovered(region.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(region.id)} onBlur={() => setHovered(null)} onClick={() => { setNewRegion(false); onSelect(region.id); }}>
            <span aria-hidden="true" style={{ color: palette[index % palette.length] }}>● </span>{region.label}<br/>
            <span className="text-white/60">{region.semanticType} · {importedBuilderCategories[region.builderCategory]?.title} · {region.geometrySource === 'manual' ? `Manual boundary${data.status === 'needs-review' ? ' · review required' : ''}` : `${Math.round(region.confidence * 100)}% confidence`}{!region.editableIndependently || region.decorative ? ' · Not editable' : ''}</span>
          </button>
        </li>)}</ul>
        {selected ? <fieldset className="space-y-2" key={selected.id}><legend className="font-semibold">Correct selected region</legend>
          <label className="block">Region name<input aria-label="Region name" className={`${control} w-full`} defaultValue={selected.label} key={`${selected.id}:${selected.label}`} onBlur={event => { if (event.target.value !== selected.label) patch({ label: event.target.value.trim() }); }}/></label>
          <label className="block">Semantic type<select aria-label="Semantic type" className={`${control} w-full`} value={selected.semanticType} onChange={event => { const semanticType = event.target.value as typeof selected.semanticType; patch({ semanticType, builderCategory: constructionRegionCategory(semanticType) }); }}>{importedRegionTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
          <label className="block">Builder category<select aria-label="Builder category" className={`${control} w-full`} value={selected.builderCategory} onChange={event => patch({ builderCategory: event.target.value as typeof selected.builderCategory })}>{Object.entries(importedBuilderCategories).map(([category, definition]) => <option key={category} value={category}>{definition.title} ({category})</option>)}</select></label>
          <label className="block"><input type="checkbox" checked={selected.editableIndependently} onChange={event => patch({ editableIndependently: event.target.checked })}/> Independently editable</label>
          <label className="block"><input type="checkbox" checked={Boolean(selected.decorative)} onChange={event => patch({ decorative: event.target.checked })}/> Decorative / not fabric</label>
          <label className="block">Colour group<input aria-label="Colour group" className={`${control} w-full`} key={`colour:${selected.id}:${selected.colourGroupId}`} defaultValue={selected.colourGroupId} onBlur={event => patch({ colourGroupId: event.target.value.trim() || `colour:${selected.id}` })}/></label>
          <label className="block">Fabric group<input aria-label="Fabric group" className={`${control} w-full`} key={`fabric:${selected.id}:${selected.fabricGroupId}`} defaultValue={selected.fabricGroupId} onBlur={event => patch({ fabricGroupId: event.target.value.trim() || `fabric:${selected.id}` })}/></label>
          <label className="block">Second region<select aria-label="Second region" className={`${control} w-full`} value={other?.id ?? ''} onChange={event => setOtherId(event.target.value)}><option value="">Choose region</option>{regions.filter(region => region.id !== selected.id).map(region => <option key={region.id} value={region.id}>{region.label}</option>)}</select></label>
          <div className="flex flex-wrap gap-2"><button className={control} disabled={!other} onClick={() => apply(() => mergeConstructionRegions(value, view, selected.id, other!.id))}>Merge regions</button>
            <button className={control} disabled={!other} onClick={() => apply(() => linkConstructionRegions(value, view, selected.id, other!.id))}>Link symmetrical pair</button>
            <button className={control} disabled={!selected.mirroredPairId} onClick={() => apply(() => linkConstructionRegions(value, view, selected.id, null))}>Unlink pair</button></div>
          <label className="block">Evidenced seam<select aria-label="Evidenced seam" className={`${control} w-full`} value={selectedSeam?.id ?? ''} onChange={event => setSeamId(event.target.value)}><option value="">Choose local seam candidate</option>{seams.map(seam => <option key={seam.id} value={seam.id}>{seam.label}</option>)}</select></label>
          <button className={control} disabled={!selectedSeam} onClick={() => apply(() => splitConstructionRegion(value, view, selected.id, selectedSeam!.id))}>Split along selected seam</button>
          {!seams.length && <p>No source-evidenced split candidate. Use manual correction above to paint a reviewed boundary instead.</p>}
        </fieldset> : <p>Select a region in the drawing or list to correct it.</p>}
      </div>
    </div>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <button className={control} disabled={!regions.length || selecting || Boolean(pendingArea) || stroke.length > 0} onClick={() => { if (apply(() => reviewConstructionRegions(value, view))) onReviewed?.(); }}>Confirm construction region review</button>
    <p>Confirmation records review, not extra confidence. Accept the garment separately after reviewing each segmented view.</p>
  </section>;
}
