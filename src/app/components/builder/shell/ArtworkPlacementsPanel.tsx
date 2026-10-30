import {artworkColours} from '../../../lib/artworkColourSlots';
import {ArtworkFactoryProfileControls} from './ArtworkFactoryProfileControls';
import {Plus,ArrowLeft,Copy,Trash2} from 'lucide-react';
import {useState} from 'react';
import {useArtworkPlacements,updatePlacement} from '../printsStudio/ArtworkPlacementsContext';
import {PLACEMENT_PRESETS,createArtworkPlacement,placementBounds,type ArtworkMethod} from '../../../lib/artworkPlacements';
import {duplicateStudioArtwork} from '../../../lib/studioArtwork';
import {ArtworkThumbnail} from '../printsStudio/ArtworkThumbnail';
import {StudioFold,StudioNumber} from './StudioControls';
import {MaterialSelect} from './MaterialSelect';
import {placementChecks,placementStatus} from '../../../lib/artworkPlacementChecks';

export function ArtworkPlacementsPanel(){
 const context=useArtworkPlacements(),[adding,setAdding]=useState(false),[preset,setPreset]=useState('centre-chest');
 if(!context)return <p className="typography-help">Placements are available on a garment. Build your reusable asset with the design tools.</p>;
 const document=context.document,placement=document.placements.find(item=>item.id===context.selectedId),profile=document.factoryProfile;
 const change=(patch:Parameters<typeof updatePlacement>[2])=>placement&&updatePlacement(context,placement.id,patch);
 const add=()=>{const created=createArtworkPlacement(preset,profile?.methods[0]?.method??'DTG');context.onDocument({...document,placements:[...document.placements,created]});context.select(created.id,true);context.onSide(created.side);setAdding(false)};
 return <div className="studio-object-panel" data-placements-panel>
 {!placement&&<ArtworkFactoryProfileControls key={profile?.id??'none'}/>}
 {placement?<>
  <button className="studio-outline-action" onClick={()=>context.select(null,true)}><ArrowLeft size={14}/>All placements</button>
  <label className="studio-field">Name<input aria-label="Placement name" value={placement.name} onChange={event=>change({name:event.target.value})}/></label>
  <StudioFold title="Print area" rowHeight={40} value={`${placement.printArea.width} × ${placement.printArea.height} cm`} open><div className="studio-two-columns">{(['width','height'] as const).map(key=><StudioNumber key={key} label={`Print area ${key}`} unit="cm" min={.1} max={200} value={placement.printArea[key]} onChange={value=>change({printArea:{...placement.printArea,[key]:value}})}/>)}</div></StudioFold>
  <StudioFold title="Position" rowHeight={40} value={`${placement.position.fromHPS} cm from shoulder`}><div className="studio-two-columns"><StudioNumber label="From shoulder point" unit="cm" min={-50} max={200} value={placement.position.fromHPS} onChange={fromHPS=>change({position:{...placement.position,fromHPS}})}/><StudioNumber label="From centre front" unit="cm" min={-100} max={100} value={placement.position.fromCentreFront} onChange={fromCentreFront=>change({position:{...placement.position,fromCentreFront}})}/></div><label className="studio-field">Side<MaterialSelect aria-label="Placement side" value={placement.side} onChange={event=>{const side=event.target.value as 'front'|'back';context.onCommit(context.sourceElements.map(element=>element.placementId===placement.id?{...element,side}:element),{...document,placements:document.placements.map(item=>item.id===placement.id?{...item,side,zone:item.zone==='front'||item.zone==='back'?side:item.zone}:item)});context.onSide(side);}}><option value="front">Front</option><option value="back">Back</option></MaterialSelect></label></StudioFold>
  <StudioFold title="Method" rowHeight={40} value={placement.method}><label className="studio-field">Production method<MaterialSelect aria-label="Placement production method" value={placement.method} onChange={event=>change({method:event.target.value as ArtworkMethod})}>{[...new Set([placement.method,...(profile?.methods.map(item=>item.method)??['Screen Print','DTG','Embroidery','Heat Transfer','Sublimation','Fabric Print','DTF','Puff Print'])])].map(method=><option key={method}>{method}</option>)}</MaterialSelect></label></StudioFold>
  <StudioFold title="Colour limit" rowHeight={40} value={placement.maxColours===undefined?'Factory to confirm':`${placement.maxColours} colours`}><p className="typography-help">{profile?`${profile.name}: ${placement.maxColours===undefined?'no colour limit supplied':placement.maxColours+' colours'}`:'Connect a factory profile to apply its colour limits and production tolerances.'}</p></StudioFold>
  <StudioFold title="Mirror to other side" rowHeight={40}><button className="studio-outline-action" onClick={()=>mirrorPlacement(context,placement.id)}><Copy size={14}/>Mirror placement and artwork</button></StudioFold>
  <StudioFold title="Checks" rowHeight={40} value={placementStatus(placement,context.elements,document,context.measurements)??'Ready'}>{placementChecks(placement,context.elements,document,context.measurements).map(check=><div className="review-note" key={check.id}><p><strong>{check.kind}</strong> {check.message}</p><button className="studio-outline-action" onClick={()=>{context.select(placement.id,true);if(check.artworkId)context.onSelectArtwork(check.artworkId)}}>Show me</button></div>)}</StudioFold>
  <button className="studio-outline-action" disabled={placement.artworks.length>0} title={placement.artworks.length?'Move artwork to another placement before removing this area':'Remove empty placement'} onClick={()=>{context.onDocument({...document,placements:document.placements.filter(item=>item.id!==placement.id)});context.select(null)}}><Trash2 size={14}/>Remove placement</button>
 </>:<>
  {document.placements.map(item=>{const artworks=context.elements.filter(element=>element.placementId===item.id&&!element.hidden),status=placementStatus(item,context.elements,document,context.measurements),colours=new Set(artworks.flatMap(artworkColours)).size;return <button className="studio-object-identity studio-outline-action" key={item.id} aria-label={`Edit placement ${item.name}`} onClick={()=>context.select(item.id,true)} style={{minHeight:56,width:'100%',justifyContent:'flex-start',textAlign:'left'}}>{artworks[0]?<span className="studio-layer-thumb"><ArtworkThumbnail element={artworks[0]}/></span>:<Plus size={18}/>}<span style={{flex:1}}><strong>{item.side==='back'?'Back, ':item.zone.includes('sleeve')?'':'Front, '}{item.name.toLowerCase()}</strong><small>{item.printArea.width} × {item.printArea.height} cm · {item.method} · {colours} colours</small></span>{status&&<span className="material-caption">{status}</span>}</button>})}
  {!document.placements.length&&<p className="typography-help">Add a print area, then create or import artwork.</p>}
  <button className="studio-outline-action" onClick={()=>setAdding(value=>!value)}><Plus size={15}/>Add placement</button>
  {adding&&<><label className="studio-field">Preset<MaterialSelect aria-label="Placement preset" value={preset} onChange={event=>setPreset(event.target.value)}>{PLACEMENT_PRESETS.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</MaterialSelect></label><button className="studio-outline-action" onClick={add}>Add print area</button></>}
 </>}
 </div>;
}
export function mirrorPlacement(context:NonNullable<ReturnType<typeof useArtworkPlacements>>,id:string){
 const source=context.document.placements.find(item=>item.id===id);if(!source)return;
 const sleeve=source.zone.includes('sleeve'),side=sleeve?source.side:source.side==='front'?'back':'front',zone=sleeve?source.zone==='left sleeve'?'right sleeve':'left sleeve':side,target={...source,id:crypto.randomUUID(),name:source.name+' mirror',zone,side,position:{...source.position,fromCentreFront:-source.position.fromCentreFront},artworks:[]} as typeof source;
 const copies=context.sourceElements.filter(element=>element.placementId===id).map(element=>({...duplicateStudioArtwork(element),placementId:target.id,side,x:context.document.origin.x*2-element.x,y:element.y,flipHorizontal:!element.flipHorizontal}));
 // One document mutation is committed with the duplicated native artwork by the provider's caller.
 context.onCommit([...context.sourceElements,...copies],{...context.document,placements:[...context.document.placements,target]},copies[0]?.id);context.select(target.id,true);context.onSide(target.side);
}
