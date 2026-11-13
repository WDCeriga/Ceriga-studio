import svgpath from 'svgpath';
import type {MultiPolygon, Pair} from 'polygon-clipping';
import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
import {fabricRings} from './regularConstruction';
import {flattenPathContours,signedArea} from '../features/panelling/panellingGeometry';
import {stablePolygonIntersection,stablePolygonUnion} from '../lib/stablePolygonUnion';
import {hemFoldLine} from './tshirtHemInk';
import {adjustableHemHardware,hoodieBodyTerminal,rawEdgeTreatment} from './hoodieFinishes';
import {shoulderFabricGeometry} from './tshirtShoulderGeometry';
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
  const settings=resolveHemSettings(styles,source.id),finish=settings.finish??'normal',depth=settings.depthCm!==undefined?Math.max(.4,Math.min(2.4,settings.depthCm/2.5)):Math.max(.55,Math.min(1,settings.depth??1));
  const cx=ps.reduce((n,p)=>n+p.x,0)/ps.length,cy=ps.reduce((n,p)=>n+p.y,0)/ps.length;
  const xx=ps.reduce((n,p)=>n+(p.x-cx)**2,0),yy=ps.reduce((n,p)=>n+(p.y-cy)**2,0),xy=ps.reduce((n,p)=>n+(p.x-cx)*(p.y-cy),0),a=.5*Math.atan2(2*xy,xx-yy),ux=Math.cos(a),uy=Math.sin(a),nx=-uy,ny=ux;
  const bottom=Math.max(...ps.map(p=>p.x*nx+p.y*ny)),at=(t:number,n:number)=>({x:t*ux+n*nx,y:t*uy+n*ny});
  const band=ps.map(p=>{const t=p.x*ux+p.y*uy,n=p.x*nx+p.y*ny;return at(t,bottom-(bottom-n)*depth)});
  const lo=Math.min(...band.map(p=>p.x*ux+p.y*uy)),hi=Math.max(...band.map(p=>p.x*ux+p.y*uy)),top=Math.min(...band.map(p=>p.x*nx+p.y*ny));
  const parent=result.find(l=>l.id===parentId(source.id));
  // Clip an inward-growing finish to its own fabric, never to the neighbouring body.
  const polygon=(ring:P[]):MultiPolygon=>[[[...ring,ring[0]].map(p=>[Math.round(p.x*100)/100,Math.round(p.y*100)/100] as Pair)]];
  const parentRing=parent?fabricRings(parent.svgRaw).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)))[0]:undefined;
  const allowanceRing = source.id === 'bodyHem' && parentRing
    ? ps.map(p => {
      const n = p.x * nx + p.y * ny;
      const overlap = Math.min(12, Math.max(0, bottom - n));
      return { x: p.x - nx * overlap, y: p.y - ny * overlap };
    }) : ps;
  const footprint=parentRing?stablePolygonUnion(polygon(parentRing),polygon(allowanceRing)):polygon(ps);
  // Intersect a strip with the real silhouette so changing depth cannot
  // distort the terminal edge or reuse the old band's sidewall angle.
  const stripTop = settings.construction === 'raw' ? bottom - 51 : top;
  const strip = [at(lo-30,stripTop),at(hi+30,stripTop),at(hi+30,bottom+3),at(lo-30,bottom+3)];
  const clipped=stablePolygonIntersection(polygon(strip),footprint);
  const d=clipped.map(poly=>poly.map(ring=>closed(ring.slice(0,-1).map(([x,y])=>({x,y})))).join('')).join('');
  const allowance='<g transform="translate(0 2048) scale(.1 -.1)" data-shared-fabric="true" data-hem-allowance="'+source.id+'" fill="#000000"><path stroke="none" fill-rule="evenodd" d="'+svgpath(closed(allowanceRing)).matrix([10,0,0,-10,0,20480]).toString()+'"/></g>';
  result=result.map(l=>l.id===parent?.id?{...l,svgRaw:l.svgRaw.replace('</svg>',allowance+'</svg>'),panellingClipSvgRaw:undefined}:l);
  let raw=wrap(d,finish).replace('<svg ', '<svg data-hem-construction="'+(settings.construction??finish)+'" ');
  raw=raw.replace('</svg>','<path data-hem-clearance="'+source.id+'" fill="none" d="'+d+'"/></svg>');
  if(source.id==='bodyHem'&&finish!=='ribbed'&&settings.construction!=='binding'&&settings.construction!=='turn-up'){
   const oldFold=hemFoldLine(ps);
   if(oldFold)raw=raw.replace('</svg>','<path data-omit-body-fold="true" fill="none" d="'+oldFold+'"/></svg>');
  }
  const seamPositions:number[]=[];
  for(const poly of clipped)for(const ring of poly)for(let i=1;i<ring.length;i++){
   const [ax,ay]=ring[i-1],[bx,by]=ring[i],an=ax*nx+ay*ny,bn=bx*nx+by*ny;
   if(Math.abs(an-top)<.05)seamPositions.push(ax*ux+ay*uy);
   if((an-top)*(bn-top)<0){const f=(top-an)/(bn-an);seamPositions.push((ax+(bx-ax)*f)*ux+(ay+(by-ay)*f)*uy);}
  }
  const seamLo=seamPositions.length?Math.min(...seamPositions):lo,seamHi=seamPositions.length?Math.max(...seamPositions):hi;
  if(settings.construction==='double-fold'){
   const firstFold=Math.max(.2,Math.min((settings.depthCm??2.5)-.2,settings.firstFoldCm??.8));
   const second=bottom-(bottom-top)*firstFold/(settings.depthCm??2.5);
   const row=(n:number)=>'M'+point(at(seamLo+9,n))+'L'+point(at(seamHi-9,n));
   raw=raw.replace('</svg>',`<defs><path data-double-fold-row="true" fill="none" d="${row(top+4)}"/><path data-double-fold-row="true" fill="none" d="${row(second)}"/></defs></svg>`);
  }
  // This is the visible opening over an under-sleeve, not a finish seam.
  // Keep the exact constructed edge instead of asking linework to estimate it from the band.
  const openings=new DOMParser().parseFromString(source.svgRaw,'image/svg+xml').querySelectorAll('[data-sleeve-opening]');
  if(openings.length)raw=raw.replace('</svg>',Array.from(openings).map(p=>new XMLSerializer().serializeToString(p)).join('')+'</svg>');
  if(settings.construction==='binding'||settings.construction==='turn-up'){raw=raw.replace('</svg>','<path data-hem-top-seam="'+source.id+'" fill="none" d="M'+point(at(seamLo,top))+'L'+point(at(seamHi,top))+'"/></svg>');}
  if(finish==='ribbed'){
   let ribs='';for(let t=lo+2.75;t<hi;t+=5.5)ribs+='M'+point(at(t,top))+'L'+point(at(t,bottom));
   raw=raw.replace('</svg>','<path data-hem-ribs="'+source.id+'" data-rib-weight="'+Math.max(.6,Math.min(1.5,(settings.ribWeight??.4)*2))+'" fill="none" d="'+ribs+'"/><path data-hem-rib-clip="'+source.id+'" fill="none" d="'+d+'"/><path data-hem-top-seam="'+source.id+'" fill="none" d="M'+point(at(seamLo,top))+'L'+point(at(seamHi,top))+'"/></svg>');
  }
  const tint=finish==='none'?parent?.tint:settings.color===''?parent?.tint:settings.color??source.tint??parent?.tint;
  result=result.map(l=>l.id===source.id?{...l,tint,svgRaw:raw,panellingClipSvgRaw:undefined}:l);
  if(settings.construction==='raw'){
   const opening = new DOMParser().parseFromString(source.svgRaw,'image/svg+xml')
     .querySelector('[data-terminal-opening]')?.getAttribute('d');
   const edge = opening ? [...opening.matchAll(/-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi)].map(match => Number(match[0])) : [];
   const a=edge.length===4?{x:edge[0],y:edge[1]}:at(lo,bottom);
   const b=edge.length===4?{x:edge[2],y:edge[3]}:at(hi,bottom);
   const rawMarkup=rawEdgeTreatment([a.x,a.y,b.x,b.y],source.id==='bodyHem'?17:source.id.endsWith('Right')?37:23);
   result=[...result,{id:source.id+'Fray',category:'Hem finish',assetId:'generated:raw-'+source.id,
    displayName:'Raw edge fibres',kind:'detail',zIndex:86,svgRaw:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><g data-hem-fray="true" data-fixed-ink="true" fill="none" stroke-linecap="round"><path fill="#252030" opacity=".16" d="${d}"/>${rawMarkup}</g></svg>`}];
  }
 }
 return result;
}

export function refreshRawTshirtCuffs(layers: ResolvedGarmentLayer[], styles?: TshirtHemStyles) {
  const raw = layers.filter(layer => /^(sleeveHem|underlayerHem)/.test(layer.id) &&
    resolveHemSettings(styles, layer.id).construction === 'raw' && !layer.id.endsWith('Fray'));
  if (!raw.length) return layers;
  const refreshed = applyConstructedHemStyles([...layers.filter(layer =>
    /^(sleeve|underSleeve)(Left|Right)$/.test(layer.id)), ...raw], styles).filter(layer => layer.id.endsWith('Fray'));
  const ids = new Set(refreshed.map(layer => layer.id));
  return [...layers.filter(layer => !ids.has(layer.id)), ...refreshed];
}

/** Bridge the independently traced torso and hem at the fabric level. */
export function registerTshirtBottomHem(layers: ResolvedGarmentLayer[]) {
  const body = layers.find(layer => layer.id === 'base');
  const hem = layers.find(layer => layer.id === 'bodyHem' && layer.kind === 'solid' && layer.hemSource !== 'uploaded');
  if (!body || !hem) return layers;
  const bodyGeometry = shoulderFabricGeometry(body.svgRaw);
  const hemGeometry = shoulderFabricGeometry(hem.svgRaw);
  const spanAt = (geometry: MultiPolygon, y: number) => {
    const xs: number[] = [];
    for (const [ring] of geometry) for (let i = 1; i < ring.length; i++) {
      const [ax, ay] = ring[i - 1], [bx, by] = ring[i];
      if ((ay > y) !== (by > y)) xs.push(ax + (bx - ax) * (y - ay) / (by - ay));
    }
    return xs.length > 1 ? [Math.min(...xs), Math.max(...xs)] : undefined;
  };
  const hemY = hemGeometry.flat(2).map(point => point[1]);
  const bodyY = bodyGeometry.flat(2).map(point => point[1]);
  if (!hemY.length || !bodyY.length) return layers;
  const hemTop = Math.min(...hemY), hemBottom = Math.max(...hemY);
  const bodyBottom = Math.max(...bodyY);
  if (hemTop - bodyBottom > 30) return layers;
  const aboveY = Math.min(hemTop, bodyBottom) - 7;
  const belowY = Math.min(hemTop + 9, hemBottom - 1);
  const above = spanAt(bodyGeometry, aboveY), below = spanAt(hemGeometry, belowY);
  if (!above || !below || belowY <= aboveY) return layers;
  const bridge = closed([
    {x:above[0],y:aboveY}, {x:above[1],y:aboveY},
    {x:below[1],y:belowY}, {x:below[0],y:belowY},
  ]);
  const backing = `<g transform="matrix(1 0 0 1 0 0)" data-shared-fabric="true" fill="#000000"><path data-bottom-hem-bridge="true" d="${bridge}" stroke="none"/></g>`;
  return layers.map(layer => layer === body ? {
    ...layer, svgRaw: layer.svgRaw.replace('</svg>', backing + '</svg>'), panellingClipSvgRaw: undefined,
  } : layer);
}

export function refreshCroppedTshirtHem(layers: ResolvedGarmentLayer[], styles?: TshirtHemStyles) {
  const hem = layers.find(layer => layer.id === 'bodyHem' && layer.svgRaw.includes('data-torso-crop'));
  if (!hem) return layers;
  const body = layers.find(layer => layer.id === 'base');
  if (!body) return layers;
  const refreshed = applyConstructedHemStyles([body, hem], styles);
  return [
    ...layers.filter(layer => layer.id !== 'bodyHemFray').map(layer =>
      layer.id === 'bodyHem' ? refreshed.find(part => part.id === layer.id) ?? layer : layer),
    ...refreshed.filter(layer => layer.id === 'bodyHemFray'),
  ];
}

/** Replace just the lower body on a completed T-shirt drawing. */
export function withTshirtCasing(layers: ResolvedGarmentLayer[], styles: TshirtHemStyles | undefined, front: boolean): ResolvedGarmentLayer[] {
  const settings = resolveHemSettings(styles, 'bodyHem');
  const kind = settings.construction;
  if (kind !== 'elasticated' && kind !== 'adjustable') return layers;
  const body = layers.find(layer => layer.id === 'base');
  const hem = layers.find(layer => layer.id === 'bodyHem');
  if (!body || !hem) return layers;
  const toPolygon = (points: P[]): MultiPolygon => points.length < 3 ? [] :
    [[[...points, points[0]].map(p => [p.x, p.y] as Pair)]];
  const bodyRings = fabricRings(body.svgRaw).sort((a,b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)));
  const hemRings = fabricRings(hem.svgRaw);
  const points = bodyRings[0];
  if (!points?.length) return layers;
  const bottom = Math.max(...[points, ...hemRings].flat().map(p => p.y));
  const seamY = bottom - 104;
  const sideAt = (y: number) => {
    const intersections = points.flatMap((a,i) => {
      const b = points[(i+1)%points.length];
      return (a.y > y) === (b.y > y) ? [] : [a.x + (b.x-a.x)*(y-a.y)/(b.y-a.y)];
    });
    return Math.min(...intersections);
  };
  const left = sideAt(seamY), previous = sideAt(seamY-30);
  if (!Number.isFinite(left + previous)) return layers;
  const terminal = hoodieBodyTerminal(kind, [left,seamY], [previous,seamY-30], bottom, (settings.depthCm ?? 3.5)*17);
  const upper = stablePolygonIntersection(toPolygon(points), [[[[0,0],[2048,0],[2048,seamY],[0,seamY],[0,0]]]]);
  const lower = flattenPathContours(`M ${left} ${seamY} ${terminal.left} ${terminal.edge} ${terminal.right} Z`, 1)[0] ?? [];
  const combined = stablePolygonUnion(upper,toPolygon(lower));
  const d = combined.map(poly => poly.map(r => closed(r.map(([x,y]) => ({x,y})))).join('')).join('');
  const svg = (content:string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048">${content}</svg>`;
  const thread = settings.stitchStyle === 'none' ? '' :
    `<path d="${terminal.channel}" fill="none" stroke="${settings.stitchColor || '#d5d1cc'}" stroke-width="${settings.stitchThread === 'heavy' ? 5 : settings.stitchThread === 'fine' ? 3 : 4}" stroke-dasharray="9 7"/>`;
  const gathers = `<path d="${terminal.gathers}" fill="none" stroke="#302b30" stroke-width="2.6" opacity=".7"/>`;
  const hardware = kind === 'adjustable' && front ? adjustableHemHardware(terminal.end[0],2048-terminal.end[0],bottom) : '';
  return [...layers.map(layer => {
    if (layer.id === 'base') return {...layer,svgRaw:wrap(d,'normal'),panellingClipSvgRaw:undefined};
    if (layer.id === 'bodyHem') return {...layer,kind:'detail' as const,svgRaw:svg(`<path fill="none" d="M ${left} ${seamY} ${terminal.left} ${terminal.edge} ${terminal.right} Z"/>`),panellingClipSvgRaw:undefined};
    return layer;
  }), {id:'bodyHemCasing',category:'Hem finish',assetId:'generated:tshirt-casing',displayName:'Hem casing',
    kind:'detail',zIndex:86,svgRaw:svg(`<g data-fixed-ink="true">${gathers}${thread}${hardware}</g>`)}];
}
