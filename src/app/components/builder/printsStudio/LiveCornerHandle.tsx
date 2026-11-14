import {useEffect,useRef} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
import {frameGesture} from '../../../lib/frameGesture';

const corners = [
  {key:'cornerTopLeft',label:'Top left',right:false,bottom:false},
  {key:'cornerTopRight',label:'Top right',right:true,bottom:false},
  {key:'cornerBottomRight',label:'Bottom right',right:true,bottom:true},
  {key:'cornerBottomLeft',label:'Bottom left',right:false,bottom:true},
] as const;

const wrapAngle=(angle:number)=>((angle%360)+360)%360;

export function LiveCornerHandle({element,scale,onPreview,onChange}:{
  element:DesignElement;
  scale:number;
  onPreview:(parameters:DesignElement['shapeParameters']|null)=>void;
  onChange:(parameters:DesignElement['shapeParameters'])=>void;
}) {
  const svg=useRef<SVGSVGElement>(null);
  const cancel=useRef<(()=>void)|null>(null);
  useEffect(()=>()=>cancel.current?.(),[]);
  const {width,height,shapeParameters}=element;
  const inset=10/scale;
  const ellipse=element.content==='ellipse'||element.content==='circle';
  const mode=shapeParameters?.ellipseMode??'full';
  const startAngle=Number(shapeParameters?.startAngle??-90);
  const sweep=Number(shapeParameters?.sweep??90);
  const rx=Math.max(1,width/2),ry=Math.max(1,height/2);

  function drag(event:ReactPointerEvent, calculate:(point:DOMPoint,origin:DOMPoint)=>DesignElement['shapeParameters']) {
    if(event.button!==0)return;
    event.preventDefault();
    event.stopPropagation();
    cancel.current?.();
    const matrix=svg.current?.getScreenCTM()?.inverse();
    if(!matrix)return;
    const pointer=event.pointerId;
    const initialX=event.clientX,initialY=event.clientY;
    event.currentTarget.setPointerCapture?.(pointer);
    const origin=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix);
    let parameters:DesignElement['shapeParameters'];
    const queue=frameGesture((point:{x:number;y:number})=>{
      const p=new DOMPoint(point.x,point.y).matrixTransform(matrix);
      parameters=calculate(p,origin);
      onPreview(parameters);
    });
    const move=(e:PointerEvent)=>{if(e.pointerId===pointer)queue.push({x:e.clientX,y:e.clientY})};
    const clear=()=>{
      queue.cancel();
      window.removeEventListener('pointermove',move,true);
      window.removeEventListener('pointerup',end,true);
      window.removeEventListener('pointercancel',abort,true);
      cancel.current=null;
    };
    const end=(e:PointerEvent)=>{
      if(e.pointerId!==pointer)return;
      if(Math.hypot(e.clientX-initialX,e.clientY-initialY)>1)queue.push({x:e.clientX,y:e.clientY});
      queue.flush();
      clear();
      onPreview(null);
      if(parameters)onChange(parameters);
    };
    const abort=(e?:PointerEvent)=>{if(e&&e.pointerId!==pointer)return;clear();onPreview(null)};
    cancel.current=abort;
    window.addEventListener('pointermove',move,true);
    window.addEventListener('pointerup',end,true);
    window.addEventListener('pointercancel',abort,true);
  }

  function start(event:ReactPointerEvent,corner:typeof corners[number],radius:number) {
    const keys=event.altKey?[corner.key]:corners.map(item=>item.key);
    drag(event,(p,origin)=>{
      const dx=(p.x-origin.x)*(corner.right?-1:1);
      const dy=(p.y-origin.y)*(corner.bottom?-1:1);
      const delta=Math.abs(dx)>=Math.abs(dy)?dx:dy;
      const value=Math.max(0,Math.min(Math.min(width,height)/2,radius+delta));
      return {...shapeParameters,...Object.fromEntries(keys.map(key=>[key,value]))};
    });
  }

  function angleHandle(edge:'start'|'end',angle:number) {
    const radians=angle*Math.PI/180;
    return handle(edge==='start'?'Ellipse start angle':'Ellipse end angle',
      rx+(rx-Math.min(rx*.45,inset*1.5))*Math.cos(radians),ry+(ry-Math.min(ry*.45,inset*1.5))*Math.sin(radians),event=>{
      const snap=event.shiftKey?15:1;
      drag(event,p=>{
        const degrees=Math.round(Math.atan2((p.y-ry)/ry,(p.x-rx)/rx)*180/Math.PI/snap)*snap;
        const start=edge==='start'?degrees:startAngle;
        const end=edge==='end'?degrees:startAngle+sweep;
        return {...shapeParameters,ellipseMode:mode==='full'?'pie':mode,startAngle:start,
          sweep:Math.max(1,Math.min(359,wrapAngle(end-start)))};
      });
    });
  }

  function handle(label:string,cx:number,cy:number,onPointerDown:(event:ReactPointerEvent)=>void) {
    return <g key={label}>
      <circle role="button" aria-label={label} cx={cx} cy={cy} r={7/scale}
        fill="transparent" className="pointer-events-auto" style={{cursor:'crosshair'}} onPointerDown={onPointerDown}><title>{label}</title></circle>
      <circle cx={cx} cy={cy} r={3.5/scale} fill="white" stroke="#525252" strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
    </g>;
  }

  return <svg ref={svg} data-editor-chrome data-live-shape-handles viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
    {ellipse ? <>
      {mode!=='crescent'&&<>{angleHandle('start',startAngle)}{angleHandle('end',startAngle+sweep)}</>}
      {(mode==='full'||mode==='crescent')&&handle('Crescent cut depth',
        Math.max(Math.min(rx*.65,inset*1.5),rx*Number(mode==='crescent'?shapeParameters?.cutOffset??32:12)/100),ry,event=>{
          const initial=Number(mode==='crescent'?shapeParameters?.cutOffset??32:12);
          drag(event,(point,origin)=>({...shapeParameters,ellipseMode:'crescent',
            cutOffset:Math.max(2,Math.min(95,Math.round(initial+(point.x-origin.x)*100/rx)))}));
        })}
    </> : corners.map(corner=>{
      const defaultRadius=element.content==='rounded-rect'?12:element.shapeGeometry==='bounds'?0:4;
      const radius=Number(shapeParameters?.[corner.key]??defaultRadius);
      const x=Math.min(width*.35,inset+radius*.6), y=Math.min(height*.35,inset+radius*.6);
      const cx=corner.right?width-x:x,cy=corner.bottom?height-y:y;
      return <g key={corner.key}>
        <circle role="button" aria-label={corner.key==='cornerTopLeft'?'Rectangle corner radius':`${corner.label} corner radius`}
          cx={cx} cy={cy} r={7/scale} fill="transparent" className="pointer-events-auto" style={{cursor:'crosshair'}}
          onPointerDown={event=>start(event,corner,radius)}><title>Drag to round all corners. Alt-drag for one corner.</title></circle>
        <circle cx={cx} cy={cy} r={3.5/scale} fill="white" stroke="#525252" strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
      </g>;
    })}
  </svg>;
}
