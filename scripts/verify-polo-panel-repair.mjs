import assert from 'node:assert/strict';
import {surfaceRuntime} from './surface-test-runtime.mjs';
const {api}=await surfaceRuntime(`export {poloRepairPanel} from './src/app/lib/poloPanelRepair';`);
const region=(id,points)=>({id,parentId:'base',label:id,path:'',points:points.map(([x,y])=>({x,y})),seamIds:['seam'],area:1});
const upper=region('upper',[[500,300],[950,300],[990,650],[1058,650],[1098,300],[1550,300],[1550,1100],[500,1100]]),lower=region('lower',[[500,1100],[1550,1100],[1550,1900],[500,1900]]);
assert.equal(api.poloRepairPanel([lower,upper],{x:1024,y:500}).id,'upper','Old neckline notch takes adjacent upper-panel fabric');
assert.equal(api.poloRepairPanel([lower,upper],{x:700,y:1500}).id,'lower');
assert.equal(api.poloRepairPanel([],{x:1024,y:500}),undefined);
console.log('PASS retired placket notch inherits its adjacent panel instead of original body paint.');
