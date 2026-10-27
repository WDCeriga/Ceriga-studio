# Quality Control

The active workflow reuses Ceriga's QC inspections, evidence, releases and audit records. Migration `20261022010000_simplified_quality_control.sql` extends those records and is also included in `schema.sql`. Existing inspections and historical files remain intact.

## Workflow

Assigned manufacturers open Quality Control from a released production order. They upload production photos, write a summary, confirm quantities for each selected garment/size line, disclose issues and confirm accuracy. Optional measurements and supporting PDFs/images remain optional. Photos use the private existing `qc-evidence` bucket, immediate previews, compression, replacement and removal before submission.

The four QC statuses are Not Submitted, Pending Review, Changes Required and Approved. Submitted versions are immutable. Change requests retain feedback and earlier evidence; the next version can reuse photos but requires fresh confirmation. Superadmins review the complete report, original specifications and photos together, then approve or request changes. Approval automatically creates the dispatch release; there is no separate approval step.

Each size has a quantity, so offsetting shortages and overruns still require an explanation. Individual lines can report zero to disclose a completely missing size, but the submission total must be positive. A discrepancy is reviewable rather than automatically rejected. Admin approval authorises the disclosed produced quantity.

## Security and integration

`qc_action` validates every write on the server under an order lock. Only the assigned manufacturer can submit; only allowlisted superadmins can review, and self-review is denied. Legacy mutation actions are disabled. Images/documents must be registered from the assigned account's order-scoped private storage path with permitted MIME and size metadata. Browser file handling also checks file signatures and decodes images before upload.

Submitted reports and referenced files cannot be overwritten by manufacturers. Reassignment prevents the replacement manufacturer from reading the previous factory's private reports. Order fingerprints tie approval to the exact production details and version. Material changes invalidate approval and revoke undispatched releases. Shipping and Ready for Dispatch are guarded in Postgres, including direct order updates.

QC uses the existing production-release gate. The previously authorised temporary customer Submit flow remains supported without inventing a payment record. Quote, assignment and payment functions are unchanged.

The existing portal notification inbox dependencies are installed if absent. Submission notifies superadmins; review notifies the manufacturer. Notification helper RPCs are internal, not callable by browser roles. `apply_superadmin_access()` includes all existing QC and portal notification tables and remains migration-only.

## Verification

- `node scripts/test-simple-qc.mjs`: repeatable migration, preserved legacy records, per-line/size validation, required photos/summary/issues/confirmation, private evidence, submission, history/resubmission, review, notifications, shipping guards, reassignment and unauthorised access.
- `node scripts/test-qc-report-files.mjs`: MIME/signature validation, multiple paths, optional PDF, empty files, upload errors and database-registration cleanup.
- `node scripts/test-manufacturer-submission.mjs` and `node scripts/test-order-routing-v2.mjs`: existing submission, quotation/routing and payment gates.
- `npm run build`: production build.
- `verify_simplified_qc_live.sql`: executed successfully against the configured Supabase project. Test fixtures use a rollback transaction; no customer orders are changed. Storage metadata fixtures test registration/RLS; they do not pretend to upload physical image bytes.

Browser checks used the real manufacturer form/gallery with isolated adapters: previews, navigation, 150% zoom, forced discrepancy disclosure, confirmation and submission. The mobile breakpoint rendered without horizontal overflow at the browser's minimum effective 507 CSS pixels. Actual device testing and a real browser file-picker upload remain unverified: Chrome's extension disallows local-file access. No browser permissions were changed.

Database changes are deployed. Frontend changes are in this workspace; hosted frontend deployment is separate. The former `verify_quality_control_live.sql` documents the retired checklist workflow and must not be used for the current workflow.
