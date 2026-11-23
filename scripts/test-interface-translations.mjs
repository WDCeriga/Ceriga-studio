import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const {outputFiles}=await build({entryPoints:['src/app/i18n/i18n.ts'],bundle:true,platform:'node',format:'cjs',write:false,packages:'external'});
const module={exports:{}};new Function('require','module','exports',outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const {i18n,prepareLanguage,translateInterface,translateInterfaceLabel,activeLocale,weekdayLabel}=module.exports;
const codes=['en','zh-CN','tr','pt','es','fr'];
const english=JSON.parse(await fs.readFile('src/app/i18n/locales/en.json','utf8'));
const keyFor=text=>Object.entries(english).flatMap(([section,values])=>Object.entries(values).map(([key,value])=>[value,section+'.'+key])).find(([value])=>value===text)?.[1];
const smallCopy=['Review requests, revisions and sent quotes.','Quotation due soonest','New and in-progress requests','Create Order','Every order in view. A clear next step for each.','Across the order workflow','New orders and reassignments','Ready for your decision','Multiple quotation options','Measurement','Fabric & Colour','Neck / Collar','Sleeves','Hem & Cuffs','Fading','Stitching','Labels','Packaging','Neckline','Full chat history','Email support','No monthly commitment'];
const sourceData={customer:'Taylor Çelik 王',product:'Customer-designed shirt',amount:12345,currency:'EUR',quantity:87,field:'sampleLeadTimeMinDays',message:'Original customer manufacturing instructions.'};
const snapshot=structuredClone(sourceData);
for(const code of codes){await prepareLanguage(code);await i18n.changeLanguage(code);for(const text of smallCopy){const key=keyFor(text);assert.ok(key,text);const translated=translateInterfaceLabel(text);assert.equal(translated,translateInterface(key));if(code!=='en')assert.notEqual(translated,text,code+' '+text);}
 for(const name of ['Maya Chen','Euro Stitch Co','Urban Layer Ltd'])assert.equal(translateInterfaceLabel(name),name);assert.equal(weekdayLabel(0),new Intl.DateTimeFormat(activeLocale(),{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2024,0,1))));assert.equal(translateInterfaceLabel(sourceData.customer),sourceData.customer);assert.equal(translateInterfaceLabel(sourceData.product),sourceData.product);assert.equal(translateInterfaceLabel(sourceData.message),sourceData.message);assert.equal(translateInterfaceLabel(sourceData.field),sourceData.field);
 for(const text of ['1 units','100 units','28d waiting']){const value=translateInterfaceLabel(text);assert.ok(!value.includes('{{'));if(code!=='en')assert.notEqual(value,text,code+' '+text);}
 const statusKey=keyFor('In production');assert.equal(translateInterfaceLabel('in_production'),translateInterface(statusKey));
 const templateKey=keyFor('Enter a valid {{value0}} lead-time range (1–3650 days).');assert.ok(templateKey);const formatted=translateInterfaceLabel('Enter a valid bulk lead-time range (1–3650 days).');assert.equal(formatted,translateInterface(templateKey,{value0:'bulk'}));
 assert.ok(!formatted.includes('{{'));assert.equal(new Intl.NumberFormat(activeLocale(),{style:'currency',currency:'EUR'}).format(sourceData.amount/100),new Intl.NumberFormat({en:'en-GB','zh-CN':'zh-CN',tr:'tr-TR',pt:'pt-PT',es:'es-ES',fr:'fr-FR'}[code],{style:'currency',currency:'EUR'}).format(123.45));assert.deepEqual(sourceData,snapshot);
}
const leadTimes=await fs.readFile('src/app/pages/manufacturer/onboarding/ProductionLeadTimes.tsx','utf8');assert.match(leadTimes,/kind === 'sample' \? "sampleLeadTimeMinDays" : "bulkLeadTimeMinDays"|kind === 'sample' \? 'sampleLeadTimeMinDays' : 'bulkLeadTimeMinDays'/);
const chart=await fs.readFile('src/app/components/ui/chart.tsx','utf8');assert.doesNotMatch(chart,/key = cerigaTranslate/);
console.log('PASS six-language microcopy, runtime system templates, status labels, locale formatting, source data preservation and protected field identifiers.');

