import {fitDraftEdge,referenceEdgeFit,fitWholeReference} from '../../../lib/referenceEdgeFit';
import {useTraceEdges} from './useTraceEdges';
import {usePrintsStudio} from './PrintsStudioContext';
import {shapeWorldPath} from '../../../lib/artworkPathOperations';
import {MousePointer2,Plus,Minus,CornerUpRight,Circle,Spline} from 'lucide-react';
import {frameGesture} from '../../../lib/frameGesture';
import {mapShapePath} from '../../../lib/artworkPathOperations';
import {bendPenSegment,nearestPenSegment} from '../../../lib/penGeometry';
import {pointInSelection,selectionBox,type MarqueeBox} from '../../../lib/artworkMarquee';
import {StudioNumber} from '../shell/StudioControls';
import {regulariseContour,regulariseCurves,regulariseSelectedArc} from '../../../lib/regulariseCurves';
import {constrainPenPoint,dragPenHandle,reversePenPath} from '../../../lib/penGeometry';
import {createPortal} from 'react-dom';
import {usePenControlsHost} from './usePenControlsHost';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { DesignElement } from '../PrintStudioEditor';
import { MaterialSelect } from '../shell/MaterialSelect';
import type { ShapePath } from '../../../lib/shapeGeometry';
import { shapePathData } from '../../../lib/shapeGeometry';
import { deleteShapePoints, moveShapePoints, pathSegmentPoint, shapePointMapping, smoothShapePoints, splitShapeSegment } from '../../../lib/shapePathEditing';

type Point = { x: number; y: number };
const button = 'shape-path-action';

