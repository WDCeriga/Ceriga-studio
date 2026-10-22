import {MobileSectionTools} from './MobileToolTabs';
import {MeasurementGuidesToggle} from './MeasurementGuidesToggle';
import {BuilderSelect} from './BuilderSelect';
import {AdvancedSizingEditor,type SizingActions} from './AdvancedSizingEditor';
import {MeasurementValueField,NewSegmentedControl} from './MeasurementEditors';
import {type MeasurementGrading} from '../../../lib/measurementGrading';
import {BuilderSheet,useResponsiveBuilder,useBuilderWidth,useMeasurementSwipe} from './responsiveBuilder';
import {ChevronUp,Minus,Plus,ChevronLeft,ChevronRight} from 'lucide-react';
import {getMeasurementTolerance,getToleranceRange,formatToleranceMagnitude} from '../../../lib/measurementTolerances';
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatMeasurementDisplay, parseMeasurementInput, measurementUnitLabel, type MeasurementUnit } from '../../../lib/measurements';
import { type MeasurementGuideId } from '../measurementGuides';
import { NEW_MEASUREMENT_LABELS } from './NewMeasurementOverlay';
import regularThumbnail from '../../../../assets/studio-tshirt/fit-thumbnails/regular.svg';
import slimThumbnail from '../../../../assets/studio-tshirt/fit-thumbnails/slim.svg';
import boxyThumbnail from '../../../../assets/studio-tshirt/fit-thumbnails/boxy.svg';
import oversizedThumbnail from '../../../../assets/studio-tshirt/fit-thumbnails/oversized.svg';
const sizes = ['xs', 's', 'm', 'l', 'xl', 'xxl'];
export function FitMeasurementsInspector({
  guidesVisible=true,onGuidesVisibleChange,
  advanced = false,notes,onNotesChange,grading,sizingActions,
  fit,
  fitChoices,
  presets,
  measurements,
  onFitChange,
  onMeasurementChange,
  measurementUnit,
  onMeasurementUnitChange,
  highlightedMeasurementId,
  onHighlight, measurementTolerances={}, onToleranceChange
}: {
  guidesVisible?:boolean;onGuidesVisibleChange?:(value:boolean)=>void;
  measurementTolerances?:Record<string,Record<string,string>>;
  onToleranceChange?:(id:string,size:string,value:string)=>void;
  grading?:MeasurementGrading;sizingActions?:SizingActions;notes?:string;onNotesChange?:(value:string)=>void;advanced?: boolean;
  fit: string;
  fitChoices: readonly {
    id: string;
    name: string;
  }[];
  presets: Record<string, Record<string, string>>;
  measurements: Record<string, Record<string, string>>;
  onFitChange: (v: string) => void;
  onMeasurementChange: (id: string, size: string, v: string) => void;
  measurementUnit: MeasurementUnit;
  onMeasurementUnitChange: (u: MeasurementUnit) => void;
  highlightedMeasurementId?: string | null;
  onHighlight: (id: MeasurementGuideId | null) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>('chestWidth');
  const {size,setSize,panel:sheet,setPanel:setSheet,inspectorSnap,setInspectorSnap}=useResponsiveBuilder();const width=useBuilderWidth();const phone=width<768;const tablet=width>=768&&width<1200;
  const coreRef=useRef<HTMLDetailsElement>(null);
  useEffect(() => { if(highlightedMeasurementId){setExpanded(highlightedMeasurementId);if(coreRef.current)coreRef.current.open=true;} }, [highlightedMeasurementId]);
  useEffect(()=>{const reveal=()=>{setInspectorSnap('peek');setSheet(null)};window.addEventListener('ceriga-measure-selected',reveal);return()=>window.removeEventListener('ceriga-measure-selected',reveal)},[]);
 const [flash,setFlash]=useState(false);
  const currentRevision=JSON.stringify([highlightedMeasurementId,measurements[highlightedMeasurementId||'chestWidth']?.[size]]);
  const previousRevision=useRef(currentRevision);
  useEffect(()=>{if(previousRevision.current===currentRevision)return;previousRevision.current=currentRevision;setFlash(true);const timer=setTimeout(()=>setFlash(false),220);return()=>clearTimeout(timer)},[currentRevision]);
  const unit = measurementUnitLabel(measurementUnit);
  const field=(id:MeasurementGuideId,s:string,value:string)=><MeasurementValueField key={id+'-'+s+'-'+measurementUnit} id={id} size={s} value={value} unit={measurementUnit} onFocus={()=>onHighlight(id)} onCommit={v=>onMeasurementChange(id,s,v)}/>;
  const fitGrid=<div className="builder-fit-grid" role="group" aria-label="Fit preset">{fitChoices.map(f=><button key={f.id} onClick={()=>{onFitChange(f.id);setSheet(null)}} aria-pressed={fit===f.id}><span className="new-fit-art"><img src={f.id==='slim'?slimThumbnail:f.id==='oversized'?oversizedThumbnail:f.id==='boxy'?boxyThumbnail:regularThumbnail} alt=""/></span><span>{f.name}</span></button>)}</div>;
  const advanceMeasurement=(direction:number)=>{const index=Math.max(0,NEW_MEASUREMENT_LABELS.findIndex(m=>m.id===highlightedMeasurementId));const id=NEW_MEASUREMENT_LABELS[(index+direction+NEW_MEASUREMENT_LABELS.length)%NEW_MEASUREMENT_LABELS.length].id;onHighlight(id);setExpanded(id)};
  const swipe=useMeasurementSwipe(advanceMeasurement);
  if(advanced&&sizingActions){const editor=<AdvancedSizingEditor measurements={measurements} presets={presets} grading={grading} tolerances={measurementTolerances} actions={sizingActions} unit={measurementUnit} onUnit={onMeasurementUnitChange} onMeasurementChange={onMeasurementChange} onToleranceChange={onToleranceChange} onHighlight={onHighlight} highlightedId={highlightedMeasurementId}/>;return phone?(!sheet&&<BuilderSheet title="Advanced sizing" persistent compactHeader snap={inspectorSnap} onSnap={setInspectorSnap} onClose={()=>setInspectorSnap('peek')}><div className="advanced-phone-heading"><button onClick={()=>setInspectorSnap(inspectorSnap==='peek'?'half':'peek')} aria-label={inspectorSnap==='peek'?'Expand advanced sizing':'Collapse advanced sizing'}>Advanced sizing <span>Size {size.toUpperCase()}</span><ChevronUp size={16} style={{transform:inspectorSnap==='peek'?undefined:'rotate(180deg)'}}/></button>{onGuidesVisibleChange&&<MeasurementGuidesToggle phone checked={guidesVisible} onChange={onGuidesVisibleChange}/>}</div>{inspectorSnap!=='peek'&&<MobileSectionTools/>}{inspectorSnap!=='peek'&&<div {...swipe} className="touch-measurement-navigation">{editor}</div>}</BuilderSheet>):<div {...swipe} className="touch-measurement-navigation">{editor}</div>;}
  const selected=NEW_MEASUREMENT_LABELS.find(m=>m.id===highlightedMeasurementId)??NEW_MEASUREMENT_LABELS[0];
  const desktopContent=<div className="builder-fit-measurements touch-measurement-navigation" {...(!phone?swipe:{})}>
    <p className="compact-fit-helper">Choose a fit, then refine measurements.</p>
    <h3 className="builder-eyebrow">Fit</h3>
    {tablet?<><h3 className="tablet-fit-label">Fit</h3><button className="tablet-fit-select" aria-haspopup="dialog" onClick={()=>setSheet('fit')}>{fitChoices.find(f=>f.id===fit)?.name??fit}<ChevronDown size={16}/></button></>:fitGrid}
    {tablet&&<details className="tablet-size-disclosure"><summary>Size & units · {size.toUpperCase()} · {unit}</summary><div className="tablet-size-settings"><div className="builder-size-range">{sizes.map(s=><button key={s} aria-pressed={size===s} onClick={()=>setSize(s)}>{s.toUpperCase()}</button>)}</div><NewSegmentedControl label="Units" values={['cm','in']} value={measurementUnit} onChange={v=>onMeasurementUnitChange(v as MeasurementUnit)}/></div></details>}
    <div className="new-measure-settings restored-core-settings"><div><span>Size range</span><div className="builder-size-range">{sizes.map(s=><button key={s} aria-label={'Edit size '+s.toUpperCase()} aria-pressed={size===s} onClick={()=>setSize(s)}>{s.toUpperCase()}</button>)}</div></div><label>Units<NewSegmentedControl label="Units" values={['cm','in']} value={measurementUnit} onChange={v=>onMeasurementUnitChange(v as MeasurementUnit)}/></label></div>
    <div className="builder-measure-heading"><h3>Measurements</h3><span className="builder-muted"><i/> {size.toUpperCase()} · Unconfirmed</span></div>
    {tablet&&<label className="tablet-measurement-picker">Measurement<BuilderSelect label="Selected measurement" value={selected.id} onChange={value=>onHighlight(value as MeasurementGuideId)} options={NEW_MEASUREMENT_LABELS.map(m=>({value:m.id,label:m.label}))}/></label>}
    {tablet&&<nav className="tablet-measurement-navigation" aria-label="Measurement navigation"><button aria-label="Previous measurement" onClick={()=>advanceMeasurement(-1)}><ChevronLeft size={16}/>Previous</button><span>{selected.label.split('.')[0]} / I</span><button aria-label="Next measurement" onClick={()=>advanceMeasurement(1)}>Next<ChevronRight size={16}/></button></nav>}
    <details ref={coreRef} className="core-measurements-collapse" open><summary>Core measurements</summary><div>
    {NEW_MEASUREMENT_LABELS.filter(m=>!tablet&&!phone||m.id===selected.id).map(m=>{
      const preset=presets[m.id]?.[size]??'0',value=measurements[m.id]?.[size]??preset,diff=value.trim()===''?NaN:Number(value)-Number(preset),open=expanded===m.id;
      const tolerance=getMeasurementTolerance(measurementTolerances,m.id,size);
      const productionRange=getToleranceRange(value,tolerance.valueCm);
      return <section key={m.id} className="new-measure-row" data-selected={selected.id===m.id} data-flash={flash&&selected.id===m.id}>
        <div className="new-measure-main"><button className="new-measure-select" aria-expanded={open} onClick={()=>{onHighlight(m.id);setExpanded(open?null:m.id)}}><span className="builder-measure-letter">{m.label.split('.')[0]}</span><span>{m.label.split('. ')[1]}</span></button>{field(m.id,size,value)}</div>
        <div className="new-measure-source"><span>{value.trim()===''?'Not set':diff===0?((phone||tablet)?(fitChoices.find(f=>f.id===fit)?.name??fit)+' preset':'From preset'):'Custom'}</span><button aria-label={'Expand '+m.label} aria-expanded={open} onClick={()=>{onHighlight(m.id);setExpanded(open?null:m.id)}}>How to measure <ChevronDown size={12} style={{transform:open?'rotate(180deg)':undefined}}/></button></div>
        {open&&<div className="new-measure-help"><div className="new-measure-comparison">{[['Current',value.trim()===''?'—':formatMeasurementDisplay(value,measurementUnit)+' '+unit],['Preset',formatMeasurementDisplay(preset,measurementUnit)+' '+unit],['Difference',Number.isFinite(diff)?(diff>0?'+':'')+formatMeasurementDisplay(String(diff),measurementUnit)+' '+unit:'—']].map(([label,v])=><div className="measurement-meta-cell" key={label}><span>{label}</span><output>{v}</output></div>)}<div className="measurement-meta-cell"><span>Tolerance</span><MeasurementValueField tolerance id={m.id} size={size} value={tolerance.valueCm} unit={measurementUnit} ariaLabel={'Tolerance '+m.label+' '+size.toUpperCase()+' in '+unit} onFocus={()=>onHighlight(m.id)} onCommit={value=>onToleranceChange?.(m.id,tolerance.key,value)}/><small className="tolerance-status">{tolerance.status}</small></div></div><div className="measurement-reset-actions"><button className="builder-link" onClick={()=>onMeasurementChange(m.id,size,preset)}>Reset measurement to preset</button>{tolerance.status!=='Recommended'&&tolerance.recommendedCm!==undefined&&<button className="builder-link" onClick={()=>onToleranceChange?.(m.id,tolerance.key,String(tolerance.recommendedCm))}>Reset tolerance</button>}</div>{productionRange&&<p className="tolerance-production-range">Acceptable range: <output>{formatMeasurementDisplay(String(productionRange.min),measurementUnit)} – {formatMeasurementDisplay(String(productionRange.max),measurementUnit)} {unit}</output></p>}<p>Follow the highlighted {m.label.split('.')[0]} guide on the flat garment.</p></div>}
      </section>
    })}
    </div></details>
  </div>;
  if(!phone)return <>{desktopContent}{tablet&&sheet==='fit'&&<BuilderSheet title="Choose fit" initialSnap="half" onClose={()=>setSheet(null)}>{fitGrid}<p className="fit-change-helper">Changing fit updates preset measurements. Custom overrides are preserved where applicable.</p></BuilderSheet>}</>;
  const value=measurements[selected.id]?.[size]??presets[selected.id]?.[size]??'';
  const select=(id:MeasurementGuideId)=>{onHighlight(id);setExpanded(id);setInspectorSnap('peek');setSheet(null)};
  const advance=(direction:number)=>{const index=NEW_MEASUREMENT_LABELS.findIndex(m=>m.id===selected.id);const id=NEW_MEASUREMENT_LABELS[(index+direction+NEW_MEASUREMENT_LABELS.length)%NEW_MEASUREMENT_LABELS.length].id;onHighlight(id);setExpanded(id)};
  const step=(direction:number)=>{onHighlight(selected.id);onMeasurementChange(selected.id,size,String(Math.max(0,Math.round((Number(value)+direction*.5)*100)/100)))};
  const instructions:Record<string,string>={chestWidth:'Measure flat across the chest, just below the armholes.',halfLength:'Measure from the high shoulder point beside the neck to the bottom hem.',shoulderWidth:'Measure across the back from shoulder seam to shoulder seam.',sleeveLength:'Measure from the shoulder join to the sleeve opening along the outer sleeve.',bottomWidth:'Measure flat across the bottom hem.',sleeveOpening:'Measure flat across the sleeve opening.',neckOpening:'Measure across the neck opening from edge to edge.',neckDrop:'Measure vertically from the shoulder neck level to the lowest neck point.',armhole:'Measure the armhole from the shoulder join to the underarm.'};
  const quickEditor=<div className="phone-dock-editor" key={selected.id}><button aria-label="Decrease measurement" onClick={()=>step(-1)}><Minus size={19}/></button>{field(selected.id,size,value)}<button aria-label="Increase measurement" onClick={()=>step(1)}><Plus size={19}/></button>{inspectorSnap==='peek'?<button className="phone-more" onClick={()=>{setExpanded(selected.id);setInspectorSnap('half')}}>More</button>:<button className="phone-more" onClick={()=>setInspectorSnap(inspectorSnap==='full'?'half':'full')}>{inspectorSnap==='full'?'Less':'Full'}</button>}</div>;
  return <><button className="phone-fit-trigger" onClick={()=>setSheet('fit')}>{fitChoices.find(f=>f.id===fit)?.name??fit}<ChevronDown size={14}/></button>
  {!sheet&&<BuilderSheet title="Measurement inspector" persistent compactHeader snap={inspectorSnap} onSnap={snap=>{if(snap!=='peek')setExpanded(selected.id);setInspectorSnap(snap)}} onClose={()=>setInspectorSnap('peek')}><div className="touch-measurement-navigation" {...swipe}><div className="phone-dock-heading"><button onClick={()=>setSheet('picker')} aria-label="Choose measurement"><span className="builder-measure-letter">{selected.label.split('.')[0]}</span>{selected.label.split('. ')[1]}<ChevronDown size={14}/></button>{onGuidesVisibleChange&&<MeasurementGuidesToggle phone checked={guidesVisible} onChange={onGuidesVisibleChange}/>}<button aria-label={inspectorSnap==='peek'?'Expand measurement details':'Collapse measurement details'} onClick={()=>{setExpanded(selected.id);setInspectorSnap(inspectorSnap==='peek'?'half':'peek')}}><ChevronUp size={18} style={{transform:inspectorSnap==='peek'?undefined:'rotate(180deg)'}}/></button></div>{inspectorSnap!=='peek'&&<MobileSectionTools/>}{quickEditor}
   {inspectorSnap!=='peek'&&<div className="phone-expanded-details"><div className="phone-detail-content">{desktopContent}</div><div className="phone-detail-actions"><button className="builder-link" onClick={()=>setSheet('how')}>How to measure</button>{inspectorSnap==='half'&&<button className="builder-link" onClick={()=>setInspectorSnap('full')}>Notes & more</button>}</div><nav className="phone-measurement-previous-next" aria-label="Measurement navigation"><button onClick={()=>advance(-1)}><ChevronLeft size={16}/> Previous</button><button onClick={()=>advance(1)}>Next <ChevronRight size={16}/></button></nav>{inspectorSnap==='full'&&<label className="phone-measurement-notes">Measurement notes<textarea aria-label="Measurement notes" value={notes??''} onChange={e=>onNotesChange?.(e.target.value)}/></label>}</div>}
  </div></BuilderSheet>}
  {(sheet==='picker'||sheet==='fit'||sheet==='how')&&<BuilderSheet title={sheet==='picker'?'Measurements':sheet==='fit'?'Choose fit':'How to measure'} initialSnap={sheet==='fit'?'half':'full'} onClose={()=>setSheet(null)}>{sheet==='picker'?<div className="responsive-menu">{NEW_MEASUREMENT_LABELS.map(m=><button key={m.id} aria-pressed={selected.id===m.id} onClick={()=>select(m.id)}><span>{m.label}</span><span>{formatMeasurementDisplay(measurements[m.id]?.[size]??presets[m.id]?.[size]??'',measurementUnit)} {unit}</span></button>)}</div>:sheet==='fit'?<>{fitGrid}<p className="fit-change-helper">Changing fit updates preset measurements. Custom overrides are preserved where applicable.</p></>:<><h3>{selected.label.split('. ')[1]}</h3><p>{instructions[selected.id]}</p><p className="builder-muted">Follow the highlighted {selected.label.split('.')[0]} guide on the garment.</p></>}</BuilderSheet>}</>;
}
