import svgpath from 'svgpath';
import {fabricRings,regularStitchRows,straightSleeveStitches} from './regularConstruction';
import {shoulderFabricGeometry,shoulderGeometryPath} from './tshirtShoulderGeometry';
import {flattenPathContours,pointInLoop,signedArea} from '../features/panelling/panellingGeometry';
import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
import type {StitchGeometry} from './tshirtStitching';
type P={x:number;y:number};
/** Offset from the seam towards its owning fabric, rather than shifting every curve horizontally. */
export function insetConstructionRow(row:P[],contains:(p:P)=>boolean,inset=14):P[]{
 return row.map((p,i)=>{const a=row[Math.max(0,i-1)],b=row[Math.min(row.length-1,i+1)],length=Math.hypot(b.x-a.x,b.y-a.y)||1;
 const normal={x:-(b.y-a.y)/length*inset,y:(b.x-a.x)/length*inset};
 const one={x:p.x+normal.x,y:p.y+normal.y},other={x:p.x-normal.x,y:p.y-normal.y};
 return contains(one)?one:contains(other)?other:one;
 });
}
export function flattenConstructionSeam(d:string):P[]{
 const normalized=svgpath(d).abs().unshort().unarc();let end:P|undefined;
 normalized.iterate(segment=>{const v=segment.slice(1) as number[];if(['M','L','C','Q'].includes(segment[0]))end={x:v[v.length-2],y:v[v.length-1]};else if(segment[0]==='H'&&end)end={...end,x:v[0]};else if(segment[0]==='V'&&end)end={...end,y:v[0]};});
 if(!end)return[];
 const contour=flattenPathContours(normalized.toString()+'Z',4)[0]??[];
 const last=contour.findIndex(p=>Math.hypot(p.x-end!.x,p.y-end!.y)<.001);
 return last<0?[]:contour.slice(0,last+1);
}
function attachment(layer:ResolvedGarmentLayer):P[][]{
 const root=new DOMParser().parseFromString(layer.svgRaw,'image/svg+xml').documentElement;
 return Array.from(root.querySelectorAll('[data-sleeve-join]')).flatMap(p=>{
  const transforms:string[]=[];for(let el:Element|null=p;el&&el!==root;el=el.parentElement)if(el.hasAttribute('transform'))transforms.unshift(el.getAttribute('transform')!);
  const row=flattenConstructionSeam(svgpath(p.getAttribute('d')??'').transform(transforms.join(' ')).toString());return row.length?[row]:[];
 });
}
export function constructionStitchRows(layers:ResolvedGarmentLayer[]):StitchGeometry['rows']{
 const rows=straightSleeveStitches(layers,regularStitchRows(layers));
 const body=layers.find(l=>l.id==='base'),neck=layers.find(l=>l.id==='neck');if(!body)return rows;
 const rings=fabricRings(body.svgRaw).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a))),outline=rings[0];if(!outline)return rows;
 const contains=(p:P)=>pointInLoop(p,outline)&&!rings.slice(1).some(r=>pointInLoop(p,r));
 const attachments=layers.filter(l=>['sleeveLeft','sleeveRight'].includes(l.id)).flatMap(attachment);
 if(attachments.length)rows.armhole=attachments.map(row=>insetConstructionRow(row,contains));
 if(layers.some(l=>l.svgRaw.includes('data-shoulder-construction="true"')))rows.shoulder=[];
 else if(neck&&attachments.length){
  const neckPoints=fabricRings(neck.svgRaw).flat();if(!neckPoints.length)return rows;const left=Math.min(...neckPoints.map(p=>p.x)),right=Math.max(...neckPoints.map(p=>p.x));
  rows.shoulder=attachments.map(row=>{
   const cap=row[0],start=cap.x<1024?cap.x+22:right+18,end=cap.x<1024?left-18:cap.x-22,edge:P[]=[];
   for(let x=start;Number.isFinite(x)&&x<=end&&x<=2048;x+=6){const ys:number[]=[];for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];if((a.x>x)!==(b.x>x))ys.push(a.y+(x-a.x)*(b.y-a.y)/(b.x-a.x));}if(ys.length)edge.push({x,y:Math.min(...ys)});}
   return insetConstructionRow(edge,contains);
  }).filter(row=>row.length>1);
 }
 return rows;
}
const masks=new Map<string,string>();
/** An inward clearance protects every external edge even for heavy triple/zigzag stitching. */
export function clipConstructionStitches(markup:string,layers:ResolvedGarmentLayer[],prefix:string):string{
 if(!markup)return markup;
 const solids=layers.filter(l=>l.kind==='solid'&&!l.id.toLowerCase().includes('pocket'));
 const key=solids.map(l=>l.id+l.svgRaw).join('|');let fabric=masks.get(key);
 if(!fabric){const geometries=solids.map(l=>shoulderFabricGeometry(l.svgRaw)).filter(g=>g.length);if(!geometries.length)return markup;fabric=geometries.map(g=>`<path d="${shoulderGeometryPath(g)}" fill="white" fill-rule="evenodd"/>`).join('');masks.set(key,fabric);if(masks.size>24)masks.delete(masks.keys().next().value!);}
 const id=prefix+'-fabric-clearance',erode=id+'-erode';
 // SVG alpha compositing unions overlapping parts without fragile polygon booleans.
 return markup.replace(/(<svg[^>]*>)/,'$1'+`<defs><filter id="${erode}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><feMorphology operator="erode" radius="5"/></filter><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><g filter="url(#${erode})">${fabric}</g></mask></defs><g mask="url(#${id})">`).replace(/<\/svg>\s*$/,'</g></svg>');
}
