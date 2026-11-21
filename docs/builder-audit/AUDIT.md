# New Builder audit and redesign strategy

19 November 2026 · Route: `/builder/:id?builder=redesign`, opened from **Catalog → Open new Builder** · Branch `codex/artwork-and-distressed-hem` (uncommitted work included)

This document is the audit and the plan. **No implementation has started.**

---

## 1. Method

I drove the real rendered builder with Playwright (Chrome, dev server on `127.0.0.1:5180`) for all four catalog presets:

| Preset | ID | Swept |
|---|---|---|
| Premium Cotton T-Shirt | `ts-001` | 7 sections × front/back at 1440×900 and 1280×800, plus 1024×768 and 768×1024; all interaction states |
| Classic Pullover Hoodie | `hd-001` | 7 sections × front/back at 1440×900 |
| Performance Joggers | `tr-001` | 7 sections × front/back at 1440×900 |
| Singlet / Tank Top | `tk-001` | 7 sections × front/back at 1440×900 |

On the T-shirt I tested these interaction states: nothing selected, a canvas part selected (Materials), an artwork object selected, a shape being drawn, a selection dragged, deselect, long inspector content scrolled to the bottom, a hover on fit cards, keyboard Tab focus through the canvas, every Construction sub-section, every Artwork tool, label added → close-up → placement, the Packaging mailer and design mode, and Review & Export.

Evidence sheets are in this folder (`01-…` to `16-…`). Each sheet is labelled with the screenshot it came from.

**Not covered:** touch gestures on a real tablet; hovering over every individual control; Hoodie/Joggers/Tank interaction states beyond the static sweep (the four garments share the same shell code); export file contents; dark mode.

---

## 2. What makes it Ceriga (keep this)

- **The garment is the canvas.** Flat technical drawings, front/back, real construction details (stitch lines, rib bands, hems).
- **Production language.** GSM, composition, tolerances, print methods, stitch types, wash treatments. This is a tech-pack tool, not a mock-up tool.
- **A guided flow.** The order runs Fit → Materials → Construction → Artwork → Labels → Packaging → Order → Review & Export.
- **A quiet monochrome UI with one red accent** for the primary action.
- **Visual option cards** are already used well in places (tank strap width, neck shape, wash treatment, pattern swatches).

None of the recommendations below replace these. The aim is to make them more direct, not more generic.

### Hard rules for implementation (approved 19 Nov 2026)
1. **The garment stays the dominant canvas.** No change may shrink it, hide it behind panels by default, or turn the screen into a generic SaaS dashboard or a Figma, Canva or Adobe clone.
2. **Direct manipulation is the primary path; numbers stay as the precise fallback.** Measurements, exact dimensions, x/y, rotation, kerning, tracking, stroke widths and offsets all keep a numeric field in the inspector.
3. **Hover previews only where they're instant.** Use them for fits, necks, hems, sleeves and similar options. Expensive vector effects get a hover preview only if it renders without delay; otherwise they preview on click.
4. **Motion stays restrained.** Use only the moments listed in §7. Nothing decorative.
5. **No capability is removed** to make a screen look cleaner. Duplicates go; features stay.
6. **The garment is free-standing.** In the garment Builder it sits directly in an open workspace, never on a card, artboard, framed stage or mockup surface. Only the Asset Workspace shows an artboard.

### Creative direction: visual quality is a primary goal
The redesign is not only about fixing UX problems. **Ceriga should feel like a premium, modern creative application, not a form-based builder**: calm, intentional, fast and visually refined.

"Preserve Ceriga" means preserving its **identity**: the garment-first workflow, the technical fashion focus, the quiet monochrome palette, the restrained red accent, and every existing capability and piece of product logic. It does **not** mean keeping each screen visually similar. Layout, composition, hierarchy, spacing, scale, panel proportions, typography, surfaces, controls, cards, every interaction state, toolbars, popovers, inspectors, empty and loading states, transitions, close-up modes, object editing states, the artwork workspaces and the Asset Workspace may all be substantially redesigned.

For every page of every preset, ask: **"Even if this works, could it look and feel significantly better?"** If a component works but feels dated, generic, cluttered or awkward, redesign it. Each major visual change needs a reason: clearer hierarchy, easier interaction, more direct manipulation, better use of space, discoverability, reduced cognitive load, consistency, or perceived quality. Never redesign for novelty.

**The target feel:** minimal but not empty · premium but not decorative · technical but not intimidating · professional but approachable · modern without trends · precise without feeling cold. Spacious, focused, elegant, creative and fast.

**Quality comes from:** proportion, typography, spacing, hierarchy, subtle surface differences, excellent interaction states, rhythm, direct manipulation and consistent motion.

**Avoid:** SaaS-dashboard aesthetics, card-in-card stacks, giant rounded rectangles, heavy shadows, glassmorphism, random gradients, colourful icons, pill overload, oversized type and fake-luxury styling.

**Show, don't describe.** Replace abstract options with previews: fit silhouettes, necklines, sleeves, hems, stitching, effects, brushes, distortions, shape operations, text styles and pattern repeats. Users should never have to imagine what an option will do.

**Speed is part of beauty.** A beautiful interaction that feels slow is not good design. Every redesign pass also removes unnecessary re-renders, delayed panel responses, slow previews, heavy transitions, scroll jank, expensive hover previews and layout shifts. Prefer transform/opacity animation, cached previews, memoised geometry, lightweight overlays and deferred heavy work.

**Artwork gets the most ambitious treatment.** It should feel like a real creative environment where the interface gets out of the way. The artwork itself stays visually dominant.

**Visual QA gate after every phase.** Render it with Playwright across all four presets and inspect the actual pixels; CSS that "looks correct" in code doesn't count. Ask: Does it look premium? Is the garment dominant? Is the hierarchy obvious? Is anything cramped or oversized? Are the controls balanced? Are empty states intentional? Are selected states obvious but restrained? Does it feel like professional creative software? Iterate until the answer is yes. The bar is not "Ceriga, but cleaner"; it's **"Ceriga has become a mature, premium design application."**

**Review questions for every redesigned screen** (all must pass):
1. Is the main task obvious within 2 seconds?
2. Is the garment or artwork still visually dominant?
3. Are secondary controls quieter than primary actions?
4. Can a beginner understand what to do next?
5. Can an experienced user still reach precision controls quickly?
6. Does it feel like a premium creative application rather than a form?

**Before/after rule.** Before a phase starts, capture **BEFORE** screenshots of a fixed set of representative states for that phase. After it, capture **AFTER** screenshots of exactly the same states (same preset, viewport, view, selection and data) and compare them side by side in one sheet. A redesign is accepted only if it is **visibly clearer, more balanced and more premium**; being different is not enough. Pairs that fail go back for iteration. The comparison sheets are saved to `docs/builder-audit/phase-N/`.

