import {useAssetWorkspaceContext} from '../printsStudio/AssetWorkspace';
import {useArtworkDismissal} from './useArtworkDismissal';
import './artwork-workspace-polish.css';
import {BuilderTooltips} from './BuilderTooltips';
import {PRINT_TOOL_GROUPS} from './PrintDesignStudio';
import {usePrintsStudio} from '../printsStudio/PrintsStudioContext';
import './phone-builder-refinements.css';
import { PrintDesignNavigation } from './PrintDesignStudio';
import {StudioWorkflowContext,useStudioWorkflow,LABEL_TOOLS,PACKAGING_TOOLS} from './StudioWorkflow';
import {MobileToolTabs,MobileSectionTools,MobileSectionToolsContext} from './MobileToolTabs';
import {MATERIAL_TOOLS,type MaterialTool} from './MaterialsInspector';
import {BuilderSheet,ResponsiveBuilderContext,useResponsiveBuilder,useBuilderWidth,sheetSnapHeight,type BuilderPanel,type SheetSnap} from './responsiveBuilder';
import {Maximize2,MoreHorizontal,Plus,SlidersHorizontal,Palette,Grid2X2,BookOpen,Blend} from 'lucide-react';
import { useRef, useState, useEffect, useMemo, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Ruler, FileText, Layers, Settings2, PenLine, Tag, Package, ClipboardCheck, Upload, Undo2, Redo2, History, CirclePlus, ScanLine, TableProperties, FileUp, Shirt, Scissors, FoldVertical, Unplug, Droplets, Rows3, ClipboardList, Settings } from 'lucide-react';
import './builder-shell.css';
import './builder-harmony.css';
import './builder-responsive.css';
import './builder-canvas-first.css';
import './artwork-usability.css';
export const BUILDER_SECTIONS = ['Fit & Measurements', 'Materials & Colour', 'Construction', 'Artwork & Graphics', 'Labels & Branding', 'Packaging', 'Order & quantities'] as const;
export type BuilderSection = typeof BUILDER_SECTIONS[number];
export type MeasurementTool = 'Core measurements' | 'Advanced sizing' | 'Add custom measurement' | 'Import measurements' | 'Upload reference';
const icons = [Ruler, Layers, Settings, PenLine, Tag, Package, ClipboardList];
function ConstructionToolIcon({index}:{index:number}){
 const iconIndex=index===4?6:index===5?4:index===6?5:index; const paths=[
  <><path d="m3 6 5-3 4 5 4-5 5 3-4 6-5-4-5 4Z"/><path d="m8 3 1 4m7-4-1 4"/></>,
  <><path d="m4 6 7-3 10 12-7 5L5 11Z"/><path d="m12 16 7-5"/></>,
  <><path d="M4 4v15h16V4M4 15h16"/><path d="M7 17h1m3 0h2m3 0h1"/></>,
  <><path d="M8 3v18m8-18v18M12 3v18"/><path d="M10 5h2m0 3h2m-4 3h2m0 3h2m-4 3h2m0 3h2"/><rect x="9" y="4" width="6" height="5" rx="1"/></>,
  <><path d="M3 8h3m3 0h3m3 0h3m3 0h1M3 16h3m3 0h3m3 0h3m3 0h1"/></>,
  <><path d="M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Z"/><path d="M8 15a4 4 0 0 0 4 4"/></>
 ];if(iconIndex===6)return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 4h16v16H4ZM4 16 20 8M12 4v16" strokeDasharray="3 2"/></svg>;return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[iconIndex]}</svg>
}
export const MEASUREMENT_TOOLS=['Core measurements','Advanced sizing','Add custom measurement','Import measurements'] as const;
const construction = ['Neck & Collar', 'Sleeves', 'Hem & Cuffs', 'Details & trims', 'Seams & panelling', 'Stitching', 'Wash & Finish'];
export function BuilderTopBar({
  name,
  onName,
  background,
  onBackground,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onHistory,
  onReview,
  onSave,
  status,
  legacyUrl,onSaveVersion
}: {
  name: string;
  onName: (v: string) => void;
  background: string;
  onBackground: (v: 'white' | 'black' | 'beige' | 'transparent') => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onHistory: () => void;
  onReview: () => void;
  onSave: () => void;
  status: string;
  legacyUrl: string;onSaveVersion:()=>void;
}) {
  const [rename, setRename] = useState(false);
 const responsive=useResponsiveBuilder();const menu=responsive.panel==='menu';
  return <header className="builder-topbar"><div className="builder-breadcrumb"><a href="/catalog" aria-label="Back to products"><ArrowLeft size={16} /></a><span className="desktop-breadcrumb-prefix">Products /</span>{rename ? <input className="builder-name-input" size={Math.max(8,Math.min(name.length,34))} aria-label="Product name" value={name} onChange={e => onName(e.target.value)} onBlur={() => setRename(false)} onKeyDown={e => e.key === 'Enter' && setRename(false)} autoFocus /> : <button className="builder-name" onClick={() => setRename(true)} title="Rename project">{name}</button>}<span className="builder-draft">Draft</span></div><div className="phone-history-actions"><button aria-label="Undo" disabled={!canUndo} onClick={onUndo}><Undo2 size={16}/></button><button aria-label="Redo" disabled={!canRedo} onClick={onRedo}><Redo2 size={16}/></button></div><button className="phone-overflow" aria-label="Builder menu" onClick={()=>responsive.setPanel('menu')}><MoreHorizontal size={22}/></button>{menu&&<BuilderSheet title="Builder menu" initialSnap="half" onClose={()=>responsive.setPanel(null)}><div className="responsive-menu"><button onClick={()=>{responsive.setPanel(null);onHistory()}}>Version history</button><button onClick={()=>{responsive.setPanel(null);onSaveVersion()}}>Save version</button><button onClick={()=>{onSave();responsive.setPanel(null)}}>Save · {status}</button></div></BuilderSheet>}<div className="builder-project-actions"><button aria-label="Undo" disabled={!canUndo} onClick={onUndo}><Undo2 size={16} /></button><button aria-label="Redo" disabled={!canRedo} onClick={onRedo}><Redo2 size={16} /></button><button className="builder-save" onClick={onSave} title="Save project">{status}</button><button aria-label="Version history" onClick={onHistory}><History size={16} /></button><button className="builder-primary" onClick={onReview}>Review & Export</button></div></header>;
}
export function BuilderSidebar({
  materialTool,onMaterialTool,
  section,
  onSection,
  tool,
  onTool,
  collapsed,
  onCollapse,
  constructionTool,
  onConstructionTool
}: {
  materialTool?:MaterialTool;onMaterialTool?:(tool:MaterialTool)=>void;
  section: BuilderSection;
  onSection: (s: BuilderSection) => void;
  tool: MeasurementTool;
  onTool: (s: MeasurementTool) => void;
  collapsed: boolean;
  onCollapse: () => void;
  constructionTool: string;
  onConstructionTool: (s: string) => void;
}) {
  const workflow=useStudioWorkflow(),assetEditing=Boolean(useAssetWorkspaceContext()?.project);
 return <aside className="builder-sidebar" data-asset-navigation={assetEditing} data-collapsed={collapsed}><button className="builder-collapse" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!collapsed} onClick={onCollapse}>{collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button>{assetEditing?<div className="asset-navigation-heading"><span>ARTWORK STUDIO</span><strong>Design tools</strong></div>:<nav aria-label="Builder sections">{BUILDER_SECTIONS.map((s, i) => {
        const Icon = icons[i];
        return <button key={s} className={section === s ? 'is-selected' : ''} onClick={() => onSection(s)} aria-current={section === s ? 'page' : undefined} title={s}><Icon size={21} /><span>{s}</span>{section === s && <i className="builder-status-dot" />}</button>;
      })}</nav>}<div className="builder-context"><h2 hidden={assetEditing}>{section === 'Materials & Colour'?'Material tools':section === 'Construction' ? 'Construction tools' : section === 'Fit & Measurements' ? 'Measurement tools' : section==='Artwork & Graphics'?'Artwork tools':'Section tools'}</h2>{section === 'Fit & Measurements' ? MEASUREMENT_TOOLS.map((s, i) => {
        const Icon = [Ruler, TableProperties, CirclePlus, FileUp][i];
        return <button key={s} className={tool === s ? 'is-selected' : ''} onClick={() => onTool(s)} title={s}><Icon size={20} /><span>{s}</span></button>;
      }) : section==='Materials & Colour'?MATERIAL_TOOLS.map((s,i)=><button key={s} className={materialTool===s?'is-selected':''} onClick={()=>onMaterialTool?.(s)} title={s}>{(()=>{const Icon=[Palette,Shirt,Grid2X2,BookOpen,Blend][i];return <Icon size={20}/>})()}<span>{s}</span></button>):section === 'Construction' ? construction.map((s,index) => {return <button key={s} className={constructionTool === s ? 'is-selected' : ''} onClick={() => onConstructionTool(s)} title={s}><ConstructionToolIcon index={index}/><span>{s}</span></button>}) : section==='Artwork & Graphics'?<PrintDesignNavigation/> : (section==='Labels & Branding'||section==='Packaging'||section==='Artwork & Graphics')?(section==='Labels & Branding'?LABEL_TOOLS:PACKAGING_TOOLS).map((name,i)=><button key={name} className={workflow.tool===name?'is-selected':''} onClick={()=>workflow.setTool(name)}>{(()=>{const Icon=[Tag,PenLine,Settings,ScanLine][i];return <Icon size={20}/>})()}<span>{name}</span></button>): <p>{section==='Order & quantities'?'Select a run, adjust your size curve and continue to delivery.':'More tools will appear here.'}</p>}</div><div className="builder-sidebar-footer"><button onClick={() => onTool('Upload reference')} title="Upload reference"><Upload size={19} /><span>Upload reference</span></button><small>Reference / inspiration only</small></div></aside>;
}
export function BuilderWorkspace({
  children,
  section
}: {
  children: ReactNode;
  materialTool?:MaterialTool;onMaterialTool?:(tool:MaterialTool)=>void;
  section: BuilderSection;
}) {
  return <main className="builder-workspace" aria-label="Garment workspace"><div className="builder-preview-persistent" data-persistent-workspace>{children}</div></main>;
}
export function BuilderInspector({
  children,
  contentKey, collapsed, onCollapse, onResize, onResizeKey
}: {
  children: ReactNode;
  contentKey: string;
  onResizeKey:(direction:number)=>void; collapsed:boolean; onCollapse:()=>void; onResize:(event:ReactPointerEvent<HTMLDivElement>)=>void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({
      top: 0,
      behavior: 'auto'
    });
  }, [contentKey]);
  return <aside className="builder-inspector-rail" data-collapsed={collapsed} aria-label="Inspector panel"><div className="builder-inspector-resize" role="separator" aria-label="Resize inspector" aria-orientation="vertical" tabIndex={0} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();onResizeKey(e.key==='ArrowLeft'?20:-20)}}} onPointerDown={onResize}/><button className="builder-inspector-collapse" aria-label={collapsed?'Expand inspector':'Collapse inspector'} aria-expanded={!collapsed} onClick={onCollapse}>{collapsed?<ChevronLeft size={15}/>:<ChevronRight size={15}/>}</button><div ref={ref} className="builder-inspector" aria-label="Section inspector" aria-hidden={collapsed}><div className="builder-inspector-content" key={contentKey}>{children}</div></div></aside>;
}
export function BuilderPlaceholder({
  section,
  detail
}: {
  section: string;
  detail?: string;
}) {
  return <div className="builder-placeholder"><span className="builder-eyebrow">Coming next</span><h2>{detail || section}</h2><p>{detail || section} redesign coming next.</p><p>Your design is preserved. This section’s existing tools remain available in the standard Builder.</p></div>;
}
export function BuilderShell({
  materialTool,onMaterialTool,
  onWorkspaceFit,onReview,reviewOpen,sizeComparison,
  topbar,
  children,
  inspector,
  section,
  onSection,
  tool,
  onTool,
  constructionTool,
  onConstructionTool
}: {
  onWorkspaceFit:()=>void;onReview:()=>void;reviewOpen:boolean;sizeComparison?:{enabled:boolean;first:string;second:string};
  topbar: ReactNode;
  children: ReactNode;
  inspector: ReactNode;
  materialTool?:MaterialTool;onMaterialTool?:(tool:MaterialTool)=>void;
  section: BuilderSection;
  onSection: (s: BuilderSection) => void;
  tool: MeasurementTool;
  onTool: (s: MeasurementTool) => void;
  constructionTool: string;
  onConstructionTool: (s: string) => void;
}) {
  const [viewportHeight,setViewportHeight]=useState(()=>window.visualViewport?.height??window.innerHeight);const [viewportTop,setViewportTop]=useState(0);
 useEffect(()=>{const update=()=>{setViewportHeight(window.visualViewport?.height??window.innerHeight);setViewportTop(window.visualViewport?.offsetTop??0)};window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);return()=>{window.removeEventListener('resize',update);window.visualViewport?.removeEventListener('resize',update);window.visualViewport?.removeEventListener('scroll',update)}},[]);
 const assetEditing=Boolean(useAssetWorkspaceContext()?.project);useArtworkDismissal(section==='Artwork & Graphics');
 const width=useBuilderWidth();const phone=width<768;const tablet=width>=768&&width<1200;
 const touchTablet=width>=768&&width<1440&&window.matchMedia('(pointer: coarse)').matches;
 useEffect(()=>{if(!phone)return;const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=oldOverflow}},[phone]);
 const [workflowTool,setWorkflowTool]=useState('Your labels'),[workflowSelection,setWorkflowSelection]=useState<string|null>(null),[controlsHost,setControlsHost]=useState<HTMLElement|null>(null);
 useEffect(()=>{setWorkflowTool(section==='Packaging'?'Packaging type':'Your labels');setWorkflowSelection(null)},[section]);
 const [panel,setPanel]=useState<BuilderPanel>(null);const [inspectorSnap,setInspectorSnap]=useState<SheetSnap>('half');const [size,setSize]=useState('m');
 const [canvasFocus,setCanvasFocus]=useState(false);
 useEffect(()=>{if(phone){setInspectorSnap('half');setCanvasFocus(false);setPanel(null)}},[phone,section]);
 const openInspector=(snap:SheetSnap)=>{setInspectorSnap(snap);if(snap!=='peek'){setCanvasFocus(false);if(tablet||touchTablet)setInspectorCollapsed(false)}};
 const [detailAddRequest,setDetailAddRequest]=useState(0);
 const [detailMode,setDetailMode]=useState<'add'|'edit'|null>(null);
 const [tabletExpanded,setTabletExpanded]=useState(false);
 const [collapsed, setCollapsed] = useState(touchTablet);
 // Canvas bounds respond through CSS containers; do not reset shared zoom on breakpoint changes.
  const [desktopInspectorWidth,setDesktopInspectorWidth]=useState(()=>{try{const saved=Number(sessionStorage.getItem('ceriga-inspector-width'));return saved>=300&&saved<=480?saved:340}catch{return 340}});
  const [tabletInspectorWidth,setTabletInspectorWidth]=useState(()=>{try{const saved=Number(sessionStorage.getItem('ceriga-tablet-inspector-width'));return saved>=280&&saved<=430?saved:320}catch{return 320}});
  const [assetInspectorWidth,setAssetInspectorWidth]=useState(360);
  const inspectorWidth=assetEditing?assetInspectorWidth:tablet?tabletInspectorWidth:desktopInspectorWidth;const setInspectorWidth=assetEditing?setAssetInspectorWidth:tablet?setTabletInspectorWidth:setDesktopInspectorWidth;
  useEffect(()=>{try{sessionStorage.setItem('ceriga-inspector-width',String(desktopInspectorWidth));sessionStorage.setItem('ceriga-tablet-inspector-width',String(tabletInspectorWidth))}catch{}},[desktopInspectorWidth,tabletInspectorWidth]);
  const [inspectorCollapsed,setInspectorCollapsed]=useState(tablet||touchTablet);
 useEffect(()=>{setInspectorCollapsed(tablet||touchTablet)},[tablet,touchTablet]);
  const [resizing,setResizing]=useState(false);
  const startResize=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(inspectorCollapsed||event.button!==0)return;
    event.preventDefault();const target=event.currentTarget;const start=event.clientX;const width=inspectorWidth;
    target.setPointerCapture(event.pointerId);setResizing(true);
    const move=(e:PointerEvent)=>setInspectorWidth(Math.max(tablet?280:300,Math.min(tablet?430:480,window.innerWidth-(collapsed||tablet&&(!tabletExpanded||window.innerWidth<1000)?64:tablet?190:205)-300,width+start-e.clientX)));
    const stop=()=>{setResizing(false);target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',stop);target.removeEventListener('pointercancel',stop);target.removeEventListener('lostpointercapture',stop)};
    target.addEventListener('pointermove',move);target.addEventListener('pointerup',stop);target.addEventListener('pointercancel',stop);target.addEventListener('lostpointercapture',stop);
  };

  const effectiveWidth=tablet?Math.max(280,Math.min(430,inspectorWidth, width-(collapsed||!tabletExpanded||width<1000?64:190)-300)):Math.max(300,inspectorWidth);
 const artworkStudio=usePrintsStudio();
 const mobileTools=section==='Artwork & Graphics'?<MobileToolTabs label="Artwork tools" items={PRINT_TOOL_GROUPS.map(t=>({id:t.id,label:t.label}))} value={artworkStudio.panel} onChange={id=>{artworkStudio.setPanel(id as typeof artworkStudio.panel);openInspector('half')}}/>:section==='Materials & Colour'?<MobileToolTabs label="Material tools" items={MATERIAL_TOOLS.map(t=>({id:t,label:t}))} value={materialTool??MATERIAL_TOOLS[0]} onChange={id=>{onMaterialTool?.(id as MaterialTool);setInspectorSnap('half')}}/>:section==='Construction'?<MobileToolTabs label="Construction tools" items={construction.map(t=>({id:t,label:t}))} value={constructionTool} onChange={id=>{onConstructionTool(id);setInspectorSnap('half')}}/>:section==='Fit & Measurements'?<MobileToolTabs label="Measurement tools" items={MEASUREMENT_TOOLS.map(t=>({id:t,label:t}))} value={tool} onChange={id=>{onTool(id as MeasurementTool);setInspectorSnap('half')}}/>:null;
 const responsiveValue=useMemo(()=>({detailMode,setDetailMode,detailAddRequest,onDetailAddHandled:()=>setDetailAddRequest(0),size,setSize,panel,setPanel,canvasFocus:phone&&canvasFocus,inspectorSnap,setInspectorSnap:openInspector,openSections:()=>setPanel('sections')}),[size,panel,inspectorSnap,detailAddRequest,detailMode,phone,tablet,touchTablet,canvasFocus]);
 return <StudioWorkflowContext.Provider value={{tool:workflowTool,setTool:name=>{setWorkflowTool(name);if(name!=='Design')setWorkflowSelection(null);openInspector('half')},selection:workflowSelection,setSelection:setWorkflowSelection,controlsHost,setControlsHost}}><MobileSectionToolsContext.Provider value={mobileTools}><ResponsiveBuilderContext.Provider value={responsiveValue}><div className="ceriga-builder-shell" data-asset-editing={assetEditing} style={{'--builder-viewport-top':`${viewportTop}px`,'--builder-viewport-height':`${viewportHeight}px`,'--builder-inspector-width':`${inspectorCollapsed?40:effectiveWidth}px`,'--phone-inspector-height':`${canvasFocus||panel||reviewOpen?0:sheetSnapHeight(inspectorSnap,viewportHeight,true)}px`} as CSSProperties} data-canvas-focus={phone&&canvasFocus} data-inspector-collapsed={inspectorCollapsed} data-resizing={resizing} data-section={section} data-construction-tool={section==='Construction'?constructionTool:undefined} data-size-compare={Boolean(sizeComparison?.enabled)} data-tool={tool} data-phone-snap={inspectorSnap} data-nav-collapsed={collapsed||tablet&&(!tabletExpanded||width<1000)}><BuilderTooltips/>{!assetEditing&&topbar}<div className="builder-shell-grid"><BuilderSidebar {...{
        section,materialTool,onMaterialTool,
        onSection:(next:BuilderSection)=>{onSection(next)},
        tool,
        onTool,
        collapsed:collapsed||tablet&&(!tabletExpanded||width<1000),
        constructionTool,
        onConstructionTool
      }} onCollapse={() => {if(tablet&&width<1000)setPanel('sections');else if(tablet)setTabletExpanded(v=>!v);else setCollapsed(v => !v)}} /><BuilderWorkspace section={section}>{children}</BuilderWorkspace><BuilderInspector collapsed={!phone&&inspectorCollapsed} onCollapse={()=>{setInspectorCollapsed(v=>!v)}} onResizeKey={direction=>{setInspectorWidth(w=>Math.max(tablet?280:300,Math.min(tablet?430:480,w+direction)))}} onResize={startResize} contentKey={section + tool + constructionTool}>{phone&&reviewOpen?null:phone&&!(section==='Fit & Measurements'&&(tool==='Core measurements'||tool==='Advanced sizing'))?(!panel&&<BuilderSheet persistent={section==='Order & quantities'||section==='Materials & Colour'||section==='Construction'||section==='Labels & Branding'||section==='Packaging'||section==='Artwork & Graphics'} snap={section==='Order & quantities'||section==='Materials & Colour'||section==='Construction'||section==='Labels & Branding'||section==='Packaging'||section==='Artwork & Graphics'?inspectorSnap:undefined} onSnap={section==='Order & quantities'||section==='Materials & Colour'||section==='Construction'||section==='Labels & Branding'||section==='Packaging'||section==='Artwork & Graphics'?openInspector:undefined} title={section==='Fit & Measurements'?tool:section==='Materials & Colour'?materialTool??section:section==='Construction'?constructionTool:section} onClose={()=>{if(section==='Order & quantities'||section==='Materials & Colour'||section==='Construction'||section==='Labels & Branding'||section==='Packaging'||section==='Artwork & Graphics')setInspectorSnap('peek');else onTool('Core measurements')}} initialSnap={section==='Order & quantities'||section==='Materials & Colour'||section==='Construction'||section==='Labels & Branding'||section==='Packaging'||section==='Artwork & Graphics'?'half':'full'}><div className="mobile-tool-content">{(section==='Order & quantities'||section==='Materials & Colour'||section==='Construction'||section==='Labels & Branding'||section==='Packaging'||section==='Artwork & Graphics')&&inspectorSnap==='peek'?null:<><MobileSectionTools/>{inspector}</>}</div></BuilderSheet>):inspector}</BuilderInspector></div>{phone&&<MobileBuilderDock onUpload={()=>{setPanel(null);onTool('Upload reference')}} canvasFocus={canvasFocus} onEdit={()=>{setPanel(null);if(reviewOpen)onReview();if(tool==='Upload reference')onTool('Upload reference');setCanvasFocus(false);setInspectorSnap(canvasFocus?'half':inspectorSnap==='peek'?'half':'peek')}} onCanvas={()=>{setPanel(null);if(tool==='Upload reference')onTool('Upload reference');setCanvasFocus(true);setInspectorSnap('peek');if(reviewOpen)onReview();}} reviewOpen={reviewOpen} panel={panel} onPanel={next=>{setCanvasFocus(false);if(reviewOpen)onReview();if(next==='add'&&section==='Construction'&&constructionTool==='Seams & panelling'){openInspector('half');setPanel(null)}else if(next==='add'&&section==='Construction'){onConstructionTool('Details & trims');setDetailAddRequest(n=>n+1);openInspector('full');setPanel(null)}else setPanel(next)}} onReview={()=>{setPanel(null);onReview()}}/>}
 {(panel==='sections'||panel==='tools'||panel==='add')&&<BuilderSheet title={panel==='sections'?'Sections':panel==='tools'?'Tools':'Add to product'} initialSnap={panel==='sections'?'full':'half'} onClose={()=>setPanel(null)}><div className="responsive-menu">{panel==='sections'?<>{BUILDER_SECTIONS.map((s,i)=>{const Icon=icons[i];return <button key={s} aria-current={s===section?'page':undefined} onClick={()=>{setPanel(null);setCanvasFocus(false);setInspectorSnap('half');onSection(s)}}><span className="mobile-nav-label"><Icon size={20}/>{s}</span>{s===section&&<span>✓</span>}</button>})}</>:panel==='tools'?<><h3>{section}</h3>{section==='Fit & Measurements'?MEASUREMENT_TOOLS.map(t=><button key={t} aria-current={t===tool?'page':undefined} onClick={()=>{onTool(t);setPanel(null)}}>{t}</button>):section==='Materials & Colour'?MATERIAL_TOOLS.map(t=><button key={t} aria-current={materialTool===t?'page':undefined} onClick={()=>{onMaterialTool?.(t);setPanel(null)}}>{t}</button>):section==='Construction'?construction.map(t=><button key={t} onClick={()=>{onConstructionTool(t);setPanel(null)}}>{t}</button>):section==='Artwork & Graphics'?<PrintDesignNavigation onActivate={()=>{openInspector('half');setPanel(null)}}/>:(section==='Labels & Branding'||section==='Packaging'||section==='Artwork & Graphics')?(section==='Labels & Branding'?LABEL_TOOLS:PACKAGING_TOOLS).map(name=><button key={name} aria-current={workflowTool===name?'page':undefined} onClick={()=>{setWorkflowTool(name);openInspector('half');setPanel(null)}}>{name}</button>):<p>No additional tools for this section.</p>}</>:section==='Fit & Measurements'?<><button onClick={()=>{onTool('Import measurements');setPanel(null)}}>Import measurements <small>Preview</small></button><p>Custom measurement creation is coming later. Existing garment and asset measurements remain editable.</p></>:section==='Artwork & Graphics'?<PrintDesignNavigation onActivate={()=>{openInspector('half');setPanel(null)}}/>:section==='Labels & Branding'?<button onClick={()=>{setWorkflowTool('Your labels');openInspector('half');setPanel(null)}}>Add or manage labels</button>:section==='Packaging'?<button onClick={()=>{setWorkflowTool('Design');openInspector('half');setPanel(null)}}>Add packaging artwork or text</button>:<p>No additional creation tools are available in this section yet.</p>}{panel==='add'&&<button onClick={()=>{setPanel(null);onTool('Upload reference')}}><span className="mobile-nav-label"><Upload size={20}/>Upload reference</span></button>}</div></BuilderSheet>}</div></ResponsiveBuilderContext.Provider></MobileSectionToolsContext.Provider></StudioWorkflowContext.Provider>;

}
function MobileBuilderDock({onUpload,canvasFocus,onEdit,onCanvas,panel,onPanel,onReview,reviewOpen}:{onUpload:()=>void;canvasFocus:boolean;onEdit:()=>void;onCanvas:()=>void;reviewOpen:boolean;panel:BuilderPanel;onPanel:(panel:BuilderPanel)=>void;onReview:()=>void}){
 const toggle=(next:BuilderPanel)=>onPanel(panel===next?null:next);
 const items=[{name:'Upload',Icon:Upload,action:onUpload,active:false},{name:'Edit',Icon:SlidersHorizontal,action:onEdit,active:!canvasFocus&&!panel&&!reviewOpen},{name:'Sections',Icon:Layers,action:()=>toggle('sections'),active:panel==='sections'},{name:'Canvas',Icon:Maximize2,action:onCanvas,active:canvasFocus&&!panel&&!reviewOpen},{name:'Review',Icon:ClipboardList,action:onReview,active:reviewOpen}];
 return <nav className="mobile-builder-dock" aria-label="Builder commands">{items.map(({name,Icon,action,active})=><button key={name} data-primary={name==='Sections'} aria-pressed={active} onClick={action}><Icon size={21}/><span>{name}</span></button>)}</nav>
}
