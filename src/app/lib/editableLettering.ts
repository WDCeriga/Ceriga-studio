import {studioFontSource} from './studioFontCatalog';
import {contourFont,loadStudioFont} from './fontEngine';
import {applyVectorTextEffects} from './vectorTextEffects';
import {richTextSpans} from './richArtworkText';
import {textPathSampler} from './textPathSampler';
import {legacyTextPath} from './legacyTextPath';
import {textCurveRadius} from './textCurveControls';
import {outlineFontSource,hasOutlineFont} from './outlineFontSources';
import {mapShapePath,shapeWorldPath,fitPenPath} from './artworkPathOperations';
import {parse} from 'opentype.js';
import {DISPLAY_FONT_SOURCES as sources} from './displayFonts';
import type {DesignElement} from '../components/builder/PrintStudioEditor';
import type {ShapePath} from './shapeGeometry';
import {bezierBounds} from './bezierBounds';
function glyphsFor(font:any,text:string):any[]{
 if(Array.from(text).some(character=>character.trim()&&font.charToGlyphIndex(character)===0))throw new Error('The font file does not contain every character. Import a complete font before converting.');
 try{return font.stringToGlyphs(text)}catch(error){
  if(!/^[\u0000-\u024f]*$/.test(text))throw new Error('This font needs unsupported shaping. Keep it as live text or choose a compatible font.');
  const glyphs=Array.from(text).map(char=>font.charToGlyph(char));
  const ligatures=[...(font.substitution?.getLigatures('rlig','latn')??[]),...(font.substitution?.getLigatures('liga','latn')??[])].sort((a:any,b:any)=>b.sub.length-a.sub.length);
  for(let index=0;index<glyphs.length;index++){const match=ligatures.find((ligature:any)=>ligature.sub.every((glyph:number,offset:number)=>glyphs[index+offset]?.index===glyph));if(match)glyphs.splice(index,match.sub.length,font.glyphs.get(match.by));}
  return glyphs;
 }
}
function advanceFor(font:any,text:string,size:number,tracking=0){const glyphs=glyphsFor(font,text);return glyphs.reduce((sum:number,g:any,i:number)=>sum+(g.advanceWidth??0)/font.unitsPerEm*size+(i<glyphs.length-1?font.getKerningValue(g,glyphs[i+1])/font.unitsPerEm*size:0)+tracking,0);}
const fonts=new Map<string,Promise<any>>(),legacyFonts=new Map<string,Promise<any>>();
export function canOutlineLettering(family:string,imports:{family:string;dataUrl:string}[]=[]){return Boolean(hasOutlineFont(family)||studioFontSource(family)||sources[family]||imports.some(f=>f.family===family))}
/** Keep glyph contours and counters as cubic paths, never a raster trace. */
export function letteringCommandsToPath(commands:any[]):{path:ShapePath;bounds:{x:number;y:number;width:number;height:number}}{
 const contours:ShapePath[]=[];let current:ShapePath|undefined;
 const ensure=()=>{if(!current)throw new Error('Invalid font contour');return current};
 for(const c of commands){
  if(c.type==='M'){current={closed:true,nodes:[{x:c.x,y:c.y}]};contours.push(current)}
  else if(c.type==='L')ensure().nodes.push({x:c.x,y:c.y});
  else if(c.type==='C'){const nodes=ensure().nodes;nodes[nodes.length-1].out={x:c.x1,y:c.y1};nodes.push({x:c.x,y:c.y,in:{x:c.x2,y:c.y2}})}
  else if(c.type==='Q'){const nodes=ensure().nodes,a=nodes[nodes.length-1];a.out={x:a.x+2/3*(c.x1-a.x),y:a.y+2/3*(c.y1-a.y)};nodes.push({x:c.x,y:c.y,in:{x:c.x+2/3*(c.x1-c.x),y:c.y+2/3*(c.y1-c.y)}})}
  else if(c.type==='Z'){const path=ensure();path.closed=true;const a=path.nodes[0],b=path.nodes.at(-1)!;if(path.nodes.length>1&&Math.hypot(a.x-b.x,a.y-b.y)<.0001){a.in=b.in;path.nodes.pop()}}
 }
 // OpenType 2 emits implicitly closed glyph contours without Z commands.
 for(const part of contours){const a=part.nodes[0],b=part.nodes.at(-1)!;if(part.nodes.length>1&&Math.hypot(a.x-b.x,a.y-b.y)<.0001){a.in=b.in;part.nodes.pop()}}
 const all=contours.flatMap(p=>p.nodes.flatMap(n=>[n,...(n.in?[n.in]:[]),...(n.out?[n.out]:[])]));
 if(!all.length)throw new Error('Type some lettering before converting.');
 const minX=Math.min(...all.map(p=>p.x)),minY=Math.min(...all.map(p=>p.y)),width=Math.max(1,Math.max(...all.map(p=>p.x))-minX),height=Math.max(1,Math.max(...all.map(p=>p.y))-minY);
 const point=(p:{x:number;y:number})=>({x:(p.x-minX)/width*100,y:(p.y-minY)/height*100});
 const normalized=contours.map(path=>({...path,nodes:path.nodes.map(n=>({...point(n),...(n.in?{in:point(n.in)}:{}),...(n.out?{out:point(n.out)}:{})}))}));
 return{path:{...normalized[0],subpaths:normalized.slice(1)},bounds:{x:minX,y:minY,width,height}};
}

