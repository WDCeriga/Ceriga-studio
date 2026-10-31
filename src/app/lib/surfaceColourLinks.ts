import type {DesignElement} from '../components/builder/PrintStudioEditor';
import type {Surface} from './artworkSurface';
export function resolveSurfaceColours(surface:Surface,element:DesignElement):DesignElement{
 const fill=surface.colours?.[element.surfaceColourLinks?.fill??'']?.hex,stroke=surface.colours?.[element.surfaceColourLinks?.stroke??'']?.hex;
 return {...element,...(fill?{color:fill,shapeFillColor:fill,textAppearance:element.textAppearance?.map(item=>item.type==='fill'?{...item,colour:fill}:item)}:{}),...(stroke?{shapeStrokeColor:stroke,borderColor:stroke}:{}),children:element.children?.map(child=>resolveSurfaceColours(surface,child))};
}
