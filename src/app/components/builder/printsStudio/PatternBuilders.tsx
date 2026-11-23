import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { DesignElement } from '../PrintStudioEditor';
import { MaterialSelect } from '../shell/MaterialSelect';
import { StudioFold, StudioNumber, StudioRange } from '../shell/StudioControls';
import { canOutlineLettering } from '../../../lib/editableLettering';
import { repeatTileGeometry, fittedRepeatCounts } from '../../../lib/patternPhysical';
import { WORD_FONTS, patternWordOutline } from '../../../lib/patternWord';
import { DEFAULT_SETT, SETT_PRESETS, expandSett, type TartanSett } from '../../../lib/patternsPro';
import { loadFontLibrary } from './designLibrary';
import './pattern-builders.css';

type Props = { element: DesignElement; onChange: (patch: Partial<DesignElement>) => void };

/** Type any word and it becomes a vector repeat. */
export function WordRepeatControls({ element, onChange }: Props) {
  const imports = useMemo(() => loadFontLibrary(), []), fonts = useMemo(() => [...new Set([...imports.map(font => font.family), ...WORD_FONTS])].filter(font => canOutlineLettering(font, imports)), [imports]);
  const [text, setText] = useState(element.patternWord?.text ?? ''), [font, setFont] = useState(element.patternWord?.font ?? fonts[0] ?? 'League Gothic'), [error, setError] = useState(''), latest = useRef(onChange), first = useRef(true);
  latest.current = onChange;
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!text.trim()) { setError(''); latest.current({ patternWord: undefined }); return; }
    let live = true;
    const timer = window.setTimeout(() => { patternWordOutline(text, font, imports).then(patternWord => { if (live) { setError(''); latest.current({ patternWord }); } }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : 'This word could not be outlined.'); }); }, 220);
    return () => { live = false; window.clearTimeout(timer); };
  }, [text, font, imports]);
  return <StudioFold title="Your word" rowHeight={40} open value={element.patternWord?.text ?? 'TYPE'}><div className="cx-word">
    <input aria-label="Repeat word" placeholder="Type your word" maxLength={40} value={text} onChange={event => setText(event.target.value)} />
    <MaterialSelect aria-label="Repeat word font" value={font} onChange={event => setFont(event.target.value)}>{fonts.map(item => <option key={item} value={item}>{item}</option>)}</MaterialSelect>
    {error && <p role="alert">{error}</p>}
  </div></StudioFold>;
}

