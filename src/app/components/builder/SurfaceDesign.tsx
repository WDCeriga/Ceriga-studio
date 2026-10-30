import {useId} from 'react';
import {surfaceShapePath,type SurfaceAppearance,type SurfaceTextOptions} from '../../lib/surfaceDesign';
import {textileInkSource} from '../../lib/textileInk';
import {svgPaint} from '../../lib/studioPaint';
export function SurfaceDecoration({x=0,y=0,width,height,fill,appearance={}}:{x?:number;y?:number;width:number;height:number;fill:string;appearance?:SurfaceAppearance}){
 const id='surface-'+useId().replace(/:/g,''),path=surfaceShapePath(width,height,appearance),paint=svgPaint(fill,id,width,height),size=Math.max(1,appearance.patternSize??12),stroke=appearance.outlineWidth??0;
 return <g transform={`translate(${x} ${y})`} opacity={(appearance.opacity??100)/100}><defs dangerouslySetInnerHTML={{__html:paint.defs}}/>{appearance.pattern&&<defs><pattern id={id+'-pattern'} width={size} height={size} patternUnits="userSpaceOnUse" patternTransform={`rotate(${appearance.patternAngle??0})`}><image href={textileInkSource(appearance.pattern,appearance.patternColors??['#e8e3d8','#383838','#a66565','#ffffff'])} width={size} height={size} preserveAspectRatio="none"/></pattern></defs>}<path d={path} fill={appearance.pattern?`url(#${id}-pattern)`:paint.color} stroke={stroke?appearance.outlineColor??'#262626':'none'} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={appearance.outlineStyle==='dashed'?`${stroke*3} ${stroke*2}`:appearance.outlineStyle==='dotted'?`0 ${stroke*2.5}`:undefined}/></g>;
}
export function SurfaceText({text,x,y,size,font,weight=400,color,align='center',options={}}:{text:string;x:number;y:number;size:number;font:string;weight?:number;color:string;align?:'left'|'center'|'right';options?:SurfaceTextOptions}){
 const words=options.transform==='uppercase'?text.toUpperCase():options.transform==='lowercase'?text.toLowerCase():text;
 return <text x={x} y={y} dominantBaseline="middle" textAnchor={align==='left'?'start':align==='right'?'end':'middle'} fontFamily={font} fontSize={size} fontWeight={weight} fontStyle={options.fontStyle} letterSpacing={options.tracking} textDecoration={options.underline?'underline':undefined} fill={color} stroke={options.outlineWidth?options.outlineColor??'#262626':undefined} strokeWidth={(options.outlineWidth??0)*2} paintOrder="stroke fill" strokeLinejoin="round">{words}</text>;
}
