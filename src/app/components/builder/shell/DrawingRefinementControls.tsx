import {usePrintsStudio} from '../printsStudio/PrintsStudioContext';
import {useEffect,useState} from 'react';
import {Spline,ScanLine,ArrowRight,Undo2} from 'lucide-react';
import type {DesignElement} from '../PrintStudioEditor';
import type {ShapePath} from '../../../lib/shapeGeometry';
import {vectorizeSketchLines,vectorizeSketchAlpha} from '../../../lib/sketchVector';
import {StudioGraphic} from '../printsStudio/StudioGraphic';
import {StudioFold,StudioRange,StudioNumber} from './StudioControls';
import './sketch-vector.css';
export function DrawingVectorOrigin({element:el,update}:{element:DesignElement;update:(p:Partial<DesignElement>)=>void}){
 if(!el.drawingVectorSource)return null;
 return <div className="sketch-vector-origin"><Spline size={16}/><span>Editable vector<small>Fill, recolour, add pattern ink or edit its points.</small></span><button type="button" disabled={el.locked} title="Restore the original brush drawing" onClick={()=>update({type:'drawing',content:el.drawingVectorSource!.content,drawing:el.drawingVectorSource!.drawing,color:el.drawingVectorSource!.color,layerName:el.drawingVectorSource!.layerName,drawingVectorSource:undefined,shapeBrush:undefined,shapePath:undefined,shapeGeometry:undefined,shapeFilled:undefined,shapeEffects:undefined,shapeFillColor:undefined,shapeStrokeColor:undefined,borderWidth:undefined})}><Undo2 size={14}/>Original</button></div>;
}
export function DrawingRefinementControls({element:el,update}:{element:DesignElement;update:(p:Partial<DesignElement>)=>void}){
 const units=usePrintsStudio().unitsPerCm;
 const source=el.drawingOriginal??el.drawing,lineAvailable=!!source?.strokes.some(s=>s.points.length>=2&&s.points.some(p=>Math.hypot(p.x-s.points[0].x,p.y-s.points[0].y)>.001))&&!el.drawing?.cuts?.length;
 const [mode,setMode]=useState<'line'|'ink'>(lineAvailable?'line':'ink'),[radius,setRadius]=useState(0),[cleanup,setCleanup]=useState(65),[closeGaps,setCloseGaps]=useState(true),[filled,setFilled]=useState(false),[result,setResult]=useState<{path?:ShapePath;error?:string;busy?:boolean}>({busy:true});
 const detail=100-cleanup;
 useEffect(()=>{
  if(el.type!=='drawing')return;
  let cancelled=false;setResult({busy:true});
  const timer=window.setTimeout(()=>{void (async()=>{
   try{
    let path:ShapePath;
    if(mode==='line'&&source)path=vectorizeSketchLines(source,detail,closeGaps,true);
    else{
     const replay=document.querySelector<HTMLCanvasElement>(`[data-print-id="${CSS.escape(el.id)}"] canvas[data-drawing-rendered="true"]`);
     const image=new Image();image.src=el.content;await image.decode();if(cancelled)return;
     const input=replay??image,max=768,scale=Math.min(1,max/Math.max(input.width,input.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(input.width*scale));canvas.height=Math.max(1,Math.round(input.height*scale));
     const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(input,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data,alpha=new Float32Array(canvas.width*canvas.height);for(let i=0;i<alpha.length;i++)alpha[i]=pixels[i*4+3]/255;
     path=vectorizeSketchAlpha(alpha,canvas.width,canvas.height,detail);
    }
    if(!cancelled)setResult({path});
   }catch(error){if(!cancelled)setResult({error:error instanceof Error?error.message:'Could not convert this drawing.'});}
  })();},100);
  return()=>{cancelled=true;clearTimeout(timer)};
 },[el.id,el.content,source,mode,detail,closeGaps]);
 if(el.type!=='drawing')return null;
 const closed=!!result.path&&[result.path,...(result.path.subpaths??[])].some(p=>p.closed);
 const color=el.color??source?.strokes[0]?.settings.color??'#171717';
 const candidate:DesignElement={...el,type:'shape',content:'custom-vector',shapeGeometry:'bounds',shapeCornerRadius:radius*units/10,shapePath:result.path,shapeBrush:mode==='line'?source:undefined,drawingVectorSource:{content:el.content,drawing:el.drawing,color:el.color,layerName:el.layerName},shapeFilled:mode==='ink'||(filled&&closed),shapeFillColor:color,shapeStrokeColor:color,color,borderWidth:mode==='ink'?0:(source?.strokes[0]?.settings.brushSize??3)*el.width/(source?.width??el.width)};
 return <StudioFold title="Sketch to vector" hint="Turn your drawing into an editable design" open><fieldset disabled={el.locked} className="sketch-vector-editor"><div className="sketch-vector-modes" role="group" aria-label="Vector conversion method"><button type="button" disabled={!lineAvailable} aria-pressed={mode==='line'} onClick={()=>setMode('line')}><Spline size={19}/><strong>Line drawing</strong><small>Clean paths, same brush finish</small></button><button type="button" aria-pressed={mode==='ink'} onClick={()=>setMode('ink')}><ScanLine size={19}/><strong>Ink silhouette</strong><small>Trace painted & textured marks</small></button></div><div className="sketch-vector-comparison"><div><img src={el.content} alt="Original sketch"/><span>Your sketch</span></div><ArrowRight size={16}/><div aria-label="Vector preview" aria-busy={!!result.busy}>{result.path?<div className="sketch-preview-art" style={{aspectRatio:`${el.width}/${el.height}`}}><StudioGraphic element={candidate}/></div>:<span>{result.busy?'Preparing preview…':'No preview'}</span>}<span>Editable vector</span></div></div><StudioNumber label="Corner radius" unit="mm" min={0} max={200} value={radius} onChange={setRadius}/><StudioRange label="Line cleanup" value={cleanup} onChange={setCleanup}/><div className="sketch-detail-labels"><span>Keep drawn detail</span><span>Straighten & simplify</span></div>{mode==='line'&&<><label className="studio-switch"><span>Join small gaps</span><input type="checkbox" checked={closeGaps} onChange={e=>setCloseGaps(e.target.checked)}/></label><label className="studio-switch"><span>Fill closed shapes</span><input type="checkbox" checked={filled} disabled={!closed} onChange={e=>setFilled(e.target.checked)}/></label></>}{result.error&&<p className="sketch-vector-error" role="alert">{result.error}</p>}<button type="button" className="sketch-vector-apply" disabled={!result.path||result.busy} onClick={()=>update({...candidate,drawing:undefined,drawingOriginal:undefined,drawingSmoothness:undefined,layerName:el.layerName??'Sketch vector'})}><Spline size={16}/>Create vector asset<ArrowRight size={16}/></button><p className="typography-help">Works with your own motifs, not a list of recognised shapes. Converts the marks you drew into curves; it does not invent or redraw missing details. The original stays available to restore.</p></fieldset></StudioFold>;
}
