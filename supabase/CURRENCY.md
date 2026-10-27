# Central account currency

## Investigation and changes

The previous implementation had three conflicting display paths. Brand `Settings.tsx` kept an unsaved page-local currency (including unsupported AUD); manufacturers saved `manufacturer_profiles.pricing.preferredCurrency` with local snapshots; superadmin pages defaulted to GBP. `currency.ts` formatted cents without conversion. `userOrders.formatEuro`, order history and checkout forced euros. The quote calculator supplied fixed/manual FX, and `publish_order_quote` copied the manufacturer currency onto the customer price. Dashboard aggregates added raw cents from different currencies. Missing manufacturer quote currencies were sometimes defaulted to GBP. Existing price books and typed integer-cent quote fields were suitable for reuse.

These paths now use `profiles.preferred_currency` as the authoritative preference for brands, manufacturers, workers and allowlisted superadmins. Explicit saved manufacturer preferences seed the field; otherwise new display preferences default to EUR. This does not assign EUR to historical prices. Manufacturer onboarding JSON stays compatible through synchronisation triggers. Settings save through `set_account_currency`, and the central account store loads at login/refresh, updates immediately after persistence, checks on focus and periodically reads remote changes. Local storage is not the authority.

`CurrencyContext.tsx`, `accountCurrency.ts`, `currency.ts` and `Money.tsx` serve the shared state, display conversion and formatting. Components subscribe without remounting active forms. Source amount/currency inputs remain explicit. Indicative displays cover catalogue/POD prices, manufacturer guidance/sample ranges, shipping estimates, quote reviews, orders, history, pricing tools and financial dashboards. Transaction views retain original charged currencies alongside optional indicative equivalents. Converted displays carry an approximation marker. A missing rate keeps the labelled original; uncertain original currencies show a review message. Mixed-currency totals become unavailable when a constituent cannot be safely converted rather than silently summing incompatible amounts.

Known base-price configuration fields remain in their explicit source currency; changing a display preference never rewrites catalogue prices, manufacturer price books or accounting records. Public help text can still state original EUR catalogue prices, and source-currency editing fields intentionally keep their original code.

## Exchange rates

Provider: Frankfurter, using its ECB provider endpoint at `https://api.frankfurter.dev/v2/providers/ecb/rates?base=EUR&quotes=USD,GBP`. This is a public reference-rate API and requires no API key. Postgres `pg_net` fetches the fixed HTTPS URL; browsers cannot submit URLs or cache values. All account contexts share one server cache and a row lock prevents request stampedes. Refresh is demand-driven when accounts are active, not a separate API call per price.

Default cache policy in `currency_rate_cache`: refresh after 24 hours, indicative retrieval age up to 72 hours, new binding conversion retrieval age up to 24 hours. The refresh/binding intervals are configurable with database admin access; shorter binding ages also trigger more frequent refreshes. ECB source dates must be no more than seven calendar days old to accommodate market closures. Every snapshot exposes the provider, source date and retrieval timestamp. Invalid, missing, future-dated or expired data is rejected. Failures retain previously fetched rates only within the relevant acceptable age. Existing approved quotations do not need a new rate.

Conversion uses exact rational arithmetic over integer minor units in the client, and Postgres `numeric` on the server. Rounding is half away from zero. EUR, GBP and USD each have two minor-unit digits. Saved quotes retain both EUR-based rate operands as well as the cross rate, so later reconciliation does not depend on rounding a recurring cross rate. `Intl.NumberFormat` handles locale, grouping and symbols; USD includes its code.

## Quotation and payment integrity

Manufacturers submit integer-cent prices in their saved preference. Existing quotations retain their original currency on revision. Admin review shows originals and indicative account-currency equivalents. The approved input remains clearly labelled in the original manufacturer currency, preserving the existing markup calculation.

`publish_order_quote` resolves the brand preference on the server and converts the already-approved total once. It records the original manufacturer amount/currency, original approved total, markup difference, explicitly supplied shipping/tax/fees, rate operands, provider/date, final payable cents/currency and exact issue/expiry timestamps. The existing manufacturer form's total includes shipping/other costs; the migration does not add those costs or the commission again. Explicit additional components are subdivisions of the approved total, not extra charges.

