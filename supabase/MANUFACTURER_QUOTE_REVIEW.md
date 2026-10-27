# Manufacturer quotation rejection

Superadmins can reject a received manufacturer quotation in the order detail or quotation review queue. A required reason is sent to the manufacturer.

- **Request revised quotation:** retains the assigned manufacturer, sets the existing `clarifying` state, removes the active rejected pricing, and allows a fresh submission through the existing quote form.
- **Assign another manufacturer:** sets the existing `rejected` state and opens the assignment console. The current manufacturer cannot overwrite the rejection; selecting a new manufacturer uses the existing assignment/deadline workflow.

The existing `order_routing_events` table retains the original manufacturer quote, currency, quotation timestamp, customer pricing draft, reason, actor and selected next action. Order history displays rejected quotation amounts. Existing account isolation and superadmin policies apply; no new tables or storage buckets are needed.

The server locks the order, requires `is_superadmin()`, validates feedback and action, rejects duplicate requests, and prevents this action on issued customer quotations, paid orders or released production.

Migration: `20261022040000_manufacturer_quote_review.sql`, also included in `schema.sql`.
Tests: `node scripts/test-manufacturer-quote-review.mjs`; rollback-only live verification: `verify_manufacturer_quote_review_live.sql`; `npm run build`.
