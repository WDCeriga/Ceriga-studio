# Smart production calendar

## Where it lives

- Manufacturer → Production calendar (`/manufacturer/capacity`).
- Super Admin → Production calendar (`/superadmin/time-off`).
- Factory capabilities, MOQ and monthly capacity remain editable in manufacturer settings and onboarding. Existing capability records are retained.

The pages offer month/week navigation, Today, date details, deadlines, production links and workload summaries. Manufacturers can select single/multiple dates, click a range, or enter start/end dates. Unavailable periods can be edited or removed. New time off takes effect immediately without admin approval; historical pending requests stay intact until edited or reviewed through the existing backend action.

## Data and migration

`20261025010000_smart_production_calendar.sql` extends existing `manufacturer_availability` with revision, timestamp, creator, factory time zone and prior-version history. It adds working weekdays, time zone and revision to existing `manufacturer_profiles`, plus two partial indexes. It creates no duplicate order or availability tables. Original RLS and allowlisted-superadmin access remain in force.

The migration is applied to the configured Supabase project and included in `schema.sql`. Live write testing exposed a missing legacy `manufacturer_profiles.city` column referenced by the existing profile-sync trigger. The same migration adds it if absent and preserves any saved city from profile JSON. An isolated legacy-schema regression reproduces that shape and verifies the repair.

`save_calendar_availability` validates ownership, inclusive date ranges and optimistic revisions, locks concurrent updates and treats identical saves as no-ops. The whole selected-date batch succeeds or fails in one transaction. Removal marks a period withdrawn; it does not delete history. Changes create database notifications for admins. Existing order dates, assignments and production commitments are never rewritten.

`production_calendar` performs server-side filtering/aggregation and returns only the caller’s authorized data. Date windows are capped at 62 days; detailed orders are capped at 300 with an explicit total and narrowing guidance. Summary counts and day counts use the uncapped result. It reads authorized processing orders, their selected quantity option, latest production updates, current availability, factory schedules and capacities. It excludes completed/shipping and unreleased work. Existing QC-approved dispatch orders stay visible, but no longer consume production workload.

`manufacturer_calendar_signals` is admin-only. Matching incorporates recorded closures, unknown working schedules and estimated workload, explains these factors and retains primary/secondary recommendations. A closure does not itself exclude a quotation candidate because quotation due dates are not production deadlines. No automatic reassignment occurs.

The assignment dialog includes a collapsible scheduling explanation and a link that opens the calendar filtered to the selected manufacturer. Network calculations cover onboarded factories that are not paused; manufacturer accounts can manage their own calendar independently.

## Scheduling assumptions and accuracy

- Dates are inclusive SQL `date` values. Browser calendar arithmetic uses UTC date-only arithmetic; display dates remain local calendar dates. Factory time zones are validated against PostgreSQL’s IANA time-zone catalog.
- Working weekdays must be explicitly recorded. A missing schedule means unknown availability; absence of a closure never certifies availability.
- The first recorded production update supplies the displayed start, if present. The latest saved expected completion supplies the expected deadline. Neither an agreed deadline nor an exact daily effort plan is invented.
- **Completion-month estimate:** the whole known quantity of each active production order is attributed to its expected completion month. It is not evenly distributed across calendar dates. Monthly profile capacity is adjusted by the fraction of recorded working days remaining after closures.
- Daily busy indicators refer to that month’s estimate, not daily utilization. Orders without completion dates or reliable selected quantities make the estimate incomplete. Other clients’ factory work, garment complexity and daily effort are not recorded, so utilization cannot promise capacity.
- Holiday risk is grouped by normalized garment capability, counting each factory once per category/day. It includes the number affected, remaining factories and estimated capacity share affected when capacities are known. Ordinary non-working weekends do not independently create holiday-overlap alerts.
- Default planning thresholds are 70% busy, 90% fully booked, 30% overlap warning and 60% capacity-loss critical. Admins can change these in the calendar. They are indicators, not universal manufacturing standards.
- “Next available” remains **Not enough scheduling data** because current records do not establish a reliable future capacity commitment. Orders also lack a required production window at quotation time; matching therefore flags near-term closures and requests confirmation instead of claiming infeasibility.
- Alerts are derived from current data and resolve automatically. Refreshing does not insert duplicate alerts or notifications. Explicit availability changes notify admins once per changed save.

## Verification

- `npm test`: 30/30 suites passed, including two new calendar suites and existing assignment, production, quotations, payment, QC and permissions coverage.
- Calendar database tests execute real order creation, assignment, quotation, approval, isolated verified payment and production updates; verify quantities/deadlines, overlap conflicts, capacity changes, tenant/admin restrictions, optional reasons, duplicate saves, stale edits, withdrawn history, leap years/month boundaries, filters and repeatable migration.
- Date/UI tests verify leap/year boundaries, Auckland/Los Angeles local-date offsets, inclusive multi-select grouping, unknown starts, both role layouts, role-specific links, estimates, filters, loading and database errors.
- Existing time-off regression now verifies immediate approval rather than requiring the removed approval step.
- Live database verification uses `verify_production_calendar_live.sql`: actual save/edit/remove/history, role-scoped reads, network/matching restrictions and admin notifications passed inside a transaction that rolled back all test changes.
- Live Super Admin browser: network data, month/week navigation, Today, manufacturer filtering and date details checked. Responsive inspection observed a 520px layout without horizontal page overflow; a full mobile-device browser submission was not executed. Manufacturer form rendering and backend mutations were tested separately; no real factory closures were added for screenshots.
- Production build passed with the pre-existing large-bundle warning. No additional calendar dependency was installed.
- Existing order schema does not support a cancelled status, so an actual cancellation workflow could not be exercised. Calendar queries include only authorized `processing` orders and tests verify completed work is excluded.
