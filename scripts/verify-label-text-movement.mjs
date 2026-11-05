import assert from 'node:assert/strict';import{surfaceRuntime}from'./surface-test-runtime.mjs';
const{api}=await surfaceRuntime(`export * from './src/app/data/garmentLabels';export * from './src/app/lib/surfaceMigration';export * from './src/app/lib/svgPrecision';export * from './src/app/lib/surfaceDocumentEditing';export {renderArtworkDocumentToSvg} from './src/app/components/builder/ArtworkSurfaceSvg';`);
const label=api.createGarmentLabel('neck'),value=api.readLabelSurface(label),word=value.document.elements.find(e=>e.type==='text'&&e.content==='BRAND'),original=JSON.stringify(word),moved={...word,x:word.x+4,y:word.y+3};assert(api.precisionLayoutChanged(moved));assert(!api.precisionLayoutChanged(word));
const source=api.precisionMarkup(word,true),free=api.precisionMarkup(moved,true),dom=new DOMParser().parseFromString(free,'image/svg+xml');assert.equal(Array.from(dom.getElementsByTagName('*')).filter(n=>n.localName!=='defs'&&n.hasAttribute('clip-path')).length,0,'Moved text must not carry its old content-zone clips');assert(source.includes('clip-path='),'Untouched legacy clips must remain unchanged');assert.equal(JSON.stringify(word),original);
const document=api.editSurfaceDocument(value,value.document.elements.map(e=>e.id===word.id?moved:e)),svg=await api.renderArtworkDocumentToSvg(value.surface,document);assert(svg.includes('-outline'),'Physical label cut remains enforced');const refreshed=api.readLabelSurface(JSON.parse(JSON.stringify(api.saveLabelSurface(label,{...value,document}))));assert.equal(refreshed.document.elements.find(e=>e.id===word.id).y,moved.y);console.log('PASS: moved text escapes old section clipping; original clips, actual label cut, editable text and saved position preserved');

const longer={...word,content:'A MUCH LONGER BRAND NAME'};assert(api.precisionTextChanged(longer));
const longerSvg=api.precisionMarkup(longer,true),longerDom=new DOMParser().parseFromString(longerSvg,'image/svg+xml');
assert.equal(Array.from(longerDom.getElementsByTagName('*')).filter(n=>n.localName!=='defs'&&n.hasAttribute('clip-path')).length,0,'Edited wording must escape stale imported text bounds');
assert(api.precisionMarkup(word,true).includes('clip-path='),'Unedited imported text retains its original rendering');
console.log('PASS: longer edited text escapes stale source clipping without changing untouched artwork');

const scaled={...word,width:word.width*2,height:word.height*2,fontSize:word.fontSize*2};
const scaledDom=new DOMParser().parseFromString(api.precisionMarkup(scaled,true),'image/svg+xml');
assert.equal(scaledDom.getElementsByTagName('text')[0].getAttribute('font-size'),word.svgPrecision.node.attrs['font-size'],'Proportional resize uses the geometry scale once, without doubling the font scale');
console.log('PASS: proportional imported text resize scales glyphs once');