export function ShapePathEditor({ element, tracingElements=[], scale, onChange, onPreview, onDone, onContinue }: {
  element: DesignElement; tracingElements?:DesignElement[]; scale: number; onChange: (path: ShapePath) => void;
  onPreview: (path: ShapePath | null) => void; onDone: () => void; onContinue?:(fromStart:boolean)=>void;
}) {
  const controlsHost=usePenControlsHost();
  const svg = useRef<SVGSVGElement>(null);
  const [subpath, setSubpath] = useState(-1);
  const [selection, setSelection] = useState<number[]>([]);
  const [linked, setLinked] = useState(true);
  const [cleanupOpen,setCleanupOpen]=useState(false);
  const [pointBox,setPointBox]=useState<MarqueeBox|null>(null);
  const [mode,setMode]=useState<'move'|'add'|'remove'|'convert'|'pen'|'fit'>('move');
  const studio=usePrintsStudio(),[fitIndex,setFitIndex]=useState(0),[otherRoute,setOtherRoute]=useState(false),[fitError,setFitError]=useState(''),edges=useTraceEdges(tracingElements,mode==='fit',studio.layerRenderer.current);
  const cancelDrag = useRef<(() => void) | null>(null);
  const [transientPath,setTransientPath]=useState<ShapePath|null>(null);
  const path = transientPath??element.shapePath!;
  const activePath = subpath < 0 ? path : path.subpaths?.[subpath] ?? path;
  const curveCleanup=useMemo(()=>cleanupOpen?regulariseCurves(path,element):{path,count:0},[cleanupOpen,path,element.width,element.height]);
  const arcCleanup=useMemo(()=>cleanupOpen?regulariseSelectedArc(activePath,selection,element):null,[cleanupOpen,activePath,selection,element.width,element.height]);
  function applyCurveCleanup(next:ShapePath){onPreview(null);onChange(next);setSelection([]);setFitError('');}
  const latest = useRef({ path, activePath, onChange, onPreview, onDone, selection, subpath });
  latest.current = { path, activePath, onChange, onPreview, onDone, selection, subpath };
  const mapping = shapePointMapping(element);
  const radiusX = 3 / Math.max(0.1, scale) * 100 / Math.max(1,element.width),radiusY = 3 / Math.max(0.1, scale) * 100 / Math.max(1,element.height);
  function replace(next: ShapePath, base = path): ShapePath {
    return subpath < 0 ? next : { ...base, subpaths: base.subpaths?.map((part, index) => index === subpath ? next : part) };
  }
  function apply(next: ShapePath) { onChange(replace(next)); }
  useEffect(() => () => { cancelDrag.current?.(); }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as Element)?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const state = latest.current;
      const store = (next: ShapePath) => state.onChange(state.subpath < 0 ? next : { ...state.path, subpaths: state.path.subpaths?.map((part, index) => index === state.subpath ? next : part) });
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){event.preventDefault();event.stopImmediatePropagation();setSelection(state.activePath.nodes.map((_,i)=>i));return;}
      if(!event.ctrlKey&&!event.metaKey&&!event.altKey){const next=event.key==='+'||event.key==='='?'add':event.key==='-'?'remove':event.key.toLowerCase()==='c'?'convert':event.key.toLowerCase()==='a'?'move':event.key.toLowerCase()==='p'?'pen':null;if(next){event.preventDefault();event.stopImmediatePropagation();setMode(next);return;}}
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancelDrag.current?.(); state.onDone(); }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault(); event.stopImmediatePropagation();
        store(deleteShapePoints(state.activePath, state.selection)); setSelection([]);
      }
      if (event.key.startsWith('Arrow') && state.selection.length) {
        const step = event.shiftKey ? 5 : 1;
        const delta = { x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0 };
        event.preventDefault(); event.stopImmediatePropagation(); store(moveShapePoints(state.activePath, state.selection, delta));
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, []);
  function clientPoint(clientX: number, clientY: number): Point {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return mapping.inverse(point);
  }
  function previewSession(){
    const root=svg.current?.closest<HTMLElement>('[data-print-id]'),content=root?.querySelector<HTMLElement>('[data-asset-content]'),inks=Array.from(content?.querySelectorAll<SVGPathElement>('[data-editable-ink]')??[]);
    const direct=inks.length>0&&!element.letteringPaints?.length&&!element.shapeBrush&&!element.drawingVectorSource&&!element.warp&&!element.perspective&&!element.shapeEffects?.some(effect=>effect.enabled);
    const originals=inks.map(ink=>ink.getAttribute('d')??''),clip=content?.style.clipPath,paintWidth=element.shapeGeometry==='bounds'?element.width:100,paintHeight=element.shapeGeometry==='bounds'?element.height:100;
    if(direct&&content)content.style.clipPath='none';
    return {update(next:ShapePath){if(direct){const d=shapePathData(mapShapePath(next,p=>({x:p.x*paintWidth/100,y:p.y*paintHeight/100})));inks.forEach(ink=>ink.setAttribute('d',d));setTransientPath(next);}else onPreview(next);},clear(){if(direct){inks.forEach((ink,i)=>ink.setAttribute('d',originals[i]));if(content)content.style.clipPath=clip??'';setTransientPath(null);}else onPreview(null);}};
  }
  function drag(event: ReactPointerEvent, index: number, handle?: 'in' | 'out',convert=false) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    cancelDrag.current?.();svg.current?.focus({preventScroll:true});
    if(!handle&&mode==='pen'&&!activePath.closed&&!activePath.subpaths?.length&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&(index===0||index===activePath.nodes.length-1)&&onContinue){onContinue(index===0);return;}
    if(!handle&&(mode==='remove'||(mode==='pen'&&!event.ctrlKey&&!event.metaKey&&!event.altKey))){apply(deleteShapePoints(activePath,[index]));setSelection([]);return;}
    const indices = handle ? selection : event.shiftKey ? selection.includes(index) ? selection.filter(i => i !== index) : [...selection, index] : selection.includes(index) ? selection : [index];
    if (!handle) setSelection(indices);
    if (!handle && !indices.includes(index)) return;
    const inverse=svg.current?.getScreenCTM()?.inverse();
    const gesturePoint=(x:number,y:number)=>inverse?mapping.inverse(new DOMPoint(x,y).matrixTransform(inverse)):clientPoint(x,y);
    const start = gesturePoint(event.clientX, event.clientY), base = activePath;
    let finalPath: ShapePath | null = null;
    const preview=previewSession();
    const queue=frameGesture((e:PointerEvent)=>{
      if (e.pointerId !== event.pointerId) return;
      let point = gesturePoint(e.clientX,e.clientY);
      if(e.shiftKey){const origin=handle||convert?base.nodes[index]:start,physical=constrainPenPoint({x:origin.x*element.width/100,y:origin.y*element.height/100},{x:point.x*element.width/100,y:point.y*element.height/100});point={x:physical.x/element.width*100,y:physical.y/element.height*100};}
      const next=handle||convert?{...base,nodes:base.nodes.map((node,i)=>{
        if(i!==index)return node;
        if(convert)return dragPenHandle({x:node.x,y:node.y},point,'out',true);
        const opposite=handle==='in'?'out':'in',other=node[opposite],original=node[handle!];
        const collinear=other&&original&&Math.abs((original.x-node.x)*(other.y-node.y)-(original.y-node.y)*(other.x-node.x))<.001;
        return dragPenHandle(node,point,handle!,linked&&!e.altKey&&Boolean(collinear));
      })}:moveShapePoints(base,indices,{x:point.x-start.x,y:point.y-start.y});
      finalPath = replace(next);
      preview.update(finalPath);
    });
    const move=(event:PointerEvent)=>{const coalesced=event.getCoalescedEvents?.();queue.push(coalesced?.at(-1)??event);};
    const clean = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', cancel);
      queue.cancel();cancelDrag.current = null;
    };
    const cancel = () => { clean(); preview.clear(); };
    const end = (e: PointerEvent) => { if (e.pointerId !== event.pointerId) return;queue.flush();clean();preview.clear();if (finalPath) onChange(finalPath);else if(convert)apply(smoothShapePoints(base,[index],!base.nodes[index].in&&!base.nodes[index].out)); };
    cancelDrag.current = cancel;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', cancel);
  }
  function insertPoint(event:ReactPointerEvent,index:number){
    event.preventDefault();event.stopPropagation();const point=clientPoint(event.clientX,event.clientY);let nearest=.5,distance=Infinity;
    for(let i=1;i<200;i++){const p=pathSegmentPoint(activePath.nodes[index],activePath.nodes[(index+1)%activePath.nodes.length],i/200);const d=Math.hypot((p.x-point.x)*element.width,(p.y-point.y)*element.height);if(d<distance){distance=d;nearest=i/200;}}
    apply(splitShapeSegment(activePath,index,nearest));setSelection([index+1]);
  }
  function canvasPoint(p:Point){const v=mapping.project(p),x=(v.x/100-.5)*element.width,y=(v.y/100-.5)*element.height,a=element.rotation*Math.PI/180;return {x:element.x+x*Math.cos(a)-y*Math.sin(a),y:element.y+x*Math.sin(a)+y*Math.cos(a)};}
  function setCoordinate(axis:'x'|'y',value:number){const node=activePath.nodes[selection[0]];if(!node)return;const target={...canvasPoint(node),[axis]:value},dx=target.x-element.x,dy=target.y-element.y,a=-element.rotation*Math.PI/180;const local=mapping.inverse({x:((dx*Math.cos(a)-dy*Math.sin(a))/element.width+.5)*100,y:((dx*Math.sin(a)+dy*Math.cos(a))/element.height+.5)*100});apply(moveShapePoints(activePath,selection,{x:local.x-node.x,y:local.y-node.y}));}
  function beginPointBox(event:ReactPointerEvent<SVGSVGElement>|PointerEvent,outside=false){
    if(event.button!==0||mode!=='move'||(!outside&&event.target!==event.currentTarget))return;
    event.preventDefault();event.stopPropagation();cancelDrag.current?.();svg.current?.focus({preventScroll:true});
    const matrix=svg.current?.getScreenCTM()?.inverse();if(!matrix)return;
    const toPoint=(x:number,y:number)=>{const p=new DOMPoint(x,y).matrixTransform(matrix);return {x:p.x,y:p.y};},start=toPoint(event.clientX,event.clientY),previous=selection,base=event.shiftKey?selection:[];
    let moved=false;
    const move=(e:PointerEvent)=>{if(e.pointerId!==event.pointerId)return;const point=toPoint(e.clientX,e.clientY),box=selectionBox(start,point);if(!moved&&Math.hypot(e.clientX-event.clientX,e.clientY-event.clientY)<3)return;moved=true;setPointBox(box);setSelection([...new Set([...base,...activePath.nodes.flatMap((node,i)=>pointInSelection(mapping.project(node),box)?[i]:[])])]);};
    const clean=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);setPointBox(null);cancelDrag.current=null;};
    const cancel=()=>{clean();setSelection(previous);};
    const end=(e:PointerEvent)=>{if(e.pointerId!==event.pointerId)return;clean();if(!moved)setSelection(base);};
    cancelDrag.current=cancel;window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',cancel);
  }
  useEffect(()=>{const zone=svg.current?.closest('[data-print-design-zone]');if(!zone)return;const down=(event:Event)=>{const pointer=event as PointerEvent,target=pointer.target as Element;if(svg.current?.contains(target)||target.closest('[data-editor-chrome],[data-measurement-guide]'))return;beginPointBox(pointer,true);};zone.addEventListener('pointerdown',down,true);return()=>zone.removeEventListener('pointerdown',down,true);},[activePath,selection,mode]);
  function worldToLocal(p:Point):Point{const angle=-element.rotation*Math.PI/180,dx=p.x-element.x,dy=p.y-element.y;return mapping.inverse({x:(dx*Math.cos(angle)-dy*Math.sin(angle))/element.width*100+50,y:(dx*Math.sin(angle)+dy*Math.cos(angle))/element.height*100+50});}
  function fitEdge(index:number){try{const world=shapeWorldPath({...element,shapePath:{...activePath,subpaths:undefined}}),last=world.nodes.length-1,closing=world.closed&&index===last,nodes=closing?[...world.nodes,world.nodes[0]]:world.nodes;let fitted=fitDraftEdge(nodes,index,edges.contours,otherRoute);if(closing){const end=fitted.pop()!,start=fitted[0],dx=end.x-start.x,dy=end.y-start.y;fitted[0]={...end,out:start.out?{x:start.out.x+dx,y:start.out.y+dy}:undefined};}apply({...activePath,nodes:mapShapePath({closed:activePath.closed,nodes:fitted},worldToLocal).nodes});setSelection([]);setFitIndex(index);setFitError('');}catch(error){setFitError(error instanceof Error?error.message:'Could not fit the reference edge.');}}
  function fitAll(){try{const world=shapeWorldPath({...element,shapePath:{...activePath,subpaths:undefined}}),reference=fitWholeReference(world,edges.contours),local=mapShapePath(reference,worldToLocal);apply(subpath<0?local:{...activePath,nodes:local.nodes});setSelection([]);setFitError('');}catch(error){setFitError(error instanceof Error?error.message:'Could not fit the outline.');}}

  function dragSegment(event:ReactPointerEvent,index:number){
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();cancelDrag.current?.();svg.current?.focus({preventScroll:true});
    const matrix=svg.current?.getScreenCTM()?.inverse();if(!matrix)return;const local=(x:number,y:number)=>mapping.inverse(new DOMPoint(x,y).matrixTransform(matrix)),start=local(event.clientX,event.clientY),base=activePath,t=nearestPenSegment({closed:false,nodes:[base.nodes[index],base.nodes[(index+1)%base.nodes.length]]},start,{x:element.width,y:element.height}).t,preview=previewSession();let finalPath:ShapePath|null=null;
    const queue=frameGesture((e:PointerEvent)=>{const p=local(e.clientX,e.clientY);finalPath=replace(bendPenSegment(base,index,t,{x:p.x-start.x,y:p.y-start.y}));preview.update(finalPath);});
    const move=(e:PointerEvent)=>{if(e.pointerId===event.pointerId)queue.push(e.getCoalescedEvents?.().at(-1)??e);};
    const clean=()=>{queue.cancel();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);cancelDrag.current=null;};
    const cancel=()=>{clean();preview.clear();};const end=(e:PointerEvent)=>{if(e.pointerId!==event.pointerId)return;queue.flush();clean();preview.clear();if(finalPath)onChange(finalPath);};
    cancelDrag.current=cancel;setSelection([index,(index+1)%base.nodes.length]);window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',cancel);
  }
  function segment(index: number) {
    const a = activePath.nodes[index], b = activePath.nodes[(index + 1) % activePath.nodes.length];
    return Array.from({ length: 33 }, (_, i) => mapping.project(pathSegmentPoint(a, b, i / 32))).map((point, i) => `${i ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  }
  const guideD=shapePathData(mapShapePath({...activePath,subpaths:undefined},mapping.project));
  return <div data-shape-path-editor data-editor-chrome className="pointer-events-none absolute inset-0 z-50">
    {controlsHost&&createPortal(<div role="toolbar" aria-label="Path point actions" className="pen-inspector-controls shape-point-toolbar">
      <div className="pen-controls-heading"><strong>Edit points</strong><span>{activePath.nodes.length} points</span></div><p className="pen-controls-hint">Drag across anchors to select a section. Drag a segment to bend it. Shift adds points; Alt adjusts one handle.</p>
      <div className="pen-mode-actions" role="group" aria-label="Point editing mode">{(['move','add','remove','convert'] as const).map(action=>{const Icon={move:MousePointer2,add:Plus,remove:Minus,convert:CornerUpRight}[action];return <button key={action} className={button} aria-pressed={mode===action} onClick={()=>setMode(action)}><Icon size={16}/><span>{({move:'Move points',add:'Add point',remove:'Remove point',convert:'Corner / curve'})[action]}</span></button>})}</div>
      <button className={button} aria-pressed={mode==='fit'} onClick={()=>setMode(mode==='fit'?'move':'fit')}>Fit edge to reference</button>
      {mode==='fit'&&<div className="pen-reference-fit-controls"><p className="path-workflow-help">Click an edge on your drawing to fit it to the reference. Your rough points guide which boundary to follow.</p><StudioNumber label="Edge to fit" min={1} max={Math.max(1,activePath.nodes.length-(activePath.closed?0:1))} step={1} unit="" value={Math.min(fitIndex+1,Math.max(1,activePath.nodes.length-(activePath.closed?0:1)))} onChange={value=>setFitIndex(value-1)}/><label className="studio-switch">Take the other route<input type="checkbox" checked={otherRoute} onChange={event=>setOtherRoute(event.target.checked)}/></label><div className="pen-draft-actions"><button disabled={edges.loading||!edges.contours.length} onClick={()=>fitEdge(Math.min(fitIndex,activePath.nodes.length-(activePath.closed?1:2)))}>{edges.loading?'Reading outline…':'Fit selected edge'}</button><button disabled={edges.loading||!edges.contours.length} onClick={fitAll}>Fit whole outline</button></div>{fitError&&<p role="alert" className="pen-inline-error">{fitError}</p>}</div>}
      {selection.length>1&&<span className="pen-selection-count">{selection.length} points selected · drag a selected point to move them together</span>}
      {selection.length===1&&activePath.nodes[selection[0]]&&<div className="pen-coordinate-fields"><StudioNumber label="Anchor X" value={canvasPoint(activePath.nodes[selection[0]]).x} min={-100000} max={100000} step={.1} onChange={x=>setCoordinate('x',x)}/><StudioNumber label="Anchor Y" value={canvasPoint(activePath.nodes[selection[0]]).y} min={-100000} max={100000} step={.1} onChange={y=>setCoordinate('y',y)}/></div>}
      {path.subpaths?.length ? <MaterialSelect aria-label="Path contour" value={String(subpath)} onChange={event=>{setSubpath(Number(event.target.value));setSelection([])}}><option value="-1">{element.letteringSource?'Contour 1':'Outer path'}</option>{path.subpaths.map((_,index)=><option key={index} value={String(index)}>{element.letteringSource?`Contour ${index+2}`:`Inner path ${index+1}`}</option>)}</MaterialSelect> : null}
      <details className="pen-point-options curve-cleanup" onToggle={event=>setCleanupOpen(event.currentTarget.open)}><summary>Clean curves</summary><div>
      <p className="pen-controls-hint">Round recognised circular contours without changing connections. For Make circle or Make ellipse, choose the contour above.</p>
      <button className={`${button} curve-cleanup-primary`} disabled={!curveCleanup.count} onClick={()=>applyCurveCleanup(curveCleanup.path)}><Circle size={15}/><span>Round circular contours{curveCleanup.count?` (${curveCleanup.count})`:''}</span></button>
      {!curveCleanup.count&&<p className="pen-controls-hint">No uneven circular contours to clean. You can reshape a closed contour below.</p>}
      <div className="curve-cleanup-choices">
      <button className={button} disabled={!activePath.closed||activePath.nodes.length<3} onClick={()=>applyCurveCleanup(replace(regulariseContour(activePath,element,'circle')))}>Make circle</button>
      <button className={button} disabled={!activePath.closed||activePath.nodes.length<3} onClick={()=>applyCurveCleanup(replace(regulariseContour(activePath,element,'ellipse')))}>Make ellipse</button>
      </div>
      <button className={`${button} curve-cleanup-arc`} disabled={!arcCleanup} onClick={()=>{if(arcCleanup)applyCurveCleanup(replace(arcCleanup));}}><Spline size={15}/><span>Fit selected arc</span></button>
      <p className="pen-controls-hint">Select adjoining points around a curve to fit an arc. Its endpoints stay connected.</p>
      </div></details>
      <details className="pen-point-options"><summary>More point actions</summary><div>
      <button className={button} disabled={!selection.length} onClick={() => apply(smoothShapePoints(activePath, selection, true))}>Curve points</button>
      <button className={button} disabled={!selection.length} onClick={() => apply(smoothShapePoints(activePath, selection, false))}>Corner points</button>
      <button className={button} disabled={!selection.length} onClick={() => { apply(deleteShapePoints(activePath, selection)); setSelection([]); }}>Delete points</button>
      <button className={button} disabled={selection.length!==1||(!activePath.closed&&selection[0]===activePath.nodes.length-1)} onClick={()=>{apply(splitShapeSegment(activePath,selection[0]));setSelection([selection[0]+1]);}}>Add point</button>
      {!element.letteringSource&&<button className={button} disabled={!activePath.closed&&activePath.nodes.length<3} onClick={()=>apply({...activePath,closed:!activePath.closed})}>{activePath.closed?'Open path':'Close path'}</button>}
      <label className="shape-path-action"><input type="checkbox" checked={linked} onChange={event=>setLinked(event.target.checked)}/> Link handles</label>
      {subpath>=0&&<button className={button} onClick={()=>{onChange({...path,subpaths:path.subpaths?.filter((_,i)=>i!==subpath)});setSubpath(-1);setSelection([]);}}>Delete contour</button>}
      {!activePath.closed&&<button className={button} onClick={()=>apply(reversePenPath(activePath))}>Reverse direction</button>}
      </div></details>
      <button className={button} onClick={onDone}>Done</button>
    </div>,controlsHost)}
    <svg ref={svg} tabIndex={-1} viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-label="Editable shape path" onPointerDown={beginPointBox} style={{outline:'none',pointerEvents:'auto'}}>
      {pointBox&&<rect data-point-selection-box x={pointBox.x} y={pointBox.y} width={pointBox.width} height={pointBox.height} fill="#737373" fillOpacity={.12} stroke="#404040" strokeWidth={1/scale} vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
      <path data-active-contour-underlay d={guideD} fill="none" stroke="white" strokeWidth={3/scale} vectorEffect="non-scaling-stroke" pointerEvents="none"/>
      <path data-active-contour-guide d={guideD} fill="none" stroke="#404040" strokeWidth={1/scale} vectorEffect="non-scaling-stroke" pointerEvents="none"/>
      {[path,...(path.subpaths??[])].map((part,i)=>i-1===subpath?null:<path key={'contour-'+i} d={shapePathData({...part,nodes:part.nodes.map(node=>({...mapping.project(node),in:node.in?mapping.project(node.in):undefined,out:node.out?mapping.project(node.out):undefined})),subpaths:undefined})} fill="none" stroke="transparent" style={{strokeWidth:12/scale}} vectorEffect="non-scaling-stroke" className="pointer-events-auto cursor-pointer" onPointerDown={event=>{event.stopPropagation();event.preventDefault();setSubpath(i-1);setSelection([]);}}/>)}
      {activePath.nodes.slice(0, activePath.closed ? undefined : -1).map((_, index) => <path key={index} d={segment(index)} fill="none" stroke="#262626" strokeWidth={1 / scale} vectorEffect="non-scaling-stroke"
        className="pointer-events-auto cursor-copy" style={{ strokeWidth: 12 / scale, stroke: 'transparent' }}
        onPointerDown={event=>{event.stopPropagation();if(mode==='fit'){event.preventDefault();if(!edges.loading)fitEdge(index);return;}if(mode==='add'||mode==='pen'&&!event.ctrlKey&&!event.metaKey)insertPoint(event,index);else if(mode==='move'||mode==='pen')dragSegment(event,index);}}
        onDoubleClick={event=>{if(mode!=='add')insertPoint(event,index);}} />)}
      {activePath.nodes.map((node, index) => {
        const p = mapping.project(node);
        return <g key={index}>
          {selection.includes(index) && (['in', 'out'] as const).map(handle => {
            if (!node[handle]) return null;
            const h = mapping.project(node[handle]);
            return <g key={handle}><line x1={p.x} y1={p.y} x2={h.x} y2={h.y} stroke="#737373" strokeWidth={1 / scale} vectorEffect="non-scaling-stroke" />
              <ellipse aria-label={`Curve ${handle} handle ${index + 1}`} data-shape-curve-handle={handle} cx={h.x} cy={h.y} rx={radiusX*2} ry={radiusY*2} fill="transparent" className="pointer-events-auto cursor-move" onPointerDown={event=>drag(event,index,handle)}/><ellipse data-pen-node-visual cx={h.x} cy={h.y} rx={radiusX*.8} ry={radiusY*.8} fill="#404040" stroke="white" strokeWidth={.7/scale} vectorEffect="non-scaling-stroke" pointerEvents="none"/></g>;
          })}
          <rect role="button" aria-label={`Shape anchor ${index+1}`} aria-pressed={selection.includes(index)} data-shape-anchor={index} x={p.x-radiusX*2.35} y={p.y-radiusY*2.35} width={radiusX*4.7} height={radiusY*4.7} fill="transparent" className="pointer-events-auto cursor-move" onPointerDown={event=>drag(event,index,undefined,mode==='convert'||event.altKey)} onDoubleClick={event=>{event.preventDefault();event.stopPropagation();if(mode==='move')apply(smoothShapePoints(activePath,[index],!node.in&&!node.out));}}/>
          <rect data-pen-node-visual x={p.x-radiusX} y={p.y-radiusY} width={radiusX*2} height={radiusY*2} rx={radiusX*.15} fill={selection.includes(index)?'#404040':'white'} stroke="#404040" strokeWidth={.9/scale} vectorEffect="non-scaling-stroke" pointerEvents="none"/>
        </g>;
      })}
    </svg>
  </div>;
}
