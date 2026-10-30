import type {ShapePath} from './shapeGeometry';
/** True cubic extrema, excluding off-curve handles from physical measurements. */
export function bezierBounds(path:ShapePath){
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 const add=(x:number,y:number)=>{left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)};
 const roots=(a:number,b:number,c:number,d:number)=>{const A=-a+3*b-3*c+d,B=2*(a-2*b+c),C=b-a;if(Math.abs(A)<1e-12)return Math.abs(B)<1e-12?[]:[-C/B];const discriminant=B*B-4*A*C;return discriminant<0?[]:[(-B+Math.sqrt(discriminant))/(2*A),(-B-Math.sqrt(discriminant))/(2*A)]};
 const cubic=(a:number,b:number,c:number,d:number,t:number)=>(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d;
 const visit=(part:ShapePath)=>{part.nodes.forEach(p=>add(p.x,p.y));for(let i=0;i<part.nodes.length-(part.closed?0:1);i++){const a=part.nodes[i],d=part.nodes[(i+1)%part.nodes.length],b=a.out??a,c=d.in??d;for(const t of[...roots(a.x,b.x,c.x,d.x),...roots(a.y,b.y,c.y,d.y)])if(t>0&&t<1)add(cubic(a.x,b.x,c.x,d.x,t),cubic(a.y,b.y,c.y,d.y,t));}part.subpaths?.forEach(visit)};visit(path);
 return{left,top,width:Number.isFinite(left)?right-left:0,height:Number.isFinite(top)?bottom-top:0};
}
