import {singleDistressMarks} from './distressRendering';
import type {DesignElement} from '../components/builder/PrintStudioEditor';
import type {DistressMark} from './distressScatter';
/** Reconstruct garment-space marks after a saved layer is moved, scaled or rotated. */
export function garmentWearMarks(element:DesignElement):DistressMark[] {
 const wear=element.wear;if(!wear)return [];
 const sx=element.width/Math.max(.01,wear.sourceWidth),sy=element.height/Math.max(.01,wear.sourceHeight),r=element.rotation*Math.PI/180;
 return wear.marks.map(mark=>{const x=(mark.x-wear.sourceWidth*.5)*sx,y=(mark.y-wear.sourceHeight*.5)*sy;return {...mark,x:element.x+x*Math.cos(r)-y*Math.sin(r),y:element.y+x*Math.sin(r)+y*Math.cos(r),width:mark.width*sx,height:mark.height*sy,rotation:mark.rotation+r,palette:undefined}});
}
export function cropWearMarks(marks:DistressMark[],x:number,y:number,scaleX:number,scaleY:number):DistressMark[] {
 return marks.map(({palette,...mark})=>({...mark,x:(mark.x-x)/scaleX,y:(mark.y-y)/scaleY,width:mark.width/scaleX,height:mark.height/scaleY}));
}

/** Expand the editing envelope without shifting any other mark on the garment. */
export function reframeWearMarks(element:DesignElement,marks:DistressMark[]):Partial<DesignElement> {
 if(!element.wear||!marks.length)return {};
 const extent=(m:DistressMark)=>Math.hypot(m.width+Math.abs(m.skew??0)/100*m.height,m.height*(1+Math.abs(m.bend??0)/100))*.62;
 const left=Math.min(...marks.map(m=>m.x-extent(m))),top=Math.min(...marks.map(m=>m.y-extent(m))),right=Math.max(...marks.map(m=>m.x+extent(m))),bottom=Math.max(...marks.map(m=>m.y+extent(m)));
 return{x:(left+right)/2,y:(top+bottom)/2,width:right-left,height:bottom-top,rotation:0,wear:{...element.wear,sourceWidth:right-left,sourceHeight:bottom-top,marks:marks.map(m=>({...m,x:m.x-left,y:m.y-top}))}};
}

export function editableWearLayer(element:DesignElement):DesignElement {
 if(element.wear)return element;
 const kind=element.content==='rips'?'rips':element.content==='abrasion'?'abrasion':'holes';
 const seed=Array.from(element.id??'wear').reduce((v,c)=>Math.imul(v^c.charCodeAt(0),16777619),2166136261);
 return{...element,wear:{kind,sourceWidth:element.width,sourceHeight:element.height,marks:singleDistressMarks(kind,element.width,element.height,seed).map(m=>({...m,...element.wearDetail}))}};
}
