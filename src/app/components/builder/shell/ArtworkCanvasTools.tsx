import {ArtworkHistoryControls} from './ArtworkHistoryControls';
import * as Popover from '@radix-ui/react-popover';
import {MousePointer2,Upload,Crop,FlipHorizontal2,Grid3X3,SlidersHorizontal,Shuffle,Undo2,Redo2,X} from 'lucide-react';
import type {ReactNode} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
import {usePrintsStudio} from '../printsStudio/PrintsStudioContext';
import {PaintInput} from '../PrintStudioColorPopover';
import {newPatternSeed} from '../../../lib/patternGeometry';
import {patternDefinition} from '../../../lib/patternCatalog';
import {StudioRange} from './StudioControls';
import type {DrawHistory} from './DrawPaintStudio';
import './artwork-canvas-tools.css';

type Props={mode:'upload'|'patterns';elements:DesignElement[];selectedId:string|null;onChange:(elements:DesignElement[])=>void;history?:DrawHistory;onBrowse:()=>void};
function QuickSettings({label,children}:{label:string;children:ReactNode}){
 return <Popover.Root><Popover.Trigger className="artwork-quick-trigger" aria-label={label}><SlidersHorizontal size={18}/><span>{label}</span></Popover.Trigger><Popover.Portal><Popover.Content className="artwork-canvas-settings" side="right" align="center" sideOffset={10} collisionPadding={12} onOpenAutoFocus={event=>event.preventDefault()}><header><strong>{label}</strong><Popover.Close aria-label={`Close ${label}`}><X size={15}/></Popover.Close></header><div>{children}</div></Popover.Content></Popover.Portal></Popover.Root>;
}
export function ArtworkCanvasTools({mode,elements,selectedId,onChange,history,onBrowse}:Props){
 const studio=usePrintsStudio(),pattern=mode==='patterns';
 const selected=elements.find(element=>element.id===selectedId&&(pattern?element.type==='pattern'||element.type==='customArea'&&!!element.customAreaPattern:element.type==='image'));
 const locked=!selected||!!selected.locked;
 const patch=(changes:Partial<DesignElement>)=>{if(selected&&!selected.locked)onChange(elements.map(element=>element.id===selected.id?{...element,...changes}:element));};
 const kind=selected?.type==='customArea'?selected.customAreaPattern:selected?.content;
 const definition=pattern?patternDefinition(kind??''):undefined;
 const select=()=>{studio.setTool('select');studio.setCropEditingId(null);studio.setWarpEditingId(null);studio.setDistortEditingId(null);studio.setPathEditingId(null);};
 return <div className="shape-canvas-tools artwork-canvas-tools" role="toolbar" aria-label={pattern?'Pattern tools':'Artwork library tools'}>
  <button aria-label={pattern?'Select pattern':'Select artwork'} title="Select (V)" aria-pressed={studio.tool==='select'&&!studio.cropEditingId} onClick={select}><MousePointer2 size={18}/><span>Select</span></button>
  {pattern?<button aria-label="Browse patterns" onClick={onBrowse}><Grid3X3 size={18}/><span>Patterns</span></button>:<button aria-label="Upload artwork from canvas" onClick={()=>studio.imageUploader.current?.()}><Upload size={18}/><span>Upload</span></button>}
  <i/>
  {!pattern&&<button aria-label="Crop selected artwork" disabled={locked} aria-pressed={!!selected&&studio.cropEditingId===selected.id} onClick={()=>{if(!selected)return;const active=studio.cropEditingId===selected.id;select();studio.setCropEditingId(active?null:selected.id);}}><Crop size={18}/><span>Crop</span></button>}
  <fieldset disabled={locked}>
   <QuickSettings label={pattern?'Repeat':'Adjust'}>{pattern?<><StudioRange label="Repeat density" value={selected?.patternCount??8} min={1} max={32} unit="" onChange={patternCount=>patch({patternCount})}/><StudioRange label="Repeat scale" value={selected?.patternScale??100} min={10} max={400} onChange={patternScale=>patch({patternScale})}/><StudioRange label="Repeat rotation" value={selected?.patternRotation??0} min={-180} max={180} unit="°" onChange={patternRotation=>patch({patternRotation})}/></>:null}<StudioRange label="Opacity" value={selected?.opacity??100} onChange={opacity=>patch({opacity})}/></QuickSettings>
   <button className="artwork-quick-trigger" aria-label={pattern?'Flip selected pattern':'Flip selected artwork'} aria-pressed={selected?.flipHorizontal??false} onClick={()=>patch({flipHorizontal:!selected?.flipHorizontal})}><FlipHorizontal2 size={18}/><span>Flip</span></button>
   {(!pattern||kind!=='custom')&&<div className="shape-tool-paint" role="group" aria-label={pattern?'Pattern colour':'Artwork ink colour'}><PaintInput ariaLabel={pattern?'Change pattern colour':'Change artwork ink colour'} value={selected?.color??'#262626'} onChange={event=>{const color=event.target.value;patch({color,...(pattern&&selected?.patternColors?.length?{patternColors:selected.patternColors.map((value,index)=>index===0?color:value)}:{})});}}/><span>Colour</span></div>}
   {pattern&&definition?.randomise&&(kind!=='custom'||selected?.patternRepeat==='random')&&(kind!=='dots'||selected?.patternRandomise)&&<button className="artwork-quick-trigger" aria-label="Shuffle selected pattern" onClick={()=>patch({patternSeed:newPatternSeed()})}><Shuffle size={18}/><span>Shuffle</span></button>}
  </fieldset>
  <ArtworkHistoryControls history={history}/>
 </div>;
}
