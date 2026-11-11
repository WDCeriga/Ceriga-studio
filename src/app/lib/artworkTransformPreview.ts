import {artworkClipStyle} from './artworkClipping';
import type {DesignElement} from '../components/builder/PrintStudioEditor';
/** A gesture previews the existing vector DOM; source geometry is committed once. */
export function artworkTransformPreview(root:HTMLElement,start:DesignElement,elements:DesignElement[]=[],previewMask?:(next:DesignElement)=>string|undefined){
 const original=root.getAttribute('style'),controls=[...root.querySelectorAll<HTMLElement>('.studio-selection-handle,.studio-selection-rotate')].map(node=>({node,style:node.getAttribute('style')}));
 const zone=root.closest('[data-print-design-zone]'),surface=root.querySelector<HTMLElement>('[data-asset-projection]')?.parentElement,surfaceStyle=surface?.getAttribute('style');
 const masks=elements.filter(e=>e.id===start.id&&(e.clipToArtworkId||e.clipToArtworkIds?.length||e.artworkClipPaths?.length)||e.clipToArtworkId===start.id||e.clipToArtworkIds?.includes(start.id)).flatMap(e=>{const node=(e.id===start.id?root:zone?.querySelector('[data-print-id="'+e.id+'"]'))?.querySelector<HTMLElement>('[data-artwork-clipped]');return node?[{id:e.id,node,style:node.getAttribute('style')}]:[]});
 const outline=root.querySelector<SVGRectElement>('.studio-selection-frame rect'),outlineStyle=outline?.getAttribute('style');
 const width=start.width,height=start.height,inverse=Number.parseFloat(getComputedStyle(root).getPropertyValue('--artwork-ui-inverse'))||1;let restored=false;
 return {
  update(next:DesignElement,rows=elements){const sx=next.width/width,sy=next.height/height;root.style.transition='none';root.style.left=next.x+'px';root.style.top=next.y+'px';root.style.width=width+'px';root.style.height=height+'px';root.style.maxWidth='none';root.style.transform=`translate(-50%, -50%) rotate(${next.rotation}deg) scale(${sx},${sy})`;root.dataset.transforming='true';
   const mask=previewMask?.(next);if(surface?.style.maskImage&&mask)surface.style.maskImage=mask;
   const live=rows.map(e=>e.id===next.id?next:e);for(const mask of masks){const e=live.find(e=>e.id===mask.id),style=e&&artworkClipStyle(e,live);if(style)Object.assign(mask.node.style,style);}
   if(outline){outline.style.strokeWidth=String(inverse/Math.max(sx,sy));outline.style.strokeDasharray=`${3*inverse/Math.max(sx,sy)} ${3*inverse/Math.max(sx,sy)}`;}
   for(const {node} of controls){if(node.classList.contains('studio-selection-rotate'))node.style.top=(-42*inverse/sy)+'px';node.style.transform=`translate(-50%, -50%) scale(${inverse/sx},${inverse/sy})`;}
  },
  restore(){if(restored)return;restored=true;if(original===null)root.removeAttribute('style');else root.setAttribute('style',original);delete root.dataset.transforming;if(outline){if(outlineStyle==null)outline.removeAttribute('style');else outline.setAttribute('style',outlineStyle);}if(surface){if(surfaceStyle==null)surface.removeAttribute('style');else surface.setAttribute('style',surfaceStyle);}for(const {node,style}of [...controls,...masks]){if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);}}
 };
}
