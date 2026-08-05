import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

export type GoogleProfile = { email: string; name: string; credential?: string };

export type AuthUser = {
  id: string | null;
  email: string;
  name: string;
};

interface AuthContextType {
  isAuthenticated: boolean;
  authReady: boolean;
  /** True when VITE_SUPABASE_* env is set — real auth + DB. */
  usingSupabase: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogleProfile: (profile: GoogleProfile) => Promise<void>;
  signupWithGoogleProfile: (profile: GoogleProfile) => Promise<void>;
  logout: () => Promise<void>;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USER_KEY = 'user';

function nameFromEmail(email: string): string {
  return email.split('@')[0] || 'User';
}

function userFromLocalStorage(): AuthUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; name?: string; id?: string };
    if (!parsed.email) return null;
    return {
      id: parsed.id ?? null,
      email: parsed.email,
      name: parsed.name || nameFromEmail(parsed.email),
    };
  } catch {
    return null;
  }
}

function persistLocalUser(user: AuthUser): void {
  localStorage.setItem(
    LOCAL_USER_KEY,
    JSON.stringify({ id: user.id, email: user.email, name: user.name }),
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const saved = userFromLocalStorage();
      if (saved) {
        setUser(saved);
        setIsAuthenticated(true);
      }
      setAuthReady(true);
      return;
    }

    const supabase = getSupabase();

    const applySession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (session?.user) {
        const email = session.user.email ?? '';
        const meta = session.user.user_metadata as { full_name?: string; name?: string };
        const next: AuthUser = {
          id: session.user.id,
          email,
          name: meta.full_name || meta.name || nameFromEmail(email),
        };
        setUser(next);
        setIsAuthenticated(true);
        persistLocalUser(next);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem(LOCAL_USER_KEY);
      }
      setAuthReady(true);
    };

    void applySession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const email = session.user.email ?? '';
        const meta = session.user.user_metadata as { full_name?: string; name?: string };
        const next: AuthUser = {
          id: session.user.id,
          email,
          name: meta.full_name || meta.name || nameFromEmail(email),
        };
        setUser(next);
        setIsAuthenticated(true);
        persistLocalUser(next);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem(LOCAL_USER_KEY);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      const mockUser: AuthUser = { id: null, email, name: nameFromEmail(email) };
      setUser(mockUser);
      setIsAuthenticated(true);
      persistLocalUser(mockUser);
      return;
    }

    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    try {
      localStorage.removeItem('ceriga_onboarding_done');
      localStorage.removeItem('ceriga_persona');
    } catch {
      /* ignore */
    }

    if (!isSupabaseConfigured) {
      const mockUser: AuthUser = { id: null, email, name };
      setUser(mockUser);
      setIsAuthenticated(true);
      persistLocalUser(mockUser);
      return;
    }

    const supabase = getSupabase();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, name } },
    });
    if (error) throw error;
  }, []);

  const loginWithGoogleProfile = useCallback(async (profile: GoogleProfile) => {
    if (!isSupabaseConfigured) {
      const next: AuthUser = { id: null, email: profile.email, name: profile.name };
      setUser(next);
      setIsAuthenticated(true);
      persistLocalUser(next);
      return;
    }

    if (!profile.credential) {
      throw new Error('Missing Google credential for Supabase sign-in');
    }

    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: profile.credential,
    });
    if (error) throw error;
  }, []);

  const signupWithGoogleProfile = useCallback(async (profile: GoogleProfile) => {
    try {
      localStorage.removeItem('ceriga_onboarding_done');
      localStorage.removeItem('ceriga_persona');
    } catch {
      /* ignore */
    }
    await loginWithGoogleProfile(profile);
  }, [loginWithGoogleProfile]);

  const logout = useCallback(async () => {
    if (isSupabaseConfigured) {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    }
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem(LOCAL_USER_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        authReady,
        usingSupabase: isSupabaseConfigured,
        login,
        signup,
        loginWithGoogleProfile,
        signupWithGoogleProfile,
        logout,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
