import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {outlineLettering} from './editableLettering';
import {outlineArtworkStroke} from './artworkPathCommands';
import {shapeWorldPath,fitPenPath,pathPolygons} from './artworkPathOperations';
import {parsePaint} from './studioPaint';
import clipping,{type MultiPolygon} from 'polygon-clipping';
import {richTextSpans} from './richArtworkText';
import {DEFAULT_IMAGE_ADJUSTMENTS} from './imageAdjustments';

export type TextAppearanceItem={id:string;type:'fill'|'stroke'|'offset'|'shadow'|'extrude';enabled:boolean;colour:string;preserveCharacterColours?:boolean;widthMm?:number;join?:'round'|'miter'|'bevel';position?:'inside'|'outside'|'center';xMm?:number;yMm?:number;depthMm?:number;angle?:number};
export function textAppearance(element:DesignElement):TextAppearanceItem[]{
  if(element.textAppearance)return element.textAppearance;
  const items:TextAppearanceItem[]=[{id:'text-fill',type:'fill',enabled:element.textFillMode!=='outline',colour:element.color??'#171717',preserveCharacterColours:Boolean(element.textCharacterStyles?.some(range=>range.style.color))}],units=element.textUnitsPerCm??30;
  if((element.borderWidth??0)>0)items.push({id:'text-stroke',type:'stroke',enabled:true,colour:element.borderColor??'#171717',widthMm:element.borderWidth!*10/units,position:'center',join:'round'});
  if(element.textShadowEnabled)items.push({id:'text-shadow',type:'shadow',enabled:true,colour:element.shadowColor??'#171717',xMm:(element.shadowOffsetX??2)*10/units,yMm:(element.shadowOffsetY??2)*10/units});
  return items;
}
export function textColours(element:DesignElement){return [...new Set(textAppearance(element).filter(item=>item.enabled).flatMap(item=>item.type==='fill'&&item.preserveCharacterColours?richTextSpans(element.content,element.textCharacterStyles).filter(run=>run.content.trim()).map(run=>run.style.color??item.colour):[item.colour]).flatMap(colour=>(parsePaint(colour)?.stops.map(stop=>stop.color)??[colour]).map(value=>value.toLowerCase())))];}
export const textGradientAllowed=(method?:string)=>!['Screen Print','Embroidery','Puff Print','Heat Transfer'].includes(method??'DTG');
export const localAppearanceSource=(element:DesignElement):DesignElement=>({...element,...DEFAULT_IMAGE_ADJUSTMENTS,imageFilter:undefined,cropTop:0,cropRight:0,cropBottom:0,cropLeft:0,cornerRadius:0,warp:undefined,perspective:undefined,clipToArtworkId:undefined,clipToArtworkIds:undefined,artworkClipPaths:undefined,eraseContours:undefined,shadowBlur:0,shadowOffsetX:0,shadowOffsetY:0,textShadowEnabled:false});

