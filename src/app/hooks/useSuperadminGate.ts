import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canAccessSuperadminLocalPreview } from '../lib/superadminAccess';
import { fetchIsSuperadmin } from '../lib/superadminDb';

/**
 * Superadmin route guard: an explicit local development preview flag uses the
 * code allowlist; all other Supabase sessions require `superadmin_emails` (RLS).
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

    const localPreviewEnabled =
      import.meta.env.DEV && import.meta.env.VITE_DEV_SUPERADMIN_PREVIEW === 'true';
    if (!usingSupabase || localPreviewEnabled) {
      setAllowed(canAccessSuperadminLocalPreview(user.email));
      return;
    }

    let cancelled = false;
    // Check allowlist first as a fallback/fast-path or RPC for DB-verified superadmins
    if (canAccessSuperadminLocalPreview(user.email)) {
      setAllowed(true);
      return;
    }

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
