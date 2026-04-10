# Ceriga Studio v4 — Full-Stack Build Spec

## What you are building

Build **Ceriga Studio** — a B2B custom apparel tech pack creation platform. Users visually construct garments step by step, seeing a live flat-lay SVG illustration update in real time as they make choices, and export a professional factory-ready PDF tech pack at the end. This is a **single full-stack monorepo** — frontend, backend API routes, and database all in one project. No separate repos.

Choose the best modern stack for this (e.g. Next.js App Router with server actions and API routes). Pick your own database, ORM, file storage, and payment provider. Justify your choices briefly before starting.

---

## Tech requirements

- Single monorepo: UI, API routes, and database access all in one project
- Auth: email/password (JWT access + refresh token pattern) AND Google OAuth
- File uploads: profile photos, product images, artwork uploads (logos, prints, vectors, labels, neck images, package images). All accessible via public URL.
- Payments: hosted checkout sessions (Stripe-style) with webhook support. Two session types: one for standard custom clothing orders, one for tech-pack-only orders.
- Email: transactional HTML emails for every order lifecycle event and every status change
- Desktop-first UI — on screens below 1024px wide, show a full-screen "Please use a desktop browser" message instead of the app. Do not attempt mobile layouts.
- PDF export: generated client-side using `jspdf` + `svg2pdf.js`. No server rendering needed for PDF. Must be vector quality — never use canvas screenshots.

---

## User roles

| Role | Access |
|---|---|
| Guest | Marketing pages, catalog, sample tech pack download, sign in/up |
| Customer | Garment builder, drafts, own orders, notifications, account settings |
| Admin | Everything customer can + admin order list, invoicing, shipping, admin notes, invite sub-admins |
| Super Admin | Everything admin can + user management, product catalog CRUD, global pricing, analytics, broadcast notifications, revenue tracking |

Protect all routes appropriately. Redirect unauthenticated users. Block lower roles from higher-role pages.

---

## Public / marketing pages

### Home (`/`)
- Hero section — lead copy must reflect the actual product: "Build your garment. Get a factory-ready tech pack." Not generic custom clothing language.
- How-it-works section — show an animated SVG sequence of the actual builder in action: a step being selected and the flat-lay preview updating. Let the product explain itself visually.
- Popular products grid
- Sample tech pack download — a real PDF download, no sign-up required. This is the single best conversion tool for B2B buyers who need to see output quality before committing.
- Extra info / trust sections
- Page title: "Ceriga Studio"

### Catalog (`/catalog`)
- Grid of products from the database
- Each card shows: product image, garment type label (Hoodie, T-shirt, Jacket — make this prominent), starting price, MOQ, and a single "Configure" CTA
- Filter tabs or sidebar: All, Tops, Bottoms, Outerwear, Dresses — build this from day one, not as an afterthought
- Each product links into the garment builder

Marketing layout only on these pages — no app sidebar.

---

## Auth flows

- Sign up / sign in with email + password
- Google OAuth (redirect flow, confirmation step on return)
- Forgot password → emailed reset code → enter code → set new password
- Access token + refresh token session pattern (silent refresh on expiry)
- `/api/auth/me` to hydrate current user on load

---

## Customer onboarding

First-time customers need to understand the product before they can use it confidently. The builder is powerful but unfamiliar — a user who doesn't know what a tech pack is will drop off immediately without guidance.

### First-login intro modal
Shown automatically on the very first login after account creation. Never shown again after dismissed. Three steps, skippable at any point:

- **Step 1 — What is Ceriga Studio?** One sentence + a small animated SVG of the builder preview updating. "Pick your garment parts. We build the tech pack."
- **Step 2 — How it works.** Three icon + label pairs: "Choose a garment type → Configure each part → Download your tech pack". No walls of text.
- **Step 3 — Ready to start.** Two buttons: "Browse the catalog" → goes to `/catalog`. "See a sample tech pack" → downloads the sample PDF. No obligation to start building immediately.

Store a `hasSeenOnboarding: boolean` flag on the user record. Check it on login — if false, show the modal and set it to true on dismiss.

### Contextual tooltips in the builder
On the first time a customer enters the builder (tracked per user, not per session), show brief tooltip overlays on the three panels:
- Left panel: "Pick from the options here"
- Centre: "Your garment updates live as you choose"
- Right panel: "Your full spec and price build up here"

One tooltip visible at a time. Dismiss on click anywhere. Never shown again after the first builder session. Store a `hasSeenBuilderTips: boolean` flag on the user record.

Do not show onboarding UI to admins or super admins.

---

## Account / profile

- Edit name, email, profile photo (upload)
- Change password
- Save multiple delivery addresses (not just one default) — customers often ship to different warehouses or agents. Each address has: company, street address, city, country, postcode, tax/BOL reference, contact name, phone, email. User can label each (e.g. "London warehouse", "Paris agent").
- Default address flag — one address marked as default, pre-fills delivery step

