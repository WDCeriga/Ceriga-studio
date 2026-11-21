# Ceriga Artwork Studio — total redesign plan

Status: **plan only — nothing implemented.** Written 20 Nov 2026 after reviewing all 14 reference videos frame by frame, the full Artwork code base (~200 files), and live captures of every category and object state on the current Builder.

Guiding rule for every decision below:

> **Make sophisticated creative work easier without making the tool less powerful.**
> Offer **RESULT → ADJUST → ADVANCED**, never TECHNICAL OPERATION × 3 → RESULT.

The plan keeps Ceriga's document data and every working capability, and rebuilds the UI, the flows and the weak tools around a single shared engine. It follows the visual language already established in the Builder: white, quiet, 13 px type, no boxed cards, quiet selection rings, chips for choices, one floating bar per canvas.

---

## What the 14 reference videos show (and what Ceriga takes from them)

| # | What happens in the video | Capability it points to | Ceriga outcome |
|---|---|---|---|
| 1 | Textured, stippled strokes drawn in colour; then **every existing stroke is restyled at once** (stipple → chalk → outline → hairline) | Brush style is a property of the stroke, not baked pixels | **Restyle strokes** — change the brush of any drawn stroke after drawing |
| 2 | A brush draws **inflated 3D tubes** with light angle, shading dots, caps, taper | Volumetric / "puff" stroke rendering with a light model | **Inflate** brush family + Puff production preview |
| 3 | "Moss" type generator (type filled with organic texture), **bitmap/dither** photo tool, **colourwork** knit-grid repeat | Texture-filled type, 1-bit image treatments, pixel-grid patterns | Texture fill on text, Bitmap styles, **Knit grid** pattern |
| 4 | Painting a character with **raised, puffy paint** on a gradient | Raised ink look | Puff / raised-ink preview on brush strokes |
| 5 | ASCII art, gradient-map, **scanline/glitch** image treatments with live sliders | Live, previewable image styles | Image Styles gallery with real thumbnails |
| 6 | Wordmark → stretched, then **spiky zig-zag distortion**, chrome finish | Edge distortion effects on live type | Distort → **Spike / Zig-zag / Roughen** |
| 7 | "BEND": half of each letter sheared to create a **bent wordmark** | Partial-region transform of type | **Bend part of text** (drag a region handle) |
| 8 | Letters scattered, then **Blend with 60 steps** to make 3-D trails | Blend / interpolation between two states | **Trail / Echo / Blend** result tool |
| 9 | Overlapping letters made legible with **Trim + Offset path** (interlocking knock-out) | Overlap with automatic gap | **Interlock** text outcome |
| 10 | "OHIO": bottom of letters stretched into **perspective flares** (beginner vs pro) | Extrude toward a vanishing point | **Flare / Extrude** with a draggable vanishing point |
| 11 | Gradient map + **slice-and-shift glitch** + film-burn texture overlay poster | Slice displacement, gradient maps, texture overlays with blend | **Slice shift** effect, gradient map, Overlay system |
| 12 | Modular **grid lettering** where circles merge (metaball) with corner/spacing sliders | Generative, parametric lettering | **Grid lettering** generator (Phase 6) |
| 13 | Type → blur → **threshold** → ink-bleed grunge letterform, warped, placed on a tee | Blur + threshold "melt"; warp; garment mock | **Ink bleed** effect, free warp, live garment preview |
| 14 | Illustrator **live corners**: round / concave / chamfer each corner by dragging | Per-corner parametric editing on canvas | **Live corners** on every rectangle-family shape |

They are references for *capability level*, not a checklist and not a UI to copy.

---

## 1. Complete audit of the existing Artwork system

### 1.1 Where Artwork lives today

| Area | Main files | Notes |
|---|---|---|
| Core editor (engine + canvas) | `PrintStudioEditor.tsx` (≈250 K chars), `PrintsDrawLayer.tsx`, `printsStudio/*` (≈70 files) | One huge component; renders, hit-tests, transforms, edits text/paths, effects |
| Garment Artwork section | `shell/PrintDesignStudio.tsx`, `UnifiedArtworkTools.tsx`, `ArtworkCanvasTools.tsx` | 7-category rail + vertical canvas tool rail |
| Inspectors | `StudioObjectPanel`, `SharedArtworkObjectPanel`, `ArtworkObjectControls`, `TypographyStudio`, `TextShapeControls`, `TextEffectsPanel`, `PathWorkflowControls`, `ShapePropertiesPanel`, `ShapeAdvancedEditor`, `ImageFiltersPanel`, `ImageTraceControls`, `PatternControls`, `WearTextureStudio`, `ArtworkPrintMethod`… | ≈20 panels, overlapping |
| Floating toolbars | `InlineElementToolbar` (65 K), `PrintStudioElementToolbar` (74 K), `ArtworkQuickActions`, `ArtworkSelectionTools`, `SelectionTransformControls`, shape "Duplicate/Delete" bar | **Two near-identical** floating toolbars + 3 smaller ones |
| Asset Workspace | `AssetWorkspace.tsx`, `useAssetWorkspace.ts`, `DesignAssetSurface.tsx` | Separate layout inside the Builder (second nav + second tool rail) |
| Labels | `SurfaceArtworkEditor` (uses the engine) **and** legacy `LabelArtworkEditor` / `LabelArtwork` | Partly shared |
| Packaging | `PackagingStudio` → `SurfaceArtworkEditor` **and** legacy `PackagingDesigner` / `PackagingArtwork` | Partly shared |
| Legacy builder step | `PrintsDesignStep.tsx` (101 K) + `InlineElementToolbar` | Parallel older editor |
| Engine libraries | `polygon-clipping`, `clipper-lib`, `opentype.js`, `fontkit`, `perfect-freehand`, `simplify-js`, `imagetracerjs`, `d3-contour`, `svgpath`, `html-to-image` | Strong base; warps are **raster** (via html-to-image) |
| Workers | `imageFilter.worker`, `imageTrace.worker`, `textEffects.worker` | Good foundation for performance |

### 1.2 The object model (`DesignElement`) — already rich

Types: `image · text · drawing · shape · pattern · distress · customArea · group`.

Already stored per object: position/size/rotation/flip/opacity/lock/hide · print method · colour slots · artwork finish · appearance stack (fills/strokes) · **variable-font axes & OpenType features** · per-glyph transforms · kerning pairs · tracking/leading/word spacing · H/V scale · baseline · case · underline/strike · text on path · text shape modes (arc / warp / path / badge / stack) · vector text warps (arc, arch, bulge, flag, wave, rise, perspective) · 40+ text effects · shape parameters, fill/stroke, cap/join/align, dashed/dotted/double · boolean operation + sources (non-destructive) · clip to artwork / region · image crop, filters, adjustments · logo trace, image trace · recorded drawing strokes (re-renderable) · erase contours · pattern repeat (grid/brick/half-drop/mirror/random) with spacing, rotation, offsets, seed, colours, garment target · custom areas · perspective quad · warp settings · wear/distress marks.

**Conclusion:** the data model is mostly sound and largely non-destructive. The weaknesses are in organisation, discoverability, previews, duplication and a few engine gaps, not in the stored data.

### 1.3 Feature-by-feature audit and decision

Legend: **KEEP · IMPROVE · REBUILD · MERGE · MOVE · REMOVE DUPLICATE · MOVE TO ADVANCED · REPLACE (better workflow)**

#### Navigation & layout
| Feature | Today | Decision |
|---|---|---|
| 7 categories (Shapes & paths, Typography, Sketch, Import & trace, Artwork library, Patterns & repeats, Finishes & texture) + "Open workspace" | Mixed nouns; "Finishes & texture" mixes print finish, wear painting and hem distressing | **REBUILD** → 7 clear creation categories (see §4) |
| Vertical canvas tool rail (Hand, Select, Points, Pen, Pencil, Shape, Type, Eraser, Mirror, Pick, Colour, Undo, Redo) | 13 items; Undo/Redo duplicate the top bar; Colour duplicates inspector; Mirror is a tool option | **IMPROVE**: keep 8 tools; **REMOVE DUPLICATE** undo/redo/colour; **MOVE** Mirror → tool options |
| Bottom canvas bar (Front/Back, zoom, Artwork view) | Good base | **KEEP**, extend with state-specific tools |
| Right inspector | Opens with **Production method** before the object's own controls; long forms | **REBUILD** as Quick / Adjust / Advanced (see §6) |
| Layers ("Layers 0 · Front" at panel foot) | Hidden behind a row, opens as a drawer | **IMPROVE** (see §14) |

#### Selection & transforms
| Feature | Today | Decision |
|---|---|---|
| Floating toolbar near object | Text selection shows **nothing near the object**; two different toolbars exist in code | **REBUILD** one context toolbar per object type |
| `InlineElementToolbar` vs `PrintStudioElementToolbar` | Same controls twice (font, size, colour, B/I/U, align, case, effects, crop, size & rotation, duplicate, delete) | **MERGE** into one |
| Position & size | In 4 places (inline toolbar, StudioObjectPanel, ArtworkObjectControls, SelectionTransformControls) | **REMOVE DUPLICATE** → Inspector "Arrange" (one place) + on-canvas handles |
| Selection visuals in the engine | Old red frame + red rotate circle (the new gallery states only reached Details & trims) | **REPLACE** with the gallery states (hover/selected/resizing/rotating/locked) everywhere |
| Multi-select (Combine & arrange, align, layer order) | In a collapsible "Combine & arrange" panel | **MOVE** to the context toolbar for multi-select |
| Garment-aware placement | Not available as one-click actions | **NEW** (see §5, §16) |

#### Shapes & paths
| Feature | Today | Decision |
|---|---|---|
| 10 "Essentials" + 5 more families (Lines & curves, Labels & tags, Sport & varsity, Frames & callouts, Symbols & badges) | Boxed cards; static shapes; few parametric | **REBUILD** the library around fashion use (see §8) |
| Ellipse parameters (full/arc/pie/inverted pie/crescent) | Exists in `shapeGeometry` but hidden | **IMPROVE**: expose as on-canvas handles |
| Live corners (`LiveCornerHandle`) | Exists for some shapes | **IMPROVE**: every rectangle-family shape, per-corner round / concave / chamfer (video 14) |
| Boolean (Unite / Minus front / Intersect / Exclude / Divide), non-destructive | Technical names | **REPLACE** labels: Merge · Cut out · Punch hole · Overlap · Divide; technical names in Advanced |
| Pen (`PenPathDraft`), Points (`ShapePathEditor`), Pencil (`ShapePencilDraft`) | Capable but technical | **IMPROVE** + add Bend/Straighten/Smooth/Sharpen/Round/Open/Close/Cut/Join/Mirror/Simplify actions |
| Path workflow (Edit with pen, Simplify detail, Offset path, Copy outline) | Buried in a panel | **MOVE** to path context toolbar + Adjust |
| "Add Star" | Clicking Add did not place a star in the audit run | **Bug to verify in Phase 0** |

