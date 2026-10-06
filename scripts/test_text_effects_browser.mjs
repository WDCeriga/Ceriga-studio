import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import sharp from 'sharp';

const base = process.env.CERIGA_BASE_URL || 'http://127.0.0.1:5189';
const bundle = await build({
  stdin: { loader: 'tsx', resolveDir: process.cwd(), contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { toCanvas } from 'html-to-image';
    import { TextArtwork } from './src/app/components/builder/printsStudio/TextArtwork';
    import { TextEffectsPanel } from './src/app/components/builder/printsStudio/TextEffectsPanel';
    import { DesignAssetSurface } from './src/app/components/builder/printsStudio/DesignAssetSurface';
    import { DesignGroupArtwork } from './src/app/components/builder/printsStudio/DesignGroupArtwork';
    import { TEXT_EFFECTS, createTextEffect } from './src/app/lib/textEffects';
    import { waitForImageFilters } from './src/app/lib/imageFilterRendering';
    import { exportAssetArtboard } from './src/app/lib/exportAssetArtboard';
    import { createWarpSettings } from './src/app/lib/warpGeometry';
    const root = createRoot(document.getElementById('root'));
    window.effectsCatalog = TEXT_EFFECTS;
    window.makeEffect = (type, patch = {}) => ({...createTextEffect(type),id:type,seed:42,...patch});
    window.renderText = (patch = {}, grouped = false, panel = false) => {
      const child = { id:'text',type:'text',content:'CERIGA',x:256,y:256,width:300,height:100,fontSize:58,fontFamily:'Arial',fontWeight:'bold',color:'#cb8580',rotation:0,...patch };
      const element = grouped ? {id:'group',type:'group',content:'',x:256,y:256,width:512,height:512,rotation:0,children:[child],groupSourceWidth:512,groupSourceHeight:512,warp:typeof grouped==='object'?grouped:undefined} : child;
      window.textElement = element;
      window.textPatch = patch;
      flushSync(()=>root.render(<><div id="capture" data-asset-artboard style={{position:'relative',width:512,height:512}}><div data-print-id={element.id} style={{position:'absolute',left:grouped?0:106,top:grouped?0:206,width:element.width,height:grouped?512:undefined}}><DesignAssetSurface element={element} selected={false} scale={1} onChange={()=>{}} overlay={null}>{grouped?<DesignGroupArtwork element={element}/>:<TextArtwork element={element} fontSize={element.fontSize}/>}</DesignAssetSurface></div></div>{panel?<div id="panel"><TextEffectsPanel element={child} onChange={updates=>window.renderText({...window.textPatch,...updates},false,true)}/></div>:null}</>));
    };
    window.captureText = async () => {
      const node=document.getElementById('capture');
      await waitForImageFilters(node,30000);
      await document.fonts.ready;
      const canvas=await toCanvas(node,{width:512,height:512,pixelRatio:1,skipFonts:true,filter:n=>!(n instanceof Element)||!n.matches('[data-editor-chrome]')});
      const pixels=canvas.getContext('2d').getImageData(0,0,512,512).data;
      let binary='';for(let i=0;i<pixels.length;i+=32768)binary+=String.fromCharCode(...pixels.subarray(i,i+32768));
      return btoa(binary);
    };
    window.exportText = () => exportAssetArtboard(512,512,[window.textElement]);
    window.warpSettings = createWarpSettings();
  ` },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'import.meta.url': JSON.stringify(`${base}/src/app/lib/textEffectRendering.ts`) },
});
const diff = (a,b) => a.reduce((sum,value,index)=>sum+Math.abs(value-b[index]),0)/a.length;
const hash = pixels => Buffer.from(pixels).toString('base64');
const browser = await chromium.launch({ channel:'msedge',headless:true });
try {
  const page = await browser.newPage({ viewport:{width:1440,height:1000},deviceScaleFactor:1 });
  page.setDefaultTimeout(30000);
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  await page.setContent('<style>body{margin:0}.relative{position:relative}.absolute{position:absolute}.w-full{width:100%}.h-full{height:100%}.h-auto{height:auto}.opacity-0{opacity:0}.overflow-visible{overflow:visible}.block{display:block}.min-w-0{min-width:0}.max-w-full{max-width:100%}.font-semibold{font-weight:600}#panel{width:360px;background:#151515;color:white}canvas{max-width:none}</style><div id="root"></div>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const effect=(type,patch={})=>page.evaluate(({type,patch})=>window.makeEffect(type,patch),{type,patch});
  const render=async(patch={},grouped=false,panel=false)=>Buffer.from(await page.evaluate(async({patch,grouped,panel})=>{window.renderText(patch,grouped,panel);return window.captureText();},{patch,grouped,panel}),'base64');
  const original=await render();
  assert(original.some((v,i)=>i%4===3&&v>0),'Text renders');
  const catalog=await page.evaluate(()=>window.effectsCatalog);
  assert.equal(catalog.length,34);
  const outputs=[];
  for(const entry of catalog){
    if(['image-fill','texture-fill'].includes(entry.id)) continue;
    const fx=await effect(entry.id);
    const pixels=await render({textEffects:[fx]});
    assert(diff(original,pixels)>.005,`${entry.id} changes actual text pixels`);
    assert.equal(pixels[3],0,`${entry.id} retains transparent artboard corners`);
    outputs.push(hash(pixels));
  }
  assert.equal(new Set(outputs).size,outputs.length,'Effects have distinct output');
  const chrome=await effect('chrome');
  const distress=await effect('distressed');
  const extrude=await effect('extrude');
  assert((await render({textEffects:[{...chrome,intensity:0}]})).equals(original),'Zero bypasses derived rendering');
  assert((await render({textEffects:[{...chrome,enabled:false}]})).equals(original),'Hidden effects bypass rendering');
  const stack=await render({textEffects:[chrome,distress,extrude]});
  const reordered=await render({textEffects:[extrude,chrome,distress]});
  assert(diff(stack,reordered)>.01,'Effect order changes construction');
  assert(diff(stack,await render({content:'COLLECTION 01',textEffects:[chrome,distress,extrude]}))>.1,'Edited text recalculates effects');
  for(const patch of [{textCurveAmount:65,textCurveShape:'arc'},{verticalText:true},{textFillMode:'fill-outline',borderWidth:2,borderColor:'#fff',textUnderline:true},{letterSpacing:4,lineSpacing:150,content:'CERIGA\nSTUDIO'}]){
    const plain=await render(patch);
    const styled=await render({...patch,textEffects:[chrome]});
    assert(diff(plain,styled)>.01,'Effects follow text layout and decorations');
    const a=plain.filter((v,i)=>i%4===3).reduce((s,v)=>s+v,0);
    const b=styled.filter((v,i)=>i%4===3).reduce((s,v)=>s+v,0);
    assert(Math.abs(a-b)/a<.08,'Material effect preserves glyph silhouette');
  }
  const warp=await page.evaluate(()=>window.warpSettings);
  const warped=await render({textEffects:[chrome,extrude],warp});
  assert(diff(warped,await render({textEffects:[distress,extrude],warp}))>.01,'Warp recaptures effect edits');
  const nested=await render({textEffects:[chrome,extrude],warp},warp);
  assert(diff(nested,await render({textEffects:[distress,extrude],warp},warp))>.01,'Nested warp awaits text pixels');
  const forExport=await render({textEffects:[chrome,extrude]});
  const encoded=await page.evaluate(()=>window.exportText());
  const png=await sharp(Buffer.from(encoded.split(',')[1],'base64')).ensureAlpha().raw().toBuffer();
  assert(diff(forExport,png)<.15,'Artboard export preserves effect overflow');
  const image='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><path fill="#f40" d="M0 0h32v64H0z"/><path fill="#04f" d="M32 0h32v64H32z"/></svg>').toString('base64');
  const maskedReference=await render({textEffects:[chrome]});
  for(const type of ['image-fill','texture-fill']){
    const fx=await effect(type,{source:image});
    const filled=await render({textEffects:[fx]});
    assert(diff(filled,original)>.01,`${type} fills glyphs`);
    for(let i=3;i<maskedReference.length;i+=4) assert(filled[i]<=maskedReference[i]+2,`${type} clips to text alpha at pixel ${i}: ${filled[i]} > ${maskedReference[i]}`);
  }
  const finalFrame=await render({textEffects:[{...chrome,intensity:73}]});
  const expectedPixels=await page.locator('[data-text-effects-canvas]').evaluate(canvas=>canvas.toDataURL());
  const rapid=await page.evaluate(async chrome=>{
    for(let intensity=5;intensity<100;intensity+=7){window.renderText({textEffects:[{...chrome,intensity}]});await new Promise(resolve=>setTimeout(resolve,5));}
    window.renderText({textEffects:[{...chrome,intensity:73}]});return window.captureText();
  },chrome);
  const latestPixels=await page.locator('[data-text-effects-canvas]').evaluate(canvas=>canvas.toDataURL());
  assert.equal(latestPixels===expectedPixels,true,'Newest slider value wins over queued renders');
  assert(diff(Buffer.from(rapid,'base64'),finalFrame)<.02,'Latest result remains visible in capture');
  await page.evaluate(chrome=>{
    window.originalRead=CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData=function(){throw new Error('Simulated capture failure');};
    window.renderText({content:'RETRY',textEffects:[chrome]});
  },chrome);
  await page.locator('[data-text-effects-error]').waitFor();
  await page.evaluate(chrome=>{
    CanvasRenderingContext2D.prototype.getImageData=window.originalRead;
    window.renderText({content:'RETRY',textEffects:[{...chrome,intensity:64}]});
  },chrome);
  assert.equal(await page.locator('[data-text-effects-error]').count(),1,'Capture error persists across effect edits');
  await assert.rejects(page.evaluate(()=>window.captureText()),/Text effects could not be rendered/,'Export must not silently omit failed effects');
  await page.getByRole('button',{name:'Retry effects',exact:true}).click();
  await page.evaluate(()=>window.captureText());
  assert.equal(await page.locator('[data-text-effects-error]').count(),0,'Retry recaptures source');
  await render({textEffects:[chrome,distress]},false,true);
  const panel=page.locator('#panel');
  await panel.locator('summary').filter({hasText:/^Effects/}).click();
  assert.equal(await panel.locator('canvas').count(),34,'Visual effect gallery');
  await panel.getByRole('button',{name:'Original / No effects',exact:true}).click();
  assert.equal(await page.locator('[data-text-effects]').count(),0,'Removing effects restores native editable text');
  await render({textEffects:[chrome],locked:true},false,true);
  assert(await panel.getByRole('button',{name:'Add Chrome effect',exact:true}).isDisabled(),'Locked text cannot add effects');
  assert(await panel.getByLabel('Effect intensity',{exact:true}).isDisabled(),'Locked text cannot modify effects');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Text effects browser: 34 presets, stacking, live text/layout, masks, nested warp, transparent export, latest-only updates, retry and locked controls passed.');
} finally { await browser.close(); }
