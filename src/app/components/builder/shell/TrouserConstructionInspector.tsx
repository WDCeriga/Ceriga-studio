import {Check,ArrowUpRight} from 'lucide-react';
import {SweatpantsControls} from './SweatpantsControls';
import {SWEATPANTS_OPTIONS,SWEATPANTS_SHORT_LEGS,sweatpantsBlock} from '../../../data/sweatpants';
import type {GarmentAssetSelection} from '../../../data/garmentSvgCatalog';
export function TrouserConstructionInspector({section,selection,onChange,onMaterials,onMeasurements,notes,onNotes}:{section:'waist'|'leg'|'hem';selection:GarmentAssetSelection;onChange:(patch:GarmentAssetSelection)=>void;onMaterials:()=>void;onMeasurements:()=>void;notes:string;onNotes:(value:string)=>void}){
 const key=section==='waist'?'pantsWaist':section==='leg'?'pantsLeg':'pantsHem';
 const title={waist:'Waistband',leg:'Leg construction',hem:'Hems & cuffs'}[section];
 const block=sweatpantsBlock(selection),value=block[section];
 const options=section==='leg'&&block.short?SWEATPANTS_SHORT_LEGS:SWEATPANTS_OPTIONS[key].options;
 const label=options.find(option=>option[0]===value)?.[1]??options[0][1];
 return <div className="materials-editor trouser-construction-editor"><header className="materials-heading"><span className="builder-eyebrow">CONSTRUCTION STUDIO</span><h2>{title}</h2><p>{{waist:'Shape the waist. Refine the construction.',leg:'Choose the leg profile. Keep the fit coordinated.',hem:'Choose the finish at the leg opening.'}[section]}</p></header>
  <section className="trouser-current-construction"><div><small>CURRENT {section==='waist'?'WAISTBAND':section==='leg'?'LEG PROFILE':'HEM'}</small><strong>{label}</strong></div><Check size={16}/></section>
  <SweatpantsControls section={section} selection={selection} onChange={onChange}/>
  <details open className="material-section-disclosure"><summary>Measurements</summary><p className="material-caption">Dimensions follow your selected fit and size. Refine length and opening in Fit & Measurements.</p><button className="material-wide-button" type="button" onClick={onMeasurements}>Edit measurements <ArrowUpRight size={14}/></button></details>
  <details className="material-section-disclosure"><summary>Material & colour</summary><p className="material-caption">Use the shared material library and colourways for the waistband, leg panels and cuffs.</p><button className="material-wide-button" type="button" onClick={onMaterials}>Edit material & colour <ArrowUpRight size={14}/></button></details>
  <details className="material-section-disclosure"><summary>Construction notes</summary><textarea aria-label={title+' notes'} value={notes} onChange={event=>onNotes(event.target.value)} placeholder="Add construction requirements…"/></details>
 </div>;
}
