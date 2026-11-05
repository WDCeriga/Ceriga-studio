import type {PointerEvent} from 'react';
type Box={x:number;y:number;width:number;height:number};
/** The same red frame and square grips used by patch, artwork and surface editors. */
export function ArtworkSelection({box,unit,onResize,resizeLabel='Resize selected artwork',kind='label'}:{box:Box;unit:number;onResize?:(event:PointerEvent<SVGRectElement>)=>void;resizeLabel?:string;kind?:'label'|'packaging'}) {
 const size=unit/22.5;
 return <g data-artwork-selection="" data-label-selection={kind==='label'?'':undefined} fill="none" stroke="#CC2D24" strokeWidth="1">
  <rect data-packaging-handle={kind==='packaging'?'selection':undefined} {...box} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
  {[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height]].map(([x,y],index)=><rect key={index} x={x-size/2} y={y-size/2} width={size} height={size} fill="white" vectorEffect="non-scaling-stroke" pointerEvents="none"/>)}
  {onResize&&<rect data-packaging-handle={kind==='packaging'?'resize':undefined} role="button" tabIndex={0} aria-label={resizeLabel} x={box.x+box.width-size/2} y={box.y+box.height-size/2} width={size} height={size} fill="white" vectorEffect="non-scaling-stroke" style={{cursor:'nwse-resize',touchAction:'none'}} onPointerDown={onResize}/>}
 </g>;
}
