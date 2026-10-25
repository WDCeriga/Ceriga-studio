import assert from 'node:assert/strict';import{build}from'esbuild';
const result=await build({stdin:{contents:"export * from './src/app/lib/designLayerOrdering'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const{orderDesignLayers}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const layers=[{id:'picture',type:'image'},{id:'p1',type:'pattern'},{id:'text',type:'text'},{id:'p2',type:'pattern'},{id:'shape',type:'shape'}];
assert.deepEqual(orderDesignLayers(layers).map(x=>x.id),['p1','p2','picture','text','shape']);assert.deepEqual(layers.map(x=>x.id),['picture','p1','text','p2','shape']);
const reordered=orderDesignLayers([layers[4],layers[2],layers[3],layers[0],layers[1]]);assert.deepEqual(reordered.map(x=>x.id),['p2','p1','shape','text','picture']);
assert.deepEqual(orderDesignLayers([{id:'group',type:'group',children:layers}])[0].children.map(x=>x.id),['p1','p2','picture','text','shape']);
assert.equal(orderDesignLayers([{id:'image',type:'image'},{id:'area',type:'customArea',customAreaPattern:'dots'}])[0].id,'area');console.log('Patterns stay behind artwork after insertion, reordering and grouping; original arrays remain unchanged.');