/** Build a tartan stripe by stripe. Drag the dividers on the strip, or set exact thread counts. */
export function TartanBuilderControls({ element, onChange }: Props) {
  const sett = element.patternSett ?? DEFAULT_SETT, colours = element.patternColors?.length ? element.patternColors : SETT_PRESETS[0].colors, [active, setActive] = useState(0), strip = useRef<HTMLDivElement>(null), index = Math.min(active, sett.stripes.length - 1), current = sett.stripes[index];
  const write = (next: Partial<TartanSett>) => onChange({ patternSett: { ...sett, ...next } });
  const setStripe = (at: number, patch: Partial<TartanSett['stripes'][number]>) => write({ stripes: sett.stripes.map((stripe, i) => i === at ? { ...stripe, ...patch } : stripe) });
  const move = (delta: number) => { const to = index + delta; if (to < 0 || to >= sett.stripes.length) return; const stripes = [...sett.stripes]; [stripes[index], stripes[to]] = [stripes[to], stripes[index]]; write({ stripes }); setActive(to); };
  const total = sett.stripes.reduce((sum, stripe) => sum + stripe.width, 0), preview = expandSett(sett), previewTotal = preview.reduce((sum, stripe) => sum + stripe.width, 0);
  const drag = (event: React.PointerEvent, at: number) => {
    event.preventDefault(); event.stopPropagation();
    const start = event.clientX, base = sett.stripes, a = base[at].width, b = base[at + 1].width, perPixel = total / Math.max(1, strip.current!.offsetWidth);
    const onMove = (e: PointerEvent) => { const shift = Math.round((e.clientX - start) * perPixel), left = Math.max(1, Math.min(a + b - 1, a + shift)); onChange({ patternSett: { ...sett, stripes: base.map((stripe, i) => i === at ? { ...stripe, width: left } : i === at + 1 ? { ...stripe, width: a + b - left } : stripe) } }); };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  };
  return <StudioFold title="Tartan builder" rowHeight={40} open value={`${sett.stripes.length} stripes`}><div className="cx-sett">
    <div className="cx-sett-presets" role="group" aria-label="Tartan starting points">{SETT_PRESETS.map(preset => <button key={preset.id} type="button" onClick={() => { onChange({ patternSett: structuredClone(preset.sett), patternColors: [...preset.colors], color: preset.colors[0] }); setActive(0); }}><span>{expandSett(preset.sett).map((stripe, i) => <i key={i} style={{ flexGrow: stripe.width, background: preset.colors[stripe.color % preset.colors.length] }} />)}</span><small>{preset.label}</small></button>)}</div>
    <div ref={strip} className="cx-sett-strip" role="group" aria-label="Stripe order">{sett.stripes.map((stripe, i) => <button key={i} type="button" aria-label={`Stripe ${i + 1}`} aria-pressed={i === index} style={{ flexGrow: stripe.width, background: colours[stripe.color % colours.length] }} onClick={() => setActive(i)}>{i < sett.stripes.length - 1 && <b role="slider" aria-label={`Resize stripe ${i + 1}`} aria-valuenow={stripe.width} onPointerDown={event => drag(event, i)} />}</button>)}</div>
    {sett.mirror && <div className="cx-sett-full" aria-hidden="true">{preview.map((stripe, i) => <i key={i} style={{ width: `${stripe.width / previewTotal * 100}%`, background: colours[stripe.color % colours.length] }} />)}</div>}
    {current && <><div className="cx-sett-colours" role="group" aria-label="Stripe colour">{colours.map((colour, i) => <button key={i} type="button" aria-label={`Stripe colour ${i + 1}`} aria-pressed={current.color % colours.length === i} style={{ background: colour }} onClick={() => setStripe(index, { color: i })} />)}</div>
      <StudioNumber label="Threads" unit="" min={1} max={120} step={1} value={current.width} onChange={width => setStripe(index, { width: Math.round(width) })} />
      <div className="cx-sett-actions"><button type="button" aria-label="Move stripe earlier" disabled={!index} onClick={() => move(-1)}><ArrowUp size={14} /></button><button type="button" aria-label="Move stripe later" disabled={index === sett.stripes.length - 1} onClick={() => move(1)}><ArrowDown size={14} /></button><button type="button" aria-label="Add stripe" disabled={sett.stripes.length >= 24} onClick={() => { const stripes = [...sett.stripes]; stripes.splice(index + 1, 0, { color: (current.color + 1) % colours.length, width: 4 }); write({ stripes }); setActive(index + 1); }}><Plus size={14} /></button><button type="button" aria-label="Remove stripe" disabled={sett.stripes.length <= 2} onClick={() => { write({ stripes: sett.stripes.filter((_, i) => i !== index) }); setActive(Math.max(0, index - 1)); }}><Trash2 size={14} /></button></div></>}
    <label className="studio-switch"><span>Mirror the stripes</span><input type="checkbox" aria-label="Mirror the stripes" checked={sett.mirror} onChange={event => write({ mirror: event.target.checked })} /></label>
    <label className="studio-switch"><span>Twill weave</span><input type="checkbox" aria-label="Twill weave" checked={sett.twill !== false} onChange={event => write({ twill: event.target.checked })} /></label>
  </div></StudioFold>;
}

