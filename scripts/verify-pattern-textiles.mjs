import assert from 'node:assert/strict';
import {build} from 'esbuild';
const built=await build({stdin:{contents:"export * from './src/app/lib/patternEditing';export * from './src/app/lib/patternCatalog';export * from './src/app/lib/patternGeometry';export * from './src/app/lib/generatedPatterns';export * from './src/app/lib/textileCamouflage';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
let count=0;const check=(name,fn)=>{fn();count++;console.log('PASS '+name)};
check('Camouflage fields meet continuously at every repeat edge',()=>{
 for(const seed of [1,1729,99382])for(const frequency of [1.2,2.8,5.4]){
  const field=api.camouflageField(seed,frequency,1.3,.55);
  for(let i=0;i<=40;i++){
   const t=i/40;
   assert.ok(Math.abs(field(0,t)-field(1,t))<1e-10);
   assert.ok(Math.abs(field(t,0)-field(t,1))<1e-10);
   const h=1e-5;
   assert.ok(Math.abs((field(h,t)-field(-h,t))-(field(1+h,t)-field(1-h,t)))<1e-9);
  }
 }
});
check('Every garment part uses the same repeat dimensions',()=>{
 for(const definition of api.PATTERN_CATALOG.filter(p=>p.id!=='custom')){
  const settings={...api.initialPatternSettings(definition.id),type:'pattern',content:definition.id,patternSeed:1729,patternReferenceSize:api.garmentPatternReference(800,700)};
  const geometry=element=>definition.category==='Classic'?api.patternGeometry(element):api.generatedPatternGeometry(element);
  const body=geometry({...settings,width:320,height:480}),sleeve=geometry({...settings,width:100,height:190});
  assert.equal(body.tileWidth??body.tileSize,sleeve.tileWidth??sleeve.tileSize,definition.id+' horizontal pitch');
  assert.equal(body.tileHeight??body.tileSize,sleeve.tileHeight??sleeve.tileSize,definition.id+' vertical pitch');
 }
});
check('Camouflage stays editable, deterministic and finite at extreme settings',()=>{
 for(const kind of ['camo-woodland','camo-tiger','camo-desert','camo-urban','camo-abstract','camo','digital-camo','cow']){
  for(const amount of [1,6,32]){
   const element={...api.initialPatternSettings(kind),type:'pattern',content:kind,width:300,height:400,patternCount:amount,patternSeed:1729,patternOptions:{shapeSize:250,overlap:100,irregularity:100}};
   const value=api.generatedPatternGeometry(element);
   assert.ok(value.motifs.some(m=>m.primitives.length));assert.ok(!/NaN|Infinity/.test(JSON.stringify(value)));
   assert.deepEqual(value,api.generatedPatternGeometry(element));
  }
 }
});
check('Seed and density controls change the original pattern artwork',()=>{
 const base={...api.initialPatternSettings('camo-woodland'),type:'pattern',content:'camo-woodland',width:300,height:400,patternSeed:1729};
 const geometry=JSON.stringify(api.generatedPatternGeometry(base));
 assert.notEqual(geometry,JSON.stringify(api.generatedPatternGeometry({...base,patternSeed:1730})));
 assert.notEqual(geometry,JSON.stringify(api.generatedPatternGeometry({...base,patternCount:12})));
});
check('Free artwork patterns retain their existing size-based scaling',()=>{
 const small=api.patternGeometry({type:'pattern',content:'stripes',width:100,height:100,patternCount:10});
 const large=api.patternGeometry({type:'pattern',content:'stripes',width:200,height:200,patternCount:10});
 assert.equal(large.tileSize,small.tileSize*2);
});
console.log(`${count} textile quality checks passed.`);
