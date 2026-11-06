import assert from 'node:assert/strict';import {surfaceRuntime} from './surface-test-runtime.mjs';
const {api}=await surfaceRuntime(`export {zipBelongsToSeam} from './src/app/features/panelling/panellingZips';`);
const seam={id:'seam',anchors:[{x:1,y:2},{x:3,y:4}]},other={id:'other',anchors:[{x:10,y:20},{x:30,y:40}]};
const linked={id:'zip',type:'zip',view:'front',opening:{sourceSeamId:'seam'}},legacy={id:'old',type:'zip',opening:{curve:seam.anchors}},back={...linked,id:'back',view:'back'};
assert(api.zipBelongsToSeam(linked,seam,'front'));assert(api.zipBelongsToSeam(legacy,seam,'front'));assert(!api.zipBelongsToSeam(linked,other,'front'));assert(!api.zipBelongsToSeam(back,seam,'front'));
assert.deepEqual([linked,legacy,back].filter(d=>!api.zipBelongsToSeam(d,seam,'front')),[back]);
console.log('PASS removing seam zips preserves unrelated details, opposite face and seam geometry.');
