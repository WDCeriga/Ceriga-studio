# Dashboard workspaces

The existing Super Admin and Manufacturer homepages share `OperationsDashboard` and use the role-checked `portal_dashboard` RPC. Navigation and order workflows are reused.

## Data definitions

- Current counts and action queues: `orders`, latest assigned-manufacturer `order_production_updates`, and latest version-2 `qc_inspections`. Current work covers all dates, independently of the reporting period. Completed, ready and cancelled records are excluded from active orders.
- Production: authorised processing orders before QC approval, with pending QC review shown separately. Customer submission under the existing payment bypass policy is not described as a verified payment.
- Revenue: only `order_verified_payments.provider_paid_at` in the reporting period. Original currency totals are converted using the existing account currency provider; quotations and bypass submissions are excluded.
- Activity: actual `order_routing_events`, `qc_audit_events` and production updates. Manufacturer results require the current assignment and matching manufacturer identity. Raw event details and internal margins are omitted.
- Orders received: creation dates for admins, assignment dates for manufacturers. Completions use recorded completion dates.
- Quotation response time: routing quotation events paired with the preceding assignment or revision request. Acceptance uses decided quotation versions; pending versions are excluded.
- Production duration: production release to first QC submission, with sample count displayed. This does not measure shipping time.
- QC approval: approved reports divided by reviewed reports. First-submission approval uses the first reviewed report per order and manufacturer.
- On-time completion: unavailable because existing records do not preserve an immutable agreed completion deadline. No historical deadline is inferred.
- Delays: latest reported delay or overdue recorded expected completion, excluding approved or pending-review QC.

## Delivery and efficiency

Migration `20261024010000_dashboard_workspaces.sql` adds the read-only RPC and five indexes, without adding tables or rewriting records. It is also included in `schema.sql` and has been applied to the configured Supabase project.

Each refresh uses one RPC. Tables and tasks return at most 12 rows, activity at most 20; counts remain uncapped. Search is debounced. Refresh runs every 30 seconds while visible and on focus or existing workflow events. Errors remain visible without substituting demo records.

## Verification

- `npm test`: 28 suites passed, including actual isolated-database assignment, quotation, verified payment, production, QC revision/approval, dispatch and delivery workflows, authorization, date filters, bounded results and migration repeatability.
- `npm run build`: passed; existing large-chunk warning remains.
- `verify_dashboards_live.sql`: passed against the configured database in a read-only transaction, comparing real order counts and checking manufacturer isolation, financial projection and access denial.
- Live manufacturer browser: reporting period, search empty state, sorting and stage-specific delivery navigation verified.
- Both layouts were tested through server rendering. A logged-in Super Admin browser session and mobile device interaction were not available for live visual verification; responsive layout rules are implemented.
