import {SeamFinish} from './SeamFinish';
import * as ContextMenu from '@radix-ui/react-context-menu';
import {useTechnicalDrawing,TECH_OUTLINE_WIDTH,TECH_TRACE_INK_BOLDNESS} from '../../lib/technicalDrawing';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useId, useRef, useState, type ForwardedRef, type PointerEvent as ReactPointerEvent } from 'react';
import { closestBoundaryPoint, distance, flattenSeam, mirrorSeam, pointInSurface, sampleSvgBoundaries, sampleGarmentSurfaces, seamPath } from './panellingGeometry';
import { constructionInk, measureGarmentOutline } from './panellingPresentation';
import { linkedMirrorSeams } from './panellingMirroring';
import { bendSeamSegment,closestSeamLocation,pointOnCurve,straightenSeamSegment,removeSeamAnchor,convertSeamToCurve, insertSeamAnchor, moveSeamAnchor, setAnchorMode, snapAnchor } from './panellingSeams';
import type { BoundaryLoop, PanellingPoint, PanellingSeam, PanelRegion, SeamAnchor } from './panellingTypes';

type Tool = 'pen' | 'select';
export type PanellingEditAction='reshape'|'add-point'|'remove-point';
type SelectedAnchor = { seamId: string; anchorId: string; segmentIndex?:number };
type Drag = SelectedAnchor & {
  pointerId: number;
  mode: 'anchor' | 'handle' | 'segment';
  mirrored?:boolean;
  independent?:boolean;
  segmentIndex?:number;segmentT?:number;grabPoint?:PanellingPoint;curvePoint?:PanellingPoint;
  handle?: 'incoming' | 'outgoing';
  initialSeams: PanellingSeam[];
  frameId?: number;
  latestPoint?: PanellingPoint;
};
const VIEW_SIZE = 2048;

export interface PanellingCanvasSelection extends SelectedAnchor {
  mode: NonNullable<SeamAnchor['handleMode']>;
  hasCurve: boolean;
  kind?:'point'|'segment';
  segmentIndex?:number;
  anchorCount?:number;
  canRemovePoint?:boolean;
}
export interface PanellingCanvasHandle {
  finish: () => void;
  cancel: () => void;
  undo: () => void;
  loadSeam: (seam: PanellingSeam) => void;
  convertSelectedToCurve: () => void;
  straightenSelectedSegment:()=>void;
  insertSelectedPoint:()=>void;
  removeSelectedPoint:()=>void;
  setSelectedAnchorMode: (mode: NonNullable<SeamAnchor['handleMode']>) => void;
}
interface PanellingCanvasProps {
  className?: string;
  surfaceAware?: boolean;
  overlayOnly?: boolean;
  seamColour?: string;
  garmentMarkup: string;
  parentSurfaceId: string;
  parentLabel: string;
  parentFill: string;
  boundaries: BoundaryLoop[];
  symmetryAxis: number;
  seams: PanellingSeam[];
  panels: PanelRegion[];
  mirror: boolean;
  legacyMirror?: boolean;
  tool: Tool;
  editAction?:PanellingEditAction;
  onToolChange?:(tool:Tool)=>void;
  selectedPanelId: string | null;
  onSeamsChange: (seams: PanellingSeam[]) => void;
  onPanelSelect: (id: string | null) => void;
  onBoundariesChange: (boundaries: BoundaryLoop[]) => void;
  onDrawingStateChange: (active: boolean) => void;
  onSelectionChange: (selection: PanellingCanvasSelection | null) => void;
}

function boundariesPath(boundaries: BoundaryLoop[]) {
  return boundaries.map(boundary => `M ${boundary.points.map(point => `${point.x} ${point.y}`).join(' L ')} Z`).join(' ');
}

function nearestAnchor(seams: PanellingSeam[], point: PanellingPoint, radius: number) {
  let match: { seamId: string; anchor: SeamAnchor; distance: number } | undefined;
  for (const seam of seams) for (const anchor of seam.anchors) {
    const current = distance(anchor, point);
    if (current <= radius && (!match || current < match.distance)) match = { seamId: seam.id, anchor, distance: current };
  }
  return match;
}

function nearestHandle(seams: PanellingSeam[], point: PanellingPoint, radius: number) {
  for (const seam of seams) for (const anchor of seam.anchors) {
    for (const handle of ['incoming', 'outgoing'] as const) {
      if (anchor[handle] && distance(anchor[handle]!, point) <= radius) return { seamId: seam.id, anchor, handle };
    }
  }
  return undefined;
}

function nearestSeam(seams:PanellingSeam[],point:PanellingPoint,radius:number){
 let best:({seam:PanellingSeam}&NonNullable<ReturnType<typeof closestSeamLocation>>)|undefined;
 for(const seam of seams){const hit=closestSeamLocation(seam,point);if(hit&&hit.distance<=radius&&(!best||hit.distance<best.distance))best={seam,...hit};}
 return best;
}

