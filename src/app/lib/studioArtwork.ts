import type { DesignElement } from '../components/builder/PrintStudioEditor';
import type { DesignElement as LegacyElement } from '../components/builder/PrintsDesignStep';
import {applyArtworkSlots} from './artworkColourSlots';
import {isFabricArtwork} from './artworkProduction';
import {artworkBounds} from './artworkGeometry';
import type {ArtworkSlotOverrides} from './artworkColourSlots';

/** Compatibility only: read methods from old saved print areas, never create new ones. */
export type LegacyArtworkState={artworkPlacements?:{unitsPerCm?:number;placements:{id:string;method:DesignElement['printMethod']}[]}};
const emptyArtwork:DesignElement[]=[];
const baseCache=new WeakMap<object,{areas:LegacyArtworkState['artworkPlacements'];result:DesignElement[]}>();
const paintedCache=new WeakMap<object,{overrides:ArtworkSlotOverrides|undefined;result:DesignElement[]}>();
export function resolveBaseStudioArtwork(state:{studioArtwork?:DesignElement[];prints?:LegacyElement[]}&LegacyArtworkState):DesignElement[]{
 const source=state.studioArtwork??state.prints??emptyArtwork,cached=baseCache.get(source);
 if(cached&&cached.areas===state.artworkPlacements)return cached.result;
 const elements=state.studioArtwork??(state.prints??[]).map(element=>({...element,side:element.view==='back'?'back' as const:'front' as const}));
 const detach=(element:DesignElement):DesignElement=>{
  const {placementId,...rest}=element as DesignElement&{placementId?:string};
  const old=state.artworkPlacements?.placements.find(area=>area.id===placementId),units=state.artworkPlacements?.unitsPerCm;
  const children=element.children?.map(detach),changedChildren=children?.some((child,i)=>child!==element.children![i]);
  if(!('placementId' in element)&&!old&&!units&&!changedChildren)return element;
  return {...rest,...(!element.printMethod&&old?.method?{printMethod:isFabricArtwork(element)?'Fabric Print':old.method}:{}),...(units?{artworkUnitsPerCm:element.artworkUnitsPerCm??units,textUnitsPerCm:element.textUnitsPerCm??units}:{}),...(changedChildren?{children}:{})};
 };
 const detached=elements.map(detach),result=detached.every((element,i)=>element===elements[i])?elements:detached;
 baseCache.set(source,{areas:state.artworkPlacements,result});return result;
}
/** Discard retired area metadata only after copying its production data onto the artwork. */
export function detachLegacyArtworkState<T extends LegacyArtworkState&{studioArtwork?:DesignElement[];prints?:LegacyElement[]}>(state:T):T{
 if(!state.artworkPlacements)return state;
 const {artworkPlacements,artworkComponents,...rest}=state as T&{artworkComponents?:unknown};
 return {...rest,studioArtwork:resolveBaseStudioArtwork(state)} as T;
}
export function resolveStudioArtwork(state:{studioArtwork?:DesignElement[];prints?:LegacyElement[];artworkSlotOverrides?:ArtworkSlotOverrides}&LegacyArtworkState){
 const base=resolveBaseStudioArtwork(state),cached=paintedCache.get(base);
 if(cached&&cached.overrides===state.artworkSlotOverrides)return cached.result;
 const painted=base.map(element=>applyArtworkSlots(element,state.artworkSlotOverrides));
 const result=painted.every((element,i)=>element===base[i])?base:painted;
 paintedCache.set(base,{overrides:state.artworkSlotOverrides,result});return result;
}
export function duplicateStudioArtwork(source: DesignElement, createId: () => string = () => crypto.randomUUID()): DesignElement {
  const copy = (element: DesignElement): DesignElement => ({...structuredClone(element), id:createId(), ...(element.children ? {children:element.children.map(copy)} : {})});
  return {...copy(source),x:source.x+20,y:source.y+20,locked:false,layerName:`${source.layerName??source.type} copy`};
}
export function describeStudioArtwork(element: DesignElement) {
  return element.layerName || (element.type === 'text' ? element.content : ({image:'Uploaded artwork',drawing:'Drawing',shape:'Shape',pattern:'Pattern',distress:'Fabric wear',customArea:'Custom area',group:'Artwork group'}[element.type]));
}

/** Saved assets retain native children; the thumbnail is never the editable source. */
export type AssetPlacement={background?:string;trim?:boolean;side?:'front'|'back';width?:number};
/** The part of the canvas that goes to the garment: all of it, or just the artwork. */
export function assetPlacementFrame(asset:{width:number;height:number;elements:DesignElement[]},trim=false){
 const boxes=trim?asset.elements.filter(e=>!e.hidden&&!e.tracingReference).map(artworkBounds):[];
 if(!boxes.length)return{x:0,y:0,width:asset.width,height:asset.height};
 const x=Math.max(0,Math.floor(Math.min(...boxes.map(b=>b.x)))),y=Math.max(0,Math.floor(Math.min(...boxes.map(b=>b.y)))),right=Math.min(asset.width,Math.ceil(Math.max(...boxes.map(b=>b.x+b.width)))),bottom=Math.min(asset.height,Math.ceil(Math.max(...boxes.map(b=>b.y+b.height))));
 return right>x&&bottom>y?{x,y,width:right-x,height:bottom-y}:{x:0,y:0,width:asset.width,height:asset.height};
}
export function placeNativeStudioAsset(asset:{name:string;width:number;height:number;elements:DesignElement[];preview:string},frame:{id:string;x:number;y:number;width:number;side:'front'|'back'},placement:AssetPlacement={}):DesignElement{const copy=(e:DesignElement):DesignElement=>({...structuredClone(e),id:crypto.randomUUID(),side:frame.side,children:e.children?.filter(c=>!c.tracingReference).map(copy)});const area=assetPlacementFrame(asset,placement.trim),art=asset.elements.filter(e=>!e.tracingReference).map(copy).map(e=>({...e,x:e.x-area.x,y:e.y-area.y})),backing:DesignElement[]=placement.background?[{id:crypto.randomUUID(),type:'shape',content:'rect',shapeGeometry:'bounds',shapeParameters:{studioRevision:2},x:area.width/2,y:area.height/2,width:area.width,height:area.height,rotation:0,opacity:100,color:placement.background,shapeFilled:true,shapeFillColor:placement.background,borderWidth:0,aspectLocked:false,layerName:'Background',side:frame.side}]:[];return{...frame,type:'group',content:'saved-asset',height:frame.width*area.height/area.width,rotation:0,opacity:100,aspectLocked:true,layerName:asset.name,printMethod:'DTG',children:[...backing,...art],groupSourceWidth:area.width,groupSourceHeight:area.height};}
