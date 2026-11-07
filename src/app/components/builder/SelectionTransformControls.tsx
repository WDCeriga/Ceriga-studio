import type { PointerEvent } from 'react';
import { RotateCw } from 'lucide-react';
import './selection-transform-controls.css';
type Handle='nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w';
export function SelectionTransformControls({onResizePointerDown,onRotatePointerDown,uiInverseScale=1,comfortableTouch=false,hideBounds=false,rotation=0,transformLabel}:{onResizePointerDown:(event:PointerEvent,handle:Handle)=>void;onRotatePointerDown:(event:PointerEvent)=>void;uiInverseScale?:number;comfortableTouch?:boolean;hideBounds?:boolean;rotation?:number;transformLabel?:string}) {
 const scale=uiInverseScale>0?uiInverseScale:1;
 return <div data-handles data-editor-chrome data-shape-transform className="studio-selection-controls">
  {!hideBounds&&<svg aria-hidden="true" className="studio-selection-frame"><rect width="100%" height="100%" fill="none" stroke="#CC2D24" strokeWidth={scale} strokeDasharray={`${3*scale} ${3*scale}`}/></svg>}
  {(['nw','n','ne','e','se','s','sw','w'] as Handle[]).map(handle=>{const x=handle.includes('w')?0:handle.includes('e')?100:50,y=handle.includes('n')?0:handle.includes('s')?100:50,cursors=['ns-resize','nesw-resize','ew-resize','nwse-resize'],base=handle==='n'||handle==='s'?0:handle==='ne'||handle==='sw'?1:handle==='e'||handle==='w'?2:3;return <button key={handle} type="button" aria-label={`Resize ${handle.toUpperCase()}`} className="studio-selection-handle" style={{left:x+'%',top:y+'%',width:comfortableTouch?28:22,height:comfortableTouch?28:22,transform:`translate(-50%,-50%) scale(${scale})`,cursor:cursors[(base+Math.round(rotation/45)%4+4)%4]}} onPointerDown={event=>{if(event.button===0)onResizePointerDown(event,handle)}}/>})}
  <button type="button" aria-label="Rotate" className="studio-selection-rotate" style={{top:-42*scale,transform:`translate(-50%,-50%) scale(${scale})`}} onPointerDown={event=>{if(event.button===0)onRotatePointerDown(event)}}><RotateCw size={13}/></button>
  {transformLabel&&<span className="studio-selection-readout" style={{top:`calc(100% + ${18*scale}px)`,transform:`translateX(-50%) scale(${scale})`}}>{transformLabel}</span>}
 </div>;
}
