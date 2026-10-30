import {useId} from 'react';
import type {SavedTextStyle} from '../../lib/textStyles';
import {svgPaint} from '../../lib/studioPaint';
/** Labels share the same physical-mm paint stack without changing their layout components. */
export function LabelStyledText({style,text,x,y,size,weight,width,tracking,section}:{style?:SavedTextStyle;text:string;x:number;y:number;size:number;weight:number;width:number;tracking?:number;section?:string}){
 const id=useId().replace(/:/g,''),source=style?.values,stack=source?.textAppearance;
 const words=source?.textTransform==='uppercase'?text.toUpperCase():source?.textTransform==='lowercase'?text.toLowerCase():source?.textTransform==='title'?text.toLowerCase().replace(/(^|\s)(\p{L})/gu,(_m,space,letter)=>space+letter.toUpperCase()):text;
 const base={fontSize:size,fontWeight:weight,fontStyle:source?.fontStyle,letterSpacing:tracking,textDecoration:[source?.textUnderline?'underline':'',source?.textStrikethrough?'line-through':''].filter(Boolean).join(' ')||undefined},node=(props:React.SVGProps<SVGTextElement>,key?:string)=><text key={key} data-label-text-section={section} {...base} x={x} y={y} {...props}>{words}</text>;
 if(!stack)return node({});
 return <g>{[...stack].reverse().filter(item=>item.enabled).map(item=>{
  const key=id+item.id,paint=svgPaint(item.colour,key,Math.max(1,width),size*2),fill=node({fill:paint.color},key);
  if(item.type==='fill')return <g key={key}><defs dangerouslySetInnerHTML={{__html:paint.defs}}/>{fill}</g>;
  if(item.type==='shadow')return node({fill:item.colour,x:x+(item.xMm??1),y:y+(item.yMm??1)},key);
  if(item.type==='extrude'){const depth=item.depthMm??1,angle=(item.angle??45)*Math.PI/180,steps=Math.min(160,Math.max(1,Math.ceil(depth/.05)));return <g key={key}>{Array.from({length:steps+1},(_,i)=>{const d=depth*(steps-i)/steps;return node({fill:item.colour,x:x+Math.cos(angle)*d,y:y+Math.sin(angle)*d},key+'-'+i)})}</g>}
  const position=item.type==='offset'?'outside':item.position??'outside',strokeWidth=(item.widthMm??.5)*(position==='center'?1:2);
  return <g key={key}><defs><clipPath id={key+'-inside'}>{node({fill:'white'})}</clipPath><mask id={key+'-outside'} maskUnits="userSpaceOnUse" x={-1000} y={-1000} width={2000} height={2000}><rect x={-1000} y={-1000} width={2000} height={2000} fill="white"/>{node({fill:'black'})}</mask></defs>{node({fill:'none',stroke:item.colour,strokeWidth,strokeLinejoin:item.join??'round',clipPath:position==='inside'?`url(#${key}-inside)`:undefined,mask:position==='outside'?`url(#${key}-outside)`:undefined})}</g>;
 })}</g>;
}
