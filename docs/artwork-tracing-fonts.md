# Artwork tracing and font tools

## Tracing workflow

The Pen supports corners, dragged Bezier handles and automatic curvature. C enters curvature drawing; Alt places a corner; double-click toggles a curve anchor. Snap to artwork edges positions anchors within eight screen pixels. It does not by itself bend the intervening segment.

Fit edges to reference follows the detected boundary between roughly placed anchors. It works while drawing and on finished shapes in Points mode. Choose an edge, click Fit selected edge, or click that edge on the canvas. Other route follows the opposite side of a closed contour. Fit all placed edges handles an open draft; Fit and close outline also fits the closing segment. Finished shapes offer Fit whole outline. Every fit remains editable and undoable. Raster contours are cleaned into cubic curves; native references retain tighter geometric accuracy. Ambiguous crossings, very low contrast, or small image details may require additional guide anchors.

An image can become a locked tracing reference with adjustable opacity and Ctrl/Cmd+H visibility. Two-point calibration sets drawing units per centimetre. Region tracing flood-fills the clicked colour in a worker and creates native colour-filled paths. References stay behind artwork and are excluded from production preparation and reusable-asset placement.

Vectorise image runs ImageTracer in a cancellable worker. Colour count, detail, corner smoothing, speck removal, white-background removal and straight-edge preference can update an existing trace. Original preview and per-colour visibility/recolouring remain editable; Expand creates native grouped paths. A simple synthetic two-colour logo was traced in approximately 50 ms in isolated Chrome checks; this is not a timing promise for photos.

## Font tools

The picker includes used fonts, recent fonts, favourites, private workspace uploads and a verified catalogue of 200 additional Google Fonts. Font files load when their rows become visible or when selected. Arrow keys preview a family; Enter commits and Escape restores the original family. The list remains stationary while previewing.

Uploads accept multiple TTF, OTF, WOFF and WOFF2 files with a required rights checkbox and timestamp. Names, PostScript identity, styles, weights, embedding flags and exposed axes are read from the actual font. New uploaded files are stored locally in IndexedDB under the active account scope, not sent to a server or shared as raw font files. WOFF2 data is decoded with WebAssembly before fontkit variable instancing. Workspace styles are grouped by family. Missing fonts retain their source identity and have a screen-only fallback; production outlining blocks until they are restored or replaced.

Shape text applies a non-destructive ordered vector effect stack (Arc, Arch, Bulge, Flag, Wave, Rise and Perspective). Source contours are cached, deformations are subdivided and refitted to Beziers, and disabling an effect restores the source geometry. Individual glyph positions, rotation and scale remain properties of live text. Horizontal/vertical text scaling, supported OpenType feature toggles, variable axes and encoded glyph insertion use the same contour pipeline. Existing Convert and edit outlines remains available for point-level editing and separating letters. Unsupported font styles are disabled rather than silently synthesized.

Existing artwork review includes live-text, font-missing, embedding, synthetic-style and missing-character checks. The separately added asset SVG/PDF export menu was removed at the user's request.

## Workspace and usability

Ctrl/Cmd+C, X and V copy, cut and paste native artwork. Form fields keep normal text clipboard behaviour. Saved assets place native editable children instead of their bitmap thumbnail. The asset header contains its name, return and save controls; the shortcut instruction strip is removed. Everyday text and shape appearance precedes specialist controls, and entering point editing scrolls the inspector to the active controls.

## References