async function fontFor(element:DesignElement,imports:{family:string;dataUrl:string}[]) {
 const family=element.fontFamily??'Inter';
 const imported=element.fontId?imports.find((f:any)=>f.id===element.fontId&&(!element.fontPostscriptName||f.postscriptName===element.fontPostscriptName)):imports.find(f=>f.family===family);
 if(element.fontId&&!element.fontId.startsWith('builtin:')&&!imported)throw new Error('Font missing. Restore the uploaded font or choose a replacement.');
 const url=outlineFontSource(family,element.fontWeight,element.fontStyle)??sources[family]??imported?.dataUrl??studioFontSource(family,element.fontWeight,element.fontStyle);
 if(!url)throw new Error('Import the matching TTF, OTF or WOFF font before converting this text.');
 let pending=fonts.get(url);
 if(!pending){pending=loadStudioFont(url);fonts.set(url,pending);pending.catch(()=>fonts.delete(url));}
 const raw=await pending;const font=element.fontId||!outlineFontSource(family,element.fontWeight,element.fontStyle)&&!sources[family]||Object.keys(element.fontAxes??{}).length||Object.keys(element.fontFeatures??{}).length?contourFont(raw,element):await (()=>{let cached=legacyFonts.get(url);if(!cached){cached=fetch(url).then(r=>r.arrayBuffer()).then(parse);legacyFonts.set(url,cached);}return cached;})();if(!outlineFontSource(family,element.fontWeight,element.fontStyle)&&element.fontWeight==='bold'&&(font.tables.os2?.usWeightClass??400)<600&&(element.fontAxes?.wght??0)<600)throw new Error('Import the matching bold font before outlining; simulated bold cannot preserve the same contours.');if(!outlineFontSource(family,element.fontWeight,element.fontStyle)&&element.fontStyle==='italic'&&!font.tables.post?.italicAngle&&!element.fontAxes?.ital&&!element.fontAxes?.slnt)throw new Error('Import the matching italic font before outlining; simulated italic cannot preserve the same contours.');return font;
}

export async function letteringFontMetrics(element:DesignElement,imports:{family:string;dataUrl:string}[]=[]){const font=await fontFor(element,imports),commands=font.charToGlyphIndex('H')?glyphsFor(font,'H')[0]?.getPath(0,0,1000).commands??[]:[],ys=commands.filter((c:any)=>Number.isFinite(c.y)).map((c:any)=>c.y);return{features:font.availableFeatures??font.tables.gsub?.features?.map((feature:any)=>feature.tag)??[],capRatio:ys.length?(Math.max(...ys)-Math.min(...ys))/1000:.7,missing:Array.from(element.content).filter(character=>character.trim()&&!font.charToGlyphIndex(character))};}
type Glyph={glyph:any;font:any;size:number;color:string;advance:number;before:number;shift:number;label:string};
function wrapGlyphs(glyphs:Glyph[],limit:number){
 const rows:Glyph[][]=[];let line:Glyph[]=[];
 for(const glyph of glyphs){
  if(line.length&&line.reduce((n,g)=>n+g.advance+g.before,0)+glyph.advance+glyph.before>limit){
   const at=line.map(g=>g.label).lastIndexOf(' ')+1;
   if(at>0&&at<line.length){rows.push(line.slice(0,at));line=line.slice(at);}else{rows.push(line);line=[];}
  }
  line.push(glyph);
 }
 rows.push(line);return rows;
}
/** Convert the actual font contours. Positions remain in the original text frame;
 * reframe only after positioning every glyph, including character styles and paths. */
