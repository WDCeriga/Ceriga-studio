import {stablePolygonUnion} from '../../lib/stablePolygonUnion';
import svgpath from 'svgpath';
import {useEffect,useId,useRef,useState} from 'react';
import polygonClipping,{type MultiPolygon,type Pair} from 'polygon-clipping';
import simplify from 'simplify-js';
import {sampleGarmentSurfaces,flattenPathContours,pointInLoop,projectToSegment,distance,signedArea} from './panellingGeometry';
import {TECH_OUTLINE_WIDTH,TECH_CONSTRUCTION_WIDTH,TECH_CURVE_TOLERANCE} from '../../lib/technicalDrawing';
import type {BoundaryLoop,PanellingPoint} from './panellingTypes';
const polygon=(loops:BoundaryLoop[]):MultiPolygon=>loops.filter(l=>l.role==='outer').map(outer=>{
 const ring=(points:PanellingPoint[]):Pair[]=>[...points,points[0]].map(p=>[p.x,p.y]);
 return [ring(outer.points),...loops.filter(h=>h.role==='hole'&&pointInLoop(h.points[0],outer.points)).map(h=>ring(h.points))];
});
export function technicalContourPath(points:PanellingPoint[],closed=false,tolerance=TECH_CURVE_TOLERANCE,preserve?:(p:PanellingPoint)=>boolean){
 if(points.length<2)return '';
 let reduced:PanellingPoint[];
 if(closed){let split=1;for(let i=2;i<points.length;i++)if(distance(points[0],points[i])>distance(points[0],points[split]))split=i;
 reduced=[...simplify(points.slice(0,split+1),tolerance,true).slice(0,-1),...simplify([...points.slice(split),points[0]],tolerance,true).slice(0,-1)];}
 else reduced=simplify(points,tolerance,true);
 if(preserve){const kept=new Set(reduced);reduced=points.filter(p=>kept.has(p)||preserve(p));}
 const point=(p:PanellingPoint)=>p.x.toFixed(3)+','+p.y.toFixed(3);
 const corners=reduced.map((p,i)=>{if(preserve?.(p)||!closed&&(i===0||i===reduced.length-1))return {a:p,b:p,p,smooth:false};
  const before=reduced[(i+reduced.length-1)%reduced.length],after=reduced[(i+1)%reduced.length];
  const a=distance(p,before),b=distance(p,after);const cosine=a&&b?((p.x-before.x)*(after.x-p.x)+(p.y-before.y)*(after.y-p.y))/(a*b):-1;
  // Smooth local tracing corners. Acute construction corners stay sharp; collars never use this repair.
  if(cosine<0||!a||!b)return {a:p,b:p,p,smooth:false};
  const r=Math.min(TECH_OUTLINE_WIDTH*1.5,a*.45,b*.45);
  return {a:{x:p.x+(before.x-p.x)*r/a,y:p.y+(before.y-p.y)*r/a},b:{x:p.x+(after.x-p.x)*r/b,y:p.y+(after.y-p.y)*r/b},p,smooth:true};
 });
 let path='M'+point(corners[0].b);
 for(let j=1;j<=corners.length-(closed?0:1);j++){const c=corners[j%corners.length];path+='L'+point(c.a);if(c.smooth)path+='Q'+point(c.p)+' '+point(c.b);}
 return path+(closed?'Z':'');
}
export function technicalBoundaryPaths(boundaries:BoundaryLoop[],stitchOnlyHems:string[]=[],explicitAttachments=false,explicitOpenings=false,neckFootprints:PanellingPoint[][]=[]){
 boundaries=boundaries.filter(b=>Math.abs(signedArea(b.points))>TECH_OUTLINE_WIDTH**2*4).map(b=>({...b,points:b.points.map(p=>({x:Math.round(p.x*1000)/1000,y:Math.round(p.y*1000)/1000}))}));
 const layered=boundaries.some(b=>b.surfaceId==='underSleeveLeft');
 const openingEdges=boundaries.filter(b=>['sleeveHemLeft','sleeveHemRight'].includes(b.surfaceId??'')&&b.role==='outer').map(b=>{
  const points=b.points,cx=points.reduce((n,p)=>n+p.x,0)/points.length,cy=points.reduce((n,p)=>n+p.y,0)/points.length;
  const xx=points.reduce((n,p)=>n+(p.x-cx)**2,0),yy=points.reduce((n,p)=>n+(p.y-cy)**2,0),xy=points.reduce((n,p)=>n+(p.x-cx)*(p.y-cy),0),angle=.5*Math.atan2(2*xy,xx-yy);
  const ux=Math.cos(angle),uy=Math.sin(angle),nx=-uy,ny=ux;
  const ts=points.map(p=>p.x*ux+p.y*uy),edge=Math.max(...points.map(p=>p.x*nx+p.y*ny));
  const a=Math.min(...ts)+3,z=Math.max(...ts)-3;
  return {left:b.surfaceId==='sleeveHemLeft',a:{x:a*ux+edge*nx,y:a*uy+edge*ny},b:{x:z*ux+edge*nx,y:z*uy+edge*ny}};
 });
 const openingLines=layered&&!explicitOpenings?openingEdges.map(e=>'M'+e.a.x.toFixed(3)+','+e.a.y.toFixed(3)+'L'+e.b.x.toFixed(3)+','+e.b.y.toFixed(3)).join(''):'';
 const hemBands=boundaries.filter(b=>stitchOnlyHems.includes(b.surfaceId??'')).map(b=>({minX:Math.min(...b.points.map(p=>p.x))-6,maxX:Math.max(...b.points.map(p=>p.x))+6,minY:Math.min(...b.points.map(p=>p.y))-6,maxY:Math.max(...b.points.map(p=>p.y))+6}));
 // Join normal folded hems to their parent only for presentation linework.
 const groups=new Map<string,BoundaryLoop[]>();
 for(const loop of boundaries){const id=loop.surfaceId??'';const owner=stitchOnlyHems.includes(id)?id.replace('sleeveHem','sleeve').replace('underlayerHem','underSleeve').replace('bodyHem','base'):id;groups.set(owner,[...(groups.get(owner)??[]),loop]);}
 boundaries=[...groups].flatMap(([surfaceId,loops])=>{const originalIds=[...new Set(loops.map(l=>l.surfaceId))];if(originalIds.length<2)return loops;// Traced body/hem joins can differ by a few thousandths of a viewBox unit.
 // Snap only a hem's near-coincident vertices to its parent for presentation union.
 const parents=loops.filter(loop=>loop.surfaceId===surfaceId);
 const joined=loops.map(loop=>loop.surfaceId===surfaceId?loop:{...loop,points:loop.points.map(point=>{
  let best=point,nearest=.05;
  for(const parent of parents)for(let i=0;i<parent.points.length;i++){const candidate=projectToSegment(point,parent.points[i],parent.points[(i+1)%parent.points.length]).point,gap=distance(point,candidate);if(gap<nearest){best=candidate;nearest=gap;}}
  return best;
 })});
 const parts=originalIds.map(id=>polygon(joined.filter(l=>l.surfaceId===id))).filter(p=>p.length);const merged=stablePolygonUnion(parts[0],...parts.slice(1));return merged.flatMap((p,i)=>p.map((r,j)=>({id:surfaceId+i+':'+j,surfaceId,role:j?'hole' as const:'outer' as const,points:r.slice(0,-1).map(([x,y])=>({x,y}))})));});
 const ids=[...new Set(boundaries.map(b=>b.surfaceId))];
 const geometries=ids.map(id=>polygon(boundaries.filter(b=>b.surfaceId===id))).filter(g=>g.length);
 if(!geometries.length)return {fabric:'',outline:'',construction:'',maxDeviation:TECH_CURVE_TOLERANCE+TECH_OUTLINE_WIDTH/2};
 const attachments:{points:PanellingPoint[];minY:number;maxY:number;left:boolean}[]=[];
 for(const surfaceId of ['sleeveLeft','sleeveRight']){
  const ring=boundaries.filter(b=>b.surfaceId===surfaceId&&b.role==='outer').sort((a,b)=>Math.abs(signedArea(b.points))-Math.abs(signedArea(a.points)))[0]?.points;
  if(!ring?.length)continue;const left=surfaceId==='sleeveLeft',inner=(p:PanellingPoint)=>left?p.x:2048-p.x;
  const minY=Math.min(...ring.map(p=>p.y)),maxX=Math.max(...ring.map(inner));
  const start=ring.reduce((best,p,i)=>p.y<ring[best].y?i:best,0);
  const candidates=ring.map((p,i)=>({p,i})).filter(({p})=>inner(p)>maxX-4&&p.y<minY+650);
  if(!candidates.length)continue;const end=candidates.reduce((a,b)=>a.p.y>b.p.y?a:b).i;
  const arc=(a:number,b:number)=>{const result=[ring[a]];for(let i=(a+1)%ring.length;i!==b;i=(i+1)%ring.length){result.push(ring[i]);if(result.length>ring.length)return [];}result.push(ring[b]);return result;};
  if(start===end)continue;const a=arc(start,end),b=arc(end,start).reverse(),length=(p:PanellingPoint[])=>p.slice(1).reduce((n,q,i)=>n+distance(q,p[i]),0);
  const points=length(a)<length(b)?a:b;
  const opening=openingEdges.find(e=>e.left===left),hemEnd=opening?(left?(opening.a.x>opening.b.x?opening.a:opening.b):(opening.a.x<opening.b.x?opening.a:opening.b)):undefined;
  if(hemEnd&&hemEnd.y<minY+650)points.push(hemEnd);
  if(points.length>1)attachments.push({points,minY,maxY:points.at(-1)!.y,left});
 }
 const united=stablePolygonUnion(geometries[0],...geometries.slice(1));
 // Sub-stroke slivers are tracing/boolean residue, not visible garment openings.
 const exterior=united.flatMap(p=>p.slice(0,1).map(r=>r.slice(0,-1).map(([x,y])=>({x,y})))).filter(r=>Math.abs(signedArea(r))>TECH_OUTLINE_WIDTH**2);
 // The traced collar owns its ink. Omit collar boundary segments before stroking,
 // rather than enlarging a mask, which would cut gaps into adjoining shoulders.
 const collarOwns=(p:PanellingPoint)=>neckFootprints.some(r=>pointInLoop(p,r)||r.some((a,i)=>distance(p,projectToSegment(p,a,r[(i+1)%r.length]).point)<1));
 const outline=exterior.map(r=>{
  if(!neckFootprints.length)return technicalContourPath(r,true);
  const visible=r.map((a,i)=>!collarOwns({x:(a.x+r[(i+1)%r.length].x)/2,y:(a.y+r[(i+1)%r.length].y)/2}));
  if(visible.every(Boolean))return technicalContourPath(r,true);
  const start=visible.findIndex(v=>!v);let run:PanellingPoint[]=[],d='';
  for(let j=1;j<=r.length;j++){const i=(start+j)%r.length;if(visible[i]){if(!run.length)run.push(r[i]);run.push(r[(i+1)%r.length]);}else if(run.length){d+=technicalContourPath(run);run=[];}}
  if(run.length)d+=technicalContourPath(run);return d;
 }).join('')+openingLines;
 const outerSegments=exterior.flatMap(r=>r.map((a,i)=>({a,b:r[(i+1)%r.length]})));
 const key=(p:PanellingPoint)=>p.x.toFixed(4)+','+p.y.toFixed(4);
 const edges=new Map<string,{a:PanellingPoint,b:PanellingPoint}>();
 for(const loop of boundaries)for(let i=0;i<loop.points.length;i++){
   const a=loop.points[i],b=loop.points[(i+1)%loop.points.length],m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   if(distance(a,b)<1e-5)continue;
   if(outerSegments.some(s=>m.x>=Math.min(s.a.x,s.b.x)-.8&&m.x<=Math.max(s.a.x,s.b.x)+.8&&m.y>=Math.min(s.a.y,s.b.y)-.8&&m.y<=Math.max(s.a.y,s.b.y)+.8&&distance(m,projectToSegment(m,s.a,s.b).point)<.8))continue;
   edges.set([key(a),key(b)].sort().join('|'),{a,b});
 }
 const adjacency=new Map<string,string[]>();for(const [id,e]of edges)for(const p of [e.a,e.b])adjacency.set(key(p),[...(adjacency.get(key(p))??[]),id]);
 const visited=new Set<string>(),segments:PanellingPoint[][]=[];
 const trace=(id:string,start:PanellingPoint)=>{const points=[start];let at=start,current:string|undefined=id;
  while(current&&!visited.has(current)){visited.add(current);const e=edges.get(current)!;at=key(e.a)===key(at)?e.b:e.a;points.push(at);const candidates=adjacency.get(key(at))??[];current=candidates.length===2?candidates.find(k=>!visited.has(k)):undefined;}
  const closed=key(points[0])===key(points.at(-1)!);
  const length=points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);
  // Boolean intersections can leave zero-area loops and isolated trace flecks.
  if(points.length>1&&length>TECH_OUTLINE_WIDTH*6&&(!closed||Math.abs(signedArea(points))>TECH_OUTLINE_WIDTH**2*4))segments.push(points);
 };
 for(const[id,e]of edges)if(!visited.has(id)&&((adjacency.get(key(e.a))?.length??0)!==2||(adjacency.get(key(e.b))?.length??0)!==2))trace(id,(adjacency.get(key(e.a))?.length??0)!==2?e.a:e.b);
 for(const[id,e]of edges)if(!visited.has(id))trace(id,e.a);
 // A traced seam may contain small missing spans. Reconnect only nearby,
 // aligned ends; parallel seams and genuine corners cannot be bridged sideways.
 const aligned=(a:PanellingPoint[],b:PanellingPoint[])=>{const end=a.at(-1)!,start=b[0],gap=distance(end,start);if(gap<.01||gap>120)return false;const dot=(x:PanellingPoint,y:PanellingPoint)=>((y.x-x.x)*(start.x-end.x)+(y.y-x.y)*(start.y-end.y))/(distance(x,y)*gap||1);return dot(a.at(-2)!,end)>.85&&dot(start,b[1])>.85;};
 for(let pass=0;pass<segments.length;pass++){let joined=false;
  outer:for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++)for(const reverseA of [false,true])for(const reverseB of [false,true]){const a=reverseA?[...segments[i]].reverse():segments[i],b=reverseB?[...segments[j]].reverse():segments[j];if(distance(a[0],a.at(-1)!)<.01||distance(b[0],b.at(-1)!)<.01)continue;if(aligned(a,b)){segments[i]=[...a,...b];segments.splice(j,1);joined=true;break outer;}}
  if(!joined)break;
 }
 const retained=segments.filter(points=>!hemBands.some(b=>points.every(p=>p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY))&&!attachments.some(arc=>points.every(p=>p.y>=arc.minY-8&&p.y<=arc.maxY+8&&(arc.left?p.x<750:p.x>1298))));
 return {fabric:united.map(poly=>poly.map(r=>'M'+r.map(([x,y])=>x.toFixed(3)+','+y.toFixed(3)).join('L')+'Z').join('')).join(''),outline,construction:[...retained.map(points=>technicalContourPath(points,distance(points[0],points.at(-1)!)<.01)),...(explicitAttachments?[]:attachments).map(arc=>{const a=arc.points[0],b=arc.points.at(-1)!,dx=b.x-a.x,dy=b.y-a.y;return 'M'+a.x+','+a.y+'C'+(a.x+dx*.65)+','+(a.y+dy*.25)+' '+b.x+','+(b.y-dy*.3)+' '+b.x+','+b.y;})].join(''),maxDeviation:TECH_CURVE_TOLERANCE+TECH_OUTLINE_WIDTH/2};
}
export function repairClipPaths(geometryMarkup:string){
 const repairClip=new DOMParser().parseFromString(geometryMarkup,'image/svg+xml').querySelectorAll('[data-ink-repair]');
 // SVG clipPath only accepts shape children. Bake repair-window placement into
 // these disposable shapes so no invalid group can hide the replacement ink.
 return Array.from(repairClip).map(el=>{const transforms:string[]=[];for(let node:Element|null=el;node&&node.tagName.toLowerCase()!=='svg';node=node.parentElement)if(node.hasAttribute('transform'))transforms.unshift(node.getAttribute('transform')!);return '<path fill="black" stroke="none" d="'+svgpath(el.getAttribute('d')??'').transform(transforms.join(' ')).toString()+'"/>';}).join('');
}
export function TechnicalLinework({geometryMarkup,colour='#141414',stitchOnlyHems='',visibleClip='',repairOnly=true,completeOutline=false,onSurfacesChange}:{geometryMarkup:string;colour?:string;stitchOnlyHems?:string;visibleClip?:string;repairOnly?:boolean;completeOutline?:boolean;onSurfacesChange?:(surfaces:BoundaryLoop[])=>void}){
 const ref=useRef<HTMLDivElement>(null),id='technical-'+useId().replace(/:/g,'');const[paths,setPaths]=useState({fabric:'',outline:'',construction:'',maxDeviation:0});const[error,setError]=useState('');const[hemOmissions,setHemOmissions]=useState('');
 useEffect(()=>{const svg=ref.current?.querySelector('svg');if(!svg)return;try{const surfaces=sampleGarmentSurfaces(svg);setHemOmissions(Array.from(svg.querySelectorAll('[data-hem-clearance]')).map(p=>p.getAttribute('d')??'').join('')||surfaces.filter(s=>s.surfaceId==='bodyHem').map(s=>{const xs=s.points.map(p=>p.x),ys=s.points.map(p=>p.y),a=Math.min(...xs)-6,b=Math.min(...ys)-6,c=Math.max(...xs)+6,d=Math.max(...ys)+6;return 'M'+a+','+b+'H'+c+'V'+d+'H'+a+'Z';}).join(''));setPaths(technicalBoundaryPaths(surfaces,stitchOnlyHems.split(','),geometryMarkup.includes('data-sleeve-join'),geometryMarkup.includes('data-sleeve-opening'),completeOutline?surfaces.filter(s=>['neck','innerBackNeck'].includes(s.surfaceId??'')&&s.role==='outer').map(s=>s.points):Array.from(svg.querySelectorAll('[data-ink-preserve][transform]')).flatMap(el=>flattenPathContours(svgpath(el.getAttribute('d')??'').transform(el.getAttribute('transform')??'').toString(),4))));onSurfacesChange?.(surfaces);setError('');}catch(e){console.warn('Technical contour preparation failed',e);setError(String(e));}},[geometryMarkup,stitchOnlyHems,onSurfacesChange,completeOutline]);
 const clips=repairOnly&&geometryMarkup?repairClipPaths(geometryMarkup):'';
 const joins=geometryMarkup?Array.from(new DOMParser().parseFromString(geometryMarkup,'image/svg+xml').querySelectorAll('[data-sleeve-join]')).map(el=>{const transforms:string[]=[];for(let node:Element|null=el;node&&node.tagName.toLowerCase()!=='svg';node=node.parentElement)if(node.hasAttribute('transform'))transforms.unshift(node.getAttribute('transform')!);return svgpath(el.getAttribute('d')??'').transform(transforms.join(' ')).toString();}).join(''):'';
 const openingInk=geometryMarkup?Array.from(new DOMParser().parseFromString(geometryMarkup,'image/svg+xml').querySelectorAll('[data-sleeve-opening]')).map(el=>{const transforms:string[]=[];for(let node:Element|null=el;node&&node.tagName.toLowerCase()!=='svg';node=node.parentElement)if(node.hasAttribute('transform'))transforms.unshift(node.getAttribute('transform')!);return svgpath(el.getAttribute('d')??'').transform(transforms.join(' ')).toString();}).join(''):'';
 const necklines=geometryMarkup?Array.from(new DOMParser().parseFromString(geometryMarkup,'image/svg+xml').querySelectorAll('[data-neckline-boundary]')).map(el=>el.getAttribute('d')).join(''):'';
 const ribDoc=geometryMarkup?new DOMParser().parseFromString(geometryMarkup,'image/svg+xml'):undefined,ribs=ribDoc?.querySelector('path[data-technical-neck-ribs][d]')?.getAttribute('d')??'',ribClip=ribDoc?.querySelector('path[data-technical-neck-rib-clip][d]')?.getAttribute('d')??'';
 const hemDoc=geometryMarkup?new DOMParser().parseFromString(geometryMarkup,'image/svg+xml'):undefined;
 const world=(el:Element)=>{const transforms:string[]=[];for(let n:Element|null=el;n&&n.tagName.toLowerCase()!=='svg';n=n.parentElement)if(n.hasAttribute('transform'))transforms.unshift(n.getAttribute('transform')!);return svgpath(el.getAttribute('d')??'').transform(transforms.join(' ')).toString();};
 const hemRibs=Array.from(hemDoc?.querySelectorAll('[data-hem-ribs]')??[]).map((el,i)=>{const key=el.getAttribute('data-hem-ribs'),clip=Array.from(hemDoc!.querySelectorAll('[data-hem-rib-clip]')).find(p=>p.getAttribute('data-hem-rib-clip')===key),seam=Array.from(hemDoc!.querySelectorAll('[data-hem-top-seam]')).find(p=>p.getAttribute('data-hem-top-seam')===key);return {id:id+'-hem-rib-'+i,d:world(el),clip:clip?world(clip):'',seam:seam?world(seam):'',width:Number(el.getAttribute('data-rib-weight')??.8)};});
 const omittedFold=Array.from(hemDoc?.querySelectorAll('[data-omit-body-fold]')??[]).map(world).join('');
 const wornHem=Array.from(hemDoc?.querySelectorAll('[data-worn-hem-clearance]')??[]).map(world).join('');
 const hemEdges=Array.from(hemDoc?.querySelectorAll('[data-hem-edge]')??[]).map(world).join('');
 const finishSeams=Array.from(hemDoc?.querySelectorAll('[data-hem-top-seam]')??[]).filter(el=>!Array.from(hemDoc?.querySelectorAll('[data-hem-ribs]')??[]).some(r=>r.getAttribute('data-hem-ribs')===el.getAttribute('data-hem-top-seam'))).map(world).join('');
 const preserved=geometryMarkup?Array.from(new DOMParser().parseFromString(geometryMarkup,'image/svg+xml').querySelectorAll('[data-ink-preserve]')).map(el=>'<path fill="black" stroke="black" stroke-width="'+(el.hasAttribute('transform')?0:6)+'" stroke-linejoin="round" d="'+svgpath(el.getAttribute('d')??'').transform(el.getAttribute('transform')??'').toString()+'"/>').join(''):'';
 return <><div ref={ref} className="pointer-events-none absolute inset-0 invisible [&>svg]:h-full [&>svg]:w-full" aria-hidden dangerouslySetInnerHTML={{__html:geometryMarkup}}/>
 <svg data-technical-linework={id} data-geometry-tolerance={paths.maxDeviation} viewBox="0 0 2048 2048" className="pointer-events-none absolute inset-0 h-full w-full" style={{zIndex:110}} shapeRendering="geometricPrecision" fill="none" stroke={colour} strokeLinejoin="round" strokeLinecap="round">
 <defs>{wornHem&&<mask id={id+'-worn-hem'} maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><rect width="2048" height="2048" fill="white"/><path d={wornHem} fill="none" stroke="black" strokeWidth="12"/></mask>}<clipPath id={id+'-fabric'}><path d={paths.fabric} clipRule="evenodd"/></clipPath>{omittedFold&&<mask id={id+'-fold-clearance'} maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><rect width="2048" height="2048" fill="white"/><path d={omittedFold} fill="none" stroke="black" strokeWidth="10"/></mask>}{hemRibs.map(h=><clipPath key={h.id} id={h.id} clipPathUnits="userSpaceOnUse"><path d={h.clip} clipRule="evenodd"/></clipPath>)}<clipPath id={id+'-opening-clip'} clipPathUnits="userSpaceOnUse"><path d={visibleClip} clipRule="evenodd"/></clipPath><clipPath id={id+'-rib-clip'} clipPathUnits="userSpaceOnUse"><path d={ribClip} clipRule="evenodd"/></clipPath><mask id={id+'-hem-clearance'} maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><rect width="2048" height="2048" fill="white"/><path d={hemOmissions} fill="black"/></mask><mask id={id+'-preserve'} maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><rect width="2048" height="2048" fill="white"/><g dangerouslySetInnerHTML={{__html:preserved}}/></mask><mask id={id+'-construction-preserve'} maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><rect width="2048" height="2048" fill="white"/><g dangerouslySetInnerHTML={{__html:preserved.replace(/stroke-width="0"/g,'stroke-width="8"')}}/></mask><clipPath id={id+'-repair'} clipPathUnits="userSpaceOnUse" dangerouslySetInnerHTML={{__html:clips}}/></defs><g clipPath={visibleClip?'url(#'+id+'-opening-clip)':undefined}><g mask={preserved?'url(#'+id+'-preserve)':undefined} clipPath={repairOnly&&!geometryMarkup.includes('data-sleeve-join')?'url(#'+id+'-repair)':undefined}>
 <g mask={hemOmissions?'url(#'+id+'-hem-clearance)':undefined}><g mask={omittedFold?'url(#'+id+'-fold-clearance)':undefined}><g mask={wornHem?'url(#'+id+'-worn-hem)':undefined}><path mask={preserved?'url(#'+id+'-construction-preserve)':undefined} data-tech-role="construction" d={paths.construction} strokeWidth={TECH_CONSTRUCTION_WIDTH}/></g></g></g>{!completeOutline&&<path mask={omittedFold?'url(#'+id+'-fold-clearance)':undefined} data-tech-role="outline" d={paths.outline+openingInk} strokeWidth={TECH_OUTLINE_WIDTH}/>}</g>{completeOutline&&<path mask={wornHem?'url(#'+id+'-worn-hem)':undefined} data-tech-role="outline" d={paths.outline+openingInk} strokeWidth={TECH_OUTLINE_WIDTH}/>}<path clipPath={paths.fabric?'url(#'+id+'-fabric)':undefined} data-tech-role="sleeve-attachment" d={joins} strokeWidth={TECH_CONSTRUCTION_WIDTH}/>{hemRibs.map(h=><g key={h.id} clipPath={'url(#'+h.id+')'}><path data-tech-role="hem-ribbing" d={h.d} strokeWidth={h.width} opacity={.4}/><path data-tech-role="hem-seam" d={h.seam} strokeWidth={TECH_CONSTRUCTION_WIDTH}/></g>)}<path data-tech-role="texture" d={ribs} clipPath={'url(#'+id+'-rib-clip)'} strokeWidth={1.2} opacity={.5}/><path data-tech-role="hem-opening" d={hemEdges} strokeWidth={TECH_OUTLINE_WIDTH}/><path data-tech-role="hem-finish" d={finishSeams} strokeWidth={TECH_CONSTRUCTION_WIDTH}/><path data-tech-role="neckline" d={necklines} strokeWidth={TECH_OUTLINE_WIDTH}/></g></svg>{error&&<p role="alert" className="sr-only">Technical proof preparation failed: {error}</p>}</>;
}
