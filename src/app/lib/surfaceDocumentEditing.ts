import {sourceElementKeys} from './rebaseSurfaceDocument';
import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {inverse,multiply,transformPoint,type SurfaceArtwork,type ArtworkDocument} from './artworkSurface';
import {elementMatrix} from './svgPrecision';
export interface SurfaceCommandMetadata {id:string;surfaceId:string;gestureId:string;timestamp:number}
/** Section-linked children share their frame leader's affine gesture. */
export function editSurfaceDocument(value:SurfaceArtwork,elements:DesignElement[]):ArtworkDocument{
 if(value.document.readOnly)throw new Error('Released artwork is read-only.');
 const leaderOf=(frame:typeof value.document.frames[number],rows:DesignElement[])=>rows.find(element=>element.type==='shape'&&(element.id===frame.leaderId||frame.sourceKey&&element.svgPrecision?.owner===frame.sourceKey&&frame.artworks.includes(element.id)));
 const previous=value.document.elements,byId=new Map(elements.map(e=>[e.id,e]));
 for(const frame of value.document.frames){const before=previous.find(e=>e.type==='shape'&&(e.id===frame.leaderId||e.svgPrecision?.owner===frame.sourceKey&&frame.artworks.includes(e.id))),after=before&&byId.get(before.id);if(!before||!after)continue;
 if(before.x===after.x&&before.y===after.y&&before.width===after.width&&before.height===after.height&&before.rotation===after.rotation)continue;
 const delta=multiply(multiply(elementMatrix(after),[after.width/before.width,0,0,after.height/before.height,0,0]),inverse(elementMatrix(before)));
 for(const id of frame.artworks){const old=previous.find(e=>e.id===id),next=byId.get(id);if(!old||!next||id===before.id||next.x!==old.x||next.y!==old.y)continue;const point=transformPoint(delta,old);byId.set(id,{...next,...point,width:next.width*after.width/before.width,height:next.height*after.height/before.height,rotation:next.rotation+after.rotation-before.rotation});}}
 // New or moved objects join the smallest containing frame. A frame never parents itself.
 for(const element of elements){const old=previous.find(item=>item.id===element.id);if(element.locked||element.surfaceRole==='border'||value.document.frames.some(frame=>leaderOf(frame,previous)?.id===element.id)||old&&old.x===element.x&&old.y===element.y)continue;
  const target=value.document.frames.filter(frame=>{const leader=leaderOf(frame,[...byId.values()]),x=leader?leader.x-leader.width/2:frame.x,y=leader?leader.y-leader.height/2:frame.y,width=leader?.width??frame.width,height=leader?.height??frame.height;return element.x>=x&&element.x<=x+width&&element.y>=y&&element.y<=y+height;}).sort((a,b)=>a.width*a.height-b.width*b.height)[0];
  byId.set(element.id,{...byId.get(element.id)!,frameId:target?.id});
 }
 const frames=value.document.frames.map(frame=>{const leader=leaderOf(frame,[...byId.values()]);return {...frame,...(leader?{x:leader.x-leader.width/2,y:leader.y-leader.height/2,width:leader.width,height:leader.height}:{}),artworks:elements.filter(element=>byId.get(element.id)?.frameId===frame.id||element.id===leader?.id).map(element=>element.id)};});
 const keys=sourceElementKeys(previous),deletedSourceKeys=[...new Set([...(value.document.deletedSourceKeys??[]),...previous.filter(e=>e.svgPrecision&&!byId.has(e.id)).map(e=>keys.get(e.id)!)])];
 return{...value.document,frames,deletedSourceKeys,elements:[...elements.filter(e=>e.surfaceRole!=='border'),...elements.filter(e=>e.surfaceRole==='border')].map(e=>byId.get(e.id)!),revision:value.document.revision+1};
}
export function surfaceEditorEnabled(){return typeof window!=='undefined'}
