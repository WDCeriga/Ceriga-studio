import type {CSSProperties} from 'react';
import {ArrowUpRight, Check, ChevronDown, Focus} from 'lucide-react';
import {NeckChoiceGrid} from './NeckConstructionInspector';
import {FoldDrawing} from './HemConstructionInspector';
import {MaterialSelect} from './MaterialSelect';
import type {HemConstruction} from '../../../data/tshirtHemStyles';
import './preset-construction.css';
import {ConstructionDimensions} from './ConstructionDimensions';
import {constructionDepth} from '../../../lib/constructionDepth';
import type {GarmentAssetSelection} from '../../../data/garmentSvgCatalog';
import {TANK_OPTIONS,TANK_DEFAULTS,TANK_ARMHOLE_FINISHES,tankThumbnail,tankNeckForFit,TANK_LENGTH_RANGE,tankLengthAdjustment} from '../../../data/tankTop';
import './sweatpants-controls.css';
import {VisualOptionGrid,PresetArt} from '../design-system';
export function TankControls({selection,onChange,section='fit',fit='regular'}:{selection:GarmentAssetSelection;onChange:(patch:GarmentAssetSelection)=>void;fit?:string;section?:'fit'|'openings'|'body'|'hem'}){
 const keys=section==='fit'?['tankLength']:section==='openings'?['tankNeck','tankStrap','tankArmhole']:section==='body'?['tankType']:['tankHem'];
 const adjustment=tankLengthAdjustment(selection.tankLengthAdjust);
 const {min,max,step}=TANK_LENGTH_RANGE;
 const adjustLength=(value:string)=>onChange({tankLengthAdjust:String(tankLengthAdjustment(value))});
 return <div className="sweatpants-fit-controls sweatpants-illustrated-controls tank-controls">
  {keys.map(key=>{
   const group=TANK_OPTIONS[key as keyof typeof TANK_OPTIONS];
   const selected=key==='tankNeck'?tankNeckForFit(selection,fit):selection[key]??TANK_DEFAULTS[key];
   const folds:Record<string,HemConstruction>={single:'single-fold',double:'double-fold',raw:'raw',cover:'double-fold',rib:'rib',curved:'single-fold',dropped:'single-fold'};
   return <details className={section==='fit'?'sweatpants-choice':'material-section-disclosure'} key={key} open><summary>{section==='fit'?<><span>{group.label}<small>{group.options.find(([id])=>id===selected)?.[1]}</small></span><ChevronDown size={16}/></>:group.label}</summary>
    {key==='tankNeck'?<NeckChoiceGrid choices={group.options.map(([id,name])=>({id,name}))} selected={selected} onSelect={id=>onChange({tankNeck:id})}/>:section==='fit'?
     // Phase 1: Fit choices use the shared VisualOptionGrid (same options, images, state and handler).
     <div className="sweatpants-fit-grid cx"><VisualOptionGrid label={group.label} columns={3} value={selected}
      options={group.options.map(([id,label])=>({id,label,preview:<PresetArt src={tankThumbnail(fit,{...selection,[key]:id})}/>}))}
      onChange={id=>onChange({[key]:id})}/></div>:<div role="group" aria-label={group.label} className={key==='tankHem'?'hem-construction-grid':'neck-shape-grid tank-shape-grid'}>
     {group.options.map(([id,label])=><button type="button" key={id} className={selected===id?'is-selected':''} aria-pressed={selected===id}
      onClick={()=>onChange({[key]:id})}>
      {key==='tankHem'?<FoldDrawing kind={folds[id]}/>:<img className="sweatpants-leg-art" src={tankThumbnail(fit,{...selection,[key]:id})} alt=""/>}
      <span>{label}</span>
      {selected===id&&<Check className="neck-choice-check" size={12}/>}
     </button>)}
    </div>}
    {key==='tankLength'&&<div className="sweatpants-length-adjuster" style={{'--length-position':`${100*(adjustment-min)/(max-min)}%`} as CSSProperties}>
     <div className="sweatpants-length-value"><label htmlFor="tank-length-adjustment">Length adjustment</label><span><input id="tank-length-adjustment" type="number" aria-label="Length adjustment in centimetres" min={min} max={max} step={step} value={adjustment} onChange={event=>adjustLength(event.target.value)}/> cm</span></div>
     <div className="sweatpants-length-slider"><div className="sweatpants-length-track" aria-hidden="true"/><input type="range" aria-label="Adjust tank length" min={min} max={max} step={step} value={adjustment} onChange={event=>adjustLength(event.target.value)}/></div>
     <div className="sweatpants-length-scale" aria-hidden="true"><span>{min} cm</span><span>+{max} cm</span></div>
     <button className="sweatpants-length-reset" type="button" disabled={adjustment===0} onClick={()=>adjustLength('0')}>Reset length</button>
    </div>}
    {key==='tankLength'&&<p className="cx-section-helper">Adjusts the body and hem only.</p>}
   </details>;
  })}
  {section==='openings'&&<>
   <details className="material-section-disclosure" open><summary>Neck finish</summary>
    <div className="neck-finish-grid">{([
     ['rib','ribbed','Ribbed','Textured band'],['self','clean','Smooth band','No rib lines'],['raw','raw','Raw opening','Without a band'],
    ] as const).map(([id,style,label,hint])=><button type="button" key={id} aria-pressed={(selection.tankNeckFinish??'rib')===id}
     onClick={()=>onChange(selection.tankLinkOpenings!=='off'?{tankNeckFinish:id,tankLeftFinish:id,tankRightFinish:id}:{tankNeckFinish:id})}>
     <span className={'neck-finish-sample neck-finish-'+style}/><strong>{label}</strong><small>{hint}</small>
    </button>)}</div>
   </details>
   <details className="material-section-disclosure" open><summary>Armhole finish</summary>
    <label className="preset-construction-toggle">Link opening finishes<input type="checkbox" checked={selection.tankLinkOpenings!=='off'} onChange={event=>onChange({tankLinkOpenings:event.target.checked?'on':'off'})}/></label>
    {(['tankLeftFinish','tankRightFinish'] as const).map((key,index)=><label className="preset-construction-field" key={key}>
     {index===0?'Left armhole':'Right armhole'}
     <MaterialSelect aria-label={index===0?'Left armhole finish':'Right armhole finish'} value={selection[key]??TANK_DEFAULTS[key]}
      onChange={event=>{const id=event.target.value;const shared=['rib','self','raw'].includes(id);onChange(selection.tankLinkOpenings!=='off'?{...(shared?{tankNeckFinish:id}:{}),tankLeftFinish:id,tankRightFinish:id}:{[key]:id});}}>
      {TANK_ARMHOLE_FINISHES.map(([id,label])=><option value={id} key={id}>{label}</option>)}
     </MaterialSelect>
    </label>)}
   </details>
  </>}
 </div>;
}
export function TankConstructionInspector(props:{selection:GarmentAssetSelection;fit?:string;unit?:'cm'|'in';onChange:(patch:GarmentAssetSelection)=>void;section:'openings'|'body'|'hem';onMaterials:()=>void;onMeasurements:()=>void;notes:string;onNotes:(value:string)=>void;closeUp?:boolean;onCloseUp?:()=>void;hemColour?:{value:string;onChange:(colour:string)=>void;onMatchBody:()=>void}}){
 const {section,selection,fit}=props;
 const title={openings:'Neck & armhole',body:'Tank construction',hem:'Hem'}[section];
 const key={openings:'tankNeck',body:'tankType',hem:'tankHem'}[section] as 'tankNeck'|'tankType'|'tankHem';
 const value=section==='openings'?tankNeckForFit(selection,fit):selection[key]??TANK_DEFAULTS[key];
 const label=TANK_OPTIONS[key].options.find(option=>option[0]===value)?.[1];
 return <div className="materials-editor neck-construction-editor preset-construction-editor">
  <header className="materials-heading"><span className="builder-eyebrow">CONSTRUCTION STUDIO</span>
   <h2>{title}</h2><p>{{openings:'Shape the neckline and finish the openings.',body:'Choose the tank silhouette.',hem:'Choose how the bottom edge is finished.'}[section]}</p>
  </header>
  <section className="neck-selected-summary"><span><small>{{openings:'CURRENT NECKLINE',body:'CURRENT SILHOUETTE',hem:'CURRENT HEM'}[section]}</small><strong>{label}</strong></span>
   {props.onCloseUp&&<button type="button" aria-pressed={props.closeUp} onClick={props.onCloseUp}><Focus size={14}/>{props.closeUp?'Full garment':'Close-up'}</button>}
  </section>
  <TankControls {...props}/>
  {section==='hem'&&value!=='raw'&&props.hemColour&&<section className="material-section-disclosure">
   <label className="preset-construction-colour">Hem colour <span>{props.hemColour.value.toUpperCase()}<input type="color" aria-label="Hem colour" value={props.hemColour.value} onChange={event=>props.hemColour?.onChange(event.currentTarget.value)}/></span></label>
   <button type="button" className="material-wide-button" onClick={props.hemColour.onMatchBody}>Match body colour</button>
  </section>}
  {section==='hem'&&value!=='raw'
   ?<ConstructionDimensions label={value==='rib'?'Band height':'Hem depth'} cm={constructionDepth(selection.tankHemDepth,value==='rib'?3:1.3,value==='rib'?12:5)} defaultCm={value==='rib'?3:1.3} maxCm={value==='rib'?12:5} unit={props.unit} onChange={cm=>props.onChange({tankHemDepth:String(cm)})} onMeasurements={props.onMeasurements}/>
   :<details open className="material-section-disclosure"><summary>Measurements</summary><button className="material-wide-button" type="button" onClick={props.onMeasurements}>Edit measurements <ArrowUpRight size={14}/></button></details>}
  <details className="material-section-disclosure"><summary>Material & colour</summary><button className="material-wide-button" type="button" onClick={props.onMaterials}>Edit material & colour <ArrowUpRight size={14}/></button></details>
  <details className="material-section-disclosure"><summary>Construction notes</summary><textarea className="preset-construction-notes" aria-label={title+' notes'} value={props.notes} onChange={event=>props.onNotes(event.target.value)} placeholder="Add construction requirements…"/></details>
 </div>;
}
