import {withTshirtSurfaceQuality} from './tshirtSurfaceQuality';
import type {TshirtHemStyles} from './tshirtHemStyles';
import type {NeckFinish} from './tshirtNeckFinish';
import polygonClipping,{type MultiPolygon,type Pair} from 'polygon-clipping';
import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
import {sampleSvgBoundaries,pointInLoop} from '../features/panelling/panellingGeometry';
import {livePanellingMarkup} from '../features/panelling/livePanellingGeometry';
export type ShoulderConstruction='set-in'|'raglan'|'saddle'|'drop';
export const SHOULDER_CONSTRUCTIONS=[{id:'set-in',name:'Set-in',hint:'Original shoulder seam'},{id:'raglan',name:'Raglan',hint:'Collar to underarm'},{id:'saddle',name:'Saddle',hint:'Shoulder strip into sleeve'},{id:'drop',name:'Drop shoulder',hint:'Seam sits further down the arm'}] as const;
const cache=new Map<string,ResolvedGarmentLayer[]>();
const sourceCache=new Map<string,{original:MultiPolygon;ls:MultiPolygon;rs:MultiPolygon;np:Pair[];joined?:MultiPolygon;torso?:MultiPolygon}>();
const wrap=(body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" data-shoulder-construction="true">${body}</svg>`;
function geometryPath(geometry:MultiPolygon){return geometry.map(p=>p.map(r=>'M'+r.map(p=>p.map(n=>Number(n.toFixed(2))).join(',')).join('L')+'Z').join('')).join('')}
/** Curved neck-to-underarm raglan; saddle retains a shoulder strip, drop moves the armscye out. */
export function shoulderSeam(kind:ShoulderConstruction,start:Pair,end:Pair):Pair[]{
 const dx=start[0]-end[0],dy=end[1]-start[1];
 if(kind==='saddle'){
 const elbow:Pair=[end[0]-70,start[1]+dy*.28];
 const first=Array.from({length:17},(_,i)=>{const t=i/16;return[start[0]+(elbow[0]-start[0])*t,start[1]+(elbow[1]-start[1])*t] as Pair});
 const last=Array.from({length:25},(_,i)=>{const t=i/24,u=1-t;return[u*u*elbow[0]+2*u*t*(end[0]-15)+t*t*end[0],u*u*elbow[1]+2*u*t*(end[1]-dy*.18)+t*t*end[1]] as Pair});return [...first,...last.slice(1)];
 }
 const c1:Pair=kind==='drop'?[start[0]-dx*.34,start[1]+dy*.34]:[start[0]-dx*.32,start[1]+dy*.28];
 const c2:Pair=kind==='drop'?[end[0]+dx*.22,end[1]-dy*.25]:[end[0],end[1]-dy*.20];
 return Array.from({length:49},(_,i)=>{const t=i/48,u=1-t;return[u*u*u*start[0]+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t*t*t*end[0],u*u*u*start[1]+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t*t*t*end[1]] as Pair});
}
export function partitionShoulderFabric(all:MultiPolygon,ls:MultiPolygon,rs:MultiPolygon,seam:Pair[],axis:number){
 const start=seam[0],end=seam.at(-1)!;
 const region:MultiPolygon=[[[[0,0],[start[0],0],...seam,[0,end[1]],[0,0]]]];
 const mirrored:MultiPolygon=region.map(p=>p.map(r=>r.map(([x,y])=>[axis*2-x,y] as Pair).reverse()));
 const lower:MultiPolygon=[[[[0,end[1]],[2048,end[1]],[2048,2048],[0,2048],[0,end[1]]]]];
 const left=polygonClipping.union(polygonClipping.intersection(all,region),polygonClipping.intersection(ls,lower));
 const right=polygonClipping.union(polygonClipping.intersection(all,mirrored),polygonClipping.intersection(rs,lower));
 return {left,right,body:polygonClipping.difference(all,left,right)};
}
function softenShoulderCaps(geometry:MultiPolygon,neckX:number,axis:number,top:number,underarm:number):MultiPolygon{
 return geometry.map(p=>p.map(r=>{
 const points:Pair[]=[];for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/5));for(let k=0;k<steps;k++)points.push([a[0]+(b[0]-a[0])*k/steps,a[1]+(b[1]-a[1])*k/steps]);}
 if(points.length<3)return r;
 const smooth=points.map((point,i)=>{if(point[1]>top+(underarm-top)*.72||point[1]<top+15||(point[0]>neckX-35&&point[0]<axis*2-neckX+35))return point;
 let x=0,y=0;for(let j=-9;j<=9;j++){const q=points[((i+j)%points.length+points.length)%points.length];x+=q[0];y+=q[1]}return[x/19,y/19] as Pair;});return [...smooth,smooth[0]];
 }));
}
/** Repartition the actual fabric surfaces, keeping existing part IDs, colours and material bindings. */
export function withShoulderConstruction(layers:ResolvedGarmentLayer[],kind:ShoulderConstruction='set-in',fit?:string,view:'front'|'back'='front',finish:NeckFinish='ribbed',hems?:TshirtHemStyles):ResolvedGarmentLayer[]{
 if(kind==='set-in'||typeof document==='undefined')return layers;
 layers=withTshirtSurfaceQuality(layers,fit,finish,view,hems);
 const sourceRaster=layers.some(l=>l.svgRaw.includes('data-raster-neck="true"'));
 const body=layers.find(l=>l.id==='base'),left=layers.find(l=>l.id==='sleeveLeft'),right=layers.find(l=>l.id==='sleeveRight'),neck=layers.find(l=>l.id==='neck');
 if(!body||!left||!right)return layers;
 const key=JSON.stringify([kind,layers]);const old=cache.get(key);if(old)return old;
 const geometryKey=JSON.stringify(layers.filter(l=>['base','sleeveLeft','sleeveRight','neck'].includes(l.id)).map(l=>[l.id,l.svgRaw]));
 let geometry=sourceCache.get(geometryKey);
 const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;width:2048px;height:2048px;visibility:hidden;pointer-events:none';
 if(!geometry)host.innerHTML=livePanellingMarkup(layers.filter(l=>['base','sleeveLeft','sleeveRight','neck'].includes(l.id)).map(source=>({id:source.id,source,matrix:'matrix(1 0 0 1 0 0)'})));if(!geometry)document.body.appendChild(host);
 try{
 const svg=host.querySelector('svg')!;
 const part=(id:string):MultiPolygon=>{const loops=sampleSvgBoundaries(svg,id,6),close=(p:{x:number;y:number}[]):Pair[]=>[...p,p[0]].map(p=>[p.x,p.y]);return loops.filter(l=>l.role==='outer').map(o=>[close(o.points),...loops.filter(l=>l.role==='hole'&&pointInLoop(l.points[0],o.points)).map(l=>close(l.points))])};
 if(!geometry){geometry={original:part('base'),ls:part('sleeveLeft'),rs:part('sleeveRight'),np:neck?part('neck').flat(2):[]};sourceCache.set(geometryKey,geometry);if(sourceCache.size>16)sourceCache.delete(sourceCache.keys().next().value!);}
 const {original,ls,rs,np}=geometry;if(!original.length||!ls.length||!rs.length)return layers;
 const towardBody=(g:MultiPolygon,dx:number):MultiPolygon=>g.map(p=>p.map(r=>r.map(([x,y])=>[x+dx,y] as Pair)));
 let all=geometry.joined??polygonClipping.union(original,ls,rs,towardBody(ls,6),towardBody(rs,-6));geometry.joined=all;
 const ownedBody=geometry.torso??polygonClipping.difference(original,ls,rs);const torso=ownedBody.length?ownedBody:original;geometry.torso=torso;const points=torso.flat(2);
 const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),top=Math.min(...points.map(p=>p[1])),bottom=Math.max(...points.map(p=>p[1])),axis=(minX+maxX)/2;
 const probe=top+(bottom-top)*.64, crossings:number[]=[];
 for(const polygon of torso)for(const ring of polygon)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if((a[1]<=probe&&b[1]>probe)||(b[1]<=probe&&a[1]>probe))crossings.push(a[0]+(b[0]-a[0])*(probe-a[1])/(b[1]-a[1]));}
 const chestX=crossings.length?Math.min(...crossings):minX+35;
 const candidates:Pair[]=[];
 for(const polygon of all)for(const ring of polygon)for(let i=1;i<ring.length-1;i++){
 const p=ring[i],before=ring[i-1],after=ring[i+1];
 if(p[1]>top+(bottom-top)*.22&&p[1]<top+(bottom-top)*.65&&Math.abs(p[0]-chestX)<55&&Math.abs(after[1]-before[1])>Math.abs(after[0]-before[0])*2)candidates.push(p);
 }
 const armpit=candidates.sort((a,b)=>a[1]-b[1])[0];const underX=armpit?.[0]??chestX,y=armpit?.[1]??top+(bottom-top)*.43;
 const neckX=np.length?Math.min(...np.map(p=>p[0])):axis-(maxX-minX)*.2,neckY=np.length?Math.min(...np.map(p=>p[1])):top;
 const neckSide=np.length?np.reduce((best,p)=>p[0]<best[0]?p:best,np[0]):[neckX,neckY+20];
 const neckBottom=np.length?Math.max(...np.map(p=>p[1])):neckSide[1]+180;
 const joinY=neckSide[1]+Math.min(90,Math.max(12,neckBottom-neckSide[1])*(view==='front'?.35:.55));
 const neckJoin=np.filter(p=>p[0]<axis).sort((a,b)=>(Math.abs(a[1]-joinY)*25+a[0])-(Math.abs(b[1]-joinY)*25+b[0]))[0]??neckSide;
 const saddlePoint=np.filter(p=>p[0]<axis).sort((a,b)=>(Math.abs(a[1]-neckSide[1]-45)*5+a[0])-(Math.abs(b[1]-neckSide[1]-45)*5+b[0]))[0];
 const capPoint=ls.flat(2).reduce((best,p)=>p[1]<best[1]?p:best,ls[0][0][0]);
 const dropY=capPoint[1]+(y-capPoint[1])*.3,dropXs:number[]=[];
 for(const polygon of all)for(const ring of polygon)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if((a[1]<=dropY&&b[1]>dropY)||(b[1]<=dropY&&a[1]>dropY))dropXs.push(a[0]+(b[0]-a[0])*(dropY-a[1])/(b[1]-a[1]));}
 const start:Pair=kind==='drop'?[dropXs.length?Math.min(...dropXs):underX-100,dropY]:kind==='saddle'&&saddlePoint?saddlePoint:neckJoin;
 const end:Pair=[underX,y];
 const seam=shoulderSeam(kind,start,end);
 all=softenShoulderCaps(all,neckX,axis,top,y);
 // The shoulder cut stops at the armpit. Below it, only the original sleeve owns fabric.
 // Continuing a vertical half-plane to the hem incorrectly colours flared torso sides.
 const partition=partitionShoulderFabric(all,ls,rs,seam,axis);
 const newLeft=partition.left,newRight=partition.right,newBody=partition.body;
 const paths={base:geometryPath(newBody),sleeveLeft:geometryPath(newLeft),sleeveRight:geometryPath(newRight)};
 const outer=(raw:string)=>{const root=new DOMParser().parseFromString(raw,'image/svg+xml').documentElement;root.querySelectorAll('[data-ink-repair],[data-sleeve-join],[data-sleeve-opening]').forEach(e=>e.remove());return root.innerHTML};
 const cap=neckX-12,capW=(axis-neckX)*2+24,capH=np.length?Math.max(...np.map(p=>p[1]))-neckY+24:240;
 const clipKey=`${kind}-${fit??'fit'}-${view}-${Math.round(cap)}-${Math.round(capH)}`;
 const preserveNeck=(raw:string)=>`<defs><clipPath id="shoulder-neck-keep-${clipKey}"><rect x="${cap}" y="${neckY-12}" width="${capW}" height="${capH}"/></clipPath></defs><g clip-path="url(#shoulder-neck-keep-${clipKey})">${outer(raw)}</g>`;
 const cutLines=Object.values(paths).map(d=>`<path d="${d}" fill="none" stroke="#202020" stroke-width="5" stroke-linejoin="round"/>`).join('');
 const result=layers.map(layer=>{
 if(layer.id in paths){const d=paths[layer.id as keyof typeof paths];return{...layer,measurementShoulder:layer.id==='sleeveLeft'?{x:(kind==='drop'?start:capPoint)[0],y:(kind==='drop'?start:capPoint)[1]}:layer.id==='sleeveRight'?{x:axis*2-(kind==='drop'?start:capPoint)[0],y:(kind==='drop'?start:capPoint)[1]}:undefined,displayName:layer.displayName+' · '+kind,svgRaw:wrap(`<g transform="matrix(1 0 0 1 0 0)" fill="#000000"><path fill-rule="evenodd" d="${d}"/></g>`),panellingClipSvgRaw:undefined,constructionSvg:undefined,stitchSvg:undefined};}
 if(layer.id==='outline')return{...layer,svgRaw:wrap(cutLines+preserveNeck(layer.svgRaw))};
 if(layer.id==='stitching'){const lines=[seam,seam.map(([x,y])=>[axis*2-x,y] as Pair)].map(r=>`<path d="M${r.map(([x,y])=>`${x+6},${y}`).join('L')}" fill="none" stroke="${layer.tint??'#aaa'}" stroke-width="2.5" stroke-dasharray="9 9"/>`).join('');return{...layer,svgRaw:wrap(`<defs><clipPath id="shoulder-stitch-keep-${clipKey}"><rect y="${y+20}" width="2048" height="2048"/><rect x="${cap}" y="${neckY-12}" width="${capW}" height="${capH}"/></clipPath></defs><g clip-path="url(#shoulder-stitch-keep-${clipKey})">${outer(layer.svgRaw)}</g>`+lines)};}
 return layer;});
 const ready=sourceRaster?result.map(l=>l.svgRaw.includes('data-shoulder-construction="true"')?{...l,svgRaw:l.svgRaw.replace('<svg ','<svg data-raster-neck="true" ')}:l):result;
 cache.set(key,ready);if(cache.size>12)cache.delete(cache.keys().next().value!);return ready;
 }finally{host.remove()}
}
