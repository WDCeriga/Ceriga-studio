import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, BetweenHorizontalStart, Copy, ImagePlus, Maximize, Minus, Plus, RotateCcw, Save, Trash2, Type, Upload } from 'lucide-react';
import { PackagingArtwork } from './PackagingArtwork';
import { PACKAGING_CATEGORIES, PACKAGING_TEMPLATES, PANEL_NAMES, packagingTemplate, createPackagingDesign, switchPackaging, normalizePackagingDesign, packagingDimensionError, packagingWarnings, constrainPackagingElement, fitPackagingElement, printRegion, rotatedExtents, type PackagingCategory, type PackagingState, type PackagingDesign, type PackagingElement, type PackagingPanel, type PackagingView } from '../../data/packaging';
import './packaging.css';

function Field({ title, children }: { title: string; children: ReactNode }) { return <label className="pkg-field"><span>{title}</span>{children}</label>; }
function Tool({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) { return <button type="button" className="pkg-tool" title={title} aria-label={title} onClick={onClick}>{children}</button>; }
function textMetrics(content: string, font: string, size: number) {
  const context = document.createElement('canvas').getContext('2d');
  if (context) context.font = `${size}px "${font}"`;
  return { width: Math.max(size, (context?.measureText(content).width ?? content.length * size) + size), height: size * 1.6 };
}
export async function readPackagingUpload(file: File) {
  if (file.size > 8 * 1024 * 1024) throw new Error('Use an image smaller than 8 MB.');
  if (!/\.(png|jpe?g|webp|svg)$/i.test(file.name)) throw new Error('Use PNG, JPEG, WebP or a static SVG.');
  const vector = /\.svg$/i.test(file.name);
  if (vector) {
    const source = await file.text();
    const document = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (/<!DOCTYPE|<\?xml-stylesheet/i.test(source) || document.documentElement.localName !== 'svg' || document.querySelector('parsererror, script, foreignObject, animate, animateTransform, animateMotion, set, style, image') || Array.from(document.querySelectorAll('*')).some(element => Array.from(element.attributes).some(attribute => /^on/i.test(attribute.name) || (/(href|src)$/i.test(attribute.name) && !attribute.value.startsWith('#')) || /url\(\s*['"]?(?!#)/i.test(attribute.value)))) throw new Error('SVG must be self-contained and static, without scripts, external resources or embedded images. Export a plain vector SVG or PNG.');
  }
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read image.')); reader.readAsDataURL(file);
  });
  const image = new Image(); image.src = content;
  try { await image.decode(); } catch { throw new Error('This image could not be decoded.'); }
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 32_000_000) throw new Error('Image dimensions must be valid and below 32 megapixels.');
  return { content, width: image.naturalWidth, height: image.naturalHeight, vector };
}

interface DesignerProps {
  value: PackagingState;
  onChange: (value: PackagingState) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onBoundary: (limited: boolean) => void;
  hasGarmentMeasurements?: boolean;
  legacy?: boolean;
}
export function PackagingDesigner({ value, onChange, selectedId, onSelect, onBoundary, hasGarmentMeasurements, legacy }: DesignerProps) {
  const design = value.designs[value.active];
  const template = packagingTemplate(design.templateId);
  const selected = design.elements.find(element => element.id === selectedId);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [text, setText] = useState('');
  const [textRole, setTextRole] = useState('Brand name');
  const [presetName, setPresetName] = useState('');
  const [dimensions, setDimensions] = useState(design.dimensions);
  useEffect(() => { setDimensions(design.dimensions); }, [design.dimensions.width, design.dimensions.height, design.dimensions.depth]);
  const uploadRef = useRef<HTMLInputElement>(null);
  const uploadIntent = useRef<{ kind: 'logo' | 'artwork'; replace?: string }>({ kind: 'logo' });
  const latest = useRef({ value, onChange }); latest.current = { value, onChange };
  const update = (patch: Partial<PackagingDesign>) => {
    const next = normalizePackagingDesign({ ...design, ...patch });
    const limited = next.elements.some((element, index) => JSON.stringify(element) !== JSON.stringify((patch.elements ?? design.elements)[index]));
    onBoundary(limited);
    onChange({ ...value, designs: { ...value.designs, [value.active]: next } });
  };
  const updateElement = (patch: Partial<PackagingElement>) => {
    if (!selected) return;
    update({ elements: design.elements.map(element => element.id === selected.id ? { ...element, ...patch } : element) });
  };
  const selectPanel = (panel: PackagingPanel) => {
    update({ selectedPanel: panel, view: design.category === 'box' ? 'panel' : panel === 'back' ? 'back' : 'front' });
    onSelect(null);
  };
  const chooseTemplate = (id: string) => { onChange(switchPackaging(value, id)); onSelect(null); setError(''); setMessage('Previous designs are retained in their variations.'); };
  const addText = () => {
    if (!text.trim()) return;
    const region = printRegion(design, design.selectedPanel);
    const font = 'Georgia'; const fontSize = 12;
    const element: PackagingElement = { id: crypto.randomUUID(), panel: design.selectedPanel, kind: 'text', name: textRole, content: text.trim(), x: 0, y: 0, ...textMetrics(text.trim(), font, fontSize), rotation: 0, color: '#111111', font, fontSize, align: 'center' };
    const fitted = fitPackagingElement(element, region);
    update({ elements: [...design.elements, fitted] }); onSelect(element.id); setText('');
  };
  const resize = (width: number) => { if (selected && Number.isFinite(width) && width > 0) { const factor = width / selected.width; updateElement({ width, height: selected.height * factor, fontSize: selected.fontSize * factor }); } };
  const align = (axis: 'x' | 'y', position: 'start' | 'center' | 'end') => {
    if (!selected) return;
    const region = printRegion(design, selected.panel); const bounds = rotatedExtents(selected);
    const start = axis === 'x' ? region.x : region.y; const length = axis === 'x' ? region.width : region.height; const extent = axis === 'x' ? bounds.width : bounds.height;
    updateElement({ [axis]: start + (position === 'start' ? extent / 2 : position === 'center' ? length / 2 : length - extent / 2) });
  };
  const chooseUpload = (kind: 'logo' | 'artwork', replace?: string) => { uploadIntent.current = { kind, replace }; uploadRef.current?.click(); };
  const savePreset = (duplicate: boolean) => {
    const name = presetName.trim() || `${template.name}${duplicate ? ' copy' : ' preset'}`;
    onChange({ ...value, presets: [...value.presets, { id: crypto.randomUUID(), name, design: structuredClone(design) }] });
    setMessage(`${name} saved in this project.`); setPresetName('');
  };
  return <div className="pkg-editor" data-packaging-editor>
    <section><h3>Packaging</h3><div className="pkg-categories" role="group" aria-label="Packaging category">
      {Object.entries(PACKAGING_CATEGORIES).map(([category, name]) => <button type="button" key={category} aria-pressed={design.category === category} onClick={() => chooseTemplate(PACKAGING_TEMPLATES.find(item => item.category === category)!.id)}>{name}</button>)}
    </div></section>
    {design.category !== 'none' && <Field title="Variation"><select aria-label="Packaging variation" value={design.templateId} onChange={event => chooseTemplate(event.target.value)}>{PACKAGING_TEMPLATES.filter(item => item.category === design.category).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
    {message && <p role="status" className="pkg-advisory">{message}</p>}
    {design.category === 'none' ? <p className="pkg-advisory">No individual custom packaging is included. Garments will be packed in a standard, unbranded bulk shipping carton for delivery.</p> : <>
      {legacy && <p className="pkg-advisory">Legacy artwork has been fitted into safe regions. Original legacy data is retained; review each placement.</p>}
      <section><h3>Material &amp; colour</h3><p className="pkg-material">{design.material}</p><div className="pkg-two">
        <Field title="Exterior colour"><input aria-label="Packaging exterior colour" type="color" value={design.exterior} onChange={event => update({ exterior: event.target.value })} /></Field>
        {design.category === 'box' && <Field title="Interior colour"><input aria-label="Packaging interior colour" type="color" value={design.interior} onChange={event => update({ interior: event.target.value })} /></Field>}
      </div>{template.transparency && <Field title={`Material opacity ${Math.round(design.opacity * 100)}%`}><input aria-label="Material opacity" type="range" min="10" max="90" value={Math.round(design.opacity * 100)} onChange={event => update({ opacity: Number(event.target.value) / 100 })} /></Field>}</section>
      <section><h3>Size</h3><div className="pkg-two">{(['width', 'height', ...(design.category === 'box' ? ['depth'] : [])] as const).map(dimension => <Field key={dimension} title={`${dimension === 'height' ? 'Length' : dimension} (mm)`}><input aria-label={`Packaging ${dimension} mm`} type="number" min={dimension === 'depth' ? 20 : 100} max={dimension === 'depth' ? 500 : 1000} value={dimensions[dimension as keyof typeof dimensions]} onChange={event => setDimensions({ ...dimensions, [dimension]: Number(event.target.value) })} /></Field>)}</div>
        <button type="button" className="pkg-command" onClick={() => { const problem = packagingDimensionError(dimensions, design.category); if (problem) { setError(problem); return; } setError(''); update({ dimensions, dimensionsConfirmed: true }); }}>Apply dimensions</button>
        <p className="pkg-advisory">{design.dimensions.width} x {design.dimensions.height}{design.category === 'box' ? ` x ${design.dimensions.depth}` : ''} mm{design.dimensionsConfirmed ? ' requested' : ' illustrative'}.</p>
        <p className="pkg-advisory">{hasGarmentMeasurements ? 'Garment measurements are available, but folded dimensions are unknown.' : 'Folded garment dimensions are unknown.'} Confirm folded width, length, thickness and packing allowance before production.</p>
      </section>
      <section><h3>Print surface</h3><Field title="Selected panel"><select aria-label="Printable panel" value={design.selectedPanel} onChange={event => selectPanel(event.target.value as PackagingPanel)}>{template.panels.map(panel => <option key={panel} value={panel}>{PANEL_NAMES[panel]}</option>)}</select></Field>
        {design.category === 'mailer' && <label className="pkg-check"><input type="checkbox" checked={design.shippingLabel} onChange={event => { if (event.target.checked && design.elements.some(element => element.panel === 'front') && !window.confirm('Reserve the front-right area for a shipping label? Front branding will be fitted into the remaining print-safe area.')) return; update({ shippingLabel: event.target.checked }); }} />Reserve shipping-label area</label>}
      </section>
      <section><h3>Artwork &amp; text</h3><div className="pkg-actions"><button type="button" onClick={() => chooseUpload('logo')}><Upload size={15} />Logo</button><button type="button" onClick={() => chooseUpload('artwork')}><ImagePlus size={15} />Artwork</button></div>
        <input ref={uploadRef} aria-label="Packaging image upload" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
          const target = value.active; const targetPanel = design.selectedPanel; const intent = { ...uploadIntent.current }; setError('');
          try {
            const uploaded = await readPackagingUpload(file);
            const current = latest.current.value; const targetDesign = current.designs[target];
            if (!targetDesign) throw new Error('The destination design is no longer available.');
            const previous = targetDesign.elements.find(element => element.id === intent.replace);
            const element: PackagingElement = { id: previous?.id ?? crypto.randomUUID(), kind: intent.kind, panel: previous?.panel ?? targetPanel, name: file.name, content: uploaded.content, x: 0, y: 0, width: uploaded.width, height: uploaded.height, rotation: previous?.rotation ?? 0, font: 'Georgia', fontSize: 12, color: '#111111', align: 'center', pixelWidth: uploaded.vector ? undefined : uploaded.width, pixelHeight: uploaded.vector ? undefined : uploaded.height };
            const fitted = fitPackagingElement(element, printRegion(targetDesign, element.panel));
            if (previous) { fitted.x = previous.x; fitted.y = previous.y; }
            const next = normalizePackagingDesign({ ...targetDesign, elements: previous ? targetDesign.elements.map(item => item.id === previous.id ? fitted : item) : [...targetDesign.elements, fitted] });
            latest.current.onChange({ ...current, designs: { ...current.designs, [target]: next } });
            if (current.active === target) onSelect(fitted.id);
          } catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed.'); }
        }} />
        <Field title="Text type"><select value={textRole} onChange={event => setTextRole(event.target.value)}>{['Brand name', 'Supporting text', 'Website / social handle', 'Thank-you message'].map(role => <option key={role}>{role}</option>)}</select></Field>
        <Field title={textRole}><input aria-label="New packaging text" maxLength={160} value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addText(); } }} /></Field>
        <button type="button" className="pkg-command" disabled={!text.trim()} onClick={addText}><Type size={15} />Add text</button>
        <div className="pkg-layers" aria-label="Packaging layers">{design.elements.filter(element => element.panel === design.selectedPanel).map(element => <button type="button" key={element.id} aria-pressed={selectedId === element.id} onClick={() => onSelect(element.id)}>{element.kind === 'text' ? <Type size={14} /> : <ImagePlus size={14} />}<span>{element.name}</span></button>)}</div>
      </section>
      {selected && <section data-packaging-layer-controls><h3>{selected.name}</h3>
        {selected.kind === 'text' && <>
          <Field title="Text"><input aria-label="Selected packaging text" maxLength={160} value={selected.content} onChange={event => updateElement({ content: event.target.value, ...textMetrics(event.target.value, selected.font, selected.fontSize) })} /></Field>
          <div className="pkg-two"><Field title="Font"><select aria-label="Packaging font" value={selected.font} onChange={event => updateElement({ font: event.target.value, ...textMetrics(selected.content, event.target.value, selected.fontSize) })}>{['Georgia', 'Arial', 'Courier New'].map(font => <option key={font}>{font}</option>)}</select></Field><Field title="Text colour"><input aria-label="Packaging text colour" type="color" value={selected.color} onChange={event => updateElement({ color: event.target.value })} /></Field></div>
          <Field title="Font size (mm)"><input aria-label="Packaging font size" type="number" min="1" max="100" step="0.5" value={Number(selected.fontSize.toFixed(1))} onChange={event => { const fontSize = Math.max(1, Number(event.target.value)); updateElement({ fontSize, ...textMetrics(selected.content, selected.font, fontSize) }); }} /></Field>
          <div className="pkg-actions" role="group" aria-label="Text alignment">{(['left', 'center', 'right'] as const).map((alignment, index) => { const Icon = [AlignLeft, AlignCenter, AlignRight][index]; return <button type="button" key={alignment} title={`Text align ${alignment}`} aria-label={`Text align ${alignment}`} aria-pressed={selected.align === alignment} onClick={() => updateElement({ align: alignment })}><Icon size={16} /></button>; })}</div>
        </>}
        <div className="pkg-two"><Field title="Width (mm)"><input aria-label="Artwork width" type="number" min="1" max="1000" step="1" value={Number(selected.width.toFixed(1))} onChange={event => resize(Number(event.target.value))} /></Field><Field title="Rotation (degrees)"><input aria-label="Artwork rotation" type="number" min="-180" max="180" value={selected.rotation} onChange={event => updateElement({ rotation: Math.max(-180, Math.min(180, Number(event.target.value))) })} /></Field>
          <Field title="Centre X (mm)"><input aria-label="Artwork X" type="number" step="1" value={Number(selected.x.toFixed(1))} onChange={event => updateElement({ x: Number(event.target.value) })} /></Field><Field title="Centre Y (mm)"><input aria-label="Artwork Y" type="number" step="1" value={Number(selected.y.toFixed(1))} onChange={event => updateElement({ y: Number(event.target.value) })} /></Field></div>
        <div className="pkg-actions"><Tool title="Align left" onClick={() => align('x', 'start')}><AlignLeft size={16} /></Tool><Tool title="Centre horizontally" onClick={() => align('x', 'center')}><AlignCenter size={16} /></Tool><Tool title="Align right" onClick={() => align('x', 'end')}><AlignRight size={16} /></Tool><Tool title="Align top" onClick={() => align('y', 'start')}><ArrowUpToLine size={16} /></Tool><Tool title="Centre vertically" onClick={() => align('y', 'center')}><BetweenHorizontalStart size={16} /></Tool><Tool title="Align bottom" onClick={() => align('y', 'end')}><ArrowDownToLine size={16} /></Tool></div>
        <div className="pkg-actions"><Tool title="Reset size" onClick={() => { const fitted = fitPackagingElement(selected, printRegion(design, selected.panel)); updateElement({ width: fitted.width, height: fitted.height, fontSize: fitted.fontSize }); }}><Maximize size={16} /></Tool><Tool title="Reset position" onClick={() => { const region = printRegion(design, selected.panel); updateElement({ x: region.x + region.width / 2, y: region.y + region.height / 2 }); }}><RotateCcw size={16} /></Tool>{selected.kind !== 'text' && <Tool title="Replace image" onClick={() => chooseUpload(selected.kind as 'logo' | 'artwork', selected.id)}><Upload size={16} /></Tool>}<Tool title="Duplicate layer" onClick={() => { const copied = { ...selected, id: crypto.randomUUID() }; update({ elements: [...design.elements, copied] }); onSelect(copied.id); }}><Copy size={16} /></Tool><Tool title="Remove layer" onClick={() => { update({ elements: design.elements.filter(element => element.id !== selected.id) }); onSelect(null); }}><Trash2 size={16} /></Tool></div>
      </section>}
      <section><h3>Manufacturing request</h3><textarea aria-label="Packaging manufacturing request" value={design.notes} maxLength={2000} rows={3} onChange={event => update({ notes: event.target.value })} /><p className="pkg-advisory">Concept only. Materials, colours, dimensions, print methods and dielines require manufacturer confirmation. No finishing method is selected.</p></section>
      <section><h3>Design presets</h3><Field title="Preset name"><input aria-label="Packaging preset name" maxLength={80} value={presetName} onChange={event => setPresetName(event.target.value)} /></Field><div className="pkg-actions"><button type="button" onClick={() => savePreset(false)}><Save size={15} />Save preset</button><Tool title="Duplicate design" onClick={() => savePreset(true)}><Copy size={16} /></Tool><Tool title="Reset template" onClick={() => { if (window.confirm('Reset this variation? Its colours, dimensions, notes and artwork will be removed. Saved presets and other variations will remain.')) { onChange({ ...value, designs: { ...value.designs, [value.active]: createPackagingDesign(value.active) } }); onSelect(null); setDimensions(createPackagingDesign(value.active).dimensions); } }}><RotateCcw size={16} /></Tool></div>
        {value.presets.map(preset => <div className="pkg-preset" key={preset.id}><button type="button" onClick={() => { if (value.designs[preset.design.templateId]?.elements.length && !window.confirm('Replace this variation with the saved preset?')) return; onChange({ ...value, active: preset.design.templateId, designs: { ...value.designs, [preset.design.templateId]: structuredClone(preset.design) } }); onSelect(null); setDimensions(preset.design.dimensions); }}>{preset.name}</button><Tool title={`Delete preset ${preset.name}`} onClick={() => onChange({ ...value, presets: value.presets.filter(item => item.id !== preset.id) })}><Trash2 size={14} /></Tool></div>)}
      </section>
      {packagingWarnings(design).map((warning, index) => <p className="pkg-advisory" key={`${index}-${warning}`}>{warning}</p>)}
    </>}
    {error && <p className="pkg-error" role="alert">{error}</p>}
  </div>;
}

