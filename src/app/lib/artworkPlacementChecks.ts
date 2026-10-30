import {logoTraceChecks} from './logoOutline';
import {repeatCheckKey} from './patternPhysical';
import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {artworkColours} from './artworkColourSlots';
import {artworkOutsidePlacement,type ArtworkPlacement,type ArtworkPlacements} from './artworkPlacements';
import {parsePaint} from './studioPaint';
import {textChecks} from './textChecks';
export type PlacementCheck={id:string;kind:'Blocker'|'Risk'|'Polish';message:string;artworkId?:string};
export type ArtworkCheckMeasurements=Record<string,{capMm?:number;strokeMm?:number;missing?:string[];pixels?:{width:number;height:number};error?:string}>;
export function placementChecks(placement:ArtworkPlacement,elements:DesignElement[],document:ArtworkPlacements,measurements:ArtworkCheckMeasurements={}):PlacementCheck[]{
 const checks:PlacementCheck[]=[],items=elements.filter(element=>element.placementId===placement.id&&!element.hidden&&!element.sketchOnly&&!element.tracingReference&&element.type!=='distress'),limits=document.factoryProfile?.methods.find(item=>item.method===placement.method),inks=[...new Set(items.flatMap(artworkColours))];
 const add=(kind:PlacementCheck['kind'],message:string,element?:DesignElement)=>checks.push({id:`${placement.id}:${element?.id??'area'}:${message}`,kind,message,artworkId:element?.id});
 if(!document.factoryProfile)add('Risk','Factory colour limits and tolerances are not supplied.');
 else if(!limits)add('Blocker',`${placement.method} is not supported by ${document.factoryProfile.name}.`);
 if(limits?.maxColours!==undefined&&inks.length>limits.maxColours)add('Risk',`${inks.length} colours exceed the factory limit of ${limits.maxColours}.`);
 const inspect=(element:DesignElement,root:DesignElement,scale=1)=>{
  const measured=measurements[element.id],widthCm=element.width*scale/document.unitsPerCm,heightCm=element.height*scale/document.unitsPerCm;
  if(element.type==='text'){
   for(const check of textChecks({...element,printMethod:placement.method,textPrintLimits:limits?{minCapMm:limits.minTextMm??0,minStrokeMm:limits.minStrokeMm??0,maxColours:limits.maxColours??Infinity}:undefined},measured?.missing??[],measured?.capMm===undefined?undefined:measured.capMm*scale,measured?.strokeMm===undefined?undefined:measured.strokeMm*scale))add(check.kind,check.message,root);
   add('Polish','Live text will be outlined for production.',root);
  }
  if(measured?.error)add('Blocker',measured.error,root);
  if(element.type==='image'&&!/^data:image\/svg\+xml|\.svg(?:\?|$)/i.test(element.content)){
   const pixels=measured?.pixels??element.imagePixels;
   if(pixels){const dpi=Math.min(pixels.width/(widthCm/2.54),pixels.height/(heightCm/2.54)),minimum=limits?.minDpi??150;if(dpi<minimum)add('Risk',`Raster is ${Math.round(dpi)} DPI at its placed size; ${minimum} DPI is required.`,root);}
   else add('Polish','Source pixel size is still being checked.',root);
  }
  if(limits?.maxColours!==undefined&&element.type==='image'&&!element.color)add('Risk','Raster colours need a factory separation or an editable vector trace.',root);
  if(element.patternSeamCheck?.status==='risk'&&element.patternSeamCheck.sourceKey===repeatCheckKey(element))add('Risk',element.patternSeamCheck.message,root);
  if(element.logoTrace)for(const check of logoTraceChecks({...element,printMethod:placement.method},document.unitsPerCm))add(check.kind,check.message,root);
  if(limits?.minStrokeMm&&element.artworkAppearance?.some(item=>item.enabled&&(item.type==='stroke'||item.type==='offset')&&(item.widthMm??0)>0&&(item.widthMm??0)<limits.minStrokeMm!))add('Risk',`Stroke is below the factory minimum of ${limits.minStrokeMm} mm.`,root);
  if(!element.artworkAppearance&&limits?.minStrokeMm&&(element.borderWidth??0)>0&&element.borderWidth!*scale*10/document.unitsPerCm<limits.minStrokeMm)add('Risk',`Stroke is below the factory minimum of ${limits.minStrokeMm} mm.`,root);
  if(placement.method==='Screen Print'&&[element.color,element.shapeFillColor,element.shapeStrokeColor,...(element.textAppearance??[]).filter(item=>item.enabled).map(item=>item.colour)].some(value=>parsePaint(value)))add('Risk','Gradient needs separated halftones for screen print.',root);
  const finish=element.artworkFinish;if(finish&&limits?.finishes&&!limits.finishes.includes(finish.type))add('Risk',`${finish.type} is not supported by this factory method.`,root);
  if(finish&&['Foil','Flock','Reflective','Glitter'].includes(finish.type)&&!limits?.finishes?.includes(finish.type)&&!['Screen Print','Heat Transfer','DTF'].includes(placement.method))add('Risk',`${finish.type} needs a supported transfer or adhesive-ink process.`,root);
  if(finish?.type==='Puff'&&!limits?.finishes?.includes('Puff')&&!['Screen Print','Puff Print'].includes(placement.method))add('Risk','Puff requires a raised screen-ink process.',root);
  if(finish?.type==='Embroidery'&&!limits?.finishes?.includes('Embroidery')&&placement.method!=='Embroidery')add('Risk','Choose Embroidery for the stitched finish.',root);
  if(element.children)for(const child of element.children.filter(item=>!item.hidden))inspect(child,root,scale*Math.min(element.width/(element.groupSourceWidth??element.width),element.height/(element.groupSourceHeight??element.height)));
 };
 for(const element of items){if(artworkOutsidePlacement(element,placement,document)&&element.patternCoverage!=='garment'&&!element.patternTarget)add('Risk','Outside print area',element);inspect(element,element);}
 return checks.filter((check,index)=>checks.findIndex(item=>item.id===check.id)===index);
}
export function placementStatus(placement:ArtworkPlacement,elements:DesignElement[],document:ArtworkPlacements,measurements:ArtworkCheckMeasurements={}){const checks=placementChecks(placement,elements,document,measurements);return(['Blocker','Risk','Polish'] as const).find(kind=>checks.some(check=>check.kind===kind));}
