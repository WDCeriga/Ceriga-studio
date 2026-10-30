import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {outlineLettering,letteringFontMetrics} from './editableLettering';
import {textStrokeWidth} from './textStrokeCheck';
import {bezierBounds} from './bezierBounds';
export async function measureText(element:DesignElement,fonts:{family:string;dataUrl:string}[]=[]){
  const source={...element,textAppearance:undefined,textShadowEnabled:false,shadowBlur:0,textUnderline:false,textStrikethrough:false,textLinePosition:'none' as const};
  const [shape,font]=await Promise.all([outlineLettering(source,fonts),letteringFontMetrics(source,fonts)]);
  return{height:bezierBounds(shape.shapePath!).height*shape.height!/100,capHeight:font.capRatio*(shape.textEffectiveFontSize??element.fontSize??30),strokeWidth:textStrokeWidth({...source,...shape}),missing:font.missing,features:font.features};
}
export const toCentimetres=(value:number,unit:'cm'|'mm'|'in')=>unit==='mm'?value/10:unit==='in'?value*2.54:value;
export const fromCentimetres=(value:number,unit:'cm'|'mm'|'in')=>unit==='mm'?value*10:unit==='in'?value/2.54:value;
