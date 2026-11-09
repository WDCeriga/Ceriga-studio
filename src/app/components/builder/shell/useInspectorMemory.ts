import {useLayoutEffect, type RefObject} from 'react';

/** View state only: no product changes, autosaves or history commands. */
export function useInspectorMemory(ref:RefObject<HTMLDivElement|null>,scope:string) {
  useLayoutEffect(()=>{
    const root=ref.current;
    if(!root)return;
    let state=views.get(scope);
    if(!state){state={scroll:0,sheetScroll:0,sections:new Map()};views.set(scope,state);}
    const view=state,seen=new WeakSet<HTMLDetailsElement>();
    const sectionKey=(node:HTMLDetailsElement)=>{
      const summary=node.querySelector(':scope > summary');
      if(!summary)return '';
      const copy=summary.cloneNode(true) as Element;
      copy.querySelectorAll('small,svg,.material-caption').forEach(child=>child.remove());
      return copy.textContent?.trim()??'';
    };
    const restore=()=>{
      root.querySelectorAll<HTMLDetailsElement>('details:not(.studio-fold)').forEach(node=>{
        if(seen.has(node))return;
        seen.add(node);
        const key=sectionKey(node);
        if(key&&view.sections.has(key))node.open=view.sections.get(key)!;
      });
    };
    restore();root.scrollTop=view.scroll;
    const sheet=root.querySelector<HTMLElement>('.responsive-sheet-content');
    if(sheet)sheet.scrollTop=view.sheetScroll;
    const scroll=(event:Event)=>{
      if(event.target===root)view.scroll=root.scrollTop;
      if(event.target instanceof HTMLElement&&event.target.matches('.responsive-sheet-content'))view.sheetScroll=event.target.scrollTop;
    };
    const toggle=(event:Event)=>{
      if(!(event.target instanceof HTMLDetailsElement)||event.target.classList.contains('studio-fold'))return;
      const key=sectionKey(event.target);if(key)view.sections.set(key,event.target.open);
    };
    const observer=new MutationObserver(restore);
    observer.observe(root,{childList:true,subtree:true});
    root.addEventListener('scroll',scroll,true);root.addEventListener('toggle',toggle,true);
    return()=>{observer.disconnect();root.removeEventListener('scroll',scroll,true);root.removeEventListener('toggle',toggle,true);};
  },[ref,scope]);
}
const views=new Map<string,{scroll:number;sheetScroll:number;sections:Map<string,boolean>}>();
