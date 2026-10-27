import type {DesignElement} from '../components/builder/PrintStudioEditor';
export const PRODUCTION_METHODS = [
 ['Fabric Print','Printed fabric'],['DTG','Direct to garment'],['DTF','Full-colour film transfer'],
 ['Screen Print','Separated ink colours'],['Embroidery','Digitised thread'],['Puff Print','Raised screen ink'],['Heat Transfer','Cut vinyl or printed transfer'],
] as const;
export type ProductionMethod = typeof PRODUCTION_METHODS[number][0];
export function isFabricArtwork(el:DesignElement){return (el.type==='pattern'||el.type==='customArea'&&Boolean(el.customAreaPattern))&&(Boolean(el.patternTarget)||el.patternCoverage==='garment');}
export function productionOptions(el:DesignElement){
 const fabric=isFabricArtwork(el);
 const textured=el.type==='image'||el.type==='drawing'||Boolean(el.shapeBrush)||Boolean(el.patternSource)||Boolean(el.customAreaPattern)||el.type==='pattern'||Boolean(el.textEffects?.length)||Boolean(el.shapeEffects?.length);
 return PRODUCTION_METHODS.map(([id,label])=>{
  let available=true,note='';
  if(fabric){
   if(id==='Fabric Print')note='Print the fabric before cutting and sewing. Cotton needs a suitable textile-ink process; sublimation requires compatible polyester fabric. Match the process to the chosen material.';
   else {available=false;note='This is a fabric fill. Use printed fabric, or switch to a placed graphic for this decoration method.';}
  }else{
   if(id==='Fabric Print'){available=false;note='For garment-panel and all-over fabric repeats. Use a pattern layer for this workflow.';}
   if(id==='DTG')note='Full-colour placed artwork. Works best on suitable cotton-rich fabrics; blends, dark grounds and pretreatment need checking. Avoid printing over seams.';
   if(id==='DTF')note='Full-colour placed artwork, including gradients. Check fabric heat tolerance, dye migration and the smallest isolated details; the transfer adds a surface feel.';
   if(id==='Screen Print')note=textured?'Prepare colour separations or halftones for this artwork. Fine textures and gradients depend on mesh, ink and the final print size.':'Good for solid-colour artwork. Each ink colour needs preparation; check line weight and final print size.';
   if(id==='Embroidery')note=textured?'Needs digitising and a stitch preview. Photos, brush texture and pattern detail need interpretation; standard thread cannot reproduce every printed effect. Specialist colour blending requires maker review.':'Needs digitising. Confirm final size, stitch density, lettering and fabric stabilisation; the screen preview is not a stitch simulation.';
   if(id==='Puff Print')note=textured?'Prepare a simplified raised-ink version. Expanding ink can close gaps and soften fine texture; confirm separations, spacing and a sample. Your artwork stays unchanged.':'Best for bold, well-spaced shapes. Expanding ink changes small gaps and edges; confirm ink, fabric, cure and a sample.';
   if(id==='Heat Transfer')note=textured?'Use a printed transfer for photographs, gradients and textured colour. Cut vinyl needs simplified cuttable shapes; confirm material and heat settings.':'Cut vinyl suits simple shapes; printed transfers support more colour. Confirm cut detail, fabric compatibility and heat settings.';
  }
  return{id,label,available,note};
 });
}
