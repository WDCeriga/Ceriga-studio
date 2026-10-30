import type {BrushPoint,renderBrushStroke} from './drawingBrush';
export type RecordedBrushSettings=Parameters<typeof renderBrushStroke>[2];
export interface RecordedStroke {points:BrushPoint[];settings:RecordedBrushSettings;seed:number;opacity:number;mirrorAxis?:number;paintFrame?:{x:number;y:number;width:number;height:number};clip?:{url:string;x:number;y:number;width:number;height:number}}
export interface RecordedDrawing {width:number;height:number;strokes:RecordedStroke[];erasers?:RecordedStroke[];cuts?:{x:number;y:number}[][]}
export function snapshotBrush(settings:RecordedBrushSettings):RecordedBrushSettings {
 return {...Object.fromEntries(Object.entries(settings).filter(([,v])=>['number','boolean','string'].includes(typeof v))),pencil:{tiltShading:settings.pencil.tiltShading}} as RecordedBrushSettings;
}
export function offsetRecordedStroke(stroke:RecordedStroke,x:number,y:number):RecordedStroke {
 return {...stroke,points:stroke.points.map(p=>({...p,x:p.x+x,y:p.y+y})),paintFrame:stroke.paintFrame?{...stroke.paintFrame,x:stroke.paintFrame.x+x,y:stroke.paintFrame.y+y}:undefined,mirrorAxis:stroke.mirrorAxis===undefined?undefined:stroke.mirrorAxis+x,clip:stroke.clip?{...stroke.clip,x:stroke.clip.x+x,y:stroke.clip.y+y}:undefined};
}
