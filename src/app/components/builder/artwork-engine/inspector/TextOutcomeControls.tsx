import { memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DesignElement } from '../../PrintStudioEditor';
import { StudioFold, StudioNumber, StudioRange } from '../../shell/StudioControls';
import { ArtworkSurfaceContext } from '../../printsStudio/ArtworkSurfaceContext';
import { usePrintsStudio } from '../../printsStudio/PrintsStudioContext';
import { TextArtwork } from '../../printsStudio/TextArtwork';
import { textAppearance } from '../../../../lib/textAppearance';
import { useArtworkScene } from '../state/scene';
import { INK_DARK, INK_LIGHT, contrastRatio } from '../geometry/colour';
import { TEXT_OUTCOMES, applyTextOutcome, clearTextOutcome, defaultOutcome, type TextOutcome, type TextOutcomeId } from '../typography/outcomes';
import './text-outcomes.css';

const PREVIEW_SIZE = 34;

const OutcomePreview = memo(function OutcomePreview({ source, id, ink, surface, units }: { source: DesignElement; id: TextOutcomeId; ink: string; surface: string; units: number }) {
  const host = useRef<HTMLSpanElement>(null);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null), [room, setRoom] = useState(70);
  useEffect(() => { const node = host.current; if (!node) return; const read = () => setRoom(Math.max(36, node.clientWidth - 14)); read(); const observer = new ResizeObserver(read); observer.observe(node); return () => observer.disconnect(); }, []);
  const element = useMemo(() => {
    const word = source.content.split(/\r?\n/)[0].trim().slice(0, 6) || 'Text';
    const base = { ...source, id: 'outcome-preview-' + id, content: word, x: 0, y: 0, rotation: 0, fontSize: PREVIEW_SIZE, letterSpacing: 0, width: frame?.width ?? 180, height: frame?.height ?? PREVIEW_SIZE, textFrameMode: 'point', autoWidth: true, autoHeight: true, textPath: undefined, textEdge: undefined, textGlyphTransforms: undefined, textEffects: undefined, textOutcome: undefined, textRecipe: undefined, textAppearance: [{ id: 'fill', type: 'fill', enabled: true, colour: ink }] } as DesignElement;
    const styled = { ...base, ...applyTextOutcome(base, defaultOutcome(id, ink, surface), units) } as DesignElement;
    // Six live tiles: fewer copies keep the panel light, and read the same at this size.
    return { ...styled, textAppearance: styled.textAppearance?.map(item => item.type === 'extrude' ? { ...item, copies: Math.min(item.copies ?? 12, 12) } : item) } as DesignElement;
  }, [source.content, source.fontFamily, source.fontWeight, source.fontStyle, source.textTransform, id, ink, surface, units, frame]);
  const scale = frame ? Math.min(room / Math.max(1, frame.width), 28 / Math.max(1, frame.height), 1) : 0;
  return <span ref={host} className="cx-outcome-tile__art" aria-hidden="true"><span style={{ width: frame?.width ?? 180, height: frame?.height ?? PREVIEW_SIZE, transform: `scale(${scale})`, opacity: frame ? 1 : 0 }}>
    <TextArtwork element={element} fontSize={PREVIEW_SIZE} onFrameChange={next => setFrame(current => current && Math.abs(current.width - next.width) < .5 && Math.abs(current.height - next.height) < .5 ? current : next)} />
  </span></span>;
});

const Well = ({ label, value, onChange }: { label: string; value: string; onChange: (colour: string) => void }) => <label className="cx-outcome-well"><span>{label}</span><input type="color" aria-label={label} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#171717'} onChange={event => onChange(event.target.value)} /></label>;

