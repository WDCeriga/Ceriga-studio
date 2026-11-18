import {useState} from 'react';
import {MaterialSelect} from './shell/MaterialSelect';
import {GARMENT_DETAIL_OPTIONS,detailAsset,createGarmentDetail,type GarmentDetail,type GarmentDetailType,type GarmentDetailVariant,type DetailBounds} from '../../data/garmentDetails';
import type {GarmentAssetSelection} from '../../data/garmentSvgCatalog';
import {TROUSER_POCKET_CHOICES,TROUSER_UTILITIES,TROUSER_PATCH_PRESETS,TROUSER_TABS,TROUSER_ZIP_PLACEMENTS} from '../../data/trouserTrimAssets';
import {TROUSER_POCKET_DIMENSIONS,trouserBuiltInPocketThumbnail,trouserPocketDimension} from '../../data/sweatpants';
import {DEFAULT_PATCH,type PatchSettings} from '../../data/garmentPatches';
import {EYELET_STYLES,TIP_STYLES} from '../../data/hoodieTrimAssets';
export interface TrouserDetailConstruction {selection:GarmentAssetSelection;onChange:(patch:GarmentAssetSelection)=>void;onView:(view:'front'|'back')=>void;onAddToView:(detail:GarmentDetail)=>void}
const addOnPockets=['cargo','hidden','coin'];
const pocketThumbnails=Object.fromEntries(TROUSER_POCKET_CHOICES.map(([id])=>[id,addOnPockets.includes(id)
 ? detailAsset({type:'pocket',variant:('trouser-'+id) as GarmentDetailVariant}).svg
 : trouserBuiltInPocketThumbnail(id)]));
