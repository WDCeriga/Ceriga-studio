/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Preferred for local Vite */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Enables the local-only superadmin email allowlist during Vite development. */
  readonly VITE_DEV_SUPERADMIN_PREVIEW?: string;

  /** Vercel Supabase integration / Next-style names (also exposed via vite envPrefix) */
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
