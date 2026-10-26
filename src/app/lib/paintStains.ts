import type {ShapePath,ShapePathNode} from './shapeGeometry';
export function paintStainPath(style='splash',seed=37,spread=65):ShapePath {
 let n=seed>>>0||1;const random=()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296};
 const loop=(cx:number,cy:number,rx:number,ry:number,count:number):ShapePath=>{
 const p=Array.from({length:count},(_,i)=>{const a=i/count*Math.PI*2,k=.78+random()*.22;return{x:cx+Math.cos(a)*rx*k,y:cy+Math.sin(a)*ry*k}});
 const nodes:ShapePathNode[]=p.map((q,i)=>{const before=p[(i+p.length-1)%p.length],after=p[(i+1)%p.length],dx=(after.x-before.x)/7,dy=(after.y-before.y)/7;return{...q,in:{x:q.x-dx,y:q.y-dy},out:{x:q.x+dx,y:q.y+dy}}});return{closed:true,nodes};};
 const main=loop(50,style==='drips'?30:50,style==='smear'?37:22,style==='smear'?12:20,28),subpaths:ShapePath[]=[];
 for(let i=0;i<8+Math.round(spread/6);i++){const a=random()*Math.PI*2,d=32+random()*12,size=.6+random()*2.4;subpaths.push(loop(50+Math.cos(a)*d,50+Math.sin(a)*d,size,size*(.5+random()),8))}
 if(style==='drips')for(let i=0;i<4;i++){const x=39+i*7,y=36+random()*3;subpaths.push(loop(x,y+17+random()*9,1.1+random()*1.4,16+random()*12,12))}
 return{...main,subpaths};
}
