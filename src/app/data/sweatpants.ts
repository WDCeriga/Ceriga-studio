import {constructionDepth} from '../lib/constructionDepth';
import {hoodieCordSvg} from './hoodieTrimAssets';
import type {GarmentAssetSelection,ResolvedGarmentLayer} from './garmentSvgCatalog';
import {GARMENT_SIZES} from '../lib/measurementGrading';

export const SWEATPANTS_PRESET='studio-sweatpants:performance';
export const TROUSER_POCKET_DIMENSIONS = {
 front: [['pantsPocketLength','Opening length',70,130],['pantsPocketInset','Opening inset',75,135]],
 back: [['pantsBackPocketWidth','Pocket width',65,130],['pantsBackPocketHeight','Pocket depth',65,125],['pantsBackPocketDrop','Pocket drop',65,130]],
} as const;
export const SWEATPANTS_SHORT_LEGS = [
 ['slim','Slim'],['straight','Straight'],['relaxed','Relaxed'],['wide','Wide'],['baggy','Baggy / Oversized'],
] as const;
const shortLegProfiles = {
 slim:{upper:.96,opening:.77,gap:.086,rise:0,sweep:.44},
 straight:{upper:1,opening:.91,gap:.046,rise:0,sweep:.14},
 relaxed:{upper:1.04,opening:1.00,gap:.044,rise:8,sweep:.34},
 wide:{upper:1.05,opening:1.10,gap:.047,rise:0,sweep:.15},
 baggy:{upper:1.12,opening:1.15,gap:.043,rise:18,sweep:.30},
};

