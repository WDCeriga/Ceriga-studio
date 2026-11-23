import {refreshBoolean} from './booleanArtwork';
import {refreshRepeat} from '../components/builder/artwork-engine/geometry/repeat';
import {refreshBlend} from '../components/builder/artwork-engine/geometry/blend';
import {refreshReflections} from '../components/builder/artwork-engine/geometry/fade';
import {refreshTextRecipeScale} from '../components/builder/artwork-engine/typography/recipeScale';
import {refreshTextOutcomeScale} from '../components/builder/artwork-engine/typography/outcomes';
import {keepEdgeOnResize} from '../components/builder/artwork-engine/geometry/garmentEdges';
import {getGarmentEdges} from '../components/builder/artwork-engine/state/garmentEdges';
import type {DesignElement} from '../components/builder/PrintStudioEditor';
/** Patterns form the background tier; preserve relative order within each tier. */
export function orderDesignLayers(elements:DesignElement[]):DesignElement[]{
 const layers=refreshReflections(elements).map(element=>refreshBlend(refreshRepeat(refreshBoolean(refreshTextOutcomeScale(refreshTextRecipeScale(keepEdgeOnResize(element.children&&!element.artworkRepeat&&!element.artworkBlend?{...element,children:orderDesignLayers(element.children)}:element,getGarmentEdges().edges,getGarmentEdges().side)))))));
 return [...layers.filter(e=>e.tracingReference),...layers.filter(e=>!e.tracingReference&&isBackgroundPattern(e)),...layers.filter(e=>!e.tracingReference&&!isBackgroundPattern(e))];
}
export function isBackgroundPattern(element:DesignElement):boolean{
 if(element.layerOrderExplicit||element.clipToArtworkId||element.clipToArtworkIds?.length||element.artworkClipPaths?.length)return false;
 return element.type==='pattern'||(element.type==='customArea'&&!!element.customAreaPattern)||(element.type==='group'&&!!element.children?.length&&element.children.every(isBackgroundPattern));
}

/** Layer arrays are back-to-front; the list is displayed in reverse. */
export function moveArtworkLayer(elements:DesignElement[],id:string,targetId:string,placement:'above'|'below'):DesignElement[]{
 const item=elements.find(e=>e.id===id),target=elements.find(e=>e.id===targetId);
 if(!item||!target||id===targetId||(item.side??'front')!==(target.side??'front'))return elements;
 const next=elements.filter(e=>e.id!==id),index=next.findIndex(e=>e.id===targetId);
 next.splice(index+(placement==='above'?1:0),0,{...item,layerOrderExplicit:true});return next;
}
