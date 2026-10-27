import {useLayoutEffect,useState} from 'react';
import {garmentArtworkCamera} from '../../../lib/garmentArtworkCamera';
/** Apply the garment camera to its artwork, including the intermediate frames of a close-up. */
export function useGarmentArtworkCamera(zone:HTMLDivElement|null,enabled:boolean){
 const [transform,setTransform]=useState<string>();
 useLayoutEffect(()=>{
  if(!enabled||!zone){setTransform(undefined);return;}
  const root=zone.closest<HTMLElement>('[data-design-canvas]');
  const preview=root?.querySelector<HTMLElement>('[data-print-garment-preview]');
  if(!root||!preview)return;
  let frame=0,until=0;
  const update=()=>{
   const canvas=preview.querySelector<HTMLElement>('[data-garment-camera]');
   const parent=canvas?.parentElement;
   if(canvas&&parent){
    const r=root.getBoundingClientRect(),p=parent.getBoundingClientRect(),c=canvas.getBoundingClientRect();
    const unit=r.width/root.clientWidth;
    if(unit>0){
     const value=garmentArtworkCamera({root:{x:r.left,y:r.top},parent:{x:p.left,y:p.top,width:p.width,height:p.height},canvas:{x:c.left,y:c.top,width:c.width},zone:{x:zone.offsetLeft,y:zone.offsetTop},unit});
     setTransform(old=>old===value?old:value);
    }
   }
   if(performance.now()<until)frame=requestAnimationFrame(update);
  };
  const schedule=()=>{until=performance.now()+1200;cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};
  const mutations=new MutationObserver(records=>{if(records.some(r=>r.type==='childList'||(r.target as Element).hasAttribute('data-garment-camera')))schedule();});
  mutations.observe(preview,{subtree:true,childList:true,attributes:true,attributeFilter:['style','data-garment-camera']});
  const resize=new ResizeObserver(schedule);resize.observe(preview);resize.observe(root);schedule();
  return()=>{cancelAnimationFrame(frame);mutations.disconnect();resize.disconnect();};
 },[zone,enabled]);
 return transform;
}
