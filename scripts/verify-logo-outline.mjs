import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
const output='node_modules/.cache/logo-outline-tests.mjs';
await build({stdin:{contents:"import './src/app/lib/logoOutline.worker';export {traceLogoImage} from './src/app/lib/logoOutline.worker';export * from './src/app/lib/logoOutline';export * from './src/app/lib/artworkImagePlacement';export * from './src/app/lib/logoRegionEditing';export * from './src/app/lib/editableLogoLayers';export * from './src/app/lib/artworkClipping';export {productionArtworkSvg} from './src/app/lib/productionArtwork';export {shapeWorldPath,mapShapePath} from './src/app/lib/artworkPathOperations';export {shapeIsClosed,shapeContourHasArea} from './src/app/lib/shapeGeometry';export {pathSegmentPoint} from './src/app/lib/shapePathEditing';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:output,logLevel:'silent',plugins:[{name:'font-assets',setup(build){build.onLoad({filter:/\.(ttf|otf|woff2?)$/},args=>({contents:'export default '+JSON.stringify(args.path),loader:'js'}));}}]});
let reply;globalThis.self={postMessage:value=>reply=value};
const api=await import(pathToFileURL(process.cwd()+'/'+output));
const w=200,h=200,pixels=new Uint8ClampedArray(w*h*4);
for(let y=10;y<190;y++)for(let x=10;x<190;x++){if(x>=60&&x<140&&y>=60&&y<140&&!(x>=85&&x<115&&y>=85&&y<115))continue;const gold=y>=20&&y<35&&(x>=20&&x<80||x>=130&&x<175);pixels.set(gold?[255,196,96,255]:[17,17,17,255],(y*w+x)*4);}
const settings={...api.LOGO_OUTLINE_DEFAULTS,layout:'cutout',supersample:1,specksMm2:0}; // Native-resolution worker fixture; browser coverage tests supersampling.
self.onmessage({data:{pixels:pixels.buffer,width:w,height:h,sourceWidth:w,sourceHeight:h,settings,placedWidthMm:100,preview:false}});
assert.equal(reply.error,undefined);const result=reply.result;
assert.equal(result.palette.length,2);assert.equal(result.regions.filter(r=>r.colour===result.palette[1]).length,2,'Disconnected pieces of one colour must move independently.');
function contains(path,p){let inside=false;for(const part of [path,...(path.subpaths??[])]){const points=[];for(let i=0;i<part.nodes.length;i++)for(let step=0;step<12;step++)points.push(api.pathSegmentPoint(part.nodes[i],part.nodes[(i+1)%part.nodes.length],step/12));for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}}return inside;}
const silhouette=result.silhouette??result.regions[0].path;assert.equal(contains(silhouette,{x:35,y:35}),false);assert.equal(contains(silhouette,{x:50,y:50}),true);assert.equal(contains(silhouette,{x:10,y:50}),true);assert.equal(contains(silhouette,{x:99,y:99}),false);assert.equal(silhouette.nodes.length,4,'A rectangle must retain all four sharp corners.');
const source={id:'logo',type:'image',content:'fixture',x:300,y:300,width:300,height:300,rotation:0},state={source:'fixture',sourceWidth:w,sourceHeight:h,settings,result,rightsAcceptedAt:'2026-10-29T00:00:00Z',completedAt:'2026-10-29T00:00:01Z'},root=api.logoTraceElement(source,state,30);
const recoloured={...root,...api.recolourLogo(root,result.palette[1],'#ff0000')};assert(recoloured.children.filter(r=>r.logoTraceRegion.colourKey===result.palette[1]).every(r=>r.children[0].shapeFillColor==='#ff0000'));
const outlined=api.logoTraceElement(source,{...state,settings:{...settings,output:'outline',outline:'whole'}},30,root);assert.deepEqual(outlined.children.filter(r=>!r.hidden).map(r=>r.logoTraceRegion.key),result.regions.filter(region=>region.silhouette).map(region=>region.key));assert.equal(outlined.children[0].children[0].shapeFilled,false);
const detached={...root,children:root.children.map((r,i)=>i===1?{...r,x:r.x+20,logoTraceRegion:{...r.logoTraceRegion,detached:true}}:r)},updated=api.logoTraceElement(source,state,30,detached);assert.deepEqual(updated.children[1],detached.children[1]);assert(!api.expandLogoTrace(root).logoTrace);
globalThis.Image=class{naturalWidth=512;naturalHeight=756;decode(){return Promise.resolve()}};
const placement=await api.artworkImagePlacement('fixture',{width:600,height:600},true);assert.equal(placement.height,450);assert(Math.abs(placement.width/placement.height-512/756)<1e-10);
console.log('Logo outline passed: nested holes and islands, sharp corners, separate colour pieces, shared swatches, output modes, selective detachment and image proportions.');

const piece=root.children.find(child=>child.logoTraceRegion.colourKey===result.palette[1]),normal=api.normalizeLogoRegion(piece),before=api.shapeWorldPath(piece.children[0]),after=api.mapShapePath(api.shapeWorldPath(normal.children[0]),p=>({x:normal.x-normal.width/2+p.x,y:normal.y-normal.height/2+p.y}));assert(normal.width<piece.width/2);for(let i=0;i<before.nodes.length;i++){assert(Math.abs(before.nodes[i].x-after.nodes[i].x)<1e-6);assert(Math.abs(before.nodes[i].y-after.nodes[i].y)<1e-6);}
const resized=api.patchLogoRegion(normal,{width:normal.width*2,opacity:45,aspectLocked:false,shapeFillColor:'#00ff00'}),proxy=api.logoRegionShape(resized);assert.equal(proxy.width,normal.width*2);assert.equal(proxy.opacity,45);assert.equal(proxy.aspectLocked,false);assert.equal(proxy.shapeFillColor,'#00ff00');assert(resized.logoTraceRegion.detached);
const paint={id:'paint',type:'shape',content:'rect',x:300,y:300,width:300,height:300,rotation:0,clipToArtworkId:root.id},paths=api.artworkClipPaths(paint,[root,paint]),moved=api.artworkClipPaths(paint,[{...root,x:root.x+15},paint]);assert(paths.length>0);assert(Math.abs(moved[0].nodes[0].x-paths[0].nodes[0].x-15)<1e-6);assert(api.artworkClipStyle(paint,[root,paint]).maskImage.includes('data:image/svg+xml'));
console.log('Connected tools passed: tight piece bounds preserve artwork, resize/opacity/ratio round-trip, pattern-ready native properties and live graphic clipping.');

const svg=await api.productionArtworkSvg([root,{...paint,shapeFilled:true,shapeFillColor:'#111111',shapeGeometry:'bounds'}],600,600);assert(svg.includes('-artwork-clip'));assert(svg.includes('clip-rule="evenodd"'));assert(!svg.includes('<image'));
console.log('Clipping production passed: editable paint prepares with native vector clip paths and preserved fill rules.');

const visibleParts=api.editableLogoParts(root),region=visibleParts.find(part=>part.regionKey!=='silhouette'),linked={...paint,clipToArtworkId:root.id,clipToRegionKey:region.regionKey};assert(!api.wasLogoLayerSplit(root));const layers=api.splitEditableLogoLayers([root,linked]);assert.equal(layers.filter(element=>element.id!=='paint').length,root.children.filter(child=>!child.hidden).length);assert(layers.filter(element=>element.id!=='paint').every(element=>element.type==='shape'&&!element.logoTrace&&!element.children));assert.equal(layers.find(element=>element.id==='paint').clipToArtworkId,region.element.id);assert.equal(layers.find(element=>element.id==='paint').clipToRegionKey,undefined);assert(api.wasLogoLayerSplit(root));const again=api.splitEditableLogoLayers(layers);assert.deepEqual(again,layers);assert(root.logoTrace,'Splitting must not mutate the original group needed by undo.');
console.log('Real shape layers passed: independent native paths, stable IDs, clipping references, repeat safety, source immutability and undo revision tracking.');

const wholeClip=api.splitEditableLogoLayers([root,paint]),combined=wholeClip.find(element=>element.id==='paint');assert(combined.clipToArtworkIds.length>1,'A cut-out logo mask must retain every colour region after splitting.');assert.equal(api.artworkClipPaths(combined,wholeClip).length,visibleParts.length);const direct={...root,children:root.children.filter(child=>!child.hidden).map(child=>api.logoRegionShape(child))};assert.equal(api.editableLogoParts(direct).length,visibleParts.length);const mixed={...root,children:[{id:'image-child',type:'image',content:'fixture',x:50,y:50,width:100,height:100,rotation:0}]};assert(!api.isEditableLogoGroup(mixed));assert.deepEqual(api.splitEditableLogoLayers([mixed]),[mixed]);
console.log('Saved trace compatibility passed: direct shape children, mixed-content protection and complete cut-out clipping masks.');

const glyphs={R:['11110','10001','10001','11110','10100','10010','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],Y:['10001','10001','01010','00100','00100','00100','00100']};
function linkedLogo(opaque){const width=420,height=100,data=new Uint8ClampedArray(width*height*4),colour=[72,108,166,255];if(opaque)for(let i=0;i<data.length;i+=4)data.set([255,255,255,255],i);const put=(x,y,c)=>{if(x>=0&&x<width&&y>=0&&y<height)data.set(c,(y*width+x)*4)};for(let y=0;y<height;y++)for(let x=0;x<width;x++){const circle=Array.from({length:6},(_,i)=>Math.hypot(x-(35+i*70),y-50)).some(d=>d<=33),bridge=x>=35&&x<=385&&y>=40&&y<=60;if(circle||bridge)put(x,y,colour);}for(let i=0;i<6;i++)for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(Math.hypot(x-(35+i*70),y-50)<=24)put(x,y,[255,255,255,255]);for(const [index,letter] of Array.from('RBERRY').entries())for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(glyphs[letter][row][col]==='1')for(let dy=-1;dy<=4;dy++)for(let dx=-1;dx<=4;dx++)put(35+index*70-10+col*4+dx,50-14+row*4+dy,colour);return{data,width,height};}
function softenEdges(fixture){const original=fixture.data,data=new Uint8ClampedArray(original.length),{width,height}=fixture;for(let y=0;y<height;y++)for(let x=0;x<width;x++){let weight=0,alpha=0,red=0,green=0,blue=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=Math.max(0,Math.min(width-1,x+dx)),yy=Math.max(0,Math.min(height-1,y+dy)),i=(yy*width+xx)*4,w=(dx===0?2:1)*(dy===0?2:1),a=original[i+3]/255;weight+=w;alpha+=a*w;red+=original[i]*a*w;green+=original[i+1]*a*w;blue+=original[i+2]*a*w;}const i=(y*width+x)*4;if(alpha)data.set([red/alpha,green/alpha,blue/alpha,alpha/weight*255],i);}return{...fixture,data};}
for(const opaque of [false,true])for(const soften of[false,true])for(const autoColours of[false,true]){const fixture=soften?softenEdges(linkedLogo(opaque)):linkedLogo(opaque),settings={...api.LOGO_OUTLINE_DEFAULTS,supersample:1,specksMm2:0,autoColours,colours:2},traced=api.traceLogoImage({pixels:fixture.data.buffer,width:fixture.width,height:fixture.height,sourceWidth:fixture.width,sourceHeight:fixture.height,settings,placedWidthMm:100,preview:false}),bases=traced.regions.filter(region=>region.silhouette),outlined=api.logoTraceElement({...source,width:420,height:100},{...state,settings,result:traced},30);assert.equal(traced.palette.length,1,'Antialias/background must not become an extra ink.');assert.equal(bases.length,7,'Connected rim plus six letters must produce seven positive shapes.');assert.equal(bases[0].path.subpaths.length,6,'The six circle centres are holes in one connected rim.');assert.equal(api.editableLogoParts(outlined).length,7);assert(bases.slice(1).some(region=>(region.path.subpaths?.length??0)===2),'Letter counters remain holes in the B.');}
console.log('Seven-shape logo passed: one connected rim, six independent letters, counters retained as holes, transparent and opaque white backgrounds, antialiased edges and automatic/manual palettes.');

// A connected colour can contain collapsed antialias specks at narrow joins.
// They must not suppress its entire fill, including traces saved before this fix.
const closedSquare={closed:true,nodes:[{x:10,y:10},{x:90,y:10},{x:90,y:90},{x:10,y:90}]};
const collapsed={closed:true,nodes:[{x:50,y:50},{x:51,y:50}]};
const compound={type:'shape',content:'custom-path',shapePath:{...closedSquare,subpaths:[collapsed]}};
assert(api.shapeIsClosed(compound),'A collapsed closed contour must not remove a valid compound fill.');
assert(!api.shapeContourHasArea(collapsed));
assert(!api.shapeIsClosed({...compound,shapePath:collapsed}),'A collapsed path alone has no fill.');
assert(!api.shapeIsClosed({...compound,shapePath:{...closedSquare,subpaths:[{...collapsed,closed:false}]}}),'A genuine open contour remains open.');
const lens={closed:true,nodes:[{x:20,y:50,out:{x:20,y:20},in:{x:20,y:80}},{x:80,y:50,in:{x:80,y:20},out:{x:80,y:80}}]};
assert(api.shapeContourHasArea(lens),'Two-anchor curved shapes remain valid.');
console.log('Compound fill passed: collapsed closed specks preserve the main fill, genuine open paths stay open and two-anchor curved shapes remain fillable.');

// Joined rays remain one colour region despite narrow gaps and one-pixel edge specks.
const fw=240,fh=220,fanPixels=new Uint8ClampedArray(fw*fh*4);
for(let y=0;y<fh;y++)for(let x=0;x<fw;x++){
 const outer=x>=10&&x<=230&&y>=10&&y<=210;
 if(!outer)continue;
 let yellow=x>=30&&x<=210&&y>=35&&y<=190;
 if(y<130&&[-.6,-.4,-.2,.2,.4,.6].some(slope=>Math.abs(x-(120+slope*(160-y)))<1.5&&y>=35))yellow=false;
 if(x===120&&y===180)yellow=false;
 fanPixels.set(yellow?[255,205,0,255]:[218,41,28,255],(y*fw+x)*4);
}
const fanSettings={...api.LOGO_OUTLINE_DEFAULTS,supersample:1},fanResult=api.traceLogoImage({pixels:fanPixels.buffer,width:fw,height:fh,sourceWidth:fw,sourceHeight:fh,settings:fanSettings,placedWidthMm:100,preview:false});
const fanRoot=api.logoTraceElement({...source,width:fw,height:fh},{...state,settings:fanSettings,result:fanResult},30),fanParts=api.editableLogoParts(fanRoot);
assert.equal(fanParts.length,2,'Connected two-colour artwork must expose two independent visible shapes.');
assert(fanParts.every(({element})=>api.shapeIsClosed(element)),'Both traced colour shapes must keep their fills.');
assert.equal(fanResult.regions.filter(region=>region.colour===fanResult.palette[1]).length,1,'Joined rays belong to one yellow shape.');
const fanSvg=await api.productionArtworkSvg([fanRoot],fw,fh);
assert(fanSvg.includes('#da291c')&&fanSvg.includes('#ffcd00'),'Both inks survive production rendering.');
console.log('Joined-colour logo passed: one connected yellow region, independent red shape, visible fills and both inks in native output.');
