import {useContext} from 'react';
import {useResponsiveBuilder} from './responsiveBuilder';
import {sweatpantsBlock,sweatpantsMeasurementPresets,sweatpantsDrawingLength,trouserInnerOpening} from '../../../data/sweatpants';
import type {GarmentAssetSelection} from '../../../data/garmentSvgCatalog';
import type {MeasurementGuideDef,MeasurementGuideId} from '../measurementGuides';
import {NewMeasurementOverlay,MeasurementValueContext} from './NewMeasurementOverlay';
export function SweatpantsMeasurementGuides({selection,fit,back,onSelect,highlightedId}:{highlightedId?:string|null;selection:GarmentAssetSelection;fit:string;back:boolean;onSelect?:(id:MeasurementGuideId)=>void}){
 const {size}=useResponsiveBuilder();
 const b=sweatpantsBlock(selection,fit),{measurements}=useContext(MeasurementValueContext);
 const defaults=sweatpantsMeasurementPresets(selection,fit);
 const value=(id:string,fallback:number)=>{const n=Number(measurements[id]?.[size]);return n>0?n:fallback};
 const ratio=(id:string)=>value(id,Number(defaults[id]?.[size]))/Number(defaults[id]?.[size]);
 const top=350,hip=b.hip*ratio('hip'),rise=b.rise*ratio(back?'backRise':'frontRise');
 const hem=top+sweatpantsDrawingLength(rise+value('inseam',(b.length-b.rise)/10)*10,rise,b.short),crotch=top+rise+(b.shortProfile?.rise??0),left=1024-hip;
 const waistbandHalf=hip*.92*ratio('waist')-9;
 const bandHeight=value('waistbandHeight',4)*11;
 const opening=b.opening*ratio('legOpening');
 const innerEnd=trouserInnerOpening(b,hip);
 const outerEnd=innerEnd-opening;
 const kneeInner=b.leg==='tapered'?1024-hip*.105:b.leg==='flared'?1024-hip*.075:1012;
 const kneeOuter=kneeInner-b.knee*ratio('knee');
 const hemGuideY=hem+24;
 const outseamX=Math.min(left,outerEnd)-30;
 const lines:[string,number,number,number,number][]=[
 ['waist',1024-waistbandHalf,top-30,1024+waistbandHalf,top-30],['hip',left,top+150,2048-left,top+150],
 [back?'backRise':'frontRise',1024,top+60,1024,crotch],['thigh',left,crotch+30,1006,crotch+30],
 ['legOpening',outerEnd,hemGuideY,innerEnd,hemGuideY],
 ['inseam',1044,crotch+20,1044,hem],['outseam',outseamX,top,outseamX,hem],
 ['waistbandHeight',2048-left+25,top,2048-left+25,top+bandHeight]];
 if(!b.short){
  const kneeY=crotch+(hem-crotch)*(b.leg==='flared'?.39:.43);
  lines.push(['knee',kneeOuter,kneeY,kneeInner,kneeY]);
  if(['rib','elastic'].includes(b.hem))lines.push(['cuffOpening',outerEnd,hem-25,innerEnd,hem-25]);
 }
 const guides:MeasurementGuideDef[]=lines.map(([id,x1,y1,x2,y2])=>({id:id as MeasurementGuideId,label:id,x1:x1/2.048,y1:y1/2.048,x2:x2/2.048,y2:y2/2.048,labelX:(x1+x2)/4.096,labelY:(y1+y2)/4.096,labelAlign:'center',...(['frontRise','backRise'].includes(id)?{dimensionX:1104/2.048}:{})}));
 return <NewMeasurementOverlay guides={guides} highlightedId={highlightedId} onSelect={id=>onSelect?.(id as MeasurementGuideId)}/>;
}
