import {useMemo} from 'react';
import simplify from 'simplify-js';
import {fabricRings} from '../../../data/regularConstruction';
import type {ResolvedGarmentLayer} from '../../../data/garmentSvgCatalog';
import type {FabricPart} from '../../../data/garmentFabrics';
export function MaterialPartDiagram({layers,parts,selectedIds,onSelect}:{layers:ResolvedGarmentLayer[];parts:FabricPart[];selectedIds:string[];onSelect:(id:string)=>void}){
 const regions=useMemo(()=>layers.filter(l=>parts.some(p=>p.id===l.id)).map(l=>{const rings=fabricRings(l.svgRaw).filter(r=>r.length>3).map(r=>simplify(r,1,true));return {id:l.id,label:parts.find(p=>p.id===l.id)?.label??l.displayName,rings,d:rings.map(r=>'M'+r.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join('L')+'Z').join('')}}).filter(r=>r.d),[layers,parts]);
 const points=regions.flatMap(r=>r.rings.flat()),xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs)-35,top=Math.min(...ys)-35,width=Math.max(...xs)-left+35,height=Math.max(...ys)-top+35;
 if(!regions.length)return null;
 return <svg className="material-part-diagram" viewBox={`${left} ${top} ${width} ${height}`} aria-label="Interactive garment section map">{regions.map(r=><path key={r.id} data-material-map-hit={r.id} d={r.d} fillRule="evenodd" tabIndex={0} role="button" aria-label={`Select ${r.label} on map`} aria-pressed={selectedIds.includes(r.id)} onClick={()=>onSelect(r.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(r.id)}}}><title>{r.label}</title></path>)}</svg>
}
