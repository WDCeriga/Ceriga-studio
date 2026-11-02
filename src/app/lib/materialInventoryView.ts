import type {FactoryMaterial} from '../data/manufacturerPortalMock';
export const materialKinds={fabric:'Fabric',trim:'Trim',packaging:'Packaging',other:'Other'};
export const materialUnits=['metres','kg','rolls','units','cones'] as const;
export type MaterialDraft={name:string;kind:FactoryMaterial['kind'];quantity:string;unit:FactoryMaterial['unit'];reorderAt:string;colour:string;gsm:string;supplier:string;location:string;notes:string};
export const freshMaterialDraft=():MaterialDraft=>({name:'',kind:'fabric',quantity:'0',unit:'metres',reorderAt:'0',colour:'',gsm:'',supplier:'',location:'',notes:''});
export const draftFromMaterial=(r:FactoryMaterial):MaterialDraft=>({name:r.name,kind:r.kind,quantity:String(r.quantity),unit:r.unit,reorderAt:String(r.reorderAt),colour:r.colour||'',gsm:r.gsm==null?'':String(r.gsm),supplier:r.supplier||'',location:r.location||'',notes:r.notes||''});
export function materialStockState(r:FactoryMaterial){if(!Number.isFinite(r.quantity)||!Number.isFinite(r.reorderAt)||r.quantity<0||r.reorderAt<0)return 'review';return r.quantity===0?'out':r.quantity<=r.reorderAt?'low':'healthy';}
export const materialStockLabel={out:'Out of stock',low:'Low stock',healthy:'In stock',review:'Check stock values'};
export function parseMaterialDraft(d:MaterialDraft){
 const quantity=Number(d.quantity),reorderAt=Number(d.reorderAt),gsm=d.gsm.trim()?Number(d.gsm):undefined;
 if(!d.name.trim()||d.name.trim().length>200)throw Error('Enter a material name, up to 200 characters.');
 if(!d.quantity.trim()||!d.reorderAt.trim()||![quantity,reorderAt].every(n=>Number.isFinite(n)&&n>=0))throw Error('Enter valid quantities and a reorder level of zero or more.');
 if(!Object.hasOwn(materialKinds,d.kind)||!materialUnits.includes(d.unit))throw Error('Choose a valid material type and stock unit.');
 if(gsm!==undefined&&(!Number.isInteger(gsm)||gsm<1||gsm>5000))throw Error('GSM must be a whole number between 1 and 5000.');
 return {...d,name:d.name.trim(),quantity,reorderAt,gsm,colour:d.colour.trim(),supplier:d.supplier.trim(),location:d.location.trim(),notes:d.notes.trim()};
}
export const materialQuantity=(n:number)=>Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:20}):'Not recorded';
