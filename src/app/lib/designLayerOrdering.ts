import {refreshBoolean} from './booleanArtwork';
import type {DesignElement} from '../components/builder/PrintStudioEditor';
/** Patterns form the background tier; preserve relative order within each tier. */
export function orderDesignLayers(elements:DesignElement[]):DesignElement[]{
 const layers=elements.map(element=>refreshBoolean(element.children?{...element,children:orderDesignLayers(element.children)}:element));
 return [...layers.filter(e=>e.tracingReference),...layers.filter(e=>!e.tracingReference&&isBackgroundPattern(e)),...layers.filter(e=>!e.tracingReference&&!isBackgroundPattern(e))];
}
export function isBackgroundPattern(element:DesignElement):boolean{
 return element.type==='pattern'||(element.type==='customArea'&&!!element.customAreaPattern)||(element.type==='group'&&!!element.children?.length&&element.children.every(isBackgroundPattern));
}
