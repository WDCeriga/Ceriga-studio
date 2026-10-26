import type {DesignElement} from '../PrintStudioEditor';
import {imageFilterControls,type ImageFilterSettings} from '../../../lib/imageFilters';
import {StudioFold,StudioNumber,StudioPaint} from './StudioControls';
export function InkExtractionControls({element,update}:{element:DesignElement;update:(patch:Partial<DesignElement>)=>void}){
 const options=[['extract-light','Light ink'],['extract-dark','Dark ink'],['remove-colour','Remove colour']] as const;
 const selected=options.some(([id])=>id===element.imageFilter?.id)?element.imageFilter:undefined;
 const change=(key:string,value:string|number)=>update({imageFilter:{...selected!,[key]:value}});
 return <StudioFold title="Extract print from image" hint="Remove a photo background without flattening the source"><div className="typography-segments">{options.map(([id,name])=><button key={id} aria-label={name+' extraction'} aria-pressed={selected?.id===id} onClick={()=>update({imageFilter:{id,intensity:100}})}>{name}</button>)}</div>{selected&&<><p className="typography-help">Crop around the graphic first. Removed areas become transparent so the garment fabric shows through.</p>{imageFilterControls(selected.id).map(c=>c.type==='color'?<StudioPaint key={c.key} label={c.label} allowGradients={false} value={String(selected[c.key as keyof ImageFilterSettings]??c.default)} onChange={v=>change(c.key,v)}/>:<StudioNumber key={c.key} label={c.label} value={Number(selected[c.key as keyof ImageFilterSettings]??c.default)} min={c.min} max={c.max} step={c.step} unit="" onChange={v=>change(c.key,v)}/>)}<button className="studio-outline-action" onClick={()=>update({imageFilter:undefined})}>Restore original image</button></>}</StudioFold>;
}
