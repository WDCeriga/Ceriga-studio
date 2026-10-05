import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ImagePlus, Merge, Scissors, Shapes, RotateCcw, X, Unlink, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { canAcceptImportedConstruction, importedBuilderCategories, importedControlGroups, importedRegionTypes, mergeImportedGarmentView, normalizeImportedGarment, type ImportedGarment, type ImportedMeasurementId, type ImportedPart, type ImportedStitchSettings } from '../../data/importedGarment';
import { importedMeasurementGuides } from '../../data/importedGarmentMeasurements';
import { mergeImportedParts, reviseImportedGarment, splitImportedPart } from '../../data/importedGarmentEditing';
import { tintPotraceSvg } from '../../lib/tshirtSvgUtils';
import { ImportedSizeTable } from './ImportedSizeTable';
import { editEstimatedBackOutline, generateEstimatedBack } from '../../data/importedGarmentBack';

const inputClass = 'w-full min-w-0 rounded border border-white/20 bg-[#202024] px-2 py-1.5 text-xs text-white';
const buttonClass = 'inline-flex min-h-8 items-center justify-center gap-2 rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-40';
type Point = [number, number];

function validateResult(value: ImportedGarment) {
  if (value.source !== 'azure-garment-reconstruction-v1' || !value.manifest?.garmentType ||
    !Array.isArray(value.parts) || value.parts.length < 1 || value.parts.length > 128 || !value.provenance?.garmentVersion || !canAcceptImportedConstruction(value)) throw new Error('Missing source-evidenced construction. Re-analyze the source.');
  const ids = new Set<string>();
  for (const part of value.parts) {
    if (ids.has(part.id) || !/^[a-z][a-z0-9-]{0,63}$/.test(part.id)) throw new Error('Invalid region identity.');
    ids.add(part.id);
  }
  for (const raw of [...value.parts.flatMap(part => [part.svg, part.constructionSvg, part.stitchSvg]),
    ...(value.detailLayers ?? []).flatMap(detail => [detail.constructionSvg, detail.stitchSvg])]) {
      const root = new DOMParser().parseFromString(raw, 'image/svg+xml');
      if (root.querySelector('parsererror') || root.documentElement.localName !== 'svg') throw new Error('Invalid traced SVG.');
      for (const element of root.querySelectorAll('*')) {
        if (!['svg', 'title', 'desc', 'g', 'path', 'defs', 'clipPath', 'rect'].includes(element.localName) ||
          Array.from(element.attributes).some(attribute => /^on/i.test(attribute.name) || /href|style/i.test(attribute.name))) throw new Error('Unsafe SVG response.');
      }
  }
  return normalizeImportedGarment(value);
}

