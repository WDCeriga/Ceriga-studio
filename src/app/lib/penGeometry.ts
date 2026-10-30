import {pathSegmentPoint} from './shapePathEditing';
import type {ShapePath,ShapePathNode} from './shapeGeometry';
export type PenPoint={x:number;y:number};
export function copyPenPoint(point:PenPoint):PenPoint{return {x:point.x,y:point.y};}
export function offsetPenNode(node:ShapePathNode,delta:PenPoint):ShapePathNode{
  const move=(p:PenPoint)=>({x:p.x+delta.x,y:p.y+delta.y});
  return {...move(node),...(node.in?{in:move(node.in)}:{}),...(node.out?{out:move(node.out)}:{})};
}
export function constrainPenPoint(origin:PenPoint,point:PenPoint):PenPoint{
  const distance=Math.hypot(point.x-origin.x,point.y-origin.y),angle=Math.round(Math.atan2(point.y-origin.y,point.x-origin.x)/(Math.PI/4))*Math.PI/4;
  return {x:origin.x+Math.cos(angle)*distance,y:origin.y+Math.sin(angle)*distance};
}
export function dragPenHandle(node:ShapePathNode,point:PenPoint,handle:'in'|'out',linked:boolean,shift=false):ShapePathNode{
  const target=shift?constrainPenPoint(node,point):copyPenPoint(point),opposite=handle==='in'?'out':'in',length=Math.hypot(target.x-node.x,target.y-node.y);
  const oldLength=node[opposite]?Math.hypot(node[opposite]!.x-node.x,node[opposite]!.y-node.y):length;
  return {...node,[handle]:target,...(linked&&length>0?{[opposite]:{x:node.x-(target.x-node.x)*oldLength/length,y:node.y-(target.y-node.y)*oldLength/length}}:{})};
}
export function reversePenPath(path:ShapePath):ShapePath{
  return {...path,nodes:path.nodes.slice().reverse().map(n=>({x:n.x,y:n.y,in:n.out?copyPenPoint(n.out):undefined,out:n.in?copyPenPoint(n.in):undefined}))};
}
export function snapPenPoint(point:PenPoint,targets:PenPoint[],tolerance:number,gridSize=0):{point:PenPoint;vertical?:number;horizontal?:number}{
  let x=point.x,y=point.y,dx=tolerance,dy=tolerance,vertical:number|undefined,horizontal:number|undefined;
  for(const target of targets){const ax=Math.abs(point.x-target.x),ay=Math.abs(point.y-target.y);if(ax<dx){dx=ax;x=target.x;vertical=x;}if(ay<dy){dy=ay;y=target.y;horizontal=y;}}
  if(gridSize>0){const gx=Math.round(point.x/gridSize)*gridSize,gy=Math.round(point.y/gridSize)*gridSize;if(Math.abs(point.x-gx)<dx){x=gx;vertical=x;}if(Math.abs(point.y-gy)<dy){y=gy;horizontal=y;}}
  return {point:{x,y},vertical,horizontal};
}

export function nearestPenSegment(path:ShapePath,point:PenPoint,metric={x:1,y:1}){
 let best={index:-1,t:.5,distance:Infinity};
 for(let index=0;index<path.nodes.length-(path.closed?0:1);index++){
  const a=path.nodes[index],b=path.nodes[(index+1)%path.nodes.length],distance=(t:number)=>{const p=pathSegmentPoint(a,b,t);return Math.hypot((p.x-point.x)*metric.x,(p.y-point.y)*metric.y);};
  let t=0,d=Infinity;for(let i=0;i<=32;i++){const next=distance(i/32);if(next<d){d=next;t=i/32;}}
  let lo=Math.max(0,t-1/32),hi=Math.min(1,t+1/32);for(let i=0;i<28;i++){const x=lo+(hi-lo)/3,y=hi-(hi-lo)/3;if(distance(x)<distance(y))hi=y;else lo=x;}t=(lo+hi)/2;d=distance(t);if(d<best.distance)best={index,t,distance:d};
 }
 return best;
}
/** Move a point on a cubic exactly under the pointer without moving its endpoints. */
export function bendPenSegment(path:ShapePath,index:number,t:number,delta:PenPoint):ShapePath{
 const next=(index+1)%path.nodes.length;if(index<0||index>=path.nodes.length||(!path.closed&&next===0))return path;
 const a=path.nodes[index],b=path.nodes[next],u=Math.max(.02,Math.min(.98,t)),w1=3*(1-u)**2*u,w2=3*(1-u)*u*u,den=w1*w1+w2*w2;
 return {...path,nodes:path.nodes.map((n,i)=>({...n,...(i===index?{out:{x:(a.out??a).x+delta.x*w1/den,y:(a.out??a).y+delta.y*w1/den}}:{}),...(i===next?{in:{x:(b.in??b).x+delta.x*w2/den,y:(b.in??b).y+delta.y*w2/den}}:{})}))};
}
