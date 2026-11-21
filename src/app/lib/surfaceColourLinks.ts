import type {DesignElement} from '../components/builder/PrintStudioEditor';
import type {Surface} from './artworkSurface';
export function resolveSurfaceColours(surface:Surface,element:DesignElement):DesignElement{
 // Older surface uploads inherited the text tool's default fill, hiding image pixels.
 if(element.type==='image'&&element.color==='#171717'&&!element.imageFilter&&
   !element.surfaceColourLinks?.fill&&element.shapeGeometry==='bounds'&&
   element.shapeFilled===false&&element.shapeFillColor==='#e5e5e5'&&element.fontFamily==='Inter'){
  element={...element,color:undefined,shapeGeometry:undefined,shapeFilled:undefined,shapeFillColor:undefined};
 }
 const fill=surface.colours?.[element.surfaceColourLinks?.fill??'']?.hex,stroke=surface.colours?.[element.surfaceColourLinks?.stroke??'']?.hex;
 return {...element,...(fill?{color:fill,shapeFillColor:fill,textAppearance:element.textAppearance?.map(item=>item.type==='fill'?{...item,colour:fill}:item)}:{}),...(stroke?{shapeStrokeColor:stroke,borderColor:stroke}:{}),children:element.children?.map(child=>resolveSurfaceColours(surface,child))};
}
