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
/**
 * One watcher per garment, shared by every wear mark. It ignores artwork, editor chrome and eraser masks (they never change
 * fabric colours) and tells marks at most once per frame, so painting or erasing wear no longer re-reads the garment
 * for every mark on every move.
 */
const garmentWatchers=new WeakMap<Element,{observer:MutationObserver;listeners:Set<()=>void>;frame:number}>();
/** Colours already looked up, per garment preview and rough spot. Cleared whenever the garment itself changes. */
const paletteCache=new WeakMap<Element,Map<string,DistressPalette>>();
const ignoredMutation=(record:MutationRecord)=>{const target=record.target instanceof Element?record.target:record.target.parentElement;return Boolean(target?.closest('[data-print-id],[data-editor-chrome],mask,[data-asset-content]'))};
function watchGarment(garment:Element,listener:()=>void){
  let watcher=garmentWatchers.get(garment);
  if(!watcher){
    const created={observer:new MutationObserver(records=>{if(records.every(ignoredMutation)||created.frame)return;paletteCache.delete(garment);created.frame=requestAnimationFrame(()=>{created.frame=0;created.listeners.forEach(notify=>notify())})}),listeners:new Set<()=>void>(),frame:0};
    created.observer.observe(garment,{subtree:true,childList:true,attributes:true,attributeFilter:['fill','style','class','transform','data-garment-interior-color']});
    garmentWatchers.set(garment,created);watcher=created;
  }
  watcher.listeners.add(listener);
  return()=>{const current=garmentWatchers.get(garment);if(!current)return;current.listeners.delete(listener);if(!current.listeners.size){current.observer.disconnect();if(current.frame)cancelAnimationFrame(current.frame);garmentWatchers.delete(garment)}};
}
export function useGarmentWearPalette(x:number,y:number) {
  const host=useContext(GarmentWearHostContext),[palette,setPalette]=useState(DEFAULT_DISTRESS_PALETTE);
  useEffect(()=>{
    const garment=host?.closest('[data-design-canvas]')?.querySelector('[data-print-garment-preview]');
    const update=()=>{
      const fx=x/Math.max(1,host?.clientWidth??800),fy=y/Math.max(1,host?.clientHeight??700),key=Math.round(fx*40)+','+Math.round(fy*40);
      let cache=garment?paletteCache.get(garment):undefined;if(garment&&!cache){cache=new Map();paletteCache.set(garment,cache)}
      const next=cache?.get(key)??garmentWearPalette(host,fx,fy);cache?.set(key,next);
      setPalette(old=>old===next?old:next);
    };
    update();
    if(!garment)return;
    return watchGarment(garment,update);
  },[host,x,y]);
  return palette;
}
