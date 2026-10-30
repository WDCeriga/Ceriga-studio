import type {ShapePath} from './shapeGeometry';
import {pathSegmentPoint} from './shapePathEditing';

type Size={width:number;height:number};
type Mode='auto'|'circle'|'ellipse';
const kappa=4/3*Math.tan(Math.PI/8);
function alreadyRegular(path:ShapePath){
  if(path.nodes.length!==4)return false;
  const cx=(path.nodes[0].x+path.nodes[2].x)/2,cy=(path.nodes[0].y+path.nodes[2].y)/2,near=(a:number,b:number)=>Math.abs(a-b)<1e-6;
  return path.nodes.every((node,index)=>{const opposite=path.nodes[(index+2)%4],next=path.nodes[(index+1)%4];return node.in&&node.out&&near(node.x+opposite.x,cx*2)&&near(node.y+opposite.y,cy*2)&&near(node.out.x-node.x,(next.x-cx)*kappa)&&near(node.out.y-node.y,(next.y-cy)*kappa)&&near(node.in.x+node.out.x,node.x*2)&&near(node.in.y+node.out.y,node.y*2);});
}
/** Work in physical element coordinates: a circle must stay circular in a wide element. */
export function regulariseContour(path:ShapePath,size:Size,mode:Mode='auto',tolerance=.08):ShapePath{
  if(!path.closed||path.nodes.length<3||size.width<=0||size.height<=0)return path;
  if(mode==='auto'&&alreadyRegular(path))return path;
  if(mode==='auto'&&path.nodes.length<8&&!path.nodes.some(node=>node.in||node.out))return path;
  const points=path.nodes.flatMap((node,index)=>Array.from({length:16},(_,step)=>{
    const p=pathSegmentPoint(node,path.nodes[(index+1)%path.nodes.length],step/16);
    return{x:p.x*size.width/100,y:p.y*size.height/100};
  }));
  if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return path;
  const bounds=points.reduce((b,p)=>({left:Math.min(b.left,p.x),right:Math.max(b.right,p.x),top:Math.min(b.top,p.y),bottom:Math.max(b.bottom,p.y)}),{left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity});
  const{left,right,top,bottom}=bounds;
  const cx=(left+right)/2,cy=(top+bottom)/2;let rx=(right-left)/2,ry=(bottom-top)/2;
  if(Math.min(rx,ry)<1e-8)return path;
  const errors=points.map(p=>Math.abs(Math.hypot((p.x-cx)/rx,(p.y-cy)/ry)-1));
  if(mode==='auto'&&(Math.sqrt(errors.reduce((sum,v)=>sum+v*v,0)/errors.length)>tolerance||errors.some(error=>error>tolerance*2)))return path;
  if(mode==='circle'||mode==='auto'&&Math.max(rx,ry)/Math.min(rx,ry)<1.15)rx=ry=(rx+ry)/2;
  const area=points.reduce((sum,p,index)=>{const q=points[(index+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0),direction=area<0?-1:1;
  const start=Math.atan2((points[0].y-cy)/ry,(points[0].x-cx)/rx),k=kappa;
  const normal=(x:number,y:number)=>({x:x/size.width*100,y:y/size.height*100});
  const nodes=Array.from({length:4},(_,index)=>{
    const angle=start+index*direction*Math.PI/2,x=cx+rx*Math.cos(angle),y=cy+ry*Math.sin(angle),dx=-rx*Math.sin(angle)*direction*k,dy=ry*Math.cos(angle)*direction*k;
    return{...normal(x,y),in:normal(x-dx,y-dy),out:normal(x+dx,y+dy)};
  });
  return{...path,nodes};
}

/** Only recognised round contours change. Linked outlines, letters and open paths are preserved. */
export function regulariseCurves(path:ShapePath,size:Size,tolerance=.08):{path:ShapePath;count:number}{
  const fitted=regulariseContour(path,size,'auto',tolerance);let count=fitted===path?0:1;
  const children=path.subpaths?.map(child=>{const result=regulariseCurves(child,size,tolerance);count+=result.count;return result.path;});
  return{path:count?{...fitted,subpaths:children}:path,count};
}

/** Fit a circular arc to one contiguous selection, keeping both joins and outside handles fixed. */
export function regulariseSelectedArc(path:ShapePath,selection:number[],size:Size):ShapePath|null{
  const chosen=new Set(selection.filter(index=>index>=0&&index<path.nodes.length)),length=path.nodes.length;
  if(chosen.size<2||size.width<=0||size.height<=0||path.closed&&chosen.size===length)return null;
  const starts=[...chosen].filter(index=>!chosen.has(index-1)&&(index!==0||!path.closed||!chosen.has(length-1)));
  if(starts.length!==1)return null;
  const start=starts[0],indices=Array.from({length:chosen.size},(_,i)=>(start+i)%length);
  if(indices.some(index=>!chosen.has(index)))return null;
  const first=path.nodes[start],last=path.nodes[indices[indices.length-1]],world=(p:{x:number;y:number})=>({x:p.x*size.width/100,y:p.y*size.height/100}),a=world(first),b=world(last),dx=b.x-a.x,dy=b.y-a.y,chord=Math.hypot(dx,dy);
  if(chord<1e-8)return null;
  const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,nx=-dy/chord,ny=dx/chord;
  const points=indices.slice(0,-1).flatMap((index,j)=>Array.from({length:16},(_,step)=>world(pathSegmentPoint(path.nodes[index],path.nodes[indices[j+1]],step/16))));points.push(b);
  let numerator=0,denominator=0;
  for(const p of points){const x=p.x-mx,y=p.y-my,v=2*(x*nx+y*ny);numerator+=v*(x*x+y*y-chord*chord/4);denominator+=v*v;}
  if(denominator<chord**4*1e-10)return null;
  const offset=numerator/denominator,cx=mx+nx*offset,cy=my+ny*offset,radius=Math.hypot(chord/2,offset),angle=Math.atan2(a.y-cy,a.x-cx);
  let previous=angle,sweep=0;
  for(const p of points.slice(1)){const next=Math.atan2(p.y-cy,p.x-cx);let delta=next-previous;while(delta>Math.PI)delta-=Math.PI*2;while(delta< -Math.PI)delta+=Math.PI*2;sweep+=delta;previous=next;}
  if(!Number.isFinite(radius)||Math.abs(sweep)<1e-5||Math.abs(sweep)>Math.PI*1.95)return null;
  const segments=Math.ceil(Math.abs(sweep)/(Math.PI/2)),step=sweep/segments,k=4/3*Math.tan(step/4),normal=(x:number,y:number)=>({x:x/size.width*100,y:y/size.height*100});
  const arc=Array.from({length:segments+1},(_,index)=>{
    const theta=angle+step*index,p=index===0?a:index===segments?b:{x:cx+radius*Math.cos(theta),y:cy+radius*Math.sin(theta)},tx=-radius*Math.sin(theta)*k,ty=radius*Math.cos(theta)*k;
    const position=index===0?{x:first.x,y:first.y}:index===segments?{x:last.x,y:last.y}:normal(p.x,p.y);
    return{...position,in:index===0?first.in:normal(p.x-tx,p.y-ty),out:index===segments?last.out:normal(p.x+tx,p.y+ty)};
  });
  const nodes=path.closed?[...arc,...Array.from({length:length-chosen.size},(_,i)=>path.nodes[(start+chosen.size+i)%length])]:[...path.nodes.slice(0,start),...arc,...path.nodes.slice(start+chosen.size)];
  return{...path,nodes};
}
