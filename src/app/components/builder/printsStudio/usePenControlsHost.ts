import {useLayoutEffect,useState} from 'react';
/** Editing controls belong to the inspector, never over the artwork. */
export function usePenControlsHost(selector='[data-pen-controls-host]'){
  const [host,setHost]=useState<HTMLElement|null>(null);
  useLayoutEffect(()=>{
    let frame=0;
    const find=()=>{frame=0;const nodes=Array.from(document.querySelectorAll<HTMLElement>(selector));const next=nodes.find(node=>Boolean(node.parentElement?.getClientRects().length))??null;setHost(previous=>previous===next?previous:next);};
    find();
    // Check at most once a frame: this watches the whole page, and each check forces layout.
    const observer=new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(find)});observer.observe(document.body,{childList:true,subtree:true});return()=>{observer.disconnect();if(frame)cancelAnimationFrame(frame)};
  },[selector]);
  return host;
}
