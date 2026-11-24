import {GarmentPrintTextureContext} from './GarmentPrintTexture';
import {multiplyInkFabricPixels} from '../../../lib/inkFabricRelief';
import {usePrintsStudio} from './PrintsStudioContext';
import {useContext,useEffect,useRef,useState,useId,useMemo} from 'react';
import {supportsVectorDrawing,vectorDrawingMarkup} from '../../../lib/vectorDrawing';
import {ArtworkResolutionContext} from './ArtworkResolutionContext';
import {ArtworkInteractionContext} from './ArtworkInteractionContext';
import {artworkPixelRatio} from '../../../lib/artworkResolution';
import {activeDrawingEffects,replayDrawingWithEffects} from '../../../lib/drawingRaster';
import {cancelTextEffects} from '../../../lib/textEffectRendering';
import {artworkFlipStyle} from '../../../lib/artworkFlip';
import {ensureDrawingTips} from '../../../lib/brushTips';
import {composeArtworkFilter,type DesignElement} from '../PrintStudioEditor';

export async function waitForDrawingReplay(root:HTMLElement) {
 const start=performance.now();
 while(root.querySelector('[data-drawing-ready="false"]')){if(performance.now()-start>6000)throw new Error('Drawing detail is still rendering');await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))}
}
/** Repaint original brush commands at the current display density, instead of enlarging an old bitmap. */
function RasterDrawingArtwork({element}:{element:DesignElement}) {
 const studio=usePrintsStudio(),erasing=studio.tool==='eraser',texture=useContext(GarmentPrintTextureContext);
 const source=element.drawing!,display=useContext(ArtworkResolutionContext),interacting=useContext(ArtworkInteractionContext),canvas=useRef<HTMLCanvasElement>(null);
 const ratio=artworkPixelRatio(source.width,source.height,display*Math.max(element.width/source.width,element.height/source.height),window.devicePixelRatio||1);
 const lane=useId(),effects=activeDrawingEffects(element),key=JSON.stringify([source,ratio,element.color,effects,effects.length?[element.width,element.height]:null,texture?.url,texture?[element.x,element.y,element.width,element.height,element.rotation]:null]);const [status,setStatus]=useState<{key:string;error?:boolean;padding?:number}>();
 const ready=status?.key===key&&!status.error,pending=status?.key!==key;
 useEffect(()=>{
  if(interacting||erasing)return;let cancelled=false;
  const redraw=async()=>{
   await ensureDrawingTips([...source.strokes,...(source.erasers??[])]);if(cancelled)return;const {canvas:output,padding}=await replayDrawingWithEffects(element,ratio,()=>cancelled,lane);if(!output||cancelled)return;const ctx=output.getContext('2d',{willReadFrequently:true})!,width=output.width,height=output.height,cssWidth=element.width+padding*2,cssHeight=element.height+padding*2;
   if(texture){
    const relief=document.createElement('canvas');relief.width=width;relief.height=height;
    const surface=relief.getContext('2d')!;surface.scale(width/cssWidth,height/cssHeight);surface.translate(cssWidth/2,cssHeight/2);surface.rotate(-element.rotation*Math.PI/180);surface.translate(-element.x,-element.y);surface.drawImage(texture.canvas,0,0,texture.width,texture.height);
    const pixels=ctx.getImageData(0,0,width,height);multiplyInkFabricPixels(pixels.data,surface.getImageData(0,0,width,height).data);ctx.putImageData(pixels,0,0);
   }
   if(cancelled||!canvas.current)return;canvas.current.width=width;canvas.current.height=height;canvas.current.getContext('2d')?.drawImage(output,0,0);setStatus({key,padding});
  };
  void redraw().catch(error=>{if(!cancelled){console.warn('Using the saved drawing while detail rendering is unavailable.',error);setStatus({key,error:true})}});
  return()=>{cancelled=true;cancelTextEffects(lane)};
 },[key,interacting,erasing]);
 return <div className="relative h-full w-full" style={{...artworkFlipStyle(element),filter:composeArtworkFilter(element)}} data-drawing-ready={pending&&!interacting&&!erasing?'false':'true'}>
  <img src={element.content} alt="Drawing" className="absolute inset-0 h-full w-full object-fill" style={{opacity:ready?0:1}}/>
  <canvas ref={canvas} data-replayed-drawing data-drawing-rendered={ready?'true':'false'} aria-label="High resolution drawing" className="absolute" style={{opacity:ready?1:0,left:-(status?.padding??0),top:-(status?.padding??0),width:`calc(100% + ${(status?.padding??0)*2}px)`,height:`calc(100% + ${(status?.padding??0)*2}px)`,maxWidth:'none'}}/>
 </div>;
}

function VectorDrawingArtwork({element}:{element:DesignElement}){
 const id='drawing-'+useId().replace(/:/g,''),source=element.drawing!;
 const markup=useMemo(()=>vectorDrawingMarkup(source,id,element.color),[source,id,element.color]);
 return <svg viewBox={`0 0 ${source.width} ${source.height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none" style={{...artworkFlipStyle(element),filter:composeArtworkFilter(element),mixBlendMode:'multiply'}} aria-label="Vector drawing" data-vector-drawing data-drawing-ready="true" dangerouslySetInnerHTML={{__html:markup}}/>;
}
export function DrawingArtwork({element}:{element:DesignElement}){
 return supportsVectorDrawing(element.drawing!)&&!activeDrawingEffects(element).length?<VectorDrawingArtwork element={element}/>:<RasterDrawingArtwork element={element}/>;
}
