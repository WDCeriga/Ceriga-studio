import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react';
import type { DesignElement } from '../PrintsDesignStep';
import { TEXT_EFFECTS, SHAPE_EFFECTS, createTextEffect, createShapeEffect, textEffectControls, shapeEffectControls, type TextEffect, type TextEffectId } from '../../../lib/textEffects';
import { TextEffectPreview } from './TextEffectsArtwork';
import { shapeIsClosed } from '../../../lib/shapeGeometry';

export interface TextEffectsPanelProps {
  element: DesignElement;
  onChange: (updates: Partial<DesignElement>) => void;
  images?: Array<{ name: string; src: string }>;
  target?: 'text' | 'shape';
}

const RANDOM_EFFECTS = new Set<TextEffectId>(['distressed', 'cracked', 'faded', 'glitch']);
const DRAG_TYPE = 'application/x-ceriga-text-effect';
const buttonClass = 'rounded border border-white/15 bg-black/20 p-1.5 text-white/65 hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-30';
const rangeClass = 'mt-1 block w-full accent-[#FF3B30]';
let nextEffectId = 0;

function uniqueId() {
  return globalThis.crypto?.randomUUID?.() ?? `text-effect-${Date.now()}-${++nextEffectId}`;
}

export function TextEffectsPanel({ element, onChange, images = [], target = 'text' }: TextEffectsPanelProps) {
  const closedShape = target === 'shape' && shapeIsClosed(element);
  const catalog = target === 'shape' ? SHAPE_EFFECTS.filter(effect => closedShape || !['texture-fill', 'image-fill'].includes(effect.id)) : TEXT_EFFECTS;
  const createEffect = target === 'shape' ? createShapeEffect : createTextEffect;
  const field = target === 'shape' ? 'shapeEffects' : 'textEffects';
  const previews = useMemo(() => catalog.map(item => ({ ...item, effect: { ...createEffect(item.id), seed: 1 }   })), [target, closedShape]);
  const [selection, setSelection] = useState<{ elementId: string; effectId: string } | null>(null);
  const [sourceError, setSourceError] = useState('');
  const [loadingSource, setLoadingSource] = useState(false);
  const latest = useRef({ element, onChange });
  latest.current = { element, onChange };
  const reader = useRef<FileReader | null>(null);
  const uploadVersion = useRef(0);
  const dragged = useRef<string | null>(null);
  const effects = element[field] ?? [];
  const active = effects.find(effect => selection?.elementId === element.id && effect.id === selection.effectId) ?? effects[0];
  const controls = active ? (target === 'shape' ? shapeEffectControls : textEffectControls)(active.type) : [];
  const locked = !!element.locked;
  const isFill = active?.type === 'texture-fill' || active?.type === 'image-fill';
  const gradientStops = active?.stops && active.stops.length >= 2 ? active.stops : previews.find(item => item.id === 'gradient')?.effect.stops ?? [
    { color: '#FF3B30', position: 0 },
    { color: '#FFFFFF', position: 100 },
  ];

  useEffect(() => {
    setSourceError('');
    setLoadingSource(false);
    dragged.current = null;
    return () => {
      uploadVersion.current += 1;
      reader.current?.abort();
    };
  }, [element.id, active?.id]);

  function changeEffects(update: (current: TextEffect[]) => TextEffect[], patch: Partial<DesignElement> = {}) {
    const current = latest.current;
    if (current.element.locked || current.element.type !== target) return;
    current.onChange({ ...patch, [field]: update(current.element[field] ?? []) });
  }

  function patchEffect(id: string, patch: Partial<TextEffect>) {
    changeEffects(current => current.map(effect => effect.id === id ? { ...effect, ...patch } : effect));
  }

  function updateSetting(key: string, value: string | number) {
    if (!active) return;
    changeEffects(current => current.map(effect => effect.id === active.id ? { ...effect, settings: { ...effect.settings, [key]: value } } : effect));
  }

  function selectEffect(id: string) {
    setSelection({ elementId: element.id, effectId: id });
  }

  function addEffect(type: TextEffectId) {
    const effect = { ...createEffect(type), id: uniqueId() };
    changeEffects(current => [...current, effect], closedShape && ['gradient', 'image-fill', 'texture-fill'].includes(type) ? { shapeFilled: true } : {});
    selectEffect(effect.id);
  }

  function moveEffect(id: string, targetId: string) {
    changeEffects(current => {
      const from = current.findIndex(effect => effect.id === id);
      const to = current.findIndex(effect => effect.id === targetId);
      if (from < 0 || to < 0 || from === to) return current;
      const reordered = [...current];
      reordered.splice(to, 0, ...reordered.splice(from, 1));
      return reordered;
    });
  }

  function duplicateEffect(effect: TextEffect) {
    const duplicate = { ...effect, id: uniqueId(), settings: { ...effect.settings }, stops: effect.stops?.map(stop => ({ ...stop })) };
    changeEffects(current => current.flatMap(item => item.id === effect.id ? [item, duplicate] : [item]));
    selectEffect(duplicate.id);
  }

  function chooseSource(source: string | undefined) {
    uploadVersion.current += 1;
    reader.current?.abort();
    setLoadingSource(false);
    setSourceError('');
    if (active) patchEffect(active.id, { source });
  }

  function uploadSource(file: File | undefined) {
    if (!file || !active || locked) return;
    const version = ++uploadVersion.current;
    reader.current?.abort();
    setSourceError('');
    setLoadingSource(false);
    if (!file.type.startsWith('image/')) {
      setSourceError('Choose a valid image file.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setSourceError('Choose an image smaller than 20 MB.');
      return;
    }
    const elementId = element.id;
    const effectId = active.id;
    const fileReader = new FileReader();
    reader.current = fileReader;
    setLoadingSource(true);
    const isCurrent = () => version === uploadVersion.current && latest.current.element.id === elementId;
    const fail = () => {
      if (!isCurrent()) return;
      setLoadingSource(false);
      setSourceError('This image could not be loaded. Try another file.');
    };
    fileReader.onerror = fail;
    fileReader.onload = () => {
      if (!isCurrent()) return;
      const source = fileReader.result;
      if (typeof source !== 'string') { fail(); return; }
      const image = new Image();
      image.onerror = fail;
      image.onload = () => {
        if (!isCurrent()) return;
        setLoadingSource(false);
        if (!latest.current.element.locked && latest.current.element[field]?.some(effect => effect.id === effectId)) {
          patchEffect(effectId, { source });
        }
      };
      image.src = source;
    };
    try { fileReader.readAsDataURL(file); } catch { fail(); }
  }

  if (element.type !== target) return null;

  return <details className="rounded-xl border border-[#252528] bg-black/20 p-3" data-text-effects-panel={target === 'text' ? true : undefined} data-shape-effects-panel={target === 'shape' ? true : undefined}>
    <summary className="cursor-pointer text-[11px] font-semibold text-white/90">Effects{effects.length ? ` (${effects.length})` : ''}</summary>
    <fieldset disabled={locked} className="mt-3 min-w-0 space-y-3 disabled:opacity-50">
      <legend className="sr-only">{target === 'shape' ? 'Shape effects' : 'Text effects'}</legend>
      <button type="button" aria-pressed={effects.length === 0} onClick={() => { changeEffects(() => []); setSelection(null); }}
        className={`w-full rounded-lg border px-2 py-2 text-[10px] ${effects.length === 0 ? 'border-[#FF3B30] bg-[#FF3B30]/15 text-white' : 'border-white/15 text-white/70 hover:border-white/40'}`}>
        Original / No effects
      </button>
      <div className="grid max-h-80 grid-cols-2 gap-1.5 overflow-y-auto pr-1" aria-label={`Available ${target} effects`}>
        {previews.map(({ id, label, effect }) => <button key={id} type="button" aria-label={`Add ${label} effect`} onClick={() => addEffect(id)}
          className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] text-left hover:border-[#FF3B30]/70">
          <div className="flex h-14 w-full items-center justify-center overflow-hidden" aria-hidden="true"><TextEffectPreview effect={effect} text="CERIGA" shape={target === 'shape'} /></div>
          <span className="block px-1.5 py-1 text-[9px] leading-tight text-white/80">{label}</span>
        </button>)}
      </div>
      {effects.length > 0 && <section aria-label="Applied effects" className="space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-white/55">Applied Effects</h3>
        <p className="text-[9px] text-white/40">Top to bottom. Drag a handle or use the arrows to reorder.</p>
        <ol className="space-y-1.5">
          {effects.map((effect, index) => {
            const label = catalog.find(item => item.id === effect.type)?.label ?? effect.type;
            return <li key={effect.id} className={`rounded-lg border p-1.5 ${active?.id === effect.id ? 'border-[#FF3B30]/70 bg-[#FF3B30]/10' : 'border-white/10 bg-black/20'}`}
              onDragOver={event => { if (!locked && dragged.current && event.dataTransfer.types.includes(DRAG_TYPE)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
              onDrop={event => {
                if (locked || !dragged.current) return;
                event.preventDefault();
                const id = event.dataTransfer.getData(DRAG_TYPE);
                if (id === dragged.current) moveEffect(id, effect.id);
                dragged.current = null;
              }}>
              <div className="flex min-w-0 items-center gap-1">
                {target === 'shape' && <span className="w-12 shrink-0" aria-hidden="true"><TextEffectPreview effect={effect} shape /></span>}
                <button type="button" draggable={!locked} aria-label={`Drag ${label} effect ${index + 1} to reorder`} title="Drag to reorder, or use Move up / Move down" className={`${buttonClass} cursor-grab`}
                  onDragStart={event => { if (locked) { event.preventDefault(); return; } dragged.current = effect.id; event.dataTransfer.setData(DRAG_TYPE, effect.id); event.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => { dragged.current = null; }}><GripVertical className="h-3 w-3" aria-hidden="true" /></button>
                <button type="button" onClick={() => selectEffect(effect.id)} aria-pressed={active?.id === effect.id} aria-label={`Edit ${label} effect ${index + 1}`}
                  className={`min-w-0 flex-1 truncate px-1 py-1 text-left text-[10px] ${effect.enabled ? 'text-white/90' : 'text-white/40'}`}>{label}{!effect.enabled && ' (hidden)'}</button>
              </div>
              <div className="mt-1 flex justify-end gap-1">
                <button type="button" aria-label={`Move ${label} effect ${index + 1} up`} title="Move up" disabled={index === 0} onClick={() => moveEffect(effect.id, effects[index - 1].id)} className={buttonClass}><ArrowUp className="h-3 w-3" aria-hidden="true" /></button>
                <button type="button" aria-label={`Move ${label} effect ${index + 1} down`} title="Move down" disabled={index === effects.length - 1} onClick={() => moveEffect(effect.id, effects[index + 1].id)} className={buttonClass}><ArrowDown className="h-3 w-3" aria-hidden="true" /></button>
                <button type="button" aria-label={`${effect.enabled ? 'Hide' : 'Show'} ${label} effect ${index + 1}`} title={effect.enabled ? 'Hide effect' : 'Show effect'} aria-pressed={effect.enabled} onClick={() => patchEffect(effect.id, { enabled: !effect.enabled })} className={buttonClass}>{effect.enabled ? <Eye className="h-3 w-3" aria-hidden="true" /> : <EyeOff className="h-3 w-3" aria-hidden="true" />}</button>
                <button type="button" aria-label={`Duplicate ${label} effect ${index + 1}`} title="Duplicate effect" onClick={() => duplicateEffect(effect)} className={buttonClass}><Copy className="h-3 w-3" aria-hidden="true" /></button>
                <button type="button" aria-label={`Remove ${label} effect ${index + 1}`} title="Remove effect" onClick={() => changeEffects(current => current.filter(item => item.id !== effect.id))} className={buttonClass}><Trash2 className="h-3 w-3" aria-hidden="true" /></button>
              </div>
            </li>;
          })}
        </ol>
      </section>}
      {active && <section aria-label="Selected effect settings" className="space-y-3 border-t border-white/10 pt-3">
        <h3 className="text-[11px] font-semibold text-white/85">{catalog.find(item => item.id === active.type)?.label ?? active.type}</h3>
        <label className="block text-[10px] text-white/70">Overall intensity <span className="float-right tabular-nums">{active.intensity}%</span>
          <input aria-label="Effect intensity" type="range" min={0} max={100} step={1} value={active.intensity} onChange={event => patchEffect(active.id, { intensity: Number(event.target.value) })} className={rangeClass} />
        </label>
        {(RANDOM_EFFECTS.has(active.type) || target === 'shape' && ['grunge', 'rough-edges'].includes(active.type)) && <button type="button" className={`${buttonClass} w-full text-[10px]`} onClick={() => patchEffect(active.id, { seed: (active.seed + 1) >>> 0 })}>Randomise</button>}
        {controls.map(control => {
          const value = active.settings[control.key] ?? control.default;
          return <label key={control.key} className="block text-[10px] text-white/70">{control.label}
            {control.type === 'range' ? <>
              <span className="float-right tabular-nums">{value}</span>
              <input aria-label={`Effect ${control.label}`} type="range" min={control.min} max={control.max} step={control.step} value={Number(value)} onChange={event => updateSetting(control.key, Number(event.target.value))} className={rangeClass} />
            </> : control.type === 'color' ? <input aria-label={`Effect ${control.label}`} type="color" value={String(value)} onChange={event => updateSetting(control.key, event.target.value)} className="mt-1 block h-8 w-full rounded border border-white/15 bg-transparent" /> : <select aria-label={`Effect ${control.label}`} value={String(value)} onChange={event => updateSetting(control.key, event.target.value)} className="mt-1 block h-8 w-full rounded-lg border border-[#252528] bg-[#111] px-2 text-[10px] text-white">
              {control.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>}
          </label>;
        })}
        {active.type === 'gradient' && <section aria-label="Gradient stops" className="space-y-2">
          <h4 className="text-[10px] font-semibold text-white/65">Gradient stops</h4>
          {gradientStops.map((stop, index) => <div key={index} className="space-y-1 rounded-lg border border-white/10 p-2">
            <div className="flex items-center gap-2">
              <label className="flex flex-1 items-center gap-2 text-[10px] text-white/65">Stop {index + 1}
                <input aria-label={`Stop ${index + 1} colour`} type="color" value={stop.color} onChange={event => patchEffect(active.id, { stops: gradientStops.map((item, i) => i === index ? { ...item, color: event.target.value } : item) })} className="h-7 min-w-0 flex-1 rounded border border-white/15 bg-transparent" />
              </label>
              <button type="button" aria-label={`Remove stop ${index + 1}`} disabled={gradientStops.length <= 2} onClick={() => patchEffect(active.id, { stops: gradientStops.filter((_, i) => i !== index) })} className={buttonClass}><Trash2 className="h-3 w-3" aria-hidden="true" /></button>
            </div>
            <label className="block text-[10px] text-white/60">Position <span className="float-right tabular-nums">{stop.position}%</span>
              <input aria-label={`Stop ${index + 1} position`} type="range" min={0} max={100} step={1} value={stop.position} onChange={event => patchEffect(active.id, { stops: gradientStops.map((item, i) => i === index ? { ...item, position: Number(event.target.value) } : item) })} className={rangeClass} />
            </label>
          </div>)}
          <button type="button" onClick={() => patchEffect(active.id, { stops: [...gradientStops, { color: '#FFFFFF', position: 50 }] })} className={`${buttonClass} w-full text-[10px]`}>Add stop</button>
        </section>}
        {isFill && <section aria-label="Fill image source" className="space-y-2">
          <h4 className="text-[10px] font-semibold text-white/65">Image source</h4>
          {active.source ? <img src={active.source} alt="Current fill source" className="h-20 w-full rounded-lg border border-white/10 object-contain" /> : <p className="text-[10px] text-white/45">Choose an image or texture to fill the {target === 'shape' ? 'shape' : 'lettering'}. The gallery shows a sample.</p>}
          <label className="block text-[10px] text-white/70">Upload image (up to 20 MB)
            <input type="file" accept="image/*" aria-label="Upload fill image" onChange={event => { uploadSource(event.target.files?.[0]); event.target.value = ''; }} className="mt-1 block w-full min-w-0 text-[10px] text-white/65 file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1.5 file:text-white" />
          </label>
          {loadingSource && <p role="status" className="text-[10px] text-white/60">Loading image…</p>}
          {sourceError && <p role="alert" className="text-[10px] text-red-300">{sourceError}</p>}
          {images.length > 0 && <div className="grid max-h-40 grid-cols-3 gap-1.5 overflow-y-auto" aria-label="Existing image sources">
            {images.map((image, index) => <button type="button" key={`${image.name}-${index}`} aria-label={`Use ${image.name} as fill source`} aria-pressed={active.source === image.src} title={image.name} onClick={() => chooseSource(image.src)} className={`min-w-0 overflow-hidden rounded border p-1 ${active.source === image.src ? 'border-[#FF3B30]' : 'border-white/15'}`}>
              <img src={image.src} alt="" className="h-10 w-full object-contain" loading="lazy" />
              <span className="block truncate text-[9px] text-white/65">{image.name}</span>
            </button>)}
          </div>}
          <div className="flex gap-2">
            <button type="button" disabled={!active.source} onClick={() => chooseSource(undefined)} className={`${buttonClass} flex-1 text-[10px]`}>Clear image</button>
            {controls.some(control => control.key.toLowerCase().startsWith('crop')) && <button type="button" onClick={() => {
              const settings = { ...active.settings };
              controls.filter(control => control.key.toLowerCase().startsWith('crop')).forEach(control => { settings[control.key] = control.default; });
              patchEffect(active.id, { settings });
            }} className={`${buttonClass} flex-1 text-[10px]`}>Reset crop</button>}
          </div>
        </section>}
      </section>}
      {locked && <p className="text-[10px] text-white/50">Unlock this {target} layer to edit its effects.</p>}
    </fieldset>
  </details>;
}
