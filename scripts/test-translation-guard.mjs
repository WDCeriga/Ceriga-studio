import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {spawnSync} from 'node:child_process';
const fixture='src/app/translation-guard-regression.tsx';
try{
 await fs.writeFile(fixture,`export const Test = () => <select>{[{id:'regular',label:'Regular'}].map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select>;`);
 let run=spawnSync(process.execPath,['scripts/check-translations.mjs','--source-only'],{encoding:'utf8'});assert.notEqual(run.status,0);assert.match(run.stderr,/untranslated dropdown display option.label/);
 await fs.writeFile(fixture,`import {translateInterfaceLabel} from './i18n/i18n'; export const Test = () => <select>{[{id:'regular',label:'Regular'}].map(option => <option key={option.id} value={option.id}>{translateInterfaceLabel(option.label)}</option>)}</select>;`);
 run=spawnSync(process.execPath,['scripts/check-translations.mjs','--source-only'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 for(const expression of ['translateLabel(option.label)','display(option.label)','String(display(option.label))']){
  await fs.writeFile(fixture,`import {translateInterfaceLabel as display,useCerigaTranslation} from './i18n/i18n'; export const Test=()=>{const {label:translateLabel}=useCerigaTranslation();return <select>{[{id:'regular',label:'Regular'}].map(option=><option key={option.id} value={${expression}}>{display(option.label)}</option>)}</select>};`);
  run=spawnSync(process.execPath,['scripts/check-translations.mjs','--source-only'],{encoding:'utf8'});
  assert.notEqual(run.status,0);assert.match(run.stderr,/translated option value or React key/);
 }
 console.log('PASS translation guard keeps localized display separate from stored codes, including imported, hook and nested aliases.');
}finally{await fs.unlink(fixture).catch(()=>{});}
