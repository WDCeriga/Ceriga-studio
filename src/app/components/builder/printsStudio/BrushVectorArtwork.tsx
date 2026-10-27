import {useContext,useEffect,useId,useState} from 'react';
import type {DesignElement} from '../PrintStudioEditor';
import {ArtworkResolutionContext} from './ArtworkResolutionContext';
import {artworkPixelRatio} from '../../../lib/artworkResolution';
import {renderBrushStroke} from '../../../lib/drawingBrush';
import {replayVectorBrush} from '../../../lib/vectorBrushReplay';
import {shapePathData} from '../../../lib/shapeGeometry';
import {svgPaint} from '../../../lib/studioPaint';
import {artworkFlipStyle} from '../../../lib/artworkFlip';
export function BrushVectorArtwork({element:el}:{element:DesignElement}){
 const source=el.shapeBrush!,path=el.shapePath!,id=useId().replace(/:/g,''),display=useContext(ArtworkResolutionContext),[mask,setMask]=useState<string>();
 const width=el.width,height=el.height,ratio=artworkPixelRatio(source.width,source.height,display*Math.max(width/source.width,height/source.height),window.devicePixelRatio||1),baseWidth=(source.strokes[0]?.settings.brushSize??1)*width/source.width,weight=(el.borderWidth??baseWidth)/Math.max(.01,baseWidth);
 const padding=Math.max(12,...source.strokes.map(s=>s.settings.brushSize*weight*2)),px=padding*width/source.width,py=padding*height/source.height;
 useEffect(()=>{
  const recording=replayVectorBrush(path,source,weight),canvas=document.createElement('canvas');canvas.width=Math.ceil((source.width+padding*2)*ratio);canvas.height=Math.ceil((source.height+padding*2)*ratio);const ctx=canvas.getContext('2d')!;
  const layer=document.createElement('canvas');layer.width=canvas.width;layer.height=canvas.height;const ink=layer.getContext('2d')!;
  for(const stroke of recording.strokes){ink.clearRect(0,0,layer.width,layer.height);renderBrushStroke(ink,stroke.points.map(p=>({...p,x:(p.x+padding)*ratio,y:(p.y+padding)*ratio})),{...stroke.settings,color:'#fff'},ratio,stroke.seed);ctx.globalAlpha=stroke.opacity;ctx.drawImage(layer,0,0);}
  setMask(canvas.toDataURL('image/png'));
 },[path,source,ratio,weight,padding]);
 const stroke=svgPaint(el.shapeStrokeColor??el.color??source.strokes[0]?.settings.color??'#171717',`brush-ink-${id}`,width,height),fill=svgPaint(el.shapeFillColor??el.color??'#171717',`brush-fill-${id}`,width,height);
 const scale=(p:typeof path):typeof path=>({...p,nodes:p.nodes.map(n=>({x:n.x*width/100,y:n.y*height/100,...(n.in?{in:{x:n.in.x*width/100,y:n.in.y*height/100}}:{}),...(n.out?{out:{x:n.out.x*width/100,y:n.out.y*height/100}}:{})})),subpaths:p.subpaths?.map(scale)});
 const contours=[path,...(path.subpaths??[])].filter(p=>p.closed).map(p=>shapePathData(scale({...p,subpaths:undefined}))).join(' ');
 return <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none" style={artworkFlipStyle(el)} data-vector-brush={source.strokes[0]?.settings.brushPreset}><defs dangerouslySetInnerHTML={{__html:stroke.defs+fill.defs}}/>{el.shapeFilled&&<path d={contours} fill={fill.color} fillRule="evenodd"/>}{(el.borderWidth??baseWidth)>0&&mask&&<><defs><mask id={`vector-brush-${id}`} maskUnits="userSpaceOnUse" x={-px} y={-py} width={width+px*2} height={height+py*2} style={{maskType:'alpha'}}><image href={mask} x={-px} y={-py} width={width+px*2} height={height+py*2}/></mask></defs><rect x={-px} y={-py} width={width+px*2} height={height+py*2} fill={stroke.color} mask={`url(#vector-brush-${id})`}/></>}</svg>;
}
