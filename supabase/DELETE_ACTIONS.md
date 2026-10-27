# Admin deletion setup

Apply `migrations/20261017_superadmin_order_delete.sql` to an existing database. New installations include this policy in `schema.sql`.

Deploy the account deletion function with the Supabase CLI:

```sh
supabase functions deploy admin-delete-account --project-ref YOUR_PROJECT_REF
```

The function uses Supabase's server-side `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` environment variables. Never expose the service role key to the browser.

Every account deletion verifies the caller's JWT and the existing `is_superadmin()` allowlist. Users cannot delete their own account. Accounts owning orders must have those orders explicitly deleted first. Other foreign-key restrictions, such as invitations created by the account, are reported as errors; they are not silently removed. Auth deletion cascades to associated profile records. Assigned manufacturer references become null through the existing foreign key.

Connected admin lists use database records without merging demo accounts back into the results. Local demo accounts cannot be deleted through the remote API. Team member deletion follows the current browser-local factory workspace storage model and preserves the acting member and last active administrator.

No real account or order should be deleted as part of a test run.
