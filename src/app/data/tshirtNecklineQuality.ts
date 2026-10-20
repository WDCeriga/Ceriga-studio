import {technicalContourPath} from '../features/panelling/TechnicalLinework';
import svgpath from 'svgpath';
import simplify from 'simplify-js';
import {fabricRings} from './regularConstruction';
import {signedArea,distance,pointInLoop} from '../features/panelling/panellingGeometry';
import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
type P={x:number;y:number};
const cache=new Map<string,string>();
const pt=(p:P)=>p.x.toFixed(3)+','+p.y.toFixed(3);
const unit=(p:P)=>{const n=Math.hypot(p.x,p.y)||1;return {x:p.x/n,y:p.y/n}};
/** Fit existing contour samples; no alternate neckline construction or dimensions. */
function fit(points:P[],depth=0,startTangent?:P,endTangent?:P):string{
 const a=points[0],b=points.at(-1)!;if(points.length<3)return 'L'+pt(b);
 const ta=startTangent??unit({x:points[1].x-a.x,y:points[1].y-a.y}),tb=endTangent??unit({x:points.at(-2)!.x-b.x,y:points.at(-2)!.y-b.y});
 const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+distance(points[i-1],points[i]));const total=lengths.at(-1)||1;
 let aa=0,ab=0,bb=0,ra=0,rb=0;
 const ts=lengths.map(l=>l/total);
 points.forEach((p,i)=>{const t=ts[i],u=1-t,k=3*u*u*t,l=3*u*t*t,ax=k*ta.x,ay=k*ta.y,bx=l*tb.x,by=l*tb.y,rx=p.x-(u*u*u+k)*a.x-(t*t*t+l)*b.x,ry=p.y-(u*u*u+k)*a.y-(t*t*t+l)*b.y;aa+=ax*ax+ay*ay;ab+=ax*bx+ay*by;bb+=bx*bx+by*by;ra+=ax*rx+ay*ry;rb+=bx*rx+by*ry});
 const det=aa*bb-ab*ab,chord=distance(a,b),clamp=(v:number)=>Math.max(chord*.05,Math.min(total*.8,v));
 const alpha=clamp(det>1e-8?(ra*bb-rb*ab)/det:chord/3),beta=clamp(det>1e-8?(rb*aa-ra*ab)/det:chord/3);
 const c={x:a.x+ta.x*alpha,y:a.y+ta.y*alpha},d={x:b.x+tb.x*beta,y:b.y+tb.y*beta};let error=0,split=Math.floor(points.length/2);
 points.forEach((p,i)=>{const t=ts[i],u=1-t,q={x:u*u*u*a.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*b.x,y:u*u*u*a.y+3*u*u*t*c.y+3*u*t*t*d.y+t*t*t*b.y},e=distance(p,q);if(e>error){error=e;split=i}});
 if(error>3&&depth<12&&split>0&&split<points.length-1){const tangent=unit({x:points[split+1].x-points[split-1].x,y:points[split+1].y-points[split-1].y});return fit(points.slice(0,split+1),depth+1,ta,{x:-tangent.x,y:-tangent.y})+fit(points.slice(split),depth+1,tangent,tb);}
 return 'C'+pt(c)+' '+pt(d)+' '+pt(b);
}
export function smoothNeckRing(source:P[],tolerance=3):string{
 let r=source.slice();if(distance(r[0],r.at(-1)!)<.01)r.pop();if(r.length<3)return '';
 const start=r.reduce((best,p,i)=>p.x<r[best].x?i:best,0);r=[...r.slice(start),...r.slice(0,start)];
 const far=r.reduce((best,p,i)=>distance(p,r[0])>distance(r[best],r[0])?i:best,0);
 const halves=[r.slice(0,far+1),[...r.slice(far),r[0]]];
 return 'M'+pt(r[0])+halves.map(half=>{const ps=simplify(half,tolerance,true);const cuts=[0];for(let i=1;i<ps.length-1;i++){const a=unit({x:ps[i].x-ps[i-1].x,y:ps[i].y-ps[i-1].y}),b=unit({x:ps[i+1].x-ps[i].x,y:ps[i+1].y-ps[i].y});if(a.x*b.x+a.y*b.y<-.2)cuts.push(i)}cuts.push(ps.length-1);return cuts.slice(1).map((end,i)=>fit(ps.slice(cuts[i],end+1))).join('')}).join('')+'Z';
}
export function necklineBoundary(layers:ResolvedGarmentLayer[]):string{
 const neck=layers.find(l=>l.id==='neck');if(!neck)return '';
 const root=new DOMParser().parseFromString(neck.svgRaw,'image/svg+xml'),g=[...root.querySelectorAll('g[transform]')].find(e=>!e.closest('defs')) as SVGGraphicsElement|undefined,p=g?.querySelector('path'),m=g?.transform.baseVal.consolidate()?.matrix;
 let d=p&&m?svgpath(p.getAttribute('d')??'').matrix([m.a,m.b,m.c,m.d,m.e,m.f]).toString():'';

 return d;
}
function thinOpening(source:P[]):string{
 const r=source.slice();if(distance(r[0],r.at(-1)!)<.01)r.pop();const l=r.reduce((n,p,i)=>p.x<r[n].x?i:n,0),h=r.reduce((n,p,i)=>p.x>r[n].x?i:n,0);
 const walk=(a:number,b:number)=>{const ps=[r[a]];for(let i=(a+1)%r.length;i!==b;i=(i+1)%r.length){ps.push(r[i]);if(ps.length>r.length)return [];}ps.push(r[b]);return ps;};
 const a=walk(l,h),b=walk(h,l).reverse(),mean=(ps:P[])=>ps.reduce((n,p)=>n+p.y,0)/ps.length,upper=mean(a)<mean(b)?a:b,lower=mean(a)<mean(b)?b:a,left=r[l],right=r[h],cx=(left.x+right.x)/2,mid=upper.reduce((n,p)=>Math.abs(p.x-cx)<Math.abs(n.x-cx)?p:n,upper[0]),cy=2*mid.y-(left.y+right.y)/2;
 return 'M'+pt(left)+'Q'+cx+','+cy+' '+pt(right)+fit(simplify(lower.slice().reverse(),3,true))+'Z';
}
function nearest(p:P,ring:P[]):P{let best=ring[0],d=Infinity;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),q={x:a.x+dx*t,y:a.y+dy*t},n=distance(p,q);if(n<d){d=n;best=q;}}return best;}
function narrowOpening(r:P[],outer:P[],width:number){return r.map(p=>{const q=nearest(p,outer),n=distance(p,q)||1,t=Math.min(1,width/n);return {x:q.x+(p.x-q.x)*t,y:q.y+(p.y-q.y)*t}});}
function straightV(r:P[]):string{
 const ring=r.slice();if(distance(ring[0],ring.at(-1)!)<.01)ring.pop();const li=ring.reduce((n,p,i)=>p.x<ring[n].x?i:n,0),ri=ring.reduce((n,p,i)=>p.x>ring[n].x?i:n,0),left=ring[li],right=ring[ri],bottom=ring.reduce((a,p)=>p.y>a.y?p:a,ring[0]),cx=(left.x+right.x)/2;
 const walk=(a:number,b:number)=>{const out=[ring[a]];for(let i=(a+1)%ring.length;i!==b;i=(i+1)%ring.length){out.push(ring[i]);if(out.length>ring.length)return [];}out.push(ring[b]);return out;},a=walk(li,ri),b=walk(ri,li).reverse(),mean=(ps:P[])=>ps.reduce((n,p)=>n+p.y,0)/ps.length,upper=mean(a)<mean(b)?a:b;
 return 'M'+pt(left)+fit(simplify(upper,3,true))+'L'+(cx+4)+','+(bottom.y-4)+'Q'+cx+','+bottom.y+' '+(cx-4)+','+(bottom.y-4)+'Z';
}
function rearBand(r:P[]):string{const left=r.reduce((a,p)=>p.x<a.x?p:a,r[0]),right=r.reduce((a,p)=>p.x>a.x?p:a,r[0]),cx=(left.x+right.x)/2,ey=(left.y+right.y)/2,near=r.filter(p=>Math.abs(p.x-cx)<12),top=Math.min(...near.map(p=>p.y)),bottom=Math.max(...near.map(p=>p.y));if(!Number.isFinite(top)||!Number.isFinite(bottom))return smoothNeckRing(r);return 'M'+left.x+','+ey+'Q'+cx+','+(2*top-ey)+' '+right.x+','+ey+'Q'+cx+','+(2*bottom-ey)+' '+left.x+','+ey+'Z';}
export function cleanNecklineFabric(layer:ResolvedGarmentLayer,view:'front'|'back'='front'):ResolvedGarmentLayer{
 if(!['neck','innerBackNeck'].includes(layer.id)||/polo/i.test(layer.displayName))return layer;
 const key=view+':'+layer.svgRaw;const cached=cache.get(key);if(cached)return {...layer,svgRaw:cached};
 const doc=new DOMParser().parseFromString(layer.svgRaw,'image/svg+xml'),g=[...doc.querySelectorAll('g[transform]')].find(e=>!e.closest('defs')) as SVGGraphicsElement|undefined,p=g?.querySelector('path'),m=g?.transform.baseVal.consolidate()?.matrix;if(!p||!m)return layer;
 const rings=fabricRings(layer.svgRaw).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)));const thin=/thin crew/i.test(layer.displayName),vneck=/\bv-?neck/i.test(layer.displayName)&&!/deep/i.test(layer.displayName);if(!rings.length)return layer;
 const inv=new DOMMatrix([m.a,m.b,m.c,m.d,m.e,m.f]).inverse();p.setAttribute('d',svgpath(rings.map((r,i)=>Math.abs(signedArea(r))>40?(view==='back'&&layer.id==='neck'?rearBand(r):thin&&i>0?thinOpening(narrowOpening(r,rings[0],11)):vneck&&layer.id==='neck'?straightV(r):smoothNeckRing(r,thin?6:3)):'M'+r.map(pt).join('L')+'Z').join('')).matrix([inv.a,inv.b,inv.c,inv.d,inv.e,inv.f]).toString());
 const raw=new XMLSerializer().serializeToString(doc.documentElement);if(cache.size>80)cache.clear();cache.set(key,raw);return {...layer,svgRaw:raw,panellingClipSvgRaw:undefined};
}

