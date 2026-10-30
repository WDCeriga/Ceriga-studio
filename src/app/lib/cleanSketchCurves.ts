import type {ShapePath,ShapePathNode} from './shapeGeometry';
type P={x:number;y:number};
const add=(a:P,b:P):P=>({x:a.x+b.x,y:a.y+b.y}),sub=(a:P,b:P):P=>({x:a.x-b.x,y:a.y-b.y}),mul=(a:P,s:number):P=>({x:a.x*s,y:a.y*s}),dot=(a:P,b:P)=>a.x*b.x+a.y*b.y;
const length=(p:P)=>Math.hypot(p.x,p.y),unit=(p:P):P=>mul(p,1/(length(p)||1)),dist=(a:P,b:P)=>length(sub(a,b));
type Cubic=[P,P,P,P];
function sample(c:Cubic,t:number){const u=1-t;return add(add(mul(c[0],u*u*u),mul(c[1],3*u*u*t)),add(mul(c[2],3*u*t*t),mul(c[3],t*t*t)));}
/** Least-squares cubic fitting replaces dense freehand anchors with designed curve spans. */
function fit(points:P[],left:P,right:P,tolerance:number,depth=0):Cubic[]{
 const first=points[0],last=points.at(-1)!;
 if(points.length===2||depth>18){const reach=dist(first,last)/3;return [[first,add(first,mul(left,reach)),add(last,mul(right,reach)),last]];}
 const params=[0];for(let i=1;i<points.length;i++)params.push(params[i-1]+dist(points[i],points[i-1]));const total=params.at(-1)||1;for(let i=1;i<params.length;i++)params[i]/=total;
 let c00=0,c01=0,c11=0,x0=0,x1=0;
 for(let i=0;i<points.length;i++){
  const t=params[i],u=1-t,b0=u*u*u,b1=3*u*u*t,b2=3*u*t*t,b3=t*t*t,A=mul(left,b1),B=mul(right,b2),delta=sub(points[i],add(mul(first,b0+b1),mul(last,b2+b3)));
  c00+=dot(A,A);c01+=dot(A,B);c11+=dot(B,B);x0+=dot(A,delta);x1+=dot(B,delta);
 }
 const determinant=c00*c11-c01*c01,chord=dist(first,last);
 let a=determinant? (x0*c11-x1*c01)/determinant:0,b=determinant?(c00*x1-c01*x0)/determinant:0;
 if(a<chord*.001||b<chord*.001||a>total*2||b>total*2)a=b=chord/3;
 const curve:Cubic=[first,add(first,mul(left,a)),add(last,mul(right,b)),last];
 let error=0,split=Math.floor(points.length/2);
 for(let i=1;i<points.length-1;i++){const d=dist(sample(curve,params[i]),points[i]);if(d>error){error=d;split=i;}}
 if(error<=tolerance)return [curve];
 const tangent=unit(sub(points[Math.max(0,split-1)],points[Math.min(points.length-1,split+1)]));
 return [...fit(points.slice(0,split+1),left,tangent,tolerance,depth+1),...fit(points.slice(split),mul(tangent,-1),right,tolerance,depth+1)];
}
function resample(points:P[],closed:boolean,step:number){
 const input=closed?[...points,points[0]]:points,out:P[]=[input[0]];let traversed=0,next=step;
 for(let i=1;i<input.length;i++){const a=input[i-1],b=input[i],span=dist(a,b);while(span&&next<=traversed+span){out.push(add(a,mul(sub(b,a),(next-traversed)/span)));next+=step;}traversed+=span;}
 if(!closed&&dist(out.at(-1)!,input.at(-1)!)>.001)out.push(input.at(-1)!);
 return out;
}
export function cleanSketchCurve(raw:P[],closed:boolean,detail:number,width:number,height:number):ShapePath{
 let source=raw.filter((p,i)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&(!i||dist(p,raw[i-1])>.001));
 if(closed&&source.length>2&&dist(source[0],source.at(-1)!)<.01)source.pop();
 if(source.length<2)return {closed:false,nodes:[]};
 const diagonal=Math.hypot(width,height),step=Math.max(.25,diagonal*.006),points=resample(source,closed,step),n=points.length;
 if(n<(closed?3:2))return {closed:closed&&source.length>=3,nodes:source.map(p=>({x:p.x/width*100,y:p.y/height*100}))};
 const at=(i:number)=>points[closed?((i%n)+n)%n:Math.max(0,Math.min(n-1,i))];
 const wholeDelta=sub(points.at(-1)!,points[0]),wholeDen=dot(wholeDelta,wholeDelta),lineTolerance=Math.max(diagonal*(.008+(100-detail)/100*.04),Math.sqrt(wholeDen)*.055);
 if(!closed&&wholeDen&&points.every(p=>{const t=dot(sub(p,points[0]),wholeDelta)/wholeDen;return t>=-.02&&t<=1.02&&dist(p,add(points[0],mul(wholeDelta,t)))<=lineTolerance;}))return {closed:false,nodes:[points[0],points.at(-1)!].map(p=>({x:p.x/width*100,y:p.y/height*100}))};
 const window=Math.max(1,Math.min(Math.floor((n-1)/2),Math.max(3,Math.round(diagonal*.05/step))));
 const average=(i:number)=>{let sum={x:0,y:0};const half=Math.max(1,Math.floor(window/3));for(let j=-half;j<=half;j++)sum=add(sum,at(i+j));return mul(sum,1/(half*2+1));};
 const scores=points.map((p,i)=>{
  if(!closed&&(i<window||i>=n-window))return 0;
  const center=average(i),a=unit(sub(center,average(i-window))),b=unit(sub(average(i+window),center));return Math.acos(Math.max(-1,Math.min(1,dot(a,b))));
 });
 const corners=new Set<number>();
 for(let i=0;i<n;i++)if(scores[i]>.55){
  // A corner stays sharp at two scales. Smooth tight bends must not become cusps.
  const half=Math.max(1,Math.floor(window/2)),center=average(i),fine=Math.acos(Math.max(-1,Math.min(1,dot(unit(sub(center,average(i-half))),unit(sub(average(i+half),center))))));
  if(scores[i]>1.30){if(fine<scores[i]*.72)continue;}
  else{
   // A shallow architectural corner has two straight supporting runs; a petal
   // or snake bend has continuously changing curvature on at least one side.
   const support=(direction:number)=>{const a=average(i+direction*2),b=average(i+direction*window*2),delta=sub(b,a),den=dot(delta,delta);if(!den)return false;for(let k=3;k<window*2;k++){const p=average(i+direction*k),t=dot(sub(p,a),delta)/den;if(dist(p,add(a,mul(delta,t)))>diagonal*.005)return false;}return true;};
   if(!support(-1)||!support(1))continue;
  }let strongest=true;for(let j=-window;j<=window;j++){const k=closed?(i+j+n)%n:i+j;if(k>=0&&k<n&&k!==i&&(scores[k]>scores[i]||(scores[k]===scores[i]&&k<i))){strongest=false;break;}}if(strongest)corners.add(i);}
 const radius=Math.max(1,Math.min(n-1,Math.max(2,Math.round(diagonal*(.010+(100-detail)/100*.022)/step))));
 const smoothed=points.map((p,i)=>{
  if(corners.has(i)||(!closed&&(i===0||i===n-1)))return p;
  let sum=0,x=0,y=0;
  for(let j=-radius;j<=radius;j++){const k=closed?(i+j+n)%n:Math.max(0,Math.min(n-1,i+j));let crosses=false;for(let a=1;a<=Math.abs(j);a++)if(corners.has(closed?(i+Math.sign(j)*a+n)%n:i+Math.sign(j)*a)){crosses=true;break;}if(crosses)continue;const weight=Math.exp(-j*j/(radius*radius*.5));sum+=weight;x+=points[k].x*weight;y+=points[k].y*weight;}
  return {x:x/sum,y:y/sum};
 });
 // Split closed loops at corners; a smooth loop gets two stable opposite anchors.
 let anchors=[...corners].sort((a,b)=>a-b);
 if(closed&&anchors.length<2){const first=anchors[0]??smoothed.reduce((best,p,i)=>p.y>smoothed[best].y?i:best,0);anchors=[first,(first+Math.floor(n/2))%n].sort((a,b)=>a-b);}
 if(!closed)anchors=[0,...anchors,n-1].filter((v,i,a)=>!i||v!==a[i-1]);
 const tolerance=Math.max(.25,diagonal*(.004+(100-detail)/100*.021)),nodes:ShapePathNode[]=[];
 const spans=Array.from({length:closed?anchors.length:anchors.length-1},(_,span)=>{
  const start=anchors[span],end=anchors[(span+1)%anchors.length],row:P[]=[];
  for(let i=start;;i=(i+1)%n){row.push(smoothed[i]);if(i===end)break;}
  const a=row[0],b=row.at(-1)!,delta=sub(b,a),den=dot(delta,delta),straight=den>0&&row.every(p=>{const t=dot(sub(p,a),delta)/den;return t>=-.01&&t<=1.01&&dist(p,add(a,mul(delta,t)))<=Math.max(tolerance*.8,Math.sqrt(den)*.055);});
  return {start,end,row,straight,delta,den};
 });
 // Solve shared horizontal/vertical constraints before emitting any curves,
 // so adjacent straight edges meet at exactly the same corner.
 for(const axis of ['x','y'] as const){
  const parent=new Map(anchors.map(i=>[i,i])),root=(i:number):number=>{const p=parent.get(i)!;return p===i?i:root(p);};
  for(const span of spans)if(span.straight&&Math.abs(span.delta[axis])<Math.sqrt(span.den)*.12)parent.set(root(span.end),root(span.start));
  const groups=new Map<number,number[]>();for(const i of anchors){const key=root(i);groups.set(key,[...(groups.get(key)??[]),i]);}
  for(const group of groups.values())if(group.length>1){const value=group.reduce((sum,i)=>sum+smoothed[i][axis],0)/group.length;group.forEach(i=>smoothed[i][axis]=value);}
 }
 for(const {start,end,row,straight} of spans){
  const near=(i:number)=>smoothed[(i+n)%n];
  const left=unit(!corners.has(start)&&(closed||start>0)?sub(near(start+1),near(start-1)):sub(row[1],row[0]));
  const right=unit(!corners.has(end)&&(closed||end<n-1)?sub(near(end-1),near(end+1)):sub(row.at(-2)!,row.at(-1)!));
  const a=row[0],b=row.at(-1)!,curves=straight?[[a,a,b,b] as Cubic]:fit(row,left,right,tolerance);
  for(const c of curves){let node=nodes.at(-1);if(!node||dist(node,c[0])>.001){node={...c[0]};nodes.push(node);}if(!straight)node.out=c[1];const last={...c[3],...(!straight?{in:c[2]}:{})};nodes.push(last);}
 }
 if(closed&&nodes.length>1&&dist(nodes[0],nodes.at(-1)!)<.001){nodes[0].in=nodes.at(-1)!.in;nodes.pop();}
 const normalize=(p:P)=>({x:p.x/width*100,y:p.y/height*100});
 return {closed,nodes:nodes.map(p=>({...normalize(p),...(p.in?{in:normalize(p.in)}:{}),...(p.out?{out:normalize(p.out)}:{})}))};
}