const boundaryCache = new Map<string, ReturnType<typeof sampleSvgBoundaries>>();

function PanellingCanvasInner({ className, surfaceAware = false, overlayOnly = false, seamColour = '#1d2424', garmentMarkup, parentSurfaceId, parentLabel, parentFill, boundaries, symmetryAxis, seams, panels, mirror, legacyMirror = false, tool, editAction='reshape', onToolChange, selectedPanelId, onSeamsChange, onPanelSelect, onBoundariesChange, onDrawingStateChange, onSelectionChange }: PanellingCanvasProps, ref: ForwardedRef<PanellingCanvasHandle>) {
  const technical=useTechnicalDrawing();
  const clipId = `panelling-${useId().replaceAll(':', '')}`;
  const frameRef = useRef<HTMLDivElement>(null);
  const garmentRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<{ start: PanellingPoint; pointerId: number; dragged: boolean } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const continuationRef = useRef<{ seamId: string; at: 'start' | 'end' } | null>(null);
  const [drawingPreview, setDrawingPreview] = useState<{ start: PanellingPoint; current: PanellingPoint; dragged: boolean } | null>(null);
  const [active, setActive] = useState<SeamAnchor[]>([]);
  const [cursor, setCursor] = useState<SeamAnchor | null>(null);
  const [selected, setSelected] = useState<SelectedAnchor | null>(null);
  const [snapFeedback, setSnapFeedback] = useState<PanellingPoint | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(760);
  const [boundaryError, setBoundaryError] = useState(false);
  const [dragPreviewSeams, setDragPreviewSeams] = useState<PanellingSeam[] | null>(null);
  const dragPreviewRef = useRef<PanellingSeam[] | null>(null);
  const [constructionWidth, setConstructionWidth] = useState(TECH_OUTLINE_WIDTH);
  const ink = useMemo(() => constructionInk(garmentMarkup), [garmentMarkup]);
  const hitRadius = 14 * VIEW_SIZE / canvasWidth;
  const visibleSeams = linkedMirrorSeams(dragPreviewSeams ?? seams, symmetryAxis, legacyMirror);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setCanvasWidth(Math.max(1, entries[0].contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { onDrawingStateChange(active.length > 0); }, [active.length, onDrawingStateChange]);

  useEffect(() => {
    const svg = garmentRef.current?.querySelector('svg');
    if (!svg) return;
    try {
      const cacheKey = `${surfaceAware}|live-masked-v4|${parentSurfaceId}|${garmentMarkup.length}|${garmentMarkup.replace(/#[0-9a-fA-F]{6}/g, '')}`;
      let sampled = boundaryCache.get(cacheKey);
      if (!sampled) {
        sampled = surfaceAware
          ? sampleGarmentSurfaces(svg)
          : sampleSvgBoundaries(svg, parentSurfaceId);
        boundaryCache.set(cacheKey, sampled);
      }
      onBoundariesChange(sampled);
      const width = measureGarmentOutline(svg, sampled);
      setConstructionWidth(width===undefined?TECH_OUTLINE_WIDTH:technical?TECH_OUTLINE_WIDTH:width);
      setBoundaryError(false);
    } catch (error) {
      console.error(`Could not sample panelling boundaries for ${parentSurfaceId}.`, error);
      setBoundaryError(true);
    }
  }, [garmentMarkup, parentSurfaceId, surfaceAware, onBoundariesChange, technical]);

  const updateSelection = (selection: SelectedAnchor | null, sourceSeams = seams) => {
    setSelected(selection);
    if (!selection) { onSelectionChange(null); return; }
    const anchor = sourceSeams.find(seam => seam.id === selection.seamId)?.anchors.find(point => point.id === selection.anchorId);
    const seam=sourceSeams.find(item=>item.id===selection.seamId),index=seam?.anchors.findIndex(item=>item.id===selection.anchorId)??-1;
    onSelectionChange(anchor&&seam?{...selection,kind:selection.segmentIndex===undefined?'point':'segment',anchorCount:seam.anchors.length,canRemovePoint:selection.segmentIndex===undefined&&index>0&&index<seam.anchors.length-1,mode:anchor.handleMode??'corner',hasCurve:selection.segmentIndex===undefined?Boolean(anchor.incoming||anchor.outgoing):Boolean(seam.anchors[selection.segmentIndex]?.outgoing||seam.anchors[selection.segmentIndex+1]?.incoming)}:null);
  };

  const finish = () => {
    if (active.length < 2) { setActive([]); return; }
    let finished:PanellingSeam|undefined;
    const continuation = continuationRef.current && seams.find(seam => seam.id === continuationRef.current?.seamId);
    if (continuation && continuationRef.current) {
      const extension = continuationRef.current.at === 'end'
        ? active.slice(1)
        : active.slice(1).reverse().map(anchor => ({ ...anchor, incoming: anchor.outgoing, outgoing: anchor.incoming }));
      const anchors = continuationRef.current.at === 'end' ? [...continuation.anchors, ...extension] : [...extension, ...continuation.anchors];
      finished={...continuation,anchors};
      onSeamsChange(seams.map(seam => seam.id === continuation.id ? finished! : seam));
    } else {
      const id = crypto.randomUUID();
      const startSurface = boundaries.find(loop => loop.role === 'outer' && pointInSurface(active[0], boundaries.filter(other => other.surfaceId === loop.surfaceId)))?.surfaceId ?? parentSurfaceId;
      finished={ id, label: `${parentLabel} seam ${seams.length + 1}`, parentSurfaceId: startSurface, anchors: active, construction: 'standard', mirrorLinked: mirror, ...(mirror ? { mirrorGroupId: id } : {}) };
      onSeamsChange([...seams,finished]);
    }
    continuationRef.current = null;
    setActive([]);
    setCursor(null);
    if(finished){onToolChange?.('select');updateSelection({seamId:finished.id,anchorId:finished.anchors[0].id,segmentIndex:0},[finished]);}
  };

  const cancel = () => {
    if(dragRef.current?.frameId!==undefined)cancelAnimationFrame(dragRef.current.frameId);
    dragRef.current=null;dragPreviewRef.current=null;setDragPreviewSeams(null);
    setActive([]);
    setCursor(null);
    setDrawingPreview(null);
    drawingRef.current = null;
    continuationRef.current = null;
  };

  const convertSelectedToCurve = () => {
    if (!selected) return;
    const seam = seams.find(item => item.id === selected.seamId);
    const index = seam?.anchors.findIndex(anchor => anchor.id === selected.anchorId) ?? -1;
    if (!seam || index < 0) return;
    let next = seam;
    if(selected.segmentIndex!==undefined)next=convertSeamToCurve(next,selected.segmentIndex);else{
      if (index > 0) next = convertSeamToCurve(next, index - 1);
      if (index < next.anchors.length - 1) next = convertSeamToCurve(next, index);
    }
    onSeamsChange(seams.map(item => item.id === seam.id ? next : item));
    updateSelection(selected, [next]);
  };

  const setSelectedAnchorMode = (mode: NonNullable<SeamAnchor['handleMode']>) => {
    if (!selected) return;
    const seam = seams.find(item => item.id === selected.seamId);
    if (!seam) return;
    const next = setAnchorMode(seam, selected.anchorId, mode);
    onSeamsChange(seams.map(item => item.id === seam.id ? next : item));
    updateSelection(selected, [next]);
  };

  const replaceSelectedSeam=(next:PanellingSeam,nextSelection=selected)=>{onSeamsChange(seams.map(seam=>seam.id===next.id?next:seam));updateSelection(nextSelection,[next]);};
  const straightenSelectedSegment=()=>{
    const seam=seams.find(item=>item.id===selected?.seamId);if(!seam||!selected)return;
    const index=selected.segmentIndex??Math.min(seam.anchors.length-2,seam.anchors.findIndex(anchor=>anchor.id===selected.anchorId));
    replaceSelectedSeam(straightenSeamSegment(seam,index));
  };
  const insertSelectedPoint=()=>{
    const seam=seams.find(item=>item.id===selected?.seamId);if(!seam||!selected)return;
    const index=selected.segmentIndex??Math.min(seam.anchors.length-2,seam.anchors.findIndex(anchor=>anchor.id===selected.anchorId));
    if(index<0)return;const a=seam.anchors[index],b=seam.anchors[index+1],point=a.outgoing||b.incoming?pointOnCurve(a,b,.5):{x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    const next=insertSeamAnchor(seam,point),inserted=next.anchors.find(anchor=>!seam.anchors.some(old=>old.id===anchor.id));
    if(inserted)replaceSelectedSeam(next,{seamId:seam.id,anchorId:inserted.id});
  };
  const removeSelectedPoint=()=>{
    const seam=seams.find(item=>item.id===selected?.seamId);if(!seam||!selected||selected.segmentIndex!==undefined)return;
    const next=removeSeamAnchor(seam,selected.anchorId);if(next===seam)return;
    replaceSelectedSeam(next,{seamId:seam.id,anchorId:next.anchors[0].id,segmentIndex:0});
  };

  useImperativeHandle(ref, () => ({
    finish,
    cancel,
    undo: () => active.length ? setActive(current => current.slice(0, -1)) : onSeamsChange(seams.slice(0, -1)),
    loadSeam: seam => onSeamsChange([...seams, seam]),
    convertSelectedToCurve,straightenSelectedSegment,insertSelectedPoint,removeSelectedPoint,
    setSelectedAnchorMode,
  }), [active, seams, selected]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if(event.defaultPrevented||(event.target as Element)?.closest('input,textarea,select,[contenteditable="true"]'))return;
      if (event.key === 'Escape') cancel();
      if(event.key==='Enter'&&active.length>1){event.preventDefault();finish();}
      if((event.key==='Delete'||event.key==='Backspace')&&tool==='select'&&selected){event.preventDefault();removeSelectedPoint();}
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && active.length) {
        event.preventDefault();
        setActive(current => current.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, seams, onSeamsChange,selected,tool]);

  const pointFromEvent = (event: Pick<ReactPointerEvent<SVGSVGElement>, 'currentTarget' | 'clientX' | 'clientY'>): PanellingPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * VIEW_SIZE / bounds.width, y: (event.clientY - bounds.top) * VIEW_SIZE / bounds.height };
  };

  const moveDraggedSeam = (drag: Drag, point: PanellingPoint) => drag.initialSeams.map(seam => {
    if (seam.id !== drag.seamId) return seam;
    if(drag.mode==='segment')return bendSeamSegment(seam,drag.segmentIndex!,drag.segmentT!,{x:drag.curvePoint!.x+point.x-drag.grabPoint!.x,y:drag.curvePoint!.y+point.y-drag.grabPoint!.y});
    if (drag.mode === 'anchor') return moveSeamAnchor(seam, drag.anchorId, point);
    return { ...seam, anchors: seam.anchors.map(anchor => {
      if (anchor.id !== drag.anchorId || !drag.handle) return anchor;
      if (anchor.handleMode === 'independent'||drag.independent) return { ...anchor, handleMode:'independent' as const, [drag.handle]: point };
      const opposite = drag.handle === 'incoming' ? 'outgoing' : 'incoming';
      const oldOpposite = anchor[opposite], length = oldOpposite ? distance(anchor, oldOpposite) : distance(anchor, point);
      const dx = point.x - anchor.x, dy = point.y - anchor.y, magnitude = Math.hypot(dx, dy) || 1;
      return { ...anchor, [drag.handle]: point, [opposite]: { x: anchor.x - dx / magnitude * length, y: anchor.y - dy / magnitude * length } };
    }) };
  });

  const startDrag = (drag: Drag) => {
    dragRef.current = { ...drag };
    dragPreviewRef.current = null;
    setDragPreviewSeams(null);
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || !boundaries.length) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromEvent(event), edge = closestBoundaryPoint(point,boundaries);
    if(tool==='select'){
      const editableSeams=linkedMirrorSeams(seams,symmetryAxis,legacyMirror);
      const sourceFor=(id:string)=>{const seam=seams.find(seam=>seam.id===id)??seams.find(seam=>seam.id===id.replace(/:mirror$/,''));return {seam,mirrored:!seams.some(seam=>seam.id===id)};};
      const handle=editAction==='reshape'?nearestHandle(editableSeams.filter(seam=>seam.id===selected?.seamId||seam.id===selected?.seamId+':mirror'),point,hitRadius*.65):undefined;
      if(handle){const {seam,mirrored}=sourceFor(handle.seamId);if(!seam)return;const id=mirrored?handle.anchor.id.replace(/:mirror$/,''):handle.anchor.id;
        startDrag({pointerId:event.pointerId,seamId:seam.id,anchorId:id,mode:'handle',handle:handle.handle,mirrored,initialSeams:seams});updateSelection({seamId:seam.id,anchorId:id});event.currentTarget.setPointerCapture(event.pointerId);return;}
      const anchor=editAction!=='add-point'?nearestAnchor(editableSeams,point,hitRadius*.7):undefined;
      if(anchor){const {seam,mirrored}=sourceFor(anchor.seamId);if(!seam)return;const id=mirrored?anchor.anchor.id.replace(/:mirror$/,''):anchor.anchor.id;
        if(editAction==='remove-point'){const next=removeSeamAnchor(seam,id);if(next!==seam)replaceSelectedSeam(next,{seamId:seam.id,anchorId:next.anchors[0].id,segmentIndex:0});else updateSelection({seamId:seam.id,anchorId:id});return;}
        startDrag({pointerId:event.pointerId,seamId:seam.id,anchorId:id,mode:'anchor',mirrored,initialSeams:seams});updateSelection({seamId:seam.id,anchorId:id});event.currentTarget.setPointerCapture(event.pointerId);return;}
      const hit=nearestSeam(editableSeams,point,hitRadius);
      if(hit){const {seam,mirrored}=sourceFor(hit.seam.id);if(!seam)return;const sourcePoint=mirrored?{x:2*symmetryAxis-point.x,y:point.y}:point;
        if(editAction==='add-point'||event.altKey){const next=insertSeamAnchor(seam,sourcePoint),inserted=next.anchors.find(anchor=>!seam.anchors.some(old=>old.id===anchor.id));const nextSeams=seams.map(item=>item.id===seam.id?next:item);onSeamsChange(nextSeams);
          if(inserted){startDrag({pointerId:event.pointerId,seamId:seam.id,anchorId:inserted.id,mode:'anchor',mirrored,initialSeams:nextSeams});updateSelection({seamId:seam.id,anchorId:inserted.id},nextSeams);event.currentTarget.setPointerCapture(event.pointerId);}return;}
        if(editAction==='remove-point')return;
        const index=hit.segmentIndex,t=Math.max(.05,Math.min(.95,hit.t)),base=convertSeamToCurve(seam,index),curvePoint=pointOnCurve(base.anchors[index],base.anchors[index+1],t);
        startDrag({pointerId:event.pointerId,seamId:seam.id,anchorId:seam.anchors[index].id,mode:'segment',mirrored,segmentIndex:index,segmentT:t,grabPoint:sourcePoint,curvePoint,initialSeams:seams});updateSelection({seamId:seam.id,anchorId:seam.anchors[index].id,segmentIndex:index});event.currentTarget.setPointerCapture(event.pointerId);return;
      }
      onPanelSelect(null);updateSelection(null);return;
    }
    if(!pointInSurface(point,boundaries)&&(!edge||edge.distance>hitRadius))return;

    const endpoint = nearestAnchor(seams.filter(seam => seam.anchors.length > 1), point, hitRadius);
    if (!active.length && endpoint) {
      const seam = seams.find(item => item.id === endpoint.seamId);
      const at = seam?.anchors[0]?.id === endpoint.anchor.id ? 'start' : seam?.anchors.at(-1)?.id === endpoint.anchor.id ? 'end' : null;
      if (seam && at) {
        setActive([endpoint.anchor]);
        continuationRef.current = { seamId: seam.id, at };
        updateSelection({ seamId: seam.id, anchorId: endpoint.anchor.id });
        return;
      }
    }
    drawingRef.current = { start: point, pointerId: event.pointerId, dragged: false };
    setDrawingPreview({ start: point, current: point, dragged: false });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const dragPoint=(drag:Drag,point:PanellingPoint,detach=false)=>{
    const source=drag.mirrored?{x:2*symmetryAxis-point.x,y:point.y}:point;
    if(drag.mode!=='anchor')return source;
    const original=drag.initialSeams.find(seam=>seam.id===drag.seamId)?.anchors.find(anchor=>anchor.id===drag.anchorId);
    const attached=original?.boundaryId&&!detach?boundaries.find(boundary=>boundary.id===original.boundaryId):undefined;
    if(attached)return closestBoundaryPoint(source,[attached])?.point??source;
    return snapAnchor(source,boundaries,drag.initialSeams.filter(seam=>seam.id!==drag.seamId));
  };

  const pointerFrame=useRef<number|undefined>(undefined);
  const pendingPointer=useRef<{point:PanellingPoint;pointerId:number;altKey:boolean}|null>(null);
  useEffect(()=>()=>{if(pointerFrame.current!==undefined)cancelAnimationFrame(pointerFrame.current)},[]);
  const processPointerMove = ({point,pointerId,altKey}:{point:PanellingPoint;pointerId:number;altKey:boolean}) => {
    if(tool==='pen'){const snapped=snapAnchor(point,boundaries,seams,hitRadius);setCursor(snapped);setSnapFeedback(distance(point,snapped)>.5?snapped:null);}else setSnapFeedback(null);
    const drawing = drawingRef.current;
    if (drawing?.pointerId === pointerId) {
      if (distance(drawing.start, point) > 8 * VIEW_SIZE / canvasWidth) drawing.dragged = true;
      setDrawingPreview({ start: drawing.start, current: point, dragged: drawing.dragged });
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerId) return;
    drag.independent=altKey;
    const nextPoint=dragPoint(drag,point,altKey);
    if(drag.mode==='segment'&&!drag.latestPoint&&distance(nextPoint,drag.grabPoint!)<2*VIEW_SIZE/canvasWidth)return;
    drag.latestPoint = nextPoint;
    // Pointer work is already animation-frame scheduled; do not add a second frame of latency.
    dragPreviewRef.current = moveDraggedSeam(drag, nextPoint);
    setDragPreviewSeams(dragPreviewRef.current);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.preventDefault();event.stopPropagation();
    pendingPointer.current={point:pointFromEvent(event),pointerId:event.pointerId,altKey:event.altKey};
    if(pointerFrame.current!==undefined)return;
    pointerFrame.current=requestAnimationFrame(()=>{pointerFrame.current=undefined;const pending=pendingPointer.current;pendingPointer.current=null;if(pending)processPointerMove(pending)});
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if(pointerFrame.current!==undefined){cancelAnimationFrame(pointerFrame.current);pointerFrame.current=undefined;pendingPointer.current=null;}
    const drawing = drawingRef.current;
    if (drawing?.pointerId === event.pointerId) {
      let end = pointFromEvent(event); const anchor = snapAnchor(drawing.start, boundaries, seams,hitRadius);
      if(event.shiftKey){const a=Math.round(Math.atan2(end.y-anchor.y,end.x-anchor.x)/(Math.PI/12))*Math.PI/12,r=distance(anchor,end);end={x:anchor.x+Math.cos(a)*r,y:anchor.y+Math.sin(a)*r};}
      if (drawing.dragged) {
        const handle = end;
        setActive(points => [...points, { ...anchor, outgoing: handle, incoming: event.altKey ? undefined : { x: 2 * anchor.x - handle.x, y: 2 * anchor.y - handle.y }, handleMode:event.altKey?'independent':'smooth' }]);
      } else setActive(points => [...points, { ...anchor, handleMode: 'corner' }]);
      drawingRef.current = null;
      setDrawingPreview(null);
    }
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      if (drag.frameId !== undefined) cancelAnimationFrame(drag.frameId);
      drag.independent=event.altKey;
      const finalPoint = dragPoint(drag,pointFromEvent(event),event.altKey);
      const finalSeams = moveDraggedSeam(drag, finalPoint);
      if (dragPreviewRef.current || drag.latestPoint){onSeamsChange(finalSeams);updateSelection(selected,finalSeams);}
      dragRef.current = null;
      dragPreviewRef.current = null;
      setDragPreviewSeams(null);
    }
  };

  const pending = drawingPreview ? (() => {
    const anchor = snapAnchor(drawingPreview.start, boundaries, seams);
    if (!drawingPreview.dragged) return { ...anchor, handleMode: 'corner' as const };
    const handle = drawingPreview.current;
    return { ...anchor, handleMode: 'smooth' as const, outgoing: handle,
      incoming: { x: 2 * anchor.x - handle.x, y: 2 * anchor.y - handle.y } };
  })() : null;
  const activePreview = !drawingPreview && active.length && cursor ? [...active.slice(-1), { ...cursor, id: 'cursor' }] : [];
  const pendingPath = pending ? [...active.slice(-1), pending] : [];
  const continuedSeam = seams.find(seam => seam.id === continuationRef.current?.seamId);
  const mirrorDraft = continuedSeam ? (continuedSeam.mirrorLinked ?? legacyMirror) : mirror;
  const draftPreview = [...active, ...(pendingPath.length ? pendingPath.slice(-1) : activePreview.slice(-1))];
  const mirroredPreview = mirrorDraft && draftPreview.length > 1
    ? mirrorSeam({ id: 'active', label: 'Preview', anchors: draftPreview, construction: 'standard' }, symmetryAxis).anchors
    : [];
  const selectedSeam = seams.find(seam => seam.id === selected?.seamId);
  const contextActions = tool === 'pen' ? [
    { label: 'Finish seam', action: finish, disabled: active.length < 2 },
    { label: 'Undo last point', action: () => setActive(points => points.slice(0, -1)), disabled: !active.length },
    { label: 'Cancel seam', action: cancel, disabled: !active.length },
  ] : [
    { label: 'Curve segment', action: convertSelectedToCurve, disabled: !selectedSeam },
    { label: 'Straighten segment', action: straightenSelectedSegment, disabled: !selectedSeam },
    { label: 'Insert midpoint', action: insertSelectedPoint, disabled: !selectedSeam },
    { label: 'Smooth point', action: () => setSelectedAnchorMode('smooth'), disabled: !selectedSeam || selected?.segmentIndex !== undefined },
    { label: 'Make corner', action: () => setSelectedAnchorMode('corner'), disabled: !selectedSeam || selected?.segmentIndex !== undefined },
    { label: 'Remove point', action: removeSelectedPoint, disabled: (selectedSeam?.anchors.length ?? 0) <= 2 || selected?.segmentIndex !== undefined },
    { label: 'Delete seam', action: () => {
      if (!selectedSeam) return;
      onSeamsChange(seams.filter(seam => seam.id !== selectedSeam.id));
      updateSelection(null);
    }, disabled: !selectedSeam },
  ];

  return <div className={`panelling-canvas-frame ${className ?? ''}`} ref={frameRef}>
    {boundaryError && <p role="alert" className="absolute left-2 top-2 z-10 rounded bg-red-950/90 px-2 py-1 text-xs text-red-100">
      Could not calculate garment boundaries. Existing panelling data was preserved.
    </p>}
    <div className="panelling-body" style={overlayOnly ? { visibility: 'hidden' } : undefined} aria-hidden={overlayOnly || undefined} ref={garmentRef} dangerouslySetInnerHTML={{ __html: garmentMarkup }} />
    <ContextMenu.Root>
    <ContextMenu.Trigger asChild>
    <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} className={`panelling-overlay ${tool === 'pen' ? 'pen-mode' : 'select-mode'} edit-${editAction}`} role="application" aria-label={`T-shirt ${parentLabel} seam drawing canvas`} tabIndex={0}
      onContextMenu={event => {
        if (tool !== 'select' || event.clientX === 0 && event.clientY === 0) return;
        const point = pointFromEvent(event);
        const anchor = nearestAnchor(visibleSeams, point, hitRadius);
        const segment = anchor ? undefined : nearestSeam(visibleSeams, point, hitRadius);
        const hitId = anchor?.seamId ?? segment?.seam.id;
        const source = seams.find(seam => seam.id === hitId || seam.id + ':mirror' === hitId);
        if (source && anchor) updateSelection({ seamId: source.id, anchorId: hitId === source.id ? anchor.anchor.id : anchor.anchor.id.replace(/:mirror$/, '') });
        else if (source && segment) updateSelection({ seamId: source.id, anchorId: source.anchors[segment.segmentIndex].id, segmentIndex: segment.segmentIndex });
        else updateSelection(null);
      }}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={cancel} onPointerLeave={()=>{if(!drawingRef.current&&!dragRef.current){setCursor(null);setSnapFeedback(null)}}}>
      <defs><clipPath id={clipId}><path d={boundariesPath(boundaries)} fillRule="nonzero" clipRule="nonzero" /></clipPath></defs>
      <g clipPath={`url(#${clipId})`}>
        {panels.map(panel => <path key={panel.id} data-panel-id={panel.id} data-surface-id={panel.parentId} d={panel.path} fill={overlayOnly ? 'transparent' : panel.fillOverride ?? 'transparent'} fillRule="evenodd" fillOpacity={1} stroke="none" onClick={event => { event.stopPropagation(); onPanelSelect(panel.id); }} />)}
        {visibleSeams.map(seam => <g key={seam.id}>
          <path d={seamPath(seam.anchors)} fill="none" stroke="transparent" strokeWidth={hitRadius * 2} pointerEvents={tool === 'select' ? 'stroke' : 'none'} data-seam-id={seam.id} />
          <SeamFinish seam={seam} colour={seamColour}/>
        </g>)}
        {active.length > 1 && <path className="panelling-drawn-segment" d={seamPath(active)} fill="none" stroke="#141414" strokeWidth="1.25" vectorEffect="non-scaling-stroke" strokeLinecap="round" />}
        {pendingPath.length > 0 && <g className="panelling-preview-guide" pointerEvents="none"><path className="panelling-guide-halo" d={seamPath(pendingPath)} fill="none" stroke="#fff" strokeWidth="3.5" strokeOpacity="0.8" vectorEffect="non-scaling-stroke"/><path d={seamPath(pendingPath)} fill="none" stroke="#657d90" strokeWidth="1.25" strokeDasharray="4 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></g>}
        {activePreview.length > 0 && <g className="panelling-preview-guide" pointerEvents="none"><path className="panelling-guide-halo" d={seamPath(activePreview)} fill="none" stroke="#fff" strokeWidth="3.5" strokeOpacity="0.8" vectorEffect="non-scaling-stroke"/><path d={seamPath(activePreview)} fill="none" stroke="#657d90" strokeWidth="1.25" strokeDasharray="4 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></g>}
        {mirroredPreview.length > 0 && <g className="panelling-preview-guide is-mirrored" pointerEvents="none"><path className="panelling-guide-halo" d={seamPath(mirroredPreview)} fill="none" stroke="#fff" strokeWidth="3.5" strokeOpacity="0.8" vectorEffect="non-scaling-stroke"/><path d={seamPath(mirroredPreview)} fill="none" stroke="#657d90" strokeWidth="1.25" strokeDasharray="4 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></g>}
        {!overlayOnly && <g data-original-construction="" pointerEvents="none" dangerouslySetInnerHTML={{ __html: ink }} />}
      </g><g className="panelling-edit-controls">
        {visibleSeams.filter(seam => selected?.seamId === seam.id || seam.id===selected?.seamId+':mirror' || tool === 'select').map(seam => seam.anchors.map(anchor => <g key={anchor.id} className={`panelling-control-point ${(selected?.seamId===seam.id||seam.id===selected?.seamId+':mirror')&&(selected?.anchorId===anchor.id||anchor.id===selected?.anchorId+':mirror')?'is-selected':''}`}>
          {(selected?.seamId===seam.id||seam.id===selected?.seamId+':mirror')&&anchor.incoming && <><line x1={anchor.x} y1={anchor.y} x2={anchor.incoming.x} y2={anchor.incoming.y} className="panelling-handle-line" stroke="#9caebe" strokeWidth="1" vectorEffect="non-scaling-stroke" /><circle cx={anchor.incoming.x} cy={anchor.incoming.y} r={3 * VIEW_SIZE / canvasWidth} fill="#fff" className="panelling-curve-handle" stroke="#8192a8" strokeWidth="1" vectorEffect="non-scaling-stroke" /></>}
          {(selected?.seamId===seam.id||seam.id===selected?.seamId+':mirror')&&anchor.outgoing && <><line x1={anchor.x} y1={anchor.y} x2={anchor.outgoing.x} y2={anchor.outgoing.y} className="panelling-handle-line" stroke="#9caebe" strokeWidth="1" vectorEffect="non-scaling-stroke" /><circle cx={anchor.outgoing.x} cy={anchor.outgoing.y} r={3 * VIEW_SIZE / canvasWidth} fill="#fff" className="panelling-curve-handle" stroke="#8192a8" strokeWidth="1" vectorEffect="non-scaling-stroke" /></>}
          <circle cx={anchor.x} cy={anchor.y} r={(selected?.seamId === seam.id && selected.anchorId === anchor.id ? 4 : 3.25) * VIEW_SIZE / canvasWidth} fill="#fff" className="panelling-anchor" stroke="#657d90" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </g>))}
        {active.map((anchor,index) => <g key={anchor.id} className={`panelling-control-point ${index===active.length-1?'is-current':''}`}>
          {anchor.incoming && <><line x1={anchor.x} y1={anchor.y} x2={anchor.incoming.x} y2={anchor.incoming.y} className="panelling-handle-line" stroke="#9caebe" strokeWidth="1" vectorEffect="non-scaling-stroke" /><circle cx={anchor.incoming.x} cy={anchor.incoming.y} r={3 * VIEW_SIZE / canvasWidth} fill="#fff" className="panelling-curve-handle" stroke="#8192a8" strokeWidth="1" vectorEffect="non-scaling-stroke" /></>}
          {anchor.outgoing && <><line x1={anchor.x} y1={anchor.y} x2={anchor.outgoing.x} y2={anchor.outgoing.y} className="panelling-handle-line" stroke="#9caebe" strokeWidth="1" vectorEffect="non-scaling-stroke" /><circle cx={anchor.outgoing.x} cy={anchor.outgoing.y} r={3 * VIEW_SIZE / canvasWidth} fill="#fff" className="panelling-curve-handle" stroke="#8192a8" strokeWidth="1" vectorEffect="non-scaling-stroke" /></>}
          <circle cx={anchor.x} cy={anchor.y} r={3.25 * VIEW_SIZE / canvasWidth} className="panelling-anchor" fill="#fff" stroke="#657d90" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </g>)}
        {pending && <g className="panelling-control-point is-current">
          {pending.incoming && <><line x1={pending.x} y1={pending.y} x2={pending.incoming.x} y2={pending.incoming.y} className="panelling-handle-line" stroke="#9caebe" strokeWidth="1" vectorEffect="non-scaling-stroke" /><circle cx={pending.incoming.x} cy={pending.incoming.y} r={3 * VIEW_SIZE / canvasWidth} fill="#fff" className="panelling-curve-handle" stroke="#8192a8" strokeWidth="1" vectorEffect="non-scaling-stroke" /></>}
          {pending.outgoing && <><line x1={pending.x} y1={pending.y} x2={pending.outgoing.x} y2={pending.outgoing.y} className="panelling-handle-line" stroke="#9caebe" strokeWidth="1" vectorEffect="non-scaling-stroke" /><circle cx={pending.outgoing.x} cy={pending.outgoing.y} r={3 * VIEW_SIZE / canvasWidth} fill="#fff" className="panelling-curve-handle" stroke="#8192a8" strokeWidth="1" vectorEffect="non-scaling-stroke" /></>}
          <circle cx={pending.x} cy={pending.y} r={3.25 * VIEW_SIZE / canvasWidth} className="panelling-anchor" fill="#fff" stroke="#657d90" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </g>}
        {activePreview.length>0&&cursor&&<circle className="panelling-cursor-point" cx={cursor.x} cy={cursor.y} r={2.5*VIEW_SIZE/canvasWidth} fill="#fff" stroke="#657d90" strokeWidth="1.25" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}
        {snapFeedback && <circle className="panelling-snap-ring" cx={snapFeedback.x} cy={snapFeedback.y} r={6.5 * VIEW_SIZE / canvasWidth} fill="none" stroke="#8192a8" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />}
      </g>
    </svg>
    </ContextMenu.Trigger>
    <ContextMenu.Portal>
      <ContextMenu.Content aria-label="Panelling actions" className="z-[10000] min-w-40 rounded-md border border-neutral-200 bg-white p-1 text-sm text-neutral-800 shadow-lg">
        {contextActions.map(({ label, action, disabled }) => <ContextMenu.Item key={label} disabled={disabled}
          onSelect={action} className="cursor-default rounded px-3 py-2 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-neutral-100">{label}</ContextMenu.Item>)}
      </ContextMenu.Content>
    </ContextMenu.Portal>
    </ContextMenu.Root>

  </div>;
}

export const PanellingCanvas = forwardRef(PanellingCanvasInner);
