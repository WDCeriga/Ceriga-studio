import {constructionDepth} from '../lib/constructionDepth';

type Point = readonly [x: number, y: number];
type Side = readonly [Point, Point, Point, Point];
type AddLayer = (id:string,name:string,markup:string,solid?:boolean,role?:string,z?:number)=>void;

// Draft from the right side seam, then mirror the left edge about centre front.
export function tankHem(add:AddLayer,style:string,depthValue:string|undefined,centre:number,bow:number,side:Side) {
 const [start,a,b,end]=side;
 const [edgeX,edgeY]=end;
 const depth=constructionDepth(depthValue,style==='rib'?3:1.3,style==='rib'?12:5)*10;
 const mirror=([x,y]:Point):Point=>[2*centre-x,y];
 const print=([x,y]:Point)=>`${x} ${y}`;
 const mix=(p:Point,q:Point,t:number):Point=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
 const split=(t:number)=>{
  const ab=mix(a,b,t),be=mix(b,end,t),rightControl=mix(ab,be,t);
  return [mix(mix(mix(start,a,t),ab,t),rightControl,t),rightControl,be] as const;
 };
 const atY=(y:number)=>{
  let low=0,high=1;
  for(let i=0;i<24;i++){
   const mid=(low+high)/2;
   if(split(mid)[0][1]<y)low=mid;
   else high=mid;
  }
  return split((low+high)/2);
 };
 const row=(right:Point,inset=0)=>{
  const point:Point=[right[0]-inset,right[1]];
  return `M${print(mirror(point))}Q${centre} ${point[1]+bow} ${print(point)}`;
 };
 if(style==='raw'){
  add('rawHem','Raw hem',`<path data-fixed-ink="true" d="${row(end)}" fill="none" stroke="#777" stroke-opacity=".52" stroke-width="1.4"/>`);
  return '';
 }
 const [top,p,q]=atY(edgeY-depth);
 const band=`${row(top)}C${print(p)} ${print(q)} ${print(end)}Q${centre} ${edgeY+bow} ${print(mirror(end))}C${print(mirror(q))} ${print(mirror(p))} ${print(mirror(top))}Z`;
 add('bodyHem',style==='rib'?'Rib hem band':'Bottom hem',`<path${style==='rib'?' data-drawn-hem-ribbing="true"':''} d="${band}" fill="#000000"/>`,true,'hem',20);
 if(style==='rib'){
  // Keep each stroke inside both curved edges without a document-wide clip ID.
  const ribHalfWidth=Math.min(top[0],p[0],q[0],edgeX)-centre-3;
  const edgeAt=(x:number,right:Point)=>right[1]+bow*(1-((x-centre)/(right[0]-centre))**2)/2;
  let ribs='';
  const ribLine=(x:number)=>`M${x} ${edgeAt(x,top)+2}V${edgeAt(x,end)-2}`;
  for(let x=centre-ribHalfWidth;x<=centre+ribHalfWidth;x+=5) {
   ribs+=ribLine(x);
  }
  add('bodyHemRib','Hem rib lines',`<g data-fixed-ink="true" data-texture="rib" fill="none"><path d="${ribs}" stroke="#16181c" stroke-opacity=".7" stroke-width="1.5"/></g>`,false,'body',22);
 }
 const stitch=(y:number)=>row(atY(y)[0],3);
 const line=stitch(edgeY-depth);
 const second=style==='double'||style==='cover';
 if(style==='cover')add('coverHem','Coverstitch interlock',`<path data-fixed-ink="true" d="${stitch(edgeY-depth-3.5)}" fill="none" stroke="#999" stroke-width="1.5" stroke-dasharray="1 3"/>`);
 return `<path data-trouser-stitch-region="bottom" d="${line}"/>${second?`<path data-trouser-stitch-region="bottom" d="${stitch(edgeY-depth-7)}"/>`:''}`;
}
