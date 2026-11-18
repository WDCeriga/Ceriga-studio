import {useContext} from 'react';
import {tankBlock,tankMeasurementPresets} from '../../../data/tankTop';
import type {GarmentAssetSelection} from '../../../data/garmentSvgCatalog';
import {useResponsiveBuilder} from './responsiveBuilder';
import {NewMeasurementOverlay,MeasurementValueContext} from './NewMeasurementOverlay';
import type {MeasurementGuideDef,MeasurementGuideId} from '../measurementGuides';
export function TankMeasurementGuides({selection,fit,back,onSelect,highlightedId}:{selection:GarmentAssetSelection;fit:string;back:boolean;onSelect?:(id:MeasurementGuideId)=>void;highlightedId?:string|null}){
 const {size}=useResponsiveBuilder(),{measurements}=useContext(MeasurementValueContext);
 const b=tankBlock(selection,fit),defaults=tankMeasurementPresets(selection,fit);
 const ratio=(key:string)=>Number(measurements[key]?.[size]??defaults[key]?.[size])/Number(defaults[key]?.m);
 const top=410,chest=b.chest*ratio('chestWidth'),bottom=top+b.length*ratio('bodyLength'),arm=top+b.armhole*ratio('armhole');
 const neck=b.neckWidth*5*ratio('neckOpening'),drop=Number(measurements[back?'backNeckDrop':'neckDrop']?.[size]??defaults[back?'backNeckDrop':'neckDrop'][size])*10;
 const shoulder=b.shoulder*ratio('shoulderWidth');
 const lines:[string,number,number,number,number][]=[
  ['chestWidth',1024-chest,arm+25,1024+chest,arm+25],
  ['bodyLength',1024+chest+40,top,1024+chest+40,bottom],
  ['shoulderWidth',1024-shoulder,top-28,1024+shoulder,top-28],
  ['neckOpening',1024-neck,top-60,1024+neck,top-60],
  [back?'backNeckDrop':'neckDrop',1024,top,1024,top+drop],
  ['armhole',1024-chest-30,top+19,1024-chest-30,arm],
  ['hemWidth',1024-b.hem*ratio('hemWidth'),bottom+30,1024+b.hem*ratio('hemWidth'),bottom+30],
 ];
 const guides:MeasurementGuideDef[]=lines.map(([id,x1,y1,x2,y2])=>({id:id as MeasurementGuideId,label:id,x1:x1/2.048,y1:y1/2.048,x2:x2/2.048,y2:y2/2.048,labelX:(x1+x2)/4.096,labelY:(y1+y2)/4.096,labelAlign:'center'}));
 return <NewMeasurementOverlay guides={guides} highlightedId={highlightedId} onSelect={id=>onSelect?.(id as MeasurementGuideId)}/>;
}
