import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {shapeWorldPath,pathPolygons} from './artworkPathOperations';
/** Cross-section estimate on the actual glyph contours; ignores vanishing tip fragments. */
export function textStrokeWidth(element:DesignElement):number|undefined{
 if(!element.shapePath)return undefined;
 const world=shapeWorldPath({...element,x:element.width/2,y:element.height/2,rotation:0,flipHorizontal:false,flipVertical:false}),contours=[{...world,subpaths:undefined},...(world.subpaths??[])],keys=[...new Set(contours.map(path=>path.letterKey))],widths:number[]=[];
 for(const key of keys.slice(0,40)){
  const selected=contours.filter(path=>path.letterKey===key);if(!selected.length)continue;
  const polygons=pathPolygons({...selected[0],subpaths:selected.slice(1),fillRule:'nonzero'}),points=polygons.flat(2);if(!points.length)continue;
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  for(const axis of[0,1])for(const fraction of[.25,.35,.45,.55,.65,.75]){
   const slice=axis===0?top+(bottom-top)*fraction:left+(right-left)*fraction,intersections:number[]=[];
   for(const ring of polygons.flat())for(let i=0;i<ring.length-1;i++){const a=ring[i],b=ring[i+1],other=1-axis;if((a[other]>slice)!==(b[other]>slice))intersections.push(a[axis]+(slice-a[other])*(b[axis]-a[axis])/(b[other]-a[other]));}
   intersections.sort((a,b)=>a-b);for(let i=0;i+1<intersections.length;i+=2){const width=intersections[i+1]-intersections[i];if(width>Math.min(right-left,bottom-top)*.003)widths.push(width);}
  }
 }
 widths.sort((a,b)=>a-b);return widths.length?widths[Math.floor(widths.length*.1)]:undefined;
}
