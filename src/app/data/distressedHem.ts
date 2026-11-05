import svgpath from 'svgpath';
import polygonClipping,{type MultiPolygon,type Pair} from 'polygon-clipping';
import {shoulderFabricGeometry,shoulderGeometryPath} from './tshirtShoulderGeometry';
import {resolveHemSettings,type TshirtHemStyles} from './tshirtHemStyles';
import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
type Point={x:number;y:number};
/** Deterministic cut edge, deep open tears and loose cotton fibres, in garment coordinates. */
export function distressedHemEdge(left:number,right:number,bottom:number,amount=55,depth=55,fray=65,seed=17){
 let state=seed>>>0;const random=()=>{state+=0x6D2B79F5;let t=Math.imul(state^state>>>15,1|state);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296};
 const width=right-left,strength=Math.max(0,Math.min(1,amount/100)),count=Math.max(2,Math.round(2+strength*5));
 // Wear clusters contain several horizontal broken courses, rather than punched-out scallops.
 const clusters=Array.from({length:count},(_,i)=>({x:left+width*(.045+(i+random()*.5)/count*.91),w:width*(.018+random()*.025),h:(5+depth*.22)*strength*(.65+random()*.6)}));
 const points:Point[]=Array.from({length:241},(_,i)=>{const x=left+width*i/240;const wear=clusters.reduce((n,p)=>n+p.h*.35*Math.exp(-Math.pow((x-p.x)/p.w,4)),0);return{x,y:bottom-strength*(2+Math.sin(i*.18)*1.8+Math.sin(i*.61)*.9+random()*2.2)-wear}});
 const holes:Point[][]=[],bridges:string[]=[],rims:string[]=[];
 const fmt=(v:number)=>v.toFixed(2);
 for(const c of clusters){
  const rows=2+Math.round(strength*2);
  for(let row=0;row<rows;row++){
   const cx=c.x+(random()-.5)*c.w*.65,cy=bottom-c.h*(.55+row*.48)-3,rx=c.w*(.65+random()*.5),ry=(1.4+random()*2.1+depth*.025)*strength;
   const ring=Array.from({length:25},(_,j)=>{const t=j/24*Math.PI*2;return{x:cx+Math.cos(t)*rx*(.92+random()*.16),y:cy+Math.sin(t)*ry*(.7+random()*.6)}});ring.push(ring[0]);holes.push(ring);
   rims.push('M'+ring.map(p=>fmt(p.x)+','+fmt(p.y)).join('L')+'Z');
   // Remaining yarns bridge the opening; they are not a solid white painted tear.
   if(row%2===0)bridges.push(`M${fmt(cx-rx*.9)},${fmt(cy)} Q${fmt(cx)},${fmt(cy+ry*.5)} ${fmt(cx+rx*.9)},${fmt(cy)}`);
  }
 }
 const fibers=Array.from({length:Math.round(Math.max(0,Math.min(100,fray))*.85)},(_,i)=>{const p=points[Math.floor(random()*points.length)],length=1+random()*(3+fray*.065),curl=(random()-.5)*length;
  return `M${fmt(p.x)},${fmt(p.y)} q${fmt(curl)},${fmt(length*.4)} ${fmt(curl*.6)},${fmt(length)}`});
 // A few broad dangling knit loops hang below worn clusters, as in a washed waffle hem.
 if(fray>0)for(const c of clusters){const span=c.w*(.65+random()*.45),drop=(5+fray*.17)*( .5+random()*.6);const y=bottom-2;
  fibers.push(`M${fmt(c.x-span)},${fmt(y)} C${fmt(c.x-span*.8)},${fmt(y+drop)} ${fmt(c.x+span*.65)},${fmt(y+drop)} ${fmt(c.x+span)},${fmt(y-1)}`);
 }
 const roll=points.filter((_,i)=>i%3===0).map(p=>({x:p.x,y:p.y-2.5-strength*2}));
 return {points,fibers,holes,bridges,rims,roll};
}
const cache=new Map<string,ResolvedGarmentLayer[]>();
function withDistressedBodyHem(layers:ResolvedGarmentLayer[],styles?:TshirtHemStyles,edgeDepthLimit?:number):ResolvedGarmentLayer[]{
 const settings=resolveHemSettings(styles,'bodyHem');if(settings.construction!=='distressed')return layers;
 const body=layers.find(l=>l.id==='base');if(!body)return layers;
 const key=JSON.stringify([layers,settings,edgeDepthLimit]);if(cache.has(key))return cache.get(key)!;
 const geometry=shoulderFabricGeometry(body.svgRaw),ps=geometry.flat(2);if(!ps.length)return layers;
 const bottom=Math.max(...ps.map(p=>p[1])),low=ps.filter(p=>p[1]>bottom-100),left=Math.min(...low.map(p=>p[0])),right=Math.max(...low.map(p=>p[0]));
 let {points,fibers,holes,bridges,rims,roll}=distressedHemEdge(left,right,bottom,settings.distressAmount,settings.distressDepth,settings.frayAmount,settings.distressSeed);
 if(edgeDepthLimit){
  const depth=Math.max(1,...holes.flat().map(p=>bottom-p.y),...points.map(p=>bottom-p.y)),scale=Math.min(1,edgeDepthLimit/depth),m=[1,0,0,scale,0,bottom*(1-scale)];
  const point=(p:Point)=>({...p,y:bottom+(p.y-bottom)*scale});points=points.map(point);holes=holes.map(r=>r.map(point));roll=roll.map(point);
  fibers=fibers.map(d=>svgpath(d).matrix(m).toString());bridges=bridges.map(d=>svgpath(d).matrix(m).toString());rims=rims.map(d=>svgpath(d).matrix(m).toString());
 }
 const keep:MultiPolygon=[[[[0,0],[2048,0],[2048,bottom],...points.slice().reverse().map(p=>[p.x,p.y] as Pair),[0,bottom],[0,0]]]];
 const wrap=(shape:MultiPolygon)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" data-distressed-hem="true"><g transform="matrix(1 0 0 1 0 0)" fill="#000"><path fill-rule="evenodd" d="${shoulderGeometryPath(shape)}"/></g><path data-worn-hem-clearance="true" fill="none" d="${rims.join(' ')} M${points.map(p=>p.x+','+p.y).join('L')}"/></svg>`;
 const openings:MultiPolygon=holes.map(ring=>[ring.map(p=>[p.x,p.y] as Pair)]);
 let result=layers.map(layer=>{
  if(layer.id==='base'||layer.id==='bodyHem')return {...layer,svgRaw:wrap(polygonClipping.difference(polygonClipping.intersection(shoulderFabricGeometry(layer.svgRaw),keep),openings)),panellingClipSvgRaw:undefined};
  if(layer.id==='outline'||layer.id==='stitching'){
   const id='distressed-hem-'+layer.id,mask=`<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><rect width="2048" height="2048" fill="white"/><rect x="${left+10}" y="${bottom-90}" width="${right-left-20}" height="${2048-bottom+90}" fill="black"/></mask></defs>`;
   return {...layer,svgRaw:layer.svgRaw.replace(/(<svg[^>]*>)/,'$1'+mask+`<g mask="url(#${id})">`).replace('</svg>','</g></svg>')};
  }return layer;
 });
 const line=(ps:Point[])=>'M'+ps.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).join('L');
 const raw=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><g data-ink-preserve="true" data-hem-fray="true" data-fixed-ink="true" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${line(roll)}" stroke="#15110c" stroke-width="7" opacity=".23"/><path d="${line(roll.map(p=>({...p,y:p.y-2})))}" stroke="#fff" stroke-width="2.3" opacity=".28"/><path d="${rims.join(' ')}" stroke="#706758" stroke-width="1.4" opacity=".35"/><path d="${bridges.join(' ')} ${fibers.join(' ')}" stroke="#302b23" stroke-width="2.4" opacity=".46"/><path d="${bridges.join(' ')} ${fibers.join(' ')}" stroke="#fff" stroke-width="1.1" opacity=".38"/></g></svg>`;
 result=[...result,{id:'hemFray',category:'Hem finish',assetId:'generated:distressed-hem',displayName:'Distressed hem fibres',kind:'detail',svgRaw:raw,zIndex:86,tint:'#b7afa0'}];cache.set(key,result);if(cache.size>20)cache.delete(cache.keys().next().value!);return result;
}

