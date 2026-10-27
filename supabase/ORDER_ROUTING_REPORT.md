# Order routing and offers — implementation and deployment report

Date: 21 October 2026. Production project: yzpahvwywvalegsztnif.

The user explicitly approved applying 20261021010000_order_routing_and_offers.sql without a backup. No independent backup or restore test was performed. The migration is applied to the production database. Application changes are in this local checkout; no hosted frontend deployment was performed.

## Result and improvements

- Customers submit unpriced production orders for admin review, including actual quantities and required print methods.
- The recommendation engine offers a primary and, when available, secondary factory. It checks onboarded active status, garment compatibility, recorded capabilities, shipping, MOQ and available capacity. Actual quote timeliness is used when all candidates have sufficient observations; actual workload breaks further ties. Equal candidates use a stable randomized order-ID/factory-ID tie break, so recommendations do not shuffle during polling. Missing data is identified for manual checking; no performance statistics are invented.
- The superadmin retains manual assignment and can select another available factory. The database validates authorization, active onboarding and rejection history.
- Manufacturers quote saved customer quantities with unit prices and sample/bulk lead times. Declines return to admin routing. Admin quote rejection also requests another factory. Previous rejecting/rejected factories are excluded for that order.
- Reassignment clears stale quotations and unpublished customer prices. Rejections retain a reason and routing history.
- Admin publication saves the approved prices and a server-issued deadline exactly 30 days later. An active offer cannot be silently republished to extend its deadline. An expired offer requires renewed admin approval.
- Customer payment controls block expired/missing offers. Payments remain disabled in the application and database. Simulated checkout can no longer mark orders paid or start production.
- A service-role-only payment-confirmation function validates the approved option, amount, currency, payment timestamp and unique provider event. Once a provider is connected and payments explicitly enabled, verified payment releases the order directly into the assigned factory's production queue. Browser accounts cannot call this function. Provider webhook signature verification is still required before enabling payments.
- New production orders use routing version 2. Existing orders retain their existing fields and NULL routing version. No bulk backfill or historical order rewrite was included.
- Existing superadmin notes, deletion and file access remain available under existing policies. Workflow state changes for new orders must use checked functions. Customer messaging remains removed; staff/manufacturer messaging is retained.

## Database work

Migration: supabase/migrations/20261021010000_order_routing_and_offers.sql. Canonical fresh-install schema updated in supabase/schema.sql.

Adds order routing/offer/payment-release metadata, routing events, disabled payment controls, verified-payment receipts, indexes, foreign keys, RLS and grants. Extends the migration-only superadmin helper and calls it. Adds checked assignment/publication/payment functions and updates quote submission/rejection. The order guard also blocks changing the identity/type/owner of a version-2 order to bypass workflow checks.

The dashboard's extra RLS safeguard initially attempted to enable RLS on the temporary preservation-check table after it had been dropped at commit. It reported a missing temporary relation after the migration committed. A schema inspection confirmed deployment; the full live rollback-only verification then passed and confirmed RLS on all new persistent tables. No attempt was made to bypass the rejected Run-without-RLS option.

## Verification

Passed isolated database tests: migration applied twice; every pre-existing order field unchanged; new order insertion; customer self-assignment/direct-price/type-change denial; assigned factory access and previous factory isolation; manufacturer quote and decline; admin rejection and reroute; exclusion of prior rejected factory; clearing stale quotes; publication; exact 30-day expiry; duplicate active publication denial; expired payment denial; private audit/receipts; browser payment denial; disabled-payment denial; wrong amount/currency denial; service-only verified production release; provider-event idempotency; refusal to reroute a paid order.

Passed application tests: manufacturer recommendation ranking, capabilities/shipping/MOQ/capacity constraints, randomized stable tie distribution, customer/admin order mapping, checked assignment/publication calls, database error propagation, currency preservation, offer expiry boundaries and disabled checkout.

Production verification script: supabase/verify_order_routing_v2_live.sql. Passed against existing real customer/admin/factory identities using a newly inserted transaction-only order. Verified assignment, decline/reroute, quotation, publication, exact deadline, customer access, previous-factory isolation, private audit and receipt isolation, function privileges, type-change denial, disabled payments, and preservation of every pre-existing order during the test. All fixture writes were rolled back. No customer price, assignment or payment was committed by the test. Live production-release payment was not simulated; that path was tested in the isolated database.

Production build passed. Vite retains existing large-chunk and mixed static/dynamic import warnings.

Evidence: .tmp-order-routing-live-verified.png.

## Recovery strategy and remaining limits

No destructive automatic down migration is supplied: dropping payment receipts or routing history would lose records and weaken protections. Before any recovery, stop new submissions/assignments/publication, leave payment controls disabled, and export current orders plus all new routing/payment records and relevant uploaded files. Keep the additive columns/tables and their RLS policies. Prefer a corrective forward migration for an identified defect.

A frontend rollback must preserve the checked RPC transitions for version-2 orders. Restoring old direct-write clients alone would fail safely under the workflow guard. Historical NULL-version orders must not be mass-converted. Reverting function bodies requires a reviewed per-function migration using their prior definitions in the previous versioned migrations, retaining the version-2 payment guard until each affected new order has an explicit recovery decision. Do not restore an old snapshot over newer customer records. This is a recovery procedure, not a tested independent backup restore; no backup exists for this deployment by explicit user waiver.

Real purchases remain unavailable until a payment provider is selected, signature-verified webhook implementation is deployed and tested, and both application/database payment gates are deliberately enabled. Payment amounts must come from approved server data; a browser success redirect must never release production. Missing manufacturer onboarding data still requires manual review. Historical status-only quotes with no approved saved amounts require admin republication; prices are not fabricated.

## Follow-up: actual sample/bulk production matching (21 October 2026)

Recommendations and the assignment dialog now use the customer's persisted specifications and the manufacturer's confirmed per-garment onboarding details. They check fabric, GSM range, fit, neck, sleeve and recorded additional construction requirements, selected decoration methods, every positive sample/bulk option, capacity and method-specific minima. Bulk garment MOQ is not applied to samples, but decoration method minima are. Trousers are no longer assumed interchangeable with joggers, nor jackets with outerwear. Equal qualified candidates retain the existing performance/workload/stable-random ordering.

Detailed garment settings now persist in the existing manufacturer_customisation_settings.settings JSONB. New orders retain construction selections as well as fabric/GSM/decorations. The current saved capability map takes precedence over older broad profile capability labels. Missing requirements, unconfirmed suggestions and unsupported features do not qualify for a recommendation. The assignment UI explains incompatibilities and refuses that selection. This is application matching and assignment validation; the existing admin-only database assignment RPC still permits an authorized admin caller outside this UI to assign any active onboarded factory.

The versioned 20261021020000_production_capability_matching.sql is a read-only schema/RLS readiness migration: existing JSONB storage and isolation support the new payload without adding columns or changing records, grants or policies. It ran successfully on production. supabase/verify_production_capability_matching.sql verified owner persistence/reload, admin read and other-account read/write isolation against the actual database, with all fixture changes rolled back. No historical profile was fabricated or backfilled. Previously local-only manufacturer details need to be saved again in onboarding; historical orders missing specifications need review before they can receive a confirmed recommendation.

Passed scripts/test-assignment-recommendation.mjs, scripts/test-production-capability-persistence.mjs, customer/admin mapping and existing workflow/database regressions. Production build passed with existing bundle warnings. Matching uses saved structured requirements; it does not infer machine capability, exact artwork dimensions, free-text requirements or size measurements from preview images. Those still require factory/admin review.
