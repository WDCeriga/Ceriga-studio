import {useResponsiveBuilder} from './responsiveBuilder';
import {formatMeasurementDisplay,type MeasurementUnit} from '../../../lib/measurements';
import { createContext, useContext, useId } from 'react';
import { type MeasurementGuideDef } from '../measurementGuides';
export const MeasurementMotionContext=createContext('');
export const MeasurementValueContext=createContext<{measurements:Record<string,Record<string,string>>;unit:MeasurementUnit}>({measurements:{},unit:'cm'});
export const NEW_MEASUREMENT_LABELS = [{
  id: 'chestWidth',
  label: 'A. Chest width'
}, {
  id: 'halfLength',
  label: 'B. Body length'
}, {
  id: 'shoulderWidth',
  label: 'C. Shoulder width'
}, {
  id: 'sleeveLength',
  label: 'D. Sleeve length'
}, {
  id: 'bottomWidth',
  label: 'E. Hem width'
}, {
  id: 'sleeveOpening',
  label: 'F. Sleeve opening'
}, {
  id: 'neckOpening',
  label: 'G. Neck opening'
}, {
  id: 'neckDrop',
  label: 'H. Neck drop'
}, {
  id: 'armhole',
  label: 'I. Armhole'
}] as const;
type Point={x:number;y:number};
/** Readonly layout offsets: garment anchors remain the actual sampled measurement points. */
export function layoutMeasurementDimension(g:MeasurementGuideDef,guides:MeasurementGuideDef[]){
 const chest=guides.find(item=>item.id==='chestWidth');const neck=guides.find(item=>item.id==='neckOpening');
 let start:Point={x:g.dimensionX??g.x1,y:g.dimensionY??g.y1},end:Point={x:g.dimensionX??g.x2,y:g.dimensionY??g.y2};
 let normal:Point={x:0,y:0};let curved=false;
 if(g.id==='halfLength'&&chest){const x=chest.x1+(chest.x2-chest.x1)*.17;start={x,y:g.y1};end={x,y:g.y2};}
 if(g.id==='shoulderWidth'){const y=Math.min(neck?.y1??g.y1,neck?.y2??g.y2,g.y1,g.y2)-20;start={x:g.x1,y};end={x:g.x2,y};}
 if(g.id==='neckOpening'){start={x:g.x1,y:g.y1};end={x:g.x2,y:g.y2};}
 if(g.id==='sleeveLength'||g.id==='sleeveOpening'){
  const dx=g.x2-g.x1,dy=g.y2-g.y1,length=Math.hypot(dx,dy)||1;normal={x:-dy/length,y:dx/length};
  if(g.id==='sleeveOpening'&&normal.y<0)normal={x:-normal.x,y:-normal.y};
  if(g.id==='sleeveLength'&&normal.x>0)normal={x:-normal.x,y:-normal.y};
  start={x:g.x1+normal.x*30,y:g.y1+normal.y*30};end={x:g.x2+normal.x*30,y:g.y2+normal.y*30};curved=g.id==='sleeveLength';
 }
 const mid={x:(start.x+end.x)/2,y:(start.y+end.y)/2};
 const label={x:mid.x+(curved?normal.x*10:g.id==='sleeveOpening'?normal.x*20:0),y:mid.y+(g.id==='shoulderWidth'?-15:curved?normal.y*10:g.id==='sleeveOpening'?normal.y*20:0)};
 const length=Math.hypot(end.x-start.x,end.y-start.y)||1,tick={x:-(end.y-start.y)/length*6,y:(end.x-start.x)/length*6};
 const dimensionPath=curved?`M${start.x},${start.y}Q${mid.x+normal.x*20},${mid.y+normal.y*20} ${end.x},${end.y}`:`M${start.x},${start.y}L${end.x},${end.y}`;
 const ticks=`M${start.x-tick.x},${start.y-tick.y}L${start.x+tick.x},${start.y+tick.y}M${end.x-tick.x},${end.y-tick.y}L${end.x+tick.x},${end.y+tick.y}`;
 return{start,end,label,dimensionPath,ticks};
}
export function NewMeasurementOverlay({guides=[],highlightedId,onSelect,drawingTransform}:{drawingTransform?:string;guides?:MeasurementGuideDef[];highlightedId?:string|null;onSelect?:(id:string)=>void}){
 const {size}=useResponsiveBuilder();const values=useContext(MeasurementValueContext);
 const revision=useContext(MeasurementMotionContext);const prefix=useId().replace(/:/g,'');
 return <svg className="new-measurement-overlay" viewBox="0 0 1000 1000" aria-label="Garment measurement guides"><defs>{['normal','selected'].map(state=><marker key={state} id={`${prefix}-${state}`} markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 0L8 4L0 8Z" fill={state==='selected'?'#ed2629':'#7c879d'}/></marker>)}</defs><g transform={drawingTransform}>{guides.map(g=>{
  const selected=highlightedId===g.id,color=selected?'#ed2629':'#7c879d',layout=layoutMeasurementDimension(g,guides),{start,end,label}=layout;
  const value=values.measurements[g.id]?.[size];const labelText=NEW_MEASUREMENT_LABELS.find(m=>m.id===g.id)?.label.split('. ')[1];
  const select=()=>{onSelect?.(g.id);window.dispatchEvent(new Event('ceriga-measure-selected'))};
  const letter=NEW_MEASUREMENT_LABELS.find(m=>m.id===g.id)?.label.split('.')[0];
  return <g className="measurement-focus-group" data-active={selected} data-dimmed={Boolean(highlightedId)&&!selected} key={g.id} data-measurement-guide={g.id} aria-pressed={selected} role="button" tabIndex={0} aria-label={`${labelText}${value?', '+formatMeasurementDisplay(value,values.unit)+' '+(values.unit==='cm'?'centimetres':'inches'):''}`} onClick={select} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}}} style={{color,pointerEvents:'auto',cursor:'pointer'}}>
   <path d={`M${g.x1} ${g.y1}L${start.x} ${start.y}M${g.x2} ${g.y2}L${end.x} ${end.y}`} fill="none" stroke="currentColor" strokeWidth=".7" opacity=".5"/>
   <path d={layout.ticks} fill="none" stroke="currentColor" strokeWidth=".9" opacity=".75"/>
   <path d={layout.dimensionPath} fill="none" stroke="transparent" strokeWidth="16"/>
   <path className="measurement-dimension-line" key={selected?revision:'normal'} d={layout.dimensionPath} fill="none" stroke="currentColor" strokeWidth={selected?1.6:1.15} markerStart={`url(#${prefix}-${selected?'selected':'normal'})`} markerEnd={`url(#${prefix}-${selected?'selected':'normal'})`}/>
   <circle className="measurement-touch-target" cx={label.x} cy={label.y} r="14" fill="transparent" stroke="transparent" strokeWidth="32" vectorEffect="non-scaling-stroke" pointerEvents="all"/>
   <g className="measurement-badge" style={{transformOrigin:`${label.x}px ${label.y}px`}}><circle key={selected?revision:'normal'} className={selected?'measurement-badge-pulse':undefined} cx={label.x} cy={label.y} r="14" fill={color} stroke="white" strokeWidth="2"/><text x={label.x} y={label.y} dy=".35em" textAnchor="middle" fill="white" fontSize="15" fontFamily="Arial" fontWeight="600">{letter}</text></g>

  </g>
 })}</g></svg>;
}
