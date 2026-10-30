import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {StudioGraphic} from '../components/builder/printsStudio/StudioGraphic';
import {productionArtworkSvg} from './productionArtwork';
import {loadFontLibrary} from '../components/builder/printsStudio/designLibrary';
import {artworkBounds} from './artworkGeometry';
export async function nativeArtworkSource(elements:DesignElement[],name='Artwork'){
 const visible=elements.filter(element=>!element.hidden&&!element.tracingReference);if(!visible.length)throw new Error('Select visible artwork first.');
 const bounds=visible.map(artworkBounds),left=Math.min(...bounds.map(box=>box.x)),top=Math.min(...bounds.map(box=>box.y)),width=Math.max(1,Math.max(...bounds.map(box=>box.x+box.width))-left),height=Math.max(1,Math.max(...bounds.map(box=>box.y+box.height))-top);
 const clean=(element:DesignElement):DesignElement=>({...element,sketchOnly:false,children:element.children?.map(clean)}),local=visible.map(element=>({...clean(element),x:element.x-left,y:element.y-top,side:'front' as const}));
 const svg=await productionArtworkSvg(local,width,height,{side:'front',fonts:loadFontLibrary(),complex:async element=>{const markup=renderToStaticMarkup(createElement(StudioGraphic,{element})),parsed=new DOMParser().parseFromString(markup,'image/svg+xml'),root=parsed.documentElement;if(root.localName!=='svg'||root.querySelector('text,foreignObject,canvas,parsererror'))throw new Error('Expand this artwork’s live effects before using it as a vector repeat.');root.setAttribute('width',String(element.width));root.setAttribute('height',String(element.height));return new XMLSerializer().serializeToString(root);}});
 return{src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg),name,width,height};
}
