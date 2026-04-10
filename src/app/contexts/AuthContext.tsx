import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type GoogleProfile = { email: string; name: string };

interface AuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogleProfile: (profile: GoogleProfile) => Promise<void>;
  signupWithGoogleProfile: (profile: GoogleProfile) => Promise<void>;
  logout: () => void;
  user: { email: string; name: string } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);

  useEffect(() => {
    // Check if user is logged in from localStorage
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (email: string, password: string) => {
    // Mock login - in production, this would call your backend
    const mockUser = { email, name: email.split('@')[0] };
    setUser(mockUser);
    setIsAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(mockUser));
  };

  const signup = async (email: string, password: string, name: string) => {
    // Mock signup - in production, this would call your backend
    const mockUser = { email, name };
    setUser(mockUser);
    setIsAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(mockUser));
    // New accounts must see onboarding; clear any prior completion from this browser
    try {
      localStorage.removeItem('ceriga_onboarding_done');
      localStorage.removeItem('ceriga_persona');
    } catch {
      /* ignore */
    }
  };

  const loginWithGoogleProfile = async (profile: GoogleProfile) => {
    const next = { email: profile.email, name: profile.name };
    setUser(next);
    setIsAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(next));
  };

  const signupWithGoogleProfile = async (profile: GoogleProfile) => {
    const next = { email: profile.email, name: profile.name };
    setUser(next);
    setIsAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(next));
    try {
      localStorage.removeItem('ceriga_onboarding_done');
      localStorage.removeItem('ceriga_persona');
    } catch {
      /* ignore */
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
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