#### Typography
| Feature | Today | Decision |
|---|---|---|
| Add text (textarea + Add button) | Indirect | **REPLACE**: click Type tool or "Add text" places editable text on the garment with the cursor active |
| 7 style starters (Collegiate, Stencil, Script, Statement, Editorial, Essential, Athletic) | Good idea, few, plain | **REBUILD** as editable **Recipes** (§9) |
| Font picker, size in cm, B/I, align, case, tracking | In inspector + toolbar + TypographyStudio (3×) | **MERGE** |
| Text shape (Arc / Warp preset / Path / Badge / Stack) | Exists, technical, raster warps | **IMPROVE** into "Shape" gallery with real previews; vector warps (§9) |
| Variable axes / OpenType / per-glyph | In the model, barely exposed | **MOVE TO ADVANCED** + glyph handles on canvas |
| Text effects (40+) in `TextEffectsPanel` | Long list with category select | **REBUILD** as an Effects gallery shared by all objects (§12) |
| Convert (live text → outlines) | Exists | **KEEP** in Advanced, clearly marked destructive |

#### Drawing
| Feature | Today | Decision |
|---|---|---|
| 60+ brushes (pencil → embroidery) + 49 textures | Large, but presented as 8 "Ink & pencil" items + a hidden settings drawer | **REBUILD** presentation: families with real stroke previews (§10) |
| Brush settings (size, spacing, scatter, stabilisation, taper, pressure, tilt, grain…) | All in one drawer | **SPLIT** Quick (size, colour, opacity, smoothness) / Advanced |
| Strokes stored as recorded drawings | Re-renderable | **KEEP** — enables **Restyle stroke** (video 1) |
| Symmetry ("Dual drawing / Symmetry", "Mirror new artwork") | Duplicated in two places | **MERGE** into tool options |
| Eraser | Works on vectors via erase contours | **KEEP** |

#### Import & trace
| Feature | Today | Decision |
|---|---|---|
| Upload (PNG/JPG/WebP/SVG), Your artwork, collection | Basic | **REBUILD** as Upload → Clean → Style → Trace/Keep → Edit (§11) |
| ~40 image filters (B&W, duotone, threshold, halftone, posterise, photocopy, glitch, thermal…) | Good engine, weak previews | **IMPROVE**: thumbnail gallery rendered from the user's image |
| Background removal, colour extraction (light/dark ink) | Exists | **KEEP**, surface earlier |
| Image trace + logo trace (regions, palette) | Exists in workers | **IMPROVE**: modes Logo / Line art / Detailed / Silhouette / Colour + refine |
| Crop (`CropEditor`) | Exists | **KEEP**, add aspect presets & shape crops |

#### Patterns & repeats
| Feature | Today | Decision |
|---|---|---|
| 49 pattern styles in 6 groups | Big image tiles | **KEEP** content, **IMPROVE** browsing |
| Repeat types grid / brick / half-drop / mirror / random | Sliders only | **IMPROVE**: on-canvas tile handles; add radial, wave, along-path, rotated |
| Custom repeat from artwork | Exists | **IMPROVE**: "Make a repeat" from any selection |
| Garment targets / continuous across seams / seam check | Exists | **KEEP**; add fashion placements (§13) |

