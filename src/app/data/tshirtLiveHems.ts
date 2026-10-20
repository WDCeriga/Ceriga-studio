import svgpath from 'svgpath';
import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
import {fabricRings} from './regularConstruction';
import {signedArea} from '../features/panelling/panellingGeometry';
import {resolveHemSettings,type TshirtHemStyles} from './tshirtHemStyles';
type P={x:number;y:number};
const point=(p:P)=>p.x.toFixed(3)+','+p.y.toFixed(3);
const closed=(ps:P[])=>'M'+ps.map(point).join('L')+'Z';
const wrap=(d:string,finish:string)=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" data-live-hem-finish="'+finish+'"><g transform="translate(0,2048) scale(.1,-.1)" fill="#000000"><path fill-rule="evenodd" d="'+svgpath(d).matrix([10,0,0,-10,0,20480]).toString()+'"/></g></svg>';
const parentId=(id:string)=>id==='bodyHem'?'base':id.replace('underlayerHem','underSleeve').replace('sleeveHem','sleeve');
/** Apply finishes after sleeve construction, so fabric, seams and ribs share one live band. */
export function applyConstructedHemStyles(layers:ResolvedGarmentLayer[],styles?:TshirtHemStyles):ResolvedGarmentLayer[]{
 let result=layers;
 for(const source of layers.filter(l=>/^(bodyHem|sleeveHem(?:Left|Right)|underlayerHem(?:Left|Right))$/.test(l.id)&&l.hemSource!=='uploaded')){
  const ps=fabricRings(source.svgRaw).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)))[0];if(!ps?.length)continue;
  const settings=resolveHemSettings(styles,source.id),finish=settings.finish??'normal',depth=Math.max(.55,Math.min(1,settings.depth??1));
  const cx=ps.reduce((n,p)=>n+p.x,0)/ps.length,cy=ps.reduce((n,p)=>n+p.y,0)/ps.length;
  const xx=ps.reduce((n,p)=>n+(p.x-cx)**2,0),yy=ps.reduce((n,p)=>n+(p.y-cy)**2,0),xy=ps.reduce((n,p)=>n+(p.x-cx)*(p.y-cy),0),a=.5*Math.atan2(2*xy,xx-yy),ux=Math.cos(a),uy=Math.sin(a),nx=-uy,ny=ux;
  const bottom=Math.max(...ps.map(p=>p.x*nx+p.y*ny)),at=(t:number,n:number)=>({x:t*ux+n*nx,y:t*uy+n*ny});
  const band=ps.map(p=>{const t=p.x*ux+p.y*uy,n=p.x*nx+p.y*ny;return at(t,bottom-(bottom-n)*depth)}),d=closed(band);
  const lo=Math.min(...band.map(p=>p.x*ux+p.y*uy)),hi=Math.max(...band.map(p=>p.x*ux+p.y*uy)),top=Math.min(...band.map(p=>p.x*nx+p.y*ny));
  const parent=result.find(l=>l.id===parentId(source.id));
  const allowance='<g transform="translate(0 2048) scale(.1 -.1)" data-shared-fabric="true" data-hem-allowance="'+source.id+'" fill="#000000"><path stroke="none" fill-rule="evenodd" d="'+svgpath(closed(ps)).matrix([10,0,0,-10,0,20480]).toString()+'"/></g>';
  // The parent covers the old allowance. Changing depth never leaves a transparent strip.
  result=result.map(l=>l.id===parent?.id?{...l,svgRaw:l.svgRaw.replace('</svg>',allowance+'</svg>'),panellingClipSvgRaw:undefined}:l);
  let raw=wrap(d,finish);
  // This is the visible opening over an under-sleeve, not a finish seam.
  // Keep the exact constructed edge instead of asking linework to estimate it from the band.
  const openings=new DOMParser().parseFromString(source.svgRaw,'image/svg+xml').querySelectorAll('[data-sleeve-opening]');
  if(openings.length)raw=raw.replace('</svg>',Array.from(openings).map(p=>new XMLSerializer().serializeToString(p)).join('')+'</svg>');
  if(finish==='ribbed'){
   let ribs='';for(let t=lo+2.75;t<hi;t+=5.5)ribs+='M'+point(at(t,top))+'L'+point(at(t,bottom));
   raw=raw.replace('</svg>','<path data-hem-ribs="'+source.id+'" data-rib-weight="'+Math.max(.6,Math.min(1.5,(settings.ribWeight??.4)*2))+'" fill="none" d="'+ribs+'"/><path data-hem-rib-clip="'+source.id+'" fill="none" d="'+d+'"/><path data-hem-top-seam="'+source.id+'" fill="none" d="M'+point(at(lo,top))+'L'+point(at(hi,top))+'"/></svg>');
  }
  const tint=finish==='none'?parent?.tint:settings.color===''?parent?.tint:settings.color??source.tint??parent?.tint;
  result=result.map(l=>l.id===source.id?{...l,tint,svgRaw:raw,panellingClipSvgRaw:undefined}:l);
 }
 return result;
}
