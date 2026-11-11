import {ArtworkInteractionContext} from '../printsStudio/ArtworkInteractionContext';
import {Check} from 'lucide-react';
import type {DesignElement} from '../PrintStudioEditor';
import {ArtworkThumbnail} from '../printsStudio/ArtworkThumbnail';
import {VECTOR_LOOKS,type VectorEffects} from '../../../lib/vectorEffects';
import {StudioFold,StudioRange} from './StudioControls';
export function VectorEffectsPanel({element,update}:{element:DesignElement;update:(patch:Partial<DesignElement>)=>void}){
 const settings=element.vectorEffects,preset=settings?.preset??'none';
 const change=(patch:Partial<VectorEffects>)=>update({vectorEffects:{preset,...settings,...patch}});
 return <StudioFold title="Artwork effects" value={VECTOR_LOOKS.find(look=>look.id===preset)?.label??'Original'}>
  <fieldset disabled={element.locked} className="vector-effect-controls">
   <div className="artwork-look-grid vector-look-grid" role="group" aria-label="Artwork effect presets">
    {VECTOR_LOOKS.map(look=><button key={look.id} type="button" aria-label={`Apply ${look.label} artwork effect`} aria-pressed={preset===look.id} onClick={()=>change({preset:look.id})}>
     <div className="vector-look-preview"><ArtworkInteractionContext.Provider value={true}><ArtworkThumbnail element={{...element,vectorEffects:{preset:look.id,strength:100}}}/></ArtworkInteractionContext.Provider></div>
     <span>{look.label}{preset===look.id&&<Check size={11}/>}</span>
    </button>)}
   </div>
   {preset!=='none'&&<StudioRange label="Effect strength" value={settings?.strength??100} onChange={strength=>change({strength})}/>}
   <StudioFold title="Light & colour"><StudioRange label="Brightness" value={settings?.brightness??100} min={0} max={200} onChange={brightness=>change({brightness})}/><StudioRange label="Contrast" value={settings?.contrast??100} min={0} max={200} onChange={contrast=>change({contrast})}/><StudioRange label="Saturation" value={settings?.saturation??100} min={0} max={200} onChange={saturation=>change({saturation})}/><StudioRange label="Hue" value={settings?.hue??0} min={-180} max={180} unit="°" onChange={hue=>change({hue})}/></StudioFold>
   {settings&&<button className="studio-outline-action" onClick={()=>update({vectorEffects:undefined})}>Reset artwork effects</button>}
  </fieldset>
 </StudioFold>;
}
