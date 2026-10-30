import {sourceElementKeys} from './rebaseSurfaceDocument';
import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {inverse,multiply,transformPoint,type SurfaceArtwork,type ArtworkDocument} from './artworkSurface';
import {elementMatrix} from './svgPrecision';
export interface SurfaceCommandMetadata {id:string;surfaceId:string;gestureId:string;timestamp:number}
/** Section-linked children share their frame leader's affine gesture. */
export function editSurfaceDocument(value:SurfaceArtwork,elements:DesignElement[]):ArtworkDocument{
 if(value.document.readOnly)throw new Error('Released artwork is read-only.');
 const previous=value.document.elements,byId=new Map(elements.map(e=>[e.id,e]));
 for(const frame of value.document.frames){const before=previous.find(e=>e.type==='shape'&&e.svgPrecision?.owner===frame.sourceKey&&frame.artworks.includes(e.id)),after=before&&byId.get(before.id);if(!before||!after)continue;
 if(before.x===after.x&&before.y===after.y&&before.width===after.width&&before.height===after.height&&before.rotation===after.rotation)continue;
 const delta=multiply(multiply(elementMatrix(after),[after.width/before.width,0,0,after.height/before.height,0,0]),inverse(elementMatrix(before)));
 for(const id of frame.artworks){const old=previous.find(e=>e.id===id),next=byId.get(id);if(!old||!next||id===before.id||next.x!==old.x||next.y!==old.y)continue;const point=transformPoint(delta,old);byId.set(id,{...next,...point,width:next.width*after.width/before.width,height:next.height*after.height/before.height,rotation:next.rotation+after.rotation-before.rotation});}}
 const keys=sourceElementKeys(previous),deletedSourceKeys=[...new Set([...(value.document.deletedSourceKeys??[]),...previous.filter(e=>e.svgPrecision&&!byId.has(e.id)).map(e=>keys.get(e.id)!)])];
 return{...value.document,deletedSourceKeys,elements:elements.map(e=>byId.get(e.id)!),revision:value.document.revision+1};
}
export function surfaceEditorEnabled(){return typeof window!=='undefined'&&(new URLSearchParams(window.location.search).get('surfaceEditor')==='1'||import.meta.env.VITE_SHARED_SURFACES==='1')}
