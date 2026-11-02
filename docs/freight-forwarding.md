# Freight forwarding in quotation review

The existing quotation workflow now treats each sample/bulk option as a separate possible shipment. Manufacturer unit prices exclude freight. Shipping terms are submitted with that same quotation, and a new manufacturer revision invalidates previous shipping selections by comparing the complete original tier and assigned factory.

## Operational workflow

1. Manufacturer submits manufacturing prices and shipping terms for every requested quantity option.
2. Super Admin opens the order quotation review. Keep manufacturer shipping or choose **Find Alternative Shipping**. Freight requests are made externally; confirmed responses are entered manually and compared on the order.
3. Manage forwarder contacts, routes and services under **Shipping → Freight forwarders**. The previous carrier reference directory is retained.
4. Enter manufacturing subtotal including the existing Ceriga margin, shipping service fee, taxes, known duties and other charges. Preview the full customer quotation, then issue it. Shipping is added server-side; do not include it again in the manufacturing subtotal.
5. The existing approved quotation remains valid for 30 days. It stores original freight terms, cost-currency conversion metadata and the customer-payable breakdown in immutable quotation history. Customer and factory projections exclude private freight costs and margins.
6. Production requires a verified full-payment receipt matching the approved option, amount and currency. The temporary customer submission-without-payment path remains available only for historical offers without the new freight snapshot.
7. The existing three production stages and automation remain unchanged. Finishing leads to the existing QC submission and approval process.
8. Following QC approval, admins record collection instructions and logistics updates within existing delivery details. Complete the existing approved QC release dispatch before carrier transit. Delivery uses the existing order completion function, with full release/quantity checks.
9. Paid shipping changes require an explicit admin-approved amendment and reason. Ceriga absorbs cost differences; the locked customer amount and original terms are preserved. Pricing changes require a separately approved commercial process; this feature does not silently reprice an existing obligation.

## Database

`supabase/migrations/20261101010000_freight_quotation_integration.sql` is additive and repeatable, and is included in `supabase/schema.sql` for fresh installations. Apply it after the existing team, currency, QC and three-stage production migrations. It adds:

- `freight_forwarders`: admin-only directory.
- `order_freight_quotes`: immutable original/alternative quote records bound to an order, option, factory and manufacturer quote version.
- `order_freight_selections`: explicit approved selection per option.
- `order_shipping_amendments`: immutable paid-order provider amendment audit.
- `order_logistics_events`: immutable, idempotent shipment history.

All tables have foreign keys, range/ownership indexes as appropriate, RLS and allowlisted `public.is_superadmin()` access through `public.apply_superadmin_access()`. That helper remains unavailable to browser clients. Manufacturer/customer reads use the permission-scoped `freight_context` RPC. Privileged quote selection, previews and logistics actions require server-side super admin authorisation. No new Edge Function, external shipping API or scheduled production job is introduced.

Original issued offers and historical transactions are not migrated or relabelled. New issuance from an older manufacturer quote requires a revision separating manufacturing from shipping; existing inclusive prices are never guessed or silently stripped.

## Verification and deployment status (1 November 2026)

- New freight database integration tests execute against isolated PostgreSQL semantics (PGlite), including complete payment → three production stages → QC → dispatch → delivery/completion.
- UI tests cover required shipping fields, exact amount parsing, integer cartons, customer breakdown, permissions, duplicate submission prevention and saved feedback.
- Shared shipping fields were checked in a real browser at desktop and 390px mobile width, with no horizontal overflow. These were explicitly labelled UI-only fixtures, not production data.
- A read-only call to the configured Supabase project returned `PGRST202`: `freight_context` is not deployed. Local configuration contains only a public application key; no migration-capable project credentials or linked Supabase CLI are available. **The migration has not been applied to the live project.**
- The existing application has no configured online payment collection. Freight checkout now clearly displays that limitation and cannot use the no-payment release shortcut. The existing service-role-only verified-payment RPC is retained and tested; production payment collection is not claimed as operational.
- Forwarder quotes and tracking are manually entered, with no external carrier booking, quote retrieval or live tracking API. Proof of delivery is a validated HTTPS document link, not a new document storage bucket.
- Existing bundle-size/dynamic-import build warnings remain. The older `production-timeline` regression expects five stages and fails identically when the freight migration is removed; the new freight end-to-end test verifies the existing three-stage workflow instead.

## Follow-up verification — 2 November 2026

Added `20261102010000_freight_logistics_safety.sql`: server/database checks prevent backwards logistics transitions, including direct admin inserts. Exceptions retain the last actual shipping stage; an admin may resume it or advance to an eligible next step. The interface offers eligible statuses and restores saved carrier, tracking, collection and proof details for subsequent updates. Both freight test suites and the production build pass. A fresh read-only project check still returns PGRST202 for `freight_context`; neither freight migration is live. Migration credentials and online payment collection remain unavailable.
## Production deployment completed — 2 November 2026

This supersedes the earlier deployment blockers above. An authenticated Supabase dashboard session was available for the configured project. Applied the existing three-stage compatibility migration and both freight migrations atomically through the production SQL Editor, following a successful rollback-only trial:

- `20261028010000_three_stage_production.sql`
- `20261101010000_freight_quotation_integration.sql`
- `20261102010000_freight_logistics_safety.sql`

The committed database retains all 15 production plans and 14 active orders, with zero plans flagged for review. A deployment marker in `platform_settings.freight_deployment` records the migration versions. Verified actual allowlisted admin insert/update/read, ordinary-account isolation, migration-helper denial, and RLS on all five freight tables. Synthetic verification records were rolled back (zero left). An independent public-key REST call now finds `freight_context` and correctly rejects anonymous access with SQLSTATE 42501, rather than the previous missing-function error.

The current local application successfully loads **Super Admin → Shipping → Freight forwarders** from the deployed database, showing the genuine empty directory without database errors. No real forwarders, orders, payments or quotations were created as test data. Existing payment collection is still unconfigured; deploying these database migrations does not enable an external payment provider or publish a new frontend hosting release. Full verified payment remains mandatory for new freight-backed production orders.
