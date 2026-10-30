import {offsetArtwork} from '../../../lib/artworkPathCommands';
import {useRef,useState} from 'react';
import {Copy,Type,Scissors,MousePointer2} from 'lucide-react';
import type {DesignElement} from '../PrintStudioEditor';
import {loadFontLibrary} from '../printsStudio/designLibrary';
import {canOutlineLettering,outlineLettering} from '../../../lib/editableLettering';
import {canSeparateLettering,labelExistingLettering,separateLettering} from '../../../lib/letteringParts';
import {useArtworkDocument} from '../printsStudio/ArtworkDocumentContext';
import {usePrintsStudio} from '../printsStudio/PrintsStudioContext';
import {StudioFold,StudioNumber} from './StudioControls';
import './artwork-path-tools.css';
export function LetteringPathControls({element,update}:{element:DesignElement;update:(p:Partial<DesignElement>)=>void}){
 const studio=usePrintsStudio(),document=useArtworkDocument(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[letter,setLetter]=useState<string|null>(null),[offsetMm,setOffsetMm]=useState(1),latest=useRef({element,document});latest.current={element,document};
 const source=element.letteringSource??element,parts=element.letteringParts??[],active=parts.find(p=>p.key===letter)??parts[0],supported=canOutlineLettering(source.fontFamily??'Inter',loadFontLibrary()),distorted=Boolean(element.warp||element.perspective||element.verticalText);
 const commitParts=(key?:string,copy=false,outlined=element)=>{
  if(!document)return;
  try{const all=document.elements.map(e=>e.id===outlined.id?outlined:e),result=separateLettering(all,outlined.id,key,copy);studio.setPathEditingId(null);studio.setSelectionIds([]);studio.setSelectionAdditive(false);studio.setTool('select');document.onChange(result.elements,result.selectedId);document.onSelect(result.selectedId);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not separate letters.');}
 };
 const convert=async(separate=false)=>{setBusy(true);setError('');const snapshot=latest.current;try{
  const template=await outlineLettering(source,loadFontLibrary());
  if(latest.current.element!==snapshot.element||latest.current.document?.elements!==snapshot.document?.elements)throw new Error('The artwork changed. Choose the lettering again.');
  const patch=element.letteringSource?labelExistingLettering(element,template):template,outlined={...element,...patch};
  if(separate)commitParts(undefined,false,outlined);else{update(patch);studio.setTool('select');studio.setPathEditingId(element.id);}
 }catch(e){setError(e instanceof Error?e.message:'Could not prepare lettering.');}finally{setBusy(false)}};
 const createOffset=async()=>{if(!document)return;const snapshot=latest.current;setBusy(true);setError('');try{const vector=element.type==='shape'?element:{...element,...await outlineLettering(element,loadFontLibrary())};const offset={...offsetArtwork(vector,offsetMm*studio.unitsPerCm/10),id:crypto.randomUUID(),layerName:'Text outline',borderWidth:0,shapeFilled:true,shapeFillColor:element.borderColor??'#262626',letteringSource:undefined};if(latest.current.element!==snapshot.element||latest.current.document?.elements!==snapshot.document?.elements)throw new Error('The artwork changed. Try the outline again.');document.onChange(document.elements.flatMap(e=>e.id===element.id?[offset,e]:[e]),offset.id);document.onSelect(offset.id);}catch(e){setError(e instanceof Error?e.message:'Could not create the text outline.');}finally{setBusy(false)}};
 return <StudioFold title="Convert & edit outlines" hint="Make anchor points or separate letters">
  <StudioNumber label="Offset outline" unit="mm" min={.1} max={30} step={.1} value={offsetMm} onChange={setOffsetMm}/><button className="studio-outline-action" disabled={busy||!document||distorted||(!supported&&element.type!=='shape')} onClick={()=>void createOffset()}>Create sticker / varsity outline</button>
  {element.letteringSource?<><p className="path-workflow-help">Choose a letter to move it out of the word or make a separate copy. Its holes stay with it.</p>
   {parts.length?<><div className="letter-choice-list" role="group" aria-label="Choose a letter">{parts.map((part,index)=><button key={part.key} aria-label={`Choose letter ${part.label} ${index+1}`} aria-pressed={active?.key===part.key} onClick={()=>setLetter(part.key)}>{part.label}</button>)}</div><div className="letter-action-grid"><button disabled={!document||!canSeparateLettering(element)||parts.length<2} onClick={()=>commitParts(active?.key)}><MousePointer2 size={15}/>Separate letter</button><button disabled={!document||!canSeparateLettering(element)} onClick={()=>commitParts(active?.key,true)}><Copy size={15}/>Copy letter</button>{parts.length>1&&<button disabled={!document||!canSeparateLettering(element)} onClick={()=>commitParts()}><Scissors size={15}/>Separate all letters</button>}</div></>:<button className="studio-outline-action" disabled={busy||!supported||distorted} onClick={()=>void convert()}>{busy?'Preparing letters…':'Prepare individual letters'}</button>}
   <div className="letter-secondary-actions"><button onClick={()=>{studio.setTool('select');studio.setPathEditingId(studio.pathEditingId===element.id?null:element.id)}}>{studio.pathEditingId===element.id?'Finish point editing':'Edit letter points'}</button><button onClick={()=>{studio.setPathEditingId(null);update({...element.letteringSource!,x:element.x,y:element.y,rotation:element.rotation,letteringSource:undefined,letteringParts:undefined,shapePath:undefined,shapeEffects:undefined})}}>Restore editable text</button></div>
  </>:<><p className="path-workflow-help">Convert the letter contours to vector points. Use Adjust letters to move characters while keeping live text.</p><div className="letter-action-grid"><button disabled={busy||element.locked||!supported||distorted} onClick={()=>void convert()}><Type size={15}/>{busy?'Preparing…':'Edit word outline'}</button><button disabled={busy||!document||element.locked||!supported||distorted} onClick={()=>void convert(true)}><Scissors size={15}/>Separate letters</button></div>{!supported&&<p className="path-workflow-help">Choose a bundled display font or import its font file to edit its outlines.</p>}</>}
  {distorted&&<p className="path-workflow-help">Reset distortion before separating letters.</p>}{error&&<p className="pen-inline-error" role="alert">{error}</p>}
 </StudioFold>;
}
