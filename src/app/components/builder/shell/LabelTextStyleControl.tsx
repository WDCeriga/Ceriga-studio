import {useEffect,useState} from 'react';
import {MaterialSelect} from './MaterialSelect';
import {readTextStyles} from '../../../lib/textStyles';
import {workspaceFonts} from '../../../lib/workspaceFonts';
import {loadFontLibrary} from '../printsStudio/designLibrary';
import {labelBlocks,type GarmentLabel,type LabelBlockKey} from '../../../data/garmentLabels';
export function LabelTextStyleControl({label,blockKey,update}:{label:GarmentLabel;blockKey:LabelBlockKey;update:(patch:Partial<GarmentLabel>)=>void}){
 const [styles,setStyles]=useState(readTextStyles);useEffect(()=>{const refresh=()=>setStyles(readTextStyles());window.addEventListener('ceriga-text-styles-change',refresh);window.addEventListener('ceriga-font-library-change',refresh);return()=>{window.removeEventListener('ceriga-text-styles-change',refresh);window.removeEventListener('ceriga-font-library-change',refresh)}},[]);
 if(!styles.length)return null;const block=labelBlocks(label).find(block=>block.key===blockKey);
 return <label className="label-field">Text style<MaterialSelect aria-label={`${blockKey} text style`} value={block?.textStyle?.id??''} onChange={event=>{const style=styles.find(style=>style.id===event.target.value);if(!style)return;const values=style.values,font=values.fontFamily??'Inter',savedFont=workspaceFonts().find(item=>item.id===values.fontId),file=savedFont?.embeddingRestricted?undefined:savedFont?.dataUrl??loadFontLibrary().find(item=>item.family===font)?.dataUrl;update({blocks:labelBlocks(label).map(block=>block.key===blockKey?{...block,textStyle:structuredClone(style),font,fontData:file,fontSizeMm:(values.fontSize??30)*10/(values.textUnitsPerCm??30),fontWeight:values.fontWeight==='bold'?700:values.fontWeight==='normal'?400:savedFont?.weight??(['Inter','Montserrat','Poppins'].includes(font)?600:400),fontStyle:values.fontStyle,letterSpacingMm:(values.letterSpacing??0)*10/(values.textUnitsPerCm??30),lineSpacing:values.lineSpacing??115,color:values.textAppearance?.find(item=>item.type==='fill')?.colour??block.color}:block)});}}><option value="">Custom</option>{styles.map(style=><option key={style.id} value={style.id}>{style.name}</option>)}</MaterialSelect></label>;
}
