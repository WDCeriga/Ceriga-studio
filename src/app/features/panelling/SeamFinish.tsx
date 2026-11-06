import {memo} from 'react';
import {flattenSeam,seamPath} from './panellingGeometry';
import type {PanellingSeam} from './panellingTypes';
/** Shared construction preview: never changes panel topology or fabric assignment. */
export const SeamFinish=memo(function SeamFinish({seam,colour='#141414'}:{seam:PanellingSeam;colour?:string}) {
 const d=seamPath(seam.anchors),finish=seam.finish??'plain',ink=seam.threadColour??colour;
 const width=Math.max(.5,Math.min(8,seam.finishWidth??2)),stitch=Math.max(1,Math.min(12,seam.stitchLength??3));
 const line=flattenSeam(seam),offset=width*2;
 const shifted=(side:number)=>line.map((p,i)=>{const a=line[Math.max(0,i-1)],b=line[Math.min(line.length-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;return{x:p.x-dy/len*side,y:p.y+dx/len*side}});
 const path=(value:string,stroke:string,size:number,dash?:string)=><path d={value} fill="none" stroke={stroke} strokeWidth={size} strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>;
 const poly=(points:{x:number;y:number}[])=>points.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ');
 // Sample by arc length so stitches stay evenly spaced through tight curves.
 const stations:{x:number;y:number;nx:number;ny:number}[]=[];let travelled=0,next=0;
 for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(!length)continue;
  while(next<=travelled+length){const t=(next-travelled)/length;stations.push({x:a.x+dx*t,y:a.y+dy*t,nx:-dy/length,ny:dx/length});next+=Math.max(2,stitch*2);}travelled+=length;
 }
 const at=(p:typeof stations[number],n:number)=>({x:p.x+p.nx*n,y:p.y+p.ny*n});
 const cross=stations.map((p,i)=>at(p,(i%2?1:-1)*offset));
 const edge=seam.seamColour??'#a3a3a3';
 const ribbon=(fill:string,opacity:number=1)=><path d={poly(shifted(offset))+' '+poly(shifted(-offset).reverse()).replace(/^M/,'L')+'Z'} fill={fill} fillOpacity={opacity} stroke="none"/>;
 const loops=stations.slice(0,-1).map((p,i)=>{const q=stations[i+1],a=at(p,offset),b=at(q,-offset),c=at(p,-offset);return `M${a.x},${a.y}Q${c.x},${c.y} ${b.x},${b.y}`}).join(' ');
 const chain=stations.slice(0,-1).map((p,i)=>{const q=stations[i+1],a=at(p,-offset*.45),b=at(p,offset*.45);return `M${p.x},${p.y}Q${a.x},${a.y} ${q.x},${q.y}Q${b.x},${b.y} ${p.x},${p.y}`}).join(' ');
 const fibres=stations.map((p,i)=>{const a=at(p,offset*(i%2?1:-1)),b=at(p,(offset+3+(i%3)*2)*(i%2?1:-1));return `M${a.x},${a.y}L${b.x+((i%3)-1)*2},${b.y}`}).join(' ');
 return <g data-construction-seam="" data-seam-finish={finish} pointerEvents="none">
 {finish==='hidden'?null:finish==='plain'?path(d,ink,.75):finish==='topstitch'?<>{path(d,colour,.4)}{path(poly(shifted(offset)),ink,.65,`${stitch} ${stitch*.65}`)}</>:finish==='double'?<>{path(poly(shifted(offset)),ink,.65,`${stitch} ${stitch*.65}`)}{path(poly(shifted(-offset)),ink,.65,`${stitch} ${stitch*.65}`)}</>:finish==='flatlock'?<>{path(poly(shifted(offset)),ink,.5)}{path(poly(shifted(-offset)),ink,.5)}{path(poly(cross),ink,.55)}</>:finish==='exposed'?<>{ribbon(edge,.45)}{path(poly(shifted(offset)),colour,.5)}{path(poly(shifted(-offset)),colour,.5)}{path(poly(shifted(-offset*.5)),ink,.6,`${stitch} ${stitch}`)}{path(fibres,edge,.4)}</>:finish==='overlock'?<>{path(d,colour,.5)}{path(loops,ink,.6)}{path(poly(shifted(-offset)),ink,.5)}</>:finish==='raw'?<>{path(d,edge,.65)}{path(fibres,edge,.45)}{path(poly(shifted(-offset)),ink,.6,`${stitch} ${stitch}`)}</>:finish==='zigzag'?path(poly(cross),ink,.65):finish==='chain'?path(chain,ink,.65):finish==='coverstitch'?<>{path(poly(shifted(offset)),ink,.55,`${stitch} ${stitch*.7}`)}{path(poly(shifted(-offset)),ink,.55,`${stitch} ${stitch*.7}`)}{path(poly(cross),ink,.4)}</>:finish==='lapped'?<>{ribbon(edge,.3)}{path(poly(shifted(offset)),colour,.55)}{path(poly(shifted(offset*.6)),ink,.55,`${stitch} ${stitch}`)}{path(poly(shifted(-offset*.6)),ink,.55,`${stitch} ${stitch}`)}</>:finish==='mesh'?<>{ribbon(edge,.25)}{path(poly(cross),ink,.45)}{path(poly(stations.map((p,i)=>at(p,(i%2?-1:1)*offset))),ink,.45)}{path(poly(shifted(offset)),ink,.5)}{path(poly(shifted(-offset)),ink,.5)}</>:finish==='taped'?<>{ribbon(edge,.8)}{path(poly(shifted(offset)),edge,.5)}{path(poly(shifted(-offset)),edge,.5)}</>:finish==='binding'?<>{ribbon(edge,.8)}{path(poly(shifted(offset)),colour,.5)}{path(poly(shifted(-offset)),colour,.5)}{path(d,ink,.6,`${stitch} ${stitch}`)}</>:<>{ribbon(edge)}{path(poly(shifted(offset)),colour,.5)}{path(poly(shifted(-offset)),colour,.5)}{path(d,'#ffffff',.5)}</>}

 </g>;
});
