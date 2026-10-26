import { contours } from 'd3-contour';
import type { PatternPrimitive } from './generatedPatterns';

const TAU = Math.PI * 2;
const geometryCache=new Map<string,PatternPrimitive[]>();
function randomSource(seed: number) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let word = Math.imul(state ^ state >>> 15, state | 1); word ^= word + Math.imul(word ^ word >>> 7, word | 61); return ((word ^ word >>> 14) >>> 0) / 4294967296; };
}

/** Periodic gradient noise: neighbouring cells share gradients and tile-edge derivatives. */
function periodicNoise(seed:number,columns:number,rows:number){
 const random=randomSource(seed),gradients=Array.from({length:columns*rows},()=>{const angle=random()*TAU;return [Math.cos(angle),Math.sin(angle)];});
 const fade=(t:number)=>t*t*t*(t*(t*6-15)+10),mix=(a:number,b:number,t:number)=>a+(b-a)*t;
 const at=(x:number,y:number)=>gradients[((y%rows+rows)%rows)*columns+(x%columns+columns)%columns];
 return (u:number,v:number)=>{
  const x=u*columns,y=v*rows,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const a=at(ix,iy),b=at(ix+1,iy),c=at(ix,iy+1),d=at(ix+1,iy+1);
  return mix(mix(a[0]*fx+a[1]*fy,b[0]*(fx-1)+b[1]*fy,fade(fx)),mix(c[0]*fx+c[1]*(fy-1),d[0]*(fx-1)+d[1]*(fy-1),fade(fx)),fade(fy))*1.45;
 };
}

/** Multiscale cloud fields produce joined lobes instead of a grid of round stamps. */
export function camouflageField(seed: number, frequency: number, stretch = 1, detail = .35, distortion = 1) {
 const make=(offset:number,rate:number)=>periodicNoise(seed+offset,Math.max(2,Math.round(rate/stretch)),Math.max(2,Math.round(rate*stretch)));
 const base=Math.max(2,Math.floor(frequency)),fraction=Math.max(0,frequency-base);
 const first=make(11,base),second=make(77,base+1),fine=make(131,base*2),grain=make(241,base*4);
 const warpX=periodicNoise(seed+317,2,3),warpY=periodicNoise(seed+991,3,2);
 return (u:number,v:number)=>{
  const x=u+warpX(u,v)*.24*distortion,y=v+warpY(u,v)*.24*distortion;
  return (first(x,y)*(1-fraction)+second(x,y)*fraction+fine(x,y)*(.18+detail*.35)+grain(x,y)*detail*.16)/(1.18+detail*.51);
 };
}

/** Original contour-based textile art, not a tracing of any proprietary camouflage. */
export function textileCamouflage(kind:string, options:Record<string,number|string>, colors:number, count:number, seed:number, tileSize:number):PatternPrimitive[] {
  const key=JSON.stringify([kind,options,colors,count,seed,tileSize]);
  const cached=geometryCache.get(key);if(cached){geometryCache.delete(key);geometryCache.set(key,cached);return cached;}
  const option=(key:string,fallback:number)=>Number.isFinite(Number(options[key]))?Number(options[key]):fallback;
  const tiger = kind==='camo-tiger';
  const desert = kind==='camo-desert';
  const angular = kind==='digital-camo'||kind==='camo-urban'&&options.style==='angular';
  const shapeSize=option('shapeSize',100)/100;
  const density=Math.max(1.2,Math.min(8,Math.sqrt(count)*1.15/shapeSize))*2;
  const complexity=kind==='camo-urban'?1-option('sharpness',50)/150:option('irregularity',option('complexity',55))/100;
  const overlap=option('overlap',40)/100;
  const grid=kind==='digital-camo'?96:angular?120:224;
  const side=grid+2;
  const primitives:PatternPrimitive[]=[];
  for(let color=1;color<colors;color++) {
    const smallAccent=desert&&color>=3;
    const frequency=density*(smallAccent?2.8:color===3?1.35:1);
    const field=camouflageField(seed+color*7919,frequency,tiger?2.8:desert?1.15:color===3?1.65:kind==='camo-abstract'?1+option('stretch',40)/50:1,complexity,kind==='camo-abstract'?.35+option('distortion',30)/50+option('curvature',50)/100:1);
    const modulation=camouflageField(seed+color*137,tiger?Math.max(.5,1.3*120/option('stripeLength',120)):1.3,1,.2);
    const phase=randomSource(seed+color*419)()*TAU;
    const direction=option('direction',0)*Math.PI/180;
    const bands=Math.max(2,Math.round(count*.75));
    const fx=Math.round(Math.sin(direction)*bands),fy=Math.round(Math.cos(direction)*bands)||1;
    const values=new Float64Array(side*side);
    for(let row=0;row<side;row++)for(let column=0;column<side;column++) {
      const u=(column-.5)/grid,v=(row-.5)/grid;
      const value=tiger
        ? Math.sin(TAU*(fx*u+fy*v)+phase+field(u,v)*option('curvature',40)/100*5)*.24 + field(u,v)*.72 + modulation(u,v)*.14
        : field(u,v);
      values[row*side+column]=value;
    }
    // Broad middle tones, smaller dark branches, and sparse light/desert accents.
    let threshold=(color===3?.12:color>=4?.26:.015)+(0.4-overlap)*.17;
    if(kind==='cow')threshold=.035;
    if(smallAccent)threshold=.28+(1-option('accents',40)/100)*.12;
    if(tiger)threshold=(color===colors-1?.16:.01)+(1-option('stripeWidth',100)/100)*.1;
    const result=contours().size([side,side]).smooth(!angular).thresholds([threshold])(values)[0];
    if(!result)continue;
    const d=result.coordinates.map(polygon=>polygon.map(ring=>ring.map(([x,y],index)=>`${index?'L':'M'}${((x-1)*tileSize/grid).toFixed(3)} ${((y-1)*tileSize/grid).toFixed(3)}`).join('')+'Z').join('')).join('');
    if(d)primitives.push({tag:'path',d,fill:color});
  }
  geometryCache.set(key,primitives);if(geometryCache.size>48)geometryCache.delete(geometryCache.keys().next().value!);
  return primitives;
}