import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const gridBuild=await build({entryPoints:['src/app/components/builder/TshirtAssetChoiceGrid.tsx'],bundle:false,format:'cjs',write:false});
const gridModule={exports:{}};
const assets=[{id:'neckline/Untitled_Artwork-1',displayName:'Untitled_Artwork-1'}];
new Function('React','require','module','exports',gridBuild.outputFiles[0].text)(React,name=>{
 if(name.endsWith('/i18n/i18n'))return {...module.exports,useCerigaTranslation:()=>({})};
 if(name.endsWith('/garmentSvgCatalog'))return {getGarmentAssets:()=>assets,isGarmentCategoryOptional:()=>false};
 if(name.endsWith('/ui/label'))return {Label:({children,...props})=>React.createElement('label',props,children)};
 if(name.endsWith('/ui/utils'))return {cn:(...values)=>values.join(' ')};
 throw Error('Unexpected grid import '+name);
},gridModule,gridModule.exports);
for(const code of codes){await prepareLanguage(code);await i18n.changeLanguage(code);let selection;
 const tree=gridModule.exports.GarmentAssetChoiceGrid({garmentType:'tshirt',category:'neckline',selected:assets[0].id,onSelect:id=>selection=id});
 const html=renderToStaticMarkup(tree);assert.doesNotMatch(html,/Untitled_Artwork/);assert.ok(html.includes(translateInterface('interface.garmentStyle',{number:1})));
 assert.equal(gridModule.exports.garmentAssetLabel('Customer supplied style'), 'Customer supplied style');
 const buttons=React.Children.toArray(tree.props.children)[1].props.children;
 buttons.flat().filter(Boolean).find(button=>button.key===assets[0].id||button.props?.onClick)?.props.onClick();assert.equal(selection,assets[0].id);
 if(code==='pt'){assert.match(html,/Estilo 1/);assert.equal(translateInterfaceLabel('Neck / Collar'),'Gola');}
}
console.log('PASS six-language catalogue placeholder labels and original asset selection IDs.');


