import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/app/lib/artworkProduction.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {productionOptions,isFabricArtwork}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const allowed=el=>productionOptions(el).filter(m=>m.available).map(m=>m.id);
for(const content of ['camo-woodland','plaid','custom','topographic'])assert.deepEqual(allowed({type:'pattern',content,patternTarget:'base'}),['Fabric Print']);
assert(!isFabricArtwork({type:'customArea',customAreaPattern:'camo'}));
assert(!allowed({type:'customArea',customAreaPattern:'camo'}).includes('Fabric Print'));
assert.deepEqual(allowed({type:'pattern',patternCoverage:'garment'}),['Fabric Print']);
assert(!allowed({type:'pattern'}).includes('Fabric Print'));
assert(allowed({type:'pattern'}).includes('Screen Print'));
assert.deepEqual(allowed({type:'pattern',patternTarget:'sleeveLeft'}),['Fabric Print']);
assert(allowed({type:'pattern'}).includes('Screen Print'));
assert(!productionOptions({type:'pattern',patternTarget:'base',printMethod:'Screen Print'}).find(m=>m.id==='Screen Print').available);
assert(!isFabricArtwork({type:'shape',shapeEffects:[{id:'textile-ink'}]}));
for(const type of ['image','drawing','shape','text']){
 const options=allowed({type});assert(options.includes('DTG'));assert(options.includes('DTF'));assert(options.includes('Embroidery'));assert(!options.includes('Fabric Print'));
}
assert(allowed({type:'pattern',content:'camo-woodland'}).includes('DTF'));
const photo=productionOptions({type:'image'});assert.match(photo.find(m=>m.id==='Embroidery').note,/digitising/);assert.match(photo.find(m=>m.id==='Puff Print').note,/simplified/);assert.match(photo.find(m=>m.id==='Heat Transfer').note,/printed transfer/);
const saved={type:'pattern',patternTarget:'base',printMethod:'DTG'},before=structuredClone(saved);assert(!productionOptions(saved).find(m=>m.id===saved.printMethod).available);assert.deepEqual(saved,before);
console.log('Production rules: fabric vs placed camo, custom areas, patterned shapes, all artwork categories, preparation notes and saved-method validation passed.');
