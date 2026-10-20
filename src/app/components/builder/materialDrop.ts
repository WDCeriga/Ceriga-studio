import { useState, type DragEvent } from 'react';

export const MATERIAL_DRAG_TYPE = 'application/x-ceriga-material';
export type MaterialDrop = { kind: 'colour'; colour: string } | { kind: 'fabric'; fabricId: string };
export type MaterialDropHandler = (partId: string, material: MaterialDrop) => void;

export function readMaterialDrop(transfer: Pick<DataTransfer, 'getData'>): MaterialDrop | undefined {
  try {
    const value = JSON.parse(transfer.getData(MATERIAL_DRAG_TYPE));
    if (value?.kind === 'colour' && /^#[\da-f]{6}$/i.test(value.colour)) return { kind: 'colour', colour: value.colour };
    if (value?.kind === 'fabric' && typeof value.fabricId === 'string' && /^[a-z0-9-]+$/.test(value.fabricId)) return { kind: 'fabric', fabricId: value.fabricId };
  } catch { /* External drags are not material assignments. */ }
  return undefined;
}

export function useMaterialDrop(partId: string, onDrop?: MaterialDropHandler) {
  const [dragHovered, setDragHovered] = useState(false);
  return {
    dragHovered,
    handlers: {
      onDragOver: (event: DragEvent<Element>) => {
        if (!onDrop || !event.dataTransfer.types.includes(MATERIAL_DRAG_TYPE)) return;
        event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy'; setDragHovered(true);
      },
      onDragLeave: () => setDragHovered(false),
      onDrop: (event: DragEvent<Element>) => {
        setDragHovered(false);
        if (!onDrop) return;
        const material = readMaterialDrop(event.dataTransfer);
        if (!material) return;
        event.preventDefault(); event.stopPropagation(); onDrop(partId, material);
      },
    },
  };
}

/** Pointer drag keeps swatches responsive across browsers without native drag previews. */
export function beginMaterialDrag(event:import('react').PointerEvent<HTMLElement>,material:MaterialDrop){
 if(event.button!==0)return;const start={x:event.clientX,y:event.clientY};let active=false,hover:HTMLElement|null=null,ghost:HTMLDivElement|null=null;
 const find=(x:number,y:number)=>document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-tshirt-hit-target],[data-construction-region-hit],[data-material-map-hit]')??null;
 const cleanup=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',cancel);hover?.removeAttribute('data-material-drag-hover');ghost?.remove()};
 const move=(e:PointerEvent)=>{if(!active&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<8)return;active=true;e.preventDefault();
  if(!ghost){ghost=document.createElement('div');ghost.className='material-drag-ghost';ghost.textContent=material.kind==='fabric'?'Drop fabric':'Drop colour';if(material.kind==='colour')ghost.style.borderLeft='22px solid '+material.colour;document.body.append(ghost)}
  ghost.style.left=(e.clientX+14)+'px';ghost.style.top=(e.clientY+14)+'px';const target=find(e.clientX,e.clientY);if(target!==hover){hover?.removeAttribute('data-material-drag-hover');hover=target;hover?.setAttribute('data-material-drag-hover','true')}
 };
 const end=(e:PointerEvent)=>{const target=find(e.clientX,e.clientY),partId=target?.dataset.tshirtHitTarget??target?.dataset.constructionRegionHit??target?.dataset.materialMapHit;cleanup();if(!active)return;
  const suppress=(click:MouseEvent)=>{click.preventDefault();click.stopPropagation();document.removeEventListener('click',suppress,true)};document.addEventListener('click',suppress,true);setTimeout(()=>document.removeEventListener('click',suppress,true),350);
  if(partId)window.dispatchEvent(new CustomEvent('ceriga-material-pointer-drop',{detail:{partId,material}}));
 };
 const cancel=()=>cleanup();document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',end);document.addEventListener('pointercancel',cancel);
}
