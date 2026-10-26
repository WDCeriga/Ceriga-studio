import {ChevronRight} from 'lucide-react';
import {useEffect,useState} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
import {PatternGraphic} from '../printsStudio/PatternGraphic';
import {patternDefinition} from '../../../lib/patternCatalog';

type Part={mask?:string;label:string;width:number;height:number;x:number;y:number;patternReferenceSize?:number};
function GarmentPatternCard({element,onSelect}:{element:DesignElement;onSelect:()=>void}){
 const [part,setPart]=useState<Part>({label:element.patternTarget?'Garment part':'Artwork layer',width:element.width,height:element.height,x:element.x,y:element.y});
 useEffect(()=>{
  const zone=document.querySelector('[data-print-design-zone]');if(!zone)return;
  const refresh=()=>{
   const node=Array.from(zone.querySelectorAll<HTMLElement>('[data-print-id]')).find(node=>node.dataset.printId===element.id);
   if(!node)return;
   const bounds=node.dataset.patternPartBounds?JSON.parse(node.dataset.patternPartBounds):{width:element.width,height:element.height,x:element.x,y:element.y};
   const next={...bounds,label:node.dataset.patternPartLabel??'Artwork layer',mask:node.dataset.patternPartMask,patternReferenceSize:node.dataset.patternReferenceSize?Number(node.dataset.patternReferenceSize):undefined};
   setPart(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
  };
  refresh();const observer=new MutationObserver(refresh);observer.observe(zone,{childList:true,subtree:true,attributes:true,attributeFilter:['data-pattern-part-mask','data-pattern-part-label','data-pattern-part-bounds','data-pattern-reference-size']});
  return()=>observer.disconnect();
 },[element.id,element.width,element.height,element.x,element.y]);
 return <button className="applied-pattern-card" onClick={onSelect} aria-label={`Edit ${patternDefinition(element.content)?.label??'pattern'} on ${part.label}`}><div className="applied-pattern-part"><div style={{aspectRatio:`${part.width}/${part.height}`,height:part.height>=part.width?'100%':'auto',width:part.width>part.height?'100%':'auto',maxWidth:'100%',maxHeight:'100%',maskImage:part.mask,maskSize:'100% 100%',maskRepeat:'no-repeat',background:'#f4f1e9',opacity:(element.opacity??100)/100}}><PatternGraphic element={{...element,...part,rotation:0}}/></div></div><span><strong>{part.label}</strong><small>{patternDefinition(element.content)?.label??'Custom repeat'}</small></span><span className="applied-pattern-edit">Edit<ChevronRight size={13} aria-hidden="true"/></span></button>;
}
export function AppliedGarmentPatterns({elements,onSelect}:{elements:DesignElement[];onSelect:(id:string)=>void}){
 const visible=elements.filter(element=>!element.hidden);if(!visible.length)return null;
 return <section className="applied-garment-patterns"><div className="studio-pattern-section-heading"><h3>On this garment</h3><span>{visible.length}</span></div><div className="applied-pattern-grid">{visible.map(element=><GarmentPatternCard key={element.id} element={element} onSelect={()=>onSelect(element.id)}/>)}</div></section>;
}
