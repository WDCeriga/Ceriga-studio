# Production turnaround scheduling

The production workspace uses the existing Preparation → Cutting → Sewing → Finishing → Quality Control stages and `order_production_updates` for manufacturer-confirmed progress. It does not introduce a second physical production workflow. Quality reports, approval, payment release and dispatch retain their existing safeguards.

## Factory setup

Onboarding now includes a Production turnaround timeline step before final review. The same editor is in manufacturer Settings. The database is authoritative. Suggested durations are distributed from the existing typical lead time; automation starts disabled. Working schedules reuse the factory calendar's timezone/weekdays, and approved holidays/closures affect working units.

Stages remain sequential. Start conditions can delay a stage until material availability or sample/customer approval is explicitly confirmed. Structured timing factors can add time, block progression or require confirmation. Notes never calculate dates. New defaults apply to newly released orders; existing plans require an explicit preview and Apply action. A preview hash prevents applying a schedule that changed after preview.

Working days mean the configured daytime shift's hours. Working hours skip non-working weekdays and inclusive closure dates. Calendar days maintain local wall time across DST; elapsed hours are absolute time. Order blocker intervals pause all unit types. Unknown or overdue unresolved blockers make completion uncertain. Overdue, unconfirmed stages are re-estimated from the delay report when blocked. Overnight shifts are not supported.

## Daily workflow

Start Preparation or Move to the next stage directly from an order card. Forward moves confirm each preceding stage and cannot skip prerequisites. Corrections require a reason. Eligible orders with the same next stage support an atomic bulk update (maximum 100). Safe single-stage undo lasts 30 seconds on the server and appends history rather than deleting it.

Use Report delay/block production for a structured blocker and revised-date preview. Existing blockers can be edited and explicitly resolved. Per-order automation can be paused without claiming physical work stopped; blocking production separately pauses its schedule. A reasoned overall estimate remains labelled as manual.

## Automated estimates

`ceriga-production-timeline` runs every five minutes, processing up to 250 orders in fair bounded sweeps. It checks current assignments, production release, QC state, blockers and the order's immutable configuration snapshot. Explicitly enabled stages may advance **estimated** progress through satisfied dependencies. Previous-stage-confirmation dependencies stop that forecast chain. Clock time never inserts confirmed production updates, permits a QC submission or approves dispatch.

Each automatic step has a deterministic dedupe key. A late or repeated run can catch up eligible estimated steps without duplicate history. Order locks precede plan locks; concurrent manual changes use optimistic plan and production versions. Template saves also check revisions and factory identity.

## Persistence and access

Migration: `supabase/migrations/20261027020000_production_timeline.sql`; fresh installs include the same definitions in `supabase/schema.sql`.

- `manufacturer_production_timelines`: factory defaults and revision.
- `order_production_timelines`: per-order/factory snapshot, inputs, blocker intervals, estimates and revision.
- `production_timeline_events`: append-only application history and idempotency keys.

Factory team permissions and order-assignment isolation are checked by RPCs and RLS. Default history remains readable after the production stage. Allowlisted Super Admin identities retain full CRUD through the existing migration-only access helper. The scheduler is unavailable to browser roles. No new Edge Function, storage bucket, email provider or browser service credential is needed.

Legacy confirmed updates, manual date-only estimates and reported delays are retained. Existing calendar/dashboard projections consume the saved timeline where applicable. Meaningful completion changes (at least 24 hours or known/unknown changes) and explicit blockers/resolutions notify the relevant users; routine estimates do not create notifications.

## Accuracy and testing

Capacity is an estimate of active Ceriga units against the factory's saved monthly capacity. Approved QC work no longer consumes that estimate. Missing quantities/capacity are unknown, not zero. External factory commitments and garment-specific effort are not inferred.

Tests: `scripts/test-production-timeline.mjs` covers database persistence, working time/DST/closures, structured prerequisites, bulk isolation/rollback, safe retries/undo, blockers and overrides, per-order automation, automatic forecast chains, immutable confirmed stages, private cron execution and repeatable migration. `scripts/test-production-workspace-ui.mjs` exercises one-click/bulk RPC wiring, saved-state feedback and loading/error/empty states with isolated fixtures. The full regression suite also checks existing teams, calendar, dashboards, finance and QC workflows.

Live database verification is reproducible with scripts/verify-production-timeline.sql in the Supabase SQL editor. It uses existing authorised principals, a temporary fixture, and BEGIN/ROLLBACK; it does not leave test orders or change real payments. The interactive manufacturer browser walkthrough was not performed in the available Super Admin session; UI interactions were exercised with isolated fixtures.
