import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['src/app/data/sweatpants.ts'],outfile:'node_modules/.cache/sweatpants-test.cjs',bundle:true,platform:'node',logLevel:'silent'});
const {createRequire}=await import('node:module');const api=createRequire(import.meta.url)(process.cwd()+'/node_modules/.cache/sweatpants-test.cjs');
let count=0;
for(const fit of api.SWEATPANTS_FITS)for(const rise of ['low','mid','high'])for(const length of ['shorts','above-knee','knee','cropped','full'])for(const leg of ['tapered','straight','wide','flared','baggy','jogger']){
 const selection={pantsRise:rise,pantsLength:length,pantsLeg:leg};
 for(const back of [false,true]){
  const layers=api.sweatpantsLayers(selection,fit.id,back);
  assert(layers.some(l=>l.id==='base'));
  assert(!/NaN|Infinity/.test(JSON.stringify(layers)));
  assert.deepEqual(api.sweatpantsLayers(JSON.parse(JSON.stringify(selection)),fit.id,back),layers);
  count++;
 }
}
const normal=api.sweatpantsLayers({},'regular',false);
for(const id of Object.keys(api.sweatpantsMeasurementPresets({},'regular'))){
 const n=Number(api.sweatpantsMeasurementPresets({},'regular')[id].m);
 const selection=id==='cuffOpening'?{pantsHem:'rib'}:{};
 const changed=api.sweatpantsLayers(selection,'regular',id==='backRise',{[id]:{m:String(n+3)}});
 assert.notDeepEqual(changed,api.sweatpantsLayers(selection,'regular',id==='backRise'),id+' affects geometry');
}
console.log('PASS '+count+' fit/rise/length/leg/view combinations, persistence and all 11 measurement edits');
