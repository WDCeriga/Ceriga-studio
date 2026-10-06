import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import sharp from 'sharp';

const helpersBundle = await build({ entryPoints: ['src/app/lib/designGroups.ts'], bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent' });
const { groupDesignLayers, ungroupDesignLayer, groupLayersIssue, ungroupLayersIssue, toggleLayerSelection } = await import(`data:text/javascript;base64,${Buffer.from(helpersBundle.outputFiles[0].text).toString('base64')}`);
const base = { id: 'a', type: 'shape', content: 'rect', x: 180, y: 180, width: 140, height: 100, rotation: 0, color: '#db2233', side: 'front' };
const pair = [base, { ...base, id: 'b', x: 270, y: 240, content: 'ellipse', color: '#226acc', rotation: 17 }];
const grouped = groupDesignLayers(pair, ['a','b'], 'group');
assert.deepEqual(ungroupDesignLayer(grouped, 'group', () => 'unused'), pair);
assert.equal(grouped[0].children.length, 2);
assert.deepEqual(pair[0], base, 'Grouping does not mutate input');
for (const patch of [{locked:true},{hidden:true},{patternTarget:'sleeve'},{customAreaOpen:true},{id:'print-drawing-layer'},{side:'back'},{printMethod:'embroidered'}]) {
  const other = {...pair[1],...patch};
  assert(groupLayersIssue([base,other], ['a',other.id]));
}
assert.match(groupLayersIssue([base,{...base,id:'middle'},pair[1]],['a','b']), /adjacent/);
assert.deepEqual(toggleLayerSelection(toggleLayerSelection(['a'],'b'),'a'), ['b']);
assert(groupLayersIssue(pair,['a','a']));
assert.match(ungroupLayersIssue({...grouped[0],opacity:50}), /opacity/);
assert.equal(ungroupLayersIssue({...grouped[0],rotation:38}), null);
const envelope = ungroupDesignLayer([{...grouped[0],width:400}], 'group', () => Math.random().toString());
assert(envelope.every(element => element.type === 'group' && element.children.length === 1 && element.groupTransformEnvelope));
assert.equal(envelope[0].children[0].content, 'rect');
assert.match(ungroupLayersIssue(envelope[0]), /transform envelope/);
const resetEnvelope = { ...envelope[0], width: envelope[0].groupSourceWidth };
assert.equal(ungroupLayersIssue(resetEnvelope), null);
assert.equal(ungroupDesignLayer([resetEnvelope], resetEnvelope.id, () => 'unused')[0].type, 'shape');

const bundle = await build({
  stdin: { loader: 'tsx', resolveDir: process.cwd(), contents: `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { PrintsDesignPreview, PrintsDesignStep } from './src/app/components/builder/PrintsDesignStep';
    import { PrintsStudioProvider } from './src/app/components/builder/printsStudio/PrintsStudioContext';
    import { groupDesignLayers, ungroupDesignLayer } from './src/app/lib/designGroups';
    import { sourceSignature } from './src/app/components/builder/printsStudio/WarpedArtwork';
    const root = createRoot(document.getElementById('root'));
    function Fixture({initial, panel}) {
      const [elements, change] = useState(initial);
      const [selected, select] = useState(null);
      window.elements = elements;
      window.group = () => flushSync(() => change(groupDesignLayers(elements, elements.map(e=>e.id), 'group')));
      window.ungroup = () => flushSync(() => change(ungroupDesignLayer(elements, 'group', () => crypto.randomUUID())));
      window.patch = patch => flushSync(() => change(elements.map(e=>e.id==='group'?{...e,...patch}:e)));
      window.ready = () => [...document.querySelectorAll('[data-warp-canvas]')].every(node=>Boolean(node.dataset.warpReady));
      return <PrintsStudioProvider><div id="stage" style={{width:600,height:600,background:'white',position:'relative'}}>
        <PrintsDesignPreview elements={elements} onChange={change} editable={!panel} selectedLayerId={selected} onSelectedLayerIdChange={select} canvasSize={{width:600,height:600}} garmentSide="front"
          garmentPreview={scale=><div data-layer-id="base"><svg width="600" height="600"><rect width="600" height="600" fill="#eee" /></svg></div>} />
      </div>{panel && <PrintsDesignStep elements={elements} onChange={(next,id)=>{change(next);if(id!==undefined)select(id);}} selectedLayerId={selected} onSelectedLayerIdChange={select} />}</PrintsStudioProvider>;
    }
    window.renderDesign = (initial,panel=false) => flushSync(()=>root.render(<Fixture key={Math.random()} {...{initial,panel}} />));
    window.signature = sourceSignature;
  ` }, bundle: true, write: false, format:'iife', platform:'browser', jsx:'automatic',
  define: {'process.env.NODE_ENV':'"production"'}, loader:{'.svg':'dataurl','.png':'dataurl','.jpg':'dataurl'}, logLevel:'silent',
});
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1100,height:950}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.BASE_URL ?? 'http://127.0.0.1:5189');
  await page.setContent(`<style>
    body{margin:0}.relative{position:relative}.absolute{position:absolute}.inset-0{inset:0}.inset-x-0{left:0;right:0}.top-0{top:0}
    .w-full{width:100%}.h-full{height:100%}.flex{display:flex}.flex-col{flex-direction:column}.flex-1{flex:1 1 0%}
    .items-center{align-items:center}.justify-center{justify-content:center}.min-h-0{min-height:0}.overflow-visible{overflow:visible}.overflow-hidden{overflow:hidden}
    .block{display:block}.object-fill{object-fit:fill}.pointer-events-none{pointer-events:none}.pointer-events-auto{pointer-events:auto}
    .z-0{z-index:0}.z-10{z-index:10}.z-50{z-index:50}button{min-height:25px}
  </style><div id="root"></div>`);
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const settle=async()=>{
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode()));});
    await page.waitForFunction(()=>window.ready());
    await page.waitForTimeout(500);
  };
  const render=async(elements,panel=false)=>{await page.evaluate(args=>window.renderDesign(...args),[elements,panel]);await settle();};
  const pixels=async()=>sharp(await page.locator('#stage').screenshot()).ensureAlpha().raw().toBuffer();
  const difference=(a,b)=>a.reduce((sum,value,index)=>sum+Math.abs(value-b[index]),0)/a.length;
  const image='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="140" height="100"><path fill="red" d="M0 0h70v50H0z"/><path fill="blue" d="M70 50h70v50H70z"/></svg>').toString('base64');
  const cases=[
    {},
    {rotation:32,cropLeft:15,flipHorizontal:true},
    {type:'image',content:image,filterBlur:1,shadowBlur:3,shadowOffsetX:4,shadowOffsetY:5,shadowColor:'#111111'},
    {type:'drawing',content:image},
    {type:'text',content:'Editable text',fontSize:24,fontFamily:'Arial',height:40,autoHeight:true},
    {type:'pattern',content:'dots',patternScale:25,patternRandomise:true,patternSeed:37},
    {type:'distress',content:'speckle',patternScale:25},
    {type:'customArea',content:'',customAreaPoints:[{x:0,y:0},{x:140,y:25},{x:40,y:100}],customAreaPattern:'diagonal',patternScale:30},
    {perspective:[{x:.05,y:.05},{x:1,y:.2},{x:.85,y:1},{x:.15,y:.9}]},
    {warp:{mode:'preset',preset:'arc',bend:30,horizontalDistortion:0,verticalDistortion:0,gridSize:3,points:[]}},
  ];
  for(const patch of cases){
    await render([{...base,...patch},pair[1]]);
    const before=await pixels();
    await page.evaluate(()=>window.group());await settle();
    let delta=difference(before,await pixels());
    assert(delta<.35,`Grouping ${patch.type??'shape'} preserves pixels: ${delta}`);
    await page.evaluate(()=>window.ungroup());await settle();
    delta=difference(before,await pixels());
    assert(delta<.35,`Ungrouping ${patch.type??'shape'} preserves pixels: ${delta}`);
  }
  for(const patch of [{rotation:35},{width:390,height:140,rotation:23},{flipHorizontal:true,cropLeft:10},{perspective:[{x:0,y:.1},{x:1,y:0},{x:.8,y:1},{x:.1,y:.85}]},{warp:{mode:'preset',preset:'arc',bend:25,horizontalDistortion:0,verticalDistortion:0,gridSize:3,points:[]}}]){
    await render(pair);await page.evaluate(()=>window.group());
    await page.evaluate(patch=>window.patch(patch),patch);await settle();
    const before=await pixels();
    await page.evaluate(()=>window.ungroup());await settle();
    const delta=difference(before,await pixels());
    assert(delta<.65,`Transformed ungroup preserves pixels ${JSON.stringify(patch)}: ${delta}`);
    assert.equal(await page.evaluate(()=>window.elements.length),2);
  }
  const signatureChanged=await page.evaluate(group=>window.signature(group)!==window.signature({...group,children:group.children.map((child,index)=>index?child:{...child,x:child.x+1})}),grouped[0]);
  assert(signatureChanged,'Child geometry invalidates captured warp source');
  await render(pair,true);
  await page.getByRole('checkbox',{name:'Select layer 1 for group or merge'}).check();
  await page.getByRole('checkbox',{name:'Select layer 2 for group or merge'}).check();
  await page.getByRole('button',{name:'Group',exact:true}).click();await settle();
  assert.equal(await page.evaluate(()=>window.elements[0].type),'group');
  await page.getByRole('button',{name:'Ungroup',exact:true}).click();await settle();
  assert.equal(await page.evaluate(()=>window.elements.length),2);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Design groups: helpers, source retention, all artwork types, transformed pixel parity, source invalidation and Layers controls passed.');
} finally { await browser.close(); }
