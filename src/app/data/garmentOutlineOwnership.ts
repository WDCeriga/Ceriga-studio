import svgpath from 'svgpath';
import {flattenPathContours} from '../features/panelling/panellingGeometry';
import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
import {shoulderFabricGeometry,shoulderGeometryPath} from './tshirtShoulderGeometry';
const cache=new WeakMap<ResolvedGarmentLayer[],ResolvedGarmentLayer[]>();
/** The traced collar owns collar ink. Live fabric boundaries own the garment outline.
 * Old silhouette and cuff ink must not remain after changing fit or sleeve construction. */
export function withGarmentOutlineOwnership(layers:ResolvedGarmentLayer[]):ResolvedGarmentLayer[]{
 const cached=cache.get(layers);if(cached)return cached;
 const collars=layers.filter(l=>l.id==='neck'||l.id==='innerBackNeck').flatMap(l=>shoulderFabricGeometry(l.svgRaw).map(poly=>[poly[0]]));
 if(!collars.length)return layers;
 const d=shoulderGeometryPath(collars),key='live-collar-ink-'+Array.from(d).reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,0).toString(36);
 // Read the actual ink in world coordinates. Fabric and ink traces can differ
 // by a few units, so the fabric footprint alone cannot define this boundary.
 const ink=layers.find(l=>l.id==='outline');
 const inkDoc=ink?new DOMParser().parseFromString(ink.svgRaw,'image/svg+xml'):undefined;
 const rings=Array.from(inkDoc?.querySelectorAll('path')??[]).filter(p=>!p.closest('defs,mask,clipPath')&&p.getAttribute('fill')!=='none').flatMap(p=>{
  const transforms:string[]=[];for(let n:Element|null=p;n&&n!==inkDoc!.documentElement;n=n.parentElement)if(n.hasAttribute('transform'))transforms.unshift(n.getAttribute('transform')!);
  return flattenPathContours(svgpath(p.getAttribute('d')??'').transform(transforms.join(' ')).toString(),1);
 });
 const cp=collars.flat(2),left=Math.min(...cp.map(p=>p[0]))-10,right=Math.max(...cp.map(p=>p[0]))+10;
 const edge:{x:number;y:number}[]=[];
 for(let x=left;x<=right;x+=2){const hits:number[]=[];for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if((a.x>x)!==(b.x>x))hits.push(a.y+(x-a.x)*(b.y-a.y)/(b.x-a.x));}if(hits.length)edge.push({x,y:Math.min(...hits)+1.2});}
 const paintCut=edge.length>2?'M0,0H'+edge[0].x+'V'+edge[0].y+'L'+edge.slice(1).map(p=>p.x.toFixed(3)+','+p.y.toFixed(3)).join('L')+'V0H2048V2048H0Z':'';
 const result=layers.map(layer=>{
  if(layer.id!=='outline'&&layer.kind==='solid'&&paintCut){
   const id=key+'-paint-'+layer.id,cut='<defs><mask id="'+id+'" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><path d="'+paintCut+'" fill="white"/></mask></defs>';
   return {...layer,necklinePaintMask:cut};
  }

  if(layer.id!=='outline'||layer.svgRaw.includes('data-outline-ownership'))return layer;
  const doc=new DOMParser().parseFromString(layer.svgRaw,'image/svg+xml'),root=doc.documentElement;if(root.querySelector('parsererror'))return layer;
  const ns='http://www.w3.org/2000/svg',defs=doc.createElementNS(ns,'defs'),mask=doc.createElementNS(ns,'mask'),path=doc.createElementNS(ns,'path'),group=doc.createElementNS(ns,'g');
  mask.setAttribute('id',key);mask.setAttribute('maskUnits','userSpaceOnUse');mask.setAttribute('x','0');mask.setAttribute('y','0');mask.setAttribute('width','2048');mask.setAttribute('height','2048');
  path.setAttribute('d',d);path.setAttribute('fill','white');path.setAttribute('stroke','white');path.setAttribute('stroke-width','8');path.setAttribute('stroke-linejoin','round');mask.appendChild(path);defs.appendChild(mask);
  for(const child of Array.from(root.childNodes))group.appendChild(child);group.setAttribute('mask',`url(#${key})`);root.appendChild(defs);root.appendChild(group);root.setAttribute('data-outline-ownership','live-boundaries');
  return {...layer,svgRaw:new XMLSerializer().serializeToString(root)};
 });cache.set(layers,result);return result;
}
