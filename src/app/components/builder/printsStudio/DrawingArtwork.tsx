import {usePrintsStudio} from './PrintsStudioContext';
import {useContext,useEffect,useRef,useState} from 'react';
import {ArtworkResolutionContext} from './ArtworkResolutionContext';
import {ArtworkInteractionContext} from './ArtworkInteractionContext';
import {artworkPixelRatio} from '../../../lib/artworkResolution';
import {renderBrushStroke} from '../../../lib/drawingBrush';
import {artworkFlipStyle} from '../../../lib/artworkFlip';
import {composeArtworkFilter,type DesignElement} from '../PrintStudioEditor';

export async function waitForDrawingReplay(root:HTMLElement) {
 const start=performance.now();
 while(root.querySelector('[data-drawing-ready="false"]')){if(performance.now()-start>6000)throw new Error('Drawing detail is still rendering');await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))}
}
/** Repaint original brush commands at the current display density, instead of enlarging an old bitmap. */
export function DrawingArtwork({element}:{element:DesignElement}) {
 const studio=usePrintsStudio(),erasing=studio.tool==='eraser';
 const source=element.drawing!,display=useContext(ArtworkResolutionContext),interacting=useContext(ArtworkInteractionContext),canvas=useRef<HTMLCanvasElement>(null);
 const ratio=artworkPixelRatio(source.width,source.height,display*Math.max(element.width/source.width,element.height/source.height),window.devicePixelRatio||1);
 const key=JSON.stringify([source,ratio,element.color]);const [status,setStatus]=useState<{key:string;error?:boolean}>();
 const ready=status?.key===key&&!status.error,pending=status?.key!==key;
 useEffect(()=>{
  if(interacting||erasing)return;let cancelled=false;
  const redraw=async()=>{
   const width=Math.max(1,Math.round(source.width*ratio)),height=Math.max(1,Math.round(source.height*ratio));
   const output=document.createElement('canvas');output.width=width;output.height=height;const ctx=output.getContext('2d');if(!ctx)throw new Error('Drawing canvas unavailable');
   const strokeCanvas=document.createElement('canvas');strokeCanvas.width=width;strokeCanvas.height=height;const ink=strokeCanvas.getContext('2d');if(!ink)throw new Error('Stroke canvas unavailable');
   const images=new Map<string,Promise<HTMLImageElement>>();
   const image=(url:string)=>{if(!images.has(url)){const img=new Image();img.src=url;images.set(url,img.decode().then(()=>img))}return images.get(url)!};
   for(const stroke of source.strokes){
    if(cancelled)return;ink.clearRect(0,0,width,height);
    renderBrushStroke(ink,stroke.points.map(p=>({...p,x:p.x*ratio,y:p.y*ratio})),{...stroke.settings,color:element.color??stroke.settings.color},ratio,stroke.seed,stroke.paintFrame);
    if(stroke.mirrorAxis!==undefined){const copy=document.createElement('canvas');copy.width=width;copy.height=height;copy.getContext('2d')?.drawImage(strokeCanvas,0,0);ink.save();ink.translate(stroke.mirrorAxis*ratio*2,0);ink.scale(-1,1);ink.drawImage(copy,0,0);ink.restore()}
    if(stroke.clip){const clip=await image(stroke.clip.url);if(cancelled)return;ink.save();ink.globalCompositeOperation='destination-in';ink.drawImage(clip,stroke.clip.x*ratio,stroke.clip.y*ratio,stroke.clip.width*ratio,stroke.clip.height*ratio);ink.restore()}
    ctx.globalAlpha=stroke.opacity;ctx.drawImage(strokeCanvas,0,0);
   }
   ctx.globalAlpha=1;ctx.globalCompositeOperation='destination-out';
   for(const cut of source.cuts??[]){ctx.beginPath();cut.forEach((p,i)=>i?ctx.lineTo(p.x*ratio,p.y*ratio):ctx.moveTo(p.x*ratio,p.y*ratio));ctx.closePath();ctx.fill()}
   if(cancelled||!canvas.current)return;canvas.current.width=width;canvas.current.height=height;canvas.current.getContext('2d')?.drawImage(output,0,0);setStatus({key});
  };
  void redraw().catch(error=>{if(!cancelled){console.warn('Using the saved drawing while detail rendering is unavailable.',error);setStatus({key,error:true})}});
  return()=>{cancelled=true};
 },[key,interacting,erasing]);
 return <div className="relative h-full w-full" style={{...artworkFlipStyle(element),filter:composeArtworkFilter(element)}} data-drawing-ready={pending&&!interacting&&!erasing?'false':'true'}>
  <img src={element.content} alt="Drawing" className="absolute inset-0 h-full w-full object-fill" style={{opacity:ready?0:1}}/>
  <canvas ref={canvas} data-replayed-drawing data-drawing-rendered={ready?'true':'false'} aria-label="High resolution drawing" className="absolute inset-0 h-full w-full" style={{opacity:ready?1:0}}/>
 </div>;
}
