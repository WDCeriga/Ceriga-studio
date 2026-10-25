import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
await mkdir('node_modules/.cache/wear-checks',{recursive:true});
async function load(name){const file=`node_modules/.cache/wear-checks/${name}.mjs`;await build({entryPoints:[`src/app/lib/${name}.ts`],outfile:file,bundle:true,platform:'node',format:'esm',logLevel:'silent'});return import(pathToFileURL(process.cwd()+'/'+file).href)}
const scatter=await load('distressScatter'),render=await load('distressRendering');
for(const kind of ['holes','abrasion','rips']) {
  const settings={...scatter.DEFAULT_DISTRESS_SCATTER,opacity:100};
  const a=scatter.createDistressStamp({x:100,y:120},32,settings,kind);
  assert.deepEqual(a,scatter.createDistressStamp({x:100,y:120},32,settings,kind),'Cursor preview must match committed marks');
  assert.notDeepEqual(a.map(m=>m.seed),scatter.createDistressStamp({x:110,y:125},32,settings,kind).map(m=>m.seed),'Successive dabs must not repeat identical damage');
  const high=scatter.createDistressStamp({x:200,y:240},64,{...settings,size:settings.size*2},kind,2);
  assert.deepEqual(a.map(m=>m.seed),high.map(m=>m.seed),'DPR must not change texture detail');
  for(const roughness of [0,.5,1])for(const size of [1,9,80]) {
    const mark={...a[0],width:size,height:size*(kind==='rips'?.15:.75),roughness};
    const paths=render.distressPaths(mark,kind);
    assert(paths.every(p=>!p.d.match(/NaN|Infinity/)&&Number.isFinite(p.opacity??1)));
    assert(paths.some(p=>p.role==='fiber'),'All damage needs broken or raised cotton fibres');
    assert.equal(paths.some(p=>p.role==='opening'),kind!=='abrasion','Abrasion must preserve fabric rather than punch holes');
    if(kind==='abrasion')assert(paths.every(p=>!p.fill),'Surface wear cannot be an opaque patch');
    assert.notDeepEqual(paths,render.distressPaths({...mark,seed:mark.seed+23},kind),'Damage geometry must vary by seed');
    assert.deepEqual(paths,render.distressPaths(mark,kind),'Saved vector assets must remain stable');
  }
  if(kind!=='abrasion')assert(a.every(m=>m.opacity===1),'Open fabric should not look like translucent ink at full strength');
  if(kind==='rips')assert(a.every(m=>Math.abs(m.rotation)<=.21),'Rips should follow a coherent tear direction');
}
assert.notEqual(render.distressPalette('#ffffff').fiber,render.distressPalette('#171717').fiber,'Fraying must follow the garment dye');
assert.equal(render.singleDistressMarks('rips',120,26)[0].height,20.8);
console.log('Wear rendering: three distinct finishes, stable previews, varied dabs, DPR parity, colour adaptation and finite geometry at all detail extremes passed.');

const editing=await load('wearEditing');
const holes=scatter.createDistressStamp({x:100,y:100},50,{...scatter.DEFAULT_DISTRESS_SCATTER,count:48},'holes');
for(let i=0;i<holes.length;i++)for(let j=i+1;j<holes.length;j++)assert(Math.hypot(holes[i].x-holes[j].x,holes[i].y-holes[j].y)>(Math.max(holes[i].width,holes[i].height)+Math.max(holes[j].width,holes[j].height))*.53+1,'Brush openings must leave intact cloth between them');
assert.equal(scatter.separateDistressMarks(holes,holes).length,0,'Holding or repainting an occupied patch must not stack identical holes');
const original=structuredClone(holes),local=editing.cropWearMarks(holes,30,40,2,2);
const layer={id:'wear',type:'distress',content:'data:cached',x:30,y:40,width:30,height:40,rotation:0,wear:{kind:'holes',sourceWidth:30,sourceHeight:40,marks:local}};
const restored=editing.garmentWearMarks(layer);
assert(Math.abs(restored[0].x-holes[0].x/2)<1e-9);assert(Math.abs(restored[0].y-holes[0].y/2)<1e-9);
assert.deepEqual(holes,original,'Saving editable marks cannot mutate the stroke');
const palette=render.distressPalette('#4978ab');assert.equal(palette.opening,'rgb(73,120,171)','Opening fallback must not add another darkening pass');
for(const kind of ['holes','abrasion','rips']) {
 const m={...holes[0],width:40,height:25};
 assert.notDeepEqual(render.distressPaths(m,kind),render.distressPaths({...m,bend:35,skew:40},kind),'Each finish must respond to reshaping');
 assert(!render.distressPaths({...m,fray:0},kind).some(p=>p.role==='fiber'&&p.d),'Fraying controls must affect visible fibres');
}
console.log('Separated holes, repeated-pass rejection, editable stroke coordinates, inner-fabric colour and three-finish reshaping passed.');

const worldMarks=editing.garmentWearMarks(layer);const shifted=worldMarks.map((m,i)=>i?m:{...m,x:m.x+400,width:m.width*2});const reframed={...layer,...editing.reframeWearMarks(layer,shifted)};const afterFrame=editing.garmentWearMarks(reframed);for(let i=0;i<shifted.length;i++){assert(Math.abs(afterFrame[i].x-shifted[i].x)<1e-8);assert(Math.abs(afterFrame[i].y-shifted[i].y)<1e-8)}
console.log('Individual shaping expands the editable frame without shifting other holes.');

const single={id:'single-hole',type:'distress',content:'holes',x:400,y:300,width:36,height:30,rotation:20};const editableSingle=editing.editableWearLayer(single);const singleWorld=editing.garmentWearMarks(editableSingle);const reshapedSingle={...single,...editing.reframeWearMarks(editableSingle,singleWorld.map(m=>({...m,bend:40,skew:60})))};const transformed=editing.garmentWearMarks(reshapedSingle)[0];assert(Math.abs(transformed.x-400)<1e-8);assert(Math.abs(transformed.y-300)<1e-8);assert(reshapedSingle.width>singleWorld[0].width);console.log('Single marks retain their garment position when converted for shape editing.');

assert.equal(render.distressPalette('#4978ab','rgb(110,145,184)').opening,'rgb(110,145,184)','The rendered inner-neck colour must pass through unchanged');
