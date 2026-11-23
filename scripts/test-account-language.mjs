import { localeMocks } from './support/localeMocks.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { testDatabase, asAccount } from './support/testDatabase.mjs';

const db = await testDatabase();
const first = randomUUID(), second = randomUUID();
const read = async (id, language) => (await db.query(
  'select public.account_language_preference($1,$2) as language', [id, language],
)).rows[0].language;
try {
  await db.query("insert into auth.users(id,email) values ($1,'one@example.invalid'), ($2,'two@example.invalid')", [first,second]);
  const migration = await fs.readFile('supabase/migrations/20261117120000_account_language_preference.sql','utf8');
  await db.exec(migration);
  await actor(first);
  assert.equal(await read(first,null), null);
  assert.equal(await read(first,'zh-CN'), 'zh-CN');
  await assert.rejects(read(second,'tr'), /access denied/);
  await assert.rejects(read(first,'xx'), /Unsupported language/);
  await actor(second);
  assert.equal(await read(second,'fr'), 'fr');
  await assert.rejects(read(first,null), /access denied/);
  await actor(first);
  assert.equal(await read(first,null), 'zh-CN');
  await db.exec('reset role; set role anon');
  await assert.rejects(read(first,null), /permission denied/);
} finally { await db.close(); }

function actor(id) { return asAccount(db,id); }
const directory = 'src/app/i18n/locales';
const dictionaries = await Promise.all(['en','zh-CN','tr','pt','es','fr'].map(async id =>
  JSON.parse(await fs.readFile(`${directory}/${id}.json`,'utf8`'.slice(0,-1)))
));
const keys = dictionary => Object.entries(dictionary).flatMap(([group, entries]) =>
  Object.keys(entries).map(key=>`${group}.${key}`)).sort();
for (const dictionary of dictionaries) assert.deepEqual(keys(dictionary),keys(dictionaries[0]));
assert.match(dictionaries[1].common.language, /[\u3400-\u9fff]/);
assert.equal(new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(12.34).replace(/\s+/g,' '),'12,34 €');
const { outputFiles } = await build({
  entryPoints: ['src/app/i18n/i18n.ts'], platform: 'node', bundle: true, format: 'cjs', write: false, packages: 'external',
});
const localeModule = {exports:{}};
new Function('require','module','exports',outputFiles[0].text)(((original)=>specifier=>{if(/\/i18n\/i18n$/.test(specifier)){let actual;try{actual=original(specifier)}catch{}if(!actual)return localeMocks['../../i18n/i18n'];for(const [key,value]of Object.entries(localeMocks['../../i18n/i18n']))if(!(key in actual))actual[key]=value;return actual}return original(specifier)})(createRequire(import.meta.url)),localeModule,localeModule.exports);
const { i18n, prepareLanguage, browserLanguage } = localeModule.exports;
assert.equal(browserLanguage(['de-DE','zh-Hans-CN']), 'zh-CN');
assert.equal(browserLanguage(['zh-Hant-TW','es-MX']), 'es');
assert.equal(browserLanguage(['unsupported']), 'en');
await prepareLanguage('fr');
await i18n.changeLanguage('fr');
assert.equal(i18n.t('nav.orders'), 'Commandes');
assert.equal(i18n.t('orders.resultCount', {count:2}), '2 commandes correspondantes');
assert.equal(i18n.dir('ur'), 'rtl');
assert.equal(i18n.hasResourceBundle('zh-CN','translation'), false);
await prepareLanguage('zh-CN');
await i18n.changeLanguage('zh-CN');
assert.equal(i18n.t('common.language'), '语言');
assert.equal(i18n.t('orders.resultCount', {count:1}), '1 个匹配订单');
i18n.removeResourceBundle('zh-CN','translation');
assert.equal(i18n.t('nav.orders'), 'Orders');
console.log('PASS: account isolation, permission checks, fresh schema, dictionary parity, Chinese Unicode, lazy loading, interpolation, pluralisation, English fallback and RTL direction metadata.');

