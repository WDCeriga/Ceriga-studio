export type ZipPoint={x:number;y:number};
export type ZipAnchor=ZipPoint&{incoming?:ZipPoint;outgoing?:ZipPoint};
export type ZipRoute={start:ZipPoint;end:ZipPoint;curve?:ZipAnchor[]};
export function zipPolyline(route:ZipRoute):ZipPoint[]{
 const a=route.curve?.length&&route.curve.length>1?route.curve:[route.start,route.end],points:ZipPoint[]=[{...a[0]}];
 for(let i=1;i<a.length;i++){const p=a[i-1],q=a[i],c=p.outgoing??p,d=q.incoming??q;const steps=p.outgoing||q.incoming?48:1;
 for(let j=1;j<=steps;j++){const t=j/steps,u=1-t;points.push({x:u*u*u*p.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*q.x,y:u*u*u*p.y+3*u*u*t*c.y+3*u*t*t*d.y+t*t*t*q.y});}}
 return points;
}
export function zipRoute(route:ZipRoute){
 const points=zipPolyline(route),lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
 const length=lengths.at(-1)??0;
 const at=(distance:number,offset=0)=>{let i=1;while(i<lengths.length-1&&lengths[i]<distance)i++;const a=points[i-1],b=points[i],n=Math.hypot(b.x-a.x,b.y-a.y)||1,t=(distance-lengths[i-1])/n;return{x:a.x+(b.x-a.x)*t-(b.y-a.y)/n*offset,y:a.y+(b.y-a.y)*t+(b.x-a.x)/n*offset}};
 return{points,length,at};
}
export function mapZipCurve(route:ZipRoute,transform:(p:ZipPoint)=>ZipPoint):ZipAnchor[]|undefined{return route.curve?.map(p=>({...transform(p),incoming:p.incoming?transform(p.incoming):undefined,outgoing:p.outgoing?transform(p.outgoing):undefined}))}
export function bendZip(route:ZipRoute,bend:number):ZipAnchor[]{const a=route.start,b=route.end,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;return[{...a,outgoing:{x:a.x+dx/3-dy/len*bend,y:a.y+dy/3+dx/len*bend}},{...b,incoming:{x:b.x-dx/3-dy/len*bend,y:b.y-dy/3+dx/len*bend}}]}
