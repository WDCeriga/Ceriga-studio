import type { DesignElement } from '../components/builder/PrintStudioEditor';
import type { DesignElement as LegacyElement } from '../components/builder/PrintsDesignStep';
import {displayArtworkPlacements,type ArtworkPlacements} from './artworkPlacements';
import type {ArtworkSlotOverrides} from './artworkColourSlots';

/** Empty studio artwork is intentional; never resurrect deleted legacy prints. */
export function resolveBaseStudioArtwork(state: {studioArtwork?: DesignElement[]; prints?: LegacyElement[]}): DesignElement[] {
  return state.studioArtwork ?? (state.prints ?? []).map(element => ({...element, side: element.view === 'back' ? 'back' : 'front'}));
}
export function resolveStudioArtwork(state:{studioArtwork?:DesignElement[];prints?:LegacyElement[];artworkPlacements?:ArtworkPlacements;artworkSlotOverrides?:ArtworkSlotOverrides}){return displayArtworkPlacements(resolveBaseStudioArtwork(state),state.artworkPlacements,state.artworkSlotOverrides);}
export function duplicateStudioArtwork(source: DesignElement, createId: () => string = () => crypto.randomUUID()): DesignElement {
  const copy = (element: DesignElement): DesignElement => ({...structuredClone(element), id:createId(), ...(element.children ? {children:element.children.map(copy)} : {})});
  return {...copy(source),x:source.x+20,y:source.y+20,locked:false,layerName:`${source.layerName??source.type} copy`};
}
export function describeStudioArtwork(element: DesignElement) {
  return element.layerName || (element.type === 'text' ? element.content : ({image:'Uploaded artwork',drawing:'Drawing',shape:'Shape',pattern:'Pattern',distress:'Fabric wear',customArea:'Custom area',group:'Artwork group'}[element.type]));
}

/** Saved assets retain native children; the thumbnail is never the editable source. */
export function placeNativeStudioAsset(asset:{name:string;width:number;height:number;elements:DesignElement[];preview:string},frame:{id:string;x:number;y:number;width:number;side:'front'|'back'}):DesignElement{const copy=(e:DesignElement):DesignElement=>({...structuredClone(e),id:crypto.randomUUID(),side:frame.side,children:e.children?.filter(c=>!c.tracingReference).map(copy)});return{...frame,type:'group',content:'saved-asset',height:frame.width*asset.height/asset.width,rotation:0,opacity:100,aspectLocked:true,layerName:asset.name,printMethod:'DTG',children:asset.elements.filter(e=>!e.tracingReference).map(copy),groupSourceWidth:asset.width,groupSourceHeight:asset.height};}
