import svgpath from 'svgpath';
import {withShoulderConstruction,type ShoulderConstruction} from './shoulderConstruction';
import {withRoundedShoulderCaps} from './tshirtShoulderGeometry';
import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
let sharedSleeves:Promise<void>|undefined;
let sharedReady=false;
/** Load the same traced sleeve family used by the other fits, before publishing the new fit. */
export async function preloadOversizedReference(_view:string,neckName?:string):Promise<boolean>{
 const first=!sharedSleeves;
 if(!sharedSleeves)sharedSleeves=(async()=>{
  const c=await import('./garmentSvgCatalog'),s=await import('./tshirtLongSleeves'),base=c.getDefaultGarmentSelection('tshirt','regular');
  const choices=c.getGarmentAssetsForFit('tshirt','Sleeve length','regular');
  await Promise.all(choices.map(async asset=>{const selected=c.applyGarmentSelectionLinks('tshirt',{...base,[asset.category]:asset.id},'regular');await c.preloadGarmentSvgAssets(Object.values(selected))}));
  await Promise.all(['cap','longer-short','long','layered-long'].map(v=>s.preloadTshirtSleeveAssets('regular',v as 'cap'|'longer-short'|'long'|'layered-long')));
 })();await sharedSleeves;sharedReady=true;
 if(neckName){const c=await import('./garmentSvgCatalog'),name=c.garmentChoiceLabel(neckName),neck=c.getGarmentAssetsForFit('tshirt','Neck','regular').find(a=>c.garmentChoiceLabel(a.displayName)===name);if(neck){const selected=c.applyGarmentSelectionLinks('tshirt',{...c.getDefaultGarmentSelection('tshirt','regular'),Neck:neck.id},'regular');await c.preloadGarmentSvgAssets(Object.values(selected));}}
 return first;
}
const cache=new Map<string,ResolvedGarmentLayer[]>();
/** One complete traced construction, preserving the approved Oversized silhouette.
 * Transform every part together: seams, cuffs, neckline and fabric can never drift apart. */
export function withOversizedReference(layers:ResolvedGarmentLayer[],view:string,shoulder:string|undefined,length:string,native?:ResolvedGarmentLayer[]):ResolvedGarmentLayer[]{
 if(!sharedReady||!native||!['base','sleeveLeft','sleeveRight','sleeveHemLeft','sleeveHemRight','bodyHem','outline','stitching'].every(id=>native.some(l=>l.id===id))||!native.some(l=>l.svgRaw.includes('data-raster-neck')))return layers;
 const key=JSON.stringify([view,shoulder,length,native]);const old=cache.get(key);if(old)return old;
 const construction=withRoundedShoulderCaps(withShoulderConstruction(native,shoulder as ShoulderConstruction??'set-in','regular',view as 'front'|'back','ribbed',undefined,shoulder&&shoulder!=='set-in'?48:0));
 // Add chest ease without shortening the body or altering the vertical shoulder placement.
 const fitMatrix=new DOMMatrix([1.07,0,0,1,-1024*.07,0]);
 const result=construction.map(source=>{
  const doc=new DOMParser().parseFromString(source.svgRaw,'image/svg+xml'),root=doc.documentElement;
  // Bake the complete inherited transform into path coordinates, including clipping definitions.
  // This keeps the renderer, material masks, stitches and hit-testing in one coordinate system.
  for(const el of root.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line')){
   const chain:Element[]=[];for(let node:Element|null=el;node&&node!==root;node=node.parentElement)chain.unshift(node);
   let matrix=fitMatrix;for(const node of chain){const local=(node as SVGGraphicsElement).transform?.baseVal.consolidate()?.matrix;if(local)matrix=matrix.multiply(local)}
   if(el.tagName==='path'){el.setAttribute('d',svgpath(el.getAttribute('d')??'').matrix([matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f]).toString());el.removeAttribute('transform');}
   else el.setAttribute('transform',`matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
  }
  root.querySelectorAll('g[transform]').forEach(g=>g.removeAttribute('transform'));
  const groups=Array.from(root.querySelectorAll('g')).filter(g=>!g.closest('defs')&&g.querySelector('path'));
  const fabric=groups.find(g=>g.getAttribute('fill')==='#000000')??groups[0];
  if(fabric)fabric.setAttribute('transform','matrix(1 0 0 1 0 0)');
  for(const shared of root.querySelectorAll('g[data-shared-fabric]'))shared.setAttribute('transform','matrix(1 0 0 1 0 0)');
  root.setAttribute('data-oversized-reference','true');root.setAttribute('data-raster-neck','true');root.setAttribute('data-shoulder-construction','true');root.setAttribute('data-tech-ink-boldness','0');
  const original=layers.find(l=>l.id===source.id);
  return {...source,...(original?{tint:original.tint,displayName:original.displayName,fabricRegion:original.fabricRegion}:{}),assetId:(original?.assetId??source.assetId)+':oversized-shared:'+length,svgRaw:new XMLSerializer().serializeToString(root),panellingClipSvgRaw:undefined,constructionSvg:undefined,stitchSvg:undefined};
 });cache.set(key,result);if(cache.size>16)cache.delete(cache.keys().next().value!);return result;
}
