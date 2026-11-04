import {createGarmentLabel,type GarmentLabel} from '../data/garmentLabels';
import type {ShapePath} from './shapeGeometry';
import type {LogoTraceResult} from './logoOutlineTypes';
import {mapShapePath} from './artworkPathOperations';
import {readLabelSurface,saveLabelSurface} from './surfaceMigration';
/** Reference coordinates become the cut outline; artwork stays native vector shapes. */
export function normaliseLabelOutline(path:ShapePath){
 const points: {x:number;y:number}[]=[];const visit=(p:ShapePath)=>{points.push(...p.nodes);p.subpaths?.forEach(visit)};visit(path);
 const left=Math.min(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),width=Math.max(...points.map(p=>p.x))-left,height=Math.max(...points.map(p=>p.y))-top;
 if(!path.closed||points.length<3||width<.001||height<.001)throw new Error('Choose a closed shape with a visible width and height.');
 return {path:mapShapePath(path,p=>({x:(p.x-left)/width*100,y:(p.y-top)/height*100})),left,top,width,height};
}
/** Minimum-area cut bounds remove camera tilt in real image coordinates, not stretched percentages. */
export function straightenLabelOutline(path:ShapePath,width=100,height=100){
 const physical=mapShapePath(path,p=>({x:p.x*width/100,y:p.y*height/100})),points=physical.nodes.map(p=>({x:p.x,y:p.y})).sort((a,b)=>a.x-b.x||a.y-b.y),cross=(a:typeof points[number],b:typeof a,c:typeof a)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 const lower:typeof points=[],upper:typeof points=[];for(const p of points){while(lower.length>1&&cross(lower.at(-2)!,lower.at(-1)!,p)<=0)lower.pop();lower.push(p)}for(const p of [...points].reverse()){while(upper.length>1&&cross(upper.at(-2)!,upper.at(-1)!,p)<=0)upper.pop();upper.push(p)}
 const hull=[...lower.slice(0,-1),...upper.slice(0,-1)];let best={area:Infinity,angle:0};
 for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length];let angle=Math.atan2(b.y-a.y,b.x-a.x);while(angle>Math.PI/4)angle-=Math.PI/2;while(angle<=-Math.PI/4)angle+=Math.PI/2;const c=Math.cos(angle),sn=Math.sin(angle),xs=hull.map(p=>p.x*c+p.y*sn),ys=hull.map(p=>-p.x*sn+p.y*c),area=(Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys));if(area<best.area-1e-7||Math.abs(area-best.area)<1e-7&&Math.abs(angle)<Math.abs(best.angle))best={area,angle};}
 const c=Math.cos(best.angle),sn=Math.sin(best.angle);return {...normaliseLabelOutline(mapShapePath(physical,p=>({x:p.x*c+p.y*sn,y:-p.x*sn+p.y*c}))),angle:best.angle*180/Math.PI};
}
/** References supply a physical cut and base colour. Their lettering and graphics are never imported. */
export function labelFromReference(label:GarmentLabel,result:LogoTraceResult,options:{border?:boolean;colour?:string;borderColour?:string}={}){
 const subject=result.regions.filter(r=>r.silhouette).sort((a,b)=>b.area-a.area)[0];
 if(!subject)throw new Error('No clear outline found. Crop around one object on a plain background.');
 const sourceBox=normaliseLabelOutline({...subject.path,subpaths:undefined}),straight=straightenLabelOutline({...subject.path,subpaths:undefined},result.sourceWidth??result.width??100,result.sourceHeight??result.height??100),colours=new Map<string,number>();
 for(const r of result.regions.filter(r=>!r.silhouette&&r.path.nodes.some(p=>p.x>=sourceBox.left&&p.x<=sourceBox.left+sourceBox.width&&p.y>=sourceBox.top&&p.y<=sourceBox.top+sourceBox.height)))colours.set(r.colour,(colours.get(r.colour)??0)+r.area);
 const palette=[...colours].sort((a,b)=>b[1]-a[1]).map(([colour])=>colour),key=['tag','hand'].includes(label.category)?label.artworkFace??label.exteriorView??'front':'label',saved=label.artworkSurfaces?.[key],isOldReference=(e:{type:string;layerName?:string})=>e.type==='shape'&&/^Reference (colour|shape) \d+$/.test(e.layerName??''),removed=saved?.document.elements.some(isOldReference);
 let next:GarmentLabel={...label,customOutline:straight.path,fold:'die',background:options.colour??palette[0]??label.background,borderEnabled:options.border??label.borderEnabled,...(options.border?{borderVersion:2,borderStyle:'solid',border:options.borderColour??label.border}:{}),colourReferences:undefined};
 if(saved&&removed){const ids=new Set(saved.document.elements.filter(isOldReference).map(e=>e.id));next.artworkSurfaces={...next.artworkSurfaces,[key]:{...saved,document:{...saved.document,elements:saved.document.elements.filter(e=>!ids.has(e.id)),frames:saved.document.frames.map(f=>({...f,artworks:f.artworks.filter(id=>!ids.has(id))}))}}};if(!saved.document.elements.some(e=>e.type==='text'&&!e.hidden)&&label.blocks?.every(b=>!b.enabled)){const enabled=new Set(createGarmentLabel(label.category).blocks?.filter(b=>b.enabled).map(b=>b.key));next.blocks=label.blocks.map(b=>({...b,enabled:enabled.has(b.key)}));}}
 return saveLabelSurface(next,readLabelSurface(next));
}