---

## The garment builder — core of the product

The builder is a fixed three-panel split-screen:
- **Left panel (320px fixed)**: current step options — visual preset cards + spec input fields below. Sticky "Back" and "Continue" buttons pinned to the bottom of this panel always visible regardless of scroll.
- **Centre (flex)**: live flat-lay SVG garment preview (front/back toggle). Large, generously padded, centred. This is the centrepiece of the product — it must feel like a design tool, not a form. White space around it is doing work.
- **Right panel (260px fixed)**: running spec summary — updates after every single selection, not just at review. A user on step 5 should be able to glance right and see fabric, colour, neck type, and fit already confirmed. Live itemised price estimate at the bottom.

**Progress indicator**: shown at the top of the builder at all times. Each completed step is clickable — clicking it jumps directly to that step without losing any subsequent choices. Users should never have to click Back 6 times to change an earlier decision.

**Autosave**: debounced 800ms on every change. Show "Saving…" → "Saved ✓" in the builder header. On navigate-away with unsaved changes, show a confirmation modal: "You have unsaved changes — are you sure you want to leave?" Never silently lose work.

**Garment type controls everything downstream**: step 1 (garment type) is not just a label — it filters every subsequent step's option list. A hoodie must never show V-neck as a neck option. A skirt must never show sleeve types. The garment type selection is a strict filter applied to all downstream preset lists. Build this relationship into the data model from the start.

---

### SVG layer architecture

Every garment is a single SVG file made of named `<g>` layer groups stacked in this order (bottom to top):

| Layer ID | Contents | Behaviour |
|---|---|---|
| `#layer-shadow` | Subtle fold/depth lines | Static, never changes |
| `#layer-body` | Base garment silhouette | Swapped when fit/silhouette changes |
| `#layer-construction` | Neck, sleeves, hem, cuffs | Swapped per step selection |
| `#layer-details` | Pockets, zips, seam lines, topstitch marks | Swapped per step selection |
| `#layer-print` | Print placement zones (draggable overlays) | Added/removed per placement |
| `#layer-labels` | Auto-generated callout lines + annotation text | Hidden in builder mode, shown in tech pack mode |

**Part swapping**: Each selectable part is stored as a partial SVG file containing only the path data for that `<g>` group. When the user picks an option, fetch that file and replace the relevant group's `innerHTML`. The base SVG stays mounted — only the group contents change.

**Colour system**: All fill and stroke values in the SVG reference two CSS variables: `--garment-fill` and `--garment-stroke`. Changing garment colour = setting these two variables on the SVG element. One operation, instant update, no path-by-path changes.

**Two display modes — same SVG, different CSS class**:
- `builder-mode`: coloured fill (`--garment-fill`), coloured stroke, `#layer-labels` hidden
- `techpack-mode`: white fill, black `#2C2C2A` stroke, `#layer-shadow` hidden, `#layer-labels` visible

Never render two separate SVGs. One SVG, two CSS classes.

**Auto-generated callout lines**: In `techpack-mode`, `#layer-labels` is populated automatically by the app — not manually by the user. The system knows what neck type, sleeve type, hem, and pocket were selected. It draws callout lines from each construction element to a labelled annotation in the margin. No human input required for the technical illustration. This is what makes the output look factory-professional.

---

### SVG asset file structure

```
/assets/garments/
  tshirt/
    base.svg              ← full layered SVG template
    neck/
      crew.svg            ← partial: just the neck <g> path data
      vneck.svg
      polo.svg
      mockneck.svg
      scoop.svg
    sleeves/
      set-in-short.svg
      set-in-long.svg
      raglan-short.svg
      raglan-long.svg
      dropped-short.svg
      dropped-long.svg
      sleeveless.svg
    hem/
      straight.svg
      curved.svg
      split.svg
      ribbed.svg
      raw.svg
    cuffs/
      ribbed.svg
      banded.svg
      raw.svg
      elasticated.svg
    pockets/
      none.svg
      patch.svg
      welt.svg
      side-seam.svg
  hoodie/
    base.svg
    neck/
      hood-single.svg
      hood-double.svg
      halfzip.svg
      fullzip.svg
    ...same structure
  sweatshirt/
    base.svg
    neck/
      crew.svg
      mockneck.svg
      halfzip.svg
    ...
  trousers/
    base.svg
    waist/
      elasticated.svg
      drawstring.svg
      belt-loop.svg
    pockets/
    hem/
  shorts/
    base.svg
    ...
  jacket/
    base.svg
    collar/
      zip-collar.svg
      shirt-collar.svg
      mock-neck.svg
    zip/
    pockets/
  dress/
    base.svg
    neckline/
    sleeves/
    skirt/
  skirt/
    base.svg
    waist/
    hem/
```

