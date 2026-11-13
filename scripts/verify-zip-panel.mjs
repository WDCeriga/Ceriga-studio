import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {surfaceRuntime} from './surface-test-runtime.mjs';
globalThis.window={innerWidth:1280};
const {api}=await surfaceRuntime(`export {GarmentDetailsPanel} from './src/app/components/builder/GarmentDetails';export {createGarmentDetail,GARMENT_DETAIL_OPTIONS} from './src/app/data/garmentDetails';`);
const originalError=console.error;console.error=(message,...args)=>{if(typeof message==='string'&&message.startsWith('Warning: useLayoutEffect does nothing on the server'))return;originalError(message,...args)};
for(const variant of api.GARMENT_DETAIL_OPTIONS.zip){
 const zip=api.createGarmentDetail('zip',[],'#5C7FB6',variant.id);
 const html=renderToStaticMarkup(React.createElement(api.GarmentDetailsPanel,{details:[zip],selectedId:zip.id,onSelect(){},onChange(){},color:'#5C7FB6',view:'front'}));
 assert(html.includes('aria-label="Detail name"'),variant.id+' renders zip name control');
 assert(!html.includes('aria-label="Patch name"'),variant.id+' does not render a stray patch field');
}

console.log(`PASS all ${api.GARMENT_DETAIL_OPTIONS.zip.length} selected zip variants render without undefined detail references.`);

for(const type of ['pocket','zip','button','patch']){
 const detail={...api.createGarmentDetail(type,[],'#5C7FB6'),name:'Custom '+type};
 const html=renderToStaticMarkup(React.createElement(api.GarmentDetailsPanel,{details:[detail],selectedId:detail.id,onSelect(){},onChange(){},color:'#5C7FB6',view:'front'}));
 assert.equal((html.match(/aria-label="Detail name"/g)||[]).length,1,type+' has one name editor');
 assert(html.includes('value="Custom '+type+'"'),type+' displays its saved custom name');
}
console.log('PASS pockets, zips, buttons and patches each expose one shared rename field.');

console.error=originalError;
