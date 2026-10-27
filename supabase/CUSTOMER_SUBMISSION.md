# Temporary customer submission without payment

Production quote options now use **Submit**. A customer selects an approved sample or bulk option and submits it directly to the already-assigned manufacturer. The checkout route supports the same action for existing links. Digital tech-pack payment behavior remains unchanged.

`submit_order_to_manufacturer(order_id, option_id)` checks ownership, approved quote status, expiry, selected quantities and the assigned factory's onboarding/availability. It locks the order, persists the selection, marks it `processing` / `in_production`, and records `manufacturer_submitted_at` plus the production release timestamp. Repeat requests for the same submitted option return successfully; changing the option after submission is rejected. Invalid or expired quotes, missing assignments and other accounts are rejected.

No charge is made. `paid_amount_cents`, `payment_verified_at` and payment receipt rows remain untouched. Customer/manufacturer copy identifies customer submission instead of claiming payment. Existing manufacturer queries already load the assigned order and production release, so submitted jobs appear in their orders and production queue. QC and shipment approval requirements still apply.

The temporary mode is controlled by `public.order_payment_controls.submission_without_payment_enabled`, enabled by this migration. Set it to false through authorized administration to stop new unpaid submissions. This does not enable the real payment integration or alter previously submitted records. The existing superadmin-only access to the controls table and service-only payment verification remain intact.

Migration: `migrations/20261021050000_customer_submit_to_manufacturer.sql` (also in `schema.sql`). No existing customer records are rewritten. The new timestamp cannot be set directly by browser clients.

Verified on 21 October 2026:
- Isolated tests: `node scripts/test-manufacturer-submission.mjs` covers success, empty/invalid option, ownership, expiry, paused factory, disabled mode, duplicate requests and payment fields staying unchanged.
- Live project `yzpahvwywvalegsztnif`: migration applied and `verify_manufacturer_submission_live.sql` passed with rollback-only fixtures. Verified actual customer persistence, assigned manufacturer visibility and non-owner isolation.
- Customer order screen displays Submit, and the production build passes. No actual customer order was submitted as part of verification. Frontend changes are local until the app is published.
