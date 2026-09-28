# Run — Ceriga Studio (Vite app)

## Reproduce uncommitted artifacts

- Env: `.env` must exist at the project root with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public anon key only; never `SUPABASE_SERVICE_ROLE_KEY` or `POSTGRES_*`). Copy it from the main checkout if missing. `vite.config.ts` exposes both `VITE_` and `NEXT_PUBLIC_` prefixes.
- Dependencies: `node_modules` is committed-tracked locally; if absent, install with `npm install`.

## Run the server

- Dev server: `npm run dev` (runs `vite`), default port **5173** (`http://localhost:5173/`).
- Prefer the default port; if taken, pass a free port via `--port` and update the preview URL.
- Start detached on Windows so it outlives the session:
  ```
  powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
  ```
  Use different files for stdout/stderr, confirm the pid with `Get-Process -Id <pid>`, and wait until `http://localhost:5173/` answers 200 before registering the preview.