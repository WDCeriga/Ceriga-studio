import {useState} from 'react';
import {TANK_TRIMS} from '../../data/tankTrims';
import {TANK_FINISHES} from '../../data/tankTop';
import {detailAsset,type GarmentDetail,type GarmentDetailType,type GarmentDetailVariant} from '../../data/garmentDetails';
export function TankDetailsLibrary({add,onFinish}:{onFinish?:(finish:string)=>void;add:(type:GarmentDetailType,variant?:GarmentDetailVariant,length?:'quarter'|'half'|'full',overrides?:Partial<GarmentDetail>)=>void}){
 const [section,setSection]=useState('Pockets');
 const categories=['Pockets','Neck / armhole trims','Vent / side details','Performance details'];
 const card=(label:string,svg:string,action:()=>void)=><button key={label} type="button" aria-label={'Add '+label} onClick={action}>
  <img alt="" src={'data:image/svg+xml,'+encodeURIComponent(svg.replaceAll('var(--detail-fill, none)','#b9bdc5').replaceAll('var(--detail-outline, black)','#25282c').replaceAll('var(--detail-stitch, black)','#fff'))}/><span>{label}</span>
 </button>;
 return <div className="trouser-details-library">
  <div className="detail-category-grid trouser-detail-categories" role="group" aria-label="Tank detail category">{categories.map(name=><button type="button" key={name} aria-pressed={section===name} onClick={()=>setSection(name)}>{name}</button>)}</div>
  <div className="trouser-detail-cards">
   {section==='Neck / armhole trims'?TANK_FINISHES.map(([id,label])=>card(label,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 70"><path d="M15 12Q60 85 105 12" fill="none" stroke="#aaa" stroke-width="${id==='raw'?2:10}" ${id==='rib'?'stroke-dasharray="2 2"':''}/></svg>`,()=>onFinish?.(id))):section==='Pockets'?[
    ['Chest patch pocket','pocket-01',.28,.34,.60],
    ['Lower patch pocket','pocket-01',.28,.73,.72],
    ['Zip chest pocket','hoodie-chest-zip',.72,.34,.65],
    ['Hidden side pocket','hoodie-welt',.18,.65,.42],
   ].map(([label,variant,x,y,scale])=>card(String(label),detailAsset({type:'pocket',variant:variant as GarmentDetailVariant}).svg,
    ()=>add('pocket',variant as GarmentDetailVariant,undefined,{name:label,x,y,scale})))
    :TANK_TRIMS.filter(option=>section==='Vent / side details'?['tank-slit','tank-dropped-slit','tank-side-tape'].includes(option.id):['tank-reflective','tank-mesh','tank-piping'].includes(option.id)).map(option=>
     card(option.label,option.svg,()=>add('utility',option.id as GarmentDetailVariant,undefined,{name:option.label})))}
  </div>
 </div>;
}
