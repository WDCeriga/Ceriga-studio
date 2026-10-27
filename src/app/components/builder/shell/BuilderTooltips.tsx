import {useEffect,useId,useState} from 'react';
import {createPortal} from 'react-dom';
import './builder-tooltips.css';
/** Give the builder's existing hints one accessible visual style instead of native title popups. */
export function BuilderTooltips(){
 const id=useId(),[hint,setHint]=useState<{text:string;x:number;y:number;above:boolean}|null>(null);
 useEffect(()=>{
  const roots=Array.from(document.querySelectorAll('.ceriga-builder-shell')),managed=new Map<Element,{title:string;label:boolean}>();let anchor:Element|null=null,timer=0;
  const hide=()=>{clearTimeout(timer);if(anchor){const values=(anchor.getAttribute('aria-describedby')??'').split(' ').filter(v=>v&&v!==id);values.length?anchor.setAttribute('aria-describedby',values.join(' ')):anchor.removeAttribute('aria-describedby');}anchor=null;setHint(null);};
  const scan=(root:Element)=>{const nodes=[...(root.hasAttribute('title')?[root]:[]),...root.querySelectorAll('[title]')];for(const node of nodes){const title=node.getAttribute('title')?.trim();if(!title)continue;const prior=managed.get(node),label=prior?.label??(!node.getAttribute('aria-label')&&!node.textContent?.trim());managed.set(node,{title,label});node.setAttribute('data-builder-hint',title);if(label)node.setAttribute('aria-label',title);node.removeAttribute('title');}};
  roots.forEach(scan);
  const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='attributes'&&(record.target as Element).hasAttribute('title'))scan(record.target as Element);else for(const node of record.addedNodes)if(node instanceof Element)scan(node);}if(anchor&&!anchor.isConnected)hide();for(const node of managed.keys())if(!node.isConnected)managed.delete(node);});
  roots.forEach(root=>observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['title']}));
  const show=(node:Element)=>{if(node===anchor)return;hide();anchor=node;timer=window.setTimeout(()=>{if(anchor!==node||!node.isConnected)return;const rect=node.getBoundingClientRect(),above=rect.bottom+64>window.innerHeight;node.setAttribute('aria-describedby',[(node.getAttribute('aria-describedby')??''),id].filter(Boolean).join(' '));setHint({text:node.getAttribute('data-builder-hint')??'',x:Math.max(130,Math.min(window.innerWidth-130,rect.left+rect.width/2)),y:above?rect.top-8:rect.bottom+8,above});},350);};
  const over=(event:PointerEvent)=>{if(event.pointerType==='touch')return;const node=(event.target as Element).closest?.('[data-builder-hint]');if(node&&roots.some(root=>root.contains(node)))show(node);};
  const out=(event:PointerEvent)=>{if(anchor&&!(event.relatedTarget instanceof Node&&anchor.contains(event.relatedTarget)))hide();};
  const focus=(event:FocusEvent)=>{const node=(event.target as Element).closest?.('[data-builder-hint]');if(node?.matches(':focus-visible'))show(node);};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')hide();};
  document.addEventListener('pointerover',over);document.addEventListener('pointerout',out);document.addEventListener('focusin',focus);document.addEventListener('focusout',hide);document.addEventListener('pointerdown',hide,true);document.addEventListener('keydown',key);window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
  return()=>{hide();observer.disconnect();document.removeEventListener('pointerover',over);document.removeEventListener('pointerout',out);document.removeEventListener('focusin',focus);document.removeEventListener('focusout',hide);document.removeEventListener('pointerdown',hide,true);document.removeEventListener('keydown',key);window.removeEventListener('scroll',hide,true);window.removeEventListener('resize',hide);for(const[node,original]of managed){if(!node.hasAttribute('title'))node.setAttribute('title',original.title);node.removeAttribute('data-builder-hint');if(original.label&&node.getAttribute('aria-label')===original.title)node.removeAttribute('aria-label');}};
 },[id]);
 return hint?createPortal(<div id={id} role="tooltip" className="builder-tool-hint" style={{left:hint.x,top:hint.y,transform:`translate(-50%,${hint.above?'-100%':'0'})`}}>{hint.text}</div>,document.body):null;
}
