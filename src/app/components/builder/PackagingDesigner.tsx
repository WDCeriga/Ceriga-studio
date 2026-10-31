import {SurfaceTextControls,SurfaceAppearanceControls} from './shell/SurfaceDesignControls';
import {PackagingPanelIllustration} from './PackagingPanelIllustration';
import {MaterialSelect} from './shell/MaterialSelect';
import {AdvancedColorPopover} from './PrintStudioColorPopover';
import {CanvasZoom} from './shell/CanvasZoom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Check, ArrowDownToLine, ArrowUpToLine, BetweenHorizontalStart, Copy, ImagePlus, Maximize, Minus, Plus, RotateCcw, Save, Trash2, Type, Upload } from 'lucide-react';
import { PackagingArtwork } from './PackagingArtwork';
import { PACKAGING_CATEGORIES, PACKAGING_TEMPLATES, PANEL_NAMES, packagingTemplate, panelSize,packagingElementRegion, createPackagingDesign, switchPackaging, normalizePackagingDesign, placePackagingText, packagingDimensionError, packagingWarnings, constrainPackagingElement, fitPackagingElement, printRegion, rotatedExtents, type PackagingCategory, type PackagingState, type PackagingDesign, type PackagingElement, type PackagingPanel, type PackagingView } from '../../data/packaging';
import './packaging.css';

function PackagingColour({title,value,onChange,onOpen,selected}:{title:string;value:string;onChange:(value:string)=>void;onOpen?:()=>void;selected?:boolean}){return <AdvancedColorPopover value={value} onChange={onChange} onOpenChange={open=>{if(open)onOpen?.()}}><button type="button" className="label-colour-chip pkg-colour-chip" aria-pressed={selected} aria-label={title}><i style={{background:value}}/><span>{title}<small>{value.toUpperCase()}</small></span></button></AdvancedColorPopover>}

