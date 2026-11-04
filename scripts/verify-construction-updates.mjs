import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {surfaceRuntime} from './surface-test-runtime.mjs';
const {api}=await surfaceRuntime(`export {reanchorOpening} from './src/app/data/garmentOpenings';export {patchSvg,patchSettings,PATCH_TYPES} from './src/app/data/garmentPatches';export {updatePageReferences} from './src/app/data/pageReferences';export {withRegularConstruction} from './src/app/data/regularConstruction';`);
const elementPrototype=Object.getPrototypeOf(new DOMParser().parseFromString('<svg/>','image/svg+xml').documentElement);if(!elementPrototype.remove)elementPrototype.remove=function(){this.parentNode?.removeChild(this)};
const bounds={minX:400,maxX:1600,minY:100,maxY:1900,necklineY:360};
const opening={version:1,closure:'zip',attachment:'neckline',start:{x:1000,y:300},end:{x:1000,y:800},width:40,facingColor:'#888888',garmentAnchor:{x:1000,y:300}};opening.defaults={...opening};
const zip={id:'zip',type:'zip',x:.5,y:.3,fill:'#888888',opening};
const moved=api.reanchorOpening(zip,bounds);assert.equal(moved.opening.start.y,360);assert.equal(moved.opening.end.y,860);assert.equal(moved.opening.width,40);assert.equal(api.reanchorOpening(moved,bounds),moved);assert.equal(zip.opening.start.y,300);
assert.equal(api.reanchorOpening({...zip,opening:{...opening,attachment:'free'}},bounds).opening.start.y,300);
const layers=[{id:'sleeveLeft',svgRaw:'<svg data-shoulder-construction="true"/>'}];assert.equal(api.withRegularConstruction(layers),layers,'Never reapply old set-in geometry to alternate shoulders');
const entry={title:'Stitching',notes:'',specification:'Keep legacy notes',files:[{id:'photo',name:'Cuff.jpg'}],groups:[{id:'g',title:'Cuff',points:['Double needle','Match thread'],referenceId:'photo'}]};assert.deepEqual(JSON.parse(JSON.stringify(api.updatePageReferences({},'construction:stitch',entry)))['construction:stitch'],entry);
await mkdir('work/construction-proof',{recursive:true});
for(const material of Object.keys(api.PATCH_TYPES)){
 const detail={id:material,type:'patch',fill:material==='leather'?'#9c7552':'#b2a88e',outline:'#45403a',stitch:'#eee8d9',patch:{material}};
 const svg=api.patchSvg(detail);assert(svg.includes('data-patch-material="'+material+'"'));assert(!svg.includes('NaN'));await writeFile('work/construction-proof/patch-'+material+'.svg',svg);
 const settings=api.patchSettings({material});assert(settings.application);
}
console.log('PASS zip follows neckline, preserves dimensions, free placements remain unchanged, reanchoring is stable and immutable.');
console.log('PASS alternate shoulders survive regular-fit cleanup; specification groups and image links survive JSON persistence.');
console.log('PASS seven patch constructions produce finite SVG output; proofs saved to work/construction-proof.');
