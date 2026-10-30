import {useMemo} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
import {DesignGroupArtwork} from './DesignGroupArtwork';
import {ArtworkResolutionContext} from './ArtworkResolutionContext';
import {GarmentPrintTextureContext,GarmentPatternReliefContext} from './GarmentPrintTexture';

/** A contained, non-interactive rendering of the actual asset, including nested groups. */
export function ArtworkThumbnail({element}:{element:DesignElement}){
 const preview=useMemo(()=>{
  const clean=(item:DesignElement):DesignElement=>({...item,logoTrace:undefined,children:item.children?.map(clean)});
  const w=Math.max(1,element.width||1),h=Math.max(1,element.height||1),angle=(element.rotation||0)*Math.PI/180,width=Math.max(1,Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*h),height=Math.max(1,Math.abs(Math.sin(angle))*w+Math.abs(Math.cos(angle))*h);
  return{id:'thumbnail-'+element.id,type:'group' as const,content:'thumbnail',x:0,y:0,width,height,rotation:0,groupSourceWidth:width,groupSourceHeight:height,children:[{...clean(element),x:width/2,y:height/2,width:w,height:h,hidden:false}]};
 },[element]);
 return <div className="studio-artwork-thumbnail" data-artwork-thumbnail={element.type} role="img" aria-label={(element.layerName??(element.type==='text'?element.content:element.type))+' preview'}>
  <svg viewBox={`0 0 ${preview.width} ${preview.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true"><foreignObject width={preview.width} height={preview.height}>
   <div style={{width:preview.width,height:preview.height,pointerEvents:'none'}}>
    <GarmentPrintTextureContext.Provider value={null}><GarmentPatternReliefContext.Provider value={null}><ArtworkResolutionContext.Provider value={1}>
     <DesignGroupArtwork element={preview}/>
    </ArtworkResolutionContext.Provider></GarmentPatternReliefContext.Provider></GarmentPrintTextureContext.Provider>
   </div>
  </foreignObject></svg>
 </div>;
}