/** Whole repeats across a panel, so a pattern never ends on a cut motif at the seam. */
export function PatternFitControls({ element, onChange }: Props) {
  const fit = element.patternFit, mode = fit?.mode ?? 'free', tile = repeatTileGeometry(element), counts = fittedRepeatCounts(element, tile);
  return <div className="cx-pattern-fit"><div className="cx-pattern-fit__modes" role="group" aria-label="Fit to panel">{([['free', 'Free'], ['width', 'Fit width'], ['panel', 'Fit panel']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => onChange(id === 'free' ? { patternFit: undefined } : { patternFit: { mode: id }, patternAlignment: 'independent', patternOffsetX: 0, patternOffsetY: 0, patternRotation: 0 })}>{label}</button>)}</div>
    {fit && <div className="studio-two-columns"><StudioRange label="Across" min={1} max={32} unit="" value={counts.across} onChange={across => onChange({ patternFit: { ...fit, across } })} />{fit.mode === 'panel' && <StudioRange label="Down" min={1} max={32} unit="" value={counts.down} onChange={down => onChange({ patternFit: { ...fit, down } })} />}</div>}
  </div>;
}

export const CUSTOM_LAYOUTS = [
  { id: 'grid', label: 'Grid' }, { id: 'brick', label: 'Brick' }, { id: 'half-drop', label: 'Half drop' }, { id: 'diamond', label: 'Diamond' },
  { id: 'mirror', label: 'Mirror' }, { id: 'toss', label: 'Toss' }, { id: 'pinwheel', label: 'Pinwheel' }, { id: 'spaced', label: 'Spaced' }, { id: 'random', label: 'Scatter' },
] as const;
function LayoutGlyph({ id }: { id: string }) {
  return <svg viewBox="0 0 44 34" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => {
    const column = index % 3, row = Math.floor(index / 3);
    if (id === 'diamond' && (row + column) % 2) return null;
    const x = 5 + column * 12 + (id === 'brick' && row % 2 ? 5 : id === 'random' ? (index * 7 % 5) - 2 : id === 'spaced' ? (index * 5 % 3) - 1 : 0), y = 4 + row * 11 + (id === 'half-drop' && column % 2 ? 4 : id === 'random' ? (index * 3 % 5) - 2 : id === 'spaced' ? (index * 4 % 3) - 1 : 0), turn = id === 'pinwheel' ? (row % 2) * 180 + (column % 2) * 90 : id === 'toss' && (row + column) % 2 ? 180 : 0, flip = id === 'mirror' && column % 2 ? -1 : 1;
    return <path key={index} transform={`translate(${x + 3} ${y + 3}) rotate(${turn}) scale(${flip} 1)`} d="M-3 3V-3H3Z" fill="currentColor" />;
  })}</svg>;
}
/** Layout, size, turn and ground for a custom repeat. Shared by the maker and the object panel. */
export function CustomRepeatControls({ element, onChange }: Props) {
  const ground = element.patternGround;
  return <div className="cx-repeat">
    <div className="pattern-layout-choices cx-repeat__layouts" role="group" aria-label="Repeat type">{CUSTOM_LAYOUTS.map(layout => <button key={layout.id} type="button" aria-pressed={(element.patternRepeat ?? 'grid') === layout.id} onClick={() => onChange({ patternRepeat: layout.id })}><LayoutGlyph id={layout.id} /><span>{layout.label}</span></button>)}</div>
    <StudioRange label="Motif size" min={20} max={250} value={element.patternMotifScale ?? 100} onChange={patternMotifScale => onChange({ patternMotifScale })} />
    <StudioRange label="Motif turn" min={-180} max={180} unit="°" value={element.patternMotifRotation ?? 0} onChange={patternMotifRotation => onChange({ patternMotifRotation })} />
    <div className="cx-repeat__ground"><label><input type="checkbox" aria-label="Background colour" checked={Boolean(ground)} onChange={event => onChange({ patternGround: event.target.checked ? '#f3efe6' : undefined })} />Background colour</label>{ground && <input type="color" aria-label="Pattern background" value={ground} onChange={event => onChange({ patternGround: event.target.value })} />}</div>
  </div>;
}
