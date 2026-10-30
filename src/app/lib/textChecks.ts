import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {textAppearance,textColours,textGradientAllowed} from './textAppearance';
import {workspaceFonts} from './workspaceFonts';
import {parsePaint} from './studioPaint';
export type TextCheck={kind:'Blocker'|'Risk'|'Polish';message:string};
export const connectedScript=(family:string)=>/script|pinyon|lobster|pacifico|dancing|allura|cursive|brush/i.test(family);
export function textChecks(element:DesignElement,missing:string[]=[],capHeightMm?:number,glyphStrokeMm?:number):TextCheck[]{
 const method=element.printMethod??'DTG',limits=element.textPrintLimits??(method==='Embroidery'?{minCapMm:5,minStrokeMm:.4,maxColours:12}:method==='Screen Print'||method==='Puff Print'?{minCapMm:3,minStrokeMm:.3,maxColours:6}:{minCapMm:2,minStrokeMm:.2,maxColours:Infinity}),stack=textAppearance(element),checks:TextCheck[]=[];
 if(capHeightMm!==undefined&&capHeightMm<limits.minCapMm)checks.push({kind:'Risk',message:`Cap height is below ${limits.minCapMm} mm for ${method}.`});
 if(glyphStrokeMm!==undefined&&glyphStrokeMm<limits.minStrokeMm)checks.push({kind:'Risk',message:`Fine glyph strokes may be below ${limits.minStrokeMm} mm for ${method}.`});
 if(stack.some(item=>item.enabled&&(item.type==='stroke'||item.type==='offset')&&(item.widthMm??0)>0&&(item.widthMm??0)<limits.minStrokeMm))checks.push({kind:'Risk',message:`Stroke weight is below ${limits.minStrokeMm} mm for ${method}.`});
 if(textColours(element).length>limits.maxColours)checks.push({kind:'Risk',message:`Colour count exceeds the ${limits.maxColours}-colour limit for ${method}.`});
 if(!textGradientAllowed(method)&&stack.some(item=>item.enabled&&parsePaint(item.colour)))checks.push({kind:'Risk',message:`Gradient fill is not supported by ${method}.`});
 if(connectedScript(element.fontDisplayName??element.fontFamily??'')&&(element.letterSpacing??0)!==0)checks.push({kind:'Risk',message:'Spacing breaks connected letters'});
 if(missing.length)checks.push({kind:'Blocker',message:`Missing glyph: ${[...new Set(missing)].join(' ')}`});
 const font=workspaceFonts().find(font=>font.id===element.fontId);if(font?.embeddingRestricted)checks.push({kind:'Risk',message:"This font's licence restricts embedding. Production uses outlines only."});
 if(element.fontId&&!element.fontId.startsWith('builtin:')&&!font)checks.push({kind:'Blocker',message:'Font missing. Restore it or choose a replacement.'});
 return checks;
}
