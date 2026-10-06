import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import sharp from 'sharp';

const bundle = await build({
  stdin: { loader: 'tsx', resolveDir: process.cwd(), contents: `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { PrintsDesignPreview } from './src/app/components/builder/PrintsDesignStep';
    import { PrintsStudioProvider } from './src/app/components/builder/printsStudio/PrintsStudioContext';
    import { flattenDesignLayers, replaceMergedLayers, mergeLayersIssue } from './src/app/lib/mergeDesignLayers';
    import { sourceSignature } from './src/app/components/builder/printsStudio/WarpedArtwork';
    const root = createRoot(document.getElementById('root'));
    window.mergeIssue = mergeLayersIssue;
    function Fixture({ initial, side, size, editable }) {
      const [elements, change] = useState(initial);
      const [selected, select] = useState(null);
      window.elements = elements;
      window.select = select;
      window.change = change;
      window.merge = async ids => {
        const artwork = await flattenDesignLayers(document.querySelector('[data-print-design-zone]'), elements, ids);
        flushSync(() => change(replaceMergedLayers(elements, ids, artwork, 'merged')));
        return artwork;
      };
      window.ready = () => elements.filter(e => e.warp && (e.side ?? 'front') === side).every(e => document.querySelector('[data-print-id="' + e.id + '"] [data-warp-canvas]')?.dataset.warpReady === sourceSignature(e) + JSON.stringify(e.warp));
      return <div id="stage" style={{ width: size, height: size, background: 'white', position: 'relative' }}>
        <PrintsStudioProvider><PrintsDesignPreview elements={elements} onChange={change} editable={editable} selectedLayerId={selected} onSelectedLayerIdChange={select} canvasSize={{width:600,height:600}} garmentSide={side}
          garmentPreview={sceneScale => <div data-layer-id="base" data-scene-scale={sceneScale} style={{width:600,height:600}}><svg viewBox="0 0 600 600" width="600" height="600"><rect width="600" height="600" fill="#eee" /></svg></div>} />
        </PrintsStudioProvider></div>;
    }
    window.renderDesign = (initial, side='front', size=600, editable=false) => flushSync(() => root.render(<Fixture key={Math.random()} {...{initial, side, size, editable}} />));
  ` }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl' }, logLevel: 'silent',
});
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 950 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent(`<style>
    body{margin:0}.relative{position:relative}.absolute{position:absolute}.inset-0{inset:0}.inset-x-0{left:0;right:0}.top-0{top:0}
    .w-full{width:100%}.h-full{height:100%}.flex{display:flex}.flex-col{flex-direction:column}.flex-1{flex:1 1 0%}
    .items-center{align-items:center}.justify-center{justify-content:center}.min-h-0{min-height:0}.overflow-visible{overflow:visible}.overflow-hidden{overflow:hidden}
    .block{display:block}.object-contain{object-fit:contain}.pointer-events-none{pointer-events:none}.pointer-events-auto{pointer-events:auto}
    .z-0{z-index:0}.z-10{z-index:10}.z-50{z-index:50}.z-\\[100\\]{z-index:100}[data-crop-editor]{z-index:210}button{min-height:25px}
  </style><div id="root"></div>`);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const base = { id: 'a', type: 'shape', content: 'rect', borderWidth: 16, x: 180, y: 180, width: 140, height: 100, rotation: 0, color: '#db2233', opacity: 80, side: 'front' };
  const image = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><path fill="red" d="M0 0h80v60H0z"/><path fill="blue" d="M80 60h80v60H80z"/></svg>').toString('base64');
  const render = async (elements, side='front', size=600, editable=false) => {
    await page.evaluate(args => window.renderDesign(...args), [elements, side, size, editable]);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode())); });
    await page.waitForFunction(() => window.ready());
    await page.waitForTimeout(400);
  };
  const pixels = async () => sharp(await page.locator('#stage').screenshot()).ensureAlpha().raw().toBuffer();
  const difference = (a,b) => a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0) / a.length;
  for (const [patch, issue] of [[{}, null], [{ locked: true }, 'Only visible'], [{ hidden: true }, 'Only visible'], [{ id: 'print-drawing-layer' }, 'Only visible'], [{ side: 'back' }, 'same garment side'], [{ printMethod: 'embroidery' }, 'same print method']]) {
    const other = {...base, id:'b', ...patch};
    const result = await page.evaluate(({elements,ids}) => window.mergeIssue(elements,ids), {elements:[base,other],ids:[base.id,other.id]});
    if (issue) assert(result.includes(issue), result); else assert.equal(result, null);
  }
  assert.match(await page.evaluate(base => window.mergeIssue([base,{...base,id:'middle'},{...base,id:'b'}],['a','b']), base), /adjacent/);
  const cases = [
    {},
    { rotation: 32, cropLeft: 15, cropBottom: 10, flipHorizontal: true, shadowBlur: 3, shadowOffsetX: 4, shadowOffsetY: 5, shadowColor: '#111111' },
    { type:'image', content:image, flipVertical:true, filterBlur:1, cropTop:10 },
    { type:'text', content:'Merge me', fontSize:26, fontFamily:'Arial', height:40, color:'#1841ad', autoHeight:true },
    { type:'pattern', content:'dots', patternRandomise:true, patternSeed:37, patternScale:25, cropRight:22 },
    { type:'customArea', content:'', customAreaPoints:[{x:0,y:0},{x:140,y:25},{x:40,y:100}], customAreaPattern:'diagonal', patternScale:30 },
    { type:'image', content:image, warp:{mode:'preset',preset:'arc',bend:40,horizontalDistortion:0,verticalDistortion:0,gridSize:3,points:[]}, cropLeft:10, flipVertical:true },
    { type:'shape', content:'triangle', perspective:[{x:.05,y:.05},{x:1,y:.2},{x:.85,y:1},{x:.15,y:.9}] },
  ];
  for (const patch of cases) {
    const elements = [{...base,...patch}, {...base,id:'b',content:'ellipse',x:225,y:215,width:90,height:90,color:'#226acc',opacity:55,rotation:-17}];
    await render(elements);
    const before = await pixels();
    const artwork = await page.evaluate(() => window.merge(['a','b']));
    await page.locator('[data-print-id="merged"] img').evaluate(img => img.decode());
    const after = await pixels();
    const error = difference(before, after);
    assert(error < .8, 'Flatten preserves ' + (patch.type ?? 'shape') + ' pixels, mean error=' + error + ' bounds=' + JSON.stringify({...artwork,content:undefined}));
    assert.equal(await page.locator('[data-print-id]').count(), 1);
    assert.equal(await page.evaluate(() => window.elements[0].opacity), 100);
  }
  const layered = [{...base}, {...base,id:'back',side:'back',color:'#0055ff'}];
  await render(layered);
  const front = await pixels();
  await render(layered, 'back');
  assert(difference(front, await pixels()) > 1, 'Front and back use distinct artwork');
  const back = await pixels();
  await render(layered,'back',300);
  const small = await sharp(await page.locator('#stage').screenshot()).resize(600,600).ensureAlpha().raw().toBuffer();
  assert(difference(back,small) < .5, 'Saved canvas scales the whole composition consistently');
  assert.equal(await page.locator('[data-scene-scale]').getAttribute('data-scene-scale'), '0.5', 'Garment interactions receive the internal scene scale');
  for (const patch of cases) {
    const element = {...base,...patch};
    await render([element],'front',600,true);
    await page.evaluate(() => window.select('a'));
    await page.getByTitle('Crop', {exact:true}).click();
    assert.equal(await page.getByRole('button', {name:/^Resize crop/}).count(),8);
    await page.getByRole('button',{name:'Resize crop right',exact:true}).press('ArrowLeft');
    assert.equal(await page.evaluate(() => window.elements[0].cropRight), element.cropRight);
    await page.getByRole('button',{name:'Apply crop'}).click();
    assert.equal(await page.evaluate(() => window.elements[0].cropRight), (element.cropRight ?? 0)+1);
    assert.equal(await page.evaluate(() => window.elements[0].content), element.content);
    await page.getByTitle('Crop',{exact:true}).click();
    await page.getByRole('button',{name:'Reset crop'}).click();
    await page.getByRole('button',{name:'Cancel crop'}).click();
    assert.equal(await page.evaluate(() => window.elements[0].cropRight), (element.cropRight ?? 0)+1);
  }
  assert.deepEqual(errors,[]);
  console.log('Design composition passed: merge compatibility and pixel preservation, fixed canvas sizing, front/back and non-destructive crop across artwork types.');
} finally { await browser.close(); }
