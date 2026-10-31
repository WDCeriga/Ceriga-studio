import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {parsePaint,serializePaint} from './studioPaint';
import {textColours} from './textAppearance';

export type ArtworkColourSlot={id:string;name:string;source:string;owners?:string[];swatch:{hex:string;reference?:string}};
export type ArtworkSlotOverrides=Record<string,{hex:string;reference?:string}>;
export const artworkSlotKey=(artworkId:string,slotId:string)=>slotId.startsWith('ink-')?`${artworkId}:${slotId}`:slotId;
const paintKeys=new Set(['color','colour','fill','stroke','shapeFillColor','shapeStrokeColor','borderColor','shadowColor','paintStainColor']);
const colours=(value?:string)=>parsePaint(value)?.stops.map(stop=>stop.color)??(value&&/^#[\da-f]{3,8}$/i.test(value)?[value]:[]);
export function artworkColours(element:DesignElement):string[]{
 if(element.hidden||element.tracingReference||element.sketchOnly||element.type==='distress')return [];
 if(element.artworkAppearance)return [...new Set(element.artworkAppearance.filter(item=>item.enabled).flatMap(item=>colours(item.colour)))];
 if(element.type==='group')return [...new Set((element.children??[]).flatMap(artworkColours))];
 if(element.type==='text')return textColours(element);
 const inks:string[]=[];
 if(element.type==='shape'){
  if(element.shapeFilled!==false)inks.push(...colours(element.shapeFillColor??element.color??'#171717'));
  if((element.borderWidth??0)>0||['line','arc','wave'].includes(element.content))inks.push(...colours(element.shapeStrokeColor??element.color??'#171717'));
 }else if(element.type!=='image')inks.push(...colours(element.color));
 if(element.patternColors)inks.push(...element.patternColors.flatMap(colours));
 if(element.type==='image'&&element.color&&!element.imageFilter)inks.push(...colours(element.color));
 if(element.drawing)for(const stroke of element.drawing.strokes??[])inks.push(...colours(stroke.settings?.color));
 if(element.type==='drawing')try{const drawing=JSON.parse(element.content);for(const stroke of drawing.strokes??[])inks.push(...colours(stroke.settings?.color??stroke.color));}catch{/* Old raster drawings have no editable ink slots. */}
 return [...new Set(inks.map(ink=>ink.toLowerCase()))];
}
const elementIds=(element:DesignElement):string[]=>[element.id,...(element.children??[]).flatMap(elementIds)];
export function refreshArtworkSlots(element:DesignElement):DesignElement{
 const existing=element.colourSlots??[];
 if(element.type==='group'&&element.children){
  const children=element.children.map(refreshArtworkSlots),palette=!!element.logoTrace||existing.some(slot=>!slot.owners),slots=new Map<string,ArtworkColourSlot>(),aliases=new Map<string,string>();
  for(const child of children)for(const slot of child.colourSlots??[]){
   const saved=palette?existing.find(item=>item.source.toLowerCase()===slot.source.toLowerCase()):existing.find(item=>item.id===slot.id),id=palette?artworkSlotKey(element.id,saved?.id??'ink-'+slot.source.slice(1).toLowerCase()):slot.id,prior=slots.get(id),members=new Set(elementIds(child)),owners=slot.owners?.filter(owner=>members.has(owner));
   if(id!==slot.id)aliases.set(slot.id,id);
   slots.set(id,{...slot,...saved,id,owners:[...new Set([...(prior?.owners??[]),...(owners?.length?owners:[child.id])])],name:saved?.name??prior?.name??(palette?`Ink ${slots.size+1}`:slot.name),swatch:saved?.swatch??prior?.swatch??slot.swatch});
  }
  const propagate=(child:DesignElement):DesignElement=>({...child,colourSlots:child.colourSlots?.map(slot=>{const id=aliases.get(slot.id)??slot.id,linked=slots.get(id);return linked?{...slot,id,swatch:linked.swatch}:slot}),children:child.children?.map(propagate)}),next={...element,children:children.map(propagate),colourSlots:[...slots.values()]};
  return JSON.stringify(element)===JSON.stringify(next)?element:next;
 }
 const members=new Set(elementIds(element)),next=artworkColours({...element,hidden:false,sketchOnly:false}).map((source,index)=>{const saved=existing.find(slot=>slot.source.toLowerCase()===source.toLowerCase()),owners=saved?.owners?.filter(owner=>members.has(owner));return saved?{...saved,id:artworkSlotKey(element.id,saved.id),owners:[element.id]}:{id:element.id+':ink-'+source.slice(1).toLowerCase(),name:`Ink ${index+1}`,source,owners:[element.id],swatch:{hex:source}}});
 return JSON.stringify(existing)===JSON.stringify(next)?element:{...element,colourSlots:next};
}
/** Bind inks to their owning subtree, so two black objects can have different colourway inks. */
export function applyArtworkSlots(element:DesignElement,overrides:ArtworkSlotOverrides={}):DesignElement{
 const slots=element.colourSlots??[];if(!slots.length||slots.every(slot=>(overrides[artworkSlotKey(element.id,slot.id)]??slot.swatch).hex.toLowerCase()===slot.source.toLowerCase()))return element;const bindings=new Map<string,Map<string,string>>(),members=new Set(elementIds(element));
 for(const slot of slots){const targets=slot.owners?.filter(owner=>members.has(owner)),owners=targets?.length?targets:[element.id],ink=(overrides[artworkSlotKey(element.id,slot.id)]??slot.swatch).hex;for(const owner of owners){const map=bindings.get(owner)??new Map();map.set(slot.source.toLowerCase(),ink);bindings.set(owner,map)}}
 const paint=(value:string,inks:Map<string,string>):string=>{const gradient=parsePaint(value);return gradient?serializePaint({...gradient,stops:gradient.stops.map(stop=>({...stop,color:inks.get(stop.color.toLowerCase())??stop.color}))}):inks.get(value.toLowerCase())??value;};
 const walk=(value:any,key='',inherited=new Map<string,string>()):any=>{
  if(typeof value==='string'&&(paintKeys.has(key)||key==='patternColors'))return paint(value,inherited);
  if(Array.isArray(value))return value.map(item=>walk(item,key,inherited));
  if(value&&typeof value==='object'){
   const inks=value.id&&bindings.has(value.id)?new Map([...inherited,...bindings.get(value.id)!]):inherited,result=Object.fromEntries(Object.entries(value).map(([name,item])=>[name,['colourSlots','logoTrace','shapePath'].includes(name)?item:walk(item,name,inks)]));
   if(value.type==='text'&&value.color===undefined)result.color=paint('#171717',inks);
   if(value.type==='drawing')try{result.content=JSON.stringify(walk(JSON.parse(value.content),'',inks))}catch{}
   return result;
  }
  return value;
 };
 return walk(element) as DesignElement;
}

/** Editing a rendered colourway must not bake unchanged preview inks into the source. */
export function restoreArtworkSource(next:DesignElement,source?:DesignElement,display?:DesignElement):DesignElement{
 if(!source||!display)return next;
 const restore=(value:any,base:any,shown:any,key=''):any=>{
  if(typeof value==='string'&&typeof base==='string'&&value===shown&&(paintKeys.has(key)||key==='patternColors'||key==='content'))return base;
  if(Array.isArray(value))return value.map((item,index)=>{const oldIndex=item&&typeof item==='object'&&item.id?shown?.findIndex((old:any)=>old?.id===item.id):index;return restore(item,base?.[oldIndex],shown?.[oldIndex],key)});
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,restore(item,base?.[name],shown?.[name],name)]));
  return value;
 };
 return restore(next,source,display);
}
