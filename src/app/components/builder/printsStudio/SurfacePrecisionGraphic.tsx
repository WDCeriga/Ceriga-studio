import {artworkPixelRatio} from '../../../lib/artworkResolution';
import {useContext} from 'react';
import type{DesignElement}from'../PrintStudioEditor';
import{precisionMarkup,scopeSvgMarkup}from'../../../lib/svgPrecision';
import {ArtworkResolutionContext} from './ArtworkResolutionContext';
/** Render tiny physical surfaces at canvas density before scaling back to surface coordinates. */
export function SurfacePrecisionGraphic({element}:{element:DesignElement}){
 const resolution=useContext(ArtworkResolutionContext),density=artworkPixelRatio(element.width,element.height,resolution,typeof window==='undefined'?1:window.devicePixelRatio||1),markup=scopeSvgMarkup(precisionMarkup(element,true),element.id).replace('<svg ','<svg style="width:100%;height:100%;overflow:visible" ');
 return <div data-surface-precision style={{width:'100%',height:element.height,position:'relative',pointerEvents:'none',overflow:'visible'}}><div data-surface-density={density} style={{position:'absolute',left:0,top:0,width:element.width*density,height:element.height*density,transform:`scale(${1/density})`,transformOrigin:'0 0',overflow:'visible'}} dangerouslySetInnerHTML={{__html:markup}}/></div>;
}
