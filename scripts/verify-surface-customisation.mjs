import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
await mkdir('node_modules/.cache/surface-checks',{recursive:true});
const outfile='node_modules/.cache/surface-checks/design.mjs';
await build({stdin:{contents:`export * from './src/app/lib/surfaceDesign';export * from './src/app/lib/embedSurfaceFonts';export * from './src/app/data/garmentLabels';export * from './src/app/data/packaging';export * from './src/app/components/builder/SurfaceDesign';`,resolveDir:process.cwd()},outfile,bundle:true,platform:'node',format:'esm',jsx:'automatic',loader:{'.woff':'dataurl','.woff2':'dataurl','.ttf':'dataurl'},external:['react','react/jsx-runtime'],logLevel:'silent'});
const api=await import(pathToFileURL(process.cwd()+'/'+outfile));
const {renderToStaticMarkup}=await import('react-dom/server');const {createElement}=await import('react');
for(const shape of ['rect','rounded-rect','ellipse','triangle','diamond','star','polygon']){const path=api.surfaceShapePath(42,18,{shape,cornerRadius:3});assert(path.length>20);assert(!/NaN|Infinity|undefined/.test(path));}
assert.notEqual(api.surfaceShapePath(42,18,{cornerRadius:0}),api.surfaceShapePath(42,18,{cornerRadius:4}));
const appearance={shape:'ellipse',pattern:'plaid',patternSize:7,patternAngle:30,patternColors:['#171717','#ffffff','#ff0000','#bbbbbb'],outlineWidth:1,outlineStyle:'dashed',opacity:65};
const svg=renderToStaticMarkup(createElement('svg',null,createElement(api.SurfaceDecoration,{width:42,height:18,fill:'#abcabc',appearance})));
assert(svg.includes('<pattern'));assert(svg.includes('rotate(30)'));assert(svg.includes('opacity="0.65"'));assert(svg.includes('stroke-dasharray="3 2"'));assert(svg.includes('data:image/svg+xml'));
const text=renderToStaticMarkup(createElement('svg',null,createElement(api.SurfaceText,{text:'Studio',x:20,y:10,size:4,font:'Bungee',weight:700,color:'#171717',options:{tracking:.5,fontStyle:'italic',underline:true,transform:'uppercase',outlineWidth:.3}})));
for(const expected of ['STUDIO','Bungee','font-weight="700"','font-style="italic"','letter-spacing="0.5"','text-decoration="underline"','stroke-width="0.6"'])assert(text.includes(expected),expected);
const label=api.createGarmentLabel('hand');label.designSections=[{id:'s',x:0,y:0,width:20,height:12,text:'Studio',font:'Bungee',fontSizeMm:4,fontWeight:700,background:'#ffffff',color:'#000000',appearance,textOptions:{tracking:.5,underline:true},align:'left'}];
const normalized=api.normalizeLabel(label);assert.deepEqual(normalized.designSections[0].appearance,appearance);assert.equal(normalized.designSections[0].textOptions.tracking,.5);
const back=api.switchTagFace(normalized,'back'),front=api.switchTagFace(back,'front');assert.deepEqual(front.designSections,normalized.designSections,'Tag faces must preserve the custom design');
const design=api.createPackagingDesign('folding');const panel=design.selectedPanel;design.elements=[{id:'s',kind:'section',panel,x:80,y:40,width:80,height:30,rotation:0,name:'Shape',content:'',font:'Bungee',fontSize:5,color:'#fff',align:'center',appearance,textOptions:{tracking:.5}}];
assert.deepEqual(api.normalizePackagingDesign(design).elements[0].appearance,appearance);
assert.deepEqual(JSON.parse(JSON.stringify(normalized)).designSections[0].appearance,appearance);
console.log('PASS: seven vector shapes, real pattern/outline/opacity SVG, text styling, label normalisation, independent tag faces and packaging save persistence');

const standalone=await api.embedSurfaceFonts(text);assert(standalone.includes('@font-face'));assert(/src:url\("data:/.test(standalone));assert(standalone.includes('font-family:"Bungee"'));console.log('PASS: exported clothing fonts are embedded into standalone SVG');

const upper={...normalized,brand:'Studio brand',blocks:api.labelBlocks(normalized).map(block=>block.key==='brand'?{...block,enabled:true,textOptions:{transform:'uppercase'}}:block)};assert.equal(api.labelTextSections(upper).find(s=>s.key==='brand').text,'STUDIO BRAND');
