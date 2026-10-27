import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSupabase } from './supabaseClient';

export function useMessagingAccess() {
  const { user, authReady, usingSupabase } = useAuth();
  const [result, setResult] = useState<{ id: string | null; allowed: boolean; error: string }>({ id: null, allowed: false, error: '' });
  useEffect(() => {
    let current = true;
    if (!authReady || !usingSupabase || !user?.id) return;
    const refresh = () => {
      void getSupabase().rpc('messaging_enabled').then(({ data, error }) => {
        if (current) setResult({ id: user.id, allowed: data === true && !error, error: error?.message || '' });
      });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => { current = false; window.removeEventListener('focus', refresh); };
  }, [authReady, usingSupabase, user?.id]);
  return { allowed: usingSupabase && result.id === user?.id && result.allowed, loading: authReady && usingSupabase && !!user?.id && result.id !== user.id, error: result.id === user?.id ? result.error : '' };
}
