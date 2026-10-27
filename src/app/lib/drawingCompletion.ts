export function outsideDrawing(point:{x:number;y:number},drawing:{x:number;y:number;width:number;height:number},padding=6){
 return point.x<drawing.x-drawing.width/2-padding||point.x>drawing.x+drawing.width/2+padding||point.y<drawing.y-drawing.height/2-padding||point.y>drawing.y+drawing.height/2+padding;
}
/** A brief blank tap finishes a drawing; movement or a held dot remains brush input. */
export function isDrawingFinishTap(start:{x:number;y:number;time:number},end:{x:number;y:number;time:number}){
 return Math.hypot(end.x-start.x,end.y-start.y)<=4&&end.time-start.time<350;
}
