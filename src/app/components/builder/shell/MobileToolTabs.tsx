import {createContext,useContext,useEffect,useRef,type ReactNode} from 'react';
import './mobile-tool-tabs.css';
export type MobileToolChoice={id:string;label:string;disabled?:boolean};
export const MobileSectionToolsContext=createContext<ReactNode>(null);
export function MobileSectionTools(){return useContext(MobileSectionToolsContext)}
/** One phone tool-navigation pattern; the main page keeps its existing editor. */
export function MobileToolTabs({label,items,value,onChange}:{label:string;items:MobileToolChoice[];value:string;onChange:(id:string)=>void}){
 const root=useRef<HTMLElement>(null);
 useEffect(()=>{const nav=root.current,active=nav?.querySelector<HTMLElement>('[aria-current="page"]');if(!nav||!active||!nav.clientWidth)return;const left=active.offsetLeft-nav.offsetLeft;if(left<nav.scrollLeft||left+active.offsetWidth>nav.scrollLeft+nav.clientWidth)nav.scrollTo({left:Math.max(0,left-(nav.clientWidth-active.offsetWidth)/2),behavior:'auto'})},[value]);
 return <nav ref={root} className="mobile-page-tools" data-mobile-tool-tabs aria-label={label}>{items.map(item=><button key={item.id} type="button" disabled={item.disabled} aria-current={value===item.id?'page':undefined} onClick={()=>onChange(item.id)}>{item.label}</button>)}</nav>
}
