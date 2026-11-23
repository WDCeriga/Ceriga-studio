import { readFile } from 'node:fs/promises';

const english = JSON.parse(await readFile(new URL('../../src/app/i18n/locales/en.json', import.meta.url),'utf8'));
const translate = (key, options) => {
  const [group, name] = key.split('.');
  const pluralKey = options?.count === undefined ? name : name + (options.count === 1 ? '_one' : '_other');
  const template = english[group]?.[pluralKey] ?? english[group]?.[name] ?? key;
  return template.replace(/{{(\w+)}}/g, (_, name) => String(options?.[name] ?? ''));
};

export const localeMocks = {
  '../../i18n/i18n': { i18n: { t: translate, resolvedLanguage: 'en' }, activeLocale: () => 'en-GB', weekdayLabel: index => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][index], translateInterface: translate, formatQuantityLine: line => translate(line.kind==='sample'?'interface.quantitySample':line.target&&line.target!==line.total?'interface.quantityBulkTier':'interface.quantityBulk',{count:line.total,index:line.index,target:line.target}), translateInterfaceLabel: value => value, useCerigaTranslation: () => ({ t: translate, label: value => value }) },
  '../../i18n/LanguageProvider': { Translate: ({ k }) => translate(k), LanguageSelect: () => null },
};

