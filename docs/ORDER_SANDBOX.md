# Isolated order batch

The one-time batch is in `.sandbox/order-batch-20261025/`. It contains a persistent PGlite PostgreSQL database loaded from Ceriga’s current schema, five synthetic identities (two brands, two manufacturers and one sandbox super admin), and 40 orders across 16 actual workflow stages.

Open `.sandbox/order-batch-20261025/viewer.html` directly in a browser. The portable viewer works without a server and includes search, account/stage filters, routing/production history, QC reports, review feedback and generated TEST evidence images.

This environment is separate from the running Ceriga/Supabase application. The accounts are test auth identities, not live Supabase logins. These orders will not appear in the live dashboards. Email, payment providers, storage service and cron delivery are isolated/mocked. Actual workflow functions, constraints, roles, permissions and order transitions run against the full database schema; evidence files exist in the sandbox’s local storage directory.

## Reuse

```powershell
node scripts/seed-order-sandbox.mjs
node scripts/verify-order-sandbox.mjs
node scripts/test-order-sandbox-viewer.mjs
```

Running the seed again does not add duplicate accounts or orders. It regenerates the portable viewer for the existing batch. Pass a new directory under `.sandbox/` to generate a separate batch.

Optional local read-only HTTP viewer:

```powershell
node scripts/order-sandbox-viewer.mjs
```

It binds only to `127.0.0.1:5180` and never connects to live services. The portable HTML is preferable when local network restrictions prevent access.

## Batch contents

- Assignment: 4 unassigned, 4 quotation requests, 2 requiring reassignment.
- Quotations: 3 revisions requested, 3 awaiting admin review, 3 awaiting customer submission.
- Production: 3 preparation, 3 cutting, 3 sewing, 2 finishing.
- QC: 2 awaiting submission, 2 pending review, 2 changes required.
- Delivery: 2 ready for dispatch, 1 shipping, 1 completed.

Factories also have recorded working weekdays, future closures with holiday overlap and an example reported production delay. The completed order includes a genuine QC correction/resubmission history with two versions. There are 16 generated PNG evidence files. No real photographs, payment transactions, carrier bookings or external notifications are used.

Production release uses the existing customer Submit-without-payment workflow. No verified payment rows or revenue are fabricated.

## Verification

Every seeded order’s persisted state was compared with its intended stage. The database was closed and reopened to verify durability, five accounts, 40 orders, zero verified payments, evidence files and account isolation. The viewer’s stage/account/search filters and QC version inspection have a JavaScript unit test. The application’s 30 existing regression suites passed after the test-database helper gained optional disk persistence.

Browser visual verification was unavailable in this session because the browser connection timed out. The portable viewer’s JavaScript syntax and data interactions were tested separately. `.sandbox/` is ignored by Git; application database schemas, permissions and production records were not changed by this seed task.
