import {composeArtworkFilter,ImageFxDefs,type DesignElement} from '../PrintStudioEditor';
import {artworkFlipStyle} from '../../../lib/artworkFlip';
import {paintCss} from '../../../lib/studioPaint';
import {FilteredImage} from './FilteredImage';
import {ImageAdjustmentDefs} from './ImageAdjustmentDefs';

/** Preserve image pixels in surface previews and export captures. */
export function ImageArtwork({element}:{element:DesignElement}){
 const tinted=Boolean(element.color&&!element.imageFilter);
 return <div className="relative h-full w-full" style={{filter:composeArtworkFilter(element)}}>
  <ImageFxDefs element={element}/>
  <ImageAdjustmentDefs element={element}/>
  <FilteredImage source={element.content} settings={element.imageFilter}
   tint={element.imageFilter?element.color:undefined} alt={element.layerName??'Artwork'}
   className="h-full w-full object-fill"
   style={{...artworkFlipStyle(element),opacity:tinted?0:undefined}}/>
  {tinted&&<div className="pointer-events-none absolute inset-0" style={{
   background:paintCss(element.color),maskImage:`url("${element.content}")`,
   maskSize:'100% 100%',maskRepeat:'no-repeat',...artworkFlipStyle(element),
  }}/>}
 </div>;
}