/** Keep generated stitch rows outside every collar and its join allowance. */
export function clipPoloStitching(markup:string,layers:ResolvedGarmentLayer[],id:string):string{
 if(!markup||!layers.some(l=>l.id==='neck'||l.id==='innerBackNeck'))return markup;
 const contours=layers.filter(l=>['neck','innerBackNeck'].includes(l.id)).flatMap(l=>fabricRings(l.svgRaw));
 const outer=contours.filter((r,i)=>!contours.some((q,j)=>i!==j&&Math.abs(signedArea(q))>Math.abs(signedArea(r))&&pointInLoop(r[0],q)));
 const d=outer.map(r=>'M'+r.map(pt).join('L')+'Z').join('');
 const defs='<defs><mask id="'+id+'" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><rect width="2048" height="2048" fill="white"/><path d="'+d+'" fill="black" stroke="black" stroke-width="24" stroke-linejoin="round"/></mask></defs>';
 return markup.replace(/(<svg[^>]*>)/,'$1'+defs+'<g mask="url(#'+id+')">').replace(/<\/svg>\s*$/,'</g></svg>');
}

/** Repair only the lateral Polo edges where shoulder ink used to overrun the collar. */
export function poloJoinBoundary(layers:ResolvedGarmentLayer[]):string{
 const neck=layers.find(l=>l.id==='neck');if(!neck)return '';
 const r=fabricRings(neck.svgRaw).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)))[0];if(!r?.length)return '';
 if(Math.max(...r.map(p=>p.y))-Math.min(...r.map(p=>p.y))<(Math.max(...r.map(p=>p.x))-Math.min(...r.map(p=>p.x)))*.65)return '';
 const torso=fabricRings(layers.find(l=>l.id==='base')?.svgRaw??'').sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)))[0]??[];
 const walk=(a:number,b:number)=>{const ps=[r[a]];for(let i=(a+1)%r.length;i!==b;i=(i+1)%r.length){ps.push(r[i]);if(ps.length>r.length)return [];}ps.push(r[b]);return ps;};
 const length=(ps:P[])=>ps.slice(1).reduce((n,p,i)=>n+distance(ps[i],p),0);
 const trim=(ps:P[])=>{let left=14;while(ps.length>1&&left>0){const d=distance(ps[0],ps[1]);if(d<=left){left-=d;ps.shift();}else{ps[0]={x:ps[0].x+(ps[1].x-ps[0].x)*left/d,y:ps[0].y+(ps[1].y-ps[0].y)*left/d};left=0;}}return ps;};
 return [false,true].map(right=>{const ids=r.map((_,i)=>i).filter(i=>right?r[i].x>1024:r[i].x<1024);const top=ids.reduce((n,i)=>r[i].y<r[n].y?i:n,ids[0]),extreme=ids.reduce((n,i)=>(right?r[i].x>r[n].x:r[i].x<r[n].x)?i:n,ids[0]),edgeIds=ids.filter(i=>Math.abs(r[i].x-r[extreme].x)<60),tip=edgeIds.reduce((n,i)=>r[i].y>r[n].y?i:n,edgeIds[0]);const a=walk(top,tip),b=walk(tip,top).reverse(),arc=length(a)<length(b)?a:b;let bridge='';const join=r[extreme],direction=right?1:-1,samples=torso.filter(p=>{const dx=(p.x-join.x)*direction;return dx>30&&dx<140&&Math.abs(p.y-join.y)<120;});if(samples.length>1){const mx=samples.reduce((n,p)=>n+p.x,0)/samples.length,my=samples.reduce((n,p)=>n+p.y,0)/samples.length,den=samples.reduce((n,p)=>n+(p.x-mx)**2,0),slope=samples.reduce((n,p)=>n+(p.x-mx)*(p.y-my),0)/(den||1),at=(x:number)=>my+slope*(x-mx);const crosses:P[]=[];for(let i=1;i<arc.length;i++){const a=arc[i-1],b=arc[i],fa=a.y-at(a.x),fb=b.y-at(b.x);if(fa*fb<=0&&Math.abs(fa-fb)>1e-6){const t=fa/(fa-fb);crosses.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}if(crosses.length&&Math.abs(slope)<2){const q=crosses.reduce((n,p)=>distance(p,join)<distance(n,join)?p:n,crosses[0]);bridge='M'+pt({x:q.x+direction*40,y:at(q.x+direction*40)})+'L'+pt(q);}}return technicalContourPath(trim(trim(arc).reverse()).reverse(),false,3.2)+bridge;}).join('');
}

