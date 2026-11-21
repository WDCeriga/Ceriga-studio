import {tankHem} from './tankHem';
import type {GarmentAssetSelection,ResolvedGarmentLayer} from './garmentSvgCatalog';

/** Dedicated front and Y-back drafting, following the racerback reference. */
export function racerbackLayers(s:GarmentAssetSelection,back:boolean,p:{
 top:number;chest:number;hem:number;end:number;neckHalf:number;drop:number;frontDrop:number;backDrop:number;armDepth:number;strap:number;
 silhouette:{waistRatio:number;waistPosition:number;shoulderDrop:number;hemBow:number;armSweep:number};
}):ResolvedGarmentLayer[]{
 const {top,chest,hem,end,neckHalf,drop,armDepth,silhouette}=p,c=1024;
 const shoulder=neckHalf+p.strap,sy=top+silhouette.shoulderDrop,arm=top+armDepth;
 const waist=chest*silhouette.waistRatio,wy=arm+(end-arm)*silhouette.waistPosition;
 const curved=(l:number,r:number,y:number,d:number,reverse=false,front=!back)=>{
  const a=reverse?r:l,b=reverse?l:r;
  if(front&&(s.tankNeck==='v'||s.tankNeck==='deep-v'))return `${reverse?'L':'M'}${a} ${y}Q${a} ${y+d*.45} ${c} ${y+d}Q${b} ${y+d*.45} ${b} ${y}`;
  if(front&&s.tankNeck==='square')return `${reverse?'L':'M'}${a} ${y}L${a} ${y+d-12}Q${a} ${y+d} ${a+(reverse?-12:12)} ${y+d}H${b+(reverse?12:-12)}Q${b} ${y+d} ${b} ${y+d-12}L${b} ${y}`;
  const direction=reverse?-1:1;
  const control=(r-l)*(front?.065:.24)*direction;
  return `${reverse?'L':'M'}${a} ${y}C${a+control} ${y+d*4/3} ${b-control} ${y+d*4/3} ${b} ${y}`;
 };
 const neck=curved(c-neckHalf,c+neckHalf,top,drop);
 type Point=[number,number];
 type Curve=[Point,Point,Point];
 const shoulderPoint:Point=[-shoulder,sy];
 const armCurves=(rear:boolean):Curve[]=>rear ? [
  [[-shoulder*.71,top+armDepth*.24],[-chest*.215,top+armDepth*.38],[-chest*.215,top+armDepth*.63]],
  [[-chest*.215,top+armDepth*.97],[-chest*.86,arm+armDepth*.12],[-chest,arm]],
 ] : [
  [[-shoulder+chest*.05+silhouette.armSweep*.45,top+armDepth*.41],[-shoulder-chest*.025+silhouette.armSweep*.2,top+armDepth*.83],[-chest,arm]],
 ];
 const point=([x,y]:Point,mirror=1,inset=0,dy=0)=>`${c+mirror*(x+inset)} ${y+dy}`;
 const armPath=(rear:boolean,mirror=1,inset=0,dy=0)=>armCurves(rear).map(curve=>`C${curve.map(p=>point(p,mirror,inset,dy)).join(' ')}`).join('');
 const reverseArm=(rear:boolean,inset=0,dy=0)=> {
  const curves=armCurves(rear);
  return curves.map(([a,b],i)=>[b,a,i===0?shoulderPoint:curves[i-1][2]] as Curve).reverse().map(curve=>`C${curve.map(p=>point(p,1,inset,dy)).join(' ')}`).join('');
 };
 const armLeft=(inset=0)=>`M${point(shoulderPoint,1,inset)}${armPath(back,1,inset,back?inset*.65:0)}`;
 const hemStyle=s.tankHem??'single',bottom=end+(back&&hemStyle==='dropped'?45:0),bow=hemStyle==='curved'?64:silhouette.hemBow;
 const leftSide=`M${c-chest} ${arm}C${c-chest+8} ${arm+(bottom-arm)*.18} ${c-waist} ${wy-42} ${c-waist} ${wy}C${c-waist} ${wy+96} ${c-hem+8} ${bottom-85} ${c-hem} ${bottom}`;
 const body=`${neck}L${point(shoulderPoint,-1)}${armPath(back,-1)}C${c+chest-8} ${arm+(bottom-arm)*.18} ${c+waist} ${wy-42} ${c+waist} ${wy}C${c+waist} ${wy+96} ${c+hem-8} ${bottom-85} ${c+hem} ${bottom}Q${c} ${bottom+bow} ${c-hem} ${bottom}C${c-hem+8} ${bottom-85} ${c-waist} ${wy+96} ${c-waist} ${wy}C${c-waist} ${wy-42} ${c-chest+8} ${arm+(bottom-arm)*.18} ${c-chest} ${arm}${reverseArm(back)}Z`;
 const layers:ResolvedGarmentLayer[]=[];
 const svg=(content:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" data-tank-top="true" data-racerback-reference="true" data-no-fabric-edge-seal="true">${content}</svg>`;
 const add=(id:string,name:string,content:string,solid=false,role='body',z=solid?10:30)=>layers.push({id,category:id,assetId:'studio-tank:classic:racer:'+id,displayName:name,kind:solid?'solid':'detail',svgRaw:svg(content),zIndex:z,...(solid?{fabricRegion:{role,materialCategory:role==='neck'?'neck':role==='hem'?'hem':'body',...(role==='interior'?{interior:true,surface:'reverse',exteriorPartId:'base'}:role==='armhole'?{fallbackFromId:'base'}:{})}}:{tint:id==='stitching'?'#eeeeea':'#202020'})} as ResolvedGarmentLayer);
 add('base','Racerback body',`<path d="${body}" fill="#000000"/>`,true);
 const frontDepth=p.frontDrop;
 const backNeck=curved(c-neckHalf,c+neckHalf,top,p.backDrop,false,false);
 // From the rear, the front panel hangs slightly forward of the Y-back.
 const visibleFrontNeck=curved(c-neckHalf,c+neckHalf,top,frontDepth+armDepth*.19,false,true);
 const lining=back
  ? `${visibleFrontNeck}L${point(shoulderPoint,-1)}${armPath(false,-1)}L${c+chest} ${arm+armDepth*.12}H${c-chest}V${arm}${reverseArm(false)}Z`
  : `${backNeck}L${c+neckHalf+12} ${top+frontDepth+16}H${c-neckHalf-12}Z`;
 add('innerBackNeck',back?'Front fabric visible through rear armholes':'Inside racerback neck',`<path d="${lining}" fill="#000000"/>`,true,'interior',9);
 const liningEdges=back
  ? `${visibleFrontNeck}L${point(shoulderPoint,-1)}${armPath(false,-1)} M${c-chest} ${arm}${reverseArm(false)}`
  : backNeck;
 add('racerbackInteriorOutline','Inside opening edges',`<path d="${liningEdges}" fill="none" stroke="#202020" stroke-width="3.5" stroke-linejoin="round"/>`,false,'body',9.5);
 if(!back&&s.tankNeckFinish!=='raw'){
  const backBand=`${backNeck}${curved(c-neckHalf,c+neckHalf,top+11,p.backDrop,true,false)}Z`;
  add('racerbackRearRim','Inside back neck binding',`<path d="${backBand}" fill="#000000"/>`,true,'neck',9.6);
  add('racerbackRearRimInk','Inside neckline outline',`<path d="${backBand}" fill="none" stroke="#202020" stroke-width="1.5"/>`,false,'body',9.7);
 }
 add('outline','Racerback outline',`<path d="${body}" fill="none" stroke="#202020" stroke-width="3.5" stroke-linejoin="round"/>`,false,'body',21);
 for(const [id,key] of [['neck','tankNeckFinish'],['armholeLeft','tankLeftFinish'],['armholeRight','tankRightFinish']] as const){
  const finish=s[key]??(id==='neck'?'self':'none');
  if(finish==='none')continue;
  const width=finish==='fold'?6:10,mirror=id==='armholeRight'?' transform="translate(2048 0) scale(-1 1)"':'';
  const line=id==='neck'?neck:armLeft();
  if(finish==='raw'){add(id+'Raw','Raw opening',`<g${mirror}><path d="${line}" fill="none" stroke="#aaa" stroke-width="1.6" stroke-dasharray="1 2"/></g>`);continue;}
  const band=id==='neck'?`${neck}${curved(c-neckHalf-width,c+neckHalf+width,top+width,drop,true)}Z`:`${line}L${c-chest+width} ${arm}${reverseArm(back,width,back?width*.65:0)}Z`;
  add(id,id==='neck'?'Racerback neck binding':'Racerback armhole binding',`<g${mirror}><path d="${band}" fill="#000000"/></g>`,true,id==='neck'?'neck':'armhole',24);
  add(id+'Outline','Binding outline',`<g${mirror}><path d="${band}" fill="none" stroke="#202020" stroke-width="1.5"/></g>`,false,'body',26);
  if(finish==='rib')add(id+'Ribs','Binding ribs',`<g${mirror}><path d="${line}" fill="none" stroke="#555" stroke-width="8" stroke-dasharray="1 4"/></g>`,false,'body',27);
 }
 const hemStitches=tankHem(add,hemStyle,s.tankHemDepth,c,bow,[[c+waist,wy],[c+waist,wy+96],[c+hem-8,bottom-85],[c+hem,bottom]]);
 add('stitching','Racerback stitching',`<g fill="none" stroke="#eee" stroke-width="2" stroke-dasharray="6 4">${hemStitches}</g><defs><path data-trouser-stitch-region="neckline" d="${neck}"/><path data-trouser-stitch-region="armhole" d="${armLeft(5)}"/><g transform="translate(2048 0) scale(-1 1)"><path data-trouser-stitch-region="armhole" d="${armLeft(5)}"/></g><path data-trouser-stitch-region="side" d="${leftSide}"/><g transform="translate(2048 0) scale(-1 1)"><path data-trouser-stitch-region="side" d="${leftSide}"/></g></defs>`);
 return layers;
}
