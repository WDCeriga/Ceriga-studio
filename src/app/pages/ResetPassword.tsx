import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../i18n/i18n';
import { LanguageSelect } from '../i18n/LanguageProvider';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

/**
 * Handles the Supabase recovery link. Supabase lands the user here with either
 * `?code=...` (PKCE) or a `#access_token=...&type=recovery` fragment; the client
 * (detectSessionInUrl) consumes it, then we let the user set a new password.
 */
export function ResetPassword() {
  

  const { t, label: translateLabel } = useCerigaTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessionReady, setSessionReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    const poll = window.setInterval(() => {
      void (async () => {
        const { data } = await getSupabase().auth.getSession();
        if (!cancelled && data.session) {
          window.clearInterval(poll);
          setSessionReady(true);
        }
      })();
    }, 500);
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        window.clearInterval(poll);
        setSessionReady((prev) => prev || Boolean(user));
      }
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearTimeout(timeout);
    };
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirm) return setError('Passwords do not match');
    if (!isSupabaseConfigured) return setError('Database not configured');
    setSaving(true);
    try {
      const { error: err } = await getSupabase().auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      window.setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : cerigaTranslate("interface.text_f0716e31a94df8fb"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-[#09090B] px-5 py-8">
      <div className="w-full max-w-[390px]">
        <Link to="/" className="mb-5 inline-flex items-center text-[11px] uppercase tracking-wider text-white/60 transition-colors hover:text-white">
          ← {t('authentication.backHome')}
        </Link>

        <div className="rounded-2xl border border-[#252528] bg-white/5 p-6">
          <div className="mb-3 flex justify-end"><LanguageSelect /></div>
          <div className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">
            {t('common.account')}
          </div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold text-white">
            {t('authentication.newPassword')}
          </h1>

          {done ? (
            <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              {t('authentication.updatedPassword')}
            </p>
          ) : !sessionReady ? (
            <p className="mt-4 text-sm text-white/55">
              {t('authentication.verifyReset')}
              <br />
              <span className="mt-2 inline-block text-xs text-white/40">{cerigaTranslate("interface.text_1a6af84c2300d22a")}{' '}
                <Link to="/login" className="text-[#E5534A] hover:underline">{cerigaTranslate("interface.text_99819993840f84f9")}</Link>
                .
              </span>
            </p>
          ) : (
            <>
              <p className="mb-5 mt-1 text-sm text-white/55">
                {t('authentication.choosePassword')}
              </p>
              {error && (
                <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {cerigaTranslateLabel(translateLabel(error))}
                </div>
              )}
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/55">
                    {t('authentication.password')}
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#252528] bg-black/20 px-3 text-sm text-white placeholder:text-white/35 focus:border-[#CC2D24] focus:outline-none"
                    placeholder={t('authentication.min')}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/55">
                    {t('authentication.confirmPassword')}
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#252528] bg-black/20 px-3 text-sm text-white placeholder:text-white/35 focus:border-[#CC2D24] focus:outline-none"
                    placeholder={t('authentication.repeat')}
                    autoComplete="new-password"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-10 w-full bg-[#CC2D24] text-xs font-semibold hover:bg-[#CC2D24]/90 disabled:opacity-50"
                >
                  {t(saving ? "common.saving" : "authentication.updatePassword")}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
