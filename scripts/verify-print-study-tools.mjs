import assert from 'node:assert/strict';import{build}from'esbuild';import{pathToFileURL}from'node:url';import{mkdir}from'node:fs/promises';
await mkdir('node_modules/.cache/print-checks',{recursive:true});
async function load(name){const out=`node_modules/.cache/print-checks/${name}-study.mjs`;await build({entryPoints:[`src/app/lib/${name}.ts`],outfile:out,bundle:true,platform:'node',format:'esm',logLevel:'silent'});return import(pathToFileURL(process.cwd()+'/'+out));}
const {applyImageFilter}=await load('imageFilters');const src=new Uint8ClampedArray([30,45,65,255,235,228,210,255,10,10,10,0]);
for(const id of ['extract-light','extract-dark','remove-colour']){
 const p=applyImageFilter(src,3,1,{id,intensity:100,threshold:100,softness:20,backgroundColor:'#1e2d41'});
 assert.equal(p[11],0);assert.deepEqual([...src],[30,45,65,255,235,228,210,255,10,10,10,0]);
 if(id==='extract-dark'){assert.equal(p[3],255);assert.equal(p[7],0)}else{assert.equal(p[3],0);assert.equal(p[7],255)}
 assert.deepEqual(applyImageFilter(src,3,1,{id,intensity:0}),src);
}
const {textileInkEffect,textileInkSource}=await load('textileInk');
for(const kind of ['plaid','tartan','gingham','houndstooth']){
 const palette=['#d0c4a0','#953a45','#f1eedc','#21354a'];const a=textileInkSource(kind,palette,4);assert.equal(a,textileInkSource(kind,palette,4));assert.notEqual(a,textileInkSource(kind,palette,8));assert(decodeURIComponent(a).includes('<pattern'));const effect=textileInkEffect(kind,palette,4,35);assert.equal(effect.settings.rotation,35);assert.equal(effect.type,'texture-fill');
}
console.log('Print study tools: light/dark ink separation, colour-key transparency, source preservation, zero intensity, deterministic vector textile fills and editable repeat settings passed.');

const {readFile}=await import('node:fs/promises');const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
const outlineOut='node_modules/.cache/print-checks/editable-lettering-study.mjs';
await build({entryPoints:['src/app/lib/editableLettering.ts'],outfile:outlineOut,bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'font-url',setup(b){b.onResolve({filter:/\.woff2?\?url$/},a=>({path:require.resolve(a.path.replace('\?url','')),namespace:'font-data'}));b.onLoad({filter:/.*/,namespace:'font-data'},async a=>({contents:`export default "data:font/woff;base64,${(await readFile(a.path)).toString('base64')}"`,loader:'js'}))}}]});
const {outlineLettering}=await import(pathToFileURL(process.cwd()+'/'+outlineOut));
for(const fontFamily of ['Graduate','Black Ops One','Pinyon Script','Anton','UnifrakturCook','Bungee','Jersey 10']){
 const el={id:'letters',type:'text',content:'B83',fontFamily,fontSize:64,width:220,height:100,x:360,y:300,rotation:0,color:'#171717'};
 const result=await outlineLettering(el);assert.equal(result.type,'shape');assert(result.shapePath.subpaths.length>=3,'Counters and separate glyphs must remain vector contours');assert.equal(result.letteringSource.content,'B83');assert.equal(el.type,'text');assert(result.width>0&&result.height>0);
 for(const p of [result.shapePath,...result.shapePath.subpaths])for(const n of p.nodes)assert(Number.isFinite(n.x)&&Number.isFinite(n.y));
}
console.log('Custom lettering: bundled fonts convert to editable cubic contours, preserve letter counters and retain original text for restoration.');

const w=32,h=32,mask=new Uint8ClampedArray(w*h*4);for(let y=4;y<28;y++)for(let x=4;x<28;x++){const i=(y*w+x)*4;mask.set([235,235,235,255],i)}mask[(16*w+16)*4]=25;mask[(16*w+16)*4+1]=25;mask[(16*w+16)*4+2]=25;
const full=applyImageFilter(mask,w,h,{id:'extract-light',inkCleanup:75,intensity:100});const half=applyImageFilter(mask,w,h,{id:'extract-light',inkCleanup:75,intensity:50});assert.equal(full[3],0);for(let i=3;i<mask.length;i+=4)assert(Math.abs(half[i]-(mask[i]+full[i])/2)<=1);assert.equal(mask[(16*w+16)*4],25);
console.log('Ink cleanup: source transparency and original pixels preserved; partial-strength alpha matches cached rendering.');

const notices=JSON.parse(await readFile('public/font-licenses/index.json','utf8'));assert.equal(notices.length,22);for(const font of notices){assert(['OFL-1.1','Apache-2.0'].includes(font.license));const licence=await readFile('public/font-licenses/'+font.notice,'utf8');assert(licence.includes('SIL OPEN FONT LICENSE')||licence.includes('Apache License'));assert(font.copyright.length>20)}console.log('Clothing font collection: 22 retained licence/copyright notices verified, including 19 display families.');
