import { useState } from 'react';
import { CornerDownRight, Plus, Trash2 } from 'lucide-react';
import type { DesignElement } from '../../PrintStudioEditor';
import { StudioFold, StudioNumber, StudioRange } from '../../shell/StudioControls';
import { MaterialSelect } from '../../shell/MaterialSelect';
import { useArtworkDocument } from '../../printsStudio/ArtworkDocumentContext';
import { usePrintsStudio } from '../../printsStudio/PrintsStudioContext';
import { shapeToEditablePath } from '../../../../lib/shapeGeometry';
import { BLEND_MAX_STEPS, addBlendKey, clearBlendSpine, expandBlend, releaseBlend, removeBlendKey, setBlendSpine, updateBlend, updateBlendSource, type BlendEasing, type BlendSettings } from '../geometry/blend';
import './blend-controls.css';

const EASINGS: { id: BlendEasing; label: string; d: string }[] = [
  { id: 'linear', label: 'Even', d: 'M3 17 17 3' },
  { id: 'in', label: 'Ease in', d: 'M3 17C11 17 15 11 17 3' },
  { id: 'out', label: 'Ease out', d: 'M3 17C5 9 9 3 17 3' },
  { id: 'inOut', label: 'Both', d: 'M3 17C10 17 10 3 17 3' },
];