#### Finishes, wear & production
| Feature | Today | Decision |
|---|---|---|
| Print method chooser (DTG, DTF, Screen, Embroidery, Puff, Heat transfer) | Leads the inspector; big cards | **MOVE** to a compact "Production" row + production panel |
| Artwork finish (embroidery thread, patch size, glitter…) | In ArtworkObjectControls | **MERGE** into Production |
| Wear painting (Holes / Abrasion / Rips) + Hem distressing | In "Finishes & texture" | **MOVE** to Construction → Wash & Finish (it's garment wear, not artwork) |
| Production checks (font size, logo checks, colour count) | Partial | **IMPROVE** into live guidance (§12.5) |

#### Library & reuse
| Feature | Today | Decision |
|---|---|---|
| Artwork library (My artwork, Save selection to library, Examples) | Thin | **REBUILD** as Library: My assets · Recipes · Brand kit · Ceriga examples |
| Print studies / reference studies | Separate pages | **MERGE** into Library → Examples |

#### Asset Workspace, Labels, Packaging
| Feature | Today | Decision |
|---|---|---|
| Asset Workspace | Second left nav + second tool rail inside the Builder | **REBUILD** as the full-screen Artwork Studio (§15) |
| Label artwork | Engine-based editor + a legacy editor | **MERGE** onto the shared engine (§16) |
| Packaging artwork | Engine-based studio + legacy designer | **MERGE** onto the shared engine |
| Legacy `PrintsDesignStep` + `InlineElementToolbar` | Parallel old editor | **REMOVE** once the new studio covers its flows (behind the redesign flag) |

#### Keyboard
Today: V select, A direct, P pen, T type, plus others in the editor (h, c, n, m, l, d, o, j, g), arrows, Enter/Escape/Delete. **IMPROVE**: one documented shortcut map (§6.5), shown in tooltips, consistent across contexts.

---

## 2. Capability map

Classification: **A** = can improve now with the existing engine · **B** = small engine extension · **C** = major engine feature · **D** = future / experimental.

### Shapes & paths
| Capability | Class |
|---|---|
| Fashion shape library (badges, crests, ribbons, plates, streetwear, decorative) as parametric generators | **A/B** (geometry functions in `shapeGeometry`) |
| On-canvas parameter handles (star points, inner radius, ellipse arc, badge point depth, ribbon tail) | **B** |
| Live corners: round / concave / chamfer / per corner | **A** (handle exists) → **B** for concave & chamfer |
| Merge · Cut out · Punch hole · Overlap · Divide with previews | **A** (`polygon-clipping`, non-destructive sources exist) |
| Offset path, outline stroke | **A** (`clipper-lib`) |
| Simplify Light/Medium/Strong | **A** (`simplify-js`) |
| Smooth / Sharpen / Round corners on paths | **B** |
| Join / Split / Cut at point / Open / Close / Delete segment | **A/B** (`artworkPathCommands`) |
| Symmetry while drawing paths | **B** |
| Vector reshape brushes (push, pull, pinch, bloat, twist, smooth) | **C** |
| Blend / Trail / Echo between shapes | **B** (point resampling + interpolation) |

### Typography
| Capability | Class |
|---|---|
| All type properties incl. variable axes and OpenType | **A** (model + fontkit) |
| Text recipes (Varsity, Racing, Y2K…) | **A** (recipes = saved property bundles) |
| Arc, Arch, Circle, Rise, Flag, Wave, Bulge, Perspective as **vector** warps | **B** (outline with opentype → map points through warp function → still re-editable since source text is kept) |
| Squeeze, Inflate, Fisheye, Twist, Fan, Stretch, Compress | **B** (more warp functions) |
| Text on path incl. Follow neckline / hem / sleeve / pocket | **A** (textPath exists) + **B** (garment edge paths as sources) |
| Interlock, Echo/Trail, Stack, Offset, Long shadow, Extrude | **A/B** (outlines + boolean + offsets) |
| Bend part of text (video 7) | **B** (region-limited warp) |
| Flare / extrude to vanishing point (video 10) | **B** |
| Grid lettering generator (video 12) | **D** |

### Drawing
| Capability | Class |
|---|---|
| Visual brush families with real stroke previews | **A** (renderer exists; render thumbnails) |
| Restyle existing strokes (video 1) | **A** (strokes are recorded) |
| Pressure / tilt / taper / stabilisation | **A** (exist) |
| Inflate / puff tube brush with light angle (video 2/4) | **B** (shaded stroke renderer; offset bands + gradient) |
| Stitch / embroidery guide brushes | **A** (exist) — **IMPROVE** previews |
| Stroke → editable path ("Make shape from stroke") | **A** (`sketchVector`) |

### Image & filters
| Capability | Class |
|---|---|
| Live thumbnail gallery of styles from the user's image | **A** (workers exist) |
| Levels, exposure, threshold, colour reduction | **A/B** |
| Halftone, dither (ordered/error-diffusion), bitmap, ASCII | **A/B** |
| Gradient map / duotone / tritone | **A** |
| Trace modes + refine (smooth, corners, colours, min area) | **A** (imagetracerjs + d3-contour) |
| Background removal (on-device) | **B** (current is colour-key; ML model would be **C**) |

### Effects & textures
| Capability | Class |
|---|---|
| Effect stack shared by text, shapes, images, drawings | **B** (unify `textEffects` + `vectorEffects` + `shapeEffects`) |
| Outline / double / triple / inline | **A** |
| Shadow, long shadow, block depth, offset copy, stack, echo | **A/B** |
| Distort: wave, bulge, squeeze, fisheye, twist, perspective, spike/zig-zag/roughen (video 6) | **B** (vector), raster fallback **A** |
| Print/wear: faded, cracked, chipped, halftone, ink spread, misregistration | **A** (exist as raster) |
| Slice shift / glitch (video 11) | **B** |
| Ink bleed (blur + threshold, video 13) | **B** (vector via contour of blurred field: d3-contour) |
| Overlay/texture system: clip, blend, intensity, scale, rotate, invert, reseed | **B** |
| Production previews (puff, emboss, foil, metallic, reflective, rubberised) | **A/B** (honest preview labels) |

### Patterns & placement
| Capability | Class |
|---|---|
| Repeat types + on-canvas tile handles | **B** |
| Radial, wave, along path, rotated, scattered | **B** |
| Fashion placements (left chest, centre front, upper back, sleeve, wrap sleeve, along hem, around collar, AOP) | **A** (garment print areas exist) |
| Mirror to opposite sleeve / front→back | **A** |
| Knit/colourwork grid pattern (video 3) | **B** |

### Layers, masks, colour
| Capability | Class |
|---|---|
| Layers: visibility, lock, rename, reorder, group, duplicate, thumbnails | **A** |
| Clip inside shape / image inside text / texture clipped to text | **A** (clip fields exist) |
| Inverse mask | **B** |
| Gradients (linear, radial, angle, multi-stop) on shapes and text | **A/B** (text has gradient effect) |
| Document / garment / recent / brand colours | **A** |
| Pantone references | **A** (library exists) |
| Mesh gradients | **D** |

### Workspace & engine
| Capability | Class |
|---|---|
| Workspace state machine (Browse / Create / Select / Direct / Multi / Effect / Pattern / Focus) | **A** |
| Single context toolbar + Quick/Adjust/Advanced inspector | **A** |
| Full-screen Asset Workspace with artboards | **B** |
| Labels & Packaging on the same engine | **B** |
| Split the 250 K editor into engine modules | **C** (required for performance & maintainability) |
| True vector envelope / mesh warp for any object | **C** |
| AI assists (generate texture, suggest recipes) | **D** |

---

## 3. Missing-capability research (what modern tools make easy)

Studied patterns from professional vector/illustration tools, newer browser design tools, merch-focused editors, drawing apps and generative type tools. Copying UI is out of scope; these are the **workflow lessons**:

1. **Live parameters beat menus.** Modern tools expose a shape's parameters as on-canvas handles (corner widgets, star points, arc ends). Users discover by dragging. → On-canvas handles for every parametric shape and warp.
2. **Appearance stacks keep everything editable.** Multiple fills/strokes/effects on one object, reorderable, without outlining. Ceriga already has `textAppearance`/`artworkAppearance`. → One shared appearance + effect stack for all objects.
3. **Results-first galleries.** Merch editors win beginners with "text effect" galleries rendered on the user's own word. → Every effect, warp, recipe and filter thumbnail is rendered from the selected object.
4. **Non-destructive booleans and blends.** Compound shapes keep their sources; blends stay live. → Ceriga already keeps boolean sources; extend to blends, echoes and interlocks.
5. **Context toolbars near the object.** Newer tools show 5–7 actions next to the selection and push the rest to the inspector. → One context toolbar per object type.
6. **Brush engines store intent, not pixels.** Recorded strokes can be restyled. → Restyle stroke.
7. **Image-to-vector as a guided pipeline.** Clean → threshold → trace → refine, with before/after. → Upload → Clean → Style → Trace/Keep → Edit.
8. **Pattern editors work on the tile.** Edit one tile, see the repeat live, drag spacing/offset on canvas. → Pattern Edit state.
9. **Domain-aware placement.** Merch tools ship print-area presets; Ceriga can go further because it knows the garment geometry (neckline, hem, sleeves, seams). → Garment-aware actions are Ceriga's advantage.
10. **Production guardrails as hints, not blocks.** Minimum line weight, small text, colour count, resolution. → Live, inline guidance per method.

Capabilities found that Ceriga lacks and should add (each has a clear clothing purpose):
- **Recolour artwork** (map every colour in a selection to garment/brand palette in one step) — essential for colourways.
- **Colour separations preview** for screen print (show each ink plate).
- **Knock-out to garment** ("let the garment show through" — white becomes fabric) — common in screen print/streetwear.
- **Stroke to embroidery guide** (satin/fill direction preview) — honest preview only.
- **Arch/curve text around a badge** in one step (badge text exists — expose it).
- **Distress mask** that is reseedable and adjustable, not baked.
- **Make a repeat** from any selection.
- **Brand kit** (logos, colours, fonts) reused across garments, labels and packaging.
- **Mirror to opposite sleeve / front→back** placement.
- **Snap to garment landmarks** (centre front, chest line, sleeve centreline).

---

## 4. Proposed new Artwork architecture

### 4.1 One engine, four contexts

```
                ┌───────────────── Ceriga Artwork Engine ─────────────────┐
                │ Document (objects, layers, history, assets, recipes)     │
                │ Geometry (paths, booleans, offsets, warps, outlines)     │
                │ Renderers (vector SVG, raster workers, previews/cache)   │
                │ Interaction (tools, selection, handles, snapping)        │
                │ UI kit (context toolbar, inspector sections, galleries)  │
                └───────────────┬───────────────┬───────────────┬─────────┘
           Garment context  Asset context   Label context   Packaging context
           print areas,     free artboards  label size,     panels, dielines,
           landmarks,       no garment      sewing margins, print-safe areas
           production       constraints     fold lines
```

Contexts supply **bounds, safe zones, snapping landmarks, placement presets and production rules**. Everything else (drawing, text, shapes, paths, effects, layers, transforms) is identical.

### 4.2 Workspace states

| State | Trigger | What the UI shows |
|---|---|---|
| **BROWSE** | Nothing selected, no tool | Left: categories. Inspector: category content (galleries). Bar: view + zoom |
| **CREATE** | A tool is active (pen, brush, shape, type) | Tool-options strip above the bar; inspector shows the tool's choices; context toolbar hidden |
| **SELECT** | One object selected | Context toolbar near the object; inspector Quick/Adjust/Advanced for that type |
| **DIRECT EDIT** | Double-click / Enter on text, points, crop, shape params | Only that editing affordance + "Done"; everything else dims; Escape exits |
| **MULTI-SELECT** | 2+ objects | Context toolbar: Group · Align · Distribute · Combine; inspector: Arrange |
| **EFFECT EDIT** | Effect chosen/adjusted | Live effect handles on canvas (e.g. shadow angle, extrude vanishing point); inspector shows that effect only |
| **PATTERN EDIT** | Pattern selected / "Edit repeat" | Tile frame on canvas with spacing/offset/rotation handles; inspector shows repeat controls |
| **FOCUS** | `F` or button | Hide rail and inspector; keep bar + context toolbar |

Irrelevant controls are never shown in the wrong state.

### 4.3 Where things live (frequency rule)

| Location | Holds | Never holds |
|---|---|---|
| **1. Left area navigation** (Builder rail, Artwork tools) | Creation categories: **Text · Shapes · Draw · Images · Library · Patterns · Effects** + **Open Studio**. Production is cross-cutting, so it is *not* a category: it is a persistent contextual Production row/panel plus a Production preview mode (see R2) | Object properties |
| **2. Canvas toolbar** (vertical, beside canvas) | Tools: Select V · Edit points A · Pen P · Brush B · Shape S · Text T · Eraser E · Eyedropper I · Hand H/Space | Undo/redo (top bar), colour (context), mirror (tool option) |
| **3. Context toolbar** (floats above the selection) | The 5–7 most frequent actions for that object type + "⋯" | Long forms, numbers |
| **4. Bottom bar** (existing island) | View · zoom · guides · state tools (Close-up, Clean view…) · **tool-options strip above it while a tool is active** | Object properties |
| **5. Right inspector** | Quick / Adjust / Advanced for the selection; galleries in Browse | Duplicate actions that already sit on canvas |
| **6. Popovers** | Font picker, colour, effect gallery, warp gallery, shape gallery, placement presets | Settings that need to stay visible |
| **7. Advanced** | Booleans by name, numeric path data, OpenType, effect stack order, transform matrix, export | Anything a beginner needs to finish a design |

---

## 5. Tool-by-tool redesign

Each tool: purpose → beginner flow → professional depth → location.

### Select (V)
Click, shift-click, marquee, double-click to Direct Edit. Gallery selection states (thin frame, square corners, pill sides, rotate dot on a stalk, live size chip "Logo · 9 × 9 cm", rotation chip "12°", locked badge). **Snapping**: garment centre lines, chest line, print-area edges, other objects, equal spacing — shown as thin lines with distance chips. Alt-drag duplicates. Shift constrains.

### Edit points (A)
Points become 8 px white squares (corner) / circles (smooth) with handles; segment hover shows a midpoint to add a point. Point actions in the context toolbar: **Smooth · Corner · Delete · Split · Join**; path actions: **Bend · Straighten · Simplify (Light/Medium/Strong) · Open/Close · Mirror · Symmetry**. Numeric x/y in Advanced.

### Pen (P)
Click = corner, drag = smooth, Alt = break handle, close by clicking start, Enter finishes, Escape cancels. Tool options: **Fill / Stroke**, **Symmetry (off / vertical / horizontal / radial n)**, **Smooth as I go**. Clear rubber-band preview.

### Brush (B)
Tool options strip: family picker (real stroke preview), size, colour, opacity, smoothness. ⋯ opens Advanced brush (pressure, tilt, taper, spacing, texture, flow, stabilisation, velocity). Strokes stay restylable. **Make shape from stroke** in context toolbar.

### Shape (S)
Tool options: last-used shape + shape gallery popover. Drag to draw; hold Shift for proportion; **every shape has live handles** (see §8). One-click shapes from the inspector still work (drag from gallery onto the garment).

### Text (T)
Click on the garment → text appears with cursor at a readable default (contrast-aware colour against the garment). Context toolbar: **Font · Size · Colour · Shape · Effects · Recipe**. Double-click = edit text in place. Glyph handles in Advanced.

### Eraser (E)
Vector-aware erase (existing contours) with size; option **Erase whole stroke** vs **Erase area**.

### Eyedropper (I)
Picks colour from artwork, garment or image; Alt applies to stroke. Shows the picked colour chip with hex.

### Hand (H / Space)
Pan; Space-drag from any tool.

### Removed / moved from the tool rail
Undo/Redo (top bar), Colour swatch (context toolbar), Mirror (tool option: Symmetry), separate Pencil (becomes a Brush family "Pencil").

---

## 6. Inspector architecture

### 6.1 Structure (same for every object type)

```
[ Object header ]  thumbnail · name (editable) · visibility · lock · ⋯
QUICK      the 3–6 controls that finish 80 % of designs (visual)
ADJUST     relevant fine controls, collapsed by default per section
ADVANCED   professional technical properties (one collapsed group)
PRODUCTION one row: method chip + live warnings count → opens Production
```

Production moves **below** the object's own controls (today it leads the panel).

### 6.2 Per type

| Type | QUICK | ADJUST | ADVANCED |
|---|---|---|---|
| **Text** | Text field · Font · Size (cm) · Colour · Shape (gallery) · Recipe | Spacing (tracking, leading, word), alignment, case, effects stack | Kerning pairs, baseline, H/V scale, variable axes, OpenType, glyph transforms, convert to outlines |
| **Shape** | Shape parameters (visual) · Fill · Stroke | Corners, stroke style/cap/join/align, effects | Boolean by name, numeric path, fill rule |
| **Path** | Fill · Stroke · Smooth | Simplify, offset, open/close, dash | Point coordinates, handle lengths |
| **Drawing** | Brush family · Size · Colour | Smoothness, opacity, texture | Pressure/tilt curves, spacing, flow, stabilisation |
| **Image** | Style (gallery) · Crop · Remove background · Trace | Exposure, contrast, levels, threshold, colours | Resolution, colour profile notes, DPI at size |
| **Pattern** | Pattern · Colours · Scale · Placement | Repeat type, spacing, rotation, offset, randomness | Tile size (cm), seam continuity, seed |
| **Group / Multi** | Group · Align · Distribute · Combine | Arrange, spacing | Transform numerics |

### 6.3 Arrange (one place, all objects)
x · y · width · height (cm) · rotation · flip · lock ratio · opacity · **garment placement** (Centre front, Left chest, Upper back, Sleeve…) · align to print area · keep in safe zone.

### 6.4 Visual language
Same as the rest of the Builder: 13 px body, 14 px section titles, grey labels, ink values, chips with faint fill, quiet tiles (drawing on white + ring when selected), hairline dividers, no boxed cards.

### 6.5 Shortcuts (one map, shown in tooltips)
V select · A edit points · P pen · B brush · S shape · T text · E eraser · I eyedropper · H hand (Space temporary) · F focus · ⌘/Ctrl G group · ⇧⌘G ungroup · ⌘D duplicate · ⌘[ ⌘] order · ⌘; guides · Arrows nudge (⇧ ×10) · Enter = edit / finish · Escape = cancel temporary operation / exit edit / deselect.

---

## 7. Floating / context toolbar architecture

One component, configured per state. Max 7 visible actions + ⋯. Positioned above the selection; flips below near the top; never covers handles; avoids the bottom bar.

| Selection | Actions |
|---|---|
| **Text** | Edit · Font ▾ · Size · Colour · **Shape** ▾ (warp gallery) · **Effects** ▾ · ⋯ (Recipe, Duplicate, Mirror, Delete) |
| **Shape** | Edit shape · Fill · Stroke · Corners · Effects ▾ · ⋯ |
| **Path** | Points · Smooth ▾ · Stroke · Fill · Effects ▾ · ⋯ (Simplify, Offset, Open/Close) |
| **Drawing** | Brush ▾ (restyle) · Colour · Smooth · Make shape · ⋯ |
| **Image** | Crop · Style ▾ · Remove background · Trace · Recolour · ⋯ |
| **Pattern** | Edit repeat · Colours · Scale · Placement ▾ · ⋯ |
| **Group** | Ungroup · Align ▾ · Effects ▾ · ⋯ |
| **Multi-select** | Group · Align ▾ · Distribute ▾ · **Combine** ▾ (Merge / Cut out / Punch hole / Overlap / Divide) · Blend · ⋯ |
| **Direct edit** | Context-specific + **Done** |

The ⋯ menu always contains: Duplicate · Mirror to opposite side · Bring forward/back · Lock · Hide · Save to library · Delete.

Bottom bar additions per state: **Close-up** (zoom to selection), **Clean view** (hide garment texture), **Print area** (show safe zones), **Production preview** toggle.

---

## 8. Shape & path architecture

### 8.1 Parametric shape generators
Every library shape is a **generator** (`kind + params → path`), stored as `shapeParameters`, re-generated on change, and convertible to a plain path ("Edit as path", Advanced). Handles are declared by the generator.

| Family | Shapes | Parameters (with on-canvas handles) |
|---|---|---|
| **Basic** | Rectangle, rounded rectangle, circle, ellipse, triangle, diamond, polygon, star, burst, cross, arrow, line | Rectangle: w, h, radius, **per-corner radius**, **concave**, **chamfer**, edge bend, skew · Ellipse: open, arc start/end, pie, crescent, **ring thickness** · Star: points, inner/outer radius, rotation, roundness · Burst: rays, depth, jitter · Arrow: head size, shaft width, curve |
| **Badges** | Shield, crest, seal, medallion, varsity badge, patch, arch badge, ticket, notched badge | width, height, point depth, border, inset, curvature, notch count/size |
| **Ribbons** | Straight, curved, folded, swallowtail, wrapped, scroll, medal ribbon | width, bend, tail length, fold depth, tail cut |
| **Logo builders** | Monogram frame, circular mark (ring + text slots), shield layout, crest structure, racing plate, sports emblem, stamp | Composite generators with named text slots that accept live text |
| **Streetwear** | Caution tape, warning label, utility tab, barcode block, industrial plate, product-code block, sticker outline (offset of any selection), patch shape | stripe angle/width, code text, plate bolts, sticker offset |
| **Decorative** | Flames, tribal, lightning, thorns, barbed wire, stars, wings, clouds, drips, blobs, waves, sparks | count, length, randomness (reseedable), thickness |

Shapes that are not useful for clothing are dropped from the default library (still available under "All").

### 8.2 Combine (beginner) / Boolean (advanced)
Multi-select → **Combine**: **Merge · Cut out · Punch hole · Overlap · Divide**, each with a live preview thumbnail of the user's shapes. Advanced shows Union · Subtract · Intersect · Exclude · Divide. Result keeps sources (already supported) — "Release" restores them.

### 8.3 Path actions
Bend (drag a segment) · Straighten · Smooth (Light/Medium/Strong) · Sharpen · Round corners (radius) · Open · Close · Cut (scissors at a point) · Join (two endpoints) · Mirror · Symmetry (live) · Simplify (Light/Medium/Strong) · Offset · Outline stroke. Professional: convert point, independent handles, delete segment, numeric points.

### 8.4 Reshape brushes (C)
Push · Pull · Pinch · Bloat · Twist · Smooth · Inflate/Deflate as a vector "Reshape" tool on outlines — Phase C, behind Advanced, with resample-and-simplify to keep paths clean.

### 8.5 Blend / Trail / Echo
Select two objects (or one + direction) → **Blend** with steps and spacing (video 8); **Echo** = n offset copies with fade/scale; **Trail** = copies along a drag path. Live and editable (stored as an operation over sources).

---

## 9. Typography architecture

### 9.1 Live text first
Text stays live through every operation possible: warps, effects, path text, recipes, repeats. Outlines are generated **for rendering** from the live text (opentype.js), not stored as the source. "Convert to shapes" stays available and is marked destructive.

### 9.2 Properties
Font (with search, categories, recently used, brand fonts, upload) · weight · size (cm and pt) · tracking · kerning (metrics/optical/manual pairs) · leading · word spacing · alignment · case · baseline · H/V scale · rotation · underline/strike · variable axes (sliders appear only when the font has them) · OpenType features (ligatures, alternates, small caps, numerals — shown as toggles with previews).

### 9.3 Shape gallery (vector warps)
Gallery thumbnails rendered from the user's text:
Arc · Arch · Circle · Wave · Flag · Rise · Bulge · Squeeze · Inflate · Fisheye · Twist · Perspective · Bend · Fan · Stretch · Compress · Custom path.
Each warp has an on-canvas handle (e.g. bend amount = drag the top midpoint). Implementation (B): outline glyphs → resample → map points through warp function → render vector; cache per (text, font, warp, params).

### 9.4 Text on path
Draw path · Use existing path · **Follow neckline · Follow hem · Follow sleeve · Follow pocket · Follow custom garment edge**. Controls: offset, flip, start, end, alignment, spacing. Garment paths come from the garment context.

### 9.5 Creative outcomes (one click, editable)
Interlock (overlap with automatic gap, video 9) · Overlap · Trail · Echo · Stack · Connect · Split · Offset · Extrude / Flare to vanishing point (video 10) · Long shadow · Bend part (video 7).

### 9.6 Recipes (editable starting points)
Varsity · College · Racing · Motorsport · Luxury serif · Y2K · Chrome · Bubble · Retro · Vintage · Streetwear · Athletic · Techwear · Distressed · Photocopy · Stacked · Outlined · Inflated.
A recipe = font + spacing + case + appearance stack + effects + optional warp. Applying it shows the result on the user's word; everything stays editable; users can save their own recipes to the Library / Brand kit.

---

## 10. Brush & drawing architecture

### 10.1 Top level (what a beginner sees)
Brush families as **real stroke previews** in a strip: Pen · Marker · Ink · Dry ink · Brush pen · Pencil · Charcoal · Chalk · Paint · Spray · Airbrush · Texture · Grain · Distress · Rough · **Inflate** · Stitch · Embroidery guide · Calligraphy. Then size, colour, opacity, smoothness.

### 10.2 Advanced
Pressure curve · tilt · taper (start/end) · spacing · texture (49 existing) · flow · dynamics (jitter size/angle/scatter) · stabilisation · velocity response · symmetry.

### 10.3 Engine
- Strokes stay **recorded** (points + pressure + time). Rendering is a function of (stroke, brush). → **Restyle stroke** and **Restyle all strokes in layer** (video 1).
- Vector brushes use perfect-freehand outlines; textured brushes render to cached tiles in a worker.
- **Inflate** family (B): offset bands + light-angle shading → convincing raised/puff look (videos 2, 4).
- "Make shape from stroke" converts to an editable path (existing `sketchVector`).

---

## 11. Image & filter architecture

Pipeline (each step skippable, always reversible):

**UPLOAD** → **CLEAN** → **STYLE** → **TRACE or KEEP BITMAP** → **EDIT**

| Step | Controls |
|---|---|
| Clean | Crop (free / aspect / shape), remove background (colour-key now; on-device ML later), exposure, contrast, levels, threshold, colour reduction |
| Style (gallery from the user's image) | Halftone · Bitmap · Dither · Photocopy · Duotone · Posterise · Stencil · Grain · Noise · Line art · Silhouette · Screen-print look · Gradient map · ASCII (video 5) · Slice shift (video 11) |
| Trace | Logo · Line art · Detailed · Silhouette · Colour (n colours) → refine: smoothness, corner sharpness, min area, colour merge |
| Edit | Traced result is a normal path group; recolour, simplify, effects, production |

Filters keep running in workers; thumbnails rendered at low resolution first then refined (progressive preview).

---

## 12. Effects & texture architecture

### 12.1 One effect stack for every object type
Merge `textEffects`, `vectorEffects`, `shapeEffects` and image adjustments into one ordered, toggleable **effect stack** (non-destructive, reorderable in Advanced).

### 12.2 Effect gallery (thumbnails of the real effect on the selection)
| Group | Effects |
|---|---|
| **Outline** | Outline · Double · Triple · Inline · Outer + inner |
| **Depth** | Shadow · Long shadow · Block depth · Extrusion · Offset copy · Stack · Echo |
| **Distort** | Bend · Wave · Bulge · Squeeze · Fisheye · Twist · Perspective · Inflate · **Spike / Zig-zag / Roughen** (video 6) · **Slice shift** (video 11) · **Ink bleed** (video 13) |
| **Print / wear** | Faded · Cracked · Chipped · Distressed · Halftone · Weathered · Rough ink · Ink spread · Misregistration |
| **Graphic** | Threshold · Dither · Grain · Photocopy · Posterise · Duotone · Noise · Blur · Sharpen |
| **Fill** | Solid · Gradient (linear / radial / angle, multi-stop) · Texture fill · Image fill (image inside text) |

### 12.3 Production preview (separate and labelled)
Puff · Emboss · Deboss · Foil · Metallic · Reflective · Glossy · Matte · Rubberised · Embroidery stitch direction. These are **previews of the production method**, shown with a "Preview" tag and tied to the Production method — never presented as design effects.

### 12.4 Overlay / texture system
Overlays (grain, paper, dust, scratches, ink wear, paint, spray, fabric, noise, photocopy, distress) attach to an object or group: intensity · scale · rotate · invert · **clip to artwork** · blend mode · **reseed**. Stored as parameters, never flattened.

### 12.5 Production guidance (live, non-blocking)
| Method | Live checks |
|---|---|
| Screen print | Colour count, minimum line/detail, separations preview, knock-out to garment |
| Embroidery | Minimum stroke, small-text warning, density preview, fill/satin direction |
| DTG / DTF | Resolution at printed size, transparent/semi-transparent pixels, printable area |
| Puff | Minimum area, fine-detail limits |
| Heat transfer | Minimum cut width, weeding complexity |
Shown as a count on the Production row; details open on click; quick fixes offered ("Thicken thin lines", "Reduce to 4 colours").

---

## 13. Pattern & repeat architecture

### 13.1 Repeat types (visual outcomes)
Grid · Half drop · Brick · Mirror · Radial · Scattered · Rotated · Wave · Along path · **Knit grid** (video 3).

### 13.2 Fashion placements
Across chest · Across back · Down sleeve · Around sleeve · Around collar · Along hem · Side panel · Full garment · All-over print (continuous across seams, existing seam check).

### 13.3 Pattern Edit state
Selecting a pattern + "Edit repeat" shows the **tile frame** on canvas: drag to change spacing, corner to scale, rotate handle, offset handle, count stepper for radial/along-path. Inspector: colours, randomness (reseed), tile size in cm.

### 13.4 Make a repeat
Any selection → **Make a repeat** → choose type → place. The repeat references the source artwork (edit source → repeat updates).

---

## 14. Layer architecture

- Lives as a **slim panel** docked at the inspector foot (today's "Layers" row) that expands upward; in the Studio it is a left column under the categories.
- Rows: thumbnail (real render) · name (double-click rename) · visibility · lock · production method dot.
- Drag to reorder; drop on a row to group; ⌘G / ⇧⌘G.
- Clip/mask: drag an object onto a shape's row with ⌥ or use "Clip inside" in the ⋯ menu. **Inverse mask** in Advanced (B).
- Front / Back / Sleeve tabs follow the garment view.
- Never dominates the workspace; collapsible at any time.

### Masks made easy
Clip artwork inside shape · Image inside text · Texture clipped to text · Mask · Inverse mask — each one a single action from the context ⋯ menu, with the result shown immediately.

### Colour
Quick: document colours · garment colours · recent · brand colours. Advanced: HEX · RGB · CMYK (print reference) · Pantone (where available). Gradients: linear · radial · angle · multi-stop with on-canvas gradient handles. **Recolour artwork** maps all colours in a selection at once. Mesh gradient: D.

---

## 15. Asset Workspace redesign — "Ceriga Artwork Studio"

The fullest version of Artwork, independent of any garment.

```
┌ compact header: ← Back to garment · asset name · artboard size · Save asset · Insert on garment ┐
│ slim creative nav │            large artboard (real workspace)            │ precise inspector  │
│  Text             │                                                        │  Quick/Adjust/Adv  │
│  Shapes           │        context toolbar floats over selection          │                    │
│  Draw             │                                                        │                    │
│  Images           │                                                        │                    │
│  Library          │                                                        │                    │
│  Patterns         │                                                        │                    │
│  ─ Layers ─       │  ┌ tool-options strip (when a tool is active) ┐       │                    │
│                   │  └ bottom bar: zoom · guides · grid · focus  ┘       │                    │
└───────────────────┴────────────────────────────────────────────────────────┴────────────────────┘
        vertical canvas tool rail sits on the artboard's left edge
```

- **Full screen**: replaces the Builder chrome while open (no second nav inside the first).
- Artboards: square, A-sizes, label sizes, patch sizes, custom; multiple artboards per asset (e.g. logo + monogram + wordmark).
- Background: transparent checker / light / dark / garment colour.
- Assets saved to the Library: logos · graphics · patterns · text treatments · badges · illustrations · effect stacks · recipes.
- **Insert on garment** places it with garment-aware presets (§16).

---

## 16. Shared engine strategy (garment · assets · labels · packaging)

| Shared (engine) | Context-specific |
|---|---|
| Document model, history, autosave, persistence | Bounds and safe zones |
| Tools, selection, handles, snapping | Snapping landmarks (garment centre, chest line; label fold lines; packaging panel edges) |
| Text, shapes, paths, brushes, images, patterns | Placement presets (garment: Left chest…; label: Centre / Top band…; packaging: Front panel…) |
| Effect stack, overlays, colour | Production rules (garment: methods; labels: woven/printed limits; packaging: print-safe, bleed) |
| Context toolbar, inspector kit, galleries | Extra panels (label sewing, packaging dielines) |

Migration path: `SurfaceArtworkEditor` already wraps the engine for labels and packaging; the legacy `LabelArtworkEditor`, `PackagingDesigner/Artwork` and `PrintsDesignStep` are retired once parity is confirmed (redesign flag on). Existing saved documents load through the existing `surfaceMigration` path.

### Garment-aware actions (Ceriga's advantage)
Place as left-chest logo · Centre front · Centre upper back · Full front · Full back · Down sleeve · Wrap sleeve · Follow neckline · Follow hem · Repeat down sleeve · Mirror to opposite sleeve · Mirror front to back · Scale to print area · Keep inside safe zone · Align to neckline · Align to hem · Maximum printable width. Exposed in Arrange (inspector) and in the context ⋯ menu as **Place on garment ▸**.

---

## 17. Beginner → professional (progressive disclosure)

| Layer | Beginner sees | Professional reaches |
|---|---|---|
| Choice | Visual galleries (shapes, recipes, effects, warps, brushes, styles) rendered from their own work | Same galleries + search + favourites |
| Manipulation | On-canvas handles with chips (size in cm, degrees) | Exact numbers in Arrange; shortcuts |
| Language | Merge · Cut out · Punch hole · Bend text · Smooth · Trail | Union / Subtract · Envelope warp parameters · Bézier handles |
| Panels | QUICK open, ADJUST collapsed | ADVANCED group, effect stack order, OpenType, compound paths |
| Safety | Undo everything, Escape cancels, non-destructive defaults | Explicit destructive actions (Convert, Flatten) clearly marked |

Same objects, same canvas, same engine — nothing is "simple mode".

---

## 18. Performance risks and mitigations

| Risk | Where | Mitigation |
|---|---|---|
| 250 K-char `PrintStudioEditor` re-renders on every change | Engine | Split into modules (document store, renderers, interaction, UI); selector-based subscriptions; memoised object renderers keyed by object version |
| Drag latency | Transforms | Transform via CSS/SVG `transform` during pointer-move (compositor), commit on pointer-up; no layout reads in the move loop |
| Raster warps via `html-to-image` | `WarpedArtwork` | Replace with vector warps (outline + point mapping), cached; raster fallback only for bitmaps |
| Effect previews (blur, threshold, halftone) | Text/image effects | Workers + OffscreenCanvas; low-res preview while dragging sliders, full-res after 150 ms idle |
| Gallery thumbnails of the user's object | Effects/warps/recipes/filters | Render lazily in a worker, cache by (object version, effect id); skeleton then fade-in |
| Large patterns / AOP | Patterns | Render one tile to an image pattern; SVG `<pattern>` for repeat; recompute only on tile change |
| Brush texture rendering | Drawing | Tile cache per (brush, texture, size); render strokes incrementally |
| Font loading | Typography | Preload recipe fonts; subset previews; fontkit parse once per font |
| Boolean/offset on complex paths | Geometry | Run in a worker for > N points; simplify inputs; keep previous result while computing |
| History growth | Undo | Structural sharing; coalesce continuous drags into one history step |

Budgets: pointer-to-paint < 16 ms while dragging; slider preview < 50 ms; gallery thumbnail first paint < 300 ms.

---

## 19. Implementation phases

Each phase ships behind the existing `?builder=redesign` flag, keeps saved projects loading, and integrates with undo/redo, history and autosave from day one.

| Phase | Scope | Class |
|---|---|---|
| **0 · Foundations** | **Start modularising `PrintStudioEditor`** (new `artwork-engine/` modules for state, geometry, interaction, rendering, preview, inspector — new code goes there, never into the monolith); workspace state model; **one context toolbar** (merge the two toolbars); inspector Quick/Adjust/Advanced shell; Production moved below object controls as a persistent row; gallery selection states in the engine; canvas tool rail cleanup (remove undo/redo/colour/mirror duplicates); contrast-aware default text colour; shortcut map + tooltips; fix "Add Star" if confirmed; **early multi-object actions** (align, distribute, equal spacing, align to garment / print area, duplicate / repeat, smart spacing) | A |
| **1 · Shapes & paths** | Parametric generator framework + on-canvas handles; live corners (round/concave/chamfer); new fashion shape library (Basic, Badges, Ribbons, Streetwear, Decorative; Logo builders after); Combine (Merge/Cut out/Punch hole/Overlap/Divide) with previews; path actions (Bend, Smooth L/M/S, Simplify, Open/Close, Join/Cut, Mirror, Offset) | A → B |
| **2 · Typography** | Live-text property set; font picker refresh; recipes (18); **vector warp engine** (Arc…Custom path) with handles; text on garment paths (neckline, hem, sleeve, pocket); outcomes (Interlock, Echo, Trail, Stack, Offset, Long shadow, Flare, Bend part) | A → B |
| **3 · Effects, overlays, production** | Unified effect stack + gallery with real thumbnails; overlay/texture system; production previews (labelled); live production guidance + quick fixes; recolour artwork; screen-print separations; knock-out to garment | A → B |
| **4 · Images & trace** | Upload → Clean → Style → Trace/Keep → Edit; style gallery (incl. ASCII, slice shift, gradient map); trace modes + refine | A → B |
| **5 · Drawing** | Brush family strip with real previews; Quick/Advanced brush settings; restyle stroke(s); Inflate brush; make shape from stroke; symmetry | A → B |
| **6 · Patterns & placement** | Pattern Edit state with tile handles; new repeat types; fashion placements; make a repeat; garment-aware placement actions; mirror to opposite sleeve / front→back | A → B |
| **7 · Studio & shared engine** | Full-screen Artwork Studio with **one excellent artboard first** (multiple artboards follow and must not block the release); Library (assets, recipes, brand kit, symbols); labels & packaging fully on the engine; retire legacy editors | B |
| **8 · Engine work** | Finish the modularisation that began in Phase 0 (by now the monolith only hosts legacy paths); vector envelope/mesh warp for any object; reshape brushes; inverse masks | C |
| **Later** | Grid lettering generator (video 12); on-device ML background removal; mesh gradients; AI assists | D |

Order inside every phase: **A items first, then B**, with the architecture leaving clean extension points for C.

---

## 20. Visual QA & testing plan

| Layer | How |
|---|---|
| **State coverage** | Playwright scripts drive every workspace state (Browse, Create per tool, Select per type, Direct edit per type, Multi, Effect edit, Pattern edit, Focus) on all 4 presets + Asset Studio + Labels + Packaging; contact sheets reviewed each phase (as done for Fit/Materials/Construction) |
| **Typography & sizing audit** | The existing type audit script (only 10/12/13/14/17 px allowed) runs on every Artwork panel |
| **Pipelines (end-to-end)** | Text → Bend → Outline → Distress → Repeat down sleeve · Shape → Edit geometry → Gradient → Texture → Pattern · Upload logo → Trace → Recolour → Distress → Screen-print prep · Path → Brush → Inflate → Repeat. Each asserts the result is still editable at every step |
| **Non-destructive checks** | After each pipeline: change the source text/shape and assert every downstream result updates |
| **Persistence** | Save → reload → identical render (SVG diff); load a set of existing saved projects (fixtures) and confirm no data loss |
| **Undo / redo / Escape** | Every new operation: one history step per gesture; Escape cancels temporary operations; redo restores exactly |
| **Geometry unit tests** | Generators (shape params → path), booleans, offsets, warps (point mapping invariants), simplify levels |
| **Performance** | Scripted drags/slider moves with `performance.mark`; fail the run if pointer-to-paint > 16 ms p95 or slider preview > 50 ms p95 |
| **Visual regression** | Screenshot diffs of selection states, galleries and context toolbars at 1440 and 1920 widths |
| **Accessibility** | Keyboard reachability of every tool and action, focus rings, aria labels, reduced motion |
| **Production honesty** | Production previews always carry a "Preview" label; checks verified against method rules |

---

## Appendix A — Immediate issues found during the audit (fix in Phase 0)

1. Selecting text shows **no actions near the object**; the panel opens with Production method first.
2. Default text colour is black on a near-black garment (unreadable).
3. The engine still draws the **old red selection** (new gallery states only in Details & trims).
4. Drawn strokes get a separate "Shape actions" bar in the bottom-right corner (a third toolbar).
5. "Add Star" did not place a star during the scripted run (verify).
6. Asset Workspace nests a second navigation and a second tool rail inside the Builder.
7. Undo/redo appear in both the top bar and the canvas tool rail.
8. Wear painting (holes, abrasion, rips) and hem distressing live under Artwork but are garment wash/wear.

## Appendix B — Visual direction for Artwork

Premium, quiet, precise — the same feel as the rest of the Builder:
- White canvas, garment free-standing; Asset Studio artboard is the only framed surface.
- Tool icons: 1.5 px line icons, one family, 18 px, label under icon only in the tool rail.
- Galleries render **the user's own object** (their word, their shape, their image) — never generic samples.
- Selection & handles: the gallery states (thin frame, 8 px squares, pills, rotate dot on a stalk, size/degree chips).
- Context toolbar: white island, 36 px tall, 13 px labels, icon + word for the first actions.
- Inspector: 13/14 px, grey labels, ink values, chips with faint fill, quiet tiles, hairlines — no nested form-card UI.
- **"No boxed cards" ≠ no visual tiles.** Galleries for shapes, brushes, effects, recipes, filters and patterns use quiet visual tiles (the preview on white, faint hover wash, ring when chosen). What is avoided is wrapping forms and settings in nested cards.
- Red only for the primary action and errors; warnings in amber text, not banners.
- Motion: ≤ 200 ms ease-out for popovers and handles; none on high-frequency drags; respects reduced motion.

---

## R. Approved revisions (20 Nov 2026) — binding rules for every phase

| # | Rule |
|---|---|
| **R1 · Modularise from Phase 0** | `PrintStudioEditor` is broken up incrementally starting in Phase 0. New code lives in `src/app/components/builder/artwork-engine/` split by responsibility — **state** (document store, selection, workspace state), **geometry** (generators, booleans, offsets, warps), **interaction** (tools, handles, snapping), **rendering** (object renderers), **preview** (thumbnails, workers, caches), **inspector** (Quick/Adjust/Advanced sections). Every phase moves at least one responsibility out; **no new feature may grow the monolith**. |
| **R2 · Production is cross-cutting** | Left categories: **Text · Shapes · Draw · Images · Library · Patterns · Effects**. Production is a persistent contextual row (method chip + warnings) on every selection, a Production panel, and a **Production preview** mode in the bottom bar. |
| **R3 · Tiles are good, nested forms are not** | Galleries (shapes, brushes, effects, recipes, filters, patterns) use quiet visual tiles. Avoid cards wrapping settings/forms. |
| **R4 · One shared Appearance system** | Every supported object type has one ordered, toggleable stack: **Fill(s) · Stroke(s) · Effects · Overlays · Opacity / blend mode · Masks**. Reorderable (drag in Adjust/Advanced), each item can be hidden, duplicated, removed. Saved as an **Appearance style** that can be reused (see C-review). Replaces today's separate `textAppearance`, `artworkAppearance`, `textEffects`, `shapeEffects`, `vectorEffects` (migrated, not dropped). |
| **R5 · Typography invariant (hard)** | Warps, recipes, outlines, shadows, trails, interlocks, echoes and text-on-path **always keep the editable source text** (string, font, size, spacing). Rendering derives geometry from the source each time (cached). Only an explicit **Convert to shapes** produces non-editable outlines, and it is labelled destructive with undo. |
| **R6 · Multi-object actions early** | Phase 0 ships: align (6 ways), distribute (H/V), **equal spacing** (drag-to-even with spacing chip), **align to garment** (centre front, chest line, centre back, sleeve centre), **align to print area**, duplicate / **repeat** (n copies with offset), **smart spacing** hints while dragging. |
| **R7 · Transform origin / pivot** | Advanced → Arrange: pivot point (9-point picker + draggable pivot on canvas with Alt). Used by rotate, scale, flip, effects (radial echo, long shadow origin) and repeats (radial centre). |
| **R8 · Source-linked generation (core rule)** | Booleans, blends, repeats, trails, echoes, interlocks, offsets, outlines-for-render, symbols and patterns **reference editable source objects**; editing a source updates the result. "Release" restores sources; "Flatten" is explicit and destructive. Stored as `{operation, params, sourceIds}`. |
| **R9 · Brush engine types** | Internally distinguish **vector stroke** (perfect-freehand outline → editable, scalable), **textured stroke** (vector spine + cached texture tiles; restylable), **raster brush** (pixel paint on a bitmap layer; resolution-bound), **production-preview stroke** (embroidery/stitch/puff preview — renders a preview, exports the underlying vector). Each declares editability, scalability and cost so the UI can be honest ("Raster — resize may soften"). |
| **R10 · Search / Recent / Favourites everywhere** | Fonts, shapes, brushes, effects, recipes, patterns, assets: one shared library-browser component with search, Recent, Favourites (★), and categories. |
| **R11 · Focus mode escape path** | Focus hides rail and inspector but always keeps: current tool, context toolbar, zoom, undo/redo, and an **Exit focus** button (plus F / Escape). |
| **R12 · Asset Studio artboards** | First release: one excellent artboard (sizes, background, guides, grid, rulers). Multiple artboards follow; they must not block the first release. |

---

## C. From-scratch capability review (beyond the videos and the current code)

Question asked: *If Ceriga Artwork were designed from scratch today as a complete fashion-focused creative editor, what would it need?* Reviewed across vector editors, illustration tools, merch/apparel editors, typography tools, drawing apps, photo/bitmap editors, pattern tools, logo builders and print-production workflows.

Legend — **Today**: ✓ exists · ◐ partial · ✗ missing. **Class**: A/B/C/D as in §2. **Where**: primary location. **Phase**: when.

### C.1 Vector & shape construction
| Capability | Why it matters for clothing | Today | Class | Where | Phase |
|---|---|---|---|---|---|
| **Shape builder** (drag across overlapping regions to merge, Alt-drag to delete) | Fastest way to build badges, crests, letter knockouts | ✗ | B | Multi-select context → Combine ▸ Shape builder (Direct edit state) | 1 |
| **Live compound shapes** (non-destructive booleans, editable sources) | Logos stay editable for colourways | ◐ (boolean sources kept) | A | Combine | 1 |
| **Path offset / inset / outset** | Sticker outlines, patch borders, embroidery underlay, screen-print choke/spread | ◐ (offset path) | A | Path context + Effects ▸ Outline | 1 |
| **Outline / expand stroke** | Required before cutting vinyl / embroidery digitising | ✗ | A | Path ⋯ → Expand stroke (source-linked) | 1 |
| **Variable-width strokes** (width points on a path) | Brush-like logos, calligraphic marks that stay vector | ✗ | B | Direct edit (width handles) | 5 |
| **Stroke profiles** (taper, bulge, custom) | Hand-drawn feel on vectors | ◐ (taper on brushes) | B | Stroke popover | 5 |
| **Dash controls** (dash, gap, offset, round caps, align to corners) | Stitch lines, tape graphics, cut lines | ◐ (dashed/dotted) | A | Stroke popover | 1 |
| **Live mirror / symmetry** (vertical, horizontal, radial n) | Crests, emblems, mandalas, wings | ◐ (drawing mirror) | B | Tool options + object ⋯ (live mirror group) | 1 |
| **Reusable symbols / linked instances** | Same logo on chest, sleeve, label, packaging — edit once | ✗ | B | Library ▸ Symbols; instance context: Edit master / Detach | 7 (model in 1) |
| **Linked duplicates** (instances inside one design) | Repeating elements in badges, borders | ✗ | B | ⋯ → Duplicate linked | 1 |
| **Reshape brushes** (push/pull/pinch/bloat/twist) | Organic lettering, melt effects | ✗ | C | Advanced tool | 8 |

### C.2 Appearance, styles & colour
| Capability | Why | Today | Class | Where | Phase |
|---|---|---|---|---|---|
| **Object-level effect stacks** + **effect reordering** | Predictable, layered looks | ◐ (text only, fixed order) | B | Appearance (R4) | 3 |
| **Appearance styles** (save & apply a whole stack) | One click consistency across a collection | ✗ | A | Appearance header → Save style; Library ▸ Styles | 3 |
| **Object styles** (appearance + text + transform defaults) | House styles for brands | ✗ | B | Library ▸ Styles | 7 |
| **Blend modes** (multiply, screen, overlay, darken, lighten, difference…) | Overlays, ink-on-fabric realism, posters (video 11) | ✗ | A (SVG/CSS mix-blend) | Appearance ▸ Opacity / blend | 3 |
| **Clipping & masking** (clip in shape, image in text, texture in text, inverse mask, alpha mask) | AOP inside type, photo-fill logos | ◐ (clip exists) | A/B | ⋯ → Clip inside / Mask; Layers drag | 3 |
| **Gradient handles on object** (drag start/end, add stops on canvas) | Y2K, chrome, sunset gradients | ◐ (gradient effect, no handles) | B | Effect edit state | 3 |
| **Spot colours** (named inks, Pantone, ink count) | Screen print & embroidery thread matching | ◐ (Pantone refs) | A | Colour popover ▸ Spot | 3 |
| **Colour harmonies / palette generation** (from garment colour, image, brand) | Fast colourways that work on the garment | ✗ | A | Colour popover ▸ Suggest | 3 |
| **Recolour artwork** (map all colours at once) | Colourways in seconds | ◐ (colour slots) | A | Image/Group context → Recolour | 3 |
| **Multi-object property editing** | Change font/colour/stroke of many objects at once | ✗ | A | Inspector shows shared props for multi-select | 0 |

### C.3 Layout, precision & placement
| Capability | Why | Today | Class | Where | Phase |
|---|---|---|---|---|---|
| **Smart guides & equal-spacing hints** | Professional alignment without numbers | ◐ (alignment guides) | A | Canvas while dragging | 0 |
| **Snap priorities** (garment landmarks > print area > objects > grid; toggle per source) | Predictable snapping on complex garments | ✗ | A | Bottom bar ▸ Snapping popover | 0 |
| **Transform pivot / origin** | Precise rotations, radial repeats | ✗ | A | Advanced ▸ Arrange (R7) | 0 |
| **Rulers, guides, grid** (cm) | Physical sizing on garments | ◐ | A | Bottom bar | 0/7 |
| **Graded artwork per garment size** (scale rule per size: fixed / proportional / custom) | Real production: chest print width differs per size | ✗ | B | Production panel ▸ Size grading | 6 |
| **Variable data** (names, numbers, sizes for team/sports jerseys) | Sports & merch personalisation | ✗ | B | Text ⋯ → Make variable; Order step links data | 6 |

### C.4 Drawing & bitmap
| Capability | Why | Today | Class | Where | Phase |
|---|---|---|---|---|---|
| **Custom brush creation & saving** (from a shape/texture/stroke; tweak dynamics; save to Library) | Signature marks, brand textures | ◐ ("Save Pen brush") | B | Brush Advanced → Save brush | 5 |
| **Brush → path** (stroke to editable outline) | Hand-drawn logos to production vector | ✓ (sketchVector) | A | Drawing context → Make shape | 5 |
| **Path → brush** (apply a brush to any path) | Brush-styled typography and shapes | ✗ | B | Path stroke popover → Brush | 5 |
| **Raster → vector** (trace) | Logos from photos/sketches | ✓ | A | Images pipeline | 4 |
| **Vector → raster** (rasterise with DPI, for textures/filters) | Some effects need pixels | ◐ | A | ⋯ → Rasterise (destructive, labelled) | 4 |
| **Image masks inside text / shapes** | Photo-fill wordmarks | ◐ | A | Clip (C.2) | 3 |
| **Bitmap layers with paint & erase** | Grunge, hand texture | ◐ (raster brushes) | B | Draw (R9 raster brush) | 5 |

### C.5 Libraries, reuse & versions
| Capability | Why | Today | Class | Where | Phase |
|---|---|---|---|---|---|
| **Reusable templates** (layouts with slots: varsity chest, back print, pocket logo + sleeve hit) | Fast start for beginners, consistent for brands | ◐ (print studies) | A | Library ▸ Templates | 7 |
| **Variants / alternate versions** (A/B artwork per design, colourway variants) | Compare options, keep alternatives | ✗ | B | Object/Group ⋯ → Variants; compare on garment | 6 |
| **Brand kit** (logos, colours, fonts, styles) | One source of truth across garments, labels, packaging | ✗ | A | Library ▸ Brand kit | 7 |
| **Search / Recent / Favourites** | Big libraries stay fast | ◐ | A | All libraries (R10) | 0 → all |
| **Asset version history** | Safe experimentation | ◐ (project history) | B | Studio header | 7 |

### C.6 Production
| Capability | Why | Today | Class | Where | Phase |
|---|---|---|---|---|---|
| **Production separations** (per-ink plates, underbase for dark garments, halftone LPI/angle) | Screen print reality | ✗ | B | Production panel ▸ Separations preview | 3 |
| **Choke / spread (trapping)** | Registration tolerance on screen print | ✗ | B | Production ▸ Screen options | 3 |
| **Preflight checks** (min line, min text, colour count, DPI at size, transparency, out-of-print-area, font licence/outline status) | Prevent costly mistakes before tech pack | ◐ (some checks) | A | Production row warnings + Review | 3 |
| **Embroidery preview** (stitch direction, density, min detail) | Honest expectation for thread | ◐ | B | Production preview | 3 |
| **Export & production validation** (SVG/PDF vector, PNG at DPI, per-ink files, tech-pack inclusion, embroidery hand-off file list) | Manufacturer-ready output | ◐ (downloadProductionArtwork, tech pack) | B | Review & Export | 3/7 |
| **Garment-realistic preview** (fabric texture, folds, ink on fabric) | Confidence before ordering | ◐ (print texture, wear) | B | Production preview mode | 3 |

### C.7 Explicitly considered and deferred
Mesh gradients (D), 3D extrusion with lighting (C — fake depth via Effects ▸ Depth is enough for most garment graphics), generative AI imagery (D, licensing risk), automatic embroidery digitising to machine files (D, specialist software), on-device ML background removal (C/D).

### C.8 What changes in the plan because of this review
- Phase 0 gains: multi-object property editing, smart guides + equal spacing, snap priorities, pivot.
- Phase 1 gains: shape builder, outline/expand stroke, dash controls, live symmetry groups, linked duplicates (symbol model).
- Phase 3 gains: blend modes, gradient handles, spot colours, harmonies, separations, choke/spread, preflight.
- Phase 5 gains: variable-width strokes, stroke profiles, custom brushes, path → brush.
- Phase 6 gains: graded artwork per size, variable data, variants.
- Phase 7 gains: symbols library, templates, brand kit, object styles.

---

## A. Adobe parity map (Illustrator + Photoshop)

Adobe Illustrator and Photoshop define the professional standard. Ceriga matches the **capability**, keeps its own quieter UI, and adds a results-first path on top (RESULT → ADJUST → ADVANCED). Nothing here copies Adobe's interface.

### A.1 Illustrator
| Illustrator capability | Ceriga equivalent (beginner path → pro path) | Today | Phase |
|---|---|---|---|
| Selection & Direct Selection, Group Selection | Select (V) · Edit points (A) · double-click to enter groups | ✓ | 0 |
| Smart Guides, Align panel (key object, align to artboard), Distribute spacing | Smart guides + equal-spacing chips · context bar Align / Space evenly / Align to print area · key object in Advanced | ◐ (bar done) | 0 |
| Transform panel, reference point, Transform Each | Arrange section (x, y, w, h, rotate, pivot) · Transform each in Advanced | ◐ | 0 |
| Pen, Curvature tool, Anchor add/delete/convert, Join, Scissors, Knife | Pen (P) + Bend segment · point actions in context bar | ◐ | 1 |
| Live Shapes & Live Corners (round / inverted / chamfer) | Parametric shapes + live corners on canvas | ◐ | 1 |
| Shape Builder | Shape builder (drag across regions) | ✗ | 1 |
| Pathfinder (Unite, Minus Front, Intersect, Exclude, Divide, Trim, Merge, Crop, Outline) | Merge · Cut out · Punch hole · Overlap · Divide → Advanced names, live compound sources | ◐ | 1 |
| Offset Path, Outline Stroke, Simplify, Smooth | Offset / inset / outset · Expand stroke · Simplify L/M/S · Smooth L/M/S | ◐ | 1 |
| Width tool, variable-width profiles, Stroke panel (dash, caps, arrowheads) | Width handles on paths · stroke profiles · dash controls | ◐ | 1 / 5 |
| Blend tool (steps, spine), Replace spine | Blend / Trail / Echo, along path | ✗ | 1 |
| Envelope Distort, Warp effects, Puppet Warp, Free Distort | Text & object Shape gallery (vector warps) · free distort · bend part | ◐ (raster) | 2 / 8 |
| Repeat (Radial, Grid, Mirror) | Repeats + live symmetry | ◐ | 1 / 6 |
| Appearance panel (multiple fills/strokes/effects), Graphic Styles | Shared Appearance stack (R4) · Appearance styles | ◐ | 3 |
| Effects (Distort & Transform, Stylize, Pathfinder effects, 3D & Materials) | Effects gallery (outline, depth, distort, print/wear) · fake depth via Depth effects | ◐ | 3 |
| Type tool, Type on a Path, Area type, Touch Type | Text on path incl. garment edges · per-glyph handles | ◐ | 2 |
| Character / Paragraph / OpenType panels, variable fonts, Character & Paragraph Styles | Text Quick/Adjust/Advanced · text styles / recipes | ◐ | 2 |
| Create Outlines | Convert to shapes (explicit, destructive, labelled) — never required for effects (R5) | ✓ | 2 |
| Image Trace (presets, palette, paths/corners/noise) | Images → Trace (Logo / Line art / Detailed / Silhouette / Colour) + refine | ◐ | 4 |
| Recolor Artwork, Global swatches, Pantone books, Color Guide harmonies | Recolour artwork · document/garment/brand colours · spot colours · harmonies | ◐ | 3 |
| Clipping masks, Opacity masks, Draw Inside | Clip inside / image inside text / mask / inverse mask | ◐ | 3 |
| Symbols, Libraries | Symbols (linked instances) · Library · Brand kit | ✗ | 1 (model) / 7 |
| Artboards, Rulers, Guides, Grids, Pixel preview | Asset Studio artboard(s) · rulers / guides / grid in cm | ◐ | 7 |
| Brushes (Calligraphic, Scatter, Art, Pattern, Bristle), Blob Brush, Shaper | Brush families (vector / textured / raster / production preview, R9) · path → brush · custom brushes | ◐ | 5 |
| Pattern Options (tile types, overlap, copies) | Pattern Edit state with tile handles | ◐ | 6 |
| Separations Preview, Overprint Preview, Document Raster Effects | Separations preview · underbase · choke/spread · DPI checks | ✗ | 3 |
| Mockup (artwork on product) | Native: artwork is always on the real garment, plus production preview | ✓ | 3 |
| Retype / Generative Recolor (AI) | Considered later (D) | ✗ | Later |

### A.2 Photoshop
| Photoshop capability | Ceriga equivalent | Today | Phase |
|---|---|---|---|
| Layers, groups, Smart Objects | Layers + groups; source-linked results (R8) behave like smart objects | ◐ | 0 / 3 |
| Layer Styles (stroke, shadows, glow, bevel, overlays) | Appearance stack effects | ◐ | 3 |
| Adjustment layers (levels, curves, hue/sat, gradient map, threshold, posterize) | Image Clean + Style steps, non-destructive | ◐ | 4 |
| Blend modes | Appearance ▸ Opacity / blend | ✗ | 3 |
| Layer & vector masks, clipping masks | Masks (C.2) | ◐ | 3 |
| Filter Gallery, Halftone / Color Halftone, Noise, Blur, Displace | Image Style gallery + Print/wear effects (halftone, grain, ink bleed, slice shift) | ◐ | 3 / 4 |
| Warp, Puppet Warp, Liquify | Free warp · reshape brushes | ✗ | 8 |
| Select Subject / Remove Background | Remove background (colour key → on-device model later) | ◐ | 4 |
| Content-Aware Fill | Not needed for garment artwork | — | — |
| Brush engine (dynamics, textures, smoothing) | Brush engine Advanced (pressure, tilt, texture, flow, stabilisation) | ✓ | 5 |
| Gradient tool, gradient maps | Gradient handles on object · gradient map style | ◐ | 3 / 4 |

### A.3 Where Ceriga goes further than Adobe (fashion-specific)
Garment-aware placement (left chest, wrap sleeve, follow neckline/hem), print-area safe zones, production methods with live preflight, graded artwork per size, variable data for team jerseys, colourways across a collection, and the same editor for garment, labels and packaging.

---

## B. Bottom bar as a contextual creative strip (user direction, 20 Nov 2026)

Inspired by the TypingMind drawing reference: the most-used *creative choices* sit in the floating bottom bar as visual previews, one tap away, and the inspector keeps precise controls. Ease of use is the primary goal.

| State | Bottom strip shows (visual, one tap) | Behaviour |
|---|---|---|
| Draw (brush active) | Brush stroke previews · 8–10 colour dots + picker · 3 sizes · undo | Tapping a brush with strokes selected **restyles** them (R9 recorded strokes) |
| Text tool / text selected | Font/recipe previews of the user's word · colour dots | Tap applies to the selection, live |
| Shape tool | Shape icons (current family) · fill/stroke colour dots | Tap places or swaps the shape |
| Any selection | Quick colour dots (document + garment + recent) | One tap recolours |
| Pattern edit | Repeat type icons · scale steps | Live repeat |
Rules: max one row; previews are real renders; the inspector never duplicates the strip's quick choices as its primary control (it holds exact values); research other tools' palettes/tool-option bars when each phase builds its strip.

**Driving rule:** the strip's content is chosen by what the user is doing right now — the active tool (Create state) or the selected object's type (Select / Multi-select / Pattern edit), via the engine's `deriveWorkspaceState`. It never shows options for a tool or object that isn't in use.


---

## D. Asset Studio — a canvas of its own (user direction, 21 Nov 2026)

The Asset Workspace becomes **Ceriga Asset Studio**: the fullest version of Artwork, also reachable **outside the Builder** (its own route from the dashboard / library), producing reusable assets (logos, wordmarks, badges, patterns, lettering, graphics) that drop onto garments, labels and packaging. It is deliberately *more* than the garment canvas: it is a drawing-and-lettering workspace with scaffolding, references and assists. References studied: Procreate (Drawing Guides, Assisted Drawing, Reference companion, StreamLine), Adobe Illustrator (rulers/guides, rectangular grid → guides, envelope warp, smart guides, snap to point), Adobe Fresco (vector brushes with smoothing, perspective/graph grids). Capabilities are adopted; their UI is not.

### D.1 Drawing guides (non-destructive overlays; "Assisted" snaps strokes to them)
| Guide | What it's for in clothing artwork | Controls | Class |
|---|---|---|---|
| 2D grid | Layout, wordmarks, consistent letter heights | Size (mm), subdivisions, opacity, colour | A |
| Isometric grid | Iso logos, 3D blocks, slanted lettering at a fixed angle | Angle, size | A |
| Perspective (1–3 vanishing points) | Depth type (video 10 "OHIO" flares), street signage, scenes | Drag vanishing points on canvas; horizon line | B |
| Symmetry: vertical · horizontal · quadrant · radial (n) | Crests, badges, wings, mandalas, flourishes | Axis position, segments (radial), rotational vs mirror | B (draw) / A (shapes) |
| Lettering guide sets | Hand lettering: baseline, x-height, cap height, ascender, descender, slant lines | Heights in mm or %, slant angle, line count | A |
| Layout skeletons | Arch, wave, banner, circle, ribbon, perspective ribbon frames to letter inside (the "grid builder stamp" idea, built in) | Tap to place, handles to bend; sits on a low-opacity guide layer | B |
"Assisted drawing" toggle: pencil/brush/pen strokes snap to the active guide (grid lines, perspective rays, symmetry). Guides never print or export.

### D.2 Reference companion
| Feature | Purpose | Class |
|---|---|---|
| Floating reference window (image, resizable, pinnable, opacity) | Keep a photo/sketch beside the canvas without adding it to the design; eyedropper samples from it | A |
| Canvas overview (live mini-map) | See overall composition while zoomed into details; click to navigate | A |
| **Garment preview companion** (Ceriga's equivalent of FacePaint preview) | Live preview of the asset on the chosen garment/placement while you draw it — the reason to design in Ceriga | B |
| Trace reference on canvas (locked, low opacity, excluded from export) | Trace a sketch into clean lettering/vectors | A (exists as tracing reference) |

### D.3 Lettering & precision aids
Rulers (cm/mm) with drag-out guides · make guides from any shape/path (Illustrator's "make guides") · rectangular grid tool that converts to guides · snap to point, to 45°/custom angle, to guide intersections · smart guides (Phase 0 work reused) · StreamLine / stabilisation per brush (exists in brush engine) · envelope/warp layout: type placeholder text, warp it into a layout (arch, wave, flag, badge), lock at low opacity and letter over it (uses Phase 2 vector warps) · vector brushes with smoothing that export as clean paths.

### D.4 Workspace
Compact header (asset name, artboard size, Save to library, Use on garment) · slim category nav · large artboard (background: transparent / light / dark / garment colour) · tool rail · context toolbar · contextual creative strip (§B) · precise inspector · layers column · guides/grid/reference/overview toggles in the bottom bar · Focus mode · one excellent artboard first, multiple artboards later (R12).

### D.5 Phasing
Asset Studio redesign is Phase 7 in the plan; guides that also help the garment canvas (2D grid, symmetry for shapes, rulers/guides, smart guides) can ship earlier as they become ready. Standalone route + library entry point lands with Phase 7.

---

## E. Reference 15 — building a mark from primitives (added 21 Nov 2026, Phase 1)

The video builds a clover icon and a playing-card layout entirely from primitives: circle + half-shape merged into a heart (**shape builder**), the heart **repeated 4× around a centre point** (radial repeat), **thin knockout gaps** cut where the copies overlap (interlock for shapes), a **small reused copy** in the corner (symbol), and the card corners as a **180° rotational copy**, then shown on a mockup.

Ceriga outcome — all live and source-linked (R8):
| Capability | Beginner path | Pro path | Class | Phase |
|---|---|---|---|---|
| Radial repeat | Select → **Repeat around** → copies count, drag the centre | Angle span, rotate copies on/off, pivot (R7) | B | 1 |
| Rotational / mirror symmetry group | **Mirror** ▸ 2-way, 4-way, 180° turn | Axis position, live edit of the source updates all copies | B | 1 |
| Knockout gaps between overlapping copies | **Interlock** ▸ gap width | Which object passes over/under, per crossing | B | 1–2 |
| Shape builder | Drag across regions to merge; Alt-drag to remove | Works on any closed paths, result stays linked | B | 1 |
| Reuse a small copy | **Duplicate linked** (symbol) | Edit master / detach | B | 1 (model) / 7 |
| Mockup | Native: always on the garment; Asset Studio garment preview companion (§D.2) | — | ✓ / B | 7 |

## F. Pen tool, text-as-shape and the effects / brushes / patterns quality pass (user direction, 21 Nov 2026)

### F.1 Pen tool audit against Illustrator / Photoshop (code audit, 21 Nov 2026)
Already strong (keep, make discoverable via the bottom strip and tooltips): click/drag anchors and close; Shift 45°; rubber band with length/angle readout; continue / Ctrl+J join; add/delete/convert anchors; Alt break-handle mid-drag; Space reposition; curvature mode (C); clipping masks; type on a path; text → outlines; offset / outline stroke / simplify; live boolean groups with Restore sources.

Gaps, assigned:
| Gap | Phase |
|---|---|
| Scissors: cut a path at an anchor or a click on a segment | 1 (path actions) |
| Shape builder: hover regions, drag to merge, Alt-click to delete | 1 (combine) |
| Alt-drag a segment to bow it (also while drawing, not only in Edit points) | 1 |
| Ctrl/Cmd = true temporary direct selection while the pen is active | 1 |
| Dash / gap / cap values on any stroke (not just a style choice) | 1 |
| Smooth brush (rub to reduce points) and a path eraser that cuts vectors | 1 → 5 |
| Width tool / width profiles on vector strokes (tapers, thick-thin) | 5 |
| Art and pattern brushes along any path (rope, chain, stitch, barbed wire on a spine) | 5 |

### F.2 Words as shapes (Phase 2, with Phase 1 hooks)
- **Text is a real shape for combining.** Merge / Cut out / Intersect / Divide and the shape builder accept text directly: the operation outlines the glyphs behind the scenes and keeps the source text linked (R5/R8), so "Edit text" re-runs the combine. No "convert text first" message.
- **Text inside a shape (area type):** pour words into any closed shape (badge, shield, circle), with auto-fit size, align, and padding.
- **Text takes the form of a shape (envelope):** warp words to any selected shape or badge outline, not only preset arcs/flags. Preset warps stay as quick starts.
- **Knockout text:** words cut out of a shape in one tap (the cut leaves the garment colour showing), plus "Stroke gap" around letters over artwork (ref 15).
- **Type on any path:** already there; add on-canvas start/end handles and "around a circle" quick start.

### F.3 Effects, filters, brushes and patterns — quality pass (Phases 3, 5, 6)
Today: ~31 text/shape effects, ~38 brushes (Draw shows 8 by default), ~49 patterns. Many are reasonable starts; some read as cheap CSS-filter looks. Rule from the user: **if a preset is not good, remove it; then add more that are good, deeply customisable and high quality.**

Process per family (start of each phase, before new work):
1. **Contact sheet audit:** render every preset at print size on light and dark garments (sheet in `docs/builder-audit/artwork-redesign/quality/`). Score 1–5 on fidelity, print-readiness (does it separate into inks / survive DTG, screen, embroidery), and customisation depth.
2. **Cut** anything scoring ≤2 that can't be rebuilt; **rebuild** 3s; keep 4–5s.
3. **Add** from the research lists below, each with a quick set (3–4 looks) and full controls (Advanced).

Quality bar for every preset: vector or high-resolution output at print size; seeded (re-roll + lock); colour from the garment palette; readable preview tile rendered by the real engine; at least 4 meaningful controls; known production behaviour per print method.

Research list — **effects** (Kittl / Illustrator / Photoshop / Procreate references): vintage crack, puff-print, screen-print misregistration, halftone (dot, line, cross, stochastic, angle per ink), riso grain, stamp/rubber ink, worn letterpress, distressed by texture mask (choose from a texture library), inline / outline stack (multi-stroke), offset shadow (hard, 3D block, long), chrome 80s, foil, glitter, flock, glow / neon tube, gradient map, duotone, emboss / deboss, rough edges / tear, warp-wave, stipple, posterise, threshold, sketch, engraving lines, embroidery fill (satin / tatami / chenille), patch with merrow border, rhinestone.

Research list — **brushes** (Procreate / Fresco / Illustrator): monoline inking pens with streamline, brush pens (pressure taper), dry ink, gel pen, technical pens, airbrush soft/hard, spray with drips, mop / tag, chalk, pastel, charcoal, gouache, watercolour wet edges, oil impasto, stipple/dot, halftone shading brush, grain shaders, sketching pencils (HB–6B), stamps (stars, sparkles, flowers), texture erasers; vector brushes: art (rope, chain, ribbon), pattern (stitch, barbed wire, zipper, lace), scatter (stars, sparks), calligraphic (angle, roundness, variance). Brush engine controls (R9): size, opacity, flow, spacing, jitter (size/angle/scatter), taper, pressure curve, streamline, grain (moving / texturised, scale, depth), wet mix, dual brush.

Research list — **patterns** (streetwear + textile): paisley / bandana, checkerboard (varsity, warped), racing check, flames, tie-dye (spiral, crumple, ice), acid wash, bleach splatter, camo (woodland, desert, digital, tiger, urban, frog, custom-colour), leopard / zebra / snake / cow, tartan builder (sett editor), houndstooth / herringbone, argyle, polka (halftone), stars & stripes, waves / topo / contour, barbed / chain, floral (ditsy, tropical), geometric (memphis, bauhaus), noise / grain fields, typographic repeat (your words). Pattern engine controls: scale (cm), rotation, offset/half-drop/brick, colourways from garment palette, seed, density, edge softness, and "fit to panel" vs "continuous across seams".

Filters for images (Phase 4): curves / levels, HSL per colour, gradient map, sharpen / clarity, noise reduce, posterise, threshold, halftone, background remove, select subject, colour to ink separation preview.


## G. Reference 16 — blended line flower poster (added 21 Nov 2026)

A 21-second Illustrator build of a teal and cream "FLOWER" poster. Contact sheets are local only.

**How it is made**
1. **Background:** cream paper, soft teal colour fields, visible film grain, thin keyline frame.
2. **Flower:** the Pen draws a jagged top edge and a tiny closed shape at the stem. A **Blend** with a high step count generates hundreds of thin in-between lines, which read as a translucent petal.
3. **Second flower:** the blend is duplicated, rotated, and its source paths are reshaped. The blend updates live.
4. **Type:** widely tracked serif "FLOWER" rotated on a slant; a tagline with an Arc warp.
5. **Details:** thin curling pen lines with tapered ends, small blended droplets, and a soft paper shadow on the final mockup.

**Ceriga status (code check, 21 Nov 2026)**
| Technique | Status | Build |
|---|---|---|
| Pen paths, duplicate, rotate | Have | Add Alt-drag duplicate if missing |
| Tracked, rotated and warped type | Have | — |
| Grain finish | Have | Quality pass in Phase 3 |
| **Blend between paths** | **Missing** | New live Blend object |
| Soft multi-point colour fields | Missing (linear, radial, conic only) | Freeform gradient |
| Width profile / tapered vector lines | Missing | Already planned in Phase 5; bring forward for Blend |
| Paper frame and mockup shadow | Partial | Asset Studio, Phase 7 |

**Blend specification (fully editable, per the standing rule)**
- Select two or more paths → **Blend** in the floating bar. Works with open and closed paths and with different point counts (resample by arc length).
- **Quick:** Steps slider, Lines / Smooth looks.
- **Pro:** exact steps (2–600) or distance between steps; start-point alignment and direction reverse; easing curve; stroke width, opacity and colour from start to end; spine (blend along a drawn path); align to page or path.
- **Live sources:** drag or edit either source path with the pen and every step updates. Add a third key shape mid-blend. **Expand** is optional and reversible until flattened.
- **Performance:** render steps as one compound SVG path; cap live preview density during drag, full density on release.
- **Production:** warn when lines are finer than the print method can hold (screen print, embroidery, puff); offer a minimum line weight or step reduction.
