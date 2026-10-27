# Delivery completion

After all units from the current approved QC report have a non-revoked dispatch record, the server starts a 14-day completion window. A PostgreSQL cron job checks due orders every five minutes, including while all browsers are closed. Partial dispatches and invalidated QC cannot complete.

In Superadmin → Quality control → order, Delivery & completion lets an authorised admin confirm delivery immediately, set a future deadline (within 90 days), or pause automatic completion with a reason. The manufacturer and brand see the deadline and completion result. Notifications and QC audit events record completion. Automatic completion does not claim that a carrier confirmed delivery.

Existing shipped orders are preserved without a backdated deadline. Admins may explicitly set a deadline or confirm delivery. Completed orders cannot be reopened by direct status edits. No payment or quotation values change.

Migration: `20261022030000_order_delivery_completion.sql`; fresh-install schema updated. Existing orders and QC audit tables are reused. Internal worker is restricted to the server/service role; delivery RPCs check `is_superadmin()`.

Verification: `node scripts/test-order-completion.mjs`, `npm run build`, and rollback-only `supabase/verify_order_completion_live.sql` on the configured project.
