import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
await mkdir('node_modules/.cache/print-checks',{recursive:true});
async function load(name){const path=`node_modules/.cache/print-checks/${name}.mjs`;await build({entryPoints:[`src/app/lib/${name}.ts`],outfile:path,bundle:true,platform:'node',format:'esm',logLevel:'silent'});return import(pathToFileURL(process.cwd()+'/'+path).href);}
const brush=await load('drawingBrush');
const points=[{x:10,y:20,p:.5,tilt:0},{x:60,y:45,p:1,tilt:.2},{x:120,y:25,p:.7,tilt:0}];
for(const preset of brush.BRUSH_PRESETS){const settings={...brush.DEFAULT_BRUSH_SETTINGS,...preset.settings,brushPreset:preset.id,brushSize:preset.size};const a=brush.createBrushStamps(points,settings,1,73);assert(a.samples.length>0,preset.id);assert(a.samples.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),preset.id);assert.deepEqual(a,brush.createBrushStamps(points,settings,1,73));}
const groups=await load('designGroups');
const source=[{id:'a',type:'text',content:'CERIGA',side:'front',x:100,y:100,width:80,height:30,rotation:0},{id:'b',type:'image',content:'original-image',side:'front',x:150,y:170,width:60,height:60,rotation:0}];
const saved=structuredClone(source);const grouped=groups.groupDesignLayers(source,['a','b'],'group');assert.equal(grouped.length,1);const result=groups.ungroupDesignLayer(grouped,'group',()=>crypto.randomUUID());assert.deepEqual(result,source);assert.deepEqual(source,saved);assert(groups.groupLayersIssue([source[0],{...source[1],side:'back'}],['a','b']));
const crop=await load('artworkCrop');const normalized=crop.normalizeCrop({cropTop:90,cropBottom:80,cropLeft:90,cropRight:80});assert(normalized.cropTop+normalized.cropBottom<=99);assert(normalized.cropLeft+normalized.cropRight<=99);
console.log(`${brush.BRUSH_PRESETS.length} brush presets produce deterministic finite strokes; layer grouping preserves editable sources; crops retain visible artwork.`);

const artwork=await load('studioArtwork');
const legacy={...source[0],view:'back'};delete legacy.side;
assert.equal(artwork.resolveStudioArtwork({prints:[legacy]})[0].side,'back');
assert.deepEqual(artwork.resolveStudioArtwork({studioArtwork:[],prints:[legacy]}),[],'Deleted studio artwork must not reappear from legacy prints');
let sequence=0;
const original={...grouped[0],locked:true,children:[...source,{...grouped[0],id:'nested'}]};
const copy=artwork.duplicateStudioArtwork(original,()=>`copy-${++sequence}`);
const ids=element=>[element.id,...(element.children??[]).flatMap(ids)];
assert.equal(new Set(ids(copy)).size,ids(copy).length);
assert(ids(copy).every(id=>!ids(original).includes(id)));
assert.equal(copy.locked,false);assert.equal(copy.x,original.x+20);
copy.children[0].content='EDIT COPY';assert.equal(original.children[0].content,'CERIGA');
assert.equal(artwork.describeStudioArtwork({...source[0],type:'pattern',content:'data:huge-payload'}),'Pattern');
console.log('Artwork migration, intentional deletion, recursive duplication and review descriptions passed.');

const relief=await load('inkFabricRelief');
const ink=new Uint8ClampedArray([0,0,0,80,30,60,90,255,200,200,200,0,50,80,100,125]);
const before=ink.slice();relief.multiplyInkFabricPixels(ink,new Uint8ClampedArray([230,230,230,255,128,128,128,255,250,250,250,255,0,0,0,0]));
assert.deepEqual([ink[3],ink[7],ink[11],ink[15]],[80,255,0,125]);
assert.deepEqual([...ink.slice(0,3)],[0,0,0]);assert.deepEqual([...ink.slice(4,7)],[15,30,45]);assert.deepEqual([...ink.slice(8)], [...before.slice(8)]);
console.log('Fabric relief preserves transparent and antialiased ink edges without adding pale pixels.');

const view=await load('artworkViewBounds');
const front={...source[0],x:100,y:100,width:80,height:40,rotation:0};
const rotated={...source[1],x:200,y:100,width:100,height:20,rotation:90};
const design=[front,rotated,{...front,id:'hidden',hidden:true,x:900},{...front,id:'back',side:'back',x:700}];
assert.deepEqual(view.artworkViewBounds(design,'front'),{x:135,y:100,width:150,height:100});
assert.deepEqual(view.artworkViewBounds(design,'back'),{x:700,y:100,width:80,height:40});
assert.equal(view.artworkViewBounds([], 'front'),null);
console.log('Artwork view fits the entire visible side, including rotated artwork, without selection or opposite-side leakage.');

const completion=await load('drawingCompletion');
const bounds={x:100,y:100,width:80,height:60};assert(!completion.outsideDrawing({x:100,y:100},bounds));assert(completion.outsideDrawing({x:180,y:150},bounds));
assert(completion.isDrawingFinishTap({x:0,y:0,time:0},{x:2,y:1,time:100}));
assert(!completion.isDrawingFinishTap({x:0,y:0,time:0},{x:30,y:1,time:100}));
assert(!completion.isDrawingFinishTap({x:0,y:0,time:0},{x:1,y:1,time:500}));
console.log('Drawing completion distinguishes a brief blank tap from another stroke or a held brush mark.');