function Field({ title, children }: { title: string; children: ReactNode }) { return <label className="pkg-field"><span>{title}</span>{children}</label>; }
function Tool({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) { return <button type="button" className="pkg-tool" title={title} aria-label={title} onClick={onClick}>{children}</button>; }
function textMetrics(content: string, font: string, size: number, options:import('../../lib/surfaceDesign').SurfaceTextOptions={},weight=400) {
  const context = document.createElement('canvas').getContext('2d');
  if (context) context.font = `${options.fontStyle??'normal'} ${weight} ${size}px "${font}"`;
  return { width: Math.max(size, (context?.measureText(content).width ?? content.length * size) + Math.max(0,content.length-1)*(options.tracking??0) + size + (options.outlineWidth??0)*2), height: size * 1.6+(options.outlineWidth??0)*2 };
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
  studioTool?: string;
}
export function PackagingDesigner({ value, onChange, selectedId, onSelect, onBoundary, hasGarmentMeasurements, legacy, studioTool }: DesignerProps) {
  const design = value.designs[value.active];
  const template = packagingTemplate(design.templateId);
  const selected = design.elements.find(element => element.id === selectedId);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [text, setText] = useState('');
  const [textTarget, setTextTarget] = useState('');
  const sectionOptions = design.elements.filter(e=>e.kind==='section'&&e.panel===design.selectedPanel);
  const textDestination = sectionOptions.find(e=>e.id===textTarget);
  const sectionLabel = (element:PackagingElement) => { const height=panelSize(design,element.panel).height; return element.name+' · '+(element.y<height/3?'Upper':element.y>height*2/3?'Lower':'Middle')+' · '+element.color.toUpperCase(); };
  const beginSectionText = (id:string) => { setTextTarget(id); onSelect(null); };
  const [textRole, setTextRole] = useState('Brand name');
  const [presetName, setPresetName] = useState('');
  const [dimensions, setDimensions] = useState(design.dimensions);
  useEffect(() => { setDimensions(design.dimensions); }, [design.dimensions.width, design.dimensions.height, design.dimensions.depth]);
  const uploadRef = useRef<HTMLInputElement>(null);
  const uploadIntent = useRef<{ kind: 'logo' | 'artwork'; replace?: string }>({ kind: 'logo' });
  const latest = useRef({ value, onChange }); latest.current = { value, onChange };
  const update = (patch: Partial<PackagingDesign>) => {
    const next = normalizePackagingDesign({ ...design, ...patch }, design);
    const limited = next.elements.some((element, index) => { const proposed=(patch.elements??design.elements)[index]; return proposed && (['x','y','width','height'] as const).some(key=>Math.abs(element[key]-proposed[key])>.01); });
    onBoundary(limited);
    onChange({ ...value, designs: { ...value.designs, [value.active]: next } });
  };
  const updateElement = (patch: Partial<PackagingElement>) => {
    if (!selected) return;
    if(selected.kind==='text'&&['content','font','fontSize','fontWeight','textOptions'].some(key=>key in patch)){
      const next={...selected,...patch};patch={...patch,...textMetrics(next.content,next.font,next.fontSize,next.textOptions,next.fontWeight)};
    }
    update({ elements: design.elements.map(element => element.id === selected.id ? { ...element, ...patch,...(patch.fullPanel!==true&&['x','y','width','height','rotation'].some(key=>key in patch)?{fullPanel:false}:{}) } : element) });
  };
  const currentText = useRef({ selected, updateElement });
  currentText.current = { selected, updateElement };
  useEffect(() => {
    if (selected?.kind !== 'text') return;
    const descriptor = `12px ${JSON.stringify(selected.font)}`;
    if (document.fonts.check(descriptor, selected.content)) return;
    let active = true;
    void document.fonts.load(descriptor, selected.content).then(() => {
      const current = currentText.current;
      if (active && current.selected?.id === selected.id && current.selected.font === selected.font) {
        current.updateElement(textMetrics(current.selected.content, current.selected.font, current.selected.fontSize));
      }
    }).catch(() => setError('This font could not be loaded. Please try again.'));
    return () => { active = false; };
  }, [selected?.id, selected?.font]);
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
    const fitted = placePackagingText(design, element, textDestination?.id);
    update({ elements: [...design.elements, fitted] }); onSelect(element.id); setText('');
  };
  const resize = (width: number) => { if (selected && Number.isFinite(width) && width > 0) { const factor = width / selected.width; updateElement({ width, height: selected.height * factor, fontSize: selected.fontSize * factor }); } };
  const align = (axis: 'x' | 'y', position: 'start' | 'center' | 'end') => {
    if (!selected) return;
    const region = packagingElementRegion(design,selected); const bounds = rotatedExtents(selected);
    const start = axis === 'x' ? region.x : region.y; const length = axis === 'x' ? region.width : region.height; const extent = axis === 'x' ? bounds.width : bounds.height;
    updateElement({ [axis]: start + (position === 'start' ? extent / 2 : position === 'center' ? length / 2 : length - extent / 2) });
  };
  const chooseUpload = (kind: 'logo' | 'artwork', replace?: string) => { uploadIntent.current = { kind, replace }; uploadRef.current?.click(); };
  const savePreset = (duplicate: boolean) => {
    const name = presetName.trim() || `${template.name}${duplicate ? ' copy' : ' preset'}`;
    onChange({ ...value, presets: [...value.presets, { id: crypto.randomUUID(), name, design: structuredClone(design) }] });
    setMessage(`${name} saved in this project.`); setPresetName('');
  };
  return <div className="pkg-editor" data-packaging-editor data-studio-tool={studioTool}>
    {studioTool?<>
      <div className="pkg-current-style" data-pkg-tool="Packaging type"><div className="pkg-current-style-art"><PackagingArtwork design={createPackagingDesign(design.templateId)} fit surfaceTone="light"/></div><div><strong>{template.name}</strong><small>{design.category==='none'?'Standard bulk delivery':template.material}</small></div></div>
      <details open className="pkg-disclosure pkg-style-disclosure" data-pkg-tool="Packaging type"><summary><span>Packaging type</span><small>{PACKAGING_CATEGORIES[design.category]}</small></summary><div className="pkg-categories" role="group" aria-label="Packaging category">{Object.entries(PACKAGING_CATEGORIES).map(([category,name])=><button type="button" key={category} aria-pressed={design.category===category} onClick={()=>chooseTemplate(PACKAGING_TEMPLATES.find(item=>item.category===category)!.id)}>{name}</button>)}</div></details>
      {design.category!=='none'&&<details open className="pkg-disclosure pkg-style-disclosure" data-pkg-tool="Packaging type"><summary><span>Style &amp; construction</span><small>{template.name}</small></summary><div className="pkg-template-grid pkg-compact-style-grid">{PACKAGING_TEMPLATES.filter(item=>item.category===design.category).map(item=><button key={item.id} aria-label={'Choose '+item.name} aria-pressed={item.id===design.templateId} onClick={()=>chooseTemplate(item.id)}><span className="pkg-template-art"><PackagingArtwork design={createPackagingDesign(item.id)} fit surfaceTone="light"/></span><strong>{item.name}</strong><small>{item.material}</small>{item.id===design.templateId&&<Check className="pkg-template-selected" size={12}/>}</button>)}</div></details>}
    </>:<><section data-pkg-tool="Packaging type"><h3>Choose your packaging</h3><div className="pkg-categories" role="group" aria-label="Packaging category">{Object.entries(PACKAGING_CATEGORIES).map(([category,name])=><button type="button" key={category} aria-pressed={design.category===category} onClick={()=>chooseTemplate(PACKAGING_TEMPLATES.find(item=>item.category===category)!.id)}>{name}</button>)}</div></section>{design.category!=='none'&&<Field title="Variation"><MaterialSelect aria-label="Packaging variation" value={design.templateId} onChange={event=>chooseTemplate(event.target.value)}>{PACKAGING_TEMPLATES.filter(item=>item.category===design.category).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</MaterialSelect></Field>}</>}
    {error && <p className="pkg-error" role="alert">{error}</p>}
    {message && <p role="status" aria-live="polite" className="pkg-feedback">{message}</p>}
    {design.category === 'none' ? <p className="pkg-advisory">No individual custom packaging is included. Garments will be packed in a standard, unbranded bulk shipping carton for delivery.</p> : <>
      {legacy && <p className="pkg-advisory">Legacy artwork has been fitted into safe regions. Original legacy data is retained; review each placement.</p>}
      <section className="pkg-material-section" data-pkg-tool="Material & size"><details open className="pkg-disclosure"><summary>Material &amp; colour</summary><div className="pkg-material-heading"><span>Material</span><strong>{design.material}</strong></div><div className={design.category==='box'?'pkg-two':'pkg-material-single'}>
        <PackagingColour title="Exterior colour" selected={!design.selectedPanel.startsWith('interior')} onOpen={()=>{if(design.category==='box'){update({view:'closed',selectedPanel:template.panels.includes('top')?'top':'front'});onSelect(null)}}} value={design.exterior} onChange={exterior=>update({exterior})}/>
        {design.category === 'box' && <PackagingColour title="Interior colour" selected={design.selectedPanel.startsWith('interior')} onOpen={()=>{update({view:'open',selectedPanel:template.panels.includes('interior-lid')?'interior-lid':'interior-base'});onSelect(null)}} value={design.interior} onChange={interior=>update({interior})}/>}
      </div>{studioTool&&template.transparency&&<div className="pkg-appearance"><span className="pkg-appearance-label">Transparency</span><div className="pkg-segmented" role="group" aria-label="Material appearance">{[{name:'Clear',value:.18},{name:'Soft frost',value:.4},{name:'Dense frost',value:.7}].map(option=><button key={option.name} aria-pressed={Math.abs(design.opacity-option.value)<.05} onClick={()=>update({opacity:option.value})}>{option.name}</button>)}</div><p className="pkg-inline-help">Choose how much of the garment shows through the bag.</p></div>}{!studioTool&&template.transparency && <Field title={`Material opacity ${Math.round(design.opacity * 100)}%`}><input aria-label="Material opacity" type="range" min="10" max="90" value={Math.round(design.opacity * 100)} onChange={event => update({ opacity: Number(event.target.value) / 100 })} /></Field>}</details></section>
      <section data-pkg-tool="Material & size"><details open className="pkg-disclosure"><summary>Size</summary>{studioTool&&<div className="pkg-size-presets" role="group" aria-label="Starting dimensions">{[{name:'Compact',width:250,height:330,depth:60},{name:'Regular',width:300,height:380,depth:80},{name:'Roomy',width:350,height:450,depth:120}].map(option=><button type="button" key={option.name} aria-pressed={dimensions.width===option.width&&dimensions.height===option.height&&(design.category!=='box'||dimensions.depth===option.depth)} onClick={()=>setDimensions({width:option.width,height:option.height,depth:option.depth})}><strong>{option.name}</strong><small>{option.width} × {option.height}{design.category==='box'?` × ${option.depth}`:''} mm</small></button>)}</div>}<div className="pkg-two">{(['width', 'height', ...(design.category === 'box' ? ['depth'] : [])] as const).map(dimension => <Field key={dimension} title={`${dimension === 'height' ? 'Length' : dimension==='width'?'Width':'Depth'} (mm)`}><input aria-label={`Packaging ${dimension} mm`} type="number" min={dimension === 'depth' ? 20 : 100} max={dimension === 'depth' ? 500 : 1000} value={dimensions[dimension as keyof typeof dimensions]} onChange={event => setDimensions({ ...dimensions, [dimension]: Number(event.target.value) })} /></Field>)}</div>
        <button type="button" className="pkg-command" disabled={design.dimensionsConfirmed && dimensions.width===design.dimensions.width && dimensions.height===design.dimensions.height && dimensions.depth===design.dimensions.depth} onClick={() => { const problem = packagingDimensionError(dimensions, design.category); if (problem) { setError(problem); return; } setError(''); update({ dimensions, dimensionsConfirmed: true }); setMessage('Packaging dimensions updated.'); }}>Apply dimensions</button>
        <p className="pkg-advisory">{design.dimensions.width} x {design.dimensions.height}{design.category === 'box' ? ` x ${design.dimensions.depth}` : ''} mm{design.dimensionsConfirmed ? ' requested' : ' illustrative'}.</p>
        <p className="pkg-advisory">{hasGarmentMeasurements ? 'Garment measurements are available, but folded dimensions are unknown.' : 'Folded garment dimensions are unknown.'} Confirm folded width, length, thickness and packing allowance before production.</p>
      </details></section>
      <section hidden={Boolean(selected)} data-pkg-tool="Design"><details open className="pkg-disclosure"><summary>Print panel</summary><div className="pkg-panel-choices" role="group" aria-label="Print surface">{template.panels.map(panel=><button type="button" key={panel} aria-label={`Edit ${PANEL_NAMES[panel]} panel`} aria-pressed={design.selectedPanel===panel} onClick={()=>selectPanel(panel)}><PackagingPanelIllustration panel={panel} box={design.category==='box'}/><span>{PANEL_NAMES[panel]}</span></button>)}</div>
        {design.category === 'mailer' && <label className="pkg-check"><input type="checkbox" checked={design.shippingLabel} onChange={event => { if (event.target.checked && design.elements.some(element => element.panel === 'front') && !window.confirm('Reserve the front-right area for a shipping label? Front branding will be fitted into the remaining print-safe area.')) return; update({ shippingLabel: event.target.checked }); }} />Reserve shipping-label area</label>}
      </details></section>
      <section hidden={Boolean(studioTool&&selected)} data-pkg-tool="Design"><details open className="pkg-disclosure"><summary>Add artwork</summary><div className="pkg-actions"><button type="button" onClick={() => chooseUpload('logo')}><Upload size={15} />Logo</button><button type="button" onClick={() => chooseUpload('artwork')}><ImagePlus size={15} />Artwork</button>{design.category==='box'&&!design.selectedPanel.startsWith('interior')&&<button onClick={()=>{const size=panelSize(design,design.selectedPanel),element:PackagingElement={id:crypto.randomUUID(),kind:'section',panel:design.selectedPanel,content:'',name:'Colour section '+(design.elements.filter(e=>e.kind==='section').length+1),fullPanel:false,x:size.width/2,y:size.height/2,width:size.width,height:size.height*.3,rotation:0,color:design.exterior.toLowerCase()==='#35414e'?'#f2c995':'#35414e',font:'Arial',fontSize:12,align:'center'};update({elements:[...design.elements,element]});onSelect(element.id)}}>+ Colour section</button>}</div>
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
        <div className="pkg-add-text"><h4>Add text</h4><Field title="Place text in"><MaterialSelect aria-label="New text destination" value={textDestination?.id??'panel'} onChange={event=>setTextTarget(event.target.value==='panel'?'':event.target.value)}><option value="panel">Whole {PANEL_NAMES[design.selectedPanel]} panel</option>{sectionOptions.map(e=><option key={e.id} value={e.id}>{sectionLabel(e)}</option>)}</MaterialSelect></Field><Field title="Text type"><MaterialSelect value={textRole} onChange={event => setTextRole(event.target.value)}>{['Brand name', 'Supporting text', 'Website / social handle', 'Thank-you message'].map(role => <option key={role}>{role}</option>)}</MaterialSelect></Field>
        <Field title={textRole}><input aria-label="New packaging text" placeholder="Enter your brand name or message" maxLength={160} value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addText(); } }} /></Field>
        <button type="button" className="pkg-command" disabled={!text.trim()} onClick={addText}><Type size={15} />Add text{textDestination?' to '+textDestination.name:' to panel'}</button></div><h4 className="pkg-layer-list-title">Layers on this panel</h4>{!design.elements.some(e=>e.panel===design.selectedPanel)&&<p className="pkg-inline-help">No layers yet. Add a colour section, image or text above.</p>}
        <div className="pkg-layers" aria-label="Packaging layers">{design.elements.filter(element => element.panel === design.selectedPanel).map(element => <button type="button" key={element.id} aria-pressed={selectedId === element.id} onClick={() => onSelect(element.id)}>{element.kind==='section'?<i className="pkg-layer-thumb" style={{background:element.color}}/>:element.kind === 'text' ? <Type size={20} /> : <img className="pkg-layer-thumb" src={element.content} alt=""/>}<span>{element.kind==='text'?element.content||'Empty text':element.name}<small>{element.kind==='section'?'Colour section':element.kind==='text'?(design.elements.find(e=>e.id===element.sectionId)?.name??'Panel text'):'Image'} · {PANEL_NAMES[element.panel]}</small></span></button>)}</div>
      </details></section>
      {selected && <section className="pkg-layer-editor" data-packaging-layer-controls data-pkg-tool="Design" key={selected.id}>
        <header className="pkg-edit-heading">
          <button type="button" className="pkg-back-link" onClick={()=>onSelect(null)}>← All layers</button>
          <span className="pkg-type-badge">{selected.kind==='section'?'Colour section':selected.kind==='text'?'Text':'Image'}</span>
        </header>
        <div className="pkg-selected-artwork">
          <div className="pkg-artwork-thumb">{selected.kind==='section'?<i style={{background:selected.color,width:'100%',height:'100%'}}/>:selected.kind==='text'?<Type size={24}/>:<img src={selected.content} alt=""/>}</div>
          <div className="pkg-layer-identity"><strong>{selected.kind==='text'?selected.content||'Add your text':selected.name}</strong><small>{PANEL_NAMES[selected.panel]} · {selected.kind==='section'?'Drag edges to resize':'Drag on canvas to move'}</small></div>
        </div>
        {selected.kind==='section'?<>
          <details open className="pkg-control-card pkg-more-controls"><summary>Colour &amp; layout</summary><button type="button" className="pkg-command" onClick={()=>beginSectionText(selected.id)}><Type size={15}/>Add text to this section</button>
            <PackagingColour title="Section colour" value={selected.color} onChange={color=>updateElement({color})}/>
            <p className="pkg-control-label">Start with a layout</p>
            <div className="pkg-layout-grid" role="group" aria-label="Colour section layout">{['Full panel','Horizontal','Vertical','Diagonal left','Diagonal right'].map((layout,index)=><button type="button" key={layout} aria-pressed={index===0?Boolean(selected.fullPanel):undefined} onClick={()=>{const size=panelSize(design,selected.panel),length=Math.hypot(size.width,size.height)*1.2;updateElement({x:size.width/2,y:size.height/2,width:index===0?size.width:index===2?size.width*.3:index>2?length:size.width,height:index===0||index===2?size.height:size.height*.3,rotation:index===3?-Math.atan2(size.height,size.width)*180/Math.PI:index===4?Math.atan2(size.height,size.width)*180/Math.PI:0,fullPanel:index===0})}}><i aria-hidden="true" className={'pkg-layout-icon pkg-layout-'+index}/><span>{layout}</span></button>)}</div>
          </details>
          <details className="pkg-control-card pkg-more-controls"><summary>Size &amp; angle</summary>
            <div className="pkg-two"><Field title="Width (mm)"><input aria-label="Section width" type="number" min="1" value={Number(selected.width.toFixed(1))} onChange={event=>updateElement({width:Math.max(1,Number(event.target.value))})}/></Field><Field title="Height (mm)"><input aria-label="Section height" type="number" min="1" value={Number(selected.height.toFixed(1))} onChange={event=>updateElement({height:Math.max(1,Number(event.target.value))})}/></Field></div>
            <div className="pkg-angle-row"><Field title="Angle"><input aria-label="Section angle" type="range" min="-180" max="180" step="1" value={((selected.rotation+180)%360+360)%360-180} onChange={event=>updateElement({rotation:Number(event.target.value)})}/></Field><Field title="Degrees"><input aria-label="Section angle degrees" type="number" value={Number(selected.rotation.toFixed(1))} onChange={event=>updateElement({rotation:Number(event.target.value)})}/></Field></div>
            <p className="pkg-inline-help">Pull a white edge handle to stretch one side. Colour outside the panel is cropped.</p>
          </details>
        </>:selected.kind==='text'?<details open className="pkg-control-card pkg-more-controls"><summary>Text &amp; style</summary>
          <Field title="Your text"><input className="pkg-text-content-field" placeholder="Type your text…" aria-label="Selected packaging text" maxLength={160} value={selected.content} onChange={event=>updateElement({content:event.target.value,...textMetrics(event.target.value,selected.font,selected.fontSize)})}/></Field>
          <div className="pkg-two"><Field title="Weight"><MaterialSelect aria-label="Packaging text weight" value={selected.fontWeight??400} onChange={e=>updateElement({fontWeight:Number(e.target.value)})}>{[[400,'Regular'],[500,'Medium'],[600,'Semibold'],[700,'Bold'],[800,'Heavy']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</MaterialSelect></Field><Field title="Size (mm)"><input aria-label="Packaging font size" type="number" min="1" max="100" step=".5" value={Number(selected.fontSize.toFixed(1))} onChange={event=>{const fontSize=Math.max(1,Math.min(100,Number(event.target.value)));updateElement({fontSize,...textMetrics(selected.content,selected.font,fontSize)})}}/></Field></div>
          <SurfaceTextControls font={selected.font} onFont={font=>updateElement({font,...textMetrics(selected.content,font,selected.fontSize)})} options={selected.textOptions} onChange={patch=>updateElement({textOptions:{...selected.textOptions,...patch}})}/><PackagingColour title="Text colour" value={selected.color} onChange={color=>updateElement({color})}/>
          <div className="pkg-segmented" role="group" aria-label="Text alignment">{(['left','center','right'] as const).map((alignment,index)=>{const Icon=[AlignLeft,AlignCenter,AlignRight][index];return <button type="button" key={alignment} aria-label={'Text align '+alignment} aria-pressed={selected.align===alignment} onClick={()=>updateElement({align:alignment})}><Icon size={16}/>{['Left','Centre','Right'][index]}</button>})}</div>
        </details>:<details open className="pkg-control-card pkg-more-controls"><summary>Image size</summary><Field title="Width (mm) · proportions locked"><input aria-label="Artwork width" type="number" min="1" max="1000" value={Number(selected.width.toFixed(1))} onChange={event=>resize(Number(event.target.value))}/></Field><div className="pkg-segmented"><button type="button" onClick={()=>resize(selected.width*.9)}><Minus size={15}/>Smaller</button><button type="button" onClick={()=>resize(selected.width*1.1)}><Plus size={15}/>Larger</button><button type="button" onClick={()=>chooseUpload(selected.kind as 'logo'|'artwork',selected.id)}><Upload size={15}/>Replace</button></div></details>}
        {selected.kind==='section'&&<SurfaceAppearanceControls value={selected.appearance} onChange={patch=>updateElement({appearance:{...selected.appearance,...patch}})}/>}
        <details className="pkg-control-card pkg-more-controls pkg-layer-settings"><summary>Layer settings</summary>
        <div className="pkg-two">
          <Field title="Layer name"><input aria-label="Layer name" maxLength={80} value={selected.name} onChange={event=>updateElement({name:event.target.value})}/></Field>
          <Field title="Switch layer"><MaterialSelect aria-label="Selected packaging artwork" value={selected.id} onChange={event=>{const next=design.elements.find(e=>e.id===event.target.value);if(next){update({selectedPanel:next.panel,view:design.category==='box'?'panel':next.panel==='back'?'back':'front'});onSelect(next.id)}}}>{design.elements.map(element=><option key={element.id} value={element.id}>{element.name} · {PANEL_NAMES[element.panel]}</option>)}</MaterialSelect></Field>
        </div>

          {selected.kind==='text'&&<><Field title="Text belongs to"><MaterialSelect aria-label="Text section" value={selected.sectionId??'panel'} onChange={event=>{const placed=placePackagingText(design,selected,event.target.value==='panel'?undefined:event.target.value);updateElement(placed)}}><option value="panel">Whole panel · unlinked</option>{design.elements.filter(e=>e.kind==='section'&&e.panel===selected.panel).map(e=><option key={e.id} value={e.id}>{e.name} · {e.color.toUpperCase()}</option>)}</MaterialSelect></Field><p className="pkg-inline-help">Linked text moves with its colour section. Choose another section to move it there.</p></>}
        </details>
        <details className="pkg-control-card pkg-more-controls"><summary>Position &amp; alignment</summary><p className="pkg-inline-help">Drag on the canvas or align to this panel.</p>
          <div className="pkg-alignment-grid" role="group" aria-label="Panel alignment">{([{axis:'x',position:'start',label:'Left',Icon:AlignLeft},{axis:'x',position:'center',label:'Centre',Icon:AlignCenter},{axis:'x',position:'end',label:'Right',Icon:AlignRight},{axis:'y',position:'start',label:'Top',Icon:ArrowUpToLine},{axis:'y',position:'center',label:'Middle',Icon:BetweenHorizontalStart},{axis:'y',position:'end',label:'Bottom',Icon:ArrowDownToLine}] as const).map(({axis,position,label,Icon})=><button type="button" key={axis+position} aria-label={'Align '+label.toLowerCase()} onClick={()=>align(axis,position)}><Icon size={16}/>{label}</button>)}</div>
          <details className="pkg-precision"><summary>Precise position{selected.kind!=='section'?' & rotation':''}</summary><div className="pkg-two"><Field title="Centre X (mm)"><input aria-label="Artwork X" type="number" value={Number(selected.x.toFixed(1))} onChange={event=>updateElement({x:Number(event.target.value)})}/></Field><Field title="Centre Y (mm)"><input aria-label="Artwork Y" type="number" value={Number(selected.y.toFixed(1))} onChange={event=>updateElement({y:Number(event.target.value)})}/></Field></div>{selected.kind!=='section'&&<Field title="Angle (degrees)"><input aria-label="Artwork rotation" type="number" min="-180" max="180" value={selected.rotation} onChange={event=>updateElement({rotation:Math.max(-180,Math.min(180,Number(event.target.value)))})}/></Field>}</details>
        </details>
        <footer className="pkg-layer-actions"><button type="button" onClick={()=>{const copied={...selected,id:crypto.randomUUID(),name:selected.name+' copy'};update({elements:[...design.elements,copied]});onSelect(copied.id)}}><Copy size={15}/>Duplicate</button>{<><button type="button" onClick={()=>update({elements:[...design.elements.filter(e=>e.id!==selected.id),selected]})}>To front</button><button type="button" onClick={()=>update({elements:[selected,...design.elements.filter(e=>e.id!==selected.id)]})}>To back</button></>}<button type="button" className="pkg-delete-layer" onClick={()=>{update({elements:design.elements.filter(e=>e.id!==selected.id)});onSelect(null)}}><Trash2 size={15}/>Delete</button></footer>
      </section>}
      {!studioTool&&<section data-pkg-tool="Production"><h3>Manufacturing request</h3><textarea aria-label="Packaging manufacturing request" value={design.notes} maxLength={2000} rows={3} onChange={event => update({ notes: event.target.value })} /><p className="pkg-advisory">Concept only. Materials, colours, dimensions, print methods and dielines require manufacturer confirmation. No finishing method is selected.</p></section>}
      <section data-pkg-tool={studioTool?"Packaging type":"Production"}><details className="pkg-disclosure pkg-saved-designs"><summary>Saved packaging designs</summary><Field title="Preset name"><input aria-label="Packaging preset name" maxLength={80} value={presetName} onChange={event => setPresetName(event.target.value)} /></Field><div className="pkg-actions"><button type="button" onClick={() => savePreset(false)}><Save size={15} />Save preset</button><Tool title="Duplicate design" onClick={() => savePreset(true)}><Copy size={16} /></Tool><Tool title="Reset template" onClick={() => { if (window.confirm('Reset this variation? Its colours, dimensions, notes and artwork will be removed. Saved presets and other variations will remain.')) { onChange({ ...value, designs: { ...value.designs, [value.active]: createPackagingDesign(value.active) } }); onSelect(null); setDimensions(createPackagingDesign(value.active).dimensions); } }}><RotateCcw size={16} /></Tool></div>
        {value.presets.map(preset => <div className="pkg-preset" key={preset.id}><button type="button" onClick={() => { if (value.designs[preset.design.templateId]?.elements.length && !window.confirm('Replace this variation with the saved preset?')) return; onChange({ ...value, active: preset.design.templateId, designs: { ...value.designs, [preset.design.templateId]: structuredClone(preset.design) } }); onSelect(null); setDimensions(preset.design.dimensions); }}>{preset.name}</button><Tool title={`Delete preset ${preset.name}`} onClick={() => onChange({ ...value, presets: value.presets.filter(item => item.id !== preset.id) })}><Trash2 size={14} /></Tool></div>)}
      </details></section>
      {packagingWarnings(design).map((warning, index) => <p className="pkg-advisory" key={`${index}-${warning}`}>{warning}</p>)}
    </>}

  </div>;
}

