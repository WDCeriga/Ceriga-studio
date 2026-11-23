import {nativeArtworkSource} from '../../../lib/nativeArtworkSource';
import {MaterialSelect} from '../shell/MaterialSelect';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { DesignElement } from '../PrintStudioEditor';
import type { SavedUpload } from './designLibrary';
import { PATTERN_CATALOG, patternDefinition } from '../../../lib/patternCatalog';
import { changePatternType, customPatternSettings, initialPatternSettings, isSelectedPattern, selectedPatternKind, type CustomPatternSource, type PatternPatch } from '../../../lib/patternEditing';
import { PatternGraphic } from './PatternGraphic';
import { LazyPatternPreview } from './LazyPatternPreview';
import { GarmentOnly } from './AssetWorkspace';
import { PatternControls } from './PatternControls';
import { PatternMaker } from './PatternMaker';
import { useAssetWorkspaceContext } from './AssetWorkspace';
import { beginPatternDrag } from './studioAssets';

export type PatternLayerSource = { id: string; name: string };

function sourceFromImage(src: string, name: string): Promise<CustomPatternSource> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ src, name, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('This image could not be loaded. Choose a different file.'));
    image.src = src;
  });
}

export function PatternLibraryPanel({ customOnly = false, color, selected, onChange, onPlace, uploads, layers, onCaptureLayer }: {
  customOnly?: boolean; color: string; selected: DesignElement | null; onChange: (patch: PatternPatch) => void;
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
    beginPatternDrag(event.dataTransfer,id,settings);
  };
  const create = () => {
    if (!source || locked) return;
    const settings = customPatternSettings(source);
    if (selected && (patterned || selected.type === 'customArea')) onChange({ ...changePatternType(selected, 'custom'), ...settings });
    else onPlace('custom', { ...initialPatternSettings('custom', color), ...settings });
  };
  const buttonClass = 'rounded-lg border border-[#e2e2e2] bg-[#fafafa] px-2 py-2 text-[11px] text-[#737373] hover:bg-[#f2f2f2] disabled:opacity-40';
  return <div className="space-y-4" data-pattern-library>
    <p className="text-[10px] leading-relaxed text-[#737373]">Choose a style<GarmentOnly> or drag its preview onto a garment part or closed Custom Area</GarmentOnly>. Select a pattern to edit it.</p>
    {!customOnly&&<details open className="space-y-3"><summary className="cursor-pointer text-xs font-semibold text-[#737373]">Pattern styles</summary>
    {PATTERN_CATALOG.filter(item => item.id !== 'custom' && !item.retired).reduce<string[]>((categories, item) => categories.includes(item.category) ? categories : [...categories, item.category], []).map(category =>
      <section key={category} className="space-y-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">{category}</h4>
        <div className="grid grid-cols-3 gap-1.5">
          {PATTERN_CATALOG.filter(item => item.category === category && item.id !== 'custom' && !item.retired).map(item => {
            const settings = {...initialPatternSettings(item.id, color),patternSeed:1729};
            const preview = { ...settings, id: `preview-${item.id}`, type: 'pattern', content: item.id, x: 0, y: 0, width: 96, height: 72, rotation: 0, patternSeed: 1729 } as DesignElement;
            return <button key={item.id} type="button" draggable={!locked} disabled={locked} aria-label={item.label} data-pattern-card={item.id} aria-pressed={kind === item.id}
              onDragStart={event => drag(event, item.id, kind === item.id && selected ? selected : { ...settings, patternSeed: 1729 })}
              onClick={() => { setCustomOpen(false); if (selected && (patterned || selected.type === 'customArea')) onChange(changePatternType(selected, item.id)); else onPlace(item.id, settings); }}
              className={`overflow-hidden rounded-lg border text-[9px] leading-tight text-[#737373] ${kind === item.id ? 'border-[#262626] bg-[#262626]/15' : 'border-[#e2e2e2] bg-[#fafafa] hover:border-[#e2e2e2]'} disabled:opacity-40`}>
              <div className="h-14 w-full bg-[#262626] p-1"><LazyPatternPreview><PatternGraphic element={preview} /></LazyPatternPreview></div>
              <span className="flex min-h-8 items-center justify-center px-1 py-1">{item.label}</span>
            </button>;
          })}
        </div>
      </section>)}
    </details>}
    {!customOnly && <button type="button" className={`${buttonClass} w-full`} aria-expanded={customOpen || custom} onClick={() => setCustomOpen(value => !value)}>Custom Pattern</button>}
    {(customOnly || customOpen || custom) && <PatternMaker color={color} selected={selected} onChange={onChange} onPlace={onPlace} uploads={uploads} layers={layers} onCaptureLayer={onCaptureLayer} />}
    {patterned && selected && <section className="space-y-3 border-t border-[#e2e2e2] pt-3">
      <h4 className="text-[10px] font-semibold uppercase text-[#737373]">Selected pattern</h4>
      <div draggable={!selected.locked && (!custom || !!selected.patternSource)} onDragStart={event => drag(event, kind!, selected)}
        data-configured-pattern={kind} role="img" aria-label={`Drag configured ${patternDefinition(kind!)?.label ?? kind} pattern`} className="h-24 cursor-grab overflow-hidden rounded-lg border border-[#e2e2e2] bg-[#262626]">
        <PatternGraphic element={selected} />
      </div>
      <p className="text-[10px] text-[#737373]">Drag this preview to copy all settings onto another part.</p>
      <PatternControls element={selected} onChange={patch => { if (!selected.locked) onChange(patch); }} />
      <button type="button" disabled={selected.locked || (custom && !selected.patternSource)} className={`${buttonClass} w-full`} onClick={() => onPlace(kind!, selected)}>Add another pattern layer</button>
    </section>}
  </div>;
}
