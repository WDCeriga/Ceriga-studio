import svgpath from 'svgpath';
import {flattenPathContours} from '../features/panelling/panellingGeometry';
import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
import {shoulderFabricGeometry,shoulderGeometryPath} from './tshirtShoulderGeometry';
import {rawNeckBoundary} from './rawNeckEdge';
const cache=new WeakMap<ResolvedGarmentLayer[],ResolvedGarmentLayer[]>();
const upperNeckCache=new WeakMap<ResolvedGarmentLayer[],ResolvedGarmentLayer[]>();
/** The traced collar owns collar ink. Live fabric boundaries own the garment outline.
 * Old silhouette and cuff ink must not remain after changing fit or sleeve construction. */
export function withGarmentOutlineOwnership(layers:ResolvedGarmentLayer[], cleanUpperNeck=false):ResolvedGarmentLayer[]{
 const results=cleanUpperNeck?upperNeckCache:cache;
 const cached=results.get(layers);if(cached)return cached;
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
 const tracedRim=cleanUpperNeck?rawNeckBoundary(collars.map(([ring])=>ring.map(([x,y])=>({x,y}))), 'back'):[];
 // Keep the shoulder joins from the original drawing. Mirror the clean half
 // only between the collar ends, where the traced rear rim can be doubled.
 const neckName=layers.find(layer=>layer.id==='neck')?.displayName??'';
 const polo=/polo/i.test(neckName);
 const margin=tracedRim.length>2?Math.min(1024-tracedRim[0].x,tracedRim.at(-1)!.x-1024)-(polo?8:28):0;
 const leftRim=tracedRim.filter(p=>p.x>=1024-margin&&p.x<1024).map((p,i,run)=>{
  const neighbours=run.slice(Math.max(0,i-2),i+3);
  return {...p,y:neighbours.reduce((sum,q)=>sum+q.y,0)/neighbours.length};
 });
 const rim=leftRim.length>2?[...leftRim,{x:1024,y:leftRim.at(-1)!.y},
  ...leftRim.slice().reverse().map(p=>({x:2048-p.x,y:p.y}))]:[];
 const scoop=/scoop/i.test(neckName);
 const strokeRim=rim.map((p,i)=>{
  const t=i/(rim.length-1);
  const seat=scoop?2+7*Math.exp(-((t-.90)**2)/.011):2;
  return {...p,y:p.y+seat*Math.min(1,i/3,(rim.length-1-i)/2)};
 });
 const inkCut=polo ? tracedRim.filter(p=>p.x>=1024+margin*.61&&p.x<=1024+margin).map(p=>({...p,y:p.y-2}))
  : strokeRim.map((p,i)=>({...p,y:p.y+7*Math.min(1,i/4,(rim.length-1-i)/4)}));
 const below=(points:{x:number;y:number}[],offset:number)=>points.length>2
  ?'M0,0H'+points[0].x+'V'+(points[0].y+offset)+'L'+points.slice(1).map(p=>p.x.toFixed(3)+','+(p.y+offset).toFixed(3)).join('L')+'V0H2048V2048H0Z':'';
 const paintCut=below(edge,0);
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
  if(inkCut.length>2){
   const upperClip=doc.createElementNS(ns,'clipPath'),boundary=doc.createElementNS(ns,'path'),wrapper=doc.createElementNS(ns,'g');
   upperClip.setAttribute('id',key+'-upper');boundary.setAttribute('d',below(inkCut,0));
   upperClip.appendChild(boundary);defs.appendChild(upperClip);
   wrapper.setAttribute('clip-path',`url(#${key}-upper)`);wrapper.appendChild(group);root.appendChild(wrapper);
   const marker=doc.createElementNS(ns,'path');
   marker.setAttribute('data-upper-neck-clip','true');marker.setAttribute('fill','none');marker.setAttribute('d',below(inkCut,0));
   root.appendChild(marker);
   if(!polo){
    // One continuous outline across the repaired span, without a seam at centre.
    const continuation=strokeRim.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
    const restored=doc.createElementNS(ns,'path');
    restored.setAttribute('data-restored-upper-neck','true');
    restored.setAttribute('d','M'+continuation.join('L'));
    restored.setAttribute('fill','none');restored.setAttribute('stroke','#202020');
    restored.setAttribute('stroke-width','4');restored.setAttribute('stroke-linecap','round');
    restored.setAttribute('stroke-linejoin','round');
    root.appendChild(restored);
   }
  }
  return {...layer,svgRaw:new XMLSerializer().serializeToString(root)};
 });results.set(layers,result);return result;
}
