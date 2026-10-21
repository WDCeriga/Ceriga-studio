import type {GarmentWash} from './garmentWash';
// Standard process capabilities, not a claim about every specialist factory.
// Sources and the conservative limits of these rules: docs/wash-process-rules.md.
export function washCapabilities(type:GarmentWash['type']){
 const dye=type==='garmentDye'||type==='overdye';
 const pigment=type==='pigment';
 const local=type==='vintage'||type==='mineral';
 return {local,dye,pigment,fade:!dye&&type!=='none',edgeWear:local,mode:(dye||pigment?'tinted':type==='acid'?'bleach':'natural') as GarmentWash['mode'],
  note:type==='none'?'':type==='enzyme'?'Cellulase enzyme wash refines cellulosic fibres across the garment. Colour washdown depends on the original dye.':type==='stone'?'Standard stonewashing is an overall abrasion process; seam wear develops naturally.':type==='acid'?'Standard acid / snow washing produces irregular all-over discharge. Precise local discharge is a separate finishing process.':dye?'Garment dyeing is an overall colour process. Fibre, existing colour, trims and preparation must be checked by the dyehouse.':pigment?'Pigment colour requires a binder and a compatible preparation and washdown process.': 'Vintage and mineral describe an appearance. Local fading needs the factory to choose and sample a suitable finishing process.'};
}
export function washAvailability(type:GarmentWash['type'],composition:string):{available:boolean;reason:string}{
 const parts=Array.from(composition.matchAll(/(\d+(?:\.\d+)?)\s*%\s*([a-z -]+?)(?=\s*(?:[/,+]|\d+\s*%)|$)/gi)).map(m=>({percent:Number(m[1]),name:m[2].trim().toLowerCase()}));
 const cellulosic=/cotton|linen|flax|viscose|rayon|lyocell|modal|hemp|cupro|bamboo/;
 const total=parts.reduce((n,p)=>n+p.percent,0);
 if(type==='enzyme'&&total>=99&&total<=101&&!parts.some(p=>p.percent>0&&cellulosic.test(p.name)))return {available:false,reason:'This cellulase wash needs cellulosic fibre; the selected composition has none.'};
 if(type==='none')return {available:true,reason:''};
 const stretch=parts.some(p=>p.percent>0&&/elastane|spandex|lycra/.test(p.name));
 if(stretch&&type==='acid')return {available:true,reason:'Stretch fibre is present. The factory must validate the discharge chemistry and stretch recovery; chlorine resistance cannot be assumed.'};
 if(!parts.length||total<99)return {available:true,reason:'Confirm the fibre composition, dye and finish with the factory before sampling.'};
 return {available:true,reason:'Factory sample required: the existing dye, construction and trims affect the result.'};
}
export function normaliseWashProcess(wash:GarmentWash):GarmentWash{
 const caps=washCapabilities(wash.type);
 const changed=wash.mode!==caps.mode||(!caps.edgeWear&&wash.autoWear)||(!caps.local&&(['front','back'] as const).some(v=>(wash.views[v].placement??wash.placement)!=='full'||wash.views[v].strokes.length>0||wash.views[v].shapes.length>0));
 return {...wash,...(changed&&wash.specification?{specification:{...wash.specification,confirmed:false}}:{}),mode:caps.mode,autoWear:caps.edgeWear?wash.autoWear:false,...(!caps.local?{placement:'full' as const,views:{front:{...wash.views.front,placement:'full' as const,strokes:[],shapes:[]},back:{...wash.views.back,placement:'full' as const,strokes:[],shapes:[]}}}:{})};
}