export function trouserPocketDimension(selection:GarmentAssetSelection,key:string,min:number,max:number){
 const value=Number(selection[key]??100);
 return Number.isFinite(value)?Math.max(min,Math.min(max,value)):100;
}
export const SWEATPANTS_FITS=[
 {id:'slim',name:'Slim',hip:245,thigh:143,knee:94,opening:90,rise:286,length:1040},
 {id:'regular',name:'Regular',hip:267,thigh:159,knee:110,opening:110,rise:302,length:1055},
 {id:'relaxed',name:'Relaxed',hip:284,thigh:174,knee:126,opening:124,rise:320,length:1055},
 {id:'oversized',name:'Oversized / Baggy',hip:304,thigh:190,knee:147,opening:140,rise:344,length:1070},
] as const;
export const SWEATPANTS_OPTIONS={
 pantsRise:{label:'Rise',options:[['low','Low rise'],['mid','Mid rise'],['high','High rise']]},
 pantsLength:{label:'Length',options:[['full','Full length'],['shorts','Shorts']]},
 pantsLeg:{label:'Leg shape',options:[['tapered','Tapered'],['straight','Straight'],['wide','Wide leg'],['flared','Flared'],['baggy','Baggy / Oversized']]},
 pantsWaist:{label:'Waist construction',options:[['elastic','Elastic waistband'],['rib','Rib waistband'],['folded','Folded waistband'],['flat','Flat waistband'],['drawstring','Drawstring waistband']]},
 pantsHem:{label:'Hem / cuff',options:[['rib','Rib cuff'],['elastic','Elastic cuff'],['open','Open hem'],['turned','Turned hem'],['raw','Raw hem'],['adjustable','Adjustable hem']]},
} as const;
export function sweatpantsLength(value?:string){
 return ['shorts','above-knee','knee'].includes(value??'')?'shorts':'full';
}
export function sweatpantsDrawstring(selection:GarmentAssetSelection){
 const cord=selection.pantsDrawstring;
 return !cord||cord==='auto'?(selection.pantsWaist==='drawstring'?'external':'none'):cord;
}
export function sweatpantsLengthAdjustment(selection:GarmentAssetSelection){
 const key=sweatpantsLength(selection.pantsLength)==='shorts'?'pantsShortLengthAdjust':'pantsFullLengthAdjust';
 const value=Number(selection[key]??0);
 return Number.isFinite(value)?Math.max(-10,Math.min(15,value)):0;
}
export function sweatpantsBlock(selection:GarmentAssetSelection,fit='regular'){
 const block=SWEATPANTS_FITS.find(item=>item.id===fit)??SWEATPANTS_FITS[1];
 const length=sweatpantsLength(selection.pantsLength),short=length==='shorts';
 const fullLeg=selection.pantsLeg==='jogger'?'tapered':selection.pantsLeg??'straight';
 const legacyShortLeg=({tapered:'slim',straight:'straight',flared:'wide',wide:'wide',baggy:'baggy'} as Record<string,string>)[fullLeg];
 const shortLeg=SWEATPANTS_SHORT_LEGS.find(([id])=>id===(selection.pantsShortLeg??(selection.pantsLeg?legacyShortLeg:'straight')))?.[0]??'straight';
 const shortProfile=short?shortLegProfiles[shortLeg]:undefined;
 const rise=block.rise+(selection.pantsRise==='low'?-28:selection.pantsRise==='high'?35:0);
 const lengths:Record<string,number>={shorts:540,full:block.length};
 const leg=short?shortLeg:fullLeg;
 const widths:Record<string,{knee:number;opening:number}>={
  tapered:{knee:block.hip*.79,opening:block.opening},
  straight:{knee:block.hip*.96,opening:block.hip*.98},
  wide:{knee:block.hip*1.06,opening:block.hip*1.23},
  flared:{knee:block.hip*.72,opening:block.hip*1.10},
  baggy:{knee:block.hip*1.12,opening:block.hip*.97},
 };
 const profile=widths[leg]??widths.straight;
 const hem=selection.pantsHem??(short||leg!=='tapered'?'turned':'rib');
 const naturalOpening=shortProfile?block.hip*shortProfile.opening:profile.opening;
 const opening=naturalOpening;
 return {...block,rise,knee:profile.knee,length:(lengths[length]??block.length)+sweatpantsLengthAdjustment(selection)*10,
  opening,short,shortProfile,
  hem,waist:selection.pantsWaist??'elastic',leg};
}
export function trouserInnerOpening(block:ReturnType<typeof sweatpantsBlock>,hip:number){
 return block.shortProfile?1024-hip*block.shortProfile.gap:block.leg==='tapered'?1024-hip*.17:1015;
}
export function sweatpantsMeasurementPresets(selection:GarmentAssetSelection,fit='regular'){
 const b=sweatpantsBlock(selection,fit);
 const values={waist:38+(b.hip-267)/20,hip:b.hip/5,frontRise:b.rise/10,backRise:b.rise/10+5,
 thigh:b.thigh/5,knee:b.knee/5,legOpening:b.opening/5,inseam:(b.length-b.rise)/10,outseam:b.length/10,
 cuffOpening:b.opening/5-1,waistbandHeight:4};
 return Object.fromEntries(Object.entries(values).filter(([id])=>!b.short||!['knee','cuffOpening'].includes(id)).map(([id,value])=>[
 id,Object.fromEntries(GARMENT_SIZES.map((size,i)=>[size,(value+(i-2)*(id==='waistbandHeight'?0:id.includes('Rise')?.7:1)).toFixed(1)]))
 ]));
}
// Keep leg proportions consistent across fits, including saved custom measurements.
export function sweatpantsDrawingLength(length:number,rise:number,short:boolean){
 return rise+(length-rise)*(short?1.25:1.14);
}
export function sweatpantsLayers(selection:GarmentAssetSelection,fit='regular',back=false,measurements?:Record<string,Record<string,string>>,size='m',flyColour?:string):ResolvedGarmentLayer[]{
 const b=sweatpantsBlock(selection,fit),defaults=sweatpantsMeasurementPresets(selection,fit);
 const value=(id:string,fallback:number)=>{const n=Number(measurements?.[id]?.[size]);return Number.isFinite(n)&&n>0?n:fallback};
 const ratio=(id:string)=>defaults[id]?value(id,Number(defaults[id]?.[size]))/Number(defaults[id]?.[size]):1;
 const hip=b.hip*ratio('hip'),thigh=b.thigh*ratio('thigh'),opening=b.opening*ratio('legOpening');
 const top=350,band=constructionDepth(value('waistbandHeight',4),4,12)*11,rise=b.rise*ratio(back?'backRise':'frontRise');
 const measuredLength=measurements?.inseam?.[size]?rise+value('inseam',(b.length-b.rise)/10)*10:b.length*ratio('outseam');
 const end=top+sweatpantsDrawingLength(measuredLength,rise,b.short),crotch=top+rise+(b.shortProfile?.rise??0),hemHeight=['rib','elastic'].includes(b.hem)?constructionDepth(selection.pantsHemDepth,4.8,12)*10:0;
 const waist=hip*.92*ratio('waist');
 const waistTop=waist-9;
 const waistLeft=1024-waist;
 const waistJoin=top+band;
 const waistDip=16;
 const hipSide=(y:number,edge=left)=>{
  const depth=y-waistJoin;
  return `C${waistLeft+(edge-waistLeft)*.55} ${waistJoin+depth*.24}
   ${edge} ${waistJoin+depth*.74} ${edge} ${y}`;
 };
 const left=1024-hip;
 const kneeY=crotch+(end-crotch)*(b.leg==='flared'?.39:.43);
 const hemY=end-hemHeight;
 const kneeWidth=b.knee*ratio('knee');
 const innerEnd=trouserInnerOpening(b,hip);
 const outerEnd=innerEnd-opening,center=(innerEnd+outerEnd)/2;
 const gathered=hemHeight>0||b.hem==='adjustable';
 const preserveTaper=b.leg==='tapered'&&!b.short&&gathered;
 const hemInset=gathered&&!preserveTaper?Math.min(18,opening*.065):0;
 const joinOuter=outerEnd+hemInset,joinInner=innerEnd-hemInset;
 const gatherDepth=gathered&&!preserveTaper?Math.min(62,(hemY-crotch)*.2):0;
 const profileEnd=hemY-gatherDepth;
 const kneeInner=b.leg==='tapered'?1024-hip*.105:b.leg==='flared'?1024-hip*.075:1012;
 const kneeOuter=kneeInner-kneeWidth;
 const thighOffset=thigh-b.thigh;
 const upperLeg=`M${waistLeft} ${waistJoin} ${hipSide(crotch)}`;
 const innerJoin=`Q1024 ${crotch-5} 1024 ${crotch-15} L1024 ${waistJoin+waistDip/2} Q${1024-waist/2} ${waistJoin+waistDip/2} ${waistLeft} ${waistJoin}Z`;
 const upperOuter=`C${left-thighOffset*.9} ${crotch+78} ${kneeOuter} ${kneeY-64} ${kneeOuter} ${kneeY}`;
 const stacked=b.leg==='baggy'&&!b.short&&!gathered;
 const stackY=hemY-94;
 const lowerOuter=stacked
   ? `C${kneeOuter-4} ${kneeY+85} ${outerEnd-39} ${stackY-53} ${outerEnd-17} ${stackY}
      q16 25 2 43q-13 17 6 27q12 10 9 24`
   : (b.leg==='tapered'
     ? `C${kneeOuter+5} ${kneeY+100} ${outerEnd-29} ${profileEnd-39} ${outerEnd} ${profileEnd}`
     : `C${kneeOuter} ${kneeY+75} ${outerEnd+(b.leg==='flared'?19:0)} ${profileEnd-85} ${outerEnd} ${profileEnd}`)
     +(gathered&&!preserveTaper?`Q${outerEnd} ${hemY-13} ${joinOuter} ${hemY}`:'');
 const lowerInner=stacked
   ? `q-14 -14 -7 -30q10 -14 -3 -26q-14 -11 -6 -38
      C${innerEnd-11} ${stackY-55} ${kneeInner} ${kneeY+65} ${kneeInner} ${kneeY}`
   : (gathered&&!preserveTaper?`Q${innerEnd} ${hemY-13} ${innerEnd} ${profileEnd}`:'')
     +(b.leg==='tapered'
     ? `C${innerEnd+17} ${profileEnd-33} ${kneeInner-7} ${kneeY+91} ${kneeInner} ${kneeY}`
     : `C${innerEnd-2} ${profileEnd-85} ${kneeInner} ${kneeY+66} ${kneeInner} ${kneeY}`);
 const hemCurveOffset=stacked?-36:hemHeight?4:b.short?17:22;
 const hemCurve=`Q${center} ${hemY+hemCurveOffset} ${joinInner} ${hemY}`;
 const shortSide=b.shortProfile?(()=>{
  const depth=Math.max(28,profileEnd-crotch);
  const hipY=crotch-24;
  const outerHip=1024-hip*b.shortProfile.upper-thighOffset*.45;
  const upper=`M${waistLeft} ${waistJoin} ${hipSide(hipY,outerHip)}`;
  const sweep=b.shortProfile.sweep;
  return b.leg==='baggy'
   ? `${upper} C${outerHip} ${hipY+depth*.5} ${outerEnd-22} ${profileEnd-53} ${outerEnd-17} ${profileEnd-23} Q${outerEnd-20} ${profileEnd-8} ${outerEnd} ${profileEnd}${gathered?`Q${outerEnd} ${hemY-10} ${joinOuter} ${hemY}`:''}`
   : `${upper} C${outerHip} ${hipY+depth*sweep} ${outerEnd} ${profileEnd-depth*.25} ${outerEnd} ${profileEnd}${gathered?`Q${outerEnd} ${hemY-10} ${joinOuter} ${hemY}`:''}`;
 })():undefined;
 const leg=b.short
   ? `${shortSide} ${hemCurve}
      ${gathered?`Q${innerEnd} ${hemY-10} ${innerEnd} ${profileEnd}`:''}
      C${innerEnd+5} ${profileEnd-(profileEnd-crotch)*.4} 1017 ${crotch+26} 1019 ${crotch+10} ${innerJoin}`
   : `${upperLeg} ${upperOuter} ${lowerOuter} ${hemCurve} ${lowerInner}
      C${kneeInner} ${kneeY-65} 1012 ${crotch+72} 1012 ${crotch+30} ${innerJoin}`;
 const mirror=(d:string)=>`<path d="${d}" transform="translate(2048 0) scale(-1 1)"/>`;
 const svg=(content:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" data-no-fabric-edge-seal="true">${content}</svg>`;
 const layers:ResolvedGarmentLayer[]=[];
 const add=(id:string,name:string,markup:string,solid=false,region?:ResolvedGarmentLayer['fabricRegion'])=>layers.push({id,displayName:name,category:id,assetId:SWEATPANTS_PRESET+':'+id,svgRaw:svg(markup),zIndex:solid?(id==='base'||id==='trouserLegRight'?10:12):30,kind:solid?'solid':'detail',...(solid?{fabricRegion:region??{role:'body',materialCategory:'body'}}:{tint:['stitching','pocketStitch'].includes(id)?'#eeeeea':['drawstring','eyelets','pocketZipTeeth'].includes(id)?'#d8d5c8':'#202020'})} as ResolvedGarmentLayer);
 add('base','Left leg',`<path fill="#000000" d="${leg}"/>`,true,{role:'body',group:'legs',materialCategory:'body'});
 add('trouserLegRight','Right leg',`<g fill="#000000">${mirror(leg)}</g>`,true,{role:'body',group:'legs',materialCategory:'body'});
 const bandPath=`M${waistLeft} ${waistJoin}
  Q${1024-waistTop-6} ${top+18} ${1024-waistTop} ${top+4}
  Q${1024-waistTop+2} ${top} ${1024-waistTop+12} ${top}
  H${1024+waistTop-12} Q${1024+waistTop-2} ${top} ${1024+waistTop} ${top+4}
  Q${1024+waistTop+6} ${top+18} ${1024+waist} ${waistJoin}
  Q1024 ${waistJoin+waistDip} ${waistLeft} ${waistJoin}Z`;
 add('waistband','Waistband',`<path fill="#000000" d="${bandPath}"/>`,true,{role:'waistband',materialCategory:'waistband'});
 const cuffWidth=(opening-2*hemInset-(preserveTaper?10:8))*ratio('cuffOpening');
 const cuff=`M${joinOuter} ${end-hemHeight} Q${center} ${end-hemHeight+4} ${joinInner} ${end-hemHeight} L${center+cuffWidth/2} ${end} Q${center} ${end+5} ${center-cuffWidth/2} ${end}Z`;
 if(hemHeight){
 add('bodyHem','Left leg cuff',`<path fill="#000000" d="${cuff}"/>`,true,{role:'cuff',group:'leg-cuffs',materialCategory:'cuffs'});
 add('trouserCuffRight','Right leg cuff',`<g fill="#000000">${mirror(cuff)}</g>`,true,{role:'cuff',group:'leg-cuffs',materialCategory:'cuffs'});
 }
 add('outline','Sweatpants outline',`<g fill="none" stroke="#202020" stroke-width="3.5" stroke-linejoin="round"><path d="${leg}"/>${mirror(leg)}<path d="${bandPath}"/>${hemHeight?`<path d="${cuff}"/>${mirror(cuff)}`:''}</g>`);
 if(b.hem==='adjustable'){
  const channelDepth=constructionDepth(selection.pantsHemDepth,2.2,5)*10;
  const casing=`M${joinOuter+3} ${hemY-channelDepth}Q${center} ${hemY-channelDepth+hemCurveOffset} ${joinInner-3} ${hemY-channelDepth}`;
  const exitX=joinOuter+11,exitY=hemY-12;
  const cord=`M${exitX} ${exitY-3}C${exitX-8} ${exitY-7} ${exitX-16} ${exitY+1} ${exitX-17} ${exitY+9}
   C${exitX-23} ${exitY+23} ${exitX-9} ${exitY+25} ${exitX-7} ${exitY+11}L${exitX+2} ${exitY+3}`;
  const hardware=`<ellipse cx="${exitX}" cy="${exitY}" rx="3" ry="4" fill="#555" stroke="#222" stroke-width="1.4"/>
   <path d="${cord}" fill="none" stroke="#d8d5c8" stroke-width="2.2" stroke-linecap="round"/>
   <g transform="translate(${exitX-18} ${exitY+4}) rotate(18)">
    <rect x="-4" y="-3" width="9" height="5" rx="1.5" fill="#666" stroke="#222" stroke-width="1.2"/>
    <rect x="-6" width="13" height="10" rx="3" fill="#777" stroke="#222" stroke-width="1.4"/>
    <path d="M-3 4H4" stroke="#ccc" stroke-width="1"/>
   </g>`;
  add('hemCasing','Drawcord hem channel',`<g fill="none" stroke="#202020" stroke-opacity=".45" stroke-width="1.3"><path d="${casing}"/>${mirror(casing)}</g>`);
  add('hemDrawcord','Hem drawcord and locks',`<g data-trouser-hem-hardware="" data-fixed-ink="">${hardware}<g transform="translate(2048 0) scale(-1 1)">${hardware}</g></g>`);
 }
 const pocketType=selection.pantsFrontPocket??'side-seam';
 const pocketScale=(side:keyof typeof TROUSER_POCKET_DIMENSIONS,index:number)=>{
  const [key,,min,max]=TROUSER_POCKET_DIMENSIONS[side][index];
  return trouserPocketDimension(selection,key,min,max)/100;
 };
 const inseamPocket=pocketType==='side-seam';
 const showPockets=pocketType!=='none'&&!back;
 const slashPocket=pocketType==='slant';
 const pocketStart=waistLeft+(inseamPocket?8:slashPocket?66:44)*pocketScale('front',1);
 const pocketEnd=left-hip*((b.shortProfile?.upper??1)-1)*.74+(inseamPocket?15:slashPocket?24:31)*pocketScale('front',1);
 const pocketTop=waistJoin+(slashPocket?8:24);
 const pocketBottom=pocketTop+(inseamPocket?146:131)*pocketScale('front',0);
 const pocketMiddle=(pocketTop+pocketBottom)/2;
 const pocketControl=(pocketStart+pocketEnd)/2+(slashPocket?9:0);
 const pocketAngle=-Math.atan2(pocketEnd-pocketStart,pocketBottom-pocketTop)*180/Math.PI;
 const pocketLength=Math.hypot(pocketEnd-pocketStart,pocketBottom-pocketTop);
 const pocketTransform=`translate(${pocketStart} ${pocketTop}) rotate(${pocketAngle})`;
 const curvedOpening=inseamPocket||slashPocket;
 const seam=`M${pocketStart} ${pocketTop}Q${pocketControl} ${pocketMiddle} ${pocketEnd} ${pocketBottom}`;
 if(showPockets){
 const facingWidth=inseamPocket?5:10;
 const facing=curvedOpening
  ? `${seam}h${facingWidth}Q${pocketControl+facingWidth} ${pocketMiddle} ${pocketStart+facingWidth} ${pocketTop}Z`
  : `M-7 0h14v${pocketLength}h-14Z`;
 const facingPath=`<path d="${facing}"${curvedOpening?'':` transform="${pocketTransform}"`}/>`;
 add('pocketFacingLeft','Left pocket facing',`<g fill="#000000">${facingPath}</g>`,true,{role:'pocket',group:'pocket-facings',materialCategory:'pockets'});
 add('pocketFacingRight','Right pocket facing',`<g fill="#000000" transform="translate(2048 0) scale(-1 1)">${facingPath}</g>`,true,{role:'pocket',group:'pocket-facings',materialCategory:'pockets'});
 }
 if(showPockets){
  const opening=curvedOpening
   ? `<path d="${seam}"/><path stroke-width="2.3" d="M${pocketStart-1} ${pocketTop+2}h${inseamPocket?7:12}M${pocketEnd-1} ${pocketBottom-2}h${inseamPocket?7:12}"/>`
   : `<g transform="${pocketTransform}">
      <rect x="-7" width="14" height="${pocketLength}" rx="1.5"/>
      <path d="M0 2V${pocketLength-2}" stroke-width="${pocketType==='zip'?2:3.5}"/>
     </g>`;
  const pair=(markup:string)=>`<g data-trouser-pocket="pocketFacingLeft">${markup}</g><g data-trouser-pocket="pocketFacingRight" transform="translate(2048 0) scale(-1 1)">${markup}</g>`;
  add('pocketEdges','Side pocket openings',`<g fill="none" stroke="#202020" stroke-width="2.6">${pair(opening)}</g>`);
  if(pocketType==='zip'){
   const hardware=`<g transform="${pocketTransform}">
    <path d="M0 19V${pocketLength-5}" fill="none" stroke="#ddd" stroke-width="4" stroke-dasharray="1 3"/>
    <path d="M-3 3H3V6H-3Z M-2.5 7H2.5V15Q0 18 -2.5 15Z" fill="#ddd"/>
   </g>`;
   add('pocketZipTeeth','Pocket zip hardware',pair(hardware));
  }
 }
 const pocketRow=slashPocket
  ? `M${pocketStart+12} ${pocketTop+5}Q${pocketControl+12} ${pocketMiddle} ${pocketEnd+12} ${pocketBottom-4}`
  : pocketType==='zip'? `M${pocketStart+10} ${pocketTop+5}L${pocketEnd+10} ${pocketBottom-5}`:'';
 const stitchY=hemHeight?end-hemHeight+5:end-constructionDepth(selection.pantsHemDepth,1.2,5)*10;
 const bottom=`M${joinOuter+6} ${stitchY} Q${center} ${stitchY+(stacked?-30:hemHeight?0:b.short?16:20)} ${joinInner-5} ${stitchY}`;
 const waistRow=`M${1024-waistTop+7} ${top+8} Q1024 ${top+20} ${1024+waistTop-7} ${top+8}
  M${waistLeft+7} ${waistJoin-7} Q1024 ${waistJoin+waistDip-7} ${1024+waist-7} ${waistJoin-7}`;
 if(!back&&selection.pantsFly!=='none'){
  const flyDepth=constructionDepth(selection.pantsFlyLength,12,18)*10;
  const flyY=Math.min(crotch-12,waistJoin+14+flyDepth);
  const customInk=flyColour && /^#[\da-f]{6}$/i.test(flyColour) ? flyColour : undefined;
  add('frontRiseSeam','Faux fly seam',`<path ${customInk?'data-fixed-ink=""':''} fill="none" stroke="${customInk??'#202020'}" opacity="${customInk?1:.75}" stroke-width="2.1" d="M1054 ${waistJoin+14}V${flyY-Math.min(31,flyDepth*.3)}Q1054 ${flyY} 1025 ${flyY}"/>`);
 }
 const sideRow=shortSide??`${upperLeg} ${upperOuter} ${lowerOuter}`;
 if(hemHeight){
  const gathers=`M${joinOuter+14} ${hemY-4}q-8 -9 -12 -22
    M${joinOuter+29} ${hemY-4}q-6 -8 -7 -16
    M${joinInner-12} ${hemY-4}q6 -8 8 -19`;
  add('legFolds','Cuff gathers',`<g fill="none" stroke="#202020" stroke-opacity=".5" stroke-width="1.8"><path d="${gathers}"/>${mirror(gathers)}</g>`);
 }
 if(stacked){
  const folds=`M${outerEnd-7} ${hemY-62}Q${center-12} ${hemY-98} ${innerEnd-12} ${hemY-59}
    M${outerEnd+1} ${hemY-36}Q${center+7} ${hemY-62} ${innerEnd-10} ${hemY-32}
    M${outerEnd+9} ${hemY-16}Q${center} ${hemY-46} ${innerEnd-8} ${hemY-15}`;
  add('legFolds','Stacked hem folds',`<g fill="none" stroke="#202020" stroke-opacity=".5" stroke-width="2.4"><path d="${folds}"/>${mirror(folds)}</g>`);
 }
 add('stitching','Waist and hem stitching',`<g fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="7 5"><path data-trouser-stitch-region="neckline" d="${waistRow}"/>${back||!showPockets||!pocketRow||selection.pantsPocketStitch!=='on'?'':`<g data-trouser-pocket-rows="true"><g data-trouser-pocket="pocketFacingLeft"><path data-trouser-stitch-region="armhole" d="${pocketRow}"/></g><g data-trouser-pocket="pocketFacingRight" transform="translate(2048 0) scale(-1 1)"><path data-trouser-stitch-region="armhole" d="${pocketRow}"/></g></g>`}${b.hem==='raw'||b.hem==='open'?'':`<path data-trouser-stitch-region="bottom" d="${bottom}"/><g transform="translate(2048 0) scale(-1 1)"><path data-trouser-stitch-region="bottom" d="${bottom}"/></g>`}</g><defs><path data-trouser-stitch-region="side" d="${sideRow}" transform="translate(9 0)"/><g transform="translate(2039 0) scale(-1 1)"><path data-trouser-stitch-region="side" d="${sideRow}"/></g></defs>`);
 if(!back&&b.waist!=='flat'&&sweatpantsDrawstring(selection)==='external'){
 const cord=hoodieCordSvg('round',{spacing:.65}).replace('<svg ',`<svg x="960" y="${top+band*.52-22}" width="128" height="216" style="--detail-fill:#d8d5c8;--detail-outline:#202020;--detail-stitch:#eeeeea;--detail-hardware:#d4d4d4" `);
 add('drawstring','Waist drawstring',cord);
 }
 if(b.waist==='elastic'||b.waist==='drawstring'){
  let gathers='',pleats='';
  for(let x=waistLeft+12;x<1024+waist-10;x+=10){
   const arc=1-((x-1024)/waist)**2;
   gathers+=`M${x} ${top+6+arc*6}q-4 ${band*.42} 0 ${band-13+arc*2}`;
  }
  for(const fraction of [.23,.38,.56,.74]){
   const x=waistLeft+waist*fraction;
   const y=waistJoin+4+waistDip*fraction*(1-fraction/2);
   pleats+=`M${x} ${y}q-9 22 -11 ${34+fraction*24}`;
  }
  add('waistGathering','Waist gathers',`<g fill="none" stroke="#202020"><path stroke-width="1.6" opacity=".66" d="${gathers}"/><path stroke-width="1.7" opacity=".37" d="${pleats}"/><path stroke-width="1.7" opacity=".37" d="${pleats}" transform="translate(2048 0) scale(-1 1)"/></g>`);
 }
 if(b.waist==='folded')add('waistFold','Waist fold',`<path fill="none" stroke="#222" stroke-width="2" d="M${1024-waist} ${top+band*.55}H${1024+waist}"/>`);
 if(b.hem==='raw'){
  let fray='';
  for(let x=outerEnd+3;x<innerEnd-3;x+=7){
   const t=(x-outerEnd)/opening;
   const y=hemY+2*(1-t)*t*hemCurveOffset;
   fray+=`M${x} ${y}l1 3 `;
  }
  add('rawHem','Raw cut fibres',`<g fill="none" stroke="#bbb" stroke-width="1"><path d="${fray}"/>${mirror(fray)}</g>`);
 }
 const backPocket=selection.pantsBackPocket??'none';
 if(back&&['patch','welt'].includes(backPocket)){
  const welt=backPocket==='welt';
  const width=Math.min(hip*.60,(welt?132:125)*pocketScale('back',0));
  const depth=(welt?16:137)*pocketScale('back',1);
  const x=1024+hip*.51-width/2;
  const y=waistJoin+22+64*pocketScale('back',2);
  const pocketShape=(inset:number)=>welt
   ? `M${x+inset} ${y+inset}h${width-2*inset}v${depth-2*inset}h${2*inset-width}Z`
   : `M${x+inset} ${y+inset}H${x+width-inset}V${y+depth-22}q0 ${22-inset} ${-22+inset} ${22-inset}H${x+22}q${-22+inset} 0 ${-22+inset} ${-22+inset}Z`;
  const shape=pocketShape(0);
  add('backPocket','Back pocket fabric',`<path fill="#000000" d="${shape}"/>`,true,{role:'pocket',materialCategory:'pockets'});
  add('pocket','Back pocket outline',`<path fill="none" stroke="#202020" stroke-width="2.6" d="${shape} M${x} ${y+(welt?depth/2:15)}h${width}"/>`);
  if(!welt&&selection.pantsBackPocketStitch==='on'){
   add('pocketStitch','Back pocket stitching',`<path fill="none" stroke="#eee" stroke-width="2" stroke-dasharray="6 4" d="${pocketShape(5)}"/>`);
  }
 }
 if(b.waist==='rib'||b.hem==='rib'){
  let waistInk='',cuffInk='';
  if(b.waist==='rib')for(let x=1024-waist+5;x<1024+waist;x+=7)waistInk+=`M${x} ${top+4}v${band-8}`;
  if(b.hem==='rib')for(let x=Math.min(joinOuter,center-cuffWidth/2)+5;x<Math.max(joinInner,center+cuffWidth/2)-5;x+=6)cuffInk+=`M${x} ${end-hemHeight+5}v${hemHeight-9} M${2048-x} ${end-hemHeight+5}v${hemHeight-9}`;
  add('ribbing','Rib lines',`<defs><clipPath id="trouser-rib-waist"><path d="${bandPath}"/></clipPath><clipPath id="trouser-rib-cuffs"><path d="${cuff}"/>${mirror(cuff)}</clipPath></defs><g fill="none" stroke="#444" stroke-width="1"><path clip-path="url(#trouser-rib-waist)" d="${waistInk}"/><path clip-path="url(#trouser-rib-cuffs)" d="${cuffInk}"/></g>`);
 }
 return layers;
}

export function sweatpantsLegThumbnail(shape:string,short=false){
 const layers=sweatpantsLayers({...(short?{pantsLength:'shorts',pantsShortLeg:shape}:{pantsLeg:shape}),pantsFrontPocket:'slant'},'regular');
 const markup=layers.filter(layer=>['base','trouserLegRight','outline','waistband','bodyHem','trouserCuffRight','pocketEdges','legFolds','ribbing','waistGathering','frontRiseSeam','drawstring'].includes(layer.id))
  .map(layer=>layer.svgRaw.replace(/^<svg[^>]*>|<\/svg>$/g,'').replaceAll('#000000','#e1e3e6')).join('');
 return 'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${short?'675 320 698 665':'610 320 828 1220'}">${markup}</svg>`);
}

export function trouserBuiltInPocketThumbnail(id:string){
 const back=id==='patch-back'||id==='welt-back';
 const selection=back?{pantsBackPocket:id==='welt-back'?'welt':'patch'}:{pantsFrontPocket:id};
 const layers=sweatpantsLayers(selection,'regular',back);
 const markup=layers.filter(layer=>['base','trouserLegRight','waistband','outline','pocketFacingLeft','pocketFacingRight','pocketEdges','pocketZipTeeth','backPocket','pocket','pocketStitch','stitching'].includes(layer.id))
  .map(layer=>layer.svgRaw.replace(/^<svg[^>]*>|<\/svg>$/g,'').replaceAll('#000000',layer.fabricRegion?.role==='pocket'?'#aeb5bf':'#e1e3e6')).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="710 320 628 338">${markup}</svg>`;
}

export function sweatpantsThumbnail(fit:string){
 const layers=sweatpantsLayers({},fit);
 return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="650 300 750 1300">'+layers.map(l=>l.svgRaw.replace(/^<svg[^>]*>|<\/svg>$/g,'')).join('')+'</svg>');
}

export const SWEATPANTS_MEASUREMENT_HELP:Record<string,string>={
 waist:'Measure straight across the relaxed waistband with the garment flat.',
 hip:'Measure across the widest seat, with both sides lying flat.',
 frontRise:'Measure from the top of the front waistband to the crotch seam.',
 backRise:'Measure from the top of the back waistband to the crotch seam.',
 thigh:'Measure across one leg just below the crotch.',
 knee:'Measure across one leg at knee level.',
 legOpening:'Measure across one leg opening, laid flat.',
 inseam:'Measure from the crotch seam down the inside leg to the finished edge.',
 outseam:'Measure from the top of the waistband down the outside leg to the finished edge.',
 cuffOpening:'Measure straight across the relaxed cuff opening.',
 waistbandHeight:'Measure the finished waistband from its top edge to the body join.',
};
