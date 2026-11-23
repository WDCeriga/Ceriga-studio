import i18next from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { locales } from './locale';
import english from './locales/en.json';

export const languages = {
  en: { label: 'English' },
  'zh-CN': { label: '简体中文' },
  tr: { label: 'Türkçe' },
  pt: { label: 'Português' },
  es: { label: 'Español' },
  fr: { label: 'Français' },
} as const;
export type Language = keyof typeof languages;
export type TranslationKey = { [Section in keyof typeof english]:
  `${Section}.${Extract<keyof typeof english[Section], string>}` }[keyof typeof english];

const dictionaries = {
  'zh-CN': () => import('./locales/zh-CN.json'),
  tr: () => import('./locales/tr.json'),
  pt: () => import('./locales/pt.json'),
  es: () => import('./locales/es.json'),
  fr: () => import('./locales/fr.json'),
};
export const i18n = i18next.createInstance();
const ready = i18n.use(initReactI18next).init({
  lng: 'en', fallbackLng: 'en', supportedLngs: Object.keys(languages),
  resources: { en: { translation: english } },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export function availableLanguage(value: unknown): Language | undefined {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(languages, value)
    ? value as Language : undefined;
}

export function browserLanguage(preferences: readonly string[]) {
  for (const preference of preferences) {
    const [language, script] = preference.toLowerCase().split('-');
    if (language === 'zh' && !['hant', 'tw', 'hk', 'mo'].includes(script)) return 'zh-CN';
    const supported = availableLanguage(language);
    if (supported) return supported;
  }
  return 'en';
}

export async function prepareLanguage(language: Language) {
  await ready;
  if (language !== 'en' && !i18n.hasResourceBundle(language, 'translation')) {
    const { default: dictionary } = await dictionaries[language]();
    i18n.addResourceBundle(language, 'translation', dictionary);
  }
}

export async function displayLanguage(language: Language) {
  document.documentElement.lang = language;
  document.documentElement.dir = i18n.dir(language);
  await i18n.changeLanguage(language);
  window.dispatchEvent(new Event('ceriga-language-changed'));
}

export function activeLocale() {
  return locales[availableLanguage(i18n.resolvedLanguage) ?? 'en'];
}

export function weekdayLabel(index: number, style: 'short' | 'narrow' | 'long' = 'short') {
  return new Intl.DateTimeFormat(activeLocale(), { weekday: style, timeZone: 'UTC' })
    .format(new Date(Date.UTC(2024, 0, 1 + index)));
}

const keysByText = new Map(Object.entries(english).flatMap(([section, entries]) =>
  Object.entries(entries).map(([key, value]) => [value, `${section}.${key}`] as const)));
const labelKey = (text: string) => text.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toLocaleLowerCase('en');
const keysByLabel = new Map([...keysByText].map(([text, key]) => [labelKey(text), key]));
const interfaceTemplates = [...keysByText].flatMap(([text, key]) => {
  const parts = text.split(/({{\w+}})/g);
  const names = parts.filter(part => /^{{\w+}}$/.test(part)).map(part => part.slice(2, -2));
  const specificity = text.replace(/{{\w+}}/g, '').replace(/[^a-z]/gi, '').length;
  const numericWait = /^{{\w+}}[mhd] waiting$/.test(text) || /^{{\w+}} days? (?:left|overdue)$/.test(text);
  if (!names.length || names.length > 6 || (specificity < 10 && !numericWait) || /}}\s*{{/.test(text)) return [];
  const pattern = parts.map(part => /^{{\w+}}$/.test(part) ? (numericWait ? '(\\d+)' : '([\\s\\S]*?)')
    : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')).join('');
  return [{ key, names, specificity, pattern: new RegExp(`^${pattern}$`, 'i') }];
}).sort((left, right) => right.specificity - left.specificity);

export function translateInterface(key: string, options?: Record<string, unknown>): string {
  return String(i18n.t(key, options));
}

/** Translate maintained interface metadata. Keep user-authored content out of this lookup. */
export function translateInterfaceLabel(text: string): string {
  if (typeof text !== 'string') return text;
  const units = /^(\d+) units?$/i.exec(text);
  if (units) return translateInterface('interface.displayUnits', { count: Number(units[1]) });
  const key = keysByText.get(text) ?? keysByLabel.get(labelKey(text));
  if (key) return translateInterface(key);
  // Match maintained system wording only. Captured names, identifiers and other
  // dynamic values stay in their original form; no live translation service runs.
  for (const template of text.length <= 3000 ? interfaceTemplates : []) {
    const match = template.pattern.exec(text);
    if (match) return translateInterface(template.key,
      Object.fromEntries(template.names.map((name, index) => [name,
        name === 'count' && /^\d+$/.test(match[index + 1]) ? Number(match[index + 1]) : match[index + 1]])));
  }
  return text;
}

/** Localize an unchanged catalogue title without rewriting a customer's project name. */
export function translateProjectTitle(title: string, catalogueTitle?: string): string {
  return title === catalogueTitle || title === 'Untitled Project'
    ? translateInterfaceLabel(title)
    : title;
}

export function useCerigaTranslation() {
  const { t } = useTranslation('translation', { i18n });
  return { t, label: translateInterfaceLabel };
}

export function formatQuantityLine(line: { kind: 'sample' | 'bulk'; total: number; index: number; target?: number }): string {
  const key = line.kind === 'sample' ? 'interface.quantitySample' : line.target && line.target !== line.total ? 'interface.quantityBulkTier' : 'interface.quantityBulk';
  return translateInterface(key, { count: line.total, index: line.index, target: line.target });
}
