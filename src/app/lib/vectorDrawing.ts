import {renderBrushStroke} from './drawingBrush';
import {createBrushTextureMask} from './brushTextures';
import {conicPaintMarkup} from './studioPaint';
import type {RecordedDrawing,RecordedStroke} from './drawingReplay';
const esc=(v:unknown)=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const num=(v:number)=>Number(v.toFixed(5));
type Matrix=[number,number,number,number,number,number];
const identity=():Matrix=>[1,0,0,1,0,0];
function multiply(a:Matrix,b:Matrix):Matrix{return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]}
class VectorContext{
 canvas:{width:number;height:number};fillStyle:any='#000';strokeStyle:any='#000';globalAlpha=1;lineWidth=1;lineCap='round';lineJoin='round';matrix=identity();path='';output:string[]=[];defs:string[]=[];stack:any[]=[];
 constructor(width:number,height:number,private prefix:string){this.canvas={width,height}}
 save(){this.stack.push({fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,globalAlpha:this.globalAlpha,lineWidth:this.lineWidth,lineCap:this.lineCap,lineJoin:this.lineJoin,matrix:[...this.matrix]})}
 restore(){Object.assign(this,this.stack.pop())}
 translate(x:number,y:number){this.matrix=multiply(this.matrix,[1,0,0,1,x,y])}
 rotate(a:number){this.matrix=multiply(this.matrix,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0])}
 scale(x:number,y:number){this.matrix=multiply(this.matrix,[x,0,0,y,0,0])}
 beginPath(){this.path=''}
 moveTo(x:number,y:number){this.path+=`M${num(x)},${num(y)}`}
 lineTo(x:number,y:number){this.path+=`L${num(x)},${num(y)}`}
 bezierCurveTo(...v:number[]){this.path+='C'+v.map(num).join(',')}
 quadraticCurveTo(...v:number[]){this.path+='Q'+v.map(num).join(',')}
 closePath(){this.path+='Z'}
 ellipse(x:number,y:number,rx:number,ry:number,a:number,_start:number,_end:number){const c=Math.cos(a),s=Math.sin(a),x0=x+rx*c,y0=y+rx*s,x1=x-rx*c,y1=y-rx*s;this.path+=(this.path?'L':'M')+[x0,y0].map(num).join(',')+`A${num(rx)},${num(ry)},${num(a*180/Math.PI)},1,1,${num(x1)},${num(y1)}A${num(rx)},${num(ry)},${num(a*180/Math.PI)},1,1,${num(x0)},${num(y0)}`}
 paint(stroke=false){const value=stroke?this.strokeStyle:this.fillStyle;if(!this.path||this.globalAlpha<=0)return;const color=typeof value==='string'?value:value.color();this.output.push(`<path d="${this.path}" transform="matrix(${this.matrix.map(num).join(' ')})" opacity="${num(this.globalAlpha)}" ${stroke?`fill="none" stroke="${esc(color)}" stroke-width="${num(this.lineWidth)}" stroke-linecap="${this.lineCap}" stroke-linejoin="${this.lineJoin}"`:`fill="${esc(color)}"`}/>`)}
 fill(){this.paint()}
 stroke(){this.paint(true)}
 fillRect(x:number,y:number,w:number,h:number){const old=this.path;this.path=`M${num(x)},${num(y)}h${num(w)}v${num(h)}h${num(-w)}Z`;this.fill();this.path=old}
 gradient(kind:string,args:number[]){const id=this.prefix+'-g'+this.defs.length,matrix=[...this.matrix],stops:{offset:number;color:string}[]=[];let ready=false;this.defs.push('');const index=this.defs.length-1;return {addColorStop:(offset:number,color:string)=>stops.push({offset,color}),color:()=>{if(!ready){const tags=stops.map(s=>`<stop offset="${s.offset}" stop-color="${esc(s.color)}"/>`).join(''),tf=`gradientTransform="matrix(${matrix.join(' ')})" gradientUnits="userSpaceOnUse"`;this.defs[index]=kind==='linear'?`<linearGradient id="${id}" ${tf} x1="${args[0]}" y1="${args[1]}" x2="${args[2]}" y2="${args[3]}">${tags}</linearGradient>`:kind==='radial'?`<radialGradient id="${id}" ${tf} cx="${args[3]}" cy="${args[4]}" r="${args[5]}">${tags}</radialGradient>`:`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${this.canvas.width}" height="${this.canvas.height}" patternTransform="matrix(${matrix.join(' ')})">${conicPaintMarkup({kind:'conic',angle:args[0]*180/Math.PI+90,x:args[1]/this.canvas.width,y:args[2]/this.canvas.height,stops},this.canvas.width,this.canvas.height)}</pattern>`;ready=true}return 'url(#'+id+')'}}}
 createLinearGradient(...a:number[]){return this.gradient('linear',a)}
 createRadialGradient(...a:number[]){return this.gradient('radial',a)}
 createConicGradient(...a:number[]){return this.gradient('conic',a)}
}
function textureMask(stroke:RecordedStroke,id:string,width:number,height:number){
 const settings=stroke.settings;if(settings.texture==='smooth'&&!settings.grain)return {defs:'',attribute:''};
 const mask=createBrushTextureMask(settings,settings.grain),groups=new Map<number,string>();
 // Equal-alpha runs become geometric rectangles; no embedded texture bitmap.
 for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;){const alpha=mask.data[y*mask.width+x]/255,start=x;while(++x<mask.width&&mask.data[y*mask.width+x]/255===alpha){}if(alpha)groups.set(alpha,(groups.get(alpha)??'')+`M${start},${y}h${x-start}v1h${start-x}Z`)}
 const scale=(settings.textureScale??100)/100,paths=[...groups].map(([a,d])=>`<path d="${d}" fill="black" opacity="${a}"/>`).join('');
 return {defs:`<pattern id="${id}-tile" width="${mask.width*scale}" height="${mask.height*scale}" patternUnits="userSpaceOnUse" patternTransform="rotate(${settings.textureRotation??0})"><g transform="scale(${scale})">${paths}</g></pattern><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" style="mask-type:luminance"><rect width="${width}" height="${height}" fill="white"/><rect width="${width}" height="${height}" fill="url(#${id}-tile)"/></mask>`,attribute:` mask="url(#${id})"`};
}
export function vectorDrawingMarkup(source:RecordedDrawing,prefix:string,color?:string){
 const defs:string[]=[],groups:string[]=[],textures=new Map<string,ReturnType<typeof textureMask>>();
 source.strokes.forEach((stroke,i)=>{const id=prefix+'-s'+i,ctx=new VectorContext(source.width,source.height,id);
 renderBrushStroke(ctx as unknown as CanvasRenderingContext2D,stroke.points,{...stroke.settings,color:color??stroke.settings.color},1,stroke.seed,stroke.paintFrame,false);
 defs.push(...ctx.defs);let ink=ctx.output.join('');if(stroke.mirrorAxis!==undefined)ink+=`<g transform="translate(${stroke.mirrorAxis*2} 0) scale(-1 1)">${ink}</g>`;
 const textureKey=JSON.stringify([stroke.settings.texture,stroke.settings.grain,stroke.settings.textureScale,stroke.settings.textureStrength,stroke.settings.textureDensity,stroke.settings.textureContrast,stroke.settings.textureInvert,stroke.settings.textureRotation]);let texture=textures.get(textureKey);if(!texture){texture=textureMask(stroke,id+'-texture',source.width,source.height);textures.set(textureKey,texture);defs.push(texture.defs);}ink=`<g${texture.attribute}>${ink}</g>`;
 if(stroke.settings.blur>0){const blur=id+'-blur';defs.push(`<filter id="${blur}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${stroke.settings.blur/100*stroke.settings.brushSize*.35}"/></filter>`);ink=`<g filter="url(#${blur})">${ink}</g>`}
 if(stroke.clip){const clip=stroke.clip;defs.push(`<mask id="${id}-clip" maskUnits="userSpaceOnUse" x="0" y="0" width="${source.width}" height="${source.height}" style="mask-type:alpha"><image href="${esc(clip.url)}" x="${clip.x}" y="${clip.y}" width="${clip.width}" height="${clip.height}" preserveAspectRatio="none"/></mask>`);ink=`<g mask="url(#${id}-clip)">${ink}</g>`}
 groups.push(`<g opacity="${stroke.opacity}">${ink}</g>`);
 });
 let content=groups.join('');if(source.erasers?.length){const erase=vectorDrawingMarkup({...source,strokes:source.erasers,erasers:undefined,cuts:undefined},prefix+'-erase','#000');defs.push(`<mask id="${prefix}-erase-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${source.width}" height="${source.height}" style="mask-type:luminance"><rect width="100%" height="100%" fill="white"/>${erase}</mask>`);content=`<g mask="url(#${prefix}-erase-mask)">${content}</g>`}if(source.cuts?.length){defs.push(`<mask id="${prefix}-cuts" maskUnits="userSpaceOnUse" x="0" y="0" width="${source.width}" height="${source.height}"><rect width="100%" height="100%" fill="white"/>${source.cuts.map(ps=>'<path fill="black" d="M'+ps.map(p=>p.x+','+p.y).join('L')+'Z"/>').join('')}</mask>`);content=`<g mask="url(#${prefix}-cuts)">${content}</g>`}
 return `<defs>${defs.join('')}</defs>${content}`;
}
export function supportsVectorDrawing(source:RecordedDrawing){return [...source.strokes,...(source.erasers??[])].every(s=>s.settings.texture!=='custom')}