---

## 3. Bugs found (fix before any redesign)

| # | Severity | Finding | Evidence |
|---|---|---|---|
| B1 | **P0** | **Review & Export opened from Packaging → Design is covered by the packaging editor's controls.** "Edit panel / Preview", "Add artwork" and the zoom bar render on top of the review dialog's title and footer. | `12-labels-and-review.png` (bottom right) |
| B2 | **P1** | **Construction → Sleeves frames the sleeve off-canvas.** The sleeve is cropped into the top-left corner and most of the canvas is empty. The Neck close-up frames correctly. | `13-construction-subsections.png` (top middle) |
| B3 | **P1** | **Opening a builder URL directly, or reloading it, redirects to the Catalog.** You can only enter through the Catalog link, so a refresh loses your place. It may be intentional; please confirm. | Reproduced in Playwright |
| B4 | P2 – verify | **The Joggers back view looks identical to the front**: centre fly seam, no back pockets or yoke. It may be an asset gap rather than a bug. | `08-back-view-all-garments.png` (bottom left) |
| B5 | P2 – verify | Clicking measurement callout **D** on the canvas did not visibly select or expand its inspector row. `design-qa.md` says it should. My click may have missed the hit target; this needs a recheck. | `09-fit-and-materials-states.png` |

Console: no errors during any sweep (one React Router hydration warning and a missing favicon only).

### Phase 0 results (19 Nov 2026)
Evidence: `phase-0/compare-*.png` (before | after).

