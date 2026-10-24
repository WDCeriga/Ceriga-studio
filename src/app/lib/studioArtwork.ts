import type { DesignElement } from '../components/builder/PrintStudioEditor';
import type { DesignElement as LegacyElement } from '../components/builder/PrintsDesignStep';

/** Empty studio artwork is intentional; never resurrect deleted legacy prints. */
export function resolveStudioArtwork(state: {studioArtwork?: DesignElement[]; prints?: LegacyElement[]}): DesignElement[] {
  return state.studioArtwork ?? (state.prints ?? []).map(element => ({...element, side: element.view === 'back' ? 'back' : 'front'}));
}
export function duplicateStudioArtwork(source: DesignElement, createId: () => string = () => crypto.randomUUID()): DesignElement {
  const copy = (element: DesignElement): DesignElement => ({...structuredClone(element), id:createId(), ...(element.children ? {children:element.children.map(copy)} : {})});
  return {...copy(source),x:source.x+20,y:source.y+20,locked:false,layerName:`${source.layerName??source.type} copy`};
}
export function describeStudioArtwork(element: DesignElement) {
  return element.layerName || (element.type === 'text' ? element.content : ({image:'Uploaded artwork',drawing:'Drawing',shape:'Shape',pattern:'Pattern',distress:'Fabric wear',customArea:'Custom area',group:'Artwork group'}[element.type]));
}
