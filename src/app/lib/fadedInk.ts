import type { TextEffect } from './textEffects';
const masks=new Map<string,string>();
/** Reusable, resolution-independent worn-ink mask; never replaces the source lettering. */
export function fadedInkMask(effect:TextEffect):string {
  const key=JSON.stringify([effect.seed,effect.intensity,effect.settings]);const cached=masks.get(key);if(cached)return cached;
  let state=(effect.seed||1)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const amount=Math.max(0,Math.min(1,Number(effect.settings.amount??55)/100))*effect.intensity/100;
  const variation=Math.max(0,Math.min(1,Number(effect.settings.variation??65)/100));
  const opacity=Math.max(0,Math.min(1,Number(effect.settings.opacity??100)/100));
  const marks:string[]=[];
  for(let i=0;i<32;i++)marks.push(`<ellipse cx="${random()*400}" cy="${random()*240}" rx="${14+random()*50}" ry="${5+random()*23}" fill="url(#cloud)" opacity="${amount*variation*(.25+random()*.65)}"/>`);
  for(let i=0;i<950;i++){
    const x=random()*400,y=random()*240,r=.15+random()*.8;
    marks.push(`<path d="M${x},${y}l${r*1.7},${-.2*r}l${r*.4},${r*.8}l${-r*2},${r*.5}Z" fill="black" opacity="${amount*variation*(.3+random()*.7)}"/>`);
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" preserveAspectRatio="none"><defs><radialGradient id="cloud"><stop stop-color="black"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient><mask id="wear" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="240" style="mask-type:luminance"><rect width="400" height="240" fill="white" opacity="${opacity*(1-amount*.44)}"/>${marks.join('')}</mask></defs><rect width="400" height="240" fill="white" mask="url(#wear)"/></svg>`;
  const url=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;if(masks.size>32)masks.delete(masks.keys().next().value!);masks.set(key,url);return url;
}
