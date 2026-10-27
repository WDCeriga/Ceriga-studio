# Database-backed features

- Every feature that reads or changes persistent data must include its database work: tables, columns, foreign keys, indexes, grants, RLS policies, storage policies, and server functions as applicable.
- Add a versioned migration in `supabase/migrations/` and update `supabase/schema.sql` for fresh installations. Keep migrations additive and repeatable where possible; preserve existing records.
- Apply authorized migrations to the configured Supabase project and verify the feature against the actual database before reporting completion. If credentials or approval block deployment, clearly report that the feature is not yet live.
- Allowlisted super admins must have SELECT, INSERT, UPDATE, and DELETE access to application data through `public.is_superadmin()`. Keep full-email matching and ordinary account isolation. Never expose service-role credentials in browser code.
- After adding an application table, include it in `public.apply_superadmin_access()` and call that helper in the migration. The helper is migration-only, never callable by anonymous or authenticated browser clients.
- Use server-side super admin authorization for privileged Auth operations. Deploy corresponding Edge Functions when introducing them.
- Test successful reads/writes, database errors, non-admin isolation, empty results, and required relationships. Do not hide database failures behind demo data or claim an action succeeded without persistence.
