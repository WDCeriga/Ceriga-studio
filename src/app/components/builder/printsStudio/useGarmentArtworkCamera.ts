import {useLayoutEffect,useState} from 'react';
import {garmentArtworkCamera} from '../../../lib/garmentArtworkCamera';
/** Follow the camera without ever writing camera coordinates into the artwork document. */
export function useGarmentArtworkCamera(zone:HTMLDivElement|null,enabled:boolean){
 const [transform,setTransform]=useState<string>();
 useLayoutEffect(()=>{
  if(!enabled||!zone){setTransform(undefined);return;}
  const root=zone.closest<HTMLElement>('[data-design-canvas]');
  if(!root){setTransform(undefined);return;}
  let frame=0,until=0;
  const update=()=>{
   frame=0;
   // Navigation can replace the preview; do not retain its previous DOM camera.
   const canvas=root.querySelector<HTMLElement>('[data-print-garment-preview] [data-garment-camera]'),parent=canvas?.parentElement;
   let value:string|undefined;
   if(canvas&&parent){
    const r=root.getBoundingClientRect(),p=parent.getBoundingClientRect(),c=canvas.getBoundingClientRect(),unit=r.width/root.clientWidth;
    if(unit>0)value=garmentArtworkCamera({root:{x:r.left,y:r.top},parent:{x:p.left,y:p.top,width:p.width,height:p.height},canvas:{x:c.left,y:c.top,width:c.width},zone:{x:zone.offsetLeft,y:zone.offsetTop},unit});
   }
   setTransform(old=>old===value?old:value);
   if(performance.now()<until&&!frame)frame=requestAnimationFrame(update);
  };
  // Keep one pending sample: repeated DOM changes must not starve the camera update.
  const schedule=()=>{until=performance.now()+1200;if(!frame)frame=requestAnimationFrame(update);};
  const mutations=new MutationObserver(records=>{
   if(records.some(record=>record.type==='childList'||(record.target as Element).matches('[data-garment-camera], [data-tshirt-preview], [data-print-garment-preview]')))schedule();
  });
  // Camera state also changes through data attributes and classes, not only inline styles.
  mutations.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','data-garment-camera','data-part-focus','data-stitch-camera','data-detail-camera','data-hem-camera']});
  const resize=new ResizeObserver(schedule);resize.observe(root);
  const preview=root.querySelector<HTMLElement>('[data-print-garment-preview]');if(preview)resize.observe(preview);
  root.addEventListener('transitionrun',schedule);root.addEventListener('transitionend',schedule);root.addEventListener('transitioncancel',schedule);
  schedule();
  return()=>{cancelAnimationFrame(frame);mutations.disconnect();resize.disconnect();root.removeEventListener('transitionrun',schedule);root.removeEventListener('transitionend',schedule);root.removeEventListener('transitioncancel',schedule);};
 },[zone,enabled]);
 return transform;
}
