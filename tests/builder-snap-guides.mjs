import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/app/lib/designSnapGuides.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {snapDragInZone:snap}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const boxes=[{id:'other',x:75,y:80,width:50,height:40}];
// Centre is four units away, but the other object's left edge is only one away.
const closest=snap(96,50,45,10,200,200,'moving',boxes,{tolerance:6});
assert.equal(closest.x,95);
assert.deepEqual(closest.verticalLines,[50]);
const reversed=snap(96,50,45,10,200,200,'moving',[...boxes].reverse(),{tolerance:6});
assert.equal(reversed.x,closest.x);
const free=snap(130,140,10,10,300,300,'moving',[],{tolerance:6});
assert.equal(free.x,130);
assert.deepEqual(free.verticalLines,[]);
const outside=snap(-20,80,10,10,200,200,'moving',[],{tolerance:6});
assert.equal(outside.x,10);
assert.deepEqual(outside.verticalLines,[]);
console.log('Snap guides: nearest alignment, free movement and bounds passed.');