const ribCache=new Map<string,{lines:string;clip:string}>();
export function neckRibbing(layers:ResolvedGarmentLayer[]):{lines:string;clip:string}{
 const neck=layers.find(l=>l.id==='neck');if(!neck)return {lines:'',clip:''};const cached=ribCache.get(neck.svgRaw);if(cached)return cached;
 const rings=fabricRings(neck.svgRaw).filter(r=>Math.abs(signedArea(r))>40).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)));if(!rings.length)return {lines:'',clip:''};let lines='';
 if(/polo/i.test(neck.displayName)){const r=rings[0],xs=r.map(p=>p.x),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...r.map(p=>p.y)),edge=r.filter(p=>p.x<left+60||p.x>right-60),bottom=Math.max(...edge.map(p=>p.y));for(let x=left+4;x<right;x+=7)lines+='M'+x+','+top+'V'+bottom;
 }else{let start=rings[1],target=rings[0];if(!start){const r=rings[0],l=r.reduce((n,p,i)=>p.x<r[n].x?i:n,0),h=r.reduce((n,p,i)=>p.x>r[n].x?i:n,0),walk=(a:number,b:number)=>{const out=[r[a]];for(let i=(a+1)%r.length;i!==b;i=(i+1)%r.length){out.push(r[i]);if(out.length>r.length)return [];}out.push(r[b]);return out;};const a=walk(l,h),b=walk(h,l),mean=(ps:P[])=>ps.reduce((n,p)=>n+p.y,0)/ps.length;start=mean(a)<mean(b)?a:b;target=mean(a)<mean(b)?b:a;}
 let carried=0;for(let i=1;i<start.length;i++){const a=start[i-1],b=start[i],len=distance(a,b);for(let along=7-carried;along<len;along+=7){const t=along/len,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},q=nearest(p,target);if(distance(p,q)>3)lines+='M'+pt(p)+'L'+pt(q);}carried=(carried+len)%7;}}
 const result={lines,clip:necklineBoundary([neck])};if(ribCache.size>80)ribCache.clear();ribCache.set(neck.svgRaw,result);return result;
}
