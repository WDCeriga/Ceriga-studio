import type { DesignElement } from '../components/builder/PrintStudioEditor';
import type { DesignElement as LegacyElement } from '../components/builder/PrintsDesignStep';
import {applyArtworkSlots} from './artworkColourSlots';
import {isFabricArtwork} from './artworkProduction';
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
export function placeNativeStudioAsset(asset:{name:string;width:number;height:number;elements:DesignElement[];preview:string},frame:{id:string;x:number;y:number;width:number;side:'front'|'back'}):DesignElement{const copy=(e:DesignElement):DesignElement=>({...structuredClone(e),id:crypto.randomUUID(),side:frame.side,children:e.children?.filter(c=>!c.tracingReference).map(copy)});return{...frame,type:'group',content:'saved-asset',height:frame.width*asset.height/asset.width,rotation:0,opacity:100,aspectLocked:true,layerName:asset.name,printMethod:'DTG',children:asset.elements.filter(e=>!e.tracingReference).map(copy),groupSourceWidth:asset.width,groupSourceHeight:asset.height};}
