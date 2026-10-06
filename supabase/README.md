# Supabase setup for Ceriga Studio

## 1. Create a project
1. Go to https://supabase.com and create a project.
2. Open **Project Settings → API**.
3. Copy **Project URL** and **anon public** key.

## 2. Env file
Copy `.env.example` to `.env`, or use values from the Vercel Supabase integration.

**This is a Vite app.** Client code can read:

| Works in browser | Source |
|------------------|--------|
| `VITE_SUPABASE_URL` | Local / manual |
| `VITE_SUPABASE_ANON_KEY` | Local / manual |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel Supabase integration |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel integration |

**Not used by the browser app** (keep them on Vercel if the integration added them, but don’t expect the SPA to read them):  
`POSTGRES_*`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, unprefixed `SUPABASE_URL` (unless you also have `NEXT_PUBLIC_SUPABASE_URL`).

Restart `npm run dev` after changing env.

## 3. Database schema
In Supabase: **SQL Editor → New query**, paste and run [`schema.sql`](./schema.sql).

## 4. Auth
In Supabase: **Authentication → Providers**
- Enable **Email** (for login/signup forms).
- Optionally enable **Google** and set the same client ID as `VITE_GOOGLE_CLIENT_ID`.
  For Google ID-token sign-in, add your site origin to authorized JavaScript origins in Google Cloud Console.

## 5. Try it
1. Sign up / sign in in the app.
2. Open the builder, edit a garment, click **Save**.
3. Open **Drafts** or **Dashboard** — the project should appear and reopen with `?projectId=...`.

## Asset Builder persistence

Apply [`migrations/20261005230000_asset_projects.sql`](./migrations/20261005230000_asset_projects.sql) **once**, after the existing schema, using the SQL Editor or your migration runner. This migration is not deployed automatically. It creates `public.asset_projects`, owner-only RLS policies, grants, and server-maintained update timestamps. Existing project rows are unchanged. Use the same public environment keys and real Supabase Auth session described above; never use a service-role key in the browser.

No Storage bucket or bucket policy is required: editable layer JSON and a PNG/WebP preview data URL are stored atomically in the same private row, matching the existing inline project-state convention. This avoids orphan uploads, public previews, and expiring signed URLs. Large images increase database/network usage; enforce product-level size limits before introducing a separate private bucket.

The reusable API is `src/app/lib/assetLibrary.ts`:

```typescript
export type AssetProject = {
  id: string; name: string; width: number; height: number;
  elements: DesignElement[]; preview: string; createdAt: string; updatedAt: string;
};
export function createAssetProjectId(): string;
export function listAssetProjects(userId: string | null): Promise<AssetProject[]>;
export function saveAssetProject(asset: AssetProject, userId: string | null): Promise<AssetProject>;
export function listLocalAssetProjects(userId: string | null): Promise<AssetProject[]>;
export function listPendingAssetProjects(userId: string): Promise<AssetProject[]>;
```

- Call after AuthContext's `authReady`, with `user?.id ?? null`. Local/mock accounts without a Supabase ID are guests. An account ID must match the local Supabase session, including for cache reads; cloud saves additionally validate `getUser()` and RLS. Account switching during requests rejects rather than returning another account's data.
- Callers render the transparent PNG/WebP preview; this module does not render or modify UI. Provide a data URL (or live Blob URL, converted before storage), positive canvas dimensions and valid ISO dates. Generate `createdAt`/`updatedAt` for new assets, advance `updatedAt` for local edits, and retain the returned server dates after sync.
- Every JSON layer field is preserved recursively, including runtime `type: 'group'`, `children`, drawing data and future fields. Groups retain their editable child layers and source geometry; persistence does not flatten them. Live `blob:` strings anywhere in layers/preview are embedded as data URLs. Embed remote/signed image URLs before saving if their lifetime is uncertain; external URLs are preserved, not fetched. Circular/non-JSON source data is not supported.
- Guests use IndexedDB (`ceriga-asset-library-v1`) rather than size-limited localStorage. Saves resolve only after transaction commit; unavailable storage/quota failures reject without a cloud write. Data survives reloads/browser restarts on the same origin/profile, not browser-data clearing, private-session expiry or browser eviction. Request persistent storage in the app's user interaction flow if needed; this is not a backup guarantee.
- Guest and each account have separate namespaces; no automatic guest import occurs. Browser storage is not encrypted and cannot isolate OS users sharing the same browser profile. Use separate profiles on shared devices.
- Signed-in saves commit a pending local draft first. Cloud/auth/network errors after that throw `AssetSyncError` (`asset`, `cause`), never report sync success, and retain the draft. Retry using `saveAssetProject`. Even a lost cloud acknowledgement can leave a pending draft; retry is an idempotent upsert. Server updates preserve creation time. Concurrent devices use last acknowledged database write wins, not collaborative merging.
- `listAssetProjects` fetches all cloud pages and overlays pending local edits; it rejects on cloud failure. For explicit offline/recovery UI use `listLocalAssetProjects`, and use `listPendingAssetProjects` to identify unsynced edits rather than label everything synced. A failed cloud refresh never destroys the previous cache. Successful refresh removes stale clean cache entries but never pending drafts. Offline account access requires the matching persisted session still to be available.
- Web Locks serialize operations across same-origin tabs; older browsers get an in-context queue only. Cross-tab editing on those browsers is last-write-wins. The Prints & Design Asset Builder provides the library UI and explicit save retries. Automatic cloud retries, guest migration and library delete controls are not included.

Focused offline validation (existing esbuild/Playwright tooling; mocked Supabase, no credentials or external writes): `node scripts/test_asset_library.mjs`. The SQL assertions in that script are static checks, not a deployed Postgres/RLS integration test.

### Notes
- Free-tier projects **pause after ~7 days** of no DB activity; resume in the dashboard or upgrade to Pro for production.
- Large print images inside builder state inflate the `state` JSONB column; later we can move assets to Supabase Storage.