export function PackagingDesignerPreview({ design, onChange, selectedId, onSelect, limited, onBoundary, garmentColor, garmentType,garmentPreview,studio=false }: { garmentPreview?:(reverse:boolean)=>ReactNode;studio?:boolean;design: PackagingDesign; onChange: (design: PackagingDesign) => void; selectedId: string | null; onSelect: (id: string | null) => void; limited: boolean; onBoundary: (limited: boolean) => void; garmentColor: string; garmentType?: string }) {
  useEffect(()=>{const remove=(event:KeyboardEvent)=>{if(!selectedId||event.defaultPrevented||!['Backspace','Delete'].includes(event.key)||(event.target as Element)?.closest('input,textarea,select,[contenteditable="true"],[role="combobox"],[role="dialog"]'))return;event.preventDefault();onChange({...design,elements:design.elements.filter(element=>element.id!==selectedId)});onSelect(null)};window.addEventListener('keydown',remove);return()=>window.removeEventListener('keydown',remove)},[selectedId,design,onChange,onSelect]);
  const [guides, setGuides] = useState(()=>{try{return JSON.parse(localStorage.getItem('ceriga.packaging.guides')??JSON.stringify(!studio))===true}catch{return !studio}});
  const [contents, setContents] = useState(()=>{try{return localStorage.getItem('ceriga.packaging.contents')==='true'}catch{return false}});
  useEffect(()=>{try{localStorage.setItem('ceriga.packaging.guides',JSON.stringify(guides));localStorage.setItem('ceriga.packaging.contents',JSON.stringify(contents))}catch{}},[guides,contents]);
  const [background, setBackground] = useState('light');
  const [zoom, setZoom] = useState(100);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize,setStageSize]=useState({width:0,height:0});
  useEffect(()=>{const stage=stageRef.current;if(!stage)return;const measure=()=>setStageSize(old=>old.width===stage.clientWidth&&old.height===stage.clientHeight?old:{width:stage.clientWidth,height:stage.clientHeight});measure();const observer=new ResizeObserver(measure);observer.observe(stage);return()=>observer.disconnect()},[]);
  const resetFit = () => { setZoom(100); stageRef.current?.scrollTo({ left: 0, top: 0 }); };
  // Keep the chosen zoom when switching packaging; only Fit resets it.
  useEffect(() => {
    const stage = stageRef.current;
    if (stage) stage.scrollTo({ left: (stage.scrollWidth - stage.clientWidth) / 2, top: (stage.scrollHeight - stage.clientHeight) / 2 });
  }, [zoom, design.templateId, design.view, design.selectedPanel, design.dimensions.width, design.dimensions.height, design.dimensions.depth]);
  const isBulk = design.category === 'none';
  const template = packagingTemplate(design.templateId);
  const focusPanel: PackagingPanel = template.closure === 'tape' ? 'front' : 'top';
  const activePanel = design.view==='panel'?design.selectedPanel:focusPanel;
  const focusName = design.view==='panel'?PANEL_NAMES[design.selectedPanel]:template.closure === 'tape' ? 'Front' : template.closure === 'drawer' ? 'Sleeve / Top' : 'Top / Lid';
  const views: PackagingView[] = design.category === 'box' ? ['closed', 'open', 'reverse', 'panel'] : ['front', 'back'];
  return <div className={`pkg-preview pkg-theme-${background}`} data-studio={studio||undefined} data-packaging-preview onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
    <div className="pkg-preview-toolbar">
      {!isBulk ? <div className={studio?"new-view-switch":"pkg-actions"} role="group" aria-label="Packaging view">{views.map(view => <button type="button" key={view} aria-pressed={design.view === view && (view !== 'panel' || design.selectedPanel === activePanel)} onClick={() => {
        const selectedPanel: PackagingPanel = view === 'front' || view === 'back' ? view : view === 'reverse' ? 'back' : view === 'open' ? template.panels.includes('interior-lid') ? 'interior-lid' : 'interior-base' : activePanel;
        onChange({ ...design, view, selectedPanel }); onSelect(null); onBoundary(false);
      }}>{view === 'panel' ? focusName : view.charAt(0).toUpperCase() + view.slice(1)}</button>)}{template.closure === 'drawer' && <button type="button" aria-pressed={design.view === 'panel' && design.selectedPanel === 'interior-base'} onClick={() => {
        onChange({ ...design, view: 'panel', selectedPanel: 'interior-base' }); onSelect(null); onBoundary(false);
      }}>Interior Base</button>}</div> : <span className="pkg-preview-title">Standard bulk shipping carton</span>}
      {!studio&&<div className="pkg-backgrounds" role="group" aria-label="Packaging preview background">{['light', 'dark', 'checkerboard'].map(option => <button type="button" className={`pkg-bg-${option}`} key={option} title={`${option} background`} aria-label={`${option} packaging background`} aria-pressed={background === option} onClick={() => setBackground(option)} />)}</div>}
    </div>
    <div ref={stageRef} className={`pkg-stage pkg-bg-${background}`} onPointerDown={event=>{ const target=event.target as Element; if(!target.closest('[data-packaging-element], [data-packaging-section-controls], [data-artwork-selection]')){onSelect(null);onBoundary(false);} }}><div className="pkg-preview-viewport" style={{ width: stageSize.width?stageSize.width*Math.max(1,zoom/100):'100%', height:stageSize.height?stageSize.height*Math.max(1,zoom/100):'100%' }}><div className="pkg-preview-drawing" style={{ width:stageSize.width?stageSize.width*zoom/100:'100%', height:stageSize.height?stageSize.height*zoom/100:'100%' }}><PackagingArtwork garmentPreview={garmentPreview} design={design} fit surfaceTone={background === 'dark' ? 'dark' : 'light'} guides={!isBulk && guides} contents={!isBulk && contents} garmentColor={garmentColor} garmentType={garmentType} selectedId={selectedId} onSelect={id => { const element = design.elements.find(item => item.id === id); if (element && element.panel !== design.selectedPanel) onChange({ ...design, selectedPanel: element.panel }); onSelect(id); }} onElementChange={(element, boundary) => { onBoundary(boundary); onChange(normalizePackagingDesign({ ...design, selectedPanel: element.panel, elements: design.elements.map(item => item.id === element.id ? element : item) }, design)); }} /></div></div></div>
    <div className={studio?"pkg-canvas-controls":"pkg-preview-footer"}>{!isBulk ? <><label className="pkg-check"><input type="checkbox" checked={guides} onChange={event => setGuides(event.target.checked)} />Print-safe guides</label>{(template.transparency || design.category === 'box') && <label className="pkg-check"><input type="checkbox" checked={contents} onChange={event => setContents(event.target.checked)} />Contents</label>}<span role="status" className={limited ? 'pkg-boundary' : 'pkg-panel-status'}>{limited ? 'Panel edge reached' : 'Editing '+PANEL_NAMES[design.selectedPanel]}</span></> : <span>Unbranded outer carton · Not customizable</span>}
      <CanvasZoom className={studio?"new-zoom-control":""} value={zoom} min={50} max={200} step={25} onChange={setZoom} onFit={resetFit}/>
    </div>
  </div>;
}
