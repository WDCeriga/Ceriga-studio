import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { DesignElement } from '../PrintStudioEditor';
import { MaterialSelect } from '../shell/MaterialSelect';
import { StudioRange } from '../shell/StudioControls';
import { nativeArtworkSource } from '../../../lib/nativeArtworkSource';
import { changePatternType, customPatternSettings, initialPatternSettings, isSelectedPattern, type CustomPatternSource, type PatternPatch } from '../../../lib/patternEditing';
import { useAssetWorkspaceContext } from './AssetWorkspace';
import type { SavedUpload } from './designLibrary';
import { CustomRepeatControls } from './PatternBuilders';
import { PatternGraphic } from './PatternGraphic';
import './pattern-builders.css';

const MAX_MOTIFS = 4;
const fromImage = (src: string, name: string) => new Promise<CustomPatternSource>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve({ src, name, width: image.naturalWidth, height: image.naturalHeight });
  image.onerror = () => reject(new Error('This image could not be loaded.'));
  image.src = src;
});
const readFile = (file: File) => new Promise<CustomPatternSource>((resolve, reject) => {
  if (!file.type.startsWith('image/')) { reject(new Error('Choose an image file.')); return; }
  const reader = new FileReader();
  reader.onload = () => fromImage(String(reader.result), file.name).then(resolve, reject);
  reader.onerror = () => reject(new Error('The file could not be read.'));
  reader.readAsDataURL(file);
});

/** Drop in up to four motifs, see the repeat live, then place it. */
export function PatternMaker({ color, selected, onChange, onPlace, uploads, layers, onCaptureLayer }: {
  color: string; selected: DesignElement | null; onChange: (patch: PatternPatch) => void; onPlace: (id: string, settings: PatternPatch) => void;
  uploads: SavedUpload[]; layers: { id: string; name: string }[]; onCaptureLayer?: (id: string) => Promise<CustomPatternSource>;
}) {
  const workspace = useAssetWorkspaceContext(), [motifs, setMotifs] = useState<CustomPatternSource[]>([]), [draft, setDraft] = useState<Partial<DesignElement>>({ patternRepeat: 'half-drop', patternCount: 4, patternMotifScale: 90 }), [busy, setBusy] = useState(false), [error, setError] = useState(''), [over, setOver] = useState(false), token = useRef(0);
  useEffect(() => () => { token.current++; }, []);
  const locked = Boolean(selected?.locked), replacing = Boolean(selected && (isSelectedPattern(selected) || selected.type === 'customArea'));
  const add = async (work: () => Promise<CustomPatternSource[]>) => {
    const run = ++token.current; setBusy(true); setError('');
    try { const found = await work(); if (run === token.current) setMotifs(current => [...current, ...found].slice(0, MAX_MOTIFS)); }
    catch (cause) { if (run === token.current) setError(cause instanceof Error ? cause.message : 'That source could not be loaded.'); }
    finally { if (run === token.current) setBusy(false); }
  };
  const addFiles = (files: FileList | File[]) => { const list = Array.from(files).slice(0, MAX_MOTIFS - motifs.length); if (list.length) void add(() => Promise.all(list.map(readFile))); };
  const settings = useMemo<PatternPatch>(() => motifs.length ? { ...customPatternSettings(motifs[0]), patternExtraSources: motifs.slice(1), ...draft } : draft, [motifs, draft]);
  const preview = useMemo(() => ({ ...initialPatternSettings('custom', color), ...settings, id: 'pattern-maker-preview', type: 'pattern', content: 'custom', x: 130, y: 75, width: 260, height: 150, rotation: 0, patternReferenceSize: 150, patternSeed: 1729 }) as DesignElement, [settings, color]);
  const create = () => { if (!motifs.length || locked) return; if (selected && replacing) onChange({ ...changePatternType(selected, 'custom'), ...settings }); else onPlace('custom', { ...initialPatternSettings('custom', color), ...settings }); };
  const full = motifs.length >= MAX_MOTIFS;
  return <section className="cx-maker" aria-label="Pattern maker">
    <label className="cx-maker__drop" data-over={over || undefined} data-disabled={full || locked || undefined} onDragOver={(event: DragEvent) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(event: DragEvent) => { event.preventDefault(); setOver(false); if (!full && !locked) addFiles(event.dataTransfer.files); }}>
      <ImagePlus size={18} /><span>{full ? 'Four motifs added' : 'Drop or upload motifs'}</span>
      <input type="file" multiple accept="image/*" aria-label="Upload pattern image" className="sr-only" disabled={busy || locked || full} onChange={event => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }} />
    </label>
    {uploads.length > 0 && !full && <div className="cx-maker__uploads" role="group" aria-label="Your uploads">{uploads.slice(0, 12).map(item => <button key={item.id} type="button" aria-label={`Use ${item.name}`} title={item.name} disabled={busy || locked} onClick={() => void add(async () => [await fromImage(item.dataUrl, item.name)])}><img src={item.dataUrl} alt="" /></button>)}</div>}
    {(layers.length > 0 || Boolean(workspace?.library.length)) && !full && <MaterialSelect aria-label="Use a layer or saved asset" value="" disabled={busy || locked} onChange={event => {
      const [kind, id] = event.target.value.split(':');
      if (kind === 'layer' && onCaptureLayer) void add(async () => [await onCaptureLayer(id)]);
      if (kind === 'asset') { const asset = workspace?.library.find(item => item.id === id); if (asset) void add(async () => [await nativeArtworkSource(asset.elements, asset.name)]); }
    }}><option value="">Use a layer or saved asset</option>{layers.map(item => <option key={item.id} value={`layer:${item.id}`}>{item.name}</option>)}{workspace?.library.map(item => <option key={item.id} value={`asset:${item.id}`}>{item.name}</option>)}</MaterialSelect>}
    {busy && <p role="status">Preparing…</p>}
    {error && <p role="alert">{error}</p>}
    {motifs.length > 0 && <>
      <div className="cx-maker__motifs" role="group" aria-label="Motifs">{motifs.map((motif, index) => <div key={motif.src.slice(-32) + index}><img src={motif.src} alt={motif.name} /><button type="button" aria-label={`Remove motif ${index + 1}`} onClick={() => setMotifs(current => current.filter((_, i) => i !== index))}><Trash2 size={12} /></button></div>)}</div>
      <div className="cx-maker__preview" role="img" aria-label="Live repeat preview"><PatternGraphic element={preview} /></div>
      <CustomRepeatControls element={preview} onChange={patch => setDraft(current => ({ ...current, ...patch }))} />
      <StudioRange label="Repeats" min={1} max={16} unit="" value={draft.patternCount ?? 4} onChange={patternCount => setDraft(current => ({ ...current, patternCount }))} />
      <StudioRange label="Gap" min={0} max={80} unit="" value={draft.patternSpacing ?? 0} onChange={patternSpacing => setDraft(current => ({ ...current, patternSpacing, patternSpacingX: patternSpacing, patternSpacingY: patternSpacing }))} />
      <button type="button" className="cx-maker__create" disabled={busy || locked} onClick={create}>{replacing ? 'Apply to selection' : 'Create pattern'}</button>
    </>}
  </section>;
}
