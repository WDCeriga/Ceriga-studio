# Manufacturer quotations — 20 October 2026

Manufacturers can enter a total factory price in GBP and lead time for each saved sample/bulk option on the real assigned-order details page. Orders without a quantity plan offer a production quotation with quantity input. Submitted quotes can be revised until customer pricing is issued. GBP matches the existing superadmin pricing review; other currencies are not accepted by this submission function.

Submission calls public.submit_manufacturer_quote(uuid,jsonb), an authenticated-only security-definer RPC. It locks the order, checks assignment and allowed stage, validates tiers, and updates only manufacturer_quote, factory_status and quoted_at (plus the existing updated_at trigger). It grants no general manufacturer UPDATE access. Submission becomes pending_review in the existing superadmin adapter; the existing visible-page polling refreshes the queue. Lead times are included in review. This is a queue handoff, not an external message or email notification.

Migration 20261020010000_manufacturer_quote_submission.sql was applied successfully to production project yzpahvwywvalegsztnif. schema.sql contains the same function and grants for fresh installations. No new tables or payment behavior were added. No backup was created, consistent with the user's explicit preceding approval to apply the permissions fix without backup.

Validation: build passed; isolated PostgreSQL tests passed for assigned submission, customer/other-factory denial, invalid/empty quotes, stage lock, and unchanged customer price/payment. Adapter tests confirm pending_review, tier amount and lead time. Live rollback-only verification passed on an actual assigned order: customer submission denied, assigned manufacturer submission persisted, exact-email superadmin read it, and customer status, price, payment and assignment remained unchanged. All verification quote changes were rolled back. Anonymous EXECUTE is false. The live manufacturer UI was checked with the actual assigned order; no test quotation was permanently submitted through the UI.

Rollback: revoke authenticated execute and drop public.submit_manufacturer_quote(uuid,jsonb), then remove the form call. Existing quotations remain in the order record. Do not delete saved customer or quote data to roll back the UI.

## Deployed update: unit prices and rejection

20261020020000_quote_unit_prices_rejection.sql derives quantities from the customer plan or an exact positive integer request quantity; it normalizes totals to unitPriceCents × saved quantity and ignores client totals/quantities. Missing quantities block quoting. The form is higher on the order page and no longer permits quantity editing. Each customer sample/bulk option has a unit price and lead time.

The new reject_order_quotation function allows the assigned factory to decline with a reason (rejected/reroute), and exact-email superadmins to return submitted quotes for revision (clarifying). It preserves prior quote values. Resubmission clears the rejection reason. Existing priced/payment statuses cannot be modified by these functions.

Local isolated PostgreSQL tests passed for server quantity/total enforcement despite tampered input, decline, admin rejection and revision/resubmission, customer/unrelated isolation, invalid input, and unchanged price/payment. UI arithmetic verified £12.50 × 6 = £75.00, with quantity read-only; test input cleared without submission. Build passed.

After the initial automatic-review block, the user explicitly approved this separate quotation migration without backup. Applied 20261020020000_quote_unit_prices_rejection.sql successfully to production yzpahvwywvalegsztnif on 20 October 2026. Live rollback-only verification (verify_quote_unit_prices_rejection_live.sql) passed: server quantity and total calculation, customer isolation, superadmin revision request, manufacturer resubmission and decline. All verification changes were rolled back; no test quote or rejection was left on the customer order. No backup was created. Rollback requires restoring the prior submit_manufacturer_quote definition and revoking/dropping reject_order_quotation; existing quotes and rejection reasons should be preserved.

## Deployed currency update

20261020030000_quote_settings_currency.sql replaces the GBP-only submission validation with the manufacturer's saved manufacturer_profiles.pricing.preferredCurrency (GBP/USD/EUR). Existing quotations keep their recorded currency (legacy missing currency = GBP) when revised; amounts are not converted or relabelled. This uses the existing JSON fields and adds no tables or columns.

The quotation form reads the same useManufacturerPricing hook as Account currency in Settings, waits for sync readiness, labels unit price and totals with the currency, and retains a draft currency once a price is entered. Superadmin tier adapters, review and quote displays retain the saved currency. Production now accepts the account currency for new quotations and retains the recorded currency for revisions.

Local PostgreSQL tests passed for EUR/USD/GBP, currency mismatch rejection, retained original currency after Settings changes, and unchanged amounts. Adapter tests preserve EUR. Browser check confirmed the current account's EUR setting appears on the quotation input. Following explicit user confirmation to apply this separate currency migration without a backup, 20261020030000_quote_settings_currency.sql was deployed successfully to production yzpahvwywvalegsztnif on 20 October 2026. Live rollback-only verification passed, including a targeted check on the affected EUR manufacturer order. Currency and unit totals persisted, customer price/payment remained unchanged, and all test changes were rolled back. No backup was created. Verification script: verify_quote_settings_currency_live.sql. Rollback restores submit_manufacturer_quote from 20261020020000; retain already saved quotes and their currencies.

## Customer quote publication repair

The superadmin detail action and review queue previously discarded approved tier amounts and saved only status=priced. They now pass every final tier amount to adminPatchOrder, which checks is_superadmin(), reads the saved manufacturer tiers, validates all prices, and writes price_options, priced_at, status and status_label together with a confirmed returned row. The customer's options include approved totals, quantity, saved currency and lead time; manufacturer cost fields are not copied into customer price options.

This is a repair to existing orders columns and existing RLS permissions; no new tables, columns, grants, server functions or storage changes are needed. The canonical schema already defines price_options and priced_at. Actual production read/write permission checks passed in verify_customer_quote_publication.sql using an actual order under admin, customer and unrelated-factory authenticated roles. All test writes were rolled back.

Old status-only publications with no price_options return to superadmin review and can be reissued. Lost custom approved values cannot be reconstructed: no backfill guessed customer amounts. The customer page displays an explicit finalisation message instead of an empty ready quote. The detail hook refreshes every 10 seconds while visible and on focus; refresh failures are shown.

Customer production quote cards show a Pay button with no navigation, handler or payment-state update. No payment provider is called. Tech-pack checkout behavior is outside this production-quote repair. Build and adapter/persistence tests passed, including errors, no-admin access, invalid amounts and paid-stage protection. No customer quote was permanently published as a test.
