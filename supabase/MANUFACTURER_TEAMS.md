# Manufacturer teams and permissions

The existing Manufacturer → Team & roles page now manages authenticated factory membership. The organisation key is the existing `manufacturer_profiles.user_id`; order assignments and production records retain that key. Existing factories receive an Owner membership without changing account roles, orders, quotation amounts or production history.

## Database and deployment

`migrations/20261025020000_manufacturer_teams.sql` is also included in `schema.sql`. It adds:

- `manufacturer_team_members`: role, optional permission overrides (an empty array means no permissions), joined/activity dates, removal timestamp and optimistic revision.
- `manufacturer_team_invitations`: email-bound token hashes, expiry, acceptance/revocation and delivery state. Plain tokens are returned once and never stored.
- `manufacturer_team_contexts`: server-authoritative selected organisation per account.
- `manufacturer_team_order_assignments`: explicit order assignments for Staff.
- `manufacturer_team_audit`: actor, organisation, action, subject and timestamp.

All five tables have foreign keys, indexes, RLS and allowlisted-superadmin policies through the migration-only `apply_superadmin_access()` helper. Team management mutations require controlled server functions. Raw invitation records are available only to superadmins; factory managers receive a token-free projection.

The migration and `team-invite` Edge Function were deployed to the configured Supabase project. Existing retired capacity tables are optional. No historical manufacturer capability or order records are removed.

## Default roles

- Owner: full factory permissions, including settings and ownership management.
- Admin: daily operations, quotations, financial visibility and team management; no ownership management or factory settings by default.
- Production Manager: orders, production, QC, dispatch, calendar, materials and messages; no quotation pricing or team management.
- Sales / Quotations: relevant orders, quotation pricing, quotations, customer details and messages; no production or organisation management.
- Staff: only explicitly assigned orders, permitted production updates; no financial, team or shared factory-message access by default.

Owners can promote an accepted member to Owner, then demote/remove the previous owner. The last owner cannot be removed or demoted, including through direct database changes. Team administration serialises on the factory record and requires the current member/invitation revision. Administrators cannot grant permissions they lack or modify a more privileged member.

## Existing workflow integration

Existing quotation, production, QC, calendar, reporting and profile APIs keep their signatures and validations. Their implementations are private and invoked through permission-checked adapters; browser accounts cannot execute the private implementations directly. Delegation changes only the database-local factory principal for the duration of the authorised call, restores request claims afterwards, and records the actual authenticated actor separately. It never changes a browser session or gives a teammate the factory owner's platform-superadmin identity.

Produced quantities and order labels remain visible while monetary fields are redacted for non-financial roles. New quotations use the submitting account's saved currency; existing quotation currencies and payable snapshots remain locked. Production updates, QC inspectors/uploaders and team audit events record the real teammate.

Orders, QC records, private documents, notifications and calendars are scoped to the active organisation. Staff assignments are enforced on reads and writes. Portfolio permission does not grant access to factory verification documents. Removed memberships stop authorising new API requests immediately. Already issued QC/portfolio signed URLs can remain valid for up to 60 seconds, and previously downloaded files cannot be revoked. The UI rechecks permissions every 30 seconds and on focus; backend checks run on every action. Factory draft/cache keys are separated by organisation. Requests from an open workspace carry a factory context which the backend checks against live membership; switching another tab never silently redirects a pending form to a different factory. A removed context is rejected rather than falling back to another organisation. A user's independent brand-owned records remain accessible in their brand account.

## Email delivery setup

Set these **server-side Edge Function secrets** in Supabase:

- `RESEND_API_KEY`: a Resend API key.
- `CERIGA_INVITE_FROM`: an address/domain verified with Resend.
- `CERIGA_APP_URL`: the deployed public HTTPS Ceriga origin.

`team-invite` validates the user's JWT and calls the normal, permission-checked invitation RPC. Email URLs use only the configured app origin, never a caller-provided origin. Delivery failures are saved and shown; the UI never claims that an unsent email was sent. No privileged Supabase Auth user creation is performed. The recipient signs in or creates their own account on `/team-invite`, verifies the exact invited email and explicitly accepts the invitation.

Until email secrets are configured, invitations still persist and an administrator can copy a secure single-use link. A link generated on localhost works only where that local development site is reachable; use the deployed app for remote teammates. Invitations expire after seven days. Resending invalidates the previous token and records the newly authorised issuer. Removing an inviter revokes their pending invitations; acceptance also rechecks issuer permissions.

## Verification

- Automated suites include team authorisation, invitation endpoint failure paths and factory-cache isolation, alongside existing order/quotation/QC/calendar/currency regressions.
- Team security checks cover new/existing recipients, single use, wrong email, expiry, revocation, resend after ownership changes, invalid delegation, direct API escalation, Staff assignment, private document isolation, original-owner demotion, real actor attribution and quotation currency.
- Live database verification accepted an invitation, saved a production update, checked financial redaction and cross-organisation isolation, removed the member and verified access revocation. These test writes were rolled back.
- The live Edge Function rejected unauthenticated and non-member calls without creating invitations.
- The browser saved a reserved `.invalid` test invitation, displayed the missing-email-configuration message, and revoked it. Its revoked record remains as audit evidence; no email or operational access was granted.
- Real email delivery is not verified because the project has no custom mail secrets. Provider success/outage paths are covered with a mocked mail provider; no customer emails or payments were sent.
- Stale-revision and ownership-lock behaviour is tested. A simultaneous, multi-connection production race and physical mobile-device testing have not been performed.

Run `npm test` and `npm run build` from the repository root.

## Named staff roles (2026-10-26)
The primary factory account stays an owner but is excluded from the staff list. Named custom roles use organisation-scoped IDs in the existing member/invitation role field. The server validates role ownership on every assignment and invitation, and resolves permissions centrally. Custom roles can select all permissions the administrator possesses, but cannot confer ownership. Their operational scope covers the organisation; the built-in Staff role remains assigned-order-only. Existing member-specific overrides remain explicit and can be reset to role defaults. Role edits use optimistic revision checks and immediately affect members using defaults. Referenced roles are retained for history. Migration: 20261026010000_custom_manufacturer_roles.sql; fresh-install schema updated. Existing invitation endpoint needs no signature change.

## Invitation account setup (2026-10-26)
New invitations provision an unconfirmed Auth account through the server-only generateLink invite API after the caller's factory/team permissions are validated. The invitation fragment carries a one-time Auth verification token for initial password creation. Existing users keep their credentials and records; signing in accepts their scoped team membership. Invited email is read-only and retrieved only with a valid, unexpired, unrevoked high-entropy team token. Pending, passwordless, unjoined invited accounts can renew setup links; active members never receive a password-reset link through team invitations. The lookup returns no password hashes or user IDs. No new table is needed. Email-provider configuration is still required for email delivery; copy links remain available.

## Required password completion (2026-10-26)
Supabase may create an internal password hash for an invited account, so hash presence alone is not proof of user setup. Migration 20261026030000_require_team_password.sql adds manufacturer_team_account_setup with self-read-only RLS and full allowlisted superadmin access. The invitation service records newly provisioned accounts as pending. Only a real Auth encrypted_password update completes that record through a database trigger; staff cannot complete it through a direct table write or RPC. Existing invited staff are backfilled once, without changing credentials. Pending members have no effective factory permissions and cannot accept an invitation. Their existing sessions redirect to /team-password. Invitation links display the password form before exchanging the Auth token, so opening a link no longer automatically signs in. Existing users with completed credentials retain normal sign-in. Auth account creation and email providers remain mocked in automated tests; live verification checks pending-member permission denial without changing any credentials.
