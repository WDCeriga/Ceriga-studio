import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const baseUrl = process.env.CERIGA_BASE_URL || 'http://127.0.0.1:5189';
const bundle = await build({
  stdin: { loader: 'tsx', resolveDir: process.cwd(), contents: `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { PrintsDesignPreview } from './src/app/components/builder/PrintsDesignStep';
    import { PrintsStudioProvider } from './src/app/components/builder/printsStudio/PrintsStudioContext';
    import { artworkAtPoint } from './src/app/lib/artworkHitTesting';
    import { quadMap } from './src/app/lib/designGeometry';
    const image = body => 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' + body + '</svg>');
    const bottom = { id:'bottom', type:'image', content:image('<rect width="100" height="100" fill="blue"/>'), x:350,y:320,width:500,height:500,rotation:0 };
    const top = { ...bottom, id:'top', width:300,height:300, content:image('<path fill="red" fill-rule="evenodd" d="M10 10H90V90H10Z M30 30V70H70V30Z"/>') };
    function Fixture() {
      const [elements,setElements] = useState([bottom,top]);
      const [selected,select] = useState('top');
      window.selectionState = { elements, selected };
      window.patchTop = patch => setElements(items => items.map(item => item.id === 'top' ? {...item,...patch} : item));
      window.selectLayer = select;
      window.resetSelection = () => { setElements([bottom,top]); select('top'); };
      window.groupSelection = () => { setElements([bottom,{...top,type:'group',groupSourceWidth:300,groupSourceHeight:300,children:[{...top,id:'child',x:150,y:150}]}]); select(null); };
      window.textSelection = () => { setElements([bottom,{...top,type:'text',content:'OO',fontFamily:'Arial',fontSize:100,color:'#ff0000',autoHeight:false,height:130}]); select(null); };
      window.artworkHit = (x,y) => artworkAtPoint(document.querySelector('[data-print-design-zone]'),x,y)?.dataset.printId ?? null;
      window.assetPoint = (u,v,id='top') => {
        const el = elements.find(item => item.id === id);
        const zone = document.querySelector('[data-print-design-zone]');
        const zr = zone.getBoundingClientRect();
        const root = document.querySelector('[data-print-id="'+id+'"]');
        const p = quadMap(el.perspective).project({x:u,y:v});
        const a = el.rotation*Math.PI/180, dx=(p.x-.5)*root.offsetWidth, dy=(p.y-.5)*root.offsetHeight;
        return {x:zr.x+(el.x+dx*Math.cos(a)-dy*Math.sin(a))*zr.width/zone.offsetWidth, y:zr.y+(el.y+dx*Math.sin(a)+dy*Math.cos(a))*zr.height/zone.offsetHeight};
      };
      return <PrintsDesignPreview assetMode editable canvasSize={{width:700,height:640}} className="h-full w-full" elements={elements} onChange={setElements} selectedLayerId={selected} onSelectedLayerIdChange={select} />;
    }
    createRoot(document.getElementById('root')).render(<PrintsStudioProvider><Fixture/></PrintsStudioProvider>);
  ` }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl' }, logLevel: 'silent',
});
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1100,height:850}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/__artwork-selection',route=>route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/styles/index.css?direct"><style>body{margin:0}#root{width:700px;height:640px;margin:80px}</style><div id="root"></div>'}));
  await page.goto(baseUrl+'/__artwork-selection');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const point = (u,v,id) => page.evaluate(([u,v,id])=>window.assetPoint(u,v,id),[u,v,id]);
  const waitHit = async (p,id) => page.waitForFunction(({p,id})=>window.artworkHit(p.x,p.y)===id,{p,id});
  const clickAt = async (p,id) => {
    await waitHit(p,id);
    await page.mouse.click(p.x,p.y);
    await page.waitForFunction(id=>window.selectionState.selected===id,id);
  };
  await page.locator('[data-print-id="top"]').waitFor();
  const ring=await point(.2,.5),hole=await point(.5,.5);
  await clickAt(hole,'bottom');
  await clickAt(ring,'top');
  assert.equal(await page.locator('[data-print-id="top"] [data-handles]').count(),1,'Only the proper transform overlay exists');
  assert.equal(await page.locator('[data-print-id="bottom"] [data-handles]').count(),0);
  assert.equal(await page.locator('[data-print-id="top"]').evaluate(node=>getComputedStyle(node).pointerEvents),'none');
  const tight=await page.locator('[data-print-id="top"] [data-visible-bounds]').boundingBox();
  assert(Math.abs(tight.width-240)<3,JSON.stringify(tight));
  await page.mouse.move(ring.x,ring.y); await page.mouse.down();
  assert.equal(await page.locator('[data-print-id="top"]').evaluate(node=>getComputedStyle(node).boxShadow),'none','Dragging must not add a second red box');
  await page.mouse.move(ring.x+20,ring.y+15,{steps:4}); await page.mouse.up();
  await page.waitForFunction(()=>window.selectionState.elements[1].x!==350);
  assert.equal(await page.locator('[data-print-id="top"] [data-handles]').count(),1);
  await page.evaluate(()=>window.resetSelection());
  await page.evaluate(()=>window.patchTop({width:500,height:500}));
  await waitHit(await point(.2,.5),'top');
  const oldRing=await point(.2,.5);
  await page.evaluate(()=>window.patchTop({width:120,height:120}));
  await clickAt(oldRing,'bottom');
  await clickAt(await point(.2,.5),'top');
  assert((await page.locator('[data-print-id="top"] [data-visible-bounds]').boundingBox()).width<100);
  const resize = await page.getByRole('button',{name:'Resize SE — scale',exact:true}).boundingBox();
  await page.mouse.move(resize.x+resize.width/2,resize.y+resize.height/2); await page.mouse.down();
  await page.mouse.move(resize.x+resize.width/2+24,resize.y+resize.height/2+24,{steps:4}); await page.mouse.up();
  await page.waitForFunction(()=>window.selectionState.elements[1].width>120);
  for (const patch of [
    {width:300,height:300,rotation:37},
    {rotation:-28,perspective:[{x:.1,y:.1},{x:.9,y:0},{x:1,y:.9},{x:0,y:1}]},
  ]) {
    await page.evaluate(patch=>window.patchTop(patch),patch);
    await clickAt(await point(.5,.5),'bottom');
    await clickAt(await point(.2,.5),'top');
  }
  await page.evaluate(()=>window.patchTop({rotation:0,perspective:undefined,cropLeft:50}));
  await clickAt(await point(.2,.5),'bottom');
  await clickAt(await point(.8,.5),'top');
  await page.evaluate(()=>window.patchTop({cropLeft:0,warp:{mode:'preset',preset:'wave',bend:45,horizontalDistortion:0,verticalDistortion:0,gridSize:3,points:[]}}));
  await page.locator('[data-warp-canvas]').waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-warp-canvas]')?.width>0);
  // Search visible warped pixels through the same live registry used by pointer selection.
  const warpedPoint=await page.waitForFunction(()=>{
    for(let y=.1;y<.9;y+=.05) for(let x=.1;x<.9;x+=.05){const p=window.assetPoint(x,y);if(window.artworkHit(p.x,p.y)==='top')return p;}
    return false;
  });
  await clickAt(await warpedPoint.jsonValue(),'top');
  await page.evaluate(()=>window.groupSelection());
  await clickAt(await point(.5,.5),'bottom');
  await clickAt(await point(.2,.5),'top');
  await page.evaluate(()=>window.patchTop({width:100,height:100}));
  await clickAt(await point(.2,.5),'top');
  assert((await page.locator('[data-print-id="top"] > [data-visible-bounds]').boundingBox()).width<85);
  await page.evaluate(()=>window.textSelection());
  const textPoint = await page.waitForFunction(()=>{
    for(let y=.1;y<.9;y+=.05) for(let x=.1;x<.9;x+=.05){const p=window.assetPoint(x,y);if(window.artworkHit(p.x,p.y)==='top')return p;}
    return false;
  });
  const textPixel = await textPoint.jsonValue();
  await clickAt(textPixel,'top');
  await page.mouse.click(textPixel.x,textPixel.y);
  await page.locator('textarea').waitFor();
  await page.locator('textarea').fill('EDITABLE');
  await page.mouse.click(90,700);
  await page.waitForFunction(()=>window.selectionState.elements[1].content==='EDITABLE');
  await page.evaluate(()=>window.resetSelection());
  await page.evaluate(()=>window.patchTop({warp:undefined,content:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>')}));
  await clickAt(await point(.8,.5),'bottom');
  await page.mouse.click(90,700);
  await page.waitForFunction(()=>window.selectionState.selected===null);
  assert.equal(await page.locator('[data-handles]').count(),0);
  assert.deepEqual(errors,[]);
  console.log('Artwork selection passed: painted-pixel stacking, transparent holes, one transform box, no drag ring, large-to-small resize, drag/resize controls, rotation, perspective, crop, warp and deselection.');
} finally { await browser.close(); }
