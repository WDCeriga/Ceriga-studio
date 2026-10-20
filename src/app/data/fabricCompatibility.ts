import type {GarmentFabric} from './garmentFabrics';
/** Conservative preview support policy, not mill certification or a claim that excluded textiles cannot be sewn together.
 * CottonWorks Textile Yarns: blends are produced from fibres before fabric construction.
 * CottonWorks Sourcing the Best Cotton Products Q&A: construction, finish and stitch geometry affect shrinkage/stretch.
 * https://cottonworks.com/wp-content/uploads/2017/11/Textile_Yarns.pdf
 * https://cottonworks.com/wp-content/uploads/2017/11/webinar-QA.pdf
 * The 1.6 weight ratio is an application guardrail, not a published textile standard.
 */
export function fabricPairReason(a:GarmentFabric,b:GarmentFabric):string|undefined{
 if(a.id===b.id)return 'Choose two different fabrics';
 const woven=(f:GarmentFabric)=>['twill','denim','taslan'].includes(f.textureType);
 if(woven(a)!==woven(b))return 'Knit and woven constructions: not supported in one recipe';
 if(a.textureType==='taslan'||b.textureType==='taslan'||a.textureType==='mesh'||b.textureType==='mesh')return 'Technical fabric: supplier-specific compatibility required';
 const stretch=(f:GarmentFabric)=>/high|four-way/i.test(f.stretch)?2:/minimal|low crosswise/i.test(f.stretch)?0:1;
 if(Math.abs(stretch(a)-stretch(b))>0)return 'Different stretch behaviour: not supported in this recipe';
 if(Math.max(a.gsm,b.gsm)/Math.min(a.gsm,b.gsm)>1.6)return 'Weight difference exceeds the supported recipe range';
 return undefined;
}
export function blendedComposition(a:GarmentFabric,b:GarmentFabric,percent:number):string{
 const totals:Record<string,number>={};for(const [fabric,share] of [[a,percent],[b,100-percent]] as const)for(const match of fabric.composition.matchAll(/([0-9.]+)%\s*([a-z]+)/gi))totals[match[2]]=(totals[match[2]]??0)+Number(match[1])*share/100;
 return Object.entries(totals).filter(([,n])=>n>0).map(([name,n])=>`${Number(n.toFixed(2))}% ${name}`).join(' / ');
}
