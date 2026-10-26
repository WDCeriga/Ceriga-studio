import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
import {fabricRings} from './regularConstruction';
import {signedArea} from '../features/panelling/panellingGeometry';
import {resolveHemSettings,type TshirtHemStyles} from './tshirtHemStyles';
export function hemFoldLine(points:{x:number;y:number}[]):string{
 if(points.length<3)return '';const a=Math.min(...points.map(p=>p.x))+8,b=Math.max(...points.map(p=>p.x))-8;
 const samples:{x:number;y:number}[]=[];
 for(let k=0;k<=48;k++){const x=a+(b-a)*k/48,ys:number[]=[];for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];if((p.x<=x&&q.x>x)||(q.x<=x&&p.x>x))ys.push(p.y+(q.y-p.y)*(x-p.x)/(q.x-p.x));}if(ys.length)samples.push({x,y:Math.min(...ys)});}
 return samples.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(3)},${p.y.toFixed(3)}`).join('');
}
/** A normal folded hem has thread, not a second structural panel outline. */
export function withoutBodyHemFoldInk(layers:ResolvedGarmentLayer[],styles?:TshirtHemStyles):ResolvedGarmentLayer[]{
 const settings=resolveHemSettings(styles,'bodyHem');if(settings.finish==='ribbed'||settings.construction==='binding'||settings.construction==='turn-up')return layers;
 const hem=layers.find(l=>l.id==='bodyHem');if(!hem)return layers;
 const ring=fabricRings(hem.svgRaw).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)))[0]??[],d=hemFoldLine(ring);if(!d)return layers;
 const key='body-fold-'+Array.from(d).reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,0).toString(36);
 return layers.map(l=>l.id!=='outline'?l:{...l,svgRaw:l.svgRaw.replace(/(<svg[^>]*>)/,'$1'+`<defs><mask id="${key}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><rect width="2048" height="2048" fill="white"/><path d="${d}" fill="none" stroke="black" stroke-width="10"/></mask></defs><g mask="url(#${key})">`).replace(/<\/svg>\s*$/,'</g><path data-omit-body-fold="true" fill="none" d="'+d+'"/></svg>')});
}
