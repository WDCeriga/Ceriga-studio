import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canAccessSuperadminLocalPreview } from '../lib/superadminAccess';
import { fetchIsSuperadmin } from '../lib/superadminDb';

/**
 * Superadmin route guard: local preview uses the code allowlist;
 * Supabase mode requires the signed-in email in `superadmin_emails` (RLS).
 */
export function useSuperadminGate() {
  const { authReady, usingSupabase, isAuthenticated, user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!authReady) return;

    if (!isAuthenticated || !user?.email) {
      setAllowed(false);
      return;
    }

    if (!usingSupabase) {
      setAllowed(canAccessSuperadminLocalPreview(user.email));
      return;
    }

    let cancelled = false;
    void fetchIsSuperadmin().then((ok) => {
      if (!cancelled) setAllowed(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [authReady, usingSupabase, isAuthenticated, user?.email]);

  const gateReady = authReady && allowed !== null;

  return { gateReady, allowed: allowed ?? false };
}
