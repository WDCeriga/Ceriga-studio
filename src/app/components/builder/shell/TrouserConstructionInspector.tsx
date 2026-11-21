import {Check,ArrowUpRight} from 'lucide-react';
import {SweatpantsControls} from './SweatpantsControls';
import {SWEATPANTS_OPTIONS,SWEATPANTS_SHORT_LEGS,sweatpantsBlock} from '../../../data/sweatpants';
import type {GarmentAssetSelection} from '../../../data/garmentSvgCatalog';
import {ConstructionDimensions} from './ConstructionDimensions';
import {constructionDepth} from '../../../lib/constructionDepth';
export function TrouserConstructionInspector({section,selection,onChange,onMaterials,onMeasurements,notes,onNotes,unit,waistHeight,onWaistHeight,onFlyMaterials}:{section:'waist'|'leg'|'hem';selection:GarmentAssetSelection;onChange:(patch:GarmentAssetSelection)=>void;onMaterials:()=>void;onMeasurements:()=>void;notes:string;onNotes:(value:string)=>void;unit:'cm'|'in';waistHeight?:string;onWaistHeight:(cm:number)=>void;onFlyMaterials:()=>void}){
 const key=section==='waist'?'pantsWaist':section==='leg'?'pantsLeg':'pantsHem';
 const title={waist:'Waistband',leg:'Leg construction',hem:'Hems & cuffs'}[section];
 const block=sweatpantsBlock(selection),value=block[section];
 const options=section==='leg'&&block.short?SWEATPANTS_SHORT_LEGS:SWEATPANTS_OPTIONS[key].options;
 const label=options.find(option=>option[0]===value)?.[1]??options[0][1];
 const cuff=['rib','elastic'].includes(block.hem);
 const hemDefault=cuff?4.8:block.hem==='adjustable'?2.2:1.2;
 const hemMax=cuff?12:5;
 return <div className="materials-editor trouser-construction-editor"><header className="materials-heading"><span className="builder-eyebrow">CONSTRUCTION STUDIO</span><h2>{title}</h2><p>{{waist:'Shape the waist. Refine the construction.',leg:'Choose the leg profile. Keep the fit coordinated.',hem:'Choose the finish at the leg opening.'}[section]}</p></header>
  <section className="neck-selected-summary"><span><small>CURRENT {section==='waist'?'WAISTBAND':section==='leg'?'LEG PROFILE':'HEM'}</small><strong>{label}</strong></span><Check size={16}/></section>
  <SweatpantsControls section={section} selection={selection} onChange={onChange}/>
  {section==='waist'&&<ConstructionDimensions label="Band height" cm={constructionDepth(waistHeight,4,12)} defaultCm={4} maxCm={12} unit={unit} onChange={onWaistHeight} onMeasurements={onMeasurements}/>}
  {section==='hem'&&!['raw','open'].includes(block.hem)&&<ConstructionDimensions label={cuff?'Cuff height':block.hem==='adjustable'?'Channel height':'Hem depth'} cm={constructionDepth(selection.pantsHemDepth,hemDefault,hemMax)} defaultCm={hemDefault} maxCm={hemMax} unit={unit} onChange={cm=>onChange({pantsHemDepth:String(cm)})} onMeasurements={onMeasurements}/>}
  {section==='waist'&&<details className="material-section-disclosure"><summary>Front fly seam</summary>
   <label className="preset-construction-toggle">Show faux fly seam<input type="checkbox" checked={selection.pantsFly!=='none'} onChange={event=>onChange({pantsFly:event.target.checked?'faux':'none'})}/></label>
   {selection.pantsFly!=='none'&&<><ConstructionDimensions label="Fly seam length" cm={constructionDepth(selection.pantsFlyLength,12,18)} defaultCm={12} maxCm={18} unit={unit} onChange={cm=>onChange({pantsFlyLength:String(cm)})} onMeasurements={onMeasurements}/><button className="material-wide-button" type="button" onClick={onFlyMaterials}>Edit fly seam colour <ArrowUpRight size={14}/></button></>}
  </details>}
  {section==='leg'&&<details open className="material-section-disclosure"><summary>Measurements</summary><button className="material-wide-button" type="button" onClick={onMeasurements}>Edit measurements <ArrowUpRight size={14}/></button></details>}
  <details className="material-section-disclosure"><summary>Material & colour</summary><p className="material-caption">Colours and fabrics are set in Materials.</p><button className="material-wide-button" type="button" onClick={onMaterials}>Edit material & colour <ArrowUpRight size={14}/></button></details>
  <details className="material-section-disclosure"><summary>Construction notes</summary><textarea aria-label={title+' notes'} value={notes} onChange={event=>onNotes(event.target.value)} placeholder="Add construction requirements…"/></details>
 </div>;
}