- [Adobe curvature behaviour](https://helpx.adobe.com/uk/illustrator/using/tool-techniques/curvature-tool.html)
- [Adobe individual-character manipulation](https://helpx.adobe.com/au/illustrator/using/tool-techniques/touch-type-tool.html)
- [fontkit shaping and variable-font APIs](https://github.com/foliojs/fontkit)
- [WOFF2 WebAssembly decoder](https://github.com/itskyedo/woff2-encoder/tree/v2.0.0)
- [ImageTracer](https://github.com/jankovicsandras/imagetracerjs)
- [Fontsource catalogue API](https://fontsource.org/docs/api/fonts)
- [Fontsource file CDN](https://fontsource.org/docs/getting-started/cdn)


## Outline logo and image placement

Select a placed image, then use **Outline logo** in the inspector or its context menu. First use requires the artwork-permission checkbox; the time is stored with the resulting trace and in the current account's local confirmation record.

Tracing runs in a dedicated worker. It supersamples within a 4096-pixel working limit, preserves alpha silhouettes, detects an edge-colour background, chooses a palette, fits compound cubic contours and measures thin details. Shapes support Stacked and Cut-out layouts; Outline supports whole, inner and all contours. The original source remains available for comparison. Editing settings shows a small preview before the full worker result.

Each disconnected colour piece gets its own named region. Click and drag a region on the canvas to move it inside the logo group. Its row selects the same region; names, visibility, shared colour swatches and print references remain editable. Double-click or choose **Edit points** for anchors. Moving or editing a piece detaches only that piece from future tracing; the other regions stay live. **Expand trace** detaches everything. Native production preparation removes the trace metadata and source image, keeping ordinary compound vector paths. This does not add an export button.

Print checks are preparation guidance, including source DPI, colour limits and measured thin areas; Show me highlights their sampled locations. Manufacturer-specific limits still need confirmation. The silhouette border can be offset into a separate editable sticker shape. Completion reveals contours over 600 ms and fades their fills; reduced motion uses a 100 ms fade.

Uploads and reused images preserve their natural proportions. Asset-workspace placement fits within 75% of the canvas without enlarging the source pixels. Previously stretched images can use **Artwork & size → Fit image to canvas**; garment images offer **Restore original proportions**. No stylesheet or overall panel layout changes are needed for these features.

Regression: `node scripts/verify-logo-outline.mjs` covers holes and islands, sharp closing corners, disconnected pieces, swatches, mode switching, detached-child preservation and image proportions. Browser checks also cover the context menu, required permission, actual anchor/region dragging, the supplied logo and its upload proportions.


## Focused asset editing and connected tools

Asset mode hides garment-section navigation and the garment command bar. Artwork tools move to the top of the sidebar; returning to Garment restores the builder. The asset command bar is compact, with a separate resizable inspector and a warm-white pasteboard. Drag the pasteboard directly to pan; Space-drag and middle-mouse drag also pan over artwork.

Clicking a visible logo region selects a tight native shape proxy, with four resize handles, rotation, position, appearance, pattern ink, wear and other shape controls. Geometry is reframed without changing the visible contour. Duplicate and Delete operate on that piece. Release shape places that piece into the main document for combinations with other artwork. Advanced canvas transformations release the selected piece automatically when they need the top-level editing surface.

Clipping mask is available in the selected object's panel and the layer actions menu. It links a paint, shape or texture layer to a whole graphic or a selected traced region; moving either updates the mask. Release clipping mask restores the original uncut content. SVG preparation emits native vector clip paths. Pattern ink uses the same shape controls for traced and drawn shapes.

Open property sections and floating canvas menus dismiss when clicking elsewhere in the app. Colour-picker, menu and dialog portals remain interactive while open. The styling is scoped to Artwork & Graphics, retaining the garment builder's other section styles.


## Asset previews and switching after point edits

The shared layer thumbnail renders the real artwork using the same native group renderer as the canvas. Images, grouped assets, text, brush drawings, custom paths, patterns and wear marks keep their proportions and appearance. Thumbnail rendering suppresses the trace-completion animation and garment texture, and is non-interactive.

Vectorise image now uses the alpha-aware contour engine shared with Outline logo. Transparent pixels do not enter the colour palette and cannot become a dark rectangular background. Expanding the trace creates individual compound region paths with their own holes instead of merging all regions of a colour into one object.

After editing an outer contour, clicking another visible region exits the old point editor and starts selecting or dragging that region. The same interaction applies to separate expanded vector shapes. Anchor and curve-handle clicks continue editing the current contour. Selecting a different object in the layer list clears stale point-edit state. Browser regressions cover both grouped-logo and plain-vector cases.


### Connected logo shapes and layers
A traced shape is a connected positive ink component with its counters retained as compound-path holes. A linked ring and six detached letters produce seven editable shapes. White negative space and antialiased edge shades do not create extra ink layers when background removal is enabled. Palette inference uses stable flat-colour interiors for logos, retaining full samples for photos and gradients. Both Vectorise image and Outline logo use this contour pipeline.

Selecting a traced piece or opening Layers materialises the visible pieces as native document shape layers. Each piece supports the same move, resize, appearance, point-editing and clipping controls as other shapes. Whole-graphic clipping follows the union of the split pieces. Undo can restore the original group without immediately splitting it again. Existing expanded traces are not silently regenerated: retrace the source image to replace earlier edge fragments while preserving any manually edited result.

The asset workspace uses a plain white surround without a backdrop shadow. Its inspector uses one aligned gutter rather than nested padding.


### Clean curves
Points > Clean curves provides Round circular contours for the selected vector shape, plus Make circle and Make ellipse for the contour selected in Path contour. Recognition preserves non-round outlines and open paths; near-circular contours become circles, while elongated ovals keep their proportions. Circles are calculated using the actual element dimensions, so non-square artwork does not squash them. Each result uses four cubic anchors, preserves contour winding and compound-path holes, remains editable, and participates in normal undo/redo. Colours and other separate artwork layers are unchanged. The controls reuse the existing right-panel components.

Fit selected arc handles curved sections of a joined outline or an open drawing. Select adjoining anchors, then apply the action in Clean curves. The fit uses physical coordinates, keeps the two endpoints and their outside handles, replaces the interior with cubic arc segments, and accepts selections that cross the start of a closed path. Disjoint point selections, straight sections and an entire closed contour are excluded; whole closed contours use Make circle or Make ellipse instead.


Artwork dismissal records the original pointerdown ownership and the click path before React updates. This prevents Radix dropdowns that retarget a click, conditionally replaced controls, and nested editors from collapsing their parent section. Shared floating-control detection protects portaled colour/font menus in both inline toolbars. Actual outside clicks still dismiss open sections. Selected-object inspectors use a labelled Tools return action, a compact title row and consistent section spacing across text, shapes, images and drawings.
