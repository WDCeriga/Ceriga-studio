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
