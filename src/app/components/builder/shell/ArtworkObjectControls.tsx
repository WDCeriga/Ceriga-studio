import {isFabricArtwork} from '../../../lib/artworkProduction';
import {Eye,EyeOff,Lock,Unlock,FlipHorizontal2,FlipVertical2} from 'lucide-react';
import type {DesignElement} from '../PrintStudioEditor';
import {ArtworkThumbnail} from '../printsStudio/ArtworkThumbnail';
import {useArtwork} from '../printsStudio/ArtworkContext';
import {useAssetWorkspaceContext} from '../printsStudio/AssetWorkspace';
import {usePrintsStudio} from '../printsStudio/PrintsStudioContext';
import type {ArtworkFinish} from '../../../lib/artworkGeometry';
import {artworkSlotKey} from '../../../lib/artworkColourSlots';
import {StudioFold,StudioNumber,StudioPaint,StudioRange} from './StudioControls';
import {MaterialSelect} from './MaterialSelect';
import {PrintWearControls} from './PrintWearControls';
import {TextileInkControls} from './TextileInkControls';

type Props={element:DesignElement;update:(patch:Partial<DesignElement>)=>void};
export function ArtworkObjectIdentity({element,update}:Props){return <div className="studio-object-identity"><span className="studio-layer-thumb"><ArtworkThumbnail element={element}/></span><div style={{flex:1,minWidth:0}}><input aria-label="Artwork layer name" placeholder={element.type==='text'?element.content:'Name this artwork'} value={element.layerName??''} onChange={event=>update({layerName:event.target.value||undefined})}/><small>{element.type==='drawing'?(element.sketchOnly?'Sketch':'Drawing'):element.logoTrace?'Trace':element.type==='customArea'?'Path':element.type.charAt(0).toUpperCase()+element.type.slice(1)}</small></div><button aria-label={element.hidden?'Show artwork':'Hide artwork'} onClick={()=>update({hidden:!element.hidden})}>{element.hidden?<EyeOff size={15}/>:<Eye size={15}/>}</button><button aria-label={element.locked?'Unlock artwork':'Lock artwork'} onClick={()=>update({locked:!element.locked})}>{element.locked?<Lock size={16}/>:<Unlock size={16}/>}</button></div>;}
export function ArtworkTransformFields({element,update}:Props){
 const studio=usePrintsStudio(),units=studio.unitsPerCm,origin={x:studio.printArea.x+studio.printArea.width/2,y:studio.printArea.y};
 return <StudioFold title="Position & size" rowHeight={40}><fieldset disabled={element.locked}>
 <div className="studio-two-columns">{(['x','y','width','height'] as const).map(key=><StudioNumber key={key} label={{x:'X',y:'Y',width:'Width',height:'Height'}[key]} unit="cm" min={key==='width'||key==='height'?.01:-200} max={200} step={.01} value={(element[key]-(key==='x'?origin.x:key==='y'?origin.y:0))/units} onChange={value=>update({[key]:value*units+(key==='x'?origin.x:key==='y'?origin.y:0),...(element.aspectLocked&&key==='width'?{height:element.height*value*units/element.width}:element.aspectLocked&&key==='height'?{width:element.width*value*units/element.height}:{})})}/>)}</div>
 <StudioNumber label="Rotation" unit="°" min={-360} max={360} value={element.rotation} onChange={rotation=>update({rotation})}/><label className="studio-switch">Lock ratio<input type="checkbox" checked={element.aspectLocked??false} onChange={event=>update({aspectLocked:event.target.checked})}/></label>
 <div className="path-workflow-actions"><button onClick={()=>update({flipHorizontal:!element.flipHorizontal})}><FlipHorizontal2 size={14}/>Flip H</button><button onClick={()=>update({flipVertical:!element.flipVertical})}><FlipVertical2 size={14}/>Flip V</button></div>
 </fieldset></StudioFold>;
}
export function ArtworkColourSlots({element,update}:Props){
 const context=useArtwork(),workspace=useAssetWorkspaceContext(),slots=element.colourSlots??[];
 return <>{slots.map(slot=>{const key=artworkSlotKey(element.id,slot.id),swatch=!workspace?.project?context?.overrides[key]??slot.swatch:slot.swatch;const change=(hex:string,reference?:string)=>{if(!workspace?.project&&context?.colourwayId)context.onOverrides({...context.overrides,[key]:{hex,reference}});else update({colourSlots:slots.map(item=>item.id===slot.id?{...item,swatch:{hex,reference}}:item)})};return <StudioPaint key={slot.id} label={slot.name} value={swatch.hex} allowGradients={false} onChange={hex=>change(hex)} onReference={(reference,hex)=>change(hex??swatch.hex,reference)}/>})}</>;
}
export const ARTWORK_FINISHES:ArtworkFinish['type'][]=['Puff','Foil','Flock','Reflective','Glitter','Rubber patch','Woven patch','Embroidery'];
export function ArtworkFinishControls({element,update}:Props){
 const finish=element.artworkFinish,workspace=useAssetWorkspaceContext(),studio=usePrintsStudio(),units=studio.unitsPerCm;
 if(isFabricArtwork(element))return <p className="typography-help">Fabric fill uses printed garment material. Apply raised or applied finishes to placed artwork.</p>;
 return <><label className="studio-field">Finish<MaterialSelect aria-label="Artwork finish" value={finish?.type??''} onChange={event=>{const type=event.target.value as ArtworkFinish['type'];update({artworkUnitsPerCm:units,artworkFinish:type?{type,...(['Puff','Flock','Rubber patch'].includes(type)?{heightMm:type==='Puff'?.5:1}:{}),...(type==='Embroidery'?{thread:'Polyester'}:{}),...(type.includes('patch')?{widthCm:element.width/units,heightCm:element.height/units,attachment:'Sew on'}:{}),...(['Foil','Reflective'].includes(type)?{colour:'#b8b8b8'}:{})}:undefined});}}><option value="">Standard ink</option>{ARTWORK_FINISHES.map(type=><option key={type}>{type}</option>)}</MaterialSelect></label>
 {finish&&['Puff','Flock','Rubber patch'].includes(finish.type)&&<StudioNumber label={finish.type==='Puff'?'Puff height':finish.type==='Flock'?'Pile height':'Patch thickness'} unit="mm" min={.1} max={5} value={finish.heightMm??.5} onChange={heightMm=>update({artworkFinish:{...finish,heightMm}})}/>}
 {finish?.type==='Embroidery'&&<label className="studio-field">Thread<MaterialSelect aria-label="Embroidery thread" value={finish.thread??'Polyester'} onChange={event=>update({artworkFinish:{...finish,thread:event.target.value}})}>{['Polyester','Rayon','Cotton','Metallic'].map(thread=><option key={thread}>{thread}</option>)}</MaterialSelect></label>}
 {finish?.type.includes('patch')&&<div className="studio-two-columns"><StudioNumber label="Patch width" unit="cm" min={.1} max={100} value={element.width/units} onChange={widthCm=>{const ratio=widthCm*units/element.width;update({width:widthCm*units,...(element.aspectLocked?{height:element.height*ratio}:{}),...(element.type==='text'?{fontSize:(element.fontSize??30)*ratio}:{}),artworkFinish:{...finish,widthCm}})}}/><StudioNumber label="Patch height" unit="cm" min={.1} max={100} value={element.height/units} onChange={heightCm=>{const ratio=heightCm*units/element.height;update({height:heightCm*units,...(element.aspectLocked?{width:element.width*ratio}:{}),...(element.type==='text'?{fontSize:(element.fontSize??30)*ratio}:{}),artworkFinish:{...finish,heightCm}})}}/></div>}
 {finish?.type==='Glitter'&&<StudioNumber label="Glitter particle size" unit="mm" min={.01} max={1} step={.01} value={finish.particleMm??.1} onChange={particleMm=>update({artworkFinish:{...finish,particleMm}})}/>}
 {finish?.type==='Flock'&&<label className="studio-field">Fibre<MaterialSelect value={finish.material??'Nylon'} onChange={event=>update({artworkFinish:{...finish,material:event.target.value}})}>{['Nylon','Rayon','Polyester'].map(value=><option key={value}>{value}</option>)}</MaterialSelect></label>}
 {finish?.type==='Foil'&&<label className="studio-field">Foil<MaterialSelect value={finish.style??'Polished'} onChange={event=>update({artworkFinish:{...finish,style:event.target.value}})}>{['Polished','Brushed','Holographic'].map(value=><option key={value}>{value}</option>)}</MaterialSelect></label>}
 {finish?.type==='Reflective'&&<label className="studio-field">Material reference<input value={finish.material??''} onChange={event=>update({artworkFinish:{...finish,material:event.target.value}})} placeholder="Factory material reference"/></label>}
 {finish?.type.includes('patch')&&<label className="studio-field">Attachment<MaterialSelect value={finish.attachment??'Sew on'} onChange={event=>update({artworkFinish:{...finish,attachment:event.target.value}})}>{['Sew on','Heat seal','Adhesive'].map(value=><option key={value}>{value}</option>)}</MaterialSelect></label>}
 {finish?.type==='Woven patch'&&<label className="studio-field">Edge<MaterialSelect value={finish.edge??'Merrowed'} onChange={event=>update({artworkFinish:{...finish,edge:event.target.value}})}>{['Merrowed','Laser cut','Turned edge'].map(value=><option key={value}>{value}</option>)}</MaterialSelect></label>}
 {finish&&['Embroidery','Rubber patch','Woven patch'].includes(finish.type)&&!workspace?.project&&<p className="typography-help">Included in garment components.</p>}
 {finish&&['Foil','Flock','Reflective','Glitter'].includes(finish.type)&&<StudioPaint label="Finish colour" value={finish.colour??element.color??'#737373'} allowGradients={false} onChange={colour=>update({artworkFinish:{...finish,colour}})}/>}
 <TextileInkControls element={element} update={update}/><PrintWearControls element={element} update={update}/>
 </>;
}
