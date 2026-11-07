import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {canGroupLayer} from './designGroups';
export type MarqueeBox={x:number;y:number;width:number;height:number};
export function selectionBox(a:{x:number;y:number},b:{x:number;y:number}):MarqueeBox{return{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};}
export function pointInSelection(point:{x:number;y:number},box:MarqueeBox){return point.x>=box.x&&point.x<=box.x+box.width&&point.y>=box.y&&point.y<=box.y+box.height;}
export function marqueeArtworkIds(elements:DesignElement[],side:'front'|'back',box:MarqueeBox){
  return elements.filter(e=>{
    if((e.side??'front')!==side||!canGroupLayer(e))return false;
    const angle=e.rotation*Math.PI/180,w=(Math.abs(Math.cos(angle))*e.width+Math.abs(Math.sin(angle))*e.height)/2,h=(Math.abs(Math.sin(angle))*e.width+Math.abs(Math.cos(angle))*e.height)/2;
    return e.x+w>=box.x&&e.x-w<=box.x+box.width&&e.y+h>=box.y&&e.y-h<=box.y+box.height;
  }).map(e=>e.id);
}

/** Use the rendered ink bounds rather than a source artboard's transparent padding. */
export function renderedMarqueeArtworkIds(elements:DesignElement[],side:'front'|'back',box:MarqueeBox,zone:HTMLElement){
 const zr=zone.getBoundingClientRect(),sx=zr.width/zone.clientWidth,sy=zr.height/zone.clientHeight;
 if(!sx||!sy)return [];
 const selection={left:zr.left+box.x*sx,top:zr.top+box.y*sy,right:zr.left+(box.x+box.width)*sx,bottom:zr.top+(box.y+box.height)*sy};
 const roots=new Map(Array.from(zone.querySelectorAll<HTMLElement>('[data-print-id]')).map(root=>[root.dataset.printId,root]));
 return elements.filter(e=>{if((e.side??'front')!==side||!canGroupLayer(e))return false;const root=roots.get(e.id),bounds=root?.querySelector<HTMLElement>('[data-visible-bounds]');if(!bounds)return false;const rect=bounds.getBoundingClientRect();return rect.width>0&&rect.height>0&&rect.right>=selection.left&&rect.left<=selection.right&&rect.bottom>=selection.top&&rect.top<=selection.bottom;}).map(e=>e.id);
}
