import type {DesignElement} from '../PrintStudioEditor';
import {describeStudioArtwork} from '../../../lib/studioArtwork';
import {artworkColours} from '../../../lib/artworkColourSlots';
import {ArtworkThumbnail} from '../printsStudio/ArtworkThumbnail';
import {ArtworkFontChecks} from './ArtworkFontChecks';
import {ReviewFacts} from './BuilderReview';
export function ArtworkReview({elements,onShow}:{elements:DesignElement[];onShow?:()=>void}){
 const items=elements.filter(element=>!element.hidden&&!element.sketchOnly&&!element.tracingReference&&element.type!=='distress');
 if(!items.length)return <p className="review-empty">No production artwork added.</p>;
 return <div className="review-list">{items.map(element=><section className="review-item" key={element.id}><h3>{describeStudioArtwork(element)}</h3><div style={{height:150,position:'relative'}}><ArtworkThumbnail element={element}/></div><ReviewFacts rows={[{label:'Side',value:element.side??'front'},{label:'Method',value:element.printMethod??'DTG'},{label:'Size',value:`${(element.width/(element.artworkUnitsPerCm??10)).toFixed(1)} × ${(element.height/(element.artworkUnitsPerCm??10)).toFixed(1)} cm`},{label:'Colours',value:artworkColours(element).join(', ')},{label:'Finish',value:element.artworkFinish?.type??'Standard ink'}]}/><ArtworkFontChecks elements={[element]}/></section>)}{onShow&&<button className="studio-outline-action" onClick={onShow}>Edit artwork</button>}</div>;
}
