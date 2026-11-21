import {tankHem} from './tankHem';
import type {GarmentAssetSelection,ResolvedGarmentLayer} from './garmentSvgCatalog';
import {GARMENT_SIZES} from '../lib/measurementGrading';

import {tankTshirtNeck,tshirtTankNeckDepth,tankTshirtNeckMaster} from './tankTshirtNecks';
import {racerbackLayers} from './tankRacerback';

// Normalized front-opening profiles extracted from the existing regular T-shirt
// inner-neck assets. Share the silhouette, fitting it to the tank's neck anchors.
function sharedNeckCurve(kind:string,l:number,r:number,y:number,depth:number,reverse=false,fit='regular'){
 const source=tankTshirtNeckMaster(({vneck:'v','deep-vneck':'deep-v'} as Record<string,string>)[kind]??kind,fit).bounds?.profile;
 if(!source)return undefined;
 const points=source.map(([x,h],i)=>({x:l+x*(r-l),y:y+(h+source[source.length-1-i][1])/2*depth}));
 if(reverse)points.reverse();
 let d=`${reverse?'L':'M'}${points[0].x} ${points[0].y}`;
 for(let i=1;i<points.length;i++){
  const p0=points[Math.max(0,i-2)],p1=points[i-1],p2=points[i],p3=points[Math.min(points.length-1,i+1)];
  d+=`C${p1.x+(p2.x-p0.x)/6} ${p1.y+(p2.y-p0.y)/6} ${p2.x-(p3.x-p1.x)/6} ${p2.y-(p3.y-p1.y)/6} ${p2.x} ${p2.y}`;
 }
 return d;
}

export const TANK_PRESET='studio-tank:classic';
export const TANK_FITS=[
 {id:'slim',name:'Slim',chest:247,hem:244,length:822,shoulder:197,armhole:266,waist:231,neckWidth:18,neckDepth:.92,backDrop:4.4,shoulderDrop:23,armSweep:52,waistPosition:.49,hemBow:24},
 {id:'regular',name:'Regular',chest:264,hem:262,length:790,shoulder:225,armhole:300,waist:258,neckWidth:20,neckDepth:1,backDrop:5,shoulderDrop:19,armSweep:32,waistPosition:.52,hemBow:16},
 {id:'boxy',name:'Boxy',chest:282,hem:283,length:691,shoulder:250,armhole:279,waist:282,neckWidth:21,neckDepth:1.02,backDrop:5.2,shoulderDrop:12,armSweep:27,waistPosition:.54,hemBow:6},
 {id:'oversized',name:'Oversized',chest:296,hem:306,length:844,shoulder:270,armhole:380,waist:300,neckWidth:22,neckDepth:1.07,backDrop:5.6,shoulderDrop:31,armSweep:68,waistPosition:.59,hemBow:18},
] as const;
export const TANK_OPTIONS={
 tankType:{label:'Tank construction',options:[['normal','Normal tank'],['muscle','Muscle tank'],['racer','Racerback singlet']]},
 tankNeck:{label:'Neck shape',options:[['crew','Crew neck'],['thincrew','Thin crew neck'],['scoop','Scoop neck'],['deep','Deep scoop'],['athletic','Athletic front'],['v','V-neck'],['deep-v','Deep V-neck']]},
 tankStrap:{label:'Strap width',options:[['narrow','Narrow'],['standard','Standard'],['wide','Wide']]},
 tankArmhole:{label:'Armhole depth',options:[['high','High'],['standard','Standard'],['deep','Deep']]},
 tankLength:{label:'Body length',options:[['cropped','Cropped'],['standard','Standard'],['longline','Longline']]},
 tankHem:{label:'Hem construction',options:[['single','Single fold'],['double','Double fold'],['raw','Raw hem'],['cover','Coverstitched hem'],['rib','Rib hem band'],['curved','Curved hem'],['dropped','Dropped back hem']]},
} as const;
export const TANK_FINISHES=[['self','Self binding'],['rib','Rib binding'],['fold','Folded clean edge'],['raw','Raw edge'],['contrast','Contrast binding'],['elastic','Elastic binding'],['foe','Fold-over elastic']] as const;
export const TANK_ARMHOLE_FINISHES=[['none','No binding'],...TANK_FINISHES] as const;
export const TANK_DEFAULTS:Record<string,string>={tankType:'normal',tankNeck:'scoop',tankStrap:'standard',tankArmhole:'standard',tankLength:'standard',tankHem:'single',tankNeckFinish:'rib',tankLeftFinish:'none',tankRightFinish:'none'};
export const TANK_LENGTH_RANGE = { min: -10, max: 15, step: .5 };

