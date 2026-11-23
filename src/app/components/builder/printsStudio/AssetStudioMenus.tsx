import { useEffect, useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Frame, PaintBucket, Shirt } from 'lucide-react';
import { AdvancedColorPopover } from '../PrintStudioColorPopover';
import type { useAssetWorkspace } from './useAssetWorkspace';
import { exportAssetArtboard } from '../../../lib/exportAssetArtboard';
import { assetPlacementFrame } from '../../../lib/studioArtwork';

type Workspace = ReturnType<typeof useAssetWorkspace>;
const CANVAS_SIZES = [{ name: 'Square', width: 600, height: 600 }, { name: 'Portrait', width: 600, height: 900 }, { name: 'Landscape', width: 900, height: 600 }, { name: 'Full print', width: 2400, height: 3000 }, { name: 'Sleeve', width: 600, height: 1800 }, { name: 'Label', width: 600, height: 300 }];
const SWATCHES = ['#ffffff', '#171717', '#d4d4d4', '#f3eadb', '#c8d4c2', '#a9bfd1', '#dec5ca', '#d8bf93'];

function NumberField({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (value: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => { const number = Number(text); if (Number.isInteger(number) && number >= min && number <= max) onCommit(number); else setText(String(value)); };
  return <input aria-label={label} type="number" min={min} max={max} value={text} onChange={event => setText(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />;
}
const Menu = ({ trigger, label, align = 'center', width, open, onOpenChange, children }: { trigger: ReactNode; label: string; align?: 'start' | 'center' | 'end'; width: number; open?: boolean; onOpenChange?: (open: boolean) => void; children: ReactNode }) => <Popover.Root modal={false} open={open} onOpenChange={onOpenChange}><Popover.Trigger asChild>{trigger}</Popover.Trigger><Popover.Portal><Popover.Content className="as-panel" style={{ width }} side="bottom" align={align} sideOffset={8} collisionPadding={12} aria-label={label}>{children}</Popover.Content></Popover.Portal></Popover.Root>;
const Seg = <T extends string>({ label, value, items, onChange }: { label: string; value: T; items: { id: T; label: string; disabled?: boolean }[]; onChange: (id: T) => void }) => <div className="as-seg" role="group" aria-label={label} style={{ gridTemplateColumns: `repeat(${items.length},minmax(0,1fr))` }}>{items.map(item => <button key={item.id} type="button" disabled={item.disabled} aria-pressed={value === item.id} onClick={() => onChange(item.id)}>{item.label}</button>)}</div>;
const ColourButton = ({ value, label, onChange }: { value: string; label: string; onChange: (colour: string) => void }) => <AdvancedColorPopover value={value} onChange={onChange} contentClassName="as-colour-panel"><button type="button" className="as-colour" aria-label={label}><i style={{ background: value }} /><span>{value.toUpperCase()}</span><ChevronDown size={12} /></button></AdvancedColorPopover>;

export function CanvasMenu({ workspace }: { workspace: Workspace }) {
  const { project, busy, changeProject } = workspace;
  if (!project) return null;
  return <Menu label="Canvas size" width={288} align="start" trigger={<button type="button" className="as-chip" disabled={busy}><Frame size={14} /><span>{project.width} × {project.height}</span><ChevronDown size={12} /></button>}>
    <h3>Canvas</h3>
    <div className="as-sizes">{CANVAS_SIZES.map(size => { const fit = 26 / Math.max(size.width, size.height); return <button key={size.name} type="button" disabled={busy} aria-pressed={project.width === size.width && project.height === size.height} onClick={() => changeProject({ width: size.width, height: size.height })}><span><i style={{ width: size.width * fit, height: size.height * fit }} /></span>{size.name}</button>; })}</div>
    <div className="as-dimensions"><label>Width<NumberField label="Asset width" min={32} max={4096} value={project.width} onCommit={width => changeProject({ width })} /></label><span>×</span><label>Height<NumberField label="Asset height" min={32} max={4096} value={project.height} onCommit={height => changeProject({ height })} /></label><span>px</span></div>
  </Menu>;
}

export function BackgroundMenu({ workspace }: { workspace: Workspace }) {
  const { project, busy, changeProject } = workspace;
  if (!project) return null;
  const colour = project.background;
  return <Menu label="Background" width={260} trigger={<button type="button" className="as-chip" disabled={busy}><PaintBucket size={14} /><span>Background</span>{colour ? <i className="as-dot" style={{ background: colour }} /> : <em>None</em>}<ChevronDown size={12} /></button>}>
    <h3>Background</h3>
    <Seg label="Canvas background" value={colour ? 'colour' : 'none'} items={[{ id: 'none', label: 'None' }, { id: 'colour', label: 'Colour' }]} onChange={mode => changeProject({ background: mode === 'none' ? undefined : colour ?? '#ffffff' })} />
    {colour ? <><ColourButton label="Choose canvas background colour" value={colour} onChange={background => { if (!busy) changeProject({ background }); }} /><div className="as-swatches" role="group" aria-label="Canvas background swatches">{SWATCHES.map(swatch => <button key={swatch} type="button" aria-label={`Canvas colour ${swatch}`} aria-pressed={colour.toLowerCase() === swatch} style={{ background: swatch }} onClick={() => changeProject({ background: swatch })} />)}</div><p>You can keep or leave it when adding to the garment.</p></> : <p>Only your art goes on the garment.</p>}
  </Menu>;
}

export function AddToGarmentMenu({ workspace }: { workspace: Workspace }) {
  const { project, busy, garmentSide } = workspace;
  const [open, setOpen] = useState(false), [keepBackground, setKeepBackground] = useState(true), [trim, setTrim] = useState(true), [side, setSide] = useState<'front' | 'back'>(garmentSide), [width, setWidth] = useState(140), [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!open || !project) return;
    let cancelled = false; setSide(garmentSide); setPreview(null);
    void exportAssetArtboard(project.width, project.height, project.elements).then(url => { if (!cancelled) setPreview(url); }).catch(() => { /* Adding reports any real capture problem. */ });
    return () => { cancelled = true; };
    // Capture once each time the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!project) return null;
  const empty = !project.elements.some(element => !element.hidden && !element.tracingReference), background = keepBackground ? project.background : undefined, frame = assetPlacementFrame(project, trim);
  const add = () => { setOpen(false); void workspace.save(false, undefined, { background, trim, side, width }); };
  return <Menu open={open} onOpenChange={setOpen} label="Add to garment" width={300} align="end" trigger={<button type="button" className="asset-save-primary as-add" disabled={busy}><Shirt size={14} /><span>{busy ? 'Saving…' : 'Add to garment'}</span></button>}>
    <div className="as-preview"><div style={{ aspectRatio: `${frame.width} / ${frame.height}`, background }}>{preview && <img alt="" src={preview} style={{ width: `${project.width / frame.width * 100}%`, height: `${project.height / frame.height * 100}%`, left: `${-frame.x / frame.width * 100}%`, top: `${-frame.y / frame.height * 100}%` }} />}</div></div>
    {project.background && <><label className="as-field-label">Background</label><Seg label="Garment background" value={keepBackground ? 'keep' : 'art'} items={[{ id: 'art', label: 'Art only' }, { id: 'keep', label: 'Keep background' }]} onChange={id => setKeepBackground(id === 'keep')} /></>}
    <label className="as-field-label">Fit</label>
    <Seg label="Garment fit" value={trim ? 'trim' : 'canvas'} items={[{ id: 'trim', label: 'Trim to art' }, { id: 'canvas', label: 'Full canvas' }]} onChange={id => setTrim(id === 'trim')} />
    <label className="as-field-label">Side</label>
    <Seg<'front' | 'back'> label="Garment side" value={side} items={[{ id: 'front', label: 'Front' }, { id: 'back', label: 'Back' }]} onChange={setSide} />
    <label className="as-range"><span>Size</span><input type="range" aria-label="Size on garment" min={40} max={400} value={width} onChange={event => setWidth(Number(event.target.value))} /><output>{width} px</output></label>
    {empty && <p role="alert" className="as-error">Add some artwork first.</p>}
    <footer><span>Stays editable</span><button type="button" className="as-download" disabled={busy || empty} onClick={add}>Add to {side}</button></footer>
  </Menu>;
}