export function TrouserDetailsLibrary({construction,details,onChange,onSelect,add,bounds,view}:{construction:TrouserDetailConstruction;details:GarmentDetail[];onChange:(details:GarmentDetail[])=>void;onSelect:(id:string)=>void;add:(type:GarmentDetailType,variant?:GarmentDetailVariant,length?:'quarter'|'half'|'full',overrides?:Partial<GarmentDetail>)=>void;bounds?:DetailBounds;view:'front'|'back'}){
 const [section,setSection]=useState('Pockets'),[waist,setWaist]=useState('Drawstrings'),[zipPlace,setZipPlace]=useState('pocket');
 const thumb=(raw:string)=>'data:image/svg+xml,'+encodeURIComponent(raw.replaceAll('var(--detail-fill, none)','#b7bdc6').replaceAll('var(--detail-outline, black)','#25282c').replaceAll('var(--detail-stitch, black)','#fff').replaceAll('var(--detail-hardware, none)','#ddd'));
 const card=(label:string,raw:string,action:()=>void,selected=false,disabled=false)=><button type="button" key={label} aria-label={'Add '+label} aria-pressed={selected} disabled={disabled} onClick={action}><img alt="" src={thumb(raw)}/><span>{label}</span></button>;
 const cord=details.find(d=>d.type==='drawstring'&&!d.hidden);
 const frontPocket=construction.selection.pantsFrontPocket??'side-seam';
 const backPocket=construction.selection.pantsBackPocket??'none';
 const activePocket=view==='front'?frontPocket:backPocket;
 const stitchKey=view==='front'?'pantsPocketStitch':'pantsBackPocketStitch';
 const hasPocketStitch=view==='front'?['slant','zip'].includes(frontPocket):backPocket==='patch';
 const editCord=(patch:Partial<GarmentDetail>)=>{if(cord){onChange(details.map(d=>d.id===cord.id?{...d,...patch}:d));onSelect(cord.id)}else add('drawstring','cord-round',undefined,{...patch,trouserAnchor:'waist'})};
 const pocket=(id:string)=>{
  if(id==='none'){construction.onChange({pantsFrontPocket:'none',pantsBackPocket:'none'});onChange(details.filter(d=>d.type!=='pocket'));return}
  if(id==='patch-back'||id==='welt-back'){construction.onChange({pantsBackPocket:id==='patch-back'?'patch':'welt'});construction.onView('back');return}
  if(['side-seam','slant','welt','zip'].includes(id)){construction.onChange({pantsFrontPocket:id});construction.onView('front');return}
  add('pocket',('trouser-'+id) as GarmentDetailVariant);
 };
 return <div className="trouser-details-library">
  <div className="detail-category-grid trouser-detail-categories" role="group" aria-label="Trouser detail category">{['Pockets','Waist trims','Zips & pulls','Utility details','Patches / tabs'].map(label=><button type="button" key={label} aria-pressed={section===label} onClick={()=>{setSection(label);if(label==='Waist trims')construction.onView('front')}}>{label}</button>)}</div>
  {section==='Pockets'&&<><p className="detail-library-hint">Pocket construction follows the selected fit and works on both trousers and shorts.</p><div className="trouser-detail-cards">{TROUSER_POCKET_CHOICES.map(([id,label])=>{
   const chosen=id==='patch-back'?backPocket==='patch':id==='welt-back'?backPocket==='welt'
    :id==='none'?frontPocket==='none'&&backPocket==='none'&&!details.some(detail=>detail.type==='pocket'):frontPocket===id;
   return card(label,pocketThumbnails[id],()=>pocket(id),chosen);
  })}</div>
   {activePocket!=='none'&&<details className="material-section-disclosure" open>
    <summary>{view==='front'?'Front pocket design':'Back pocket design'}</summary>
    {TROUSER_POCKET_DIMENSIONS[view].map(([key,label,min,max])=>{
     const value=trouserPocketDimension(construction.selection,key,min,max);
     return <label className="studio-field" key={key}>{label} <span>{value}%</span>
      <input type="range" min={min} max={max} value={value} aria-label={label}
       onChange={event=>construction.onChange({[key]:event.target.value})}/>
     </label>;
    })}
    {hasPocketStitch&&<label className="studio-field"><span><input type="checkbox"
     checked={construction.selection[stitchKey]==='on'}
     onChange={event=>construction.onChange({[stitchKey]:event.target.checked?'on':'off'})}/> Show pocket topstitching</span></label>}
    <button className="material-wide-button" type="button" onClick={()=>construction.onChange({
     ...Object.fromEntries(TROUSER_POCKET_DIMENSIONS[view].map(([key])=>[key,'100'])),[stitchKey]:'off',
    })}>Reset pocket design</button>
    <button className="material-wide-button" type="button" onClick={()=>construction.onChange({[view==='front'?'pantsFrontPocket':'pantsBackPocket']:'none'})}>
     {view==='front'?'Remove front pockets':'Remove back pocket'}
    </button>
   </details>}
  </>}
  {section==='Waist trims'&&<><div className="detail-category-grid detail-subcategory-grid" role="group" aria-label="Waist trim category">{['Drawstrings','Eyelets','Cord locks','Aglets / tips','Waistband tabs'].map(label=><button key={label} type="button" aria-pressed={waist===label} onClick={()=>setWaist(label)}>{label}</button>)}</div>
   {(cord||['external','internal'].includes(construction.selection.pantsDrawstring??''))&&<label className="studio-field">Drawstring position<MaterialSelect aria-label="Waist drawstring position" value={cord?.drawstringPosition??construction.selection.pantsDrawstring??'external'} onChange={event=>{construction.onChange({pantsDrawstring:event.target.value});if(cord)onChange(details.map(d=>d.id===cord.id?{...d,drawstringPosition:event.target.value as 'internal'|'external'}:d))}}><option value="external">External</option><option value="internal">Internal</option></MaterialSelect></label>}
   <div className="trouser-detail-cards">{waist==='Drawstrings'&&GARMENT_DETAIL_OPTIONS.drawstring.map(option=>card(option.label,option.svg,()=>{construction.onChange({pantsDrawstring:'external'});add('drawstring',option.id as GarmentDetailVariant,undefined,{trouserAnchor:'waist',drawstringPosition:'external'})}))}
   {waist==='Cord locks'&&GARMENT_DETAIL_OPTIONS.toggle.map(option=>card(option.label,option.svg,()=>{construction.onChange({pantsDrawstring:'external'});add('toggle',option.id as GarmentDetailVariant)}))}
   {waist==='Eyelets'&&EYELET_STYLES.map(([id,label])=>card(label,detailAsset({type:'eyelet',variant:('eyelet-'+id) as GarmentDetailVariant}).svg,()=>editCord({hoodieTrim:{...cord?.hoodieTrim,eyelet:id}})))}
   {waist==='Aglets / tips'&&TIP_STYLES.map(([id,label])=>card(label,detailAsset({type:'aglet',variant:('tip-'+id) as GarmentDetailVariant}).svg,()=>editCord({hoodieTrim:{...cord?.hoodieTrim,tip:id}})))}
   {waist==='Waistband tabs'&&TROUSER_TABS.filter(tab=>tab.id==='trouser-waistband-tab').map(tab=>card(tab.label,tab.svg,()=>add('utility',tab.id,undefined,{name:tab.label})))}
   </div><p className="detail-library-hint">Eyelets, tips and locks attach to the drawstring. Adding a lock also adds a cord if needed. Internal cords stay hidden in the exterior view.</p>
   <button type="button" className="material-wide-button" onClick={()=>{construction.onChange({pantsDrawstring:'none'});onChange(details.filter(d=>!['drawstring','toggle'].includes(d.type)))}}>No drawstring</button>
  </>}
  {section==='Zips & pulls'&&<><label className="studio-field">Placement<MaterialSelect aria-label="Trouser zip placement" value={zipPlace} onChange={event=>setZipPlace(event.target.value)}>{TROUSER_ZIP_PLACEMENTS.map(([id,label])=><option value={id} key={id} disabled={bounds?.shorts&&id==='ankle'}>{label}</option>)}</MaterialSelect></label><div className="trouser-detail-cards">{GARMENT_DETAIL_OPTIONS.zip.map(option=>card(option.label,detailAsset({type:'zip',variant:option.id}).svg,()=>{
   const placements:Record<string,Partial<GarmentDetail>>={pocket:{x:.12,y:.18,rotation:12,scaleY:.75},ankle:{x:.15,y:.89,scaleY:.85},'side-leg':{x:.07,y:.54,scaleY:1.3},cargo:{x:.25,y:.38,rotation:90,scaleY:.7},decorative:{x:.75,y:.40,rotation:0}};
   add('zip',option.id,undefined,{...placements[zipPlace],name:TROUSER_ZIP_PLACEMENTS.find(p=>p[0]===zipPlace)![1]+' · '+option.label});
  },false,!bounds||bounds.shorts&&zipPlace==='ankle'))}</div><p className="detail-library-hint">Uses the shared zipper, teeth, tape, slider and pull controls. Each zip cuts its own local opening.</p></>}
  {section==='Utility details'&&<div className="trouser-detail-cards">{TROUSER_UTILITIES.map(option=>card(option.label,option.svg,
   ()=>add('utility',option.id,undefined,{name:option.label}),false,
   Boolean(bounds?.shorts&&['trouser-ankle-tab','trouser-shock-cord','trouser-knee-tab'].includes(option.id))))}</div>}
  {section==='Patches / tabs'&&<div className="trouser-detail-cards">{TROUSER_PATCH_PRESETS.map(p=>card(p.label,detailAsset({type:'patch'}).svg,()=>{
   if('back' in p&&p.back&&view!=='back'){construction.onAddToView({...createGarmentDetail('patch',details,'#D4D4D4'),view:'back',name:p.label,x:p.x,y:p.y,scale:p.width/.2,patch:{...DEFAULT_PATCH,material:p.material as PatchSettings['material']}});return}
   add('patch',undefined,undefined,{name:p.label,x:p.x,y:p.y,scale:p.width/.2,fill:p.label==='Reflective patch'?'#C6CCD0':undefined,patch:{...DEFAULT_PATCH,material:(p.material==='reflective'?'printed':p.material) as PatchSettings['material']}});
  }))}{TROUSER_TABS.map(tab=>card(tab.label,tab.svg,()=>add('utility',tab.id,undefined,{name:tab.label})))}</div>}
 </div>;
}