export function ImportedGarmentEditor({ value, onChange, onReplace, selectedId, onSelect, colors, onColor, onResetColors, step, view = 'front', highlightedMeasurementId, onHighlightMeasurement }: {
  value?: ImportedGarment;
  onChange: (value: ImportedGarment) => void;
  onReplace: () => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  colors?: Partial<Record<string, string>>;
  onColor: (id: string, color: string, scope: 'part' | 'symmetry' | 'material' | 'group') => void;
  onResetColors: () => void;
  step: number;
  view?: 'front' | 'back';
  highlightedMeasurementId?: string | null;
  onHighlightMeasurement?: (id: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [review, setReview] = useState(false);
  const [stitchScope, setStitchScope] = useState('all');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const groups = value ? importedControlGroups(value).map(group => ({ ...group, parts: group.parts.filter(part => part.view === view), details: group.details.filter(detail => detail.view === view) })).filter(group => group.parts.length || group.details.length) : [];
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const upload = async (file: File, back?: File | null, appendView?: 'front' | 'back') => {
    if ([file, back].some(item => item && (item.size > 12 * 1024 * 1024 || !/^image\/(png|jpeg|webp)$/.test(item.type)))) { setError('Choose a PNG, JPEG or WebP under 12 MB per image.'); return; }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(''); setProgress('Preparing source image');
    try {
      const readImage = (image: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(image);
      });
      const imageBase64 = await readImage(file);
      const backImageBase64 = back ? await readImage(back) : undefined;
      if (controller.signal.aborted) return;
      const response = await fetch('/api/garment-reconstruction', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, backImageBase64, requestedView: appendView }), signal: controller.signal });
      if (!response.ok || !response.body) throw new Error(`Reconstruction service unavailable (${response.status}).`);
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let pending = '', result: ImportedGarment | undefined;
      const consume = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === 'error') throw new Error(event.error || 'Reconstruction failed.');
        if (event.type === 'progress') setProgress(event.label);
        if (event.type === 'result') result = validateResult(event);
      };
      while (true) {
        const next = await reader.read();
        pending += decoder.decode(next.value, { stream: !next.done });
        const lines = pending.split('\n'); pending = lines.pop()!; lines.forEach(consume);
        if (next.done) break;
      }
      consume(pending);
      if (!result) throw new Error('The service did not return a complete semantic garment.');
      if (!controller.signal.aborted) {
        const next = appendView && value ? mergeImportedGarmentView(value, result, appendView) : result;
        if (!appendView) onReplace();
        onChange(next); onSelect(null); setFrontFile(null); setBackFile(null);
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Upload failed.');
      controller.abort();
    } finally { if (request.current === controller) setBusy(false); }
  };
  const changeStitches = (patch: Partial<ImportedStitchSettings>) => {
    if (!value) return;
    const defaults = { visible: true, color: '#b09c72', weight: 1 };
    const group = groups.find(entry => entry.id === stitchScope);
    onChange(stitchScope === 'all' ? { ...value, stitches: { ...defaults, ...value.stitches, ...patch } }
      : { ...value, stitchOverrides: { ...value.stitchOverrides, ...Object.fromEntries([...(group?.parts ?? []), ...(group?.details ?? [])].map(part => [part.id, { ...value.stitchOverrides?.[part.id], ...patch }])) } });
  };
  const threadGroup = groups.find(group => group.id === stitchScope);
  const threadPart = threadGroup?.details[0] ?? threadGroup?.parts[0];
  const thread = { visible: true, color: '#b09c72', weight: 1, ...value?.stitches, ...(threadPart ? value?.stitchOverrides?.[threadPart.id] : {}) };

  return <section className="mb-5 space-y-3 border-b border-white/15 pb-4 text-xs text-white" aria-label="Imported garment">
    <h3 className="font-semibold">Whole Garment Import</h3>
    {step === 1 && <div className="space-y-2">
      <p className="text-white/60">Upload a garment reference, or front and back together. A combined image can contain both views.</p>
      <div className="flex flex-wrap gap-2">
        <label className={buttonClass}><ImagePlus size={14}/>{frontFile?.name ?? (value ? 'Replace garment reference' : 'Choose garment / front image')}<input aria-label="Upload whole garment" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { setFrontFile(event.target.files?.[0] ?? null); event.target.value = ''; }}/></label>
        <label className={buttonClass}><ImagePlus size={14}/>{backFile?.name ?? 'Choose back image (optional)'}<input aria-label="Choose back image" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { setBackFile(event.target.files?.[0] ?? null); event.target.value = ''; }}/></label>
        <button className={buttonClass} disabled={busy || !frontFile} onClick={() => frontFile && void upload(frontFile, backFile)}>Analyse garment</button>
      </div>
    </div>}
    {busy && <div role="status" className="flex items-center justify-between gap-2"><span>{progress}</span><button className={buttonClass} title="Cancel reconstruction" onClick={() => { request.current?.abort(); setBusy(false); }}><X size={14}/></button></div>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {value && <>
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="capitalize">{value.manifest.garmentType} · {value.manifest.subtype} · {Math.round(value.manifest.confidence * 100)}% confidence</span><button className={buttonClass} onClick={() => setReview(true)}><Shapes size={14}/>Review construction (optional)</button></div>
      {(['front', 'back'] as const).filter(side => !value.parts.some(part => part.view === side)).map(side => <div key={side} className="space-y-2 rounded border border-amber-400/30 p-2">
        <p className="text-amber-200">{side === 'back' ? 'Back reference missing' : 'Front reference required'}. Hidden details have not been generated.</p>
        <label className={buttonClass}><ImagePlus size={14}/>Upload {side} reference<input aria-label={`Upload ${side} reference`} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file, null, side); }}/></label>
        {side === 'back' && <><p className="text-white/60">Or explicitly create an editable estimate from the front silhouette, with an approximate rear neckline / hood / waistline. No rear pockets or hidden trims are assumed. No provider call is made.</p><button className={buttonClass} disabled={busy} onClick={() => {
          const result = generateEstimatedBack(value);
          if (!result.available) { setError(result.reason); return; }
          setError(''); onChange(result.garment); onSelect(null);
        }}>Generate estimated back</button></>}
      </div>)}
      {value.manifest.backView?.inference && <div role="status" className="space-y-2 rounded border border-amber-400/40 p-2 text-amber-200"><p>{value.manifest.backView.inference.notice}</p>
        <label className={buttonClass}><ImagePlus size={14}/>Replace estimate with real back<input aria-label="Replace estimated back with real back reference" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file, null, 'back'); }}/></label>
      </div>}
      {!value.accepted && canAcceptImportedConstruction(value) && <button className={`${buttonClass} bg-white/10`} onClick={() => onChange({ ...value, accepted: true, reviewed: true })}><Check size={14}/>Use detected garment</button>}
      {!canAcceptImportedConstruction(value) && <p role="status" className="text-amber-300">Legacy partition result. Source construction must be re-analyzed.</p>}
      {step === 2 && <p className="text-white/60">Colour each detected construction region independently. If a sleeve, neck or hem region is missing, use a clearer reference and re-analyse; invisible boundaries are not cut arbitrarily.</p>}
      {canAcceptImportedConstruction(value) && <ImportedGroupedControls value={value} garmentView={view} onChange={onChange} selectedId={selectedId} onSelect={onSelect} colors={colors} onColor={onColor} step={step}/>}
      {step === 1 && <ImportedMeasurements value={value} view={view} onChange={onChange} highlightedId={highlightedMeasurementId} onHighlight={onHighlightMeasurement}/>}
      {step === 8 && <div className="space-y-2"><h4 className="font-semibold">Stitching</h4><select aria-label="Thread group" className={inputClass} value={stitchScope} onChange={event => setStitchScope(event.target.value)}><option value="all">Whole garment</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select><div className="flex items-center gap-3"><input aria-label="Thread colour" type="color" value={thread.color} onChange={event => changeStitches({ color: event.target.value })}/><label><input type="checkbox" checked={thread.visible} onChange={event => changeStitches({ visible: event.target.checked })}/> Visible</label></div><label className="block">Thread weight<input aria-label="Thread weight" type="range" min="1" max="4" step=".25" value={thread.weight} onChange={event => changeStitches({ weight: Number(event.target.value) })} className="w-full"/></label></div>}
      <ImportedRegionReview value={value} open={review} onOpenChange={setReview} onChange={onChange} selectedId={selectedId} onSelect={onSelect} colors={colors} onColor={onColor}/>
    </>}
  </section>;
}

