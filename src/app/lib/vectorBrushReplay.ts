import type {RecordedDrawing,RecordedStroke} from './drawingReplay';
import type {ShapePath} from './shapeGeometry';
import {pathSegmentPoint} from './shapePathEditing';
/** Clean geometry changes the route of a brush; its material, pressure and colour stay recorded. */
export function replayVectorBrush(path:ShapePath,source:RecordedDrawing,weight=1):RecordedDrawing{
 const originals=source.strokes.flatMap(stroke=>stroke.mirrorAxis===undefined?[stroke]:[stroke,{...stroke,points:stroke.points.map(p=>({...p,x:stroke.mirrorAxis!*2-p.x})),mirrorAxis:undefined}]).filter(s=>s.points.length>1&&s.points.some(p=>Math.hypot(p.x-s.points[0].x,p.y-s.points[0].y)>.001));
 const paths=[path,...(path.subpaths??[])];
 const strokes:RecordedStroke[]=paths.flatMap((part,index)=>{
  const original=originals[index];if(!original||part.nodes.length<2)return[];
  const samples:{x:number;y:number}[]=[];
  for(let i=0;i<(part.closed?part.nodes.length:part.nodes.length-1);i++){
   const a=part.nodes[i],b=part.nodes[(i+1)%part.nodes.length],span=Math.hypot((b.x-a.x)*source.width/100,(b.y-a.y)*source.height/100),steps=Math.max(4,Math.ceil(span/1.5));
   for(let j=i?1:0;j<=steps;j++){const p=pathSegmentPoint(a,b,j/steps);samples.push({x:p.x*source.width/100,y:p.y*source.height/100});}
  }
  return [{...original,mirrorAxis:undefined,clip:undefined,settings:{...original.settings,brushSize:original.settings.brushSize*weight},points:samples.map((p,i)=>{const position=i/Math.max(1,samples.length-1)*(original.points.length-1),a=original.points[Math.floor(position)],b=original.points[Math.min(original.points.length-1,Math.ceil(position))],t=position%1;return {...p,p:a.p+(b.p-a.p)*t,tilt:a.tilt+(b.tilt-a.tilt)*t};})}];
 });
 return {...source,strokes};
}