/** One vector pipeline supplies live appearance, conversion and production. No blur or bitmap effects. */
export async function expandTextAppearance(element:DesignElement,fonts:{family:string;dataUrl:string}[]=[],byColour=false,liveFinishes=false):Promise<DesignElement>{
  if(!liveFinishes&&element.textEffects?.some(effect=>effect.enabled&&effect.intensity>0))throw new Error('Disable live finish effects before expanding solid-colour appearance. The live artwork is preserved.');
  const units=element.textUnitsPerCm??30,source={...localAppearanceSource(element),textAppearance:undefined,rotation:0,flipHorizontal:false,flipVertical:false,x:element.width/2,y:element.height/2};
  const patch=await outlineLettering(source,fonts),base:DesignElement={...source,...patch,textAppearance:undefined,letteringSource:undefined,shapeEffects:undefined,opacity:100,borderWidth:0,shapeFilled:true};
  return paintOutlinedText(element,base,byColour);
}
export function paintOutlinedText(element:DesignElement,base:DesignElement,byColour=false):DesignElement{
  const units=element.textUnitsPerCm??30,children:DesignElement[]=[];
  const ink=(shape:DesignElement,item:TextAppearanceItem,suffix=''):DesignElement=>({...shape,id:element.id+'-'+item.id+suffix,type:'shape',shapeFilled:true,shapeFillColor:item.colour,color:item.colour,shapeStrokeColor:undefined,borderWidth:0,letteringPaints:undefined,letteringSource:undefined,textAppearance:undefined,children:undefined,layerName:item.type+' '+item.colour});
  // The first row is the topmost paint, matching an appearance stack.
  for(const item of [...textAppearance(element)].reverse().filter(item=>item.enabled)){
    if(item.type==='fill'){
      if(item.preserveCharacterColours&&base.letteringPaints?.length&&base.shapePath){const paths=[{...base.shapePath,subpaths:undefined},...(base.shapePath.subpaths??[])];for(const paint of base.letteringPaints){const parts=paths.filter(path=>path.letterKey===paint.key);if(parts.length)children.push(ink({...base,shapePath:{...parts[0],subpaths:parts.slice(1)}},{...item,colour:paint.fill},'-'+paint.key));}}
      else children.push(ink(base,item));
    }
    if((item.type==='stroke'||item.type==='offset')&&(item.widthMm??0)>0){
      const stroke=outlineArtworkStroke({...base,shapeFilled:false,borderWidth:(item.widthMm??.5)*units/10,shapeStrokeColor:item.colour,shapeStrokeAlign:item.type==='offset'?'outside':item.position??'outside',shapeStrokeJoin:item.join??'round'});
      children.push(ink(stroke,item));
    }
    if(item.type==='shadow')children.push({...ink(base,item),x:base.x+(item.xMm??1)*units/10,y:base.y+(item.yMm??1)*units/10});
    if(item.type==='extrude'){
      const depth=Math.max(0,item.depthMm??1)*units/10,angle=(item.angle??45)*Math.PI/180,steps=Math.max(1,Math.min(160,Math.ceil(depth/.15)));
      for(let step=steps;step>=0;step--)children.push({...ink(base,item,'-'+step),x:base.x+Math.cos(angle)*depth*step/steps,y:base.y+Math.sin(angle)*depth*step/steps});
    }
  }
  let output=children;
  if(byColour){
    // Separate visible ink, so grouping repeated colours cannot change the stacking result.
    let separated=children;
    if(children.every(child=>/^#[0-9a-f]{6}$/i.test(child.shapeFillColor??''))){
      let covered:MultiPolygon=[];const inks=new Map<string,MultiPolygon>();
      for(const child of [...children].reverse()){
        const geometry=pathPolygons(shapeWorldPath(child)),visible=covered.length?clipping.difference(geometry,covered):geometry,colour=child.shapeFillColor!;
        if(visible.length)inks.set(colour,inks.has(colour)?clipping.union(inks.get(colour)!,visible):visible);
        if(geometry.length)covered=covered.length?clipping.union(covered,geometry):geometry;
      }
      separated=[...inks].map(([colour,polygons],index)=>{const paths=polygons.flatMap(polygon=>polygon.map(ring=>({closed:true,nodes:ring.slice(0,-1).map(([x,y])=>({x,y}))})));return{...base,...fitPenPath({...paths[0],subpaths:paths.slice(1)}),id:element.id+'-ink-'+index,shapeFillRule:'evenodd',shapeFilled:true,shapeFillColor:colour,borderWidth:0,letteringPaints:undefined} as DesignElement;});
    }
    const colours=[...new Set(children.map(child=>child.shapeFillColor!))];
    output=colours.filter(colour=>separated.some(child=>child.shapeFillColor===colour)).map((colour,index)=>({id:element.id+'-colour-'+index,type:'group',content:'text-colour-separation',layerName:colour,x:element.width/2,y:element.height/2,width:element.width,height:element.height,rotation:0,groupSourceWidth:element.width,groupSourceHeight:element.height,children:separated.filter(child=>child.shapeFillColor===colour),side:element.side}));
  }
  return{...element,type:'group',content:'expanded-text-appearance',textAppearance:undefined,textEffects:undefined,letteringSource:undefined,children:output,groupSourceWidth:element.width,groupSourceHeight:element.height,layerName:element.layerName??'Expanded text',shapePath:undefined,textLayoutHeight:base.textLayoutHeight,textLayoutWidth:base.textLayoutWidth};
}
