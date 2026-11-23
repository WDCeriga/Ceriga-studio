import { localeMocks } from './support/localeMocks.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';
import * as Icons from 'lucide-react';
import { transformWithEsbuild } from 'vite';

const result = await build({entryPoints:['src/app/i18n/i18n.ts'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external'});
const localeModule={exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(((original)=>specifier=>{if(/\/i18n\/i18n$/.test(specifier)){let actual;try{actual=original(specifier)}catch{}if(!actual)return localeMocks['../../i18n/i18n'];for(const [key,value]of Object.entries(localeMocks['../../i18n/i18n']))if(!(key in actual))actual[key]=value;return actual}return original(specifier)})(createRequire(import.meta.url)),localeModule,localeModule.exports);
const {i18n,prepareLanguage}=localeModule.exports;
const helpers={exports:{}};
new Function('module','exports',(await transformWithEsbuild(await fs.readFile('src/app/lib/manufacturerOrderView.ts','utf8'),'helper.ts',{format:'cjs'})).code)(helpers,helpers.exports);
const view={exports:{}};
const imports={
  react:{...React,useMemo:callback=>callback()},
  'react-router':{Link:({to,children,...props})=>React.createElement('a',{...props,href:to},children)},
  'lucide-react':Icons,
  '../../lib/manufacturerOrderView':helpers.exports,
  '../../data/orderQuantities':{formatOrderQuantitiesSummary:()=>[]},
  '../../i18n/i18n':{...localeModule.exports,useCerigaTranslation:()=>({
    t:(key,options)=>i18n.t(key,options),
    label:text=>{
      const english=i18n.getResourceBundle('en','translation');
      const entry=Object.entries(english).flatMap(([section,values])=>Object.entries(values).map(([key,value])=>[section+'.'+key,value])).find(([,value])=>value===text);
      return entry?i18n.t(entry[0]):text;
    },
  })},
};
const path='src/app/components/manufacturer/ManufacturerOrdersView.tsx';
new Function('React','require','module','exports',(await transformWithEsbuild(await fs.readFile(path,'utf8'),path,{format:'cjs'})).code)(React,((original)=>specifier=>{if(/\/i18n\/i18n$/.test(specifier)){let actual;try{actual=original(specifier)}catch{}if(!actual)return localeMocks['../../i18n/i18n'];for(const [key,value]of Object.entries(localeMocks['../../i18n/i18n']))if(!(key in actual))actual[key]=value;return actual}return original(specifier)})(name=>name.endsWith('.css')?{}:imports[name]),view,view.exports);
const props={orders:[{id:'fixture',kind:'production',status:'submitted',factoryStatus:'new',productName:'Customer entered name',garmentType:'T-shirt',orderDate:'2026-11-10',dueQuoteBy:'2026-11-15',priceOptions:[{id:'sample',totalUnits:12}],selectedPriceOptionId:'sample'}],loading:false,error:'',permissions:['quote'],onRefresh:()=>{},quotationOnly:true};
const render=patch=>renderToStaticMarkup(React.createElement(view.exports.ManufacturerOrdersView,{...props,...patch}));
for(const language of ['en','zh-CN','tr','pt','es','fr']){
  await prepareLanguage(language);
  await i18n.changeLanguage(language);
  const dictionary=i18n.getResourceBundle(language,'translation');
  const html=render({});
  for(const key of ['introQuotes','newRequests','feedback','sortDue','attention','quoteFooter','autoUpdates','quotePlaceholder']) assert.ok(html.includes(dictionary.manufacturerOrders[key]),language+' '+key);
  assert.ok(html.includes(props.orders[0].productName));
  const empty=render({orders:[]});
  assert.ok(empty.includes(dictionary.manufacturerOrders.emptyQuotes));
  const loading=render({orders:[],loading:true});
  assert.ok(loading.includes(dictionary.manufacturerOrders.loadingQuotes));
  assert.ok(i18n.exists('manufacturerOrders.countQuotes',{count:2}));
}
console.log('PASS six languages translate quotation microcopy, sorting, placeholders, loading, empty states and footers while preserving user content');
