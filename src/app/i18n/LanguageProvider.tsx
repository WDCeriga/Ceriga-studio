import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSupabase } from '../lib/supabaseClient';
import { availableLanguage, browserLanguage, displayLanguage, languages, prepareLanguage, useCerigaTranslation, type Language, type TranslationKey } from './i18n';

const storageKey = 'ceriga_language';
const visitorLanguage = () => {
  try { return availableLanguage(localStorage.getItem(storageKey)) ?? browserLanguage(navigator.languages); }
  catch { return 'en'; }
};

type Preference = { language: Language; busy: boolean; error: boolean; select: (next: Language) => Promise<void> };
const LanguageContext = createContext<Preference | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user, authReady, usingSupabase } = useAuth();
  const account = usingSupabase ? user?.id : undefined;
  const [language, setLanguage] = useState<Language>('en');
  const [saving, setSaving] = useState(false);
  const [loadedAccount, setLoadedAccount] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const identity = useRef(account);
  const savingLock = useRef(false);
  identity.current = account;

  useEffect(() => {
    if (!authReady) return;
    let current = true;
    setError(false);
    const restore = async () => {
      let preferred = visitorLanguage();
      if (account) {
        const { data, error } = await getSupabase().rpc('account_language_preference', { p_account: account });
        if (error) throw error;
        preferred = availableLanguage(data) ?? browserLanguage(navigator.languages);
      }
      await prepareLanguage(preferred);
      if (!current) return;
      await displayLanguage(preferred);
      if (current) setLanguage(preferred);
    };
    void restore().catch(async () => {
      if (!current) return;
      await displayLanguage('en');
      if (current) { setLanguage('en'); setError(true); }
    }).finally(() => {
      if (current) setLoadedAccount(account ?? '');
    });
    return () => { current = false; };
  }, [account, authReady]);

  const busy = saving || loadedAccount !== (account ?? '');
  const select = async (next: Language) => {
    if (busy || savingLock.current || next === language) return;
    savingLock.current = true;
    setSaving(true);
    setError(false);
    try {
      await prepareLanguage(next);
      if (identity.current !== account) return;
      if (account) {
        const { data, error } = await getSupabase().rpc('account_language_preference', { p_account: account, p_language: next });
        if (error || data !== next) throw error ?? new Error('Language preference was not saved');
      } else {
        localStorage.setItem(storageKey, next);
      }
      if (identity.current !== account) return;
      await displayLanguage(next);
      setLanguage(next);
    } catch {
      if (identity.current === account) setError(true);
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  };

  return <LanguageContext.Provider value={{ language, busy, error, select }}>{children}</LanguageContext.Provider>;
}

export function Translate({ k }: { k: TranslationKey }) {
  const { t } = useCerigaTranslation();
  return <>{t(k)}</>;
}

export function LanguageSelect({ preference = false, compact = false }: { preference?: boolean; compact?: boolean }) {
  const id = useId();
  const context = useContext(LanguageContext);
  const { t } = useCerigaTranslation();
  if (!context) return null;
  const { language, busy, error, select } = context;
  return <div className={compact ? 'min-w-0 max-w-full' : 'grid w-fit max-w-full gap-1'}>
    <label htmlFor={id} className={preference ? 'block text-sm font-medium' : 'sr-only'}>
      {t(preference ? 'common.preference' : 'common.language')}
    </label>
    <select id={id} value={language} disabled={busy} aria-describedby={error ? id + '-error' : undefined}
      className={`max-w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-900 ${compact ? 'w-14' : ''}`}
      onChange={event => { const next = availableLanguage(event.target.value); if (next) void select(next); }}>
      {Object.entries(languages).map(([code, entry]) =>
        <option key={code} value={code} lang={code}>{entry.label}</option>
      )}
    </select>
    {error && <p id={id + '-error'} role="alert" className="mt-1 max-w-56 text-xs text-red-600">{t('common.languageError')}</p>}
  </div>;
}
