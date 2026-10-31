import {useContext} from 'react';
import {ArtworkSurfaceContext} from '../printsStudio/ArtworkSurfaceContext';
import type {DesignElement} from '../PrintStudioEditor';
import {StudioFold} from './StudioControls';
import {MaterialSelect} from './MaterialSelect';
export function SurfaceColourLinks({element,update}:{element:DesignElement;update:(patch:Partial<DesignElement>)=>void}){
 const value=useContext(ArtworkSurfaceContext),colours=value?.surface.colours;if(!colours)return null;
 return <StudioFold title="Colour links" rowHeight={40} value={colours[element.surfaceColourLinks?.fill??'']?.name??'Custom'}>{(['fill','stroke'] as const).map(key=><label className="studio-field" key={key}>{key==='fill'?'Fill / text':'Outline'}<MaterialSelect value={element.surfaceColourLinks?.[key]??''} onChange={event=>update({surfaceColourLinks:{...element.surfaceColourLinks,[key]:event.target.value||undefined}})}><option value="">Custom</option>{Object.entries(colours).map(([id,colour])=><option key={id} value={id}>{colour.name} · linked</option>)}</MaterialSelect></label>)}</StudioFold>;
}