| # | Outcome | What changed |
|---|---|---|
| B1 | **Fixed** | `main.builder-workspace` now uses `isolation: isolate` (`builder-shell.css`). Canvas overlays (zoom bar z 65, packaging editor view z 70, studio toolbars) were competing with the dialog layer (z 50) in the root stacking context. They're now contained inside the workspace, which already clips its overflow, so nothing inside it looks different. |
| B2 | **Fixed** | `TshirtSvgPreview.tsx`: part close-ups now frame the part's **painted** bounds, measured from the DOM relative to the camera box. Previously they used the stored layer bbox, which is in each asset's own coordinates. The measurement retries for a few frames for garments that paint late, and the minimum zoom drops from 1.8× to 1.2× so long parts (Hoodie sleeves) fit the frame. Verified on the T-shirt and Hoodie; the Neck close-up is unchanged. |
| B3 | **Not a bug — audit error** | The redirect came from my own script: PowerShell swallowed the product ID and built `/builder/=redesign`. Direct loads and reloads of all four presets stay in the builder. **The real issue** was a blank white page for ~9 s while the route loaded in dev (React Router's "No HydrateFallback" warning). Added `BuilderLoadingFallback`: a light skeleton of the shell (header, rail, garment, inspector), wired as the builder route's `HydrateFallback`. |
| B4 | **Not a bug** | The Joggers back view correctly drops the fly, front rise seam and pocket facings. Design gap for Phase 4: the back has no back-specific details (back pockets, yoke). |
| B5 | **Fixed (different cause)** | Canvas callouts already selected the measurement and expanded its row (mouse and keyboard). But the row sits ~950 px down the inspector and was never scrolled into view, so nothing seemed to happen. `FitMeasurementsInspector.tsx` now scrolls the selected row into view on a **selection change** (smooth, or instant with reduced motion). On first load the panel still opens at the top. |

**Checks:** re-swept all 4 presets × 7 sections × front/back at 1440 and pixel-diffed against the audit captures. The only differences are hover shading in the left rail from the cursor position; no unintended changes. `npm run test:surfaces` passes (17 PASS, 0 failed) and `test:zip-panel` passes. The production `vite build` succeeds.

### Verification baseline (set up before Phase 1)
- **`tsconfig.json`** (type-check only; Vite still compiles): mirrors `vite.config.ts` with React JSX, ESM + `bundler` resolution, the `@/*` → `src/*` alias, `vite/client` types for `?raw`/`?url`/image imports, JSON imports and `.ts`-extension imports. `src/figma-assets.d.ts` declares the `figma:asset/*` imports the custom Vite plugin resolves. It's deliberately not `strict`, because the code was written without it and several libraries ship no types.
- **`npm run typecheck`** fails only on **new** errors versus `typecheck-baseline.json`. Errors are matched by file + code + message, so shifted lines don't count. Takes ~17 s incrementally (~210 s cold). **`npm run typecheck:baseline`** re-records it; only use that deliberately.
- **Baseline: 146 historical errors in 61 files.** 119 are in committed code, 27 are in files that already had uncommitted changes before this session (Builder.tsx 9, ArtworkSurfaceSvg 4, TankDetailsLibrary 4, PackagingArtwork 3, surfaceColourLinks 3, ImageArtwork 2, SurfaceAddMenu 2), and **0 are in Phase 0 files**. They aren't being fixed as part of the redesign.
- **Language server:** `typescript-language-server` uses the workspace TypeScript 5.9.3 and this tsconfig. On `PrintsDesignStep.tsx` it reports the same 9 errors as the baseline; `?raw` and `figma:asset` imports resolve.
- **Change ledger:** `scripts/change-ledger.ps1 -Label <name>` writes per-category patches and file hashes to `docs/builder-audit/ledger/<name>/`. `before-phase1` separates: **00 pre-existing** Ceriga work (21 files, untouched by Claude), **01 Claude setup** (gitignore, package files, skills lock, tsconfig, typecheck tooling, 75 skill files), and **02 Phase 0** (5 files). Phase 1 changes will appear as "unassigned" in the next ledger.
- **Every phase must pass:** `npm run test:surfaces`, `npm run test:zip-panel`, `npm run typecheck` (0 new), `npm run build`, the Playwright sweep, and the before/after visual gate.

---

## 4. Cross-cutting findings

### 4.1 Too many navigation layers (P1)
Each section stacks up to **four** ways to move around:
1. The section rail (7 items)
2. A "… tools" sub-list **in the same rail** (4–8 items)
3. Inspector tabs that **repeat** the sub-list. Labels shows *Your labels / Design / Construction & size / Placement* in both the rail and the inspector; Packaging does the same.
4. A canvas view switcher, which differs per section: Front/Back in most, *On garment / Close-up / Artwork* in Labels, *Edit panel / Preview* in Packaging Design, *Draw / Edit / Finish seam* in Seams.

The rail also mixes levels: "Fit & Measurements" sits next to "Core measurements" in the same visual style, separated only by a small grey heading.

### 4.2 The inspector repeats the canvas (P1)
- Materials, Hem & Cuffs and Stitching each draw a **small garment diagram in the inspector** ("Front view · Selected: Whole garment") plus a row of **part chips**. The canvas already supports clicking a part (verified: clicking the sleeve selects *Sleeves*), so the same job is done three ways.
- On the Joggers the part chips mix groups and parts in one list: *Legs, Pocket facings, Left leg, Right leg, Waistband, Left pocket facing, Right pocket facing*.

### 4.3 Long inspectors, all in one scroll (P1)
| Panel | Inspector height | Viewport (1440×900) | At 1280×800 |
|---|---|---|---|
| Fit (Hoodie) | 1,910 px | 2.2× | 2.5× |
| Fit (T-shirt) | 1,797 px | 2.1× | 2.4× |
| Materials | 1,683 px | 2.0× | 2.2× |
| Construction (Tank) | 1,622 px | 1.9× | — |
| Packaging | 1,383 px | 1.6× | 1.8× |

Every panel opens with a three-line header (eyebrow "FIT STUDIO", title, description), which takes about 90 px before the first control.

### 4.4 Same concept, different controls on each garment (P2)
- **Body length**: T-shirt uses a collapsed row ("Original length ⌄"), Hoodie the same, Tank uses three large image cards plus a slider, and Joggers uses a segmented control plus a slider.
- **Fit thumbnails**: the T-shirt's four are near-identical outline icons, the Joggers' are solid black bars, and the Tank's are small photos. None show what actually changes.

### 4.5 Red does too many jobs (P2)
Red is the primary CTA (Review & Export), the selected measurement line and badge, the artwork selection box and handles, the rotation handle, and the label selection outline. When an error or warning appears, it won't stand out.

### 4.6 Visual polish (P2)
- The active-section dot collides with long labels: "Fit & Measuremen●", "Artwork & Graphic●". The selected fill already shows which section is active, so the dot adds nothing.
- Rail labels are cut off: "Add custom measure", "Import measurements".
- The collapse chevrons `‹ ›` float over the rail and inspector edges and overlap labels.
- The artwork tool strip uses roughly 8 px labels ("Hand", "Select", "Points"…), which is below legibility.
- Secondary card text ("Original shoulder seam", "Seam sits further down the arm") is about 10–11 px light grey. It likely fails 4.5:1 contrast; I haven't measured it yet.
- The "Artwork view" pill at top left looks disabled and does nothing visible.
- ~~The Artwork rail has an empty "ASSET WORKSPACE" heading.~~ **Correction:** it holds an **Open workspace** button, but at 1440×900 the button sits below the visible part of the rail, so the heading looks empty. The Asset Workspace is now reviewed in §13.

---

## 5. Section by section

### Fit & Measurements
**Works:** fit cards, shoulder construction cards with diagrams, A–I callouts, keyboard-focusable measurement callouts with good labels ("Hem width, 47 centimetres"), the measurement guides toggle.

**Problems**
- Measurements can only be edited in the inspector, and the 9-row list sits about 1,000 px down.
- The callouts show letters only. To read a value you have to find the matching row.
- The fit thumbnails don't preview the change.
- On the Hoodie, callouts G, H and J stack on top of each other at the hood/neck.

**Opportunities**
- **Drag measurement end-points on the canvas** to change values, with the tolerance band shown as a shaded range and the value in a chip that follows the cursor. Shift-drag keeps symmetry.
- **Value chips on the callouts** ("A 51"). Clicking one opens a small popover with the value, tolerance, how-to-measure and reset. The inspector row expands at the same time.
- **Hovering a fit card shows a ghost outline** of that fit over the garment. Click to commit.
- One **Body length** control for every garment: visual cards (Cropped / Standard / Longline, or Full / Shorts) plus a fine-adjust slider, the same everywhere.
- Spread out the hood callouts, or move the overlapping ones to a leader line.

### Materials & Colour
**Works:** clicking a canvas part selects it and lightens it, there's a drag-swatch-onto-garment hint, the palette, GSM.

**Problems**
- The inspector garment diagram and the part chips repeat the canvas (§4.2).
- The "Main fabric" swatch is beige while the garment is charcoal, which reads as a mismatch.
- "+ Save colourway" is a tiny floating control in the canvas corner.
- "Finish painting parts" and "Match all parts to body" are unclear wording.

**Opportunities**
- **The canvas is the part picker.** Click selects, Shift-click adds, a double-click on a pair (sleeves, legs) splits it into left/right. Remove the inspector diagram and keep a one-line **selection summary** ("Sleeves · paired ✕").
- The swatch shows fabric texture **and** current colour together.
- Colourways become a strip of thumbnails under the canvas ("+ Save current") instead of a floating "+".
- Outcome actions: **"Make everything match the body"** and **"Contrast trims"** (cuffs, hem and neck in one tap).

### Construction
**Works:** neck shapes, tank strap and armhole cards, hem construction cards, stitch type cards and wash treatment tiles are all strong visual choices. The Neck close-up frames well.

**Problems**
- The canvas only frames the region you're editing in some sub-sections: Neck works, Sleeves is broken (B2), and Hem, Details, Stitching and Wash show the whole garment.
- Dimension fields (band height, neck opening, neck drop) are number inputs. The Joggers waistband uses a 1–12 tick slider.
- The Hood cards are small, near-identical line icons.
- Seams has its own top-left toolbar (*Draw / Edit / Finish seam / Cancel*), different from every other section.

**Opportunities**
- **Every sub-section frames its region automatically**, with a smooth camera move (§7) so you can see where you are. A small "Full garment" chip returns to the overview.
- **Hovering an option previews it on the garment.** Click commits.
- **On-canvas handles** for band height, neck drop and neck width, the same pattern as Fit.
- Move the Seams drawing tools into the shared canvas toolbar position.

### Artwork & Graphics (largest opportunity)
**Works:** drag-to-draw shapes, selection with handles and rotation, the production method choice with real production notes, the pattern library, wear/distress painting, brushes.

**Problems**
1. **Three overlapping tool systems.** The rail has *Shapes & paths, Typography, Sketch, Import & trace, Library, Patterns, Finishes*. The tool strip has *Hand, Select, Points, Pen, Pencil, Shape, Type, Eraser, Mirror, Pick, Colour*. The inspector has the shape library and a *Pen tool* button. Shape, Pen and Type each appear in two or three places.
2. **Clicking a shape tile places nothing.** It arms the Shape tool silently. Clicking the garment then opens a **"New shape size W × H / Create shape / Cancel" form**: a technical dialog where a direct action was expected. Dragging does draw, but nothing tells you that.
3. **Once an object exists, the inspector swaps completely** to "‹ Shape" (Combine & arrange, Production method…). The library disappears, so adding a second shape means going back first.
4. **No print areas, safe zones or seams are shown** while placing artwork. "Avoid printing over seams" only appears as text after drawing.
5. The production method is chosen **after** drawing, so its constraints arrive late.
6. "Add text" is disabled until you type in a box in the inspector. "Double-click text on the garment" is mentioned in small print but isn't offered as the main path.
7. Duplicate and delete live at the bottom-right of the canvas, far from the selected object.
8. The tool strip and rail are cut off at 1280×800 (the "Finish" items need scrolling).

**Opportunities: faster than the equivalent Illustrator workflows**
- **Remove the duplication, not the categories.** The rail keeps the seven Artwork areas (*Shapes & paths, Typography, Sketch, Import & trace, Artwork library, Patterns & repeats, Finishes & texture*) as the mental map. Each verb exists in one place only: the tool strip holds the canvas tools (Select, Hand, Points, Pen, Pencil, Eraser, Mirror, Pick), with readable labels or tooltips and single-key shortcuts. The inspector shows the library and options for the current area. The Shape / Pen tool / Type repeats are removed.
- **Click a tile and the shape lands, selected, at the centre of the active print area. Drag a tile to drop it where you want it. Drag on the garment to draw it.** Remove the W × H dialog; size lives in the selection inspector afterwards.
- **Optional print-area guides**: chest, centre front, left chest, back yoke, sleeve. A **Guides** menu in the canvas toolbar has three separate switches: *Print areas*, *Snapping* and *Seam warnings*. They're on for a first-time user, and the user's choices are remembered. Holding Alt bypasses snapping for a single drag. When seam warnings are off, an object that crosses a seam still gets a small badge in its inspector, so production problems are never silently hidden.
- **Default print method per object.** Each new artwork gets the garment's default method (e.g. DTG on cotton jersey), and it can be changed per object at any time. Creation is never blocked by a method choice.
- **A floating context toolbar next to the selection**: duplicate, flip, align to print area, arrange, delete. It follows the object.
- **The inspector keeps context.** Selecting an object pushes an object panel from the right; the library stays one tap away with its scroll position remembered. Deselecting slides back.
- **Outcome actions** that take several steps in Illustrator: "Centre on chest", "Place as left-chest logo (9 cm)", "Mirror to back", and "Make 1-colour for screen print", which auto-separates colours from the chosen print method.
- **Text first-class**: press T and click the garment to start typing in place. The inspector shows typeface and style presets.

**The outcome rule (applies to every Artwork tool in Phase 2).** Before redesigning any tool, ask: *"Can this operation be represented as an outcome instead of a vector-operation workflow?"* If yes, the outcome becomes the primary action, and the underlying vector control stays in Advanced for precision.

| Vector workflow | Outcome action |
|---|---|
| Boolean difference | **Punch hole** |
| Edit Bézier handles | **Bend edge** |
| Duplicate + offset + blend | **Long shadow** |
| Type-on-path setup | **Follow neckline** (and follow hem, follow sleeve) |
| Manual duplicate / repeat | **Repeat down sleeve** |
| Multiple appearance steps | **Recipes**: Varsity, Chrome, Racing |

Phase 2 starts with an inventory of every tool in `components/builder/` (shapes, path tools, text, sketch, trace, library, patterns, finishes, effects). Each tool gets one verdict: *becomes an outcome*, *stays direct*, or *moves to Advanced*.

### Labels & Branding
**Works:** the label type list with clear descriptions, the close-up view of the label in the neckline, the label editor with design layers.

**Problems**
- Placement is a **dropdown** ("Garment location") plus "Advanced offsets".
- There's no Front/Back toggle, and the view switcher is in a different style and position from every other section.
- The "No labels added…" message overlaps the Hoodie's hem.
- Rail sub-tools and inspector tabs repeat each other.

**Opportunities**
- **Drag the label on the garment** to place it, with snap zones (inside back neck, side seam, hem, sleeve) that light up while dragging. Keep the dropdown as an accessible fallback.
- The same view toolbar as every other section (Front / Back / Close-up), plus "Edit label" as a mode.

### Packaging
**Problems**
- The canvas shows an empty outline by default. "Contents" and "Print-safe guides" are both off.
- B1 (review overlap).

**Opportunities**
- Show the folded garment in the bag by default.
- Turn print-safe guides on automatically in Design mode.

### Order & quantities
**Works:** size inputs and the size distribution curve.

**Opportunities**
- **Drag the curve's points** to set quantities.
- One-tap curve presets: Bell, Flat, Skew small, Skew large.
- Show the total and MOQ status next to the curve.

### Review & Export
- Fix B1.
- The left nav lists each section twice (a plain list, then again with icons).

---

## 6. Responsive

| Width | Result |
|---|---|
| 1440×900 | Baseline. No horizontal overflow on any section. |
| 1280×800 | Works. Inspectors run 2.2–2.5× the viewport, and the Artwork rail and tool strip are cut off. |
| 1024×768 | Both panels collapse to icon rails and **the inspector hides completely** behind a 20 px "‹" strip, so no section controls are visible by default. Section icons have no visible labels, only `title` tooltips. |
| 768×1024 | Same as 1024, plus an empty strip down the right edge. Editing requires opening the inspector first. |

**Strategy (decided: full editing, progressively simplified):** at tablet sizes the inspector becomes a **bottom sheet** with three heights (peek / half / full), and sections become a labelled tab bar. The canvas keeps tap-to-select and drag handles, with touch targets of at least 44 px. Below 1024 px the default sheet height is "peek", showing the current choice.

---

## 7. Interaction and motion spec

Motion is used only where it explains a state change or supports dragging. Every animation respects `prefers-reduced-motion` (instant swap).

| Moment | Behaviour |
|---|---|
| Selecting an object or part | Highlight fades in over 120 ms. The inspector **pushes** the object panel (shared x-axis, 200 ms ease-out); Back reverses it. |
| Switching section | Inspector content crossfades over 150 ms. The canvas doesn't move unless the framing changes. |
| Auto-framing a region (construction close-up) | Camera pan and zoom over 280 ms ease-in-out, so you can see where you've zoomed to. |
| Dragging (measurements, artwork, labels, curve) | 1:1 with the pointer, no easing. Snap with a 60 ms settle. Escape cancels and springs back. |
| A value changes from an input | The matching canvas dimension line pulses once (180 ms). |
| Hover preview of an option | The ghost overlay fades in after an 80 ms hover delay, so passing over cards doesn't flicker. Only for options that render instantly (rule 3). |

**Control states (applied consistently)**

| State | Treatment |
|---|---|
| Hover | Border darkens one step. |
| Press | Scales to 0.98 over 80 ms. |
| Selected | Ink (near-black) border plus a check. Red is never used to mean "selected". |
| Focus-visible | 2 px ring with a 2 px offset in the accent ink colour. |
| Disabled | 40% opacity, with a tooltip saying why. |

Red is kept for the primary CTA and for errors and warnings. The selection colour becomes ink.

---

## 8. Accessibility and UX writing constraints

- Every icon-only button gets an `aria-label`. The collapsed rails currently rely on `title`.
- Secondary text needs at least 4.5:1 contrast, and nothing should be smaller than 12 px. The tool strip labels need to grow or move into tooltips.
- Every drag interaction gets a keyboard path: arrow keys nudge (Shift ×10), and the inspector fields stay as the precise fallback.
- Snap zones and print areas get text names for screen readers ("Left chest print area, 10 × 10 cm").
- Copy:
  - Drop the "XX STUDIO" eyebrow lines and cut the panel descriptions to under 8 words, or remove them.
  - Rename "Finish painting parts" → **"Done"**, "Match all parts to body" → **"Use body colour everywhere"**, and "Reference / inspiration only" → **"For reference — not used in production"**.

---

## 9. Implementation plan (for approval)

Each phase ends with a Playwright sweep of all four garments at 1440, 1280, 1024 and 768 widths, front and back, run with the same scripts used for this audit, **plus the visual QA gate** (§2, creative direction) on every page of every preset. Each phase redesigns both the behaviour and the visual presentation of its pages using the §12 system. Phase 2 includes the full Asset Workspace recomposition (§13).

| Phase | Scope | Size |
|---|---|---|
| **0 – Bugs** | B1 review overlap, B2 sleeve framing, B3 deep-link reload (if not intentional), B4/B5 verify. | S |
| **1 – Shell and design-system primitives** | First extract the shared building blocks (listed below), then rebuild the shell on them: one navigation layer (rail = sections plus their sub-areas; no repeats in the inspector), one canvas toolbar (view / zoom / guides) in the same place for every section, compact inspector header, ink selection colour, the rail dot and truncation fixed, and readable tool labels. | M–L |
| **2 – Artwork Studio architecture** | Tool inventory with outcome-rule verdicts; de-duplicated tools with the seven rail areas kept; place-on-click, drag-tile and drag-to-draw; remove the W × H dialog; optional print-area guides, snapping and seam warnings; default print method per object; floating context toolbar; push/pop inspector; outcome actions and recipes; type-on-canvas. | L |
| **3 – Fit on canvas** | Draggable measurement handles with tolerance bands, value chips, quick-edit popover, fit hover ghost, one Body length control. | M–L |
| **4 – Materials & Construction** | Canvas as the part picker (remove inspector diagrams and chips), auto-framing per sub-section, hover previews, on-canvas dimension handles. | M |
| **5 – Labels, Packaging, Order, Review** | Drag-to-place labels with snap zones, contents shown by default, draggable size curve with presets, de-duplicated review nav. | M |
| **6 – Tablet** | Bottom-sheet inspector, labelled section tabs, 44 px targets. | M |

`Builder.tsx` is 375 KB. Redesigning screens directly would give prettier but still inconsistent pages, so Phase 1 builds the shared primitives first and every section from Phase 1 onwards is built only from them.

### Phase 1 primitives

| Primitive | Job |
|---|---|
| `BuilderInspector` | Right panel frame: width, collapse, scroll, push/pop between overview and object panels |
| `InspectorHeader` | One-line title with an optional back button and actions (replaces the three-line eyebrow/title/description) |
| `InspectorSection` | Collapsible group with a summary value in its header |
| `StickySubTabs` | A section's sub-areas, pinned at the top of the inspector |
| `VisualOptionGrid` | Picture cards with consistent hover, press, selected, focus and disabled states, plus an optional instant hover preview |
| `CompactField` | Numeric or text field with unit, stepper and drag-to-scrub; the precise fallback for every direct manipulation |
| `SelectionSummary` | One line naming what's selected ("Sleeves · paired"), with clear and split actions |
| `CanvasToolbar` | View (Front / Back / Close-up), zoom and the Guides menu, in the same place in every section |
| `ContextToolbar` | Floating actions anchored to the canvas selection |
| `FloatingPopover` | Anchored quick-edit popover (measurement chip, label placement) |
| `ToolButton` | Tool strip button: icon, readable label or tooltip, shortcut, active state |
| `CanvasValueChip` | Value label pinned to a measurement, dimension or handle |
| `SnapGuide` | Snapping lines and snap-zone highlight while dragging |
| `PrintAreaOverlay` | Named print areas, safe zones and seam lines (optional, via Guides) |
| `BottomSheet` | Tablet inspector with peek / half / full heights |

## 10. Decisions (answered 19 Nov 2026)

1. **B3 reload:** yes. Refreshing or opening a builder URL keeps you in the builder.
2. **Tablet:** full editing, progressively simplified. Not review-only.
3. **Artwork print method:** a default production method per artwork object, editable later. Users are never forced to choose before creating.
4. **Phase order:** approved as 0 → 1 → 2 → 3 → 4 → 5 → 6, with Phase 1 including the design-system primitives.
5. **Print-area guides** are optional (Guides menu), as are snapping and seam warnings.

---

## 11. Visual quality review: every page, all four presets

This review is based on the same captures (sheets 01–17). All four presets share one shell, so shell-level problems appear everywhere. Preset-specific problems are tagged **[TS] [HD] [TR] [TK]**.

### Shell (every page)
- **Controls are scattered to every corner of the canvas.** Front/Back sits top right, zoom bottom left, the guides toggle bottom right, and section extras top left ("+ Save colourway", "Artwork view", label view switcher). Every island has a different style and height. *Redesign:* one bottom-centre `CanvasToolbar` island (view · zoom · Guides), with section-specific tools inside it as a second group.
- **The rail, workspace and inspector merge into one flat sheet.** *Redesign (corrected 19 Nov 2026):* **the garment stays free-standing in an open workspace: no stage, card, artboard, frame or mockup surface behind it.** Separate the regions instead with hairline boundaries, panel contrast (rail and inspector may take a very subtle tone), spacing and toolbar placement. The centre stays clean and open.
- **The left rail (≈175 px) reads like a settings sidebar.** Two stacked lists with uppercase eyebrow headings, truncated labels and a stray dot. *Redesign:* a narrower rail. Sections are icon plus a short label, and only the active section expands to show its sub-areas, indented. "Upload reference" moves into the header overflow menu.
- **The inspector opens like a form.** An eyebrow, title and description take about 160 px before the first control; then come dividers between every group, 10–11 px light-grey helper text, and box-in-box cards (grey card → white chips → grey card). *Redesign:* a one-line `InspectorHeader`, groups separated by space rather than lines, helper text only where it prevents mistakes, and no nested cards.
- **The header** is fine in weight (44 px) but red "Review & Export" is the loudest thing on screen, louder than the garment. *Redesign:* keep it red but make it smaller and quieter (text weight 500, compact height). It should be the obvious exit, not a beacon.

### Fit & Measurements
- **Fit cards use three different visual languages:** outline icons [TS][HD], solid black bars [TR] and small grey renders [TK]. In every case the four options look nearly identical at thumbnail size. *Redesign:* silhouettes rendered from the real fit geometry, overlaid on a shared baseline so the difference is visible (the selected fit is solid, the others are outlines), plus the hover ghost on the canvas.
- **Shoulder construction cards** put a ~30 px icon inside a ~150×110 card, with 10 px captions; about 70% of each card is empty. *Redesign:* a shoulder-region crop of the actual garment at 2× scale, with the seam line drawn in ink.
- **Measurement callouts** are small grey letter discs; only A is red. They read as debugging marks rather than a designed overlay. [HD] G, H and J collide on the hood. *Redesign:* `CanvasValueChip` callouts ("A · 51"), quiet ink-on-white. The active one is filled ink, with the measured line emphasised and a tolerance band.
- **Body length** looks different on every preset (§4.4). *Redesign:* one `VisualOptionGrid` with length silhouettes and a single precise `CompactField` below.
- **The size range and units** sit at the very bottom of an 1,800 px scroll. *Redesign:* move them into the inspector header row, since they define every value below them.

### Materials & Colour
- **Box-in-box stacking:** the hint box, then the Apply-to card containing the mini diagram and chips, then the Main fabric card. *Redesign:* remove the mini diagram and hint (the canvas does both), add a `SelectionSummary` line, then the fabric row, then colour.
- **The fabric swatch is beige on a charcoal garment** and reads as an error. *Redesign:* a swatch that shows the fabric texture tinted with the current colour.
- **The colour grid** (48 saturated dots) is the most colourful thing in the app and visually outweighs the garment. *Redesign:* lead with recent colours and the garment's palette, and keep the full library one step away (Library / Pantone / Pick tabs stay).
- **"+ Save colourway"** is a 10 px label in the canvas corner. *Redesign:* a colourway thumbnail strip with "+ Save current" in the canvas toolbar.
- [TR] The part chips mix groups and individual parts (§4.2).

### Construction
- **Option thumbnails are too small to show the difference.** Crew versus thin crew, the three near-identical hood icons [HD], and waistband strips occupying 20% of a tall card [TR]. The tank strap-width cards [TK] are the model to follow: the real garment, cropped, with the difference obvious.
- **Text-only toggles** (Raised/Relaxed, Stitched edge/Raw opening, Double/Single layer [HD]) where a small crop preview would remove the guesswork.
- **The canvas stays on the whole garment** for most sub-sections, so the region being edited is tiny. The sleeve close-up is broken (B2). *Redesign:* every sub-section frames its region, with ink highlighting on the parts that will change.
- **The Joggers waistband band-height control** is a 1–12 tick slider that's visually heavy and detached from the garment. *Redesign:* a drag handle on the waistband edge plus a `CompactField`.
- **Wash and stitching tiles** have good content but are small and dark. They need a consistent thumbnail scale with the other grids.

### Artwork & Graphics
- **The selection looks like a debugging overlay**: a thin red box, tiny red-bordered squares and a free-floating red rotate circle. *Redesign:* an ink 1 px box, 8 px white handles with an ink border, a rotate handle attached by a short stem, a dimension chip during resize, and a subtle hover outline on unselected objects.
- **Tool strip labels are about 8 px**, so the strip is effectively unreadable. *Redesign:* `ToolButton` with icons only, a tooltip showing name and shortcut, a clear active state, and grouping by function (select · draw · type · utility).
- **The shape library tiles** are large boxes with 1 px wireframe shapes. They work but feel like placeholders. *Redesign:* filled ink shapes at a consistent optical size, in a tighter grid. Effects, text styles and brushes get real rendered previews in the same grid style.
- **Duplicate and delete sit in the bottom-right corner**, far from the object. *Redesign:* a `ContextToolbar` above the selection.
- **The layers bar** is collapsed at the bottom with a "0". *Redesign:* layers become a compact floating panel that's on by default when there's more than one object, with thumbnails and drag reordering.
- **No print areas** and no sense of the garment's printable surface. *Redesign:* optional `PrintAreaOverlay` (Guides).
- **The sketch brush bar** at the bottom (Pen · Size · Opacity) is the right idea: tool options near the canvas. Generalise it as the tool-options strip for every tool.

### Labels & Branding
- **The label list** uses tiny grey thumbnails and "+" circles. It's functional but feels like a settings list. *Redesign:* real-scale label previews (woven, printed and hangtag look different), with selected and added states.
- **Nothing on the garment shows where labels go.** The empty-state banner floats over the hem [HD]. *Redesign:* an on-canvas ghost slot at the inside neck ("Drop a label here"), which also serves as the empty state.
- **The label editor** (Artwork mode) uses a different, unlabelled tool strip from Artwork. *Redesign:* the same `ToolButton` strip as Artwork.
- **The close-up view is excellent.** It's the model for how construction close-ups should feel.

### Packaging
- **The default canvas is an empty outline rectangle.** It feels unfinished. *Redesign:* show the folded garment inside, with a realistic material tint for clear, frosted and opaque.
- **The style cards for clear and white polybags are blank white squares**, so the previews show nothing. *Redesign:* each card renders the folded garment inside the bag material.
- The kraft mailer preview is good and is the target quality.

### Order & quantities
- **The canvas splits into a garment on the left and a small floating chart** with tiny type ("Samples 1 unit") in the middle, with large empty areas around both. *Redesign:* a deliberate composition: the garment smaller to one side, and a full-height size-curve panel with large numbers, a draggable curve, presets and the total.
- **The inspector** ends with a big black "Continue to delivery" after a large gap. The left rail "Section tools" is a paragraph of instructions. *Redesign:* remove the paragraph and pin the CTA in a sticky footer with the total.

### Review & Export
- **B1 overlap.** The navigation list is shown twice. A "Specification completion 7%" bar is barely visible. *Redesign:* the completion indicator becomes the hero (a checklist of sections with status), and the tables use the same typographic scale as the inspector.

---

## 12. Visual system (Phase 1 builds this before any page is redesigned)

All values are starting points to tune in the visual QA gate. They are tokens: every section uses them; nothing is styled ad hoc.

### Density modes
One system, three densities. A container sets its mode (`data-density`), and the primitives inside read their sizes from it, so the same `CompactField` or option card adapts without separate components.

| Mode | Used for | Control height | Row / grid gap | Group gap | Text | Thumbnails |
|---|---|---|---|---|---|---|
| **compact** | Creative tools: Artwork and Asset Workspace inspectors, layers, tool-options strip, context toolbar, dense precision groups | 28 | 4 / 6 | 16 | 12 body, 11 helper | 32–40 px |
| **standard** | Normal builder controls: Fit, Materials, Construction settings, Order, Review | 36 | 8 / 8 | 24 | 13 body, 12 helper | 48 px |
| **visual-grid** | Option cards and previews: fits, necks, sleeves, hems, stitching, effects, brushes, text styles, patterns, packaging styles | — | 8 grid | 24 | 12 label under the preview | 72–112 px; 2 or 3 columns by inspector width |

The modes can be mixed within one inspector. For example, Construction → Neck uses visual-grid for the neck shapes and standard for the measurements below them. Every mode shares the same colours, radii, states and motion.

| Area | Rule |
|---|---|
| **Surfaces** | **Garment Builder workspace: open, no surface behind the garment** (no stage tone, card, artboard or frame); the garment sits directly in the workspace. Rail and inspector may carry a very subtle panel tone for separation. Floating controls are white with a hairline and one soft shadow. No glass, no gradients. **Exception:** the Asset Workspace shows a real artboard (see §13). `--cx-stage` is for the Asset Workspace and the design-review gallery only. |
| **Lines** | Hairlines only between major regions (rail | workspace | inspector). Inside the inspector, groups are separated by spacing, not dividers. |
| **Text** | Inter. 16/600 panel title · 13/600 group heading · 13/400 control and body · 12/400 helper · 11/500 caption (sparingly, no letter-spaced uppercase eyebrows). Colours: ink, secondary and tertiary, with tertiary as the lightest text colour (≥4.5:1). |
| **Icons** | One set (Lucide), 16 px with 1.5 stroke in panels, 18 px in the tool strip. Monochrome only. |
| **Controls** | Height 32 (compact) / 36 (default). Radius 6 for controls, 8 for cards and popovers, 10 for floating toolbars. Nothing larger. |
| **Spacing** | 4-pt scale: 4 · 8 · 12 · 16 · 24 · 32. Inspector padding 16, group gap 24, grid gap 8. |
| **Cards (`VisualOptionGrid`)** | Thumbnail-first: a real preview at least 64 px, label 12 px below. Inactive has no border on a faint fill; hover is one step darker; selected has a 1.5 px ink ring and a small check; press scales to 0.98; disabled is 40% with a reason in a tooltip; focus-visible has a 2 px ink ring with a 2 px offset. |
| **Canvas selection** | Ink box, white handles with an ink border, an attached rotate stem, and a dimension chip while transforming. Hover shows a light outline. **Red only for errors and warnings.** |
| **Popovers and menus** | White, radius 8, hairline, the floating shadow, 8 px padding, 32 px rows. |
| **Tooltips** | Ink background, white 12 px text, shortcut in tertiary, 400 ms delay (0 ms once one is already open). |
| **Empty states** | On the canvas, where the action happens (ghost slots, drop zones), not as banners or grey boxes. |
| **Loading** | Skeletons in the final aspect ratio. No spinner for anything under 300 ms. Previews are cached after first render. |
| **Motion** | Only the §7 moments, using transform and opacity only. |
| **Performance** | Memoise garment geometry per fit/size; render option previews once and cache them; hover previews are synchronous or skipped; no layout shift when switching sections (fixed inspector width, reserved header). |

### Creative-canvas interaction states
These replace today's red debugging-style overlays. All overlays are drawn in **screen space**: line widths, handle sizes and labels stay the same at every zoom level. They use only the ink, white and a single focus tint, except for warnings. Built as part of the Phase 1 primitives and applied in Phase 2.

| State | Appearance | Behaviour |
|---|---|---|
| **Hover (unselected object)** | 1 px outline in tertiary ink tracing the object's actual shape (not its bounding box). | Appears instantly; no fade. Hidden while dragging. |
| **Selected object** | 1 px solid ink bounding box. Eight 8 px square handles: white fill, 1 px ink border, 1 px radius. A small name/size chip under the box (e.g. "Circle · 10 × 10 cm"), 11 px. | The selection box follows the object 1:1. A multi-selection shows one combined box plus a faint outline on each member. |
| **Resize** | The active handle fills ink. A live dimension chip beside the cursor ("12.4 × 10.0 cm"). The opposite anchor shows as a small cross. | Shift keeps proportions, Alt resizes from the centre. Values snap to 0.5 cm when snapping is on. |
| **Rotate** | A 10 px circular handle on a 16 px stem above the top-centre. While rotating: an angle chip ("15°") and a faint arc from 0°. | Shift snaps to 15°. Rotates around the visible centre point. |
| **Anchor points** (path editing) | 7 px squares: white with an ink border when unselected, solid ink when selected. Corner points are square, smooth points are round. | Clicking selects, Shift-click adds to the selection, double-click toggles corner ↔ smooth. |
| **Bézier handles** | A 1 px tertiary line from the anchor to a 6 px round handle (white fill, ink border). Shown only for the selected anchor and its neighbours. | Alt breaks the symmetry. Handles fade when the anchor is deselected (100 ms). |
| **Snap guides** | 1 px line in the focus tint (one accent: a muted blue-violet chosen in Phase 1, never red), extended edge to edge of the print area or garment. A small label when snapping to a named target ("Centre front"). | Appear only during a drag and while actually snapped. Alt held disables them. |
| **Print areas** (optional, via Guides) | Dashed 1 px tertiary outline, 4 % ink fill, and a name chip at the top-left ("Left chest · 10 × 10 cm"). The active area (the one under the drag) strengthens to a solid outline. | Visible while an artwork tool is active, if enabled. Never captured in exports. |
| **Seam warnings** (optional, via Guides) | Where artwork overlaps a seam, the seam segment is drawn in the warning colour (amber), with a small ⚠ chip at the overlap: "Crosses shoulder seam". | Updates live while dragging. When guides are off, a badge in the object inspector still records it. |
| **Drag preview** (dragging from a library) | A 70 %-opacity ghost of the item at its real size on the garment, following the cursor, with its print-area target highlighted. | Esc cancels. Dropping outside a valid area returns the ghost to the library (200 ms). |
| **Drop target** | The receiving region (print area, label slot, garment part for swatches) brightens: 8 % ink fill and a solid 1.5 px ink outline. | Only valid targets react; invalid regions stay inert, and the cursor shows not-allowed. |
| **Active tool cursor** | A custom cursor per tool: crosshair with a small tool glyph for shapes, a pen nib for the pen, a brush ring sized to the actual brush for sketch, an I-beam for type, grab/grabbing for hand. | The brush ring scales with zoom so it matches the real stroke width. |
| **Disabled tool** | Icon at 35 % opacity with no hover fill. The tooltip explains why ("Select a path to edit points"). | Remains focusable for the tooltip and has `aria-disabled`. |
| **Locked object** | No handles. A small lock badge at the top-right corner of the outline on hover. The hover outline is dashed. | Clicking selects it in the Layers panel only. The context toolbar offers "Unlock". |

**Colour roles on the canvas:** ink (selection, handles), tertiary ink (hover, print areas, Bézier lines), one focus tint (snap guides only), amber (seam warnings), red (errors only: e.g. artwork outside the printable garment). The rotate handle and selection are never red.

---

## 13. Asset Workspace (reviewed from scratch)

Opened from **Artwork & Graphics → Asset Workspace → Open workspace** (sheet `17-asset-workspace.png`).

**What it is today:** a full-screen mode with its own left rail ("Design tools", the same seven categories), a two-row header ("← Garment · ASSET WORKSPACE / Untitled Asset · Save asset", then "Canvas 600 × 600 px ⌄"), the same tool strip, a 600×600 checkerboard artboard, and the same inspector as garment artwork.

| Question | Finding |
|---|---|
| Is the canvas large enough? | The artboard fills almost the whole stage with no margin, and its edge barely contrasts with the stage, so it doesn't read as an artboard. **Fit it with breathing room, give it a clear edge on the stage colour, and show its size as a chip.** |
| Does it feel immersive? | Partly: the app header and sections are hidden, which is good. But the left rail (≈110 px) and the full inspector still frame it like the garment builder. |
| Is the header too heavy? | Yes. Two rows and an uppercase eyebrow. **Make it one 44 px row:** ← Garment · editable asset name · canvas size menu · Save asset. |
| Is the left navigation useful? | Only as category switching. "Upload reference / Reference only" is irrelevant here. **Collapse the categories into the tool strip's groups, or a slim icon rail, and give the width to the canvas.** |
| Is the right panel balanced? | No. A selected shape produces a long form: Combine & arrange, Name, Appearance, Artwork effects, Corner radius (shown **twice**: a mm field *and* a separate unitless slider), Individual corners, Reset geometry, Edit with pen, Visual effects, Reshape, then **Position & size at the very bottom**, even though it's the most-used group. **Reorder by frequency:** position/size → appearance → effects → advanced. Merge the duplicate corner-radius controls into one `CompactField` with drag-to-scrub. |
| Should controls float? | Yes. Duplicate, flip, arrange and delete move to the `ContextToolbar`. Corner radius gets an on-canvas corner handle. Tool options (brush size and opacity) stay in the bottom tool-options strip, which already exists for Sketch. |
| Should sections become popovers? | Effects, Combine & arrange and colour become popovers from the `ContextToolbar`. The inspector keeps the full precise controls. |
| Do creation tools appear near the object? | No, everything is in the side panels. Add a **quick-add** menu on the canvas: right-click or press `/` to get shape, text, image and pattern at the cursor. |
| Does rail state behave? | No. With an object selected, clicking Typography or Sketch in the rail leaves the Shape inspector showing. **Choosing a tool area while something is selected should switch the inspector to that area**, with the selection kept. |
| Does it feel like professional design software? | The bones are there (artboard, tool strip, inspector). It lacks a real artboard presentation, a context toolbar, readable tools, sensible inspector order and direct handles. With §12 applied plus those changes, it can feel professional. |

**Target composition:** a single 44 px header, a slim icon tool strip on the left, a large centred artboard on the stage, the context toolbar following the selection, a tool-options strip at the bottom centre, and a 300–320 px inspector on the right ordered by frequency, with layers as a floating panel. **The artwork stays the dominant element on screen.**

---

## 14. Skills and plugins: where each one is used

Everything installed in this project is used where it applies. The plan for each phase is: build with the "Build" skills, check with the "Review" skills, then run the Playwright visual QA gate.

| Skill / plugin | Used in | For |
|---|---|---|
| `frontend-design` (Anthropic) | 1–6 | Visual direction, type, composition and avoiding template defaults |
| `design-engineer` | 1–6 | Craft details: shadows, optical alignment, spacing, icon and state polish |
| `emil-design-eng` | 1–6 | Press/hover/focus states, popover origins, tooltip timing, clip-path, drag details |
| `apple-design` | 2, 3, 6 | Physical, interruptible motion; gestures; materials and depth (used sparingly) |
| `information-architect` | 1, 5 | Rail/section/sub-area structure, de-duplication, review navigation |
| `design-critique` | Every gate | Heuristic critique of the rendered screens |
| `accessibility-audit` | Every gate | WCAG 2.2 AA: contrast, focus, names, keyboard paths for every drag |
| `ux-writing` | 1–5 | Headers, helper text, option names, empty states, errors |
| `animate` | 1–5 | Building each §7 motion moment |
| `choreograph` | 2, 4 | Inspector push/pop and camera framing working together |
| `gestures` | 2, 3, 5, 6 | Drag handles, drag-to-place, the size curve, the bottom sheet |
| `animation-performance` | Every phase | Keeping motion composite-only and inside the frame budget |
| `review-animations` / `improve-animations` | End of 2–6 | Auditing the motion that was added |
| `find-animation-opportunities` | 4–5 | Checking for missing feedback |
| `remove-animations` | End of 6 | Removing anything decorative (restraint rule) |
| `animation-vocabulary` | As needed | Naming motion precisely in specs |
| `break-ui` | Every gate | Worst-case data: long asset names, 30 layers, many labels, extreme sizes |
| `mobile-native` | 6 | Tablet touch, 100vh, tap highlight, input zoom, safe areas |
| `ask-sonner` | 1, 5 | Save, export and undo toasts (Sonner is already a dependency) |
| `playwright-cli` | Every gate | Rendering all four presets × widths × states, and screenshots |
| `simplify` / `code-review` | End of each phase | Code quality and correctness on the diff |
| `typescript-lsp` (plugin) | 1–6 | Type-aware navigation and refactors in the 375 KB `Builder.tsx`, **once you install it** (`/plugin install typescript-lsp@claude-plugins-official`) |
| `prototype`, `learn-taste`, `pick-ui-library`, `ask-emil` | On request | These four only run when **you** type them (e.g. `/prototype` to try alternative Asset Workspace layouts); I can't start them myself |
| `write-swift`, `animate-expo` | — | Not applicable (Swift and React Native) |
