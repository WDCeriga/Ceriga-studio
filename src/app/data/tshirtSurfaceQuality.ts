import {constructSleeveFamily} from './tshirtSleeveConstruction';
import svgpath from 'svgpath';
import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
import {fabricRings} from './regularConstruction';
import {technicalContourPath} from '../features/panelling/TechnicalLinework';
import {pointInLoop,signedArea,flattenPathContours} from '../features/panelling/panellingGeometry';
const fabricCache=new Map<string,string>();
const bodyCache=new Map<string,string>();
const remember=(cache:Map<string,string>,key:string,value:string)=>{if(cache.size>80)cache.delete(cache.keys().next().value!);cache.set(key,value);return value;};
const path=(points:{x:number;y:number}[])=>'M'+points.map(p=>p.x.toFixed(3)+','+p.y.toFixed(3)).join('L')+'Z';
/** Repair fabric only for authored sleeves. Never rewrite collar/body path data. */
export function cleanSleeveFabric(layer:ResolvedGarmentLayer,tolerance=3.2,underBounds?:{minX:number;maxX:number}):ResolvedGarmentLayer{
 if(!/^((?:sleeve|sleeveHem|underSleeve|underlayerHem)(?:Left|Right))$/.test(layer.id))return layer;
 const key=tolerance+':'+JSON.stringify(underBounds)+':'+layer.id+':'+layer.svgRaw,cached=fabricCache.get(key);if(cached)return {...layer,svgRaw:cached,panellingClipSvgRaw:undefined};
 const rings=fabricRings(layer.svgRaw).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)));
 if(!rings.length)return layer;
 const doc=new DOMParser().parseFromString(layer.svgRaw,'image/svg+xml'),root=doc.documentElement;
 const group=[...root.querySelectorAll('g[transform]')].find(e=>!e.closest('defs')) as SVGGraphicsElement|undefined;
 const ink=group?.querySelector('path');if(!group||!ink)return layer;
 const matrix=group.transform.baseVal.consolidate()?.matrix;if(!matrix)return layer;
 const inverse=new DOMMatrix([matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f]).inverse();
 let contour=technicalContourPath(rings[0],true,tolerance);
 if(layer.id.startsWith('underSleeve')){const xs=rings[0].map(p=>p.x),ys=rings[0].map(p=>p.y),a=Math.min(...xs),b=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);contour=path([{x:a,y:top},{x:b,y:top},{x:b,y:bottom},{x:a,y:bottom}]);}
 if(/Hem/.test(layer.id)){
  const pts=rings[0],cx=pts.reduce((n,p)=>n+p.x,0)/pts.length,cy=pts.reduce((n,p)=>n+p.y,0)/pts.length;
  const xx=pts.reduce((n,p)=>n+(p.x-cx)**2,0),yy=pts.reduce((n,p)=>n+(p.y-cy)**2,0),xy=pts.reduce((n,p)=>n+(p.x-cx)*(p.y-cy),0),angle=.5*Math.atan2(2*xy,xx-yy),ux=Math.cos(angle),uy=Math.sin(angle),nx=-uy,ny=ux;
  const ts=pts.map(p=>p.x*ux+p.y*uy),ns=pts.map(p=>p.x*nx+p.y*ny),a=Math.min(...ts),b=Math.max(...ts),top=Math.min(...ns),bottom=Math.max(...ns);
  contour=path([[a,top],[b,top],[b,bottom],[a,bottom]].map(([t,n])=>({x:t*ux+n*nx,y:t*uy+n*ny})));
  if(underBounds){const ys=pts.map(p=>p.y),top=Math.min(...ys),bottom=Math.max(...ys);contour=path([{x:underBounds.minX,y:top},{x:underBounds.maxX,y:top},{x:underBounds.maxX,y:bottom},{x:underBounds.minX,y:bottom}]);}
 }
 const clean=svgpath(contour).matrix([inverse.a,inverse.b,inverse.c,inverse.d,inverse.e,inverse.f]).toString();
 ink.setAttribute('d',clean);ink.setAttribute('fill-rule','nonzero');
 // The sleeve silhouette is a solid fabric panel: tiny traced inner loops are not holes.
 return {...layer,svgRaw:remember(fabricCache,key,new XMLSerializer().serializeToString(root)),panellingClipSvgRaw:undefined};
}
/** Clean torso edges while retaining every vertex near the original neck opening. */
function cleanBodyFabric(layer:ResolvedGarmentLayer):ResolvedGarmentLayer{
 if(layer.id!=='base')return layer;
 const cached=bodyCache.get(layer.svgRaw);if(cached)return {...layer,svgRaw:cached,panellingClipSvgRaw:undefined};
 const doc=new DOMParser().parseFromString(layer.svgRaw,'image/svg+xml'),root=doc.documentElement;
 const group=[...root.querySelectorAll('g[transform]')].find(e=>!e.closest('defs')) as SVGGraphicsElement|undefined;
 const shape=group?.querySelector('path'),matrix=group?.transform.baseVal.consolidate()?.matrix;
 if(!shape||!matrix)return layer;
 const parts=(shape.getAttribute('d')??'').match(/M[^M]*/g);if(!parts?.length)return layer;
 const transformed=parts.map(part=>flattenPathContours(svgpath(part).matrix([matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f]).toString(),2)[0]??[]);
 const index=transformed.reduce((best,ring,i)=>Math.abs(signedArea(ring))>Math.abs(signedArea(transformed[best]))?i:best,0);
 if(!transformed[index].length)return layer;
 const inverse=new DOMMatrix([matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f]).inverse();
 parts[index]=svgpath(technicalContourPath(transformed[index],true,8,p=>p.x>700&&p.x<1348&&p.y<900)).matrix([inverse.a,inverse.b,inverse.c,inverse.d,inverse.e,inverse.f]).toString();
 shape.setAttribute('d',parts.join(''));
 return {...layer,svgRaw:remember(bodyCache,layer.svgRaw,new XMLSerializer().serializeToString(root)),panellingClipSvgRaw:undefined};
}
/** Preserve source collar ink exactly; replace only garment body/sleeve ink. */
export function withTshirtSurfaceQuality(layers:ResolvedGarmentLayer[],fit?:string):ResolvedGarmentLayer[]{
 const sleeve=layers.find(l=>l.id==='sleeveLeft')?.assetId??'';
 const reference=fit==='slim'&&!layers.some(l=>l.id==='underSleeveLeft')&&!/:(long|longer-short|cap)(?::|$)/.test(sleeve);
 if(reference)return layers;
 const smoothed=layers.map(l=>{const parent=l.id.startsWith('underlayerHem')?layers.find(p=>p.id===l.id.replace('underlayerHem','underSleeve')):undefined,ring=parent?fabricRings(parent.svgRaw).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)))[0]:undefined;const underBounds=ring?{minX:Math.min(...ring.map(p=>p.x)),maxX:Math.max(...ring.map(p=>p.x))}:undefined;return cleanBodyFabric(cleanSleeveFabric(l,8,underBounds));});
 const cleaned=constructSleeveFamily(smoothed,fit);
 const rings=cleaned.filter(l=>['neck','innerBackNeck'].includes(l.id)).flatMap(l=>fabricRings(l.svgRaw));
 const outer=rings.filter((ring,i)=>!rings.some((other,j)=>i!==j&&Math.abs(signedArea(other))>Math.abs(signedArea(ring))&&pointInLoop(ring[0],other)));
 if(!outer.length)return cleaned; // An unsupported collar must retain its original ink.
 const preserve=outer.map(path).join(''),keepId='tshirt-original-collar-'+Array.from(preserve).reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,0).toString(36);
 return cleaned.map(layer=>{
  if(layer.id!=='outline')return layer;
  const mask='<defs><mask id="'+keepId+'" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><path fill="white" stroke="white" stroke-width="6" stroke-linejoin="round" d="'+preserve+'"/></mask></defs>';
  const raw=layer.svgRaw.replace(/data-ink-repair="true"/g,'data-old-ink-repair="true"').replace(/(<svg[^>]*>)/,'$1'+mask+'<g mask="url(#'+keepId+')">').replace(/<\/svg>\s*$/,'</g><path data-ink-preserve="true" fill="none" d="'+preserve+'"/><path data-ink-repair="true" fill="none" d="M0 0H2048V2048H0Z"/></svg>');
  return {...layer,svgRaw:raw};
 });
}
