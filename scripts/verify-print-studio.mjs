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