export function ImportedMeasurements({ value, view = 'front', onChange, highlightedId, onHighlight }: { value: ImportedGarment; view?: 'front' | 'back'; onChange: (value: ImportedGarment) => void;
  highlightedId?: string | null; onHighlight?: (id: string | null) => void }) {
  const guides = importedMeasurementGuides(value, view);
  const [reference, setReference] = useState<ImportedMeasurementId>('');
  const [unit, setUnit] = useState<'cm' | 'mm'>('cm');
  const calibration = value.measurementCalibration;
  const activeCalibration = value.measurementCalibrations?.[view] ?? (calibration && (calibration.view ?? value.manifest.view) === view ? calibration : undefined);
  const updateCalibration = (millimetres?: number, measurementId = referenceId) => {
    const next = millimetres && Number.isFinite(millimetres) && millimetres > 0 ? { measurementId, millimetres, view } : undefined;
    onChange({ ...value, measurementCalibration: calibration && (calibration.view ?? value.manifest.view) !== view ? calibration : undefined,
      measurementCalibrations: { ...value.measurementCalibrations, [view]: next } });
  };
  const preferredId = activeCalibration?.measurementId ?? reference;
  const referenceId = guides.find(guide => guide.id === preferredId && guide.length)?.id ?? guides.find(guide => guide.length)?.id ?? '';
  const statuses = { supplied: 'User supplied', calibrated: 'Calibrated', estimated: 'Estimated', uncalibrated: 'Calibration required', unavailable: 'Geometry unavailable' };
  return <section className="space-y-3" aria-label="Garment measurements">
    <div><div className="flex items-center justify-between gap-2"><h4 className="text-[11px] font-semibold uppercase tracking-wide text-white/60">{view} measurement ({unit})</h4><div className="flex rounded-full border border-white/15 p-0.5" aria-label="Display units">{(['cm', 'mm'] as const).map(option => <button key={option} className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${unit === option ? 'bg-[#cc2d24] text-white' : 'text-white/50'}`} aria-pressed={unit === option} onClick={() => setUnit(option)}>{option}</button>)}</div></div><p className="mt-2 text-[10px] text-white/45">Guides follow detected garment geometry. Photo proportions are estimates, not exact production specifications.</p></div>
    <ImportedSizeTable value={value} view={view} guides={guides} unit={unit} onChange={onChange} highlightedId={highlightedId} onHighlight={onHighlight}/>
    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Photo reference measurements</h4>
    {!guides.length && <p role="status">No source-evidenced measurement landmarks for this view.</p>}
    <div className="overflow-hidden rounded-md border border-white/10 bg-[#151517]"><table className="w-full text-[11px]" aria-label="Garment measurement table"><thead><tr className="border-b border-white/10 text-white/55">{['Measurement', 'Value', 'Unit', 'Status'].map(column => <th key={column} className="px-2 py-2 text-left font-semibold">{column}</th>)}</tr></thead>
      <tbody>{guides.map((guide, index) => <tr key={guide.id} data-measurement-row={guide.id} className={`border-b border-white/10 last:border-0 ${highlightedId === guide.id ? 'bg-[#cc2d24]/15' : ''}`}
        onMouseEnter={() => onHighlight?.(guide.id)} onMouseLeave={() => onHighlight?.(null)}>
        <td className="px-2 py-2"><button className="w-full break-words text-left font-medium" title={guide.method} disabled={!guide.length} onFocus={() => onHighlight?.(guide.id)} onBlur={() => onHighlight?.(null)} onClick={() => onHighlight?.(guide.id)}>{String.fromCharCode(65 + index)}. {guide.name}</button></td>
        <td className="px-2 py-1 tabular-nums"><span className="block min-w-12 rounded border border-white/20 bg-[#1b1b1d] px-2 py-1.5 text-center">{guide.millimetres === null ? '—' : (guide.millimetres / (unit === 'cm' ? 10 : 1)).toFixed(1)}</span></td>
        <td className="px-2 py-2 text-white/60">{guide.millimetres === null ? 'relative' : unit}</td>
        <td className="px-2 py-2 text-[10px] text-white/50">{statuses[guide.status]}</td>
      </tr>)}</tbody></table></div>
    {guides.some(guide => guide.length) && <fieldset className="space-y-2 rounded border border-white/15 p-3"><legend className="px-1">Optional scale calibration</legend>
      <p className="text-white/60">Enter one known dimension for this view to estimate the others proportionally. Separate photos need their own scale.</p>
      <label className="block">Known measurement<select aria-label="Known measurement" className={`${inputClass} mt-1`} value={referenceId} onChange={event => {
        setReference(event.target.value); updateCalibration(undefined, event.target.value);
      }}>{guides.filter(guide => guide.length).map(guide => <option key={guide.id} value={guide.id}>{guide.name}</option>)}</select></label>
      <div className="flex gap-2"><label className="min-w-0 flex-1">Known length<input aria-label="Known length" className={`${inputClass} mt-1`} type="number" min="0.1" step="0.1"
        value={activeCalibration ? activeCalibration.millimetres / (unit === 'cm' ? 10 : 1) : ''}
        onChange={event => updateCalibration(Number(event.target.value) * (unit === 'cm' ? 10 : 1))}/></label>
        <label>Unit<select aria-label="Measurement unit" className={`${inputClass} mt-1`} value={unit} onChange={event => setUnit(event.target.value as 'cm' | 'mm')}><option value="cm">cm</option><option value="mm">mm</option></select></label></div>
    </fieldset>}
  </section>;
}

export function ImportedMeasurementOverlay({ value, view = 'front', highlightedId }: { value: ImportedGarment; view?: 'front' | 'back'; highlightedId: string | null }) {
  const guides = importedMeasurementGuides(value, view).filter(guide => guide.length > 0);
  const markerId = `measurement-arrow-${useId().replace(/:/g, '')}`;
  const outline = [...value.parts.filter(part => part.view === view && part.structural).flatMap(part => part.outline ?? []), ...guides.flatMap(guide => guide.points)];
  const xs = outline.map(point => point[0] * 2048), ys = outline.map(point => point[1] * 2048);
  const bounds = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  const centreX = (bounds.left + bounds.right) / 2;
  const labels = guides.map(guide => {
    const start = guide.points[0].map(number => number * 2048), end = guide.points.at(-1)!.map(number => number * 2048);
    const middle = guide.points.length > 2 ? guide.points[Math.floor(guide.points.length / 2)].map(number => number * 2048) : [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
    const horizontal = Math.abs(end[0] - start[0]) > Math.abs(end[1] - start[1]);
    const side = horizontal && middle[1] < bounds.top + (bounds.bottom - bounds.top) * .18 ? 'top'
      : horizontal && middle[1] > bounds.bottom - (bounds.bottom - bounds.top) * .12 ? 'bottom'
      : !horizontal && middle[0] <= centreX ? 'left' : 'right';
    const width = Math.max(210, Math.min(320, guide.name.length * 14 + 30));
    return { id: guide.id, middle, side, width, x: middle[0] - width / 2, y: middle[1] };
  });
  for (const side of ['left', 'right', 'top', 'bottom']) {
    const entries = labels.filter(label => label.side === side).sort((a, b) => a.middle[1] - b.middle[1]);
    let previousY = 0;
    entries.forEach((label, index) => {
      if (side === 'top' || side === 'bottom') label.y = side === 'top' ? bounds.top - 40 - (entries.length - index - 1) * 58 : bounds.bottom + 40 + index * 58;
      else { label.x = side === 'left' ? bounds.left - label.width - 35 : bounds.right + 35; label.y = Math.max(label.middle[1], previousY + 58); }
      label.x = Math.max(16, Math.min(2032 - label.width, label.x));
      label.y = Math.max(28, Math.min(2020 - (entries.length - index - 1) * 58, label.y));
      previousY = label.y;
    });
  }
  return <svg className="pointer-events-none absolute inset-0 z-[240] h-full w-full overflow-visible" viewBox="0 0 2048 2048" aria-label="Garment measurement guides">
    <defs><marker id={markerId} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="#FF3B30" strokeWidth="1.2"/></marker></defs>
    {guides.map(guide => { const active = guide.id === highlightedId; const label = labels.find(entry => entry.id === guide.id)!; return <g key={guide.id} data-measurement-guide={guide.id} data-highlighted={active} opacity={active || !highlightedId ? .92 : .22}>
      <title>{guide.name}: {guide.method}</title>
      <polyline points={guide.points.map(([horizontal, vertical]) => `${horizontal * 2048},${vertical * 2048}`).join(' ')} fill="none" stroke="#FF3B30" strokeWidth={active ? 2 : 1} vectorEffect="non-scaling-stroke" markerStart={`url(#${markerId})`} markerEnd={`url(#${markerId})`}/>
      <line x1={label.middle[0]} y1={label.middle[1]} x2={label.x + label.width / 2} y2={label.y} stroke="#FF3B30" strokeWidth=".6" vectorEffect="non-scaling-stroke" opacity=".55"/>
      {[guide.points[0], guide.points.at(-1)!].map(([horizontal, vertical], index) => <circle key={index} cx={horizontal * 2048} cy={vertical * 2048} r={active ? 7 : 4} fill="white" stroke="#FF3B30" strokeWidth="2"/>)}
      <rect x={label.x} y={label.y - 24} width={label.width} height="48" rx="5" fill="#171719" stroke="#FF3B30" strokeOpacity={active ? .9 : .3} strokeWidth="2"/>
      <text x={label.x + label.width / 2} y={label.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize="25" fontWeight="500" fill="white">{guide.name}</text>
    </g>; })}
  </svg>;
}

function ImportedGroupedControls({ value, onChange, selectedId, onSelect, colors, onColor, step, garmentView }: { value: ImportedGarment; onChange: (value: ImportedGarment) => void; selectedId: string | null; onSelect: (id: string | null) => void;
  colors?: Partial<Record<string, string>>; onColor: (id: string, color: string, scope: 'group') => void; step?: number; garmentView?: 'front' | 'back' }) {
  const groups = importedControlGroups(value)
    .map(group => ({ ...group, parts: group.parts.filter(part => !garmentView || part.view === garmentView), details: group.details.filter(detail => !garmentView || detail.view === garmentView) }))
    .filter(group => (group.parts.length || group.details.length) && (step === undefined || (step === 2 ? group.parts.some(part => part.colorable) : importedBuilderCategories[group.category].step === step)));
  return <div aria-label="Grouped construction controls" className="space-y-4 text-xs">{Object.entries(importedBuilderCategories).map(([category, definition]) => {
    const entries = groups.filter(group => group.category === category);
    return entries.length > 0 && <section key={category}><h4 className="mb-2 font-semibold">{definition.title}</h4>{entries.map(group => <div key={group.id} className={`flex min-h-10 items-center justify-between gap-2 border-b border-white/10 ${group.parts.some(part => part.id === selectedId) ? 'bg-white/10' : ''}`}>
      <button className="min-w-0 flex-1 break-words py-2 text-left" aria-pressed={[...group.parts, ...group.details].some(part => part.id === selectedId)} onClick={() => onSelect(group.parts[0]?.id ?? group.details[0].id)}>{group.name}</button>
      {group.parts.find(part => part.colorable) && <input className="h-7 w-8 shrink-0 bg-transparent" type="color" aria-label={`${group.name} colour`} title={`${group.name} colour`} value={colors?.[group.parts.find(part => part.colorable)!.id] ?? group.parts.find(part => part.colorable)!.color} onChange={event => onColor(group.parts.find(part => part.colorable)!.id, event.target.value, 'group')}/>}
      {!group.parts.length && <input type="checkbox" aria-label={`${group.name} visible`} checked={!value.hiddenDetailGroups?.includes(group.id)} onChange={event => onChange({ ...value, hiddenDetailGroups: event.target.checked ? value.hiddenDetailGroups?.filter(id => id !== group.id) : [...(value.hiddenDetailGroups ?? []), group.id] })}/>}
    </div>)}</section>;
  })}</div>;
}

function ImportedRegionReview({ value, open, onOpenChange, onChange, selectedId, onSelect, colors, onColor }: { value: ImportedGarment; open: boolean; onOpenChange: (open: boolean) => void;
  onChange: (value: ImportedGarment) => void; selectedId: string | null; onSelect: (id: string | null) => void;
  colors?: Partial<Record<string, string>>; onColor: (id: string, color: string, scope: 'group') => void }) {
  const [view, setView] = useState('source');
  const [garmentView, setGarmentView] = useState<'front' | 'back'>(value.manifest.view);
  const [mode, setMode] = useState<'select' | 'split'>('select');
  const [points, setPoints] = useState<Point[]>([]);
  const [other, setOther] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [seamEvidence, setSeamEvidence] = useState('');
  const valid = canAcceptImportedConstruction(value);
  const source = useRef(value); source.current = value;
  const selected = value.parts.find(part => part.id === selectedId);
  const inferred = garmentView === 'back' && value.manifest.backView?.inference;
  const patchPart = (patch: Partial<ImportedPart>) => onChange(reviseImportedGarment(value, value.parts.map(part => part.id === selectedId ? { ...part, ...patch } : part)));
  const geometryEdit = async (action: () => Promise<ImportedGarment>) => {
    const before = value; setWorking(true); setError('');
    try { const updated = await action(); if (source.current !== before) throw new Error('The garment changed during this edit. Retry.'); onChange(updated); setPoints([]); setMode('select'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Geometry edit failed.'); }
    finally { setWorking(false); }
  };
  const move = (direction: number) => {
    const parts = [...value.parts].sort((first, second) => first.layerOrder - second.layerOrder);
    const index = parts.findIndex(part => part.id === selectedId), target = index + direction;
    if (target < 0 || target >= parts.length) return;
    [parts[index], parts[target]] = [parts[target], parts[index]];
    onChange(reviseImportedGarment(value, parts.map((part, order) => ({ ...part, layerOrder: order }))));
  };
  const symmetry = (partner: string) => {
    if (!selected) return;
    onChange(reviseImportedGarment(value, value.parts.map(part => ({ ...part, symmetryPartner: part.id === selected.id ? partner || null : part.id === partner ? selected.id :
      part.symmetryPartner === selected.id || part.symmetryPartner === partner ? null : part.symmetryPartner }))));
  };
  const coordinate = (event: React.PointerEvent<SVGElement>): Point => {
    const svg = event.currentTarget instanceof SVGSVGElement ? event.currentTarget : event.currentTarget.ownerSVGElement!;
    const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return [Math.max(0, Math.min(2048, position.x)), Math.max(0, Math.min(2048, position.y))];
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="flex h-[92dvh] w-[96vw] max-w-[1250px] flex-col overflow-hidden border-white/20 bg-[#161618] p-4 text-white sm:max-w-[1250px]">
    <DialogTitle>{value.manifest.garmentType} · construction review</DialogTitle>
    {inferred && <p className="text-xs text-amber-200">{inferred.notice}</p>}
    {inferred && selected?.view === 'back' && selected.outline && view === 'regions' && <details className="max-h-40 overflow-auto text-xs"><summary>Edit estimated outline vertices (relative 0–1)</summary><p>Changes remain inferred, not source-confirmed. Select a region, then adjust its vertices.</p>
      {selected.outline.map((point, index) => <div className="flex gap-2" key={index}><span>{index + 1}</span>{([0, 1] as const).map(axis => <input key={axis} aria-label={`Estimated vertex ${index + 1} ${axis === 0 ? 'x' : 'y'}`} className={inputClass} type="number" min="0" max="1" step="0.005" value={point[axis]} onChange={event => {
        if (!event.target.value) return;
        const outline = selected.outline!.map(p => [...p] as Point); outline[index][axis] = Number(event.target.value);
        try { onChange(editEstimatedBackOutline(value, selected.id, outline)); setError(''); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Invalid outline.'); }
      }}/>)}</div>)}
    </details>}
    <div className="flex gap-2">{(['front', 'back'] as const).map(side => <button key={side} className={`${buttonClass} capitalize`} aria-pressed={garmentView === side} disabled={!value.parts.some(part => part.view === side)} onClick={() => { setGarmentView(side); onSelect(null); setPoints([]); setMode('select'); }}>{side}</button>)}</div>
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col"><div className="mb-2 flex flex-wrap gap-2" role="tablist" aria-label="Import review stages">{['source', 'interpretation', 'boundaries', 'regions', 'controls'].map((tab, index) => <button role="tab" aria-selected={view === tab} className={`${buttonClass} capitalize ${view === tab ? 'bg-white/15' : ''}`} key={tab} onClick={() => { setView(tab); setMode('select'); setPoints([]); }}>{index + 1}. {tab}</button>)}</div>
        <div className="relative min-h-[220px] flex-1 overflow-hidden bg-[#f7f7f7]">
          {inferred && (view === 'source' || view === 'interpretation') ? <p className="p-5 text-sm text-amber-900">{inferred.notice} No back source image exists. Choose Regions to edit the estimated outline.</p> : view === 'source' || view === 'interpretation' || !valid ? <img src={value.sourceImages?.[garmentView] ?? (garmentView === value.manifest.view ? value.sourceImage : '')} alt={`Source ${value.manifest.garmentType} ${garmentView}`} className="absolute inset-0 h-full w-full object-contain"/> :
            <svg viewBox="0 0 2048 2048" className="absolute inset-0 h-full w-full touch-none" aria-label="Construction region review" onPointerDown={event => { if (mode !== 'select') setPoints(previous => [...previous, coordinate(event)]); else onSelect(null); }}>
              {value.parts.filter(part => part.view === garmentView && (view !== 'boundaries' || part.layerKind === 'structural')).map(part => <g key={part.id} data-review-part={part.id} onPointerEnter={() => setHovered(part.id)} onPointerLeave={() => setHovered(null)} onPointerDown={event => { if (mode === 'select') { event.stopPropagation(); onSelect(part.id); } }} style={{ cursor: mode === 'select' ? 'pointer' : 'crosshair' }}>
                <g dangerouslySetInnerHTML={{ __html: tintPotraceSvg(part.svg, part.id === selectedId || part.id === hovered ? '#f1c985' : view === 'boundaries' ? '#ffffff' : '#e7e9e8') }}/>
                <g pointerEvents="none" dangerouslySetInnerHTML={{ __html: part.constructionSvg }}/>
                {view !== 'boundaries' && <g pointerEvents="none" dangerouslySetInnerHTML={{ __html: tintPotraceSvg(part.stitchSvg, '#8b7856') }}/>}
                {(showAll || view === 'boundaries') && part.layerKind === 'structural' && part.outline && <polygon points={part.outline.map(point => point.map(number => number * 2048).join(',')).join(' ')} fill="none" stroke="#177b70" strokeWidth="3" pointerEvents="none"/>}
              </g>)}
              {view !== 'boundaries' && value.detailLayers?.filter(detail => detail.view === garmentView && !value.hiddenDetailGroups?.includes(`${detail.builderCategory}:${detail.userFacingName}`)).map(detail => <g key={detail.id} data-review-detail={detail.id} pointerEvents="none">
                <g dangerouslySetInnerHTML={{ __html: tintPotraceSvg(detail.constructionSvg, selectedId === detail.id ? '#bc7617' : '#141414') }}/>
                <g dangerouslySetInnerHTML={{ __html: tintPotraceSvg(detail.stitchSvg, '#8b7856') }}/>
              </g>)}
              {(view === 'boundaries' || showAll) && value.proposedBoundaries?.filter(part => part.layerKind === 'structural').map(part => <polygon key={part.id} points={part.outline?.map(point => point.map(number => number * 2048).join(',')).join(' ')} fill="none" stroke="#bc7617" strokeWidth="5" strokeDasharray="14 10"><title>{part.name}: {part.boundary?.evidence}</title></polygon>)}
              {points.length > 0 && <polygon points={points.map(point => point.join(',')).join(' ')} fill="#e5534a33" stroke="#ce3027" strokeWidth="4" pointerEvents="none"/>}
              {points.map((point, index) => <circle key={index} cx={point[0]} cy={point[1]} r="12" fill="#ce3027" stroke="white" strokeWidth="3" onPointerDown={event => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) { const next = coordinate(event); setPoints(previous => previous.map((entry, position) => position === index ? next : entry)); } }}/>) }
            </svg>}
        </div>
        {valid && <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={showAll} onChange={event => setShowAll(event.target.checked)}/>Show all construction regions</label>}
        {valid && view === 'regions' && <div className="mt-2 flex flex-wrap gap-2"><button title="Select construction piece" className={buttonClass} onClick={() => { setMode('select'); setPoints([]); }}><Shapes size={14}/></button><button title="Split along a source-confirmed seam" className={buttonClass} disabled={!selected || selected.layerKind !== 'structural'} onClick={() => { setMode('split'); setPoints([]); setSeamEvidence(''); }}><Scissors size={14}/></button>{mode === 'split' && <><input aria-label="Source seam evidence" placeholder="Source seam evidence" className={inputClass} value={seamEvidence} onChange={event => setSeamEvidence(event.target.value)}/><button className={buttonClass} disabled={working || points.length < 3 || !selected || !seamEvidence.trim()} onClick={() => void geometryEdit(() => splitImportedPart(value, selected!.id, points, { boundaryType: 'seam', confidence: 1, evidence: seamEvidence.trim() }))}><Check size={14}/>Apply seam split</button><button className={buttonClass} title="Undo vertex" onClick={() => setPoints(previous => previous.slice(0, -1))}><RotateCcw size={14}/></button></>}</div>}
      </div>
      <div className="max-h-[35dvh] w-full shrink-0 space-y-3 overflow-y-auto text-xs md:max-h-none md:w-72">
        {!valid && <p role="alert" className="text-amber-300">Unverified legacy segmentation. No construction regions or grouped controls are approved. Upload the source again to run construction analysis.</p>}
        {(view === 'source' || view === 'interpretation') && <><h3 className="font-semibold">{value.manifest.subtype}</h3><p>{value.sourceManifest.construction}</p><p className="text-white/60">{value.sourceManifest.materialEvidence}</p>{valid && value.sourceManifest.regions.map(part => <div className="border-b border-white/15 pb-2" key={part.id}><h4>{part.name} · {part.layerKind}</h4><p className="text-white/60">{part.boundary?.evidence}</p><span>{Math.round((part.boundary?.confidence ?? 0) * 100)}% confidence</span></div>)}</>}
        {view === 'controls' && valid && <ImportedGroupedControls value={value} garmentView={garmentView} onChange={onChange} selectedId={selectedId} onSelect={onSelect} colors={colors} onColor={onColor}/>}
        {view === 'boundaries' && valid && <><h3 className="font-semibold">Source-supported boundaries</h3>{value.manifest.regions.filter(part => part.layerKind === 'structural').map(part => <div className="border-b border-white/15 pb-2" key={part.id}><strong>{part.name}</strong><p>{part.boundary?.boundaryType} · {Math.round((part.boundary?.confidence ?? 0) * 100)}%</p><p className="text-white/60">{part.boundary?.evidence}</p>{(part.boundary?.confidence ?? 0) < .8 && <div className="flex items-center justify-between text-amber-300"><span>Uncommitted proposal</span><button className={buttonClass} title={`Delete proposal for ${part.name}`} onClick={() => onChange({ ...value, proposedBoundaries: value.proposedBoundaries?.filter(proposal => proposal.id !== part.id), manifest: { ...value.manifest, regions: value.manifest.regions.filter(region => region.id !== part.id) }, reviewed: false, accepted: false })}><Trash2 size={14}/></button></div>}</div>)}</>}
        {view === 'regions' && valid && <label className="block">Construction piece<select className={inputClass} value={selectedId ?? ''} onChange={event => onSelect(event.target.value || null)}><option value="">Select a piece</option>{value.parts.filter(part => part.view === garmentView).map(part => <option key={part.id} value={part.id}>{part.name}</option>)}</select></label>}
        {selected && valid && view === 'regions' && <><label className="block">Name<input className={inputClass} value={selected.name} onChange={event => patchPart({ name: event.target.value })}/></label><label className="block">Semantic type<select className={inputClass} value={selected.semanticType} onChange={event => { const semanticType = event.target.value as ImportedPart['semanticType']; const structural = !['button', 'rivet', 'zip', 'label', 'decoration'].includes(semanticType); patchPart({ semanticType, structural, layerKind: structural ? 'structural' : 'detail' }); }}>{importedRegionTypes.map(type => <option key={type}>{type}</option>)}</select></label><label className="block">Builder category<select className={inputClass} value={selected.builderCategory} onChange={event => patchPart({ builderCategory: event.target.value as ImportedPart['builderCategory'] })}>{Object.entries(importedBuilderCategories).map(([key, category]) => <option key={key} value={key}>{category.title}</option>)}</select></label><label className="block">Control name<input className={inputClass} value={selected.userFacingName ?? ''} onChange={event => patchPart({ userFacingName: event.target.value })}/></label><button className={buttonClass} disabled={selected.editableIndependently} onClick={() => patchPart({ editableIndependently: true, colourGroup: selected.id })}><Unlink size={14}/>Unlink piece colour</button>
          <label className="block">Symmetry partner<select className={inputClass} value={selected.symmetryPartner ?? ''} onChange={event => symmetry(event.target.value)}><option value="">Independent</option>{value.parts.filter(part => part.id !== selected.id).map(part => <option value={part.id} key={part.id}>{part.name}</option>)}</select></label>
          <div className="flex gap-2"><button className={buttonClass} title="Move behind" onClick={() => move(-1)}><ArrowDown size={14}/></button><button className={buttonClass} title="Move forward" onClick={() => move(1)}><ArrowUp size={14}/></button></div>
          <div className="flex gap-2"><select aria-label="Merge target" className={inputClass} value={other} onChange={event => setOther(event.target.value)}><option value="">Merge with...</option>{value.parts.filter(part => part.id !== selected.id && part.view === selected.view && part.layerKind === selected.layerKind).map(part => <option value={part.id} key={part.id}>{part.name}</option>)}</select><button className={buttonClass} title="Merge pieces and delete internal boundary" disabled={!other || working} onClick={() => void geometryEdit(() => mergeImportedParts(value, selected.id, other))}><Merge size={14}/></button></div>
          <p className="text-white/60">{selected.evidence}</p></>}
        {error && <p role="alert" className="text-red-300">{error}</p>}
        <details open><summary className="font-semibold text-amber-300">Review findings ({value.reviewNotes.length})</summary><ul className="mt-2 space-y-2 text-white/70">{value.reviewNotes.map((note, index) => <li key={index}>{note}</li>)}</ul></details>
        <details><summary>Technical redraw and provenance</summary><img src={value.cleanDrawing} alt="Unverified AI technical redraw" className="mt-2 w-full bg-white"/><dl className="mt-2 space-y-2 break-all text-[10px] text-white/60">{Object.entries(value.provenance).map(([key, entry]) => <div key={key}><dt>{key}</dt><dd>{entry}</dd></div>)}</dl></details>
        <label className="flex gap-2"><input type="checkbox" disabled={!valid} checked={value.reviewed ?? false} onChange={event => onChange({ ...value, reviewed: event.target.checked, accepted: false })}/><span>I compared the source, construction boundaries and grouped controls.</span></label>
        <button className={`${buttonClass} w-full bg-[#a92924]`} disabled={!valid || !value.reviewed || working} onClick={() => { onChange({ ...value, accepted: true }); onOpenChange(false); }}><Check size={14}/>Accept imported garment</button>
      </div>
    </div>
  </DialogContent></Dialog>;
}