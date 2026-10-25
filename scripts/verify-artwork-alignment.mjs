import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export * from './src/app/lib/designSnapGuides'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {measureArtworkBoundsInZone,snapDragInZone}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const rect=(left,top,width,height)=>({left,top,width,height});
const zone={offsetWidth:800,offsetHeight:700,getBoundingClientRect:()=>rect(100,100,400,350)};
const visible={getBoundingClientRect:()=>rect(250,200,100,30)};
const layer={getBoundingClientRect:()=>rect(200,175,200,150),querySelector:()=>visible};
const bounds=measureArtworkBoundsInZone(zone,layer);
assert.deepEqual(bounds,{x:400,y:230,width:200,height:60,offsetX:0,offsetY:-70});
// The layout centre is at y=350, but visible text is at y=280.
let snapped=snapDragInZone(400,350+bounds.offsetY,100,30,800,700,'text',[]);
assert.deepEqual(snapped.verticalLines,[400]);
assert.deepEqual(snapped.horizontalLines,[],'Do not show a canvas-centre rail through empty space below text');
// Move the actual letters onto the centre: now show the horizontal rail.
snapped=snapDragInZone(400,420+bounds.offsetY,100,30,800,700,'text',[]);
assert.deepEqual(snapped.horizontalLines,[350]);
assert.equal(snapped.y-bounds.offsetY,420,'Convert snapped visible centre back to the layout anchor');
const aligned=snapDragInZone(204,104,40,20,800,700,'moving',[{id:'other',x:200,y:100,width:80,height:40}]);
assert.deepEqual([aligned.x,aligned.y],[200,100]);
const hiddenByClamp=snapDragInZone(400,345,100,349,800,700,'moving',[],{centerNudgeFractionY:-.01});
assert.deepEqual(hiddenByClamp.horizontalLines,[],'Clamping must not leave a stale snap guide');
console.log('Visible text bounds, zoom, layout offsets, alignment to other artwork, and clamped guides verified.');
