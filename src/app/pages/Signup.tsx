import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../i18n/i18n';
import { LanguageSelect } from '../i18n/LanguageProvider';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { GoogleAuthButton } from '../components/GoogleAuthButton';
import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'react-router';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { parseInviteToken, redeemManufacturerInvite } from '../data/manufacturerInvites';

export function Signup() {
  

  const { t, label: translateLabel } = useCerigaTranslation();
  const location = useLocation();
  const manufacturerSignup = location.pathname === '/manufacturer/signup';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(new URLSearchParams(location.search).get('invite') ?? '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();
  const { signup } = useAuth();

  useEffect(() => {
    if (manufacturerSignup && inviteCode) {
      const parsed = parseInviteToken(inviteCode);
      if (parsed?.email && !email) {
        setEmail(parsed.email);
      }
    }
  }, [manufacturerSignup, inviteCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password || !confirmPassword) return setError('Please fill in all fields');
    if (password !== confirmPassword) return setError('Passwords do not match');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (manufacturerSignup) {
      if (!inviteCode.trim()) return setError('Enter the manufacturer invitation code.');
      const parsed = parseInviteToken(inviteCode.trim());
      if (parsed && parsed.email !== email.trim().toLowerCase()) {
        return setError(cerigaTranslate("interface.text_0f0b2780d0bb0674",{value0:(parsed.email)}));
      }
    }
    try {
      await signup(email, password, name, manufacturerSignup ? 'manufacturer' : 'brand');
      if (manufacturerSignup) {
        localStorage.setItem(`ceriga_role_${email.trim().toLowerCase()}`, 'manufacturer');
        localStorage.setItem('ceriga_manufacturer_invite', inviteCode.trim());
        try {
          await redeemManufacturerInvite(inviteCode);
        } catch (inviteErr) {
          console.warn('[Signup] redeemManufacturerInvite non-fatal:', inviteErr);
        }

        let hasSession = false;
        if (isSupabaseConfigured) {
          const { getSupabase } = await import('../lib/supabaseClient');
          const {
            data: { session },
          } = await getSupabase().auth.getSession();
          hasSession = Boolean(session);
        } else {
          hasSession = true;
        }

        if (hasSession) {
          localStorage.removeItem('ceriga_manufacturer_invite');
          navigate('/manufacturer/onboarding', { replace: true });
        } else {
          setNotice('Account created! Please check your email to confirm your account, then log in to enter your factory portal.');
        }
      } else {
        navigate('/onboarding');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : cerigaTranslate("interface.text_d1890b44295245dc"));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-[#09090B] px-5 py-8">
      <div className="w-full max-w-[420px]">
        <Link to="/" className="mb-5 inline-flex items-center text-[11px] uppercase tracking-wider text-white/60 transition-colors hover:text-white">
          <ArrowLeft className="mr-2 h-3.5 w-3.5" />
          {t('authentication.backHome')}
        </Link>

        <div className="rounded-2xl border border-[#252528] bg-white/5 p-6">
          <div className="mb-3 flex justify-end"><LanguageSelect /></div>
          <div className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">
            {manufacturerSignup ? cerigaTranslate("interface.text_e1e3c6b3711fa565") : cerigaTranslate("interface.text_0dffe234b44793b6")}
          </div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold text-white">
            {manufacturerSignup ? t('authentication.create') : t('authentication.signup')}
          </h1>
          <p className="mb-6 mt-1 text-sm text-white/55">
            {manufacturerSignup ? cerigaTranslate("interface.text_d9ee9355e3970b03") : cerigaTranslate("interface.text_6f60a239d4546b40")}
          </p>

          {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{cerigaTranslateLabel(translateLabel(error))}</div>}
          {notice && <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{cerigaTranslateLabel(translateLabel(notice))}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field id="name" label={t('authentication.name')} value={name} onChange={setName} placeholder={cerigaTranslate("interface.text_6cea57c2fb6cbc2a")} />
            <Field id="email" label={t('authentication.email')} value={email} onChange={setEmail} placeholder={cerigaTranslate("interface.text_53e6cdc30765aade")} type="email" />
            {manufacturerSignup ? <Field id="inviteCode" label={t('authentication.invite')} value={inviteCode} onChange={setInviteCode} placeholder={t('authentication.paste')} /> : null}
            <Field id="password" label={t('authentication.password')} value={password} onChange={setPassword} placeholder={t('authentication.min')} type="password" />
            <Field id="confirmPassword" label={t('authentication.confirmPassword')} value={confirmPassword} onChange={setConfirmPassword} placeholder={t('authentication.repeat')} type="password" />
            <Button type="submit" className="h-10 w-full bg-[#CC2D24] text-xs font-semibold hover:bg-[#CC2D24]/90">{t('authentication.create')}</Button>
          </form>

          {!manufacturerSignup ? <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <span className="w-full border-t border-[#252528]" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-[0.14em]">
                <span className="rounded bg-white/5 px-3 py-0.5 text-white/45">{t('authentication.or')}</span>
              </div>
            </div>
            <GoogleAuthButton flow="signup" />
          </> : null}

          <p className="mt-5 text-center text-sm text-white/55">
            {t('authentication.existing')}{' '}
            <Link to={manufacturerSignup ? '/manufacturer/login' : '/login'} className="font-medium text-[#CC2D24] hover:text-[#CC2D24]/80">{t('authentication.login')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, placeholder, type = 'text' }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  useCerigaTranslation();

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/55">{cerigaTranslateLabel(label)}</label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-[#252528] bg-black/20 px-3 text-sm text-white placeholder:text-white/35 focus:border-[#CC2D24] focus:outline-none" placeholder={cerigaTranslateLabel(placeholder)} />
    </div>
  );
}
