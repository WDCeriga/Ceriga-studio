import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { DesignElement } from '../PrintsDesignStep';
import type { SavedUpload } from './designLibrary';
import { PATTERN_CATALOG, patternDefinition } from '../../../lib/patternCatalog';
import { changePatternType, customPatternSettings, initialPatternSettings, isSelectedPattern, selectedPatternKind, type CustomPatternSource, type PatternPatch } from '../../../lib/patternEditing';
import { PatternGraphic } from './PatternGraphic';
import { PatternControls } from './PatternControls';
import { useAssetWorkspaceContext } from './AssetWorkspace';
import { STUDIO_DRAG_MIME, encodeStudioDrag } from './studioAssets';

export type PatternLayerSource = { id: string; name: string };

function sourceFromImage(src: string, name: string): Promise<CustomPatternSource> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ src, name, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('This image could not be loaded. Choose a different file.'));
    image.src = src;
  });
}

export function PatternLibraryPanel({ color, selected, onChange, onPlace, uploads, layers, onCaptureLayer }: {
  color: string; selected: DesignElement | null; onChange: (patch: PatternPatch) => void;
  onPlace: (id: string, settings: PatternPatch) => void; uploads: SavedUpload[];
  layers: PatternLayerSource[]; onCaptureLayer?: (id: string) => Promise<CustomPatternSource>;
}) {
  const workspace = useAssetWorkspaceContext();
  const [customOpen, setCustomOpen] = useState(false);
  const [source, setSource] = useState<CustomPatternSource | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  const kind = selectedPatternKind(selected);
  const patterned = isSelectedPattern(selected);
  const custom = kind === 'custom';
  const locked = Boolean(selected?.locked);
  const load = async (getSource: () => Promise<CustomPatternSource>) => {
    const token = ++request.current;
    setBusy(true); setError(''); setSource(null);
    try { const result = await getSource(); if (token === request.current) setSource(result); }
    catch (cause) { if (token === request.current) setError(cause instanceof Error ? cause.message : 'The source could not be loaded.'); }
    finally { if (token === request.current) setBusy(false); }
  };
  const drag = (event: DragEvent, id: string, settings: PatternPatch) => {
    if (id === 'custom' && !settings.patternSource) { event.preventDefault(); return; }
    const payload = encodeStudioDrag('pattern', id, settings);
    event.dataTransfer.setData(STUDIO_DRAG_MIME, payload);
    event.dataTransfer.setData('text/plain', payload);
    event.dataTransfer.setData('application/x-ceriga-pattern', id);
    event.dataTransfer.effectAllowed = 'copy';
  };
  const create = () => {
    if (!source || locked) return;
    const settings = customPatternSettings(source);
    if (selected && (patterned || selected.type === 'customArea')) onChange({ ...changePatternType(selected, 'custom'), ...settings });
    else onPlace('custom', { ...initialPatternSettings('custom', color), ...settings });
  };
  const buttonClass = 'rounded-lg border border-white/15 bg-black/20 px-2 py-2 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-40';
  return <div className="space-y-4" data-pattern-library>
    <p className="text-[10px] leading-relaxed text-white/50">Choose a style or drag its preview onto a garment part or closed Custom Area. Select a pattern to edit it.</p>
    <details open className="space-y-3"><summary className="cursor-pointer text-xs font-semibold text-white/80">Pattern styles</summary>
    {PATTERN_CATALOG.filter(item => item.id !== 'custom').reduce<string[]>((categories, item) => categories.includes(item.category) ? categories : [...categories, item.category], []).map(category =>
      <section key={category} className="space-y-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-white/55">{category}</h4>
        <div className="grid grid-cols-3 gap-1.5">
          {PATTERN_CATALOG.filter(item => item.category === category && item.id !== 'custom').map(item => {
            const settings = initialPatternSettings(item.id, color);
            const preview = { ...settings, id: `preview-${item.id}`, type: 'pattern', content: item.id, x: 0, y: 0, width: 96, height: 72, rotation: 0, patternSeed: 1729 } as DesignElement;
            return <button key={item.id} type="button" draggable={!locked} disabled={locked} aria-label={item.label} data-pattern-card={item.id} aria-pressed={kind === item.id}
              onDragStart={event => drag(event, item.id, kind === item.id && selected ? selected : { ...settings, patternSeed: 1729 })}
              onClick={() => { setCustomOpen(false); if (selected && (patterned || selected.type === 'customArea')) onChange(changePatternType(selected, item.id)); else onPlace(item.id, settings); }}
              className={`overflow-hidden rounded-lg border text-[9px] leading-tight text-white/75 ${kind === item.id ? 'border-[#FF3B30] bg-[#FF3B30]/15' : 'border-white/10 bg-black/25 hover:border-white/35'} disabled:opacity-40`}>
              <div className="h-14 w-full bg-[#343437] p-1"><PatternGraphic element={preview} /></div>
              <span className="flex min-h-8 items-center justify-center px-1 py-1">{item.label}</span>
            </button>;
          })}
        </div>
      </section>)}
    </details>
    <button type="button" className={`${buttonClass} w-full`} aria-expanded={customOpen || custom} onClick={() => setCustomOpen(value => !value)}>Custom Pattern</button>
    {(customOpen || custom) && <section className="space-y-3 rounded-lg border border-white/15 p-3" aria-label="Custom Pattern source">
      <p className="text-[10px] text-white/55">Choose an image, saved asset (including Asset Builder), or design layer. The original stays unchanged; the repeat uses an editable source snapshot.</p>
      <label className={`${buttonClass} block cursor-pointer text-center`}>Upload pattern image
        <input type="file" accept="image/*" aria-label="Upload pattern image" className="sr-only" disabled={busy || locked} onChange={event => {
          const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
          void load(async () => {
            if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
            const src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('The file could not be read.')); reader.readAsDataURL(file); });
            return sourceFromImage(src, file.name);
          });
        }} />
      </label>
      <label className="block space-y-1 text-[10px] text-white/65">Uploaded images
        <select aria-label="Pattern uploaded image" value="" disabled={busy || locked || !uploads.length} className={`${buttonClass} w-full bg-[#171719]`} onChange={event => { const item = uploads.find(upload => upload.id === event.target.value); if (item) void load(() => sourceFromImage(item.dataUrl, item.name)); }}>
          <option value="">Select uploaded image</option>{uploads.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="block space-y-1 text-[10px] text-white/65">My Assets / Asset Builder
        <select aria-label="Pattern saved asset" value="" disabled={busy || locked || !workspace?.library.length} className={`${buttonClass} w-full bg-[#171719]`} onChange={event => { const item = workspace?.library.find(asset => asset.id === event.target.value); if (item) void load(() => sourceFromImage(item.preview, item.name)); }}>
          <option value="">Select saved asset</option>{workspace?.library.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="block space-y-1 text-[10px] text-white/65">Design layer
        <select aria-label="Pattern design layer" value="" disabled={busy || locked || !layers.length || !onCaptureLayer} className={`${buttonClass} w-full bg-[#171719]`} onChange={event => { if (onCaptureLayer && event.target.value) { const id = event.target.value; void load(() => onCaptureLayer(id)); } }}>
          <option value="">Select graphic layer</option>{layers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      {busy && <p role="status" className="text-xs text-white/65">Preparing source…</p>}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      {(source || selected?.patternSource) && <div className="flex items-center gap-2 text-[10px] text-white/65">
        <img src={source?.src ?? selected?.patternSource} className="h-12 w-12 rounded bg-white/10 object-contain" alt="Pattern source" />
        <span className="break-all">{source?.name ?? selected?.patternSourceName ?? 'Custom image'}</span>
      </div>}
      <button type="button" disabled={!source || busy || locked} onClick={create} className={`${buttonClass} w-full`}>{custom ? 'Replace pattern source' : 'Create Pattern'}</button>
    </section>}
    {patterned && selected && <section className="space-y-3 border-t border-white/15 pt-3">
      <h4 className="text-[10px] font-semibold uppercase text-white/65">Selected pattern</h4>
      <div draggable={!selected.locked && (!custom || !!selected.patternSource)} onDragStart={event => drag(event, kind!, selected)}
        data-configured-pattern={kind} role="img" aria-label={`Drag configured ${patternDefinition(kind!)?.label ?? kind} pattern`} className="h-24 cursor-grab overflow-hidden rounded-lg border border-white/15 bg-[#343437]">
        <PatternGraphic element={selected} />
      </div>
      <p className="text-[10px] text-white/45">Drag this preview to copy all settings onto another part.</p>
      <PatternControls element={selected} onChange={patch => { if (!selected.locked) onChange(patch); }} />
      <button type="button" disabled={selected.locked || (custom && !selected.patternSource)} className={`${buttonClass} w-full`} onClick={() => onPlace(kind!, selected)}>Add another pattern layer</button>
    </section>}
  </div>;
}
