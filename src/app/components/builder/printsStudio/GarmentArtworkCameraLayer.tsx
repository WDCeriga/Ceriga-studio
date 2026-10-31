import {cloneElement,useLayoutEffect,useState,type ReactElement,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';

type Registration={canvas:HTMLElement;side:number;left:number;top:number;width:number;height:number};
/** Paint inside the garment camera itself: CSS animates garment and artwork in the same frame. */
export function GarmentArtworkCameraLayer({zone,enabled,insets,children}:{zone:HTMLDivElement|null;enabled:boolean;insets:{left:number;right:number;top:number;bottom:number};children:ReactElement<{style?:CSSProperties}>}){
 const [registration,setRegistration]=useState<Registration|null>(null);
 const root=zone?.closest<HTMLElement>('[data-design-canvas]')??null;
 useLayoutEffect(()=>{
  if(!enabled||!root){setRegistration(null);return;}
  const update=()=>{
   const canvas=root.querySelector<HTMLElement>('[data-print-garment-preview] [data-garment-camera]'),parent=canvas?.parentElement;
   if(!canvas||!parent){setRegistration(null);return;}
   const r=root.getBoundingClientRect(),p=parent.getBoundingClientRect(),unit=r.width/root.clientWidth,side=Math.min(parent.clientWidth,parent.clientHeight);
   if(!unit||!side)return;
   const left=(p.left-r.left)/unit+(parent.clientWidth-side)/2,top=(p.top-r.top)/unit+(parent.clientHeight-side)/2;
   const next={canvas,side,left:root.clientWidth*insets.left/100-left,top:root.clientHeight*insets.top/100-top,width:root.clientWidth*(1-(insets.left+insets.right)/100),height:root.clientHeight*(1-(insets.top+insets.bottom)/100)};
   setRegistration(previous=>previous&&Object.keys(next).every(key=>next[key as keyof Registration]===previous[key as keyof Registration])?previous:next);
  };
  const resize=new ResizeObserver(update);resize.observe(root);const preview=root.querySelector<HTMLElement>('[data-print-garment-preview]');if(preview)resize.observe(preview);
  const observer=new MutationObserver(records=>{if(records.some(record=>record.type==='childList'&&(record.target as Element).closest('[data-print-garment-preview]')&&!((record.target as Element).closest('[data-artwork-camera-layer]'))))update();});
  observer.observe(root,{subtree:true,childList:true});update();
  return()=>{resize.disconnect();observer.disconnect();};
 },[root,enabled,insets.left,insets.right,insets.top,insets.bottom]);
 if(!enabled||!registration||!registration.canvas.isConnected)return children;
 const {canvas,side,left,top,width,height}=registration;
 return createPortal(<svg data-artwork-camera-layer viewBox={`0 0 ${side} ${side}`} width="100%" height="100%" preserveAspectRatio="none" overflow="visible" style={{position:'absolute',inset:0,zIndex:90,pointerEvents:'none'}}><foreignObject width={side} height={side} overflow="visible"><div xmlns="http://www.w3.org/1999/xhtml" style={{position:'relative',width:side,height:side}}>{cloneElement(children,{style:{...children.props.style,transform:undefined,left,top,right:'auto',bottom:'auto',width,height}})}</div></foreignObject></svg>,canvas);
}