export function tankLengthAdjustment(value?: string) {
 const cm = Number(value);
 return Number.isFinite(cm) ? Math.max(TANK_LENGTH_RANGE.min, Math.min(TANK_LENGTH_RANGE.max, cm)) : 0;
}
export function tankNeckForFit(selection:GarmentAssetSelection,fit='regular'){
 return selection.tankNeck??(fit==='slim'&&tankBlock(selection,fit).type==='normal'?'crew':'scoop');
}
export function tankBlock(selection:GarmentAssetSelection,fit='regular'){
 const block=TANK_FITS.find(item=>item.id===fit)??TANK_FITS[1];
 const type=selection.tankType??(selection.tankBack==='racer'?'racer':selection.tankBack==='muscle'?'muscle':'normal');
 return {...block,type,hem:type==='racer'&&block.id==='regular'?Math.round(block.chest*1.03):block.hem,neckWidth:block.neckWidth+(type==='racer'?5:0),shoulder:block.shoulder+(type==='muscle'?20:type==='racer'?-38:0),
  length:block.length+(selection.tankLength==='cropped'?-110:selection.tankLength==='longline'?120:0)+tankLengthAdjustment(selection.tankLengthAdjust)*10,
  armhole:block.armhole+(type==='muscle'?100:0)+(selection.tankArmhole==='high'?-30:selection.tankArmhole==='deep'?65:0)};
}
export function tankMeasurementPresets(selection:GarmentAssetSelection,fit='regular'){
 const b=tankBlock(selection,fit);
 const neck=tankNeckForFit(selection,fit);
 const drop=({crew:7,thincrew:6.5,scoop:13,deep:20,athletic:15,square:13,v:17,'deep-v':23} as Record<string,number>)[neck]??13;
 const sourceDepth=tshirtTankNeckDepth(neck,b.neckWidth,fit);
 const values={chestWidth:b.chest/5,bodyLength:b.length/10,shoulderWidth:b.shoulder/5,
  neckOpening:b.neckWidth,neckDrop:b.type==='racer'?(neck==='scoop'?16.5:drop)*b.neckDepth:(sourceDepth??drop*b.neckDepth)*(neck==='deep'?1.3:neck==='athletic'?1.1:1),backNeckDrop:selection.tankBack==='straight'?10:b.backDrop,armhole:b.armhole/10,hemWidth:b.hem/5};
 return Object.fromEntries(Object.entries(values).map(([key,value])=>[key,Object.fromEntries(GARMENT_SIZES.map((size,i)=>[size,(value+(i-2)*(key.includes('Drop')?.4:key==='bodyLength'?1.5:1)).toFixed(1)]))]));
}
export function tankLayers(selection:GarmentAssetSelection,fit='regular',back=false,measurements?:Record<string,Record<string,string>>,size='m'):ResolvedGarmentLayer[]{
 const b=tankBlock(selection,fit),presets=tankMeasurementPresets(selection,fit);
 const ratio=(key:string)=>{const n=Number(measurements?.[key]?.[size]??presets[key]?.[size]),base=Number(presets[key]?.m);return n>0&&base>0?n/base:1};
 const top=410,chest=b.chest*ratio('chestWidth'),hem=b.hem*ratio('hemWidth'),end=top+b.length*ratio('bodyLength');
 const neckHalf=b.neckWidth*5*ratio('neckOpening'),neckDrop=Number(presets[back?'backNeckDrop':'neckDrop'].m)*10*ratio(back?'backNeckDrop':'neckDrop');
 const strap=selection.tankStrap??'standard',shoulder=b.shoulder*ratio('shoulderWidth')+(strap==='narrow'?-35:strap==='wide'?27:0);
 if(b.type==='racer')return racerbackLayers(selection,back,{
  top,chest,hem,end,neckHalf,drop:neckDrop,
  frontDrop:Number(presets.neckDrop.m)*10*ratio('neckDrop'),
  backDrop:Number(presets.backNeckDrop.m)*10*ratio('backNeckDrop'),
  armDepth:b.armhole*ratio('armhole'),strap:Math.max(28,shoulder-neckHalf),
  silhouette:b.id==='regular'
   ? {waistRatio:.914,waistPosition:.36,shoulderDrop:22,hemBow:46,armSweep:0}
   : {waistRatio:b.waist/b.chest,waistPosition:b.waistPosition,shoulderDrop:b.shoulderDrop,hemBow:b.hemBow+12,armSweep:b.armSweep-32},
 });
 const shoulderOuter=Math.max(neckHalf+28,shoulder);
 const armY=top+b.armhole*ratio('armhole'),left=1024-chest,right=1024+chest;
 const frontNeckShape=tankNeckForFit(selection,fit);
 const frontCollar=selection.tankNeckFinish!=='raw'?tankTshirtNeck(frontNeckShape,1024-neckHalf,1024+neckHalf,top,
  Number(presets.neckDrop.m)*10*ratio('neckDrop'),fit,(selection.tankNeckFinish??'rib')==='rib'):undefined;
 const rearBandWidth=frontCollar?.bandWidth??(selection.tankNeckFinish==='fold'?5:frontNeckShape==='thincrew'?6:12);
 const rearJoinLeft=frontCollar?.joinX??1024-neckHalf-rearBandWidth;
 const rearTop=frontCollar?.joinY??top;
 const openingTop=back?rearTop:top;
 const neckShape=back?(selection.tankBack==='straight'?'square':'crew'):frontNeckShape;
 const neckY=openingTop+neckDrop,neckL=back&&frontCollar?rearJoinLeft+rearBandWidth:1024-neckHalf,neckR=2048-neckL;
 const rearNeckCurve=(l:number,r:number,y:number,depth:number,reverse=false)=>{
  const span=r-l;
  return reverse
   ? `L${r} ${y}C${r-span*.24} ${y+depth*4/3} ${l+span*.24} ${y+depth*4/3} ${l} ${y}`
   : `M${l} ${y}C${l+span*.24} ${y+depth*4/3} ${r-span*.24} ${y+depth*4/3} ${r} ${y}`;
 };
 const neck=(offset=0)=>{
  const l=neckL-offset,r=neckR+offset,y=openingTop+offset,d=neckY+offset;
  const shared=!back&&sharedNeckCurve(({crew:'crew',thincrew:'thincrew',scoop:'scoop',deep:'scoop',athletic:'scoop',v:'vneck','deep-v':'deep-vneck'} as Record<string,string>)[neckShape],l,r,y,neckDrop,false,fit);
  if(shared)return shared;
  if(neckShape==='v')return `M${l} ${y}Q${l+30} ${d-36} 1024 ${d}Q${r-30} ${d-36} ${r} ${y}`;
  if(neckShape==='square')return `M${l} ${y}L${l+8} ${d-13}Q${l+8} ${d} ${l+21} ${d}H${r-21}Q${r-8} ${d} ${r-8} ${d-13}L${r} ${y}`;
  if(back)return rearNeckCurve(l,r,y,neckDrop);
  return `M${l} ${y}C${l+8} ${d+neckDrop*.20} ${r-8} ${d+neckDrop*.20} ${r} ${y}`;
 };
 const shoulderY=top+b.shoulderDrop;
 const armControlY=shoulderY+(armY-shoulderY)*.55;
 const armEndControlY=armY-(armY-shoulderY)*.16;
 const leftArm=(inset=0)=>`M${1024-shoulderOuter+inset} ${shoulderY}C${1024-shoulderOuter+7+inset} ${armControlY} ${left+b.armSweep+inset} ${armEndControlY} ${left+inset} ${armY}`;
 const reverseLeftArm=(inset=0)=>`C${left+b.armSweep+inset} ${armEndControlY} ${1024-shoulderOuter+7+inset} ${armControlY} ${1024-shoulderOuter+inset} ${shoulderY}`;
 const rightArm=(inset=0)=>leftArm(inset);
 const neckline=neck(),hemStyle=selection.tankHem??'single';
 const fittedCollar=!back?frontCollar:undefined;
 const shoulderNeckLeft=back&&frontCollar?rearJoinLeft:fittedCollar?.joinX??neckL,shoulderNeckY=back?rearTop:fittedCollar?.joinY??top;
 const hemY=end+(back&&hemStyle==='dropped'?52:0);
 const hemCurve=hemStyle==='curved'?52:b.hemBow;
 const waist=b.waist*ratio('chestWidth'),waistY=armY+(hemY-armY)*b.waistPosition;
 const upperSide=(waistY-armY)*.35,lowerSide=(hemY-waistY)*.35;
 const body=`${neckline}L${2048-shoulderNeckLeft} ${shoulderNeckY}L${1024+shoulderOuter} ${shoulderY}C${1024+shoulderOuter-7} ${armControlY} ${right-b.armSweep} ${armEndControlY} ${right} ${armY}
 C${right} ${armY+upperSide} ${1024+waist} ${waistY-upperSide} ${1024+waist} ${waistY}C${1024+waist} ${waistY+lowerSide} ${1024+hem} ${hemY-lowerSide} ${1024+hem} ${hemY}Q1024 ${hemY+hemCurve} ${1024-hem} ${hemY}
 C${1024-hem} ${hemY-lowerSide} ${1024-waist} ${waistY+lowerSide} ${1024-waist} ${waistY}C${1024-waist} ${waistY-upperSide} ${left} ${armY+upperSide} ${left} ${armY}
 ${reverseLeftArm()}L${shoulderNeckLeft} ${shoulderNeckY}Z`;
 const layers:ResolvedGarmentLayer[]=[];
 const svg=(markup:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" data-no-fabric-edge-seal="true" data-tank-top="true">${markup}</svg>`;
 const add=(id:string,name:string,markup:string,solid=false,role='body',z=solid?10:30)=>{
  layers.push({id,displayName:name,category:id,assetId:TANK_PRESET+':'+id,svgRaw:svg(markup),zIndex:z,kind:solid?'solid':'detail',
   ...(solid?{fabricRegion:{role,materialCategory:role==='neck'?'neck':role==='hem'?'hem':'body',...(role==='interior'?{interior:true,surface:'reverse',exteriorPartId:'base'}:role==='armhole'?{fallbackFromId:'base'}:{})}}:{tint:id==='stitching'?'#eeeeea':'#202020'})} as ResolvedGarmentLayer);
 };
 add('base','Tank body',`<path fill="#000000" d="${body}"/>`,true);
 if(!back){
  const inner=`${neckline}L${neckR} ${Math.min(top,shoulderNeckY)-4}Q1024 ${Math.min(top,shoulderNeckY)+20} ${neckL} ${Math.min(top,shoulderNeckY)-4}Z`;
  add('innerBackNeck','Inside back neck',fittedCollar?.inside??`<path fill="#000000" d="${inner}"/>`,true,'interior',9);
 }
 add('outline','Tank outline',`<path fill="none" stroke="#202020" stroke-width="3.5" stroke-linejoin="round" d="${body}"/>`,false,'body',21);
 const neckLabel=TANK_OPTIONS.tankNeck.options.find(([id])=>id===neckShape)?.[1]??'Neck binding';
 const finishes=[['neck',neckLabel,neckline,'tankNeckFinish'],['armholeLeft','Left armhole binding',leftArm(),'tankLeftFinish'],['armholeRight','Right armhole binding',rightArm(),'tankRightFinish']] as const;
 for(const [id,name,d,key] of finishes){
  const finish=selection[key]??TANK_DEFAULTS[key],mirror=id==='armholeRight'?' transform="translate(2048 0) scale(-1 1)"':'';
  if(finish==='none')continue;
   const width=back&&id==='neck'?rearBandWidth:finish==='raw'?1.7:finish==='fold'?5:finish==='elastic'||finish==='foe'?10:id==='neck'&&frontNeckShape==='thincrew'?6:12;
  if(finish==='raw'){
   add(id+'Raw',name,`<g${mirror}><path d="${d}" fill="none" stroke="#aaa" stroke-width="2" stroke-dasharray="1 2"/></g>`);
  }else{
   const collar=id==='neck'?fittedCollar:undefined;
   if(collar){
    add(id,name,collar.fill,true,'neck',24);
    add(id+'Outline',name+' outline',collar.outline,false,'body',26);
    continue;
   }
   let band:string;
   if(id==='neck'){
    const l=neckL-width,r=neckR+width,y=top+width,drop=neckY+width;
    const reverse=(!back&&sharedNeckCurve(({crew:'crew',thincrew:'thincrew',scoop:'scoop',deep:'scoop',athletic:'scoop',v:'vneck','deep-v':'deep-vneck'} as Record<string,string>)[neckShape],l,r,y,neckDrop,true,fit))|| (neckShape==='v'?`Q${r-30} ${drop-36} 1024 ${drop}Q${l+30} ${drop-36} ${l} ${y}`
     :neckShape==='square'?`L${r-8} ${drop-13}Q${r-8} ${drop} ${r-21} ${drop}H${l+21}Q${l+8} ${drop} ${l+8} ${drop-13}L${l} ${y}`
     :`C${r-8} ${drop+neckDrop*.20} ${l+8} ${drop+neckDrop*.20} ${l} ${y}`);
    band=`${d}L${r} ${y}${reverse}Z`;
    if(back&&neckShape!=='square'){
     band=`${d}${rearNeckCurve(l,r,rearTop,neckDrop+width,true)}Z`;
    }
   }else{
    band=`${d}L${left+width} ${armY}${reverseLeftArm(width)}Z`;
   }
   add(id,name,`<g${mirror}><path d="${band}" fill="#000000"/></g>`,true,id==='neck'?'neck':'armhole',24);
   add(id+'Outline',name+' outline',`<g${mirror}><path d="${band}" fill="none" stroke="#202020" stroke-width="1.7"/></g>`,false,'body',26);
   if(finish==='rib'){
    const clip=`tank-binding-${id}-${back?'back':'front'}`;
    let ribs='';
    const bindingLeft=id==='neck'?neckL-width:left;
    const bindingRight=id==='neck'?neckR+width:1024-shoulderOuter+width;
    for(let x=bindingLeft;x<=bindingRight;x+=5)ribs+=`M${x} ${Math.min(top,rearTop)-2}V${armY+2}`;
    add(id+'Ribs',name+' rib lines',`<g${mirror}><defs><clipPath id="${clip}"><path d="${band}"/></clipPath></defs><path data-texture="rib" d="${ribs}" clip-path="url(#${clip})" fill="none" stroke="#555" stroke-width="1"/></g>`,false,'body',27);
   }
  }
 }
 const sideRow=`M${left+8} ${armY}C${left+8} ${armY+upperSide} ${1024-waist+8} ${waistY-upperSide} ${1024-waist+8} ${waistY}C${1024-waist+8} ${waistY+lowerSide} ${1024-hem+8} ${hemY-lowerSide} ${1024-hem+8} ${hemY-5}`;
 const hemStitches=tankHem(add,hemStyle,selection.tankHemDepth,1024,hemCurve,[[1024+waist,waistY],[1024+waist,waistY+lowerSide],[1024+hem,hemY-lowerSide],[1024+hem,hemY]]);
 add('stitching','Tank stitching',`<g fill="none" stroke="#eee" stroke-width="2" stroke-dasharray="6 4">${hemStitches}</g><defs><path data-trouser-stitch-region="armhole" d="${leftArm(6)}"/><g transform="translate(2048 0) scale(-1 1)"><path data-trouser-stitch-region="armhole" d="${leftArm(6)}"/></g><path data-trouser-stitch-region="side" d="${sideRow}"/><g transform="translate(2048 0) scale(-1 1)"><path data-trouser-stitch-region="side" d="${sideRow}"/></g><path data-trouser-stitch-region="neckline" d="${neckline}"/></defs>`);
 return layers;
}
export function tankThumbnail(fit='regular',selection:GarmentAssetSelection={},back=false){
 const markup=tankLayers(selection,fit,back).filter(l=>l.id!=='stitching').map(l=>l.svgRaw.replace(/^<svg[^>]*>|<\/svg>$/g,'').replaceAll('#000000','#dddfe2')).join('');
 return 'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="650 370 750 950">${markup}</svg>`);
}
