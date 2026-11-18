import {TANK_TSHIRT_NECK_ASSETS} from './tankTshirtNeckAssets';
import registration from './tankTshirtNeckRegistration.json';
const kindKey=(kind:string)=>({crew:'crew',thincrew:'thincrew',scoop:'scoop',deep:'scoop',athletic:'scoop',v:'vneck','deep-v':'deep-vneck'} as Record<string,string>)[kind];
export function tankTshirtNeckMaster(kind:string,fit='regular'){
 const key=fit+'.'+kindKey(kind);
 return {asset:TANK_TSHIRT_NECK_ASSETS[key],bounds:registration[key as keyof typeof registration]};
}
export function tshirtTankNeckDepth(kind:string,widthCm:number,fit='regular'){
 const {bounds}=tankTshirtNeckMaster(kind,fit);
 return bounds?widthCm*(bounds.low-bounds.top)/(bounds.max-bounds.min):undefined;
}
/** One original T-shirt master supplies band, lining and registration for both builders. */
export function tankTshirtNeck(kind:string,left:number,right:number,top:number,depth:number,fit='regular',ribbed=true){
 const {asset,bounds}=tankTshirtNeckMaster(kind,fit);
 if(!asset||!bounds)return undefined;
 const sx=(right-left)/(bounds.max-bounds.min),requestedY=depth/(bounds.low-bounds.top);
 const sy=Math.abs(requestedY-sx)<.01?sx:requestedY;
 const transform=`translate(${left-bounds.min*sx} ${top-bounds.top*sy}) scale(${sx} ${sy})`;
 const contents=(svg:string)=>svg.replace(/^.*?<svg[^>]*>|<\/svg>\s*$/gs,'');
 const band=ribbed?asset.neck:asset.cleanNeck??asset.neck;
 const inside=ribbed?asset.inside:asset.cleanInside??asset.inside;
 const outline=ribbed?asset.outline:asset.cleanOutline??asset.outline;
 const placeFabric=(svg:string,attributes='')=>contents(svg).replace(
  /<g transform="([^"]*)"/,
  (_,originalTransform:string)=>`<g${attributes} transform="${transform} ${originalTransform}"`,
 );
 return {
  joinX:left+(bounds.joinX-bounds.min)*sx,joinY:top+(bounds.joinY-bounds.top)*sy,
  fill:placeFabric(band,` data-shared-tshirt-neck="${fit}.${kindKey(kind)}"`),
  inside:placeFabric(inside),
  outline:`<g data-shared-tshirt-neck-ink="true" transform="${transform}">${contents(outline)}</g>`,
 };
}
