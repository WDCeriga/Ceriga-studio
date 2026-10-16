import svgpath from 'svgpath';
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
/** One shared attachment curve owns body and sleeve geometry; cuff edges are straight. */
export function constructSleeveFamily(layers:ResolvedGarmentLayer[],fit?:string):ResolvedGarmentLayer[]{
 const left=layers.find(l=>l.id==='sleeveLeft'),hem=layers.find(l=>l.id==='sleeveHemLeft');if(!left||!hem)return layers;
 const key=[fit,left.svgRaw,hem.svgRaw,layers.find(l=>l.id==='base')?.svgRaw].join('|'),cached=familyCache.get(key);if(cached)return apply(layers,cached);
 const r=ring(left.svgRaw),h=ring(hem.svgRaw);if(r.length<3||h.length<3)return layers;
 const long=/:long(?::|$)/.test(left.assetId),a=fit==='oversized'?{x:545.333,y:540}:r.reduce((p,q)=>q.y<p.y?q:p,r[0]);
 const cx=h.reduce((n,p)=>n+p.x,0)/h.length,cy=h.reduce((n,p)=>n+p.y,0)/h.length,xx=h.reduce((n,p)=>n+(p.x-cx)**2,0),yy=h.reduce((n,p)=>n+(p.y-cy)**2,0),xy=h.reduce((n,p)=>n+(p.x-cx)*(p.y-cy),0),angle=.5*Math.atan2(2*xy,xx-yy),ux=Math.cos(angle),uy=Math.sin(angle),nx=-uy,ny=ux;
 const ts=h.map(p=>p.x*ux+p.y*uy),top=Math.min(...h.map(p=>p.x*nx+p.y*ny)),low=Math.max(...h.map(p=>p.x*nx+p.y*ny)),lo=Math.min(...ts),hi=Math.max(...ts),corner=(t:number,n:number)=>({x:t*ux+n*nx,y:t*uy+n*ny}),outer=corner(lo,top),inner=corner(hi,top),hemInner=corner(hi,low);
 const maxX=Math.max(...r.map(p=>p.x)),candidates=r.filter(p=>p.x>maxX-4&&p.y>a.y&&p.y<a.y+650);
 const t={x:maxX,y:Math.min(...candidates.map(p=>p.y))},u={x:maxX,y:Math.max(...candidates.map(p=>p.y))};
 if(!Number.isFinite(t.y)||!Number.isFinite(u.y))return layers;
 const short=!long&&!/longer-short/.test(left.assetId);if(short){inner.x=maxX;hemInner.x=maxX;u.y=Math.min(u.y,inner.y);}
 const curve=cubic(sideArc(r,a,t,true),a,t,true)+'L'+pt(u);
 const innerCurve=long?cubic(sideArc(r,u,inner,true),u,inner):'L'+pt(inner);
 const outerCurve=long?cubic(sideArc(r,outer,a,false),outer,a):'L'+pt(a);
 const d='M'+pt(a)+curve+innerCurve+'L'+pt(outer)+outerCurve+'Z';
 let body=layers.find(l=>l.id==='base')?.svgRaw;
 if(body){body=replaceBodyArc(body,a,u,curve,fit!=='slim');const mirrored=svgpath('M'+pt(a)+curve).matrix([-1,0,0,1,2048,0]).toString();body=replaceBodyArc(body,{x:2048-a.x,y:a.y},{x:2048-u.x,y:u.y},mirrored.replace(/^M[^C]*C/,'C'),fit!=='slim');}
 if(body&&(fit==='oversized'||fit==='boxy')){
  const doc=new DOMParser().parseFromString(body,'image/svg+xml');
  for(const mask of doc.querySelectorAll('mask[id*="sleeve-torso"]')){const rect=doc.createElementNS('http://www.w3.org/2000/svg','rect');rect.setAttribute('x',String(u.x));rect.setAttribute('y',String(u.y));rect.setAttribute('width',String(2048-2*u.x));rect.setAttribute('height',String(2048-u.y));rect.setAttribute('fill','white');mask.appendChild(rect);}
  body=new XMLSerializer().serializeToString(doc.documentElement);
 }
 const seam='M'+pt(a)+curve+(short?'L'+pt(hemInner):'');
 const rightSeam=svgpath(seam).matrix([-1,0,0,1,2048,0]).toString();
 const right=wrap(svgpath(d).matrix([-1,0,0,1,2048,0]).toString()).replace('</svg>','<path data-sleeve-join="true" fill="none" d="'+rightSeam+'"/></svg>'),leftSvg=wrap(d).replace('</svg>','<path data-sleeve-join="true" fill="none" d="'+seam+'"/></svg>');
 const band='M'+pt(corner(lo,top))+'L'+pt(inner)+'L'+pt(hemInner)+'L'+pt(corner(lo,low))+'Z',opening='M'+pt(corner(lo,low))+'L'+pt(hemInner),layered=layers.some(l=>l.id==='underSleeveLeft');
 const hemSvg=(mirrored:boolean)=>{const matrix=mirrored?[-1,0,0,1,2048,0]:[1,0,0,1,0,0];return wrap(svgpath(band).matrix(matrix).toString()).replace('</svg>',layered?'<path data-sleeve-opening="true" fill="none" d="'+svgpath(opening).matrix(matrix).toString()+'"/></svg>':'</svg>');};
 const bodyHem=layers.find(l=>l.id==='bodyHem'),bodyHemRing=bodyHem?ring(bodyHem.svgRaw):[],bodyHemYs=bodyHemRing.map(p=>p.y);
 const alignedBodyHem=fit!=='slim'&&bodyHemRing.length?wrap('M'+u.x+','+Math.min(...bodyHemYs)+'H'+(2048-u.x)+'V'+Math.max(...bodyHemYs)+'H'+u.x+'Z'):undefined;
 const under:Record<string,string>={};
 if(layered)for(const id of ['underSleeveLeft','underSleeveRight']){const layer=layers.find(l=>l.id===id);if(!layer)continue;const points=ring(layer.svgRaw),xs=points.map(p=>p.x),ys=points.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y1=Math.max(...ys),edge=corner(lo,low),openingY=(x:number)=>{const leftX=id==='underSleeveRight'?2048-x:x;return edge.y+(leftX-edge.x)*(hemInner.y-edge.y)/(hemInner.x-edge.x)-4;};under[id]=wrap('M'+x0+','+openingY(x0)+'L'+x1+','+openingY(x1)+'V'+y1+'H'+x0+'Z');}
 const raw:Record<string,string>={...under,...(alignedBodyHem?{bodyHem:alignedBodyHem}:{}),sleeveLeft:leftSvg,sleeveRight:right,sleeveHemLeft:hemSvg(false),sleeveHemRight:hemSvg(true),...(body?{base:body}:{})};if(familyCache.size>24)familyCache.delete(familyCache.keys().next().value!);familyCache.set(key,raw);return apply(layers,raw);
}
