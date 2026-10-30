import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {fontWorkspaceScope} from './workspaceFonts';
import {textAppearance} from './textAppearance';
export type SavedTextStyle={id:string;name:string;updatedAt:string;values:Partial<DesignElement>};
const keys=['fontFamily','fontId','fontPostscriptName','fontDisplayName','fontWeight','fontStyle','fontAxes','fontFeatures','fontSize','letterSpacing','lineSpacing','textWordSpacing','textKerning','textKerningMode','textUnitsPerCm','textHeightCm','textCapHeightCm','textAppearance','textUnderline','textStrikethrough','textAlign','textTransform'] as const;
export function textStyleValues(element:DesignElement){return structuredClone({...Object.fromEntries(keys.map(key=>[key,element[key]])),textAppearance:textAppearance(element)}) as Partial<DesignElement>;}
export function readTextStyles():SavedTextStyle[]{try{return JSON.parse(localStorage.getItem('ceriga-text-styles:'+fontWorkspaceScope())??'[]')}catch{return []}}
export function saveTextStyle(name:string,element:DesignElement,id?:string):SavedTextStyle{
  const style={id:id??crypto.randomUUID(),name:name.trim()||'Text style',updatedAt:new Date().toISOString(),values:textStyleValues(element)},rows=readTextStyles().filter(row=>row.id!==style.id);
  localStorage.setItem('ceriga-text-styles:'+fontWorkspaceScope(),JSON.stringify([...rows,style]));window.dispatchEvent(new Event('ceriga-text-styles-change'));return style;
}
export function applyTextStyle(element:DesignElement,style:SavedTextStyle,units=element.textUnitsPerCm??30):Partial<DesignElement>{const sourceUnits=style.values.textUnitsPerCm??30,ratio=units/sourceUnits,size=(style.values.fontSize??30)*ratio,scale=size/(element.fontSize??30);return{...structuredClone(Object.fromEntries(keys.map(key=>[key,style.values[key]]))),textCharacterStyles:undefined,textKerningPairs:undefined,fontSize:size,letterSpacing:(style.values.letterSpacing??0)*ratio,textUnitsPerCm:units,textWordSpacing:(style.values.textWordSpacing??0)*ratio,textKerning:(style.values.textKerning??0)*ratio,textStyleId:style.id,width:element.width*scale,height:element.height*scale,textShadowEnabled:false,shadowBlur:0,borderWidth:0};}
