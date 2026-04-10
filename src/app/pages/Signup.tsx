import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { GoogleAuthButton } from '../components/GoogleAuthButton';
import { ArrowLeft } from 'lucide-react';

export function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { signup } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password || !confirmPassword) return setError('Please fill in all fields');
    if (password !== confirmPassword) return setError('Passwords do not match');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    try {
      await signup(email, password, name);
      navigate('/onboarding');
    } catch {
      setError('Failed to create account');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-[#0F0F0F] px-5 py-8">
      <div className="w-full max-w-[420px]">
        <Link to="/" className="mb-5 inline-flex items-center text-[11px] uppercase tracking-wider text-white/60 transition-colors hover:text-white">
          <ArrowLeft className="mr-2 h-3.5 w-3.5" />
          Back to home
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="mb-2 text-[9px] font-bold uppercase tracking-[2px] text-[#CC2D24]">Create Account</div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-extrabold text-white">Sign up</h1>
          <p className="mb-6 mt-1 text-sm text-white/55">Start building professional tech packs.</p>

          {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field id="name" label="Full Name" value={name} onChange={setName} placeholder="John Doe" />
            <Field id="email" label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
            <Field id="password" label="Password" value={password} onChange={setPassword} placeholder="At least 8 characters" type="password" />
            <Field id="confirmPassword" label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter your password" type="password" />
            <Button type="submit" className="h-10 w-full bg-[#CC2D24] text-xs font-semibold hover:bg-[#CC2D24]/90">CREATE ACCOUNT</Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.14em]">
              <span className="rounded bg-white/5 px-3 py-0.5 text-white/45">Or</span>
            </div>
          </div>

          <GoogleAuthButton flow="signup" />

          <p className="mt-5 text-center text-sm text-white/55">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-[#CC2D24] hover:text-[#CC2D24]/80">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, placeholder, type = 'text' }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/55">{label}</label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white placeholder:text-white/35 focus:border-[#CC2D24] focus:outline-none" placeholder={placeholder} />
    </div>
  );
}

