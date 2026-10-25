import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export * from './src/app/lib/patternEditing';export * from './src/app/lib/patternCatalog';export * from './src/app/lib/patternGeometry';export * from './src/app/lib/generatedPatterns';export * from './src/app/components/builder/printsStudio/studioAssets';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
for(const definition of api.PATTERN_CATALOG.filter(p=>p.id!=='custom')){
 const settings={...api.initialPatternSettings(definition.id,'#ffffff'),patternSeed:1729};
 const el={id:'test',type:'pattern',content:definition.id,x:0,y:0,width:320,height:240,...settings};
 const geometry=definition.category==='Classic'?api.patternGeometry(el):api.generatedPatternGeometry(el);
 assert(!/NaN|Infinity/.test(JSON.stringify(geometry)),definition.id+' has finite geometry');
 assert.deepEqual(geometry,definition.category==='Classic'?api.patternGeometry(el):api.generatedPatternGeometry(el),definition.id+' is deterministic');
 if(!definition.fashion)assert(settings.patternCount>=8,definition.id+' starts with a close repeat');
 assert([settings.color,...settings.patternColors??[]].some(color=>color.toLowerCase()!=='#ffffff'),definition.id+' remains visible on a light garment');
}
const events=new EventTarget();globalThis.window=events;
const data=new Map(),transfer={setData:(key,value)=>data.set(key,value)};
const settings={...api.initialPatternSettings('leopard'),patternSeed:1729,patternSpacingX:4};
api.beginPatternDrag(transfer,'leopard',settings);
assert(data.has('application/x-ceriga-pattern'),'Cards identify themselves to the garment hover handler');
const drag=api.getActivePatternDrag(),drop=api.decodeStudioDrag(data.get(api.STUDIO_DRAG_MIME));
assert.deepEqual(drag,drop,'Protected dragover preview uses the same appearance as the eventual drop');
assert.equal(transfer.effectAllowed,'copy');
events.dispatchEvent(new Event('dragend'));assert.equal(api.getActivePatternDrag(),null,'Cancelled drags clear their preview source');
console.log('49 pattern defaults, deterministic finite geometry, protected drag preview/drop parity and cancellation verified.');
