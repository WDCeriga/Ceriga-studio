import './brand-studio-controls.css';
import {PackagingDesigner,PackagingDesignerPreview} from '../PackagingDesigner';
import {EmbeddedSurfaceArtworkEditor} from '../SurfaceArtworkEditor';
import {readPackagingSurfaces,savePackagingSurface} from '../../../lib/surfaceMigration';
import {packagingTemplate,PANEL_NAMES} from '../../../data/packaging';
import {MobileToolTabs} from './MobileToolTabs';
import {MaterialSelect} from './MaterialSelect';
import {PACKAGING_TOOLS,useStudioWorkflow} from './StudioWorkflow';
import {useMemo,useState,type ComponentProps} from 'react';
import './packaging-studio.css';
export function PackagingStudioInspector(props:ComponentProps<typeof PackagingDesigner>){
 const workflow=useStudioWorkflow(),design=props.value.designs[props.value.active],template=packagingTemplate(design.templateId);
 const surface=useMemo(()=>workflow.tool==='Design'?readPackagingSurfaces(design)[design.selectedPanel]:undefined,[design,workflow.tool]);
 const changePanel=(panel:typeof design.selectedPanel)=>{workflow.setSelection(null);props.onSelect(null);props.onChange({...props.value,designs:{...props.value.designs,[props.value.active]:{...design,selectedPanel:panel}}})};
 return <div className="materials-editor packaging-studio"><header className="materials-heading"><span className="builder-eyebrow">PACKAGING STUDIO</span><h2>Packaging</h2><p>{workflow.tool==='Design'?'Choose a panel, then create and edit its artwork.':workflow.tool==='Material & size'?'Set the colours and dimensions for your packaging.':'Choose a packaging style. Each variation keeps its own design.'}</p></header><MobileToolTabs label="Packaging tools" value={workflow.tool} items={PACKAGING_TOOLS.map(id=>({id,label:id}))} onChange={workflow.setTool}/>
 {workflow.tool==='Design'&&design.category!=='none'?<div className="packaging-shared-controls"><label className="surface-field">Panel<MaterialSelect aria-label="Packaging artwork panel" value={design.selectedPanel} onChange={event=>changePanel(event.target.value as typeof design.selectedPanel)}>{template.panels.map(panel=><option key={panel} value={panel}>{PANEL_NAMES[panel]}</option>)}</MaterialSelect></label><div ref={workflow.setControlsHost} className="label-context-controls"/>{!workflow.selection&&<section className="packaging-panel-layers"><h3>On this panel</h3>{surface?.document.elements.length?surface.document.elements.map(element=><button type="button" key={element.id} onClick={()=>workflow.setSelection(element.id)}><span>{element.layerName||element.content?.slice(0,40)||element.type}</span><small>{element.type}</small></button>):<p>Use Add or the canvas tools to start your design.</p>}</section>}</div>:<PackagingDesigner {...props} studioTool={workflow.tool}/>}</div>
}
export function PackagingStudioPreview(props:ComponentProps<typeof PackagingDesignerPreview>){
 const workflow=useStudioWorkflow(),[preview,setPreview]=useState(false);
 const surface=useMemo(()=>workflow.tool==='Design'?readPackagingSurfaces(props.design)[props.design.selectedPanel]:undefined,[props.design,workflow.tool]);
 if(workflow.tool==='Design'&&props.design.category!=='none'&&surface)return <div className="packaging-studio-canvas packaging-shared-canvas"><div className="packaging-editor-view" role="group" aria-label="Packaging workspace view"><button type="button" aria-pressed={!preview} onClick={()=>setPreview(false)}>Edit panel</button><button type="button" aria-pressed={preview} onClick={()=>setPreview(true)}>Preview</button></div>{preview?<PackagingDesignerPreview {...props} studio onSelect={()=>{setPreview(false);workflow.setSelection(null)}}/>:<EmbeddedSurfaceArtworkEditor key={surface.surface.id} title="Packaging artwork" value={surface} selectedId={workflow.selection} controlsHost={workflow.controlsHost} onSelection={workflow.setSelection} onCommit={next=>props.onChange(savePackagingSurface(props.design,props.design.selectedPanel,next))}/>}</div>;
 return <div className="packaging-studio-canvas"><PackagingDesignerPreview {...props} studio onSelect={id=>{props.onSelect(id);if(id)workflow.setTool('Design')}}/></div>
}
