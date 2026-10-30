import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {refreshArtworkSlots,applyArtworkSlots,type ArtworkSlotOverrides} from './artworkColourSlots';
import {isFabricArtwork} from './artworkProduction';

export type ArtworkZone='front'|'back'|'left sleeve'|'right sleeve'|'other';
export type ArtworkMethod='Screen Print'|'DTG'|'Embroidery'|'Heat Transfer'|'Sublimation'|'Fabric Print'|'DTF'|'Puff Print';
export type ArtworkFactoryMethod={method:ArtworkMethod;maxColours?:number;minStrokeMm?:number;minTextMm?:number;minDpi?:number;finishes?:ArtworkFinish['type'][]};
export type ArtworkFactoryProfile={id:string;name:string;methods:ArtworkFactoryMethod[]};
export type ArtworkFinish={type:'Puff'|'Foil'|'Flock'|'Reflective'|'Glitter'|'Rubber patch'|'Woven patch'|'Embroidery';heightMm?:number;thread?:string;widthCm?:number;heightCm?:number;colour?:string;material?:string;style?:string;particleMm?:number;attachment?:string;edge?:string};
export type ArtworkPlacement={id:string;name:string;zone:ArtworkZone;side:'front'|'back';preset:string;printArea:{width:number;height:number};position:{fromHPS:number;fromCentreFront:number};method:ArtworkMethod;maxColours?:number;artworks:string[]};
export type ArtworkPlacements={version:1;unitsPerCm:number;origin:{x:number;y:number};placements:ArtworkPlacement[];factoryProfile?:ArtworkFactoryProfile};
export type ArtworkGeometry={unitsPerCm:number;origin:{x:number;y:number}};
export const PLACEMENT_PRESETS=[
 {id:'left-chest',name:'Left chest',zone:'front',width:10,height:10,x:-8,y:16,side:'front'},
 {id:'centre-chest',name:'Centre chest',zone:'front',width:24,height:16,x:0,y:18,side:'front'},
 {id:'full-front',name:'Full front',zone:'front',width:32,height:42,x:0,y:28,side:'front'},
 {id:'back-yoke',name:'Back yoke',zone:'back',width:26,height:12,x:0,y:11,side:'back'},
 {id:'full-back',name:'Full back',zone:'back',width:32,height:42,x:0,y:28,side:'back'},
 {id:'left-sleeve',name:'Left sleeve',zone:'left sleeve',width:9,height:12,x:-27,y:20,side:'front'},
 {id:'right-sleeve',name:'Right sleeve',zone:'right sleeve',width:9,height:12,x:27,y:20,side:'front'},
 {id:'hem',name:'Hem',zone:'front',width:12,height:6,x:0,y:55,side:'front'},
 {id:'custom',name:'Custom',zone:'other',width:20,height:20,x:0,y:24,side:'front'},
] as const;
export const artworkSide=(element:DesignElement)=>(element.side??(element as any).view??'front') as 'front'|'back';
export function createArtworkPlacement(preset:string,method:ArtworkMethod='DTG',id=crypto.randomUUID()):ArtworkPlacement{
 const p=PLACEMENT_PRESETS.find(item=>item.id===preset)??PLACEMENT_PRESETS.at(-1)!;
 return{id,name:p.name,zone:p.zone,side:p.side,preset:p.id,printArea:{width:p.width,height:p.height},position:{fromHPS:p.y,fromCentreFront:p.x},method,artworks:[]};
}
export function placementBounds(placement:ArtworkPlacement,document:ArtworkGeometry){
 const scale=document.unitsPerCm,width=placement.printArea.width*scale,height=placement.printArea.height*scale;
 return{x:document.origin.x+placement.position.fromCentreFront*scale-width/2,y:document.origin.y+placement.position.fromHPS*scale-height/2,width,height};
}
export function artworkBounds(element:DesignElement):{x:number;y:number;width:number;height:number}{
 const units=element.artworkUnitsPerCm??element.textUnitsPerCm??10,stack=element.artworkAppearance??element.textAppearance;
 let left=-element.width/2,right=element.width/2,top=-element.height/2,bottom=element.height/2;
 if(element.type==='group'&&element.children){const sx=element.width/(element.groupSourceWidth??element.width),sy=element.height/(element.groupSourceHeight??element.height);for(const child of element.children.filter(item=>!item.hidden)){const b=artworkBounds(child);left=Math.min(left,b.x*sx-element.width/2);right=Math.max(right,(b.x+b.width)*sx-element.width/2);top=Math.min(top,b.y*sy-element.height/2);bottom=Math.max(bottom,(b.y+b.height)*sy-element.height/2);}}
 let padding=stack?0:Math.max(0,element.borderWidth??0)*(element.shapeStrokeAlign==='inside'?0:element.shapeStrokeAlign==='outside'?1:.5),dx=0,dy=0;
 for(const item of stack??[]){if(!item.enabled)continue;if(item.type==='stroke'||item.type==='offset')padding=Math.max(padding,(item.widthMm??0)*units/10*(item.position==='inside'?0:item.position==='center'?.5:1));if(item.type==='shadow'){dx=Math.max(dx,Math.abs(item.xMm??0)*units/10);dy=Math.max(dy,Math.abs(item.yMm??0)*units/10)}if(item.type==='extrude'){const angle=(item.angle??45)*Math.PI/180,depth=(item.depthMm??0)*units/10;dx=Math.max(dx,Math.abs(Math.cos(angle)*depth));dy=Math.max(dy,Math.abs(Math.sin(angle)*depth));}}
 left-=padding+dx;right+=padding+dx;top-=padding+dy;bottom+=padding+dy;
 const angle=element.rotation*Math.PI/180,c=Math.cos(angle),sn=Math.sin(angle),points=[[left,top],[right,top],[right,bottom],[left,bottom]].map(([x,y])=>({x:element.x+x*c-y*sn,y:element.y+x*sn+y*c})),xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);return{x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};
}
const contains=(box:ReturnType<typeof placementBounds>,x:number,y:number)=>x>=box.x&&x<=box.x+box.width&&y>=box.y&&y<=box.y+box.height;
export function placementForArtwork(element:DesignElement,document:ArtworkPlacements,insideOnly=false){
 const candidates=document.placements.filter(placement=>placement.side===artworkSide(element)),inside=candidates.filter(placement=>contains(placementBounds(placement,document),element.x,element.y));
 return(inside.length?inside:insideOnly?[]:candidates).sort((a,b)=>{const areaA=placementBounds(a,document),areaB=placementBounds(b,document);return inside.length?areaA.width*areaA.height-areaB.width*areaB.height:Math.hypot(element.x-areaA.x-areaA.width/2,element.y-areaA.y-areaA.height/2)-Math.hypot(element.x-areaB.x-areaB.width/2,element.y-areaB.y-areaB.height/2)})[0];
}
function presetFor(element:DesignElement,geometry:ArtworkGeometry){
 const x=(element.x-geometry.origin.x)/geometry.unitsPerCm,y=(element.y-geometry.origin.y)/geometry.unitsPerCm;
 if(element.patternTarget==='sleeveLeft')return'left-sleeve';if(element.patternTarget==='sleeveRight')return'right-sleeve';
 if(artworkSide(element)==='back')return y<18&&element.height/geometry.unitsPerCm<14?'back-yoke':'full-back';
 if(x< -21)return'left-sleeve';if(x>21)return'right-sleeve';
 if(y>48&&element.height/geometry.unitsPerCm<10)return'hem';
 return element.width/geometry.unitsPerCm>25||element.height/geometry.unitsPerCm>22||element.patternCoverage==='garment'?'full-front':x< -3&&element.width/geometry.unitsPerCm<=14?'left-chest':'centre-chest';
}
/** Deterministic, idempotent migration. Every non-reference root receives a valid placement. */
export function migrateArtworkPlacements(elements:DesignElement[],saved?:ArtworkPlacements,geometry:ArtworkGeometry={unitsPerCm:10,origin:{x:400,y:70}}){
 const document:ArtworkPlacements=saved?{...saved,placements:saved.placements.map(placement=>({...placement,artworks:[]}))}:{version:1,...geometry,placements:[]};
 const next=elements.map(element=>{
  if(element.tracingReference)return element;
  let placement=document.placements.find(item=>item.id===element.placementId);
  if(isFabricArtwork(element)&&placement?.method!=='Fabric Print')placement=undefined;
  if(!placement){const preset=presetFor(element,document),method=(isFabricArtwork(element)?'Fabric Print':element.printMethod??'DTG') as ArtworkMethod;
   placement=document.placements.find(item=>item.side===artworkSide(element)&&item.preset===preset&&item.method===method)??placementForArtwork(element,{...document,placements:document.placements.filter(item=>item.method===method)},true);
   if(!placement){placement=createArtworkPlacement(preset,method,`placement-${artworkSide(element)}-${preset}-${method.toLowerCase().replace(/\W+/g,'-')}`);placement.side=artworkSide(element);document.placements.push(placement);}
  }
  placement.artworks.push(element.id);
  const limits=document.factoryProfile?.methods.find(item=>item.method===placement!.method);placement.maxColours=limits?.maxColours;
  return refreshArtworkSlots({...element,placementId:placement.id,printMethod:undefined,textPrintLimits:undefined});
 });
 return{elements:next,document,changed:JSON.stringify(elements)!==JSON.stringify(next)||JSON.stringify(saved)!==JSON.stringify(document)};
}
export function moveArtworkPlacements(previous:DesignElement[],next:DesignElement[],document:ArtworkPlacements){
 return next.map(element=>{const old=previous.find(item=>item.id===element.id);if(!old||old.placementId!==element.placementId||old.x===element.x&&old.y===element.y&&artworkSide(old)===artworkSide(element))return element;const target=placementForArtwork(element,document,true);return target?{...element,placementId:target.id}:artworkSide(old)!==artworkSide(element)?{...element,placementId:undefined}:element;});
}
export function artworkOutsidePlacement(element:DesignElement,placement:ArtworkPlacement,document:ArtworkPlacements){const area=placementBounds(placement,document),bounds=artworkBounds(element),epsilon=.2;return bounds.x<area.x-epsilon||bounds.y<area.y-epsilon||bounds.x+bounds.width>area.x+area.width+epsilon||bounds.y+bounds.height>area.y+area.height+epsilon;}
export function displayArtworkPlacements(elements:DesignElement[],document?:ArtworkPlacements,overrides:ArtworkSlotOverrides={}){return elements.map(source=>{const element=applyArtworkSlots(source,overrides),placement=document?.placements.find(item=>item.id===element.placementId),limits=document?.factoryProfile?.methods.find(item=>item.method===placement?.method);return placement?{...element,printMethod:placement.method,artworkUnitsPerCm:document!.unitsPerCm,textUnitsPerCm:document!.unitsPerCm,textPrintLimits:limits?{minCapMm:limits.minTextMm??0,minStrokeMm:limits.minStrokeMm??0,maxColours:limits.maxColours??Infinity}:undefined}:element;});}
export function artworkComponents(elements:DesignElement[],document?:ArtworkPlacements){
 const result:{id:string;artworkId:string;placementId?:string;type:ArtworkFinish['type'];name:string;quantity:number;dimensions:{width:number;height:number};thread?:string}[]=[],units=document?.unitsPerCm??10;
 const walk=(rows:DesignElement[],scale=1,placementId?:string)=>{for(const element of rows){if(element.hidden||element.sketchOnly||element.tracingReference)continue;const finish=element.artworkFinish,placement=element.placementId??placementId;if(finish&&['Embroidery','Rubber patch','Woven patch'].includes(finish.type))result.push({id:`artwork-component-${element.id}`,artworkId:element.id,placementId:placement,type:finish.type,name:element.layerName??'Artwork',quantity:1,dimensions:{width:element.width*scale/units,height:element.height*scale/units},thread:finish.thread});if(element.children)walk(element.children,scale*Math.min(element.width/(element.groupSourceWidth??element.width),element.height/(element.groupSourceHeight??element.height)),placement);}};walk(elements);return result;
}

