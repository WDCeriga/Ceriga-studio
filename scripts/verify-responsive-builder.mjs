import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const outfile=resolve('node_modules/.cache/responsive-snap-check.mjs');
await build({entryPoints:['src/app/components/builder/shell/responsiveBuilder.tsx'],outfile,bundle:true,format:'esm',platform:'node',external:['react','lucide-react'],jsx:'automatic'});
const {sheetSnapHeight,nearestSheetSnap}=await import(pathToFileURL(outfile));
let checks=0;
for(const height of [640,667,812,844,932]){
 const peek=sheetSnapHeight('peek',height),half=sheetSnapHeight('half',height),full=sheetSnapHeight('full',height);
 assert.equal(peek,104);checks++;
 assert.ok(half>peek&&full>half&&full<height-58);checks++;
 for(const snap of ['peek','half','full']){assert.equal(nearestSheetSnap(sheetSnapHeight(snap,height),height,true),snap);checks++}
 assert.notEqual(nearestSheetSnap(104,height,false),'peek');checks++;
}
assert.equal(nearestSheetSnap(338,844,true),'half');checks++;
assert.equal(nearestSheetSnap(630,844,true),'full');checks++;
assert.equal(nearestSheetSnap(106,844,true),'peek');checks++;
// Persistent editors must leave the garment visible at every snap, including a
// landscape phone and the smaller viewport reported while the keyboard is open.
for(const height of [240,320,390,430,500,640,667,812,844,932,1024,1180]){
 const usable=height-114;
 for(const snap of ['peek','half','full']){
  const reserved=sheetSnapHeight(snap,height,true);
  assert.ok(reserved>=0&&reserved<=usable*.55+1, `${height}px ${snap} preserves at least 45% of canvas`);checks++;
  assert.equal(nearestSheetSnap(reserved,height,true),snap);checks++;
 }
 assert.ok(sheetSnapHeight('peek',height,true)<sheetSnapHeight('half',height,true));checks++;
 assert.ok(sheetSnapHeight('half',height,true)<sheetSnapHeight('full',height,true));checks++;
}
assert.ok(sheetSnapHeight('full',844,true)<sheetSnapHeight('full',844,false));checks++;
const gestureFile=resolve('node_modules/.cache/responsive-touch-check.mjs');
await build({entryPoints:['src/app/components/builder/shell/useCanvasTouchNavigation.ts'],outfile:gestureFile,bundle:true,format:'esm',platform:'node',external:['react']});
const {resolveCanvasTouchTransform}=await import(pathToFileURL(gestureFile));
const gesture={count:2,x:40,y:30,distance:100,zoom:100,pan:{x:10,y:5}};
const bounds={width:390,height:600};
const doubled=resolveCanvasTouchTransform(gesture,{x:40,y:30},200,bounds);
assert.equal(doubled.zoom,200);checks++;
// A pinch must preserve the design point underneath the fingers.
assert.equal((40-doubled.pan.x)/(doubled.zoom/100),(40-gesture.pan.x)/(gesture.zoom/100));checks++;
assert.equal((30-doubled.pan.y)/(doubled.zoom/100),(30-gesture.pan.y)/(gesture.zoom/100));checks++;
assert.equal(resolveCanvasTouchTransform(gesture,{x:40,y:30},1,bounds).zoom,50);checks++;
assert.equal(resolveCanvasTouchTransform(gesture,{x:40,y:30},900,bounds).zoom,200);checks++;
const panned=resolveCanvasTouchTransform({...gesture,count:1},{x:70,y:50},0,bounds);
assert.deepEqual(panned,{zoom:100,pan:{x:40,y:25}});checks++;
const bounded=resolveCanvasTouchTransform({...gesture,count:1},{x:9999,y:-9999},0,bounds);
assert.deepEqual(bounded.pan,{x:bounds.width,y:-bounds.height});checks++;
assert.ok(Number.isFinite(resolveCanvasTouchTransform({...gesture,distance:0},{x:40,y:30},100,bounds).zoom));checks++;
console.log(`${checks} responsive sheet and touch gesture checks passed.`);
