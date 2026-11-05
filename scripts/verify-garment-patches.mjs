import assert from 'node:assert/strict';
import { surfaceRuntime } from './surface-test-runtime.mjs';
const {api} = await surfaceRuntime("export * from './src/app/data/garmentPatches';export * from './src/app/data/garmentDetails';");
const artwork='data:image/png;base64,iVBORw0KGgo=';
const detail={id:'patch-regression',fill:'#C6A450',outline:'#141414',stitch:'#ddd',patch:{...api.DEFAULT_PATCH,artwork,designMode:'logo',material:'metal'}};
const svg=api.patchSvg(detail,1.25),dom=new DOMParser().parseFromString(svg,'image/svg+xml');
assert(svg.includes('data-patch-design="logo"'));
assert(!svg.includes('data-patch-edge'),'Logo mode must not add an enclosing patch backing');
assert.equal(dom.getElementsByTagName('mask').length,1,'The complete source alpha preserves all holes and islands');
assert(svg.includes('mask-type:alpha'));
for(const material of Object.keys(api.PATCH_TYPES)) assert(api.patchSvg({...detail,patch:{...detail.patch,material}}).includes(`data-patch-material="${material}"`));
const normalized=api.patchSettings({...api.DEFAULT_PATCH,material:'metal',finish:'ironOn',application:'embroidered'});
assert.equal(normalized.finish,'prongs');assert.equal(normalized.application,'cast');
assert.equal(api.patchSettings().designMode,'backed','Existing patches retain backing mode');
const wordSvg=api.patchSvg({...detail,patch:{...detail.patch,artwork:undefined,text:'CERIGA & CO'}});
assert(wordSvg.includes('CERIGA &amp; CO'));assert(wordSvg.includes('data-patch-wording'));
const backed=api.patchSvg({...detail,patch:{...detail.patch,designMode:'backed'}});
assert(backed.includes('data-patch-edge'));assert(backed.includes('data-patch-artwork'));
console.log('PASS: all patch materials render, logo masks preserve source topology, wording stays editable, legacy backing survives, incompatible metal settings normalize');

assert.deepEqual(api.patchTextMethods('metal'),['engraved','cast','enamel','printed']);
assert(!api.patchTextMethods('embroidered').includes('engraved'),'Fabric must not offer metal engraving');
const engraving=api.patchSvg({...detail,patch:{...detail.patch,designMode:'backed',text:'Brand',textMethod:'engraved',textX:.3,textY:.6,textRotation:25}});
const engravedDom=new DOMParser().parseFromString(engraving,'image/svg+xml'),lettering=engravedDom.getElementsByTagName('text')[0];
assert.equal(lettering.getAttribute('fill'),detail.fill);assert.equal(lettering.getAttribute('data-patch-wording-method'),'engraved');assert.equal(lettering.getAttribute('x'),'60');assert.equal(lettering.getAttribute('y'),'96');assert.equal(lettering.getAttribute('transform'),'rotate(25 60 96)');assert(lettering.getAttribute('filter'),'Engraving needs visible material relief');
console.log('PASS: lettering methods follow materials; engraved wording uses the material colour, relief and saved placement/rotation');

const placed={...detail,type:'patch',name:'Patch 1',x:.5,y:.5,scale:1,hardware:'#aaa'},bounds={minX:500,minY:150,maxX:1500,maxY:1850};
for(const x of [-.15,1.15]){const moved=api.setDetailTransform(placed,bounds,{x,y:.3});assert.equal(moved.x,x,'Patch movement must reach sleeve areas outside body bounds');assert.equal(api.detailPlacement(moved,bounds).x,x);}
console.log('PASS: patch placement is not clamped to the torso, with unchanged garment-relative coordinates');
