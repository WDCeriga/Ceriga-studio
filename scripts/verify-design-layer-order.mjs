import assert from 'node:assert/strict';import{build}from'esbuild';
const result=await build({stdin:{contents:"export * from './src/app/lib/designLayerOrdering';export * from './src/app/lib/artworkArrange'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const{orderDesignLayers,moveArtworkLayer,arrangeArtwork}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const layers=[{id:'picture',type:'image'},{id:'p1',type:'pattern'},{id:'text',type:'text'},{id:'p2',type:'pattern'},{id:'shape',type:'shape'}];
assert.deepEqual(orderDesignLayers(layers).map(x=>x.id),['p1','p2','picture','text','shape']);assert.deepEqual(layers.map(x=>x.id),['picture','p1','text','p2','shape']);
const reordered=orderDesignLayers([layers[4],layers[2],layers[3],layers[0],layers[1]]);assert.deepEqual(reordered.map(x=>x.id),['p2','p1','shape','text','picture']);
assert.deepEqual(orderDesignLayers([{id:'group',type:'group',children:layers}])[0].children.map(x=>x.id),['p1','p2','picture','text','shape']);
assert.equal(orderDesignLayers([{id:'image',type:'image'},{id:'area',type:'customArea',customAreaPattern:'dots'}])[0].id,'area');console.log('Patterns stay behind artwork after insertion, reordering and grouping; original arrays remain unchanged.');

const placed=moveArtworkLayer(layers,'p1','shape','above');assert.equal(orderDesignLayers(placed).at(-1).id,'p1');assert.equal(placed.at(-1).layerOrderExplicit,true);
const clipped={...layers[1],clipToArtworkId:'shape'};assert.equal(orderDesignLayers([layers[4],clipped]).at(-1).id,'p1');
const below=moveArtworkLayer(placed,'p1','text','below');assert.ok(orderDesignLayers(below).findIndex(e=>e.id==='p1')<orderDesignLayers(below).findIndex(e=>e.id==='text'));
assert.deepEqual(moveArtworkLayer(layers,'missing','shape','above'),layers);
console.log('Explicit pattern ordering survives normalization; clipped patterns remain above their masks; before/after moves preserve the original array.');

assert.equal(orderDesignLayers(arrangeArtwork(layers,['p1'],'front')).at(-1).id,'p1');
assert.equal(orderDesignLayers(arrangeArtwork(layers,['p1'],'back')).filter(e=>!['p2'].includes(e.id))[0].id,'p1');
console.log('Arrange commands and layer dragging share the same explicit-order override.');
