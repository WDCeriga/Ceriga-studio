import {createContext,useContext} from 'react';
import {comparisonRatios,type MeasurementValues,type MeasurementGrading} from '../../../lib/measurementGrading';
import {measurementExtent,type MeasurementShape} from '../measurementGeometry';
export const SizeComparisonContext=createContext<{measurements:MeasurementValues;presets:MeasurementValues;grading?:MeasurementGrading;enabled:boolean}>({measurements:{},presets:{},enabled:false});
export function sizeDrawingTransform(shapes:MeasurementShape[],ratio:{width:number;height:number}){const bounds=measurementExtent(shapes.flatMap(shape=>shape.contours.flat())),cx=(bounds.left+bounds.right)/2;return `translate(${cx} ${bounds.top}) scale(${ratio.width} ${ratio.height}) translate(${-cx} ${-bounds.top})`}
export function SizeComparisonOverlay({shapes}:{shapes:MeasurementShape[]}){
 const context=useContext(SizeComparisonContext),compare=context.grading?.compare;if(!context.enabled||!compare||!shapes.length)return null;
 const first=comparisonRatios({measurements:context.measurements,measurementGrading:context.grading},context.presets,compare.first),second=comparisonRatios({measurements:context.measurements,measurementGrading:context.grading},context.presets,compare.second);
 const paths=shapes.map(shape=>shape.contours.filter(contour=>contour.length>3).map(contour=>'M'+contour.map(point=>`${point.x},${point.y}`).join('L')+'Z').join(''));
 return <svg className="size-comparison-overlay" viewBox="0 0 1000 1000" aria-label={`${compare.first.toUpperCase()} solid and ${compare.second.toUpperCase()} dashed proportional size outlines`}><g transform={sizeDrawingTransform(shapes,first)}>{paths.map((d,i)=><path key={i} d={d} fill="none" stroke="#566273" strokeWidth="1.5"/>)}</g><g transform={sizeDrawingTransform(shapes,second)} opacity=".55">{paths.map((d,i)=><path key={i} d={d} fill="none" stroke="#8997aa" strokeWidth="1.5" strokeDasharray="7 5"/>)}</g></svg>
}
