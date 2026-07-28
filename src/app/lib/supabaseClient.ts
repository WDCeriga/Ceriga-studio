import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve public Supabase credentials from Vite (`VITE_*`) or Vercel Supabase
 * integration (`NEXT_PUBLIC_*` / publishable key) names.
 * Never reads service-role or Postgres connection strings (server-only secrets).
 */
function firstEnv(...keys: string[]): string {
  const env = import.meta.env as Record<string, string | undefined>;
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return '';
}

const url = firstEnv(
  'VITE_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
);

const anonKey = firstEnv(
  'VITE_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
);

/** True when a public Supabase URL + anon/publishable key are available. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY, or use the Vercel Supabase integration (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY). See .env.example.',
    );
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
