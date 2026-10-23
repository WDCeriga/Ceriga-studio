import {ArtworkSelection} from './ArtworkSelection';
import { useId, useRef, useState, useEffect, type PointerEvent, type ReactNode } from 'react';
import { packagingTemplate, packagingSectionHandle, resizePackagingSectionEdge, panelSize, printRegion, packagingElementRegion, constrainPackagingElement, type PackagingDesign, type PackagingElement, type PackagingPanel, type PackagingView } from '../../data/packaging';

interface ArtworkProps {
  garmentPreview?: (reverse: boolean) => ReactNode;
  design: PackagingDesign;
  fit?: boolean;
  surfaceTone?: 'light' | 'dark';
  view?: PackagingView;
  guides?: boolean;
  contents?: boolean;
  garmentColor?: string;
  garmentType?: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onElementChange?: (element: PackagingElement, limited: boolean) => void;
}
function PackagingInlineText({element,onDone}:{element:PackagingElement;onDone:(content?:string)=>void}) {
 const input=useRef<HTMLInputElement>(null),finished=useRef(false);
 const [draft,setDraft]=useState(element.content);
 useEffect(()=>{const field=input.current;if(field){field.focus({preventScroll:true});field.setSelectionRange(field.value.length,field.value.length)}},[]);
 const finish=(content?:string)=>{if(finished.current)return;finished.current=true;onDone(content)};
 return <foreignObject x={-element.width/2} y={-element.height/2} width={element.width} height={element.height} overflow="visible">
 <input className="pkg-inline-text-input" ref={input} aria-label="Edit packaging text on canvas" maxLength={160} value={draft} onChange={event=>setDraft(event.target.value)} onPointerDown={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()} onBlur={()=>finish(draft)} onKeyDown={event=>{event.stopPropagation();if(event.key==='Enter'){event.preventDefault();finish(draft)}else if(event.key==='Escape'){event.preventDefault();finish()}}} style={{boxSizing:'border-box',width:'100%',height:'100%',minWidth:0,padding:0,border:'1px dashed #7892a5',outline:'none',borderRadius:2,background:'transparent',color:element.color,caretColor:element.color,boxShadow:'none',fontFamily:element.font,fontSize:element.fontSize,textAlign:element.align}}/>
 </foreignObject>;
}
export function PackagingSurface({ design, panel, guides, selectedId, onSelect, onElementChange }: ArtworkProps & { panel: PackagingPanel }) {
  const unique = useId().replace(/:/g, '');
  const [editingText,setEditingText]=useState<string|null>(null);
  useEffect(()=>{if(editingText!==selectedId)setEditingText(null)},[selectedId,editingText]);
  const surfaceRef=useRef<SVGGElement>(null);
  const [screenScale,setScreenScale]=useState(1);
  useEffect(()=>{const surface=surfaceRef.current;if(!surface)return;const measure=()=>{const matrix=surface.getScreenCTM();if(matrix)setScreenScale(Math.max(.01,Math.hypot(matrix.a,matrix.b)))};measure();const observer=new ResizeObserver(measure);const svg=surface.ownerSVGElement;if(svg)observer.observe(svg);return()=>observer.disconnect()},[design.templateId,design.view,design.dimensions.width,design.dimensions.height,design.dimensions.depth]);
  const region = printRegion(design, panel);
  const panelBounds = { x: 0, y: 0, ...panelSize(design, panel) };
  const lastTap=useRef<{id:string;time:number;x:number;y:number}|null>(null);
  const drag = useRef<{ pointer: number; x: number; y: number; element: PackagingElement; resize?: boolean; rotate?: boolean; corner?: 'top-left'|'top-right'|'bottom-left'|'bottom-right'; lastAngle?: number; rotation?: number; edge?: 'left' | 'right' | 'top' | 'bottom' } | null>(null);
  const point = (event: PointerEvent<SVGGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : new DOMPoint();
  };
  return <g ref={surfaceRef} data-packaging-surface={panel} onPointerMove={event => {
    if (!drag.current || event.pointerId !== drag.current.pointer) return;
    const position = point(event);
    const original=drag.current.element,dx=position.x-drag.current.x,dy=position.y-drag.current.y;
    const angle=original.rotation*Math.PI/180,localX=dx*Math.cos(angle)+dy*Math.sin(angle),localY=-dx*Math.sin(angle)+dy*Math.cos(angle);
    const factor=Math.max(.05,1+2*(localX*original.width+localY*original.height)/(original.width**2+original.height**2));
    let proposed = drag.current.resize?{...original,fullPanel:false,width:original.width*factor,height:original.height*factor,fontSize:original.fontSize*factor}:{ ...original,fullPanel:false, x: original.x + dx, y: original.y + dy };
    if (drag.current.edge) {
      proposed = resizePackagingSectionEdge(original, drag.current.edge, dx, dy);
    }
    if (drag.current.corner) {
      const horizontal=drag.current.corner.endsWith('left')?'left':'right';
      const vertical=drag.current.corner.startsWith('top')?'top':'bottom';
      proposed=resizePackagingSectionEdge(resizePackagingSectionEdge(original,horizontal,dx,dy),vertical,dx,dy);
      if(original.kind!=='section') {
        const sx=horizontal==='left'?-1:1,sy=vertical==='top'?-1:1;
        const factor=Math.max(.05,1+(sx*localX*original.width+sy*localY*original.height)/(original.width**2+original.height**2));
        const width=original.width*factor,height=original.height*factor;
        const shiftX=sx*(width-original.width)/2,shiftY=sy*(height-original.height)/2;
        proposed={...original,width,height,fontSize:original.fontSize*factor,x:original.x+shiftX*Math.cos(angle)-shiftY*Math.sin(angle),y:original.y+shiftX*Math.sin(angle)+shiftY*Math.cos(angle)};
      }
    }
    if (drag.current.rotate) {
      const current=Math.atan2(position.y-original.y,position.x-original.x)*180/Math.PI;
      const previous=drag.current.lastAngle??current;
      // Unwrap each pointer step so crossing -180/180 keeps turning smoothly.
      const delta=((current-previous+540)%360)-180;
      drag.current.lastAngle=current;
      drag.current.rotation=(drag.current.rotation??original.rotation)+delta;
      const degrees=drag.current.rotation;
      proposed={...original,fullPanel:false,rotation:degrees};
      if(event.shiftKey) proposed.rotation=Math.round(proposed.rotation/15)*15;
    }
    const constrained = constrainPackagingElement(proposed, packagingElementRegion(design,proposed));
    onElementChange?.(constrained, Math.abs(proposed.x - constrained.x) > 0.01 || Math.abs(proposed.y - constrained.y) > 0.01 || Math.abs(proposed.width-constrained.width)>.01);
  }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    <defs><clipPath id={`${unique}-panel`}><rect {...panelBounds} /></clipPath><clipPath id={`${unique}-safe`}><rect {...region} /></clipPath></defs>
    {([true,false,'linked'] as const).map(background=><g key={String(background)} clipPath={background!==false?`url(#${unique}-panel)`:`url(#${unique}-safe)`}>
      {design.elements.filter(element => element.panel === panel && (background===true?element.kind==='section':background==='linked'?element.kind==='text'&&Boolean(element.sectionId):element.kind!=='section'&&!element.sectionId)).map(element => <g key={element.id} data-packaging-element={element.id} tabIndex={onSelect?0:undefined} role={onSelect?"button":undefined} aria-label={onSelect?`Select ${element.name}`:undefined}
        onDoubleClick={event=>{if(element.kind==='text'&&onElementChange){event.preventDefault();event.stopPropagation();drag.current=null;onSelect?.(element.id);setEditingText(element.id)}}}
        onKeyDown={event=>{if((event.target as Element).closest('input'))return;if(event.key==='Enter'&&element.kind==='text'&&onElementChange){event.preventDefault();event.stopPropagation();onSelect?.(element.id);setEditingText(element.id);return}if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();onSelect?.(element.id)}else if(onElementChange&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();const step=event.shiftKey?10:1;const proposed={...element,fullPanel:false,x:element.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),y:element.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)};onElementChange(constrainPackagingElement(proposed,packagingElementRegion(design,proposed)),false)}}}
        transform={`translate(${element.x} ${element.y}) rotate(${element.rotation})`}
        style={{ cursor: onElementChange ? 'move' : undefined, touchAction: 'none' }}
        onPointerDown={event => {
          if ((event.target as Element).closest('input') || editingText===element.id || !onElementChange || event.button !== 0) return;
          if(element.kind==='text') {
            const previous=lastTap.current,time=performance.now();
            lastTap.current={id:element.id,time,x:event.clientX,y:event.clientY};
            if(previous?.id===element.id&&time-previous.time<450&&Math.hypot(event.clientX-previous.x,event.clientY-previous.y)<12){event.preventDefault();event.stopPropagation();drag.current=null;onSelect?.(element.id);setEditingText(element.id);lastTap.current=null;return;}
          }
          event.preventDefault(); event.stopPropagation();event.currentTarget.focus({preventScroll:true}); onSelect?.(element.id);
          const surface = event.currentTarget.parentElement?.parentElement as unknown as SVGGElement;
          const matrix = surface.getScreenCTM();
          if (!matrix) return;
          const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
          drag.current = { pointer: event.pointerId, x: position.x, y: position.y, element };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}>
        {element.kind==='section'?<rect data-packaging-colour-section="" x={-element.width/2} y={-element.height/2} width={element.width} height={element.height} fill={element.color}/>:element.kind === 'text' ? editingText===element.id?<PackagingInlineText element={element} onDone={content=>{setEditingText(null);if(content===undefined||!onElementChange)return;const context=document.createElement('canvas').getContext('2d');if(context)context.font=element.fontSize+'px '+element.font;const width=Math.max(element.fontSize,(context?.measureText(content).width??content.length*element.fontSize)+element.fontSize);onElementChange(constrainPackagingElement({...element,content,width,height:element.fontSize*1.6},packagingElementRegion(design,element)),false)}}/>:<svg x={-element.width / 2} y={-element.height / 2} width={element.width} height={element.height} overflow="hidden">
          <text x={element.align === 'left' ? 0 : element.align === 'right' ? element.width : element.width / 2} y={element.height / 2} dominantBaseline="central" textAnchor={element.align === 'left' ? 'start' : element.align === 'right' ? 'end' : 'middle'} fontFamily={element.font} fontSize={element.fontSize} fill={element.color} letterSpacing="0">{element.content}</text>
        </svg> : <image href={element.content} x={-element.width / 2} y={-element.height / 2} width={element.width} height={element.height} preserveAspectRatio="xMidYMid meet" />}

      </g>)}
    </g>)}
    {design.elements.filter(element=>element.id===selectedId&&element.panel===panel&&editingText!==element.id).map(element=><g key={element.id} data-packaging-section-controls={element.id}>
      <g clipPath={`url(#${unique}-panel)`}><g transform={'translate('+element.x+' '+element.y+') rotate('+element.rotation+')'}>
      <ArtworkSelection kind="packaging" box={{x:-element.width/2,y:-element.height/2,width:element.width,height:element.height}} unit={Math.min(region.width,region.height)}/></g></g>
      {onElementChange&&element.kind==='section'&&(['left','right','top','bottom'] as const).map(edge=>{const size=8/screenScale;const {x,y}=packagingSectionHandle(element,edge,panelBounds,size);return <rect key={edge} data-packaging-handle={edge} role="button" aria-label={'Resize colour section '+edge+' side'} x={x-size/2} y={y-size/2} width={size} height={size} rx={size/5} fill="white" stroke="#7892a5" strokeWidth="1" vectorEffect="non-scaling-stroke" style={{cursor:edge==='left'||edge==='right'?'ew-resize':'ns-resize',touchAction:'none'}} onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();const surface=event.currentTarget.closest('[data-packaging-surface]') as unknown as SVGGElement;const matrix=surface.getScreenCTM();if(!matrix)return;const position=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());drag.current={pointer:event.pointerId,x:position.x,y:position.y,element,edge};surface.setPointerCapture(event.pointerId)}}/>})}
      {onElementChange&&(['top-left','top-right','bottom-left','bottom-right'] as const).map(corner=>{const size=10/screenScale,a=element.rotation*Math.PI/180,lx=(corner.endsWith('left')?-1:1)*element.width/2,ly=(corner.startsWith('top')?-1:1)*element.height/2;const x=Math.max(size,Math.min(panelBounds.width-size,element.x+lx*Math.cos(a)-ly*Math.sin(a))),y=Math.max(size,Math.min(panelBounds.height-size,element.y+lx*Math.sin(a)+ly*Math.cos(a)));return <rect key={corner} data-packaging-handle={corner} aria-label={'Resize '+element.name+' '+corner+' corner'} role="button" x={x-size/2} y={y-size/2} width={size} height={size} rx={size/5} fill="white" stroke="#7892a5" strokeWidth="1" vectorEffect="non-scaling-stroke" style={{cursor:corner==='top-left'||corner==='bottom-right'?'nwse-resize':'nesw-resize',touchAction:'none'}} onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();const surface=event.currentTarget.closest('[data-packaging-surface]') as unknown as SVGGElement;const matrix=surface.getScreenCTM();if(!matrix)return;const position=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());drag.current={pointer:event.pointerId,x:position.x,y:position.y,element,corner};surface.setPointerCapture(event.pointerId)}}/>})}
      {onElementChange&&(()=>{const r=11/screenScale;const anchor=packagingSectionHandle(element,'top',panelBounds,r);const x=anchor.x,y=anchor.y-r*2.5;return <g data-packaging-handle="rotate"><rect x={x-r} y={y-r} width={r*2} height={r*2} rx={r*.4} fill="white" stroke="#a4b2c6" strokeWidth="1" vectorEffect="non-scaling-stroke" role="button" tabIndex={0} aria-label="Rotate colour section" style={{cursor:'grab',touchAction:'none'}} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();event.stopPropagation();onElementChange({...element,fullPanel:false,rotation:element.rotation+(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?15:1)},false)}} onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();const surface=event.currentTarget.closest('[data-packaging-surface]') as unknown as SVGGElement;const matrix=surface.getScreenCTM();if(!matrix)return;const position=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());drag.current={pointer:event.pointerId,x:position.x,y:position.y,element,rotate:true,lastAngle:Math.atan2(position.y-element.y,position.x-element.x)*180/Math.PI,rotation:element.rotation};surface.setPointerCapture(event.pointerId)}}/><path d={'M '+(x+r*.5)+' '+(y-r*.1)+' A '+r*.53+' '+r*.53+' 0 1 0 '+(x+r*.28)+' '+(y+r*.45)+' M '+(x+r*.5)+' '+(y-r*.6)+' L '+(x+r*.5)+' '+(y-r*.1)+' L '+x+' '+(y-r*.1)} fill="none" stroke="#657d90" strokeWidth="1.3" vectorEffect="non-scaling-stroke" pointerEvents="none"/><title>Drag around the section centre to rotate through 360°. Hold Shift to snap to 15°. Arrow keys rotate by 1°.</title></g>})()}
    </g>)}
    {guides && <rect data-packaging-guide="safe" {...region} fill="none" stroke="#657d90" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="5 4" pointerEvents="none" />}
  </g>;
}

