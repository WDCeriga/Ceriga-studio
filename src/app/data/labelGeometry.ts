export interface LabelMask {pixels:Uint8ClampedArray;size:number}
const cache=new WeakMap<LabelMask,Partial<Record<'Left'|'Right',{x:number;y:number;angle:number}|null>>>();
/** Sleeve files can contain both mirrored sleeves. Never anchor in their empty centre. */
export function sleeveLabelAnchor(mask:LabelMask,side:'Left'|'Right'){
 const previous=cache.get(mask)??{};if(side in previous)return previous[side]??null;
 const {size,pixels}=mask,mid=Math.floor(size/2),start=side==='Left'?0:mid,end=side==='Left'?mid:size;
 let minX=size,maxX=-1,minY=size,maxY=-1;
 for(let y=0;y<size;y++)for(let x=start;x<end;x++)if(pixels[(y*size+x)*4+3]>180){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
 if(maxX<minX){previous[side]=null;cache.set(mask,previous);return null}
 const x=Math.round(side==='Left'?minX+(maxX-minX)*.32:maxX-(maxX-minX)*.32);
 const bottom=(column:number)=>{for(let y=maxY;y>=minY;y--)if(pixels[(y*size+Math.max(start,Math.min(end-1,column)))*4+3]>180)return y;return maxY};
 const offset=Math.max(1,Math.round(size/128)),y=bottom(x),angle=Math.atan2(bottom(x+offset)-bottom(x-offset),offset*2)*180/Math.PI;
 const result={x:(x+.5)*2048/size,y:(y+.5)*2048/size,angle};previous[side]=result;cache.set(mask,previous);return result;
}

export function labelCameraFrame(focus:{x:number;y:number;width:number;height:number;context?:{x:number;y:number;width:number;height:number}},category?:string){return category==='tag'?focus:focus.context??focus}
export function labelEdgeGeometry(label:{widthMm:number;heightMm:number;shape:string;cut?:string;fold:string}){
 const width=label.widthMm,height=label.heightMm;
 if(['circle','oval'].includes(label.shape))return {kind:'ellipse' as const,cx:width/2,cy:height/2,rx:width/2,ry:height/2};
 const cut=label.cut??(label.shape==='rounded'?'rounded':label.fold==='die'?'angled':'straight');
 if(cut==='angled'){const c=Math.min(3,width/5,height/5);return {kind:'path' as const,d:`M${c} 0H${width-c}L${width} ${c}V${height-c}L${width-c} ${height}H${c}L0 ${height-c}V${c}Z`}}
 return {kind:'rect' as const,width,height,rx:cut==='rounded'?Math.min(3,width/5,height/5):.15};
}
