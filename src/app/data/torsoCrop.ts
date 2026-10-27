import polygonClipping,{type MultiPolygon,type Pair} from 'polygon-clipping';
import {shoulderFabricGeometry,shoulderGeometryPath} from './tshirtShoulderGeometry';
import type {ResolvedGarmentLayer} from './garmentSvgCatalog';
const cache=new Map<string,ResolvedGarmentLayer[]>();
/** Shorten only the torso; shoulder registration, sleeves and neckline stay in place. */
export function withTorsoCrop(layers:ResolvedGarmentLayer[],amount=0):ResolvedGarmentLayer[]{
 const crop=Math.max(0,Math.min(30,amount))/100;if(!crop||typeof DOMParser==='undefined')return layers;
 const body=layers.find(l=>l.id==='base');if(!body)return layers;
 const key=JSON.stringify([layers,crop]);if(cache.has(key))return cache.get(key)!;
 const geometry=shoulderFabricGeometry(body.svgRaw),points=geometry.flat(2);if(!points.length)return layers;
 const bottom=Math.max(...points.map(p=>p[1])),top=Math.min(...points.map(p=>p[1])),cut=bottom-(bottom-top)*crop,left=Math.min(...points.map(p=>p[0])),right=Math.max(...points.map(p=>p[0]));
 const rect=(x:number,y:number,w:number,h:number):MultiPolygon=>[[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]] as Pair[]]];
 const cropped=polygonClipping.intersection(geometry,rect(0,0,2048,cut));
 const hem=polygonClipping.intersection(cropped,rect(0,cut-24,2048,24));
 const wrap=(shape:MultiPolygon)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" data-torso-crop="${amount}"><g transform="matrix(1 0 0 1 0 0)" fill="#000"><path fill-rule="evenodd" d="${shoulderGeometryPath(shape)}"/></g></svg>`;
 const result=layers.map(layer=>{
  if(layer.id==='base'||layer.id==='bodyHem')return {...layer,svgRaw:wrap(layer.id==='base'?cropped:hem),panellingClipSvgRaw:undefined};
  if(layer.id==='outline'||layer.id==='stitching'){
   const id='crop-keep-'+layer.id,keep=`<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><rect width="2048" height="2048" fill="white"/><rect x="${left-8}" y="${cut-2}" width="${right-left+16}" height="${2048-cut+2}" fill="black"/></mask></defs>`;
   return {...layer,svgRaw:layer.svgRaw.replace(/(<svg[^>]*>)/,'$1'+keep+`<g mask="url(#${id})">`).replace('</svg>','</g></svg>')};
  }
  return layer;
 });cache.set(key,result);if(cache.size>24)cache.delete(cache.keys().next().value!);return result;
}