/** Work in each cuff's own tangent/normal coordinates; the shoulder never enters the cut. */
export function withDistressedHem(layers:ResolvedGarmentLayer[],styles?:TshirtHemStyles):ResolvedGarmentLayer[]{
 let result=withDistressedBodyHem(layers,styles);
 for(const hemId of ['sleeveHemLeft','sleeveHemRight','underlayerHemLeft','underlayerHemRight']){
  const settings=resolveHemSettings(styles,hemId);if(settings.construction!=='distressed')continue;
  const parentId=hemId.replace('underlayerHem','underSleeve').replace('sleeveHem','sleeve');
  const parent=result.find(l=>l.id===parentId),hem=result.find(l=>l.id===hemId);if(!parent||!hem)continue;
  const ps=shoulderFabricGeometry(hem.svgRaw).flat(2);if(ps.length<4)continue;
  const cx=ps.reduce((n,p)=>n+p[0],0)/ps.length,cy=ps.reduce((n,p)=>n+p[1],0)/ps.length;
  const xx=ps.reduce((n,p)=>n+(p[0]-cx)**2,0),yy=ps.reduce((n,p)=>n+(p[1]-cy)**2,0),xy=ps.reduce((n,p)=>n+(p[0]-cx)*(p[1]-cy),0),a=.5*Math.atan2(2*xy,xx-yy),ux=Math.cos(a),uy=Math.sin(a),nx=-uy,ny=ux;
  const ts=ps.map(p=>p[0]*ux+p[1]*uy),offset=500-Math.min(...ts);
  const parentPoints=shoulderFabricGeometry(parent.svgRaw).flat(2),normalOffset=100-Math.min(...parentPoints.map(p=>p[0]*nx+p[1]*ny));
  const local=[ux,nx,uy,ny,offset,normalOffset],world=[ux,uy,nx,ny,-offset*ux-normalOffset*nx,-offset*uy-normalOffset*ny];
  const asLocal=(l:ResolvedGarmentLayer,id:string)=>({...l,id,svgRaw:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><g transform="matrix(1 0 0 1 0 0)" fill="#000000"><path fill-rule="evenodd" d="'+svgpath(shoulderGeometryPath(shoulderFabricGeometry(l.svgRaw))).matrix(local).toString()+'"/></g></svg>'});
  const worn=withDistressedBodyHem([asLocal(parent,'base'),asLocal(hem,'bodyHem')],{editing:{regions:{bodyHem:{...settings,distressAmount:Math.min(70,settings.distressAmount??55),frayAmount:Math.min(55,settings.frayAmount??55)}}}},Math.min(12,(Math.max(...ps.map(p=>p[0]*nx+p[1]*ny))-Math.min(...ps.map(p=>p[0]*nx+p[1]*ny)))*.65));
  const toWorld=(raw:string)=>{const doc=new DOMParser().parseFromString(raw,'image/svg+xml');for(const p of doc.querySelectorAll('path'))p.setAttribute('d',svgpath(p.getAttribute('d')??'').matrix(world).toString());return new XMLSerializer().serializeToString(doc.documentElement)};
  result=result.map(l=>{const localId=l.id===parentId?'base':l.id===hemId?'bodyHem':null;if(!localId)return l;const changed=worn.find(p=>p.id===localId);if(!changed)return l;let raw=toWorld(changed.svgRaw);
   // Keep the original shared armhole marker, already expressed in world coordinates.
   const source=new DOMParser().parseFromString(l.svgRaw,'image/svg+xml');for(const marker of source.querySelectorAll('[data-sleeve-join]')){const transforms:string[]=[];for(let n:Element|null=marker;n&&n!==source.documentElement;n=n.parentElement)if(n.hasAttribute('transform'))transforms.unshift(n.getAttribute('transform')!);raw=raw.replace('</svg>','<path data-sleeve-join="true" fill="none" d="'+svgpath(marker.getAttribute('d')??'').transform(transforms.join(' ')).toString()+'"/></svg>');}
   return {...l,svgRaw:raw,panellingClipSvgRaw:undefined};});
  const fray=worn.find(l=>l.id==='hemFray');if(fray)result.push({...fray,id:'hemFray-'+hemId,assetId:'generated:distressed-'+hemId,svgRaw:toWorld(fray.svgRaw)});
 }
 return result;
}
