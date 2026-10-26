import {parse} from 'opentype.js';
import {DISPLAY_FONT_SOURCES as sources} from './displayFonts';
import type {DesignElement} from '../components/builder/PrintStudioEditor';
import type {ShapePath} from './shapeGeometry';
const fonts=new Map<string,Promise<any>>();
export function canOutlineLettering(family:string,imports:{family:string;dataUrl:string}[]=[]){return Boolean(sources[family]||imports.some(f=>f.family===family))}
/** Keep glyph contours and counters as cubic paths, never a raster trace. */
export function letteringCommandsToPath(commands:any[]):{path:ShapePath;bounds:{x:number;y:number;width:number;height:number}}{
 const contours:ShapePath[]=[];let current:ShapePath|undefined;
 const ensure=()=>{if(!current)throw new Error('Invalid font contour');return current};
 for(const c of commands){
  if(c.type==='M'){current={closed:false,nodes:[{x:c.x,y:c.y}]};contours.push(current)}
  else if(c.type==='L')ensure().nodes.push({x:c.x,y:c.y});
  else if(c.type==='C'){const nodes=ensure().nodes;nodes[nodes.length-1].out={x:c.x1,y:c.y1};nodes.push({x:c.x,y:c.y,in:{x:c.x2,y:c.y2}})}
  else if(c.type==='Q'){const nodes=ensure().nodes,a=nodes[nodes.length-1];a.out={x:a.x+2/3*(c.x1-a.x),y:a.y+2/3*(c.y1-a.y)};nodes.push({x:c.x,y:c.y,in:{x:c.x+2/3*(c.x1-c.x),y:c.y+2/3*(c.y1-c.y)}})}
  else if(c.type==='Z'){const path=ensure();path.closed=true;const a=path.nodes[0],b=path.nodes.at(-1)!;if(path.nodes.length>1&&Math.hypot(a.x-b.x,a.y-b.y)<.0001){a.in=b.in;path.nodes.pop()}}
 }
 const all=contours.flatMap(p=>p.nodes.flatMap(n=>[n,...(n.in?[n.in]:[]),...(n.out?[n.out]:[])]));
 if(!all.length)throw new Error('Type some lettering before converting.');
 const minX=Math.min(...all.map(p=>p.x)),minY=Math.min(...all.map(p=>p.y)),width=Math.max(1,Math.max(...all.map(p=>p.x))-minX),height=Math.max(1,Math.max(...all.map(p=>p.y))-minY);
 const point=(p:{x:number;y:number})=>({x:(p.x-minX)/width*100,y:(p.y-minY)/height*100});
 const normalized=contours.map(path=>({...path,nodes:path.nodes.map(n=>({...point(n),...(n.in?{in:point(n.in)}:{}),...(n.out?{out:point(n.out)}:{})}))}));
 return{path:{...normalized[0],subpaths:normalized.slice(1)},bounds:{x:minX,y:minY,width,height}};
}
export async function outlineLettering(element:DesignElement,imports:{family:string;dataUrl:string}[]=[]):Promise<Partial<DesignElement>>{
 const family=element.fontFamily??'Inter',url=sources[family]??imports.find(f=>f.family===family)?.dataUrl;
 if(!url)throw new Error('Choose a bundled display font or import its TTF, OTF or WOFF file first.');
 let pending=fonts.get(url);if(!pending){pending=fetch(url).then(r=>{if(!r.ok)throw new Error('Font source is unavailable');return r.arrayBuffer()}).then(b=>parse(b));fonts.set(url,pending);pending.catch(()=>fonts.delete(url))}
 const font=await pending,size=element.fontSize??40;let text=element.content;if(element.textTransform==='uppercase')text=text.toUpperCase();if(element.textTransform==='lowercase')text=text.toLowerCase();
 const commands:any[]=[];const rows=text.split(/\r?\n/);let y=0;
 for(const row of rows){let glyphs:any[];try{glyphs=font.stringToGlyphs(row)}catch(error){if(!/^[\u0000-\u024f]*$/.test(row))throw new Error('This font uses shaping that the path editor cannot preserve. Keep it as live text.');glyphs=Array.from(row).map(char=>font.charToGlyph(char))}let x=0;const advance=glyphs.map((g:any,i:number)=>(g.advanceWidth??0)/font.unitsPerEm*size+(i<glyphs.length-1?font.getKerningValue(g,glyphs[i+1])/font.unitsPerEm*size+(element.letterSpacing??0):0));const total=advance.reduce((a:number,b:number)=>a+b,0);
  glyphs.forEach((g:any,i:number)=>{const path=g.getPath(x,0,size);const center=x+(g.advanceWidth??0)/font.unitsPerEm*size/2;const curve=(element.textCurveAmount??0)/100;const theta=total?((center-total/2)/total)*Math.PI*curve:0;const direction=element.textCurveDirection==='down'?-1:1;const rise=direction*Math.pow((center-total/2)/Math.max(1,total/2),2)*size*curve*1.5;const cs=Math.cos(theta*direction),sn=Math.sin(theta*direction);for(const c of path.commands){const p={...c};for(const [a,b]of [['x','y'],['x1','y1'],['x2','y2']])if(Number.isFinite(p[a])){const px=p[a]-center,py=p[b];p[a]=center+px*cs-py*sn;p[b]=y+rise+px*sn+py*cs}commands.push(p)}x+=advance[i]});y+=size*(element.lineSpacing??115)/100;
 }
 const {path,bounds}=letteringCommandsToPath(commands),width=Math.min(element.width,bounds.width),height=width*bounds.height/bounds.width;
 return{type:'shape',content:'custom-lettering',shapePath:path,shapeGeometry:'bounds',shapeFilled:element.textFillMode!=='outline',shapeFillColor:element.color,shapeStrokeColor:element.borderColor??element.color,shapeEffects:element.textEffects,borderWidth:element.borderWidth??0,width,height,autoWidth:false,autoHeight:false,letteringSource:{...element,letteringSource:undefined}};
}
