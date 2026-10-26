import type {RecordedDrawing} from './drawingReplay';
import {smoothBrushPoints} from './drawingBrush';
/** Refine recorded coordinates only; preserve pressure, clipping, erasures and brush settings. */
export function refineDrawing(source:RecordedDrawing,amount:number):RecordedDrawing {
 const strength=Math.max(0,Math.min(100,amount));
 return {...source,strokes:source.strokes.map(stroke=>({...stroke,points:strength?smoothBrushPoints(stroke.points,strength,1):stroke.points.map(p=>({...p}))}))};
}
