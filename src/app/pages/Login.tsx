import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { GoogleAuthButton } from '../components/GoogleAuthButton';
import { ArrowLeft } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Please fill in all fields');
    try {
      await login(email, password);
      let onboardingDone = false;
      try {
        onboardingDone = localStorage.getItem('ceriga_onboarding_done') === '1';
      } catch {
        /* ignore */
      }
      navigate(onboardingDone ? '/dashboard' : '/onboarding');
    } catch {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-[#0F0F0F] px-5 py-8">
      <div className="w-full max-w-[390px]">
        <Link to="/" className="mb-5 inline-flex items-center text-[11px] uppercase tracking-wider text-white/60 transition-colors hover:text-white">
          <ArrowLeft className="mr-2 h-3.5 w-3.5" />
          Back to home
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">Welcome Back</div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold text-white">Log in</h1>
          <p className="mb-6 mt-1 text-sm text-white/55">Access your Ceriga Studio workspace.</p>

          {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/55">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/35 focus:border-[#CC2D24] focus:outline-none" placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/55">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/35 focus:border-[#CC2D24] focus:outline-none" placeholder="Enter your password" />
            </div>
            <Button type="submit" className="h-10 w-full bg-[#CC2D24] text-xs font-semibold hover:bg-[#CC2D24]/90">LOG IN</Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.14em]">
              <span className="rounded bg-white/5 px-3 py-0.5 text-white/45">Or</span>
            </div>
          </div>

          <GoogleAuthButton flow="login" />

          <p className="mt-5 text-center text-sm text-white/55">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-medium text-[#CC2D24] hover:text-[#CC2D24]/80">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}