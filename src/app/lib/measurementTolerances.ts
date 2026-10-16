import {formatMeasurementDisplay,type MeasurementUnit} from './measurements';
/** Canonical centimetres. `default` applies to the POM; legacy size keys are preserved overrides. */
export type MeasurementToleranceValues=Record<string,Record<string,string>>;
export const RECOMMENDED_TOLERANCES_CM:Readonly<Record<string,number>>=Object.freeze({
 chestWidth:1.5,halfLength:1,bodyLength:1,shoulderWidth:1,sleeveLength:1,bottomWidth:1,hemWidth:1,
 sleeveOpening:.5,cuffWidth:.5,neckOpening:.5,neckDrop:.5,armhole:1,hoodHeight:1,hoodOpening:1,
});
function magnitude(value:unknown):number|null{if(value===null||value===undefined||typeof value==='string'&&value.trim()==='')return null;const number=Number(value);return Number.isFinite(number)&&number>=0?number:null}
export function getMeasurementTolerance(values:MeasurementToleranceValues|undefined,id:string,size:string){
 const row=values?.[id];const perSize=Boolean(row&&Object.prototype.hasOwnProperty.call(row,size));
 const key=perSize?size:'default';const recommendedCm=RECOMMENDED_TOLERANCES_CM[id];
 const raw=row?.[key]??(recommendedCm===undefined?'':String(recommendedCm));const number=magnitude(raw);
 const status=number===null?'Not set':recommendedCm!==undefined&&Math.abs(number-recommendedCm)<1e-8?'Recommended':'Edited';
 return{valueCm:number===null?'':String(number),recommendedCm,status,key,scope:perSize?'size':'measurement'} as const;
}
export function formatToleranceMagnitude(cm:string,unit:MeasurementUnit):string{
 const value=formatMeasurementDisplay(cm,unit);return value!==''&&unit==='cm'&&!value.includes('.')?value+'.0':value;
}
/** Inclusive production limits, always in canonical centimetres. Missing/invalid inputs produce no range. */
export function getToleranceRange(targetCm:number|string|null|undefined,toleranceCm:number|string|null|undefined):{min:number;max:number}|null{
 const target=magnitude(targetCm),tolerance=magnitude(toleranceCm);return target===null||tolerance===null?null:{min:target-tolerance,max:target+tolerance};
}
/** Compare a factory/sample measurement with inclusive limits. No QC workflow or state mutation. */
export function isWithinTolerance(actualCm:number|string|null|undefined,targetCm:number|string|null|undefined,toleranceCm:number|string|null|undefined):boolean{
 const actual=magnitude(actualCm),range=getToleranceRange(targetCm,toleranceCm);if(actual===null||!range)return false;
 const epsilon=Number.EPSILON*Math.max(1,Math.abs(actual),Math.abs(range.min),Math.abs(range.max))*8;
 return actual>=range.min-epsilon&&actual<=range.max+epsilon;
}
