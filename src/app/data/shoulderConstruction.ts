import svgpath from 'svgpath';
import {flattenPathContours} from '../features/panelling/panellingGeometry';
import {withRegularConstruction} from './regularConstruction';
import {withTshirtSurfaceQuality} from './tshirtSurfaceQuality';
import type {TshirtHemStyles} from './tshirtHemStyles';
import type {NeckFinish} from './tshirtNeckFinish';
import polygonClipping,{type MultiPolygon,type Pair} from 'polygon-clipping';
import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
import {shoulderFabricGeometry} from './tshirtShoulderGeometry';
import {livePanellingMarkup} from '../features/panelling/livePanellingGeometry';
export type ShoulderConstruction='set-in'|'raglan'|'saddle'|'drop';
export const SHOULDER_CONSTRUCTIONS=[{id:'set-in',name:'Set-in',hint:'Original shoulder seam'},{id:'raglan',name:'Raglan',hint:'Collar to underarm'},{id:'saddle',name:'Saddle',hint:'Shoulder strip into sleeve'},{id:'drop',name:'Drop shoulder',hint:'Seam sits further down the arm'}] as const;
const cache=new Map<string,ResolvedGarmentLayer[]>();
const sourceCache=new Map<string,{original:MultiPolygon;ls:MultiPolygon;rs:MultiPolygon;np:Pair[];joined?:MultiPolygon;torso?:MultiPolygon}>();
const wrap=(body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" data-shoulder-construction="true" data-tech-ink-boldness="0">${body}</svg>`;
function geometryPath(geometry:MultiPolygon){return geometry.map(p=>p.map(r=>'M'+r.map(p=>p.map(n=>Number(n.toFixed(2))).join(',')).join('L')+'Z').join('')).join('')}
/** Curved neck-to-underarm raglan; saddle retains a shoulder strip, drop moves the armscye out. */
export function shoulderSeamCurves(kind: ShoulderConstruction, start: Pair, end: Pair): [Pair, Pair, Pair, Pair][] {
  const dx = start[0] - end[0];
  const dy = end[1] - start[1];
  if (kind === 'saddle') {
    const bend: Pair = [end[0] - Math.abs(dx) * .04, start[1] + dy * .35];
    return [
      [start, [start[0] - dx * .45, start[1] + dy * .10], [bend[0], start[1] + dy * .20], bend],
      [bend, [bend[0], start[1] + dy * .53], [end[0], end[1] - dy * .22], end],
    ];
  }
  if (kind === 'drop') {
    return [[start, [start[0] - dx * .34, start[1] + dy * .34], [end[0] + dx * .22, end[1] - dy * .25], end]];
  }
  return [[start, [start[0] - dx * .32, start[1] + dy * .28], [end[0], end[1] - dy * .20], end]];
}

export function shoulderSeam(kind: ShoulderConstruction, start: Pair, end: Pair): Pair[] {
  const curves = shoulderSeamCurves(kind, start, end);
  const steps = 48 / curves.length;
  return curves.flatMap(([a, b, c, d], index) =>
    Array.from({ length: steps + 1 - index }, (_, i) => {
      const t = (i + index) / steps;
      const u = 1 - t;
      return a.map((v, axis) => u * u * u * v + 3 * u * u * t * b[axis]
        + 3 * u * t * t * c[axis] + t * t * t * d[axis]) as Pair;
    }));
}
/** Close the underarm only as far as the original sleeve attachment allows. */
export function completeShoulderJoin(seam:Pair[],endpoint?:Pair):Pair[]{
 const end=seam.at(-1);return end&&endpoint&&endpoint[1]>end[1]+.5?[...seam,endpoint]:seam;
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
/** Repartition the actual fabric surfaces, keeping existing part IDs, colours and material bindings. */
export function withShoulderConstruction(layers:ResolvedGarmentLayer[],kind:ShoulderConstruction='set-in',fit?:string,view:'front'|'back'='front',finish:NeckFinish='ribbed',hems?:TshirtHemStyles,joinDepth=0):ResolvedGarmentLayer[]{
 if((kind==='set-in'&&!['boxy','oversized'].includes(fit??''))||typeof document==='undefined')return layers;
 layers=withTshirtSurfaceQuality(fit==='regular'?withRegularConstruction(layers):layers,fit,finish,view,hems);
 const sourceRaster=layers.some(l=>l.svgRaw.includes('data-raster-neck="true"'));
 const body=layers.find(l=>l.id==='base'),left=layers.find(l=>l.id==='sleeveLeft'),right=layers.find(l=>l.id==='sleeveRight'),neck=layers.find(l=>l.id==='neck');
 if(!body||!left||!right)return layers;
 const key=JSON.stringify([kind,joinDepth,layers]);const old=cache.get(key);if(old)return old;
 const geometryKey=JSON.stringify(layers.filter(l=>['base','sleeveLeft','sleeveRight','neck'].includes(l.id)).map(l=>[l.id,l.svgRaw]));
 let geometry=sourceCache.get(geometryKey);
 if(!geometry){geometry={original:shoulderFabricGeometry(body.svgRaw),ls:shoulderFabricGeometry(left.svgRaw),rs:shoulderFabricGeometry(right.svgRaw),np:neck?shoulderFabricGeometry(neck.svgRaw).flat(2):[]};sourceCache.set(geometryKey,geometry);if(sourceCache.size>16)sourceCache.delete(sourceCache.keys().next().value!);}
 const {original,ls,rs,np}=geometry;if(!original.length||!ls.length||!rs.length)return layers;
 // The prepared body and sleeves already share attachment coordinates. Moving
 // whole sleeves inward to bridge a join also moves their shoulder tips, leaving
 // a visible step on the exterior. Partition only the actual fabric silhouette.
 let all=geometry.joined??polygonClipping.union(original,ls,rs);
 geometry.joined=all;
 const ownedBody=geometry.torso??polygonClipping.difference(original,ls,rs);const torso=ownedBody.length?ownedBody:original;geometry.torso=torso;const points=torso.flat(2);
 const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),top=Math.min(...points.map(p=>p[1])),bottom=Math.max(...points.map(p=>p[1])),axis=1024;
 const probe=top+(bottom-top)*.64, crossings:number[]=[];
 for(const polygon of torso)for(const ring of polygon)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if((a[1]<=probe&&b[1]>probe)||(b[1]<=probe&&a[1]>probe))crossings.push(a[0]+(b[0]-a[0])*(probe-a[1])/(b[1]-a[1]));}
 const chestX=crossings.length?Math.min(...crossings):minX+35;
 const candidates:Pair[]=[];
 for(const polygon of all)for(const ring of polygon)for(let i=1;i<ring.length-1;i++){
 const p=ring[i],before=ring[i-1],after=ring[i+1];
 if(p[1]>top+(bottom-top)*.22&&p[1]<top+(bottom-top)*.65&&Math.abs(p[0]-chestX)<55&&Math.abs(after[1]-before[1])>Math.abs(after[0]-before[0])*2)candidates.push(p);
 }
 let endpoint:Pair|undefined;
 const sourceRoot=new DOMParser().parseFromString(left.svgRaw,'image/svg+xml').documentElement;
 const sourceJoin=sourceRoot.querySelector('[data-sleeve-join]');
 if(sourceJoin){
  const transforms:string[]=[];for(let el:Element|null=sourceJoin;el&&el!==sourceRoot;el=el.parentElement)if(el.hasAttribute('transform'))transforms.unshift(el.getAttribute('transform')!);

  svgpath(sourceJoin.getAttribute('d')??'').abs().unshort().unarc().transform(transforms.join(' ')).iterate(segment=>{const v=segment.slice(1) as number[];if(['M','L','C','Q'].includes(segment[0]))endpoint=[v[v.length-2],v[v.length-1]];});

 }
 const armpit=candidates.sort((a,b)=>a[1]-b[1])[0];const underX=endpoint?.[0]??armpit?.[0]??chestX,y=endpoint?.[1]??armpit?.[1]??top+(bottom-top)*.43;
 const neckX=np.length?Math.min(...np.map(p=>p[0])):axis-(maxX-minX)*.2,neckY=np.length?Math.min(...np.map(p=>p[1])):top;
 const neckSide=np.length?np.reduce((best,p)=>p[0]<best[0]?p:best,np[0]):[neckX,neckY+20];
 const neckBottom=np.length?Math.max(...np.map(p=>p[1])):neckSide[1]+180;
 const joinY=neckSide[1]+Math.min(90,Math.max(12,neckBottom-neckSide[1])*(view==='front'?.35:.55));
 const neckJoin=np.filter(p=>p[0]<axis).sort((a,b)=>(Math.abs(a[1]-joinY)*25+a[0])-(Math.abs(b[1]-joinY)*25+b[0]))[0]??neckSide;
 const saddlePoint=np.filter(p=>p[0]<axis).sort((a,b)=>(Math.abs(a[1]-neckSide[1]-75)*5+a[0])-(Math.abs(b[1]-neckSide[1]-75)*5+b[0]))[0];
 const capPoint=ls.flat(2).reduce((best,p)=>p[1]<best[1]?p:best,ls[0][0][0]);
 const longDrop=kind==='drop'&&/:long(?::|$)/.test(left.assetId);
 let underarm:Pair=[underX,y+joinDepth];
 if(longDrop){
  // The visible underarm starts where torso and sleeve actually separate.
  // A legacy attachment marker may end above that point, especially on Slim.
  const crossingsAt=(g:MultiPolygon,h:number)=>g.flatMap(poly=>poly.flatMap(ring=>ring.flatMap((a,i)=>{const b=ring[(i+1)%ring.length];return (a[1]>h)!==(b[1]>h)?[a[0]+(h-a[1])*(b[0]-a[0])/(b[1]-a[1])]:[]})));
  for(let h=y;h<bottom-(bottom-top)*.18;h+=2){
   const bodyXs=crossingsAt(original,h),sleeveXs=crossingsAt(ls,h);
   if(!bodyXs.length||!sleeveXs.length)continue;
   const bodyEdge=Math.min(...bodyXs),sleeveEdge=Math.max(...sleeveXs);
   if(bodyEdge-sleeveEdge>.02){underarm=[(bodyEdge+sleeveEdge)/2,h-2];break;}
  }
 }
 const dropY=capPoint[1]+Math.min(135,((longDrop?underarm[1]:y)-capPoint[1])*.21),dropXs:number[]=[];
 for(const polygon of all)for(const ring of polygon)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if((a[1]<=dropY&&b[1]>dropY)||(b[1]<=dropY&&a[1]>dropY))dropXs.push(a[0]+(b[0]-a[0])*(dropY-a[1])/(b[1]-a[1]));}
 const setInX=fit==='oversized'?capPoint[0]+(neckX-capPoint[0])*.25:underX-(fit==='boxy'?72:8),setInYs:number[]=[];
 for(const polygon of all)for(const ring of polygon)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if((a[0]<=setInX&&b[0]>setInX)||(b[0]<=setInX&&a[0]>setInX))setInYs.push(a[1]+(b[1]-a[1])*(setInX-a[0])/(b[0]-a[0]));}
 const start:Pair=kind==='set-in'?[setInX,setInYs.length?Math.min(...setInYs):capPoint[1]]:kind==='drop'?[dropXs.length?Math.min(...dropXs):underX-100,dropY]:kind==='saddle'&&saddlePoint?saddlePoint:neckJoin;
 const end:Pair=underarm;
 let seam=shoulderSeam(kind,start,end);
 if(kind==='drop'&&sourceJoin){
  const transforms:string[]=[];for(let el:Element|null=sourceJoin;el&&el!==sourceRoot;el=el.parentElement)if(el.hasAttribute('transform'))transforms.unshift(el.getAttribute('transform')!);
  const originalSeam=flattenPathContours(svgpath(sourceJoin.getAttribute('d')??'').transform(transforms.join(' ')).toString(),2,true)[0]??[];
  const innerY=Math.min(end[1]-12,dropY+Math.min(78,Math.abs(underX-start[0])*.52,(end[1]-dropY)*.36));
  let junction:Pair|undefined;
  for(let i=1;i<originalSeam.length;i++){const a=originalSeam[i-1],b=originalSeam[i];if(a.y<=innerY&&b.y>=innerY&&b.y>a.y){junction=[a.x+(b.x-a.x)*(innerY-a.y)/(b.y-a.y),innerY];break;}}
  if(junction){
   // Extend the torso over the shoulder, then meet the existing armhole.
   // The lower attachment stays registered to the sleeve and its underarm.
   seam=[...shoulderSeam(kind,start,junction),...originalSeam.filter(p=>p.y>innerY&&p.y<end[1]).map(p=>[p.x,p.y] as Pair),end];
  }
 }
 // Preserve the authored underarm endpoint: short sleeves meet the inner cuff,
 // while long sleeves end at the armpit rather than continuing to the wrist.



 // The shoulder cut stops at the armpit. Below it, only the original sleeve owns fabric.
 // Continuing a vertical half-plane to the hem incorrectly colours flared torso sides.
 const partition=partitionShoulderFabric(all,ls,rs,seam,axis);
 const newLeft=partition.left,newRight=partition.right,newBody=partition.body;
 const paths={base:geometryPath(newBody),sleeveLeft:geometryPath(newLeft),sleeveRight:geometryPath(newRight)};
 const cap=neckX-12,capW=(axis-neckX)*2+24,capH=np.length?Math.max(...np.map(p=>p[1]))-neckY+24:240;
 const clipKey=`${kind}-${fit??'fit'}-${view}-${Math.round(cap)}-${Math.round(capH)}`;
 const outer=(raw:string)=>{const root=new DOMParser().parseFromString(raw,'image/svg+xml').documentElement;return root.innerHTML};
 const result=layers.map(layer=>{
 if(layer.id in paths){const d=paths[layer.id as keyof typeof paths];return{...layer,measurementShoulder:layer.id==='sleeveLeft'?{x:(kind==='drop'||kind==='set-in'?start:capPoint)[0],y:(kind==='drop'||kind==='set-in'?start:capPoint)[1]}:layer.id==='sleeveRight'?{x:axis*2-(kind==='drop'||kind==='set-in'?start:capPoint)[0],y:(kind==='drop'||kind==='set-in'?start:capPoint)[1]}:undefined,displayName:layer.displayName+' Â· '+kind,svgRaw:wrap(`<g transform="matrix(1 0 0 1 0 0)" fill="#000000"><path fill-rule="evenodd" d="${d}"/></g>${layer.id==='base'?'':`<path data-sleeve-join="true" fill="none" d="M${seam.map(([x,y])=>`${layer.id==='sleeveRight'?axis*2-x:x},${y}`).join('L')}"/>`}`),panellingClipSvgRaw:undefined,constructionSvg:undefined,stitchSvg:undefined};}
 // Keep the authored collar ink/ribbing. TechnicalLinework draws the new exterior.
 if(layer.id==='outline')return {...layer,svgRaw:wrap(`<defs><clipPath id="shoulder-collar-ink-${clipKey}"><rect x="${cap}" y="${neckY-12}" width="${capW}" height="${capH}"/></clipPath></defs><g clip-path="url(#shoulder-collar-ink-${clipKey})">${outer(layer.svgRaw)}</g>`)};
 if(layer.id==='stitching'){const lines=[seam,seam.map(([x,y])=>[axis*2-x,y] as Pair)].map((r,side)=>`<path d="M${r.map(([x,y])=>`${x+(side?-6:6)},${y}`).join('L')}" fill="none" stroke="${layer.tint??'#aaa'}" stroke-width="2.5" stroke-dasharray="9 9"/>`).join('');return{...layer,svgRaw:wrap(`<defs><clipPath id="shoulder-stitch-keep-${clipKey}"><rect y="${y+20}" width="2048" height="2048"/><rect x="${cap}" y="${neckY-12}" width="${capW}" height="${capH}"/></clipPath></defs><g clip-path="url(#shoulder-stitch-keep-${clipKey})">${outer(layer.svgRaw)}</g>`+lines)};}
 return layer;});
 const ready=sourceRaster?result.map(l=>l.svgRaw.includes('data-shoulder-construction="true"')&&!l.svgRaw.includes('data-raster-neck="true"')?{...l,svgRaw:l.svgRaw.replace('<svg ','<svg data-raster-neck="true" ')}:l):result;
 cache.set(key,ready);if(cache.size>12)cache.delete(cache.keys().next().value!);return ready;
}
