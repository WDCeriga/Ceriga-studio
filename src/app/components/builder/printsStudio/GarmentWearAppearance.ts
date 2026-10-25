import {createContext,useContext,useEffect,useState} from 'react';
import {distressPalette,DEFAULT_DISTRESS_PALETTE,type DistressPalette} from '../../../lib/distressRendering';

export const GarmentWearHostContext=createContext<HTMLElement|null>(null);
function fabricPaint(piece:Element|null):string|undefined {
 if(!piece)return;
 let color=getComputedStyle(piece).fill;
 const pattern=color.match(/url\(["']?(?:[^#)]*#)([^"')]+)["']?\)/);
 if(pattern){const paint=piece.closest('svg')?.querySelector(`#${CSS.escape(pattern[1])} rect`);if(paint)color=getComputedStyle(paint).fill}
 return color&&color!=='none'&&!color.startsWith('url')?color:undefined;
}
/** Sample the actual SVG piece beneath the mark, including independently coloured panels. */
export function garmentWearPalette(host:HTMLElement|null,x=.5,y=.5):DistressPalette {
  const root=host?.closest('[data-design-canvas]');
  const garment=root?.querySelector('[data-print-garment-preview]');
  if(!host||!garment)return DEFAULT_DISTRESS_PALETTE;
  const inner=fabricPaint(garment.querySelector('[data-layer-id="innerBackNeck"] [data-fabric-base]'))??garment.querySelector('[data-garment-interior-color]')?.getAttribute('data-garment-interior-color')??undefined;
  const rect=host.getBoundingClientRect(),screen=new DOMPoint(rect.left+x*rect.width,rect.top+y*rect.height);
  const pieces=Array.from(garment.querySelectorAll<SVGGeometryElement>('[data-fabric-base]')).reverse();
  for(const piece of pieces) {
    try {
      const matrix=piece.getScreenCTM();if(!matrix||!piece.isPointInFill(screen.matrixTransform(matrix.inverse())))continue;
      const color=fabricPaint(piece);
      if(color)return distressPalette(color,inner??color);
    } catch { /* Detached or non-invertible source during an SVG rebuild. */ }
  }
  return distressPalette('#414141',inner);
}
export function useGarmentWearPalette(x:number,y:number) {
  const host=useContext(GarmentWearHostContext),[palette,setPalette]=useState(DEFAULT_DISTRESS_PALETTE);
  useEffect(()=>{
    const update=()=>{const next=garmentWearPalette(host,x/Math.max(1,host?.clientWidth??800),y/Math.max(1,host?.clientHeight??700));setPalette(old=>JSON.stringify(old)===JSON.stringify(next)?old:next)};
    update();const garment=host?.closest('[data-design-canvas]')?.querySelector('[data-print-garment-preview]');
    if(!garment)return;
    const observer=new MutationObserver(update);observer.observe(garment,{subtree:true,childList:true,attributes:true,attributeFilter:['fill','style','class','transform','data-garment-interior-color']});
    return()=>observer.disconnect();
  },[host,x,y]);
  return palette;
}
