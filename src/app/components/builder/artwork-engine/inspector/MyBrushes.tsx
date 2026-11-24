import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { StudioFold } from '../../shell/StudioControls';
import { StrokeSample } from '../../shell/DrawPaintStudio';
import { usePrintsStudio } from '../../printsStudio/PrintsStudioContext';
import { captureBrush, loadCustomBrushes, storeCustomBrushes, type CustomBrush } from '../../../../lib/customBrushes';
import { BRUSH_PRESETS } from '../../../../lib/drawingBrush';
import { brushTip, createBrushTip, loadBrushTip } from '../../../../lib/brushTips';
import './volume-brush.css';

function TipSample({ id, ready }: { id: string; ready: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const canvas = ref.current, ctx = canvas?.getContext('2d'), tip = brushTip(id); if (!canvas || !ctx || !tip) return; const level = tip.levels.find(item => Math.max(item.width, item.height) <= 128) ?? tip.levels[tip.levels.length - 1], fit = Math.min(38 / level.width, 38 / level.height), w = level.width * fit, h = level.height * fit; ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(level, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h); ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#1f1f1d'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalCompositeOperation = 'source-over'; }, [id, ready]);
  return <canvas ref={ref} width={174} height={45} aria-hidden="true" />;
}

/** Save the current brush with every setting, then reuse it in one tap. */
export function MyBrushes({ onPick }: { onPick: () => void }) {
  const studio = usePrintsStudio(), [brushes, setBrushes] = useState<CustomBrush[]>(loadCustomBrushes), [name, setName] = useState(''), [active, setActive] = useState<string>(), [tipsReady, setTipsReady] = useState(0), [making, setMaking] = useState(false), upload = useRef<HTMLInputElement>(null);
  useEffect(() => { let live = true; void Promise.all(brushes.map(brush => brush.settings.brushTip ? loadBrushTip(brush.settings.brushTip) : null)).then(() => { if (live) setTipsReady(value => value + 1); }); return () => { live = false; }; }, [brushes]);
  const tiles = useMemo(() => brushes.map(brush => ({ brush, preset: { id: brush.base, label: brush.name, size: brush.size, grain: brush.grain, settings: brush.settings } })), [brushes]);
  const commit = (next: CustomBrush[]) => { setBrushes(next); if (!storeCustomBrushes(next)) toast.error('Could not save this brush in your browser.'); };
  const save = () => { const label = name.trim() || `${BRUSH_PRESETS.find(item => item.id === studio.brushPreset)?.label ?? 'Brush'} ${brushes.length + 1}`, brush = captureBrush(studio, label, crypto.randomUUID()); commit([brush, ...brushes]); setActive(brush.id); setName(''); };
  const use = (brush: CustomBrush) => { onPick(); studio.setBrushPreset(brush.base); studio.patchBrush(brush.settings); studio.setBrushSize(brush.size); studio.setGrain(brush.grain); setActive(brush.id); };
  const makeFromImage = async (file?: File) => {
    if (!file) return; setMaking(true);
    try {
      const tip = await createBrushTip(file), label = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Image brush', settings = { brushTip: tip.id, brushTipFollow: false, brushSpacing: 35, brushRotation: 0, taperStart: 0, taperEnd: 0, texture: 'smooth' as const }, brush: CustomBrush = { id: crypto.randomUUID(), name: label, base: 'pen', size: 80, grain: 0, settings };
      commit([brush, ...brushes]); use(brush);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not use this image.'); }
    finally { setMaking(false); if (upload.current) upload.current.value = ''; }
  };
  const tipOn = Boolean(studio.brushTip);
  return <StudioFold title="My brushes" rowHeight={40} value={brushes.length || 'None'}>
    <div className="cx-my-brush-save"><input aria-label="Brush name" placeholder="Name this brush" maxLength={40} value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') save(); }} /><button type="button" onClick={save}><Plus size={14} />Save</button></div>
    <input ref={upload} type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-label="Brush image" onChange={event => void makeFromImage(event.target.files?.[0])} />
    <button type="button" className="cx-brush-from-image" disabled={making} onClick={() => upload.current?.click()}><ImagePlus size={14} />{making ? 'Making brush…' : 'Make brush from image'}</button>
    {tipOn && <label className="cx-brush-follow"><input type="checkbox" checked={Boolean(studio.brushTipFollow)} onChange={event => studio.patchBrush({ brushTipFollow: event.target.checked })} />Turn with stroke</label>}
    {tiles.length > 0 && <div className="draw-brushes"><div className="draw-brush-grid" role="region" aria-label="My brushes" tabIndex={0}>{tiles.map(({ brush, preset }) => <div key={brush.id} className="cx-my-brush"><button type="button" aria-label={`Use my brush ${brush.name}`} aria-pressed={active === brush.id} onClick={() => use(brush)}>{brush.settings.brushTip ? <TipSample id={brush.settings.brushTip} ready={tipsReady} /> : <StrokeSample preset={preset} />}<span>{brush.name}</span>{active === brush.id && <Check size={12} />}</button><button type="button" className="is-delete" aria-label={`Delete my brush ${brush.name}`} onClick={() => commit(brushes.filter(item => item.id !== brush.id))}><Trash2 size={12} /></button></div>)}</div></div>}
  </StudioFold>;
}
