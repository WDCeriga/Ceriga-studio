import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
await build({entryPoints:['src/app/data/tankTop.ts'],outfile:'node_modules/.cache/tank-test.cjs',bundle:true,platform:'node',loader:{'.svg':'text'},logLevel:'silent'});
const api=createRequire(import.meta.url)(process.cwd()+'/node_modules/.cache/tank-test.cjs');
let count=0;
for(const fit of api.TANK_FITS)for(const neck of api.TANK_OPTIONS.tankNeck.options)for(const type of api.TANK_OPTIONS.tankType.options)for(const arm of ['high','standard','deep'])for(const view of [false,true]){
 const selection={tankNeck:neck[0],tankType:type[0],tankArmhole:arm};
 const layers=api.tankLayers(selection,fit.id,view);
 assert(layers.some(layer=>layer.id==='base'));
 assert(!/NaN|Infinity|undefined/.test(JSON.stringify(layers)));
 assert.deepEqual(api.tankLayers(JSON.parse(JSON.stringify(selection)),fit.id,view),layers);
 count++;
}
for(const [key,group] of Object.entries(api.TANK_OPTIONS)){
 const paths=group.options.map(([value])=>JSON.stringify(api.tankLayers({[key]:value},'regular',value==='dropped')));
 assert.equal(new Set(paths).size,group.options.length,key+' choices produce distinct geometry');
}
for(const back of [false,true]){
 const bodies=api.TANK_OPTIONS.tankType.options.map(([tankType])=>api.tankLayers({tankType},'regular',back).find(layer=>layer.id==='base').svgRaw);
 assert.equal(new Set(bodies).size,3,'All three constructions have distinct body geometry in each view');
}
for(const fit of api.TANK_FITS)for(const tankNeck of ['crew','thincrew','scoop','v','deep-v']){
 const anchors=[false,true].map(back=>{
  const body=api.tankLayers({tankNeck},fit.id,back).find(layer=>layer.id==='base').svgRaw;
  return body.match(/L([\d.]+) ([\d.]+)Z/).slice(1);
 });
 assert.deepEqual(anchors[0],anchors[1],'Front and rear neckline share the shoulder attachment');
}
assert(new Set(api.TANK_FITS.map(fit=>(fit.waist/fit.chest).toFixed(3))).size>2,'Fit blocks change the waist contour, not only scale');
for(let i=1;i<api.TANK_FITS.length;i++){
 const previous=api.tankMeasurementPresets({},api.TANK_FITS[i-1].id),current=api.tankMeasurementPresets({},api.TANK_FITS[i].id);
 assert(Number(current.neckOpening.m)>Number(previous.neckOpening.m),'Neck width follows each fit block');
 assert(Number(current.neckDrop.m)>0,'Each neck retains its matching T-shirt master depth');
}
assert(api.TANK_FITS[0].waist/api.TANK_FITS[0].chest>.93,'Slim keeps a controlled taper without a pinched waist');
assert.equal(api.tankNeckForFit({},'slim'),'crew','Slim defaults to the reference high crew neck');
assert.equal(api.tankNeckForFit({tankNeck:'v'},'slim'),'v','Explicit neckline choices survive fit changes');
for(const fit of api.TANK_FITS)for(const tankNeck of ['crew','thincrew','scoop','v','deep-v']){
 const neck=api.tankLayers({tankNeck},fit.id).find(layer=>layer.id==='neck');
 assert(neck.svgRaw.includes(`data-shared-tshirt-neck="${fit.id}.`),'Tank uses the T-shirt collar master for the same fit');
 const assetKind=({v:'vneck','deep-v':'deep-vneck'})[tankNeck]??tankNeck;
 const original=readFileSync(`src/assets/tshirt-necks/${fit.id}.${assetKind}.front.ribbed.outline.svg`,'utf8');
 const originalInk=original.replace(/^.*?<svg[^>]*>|<\/svg>\s*$/gs,'');
 const ink=api.tankLayers({tankNeck},fit.id).find(layer=>layer.id==='neckOutline');
 assert(ink.svgRaw.includes(originalInk),'Tank preserves original T-shirt outline and authored rib artwork');
 const scale=neck.svgRaw.match(/scale\(([\d.]+) ([\d.]+)\)/);
 assert(scale&&Math.abs(Number(scale[1])-Number(scale[2]))<1e-9,'Default tank collars preserve the actual T-shirt asset proportions');
}
for(const tankType of ['normal','muscle','racer']){
 for(const back of [false,true]){
  const layers=api.tankLayers({tankType},'regular',back);
  assert(!layers.some(layer=>layer.id.startsWith('armhole')||layer.id==='racerbackDrape'));
  assert(layers.some(layer=>layer.id==='neck'));
  const trimmed=api.tankLayers({tankType,tankLeftFinish:'self',tankRightFinish:'none'},'regular',back);
  assert(trimmed.some(layer=>layer.id==='armholeLeft'));
  assert(!trimmed.some(layer=>layer.id.startsWith('armholeRight')));
 }
}
for(const fit of api.TANK_FITS)for(const [tankType] of api.TANK_OPTIONS.tankType.options)for(const back of [false,true]){
 const body=(tankHem)=>api.tankLayers({tankType,tankHem},fit.id,back).find(layer=>layer.id==='base').svgRaw;
 assert.notEqual(body('single'),body('curved'));
 if(back)assert.notEqual(body('single'),body('dropped'));
 else assert.equal(body('single'),body('dropped'));
 for(const [tankHem] of api.TANK_OPTIONS.tankHem.options){
  const layers=api.tankLayers({tankType,tankHem,tankHemDepth:'5'},fit.id,back);
  const ink=layers.find(layer=>layer.id==='stitching').svgRaw;
  assert.equal((ink.match(/data-trouser-stitch-region="bottom"/g)??[]).length,tankHem==='raw'?0:['cover','double'].includes(tankHem)?2:1);
  assert.equal(layers.some(layer=>layer.id==='coverHem'),tankHem==='cover');
  const facing=layers.find(layer=>layer.id==='bodyHem');
  assert.equal(facing?.kind,tankHem==='raw'?undefined:'solid');
  if(tankHem==='raw')assert(!layers.find(layer=>layer.id==='rawHem').svgRaw.includes('stroke-dasharray'));
  if(facing){
   assert.equal(facing.fabricRegion.role,'hem');
   assert.equal(facing.fabricRegion.materialCategory,'hem');
  }
  if(tankHem==='rib'){
   const texture=layers.find(layer=>layer.id==='bodyHemRib');
   assert(Number.isInteger(texture.zIndex)&&texture.zIndex>facing.zIndex);
   const ribs=texture.svgRaw;
   assert(ribs.includes('data-fixed-ink="true"')&&/d="M[^"]+V[^"]+"/.test(ribs));
  }
 }
}
for(const [finish] of api.TANK_FINISHES){
 const layers=api.tankLayers({tankNeckFinish:finish,tankLeftFinish:finish,tankRightFinish:finish});
 assert(layers.some(l=>l.id===(finish==='raw'?'neckRaw':'neck')));
 if(finish==='raw')assert(!layers.some(l=>l.id==='neck'&&l.kind==='solid'));
}
for(const id of Object.keys(api.tankMeasurementPresets({}))){
 const value=Number(api.tankMeasurementPresets({})[id].m);
 assert.notDeepEqual(api.tankLayers({},'regular',id==='backNeckDrop',{[id]:{m:String(value+2)}}),api.tankLayers({},'regular',id==='backNeckDrop'),id+' edits geometry');
}
console.log(`PASS ${count} tank fit/neck/back/armhole/view combinations, shape controls, finishes and all measurement edits`);