function FoldedGarment({ color = '#737b7b', garmentType = 'tshirt', reverse = false, width, height }: {
  color?: string; garmentType?: string; reverse?: boolean; width: number; height: number;
}) {
  const unique = useId().replace(/:/g, '');
  const tshirt = garmentType === 'tshirt';
  const body = 'M35 33Q55 23 89 23Q120 29 151 23Q185 23 205 33L211 263Q212 280 196 282Q120 287 44 282Q28 280 29 263Z';
  return <svg data-folded-garment={tshirt ? 'tshirt' : 'garment'} data-garment-facing={reverse ? 'back' : 'front'} width={width} height={height} viewBox="0 0 240 300" preserveAspectRatio="xMidYMid meet" overflow="hidden" pointerEvents="none">
    <defs>
      <linearGradient id={`${unique}-fabric`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#fff" stopOpacity=".15" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".13" /></linearGradient>
      <linearGradient id={`${unique}-edge`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#000" stopOpacity=".06" /><stop offset="1" stopColor="#000" stopOpacity=".27" /></linearGradient>
    </defs>
    <ellipse cx="120" cy="286" rx="99" ry="9" fill="#000" opacity=".1" />
    {tshirt && <g data-garment-detail="tucked-sleeves" fill={color} stroke="#000" strokeOpacity=".18" strokeWidth="1.2" strokeLinejoin="round">
      <path d="M38 35Q23 42 20 65L16 136Q25 151 45 155L65 91Z" />
      <path d="M202 35Q217 42 220 65L224 136Q215 151 195 155L175 91Z" />
      <path d="M20 65 42 111 45 155Q25 151 16 136ZM220 65 198 111 195 155Q215 151 224 136Z" fill="#000" opacity=".09" stroke="none" />
      <path d="M17 132Q29 142 44 145M223 132Q211 142 196 145" fill="none" />
    </g>}
    <g data-garment-detail="folded-edge">
      <path d="M30 259Q120 267 210 259L211 279Q208 289 196 290H44Q32 289 29 279Z" fill={color} />
      <path d="M30 259Q120 267 210 259L211 279Q208 289 196 290H44Q32 289 29 279Z" fill={`url(#${unique}-edge)`} />
      <path d="M36 283Q120 289 204 283" fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth="1.2" />
    </g>
    <path data-garment-detail="folded-body" d={body} fill={color} />
    <path d={body} fill={`url(#${unique}-fabric)`} stroke="#000" strokeOpacity=".2" strokeWidth="1.2" />
    <path d="M40 38Q58 29 84 29M156 29Q183 29 200 38M34 268Q120 277 206 268" fill="none" stroke="#fff" strokeOpacity=".24" strokeWidth="1.6" />
    <path d="M42 57Q48 109 39 169M198 57Q192 109 201 169M43 255Q119 264 197 255" fill="none" stroke="#000" strokeOpacity=".09" strokeWidth="1.3" />
    {tshirt && !reverse && <g data-garment-detail="collar">
      <path d="M87 24Q120 32 153 24Q151 69 120 71Q89 69 87 24Z" fill={color} />
      <path d="M87 24Q120 32 153 24Q151 69 120 71Q89 69 87 24Z" fill="#000" opacity=".24" />
      <path d="M92 26Q96 60 120 62Q144 60 148 26" fill="none" stroke={color} strokeWidth="7" />
      <path d="M88 26Q92 67 120 68Q148 67 152 26" fill="none" stroke="#fff" strokeOpacity=".24" strokeWidth="1.3" />
      <path d="M94 28Q120 34 146 28" fill="none" stroke="#000" strokeOpacity=".18" strokeWidth="1.4" />
      <path d="M113 31H127V40Q120 42 113 40Z" fill="#eeeae2" opacity=".7" />
    </g>}
    {reverse && <path data-garment-detail="back-fold" d="M39 63Q120 70 201 63M55 73Q58 135 48 200M185 73Q182 135 192 200" fill="none" stroke="#000" strokeOpacity=".1" strokeWidth="1.3" />}
  </svg>;
}

function FoldedLiveGarment({preview,reverse,color,width,height}:{preview:(reverse:boolean)=>ReactNode;reverse:boolean;color:string;width:number;height:number}) {
 const id=useId().replace(/:/g,'');
 const sourceRef=useRef<HTMLDivElement>(null);
 const [nativeMarkup,setNativeMarkup]=useState('');
 const [framing,setFraming]=useState({x:-140,y:-80});
 useEffect(()=>{
  const host=sourceRef.current;if(!host)return;let frame=0;
  const measure=()=>{
   const native=host.querySelector('[data-fold-geometry]');if(!native)return;
   try { const parts=JSON.parse(native.getAttribute('data-fold-geometry')??'[]') as {id:string;left:number;top:number;right:number;bottom:number}[];
    const neck=parts.find(p=>p.id==='neck'),body=parts.find(p=>p.id==='base');if(!neck&&!body)return;
    const target=neck??body!;
    const next={x:120-(target.left+target.right)/2*520/2048,y:30-target.top*520/2048};
    setFraming(old=>Math.abs(old.x-next.x)+Math.abs(old.y-next.y)>.2?next:old);
    const foreign=host.closest('foreignObject') as unknown as SVGGraphicsElement;
    const root=foreign?.getScreenCTM();if(root){
     const pieces:string[]=[];
     const layerOrder=(node:Element)=>{let order=0,current:Element|null=node;while(current&&current!==host){const value=Number(getComputedStyle(current).zIndex);if(Number.isFinite(value))order+=value;current=current.parentElement}return order};
     Array.from(host.querySelectorAll('svg')).sort((a,b)=>layerOrder(a)-layerOrder(b)).forEach(node=>{const svg=node as SVGSVGElement;if(svg.closest('defs')||!svg.closest('[data-layer-id]')||!svg.viewBox.baseVal.width)return;const matrix=svg.getScreenCTM();if(!matrix)return;const relative=root.inverse().multiply(matrix);relative.e-=Number(foreign.getAttribute('x'));relative.f-=Number(foreign.getAttribute('y'));const clone=svg.cloneNode(true) as SVGSVGElement;const box=svg.viewBox.baseVal;clone.setAttribute('width',String(box.width));clone.setAttribute('height',String(box.height));clone.setAttribute('x','0');clone.setAttribute('y','0');clone.removeAttribute('class');clone.removeAttribute('style');
      const originals=svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon,text');const copies=clone.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon,text');originals.forEach((element,index)=>{if(element.closest('defs'))return;const paint=getComputedStyle(element);for(const key of ['fill','stroke','stroke-width','opacity','fill-opacity','stroke-opacity','stroke-linejoin','stroke-linecap','font-family','font-size']){const value=paint.getPropertyValue(key);if(value)copies[index]?.setAttribute(key,value)}});
      pieces.push('<g transform="'+'matrix('+[relative.a,relative.b,relative.c,relative.d,relative.e,relative.f].join(' ')+')'+'">'+new XMLSerializer().serializeToString(clone)+'</g>');
     });
     if(pieces.length){const prefix=id+'-mobile-';let markup=pieces.join('');const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);for(const original of new Set(ids)){markup=markup.split('id="'+original+'"').join('id="'+prefix+original+'"').split('#'+original).join('#'+prefix+original)}setNativeMarkup(previous=>previous===markup?previous:markup)}
    }
   }catch{}
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure)};
  const observer=new MutationObserver(schedule);observer.observe(host,{subtree:true,childList:true,attributes:true});const resize=new ResizeObserver(schedule);resize.observe(host);schedule();return()=>{observer.disconnect();resize.disconnect();cancelAnimationFrame(frame)};
 },[reverse,id]);

 return <svg data-packaging-folded-live="true" data-garment-facing={reverse?'back':'front'} width={width} height={height} viewBox="0 0 240 260" preserveAspectRatio="xMidYMid meet" overflow="hidden" pointerEvents="none">
  <defs>
   <clipPath id={id+'-folded-body'}><path d="M36 40Q36 32 45 31Q120 23 195 31Q204 32 204 40V213Q204 222 193 223H47Q36 222 36 213Z"/></clipPath>
   <linearGradient id={id+'-side-fold'}><stop stopColor="#000" stopOpacity=".15"/><stop offset=".07" stopColor="#fff" stopOpacity=".1"/><stop offset=".18" stopColor="#000" stopOpacity="0"/><stop offset=".82" stopColor="#000" stopOpacity="0"/><stop offset=".94" stopColor="#fff" stopOpacity=".08"/><stop offset="1" stopColor="#000" stopOpacity=".16"/></linearGradient><linearGradient id={id+'-fold-shade'} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff" stopOpacity=".10"/><stop offset=".75" stopColor="#000" stopOpacity="0"/><stop offset="1" stopColor="#000" stopOpacity=".09"/></linearGradient>
  </defs>
  <ellipse cx="120" cy="238" rx="88" ry="7" fill="#000" opacity=".10"/>
  <rect data-folded-sleeves="tucked" x="38" y="47" width="164" height="186" rx="9" fill={color}/>
  <rect x="38" y="47" width="164" height="186" rx="9" fill="#000" opacity=".13"/>
  <rect x="36" y="43" width="168" height="186" rx="9" fill={color}/>
  <defs><clipPath id={id+'-turned-fold'}><rect x="39" y="215" width="162" height="13" rx="5"/></clipPath></defs>
  <g clipPath={'url(#'+id+'-turned-fold)'} transform="translate(0 443) scale(1 -1)"><foreignObject x="-140" y="-80" width="520" height="520"><div data-live-fold-source="under-fold" className="pkg-fold-source" style={{width:520,height:520,pointerEvents:'none'}}>{preview(!reverse)}</div></foreignObject></g>
  <g clipPath={'url(#'+id+'-folded-body)'}>
   <rect x="36" y="23" width="168" height="201" fill={color}/>
   {/* Only the central chest remains visible after both sleeves fold underneath. */}
   <foreignObject style={{opacity:nativeMarkup?0:1}} x={framing.x} y={framing.y} width="520" height="520"><div ref={sourceRef} data-live-fold-source="front-face" className="pkg-fold-source" style={{width:520,height:520,pointerEvents:'none'}}>{preview(reverse)}</div></foreignObject>{nativeMarkup&&<svg data-native-fold-source="" x={framing.x} y={framing.y} width="520" height="520" viewBox="0 0 520 520" overflow="visible" dangerouslySetInnerHTML={{__html:nativeMarkup}}/>}
   <rect x="36" y="23" width="168" height="201" fill={'url(#'+id+'-fold-shade)'}/><rect x="36" y="23" width="168" height="201" fill={'url(#'+id+'-side-fold)'}/>
  </g>
  <path d="M36 40Q36 32 45 31Q120 23 195 31Q204 32 204 40V213Q204 222 193 223H47Q36 222 36 213Z" fill="none" stroke="#000" strokeOpacity=".05" strokeWidth=".5"/>
  <path data-folded-hem="turned-up" d="M38 213Q120 218 202 213L201 222Q120 228 39 222Z" fill={color}/>
  <path d="M39 214Q120 219 201 214" fill="none" stroke="#000" strokeOpacity=".13" strokeWidth="1"/>
  <path d="M43 222Q120 227 197 222M44 229Q120 234 196 229" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="1"/>
 </svg>;
}
function PackagingContents({ design, panel, garmentColor, garmentType, garmentPreview, reverse = false }: ArtworkProps & { panel: PackagingPanel; reverse?: boolean }) {
  const region = printRegion({ ...design, shippingLabel: false }, panel);
  const inset = Math.min(region.width, region.height) * .025;
  return <g data-packaging-contents="true" transform={`translate(${region.x + inset} ${region.y + inset})`} pointerEvents="none">
    {garmentPreview?<FoldedLiveGarment preview={garmentPreview} reverse={reverse} color={garmentColor??'#737b7b'} width={region.width-inset*2} height={region.height-inset*2}/>:<FoldedGarment color={garmentColor} garmentType={garmentType} reverse={reverse} width={region.width - inset * 2} height={region.height - inset * 2} />}
  </g>;
}