function Well({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return <label className="cx-blend-well"><span>{label}</span><input type="color" aria-label={`${label} colour`} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#171717'} onChange={event => onChange(event.target.value)} /></label>;
}

/** Every blend value: quick look and steps first, then line, flow, spine and live source paths. */
export function BlendControls({ element, update }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void }) {
  const studio = usePrintsStudio(), artwork = useArtworkDocument(), s = element.artworkBlend, sources = element.children ?? [];
  const [picked, setPicked] = useState('');
  if (!s) return null;
  const set = (settings: Partial<BlendSettings>) => update(updateBlend(element, settings));
  const scale = element.width / Math.max(.0001, element.groupSourceWidth ?? element.width), units = Math.max(.0001, studio.unitsPerCm);
  const mm = (value: number) => Number((value * scale * 10 / units).toFixed(2)), px = (value: number) => value * units / 10 / Math.max(.0001, scale);
  const source = sources.find(item => item.id === picked) ?? sources[0];
  const sourceIndex = source ? sources.indexOf(source) : 0;
  const sourceColour = sourceIndex === 0 ? s.startColour : sourceIndex === sources.length - 1 ? s.endColour : source?.blendColour ?? s.startColour;
  const setSourceColour = (colour: string) => { if (sourceIndex === 0) set({ startColour: colour }); else if (sourceIndex === sources.length - 1) set({ endColour: colour }); else if (source) update(updateBlendSource(element, source.id, { blendColour: colour })); };
  const paths = (artwork?.elements ?? []).filter(item => item.id !== element.id && item.type === 'shape' && !item.hidden && (item.side ?? 'front') === (element.side ?? 'front'));
  const editPoints = () => {
    if (!source) return;
    if (!source.shapePath) update(updateBlendSource(element, source.id, { shapePath: shapeToEditablePath(source), shapeCornerRadius: 0 }));
    studio.setTool('select'); studio.setPathEditingId(null); studio.setLogoRegionEditing({ rootId: element.id, regionId: source.id });
  };
  return <StudioFold title="Blend" value={s.mode === 'steps' ? `${s.steps} steps` : `${mm(s.spacing)} mm`} open>
    <div className="cx-blend-looks" role="group" aria-label="Blend look">
      {(['lines', 'smooth'] as const).map(look => <button key={look} type="button" aria-pressed={s.look === look} onClick={() => set({ look })}>
        <svg viewBox="0 0 44 26" aria-hidden="true">{look === 'lines' ? [3, 8, 13, 18, 23].map(y => <path key={y} d={`M3 ${y}C14 ${y - 3} 28 ${y + 3} 41 ${y}`} />) : <path className="is-solid" d="M3 4C14 1 28 7 41 4V23C28 26 14 20 3 23Z" />}</svg>
        <span>{look === 'lines' ? 'Lines' : 'Smooth'}</span>
      </button>)}
    </div>
    <div className="typography-segments" role="group" aria-label="Spacing by"><button type="button" aria-pressed={s.mode === 'steps'} onClick={() => set({ mode: 'steps' })}>Steps</button><button type="button" aria-pressed={s.mode === 'distance'} onClick={() => set({ mode: 'distance' })}>Distance</button></div>
    {s.mode === 'steps'
      ? <StudioRange label="Steps" unit="" min={1} max={BLEND_MAX_STEPS} value={s.steps} onChange={steps => set({ steps })} />
      : <StudioNumber label="Distance between" unit="mm" min={.05} max={100} step={.05} value={mm(s.spacing)} onChange={value => set({ spacing: px(value) })} />}

    <StudioRange label="Blur" unit="mm" min={0} max={60} step={.5} value={mm(s.blur ?? 0)} onChange={value => set({ blur: value ? px(value) : 0 })} />

    <StudioFold title="Line" rowHeight={40} value={`${mm(s.startWidth)} mm`} open>
      {s.look === 'lines' && <div className="studio-two-columns">
        <StudioNumber label="Start width" unit="mm" min={.02} max={40} step={.01} value={mm(s.startWidth)} onChange={value => set({ startWidth: px(value) })} />
        <StudioNumber label="End width" unit="mm" min={.02} max={40} step={.01} value={mm(s.endWidth)} onChange={value => set({ endWidth: px(value) })} />
      </div>}
      <div className="studio-two-columns">
        <StudioNumber label="Start opacity" unit="%" min={0} max={100} step={1} value={s.startOpacity} onChange={startOpacity => set({ startOpacity })} />
        <StudioNumber label="End opacity" unit="%" min={0} max={100} step={1} value={s.endOpacity} onChange={endOpacity => set({ endOpacity })} />
      </div>
    </StudioFold>

    <StudioFold title="Flow" rowHeight={40} value={EASINGS.find(item => item.id === s.easing)?.label}>
      <div className="cx-blend-easing" role="group" aria-label="Step easing">{EASINGS.map(item => <button key={item.id} type="button" aria-pressed={s.easing === item.id} onClick={() => set({ easing: item.id })}><svg viewBox="0 0 20 20" aria-hidden="true"><path d={item.d} /></svg><span>{item.label}</span></button>)}</div>
      {s.easing !== 'linear' && <StudioRange label="Ease strength" min={0} max={100} value={s.easeAmount} onChange={easeAmount => set({ easeAmount })} />}
      <StudioRange label="Twist" min={0} max={100} value={s.twist} onChange={twist => set({ twist })} />
      <label className="studio-switch">Reverse direction<input type="checkbox" checked={s.reverse} onChange={event => set({ reverse: event.target.checked })} /></label>
      {artwork && (s.spine
        ? <button type="button" className="studio-outline-action" onClick={() => artwork.onChange(clearBlendSpine(artwork.elements, element.id), element.id)}>Release spine</button>
        : <label className="studio-field">Follow a path<MaterialSelect aria-label="Blend spine" value="" onChange={event => event.target.value && artwork.onChange(setBlendSpine(artwork.elements, element.id, event.target.value), element.id)}><option value="">Straight</option>{paths.map(item => <option key={item.id} value={item.id}>{item.layerName ?? item.content}</option>)}</MaterialSelect></label>)}
    </StudioFold>

    <StudioFold title="Source paths" rowHeight={40} value={`${sources.length}`} open>
      <div className="cx-blend-sources" role="group" aria-label="Source paths">
        {sources.map((item, index) => <button key={item.id} type="button" aria-pressed={source?.id === item.id} onClick={() => setPicked(item.id)}>{index === 0 ? 'Start' : index === sources.length - 1 ? 'End' : `Key ${index}`}</button>)}
        <button type="button" aria-label="Add key shape" title="Add key shape" onClick={() => { const id = crypto.randomUUID(); update(addBlendKey(element, id)); setPicked(id); }}><Plus size={14} /></button>
      </div>
      {source && <>
        <div className="cx-blend-wells"><Well label="Colour" value={sourceColour} onChange={setSourceColour} /></div>
        <button type="button" className="studio-outline-action cx-blend-edit" onClick={editPoints}><CornerDownRight size={15} />Edit points on canvas</button>
        <div className="studio-two-columns">
          {(['x', 'y', 'width', 'height'] as const).map(key => <StudioNumber key={key} label={key === 'x' ? 'X' : key === 'y' ? 'Y' : key === 'width' ? 'Width' : 'Height'} unit="mm" min={key === 'width' || key === 'height' ? .1 : -4000} max={4000} step={.5} value={mm(source[key])} onChange={value => update(updateBlendSource(element, source.id, { [key]: px(value) }))} />)}
        </div>
        <StudioRange label="Rotation" unit="°" min={-180} max={180} value={Math.round(source.rotation)} onChange={rotation => update(updateBlendSource(element, source.id, { rotation }))} />
        {sources.length > 2 && <button type="button" className="studio-outline-action" onClick={() => { update(removeBlendKey(element, source.id)); setPicked(''); }}><Trash2 size={14} />Remove this path</button>}
      </>}
    </StudioFold>
    <div className="path-workflow-actions"><button type="button" onClick={() => update(expandBlend(element))}>Expand</button><button type="button" onClick={() => update(releaseBlend(element))}>Release paths</button></div>
  </StudioFold>;
}

/** After Expand: return to the live blend. */
export function ExpandedBlendControls({ element, update }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void }) {
  if (!element.blendExpandedFrom) return null;
  return <button type="button" className="studio-outline-action" onClick={() => update({ ...element.blendExpandedFrom, blendExpandedFrom: undefined })}>Restore live blend</button>;
}
