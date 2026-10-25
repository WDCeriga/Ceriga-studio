import type {DesignElement} from '../components/builder/PrintStudioEditor';
/** Patterns form the background tier; preserve relative order within each tier. */
export function orderDesignLayers(elements:DesignElement[]):DesignElement[]{
 const layers=elements.map(element=>element.children?{...element,children:orderDesignLayers(element.children)}:element);
 return [...layers.filter(isBackgroundPattern),...layers.filter(element=>!isBackgroundPattern(element))];
}
export function isBackgroundPattern(element:DesignElement):boolean{
 return element.type==='pattern'||(element.type==='customArea'&&!!element.customAreaPattern)||(element.type==='group'&&!!element.children?.length&&element.children.every(isBackgroundPattern));
}