/** Fit an already designed contour without smoothing or moving its corners. */
export function fitVectorContour(points:P[],closed:boolean,tolerance=.05,cornerAngle=.55):ShapePath{
 if(points.length<3)return{closed,nodes:points};
 const n=points.length,corners:number[]=[];for(let i=closed?0:1;i<(closed?n:n-1);i++){const a=unit(sub(points[i],points[(i-1+n)%n])),b=unit(sub(points[(i+1)%n],points[i]));if(Math.acos(Math.max(-1,Math.min(1,dot(a,b))))>cornerAngle)corners.push(i);}
 const stops=closed?(corners.length?corners:[0,Math.floor(n/2)]):[0,...corners,n-1],nodes:ShapePathNode[]=[];
 for(let segment=0;segment<stops.length-(closed?0:1);segment++){const a=stops[segment],b=stops[(segment+1)%stops.length],row:P[]=[points[a]];let i=(a+1)%n;while(i!==b){row.push(points[i]);i=(i+1)%n;if(row.length>n)break;}row.push(points[b]);if(row.length<2)continue;const curves=fit(row,unit(sub(row[1],row[0])),unit(sub(row.at(-2)!,row.at(-1)!)),tolerance);for(const curve of curves){let last=nodes.at(-1);if(!last||dist(last,curve[0])>1e-7){last={...curve[0]};nodes.push(last);}last.out=curve[1];nodes.push({...curve[3],in:curve[2]});}}
 if(closed&&nodes.length>1&&dist(nodes[0],nodes.at(-1)!)<1e-6){nodes[0].in=nodes.at(-1)!.in;nodes.pop();}return{closed,nodes};
}
