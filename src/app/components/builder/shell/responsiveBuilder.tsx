import {createContext,useContext,useEffect,useRef,useState,type ReactNode,type PointerEvent as ReactPointerEvent} from 'react';
import {X,ChevronUp} from 'lucide-react';
export type SheetSnap='peek'|'half'|'full';
export type BuilderPanel='sections'|'tools'|'add'|'menu'|'appearance'|'fit'|'picker'|'how'|'settings'|null;
export function useBuilderWidth(){const [width,setWidth]=useState(()=>window.innerWidth);useEffect(()=>{const update=()=>setWidth(window.innerWidth);window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update)},[]);return width}
export const ResponsiveBuilderContext=createContext({size:'m',setSize:(_s:string)=>{},panel:null as BuilderPanel,setPanel:(_s:BuilderPanel)=>{},inspectorSnap:'peek' as SheetSnap,setInspectorSnap:(_s:SheetSnap)=>{},openSections:()=>{}});
export const useResponsiveBuilder=()=>useContext(ResponsiveBuilderContext);
/** Shared snap geometry; drag moves only the panel DOM until release. */
export function sheetSnapHeight(snap:SheetSnap,height:number){const usable=Math.max(260,height-114);return snap==='peek'?104:Math.round(usable*(snap==='half'?.46:.86))}
export function nearestSheetSnap(height:number,viewportHeight:number,persistent:boolean):SheetSnap{
 const snaps:SheetSnap[]=persistent?['peek','half','full']:['half','full'];return snaps.reduce((best,next)=>Math.abs(sheetSnapHeight(next,viewportHeight)-height)<Math.abs(sheetSnapHeight(best,viewportHeight)-height)?next:best)
}
export function BuilderSheet({title,onClose,children,persistent=false,snap:controlledSnap,onSnap,initialSnap='full',compactHeader=false}:{title:string;onClose:()=>void;children:ReactNode;persistent?:boolean;snap?:SheetSnap;onSnap?:(snap:SheetSnap)=>void;initialSnap?:SheetSnap;compactHeader?:boolean}){
 const suppressClick=useRef(0);const dragCleanup=useRef<(()=>void)|null>(null);const ref=useRef<HTMLElement>(null);const close=useRef(onClose);close.current=onClose;const [localSnap,setLocalSnap]=useState<SheetSnap>(initialSnap);const snap=controlledSnap??localSnap;
 useEffect(()=>()=>dragCleanup.current?.(),[]);
 const setSnap=(next:SheetSnap)=>{setLocalSnap(next);onSnap?.(next)};
 useEffect(()=>{if(persistent)return;const previous=document.activeElement as HTMLElement|null;ref.current?.focus();const key=(e:KeyboardEvent)=>{if(e.defaultPrevented||document.querySelector('[data-slot="select-content"]'))return;if(e.key==='Escape'){e.stopPropagation();close.current()}if(e.key==='Tab'){const nodes=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,[tabindex="0"]')??[]).filter(n=>n.getClientRects().length);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus()}},[persistent]);
 const drag=(event:ReactPointerEvent<HTMLButtonElement>)=>{
  if(event.button!==0)return;const target=event.currentTarget,panel=ref.current;if(!panel)return;const startY=event.clientY,startHeight=panel.getBoundingClientRect().height;let lastY=startY,lastTime=performance.now(),velocity=0,distance=0;
  dragCleanup.current?.();target.setPointerCapture(event.pointerId);panel.dataset.dragging='true';
  const move=(e:PointerEvent)=>{const now=performance.now();velocity=(lastY-e.clientY)/Math.max(1,now-lastTime);lastY=e.clientY;lastTime=now;distance=startY-e.clientY;panel.style.setProperty('--sheet-live-height',`${Math.max(persistent?104:64,Math.min(window.innerHeight-70,startHeight+distance))}px`)};
  const stop=()=>{dragCleanup.current=null;window.removeEventListener('resize',cancel);window.visualViewport?.removeEventListener('resize',cancel);panel.dataset.dragging='false';panel.style.removeProperty('--sheet-live-height');target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',stop);target.removeEventListener('pointercancel',cancel);target.removeEventListener('lostpointercapture',cancel);if(Math.abs(distance)<8)return;suppressClick.current=performance.now()+400;if(!persistent&&startHeight+distance<120){close.current();return}setSnap(nearestSheetSnap(startHeight+distance+velocity*100,window.innerHeight,persistent))};
  const cancel=()=>{dragCleanup.current=null;window.removeEventListener('resize',cancel);window.visualViewport?.removeEventListener('resize',cancel);panel.dataset.dragging='false';panel.style.removeProperty('--sheet-live-height');target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',stop);target.removeEventListener('pointercancel',cancel);target.removeEventListener('lostpointercapture',cancel)};
  dragCleanup.current=cancel;window.addEventListener('resize',cancel);window.visualViewport?.addEventListener('resize',cancel);target.addEventListener('pointermove',move);target.addEventListener('pointerup',stop);target.addEventListener('pointercancel',cancel);target.addEventListener('lostpointercapture',cancel);
 };
 const cycle=()=>{if(performance.now()<suppressClick.current){suppressClick.current=0;return}setSnap(snap==='peek'?'half':snap==='half'?'full':persistent?'peek':'half')};
 return <div className={persistent?'responsive-context-layer':'responsive-sheet-layer'}>{!persistent&&<button className="responsive-sheet-backdrop" aria-label="Close sheet" onClick={onClose}/>}<section ref={ref} tabIndex={persistent?undefined:-1} className={'responsive-sheet'+(persistent?' contextual-measurement-sheet':'')+(title==='Sections'?' responsive-section-sheet':'')} data-snap={snap} role={persistent?'region':'dialog'} aria-modal={persistent?undefined:true} aria-label={title}>
 <button className="mobile-sheet-handle" aria-label={`Resize ${title}: ${snap}`} onPointerDown={drag} onClick={cycle} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();setSnap(e.key==='ArrowUp'?(snap==='peek'?'half':'full'):(snap==='full'?'half':'peek'))}}}><span/></button>
 {!compactHeader&&<header><h2>{title}</h2>{persistent?<button aria-label="Collapse measurement details" onClick={()=>setSnap('peek')}><ChevronUp size={20} style={{transform:'rotate(180deg)'}}/></button>:<button aria-label="Close" onClick={onClose}><X size={20}/></button>}</header>}<div className="responsive-sheet-content">{children}</div></section></div>
}

/** Horizontal navigation yields vertical scrolling and ignores value-entry gestures. */
export function useMeasurementSwipe(onAdvance:(direction:number)=>void){
 const start=useRef<{x:number;y:number}|null>(null),suppress=useRef(0);
 return {
  onPointerDown:(e:ReactPointerEvent<HTMLElement>)=>{start.current=e.pointerType==='touch'&&!((e.target as Element).closest('input,textarea,select,[role="switch"],.mobile-sheet-handle,.grading-matrix'))?{x:e.clientX,y:e.clientY}:null},
  onPointerCancel:()=>{start.current=null},
  onPointerUp:(e:ReactPointerEvent<HTMLElement>)=>{const from=start.current;start.current=null;if(!from)return;const dx=e.clientX-from.x,dy=e.clientY-from.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5){suppress.current=performance.now()+400;onAdvance(dx<0?1:-1)}},
  onClickCapture:(e:React.MouseEvent<HTMLElement>)=>{if(performance.now()<suppress.current){e.preventDefault();e.stopPropagation()}}
 };
}
