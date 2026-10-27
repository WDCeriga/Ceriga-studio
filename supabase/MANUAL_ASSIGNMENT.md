# Manual manufacturer assignment

The assignment dialog shows a primary recommendation, a secondary when available, and a selector for any available manufacturer. The primary is preselected; the superadmin must still confirm. It evaluates the saved sample and bulk options, with at least one valid quantity required. Known MOQ/capacity mismatches and paused factories are excluded.

The existing orders.assigned_manufacturer_id, assigned_at and due_quote_by fields store assignments. No existing order records were rewritten by the permissions migration.

## Production deployment — 20 October 2026

Applied 20261019010000_manual_order_assignment.sql to project yzpahvwywvalegsztnif (main, production) through the Supabase SQL editor. The user explicitly approved deployment without a backup after being informed that backup credentials were unavailable. No backup was created.

Supabase reported Success. No rows returned. The migration installs assigned-manufacturer order and supporting-file SELECT policies and a superadmin-only assignment validation trigger. It does not delete or update existing order data.

Production verification (supabase/verify_manual_assignment_live.sql) ran in a rollback-only transaction under the authenticated role for all four actual manufacturer accounts. Passed: each manufacturer can read every order assigned to it, and cannot read unrelated orders. Two saved assignments were present. Catalog checks confirmed both read policies and the assignment guard are installed. Verification made no persistent data changes.

Local isolated PostgreSQL tests passed: customer self-assignment rejected, exact-email superadmin assignment accepted, assigned factory sees its order and file, unrelated factory sees neither. Live file download, customer write and superadmin write were not exercised in this deployment; no customer orders were reassigned for testing.

The manufacturer Orders table queries actual assigned orders and refreshes every ten seconds while visible or on window focus. No new quotation workflow or payment behavior is introduced.

## Requirement review — 21 October 2026

Missing order fabric, GSM or decoration fields no longer produce a false manufacturer capability rejection. Missing information is shown separately as a quotation clarification warning; absent decoration is not silently declared to mean a plain garment. Existing garment review flags are respected: unconfirmed details require review and are not presented as verified capabilities. Quotation assignment remains possible while these details are clarified, without authorizing production.

Known garment/decoration mismatches, confirmed fabric/style/GSM mismatches, recorded capacity or MOQ shortfalls, missing quantities, and previous rejection still block assignment. More complete compatible profiles rank before profiles needing clarification. Confirm is disabled for a known mismatch. No requirements, manufacturer selections, confirmations or customer records are fabricated or backfilled.

`20261021040000_assignment_requirement_review.sql` verifies the existing JSONB fields and anonymous assignment restrictions without changing data. The revised dialog was verified against the actual saved Premium Cotton T-Shirt order: original is recommended, Confirm is enabled, and missing fabric/GSM appear as clarification warnings. No assignment was submitted during verification.
