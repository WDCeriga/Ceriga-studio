import {useEffect} from 'react';
import {isArtworkFloatingControl} from '../../../lib/artworkDismissal';
/** Preserve ownership across pointerdown popovers and React updates, then dismiss true outside clicks. */
export function useArtworkDismissal(active:boolean){useEffect(()=>{
  if(!active)return;
  const frames=new Set<number>();let pointerPath:EventTarget[]=[],pointerFloating=false;
  const down=(event:PointerEvent)=>{pointerPath=event.composedPath();pointerFloating=isArtworkFloatingControl(event.target);};
  const cancel=()=>{pointerPath=[];pointerFloating=false;};
  const outside=(event:MouseEvent)=>{
    const target=event.target,origin=event.detail>0?pointerPath:[],floating=event.detail>0&&pointerFloating;cancel();
    if(!(target instanceof Element)||floating||isArtworkFloatingControl(target))return;
    // Radix can move focus or retarget the click before it reaches the document.
    // The original pointerdown still identifies the section that owns the control.
    const clickedPath=event.composedPath(),opened=Array.from(document.querySelectorAll<HTMLDetailsElement>('.ceriga-builder-shell details[open]')).filter(details=>!origin.includes(details)&&!clickedPath.includes(details)&&!details.contains(target));
    const frame=requestAnimationFrame(()=>{frames.delete(frame);for(const details of opened)if(details.isConnected)details.open=false;});frames.add(frame);
  };
  document.addEventListener('pointerdown',down,true);document.addEventListener('pointercancel',cancel,true);document.addEventListener('click',outside,true);
  return()=>{document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointercancel',cancel,true);document.removeEventListener('click',outside,true);frames.forEach(frame=>cancelAnimationFrame(frame));};
},[active]);}
