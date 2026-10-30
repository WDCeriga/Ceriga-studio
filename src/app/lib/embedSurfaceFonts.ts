import {SVG_FONT_SOURCES} from './displayFonts';
import {workspaceFonts} from './workspaceFonts';
const cached=new Map<string,Promise<string>>();
/** Bundle licensed font data so an exported label or package doesn't depend on this website. */
export async function embedSurfaceFonts(svg:string){
 const families=[...new Set([...svg.matchAll(/font-family="([^"]+)"/g)].map(match=>match[1]))];
 const rules=await Promise.all(families.map(async family=>{
  const uploaded=workspaceFonts().find(font=>font.family===family),source=SVG_FONT_SOURCES[family]??(uploaded?.embeddingRestricted?undefined:uploaded?.dataUrl);
  if(!source)return '';
  let pending=cached.get(source);if(!pending){pending=(async()=>{if(source.startsWith('data:'))return source;const response=await fetch(source);if(!response.ok)throw new Error(`Could not load ${family} for export.`);const blob=await response.blob();return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Font data could not be read.'));reader.readAsDataURL(blob);});})();cached.set(source,pending);pending.catch(()=>cached.delete(source));}
  const data=await pending;return `@font-face{font-family:"${family.replace(/["\\<>]/g,'')}";src:url("${data}");font-weight:100 900;font-style:normal;}`;
 }));
 return svg.replace(/(<svg\b[^>]*>)/,(_,opening)=>opening+'<defs><style>'+rules.join('')+'</style></defs>');
}