type Point = [number, number];
type Vertex = [number, number, number];
interface BoxFace { vertices: Vertex[]; panel?: PackagingPanel; interior?: boolean; shade?: number; tape?: boolean; notch?: boolean; magnets?: boolean; outline?: boolean }
export function packagingBoxGeometry(design: PackagingDesign, view: PackagingView) {
  const bulk = design.category === 'none';
  const { width, height: length, depth } = bulk ? { width: 420, height: 340, depth: 290 } : design.dimensions;
  const closure = packagingTemplate(design.templateId).closure;
  const opened = view === 'open' && !bulk;
  const reverse = view === 'reverse';
  const thickness = Math.min(4, depth * .06, width * .02, length * .02);
  const faces: BoxFace[] = [];
  const add = (vertices: Vertex[], panel?: PackagingPanel, interior = false, shade = 0, tape = false) => faces.push({ vertices, panel, interior, shade, tape });
  const front = (start: number, end: number, back: number, top: number, bottom: number, panel?: PackagingPanel, interior = false, shade = .08) => add([[start, back, top], [end, back, top], [end, back, bottom], [start, back, bottom]], panel, interior, shade);
  const topFace = (start: number, end: number, near: number, far: number, level: number, panel?: PackagingPanel, interior = false, shade = 0) => add([[start, far, level], [end, far, level], [end, near, level], [start, near, level]], panel, interior, shade);
  const side = (across: number, near: number, far: number, top: number, bottom: number, panel?: PackagingPanel, interior = false, shade = .16) => add([[across, near, top], [across, far, top], [across, far, bottom], [across, near, bottom]], panel, interior, shade);
  const tray = (offset: number, inset = 0) => {
    const near = offset + inset;
    const far = offset + length - inset;
    const low = inset;
    const high = width - inset;
    const level = depth - inset;
    front(low, high, far, level, thickness, undefined, true, .15);
    side(low, near, far, level, thickness, undefined, true, .1);
    topFace(low + thickness, high - thickness, near + thickness, far - thickness, thickness, 'interior-base', true, .04);
    front(low + thickness, high - thickness, near + thickness, level, thickness, undefined, true, .08);
    side(high - thickness, near, far, level, thickness, undefined, true, .12);
    side(high, near, far, level, 0, 'right');
    front(low, high, near, level, 0, 'front');
    if (closure === 'drawer') {
      faces[faces.length - 1].notch = true;
      const halfNotch = Math.min(12, width * .04);
      topFace(low, width / 2 - halfNotch, near, near + thickness, level, undefined, true);
      topFace(width / 2 + halfNotch, high, near, near + thickness, level, undefined, true);
    } else topFace(low, high, near, near + thickness, level, undefined, true);
    topFace(low, high, far - thickness, far, level, undefined, true);
    topFace(low, low + thickness, near, far, level, undefined, true);
    topFace(high - thickness, high, near, far, level, undefined, true);
  };
  if (opened) {
    if (closure === 'fold' || closure === 'magnet' || closure === 'lift') {
      const lidBack = length + length * .28;
      const lidTop = depth + length * .96;
      const lift = closure === 'lift' ? depth * .65 : 0;
      add([[0, lidBack, lidTop + lift], [width, lidBack, lidTop + lift], [width, length, depth + lift], [0, length, depth + lift]], 'interior-lid', true);
      const flap = Math.min(depth * .6, width * .16);
      if (closure === 'fold' || closure === 'lift') {
        add([[0, lidBack, lidTop + lift], [-flap, lidBack - flap * .2, lidTop - flap * .45 + lift], [-flap, length + flap * .5, depth + flap * .35 + lift], [0, length, depth + lift]], undefined, true, .08);
        add([[width, lidBack, lidTop + lift], [width + flap, lidBack - flap * .2, lidTop - flap * .45 + lift], [width + flap, length + flap * .5, depth + flap * .35 + lift], [width, length, depth + lift]], undefined, true, .08);
      }
      add([[0, lidBack, lidTop + lift], [width, lidBack, lidTop + lift], [width - thickness * 2, lidBack + flap * .55, lidTop + flap * .35 + lift], [thickness * 2, lidBack + flap * .55, lidTop + flap * .35 + lift]], undefined, true, .06);
      if (closure === 'magnet') faces[faces.length - 1].magnets = true;
    }
    if (closure === 'tape') {
      const flap = length / 2;
      add([[0, length, depth], [width, length, depth], [width, length + flap * .8, depth + flap * .6], [0, length + flap * .8, depth + flap * .6]], undefined, true, .04);
      add([[0, 0, depth], [0, length, depth], [-width * .46, length, depth + width * .196], [-width * .46, 0, depth + width * .196]], undefined, true, .1);
    }
    tray(closure === 'drawer' ? -length * .25 : 0, closure === 'drawer' ? thickness * .35 : 0);
    if (closure === 'drawer') {
      side(width, 0, length, depth, 0, 'right');
      topFace(0, width, 0, length, depth, 'top');
    }
    if (closure === 'tape') {
      add([[width, 0, depth], [width, length, depth], [width * 1.46, length, depth + width * .196], [width * 1.46, 0, depth + width * .196]], undefined, true, .1);
      const flap = length / 2;
      add([[0, 0, depth], [width, 0, depth], [width, -flap * .92, depth - flap * .39], [0, -flap * .92, depth - flap * .39]], undefined, true, .04);
    }
  } else {
    side(width, 0, length, depth, 0, reverse ? 'left' : 'right');
    if (closure === 'drawer' && !reverse) {
      front(0, width, 0, depth, 0, undefined, false, .16);
      faces[faces.length - 1].outline = false;
      front(thickness * .35, width - thickness * .35, 0, depth - thickness * .35, 0, 'front');
      faces[faces.length - 1].notch = true;
    } else front(0, width, 0, depth, 0, reverse ? 'back' : 'front');
    topFace(0, width, 0, length, depth, 'top');
    if (closure === 'fold' || closure === 'magnet' || closure === 'lift') {
      const lip = Math.min(depth * .28, 22);
      front(0, width, 0, depth, depth - lip, undefined, false, .03);
      side(width, 0, length, depth, depth - lip, undefined, false, .11);
      if (closure === 'fold' && !reverse) {
        const tabWidth = Math.min(width * .18, 55);
        add([[(width - tabWidth) / 2, -1, depth - lip], [(width + tabWidth) / 2, -1, depth - lip], [(width + tabWidth) / 2 - 4, -1, depth - lip * 1.7], [(width - tabWidth) / 2 + 4, -1, depth - lip * 1.7]], undefined, false, .04);
      }
    }
    if (closure === 'tape') {
      const tapeWidth = Math.min(48, width * .14);
      topFace((width - tapeWidth) / 2, (width + tapeWidth) / 2, 0, length, depth, undefined, false, 0);
      faces[faces.length - 1].tape = true;
      front((width - tapeWidth) / 2, (width + tapeWidth) / 2, 0, depth, depth - Math.min(depth * .3, 65), undefined, false, 0);
      faces[faces.length - 1].tape = true;
    }
  }
  return faces;
}
function boxProject([across, back, up]: Vertex): Point { return [across * .9 + back * .48, across * .18 - back * .42 - up * .95]; }
function boxBounds(faces: BoxFace[]) {
  const points = faces.flatMap(face => face.vertices.map(boxProject));
  const left = Math.min(...points.map(point => point[0]));
  const top = Math.min(...points.map(point => point[1]));
  return { left, top, width: Math.max(...points.map(point => point[0])) - left, height: Math.max(...points.map(point => point[1])) - top };
}
function PackagingBox(props: ArtworkProps & { view: PackagingView }) {
  const { design, view } = props;
  const faces = packagingBoxGeometry(design, view);
  const bounds = boxBounds(faces);
  const envelope = boxBounds([...packagingBoxGeometry(design, 'closed'), ...packagingBoxGeometry(design, 'open')]);
  const scale = Math.min(540 / envelope.width, 490 / envelope.height);
  const template = packagingTemplate(design.templateId);
  const bulk = design.category === 'none';
  return <g data-box-view={view} className="pkg-box-view" transform={`translate(${320 - (bounds.left + bounds.width / 2) * scale} ${300 - (bounds.top + bounds.height / 2) * scale}) scale(${scale})`}>
    {faces.map((face, index) => {
      const points = face.vertices.map(boxProject);
      const fill = face.tape ? '#ae8956' : bulk ? '#bd9561' : face.interior ? design.interior : design.exterior;
      const printable = face.panel && !bulk && template.panels.includes(face.panel);
      const dimensions = face.panel ? panelSize(design, face.panel) : null;
      const surfacePoints = face.panel === 'top' && view === 'reverse' ? [points[2], points[3], points[0], points[1]] : points;
      if (face.notch) {
        const faceWidth = face.vertices[1][0] - face.vertices[0][0];
        const faceHeight = face.vertices[0][2] - face.vertices[3][2];
        const notchWidth = Math.min(24, design.dimensions.width * .08);
        const notchDepth = Math.min(6, faceHeight * .1);
        const shape = `M0 0H${(faceWidth - notchWidth) / 2}Q${faceWidth / 2} ${notchDepth * 2} ${(faceWidth + notchWidth) / 2} 0H${faceWidth}V${faceHeight}H0Z`;
        return <g key={index} data-box-face={face.panel} data-box-material="exterior" transform={projection(points[0], points[1], points[3], faceWidth, faceHeight)}>
          <path d={shape} fill={fill} />
          <path d={shape} fill="#000" opacity={face.shade} />
          {printable && dimensions && <g data-packaging-panel={face.panel} transform={`scale(${faceWidth / dimensions.width} ${faceHeight / dimensions.height})`}><PackagingSurface {...props} guides={props.guides && design.selectedPanel === face.panel} panel={face.panel!} /></g>}
          <path d={shape} fill="none" stroke="#514d46" strokeWidth="1.15" vectorEffect="non-scaling-stroke" />
        </g>;
      }
      return <g key={index} data-box-face={face.panel ?? (face.tape ? 'tape' : 'construction')} data-box-material={face.interior ? 'interior' : 'exterior'}>
        <polygon points={points.map(point => point.join(',')).join(' ')} fill={fill} />
        {!!face.shade && <polygon points={points.map(point => point.join(',')).join(' ')} fill="#000" opacity={face.shade} />}
        {printable && dimensions && <g data-packaging-panel={face.panel} transform={projection(surfacePoints[0], surfacePoints[1], surfacePoints[3], dimensions.width, dimensions.height)}><PackagingSurface {...props} guides={props.guides && design.selectedPanel === face.panel} panel={face.panel!} /></g>}
        {props.contents && view === 'open' && face.panel === 'interior-base' && dimensions && <g transform={projection(points[0], points[1], points[3], dimensions.width, dimensions.height)}>
          <PackagingContents {...props} panel="interior-base" />
        </g>}
        {face.magnets && (() => {
          const flapWidth = face.vertices[1][0] - face.vertices[0][0];
          const flapHeight = Math.hypot(...face.vertices[3].map((coordinate, axis) => coordinate - face.vertices[0][axis]));
          const radius = Math.min(5, flapWidth * .02, flapHeight * .22);
          return <g transform={projection(points[0], points[1], points[3], flapWidth, flapHeight)} pointerEvents="none">
            {[.25, .75].map(position => <circle key={position} data-packaging-magnet cx={flapWidth * position} cy={flapHeight / 2} r={radius} fill="#c5c8cc" stroke="#71767b" strokeWidth=".8" vectorEffect="non-scaling-stroke" />)}
          </g>;
        })()}
        {face.outline !== false && <polygon points={points.map(point => point.join(',')).join(' ')} fill="none" stroke={face.tape ? '#947243' : '#514d46'} strokeWidth={face.tape ? .65 : 1.15} strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
      </g>;
    })}
  </g>;
}
function projection(origin: Point, across: Point, down: Point, width: number, height: number) {
  return `matrix(${(across[0] - origin[0]) / width} ${(across[1] - origin[1]) / width} ${(down[0] - origin[0]) / height} ${(down[1] - origin[1]) / height} ${origin[0]} ${origin[1]})`;
}
export function packagingPreviewFrame(design: PackagingDesign, view = design.view) {
  if ((design.category === 'box' || design.category === 'none') && view !== 'panel') {
    const bounds = boxBounds(packagingBoxGeometry(design, view));
    const envelope = boxBounds([...packagingBoxGeometry(design, 'closed'), ...packagingBoxGeometry(design, 'open')]);
    const scale = Math.min(540 / envelope.width, 490 / envelope.height);
    const width = Math.max(bounds.width * scale * 1.3, 180);
    const height = Math.max(bounds.height * scale * 1.3, 180);
    return `${320 - width / 2} ${300 - height / 2} ${width} ${height}`;
  }
  let bounds = { x: 140, y: 165, width: 395, height: 315 };
  if (view === 'panel' || (design.category !== 'box' && design.category !== 'none')) {
    const size = view === 'panel' ? panelSize(design, design.selectedPanel) : design.dimensions;
    const scale = view === 'panel' ? Math.min(470 / size.width, 450 / size.height) : Math.min(440 / size.width, 470 / size.height);
    const width = size.width * scale;
    const height = size.height * scale;
    bounds = { x: (640 - width) / 2, y: (600 - height) / 2, width, height };
  }
  const padding = Math.max(bounds.width, bounds.height) * .045;
  return `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`;
}
export function PackagingArtwork(props: ArtworkProps) {
  const { design, guides = false, contents = false } = props;
  const template = packagingTemplate(design.templateId);
  const view = props.view ?? design.view;
  const unique = useId().replace(/:/g, '');
  const isBulk = design.category === 'none';
  const box = design.category === 'box' || isBulk;
  const size = panelSize(design, design.selectedPanel);
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={props.fit ? packagingPreviewFrame(design, view) : '0 0 640 600'} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${template.name}, ${view} view`} data-packaging-artwork={template.id} strokeLinejoin="round" strokeLinecap="round" style={{ width: '100%', height: '100%', maxHeight: '100%', overflow: 'visible' }}>
    <defs>
      <filter id={`${unique}-frost`}><feGaussianBlur stdDeviation="1.6" /></filter>
      <pattern id={`${unique}-paper`} width="9" height="9" patternUnits="userSpaceOnUse"><path d="M1 3h2M5 7h2" stroke="#644c30" strokeWidth="0.45" opacity=".2" /></pattern>
      <pattern id={`${unique}-padding`} width="16" height="16" patternUnits="userSpaceOnUse"><path d="M0 8 8 0 16 8 8 16Z" fill="none" stroke="#735d41" strokeWidth=".6" opacity=".2" /></pattern>
      <linearGradient id={`${unique}-film`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fff" stopOpacity=".45" /><stop offset=".35" stopColor="#fff" stopOpacity=".04" /><stop offset="1" stopColor="#fff" stopOpacity=".25" /></linearGradient>
    </defs>
    {view === 'panel' && !isBulk ? <g transform={`translate(${(640 - size.width * Math.min(470 / size.width, 450 / size.height)) / 2} ${(600 - size.height * Math.min(470 / size.width, 450 / size.height)) / 2}) scale(${Math.min(470 / size.width, 450 / size.height)})`}>
      <rect width={size.width} height={size.height} fill={design.selectedPanel.startsWith('interior') ? design.interior : design.exterior} fillOpacity={template.transparency ? design.opacity : 1} stroke="#777" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <PackagingSurface {...props} panel={design.selectedPanel} />
    </g> : !box ? (() => {
      const { width, height } = design.dimensions;
      const scale = Math.min(440 / width, 470 / height);
      const front = view !== 'back';
      const activePanel = front ? 'front' : 'back';
      const isPaper = template.material.includes('paper');
      const filmStroke = props.surfaceTone === 'dark' && template.transparency ? '#c5d0d5' : '#59666d';
      const shape = `M4 0H${width - 4}L${width} ${height - 8}Q${width / 2} ${height + 3} 0 ${height - 8}Z`;
      const handleWidth = Math.min(90, width * 0.4);
      return <g transform={`translate(${(640 - width * scale) / 2} ${(600 - height * scale) / 2}) scale(${scale})`}>
        <defs><mask id={`${unique}-bag`}><path d={shape} fill="white" />{template.closure === 'handle' && <rect x={(width - handleWidth) / 2} y="17" width={handleWidth} height="19" rx="9.5" fill="black" />}</mask><clipPath id={`${unique}-bagclip`}><path d={shape} /></clipPath></defs>
        <g mask={`url(#${unique}-bag)`}>
          {template.transparency && contents && design.opacity < 1 && <g opacity={template.transparency === 'frosted' ? .82 : .96} filter={template.transparency === 'frosted' ? `url(#${unique}-frost)` : undefined}>
            <PackagingContents {...props} panel={activePanel} reverse={!front} />
          </g>}
          <path d={shape} fill={design.exterior} fillOpacity={template.transparency ? design.opacity : 1} data-material-opacity={template.transparency ? design.opacity : 1} />
          <path d={shape} fill={isPaper ? `url(#${unique}-paper)` : `url(#${unique}-film)`} opacity={template.transparency === 'frosted' ? .4 : 1} />
          {template.transparency === 'frosted' && <path d={shape} fill="#eef2f3" opacity=".12" />}
          {template.id === 'padded' && <path d={shape} fill={`url(#${unique}-padding)`} />}
          <PackagingSurface {...props} panel={activePanel} />
          <g data-packaging-construction="" fill="none" stroke={filmStroke} strokeWidth=".8" pointerEvents="none">
            <path d={`M7 0V${height - 12}H${width - 7}V0`} opacity=".5" />
            {template.closure === 'heat' && <path d={`M5 10H${width - 5}M5 14H${width - 5}`} />}
            {template.closure === 'zip' && <><path d={`M4 18H${width - 4}M4 23H${width - 4}M4 27H${width - 4}`} /><rect x={width * .82} y="15" width="12" height="16" rx="2" fill="#e1e5e5" /></>}
            {template.closure === 'adhesive' && <><path d={`M4 34H${width - 4}`} strokeDasharray="4 3" /><path d={`M4 0 18 29H${width - 18}L${width - 4} 0`} fill={design.exterior} fillOpacity=".3" /><path d={`M12 16H${width - 12}`} stroke="#555" strokeWidth="7" opacity={front ? '.18' : '.7'} /></>}
            {template.closure === 'handle' && <><path d={`M4 49H${width - 4}M4 54H${width - 4}`} /><circle cx={width - 16} cy={height - 22} r="2" fill="#687277" /></>}
            {template.id === 'kraft-mailer' && !front && <path d={`M${width / 2 - 5} 36V${height - 10}M7 ${height - 24} ${width / 2} ${height - 8} ${width - 7} ${height - 24}`} />}
            {template.id === 'padded' && <path d={`M15 45V${height - 18}H${width - 15}V45`} strokeDasharray="2 2" strokeWidth="3" />}
          </g>
          {design.category === 'mailer' && design.shippingLabel && front && <rect data-shipping-label="reserved" x={width * .52} y={Math.max(60, height * .28)} width={width * .38} height={Math.min(height * .42, 150)} rx="2" fill="#f9fafb" stroke="#aeb4b7" strokeWidth="1" />}
        </g>
        <g data-packaging-perimeter="" fill="none" stroke={filmStroke} strokeWidth="1.2" pointerEvents="none">
          <path d={shape} />
          {template.closure === 'handle' && <rect x={(width - handleWidth) / 2} y="17" width={handleWidth} height="19" rx="9.5" />}
        </g>
      </g>;
    })() : <PackagingBox {...props} view={view} />}
  </svg>;
}