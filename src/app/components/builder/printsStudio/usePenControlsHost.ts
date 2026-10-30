import {useLayoutEffect,useState} from 'react';
/** Editing controls belong to the inspector, never over the artwork. */
export function usePenControlsHost(selector='[data-pen-controls-host]'){
  const [host,setHost]=useState<HTMLElement|null>(null);
  useLayoutEffect(()=>{
    const find=()=>{const nodes=Array.from(document.querySelectorAll<HTMLElement>(selector));const next=nodes.find(node=>Boolean(node.parentElement?.getClientRects().length))??null;setHost(previous=>previous===next?previous:next);};
    find();const observer=new MutationObserver(find);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
  },[selector]);
  return host;
}
