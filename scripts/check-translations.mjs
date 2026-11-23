import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {parse} from '@babel/parser';
const languages=['en','zh-CN','tr','pt','es','fr'];
const dictionaries=await Promise.all(languages.map(async code=>JSON.parse(await fs.readFile('src/app/i18n/locales/'+code+'.json','utf8'))));
const flatten=resource=>Object.entries(resource).flatMap(([section,values])=>Object.entries(values).map(([name,value])=>[section+'.'+name,value]));
const english=new Map(flatten(dictionaries[0])),wording=new Set(english.values()),errors=[];
const placeholders=text=>[...String(text).matchAll(/{{(\w+)}}/g)].map(m=>m[1]).sort().join(',');
for(let index=1;!process.argv.includes('--source-only')&&index<languages.length;index++){
 const resource=new Map(flatten(dictionaries[index]));
 for(const[key,text]of english){const value=resource.get(key);if(typeof value!=='string'||!value.trim())errors.push(languages[index]+': missing '+key);else if(placeholders(text)!==placeholders(value))errors.push(languages[index]+': placeholder mismatch '+key);if(typeof value==='string'){const repeated=/(.{2,16})\1{5,}|(\S{2,24})(?:\s+\2){5,}|(.)\3{24}/u;if((value.length>Math.max(160,text.length*5))||(repeated.test(value)&&!repeated.test(text))||(/\bZX\s*\d+\s*XZ\b/.test(value)&&!text.includes('ZX')))errors.push(languages[index]+': malformed translation '+key);}}
 for(const key of resource.keys())if(!english.has(key))errors.push(languages[index]+': obsolete key '+key);
}
// These dropdown values are user-owned names or international codes, not UI copy.
const untranslatedDataOptions = {
 'pages/WorkerWorkspace.tsx': ['m.name'],
 'pages/superadmin/SuperAdminAssignmentConsole.tsx': ['match.name'],
 'pages/manufacturer/ManufacturerShipping.tsx': ['c.name','t'], // Carrier names and Incoterms.
 'pages/manufacturer/ManufacturerOrderDetail.tsx': ['c.name'],
 'components/manufacturer/OrderFloorWorkflow.tsx': ['c.name'],
 'components/manufacturer/ManufacturerLayout.tsx': ['o.name'],
 'components/WorkersArea.tsx': ['role.name','r.name','w.role_name'], // Custom role names.
 'components/freight/FreightReview.tsx': ['row.company_name'],
 'components/builder/PackagingReuseBar.tsx': ['item.name'], // Saved customer designs.
 'components/superadmin/AdminRecordControls.tsx': ['u.name','u.email'],
 'components/Money.tsx': ['c'],
 'components/superadmin/QuoteCalculator.tsx': ['c'],
 'i18n/LanguageProvider.tsx': ['entry.label'], // Native language names stay native.
};
function dropdownCopy(node, file, source) {
 const expression=source.slice(node.start,node.end).trim(), relative=file.replaceAll('\\','/').replace(/^src\/app\//,'');
 if(untranslatedDataOptions[relative]?.includes(expression))return;
 if(['CallExpression','NumericLiteral','StringLiteral','JSXElement'].includes(node.type))return;
 if(node.type==='ConditionalExpression'){dropdownCopy(node.consequent,file,source);dropdownCopy(node.alternate,file,source);return;}
 if(node.type==='BinaryExpression'&&node.operator==='+'&&node.right.type==='NumericLiteral')return;
 if(node.type==='Identifier'&&node.name==='n')return; // Day-count option.
 errors.push(file+':'+node.loc.start.line+' untranslated dropdown display '+expression);
}
const attrs=new Set(['aria-label','aria-description','placeholder','title','alt','label','description','subtitle','confirmLabel','cancelLabel','emptyMessage','loadingMessage']);
const isText=text=>/[a-z]{2}/i.test(text)&&!/^\s*(?:https?:\/\/|mailto:|#[a-f\d]{3,8}$)/i.test(text);
const files=execFileSync('rg',['--files','src/app','-g','*.tsx','-g','*.ts'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(file=>!file.replaceAll('\\','/').includes('/i18n/')||file.endsWith('.tsx'));let descriptors=0;
for(const file of files){const source=await fs.readFile(file,'utf8');const ast=parse(source,{sourceType:'module',plugins:['typescript','jsx']});
 const translationNames=new Set(['cerigaTranslate','cerigaTranslateLabel','translateInterface','translateInterfaceLabel']);
 const translationHooks=new Set(['useCerigaTranslation']);
 for(const statement of ast.program.body)if(statement.type==='ImportDeclaration'&&/i18n/.test(statement.source.value))for(const specifier of statement.specifiers){
  if(specifier.type==='ImportSpecifier'&&['translateInterface','translateInterfaceLabel'].includes(specifier.imported.name))translationNames.add(specifier.local.name);
  if(specifier.type==='ImportSpecifier'&&specifier.imported.name==='useCerigaTranslation')translationHooks.add(specifier.local.name);
 }
 function collectTranslationAliases(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='VariableDeclarator'&&node.id.type==='ObjectPattern'&&node.init?.type==='CallExpression'&&translationHooks.has(node.init.callee.name))for(const prop of node.id.properties)if(prop.type==='ObjectProperty'&&['t','label'].includes(prop.key.name)&&prop.value.type==='Identifier')translationNames.add(prop.value.name);
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(collectTranslationAliases);else if(value?.type)collectTranslationAliases(value);
 }
 collectTranslationAliases(ast);
 function translatesStoredValue(node){
  if(!node||typeof node!=='object')return false;
  if(node.type==='CallExpression'&&translationNames.has(node.callee.name))return true;
  return Object.values(node).some(value=>Array.isArray(value)?value.some(translatesStoredValue):value?.type?translatesStoredValue(value):false);
 }
 function report(node,text){text=text.trim().replace(/\s+/g,' ');if(isText(text))errors.push(file+':'+node.loc.start.line+' untranslated interface text '+JSON.stringify(text));}function walk(node,parent,ui=false){if(!node||typeof node!=='object'||node.type?.startsWith('TS'))return;
 if(node.type==='BlockStatement')ui=false;
 if(node.type==='BinaryExpression'&&node.operator!=='+'){walk(node.left,node,false);walk(node.right,node,false);return;}
 if(ui&&node.type==='StringLiteral'&&parent?.type==='BinaryExpression'&&parent.operator==='+')report(node,node.value);
 if(ui&&node.type==='ConditionalExpression'&&[node.consequent,node.alternate].every(part=>part.type==='StringLiteral')&&[node.consequent.value,node.alternate.value].includes('')&&[node.consequent.value,node.alternate.value].some(value=>['s','ies'].includes(value)))errors.push(file+':'+node.loc.start.line+' English plural suffix; use a plural translation key.');
 if(node.type==='JSXElement'&&['style','script','code'].includes(node.openingElement.name?.name))return;
 if(node.type==='VariableDeclarator'&&/LABELS?|TITLES?|DESCRIPTIONS?/i.test(node.id?.name??'')){let value=node.init;if(value?.type==='TSAsExpression')value=value.expression;if(['ObjectExpression','ArrayExpression'].includes(value?.type)){function labels(part){if(!part||typeof part!=='object')return;if(part.type==='ObjectProperty'&&['key','id','value','href','to','permission','path'].includes(part.key?.name??part.key?.value))return;if(part.type==='StringLiteral'){const text=part.value.trim().replace(/\s+/g,' ');if(/[a-z]{2}/i.test(text)&&!/^[/#.]|^[a-z]+:|^[a-z]+[_-]|^[a-z]*[A-Z][a-zA-Z]*$/.test(text)&&!(/^[A-Z\d _-]{1,8}$/.test(text))&&!wording.has(text))errors.push(file+':'+part.loc.start.line+' unregistered label map value '+JSON.stringify(text));}for(const child of Object.values(part))if(Array.isArray(child))child.forEach(labels);else if(child?.type)labels(child);}labels(value);}}
 if(node.type==='ObjectProperty'&&['features','bullets','steps'].includes(node.key?.name)&&node.value?.type==='ArrayExpression')for(const entry of node.value.elements)if(entry?.type==='StringLiteral'&&isText(entry.value)&&!wording.has(entry.value))errors.push(file+':'+entry.loc.start.line+' unregistered interface list text '+JSON.stringify(entry.value));
 if(node.type==='MemberExpression'&&node.computed){walk(node.object,node,ui);walk(node.property,node,false);return;}
 if(node.type==='CallExpression'&&['can','hasPermission','hasAccess','includes','startsWith','endsWith'].includes(node.callee.name??node.callee.property?.name)){for(const argument of node.arguments)walk(argument,node,false);return;}
 if(node.type==='JSXElement'&&['option','SelectItem'].includes(node.openingElement.name?.name))for(const child of node.children)if(child.type==='JSXExpressionContainer')dropdownCopy(child.expression,file,source);
 if(node.type==='JSXText')report(node,node.value);
 if(node.type==='JSXAttribute'){if((node.name?.name==='key'||node.name?.name==='value'&&['input','select','option','textarea','Input','Textarea','Select','SelectItem'].includes(parent?.name?.name))&&translatesStoredValue(node.value?.expression))errors.push(file+':'+node.loc.start.line+' translated option value or React key; translate display text only.');if(!attrs.has(node.name?.name))return;if(node.value?.type==='StringLiteral')report(node,node.value.value);}
 if(node.type==='StringLiteral'&&ui&&['ConditionalExpression','LogicalExpression','JSXExpressionContainer'].includes(parent?.type))report(node,node.value);
 if(node.type==='TemplateLiteral'&&ui&&node.quasis.some(q=>isText(q.value.cooked??'')))report(node,node.quasis.map(q=>q.value.cooked).join(' '));
 if(node.type==='StringLiteral'&&parent?.type==='ObjectProperty'&&['label','title','body','description','placeholder','help','subtitle','question','answer','q','a','headline','studioTip',...(file.endsWith('Onboarding.tsx')?['t','d']:[])].includes(parent.key?.name??parent.key?.value)){const value=node.value.trim().replace(/\s+/g,' ');if(isText(value)){descriptors++;if(!wording.has(value))errors.push(file+':'+node.loc.start.line+' unregistered interface descriptor '+JSON.stringify(value));}}
 if(node.type==='CallExpression'&&['t','cerigaTranslate','translateInterface'].includes(node.callee.name)){function keyCheck(argument){if(argument?.type==='CallExpression'&&['t','cerigaTranslate','translateInterface','cerigaTranslateLabel','translateInterfaceLabel','translateLabel'].includes(argument.callee.name))errors.push(file+':'+argument.loc.start.line+' a translation key was translated as interface text');if(argument?.type==='StringLiteral'){const key=argument.value;if(!english.has(key)&&!english.has(key+'_other'))errors.push(file+':'+node.loc.start.line+' missing key '+key);}else if(argument?.type==='ConditionalExpression'){keyCheck(argument.consequent);keyCheck(argument.alternate);}}keyCheck(node.arguments[0]);for(const argument of node.arguments.slice(1))walk(argument,node,ui);return;}
 for(const value of Object.values(node))if(Array.isArray(value))value.forEach(child=>walk(child,node,ui||node.type==='JSXExpressionContainer'));else if(value?.type)walk(value,node,ui||node.type==='JSXExpressionContainer');}walk(ast);}
if(errors.length){console.error(errors.slice(0,100).join('\n'));if(errors.length>100)console.error('... '+(errors.length-100)+' further errors');process.exitCode=1;}else console.log(process.argv.includes('--source-only')?'PASS rendered static text and registered descriptors across '+files.length+' source components.':'PASS '+files.length+' source components; '+english.size+' keys in all six languages; placeholders, rendered static text and '+descriptors+' registered descriptors. No legacy-text exemption list.');


