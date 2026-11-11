import {useEffect,useRef} from 'react';
import {flushSync} from 'react-dom';
import type {DesignElement} from '../PrintStudioEditor';
import {SelectionTransformControls} from '../SelectionTransformControls';
import {artworkTransformPreview} from '../../../lib/artworkTransformPreview';
export function MultiArtworkTransform({elements,ids,scale,onChange,previewMask}:{previewMask?:(next:DesignElement)=>string|undefined;elements:DesignElement[];ids:string[];scale:number;onChange:(elements:DesignElement[])=>void}){
 const cleanup=useRef<(()=>void)|null>(null);useEffect(()=>()=>cleanup.current?.(),[]);
 const selected=elements.filter(e=>ids.includes(e.id)&&!e.locked&&!e.hidden&&!e.patternTarget);
 if(selected.length<2)return null;
 const boxes=selected.map(e=>{const a=e.rotation*Math.PI/180,w=(Math.abs(Math.cos(a))*e.width+Math.abs(Math.sin(a))*e.height)/2,h=(Math.abs(Math.sin(a))*e.width+Math.abs(Math.cos(a))*e.height)/2;return {l:e.x-w,r:e.x+w,t:e.y-h,b:e.y+h};});
 const left=Math.min(...boxes.map(b=>b.l)),top=Math.min(...boxes.map(b=>b.t)),width=Math.max(...boxes.map(b=>b.r))-left,height=Math.max(...boxes.map(b=>b.b))-top;
 const start=(event:React.PointerEvent,handle:string)=>{
  event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);cleanup.current?.();
  const frame=event.currentTarget.closest('[data-multi-transform]') as HTMLElement,zone=frame.closest('[data-print-design-zone]') as HTMLElement;if(!zone)return;
  const original=frame.getAttribute('style'),rect=frame.getBoundingClientRect(),pixelScale=rect.width/width,cx=left+width/2,cy=top+height/2,anchorX=handle.includes('w')?left+width:handle.includes('e')?left:cx,anchorY=handle.includes('n')?top+height:handle.includes('s')?top:cy;
  const center={x:rect.left+rect.width/2,y:rect.top+rect.height/2},initial=Math.atan2(event.clientY-center.y,event.clientX-center.x);
  const previews=selected.flatMap(e=>{const node=zone.querySelector<HTMLElement>('[data-print-id="'+e.id+'"]');return node?[{id:e.id,preview:artworkTransformPreview(node,e,elements,previewMask)}]:[]});
  let next=elements,pending:PointerEvent|null=null,animation=0;
  const apply=(ev:PointerEvent)=>{let ratio=1,angle=0;if(handle==='rotate')angle=(Math.atan2(ev.clientY-center.y,ev.clientX-center.x)-initial)*180/Math.PI;else{const dx=(ev.clientX-event.clientX)/pixelScale,dy=(ev.clientY-event.clientY)/pixelScale,rx=dx/width*(handle.includes('w')?-1:1),ry=dy/height*(handle.includes('n')?-1:1);ratio=Math.max(.01,1+(handle==='n'||handle==='s'?ry:handle==='e'||handle==='w'?rx:Math.abs(rx)>Math.abs(ry)?rx:ry));}
   if(ev.shiftKey&&handle==='rotate')angle=Math.round(angle/15)*15;
   const ax=handle==='rotate'||ev.altKey?cx:anchorX,ay=handle==='rotate'||ev.altKey?cy:anchorY,a=angle*Math.PI/180;
   next=elements.map(e=>{if(!selected.includes(e))return e;const x=e.x-ax,y=e.y-ay;return {...e,x:ax+(x*Math.cos(a)-y*Math.sin(a))*ratio,y:ay+(x*Math.sin(a)+y*Math.cos(a))*ratio,width:e.width*ratio,height:e.height*ratio,rotation:e.rotation+angle,...(e.fontSize?{fontSize:e.fontSize*ratio}:{}),...(e.borderWidth?{borderWidth:e.borderWidth*ratio}:{})};});
   for(const {id,preview}of previews)preview.update(next.find(e=>e.id===id)!,next);
   frame.style.left=(ax+(cx-ax)*ratio-width*ratio/2)+'px';frame.style.top=(ay+(cy-ay)*ratio-height*ratio/2)+'px';frame.style.width=width*ratio+'px';frame.style.height=height*ratio+'px';frame.style.transform=`rotate(${angle}deg)`;
  };
  const flush=()=>{animation=0;if(pending){const e=pending;pending=null;apply(e)}};
  const move=(e:PointerEvent)=>{if(e.pointerId!==event.pointerId)return;pending=e;if(!animation)animation=requestAnimationFrame(flush)};
  const restore=()=>{if(animation)cancelAnimationFrame(animation);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',cancel);window.removeEventListener('keydown',key,true);previews.forEach(p=>p.preview.restore());if(original===null)frame.removeAttribute('style');else frame.setAttribute('style',original);cleanup.current=null;};
  const finish=(e:PointerEvent)=>{if(e.pointerId!==event.pointerId)return;if(animation)cancelAnimationFrame(animation);flush();flushSync(()=>{restore();if(next!==elements)onChange(next)});};
  const cancel=()=>restore();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel()}};
  cleanup.current=restore;window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',cancel);window.addEventListener('keydown',key,true);
 };
 return <div data-multi-transform data-editor-chrome style={{position:'absolute',left,top,width,height,zIndex:100,pointerEvents:'none'}}><SelectionTransformControls uiInverseScale={1/scale} onResizePointerDown={(e,h)=>start(e,h)} onRotatePointerDown={e=>start(e,'rotate')}/></div>;
}
