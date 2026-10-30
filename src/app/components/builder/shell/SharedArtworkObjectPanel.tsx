import {ArtworkPrintMethod} from './ArtworkPrintMethod';
import {artworkColours} from '../../../lib/artworkColourSlots';
import {expandShapeAppearance} from '../../../lib/shapeAppearance';
import {useCanonicalArtworkElements} from '../printsStudio/ArtworkContext';
import {useAssetWorkspaceContext} from '../printsStudio/AssetWorkspace';
import type {ReactNode} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
import {usePrintsStudio} from '../printsStudio/PrintsStudioContext';
import {ArtworkObjectIdentity,ArtworkTransformFields,ArtworkColourSlots,ArtworkFinishControls} from './ArtworkObjectControls';
import {ArtworkClipControls} from './ArtworkClipControls';
import {StudioFold,StudioPaint,StudioRange} from './StudioControls';
import {TextAppearanceControls} from './TextAppearanceControls';
import {shapeAppearance} from '../../../lib/shapeAppearance';
import {MaterialSelect} from './MaterialSelect';
export function SharedArtworkObjectPanel({element,update,children}:{element:DesignElement;update:(patch:Partial<DesignElement>)=>void;children:ReactNode}){
 const workspace=useAssetWorkspaceContext(),canonical=useCanonicalArtworkElements([element],!workspace?.project)[0],studio=usePrintsStudio(),units=studio.unitsPerCm,type=element.logoTrace?'Trace':element.type==='customArea'?'Path':element.type==='drawing'?'Sketch':element.type.charAt(0).toUpperCase()+element.type.slice(1),nativeShape=element.type==='shape'&&!element.shapeBrush;
 return <div className="studio-object-panel" data-shared-object-inspector>
 <ArtworkObjectIdentity element={element} update={update}/>
 {element.sketchOnly&&<button className="studio-outline-action" onClick={()=>update({sketchOnly:false})}>Use as artwork</button>}
 <ArtworkPrintMethod element={element} update={update} initiallyOpen/>
 <ArtworkTransformFields element={element} update={update}/>
 <StudioFold title="Appearance" rowHeight={40} value={`${artworkColours(element).length} colours`}><fieldset disabled={element.locked}>
 {nativeShape?<><TextAppearanceControls element={{...element,textUnitsPerCm:units,textAppearance:shapeAppearance(element,units)}} update={patch=>update({...('textAppearance'in patch?{artworkAppearance:patch.textAppearance,textUnitsPerCm:units}:{}),...('opacity'in patch?{opacity:patch.opacity}:{})})}/><label className="studio-field">Stroke cap<MaterialSelect aria-label="Stroke cap" value={element.shapeStrokeCap??'round'} onChange={event=>update({shapeStrokeCap:event.target.value as DesignElement['shapeStrokeCap']})}>{['round','butt','square'].map(cap=><option key={cap}>{cap}</option>)}</MaterialSelect></label>{element.artworkAppearance&&<button className="studio-outline-action" onClick={()=>update(expandShapeAppearance({...canonical,textUnitsPerCm:units},true))}>Expand appearance</button>}<StudioFold title="Colourway inks" rowHeight={40}><ArtworkColourSlots element={element} update={update}/></StudioFold></>:<><ArtworkColourSlots element={element} update={update}/>{!element.colourSlots?.length&&element.type!=='image'&&<StudioPaint label="Ink colour" value={element.color??'#171717'} onChange={color=>update({color})}/>}<StudioRange label="Opacity" value={element.opacity??100} onChange={opacity=>update({opacity})}/></>}
 <ArtworkClipControls element={element} update={update}/>
 </fieldset></StudioFold>
 <StudioFold title="Finish" rowHeight={40} value={element.artworkFinish?.type??'Standard ink'}><fieldset disabled={element.locked}><ArtworkFinishControls element={element} update={update}/></fieldset></StudioFold>
 <StudioFold key={`${element.id}:${studio.pathEditingId===element.id}`} title={type} rowHeight={40} value={element.shapePath?`${element.shapePath.nodes.length} points`:undefined} open={studio.pathEditingId===element.id||element.type==='image'}>{children}</StudioFold>

 </div>;
}
