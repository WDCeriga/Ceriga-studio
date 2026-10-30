import {useState} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
import {usePrintsStudio} from '../printsStudio/PrintsStudioContext';
import {PatternGraphic} from '../printsStudio/PatternGraphic';
import {StudioFold,StudioNumber} from './StudioControls';
import {repeatTileGeometry,repeatCheckKey,checkRepeatSeam} from '../../../lib/patternPhysical';
export function RepeatSizeControls({element,update}:{element:DesignElement;update:(patch:Partial<DesignElement>)=>void}){
 const studio=usePrintsStudio(),[busy,setBusy]=useState(false),[error,setError]=useState(''),tile=repeatTileGeometry(element),units=element.artworkUnitsPerCm??element.textUnitsPerCm??studio.unitsPerCm,physical=element.patternTileCm??{width:tile.width/units,height:tile.height/units},check=element.patternSeamCheck?.sourceKey===repeatCheckKey(element)?element.patternSeamCheck:null;
 return <><StudioFold title="Repeat size" rowHeight={40} value={`${physical.width.toFixed(1)} × ${physical.height.toFixed(1)} cm`}><div className="studio-two-columns">{(['width','height'] as const).map(axis=><StudioNumber key={axis} label={`Tile ${axis}`} unit="cm" min={.1} max={200} value={physical[axis]} onChange={value=>{const ratio=value/physical[axis];update({patternTileCm:{width:physical.width*ratio,height:physical.height*ratio},artworkUnitsPerCm:units})}}/>)}</div></StudioFold>
 <StudioFold title="Coverage preview" rowHeight={40} value="3 × 3 tiles"><div className="pattern-editor-preview"><PatternGraphic element={{...element,width:physical.width*units*3,height:physical.height*units*3,artworkUnitsPerCm:units,patternTileCm:physical}}/></div></StudioFold>
 <StudioFold title="Seamless check" rowHeight={40} value={check?check.status==='pass'?'Pass':'Risk':'Not checked'}>{check&&<p className="typography-help">{check.message}</p>}<button className="studio-outline-action" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{update({patternSeamCheck:await checkRepeatSeam(element)})}catch{setError('Could not inspect this source. Upload the image locally to check its edges.')}finally{setBusy(false)}}}>{busy?'Checking…':'Check repeat edges'}</button>{error&&<p role="alert" className="pen-inline-error">{error}</p>}</StudioFold></>;
}
