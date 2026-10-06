
  # Design Request (Copy)

  This is a code bundle for Design Request (Copy). The original project is available at https://www.figma.com/design/gS67Oy3t7CSSnsqKcAKyic/Design-Request--Copy-.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Distressing panel

  In Print & Design, open Distressing to compare fabric swatches for holes (frayed punctures), abrasion (faded surface wear), and rips & tears (long openings with exposed threads). Select a texture, then Brush to apply it. The brush preview responds to count, size, opacity, and texture-specific settings; Eraser clears distressing. Swatches and garment marks share the same texture paths and colours. Each brush pass stamps the pattern shown in the live settings preview, rather than generating a different image on placement. Passes and texture types accumulate on one distress layer per garment side. Select **Add new distress layer** to start a separate layer with the next stroke; existing artwork is preserved. Pen pressure can scale the marks; the fabric background is only for preview contrast. Previously placed raster marks retain their original appearance.

  With the development server running, use `node scripts/test_distressing_browser.mjs` to check previews, controls, mobile layout, and pixel-identical cursor-to-placement behavior at 1× and 2× pixel density. The test defaults to `http://127.0.0.1:5176`; set `CERIGA_BASE_URL` for another address.
  