async function buildLettering(element:DesignElement,imports:{family:string;dataUrl:string}[]=[]):Promise<Partial<DesignElement>>{
 if(element.textShadowEnabled||(element.shadowBlur??0)>0)throw new Error('Use the vector appearance shadow before converting to native outlines.');
 if(element.verticalText)throw new Error('Set lettering horizontally before converting it to outlines.');
 const baseFont=await fontFor(element,imports),size=element.fontSize??40,spacing=size*(element.lineSpacing??115)/100+(element.textStackFit?element.textStackGap??0:0);
 const curved=Boolean(element.textPath)||(element.textCurveAmount??0)>0,circular=curved&&!element.textPath&&element.textCurveShape==='circle',autoPoint=!curved&&!element.textStackFit&&(element.autoWidth===true||element.textFrameMode==='point'&&element.autoWidth!==false);
 const baseTracking=(element.letterSpacing??0)+(element.textKerning??0)+(curved?Math.max(-.5,Math.min(8,element.textCurveSpacing??0)):0);
 const display=(text:string)=>element.textTransform==='uppercase'?text.toUpperCase():element.textTransform==='lowercase'?text.toLowerCase():element.textTransform==='title'?text.toLowerCase().replace(/(^|\s)(\p{L})/gu,(_m,space,letter)=>space+letter.toUpperCase()):text;
 const measure=(text:string)=>advanceFor(baseFont,display(text),size,curved?Math.max(-.5,baseTracking):baseTracking);
 const widest=Math.max(size,...Array.from(element.content).map(measure)),radius=textCurveRadius(element);
 const minimumAmount=Math.min(100,100*(widest+size*2)/(2*Math.PI*radius));
 const circleAmount=minimumAmount+(100-minimumAmount)*Math.max(1,Math.min(100,element.textCurveAmount??100))/100;
 const limit=circular?Math.max(widest,2*Math.PI*radius*circleAmount/100-size*2):curved?Math.max(size,element.width-Math.min(element.width*.08,size)*2-size*.5):element.width;
 const rows:Glyph[][]=[];let sourceOffset=0,number=0,previousKind:string|undefined;
 const sourceRows=element.content.split(/\r?\n/);
 for(let paragraph=0;paragraph<sourceRows.length;paragraph++){
  const content=sourceRows[paragraph],kind=element.textListLineStyles?.[paragraph]??element.textList??'none';
  number=kind==='numbered'?(previousKind==='numbered'?number+1:1):0;previousKind=kind;
  const marker=kind==='bulleted'?'• ':kind==='numbered'?number+'. ':'';
  const runs=[...(marker?[{content:marker,style:{}}]:[]),...richTextSpans(content,element.textCharacterStyles,sourceOffset,element.textKerningPairs)],glyphs:Glyph[]=[];
  for(const run of runs){
   const source={...element,...run.style},font=await fontFor(source,imports),fontSize=source.fontSize??size,letters=glyphsFor(font,display(run.content));
   const tracking=curved?Math.max(-.5,(run.style.letterSpacing??element.letterSpacing??0)+(element.textKerning??0)+Math.max(-.5,Math.min(8,element.textCurveSpacing??0))):(run.style.letterSpacing??element.letterSpacing??0)+(element.textKerning??0);
   letters.forEach((glyph:any,index:number)=>glyphs.push({glyph,font,size:fontSize,color:run.style.color??element.color??'#262626',shift:run.style.baselineShift??0,before:index===0&&'kerning' in run?Number(run.kerning)||0:0,label:glyph.unicode!==undefined?String.fromCodePoint(glyph.unicode):glyph.name??'Letter',advance:(glyph.advanceWidth??0)/font.unitsPerEm*fontSize+(index<letters.length-1?font.getKerningValue(glyph,letters[index+1])/font.unitsPerEm*fontSize:0)+tracking}));
  }
  glyphs.forEach(glyph=>{if(glyph.label===' ')glyph.advance+=element.textWordSpacing??0;});
  if(element.textKerningMode==='optical')for(let i=0;i<glyphs.length-1;i++){const a=glyphs[i],b=glyphs[i+1];if(a.label===' '||b.label===' ')continue;const box=(g:Glyph)=>{const commands=g.glyph.getPath(0,0,g.size).commands.filter((c:any)=>Number.isFinite(c.x));return{left:Math.min(...commands.map((c:any)=>c.x)),right:Math.max(...commands.map((c:any)=>c.x))}};const aa=box(a),bb=box(b),gap=a.advance-aa.right+bb.left;a.advance+=Math.max(-size*.12,Math.min(size*.12,size*.04-gap));}
  rows.push(...(element.textPath||element.textStackFit||autoPoint?[glyphs]:wrapGlyphs(glyphs,limit)));sourceOffset+=content.length+(element.content.slice(sourceOffset+content.length).startsWith('\r\n')?2:1);
 }
 let frameHeight=0,rowTop=0;const layoutWidth=autoPoint?Math.max(1,...rows.map(row=>row.reduce((sum,g)=>sum+g.advance+g.before,0))):element.width;
 const parts:ShapePath[]=[],paints:{key:string;fill:string}[]=[],labels:{key:string;label:string}[]=[];
 for(let row=0;row<rows.length;row++){
  const rowStart=parts.length,glyphs=rows[row],natural=glyphs.reduce((sum,g)=>sum+g.advance+g.before,0),spaces=glyphs.filter(g=>g.label===' ').length;
  if(element.textAlign==='justify'&&spaces&&!curved&&!element.textStackFit){const extra=(element.width-natural)/spaces;glyphs.forEach(g=>{if(g.label===' ')g.advance+=extra;});}
  const forward=element.textPath?textPathSampler(mapShapePath(element.textPath.path,p=>({x:p.x*element.width/100,y:p.y*element.height/100+row*spacing}))):null;
  const custom=forward&&element.textPath?.flip?{...forward,point:(distance:number)=>{const p=forward.point(forward.length-distance);return{...p,angle:p.angle+Math.PI}}}:forward;
  const legacy=!custom&&curved?legacyTextPath(element,size,row,rows.length,measure):null,sampler=custom??legacy,scale=legacy?.glyphScale??1;
  const parentAscent=spacing/2+(baseFont.ascender+baseFont.descender)*size/baseFont.unitsPerEm/2;
  const ascent=Math.max(parentAscent,...glyphs.map(g=>spacing/2+(g.font.ascender+g.font.descender)*g.size/g.font.unitsPerEm/2)),descent=Math.max(spacing-parentAscent,...glyphs.map(g=>spacing/2-(g.font.ascender+g.font.descender)*g.size/g.font.unitsPerEm/2));
  if(custom)frameHeight=element.height;else if(legacy)frameHeight=legacy.height;else frameHeight+=ascent+descent;
  let extra=0;
  if(circular&&glyphs.length>1&&sampler){
   const baseNatural=measure(glyphs.map(g=>g.label).join('')),length=sampler.length/scale,gap=Math.max(size*.5,(length-baseNatural)/glyphs.length-baseTracking);
   extra=(Math.max(baseNatural,length-gap)-natural)/(glyphs.length-1);
  }
  const total=natural+extra*Math.max(0,glyphs.length-1),align=element.textAlign??'center';
  const start=align==='left'||align==='justify'?0:align==='right'?(sampler?sampler.length/scale:layoutWidth)-total:((sampler?sampler.length/scale:layoutWidth)-total)/2;
  let cursor=0;
  for(const record of glyphs){
   cursor+=record.before;
   const {glyph,font}=record,naturalAdvance=(glyph.advanceWidth??0)/font.unitsPerEm*record.size,center=start+cursor+naturalAdvance/2;
   // SVG textPath suppresses glyphs whose centres lie beyond an open path.
   if(sampler&&(center*scale<0||center*scale>sampler.length)){cursor+=record.advance+extra;continue;}
   const commands=[...glyph.getPath(0,0,record.size).commands];
   const rule=(y:number,thickness:number)=>commands.push({type:'M',x:0,y},{type:'L',x:naturalAdvance,y},{type:'L',x:naturalAdvance,y:y+thickness},{type:'L',x:0,y:y+thickness},{type:'Z'});
   if(element.textUnderline)rule(record.size*.1,Math.max(.15,record.size*.045));
   if(element.textStrikethrough)rule(-record.size*.32,Math.max(.15,record.size*.045));
   if(element.textLinePosition&&element.textLinePosition!=='none')rule((element.textLinePosition==='top'?-record.size:element.textLinePosition==='middle'?-record.size*.35:record.size*.12)+(element.textLineOffset??0),element.textLineThickness??1);
   if(commands.some((command:any)=>command.type==='M')){
    const glyphPath=letteringCommandsToPath(commands),position=sampler?.point(center*scale),key='letter-'+labels.length;
    const baseline=rowTop+ascent-(element.textBaselineShift??0)-record.shift;
    const offset=custom?element.textPath!.offset-(element.textBaselineShift??0)-record.shift:(legacy?.dy??0)-record.shift*scale;
    let path=mapShapePath(glyphPath.path,point=>{
     const x=glyphPath.bounds.x+point.x/100*glyphPath.bounds.width,y=glyphPath.bounds.y+point.y/100*glyphPath.bounds.height;
     if(!position)return {x:element.textStackFit?(cursor+x)*element.width/Math.max(1,natural):start+cursor+x,y:baseline+y};
     const dx=(x-naturalAdvance/2)*scale,dy=y*scale+offset,cs=Math.cos(position.angle),sn=Math.sin(position.angle);
     return {x:position.x+dx*cs-dy*sn,y:position.y+dx*sn+dy*cs};
    });
    const transform=element.textGlyphTransforms?.[key];if(transform){const centerX=start+cursor+naturalAdvance/2,centerY=baseline-record.size*.35,angle=transform.rotation*Math.PI/180;path=mapShapePath(path,p=>{const x=(p.x-centerX)*transform.scaleX,y=(p.y-centerY)*transform.scaleY;return{x:centerX+transform.x+x*Math.cos(angle)-y*Math.sin(angle),y:centerY+transform.y+x*Math.sin(angle)+y*Math.cos(angle)};});}
    parts.push(...[path,...(path.subpaths??[])].map(part=>({...part,subpaths:undefined,letterKey:key})));paints.push({key,fill:record.color});labels.push({key,label:record.label});
   }
   cursor+=record.advance+extra;
  }
  if(element.textStackFit&&parts.length>rowStart){const rowPath={...parts[rowStart],subpaths:parts.slice(rowStart+1)},bounds=bezierBounds(rowPath);if(bounds.width>1e-8)for(let index=rowStart;index<parts.length;index++)parts[index]=mapShapePath(parts[index],point=>({x:(point.x-bounds.left)*element.width/bounds.width,y:point.y}));}
  rowTop+=ascent+descent;
 }
 if(!parts.length)throw new Error('Type visible lettering before converting to outlines.');
 const sx=(element.textScaleX??100)/100,sy=(element.textScaleY??100)/100;if(sx!==1||sy!==1){for(let i=0;i<parts.length;i++)parts[i]=mapShapePath(parts[i],p=>({x:element.width/2+(p.x-element.width/2)*sx,y:frameHeight/2+(p.y-frameHeight/2)*sy}));}
 const coordinates=parts.flatMap(part=>part.nodes.flatMap(node=>[node,...(node.in?[node.in]:[]),...(node.out?[node.out]:[])]));
 const left=Math.min(...coordinates.map(p=>p.x)),top=Math.min(...coordinates.map(p=>p.y)),width=Math.max(1,Math.max(...coordinates.map(p=>p.x))-left),height=Math.max(1,Math.max(...coordinates.map(p=>p.y))-top);
 const path=mapShapePath({...parts[0],subpaths:parts.slice(1)},p=>({x:(p.x-left)/width*100,y:(p.y-top)/height*100}));
 const dx=(left+width/2-(autoPoint?layoutWidth:element.width)/2)*(element.flipHorizontal?-1:1),dy=(top+height/2-(element.autoHeight===false?element.height:frameHeight)/2)*(element.flipVertical?-1:1),angle=element.rotation*Math.PI/180;
 const fillMode=element.textFillMode??((element.borderWidth??0)>0?'fill-outline':'filled');
 return {type:'shape',content:'custom-lettering',x:element.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:element.y+dx*Math.sin(angle)+dy*Math.cos(angle),width,height,shapePath:path,shapeGeometry:'bounds',shapeFillRule:'nonzero',shapeFilled:fillMode!=='outline',shapeFillColor:element.color,shapeStrokeColor:element.borderColor??element.color,borderWidth:fillMode==='filled'?0:element.borderWidth??.25,shapeEffects:element.textEffects,letteringParts:labels,letteringPaints:element.textCharacterStyles?.some(range=>range.style.color)?paints:undefined,letteringSource:structuredClone(element),autoWidth:false,autoHeight:false,textLayoutHeight:frameHeight,textLayoutWidth:layoutWidth};
}

