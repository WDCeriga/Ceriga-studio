import svgpath from 'svgpath';
import polygonClipping from 'polygon-clipping';
import {fabricRings} from './regularConstruction';
import {flattenPathContours,signedArea,distance} from '../features/panelling/panellingGeometry';
import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
type P={x:number;y:number};
const familyCache=new Map<string,Record<string,string>>();
const apply=(layers:ResolvedGarmentLayer[],raw:Record<string,string>)=>layers.map(l=>raw[l.id]?{...l,svgRaw:raw[l.id],panellingClipSvgRaw:undefined}:l);
const pt=(p:P)=>p.x.toFixed(3)+','+p.y.toFixed(3);
const ring=(raw:string)=>fabricRings(raw).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)))[0]??[];
const near=(r:P[],p:P)=>r.reduce((best,q,i)=>distance(q,p)<distance(r[best],p)?i:best,0);
const walk=(r:P[],a:number,b:number)=>{const out=[r[a]];if(a===b)return out;for(let i=(a+1)%r.length;i!==b;i=(i+1)%r.length)out.push(r[i]);out.push(r[b]);return out;};
const sideArc=(r:P[],a:P,b:P,inner:boolean)=>{const i=near(r,a),j=near(r,b),x=walk(r,i,j),y=walk(r,j,i).reverse(),mean=(p:P[])=>p.reduce((n,q)=>n+q.x,0)/p.length;return (mean(x)>mean(y))===inner?x:y;};
function cubic(points:P[],a:P,b:P,verticalEnd=false){
 const total=points.slice(1).reduce((n,p,i)=>n+distance(p,points[i]),0)||1;let at=0,aa=0,ab=0,bb=0,rx=0,sx=0,ry=0,sy=0;
 for(let i=0;i<points.length;i++){if(i)at+=distance(points[i-1],points[i]);const t=at/total,u=1-t,k=3*u*u*t,l=3*u*t*t,x=points[i].x-u*u*u*a.x-t*t*t*b.x,y=points[i].y-u*u*u*a.y-t*t*t*b.y;aa+=k*k;ab+=k*l;bb+=l*l;rx+=k*x;sx+=l*x;ry+=k*y;sy+=l*y;}
 const det=aa*bb-ab*ab,clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
 let c=det>1e-6?{x:(rx*bb-sx*ab)/det,y:(ry*bb-sy*ab)/det}:{x:a.x+(b.x-a.x)/3,y:a.y+(b.y-a.y)/3};
 let d=det>1e-6?{x:(sx*aa-rx*ab)/det,y:(sy*aa-ry*ab)/det}:{x:a.x+(b.x-a.x)*2/3,y:a.y+(b.y-a.y)*2/3};
 const xs=points.map(p=>p.x),minX=Math.min(a.x,b.x,...xs)-4,maxX=Math.max(a.x,b.x,...xs)+4,minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y);
 c={x:clamp(c.x,minX,maxX),y:clamp(c.y,minY,maxY)};d={x:verticalEnd?b.x:clamp(d.x,minX,maxX),y:clamp(d.y,minY,maxY)};
 return 'C'+pt(c)+' '+pt(d)+' '+pt(b);
}
const wrap=(d:string)=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><g transform="translate(0 2048) scale(.1 -.1)" fill="#000000"><path fill-rule="evenodd" d="'+svgpath(d).matrix([10,0,0,-10,0,20480]).toString()+'"/></g></svg>';
function replaceBodyArc(raw:string,a:P,b:P,curve:string,straightSide=false){
 const doc=new DOMParser().parseFromString(raw,'image/svg+xml'),g=[...doc.querySelectorAll('g[transform]')].find(e=>!e.closest('defs')) as SVGGraphicsElement|undefined,p=g?.querySelector('path'),m=g?.transform.baseVal.consolidate()?.matrix;
 if(!p||!m)return raw;const parts=(p.getAttribute('d')??'').match(/M[^M]*/g);if(!parts)return raw;
 const rings=parts.map(d=>flattenPathContours(svgpath(d).matrix([m.a,m.b,m.c,m.d,m.e,m.f]).toString(),2)[0]??[]),index=rings.reduce((n,r,i)=>Math.abs(signedArea(r))>Math.abs(signedArea(rings[n]))?i:n,0),r=rings[index];if(!r.length)return raw;
 const i=near(r,a),j=near(r,b),first=walk(r,i,j),second=walk(r,j,i),len=(ps:P[])=>ps.slice(1).reduce((n,q,k)=>n+distance(q,ps[k]),0),rest=len(first)<len(second)?second:first.reverse();
 const inv=new DOMMatrix([m.a,m.b,m.c,m.d,m.e,m.f]).inverse();
 parts[index]=svgpath('M'+pt(a)+curve+(rest.length>2?'L'+rest.slice(1,-1).map(q=>straightSide&&q.y>b.y&&(b.x<1024?q.x<700:q.x>1348)?{x:b.x,y:q.y}:q).map(pt).join('L'):'')+'Z').matrix([inv.a,inv.b,inv.c,inv.d,inv.e,inv.f]).toString();p.setAttribute('d',parts.filter((_,k)=>k===index||rings[k].every(q=>q.x>700&&q.x<1348&&q.y<900)).join(''));return new XMLSerializer().serializeToString(doc.documentElement);
}
/** Smooth shoulder seams for the oversized dropped-shoulder block. */
export function straightenOversizedShoulders(layers:ResolvedGarmentLayer[],fit?:string):ResolvedGarmentLayer[]{
 if(fit!=='oversized')return layers;
 const body=layers.find(l=>l.id==='base'),neck=layers.find(l=>l.id==='neck');if(!body||/polo/i.test(neck?.displayName??''))return layers;
 let neckPoints=neck?ring(neck.svgRaw):[];
 if(!neckPoints.length){const outline=layers.find(l=>l.id==='outline'),support=outline?new DOMParser().parseFromString(outline.svgRaw,'image/svg+xml').querySelector('[data-ink-preserve],[data-shoulder-neck-boundary]'):null;if(support)neckPoints=ring('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><g transform="'+(support.getAttribute('transform')??'scale(1)')+'"><path fill="black" d="'+support.getAttribute('d')+'"/></g></svg>');}
 if(!neckPoints.length)return layers;
 const xs=neckPoints.map(p=>p.x);let raw=body.svgRaw;
 for(const side of ['Left','Right'] as const){
  const sleeve=layers.find(l=>l.id==='sleeve'+side);if(!sleeve)continue;
  const sleevePoints=ring(sleeve.svgRaw),bodyPoints=ring(raw);if(!sleevePoints.length||!bodyPoints.length)continue;
  const edge=side==='Left'?Math.min(...xs):Math.max(...xs);
  const candidates=bodyPoints.filter(p=>Math.abs(p.x-edge)<12&&p.y<650);if(!candidates.length)continue;
  const a=candidates.reduce((best,p)=>p.y<best.y?p:best),top=sleevePoints.reduce((best,p)=>p.y<best.y?p:best);
  const b=bodyPoints[near(bodyPoints,top)];if(b.y<=a.y||Math.abs(b.x-a.x)<60)continue;
  const i=near(bodyPoints,a),j=near(bodyPoints,b),one=walk(bodyPoints,i,j),two=walk(bodyPoints,j,i).reverse();
  const length=(points:P[])=>points.slice(1).reduce((n,p,k)=>n+distance(p,points[k]),0);
  raw=replaceBodyArc(raw,a,b,cubic(length(one)<length(two)?one:two,a,b));
 }
 return layers.map(l=>l.id==='base'?{...l,svgRaw:raw,panellingClipSvgRaw:undefined}:l);
}
function alignTorsoHem(raw:string,top:number,low:number[],high:number[]){
 const doc=new DOMParser().parseFromString(raw,'image/svg+xml'),g=[...doc.querySelectorAll('g[transform]')].find(e=>!e.closest('defs')) as SVGGraphicsElement|undefined,p=g?.querySelector('path'),m=g?.transform.baseVal.consolidate()?.matrix;if(!p||!m)return raw;
 const parts=(p.getAttribute('d')??'').match(/M[^M]*/g);if(!parts)return raw;
 const rings=parts.map(d=>flattenPathContours(svgpath(d).matrix([m.a,m.b,m.c,m.d,m.e,m.f]).toString(),1)[0]??[]),idx=rings.reduce((n,r,i)=>Math.abs(signedArea(r))>Math.abs(signedArea(rings[n]))?i:n,0),points=rings[idx].map(q=>{if(q.y<top-58)return q;const t=(q.y-(top-8))/50;if(q.x<low[0]+18)return {x:low[0]+(low[0]-high[0])*t,y:q.y};if(q.x>low[1]-18)return {x:low[1]+(low[1]-high[1])*t,y:q.y};return q;});
 const inv=new DOMMatrix([m.a,m.b,m.c,m.d,m.e,m.f]).inverse();parts[idx]=svgpath('M'+points.map(pt).join('L')+'Z').matrix([inv.a,inv.b,inv.c,inv.d,inv.e,inv.f]).toString();p.setAttribute('d',parts.join(''));return new XMLSerializer().serializeToString(doc.documentElement);
}
/** Copy the left construction outside the traced neck window to the right shoulder. */
function symmetricOuterTorso(raw:string){
 const doc=new DOMParser().parseFromString(raw,'image/svg+xml'),g=[...doc.querySelectorAll('g[transform]')].find(e=>!e.closest('defs')) as SVGGraphicsElement|undefined,p=g?.querySelector('path'),m=g?.transform.baseVal.consolidate()?.matrix;
 if(!p||!m)return raw;
 const parts=(p.getAttribute('d')??'').match(/M[^M]*/g);if(!parts)return raw;
 const rings=parts.map(d=>flattenPathContours(svgpath(d).matrix([m.a,m.b,m.c,m.d,m.e,m.f]).toString(),2)[0]??[]),index=rings.reduce((n,r,i)=>Math.abs(signedArea(r))>Math.abs(signedArea(rings[n]))?i:n,0);
 const original:[[number,number][][]]=[[rings[index].map(q=>[q.x,q.y])]],left=polygonClipping.intersection(original,[[[[0,0],[1024,0],[1024,2048],[0,2048]]]]);
 const reflected=left.map(poly=>poly.map(loop=>loop.map(([x,y])=>[2048-x,y] as [number,number]).reverse()));
 const neck:[[number,number][][]]=[[[[700,0],[1348,0],[1348,900],[700,900]]]];
 const symmetric=polygonClipping.union(polygonClipping.difference(polygonClipping.union(left,reflected),neck),polygonClipping.intersection(original,neck));
 const inv=new DOMMatrix([m.a,m.b,m.c,m.d,m.e,m.f]).inverse();
 parts[index]=svgpath(symmetric.map(poly=>poly.map(loop=>'M'+loop.map(([x,y])=>pt({x,y})).join('L')+'Z').join('')).join('')).matrix([inv.a,inv.b,inv.c,inv.d,inv.e,inv.f]).toString();
 p.setAttribute('d',parts.join(''));return new XMLSerializer().serializeToString(doc.documentElement);
}
/** One shared attachment curve owns body and sleeve geometry; cuff edges are straight. */
export function constructSleeveFamily(layers:ResolvedGarmentLayer[],fit?:string):ResolvedGarmentLayer[]{
 const left=layers.find(l=>l.id==='sleeveLeft'),hem=layers.find(l=>l.id==='sleeveHemLeft');if(!left||!hem)return layers;
 const key=[fit,left.assetId,left.svgRaw,hem.svgRaw,layers.find(l=>l.id==='base')?.svgRaw,...layers.filter(l=>/^(underSleeve|underlayerHem)/.test(l.id)).map(l=>l.id+':'+l.svgRaw)].join('|'),cached=familyCache.get(key);if(cached)return apply(layers,cached);
 const r=ring(left.svgRaw),h=ring(hem.svgRaw);if(r.length<3||h.length<3)return layers;
 const long=/:long(?::|$)/.test(left.assetId),a=fit==='oversized'?{x:545.333,y:540}:r.reduce((p,q)=>q.y<p.y?q:p,r[0]);
 const cx=h.reduce((n,p)=>n+p.x,0)/h.length,cy=h.reduce((n,p)=>n+p.y,0)/h.length,xx=h.reduce((n,p)=>n+(p.x-cx)**2,0),yy=h.reduce((n,p)=>n+(p.y-cy)**2,0),xy=h.reduce((n,p)=>n+(p.x-cx)*(p.y-cy),0),angle=.5*Math.atan2(2*xy,xx-yy),ux=Math.cos(angle),uy=Math.sin(angle),nx=-uy,ny=ux;
 const ts=h.map(p=>p.x*ux+p.y*uy),top=Math.min(...h.map(p=>p.x*nx+p.y*ny)),low=Math.max(...h.map(p=>p.x*nx+p.y*ny)),lo=Math.min(...ts),hi=Math.max(...ts),corner=(t:number,n:number)=>({x:t*ux+n*nx,y:t*uy+n*ny}),outer=corner(lo,top),inner=corner(hi,top),hemInner=corner(hi,low);
 if(fit==='oversized'&&/longer-short/.test(left.assetId)){
  // Taper the extended short sleeve toward the body instead of flaring the cuff.
  outer.x+=65;inner.x+=65;hemInner.x+=65;
 }
 const maxX=Math.max(...r.map(p=>p.x)),candidates=r.filter(p=>p.x>maxX-4&&p.y>a.y&&p.y<a.y+650);
 const t={x:maxX,y:Math.min(...candidates.map(p=>p.y))},u={x:maxX,y:Math.max(...candidates.map(p=>p.y))};
 if(!Number.isFinite(t.y)||!Number.isFinite(u.y))return layers;
 const longerShort=/longer-short/.test(left.assetId);
 const short=!long&&!longerShort,closedUnderarm=short||longerShort;
 if(closedUnderarm){inner.x=maxX;hemInner.x=maxX;u.y=longerShort?inner.y:Math.min(u.y,inner.y);}
 else if(long){u.y=Math.min(inner.y-90,u.y+75);}
 const curve=cubic(sideArc(r,a,t,true),a,t,true)+'L'+pt(u);
 const innerCurve=long?cubic(sideArc(r,u,inner,true),u,inner):'L'+pt(inner);
 const outerCurve=long?cubic(sideArc(r,outer,a,false),outer,a):'L'+pt(a);
 const d='M'+pt(a)+curve+innerCurve+'L'+pt(outer)+outerCurve+'Z';
 let body=layers.find(l=>l.id==='base')?.svgRaw;
 if(body){const end=closedUnderarm?hemInner:u,attachment=curve+(closedUnderarm?'L'+pt(hemInner):'');body=replaceBodyArc(body,a,end,attachment,fit!=='slim');const mirrored=svgpath('M'+pt(a)+attachment).matrix([-1,0,0,1,2048,0]).toString();body=replaceBodyArc(body,{x:2048-a.x,y:a.y},{x:2048-end.x,y:end.y},mirrored.replace(/^M[^C]*C/,'C'),fit!=='slim');}
 // The reconstructed slim torso already follows the shared sleeve attachment.
 // A traced keep-mask from the old short sleeve otherwise clips holes into that new edge.
 if(body&&fit==='slim'&&(long||longerShort)){
  const doc=new DOMParser().parseFromString(body,'image/svg+xml');
  for(const group of doc.querySelectorAll('g[mask]'))if(/(?:long|longer-short)-sleeve-torso-slim-base/.test(group.getAttribute('mask')??'')){group.removeAttribute('mask');group.setAttribute('data-constructed-slim-torso','true')}
  body=new XMLSerializer().serializeToString(doc.documentElement);
 }
 if(body&&(fit==='oversized'||fit==='boxy')){
  const doc=new DOMParser().parseFromString(body,'image/svg+xml');
  for(const mask of doc.querySelectorAll('mask[id*="sleeve-torso"]')){const rect=doc.createElementNS('http://www.w3.org/2000/svg','rect');rect.setAttribute('x',String(u.x));rect.setAttribute('y',String(u.y));rect.setAttribute('width',String(2048-2*u.x));rect.setAttribute('height',String(2048-u.y));rect.setAttribute('fill','white');mask.appendChild(rect);}
  body=new XMLSerializer().serializeToString(doc.documentElement);
 }
 const seam='M'+pt(a)+curve+(closedUnderarm?'L'+pt(hemInner):'');
 const rightSeam=svgpath(seam).matrix([-1,0,0,1,2048,0]).toString();
 const right=wrap(svgpath(d).matrix([-1,0,0,1,2048,0]).toString()).replace('</svg>','<path data-sleeve-join="true" fill="none" d="'+rightSeam+'"/></svg>'),leftSvg=wrap(d).replace('</svg>','<path data-sleeve-join="true" fill="none" d="'+seam+'"/></svg>');
 const outerBottom=corner(lo,low);if(fit==='oversized'&&/longer-short/.test(left.assetId))outerBottom.x+=65;
 const band='M'+pt(outer)+'L'+pt(inner)+'L'+pt(hemInner)+'L'+pt(outerBottom)+'Z',opening='M'+pt(outerBottom)+'L'+pt(hemInner),layered=layers.some(l=>l.id==='underSleeveLeft');
 const hemSvg=(mirrored:boolean)=>{const matrix=mirrored?[-1,0,0,1,2048,0]:[1,0,0,1,0,0];return wrap(svgpath(band).matrix(matrix).toString()).replace('</svg>',layered?'<path data-sleeve-opening="true" fill="none" d="'+svgpath(opening).matrix(matrix).toString()+'"/></svg>':'</svg>');};
 const bodyHem=layers.find(l=>l.id==='bodyHem'),bodyHemRing=bodyHem?ring(bodyHem.svgRaw):[],bodyHemYs=bodyHemRing.map(p=>p.y);
 let slimHem:string|undefined;
 if(fit==='slim'&&body){
  const torso=ring(body),bottom=Math.max(...torso.map(p=>p.y)),cut=bottom-90;
  const ext=(y:number)=>{const xs:number[]=[];for(let i=0;i<torso.length;i++){const a=torso[i],b=torso[(i+1)%torso.length];if((a.y>y)!==(b.y>y))xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));}return [Math.min(...xs),Math.max(...xs)];};
  const at=ext(cut),above=ext(cut-60),left={x:at[0],y:cut},right={x:at[1],y:cut};
  const lo={x:at[0]+(at[0]-above[0])*(bottom-cut)/60,y:bottom},hi={x:at[1]+(at[1]-above[1])*(bottom-cut)/60,y:bottom};
  if([left.x,right.x,lo.x,hi.x].every(Number.isFinite))body=replaceBodyArc(body,left,right,'L'+pt(lo)+'L'+pt(hi)+'L'+pt(right));
 }


 if(body&&fit==='regular')body=symmetricOuterTorso(body);

 // The neck variants have different body lengths. Derive the hem from this torso,
 // rather than reusing a default neck's bottom height.
 let alignedBodyHem:string|undefined;
 if(body&&bodyHemRing.length){
  const torso=ring(body),bottom=Math.max(...torso.map(p=>p.y));
  const hits=(points:P[],x:number)=>{const ys:number[]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a.x>x)!==(b.x>x))ys.push(a.y+(x-a.x)*(b.y-a.y)/(b.x-a.x));}return ys;};
  const mid=hits(bodyHemRing,1024),depth=Math.max(12,Math.min(48,mid.length>1?Math.max(...mid)-Math.min(...mid):24));
  // Clip the band to the actual torso. Sampled bounding boxes left a ledge at the slim corners.
  const clipped=polygonClipping.intersection([[torso.map(p=>[p.x,p.y] as [number,number])]],[[[[0,bottom-depth],[2048,bottom-depth],[2048,bottom],[0,bottom]]]]);
  if(clipped.length)alignedBodyHem=wrap(clipped.map(poly=>poly.map(loop=>'M'+loop.map(([x,y])=>pt({x,y})).join('L')+'Z').join('')).join(''));
 }

 const under:Record<string,string>={};
 if(layered)for(const id of ['underSleeveLeft','underSleeveRight']){
  const layer=layers.find(l=>l.id===id);if(!layer)continue;
  const points=ring(layer.svgRaw),xs=points.map(p=>p.x),ys=points.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y1=Math.max(...ys),right=id==='underSleeveRight';
  const openingY=(x:number)=>{const leftX=right?2048-x:x;return outerBottom.y+(leftX-outerBottom.x)*(hemInner.y-outerBottom.y)/(hemInner.x-outerBottom.x)-12;};
  // A straight under-sleeve ends behind the upper hem; it must never hook into the torso.
  const torso=body?ring(body):[],lower=torso.filter(p=>p.y>Math.min(openingY(x0),openingY(x1))&&p.x<1024);
  const bodyEdge=lower.length?Math.min(...lower.map(p=>p.x)):1024;
  const leftInner=Math.min(right?2048-x0:x1,bodyEdge-28),innerX=right?2048-leftInner:leftInner,outerX=right?x1:x0;
  under[id]=wrap('M'+outerX+','+openingY(outerX)+'L'+innerX+','+openingY(innerX)+'V'+y1+'H'+outerX+'Z');
  const cuffId=id.replace('underSleeve','underlayerHem'),cuff=layers.find(l=>l.id===cuffId),cuffRing=cuff?ring(cuff.svgRaw):[];
  if(cuffRing.length){const top=Math.min(...cuffRing.map(p=>p.y)),bottom=Math.max(...cuffRing.map(p=>p.y));under[cuffId]=wrap('M'+outerX+','+top+'H'+innerX+'V'+bottom+'H'+outerX+'Z');}
 }
 const raw:Record<string,string>={...under,...(alignedBodyHem?{bodyHem:alignedBodyHem}:{}),sleeveLeft:leftSvg,sleeveRight:right,sleeveHemLeft:hemSvg(false),sleeveHemRight:hemSvg(true),...(body?{base:body}:{})};if(familyCache.size>24)familyCache.delete(familyCache.keys().next().value!);familyCache.set(key,raw);return apply(layers,raw);
}
