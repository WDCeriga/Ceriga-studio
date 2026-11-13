import {stablePolygonIntersection} from '../lib/stablePolygonUnion';
import simplify from 'simplify-js';
import svgpath from 'svgpath';
import {type MultiPolygon} from 'polygon-clipping';
import {shoulderFabricGeometry,shoulderGeometryPath} from './tshirtShoulderGeometry';
import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
const cache=new WeakMap<ResolvedGarmentLayer[],ResolvedGarmentLayer[]>();
/** One straight opening owns the sleeve and its folded band; no second protruding cuff edge. */
export function withCleanSleeveOpenings(layers:ResolvedGarmentLayer[]):ResolvedGarmentLayer[]{
 const old=cache.get(layers);if(old)return old;
 const body=layers.find(l=>l.id==='base'),bodyBottom=body?Math.max(...shoulderFabricGeometry(body.svgRaw).flat(2).map(p=>p[1])):NaN;
 const replacements=new Map<string,MultiPolygon>(),stitchRows=new Map<string,string>(),openingRows=new Map<string,string>();
 const outerCuffs=new Map<string,{nx:number;ny:number;cut:number;from?:number;to?:number}>();
 for(const side of ['Left','Right'])for(const prefix of ['sleeve','underSleeve']){
  const sleeveId=prefix+side,hemId=(prefix==='sleeve'?'sleeveHem':'underlayerHem')+side;
  const sleeve=layers.find(l=>l.id===sleeveId),hem=layers.find(l=>l.id===hemId);if(!sleeve||!hem)continue;
  let sg=shoulderFabricGeometry(sleeve.svgRaw);const hg=shoulderFabricGeometry(hem.svgRaw),points=hg.flat(2);if(points.length<4||!sg.length)continue;
  const outer=prefix==='underSleeve'?outerCuffs.get(side):undefined;
  if(outer){const ux=outer.ny,uy=-outer.nx,values=sg.flat(2).map(([x,y])=>({t:x*ux+y*uy,n:x*outer.nx+y*outer.ny})),top=Math.min(...values.map(p=>p.n)),upper=values.filter(p=>p.n<top+40),a=Math.max(Math.min(...upper.map(p=>p.t)),(outer.from??-Infinity)+8),b=Math.min(Math.max(...upper.map(p=>p.t)),(outer.to??Infinity)-8),point=(t:number,n:number):[number,number]=>[t*ux+n*outer.nx,t*uy+n*outer.ny],start=Math.min(outer.cut-16,top-8),end=top+40;
   const sourceBottom=Math.max(...sg.flat(2).map(p=>p[1])),bottom=Number.isFinite(bodyBottom)?bodyBottom:sourceBottom,wrist=sg.flat(2).filter(p=>p[1]>=sourceBottom-8),left=Math.min(...wrist.map(p=>p[0])),right=Math.max(...wrist.map(p=>p[0]));
   if(Number.isFinite(left)&&right-left>12){const topLeft=point(a,start),topRight=point(b,start);sg=[[[topLeft,topRight,[right,bottom],[left,bottom],topLeft]]];}

  }

  const mean=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);
  let xx=0,xy=0,yy=0;for(const p of points){const x=p[0]-mean[0],y=p[1]-mean[1];xx+=x*x;xy+=x*y;yy+=y*y}
  let angle=.5*Math.atan2(2*xy,xx-yy);
  const direction={x:Math.cos(angle),y:Math.sin(angle)};let longest=0,openingPoint:{x:number;y:number}|undefined;
  for(const poly of sg){const ring=simplify(poly[0].slice(0,-1).map(([x,y])=>({x,y})),2,true);for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),near=Math.hypot((a.x+b.x)/2-mean[0],(a.y+b.y)/2-mean[1]);if(length>longest&&near<180&&Math.abs((dx*direction.x+dy*direction.y)/(length||1))>.94){angle=Math.atan2(dy,dx);if(Math.cos(angle)<0)angle+=Math.PI;longest=length;openingPoint={x:(a.x+b.x)/2,y:(a.y+b.y)/2};}}}
  const nx=-Math.sin(angle),ny=Math.cos(angle);
  const offsets=points.map(p=>p[0]*nx+p[1]*ny).sort((a,b)=>a-b),low=offsets[0],high=offsets.at(-1)!,depth=high-low;
  if(depth<1||depth>180)continue;
  const sleevePoints=sg.flat(2),cut=(openingPoint?openingPoint.x*nx+openingPoint.y*ny:Math.max(...sleevePoints.map(([x,y])=>x*nx+y*ny)))-1.5;
  if(prefix==='sleeve')outerCuffs.set(side,{nx,ny,cut});
  const authoredDepth = hem.svgRaw.includes('data-live-hem-finish=');
  const ux=ny,uy=-nx,ts=sleevePoints.map(([x,y])=>x*ux+y*uy),a=Math.min(...ts)-10,b=Math.max(...ts)+10;
  const bandDepth = authoredDepth ? depth : Math.max(14, Math.min(64, depth));
  const point=(t:number,n:number):[number,number]=>[t*ux+n*nx,t*uy+n*ny];
  const strip:MultiPolygon=[[[point(a,cut-bandDepth),point(b,cut-bandDepth),point(b,cut),point(a,cut),point(a,cut-bandDepth)]]];
  const clean=(g:MultiPolygon):MultiPolygon=>g.map(poly=>poly.map(r=>r.map(([x,y])=>{const d=x*nx+y*ny-cut;return d>0?[x-d*nx,y-d*ny]:[x,y]})));
  const cleaned=clean(sg);replacements.set(sleeveId,cleaned);
  const band=stablePolygonIntersection(strip,cleaned);replacements.set(hemId,band);
  const n=cut-bandDepth+Math.max(3,Math.min(6,bandDepth*.2)),hits:number[]=[];
  for(const poly of band)for(const ring of poly)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],an=a[0]*nx+a[1]*ny,bn=b[0]*nx+b[1]*ny;if((an>n)!==(bn>n)){const t=(n-an)/(bn-an),x=a[0]+t*(b[0]-a[0]),y=a[1]+t*(b[1]-a[1]);hits.push(x*ux+y*uy);}}
  hits.sort((a,b)=>a-b);let from=0,to=0;for(let i=0;i+1<hits.length;i+=2)if(hits[i+1]-hits[i]>to-from){from=hits[i];to=hits[i+1];}
  const edgeHits:number[]=[],edgeN=cut-.01;for(const poly of band)for(const ring of poly)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],an=a[0]*nx+a[1]*ny,bn=b[0]*nx+b[1]*ny;if((an>edgeN)!==(bn>edgeN)){const t=(edgeN-an)/(bn-an);edgeHits.push((a[0]+t*(b[0]-a[0]))*ux+(a[1]+t*(b[1]-a[1]))*uy);}}
  if(edgeHits.length>1){const lo=Math.min(...edgeHits),hi=Math.max(...edgeHits),a=point(lo+3.5,cut),b=point(hi-3.5,cut);openingRows.set(hemId,`M${a[0]},${a[1]}L${b[0]},${b[1]}`);if(prefix==='sleeve')outerCuffs.set(side,{nx,ny,cut,from:lo,to:hi});}
  if(to-from>12){const a=point(from+Math.min(8,(to-from)*.08),n),b=point(to-Math.min(8,(to-from)*.08),n);stitchRows.set(hemId,`M${a[0]},${a[1]}L${b[0]},${b[1]}`);}
 }
 const result=layers.map(layer=>{
  const geometry=replacements.get(layer.id);if(!geometry?.length)return layer;
  const doc=new DOMParser().parseFromString(layer.svgRaw,'image/svg+xml'),group=Array.from(doc.querySelectorAll('g[transform]')).find(g=>!g.closest('defs')) as SVGGraphicsElement|undefined;
  // The cleaned panel includes its complete cuff; the old allowance would add
  // a second, displaced cuff below it and turn the exterior into a fold line.
  doc.querySelectorAll('[data-hem-allowance]').forEach(p=>p.remove());
  const paths=group?Array.from(group.querySelectorAll('path')).filter(p=>!p.closest('defs')):[],m=group?.transform.baseVal.consolidate()?.matrix;
  if(!paths.length||!m)return layer;
  const inverse=new DOMMatrix([m.a,m.b,m.c,m.d,m.e,m.f]).inverse();
  const boundary = shoulderGeometryPath(geometry);
  paths[0].setAttribute('d',svgpath(boundary).matrix([inverse.a,inverse.b,inverse.c,inverse.d,inverse.e,inverse.f]).toString());
  paths[0].setAttribute('fill-rule','evenodd');
  // Preserve the authored shared seam marker, not obsolete extra fabric fragments.
  paths.slice(1).filter(p=>!p.hasAttribute('data-sleeve-join')&&!p.hasAttribute('data-sleeve-opening')).forEach(p=>p.remove());
  const row=stitchRows.get(layer.id);doc.querySelectorAll('[data-cuff-stitch-row]').forEach(p=>p.remove());if(row){const marker=doc.createElementNS('http://www.w3.org/2000/svg','path');marker.setAttribute('data-cuff-stitch-row','true');marker.setAttribute('fill','none');marker.setAttribute('d',row);const definitions=doc.createElementNS('http://www.w3.org/2000/svg','defs');definitions.appendChild(marker);doc.documentElement.appendChild(definitions);}
  const opening=openingRows.get(layer.id);
  if(opening){
   doc.querySelectorAll('[data-sleeve-opening]').forEach(p=>{p.removeAttribute('transform');p.setAttribute('d',opening);doc.documentElement.appendChild(p);});
   const marker=doc.createElementNS('http://www.w3.org/2000/svg','path');
   marker.setAttribute('data-terminal-opening','true');
   marker.setAttribute('fill','none');
   marker.setAttribute('d',opening);
   doc.documentElement.appendChild(marker);
  }
  for (const marker of doc.querySelectorAll('[data-hem-clearance],[data-hem-rib-clip]')) {
    marker.removeAttribute('transform');
    marker.setAttribute('d', boundary);
    doc.documentElement.appendChild(marker);
  }
  doc.querySelectorAll('[data-hem-top-seam],[data-hem-edge]').forEach(p=>p.remove());
  doc.documentElement.setAttribute('data-clean-sleeve-opening','true');
  return {...layer,svgRaw:new XMLSerializer().serializeToString(doc.documentElement),panellingClipSvgRaw:undefined};
 });cache.set(layers,result);return result;
}
