import {createContext,useContext} from 'react';
/** Shared technical-flat palette. Never compensate for CSS/screen zoom. */
/** All weights are in the shared 2048-unit garment viewBox and scale with garment zoom. */
export const TECH_OUTLINE_WIDTH=4.8;
export const TECH_CONSTRUCTION_WIDTH=3.6;
export const TECH_TRACE_INK_BOLDNESS=TECH_OUTLINE_WIDTH-3.2;
export const TECH_STITCH_WIDTH=2.4;
export const TECH_TEXTURE_WIDTH=1;
export const TECH_CURVE_TOLERANCE=3.2;
export const RegularConstructionContext=createContext(false);
export const useRegularConstruction=()=>useContext(RegularConstructionContext);
export const TECH_STITCH_DASH=9;
export const TECH_STITCH_GAP=9;
export const TechnicalDrawingContext=createContext<boolean|null>(null);
export const useTechnicalDrawing=()=>useContext(TechnicalDrawingContext);
export type TechnicalRole='outline'|'construction'|'stitch'|'texture';
export const TECH_WIDTHS={outline:TECH_OUTLINE_WIDTH,construction:TECH_CONSTRUCTION_WIDTH,stitch:TECH_STITCH_WIDTH,texture:TECH_TEXTURE_WIDTH};
export function technicalLocalWidth(role:TechnicalRole, garmentUnitsPerLocalUnit=1){return TECH_WIDTHS[role]/Math.max(1e-8,garmentUnitsPerLocalUnit);}

/** Read SVG transforms without consolidate(), which rewrites the source attribute. */
function sourceTransform(value:string){
 let matrix=new DOMMatrix();
 for(const match of value.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)){
  const v=(match[2].match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)??[]).map(Number);
  let next=new DOMMatrix();
  if(match[1]==='matrix'&&v.length===6)next=new DOMMatrix(v);
  else if(match[1]==='translate')next=next.translate(v[0]??0,v[1]??0);
  else if(match[1]==='scale')next=next.scale(v[0]??1,v[1]??v[0]??1);
  else if(match[1]==='rotate')next=next.translate(v[1]??0,v[2]??0).rotate(v[0]??0).translate(-(v[1]??0),-(v[2]??0));
  else if(match[1]==='skewX')next=next.skewX(v[0]??0);
  else if(match[1]==='skewY')next=next.skewY(v[0]??0);
  matrix=matrix.multiply(next);
 }
 return matrix;
}

/** Stroke-only normalization: never edit path data, viewBoxes or placement transforms.
 * filledInk adds only the 1.6-unit boldness increment to original traced ink. */
export function normalizeTechnicalSvg(raw:string, garmentUnitsPerRootUnit=1, defaultRole:TechnicalRole='outline',filledInk=false):string{
  const doc=new DOMParser().parseFromString(raw,'image/svg+xml'),root=doc.documentElement;
  for(const el of root.querySelectorAll('path,line,polyline,polygon,rect,circle,ellipse')){
    if(el.closest('defs,clipPath,mask'))continue;
    const inherited=(name:string)=>{for(let node:Element|null=el;node;node=node.parentElement){const value=(node as SVGElement).style?.getPropertyValue(name)||node.getAttribute(name);if(value&&value!=='inherit')return value;}return null;};
    let stroke=inherited('stroke');
    const fill=inherited('fill');
    const filled=filledInk&&(!stroke||stroke==='none')&&fill&&fill!=='none'&&fill!=='transparent';
    if(filled){stroke=fill;el.setAttribute('stroke',fill);}
    if(!stroke||stroke==='none'||stroke==='transparent')continue;
    let matrix=new DOMMatrix();const chain:Element[]=[];let parent:Element|null=el;
    while(parent&&parent!==root){chain.unshift(parent);parent=parent.parentElement;}
    for(const node of chain)matrix=matrix.multiply(sourceTransform(node.getAttribute('transform')??''));
    const localScale=Math.sqrt(Math.abs(matrix.a*matrix.d-matrix.b*matrix.c))||1;
    const dash=inherited('stroke-dasharray');
    const hardware=el.closest('[data-zip-slider],[data-zip-pull],[data-zip-stops]')
      ||(el.tagName.toLowerCase()==='path'&&el.closest('[data-zip-track]'));
    const role:TechnicalRole=el.closest('[data-zip-teeth],[data-texture],[data-rear-ribs]')?'texture'
      :dash&&dash!=='none'?'stitch':hardware?'construction':defaultRole;
    const units=garmentUnitsPerRootUnit*localScale;
    el.setAttribute('stroke-width',String(filled?(root.getAttribute('data-tech-ink-boldness')==='0'?0:TECH_TRACE_INK_BOLDNESS)/units:technicalLocalWidth(role,units)*(role==='stitch'?Number(inherited('data-stitch-weight')??1):1)));
    if(role==='stitch'&&dash&&dash!=='none')el.setAttribute('stroke-dasharray',`${TECH_STITCH_DASH/units} ${TECH_STITCH_GAP/units}`);
    else if(dash==='none')el.setAttribute('stroke-dasharray','none');
    for(const name of ['stroke-width','stroke-dasharray','stroke-opacity','stroke-linecap','stroke-linejoin','vector-effect'])(el as SVGElement).style?.removeProperty(name);
    el.removeAttribute('vector-effect');el.setAttribute('stroke-linejoin','round');el.setAttribute('stroke-linecap','round');
    el.setAttribute('stroke-opacity',role==='stitch'?'.85':role==='texture'?'.35':'1');el.setAttribute('data-tech-role',role);
  }
  root.setAttribute('shape-rendering','geometricPrecision');root.setAttribute('data-technical-drawing','normalized');
  return new XMLSerializer().serializeToString(root);
}
