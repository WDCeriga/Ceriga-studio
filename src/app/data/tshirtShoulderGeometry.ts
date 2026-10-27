import {stablePolygonUnion} from '../lib/stablePolygonUnion';
import polygonClipping,{type MultiPolygon,type Pair} from 'polygon-clipping';
import simplify from 'simplify-js';
import svgpath from 'svgpath';
import {fabricRings} from './regularConstruction';
import {pointInLoop,signedArea} from '../features/panelling/panellingGeometry';
import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
type P={x:number;y:number};
export const shoulderGeometryPath=(geometry:MultiPolygon)=>geometry.map(p=>p.map(r=>'M'+r.map(([x,y])=>x.toFixed(3)+','+y.toFixed(3)).join('L')+'Z').join('')).join('');
export function shoulderFabricGeometry(raw:string):MultiPolygon{
 const rings=fabricRings(raw).filter(r=>Math.abs(signedArea(r))>1).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)));
 const depths=rings.map((r,i)=>rings.slice(0,i).filter(other=>pointInLoop(r[0],other)).length);
 return rings.flatMap((r,i)=>depths[i]%2?[]:[[r,...rings.filter((hole,j)=>depths[j]===depths[i]+1&&pointInLoop(hole[0],r))].map(loop=>[...loop,loop[0]].map(p=>[Number(p.x.toFixed(3)),Number(p.y.toFixed(3))] as Pair))]);
}
/** Round only convex shoulder/cap corners; keep the neckline, cuffs and torso untouched. */
export function roundedShoulderRing(ring:P[],neckLeft:number,neckRight:number,limitY:number,radius=32):P[]{
 const points=simplify(ring,1.8,true),orientation=Math.sign(signedArea(points));
 return points.flatMap((p,i)=>{
  const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];
  const incoming=Math.hypot(p.x-a.x,p.y-a.y),outgoing=Math.hypot(b.x-p.x,b.y-p.y);
  const cross=(p.x-a.x)*(b.y-p.y)-(p.y-a.y)*(b.x-p.x);
  if(p.y>limitY||(p.x>neckLeft-24&&p.x<neckRight+24)||cross*orientation<=0||incoming<4||outgoing<4)return[p];
  const amount=Math.min(radius,incoming*.40,outgoing*.40);
  const start={x:p.x+(a.x-p.x)*amount/incoming,y:p.y+(a.y-p.y)*amount/incoming};
  const end={x:p.x+(b.x-p.x)*amount/outgoing,y:p.y+(b.y-p.y)*amount/outgoing};
  return Array.from({length:9},(_,j)=>{const t=j/8,u=1-t;return{x:u*u*start.x+2*u*t*p.x+t*t*end.x,y:u*u*start.y+2*u*t*p.y+t*t*end.y}});
 });
}
const cache=new Map<string,ResolvedGarmentLayer[]>();
export function withRoundedShoulderCaps(layers:ResolvedGarmentLayer[]):ResolvedGarmentLayer[]{
 const key=JSON.stringify(layers);const hit=cache.get(key);if(hit)return hit;
 const ids=['base','sleeveLeft','sleeveRight'],parts=layers.filter(l=>ids.includes(l.id));
 const geometries=parts.map(l=>shoulderFabricGeometry(l.svgRaw)).filter(g=>g.length);
 const neck=layers.find(l=>l.id==='neck'),neckPoints=neck?fabricRings(neck.svgRaw).flat():[];
 if(geometries.length!==3||!neckPoints.length)return layers;
 const all=stablePolygonUnion(geometries[0],...geometries.slice(1));
 const pts=all.flat(2),top=Math.min(...pts.map(p=>p[1])),bottom=Math.max(...pts.map(p=>p[1]));
 const left=Math.min(...neckPoints.map(p=>p.x)),right=Math.max(...neckPoints.map(p=>p.x));
 const rounded=all.map(p=>p.map((r,i)=>i?r:[...roundedShoulderRing(r.slice(0,-1).map(([x,y])=>({x,y})),left,right,top+(bottom-top)*.29)].map(p=>[Number(p.x.toFixed(3)),Number(p.y.toFixed(3))] as Pair)));
 const result=layers.map(layer=>{
  if(!ids.includes(layer.id))return layer;
  const clipped=polygonClipping.intersection(shoulderFabricGeometry(layer.svgRaw),rounded);
  const doc=new DOMParser().parseFromString(layer.svgRaw,'image/svg+xml'),root=doc.documentElement;
  const group=Array.from(root.querySelectorAll('g[transform]')).find(g=>!g.closest('defs')) as SVGGraphicsElement|undefined;
  const paths=Array.from(group?.querySelectorAll('path')??[]).filter(p=>!p.closest('defs')),matrix=group?.transform.baseVal.consolidate()?.matrix;
  if(!paths.length||!matrix)return layer;
  root.setAttribute('data-rounded-shoulders','true');
  const inv=new DOMMatrix([matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f]).inverse();
  paths[0].setAttribute('d',svgpath(shoulderGeometryPath(clipped)).matrix([inv.a,inv.b,inv.c,inv.d,inv.e,inv.f]).toString());paths[0].setAttribute('fill-rule','evenodd');paths.slice(1).forEach(p=>p.remove());
  return {...layer,svgRaw:new XMLSerializer().serializeToString(root),panellingClipSvgRaw:undefined};
 });
 cache.set(key,result);if(cache.size>32)cache.delete(cache.keys().next().value!);return result;
}