**Critical**: Draw all SVG assets before writing any app code. Each partial file contains only the inner content of its `<g>` group — not a full SVG document. Coordinate systems must match the base SVG viewBox exactly so injected parts align correctly.

---

### Preset option cards (step UI pattern)

Every step displays selectable option cards in the left panel. Each card:
- Small SVG icon (40×32px) showing just that part, drawn in the same visual style as the main preview
- Option name below (sentence case, 11px)
- Selected state: `border: 2px solid #534AB7; background: #EEEDFE`
- Unselected state: `border: 0.5px solid var(--color-border-tertiary)`

Clicking a card: (1) marks it selected, (2) fetches the matching partial SVG, (3) replaces the relevant layer group in the main preview, (4) updates the right panel spec summary immediately.

Only show cards relevant to the current garment type. Never show inapplicable options.

---

## Builder step flow

### Step 1 — Garment type
Select base category: T-shirt, Hoodie, Sweatshirt, Trousers, Shorts, Jacket, Dress, Skirt.
Loads the correct `base.svg`. Strictly filters all downstream option lists.
No spec fields — just the category cards.

### Step 2 — Fit & silhouette
Preset cards (filtered by garment type): Slim, Regular, Relaxed, Oversized, Boxy.
Swaps `#layer-body` with matching silhouette path.
Spec fields:
- Size range (multiselect: XS, S, M, L, XL, XXL, 3XL)
- Graded measurement table — pre-filled with industry standard values per size. Columns: size, chest, waist, hip, length, sleeve length (cm). Every cell user-editable. Every measurement shows a tolerance field defaulting to ±0.5cm (industry standard) — user can override per row.
- "Reset to standard" button per row and one global "Reset all to standard" — restores the pre-filled standard values without clearing the whole table.