const measurementBuild=await build({entryPoints:['src/app/components/builder/MeasurementsStep.tsx'],bundle:false,format:'cjs',write:false});
const fitNames=['Custom','Slim','Regular','Relaxed','Oversized'],fitIds=['custom','slim','regular','relaxed','oversized'];
const fitChoices=fitIds.map((id,i)=>({id,name:fitNames[i]}));const selectPart=()=>null;
const measurementsModule={exports:{}};
new Function('React','require','module','exports',measurementBuild.outputFiles[0].text)(React,name=>{
 if(name==='react')return {...React,useState:initial=>[initial,()=>{}]};
 if(name.endsWith('/i18n/i18n'))return {...module.exports,useCerigaTranslation:()=>({})};
 if(name.endsWith('/ui/select'))return {Select:selectPart,SelectContent:selectPart,SelectItem:selectPart,SelectTrigger:selectPart,SelectValue:selectPart};
 if(name.endsWith('/builderSteps'))return {fitOptions:fitChoices};
 if(name.endsWith('/measurements'))return {measurementUnitLabel:()=> 'cm'};
 if(name.endsWith('/garmentSvgCatalog'))return {resolveGarmentSvgType:()=> 'tshirt',getDefaultGarmentSelection:()=>({})};
 if(name.endsWith('/measurementGuides'))return {useResolvedMeasurementGuides:()=>[]};
 if(name.endsWith('/TshirtSvgPreview'))return {TshirtSvgPreview:()=>null};
 if(name.endsWith('/ui/input'))return {Input:()=>null};
 if(name.endsWith('/ui/label'))return {Label:()=>null};
 if(name.endsWith('/ui/utils'))return {cn:(...values)=>values.join(' ')};
 throw Error('Unexpected measurements import '+name);
},measurementsModule,measurementsModule.exports);
const flattenOptions=node=>!node||typeof node!=='object'?[]:[node,...React.Children.toArray(node.props?.children).flatMap(flattenOptions)];
for(const code of codes){await prepareLanguage(code);await i18n.changeLanguage(code);let selected;
 const tree=measurementsModule.exports.MeasurementsStep({garmentType:'tshirt',fit:'regular',onFitChange:value=>selected=value,measurements:{},onMeasurementChange:()=>{},measurementUnit:'cm',onMeasurementUnitChange:()=>{}}),nodes=flattenOptions(tree);
 const options=nodes.filter(node=>fitIds.includes(node.props?.value)&&typeof node.props?.children==='string');assert.equal(options.length,5);
 options.forEach((option,index)=>{assert.equal(option.props.value,fitIds[index]);assert.equal(option.props.children,translateInterfaceLabel(fitNames[index]));if(code!=='en')assert.notEqual(option.props.children,fitNames[index]);});
 const dropdown=nodes.find(node=>node.props?.onValueChange);assert.equal(dropdown.props.value,'regular');dropdown.props.onValueChange('slim');assert.equal(selected,'slim');
}
console.log('PASS real fit dropdown: all five options translated in six languages, selected value and change callbacks retain original IDs.');
const faqBuild=await build({entryPoints:['src/app/components/marketing/MarketingFaq.tsx'],bundle:false,format:'cjs',write:false});const faqModule={exports:{}};
new Function('React','require','module','exports',faqBuild.outputFiles[0].text)(React,name=>{
 if(name.endsWith('/i18n/i18n'))return {...module.exports,useCerigaTranslation:()=>({})};
 if(name==='lucide-react')return {ChevronDown:()=>null};
 if(name.endsWith('/ui/utils'))return {cn:(...values)=>values.join(' ')};
 throw Error('Unexpected FAQ import '+name);
},faqModule,faqModule.exports);
const faqQuestion='Do I have to finish every step in order?',faqAnswer='The builder suggests a logical order, but you can jump to steps you have already unlocked. Packaging-only skips garment steps entirely.';
for(const code of codes){await prepareLanguage(code);await i18n.changeLanguage(code);const html=renderToStaticMarkup(React.createElement(faqModule.exports.MarketingFaq,{title:'Frequently asked questions',items:[{q:faqQuestion,a:faqAnswer}]}));if(code!=='en'){assert.ok(!html.includes(faqQuestion),code+' FAQ question');assert.ok(!html.includes(faqAnswer),code+' FAQ answer');}assert.equal(translateInterfaceLabel('Private saved design name'), 'Private saved design name');}
console.log('PASS actual public FAQ rendering in six languages, with original customer content preserved.');
const pricingBuild=await build({entryPoints:['src/app/pages/PricingPage.tsx'],bundle:false,format:'cjs',write:false});const pricingModule={exports:{}};
new Function('React','require','module','exports',pricingBuild.outputFiles[0].text)(React,name=>{
 if(name.endsWith('/i18n/i18n'))return {...module.exports,useCerigaTranslation:()=>({t:translateInterface})};
 if(name.endsWith('/accountCurrency'))return {useCurrency:()=>({}),displayMoney:(cents,currency)=>new Intl.NumberFormat(activeLocale(),{style:'currency',currency}).format(cents/100)};
 if(name==='react-router')return {Link:({children,to,...props})=>React.createElement('a',{href:to,...props},children)};
 if(name==='lucide-react')return {Check:()=>null,MessageSquare:()=>null};
 if(name.endsWith('/marketing/MarketingFaq'))return faqModule.exports;
 if(name.endsWith('/marketing/MarketingShell'))return {MarketingShell:({children})=>React.createElement('main',null,children),MarketingPageHeader:({title,subtitle})=>React.createElement('header',null,title,subtitle)};
 throw Error('Unexpected pricing import '+name);
},pricingModule,pricingModule.exports);
for(const code of codes){await prepareLanguage(code);await i18n.changeLanguage(code);const html=renderToStaticMarkup(React.createElement(pricingModule.exports.PricingPage));if(code!=='en')for(const text of ['Full chat history','Image attachments in chat','No monthly commitment','Do tech packs require a subscription?'])assert.ok(!html.includes(text),code+' pricing '+text);assert.ok(html.includes('Studio'));}
console.log('PASS full public pricing component in all six languages, including feature lists and FAQ.');

for(const code of codes){await prepareLanguage(code);await i18n.changeLanguage(code);const name='Premium Cotton T-Shirt';assert.equal(module.exports.translateProjectTitle(name,name),translateInterfaceLabel(name));if(code!=='en')assert.notEqual(module.exports.translateProjectTitle(name,name),name);assert.equal(module.exports.translateProjectTitle('My summer tee',name),'My summer tee');assert.equal(module.exports.translateProjectTitle(name,'Another catalogue item'),name);}
console.log('PASS catalogue project headings translated without changing custom project names.');
