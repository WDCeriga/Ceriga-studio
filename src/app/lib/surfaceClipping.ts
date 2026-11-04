import type {CSSProperties} from 'react';
import type {Surface} from './artworkSurface';
import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {mapShapePath} from './artworkPathOperations';
import {shapePathData} from './shapeGeometry';
/** A surface cut line can extend beyond an object's measured box (font overhang, late font loads). */
export function surfaceArtworkClip(surface:Surface|undefined,element:Pick<DesignElement,'x'|'y'|'width'|'height'|'rotation'>,position?:{x:number;y:number}):CSSProperties|undefined{
 if(!surface?.clip)return undefined;
 const angle=-element.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),local=mapShapePath(surface.outline,p=>{const x=p.x-(position?.x??element.x),y=p.y-(position?.y??element.y);return{x:x*c-y*s+element.width/2,y:x*s+y*c+element.height/2}});
 // An image mask is always bounded by the object's border box. A vector clip preserves glyph overhang.
 const clipPath=`path(evenodd, "${shapePathData(local)}")`;
 return {clipPath,WebkitClipPath:clipPath};
}