### Step 3 — Fabric & colour
No SVG layer swap — affects CSS colour variables only.
Fields:
- Fabric type (select from product's available fabrics): jersey, fleece, French terry, twill, ripstop, etc.
- GSM (pulled from fabric selection, editable)
- Composition (e.g. "80% cotton, 20% polyester") — pre-filled from fabric, editable
- Colour: visual circular hex swatches — clicking sets `--garment-fill` and `--garment-stroke` instantly
- Optional Pantone code field alongside each colour swatch — clearly labelled as optional. Many fabric mills work from Pantone references.
- Number of colours (integer, affects price)
- Dye method (select): garment dye, piece dye, yarn dye, no dye
- Free-text colour description

### Step 4 — Neck / collar
Preset cards with mini SVG icons. Options strictly filtered by garment type:
- T-shirt / sweatshirt: Crew neck, V-neck, Mock neck, Scoop neck
- Hoodie: Hood (single), Hood (double), Half-zip, Full-zip
- Jacket: Crew, Mock neck, Shirt collar, Zip collar
- Dress / skirt: applicable necklines only
- Trousers / shorts: step skipped entirely — show inline message "No neck step for this garment type" and auto-advance
Spec fields: rib height (cm), neck opening width (cm), rib composition (text)
Swaps `#layer-construction` neck paths.

### Step 5 — Sleeves
Preset cards filtered by garment type. Not shown for trousers, shorts, skirts — auto-advance with inline message.
Type cards: Set-in, Raglan, Dropped shoulder, Sleeveless.
Length cards (after type selection): Short, ¾, Long.
Spec fields: sleeve length (cm), sleeve opening width (cm)
Swaps `#layer-construction` sleeve paths.

### Step 6 — Hem & cuffs
Hem preset cards: Straight, Curved, Split, Ribbed, Raw edge.
Cuff cards (only if garment has sleeves and sleeves are not Sleeveless): Ribbed, Banded, Raw, Elasticated.
Spec fields: hem height (cm), cuff height (cm)
Swaps `#layer-construction` hem/cuff paths.

### Step 7 — Pockets & zips
Pocket cards (filtered by garment type): None, Patch, Kangaroo (tops only), Welt, Side seam.
Zip cards (filtered): None, Full-length, Half-zip, Concealed, Chest zip.
Swaps `#layer-details` paths.
Spec fields: pocket width (cm), pocket height (cm), zip type/colour (text)

### Step 8 — Print placements
The flat-lay preview becomes interactive on this step.
- Predefined placement zones shown as dashed overlay rectangles on the SVG: centre chest, left chest, centre back, left sleeve, right sleeve, hem
- Snap-to-zone guides: when dragging a placement zone, show magnetic snap at common positions (centre chest, left chest, centre back). Zones snap to these positions when dragged within 8px. This ensures placements look intentional, not slightly off.
- User toggles each zone on/off
- Per active zone:
  - Print method (select, filtered by product's available methods): DTG, DTF, Screen print, Embroidery, Heat transfer, No print
  - Artwork upload (PNG, JPG, PDF, AI, SVG)
  - Size in cm (width × height)
  - Position stored as x/y percentage of garment viewBox dimensions
- Active zones appear in `#layer-print` as dashed green rectangles with labels
- Uploaded artwork previews at low opacity inside the zone on the preview

### Step 9 — Labels & tags
No SVG layer swap. Fields only.
- Neck label type: Woven, Printed transfer, Heat transfer, No label
- Neck label artwork upload
- Care label: Standard (auto-generated from fabric composition), Custom upload
- Woven label: upload artwork, specify size
- Hang tag: Yes/No, upload artwork if yes
- Custom neck label description (text)

### Step 10 — Review & export
Full spec summary of all confirmed choices.
Front and back flat-lay in `techpack-mode` (white fill, black lines, auto-generated callout annotations).
Full graded measurement table displayed.
Quantity input per size — show quantity tier thresholds as a visual bar: "Order 50+ to unlock €X/unit". Flag with a warning if total quantity is below MOQ.
Notes to manufacturer — free-text field: "Anything else the manufacturer should know?" Catches edge cases the structured steps don't cover.
Live price estimate (server-calculated, itemised).
Actions:
- Save as draft
- Submit order (custom clothing path — proceeds to delivery step)
- Download tech pack PDF (tech-pack path — generates PDF then starts hosted checkout)

### Delivery step (custom clothing orders only, shown after step 10)
Fields: company name, street address, city, country, postcode, tax/BOL reference, contact name, phone, email, "billing same as delivery" toggle.
Dropdown: "Use a saved address" — lists all customer's saved addresses by label. Selecting one pre-fills all fields. User can still edit after selection.
Validate all fields before allowing submission.
On submit: create order, redirect to My Orders. Payment triggered later from order list.

---

## PDF tech pack generation

Generated client-side using `jspdf` + `svg2pdf.js`. Triggered from the Review step.

Process:
1. Switch SVG to `techpack-mode` (auto-generates callout labels)
2. Use `svg2pdf.js` to embed SVG at vector quality
3. Build subsequent pages with `jspdf`
4. Switch SVG back to `builder-mode` after export

### PDF page structure

**Page 1 — Cover**
- Ceriga Studio logo + brand name
- Style name and auto-generated reference number
- Front + back flat-lay (techpack-mode SVG, vector)
- Colourway swatches: hex circles with colour name and Pantone code if provided
- Date created, revision number
- Revision history table: version, date, description of changes — even if only one row exists, the structure signals professionalism to factories

**Page 2 — Construction details**
- Annotated flat-lay with auto-generated callout lines to each construction element
- Annotations: neck type + rib height + opening width, sleeve type + length, hem type + height, cuff type + height, pocket type + dimensions, zip type
- Stitch type and SPI (stitches per inch)
- Seam allowance notes

**Page 3 — Materials & trims**
- Fabric: type, GSM, composition, colour name, hex, Pantone (if provided)
- Dye method
- Label specs: type, material, placement
- Thread colours (Pantone or hex)
- Hardware: zip type, drawcord, toggles
- Custom spec rows — user can add freeform rows for anything the structured form didn't capture (e.g. "bartack at pocket corners", "contrast zip pull"). A simple "+ Add detail" row in the builder feeds these extra rows into the PDF.

**Page 4 — Size & measurement table**
- Full graded measurement table (all selected sizes, all measurement points, with tolerances)
- Key points of measure diagram (simplified SVG annotation of the garment silhouette)
- Fit type label

**Page 5 — Print & artwork**
- Per placement zone: method, size in cm, position on garment (described in text)
- Uploaded artwork previews (rasterised from uploads)
- Colour separation notes
- File format requirements note

**Page 6 — Order summary**
- Size ratio breakdown table
- Total quantity and MOQ check (flag if below)
- Price estimate per unit (tiered by quantity), itemised
- Lead time estimate
- Notes to manufacturer (from step 10 free-text field)
- Submission date and order reference number

**Every page footer**: Ceriga Studio logo, page number (e.g. "3 of 6"), document reference number. When this PDF gets forwarded to a factory it must always be traceable back to the platform.

---

## Drafts

- **Default landing page** for logged-in customers who have existing drafts — show My Drafts on login, not a generic dashboard
- Each draft card in the list shows: garment type, product name, last edited date, completion percentage (e.g. "7 of 10 steps complete") — gives users a clear reason to return and finish
- Auto-create draft on first builder entry
- Autosave on every step change (debounced 800ms)
- Server returns updated itemised price estimate on every save
- Navigate-away guard: if unsaved changes exist, show confirmation modal before leaving
- Actions: Continue (restores full builder state), Duplicate, Delete
- Upload endpoints: artwork, labels, neck artwork, hang tag, vector files, full design
- Remove file endpoint; save/remove print placement position metadata

---

## Order versioning

When a customer edits a submitted order, the original spec must not be overwritten. Factories may already be working from the first version. Every edit to a submitted order creates a new revision — the previous version is preserved in full.

### How versioning works

- Every order has a `revisions[]` array. Each revision is a complete snapshot of the builder state at that point in time: all step selections, measurement table, print placements, artwork URLs, notes to manufacturer, and the itemised price at that moment.
- On first submission: revision 1 is created automatically.
- When a customer edits and resubmits: revision 2 is created. Revision 1 is never modified.
- The order always displays the **current revision** (highest number) by default.
- Both customer and admin can view any previous revision from a revision history dropdown on the order detail page: "Viewing v2 (current) ▾ — v1 (original, 14 Mar)"
- The PDF tech pack download always generates from the current revision unless the user explicitly selects a previous one.
- The revision number and date appear on the PDF cover page and in the revision history table.

### What triggers a new revision

- Customer clicks "Edit" on a submitted order, makes changes, and resubmits
- Customer re-uploads artwork on an order flagged for artwork issues (see artwork rejection flow below)

### Admin visibility

- Admins see the current revision by default with a clear "v2 of 2" label
- Admins can view any previous revision
- The activity log records which revision each admin action was taken against
- When an order moves to a new revision, admins are notified via the activity log and the order is re-flagged for review

### Data model addition

```
Order {
  ...
  currentRevision       // integer, e.g. 2
  revisions[] {
    revisionNumber      // 1, 2, 3...
    createdAt
    builderStateSnapshot  // complete JSON of all step selections at this revision
    measurementTable
    printPlacements[]
    artworkUrls[]
    notesToManufacturer
    pricingBreakdown    // itemised snapshot at time of this revision
    submittedBy         // user ID
  }
}
```

---

## Orders (customer view)

- List own orders with status badge and actions menu
- **Status badge colours — apply consistently everywhere in the app, no exceptions:**
  - Draft: grey
  - Requires Action: amber
  - Submitted: blue
  - Priced: amber
  - Accepted: teal
  - Processing: purple
  - Shipping: blue
  - Completed: green
- Actions per order: View, Edit (reloads full builder state), Duplicate, Delete, Pay, Order again
- **"Order again"** restores the complete builder state — every step selection, fabric, colour, construction choices, measurement table values, print placements, artwork file references, notes to manufacturer. Customer should arrive at the Review step in seconds, not rebuild from scratch.
- **Order detail page** (`/orders/[id]`):
  - Full garment spec visible inline — flat-lay SVG in techpack-mode and all confirmed spec fields. Customers must be able to verify what was ordered without downloading the PDF.
  - Status timeline — horizontal, shows full journey (Submitted → Priced → Accepted → Processing → Shipping → Completed), current step highlighted
  - Tracking number as a live clickable link to the carrier's tracking page (not plain text)
  - PDF download button
- Order activity log — timestamped list of every action: status changes, admin notes added, files uploaded, invoice updates. Visible on the order detail page.

---

## Order versioning

When a customer edits a submitted order, the original spec must not be overwritten. Factories may already be working from the first version. The system must track every revision as a distinct snapshot.

### How versioning works
- Every order starts at revision `v1` on submission
- When a customer edits and resubmits an order, a new revision is created: `v2`, `v3`, etc.
- Each revision stores a complete snapshot of the full builder state at that point — all step selections, measurement table values, print placements, artwork upload URLs, notes to manufacturer
- The current active revision is always the latest. Previous revisions are read-only.
- The order's `currentRevision` field always points to the active version number

### What the customer sees
- On the order detail page, a revision indicator shows the current version: "Version 2 — updated 14 Mar 2026"
- A "View history" link expands a list of all previous revisions with timestamps and a brief auto-generated change summary (e.g. "Neck type changed from Crew to V-neck")
- Clicking a previous revision shows its full spec in a read-only modal — the flat-lay SVG in techpack-mode with that revision's selections applied

### What the admin sees
- The admin order detail page shows the current revision prominently with a "Revision history" panel
- When a new revision is submitted, the order is automatically set back to "Requires Action" status and the admin is notified
- The admin can see a diff summary between the previous and current revision (which fields changed)
- The PDF tech pack always generates from the current revision

### Data model addition
```
OrderRevision {
  id
  orderId
  revisionNumber          // 1, 2, 3...
  builderStateSnapshot    // full JSON copy of builder state at this revision
  uploadUrlSnapshot       // copy of all file URLs at this revision
  createdAt
  changeSummary           // auto-generated string describing what changed vs previous revision
}
```

Orders gain two additional fields: `currentRevisionNumber` (integer) and `revisions[]` (array of OrderRevision).

---

## Artwork rejection flow

When a customer uploads artwork that cannot be used — wrong format, too low resolution, missing bleed, corrupt file — there needs to be a structured way for admins to flag it and for customers to fix it without creating a new order.

### Admin side
- On the order detail page, admins see an "Flag artwork issue" button per print placement zone
- Clicking opens a modal with:
  - Which placement zone has the issue (e.g. "Centre chest")
  - Reason (select from list): Too low resolution, Wrong file format, Missing bleed/safe zone, Corrupt file, Colour mode incorrect (must be CMYK), Other
  - Free-text notes field for detail (e.g. "Minimum 300dpi required, file is 72dpi")
  - Confirm button
- On confirm: order status changes to "Requires Action — artwork", a notification is sent to the customer, and an email is sent automatically with the reason and notes

### Customer side
- On the order detail page, affected placement zones are highlighted with an amber warning badge: "Artwork issue — see details"
- Clicking the badge shows the admin's reason and notes in a panel
- A "Re-upload artwork" button opens the file upload directly for that placement zone — no need to go back through the full builder
- On successful re-upload: the placement zone clears its warning state, the order status moves back to "Submitted", and the admin receives a notification that new artwork has been provided
- The re-uploaded file is saved as part of the current order revision — it does not create a new revision on its own

### Email for artwork rejection
Send an automatic HTML email to the customer when artwork is flagged, including:
- Which placement zone is affected
- The reason selected by the admin
- The admin's notes
- A direct link to the order page where they can re-upload

### Status flow addition
Add `Requires Action — Artwork` as a distinct sub-status alongside the existing `Requires Action` status. Both display with amber badge in all tables. The reason text is shown inline on the order detail page and in the admin order list as a tooltip on the badge.

---

## Payments

- Hosted checkout session for standard clothing orders
- Hosted checkout session for tech-pack orders (different line items)
- Webhook endpoint (raw body) for checkout completion — finalise order and payment state server-side
- Confirm session handler — verifies session, redirects to success or cancel route
- Frontend success and cancel pages (minimal — real completion via webhook)

---

## Notifications

- List notifications for logged-in user
- Delete a notification
- Super admin: send to specific users or broadcast to all

---

## Artwork rejection flow

When a customer uploads artwork that is too low resolution, the wrong format, or otherwise unusable, the order needs a structured resolution path — not just a generic status change. This will happen regularly in production and must be a first-class flow, not an afterthought.

### Admin side — flagging artwork

On any submitted order, admin can flag one or more placement zones as having an artwork issue:
- Open the order detail page
- Per print placement zone, a "Flag artwork issue" action is available
- Admin selects a reason from a predefined list:
  - Resolution too low (minimum 300dpi required)
  - Wrong file format (vector file required)
  - Artwork does not match placement size
  - Colour profile issue (CMYK required)
  - Other — free text field
- Admin can flag multiple zones in one action
- On save: order status changes to "Requires Action — artwork issue". This is a sub-status of "Requires Action", not a separate top-level status.
- Customer receives an automatic email: "Action required on your order — artwork issue" with the specific reason(s) per placement zone listed clearly in the email body.
- The activity log records which admin flagged the issue, which zones, and the reasons.

### Customer side — resolving artwork

On the order detail page, when status is "Requires Action — artwork issue":
- A prominent banner appears at the top: "Your artwork needs attention before we can proceed."
- Each flagged placement zone is highlighted with the admin's reason shown clearly
- Per flagged zone: a re-upload button — same file upload as the builder's print placement step
- Customer can re-upload one zone at a time or all at once
- On re-upload: a new order revision is created (see versioning section). The new artwork URL is saved to the new revision. The old revision retains the original (rejected) artwork.
- Once all flagged zones have new uploads, customer clicks "Resubmit for review"
- Order status returns to "Submitted"
- Admin is notified via the activity log and order re-enters the review queue
- Customer receives a confirmation email: "Your updated artwork has been submitted"

### What does not happen
- The customer cannot resubmit without addressing every flagged zone
- The admin cannot accidentally overwrite the customer's original artwork
- The order does not go back to Draft status — it stays in the order flow

### Email additions
Add to the email list:
- Artwork issue flagged → customer (lists each zone + reason)
- Artwork resubmitted → admin notification

---

## Admin panel

### Order list
- Paginated, searchable, sortable, filterable by status / order type / manufacturer
- Scoped admins only see their manufacturer's orders
- **Quick filter pills** above the table: "Needs action", "Awaiting payment", "In production", "Shipping this week" — one-click access to the views admins use daily
- **Bulk status update** — checkbox selection on multiple orders, update status in one action. Essential for processing batches.
- **Auto-flagging**: orders submitted with missing artwork, quantity below MOQ, or incomplete measurements are automatically given "Requires Action" status with a machine-readable reason shown to the admin. Admins should never have to hunt for why an order can't be processed.

### Order detail (admin view)
- Full garment spec inline — flat-lay SVG in techpack-mode, all construction details, measurements, print placements. Admin should never need to download the PDF just to review an order.
- **Order activity log** — full timestamped audit trail: status changes, notes, file uploads, invoice updates. Essential when a customer queries their order.
- **Admin notes** — private free-text field, visible to staff only. Tracks calls, special instructions, flagged issues.
- Invoice workflow: unit cost, colour cost, packaging, shipping — **total auto-calculates**, no manual entry. Super admin confirms/finalises.
- Change order status
- Change manufacturer on order
- Rename order
- Delete order
- Shipping: update tracking number, URL, carrier

### Other admin tools
- Delivery info: view customer delivery address for a specific order
- Invite sub-admin by email
- Order count widget on dashboard

---

## Super admin panel

All admin access plus:

### User management
- User list with roles and manufacturer
- Invite user to admin (email flow)
- Change manufacturer on a user
- Delete user by email
- User count + email export

### Product / catalog management
- List, search, create, update, delete products
- Each product defines the options available in the builder: fabrics, colours, GSM variants, printing methods, label types, pricing tiers, MOQ, etc.
- Full product schema (see below)

### Pricing
- Load products eligible for repricing
- Apply new price and update quantity tiers

### Analytics (tabbed, date range filters)
- Users: signup and activity metrics
- Orders: counts over time
- Revenue: monetary aggregates
- Drafts: funnel metrics (created → steps completed → submitted)
- Tech pack: tech-pack-specific orders and revenue
- All tabs: compact metric cards + data table

### Order revenue tracking (internal P&L)
- List rows with date filtering
- Create manual entry: customer name, product type, quantity, manufacturer cost, manufacturer shipping, customer paid — profit auto-calculated
- Update financials on a row
- Sync completed orders into ledger
- Aggregate stats: total revenue, total cost, total profit

---

## Product data model

```
Product {
  id
  name
  description
  categories[]
  garmentTypes[]            // which garment types this product applies to
  images[]
  leadTime
  origin                    // e.g. "Made in Portugal"
  defaultImageUrl
  moq
  startingPrice
  enforceMinOrder           // boolean

  quantityPricingTiers[]    // { minQty, maxQty, pricePerUnit }

  fabrics[] {
    name
    image
    colors[] {
      hex
      pantone               // optional
      name
      cost
      imagePath
    }
    gsmVariants[] {
      gsm
      baseCost
      quantityTiers[] { minQty, maxQty, pricePerUnit }
    }
  }

  colorOptions {
    maxColors
    additionalColorCost
  }

  dyeStyles[]               // { name, cost }
  fits[]                    // string names — filtered by garment type

  printingMethods[] {
    name                    // DTF, DTG, Embroidery, Screen Print, Transfers, No Printing
    cost
    minimumQty
    quantityTiers[]
    referenceImages[]
  }

  printingSizeDiscounts[]   // { minQty, discountPercent }

  labelTypes[] {
    name
    cost
    minimumQty
  }

  labelMaterials[]          // { name, cost }

  neckLabelOptions {
    types[]
    sizes[]
    materials[]
    allowNoLabel            // boolean
  }

  stitchingOptions[] {
    name
    cost
    image
    minimumQty
    quantityTiers[]
  }

  fadingTreatments[] {
    name
    cost
    image
    minimumQty
    quantityTiers[]
  }

  logoPlacements[] {
    name
    coordinates             // { x, y } as % of viewBox
    dimensions              // { width, height } in cm
    image
    pricingPerMethod[]      // { methodName, cost }
  }

  packageCost
}
```

---

## Data to persist

| Entity | Key fields |
|---|---|
| Users | credentials, Google OAuth ID, role, manufacturer, profile photo URL, saved delivery addresses[], default address ID, refresh tokens, hasSeenOnboarding, hasSeenBuilderTips |
| Products | full schema above |
| Drafts | full builder state JSON (all step selections), all upload URLs, print placement metadata, custom spec rows, notes to manufacturer, pricing breakdown (itemised), status, order type, step completion count, timestamps |
| Orders | same as drafts + invoice block, shipping/tracking info, payment session ID, order type, status history[], activity log[], admin notes, currentRevisionNumber, timestamps |
| Order revisions | orderId, revisionNumber, full builder state snapshot JSON, upload URL snapshot, changeSummary, createdAt |
| Artwork issues | orderId, placementZone, reason, adminNotes, resolvedAt, createdAt |
| Notifications | user ID, message, read state, timestamps |
| Password reset tokens | user ID, token, expiry |
| Revenue tracking rows | customer name, product type, quantity, manufacturer cost, manufacturer shipping, customer paid, profit (computed), source (manual or synced), timestamps |

---

## Navigation / app shell

### Logged-out: marketing layout (no sidebar)

### Logged-in: sidebar layout

**Customer sidebar**: Home, Catalog, My Drafts, My Orders

**Admin sidebar** adds: Admin Orders

**Super admin sidebar** adds: Dashboard, Admin Orders, Products, Statistics, Change Price, Revenue Tracking

---

## Email

Send transactional HTML emails for:
- Order submitted, priced, accepted, processing, shipped, completed
- Every status change — automatic, no admin action needed. B2B buyers will not log in to check. Without these, the support inbox fills up.
- Artwork rejection — sent automatically when an admin flags an artwork issue. Includes placement zone, reason, admin notes, and a direct link to re-upload.
- New artwork submitted — sent to admin when a customer re-uploads artwork after a rejection.
- New order revision submitted — sent to admin when a customer edits and resubmits an order.
- Password reset
- Admin invite

Test-send endpoint for mail config verification.

---

## UI / UX rules

- Desktop-first. Below 1024px: full-screen "Please use a desktop browser" message.
- Builder layout: left 320px fixed / centre flex / right 260px fixed. Generous padding around the SVG preview — it is the centrepiece, not a form element.
- Sticky Continue + Back buttons at the bottom of the left panel, always visible.
- Clickable progress indicator — completed steps are links, not just labels.
- Inline validation — errors appear as the user types, not on submit.
- Navigate-away guard on the builder — confirmation modal if unsaved changes exist.
- Auto-skip messaging — when a step is skipped due to garment type (e.g. no sleeve step for a skirt), show an inline message explaining why. Never silently skip.
- Right panel spec summary updates after every selection — not just at the review step.
- Price breakdown in right panel itemises every cost line: fabric, print method per placement, labels, packaging, quantity tier applied.
- Quantity tier visual bar next to quantity inputs: "Order 50+ to unlock €X/unit".
- MOQ warning when quantity is below minimum.
- One brand accent colour used consistently: active step indicator, selected preset card border, primary buttons, progress bar. No mixed highlight colours.
- All data tables: pagination, column sort, search/filter, loading skeletons that match the content layout exactly, empty states with a small SVG illustration and action prompt.
- Invoice total auto-calculates — no manual total entry.
- Modals for: invite flows, financial edits, manual order entry, confirmation dialogs.
- Consistent status badge colours as defined above — same colour for same status everywhere, no exceptions.

---

## Pricing calculation rules

All pricing calculated **server-side** on every draft save. Client displays returned value only — never calculates final prices itself. Return itemised breakdown alongside total.

Formula: base fabric cost + GSM variant cost + (additional colour cost × extra colours) + printing method cost per active placement + label costs + stitching cost + fading/treatment cost + packaging cost. Apply quantity tier discounts and printing size discounts. Flag if below MOQ.

---

## Suggested build order

1. Project setup, stack justification, folder structure
2. Database schema / models (including order revisions and artwork issues tables)
3. Auth (email/password + Google OAuth + refresh token)
4. Product data model and catalog API
5. SVG asset system — draw all garment base SVGs and all part variants first. Do not write builder code until assets exist.
6. Garment builder UI — step flow, garment-type filtering, SVG layer swapping, colour system, progress indicator, autosave, navigate-away guard
7. Customer onboarding — first-login modal and builder tooltips
8. Draft autosave + server-side pricing calculation (itemised)
9. PDF tech pack generation — auto-generated callout labels, all 6 pages, vector SVG embed, footer on every page
10. Orders, order versioning, and payments
11. Artwork rejection flow — admin flagging, customer re-upload, status transitions
12. Admin panel — order list with quick filters + bulk actions, inline spec view, activity log, revision diff view, auto-flagging, invoice auto-total
13. Super admin panel — users, products, analytics, revenue tracking
14. Notifications + email (status changes, artwork rejection, revision submission)
15. Marketing / public pages — updated copy, animated how-it-works, sample PDF download, catalog filters
16. Polish — empty states with SVG illustrations, matched loading skeletons, status badge audit across all views

---

## Final notes

- Single monorepo only. No separate frontend/backend.
- SVG assets must be drawn before builder code is written. The entire builder depends on them.
- Garment type is a strict filter — it controls every downstream option list. Build this into the data model on day one.
- Callout lines in the tech pack are auto-generated by the system, not manually entered by the user.
- Pricing is always server-side. Never trust client-calculated totals.
- PDF must be vector quality via svg2pdf.js — no canvas screenshots.
- "Order again" must restore the complete builder state including artwork upload references.
- Every order status change must trigger a customer email — automatically, no admin action needed.
- Editing a submitted order creates a new revision snapshot — never overwrite the previous spec.
- Artwork re-upload does not create a new revision — it updates the current revision's upload reference only.
- Onboarding modal and builder tooltips are shown once per user, tracked via boolean flags on the user record.
- Where any decision is ambiguous, choose the simplest maintainable approach and document it briefly.