/** One-tap type outcomes, then every value they use. */
export function TextOutcomeControls({ element, update }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void }) {
  const studio = usePrintsStudio(), scene = useArtworkScene(), onSurface = useContext(ArtworkSurfaceContext);
  const fill = textAppearance(element).find(item => item.type === 'fill' && item.enabled)?.colour ?? element.color ?? INK_DARK;
  const ink = /^#[0-9a-f]{6}$/i.test(fill) ? fill : element.color && /^#[0-9a-f]{6}$/i.test(element.color) ? element.color : INK_DARK;
  const surface = (!onSurface && scene.surfaceColour) || (contrastRatio(ink, INK_LIGHT) > contrastRatio(ink, INK_DARK) ? INK_LIGHT : INK_DARK);
  const outcome = element.textOutcome, size = Math.max(1, element.fontSize ?? 30), units = Math.max(.0001, studio.unitsPerCm);
  const mm = (em: number) => Number((em * size * 10 / units).toFixed(1)), em = (value: number) => value * units / 10 / size;
  const set = (patch: Partial<TextOutcome>) => { if (outcome) update(applyTextOutcome(element, { ...outcome, ...patch }, units)); };
  const pick = (id: TextOutcomeId) => {
    if (outcome?.id === id) { update(clearTextOutcome(element)); return; }
    const clean = { ...element, ...clearTextOutcome(element) } as DesignElement;
    update(applyTextOutcome(clean, defaultOutcome(id, ink, surface), units));
  };
  const label = TEXT_OUTCOMES.find(item => item.id === outcome?.id)?.label;
  return <StudioFold title="Outcomes" rowHeight={40} value={label ?? 'Off'}>
    <div className="cx-outcomes" role="group" aria-label="Text outcomes">
      {TEXT_OUTCOMES.map(item => <button key={item.id} type="button" className="cx-outcome-tile" aria-pressed={outcome?.id === item.id} onClick={() => pick(item.id)}>
        <span className="cx-outcome-tile__stage" style={{ background: surface }}><OutcomePreview source={element} id={item.id} ink={ink} surface={surface} units={units} /></span>
        <span className="cx-outcome-tile__name">{item.label}</span>
      </button>)}
    </div>
    {outcome && <div className="cx-outcome-values">
      <StudioNumber label={outcome.id === 'interlock' || outcome.id === 'offset' ? 'Gap' : 'Distance'} unit="mm" min={.1} max={500} step={.1} value={mm(outcome.distance)} onChange={value => set({ distance: em(value) })} />
      {outcome.id === 'interlock' && <StudioRange label="Overlap" unit="%" min={0} max={45} value={Math.round(outcome.overlap * 100)} onChange={value => set({ overlap: value / 100 })} />}
      {(outcome.id === 'offset' || outcome.id === 'echo') && <StudioNumber label={outcome.id === 'echo' ? 'Edge' : 'Line weight'} unit="mm" min={.1} max={100} step={.1} value={mm(outcome.weight)} onChange={value => set({ weight: em(value) })} />}
      {(outcome.id === 'echo' || outcome.id === 'trail' || outcome.id === 'offset') && <StudioRange label={outcome.id === 'offset' ? 'Lines' : 'Copies'} unit="" min={1} max={outcome.id === 'offset' ? 5 : 60} value={outcome.copies} onChange={copies => set({ copies })} />}
      {outcome.id !== 'interlock' && outcome.id !== 'offset' && <StudioRange label="Angle" unit="°" min={0} max={360} value={Math.round(outcome.angle)} onChange={angle => set({ angle })} />}
      {outcome.id === 'flare' && <StudioRange label="End size" unit="%" min={0} max={200} value={outcome.endSize} onChange={endSize => set({ endSize })} />}
      <div className="cx-outcome-wells">
        {outcome.id !== 'interlock' && <Well label="Colour" value={outcome.colour} onChange={colour => set({ colour })} />}
        <Well label={outcome.id === 'interlock' || outcome.id === 'offset' ? 'Gap colour' : 'Fades to'} value={outcome.colourTo} onChange={colourTo => set({ colourTo })} />
      </div>
      <button type="button" className="cx-recipes__reset" onClick={() => update(applyTextOutcome(element, defaultOutcome(outcome.id, ink, surface), units))}>Reset {label}</button>
      <button type="button" className="cx-recipes__reset" onClick={() => update(clearTextOutcome(element))}>Remove</button>
    </div>}
  </StudioFold>;
}
