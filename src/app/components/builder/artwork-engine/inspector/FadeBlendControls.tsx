import type { DesignElement } from '../../PrintStudioEditor';
import { StudioFold, StudioNumber, StudioRange } from '../../shell/StudioControls';
import { MaterialSelect } from '../../shell/MaterialSelect';
import { useArtworkDocument } from '../../printsStudio/ArtworkDocumentContext';
import { usePrintsStudio } from '../../printsStudio/PrintsStudioContext';
import './volume-brush.css';
import { BLEND_MODES, DEFAULT_FADE, blendModeLabel, textureBlendFor, createReflection, fadeGradient, type ArtworkBlendMode, type ArtworkFade } from '../geometry/fade';
import './fade-blend.css';

const FADES: { id: 'none' | ArtworkFade['type']; label: string }[] = [{ id: 'none', label: 'None' }, { id: 'linear', label: 'Linear' }, { id: 'radial', label: 'Radial' }];

/** Fade, blend mode and reflection: on any object, every value exact and editable. */
export function FadeBlendControls({ element, update }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void }) {
  const studio = usePrintsStudio(), artwork = useArtworkDocument(), fade = element.artworkFade;
  const units = Math.max(.0001, studio.unitsPerCm), mm = (value: number) => Number((value * 10 / units).toFixed(1)), px = (value: number) => value * units / 10;
  const setFade = (patch: Partial<ArtworkFade>) => update({ artworkFade: { ...(fade ?? DEFAULT_FADE), ...patch } });
  const reflection = artwork?.elements.find(item => item.reflectionOf?.of === element.id);
  const patchReflection = (patch: Partial<DesignElement>) => { if (artwork && reflection) artwork.onChange(artwork.elements.map(item => item.id === reflection.id ? { ...item, ...patch } : item), element.id); };
  const summary = [fade ? 'Fade' : '', element.artworkBlendMode && element.artworkBlendMode !== 'normal' ? blendModeLabel(element.artworkBlendMode) : '', reflection ? 'Reflection' : ''].filter(Boolean).join(' · ') || 'Off';
  const useAsTexture = async () => {
    const image = new Image(); image.crossOrigin = 'anonymous'; image.src = element.content;
    try { await image.decode(); const canvas = document.createElement('canvas'); canvas.width = canvas.height = 48; const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image, 0, 0, 48, 48); const data = ctx.getImageData(0, 0, 48, 48).data; let light = 0, weight = 0; for (let i = 0; i < data.length; i += 4) { const a = data[i + 3] / 255; light += (.2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2]) * a; weight += a; } update({ artworkBlendMode: textureBlendFor(light / Math.max(1, weight)), artworkTextureClip: true }); }
    catch { update({ artworkBlendMode: 'screen', artworkTextureClip: true }); }
  };
  return <StudioFold title="Fade & blend" rowHeight={40} value={summary}>
    {element.type === 'image' && <button type="button" className="cx-use-texture" onClick={() => void useAsTexture()}>Use as texture</button>}
    {element.type === 'image' && element.artworkBlendMode && <label className="cx-brush-follow"><input type="checkbox" checked={Boolean(element.artworkTextureClip)} onChange={event => update({ artworkTextureClip: event.target.checked || undefined })} />Only on artwork below</label>}
    <label className="studio-field">Blend mode<MaterialSelect aria-label="Blend mode" value={element.artworkBlendMode ?? 'normal'} onChange={event => update({ artworkBlendMode: event.target.value === 'normal' ? undefined : event.target.value as ArtworkBlendMode })}>{BLEND_MODES.map(mode => <option key={mode} value={mode}>{blendModeLabel(mode)}</option>)}</MaterialSelect></label>
    <div className="cx-fade-types" role="group" aria-label="Fade">
      {FADES.map(item => <button key={item.id} type="button" aria-pressed={(fade?.type ?? 'none') === item.id} onClick={() => update({ artworkFade: item.id === 'none' ? undefined : { ...(fade ?? DEFAULT_FADE), type: item.id } })}>
        <span style={{ background: item.id === 'none' ? '#1f1f1d' : `${fadeGradient({ ...DEFAULT_FADE, type: item.id })}` }} /><small>{item.label}</small>
      </button>)}
    </div>
    {fade && <>
      {fade.type === 'linear' && <StudioRange label="Angle" unit="°" min={0} max={360} value={fade.angle} onChange={angle => setFade({ angle })} />}
      <div className="studio-two-columns">
        <StudioNumber label="Fade starts" unit="%" min={0} max={100} step={1} value={fade.start} onChange={start => setFade({ start })} />
        <StudioNumber label="Fade ends" unit="%" min={0} max={100} step={1} value={fade.end} onChange={end => setFade({ end })} />
        <StudioNumber label="Start opacity" unit="%" min={0} max={100} step={1} value={fade.startOpacity} onChange={startOpacity => setFade({ startOpacity })} />
        <StudioNumber label="End opacity" unit="%" min={0} max={100} step={1} value={fade.endOpacity} onChange={endOpacity => setFade({ endOpacity })} />
      </div>
      <button type="button" className="cx-recipes__reset" onClick={() => setFade({ startOpacity: fade.endOpacity, endOpacity: fade.startOpacity })}>Reverse fade</button>
    </>}
    {artwork && !element.reflectionOf && (reflection?.reflectionOf ? <div className="cx-reflection">
      <strong>Reflection</strong>
      <StudioNumber label="Gap" unit="mm" min={-500} max={500} step={.5} value={mm(reflection.reflectionOf.gap)} onChange={value => patchReflection({ reflectionOf: { ...reflection.reflectionOf!, gap: px(value) } })} />
      <StudioRange label="Length" unit="%" min={5} max={200} value={reflection.reflectionOf.length} onChange={length => patchReflection({ reflectionOf: { ...reflection.reflectionOf!, length } })} />
      <StudioRange label="Strength" unit="%" min={0} max={100} value={reflection.opacity ?? 100} onChange={opacity => patchReflection({ opacity })} />
      <StudioRange label="Fade length" unit="%" min={5} max={100} value={reflection.artworkFade?.end ?? 100} onChange={end => patchReflection({ artworkFade: { ...(reflection.artworkFade ?? DEFAULT_FADE), end } })} />
      <button type="button" className="cx-recipes__reset" onClick={() => artwork.onChange(artwork.elements.filter(item => item.id !== reflection.id), element.id)}>Remove reflection</button>
    </div> : <button type="button" className="studio-outline-action" onClick={() => artwork.onChange(createReflection(artwork.elements, element.id, crypto.randomUUID(), units * .2), element.id)}>Add reflection</button>)}
  </StudioFold>;
}
