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
console.log(`${checks} responsive sheet checks passed.`);
