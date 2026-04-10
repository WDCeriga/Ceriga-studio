import { useNavigate } from 'react-router';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { toast } from 'sonner';

function decodeGoogleJwt(credential: string): { email?: string; name?: string; given_name?: string } {
  const segment = credential.split('.')[1];
  if (!segment) return {};
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join(''),
  );
  return JSON.parse(json) as { email?: string; name?: string; given_name?: string };
}

function profileFromCredential(res: CredentialResponse) {
  const cred = res.credential;
  if (!cred) return null;
  const p = decodeGoogleJwt(cred);
  const email = (p.email || '').trim();
  if (!email) return null;
  const name = (p.name || p.given_name || email.split('@')[0] || 'User').trim();
  return { email, name };
}

type Flow = 'login' | 'signup';

export function GoogleAuthButton({ flow }: { flow: Flow }) {
  const navigate = useNavigate();
  const { loginWithGoogleProfile, signupWithGoogleProfile } = useAuth();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  const finish = async (email: string, name: string) => {
    if (flow === 'login') {
      await loginWithGoogleProfile({ email, name });
      let onboardingDone = false;
      try {
        onboardingDone = localStorage.getItem('ceriga_onboarding_done') === '1';
      } catch {
        /* ignore */
      }
      navigate(onboardingDone ? '/dashboard' : '/onboarding');
    } else {
      await signupWithGoogleProfile({ email, name });
      navigate('/onboarding');
    }
  };

  const onGoogleSuccess = (res: CredentialResponse) => {
    const profile = profileFromCredential(res);
    if (!profile) {
      toast.error('Could not read Google profile');
      return;
    }
    void finish(profile.email, profile.name).catch(() => toast.error('Sign-in failed'));
  };

  const onDemo = () => {
    const n = Math.floor(Math.random() * 9000) + 1000;
    void finish(`demo.user.${n}@gmail.com`, 'Demo Google user').catch(() =>
      toast.error('Sign-in failed'),
    );
  };

  if (!clientId?.trim()) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={onDemo}
        className="h-11 w-full border-white/15 bg-black/25 text-sm font-medium text-white hover:bg-white/10"
      >
        <span className="mr-2 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white text-[11px] font-bold text-[#4285F4]">
          G
        </span>
        Continue with Google
      </Button>
    );
  }

  return (
    <div className="flex w-full justify-center [&>div]:!w-full [&_iframe]:!mx-auto">
      <GoogleLogin
        onSuccess={onGoogleSuccess}
        onError={() => toast.error('Google sign-in was cancelled or failed')}
        useOneTap={false}
        theme="filled_black"
        size="large"
        width="100%"
        text={flow === 'login' ? 'signin_with' : 'signup_with'}
        shape="rectangular"
        logo_alignment="left"
        type="standard"
      />
    </div>
  );
}
