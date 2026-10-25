import type { DistressMark, DistressMarkKind } from './distressScatter';

export interface DistressPalette {fabric:string;opening:string;fiber:string;edge:string;shadow:string}
export interface DistressPath {
  d:string;fill?:string;stroke?:string;strokeWidth?:number;opacity?:number;dash?:number[];
  role?:'opening'|'fiber'|'surface'|'edge';
}
function mix(a:number[],b:number[],amount:number) {
  return `rgb(${a.map((c,i)=>Math.round(c+(b[i]-c)*amount)).join(',')})`;
}
export function distressPalette(color='#414141',opening?:string):DistressPalette {
  const hex=color.match(/^#([a-f\d]{6}|[a-f\d]{3})$/i);
  const value=hex?(hex[1].length===3?hex[1].split('').map(c=>c+c).join(''):hex[1]):null;
  const rgb=value?[0,2,4].map(i=>parseInt(value.slice(i,i+2),16)):color.match(/[\d.]+/g)?.slice(0,3).map(Number);
  const base=rgb?.length===3&&rgb.every(Number.isFinite)?rgb:[65,65,65];
  return {fabric:mix(base,base,0),opening:opening??mix(base,base,0),fiber:mix(base,[255,255,255],.46),edge:mix(base,[255,255,255],.22),shadow:mix(base,[0,0,0],.48)};
}
export const DEFAULT_DISTRESS_PALETTE=distressPalette();
function seeded(seed:number) {
  let value=seed>>>0||1;
  return ()=>{value^=value<<13;value^=value>>>17;value^=value<<5;return(value>>>0)/4294967296};
}
const n=(v:number)=>Number(v.toFixed(3));
type Point={x:number;y:number};
const point=(p:Point)=>`${n(p.x)},${n(p.y)}`;
function contour(points:Point[]) {return points.map((p,i)=>`${i?'L':'M'}${point(p)}`).join(' ')+' Z'}

/** Cotton-jersey damage: exposed openings, broken loops and surface fibrillation.
 * All dimensions are local garment units. SVG assets, swatches and painted strokes share this geometry. */
export function distressPaths(mark:DistressMark,kind:DistressMarkKind,palette=DEFAULT_DISTRESS_PALETTE):DistressPath[] {
  const w=Math.max(.1,mark.width),h=Math.max(.1,mark.height),random=seeded(mark.seed);
  const rough=Math.max(0,Math.min(1,mark.roughness));
  const fray=Math.max(0,Math.min(2,mark.fray??1));
  const weight=Math.max(.13,Math.min(.65,Math.min(w,h)*.035));
  if(kind==='abrasion') {
    // Discontinuous, feathered strokes preserve the underlying knit; no solid patch or opening.
    const fade:string[][]=[[],[],[]],fibers:string[][]=[[],[],[]];
    for(let i=0;i<Math.max(24,Math.round(60*fray));i++) {
      const angle=random()*Math.PI*2,r=Math.sqrt(random());let x=Math.cos(angle)*r*w*.48,y=Math.sin(angle)*r*h*.48;
      y+=(mark.bend??0)/100*h*(.5-(x/w)**2);x+=(mark.skew??0)/100*y;
      const length=(.035+random()*.16)*w*(1-r*.55),curl=(random()-.5)*h*(.025+rough*.15);
      const d=`M${n(x-length*.5)},${n(y)} q${n(length*.42)},${n(curl)} ${n(length)},${n(curl*.28)}`;
      if(fray>0)fibers[i%3].push(d);
      if(i<24)fade[i%3].push(d);
    }
    return [
      ...fade.map((paths,i)=>({d:paths.join(' '),stroke:palette.fiber,strokeWidth:Math.max(.4,h*(.055+i*.03)),opacity:.025+i*.015,role:'surface' as const})),
      ...fibers.map((paths,i)=>({d:paths.join(' '),stroke:i===2?palette.shadow:palette.fiber,strokeWidth:weight*(.5+i*.26),opacity:i===2?.11:.18+i*.13,role:'fiber' as const})),
    ];
  }
  let points:Point[];
  if(kind==='holes') {
    const phase=random()*Math.PI*2;
    points=Array.from({length:40},(_,i)=>{
      const a=i/40*Math.PI*2,r=.43+Math.sin(a*3+phase)*.035+(random()-.5)*(.025+rough*.1);
      return{x:Math.cos(a)*w*r,y:Math.sin(a)*h*r};
    });
  } else {
    const steps=24,phase=random()*Math.PI*2;
    const jaw=(lower:boolean)=>Array.from({length:steps+1},(_,i)=>{
      const t=i/steps,envelope=Math.sin(t*Math.PI)**.72;
      return{x:(t-.5)*w*.94,y:Math.sin(t*Math.PI*2+phase)*h*.1+envelope*(lower?1:-1)*h*(.27+random()*(.08+rough*.16))};
    });
    points=[...jaw(false),...jaw(true).reverse()];
  }
  points=points.map(p=>({x:p.x+(mark.skew??0)/100*p.y,y:p.y+(mark.bend??0)/100*h*(1-(p.x/(w*.5))**2)}));
  const edge=contour(points),paths:DistressPath[]=[
    {d:edge,fill:palette.opening,stroke:palette.shadow,strokeWidth:weight*1.7,role:'opening'},
  ];
  // Broken cotton loops sit at the edge, with occasional long, loose fibres.
  const count=kind==='holes'?Math.max(12,Math.min(28,Math.round(w*1.2))):24;
  for(let i=0;i<Math.round(count*fray);i++) {
    const p=points[Math.floor(random()*points.length)],length=(.025+random()*.045)*Math.min(w,h);
    const a=Math.atan2(p.y/h,p.x/w)+(random()-.5)*.8;
    const dx=Math.cos(a)*length,dy=Math.sin(a)*length;
    paths.push({d:`M${point(p)} q${n(dx*.8+dy*.5)},${n(dy*.65-dx*.3)} ${n(dx)},${n(dy)}`,stroke:i%4?palette.fiber:palette.shadow,strokeWidth:weight*(.5+random()*.8),opacity:.45+random()*.4,role:'fiber'});
  }
  // Frayed jaw highlights are interrupted rather than a uniform light outline.
  for(let i=0;i<points.length-1;i+=3)paths.push({d:`M${point(points[i])} L${point(points[i+1])}`,stroke:palette.edge,strokeWidth:weight*.8,opacity:.65,role:'edge'});
  if(kind==='rips') {
    for(let i=0;i<Math.round(7*fray);i++) {
      const t=.14+random()*.72,x=(t-.5)*w*.9,gap=Math.sin(t*Math.PI)**.72*h*.3;
      const broken=i%3!==0;
      paths.push({d:`M${n(x)},${n(-gap)} q${n(w*.008)},${n(gap*.65)} ${n(w*(random()-.5)*.025)},${n(gap*(broken?.7:2))}`,stroke:palette.fiber,strokeWidth:weight*(.55+random()*.5),opacity:.65,role:'fiber'});
    }
  }
  return paths;
}

/** One editable asset, with stable detail independent of selection or re-renders. */
export function singleDistressMarks(kind:DistressMarkKind,width:number,height:number,seed=6271):DistressMark[] {
  return [{x:width*.5,y:height*.5,width:width*.9,height:height*.8,rotation:0,opacity:1,roughness:.65,seed}];
}

export function renderDistressMarks(context:CanvasRenderingContext2D,marks:DistressMark[],kind:DistressMarkKind,pixelScale=1,palette=DEFAULT_DISTRESS_PALETTE) {
  context.save();context.scale(pixelScale,pixelScale);context.lineCap='round';context.lineJoin='round';
  for(const mark of marks) {
    context.save();context.translate(mark.x/pixelScale,mark.y/pixelScale);context.rotate(mark.rotation);
    for(const primitive of distressPaths({...mark,width:mark.width/pixelScale,height:mark.height/pixelScale},kind,mark.palette??palette)) {
      const path=new Path2D(primitive.d);context.globalAlpha=mark.opacity*(primitive.opacity??1);
      if(primitive.fill){context.fillStyle=primitive.fill;context.fill(path)}
      if(primitive.stroke){context.strokeStyle=primitive.stroke;context.lineWidth=primitive.strokeWidth??1;context.setLineDash(primitive.dash??[]);context.stroke(path)}
    }
    context.restore();
  }
  context.restore();
}
