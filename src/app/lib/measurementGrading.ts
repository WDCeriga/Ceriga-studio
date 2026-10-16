export const GARMENT_SIZES=['xs','s','m','l','xl','xxl'] as const;
export type GarmentSize=typeof GARMENT_SIZES[number];
export type MeasurementValues=Record<string,Record<string,string>>;
export type GradeRule={mode:'simple'|'custom';stepCm:string;stepsCm?:Record<string,string>;overrides:Record<string,boolean>;anchorCustom?:boolean};
export type MeasurementGrading={baseSize:GarmentSize;rows:Record<string,GradeRule>;compare?:{enabled:boolean;first:GarmentSize;second:GarmentSize}};
export type GradedState={measurements:MeasurementValues;measurementGrading?:MeasurementGrading};
const sameValue=(a:string|undefined,b:string|undefined)=>a?.trim()===''||b?.trim()===''?a===b:a!==undefined&&b!==undefined&&Number(a)===Number(b);
export const roundCm=(n:number)=>String(Math.round(n*10000)/10000);
export const baseSize=(grading?:MeasurementGrading)=>grading?.baseSize??'m';
export function validSize(value:string):GarmentSize{return GARMENT_SIZES.includes(value as GarmentSize)?value as GarmentSize:'m'}
export function inferGrade(row:Record<string,string>,anchor:GarmentSize='m'){const i=GARMENT_SIZES.indexOf(anchor);const a=Number(row[GARMENT_SIZES[Math.max(0,i-1)]]),b=Number(row[GARMENT_SIZES[i===0?1:i]]);return roundCm(Number.isFinite(b-a)?b-a:0)}
export function currentMeasurement(state:GradedState,presets:MeasurementValues,id:string,size:string){return state.measurements[id]?.[size]??presets[id]?.[size]??''}
export function gradeRule(state:GradedState,presets:MeasurementValues,id:string):GradeRule{
 const anchor=baseSize(state.measurementGrading);return state.measurementGrading?.rows[id]??{mode:'simple',stepCm:inferGrade(presets[id]??{},anchor),overrides:Object.fromEntries(Object.keys(state.measurements[id]??{}).filter(size=>size!==anchor&&!sameValue(state.measurements[id]?.[size],presets[id]?.[size])).map(size=>[size,true])),anchorCustom:state.measurements[id]?.[anchor]!==undefined&&!sameValue(state.measurements[id]?.[anchor],presets[id]?.[anchor])};
}
function stepAt(rule:GradeRule,index:number){const raw=rule.mode==='custom'?rule.stepsCm?.[GARMENT_SIZES[index]]??rule.stepCm:rule.stepCm;const n=Number(raw);return raw.trim()!==''&&Number.isFinite(n)?n:0}
export function generatedRow(anchor:GarmentSize,value:string,rule:GradeRule){
 if(value.trim()===''||!Number.isFinite(Number(value)))return Object.fromEntries(GARMENT_SIZES.map(s=>[s,'']));const index=GARMENT_SIZES.indexOf(anchor),row:Record<string,string>={[anchor]:value};
 for(let i=index+1;i<GARMENT_SIZES.length;i++)row[GARMENT_SIZES[i]]=roundCm(Number(row[GARMENT_SIZES[i-1]])+stepAt(rule,i-1));
 for(let i=index-1;i>=0;i--)row[GARMENT_SIZES[i]]=roundCm(Number(row[GARMENT_SIZES[i+1]])-stepAt(rule,i));return row;
}
export function applyGrade<T extends GradedState>(state:T,presets:MeasurementValues,id:string,patch:Partial<GradeRule>={}):T{
 const anchor=baseSize(state.measurementGrading),rule={...gradeRule(state,presets,id),...patch};const generated=generatedRow(anchor,currentMeasurement(state,presets,id,anchor),rule),existing=state.measurements[id]??{};
 for(const size of GARMENT_SIZES)if(size!==anchor&&rule.overrides[size])generated[size]=existing[size]??presets[id]?.[size]??'';
 return {...state,measurementGrading:{...state.measurementGrading,baseSize:anchor,rows:{...state.measurementGrading?.rows,[id]:rule}},measurements:{...state.measurements,[id]:generated}};
}
export function editGradedMeasurement<T extends GradedState>(state:T,presets:MeasurementValues,id:string,size:string,value:string):T{
 const next={...state,measurements:{...state.measurements,[id]:{...state.measurements[id],[size]:value}}};const rule=state.measurementGrading?.rows[id];if(!rule)return next;
 const anchor=baseSize(state.measurementGrading),expected=generatedRow(anchor,currentMeasurement(state,presets,id,anchor),rule)[size];return applyGrade(next,presets,id,size===anchor?{anchorCustom:!sameValue(value,presets[id]?.[size])}:{overrides:{...rule.overrides,[size]:!sameValue(value,expected)}});
}
export function resetSizeToGrade<T extends GradedState>(state:T,presets:MeasurementValues,id:string,size:string):T{
 const rule=gradeRule(state,presets,id);if(size===baseSize(state.measurementGrading))return editGradedMeasurement(state,presets,id,size,presets[id]?.[size]??'');
 const overrides={...rule.overrides};delete overrides[size];return applyGrade(state,presets,id,{overrides});
}
export function resetGradingRow<T extends GradedState>(state:T,id:string):T{
 const rows={...state.measurementGrading?.rows};delete rows[id];const measurements={...state.measurements};delete measurements[id];return {...state,measurements,measurementGrading:{...state.measurementGrading,baseSize:baseSize(state.measurementGrading),rows}};
}
export function changeBaseSize<T extends GradedState>(state:T,presets:MeasurementValues,size:GarmentSize):T{
 const previous=baseSize(state.measurementGrading);if(previous===size)return state;let next:T={...state,measurementGrading:{...state.measurementGrading,baseSize:size,rows:{...state.measurementGrading?.rows}}};
 for(const [id,rule] of Object.entries(state.measurementGrading?.rows??{})){const overrides={...rule.overrides};if(rule.anchorCustom)overrides[previous]=true;const anchorCustom=Boolean(overrides[size]);delete overrides[size];next=applyGrade(next,presets,id,{...rule,anchorCustom,overrides})}return next;
}
export function regradeForFit<T extends GradedState>(state:T,presets:MeasurementValues):T{
 let next=state;const anchor=baseSize(state.measurementGrading);for(const [id,rule] of Object.entries(state.measurementGrading?.rows??{})){if(!rule.anchorCustom)next={...next,measurements:{...next.measurements,[id]:{...next.measurements[id],[anchor]:presets[id]?.[anchor]??''}}};next=applyGrade(next,presets,id)}return next;
}
export type GradingIssue={id:string;from:string;to:string;kind:'decrease'|'jump'|'rule'|'invalid';delta:number};
export function checkGrading(state:GradedState,presets:MeasurementValues,ids:string[]):GradingIssue[]{const issues:GradingIssue[]=[];for(const id of ids){const rule=state.measurementGrading?.rows[id];for(const size of GARMENT_SIZES){const value=currentMeasurement(state,presets,id,size);if(value.trim()!==''&&Number(value)<0)issues.push({id,from:size,to:size,kind:'invalid',delta:Number(value)})}for(let i=0;i<GARMENT_SIZES.length-1;i++){const from=GARMENT_SIZES[i],to=GARMENT_SIZES[i+1],a=currentMeasurement(state,presets,id,from),b=currentMeasurement(state,presets,id,to);if(a.trim()===''||b.trim()==='')continue;const delta=Number(b)-Number(a);if(!Number.isFinite(delta))continue;const expected=rule?stepAt(rule,i):Number(inferGrade(presets[id]??{}));if(delta<-.0001)issues.push({id,from,to,kind:'decrease',delta});else if(delta>Math.max(Math.abs(expected)*1.8,Math.abs(expected)+1))issues.push({id,from,to,kind:'jump',delta});else if(rule&&Math.abs(delta-expected)>.01)issues.push({id,from,to,kind:'rule',delta})}}return issues}
export function comparisonRatios(state:GradedState,presets:MeasurementValues,size:string){const ratio=(id:string)=>{const target=Number(currentMeasurement(state,presets,id,size)),reference=Number(presets[id]?.m);return target>0&&reference>0?target/reference:1};return {width:ratio('chestWidth'),height:ratio('halfLength')};}
