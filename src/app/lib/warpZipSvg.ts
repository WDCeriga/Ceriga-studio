import svgpath from 'svgpath';
import {zipRoute,type ZipRoute} from './zipCurve';
/** Bend vector tape, teeth and hardware onto the same arc-length route as the fabric cut. */
export function warpZipSvg(svg:Element,route:ZipRoute,width:number,height:number,outputHeight=height){
 if(!route.curve?.length)return;
 const curve=zipRoute(route),dx=route.end.x-route.start.x,dy=route.end.y-route.start.y,chord=Math.hypot(dx,dy)||1;
 const scale=chord/outputHeight;
 const map=(x:number,y:number)=>{const p=curve.at(y/height*curve.length,(width/2-x)*scale),rx=p.x-route.start.x,ry=p.y-route.start.y;return{x:width/2+(rx*dy/chord-ry*dx/chord)/scale,y:(rx*dx/chord+ry*dy/chord)/scale}};
 const walk=(element:Element,transforms:string)=>{
 const transform=[transforms,element.getAttribute('transform')??''].filter(Boolean).join(' ');
 for(const child of Array.from(element.children))walk(child,transform);
 const n=(key:string)=>Number(element.getAttribute(key)??0);let d=element.getAttribute('d');
 const tag=element.localName;
 if(tag==='rect'){const x=n('x'),y=n('y'),w=n('width'),h=n('height');d=`M${x} ${y}h${w}v${h}h${-w}Z`;}
 if(tag==='line')d=`M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`;
 if(tag==='circle'||tag==='ellipse'){const x=n('cx'),y=n('cy'),rx=tag==='circle'?n('r'):n('rx'),ry=tag==='circle'?n('r'):n('ry');d=`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${2*rx} 0a${rx} ${ry} 0 1 0 ${-2*rx} 0Z`;}
 if(d){const path=svgpath(d).transform(transform).abs().unshort().unarc();let out='',first={x:0,y:0};path.iterate((seg,_i,x,y)=>{const v=seg.slice(1) as number[],cmd=seg[0];if(cmd==='M'){first={x:v[0],y:v[1]};const p=map(first.x,first.y);out+=`M${p.x},${p.y}`;return;}const end=cmd==='Z'?first:cmd==='H'?{x:v[0],y}:cmd==='V'?{x,y:v[0]}:{x:v.at(-2)!,y:v.at(-1)!};const c=cmd==='C'?[{x,y},{x:v[0],y:v[1]},{x:v[2],y:v[3]},end]:cmd==='Q'?[{x,y},{x:v[0],y:v[1]},end]:[{x,y},end];const length=c.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-c[i].x,p.y-c[i].y),0);const steps=Math.max(1,Math.min(160,Math.ceil(length/5)));for(let j=1;j<=steps;j++){const t=j/steps;let q=c;while(q.length>1)q=q.slice(1).map((p,i)=>({x:q[i].x*(1-t)+p.x*t,y:q[i].y*(1-t)+p.y*t}));const p=map(q[0].x,q[0].y);out+=`L${p.x},${p.y}`;}if(cmd==='Z')out+='Z';});
 const replacement=svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg','path');for(const attr of Array.from(element.attributes))if(!['d','x','y','width','height','rx','ry','cx','cy','r','x1','y1','x2','y2','transform'].includes(attr.name))replacement.setAttribute(attr.name,attr.value);replacement.setAttribute('d',out);element.parentNode?.replaceChild(replacement,element);
 }else element.removeAttribute('transform');
 };for(const child of Array.from(svg.children))walk(child,'');
}
