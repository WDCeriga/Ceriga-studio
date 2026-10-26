import {patternGeometry} from './patternGeometry';
import {patternDefinition} from './patternCatalog';
import {generatedPatternGeometry} from './generatedPatterns';
import {initialPatternSettings} from './patternEditing';
import {createTextEffect,type TextEffect} from './textEffects';
export const TEXTILE_INKS=['plaid','tartan','gingham','houndstooth'] as const;
const escape=(s:unknown)=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
/** Serializable vector repeat used as a non-destructive fill inside any artwork alpha. */
export function textileInkSource(kind='plaid',colors=['#c9b997','#a94747','#f1eee2','#344357'],count=4,options:Record<string,number|string>={}){
 if(patternDefinition(kind)?.category==='Classic'){
 const geometry=patternGeometry({content:kind,width:512,height:512,...initialPatternSettings(kind,colors[0]),patternCount:count});
 const shapes=geometry.rectangles.map(r=>`<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${escape(colors[0])}"/>`).join('')+geometry.dots.map(d=>`<circle cx="${d.x}" cy="${d.y}" r="${d.radius}" fill="${escape(colors[0])}"/>`).join('');
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs><pattern id="ink" width="${geometry.tileSize}" height="${geometry.tileSize}" patternUnits="userSpaceOnUse" patternTransform="rotate(${kind==='diagonal'?45:kind==='stripes'?90:0})"><rect width="100%" height="100%" fill="${escape(colors[1]??'#fff')}"/>${shapes}</pattern></defs><rect width="512" height="512" fill="url(#ink)"/></svg>`);
 }
 const geometry=generatedPatternGeometry({content:kind,width:512,height:512,...initialPatternSettings(kind,colors[0]),patternColors:colors,patternCount:count,patternOptions:options,patternSeed:1729});
 const primitive=(p:any)=>{
  const {tag,fill,stroke,...attrs}=p;
  if(tag==='image')return '';
  const color=(i:number)=>/^#[a-f0-9]{6}$/i.test(geometry.colors[i])?geometry.colors[i]:'#171717';
  return `<${tag} ${Object.entries(attrs).map(([k,v])=>`${k==='strokeWidth'?'stroke-width':k}="${escape(v)}"`).join(' ')} fill="${fill==='none'?'none':color(fill??0)}"${stroke===undefined?'':` stroke="${color(stroke)}"`}/>`;
 };
 const motifs=geometry.motifs.map(m=>`<g id="m${m.id}">${m.primitives.map(primitive).join('')}</g>`).join('');
 const repeats=geometry.replicas.map(r=>{const m=geometry.motifs[r.motif];return `<use href="#m${m.id}" transform="translate(${m.x+r.dx} ${m.y+r.dy}) rotate(${m.rotation}) scale(${m.scaleX} ${m.scaleY})"/>`}).join('');
 const background=geometry.background===undefined?'':`<rect width="${geometry.tileWidth}" height="${geometry.tileHeight}" fill="${escape(geometry.colors[geometry.background])}"/>`;
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs>${motifs}<pattern id="ink" width="${geometry.tileWidth}" height="${geometry.tileHeight}" patternUnits="userSpaceOnUse">${background}${repeats}</pattern></defs><rect width="512" height="512" fill="url(#ink)"/></svg>`);
}
export function textileInkEffect(kind='plaid',colors=['#c9b997','#a94747','#f1eee2','#344357'],count=4,angle=0,options:Record<string,number|string>={}):TextEffect{
 return {...createTextEffect('texture-fill'),id:'textile-ink',source:textileInkSource(kind,colors,count,options),settings:{scale:100,offsetX:0,offsetY:0,rotation:angle,opacity:100,cropX:0,cropY:0,cropWidth:100,cropHeight:100,patternId:kind,palette:JSON.stringify(colors),repeatCount:count,patternOptions:JSON.stringify(options)}};
}