`order_quote_currency_snapshots` preserves issued options and original quote JSON. Snapshots are immutable, and direct browser edits to issued price options are blocked. The original 30-day validity is unchanged. An unexpired issued offer cannot be silently republished. A currency change only changes indicative displays; checkout prints the original approved payable amount and code. A different payment currency requires another approved quotation through Ceriga's quotation workflow.

The service-only payment verifier retains exact amount/currency matching against the locked option, rejects browser payment confirmation, validates supported currencies and persists the charged currency in `orders.paid_currency`. Provider receipts already keep exact charged amounts/currencies. No browser-calculated FX amount is used as a payment authority.

## Migration, security and historical data

Migration: `migrations/20261022020000_central_currency.sql`, also included in `schema.sql` for fresh installations. Applied to the configured Supabase project. New fields are additive. New rate-cache and quotation-history tables have foreign keys/indexes/RLS as applicable and are included in the migration-only `apply_superadmin_access()` helper. Ordinary accounts only read their own quotation history; they cannot read/write the cache directly or approve quotes. Allowlisted superadmins retain grants/policies through `is_superadmin()`, with immutable-history guards. No service-role credentials are exposed to browsers. No new Edge Function was needed.

Original historical records are not assigned currencies from account preferences. Only verified payment receipts backfill charged currency. Symbol-less legacy ranges and bare dollar ranges are not assumed to be GBP/USD. The live audit found four orders, including one with missing payable currency; it was left unchanged. Superadmin settings list ambiguous records. An admin can explicitly request a revised quotation for an unpaid, unreleased ambiguous order with a reason. Previous price/quote JSON, dates, actor and reason are preserved in routing history, and the manufacturer submits a fresh quotation with an explicit currency. Paid/released records are protected from this action and require evidence-led administrative reconciliation.

## Verification

Automated checks:
- `node scripts/test-central-currency.mjs`: repeatable schema, backend preferences, manufacturer synchronisation, RLS/ownership, mocked server transport, USD source to GBP issue, commission once, 30-day lock, immutable history, changing preference/rates without mutation, payment mismatch/browser denial, idempotency, unavailable/expired cache and explicit historical review.
- `node scripts/test-currency-utilities.mjs`: exact parsing, rounding (including negative and recurring ratios), overflow, formatting, unavailable/expired rates, login/device preference reload, immediate changes, account isolation, database errors and no per-price API calls.
- `node scripts/test-manufacturer-currency.mjs`: original price books, safe legacy parsing, sample fees/multipliers and profile database adapters. Browser checks are separate.
- Existing manufacturer-submission, order-routing and simplified-QC regression suites pass; `npm run build` passes.

`verify_central_currency_live.sql` executed against the actual database with live ECB rates. It verifies account preferences, original USD retention, GBP issuance, margins, validity, immutable snapshots, preference changes, ownership, mismatched payment currency/amount, successful service-side verification and expired-rate rejection. All fixture orders, payment-control changes and preferences roll back.

Browser checks confirmed saved GBP/EUR preferences and persistence after refresh. The same existing shipping estimator result changed numerically from GBP 4,654.00 to EUR 5,552.04 using the fetched rate. The account's original EUR preference was restored. This checks conversion of an indicative estimate, not a booked shipping charge.

## Remaining operational limits

The backend migration and live reference-rate integration are deployed. Frontend code is in this workspace; hosted frontend deployment is separate. Production checkout retains the previously authorised temporary Submit mode, and payment-provider charging remains disabled. Backend receipt validation was exercised with rolled-back fixtures; no live money was charged. Existing local preview shipping/analytics/manual-ledger tools remain preview tools; this change converts their explicit source values but does not turn them into carrier integrations, payouts or a new accounting system. The flagged legacy order still needs an admin to establish its original currency. ECB reference rates are daily reference data, not an intraday trading feed.