const outlineCache=new Map<string,Promise<Partial<DesignElement>>>();
async function badgeLettering(element:DesignElement,imports:{family:string;dataUrl:string}[]):Promise<Partial<DesignElement>>{
 const badge=element.textBadge!,r=badge.radius/element.width*100,k=.5522847498307936,parts:ShapePath[]=[],labels:{key:string;label:string}[]=[],font=await fontFor(element,imports);let effective=element.fontSize??30;
 for(const [name,text] of Object.entries({top:badge.top,bottom:badge.bottom,centre:badge.centre})){if(!text.trim())continue;const sign=name==='bottom'?1:-1,path:ShapePath={closed:false,nodes:[{x:50-r,y:50,out:{x:50-r,y:50+sign*k*r}},{x:50,y:50+sign*r,in:{x:50-k*r,y:50+sign*r},out:{x:50+k*r,y:50+sign*r}},{x:50+r,y:50,in:{x:50+r,y:50+sign*k*r}}]};
  const original=element.fontSize??30,natural=advanceFor(font,text,original,element.letterSpacing??0),available=name==='centre'?badge.radius*1.6:Math.PI*badge.radius*.9,fontSize=Math.min(original,original*available/Math.max(1,natural));effective=Math.min(effective,fontSize);
  const copy={...element,fontSize,letterSpacing:(element.letterSpacing??0)*fontSize/original,textBadge:undefined,textShapeMode:'none' as const,textCurveAmount:0,vectorTextEffects:undefined,textPath:name==='centre'?undefined:{path,offset:0},content:text,autoWidth:false,autoHeight:false,textAlign:'center' as const},patch=await buildLettering(copy,imports),shape={...copy,...patch,...(name==='centre'?{x:element.x,y:element.y}:{})},world=shapeWorldPath(shape),prefix=(part:ShapePath):ShapePath=>({...part,letterKey:part.letterKey?name+'-'+part.letterKey:undefined,subpaths:part.subpaths?.map(prefix)}),p=prefix(world);parts.push({...p,subpaths:undefined},...(p.subpaths??[]));labels.push(...(patch.letteringParts??[]).map(part=>({...part,key:name+'-'+part.key})));
 }
 if(!parts.length)throw new Error('Add some badge text.');const fit=fitPenPath({...parts[0],subpaths:parts.slice(1)});return{...fit,type:'shape',content:'custom-lettering',shapeGeometry:'bounds',shapeFilled:true,shapeFillRule:'nonzero',shapeFillColor:element.color,borderWidth:0,letteringParts:labels,letteringSource:structuredClone(element),textEffectiveFontSize:effective};
}
export async function outlineLettering(element:DesignElement,imports:{family:string;dataUrl:string}[]=[]):Promise<Partial<DesignElement>>{const key=JSON.stringify([{...element,vectorTextEffects:undefined},imports.map(f=>[f.family,f.dataUrl.length,f.dataUrl.slice(-60)])]);let result=outlineCache.get(key);if(!result){result=element.textBadge?badgeLettering(element,imports):buildLettering(element,imports);outlineCache.set(key,result);if(outlineCache.size>80)outlineCache.delete(outlineCache.keys().next().value!);result.catch(()=>outlineCache.delete(key));}const patch=structuredClone(await result);if(element.vectorTextEffects?.some(e=>e.enabled)&&patch.shapePath)patch.shapePath=applyVectorTextEffects(patch.shapePath,element.vectorTextEffects,patch.width!,patch.height!);return patch;}
