import {createContext,useContext,useState,useEffect} from 'react';
import {distressedHemEdge} from '../../../data/distressedHem';
import {resolveHemSettings,type HemSettings,type TshirtHemStyles} from '../../../data/tshirtHemStyles';
import {MaterialSelect} from './MaterialSelect';
import {StudioRange} from './StudioControls';
export type HemWearBinding={region?:string;regionIds?:string[];styles?:TshirtHemStyles;update:(styles:TshirtHemStyles)=>void;request:number;onHem?:()=>void};
export const HemWearContext=createContext<HemWearBinding|null>(null);
export const useHemWear=()=>useContext(HemWearContext);
const presets=[{name:'Lightly worn',amount:26,depth:25,fray:40},{name:'Worn hem',amount:58,depth:65,fray:75},{name:'Torn & frayed',amount:83,depth:88,fray:95}];
export function HemEdgeSample({amount,depth,fray}:{amount:number;depth:number;fray:number}){
 const edge=distressedHemEdge(10,210,75,amount,depth,fray,31);
 return <svg viewBox="0 0 220 115" aria-hidden="true"><path d={'M10 10H210L'+edge.points.slice().reverse().map(p=>p.x+','+p.y).join('L')+'Z'+edge.holes.map(r=>'M'+r.map(p=>p.x+','+p.y).join('L')+'Z').join('')} fillRule="evenodd" fill="#ded8c5" stroke="#9a9381" strokeWidth=".65"/><path d={'M'+edge.roll.map(p=>p.x+','+p.y).join('L')} fill="none" stroke="#aaa18d" strokeWidth="1.5" opacity=".4"/><path d={[...edge.bridges,...edge.fibers].join(' ')} fill="none" stroke="#aaa18d" strokeWidth=".7"/></svg>;
}
export function HemDistressControls({binding}:{binding:HemWearBinding}){
 const [region,setRegion]=useState(binding.region??'bodyHem');
 useEffect(()=>setRegion(binding.region??'bodyHem'),[binding.request]);
 const regions=[['bodyHem','Body hem'],['sleeveHemLeft','Left sleeve hem'],['sleeveHemRight','Right sleeve hem'],['underlayerHemLeft','Left under-sleeve hem'],['underlayerHemRight','Right under-sleeve hem']].filter(([id])=>!binding.regionIds||binding.regionIds.includes(id));
 const settings=resolveHemSettings(binding.styles,region),enabled=settings.construction==='distressed';
 const change=(patch:HemSettings)=>binding.update({...binding.styles,editing:{...binding.styles?.editing,applyAll:false,regions:{...binding.styles?.editing?.regions,[region]:{...settings,construction:'distressed',finish:'normal',stitchStyle:'none',...patch}}}});
 const amount=settings.distressAmount??58,depth=settings.distressDepth??65,fray=settings.frayAmount??75;
 return <section className="hem-wear-editor"><div className="wear-section-heading"><h3>Hem distressing</h3><span>{regions.find(r=>r[0]===region)?.[1]}</span></div><label className="surface-field">Hem<MaterialSelect aria-label="Distressed hem region" value={region} onChange={event=>setRegion(event.target.value)}>{regions.map(([id,name])=><option key={id} value={id}>{name}</option>)}</MaterialSelect></label><p className="wear-help">Wear the selected edge and add loose fibres. Sleeve hems follow their own angle; layered sleeves can be edited separately.</p><div className="hem-wear-presets" role="group" aria-label="Distressed hem presets">{presets.map(p=><button key={p.name} aria-pressed={enabled&&amount===p.amount&&depth===p.depth&&fray===p.fray} onClick={()=>change({distressAmount:p.amount,distressDepth:p.depth,frayAmount:p.fray,distressSeed:31})}><HemEdgeSample {...p}/><span>{p.name}</span></button>)}</div>{!enabled?<button className="studio-outline-action" onClick={()=>change({distressAmount:58,distressDepth:65,frayAmount:75,distressSeed:31})}>Apply worn hem</button>:<><div className="hem-wear-live"><HemEdgeSample amount={amount} depth={depth} fray={fray}/></div><StudioRange label="Uneven edge" value={amount} onChange={distressAmount=>change({distressAmount})}/><StudioRange label="Tear depth" value={depth} onChange={distressDepth=>change({distressDepth})}/><StudioRange label="Loose fibres" value={fray} onChange={frayAmount=>change({frayAmount})}/><button className="studio-outline-action" onClick={()=>change({distressSeed:(settings.distressSeed??31)+1})}>Vary tear layout</button><button className="hem-text-action" onClick={()=>change({construction:'raw'})}>Restore clean edge</button></>}{binding.onHem&&<button className="hem-text-action" onClick={binding.onHem}>Back to hem construction ↗</button>}</section>;
}
