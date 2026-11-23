export const locales = {
  en: 'en-GB', 'zh-CN': 'zh-CN', tr: 'tr-TR', pt: 'pt-PT', es: 'es-ES', fr: 'fr-FR',
} as const;

export function displayLocale() {
  if (typeof document === 'undefined') return 'en-GB';
  return locales[document.documentElement.lang as keyof typeof locales]
    ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-GB');
}
