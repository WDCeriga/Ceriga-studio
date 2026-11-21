import {useState} from 'react';
import {TANK_TRIMS} from '../../data/tankTrims';
import {TANK_FINISHES} from '../../data/tankTop';
import {DEFAULT_PATCH,type PatchSettings} from '../../data/garmentPatches';
import {detailAsset,type GarmentDetail,type GarmentDetailType,type GarmentDetailVariant} from '../../data/garmentDetails';
import type {GarmentView} from '../../data/garmentView';
import './tank-details.css';
export function TankDetailsLibrary({add,onFinish,onEditOpenings,view='front'}:{view?:GarmentView;onEditOpenings?:()=>void;onFinish?:(finish:string)=>void;add:(type:GarmentDetailType,variant?:GarmentDetailVariant,length?:'quarter'|'half'|'full',overrides?:Partial<GarmentDetail>)=>void}){
 const [section,setSection]=useState('Pockets');
 const categories=['Pockets','Neck / armhole trims','Vent / side details','Performance details','Patches / tabs'];
 const patches:Partial<PatchSettings>[]=[
  {material:'woven',shape:'rectangle',edgeStyle:'folded'},
  {material:'embroidered',shape:'circle'},
  {material:'silicone',shape:'rounded',finish:'heatPress'},
  {material:'printed',shape:'rectangle',edgeStyle:'folded'},
 ];
 const card=(label:string,svg:string,action:()=>void)=><button key={label} type="button" aria-label={'Add '+label} onClick={action}>
  <img alt="" src={'data:image/svg+xml,'+encodeURIComponent(svg.replaceAll('var(--detail-fill, none)','#b9bdc5').replaceAll('var(--detail-outline, black)','#25282c').replaceAll('var(--detail-stitch, black)','#fff'))}/><span>{label}</span>
 </button>;
 return <div className="trouser-details-library tank-details-library">
  <div className="detail-category-grid trouser-detail-categories" role="group" aria-label="Tank detail category">{categories.map(name=><button type="button" key={name} aria-pressed={section===name} onClick={()=>setSection(name)}>{name}</button>)}</div>
  <div className="trouser-detail-cards">
   {section==='Neck / armhole trims'?<><button type="button" className="tank-openings-editor" onClick={onEditOpenings}>Edit neck and armhole construction</button>{TANK_FINISHES.map(([id,label])=>card(label,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 70"><path d="M15 12Q60 85 105 12" fill="none" stroke="#aaa" stroke-width="${id==='raw'?2:10}" ${id==='rib'?'stroke-dasharray="2 2"':''}/></svg>`,()=>{onFinish?.(id);onEditOpenings?.()}))}</>:section==='Patches / tabs'?patches.map((patch,index)=>{
    const name=['Woven patch','Embroidered patch','Silicone patch','Printed hem tab'][index];
    const settings={...DEFAULT_PATCH,...patch};
    const shape=patch.shape==='circle'?'<circle cx="60" cy="40" r="30"/>':`<rect x="18" y="16" width="84" height="48" rx="${index===2?8:1}"/>`;
    const preview=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><g fill="#b9bdc5" stroke="#25282c" stroke-width="2">${shape}</g><path d="M42 40H78" stroke="#666" stroke-width="3"/></svg>`;
    return card(name,preview,()=>add('patch',undefined,undefined,{name,patch:settings,x:index===3?.83:.72,y:index===3?.94:.37,scale:index===3?.28:.55}));
   }):section==='Pockets'?[
    ['Chest patch pocket','pocket-01',.72,.40,.75],
    ['Lower patch pocket','pocket-01',.28,.73,.72],
    ['Zip chest pocket','hoodie-chest-zip',.72,.40,.75],
    ['Hidden side pocket','hoodie-welt',.18,.65,.42],
   ].map(([label,variant,x,y,scale])=>card(String(label),detailAsset({type:'pocket',variant:variant as GarmentDetailVariant}).svg,
    ()=>add('pocket',variant as GarmentDetailVariant,undefined,{name:label,x,y,scale})))
    :TANK_TRIMS.filter(option=>section==='Vent / side details'?['tank-slit','tank-dropped-slit','tank-side-tape','tank-bartack'].includes(option.id):['tank-reflective','tank-mesh','tank-piping',...(view==='back'?['tank-back-mesh']:[])].includes(option.id)).map(option=>
     card(option.label,option.svg,()=>add('utility',option.id as GarmentDetailVariant,undefined,{name:option.label,freeResize:true,...(option.id==='tank-reflective'?{fill:'#BFC4C9'}:{})})))}
  </div>
 </div>;
}
