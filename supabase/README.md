# Supabase setup for Ceriga Studio

## 1. Create a project
1. Go to https://supabase.com and create a project.
2. Open **Project Settings → API**.
3. Copy **Project URL** and **anon public** key.

## 2. Env file
Copy `.env.example` to `.env` in the repo root:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

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

### Notes
- Free-tier projects **pause after ~7 days** of no DB activity; resume in the dashboard or upgrade to Pro for production.
- Large print images inside builder state inflate the `state` JSONB column; later we can move assets to Supabase Storage.