/** Keep centimetres fixed when garment dimensions change the board's physical scale. */
export function recalibrateArtworkPlacements(elements:DesignElement[],document:ArtworkPlacements,geometry:ArtworkGeometry){
 if(Math.abs(document.unitsPerCm-geometry.unitsPerCm)<.0001&&Math.hypot(document.origin.x-geometry.origin.x,document.origin.y-geometry.origin.y)<.01)return{elements,document};
 const ratio=geometry.unitsPerCm/document.unitsPerCm,point=(x:number,y:number)=>({x:geometry.origin.x+(x-document.origin.x)*ratio,y:geometry.origin.y+(y-document.origin.y)*ratio});
 const next=elements.map(element=>({...element,...point(element.x,element.y),width:element.width*ratio,height:element.height*ratio,...(element.type==='text'?{fontSize:(element.fontSize??30)*ratio,letterSpacing:(element.letterSpacing??0)*ratio,textWordSpacing:(element.textWordSpacing??0)*ratio,textKerning:(element.textKerning??0)*ratio,textBaselineShift:(element.textBaselineShift??0)*ratio,textUnitsPerCm:geometry.unitsPerCm,textGlyphTransforms:element.textGlyphTransforms?Object.fromEntries(Object.entries(element.textGlyphTransforms).map(([key,value])=>[key,{...value,x:value.x*ratio,y:value.y*ratio}])):undefined,textKerningPairs:element.textKerningPairs?.map(pair=>({...pair,offset:pair.offset*ratio})),textStackGap:(element.textStackGap??0)*ratio,textCurveRadius:element.textCurveRadius?element.textCurveRadius*ratio:undefined,textPath:element.textPath?{...element.textPath,offset:element.textPath.offset*ratio}:undefined,textBadge:element.textBadge?{...element.textBadge,radius:element.textBadge.radius*ratio}:undefined}:{}),borderWidth:element.borderWidth===undefined?undefined:element.borderWidth*ratio,shapeCornerRadius:element.shapeCornerRadius===undefined?undefined:element.shapeCornerRadius*ratio}));
 return{elements:next,document:{...document,...geometry}};
}
