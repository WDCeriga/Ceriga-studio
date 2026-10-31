import './brand-studio-controls.css';
import {PackagingDesigner,PackagingDesignerPreview} from '../PackagingDesigner';
import {MobileToolTabs} from './MobileToolTabs';
import {PACKAGING_TOOLS,useStudioWorkflow} from './StudioWorkflow';
import type {ComponentProps} from 'react';
import './packaging-studio.css';
export function PackagingStudioInspector(props:ComponentProps<typeof PackagingDesigner>){const workflow=useStudioWorkflow();return <div className="materials-editor packaging-studio"><header className="materials-heading"><span className="builder-eyebrow">PACKAGING STUDIO</span><h2>Packaging</h2><p>{workflow.tool==='Design'?'Choose a panel, add layers, then edit on the canvas.':workflow.tool==='Material & size'?'Set the colours and dimensions for your packaging.':'Choose a packaging style. Each variation keeps its own design.'}</p></header><MobileToolTabs label="Packaging tools" value={workflow.tool} items={PACKAGING_TOOLS.map(id=>({id,label:id}))} onChange={workflow.setTool}/><PackagingDesigner {...props} studioTool={workflow.tool}/></div>}
export function PackagingStudioPreview(props:ComponentProps<typeof PackagingDesignerPreview>){const workflow=useStudioWorkflow();return <div className="packaging-studio-canvas"><PackagingDesignerPreview {...props} studio onSelect={id=>{props.onSelect(id);if(id)workflow.setTool('Design')}}/></div>}
