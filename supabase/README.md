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

That script creates / updates:
- `projects` — saved studio projects (tech packs, packaging, etc.)
- `orders` — brand orders (tech-pack exports + production / upload quotes)
- `packaging_library` — reusable packaging design snapshots
- `brand_notifications` — in-app notification inbox
- `measurement_guide_packs` — shared measurement lines per garment SVG asset (read: signed-in users; write: emails in `superadmin_emails`)
- `superadmin_emails` — allowlist for who can edit measurement guides
- Storage bucket `order-uploads` — uploaded tech-pack files for quote requests (path `{user_id}/{order_id}/…`)

If you already ran an older `schema.sql`, re-run the full file (it uses `if not exists` / `drop policy if exists`) so the new tables, RLS policies, and storage bucket are applied.

**Storage note:** If the bucket insert fails in the SQL editor, create a private bucket named `order-uploads` in **Storage** and re-run the storage policies section.

To let another account edit guides in production:

```sql
insert into public.superadmin_emails (email) values ('you@example.com')
on conflict do nothing;
```

## 4. Auth
In Supabase: **Authentication → Providers**
- Enable **Email** (for login/signup forms).
- Optionally enable **Google** and set the same client ID as `VITE_GOOGLE_CLIENT_ID`.
  For Google ID-token sign-in, add your site origin to authorized JavaScript origins in Google Cloud Console.

## 5. Try it
1. Sign up / sign in in the app.
2. Open the builder, edit a garment, click **Save**.
3. Open **Projects** or **Home** — the project should appear and reopen with `?projectId=...`.
4. Submit a quote upload or finish delivery checkout — the order should appear under **Orders** and persist after refresh.
5. Save packaging from the reuse bar — it should land in `packaging_library` and show up when signed in.

### Notes
- Free-tier projects **pause after ~7 days** of no DB activity; resume in the dashboard or upgrade to Pro for production.
- Large print images inside builder state inflate the `state` JSONB column; later we can move assets to Supabase Storage.
- Manufacturer / factory portal screens still use local demo data; brand studio data (projects, orders, packaging library, notifications) uses Supabase when configured.
