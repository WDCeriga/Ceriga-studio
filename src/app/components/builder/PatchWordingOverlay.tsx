import { useRef, useState, useEffect, type PointerEvent, type KeyboardEvent } from 'react';
import { patchSettings, patchTextGeometry, type PatchSettings } from '../../data/garmentPatches';
import { RotateCw } from 'lucide-react';
import type { GarmentDetail } from '../../data/garmentDetails';

let copiedWording: Partial<PatchSettings>|null = null;

// Pointer coordinates use the SVG's inverse screen matrix, including garment zoom and patch rotation.
export function PatchWordingOverlay({detail,ratio,selected,onSelect,onPreview,onCommit}:{detail:GarmentDetail;ratio:number;selected:boolean;onSelect:()=>void;onPreview:(detail:GarmentDetail|null)=>void;onCommit:(detail:GarmentDetail)=>void}) {
  const svg=useRef<SVGSVGElement>(null),gesture=useRef<{origin:GarmentDetail;point:{x:number;y:number};action:'move'|'resize'|'rotate';corner?:{x:number;y:number};geometry:ReturnType<typeof patchTextGeometry>}|null>(null);
  const [draft,setDraft]=useState<GarmentDetail|null>(null),latest=useRef<GarmentDetail|null>(null);
  const [inverse,setInverse]=useState(1),[,fontChanged]=useState(0);
  useEffect(()=>{const node=svg.current;if(!node)return;const refresh=()=>{const matrix=node.getScreenCTM();if(matrix)setInverse(1/Math.max(.01,Math.hypot(matrix.a,matrix.b)))};const observer=new ResizeObserver(refresh);observer.observe(node);refresh();document.fonts.addEventListener('loadingdone',refresh);const loaded=()=>fontChanged(v=>v+1);document.fonts.addEventListener('loadingdone',loaded);return()=>{observer.disconnect();document.fonts.removeEventListener('loadingdone',refresh);document.fonts.removeEventListener('loadingdone',loaded)}},[]);
  const current=draft??detail,settings=patchSettings(current.patch),width=200,height=200/ratio,g=patchTextGeometry(settings,width,height);
  const point=(event:{clientX:number;clientY:number})=>{const matrix=svg.current?.getScreenCTM();if(!matrix)return{x:0,y:0};const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());return{x:detail.flipX?width-p.x:p.x,y:detail.flipY?height-p.y:p.y}};
  const begin=(event:PointerEvent<SVGElement>,action:'move'|'resize'|'rotate',corner?:{x:number;y:number})=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();onSelect();svg.current?.focus();gesture.current={origin:detail,point:point(event),action,corner,geometry:patchTextGeometry(patchSettings(detail.patch),width,height)};latest.current=null;event.currentTarget.setPointerCapture(event.pointerId)};
  const update=(event:{clientX:number;clientY:number;shiftKey:boolean})=>{const active=gesture.current;if(!active)return;const p=point(event),o=patchSettings(active.origin.patch),box=active.geometry,dx=p.x-active.point.x,dy=p.y-active.point.y;let patch:Partial<PatchSettings>={};
    if(active.action==='move')patch={textX:Math.max(0,Math.min(1,(box.x+dx)/width)),textY:Math.max(0,Math.min(1,(box.y+dy)/height))};
    else if(active.action==='rotate'){const angle=box.rotation+(Math.atan2(p.y-box.y,p.x-box.x)-Math.atan2(active.point.y-box.y,active.point.x-box.x))*180/Math.PI;patch={textRotation:event.shiftKey?Math.round(angle/15)*15:angle};}
    else {const c=active.corner!,a=box.rotation*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a),vx=c.x*box.width,vy=c.y*box.height,worldX=vx*cos-vy*sin,worldY=vx*sin+vy*cos,anchorX=box.x-worldX/2,anchorY=box.y-worldY/2;
      const scale=Math.max(.15,Math.min(70/(o.textSize??20),((p.x-anchorX)*worldX+(p.y-anchorY)*worldY)/(worldX*worldX+worldY*worldY)));
      patch={textSize:Math.max(5,Math.min(70,(o.textSize??20)*scale)),textX:(anchorX+worldX*scale/2)/width,textY:(anchorY+worldY*scale/2)/height};}
    const next={...active.origin,patch:{...o,...patch}};latest.current=next;setDraft(next);onPreview(next);
  };
  const cancel=()=>{gesture.current=null;latest.current=null;setDraft(null);onPreview(null)};
  useEffect(()=>()=>onPreview(null),[]);
  const key=(event:KeyboardEvent<SVGSVGElement>)=>{if(!selected)return;const command=event.ctrlKey||event.metaKey,k=event.key.toLowerCase();let patch:Partial<PatchSettings>|null=null;
    if(event.key==='Delete'||event.key==='Backspace')patch={text:''};
    else if(command&&(k==='c'||k==='x')){copiedWording={text:settings.text,textFont:settings.textFont,textMethod:settings.textMethod,textSize:settings.textSize,textTracking:settings.textTracking,textRotation:settings.textRotation,textColour:settings.textColour};if(k==='x')patch={text:''};}
    else if(command&&k==='v'&&copiedWording)patch={...copiedWording,textX:Math.min(1,(settings.textX??.5)+.03),textY:Math.min(1,(settings.textY??.5)+.03)};
    else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){const step=event.shiftKey?.025:.005;patch={textX:(settings.textX??.5)+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),textY:(settings.textY??(settings.textPosition==='bottom'?.8:.5))+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)}}
    else return;
    event.preventDefault();event.stopPropagation();if(patch)onCommit({...detail,patch:{...settings,...patch}});
  };
  return <svg ref={svg} tabIndex={selected?0:-1} aria-label="Patch wording controls" viewBox={`0 0 ${width} ${height}`} className="patch-wording-overlay" onKeyDown={key}
    onPointerMove={event=>{if(!gesture.current)return;event.stopPropagation();update(event)}} onPointerUp={event=>{if(!gesture.current)return;event.stopPropagation();update(event);const next=latest.current;if(next)onCommit(next);cancel()}} onPointerCancel={cancel}>
    {!!settings.text?.trim()&&<g transform={`translate(${detail.flipX?width:0} ${detail.flipY?height:0}) scale(${detail.flipX?-1:1} ${detail.flipY?-1:1})`}><g transform={`rotate(${g.rotation} ${g.x} ${g.y})`}>
      <rect aria-label="Move patch wording" role="button" x={g.x-g.width/2} y={g.y-g.height/2} width={g.width} height={g.height} fill="transparent" stroke={selected?'#CC2D24':'none'} strokeDasharray={selected?'3 3':undefined} strokeWidth={.8} vectorEffect="non-scaling-stroke" className="patch-word-hit" onPointerDown={event=>begin(event,'move')}/>
      {selected&&<>
        <g className="patch-word-handle" onPointerDown={event=>begin(event,'rotate')} role="button" aria-label="Rotate patch wording" transform={`translate(${g.x} ${g.y-g.height/2-28*inverse})`}>
          <circle r={14*inverse} fill="white" stroke="#CC2D24" strokeWidth={.8} vectorEffect="non-scaling-stroke"/><svg x={-6*inverse} y={-6*inverse} width={12*inverse} height={12*inverse} viewBox="0 0 24 24"><RotateCw color="#CC2D24"/></svg>
        </g>
        {([{x:-1,y:-1},{x:1,y:-1},{x:-1,y:1},{x:1,y:1}]).map(c=><g key={`${c.x}:${c.y}`} role="button" aria-label={`Resize patch wording ${c.x}:${c.y}`} className="patch-word-handle" transform={`translate(${g.x+c.x*g.width/2} ${g.y+c.y*g.height/2})`} onPointerDown={event=>begin(event,'resize',c)}><rect x={-11*inverse} y={-11*inverse} width={22*inverse} height={22*inverse} fill="transparent"/><rect x={-3.5*inverse} y={-3.5*inverse} width={7*inverse} height={7*inverse} fill="white" stroke="#CC2D24" strokeWidth={.8} vectorEffect="non-scaling-stroke"/></g>)}
      </>}
    </g></g>}
  </svg>;
}