export function PackagingDesignerPreview({ design, onChange, selectedId, onSelect, limited, onBoundary, garmentColor }: { design: PackagingDesign; onChange: (design: PackagingDesign) => void; selectedId: string | null; onSelect: (id: string | null) => void; limited: boolean; onBoundary: (limited: boolean) => void; garmentColor: string }) {
  const [guides, setGuides] = useState(true);
  const [contents, setContents] = useState(false);
  const [background, setBackground] = useState('light');
  const [zoom, setZoom] = useState(100);
  const stageRef = useRef<HTMLDivElement>(null);
  const resetFit = () => { setZoom(100); stageRef.current?.scrollTo({ left: 0, top: 0 }); };
  useEffect(() => { resetFit(); }, [design.templateId, design.view, design.selectedPanel, design.dimensions.width, design.dimensions.height, design.dimensions.depth]);
  useEffect(() => {
    const stage = stageRef.current;
    if (stage) stage.scrollTo({ left: (stage.scrollWidth - stage.clientWidth) / 2, top: (stage.scrollHeight - stage.clientHeight) / 2 });
  }, [zoom]);
  const isBulk = design.category === 'none';
  const template = packagingTemplate(design.templateId);
  const focusPanel: PackagingPanel = template.closure === 'tape' ? 'front' : 'top';
  const focusName = template.closure === 'tape' ? 'Front' : template.closure === 'drawer' ? 'Sleeve / Top' : 'Top / Lid';
  const views: PackagingView[] = design.category === 'box' ? ['closed', 'open', 'reverse', 'panel'] : ['front', 'back'];
  return <div className={`pkg-preview pkg-theme-${background}`} data-packaging-preview onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
    <div className="pkg-preview-toolbar">
      {!isBulk ? <div className="pkg-actions" role="group" aria-label="Packaging view">{views.map(view => <button type="button" key={view} aria-pressed={design.view === view && (view !== 'panel' || design.selectedPanel === focusPanel)} onClick={() => {
        const selectedPanel: PackagingPanel = view === 'front' || view === 'back' ? view : view === 'reverse' ? 'back' : view === 'open' ? template.panels.includes('interior-lid') ? 'interior-lid' : 'interior-base' : focusPanel;
        onChange({ ...design, view, selectedPanel }); onSelect(null); onBoundary(false);
      }}>{view === 'panel' ? focusName : view.charAt(0).toUpperCase() + view.slice(1)}</button>)}</div> : <span className="pkg-preview-title">Standard bulk shipping carton</span>}
      <div className="pkg-backgrounds" role="group" aria-label="Packaging preview background">{['light', 'dark', 'checkerboard'].map(option => <button type="button" className={`pkg-bg-${option}`} key={option} title={`${option} background`} aria-label={`${option} packaging background`} aria-pressed={background === option} onClick={() => setBackground(option)} />)}</div>
    </div>
    <div ref={stageRef} className={`pkg-stage pkg-bg-${background}`}><div className="pkg-preview-viewport" style={{ width: `${Math.max(100, zoom)}%`, height: `${Math.max(100, zoom)}%` }}><div className="pkg-preview-drawing" style={{ width: `${Math.min(100, zoom)}%`, height: `${Math.min(100, zoom)}%` }}><PackagingArtwork design={design} fit surfaceTone={background === 'dark' ? 'dark' : 'light'} guides={!isBulk && guides} contents={!isBulk && contents} garmentColor={garmentColor} selectedId={selectedId} onSelect={id => { const element = design.elements.find(item => item.id === id); if (element && element.panel !== design.selectedPanel) onChange({ ...design, selectedPanel: element.panel }); onSelect(id); }} onElementChange={(element, boundary) => { onBoundary(boundary); onChange({ ...design, selectedPanel: element.panel, elements: design.elements.map(item => item.id === element.id ? element : item) }); }} /></div></div></div>
    <div className="pkg-preview-footer">{!isBulk ? <><label className="pkg-check"><input type="checkbox" checked={guides} onChange={event => setGuides(event.target.checked)} />Print-safe guides</label>{template.transparency && <label className="pkg-check"><input type="checkbox" checked={contents} onChange={event => setContents(event.target.checked)} />Contents</label>}<span role="status" className={limited ? 'pkg-boundary' : ''}>{limited ? 'Print boundary reached' : PANEL_NAMES[design.selectedPanel]}</span></> : <span>Unbranded outer carton · Not customizable</span>}
      <div className="pkg-zoom" role="group" aria-label="Packaging zoom">
        <button type="button" title="Zoom out" aria-label="Zoom packaging out" disabled={zoom <= 50} onClick={() => setZoom(Math.max(50, zoom - 25))}><Minus size={15} /></button>
        <input type="range" aria-label="Packaging zoom" min="50" max="200" step="25" value={zoom} onChange={event => setZoom(Number(event.target.value))} />
        <button type="button" title="Zoom in" aria-label="Zoom packaging in" disabled={zoom >= 200} onClick={() => setZoom(Math.min(200, zoom + 25))}><Plus size={15} /></button>
        <output aria-live="polite">{zoom}%</output>
        <button type="button" title="Fit packaging to canvas" aria-label="Fit packaging to canvas" onClick={resetFit}><Maximize size={16} /></button>
      </div>
    </div>
  </div>;
}