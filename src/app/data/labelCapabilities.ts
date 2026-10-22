import {labelBlocks,normalizeLabel, type GarmentLabel, type LabelBlockKey} from './garmentLabels';
/** Content is explicit artwork, never an automatically generated garment-care recommendation. */
export function labelContentKeys(label:GarmentLabel):LabelBlockKey[]{
 if(label.name==='Size label')return ['size'];
 if(label.category==='tag')return ['brand','additional','composition'];
 if(label.category==='hand')return ['brand','size','additional','origin','business','composition'];
 if(label.category==='care')return ['brand','size','composition','careText','origin','business','additional'];
 return ['brand','size','composition',...(label.construction==='printed'?['careText' as const]:[]),'origin','business','additional'];
}
export function editableLabelBlocks(label:GarmentLabel){const allowed=labelContentKeys(label);return labelBlocks(label).filter(b=>allowed.includes(b.key))}
export function reorderLabelBlocks(label:GarmentLabel,key:LabelBlockKey,target:LabelBlockKey){
 const blocks=labelBlocks(label),from=blocks.findIndex(b=>b.key===key),to=blocks.findIndex(b=>b.key===target);
 if(from<0||to<0||from===to)return label;
 const next=[...blocks],moved=next.splice(from,1)[0];next.splice(to,0,moved);return {...label,blocks:next};
}
export function labelFoldChoices(label:GarmentLabel){
 if(label.construction==='printed'||label.category==='hand')return [];
 if(['circle','oval'].includes(label.shape))return ['die'] as const;
 return ['straight','end','centre','loop','mitre'] as const;
}

export function applyLabelShape(label:GarmentLabel,shape:GarmentLabel['shape']){
 const width=label.widthMm,curved=['circle','oval'].includes(shape),wasCurved=['circle','oval'].includes(label.shape);
 const height=shape==='circle'||shape==='square'?width:shape==='horizontal'?Math.max(8,Math.round(width/3)):shape==='vertical'?Math.min(250,Math.round(width*2.5)):shape==='oval'?Math.max(8,Math.round(width*.6)):wasCurved?Math.max(8,Math.round(width*.6)):label.heightMm;
 return normalizeLabel({...label,shape,heightMm:height,cut:shape==='rounded'?'rounded':curved?'straight':label.cut==='rounded'?'straight':label.cut,fold:curved?'die':wasCurved?'straight':label.fold});
}
export function applyLabelCut(label:GarmentLabel,cut:NonNullable<GarmentLabel['cut']>){return normalizeLabel({...label,cut,shape:label.shape==='rounded'&&cut!=='rounded'?'rectangle':label.shape})}
