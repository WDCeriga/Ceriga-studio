/**
 * Browser-side rasterizer for the tech pack PDF.
 *
 * Reproduces the *actual* builder preview as bitmaps so the PDF shows exactly
 * what the customer designed:
 *  - the layered garment SVG composite (base + sleeves + neckline + trims…)
 *    with the same tinting, sleeve splitting, cuff alignment and user
 *    transforms used by `TshirtSvgPreview`;
 *  - the print canvas (garment + PREVIEW_ZONE artwork/text placement);
 *  - the label and packaging previews.
 *
 * Everything renders through an offscreen canvas and leaves as PNG data URLs,
 * which jsPDF embeds natively. Uploaded artwork (PNG/JPEG/**SVG** data URLs)
 * is normalized to PNG here — SVG uploads previously could not embed at all.
 */

import {
  resolveGarmentLayers,
  getGarmentSvgConfig,
  resolveGarmentSvgType,
  type GarmentSvgGarmentType,
  type GarmentAssetSelection,
  type ResolvedGarmentLayer,
} from '../data/garmentSvgCatalog';
import {
  DEFAULT_TSHIRT_LAYER_TRANSFORM,
  resolveLayerScale,
  TSHIRT_CANVAS,
  type TshirtLayerTransform,
  type TshirtLayerId,
} from '../data/tshirtLayerAssets';
import {
  TSHIRT_DETAIL_COLOR,
  computeSleeveHemAlignOffsetForSide,
  getPotraceSvgBBox,
  isValidBBox,
  splitPotraceSvgBBoxAtCenter,
  tintPotraceSvg,
  type PotraceSvgBBox,
  type SleeveSide,
} from './tshirtSvgUtils';
import { resolveCuffAlignOffset, mergeCuffSideTransform } from '../data/tshirtCuffDefaults';
import type { DesignElement } from '../components/builder/PrintsDesignStep';

/* ── generic raster helpers ────────────────────────────────────────────────── */

/** Render an SVG string to a PNG data URL via an offscreen canvas. */
export async function svgToPngDataUrl(
  svg: string,
  width: number,
  height: number,
): Promise<string | null> {
  try {
    const img = new Image();
    img.decoding = 'sync';
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('svg image load failed'));
      img.src = src;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Normalize any image content the builder may hold into a PNG data URL that
 * jsPDF can embed. PNG/JPEG pass through untouched; SVG data URLs are
 * re-rasterized through an <img>; remote URLs are attempted and may fail
 * (CORS-tainted canvas) — callers fall back to a placeholder in that case.
 */
export async function dataUrlToPngDataUrl(content: string): Promise<string | null> {
  if (!content) return null;
  if (content.startsWith('data:image/png') || content.startsWith('data:image/jpeg')) return content;
  const mime = content.startsWith('data:') ? content.slice(5, content.indexOf(';')) : '';
  if (mime === 'image/svg+xml' || content.startsWith('data:image/webp') || mime === 'image/gif' || mime === 'image/bmp') {
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('image load failed'));
        img.src = content;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1024;
      canvas.height = img.naturalHeight || 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }
  return null; // remote / unsupported → caller draws placeholder
}

/* ── garment composite (mirror of TshirtSvgPreview) ────────────────────────── */

type ExpandedLayer = {
  key: string;
  layer: ResolvedGarmentLayer;
  side?: SleeveSide;
  transform: TshirtLayerTransform;
  alignOffset?: { x: number; y: number };
  bbox: PotraceSvgBBox | null;
};

function stripSvgWrapper(tinted: string): string {
  // Start after the actual <svg …> opening tag (there may be an XML
  // declaration / DOCTYPE before it, which would corrupt the composite).
  const open = /<svg[^>]*>/i.exec(tinted);
  if (!open) return tinted;
  const start = open.index + open[0].length;
  const close = tinted.lastIndexOf('</svg>');
  if (close === -1 || close <= start) return tinted;
  return tinted.slice(start, close);
}

function garmentCompositeSvg(input: {
  garmentType: GarmentSvgGarmentType;
  baseColor: string;
  selection: GarmentAssetSelection;
  neckTrimColor?: string;
  sleeveTrimColor?: string;
  cuffTrimColor?: string;
  pocketTrimColor?: string;
  layerTransforms?: Partial<Record<TshirtLayerId, TshirtLayerTransform>>;
}): string | null {
  const config = getGarmentSvgConfig(input.garmentType);
  const layers = resolveGarmentLayers({
    garmentType: input.garmentType,
    selection: input.selection,
    neckTrimColor: input.neckTrimColor,
    sleeveTrimColor: input.sleeveTrimColor,
    cuffTrimColor: input.cuffTrimColor,
    pocketTrimColor: input.pocketTrimColor,
  });
  if (layers.length === 0) return null;

  const sleeveLayer = layers.find((l) => l.id === 'sleeves');
  const sleeveHemLayer = layers.find((l) => l.id === 'sleeveHem');
  const sleeveHemAlign = config.splitSleeveHems && sleeveLayer && sleeveHemLayer
    ? {
        left: resolveCuffAlignOffset(
          computeSleeveHemAlignOffsetForSide(sleeveLayer.svgRaw, sleeveHemLayer.svgRaw, 'left'),
          sleeveLayer.assetId,
          sleeveHemLayer.assetId,
          'left',
        ),
        right: resolveCuffAlignOffset(
          computeSleeveHemAlignOffsetForSide(sleeveLayer.svgRaw, sleeveHemLayer.svgRaw, 'right'),
          sleeveLayer.assetId,
          sleeveHemLayer.assetId,
          'right',
        ),
      }
    : { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };

  const expanded: ExpandedLayer[] = [];
  const transforms = input.layerTransforms ?? {};
  for (const layer of layers) {
    if (config.splitSleeves && layer.id === 'sleeves') {
      const { left, right } = splitPotraceSvgBBoxAtCenter(layer.svgRaw);
      const base = { ...DEFAULT_TSHIRT_LAYER_TRANSFORM, ...transforms.sleeves };
      if (left && isValidBBox(left)) {
        expanded.push({ key: 'sleeveLeft', layer, side: 'left', transform: { ...base, ...transforms.sleeveLeft }, bbox: left });
      }
      if (right && isValidBBox(right)) {
        expanded.push({ key: 'sleeveRight', layer, side: 'right', transform: { ...base, ...transforms.sleeveRight }, bbox: right });
      }
      continue;
    }
    if (config.splitSleeveHems && layer.id === 'sleeveHem') {
      const { left, right } = splitPotraceSvgBBoxAtCenter(layer.svgRaw);
      const mk = (side: SleeveSide) =>
        mergeCuffSideTransform(side, sleeveLayer?.assetId, sleeveHemLayer?.assetId, transforms as Partial<Record<string, TshirtLayerTransform>>);
      if (left && isValidBBox(left)) {
        expanded.push({ key: 'sleeveHemLeft', layer, side: 'left', transform: mk('left'), alignOffset: sleeveHemAlign.left, bbox: left });
      }
      if (right && isValidBBox(right)) {
        expanded.push({ key: 'sleeveHemRight', layer, side: 'right', transform: mk('right'), alignOffset: sleeveHemAlign.right, bbox: right });
      }
      continue;
    }
    expanded.push({
      key: layer.id,
      layer,
      transform: { ...DEFAULT_TSHIRT_LAYER_TRANSFORM, ...transforms[layer.id as TshirtLayerId] },
      bbox: getPotraceSvgBBox(layer.svgRaw),
    });
  }
  expanded.sort((a, b) => a.layer.zIndex - b.layer.zIndex);

  const C = TSHIRT_CANVAS;
  let body = '';
  for (const e of expanded) {
    if (!e.bbox || !isValidBBox(e.bbox)) continue;
    const fill = e.layer.kind === 'detail'
      ? (e.layer.tint ?? TSHIRT_DETAIL_COLOR)
      : (e.layer.tint ?? input.baseColor);
    const inner = stripSvgWrapper(tintPotraceSvg(e.layer.svgRaw, fill, 'solid'));
    const t = e.transform;
    const { scaleX, scaleY } = resolveLayerScale(t);
    // CSS `translate(tx,ty) rotate(r) scale(sx,sy) translate(ax%,ay%)` with
    // transform-origin at the (side-split) bbox centre == the SVG matrix below.
    const ox = ((e.bbox.minX + e.bbox.maxX) / 2);
    const oy = ((e.bbox.minY + e.bbox.maxY) / 2);
    const ax = e.alignOffset ? e.alignOffset.x : 0;
    const ay = e.alignOffset ? e.alignOffset.y : 0;
    const clip = e.side === 'left' ? 'url(#tpClipL)' : e.side === 'right' ? 'url(#tpClipR)' : '';
    // CSS order: inner div clips (canvas-local coords), outer transform then
    // moves the clipped result — so the clip group sits INSIDE the transform.
    const clipOpen = clip ? `<g clip-path="${clip}">` : '';
    const clipClose = clip ? '</g>' : '';
    body += `<g transform="translate(${ox + t.x} ${oy + t.y}) rotate(${t.rotation}) scale(${scaleX} ${scaleY}) translate(${ax} ${ay}) translate(${-ox} ${-oy})">${clipOpen}${inner}${clipClose}</g>`;
  }
  if (!body) return null;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${C} ${C}" width="${C}" height="${C}">` +
    `<defs>` +
    `<clipPath id="tpClipL"><rect x="0" y="0" width="${C / 2}" height="${C}"/></clipPath>` +
    `<clipPath id="tpClipR"><rect x="${C / 2}" y="0" width="${C / 2}" height="${C}"/></clipPath>` +
    `</defs>${body}</svg>`
  );
}

/** Print-zone inset on the square garment canvas (matches PREVIEW_ZONE). */
const PRINT_ZONE = { left: 0.05, top: 0.06, right: 0.05, bottom: 0.07 };

/**
 * Legacy reference frame used by `describePlacement` and old saved states:
 * element x/y were px of the live zone, so fractions of the zone are the
 * only stable coordinate system across screen sizes.
 */
function zoneFraction(el: DesignElement, visual: TechPackVisualState) {
  const zw = visual.printZoneWidth || 0;
  const zh = visual.printZoneHeight || 0;
  if (zw > 1 && zh > 1) {
    return { fx: el.x / zw, fy: el.y / zh };
  }
  // No saved zone size (legacy state) — assume the historical default zone
  // of ~335×400 px at desktop width.
  return { fx: el.x / 335, fy: el.y / 400 };
}

/** Draw print elements (text + images) onto a 2d context in zone space. */
function drawPrintsToCtx(
  ctx: CanvasRenderingContext2D,
  prints: DesignElement[],
  zonePx: { x: number; y: number; w: number; h: number },
  visual: TechPackVisualState,
) {
  const draw = async () => {
    for (const el of prints) {
      const { fx, fy } = zoneFraction(el, visual);
      const cx = zonePx.x + fx * zonePx.w;
      const cy = zonePx.y + fy * zonePx.h;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(((el.rotation ?? 0) * Math.PI) / 180);
      const opacity = el.opacity != null ? Math.max(0, Math.min(100, el.opacity)) / 100 : 1;
      ctx.globalAlpha = opacity;
      if (el.type === 'text') {
        const weight = el.fontStyle === 'italic' ? 'italic 700' : '700';
        const family = el.fontFamily || 'Helvetica, Arial, sans-serif';
        const size = Math.max(4, el.fontSize ?? 30);
        ctx.font = `${weight} ${size}px ${family}`;
        try {
          (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
            el.letterSpacing ? `${el.letterSpacing}px` : '0px';
        } catch { /* not supported — ignore */ }
        let text = el.content;
        if (el.textTransform === 'uppercase') text = text.toUpperCase();
        if (el.textTransform === 'lowercase') text = text.toLowerCase();
        ctx.fillStyle = el.color || '#000000';
        ctx.textAlign = (el.textAlign as CanvasTextAlign) || 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 0, el.width || undefined);
      } else {
        const png = await dataUrlToPngDataUrl(el.content);
        if (png) {
          const img = new Image();
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = png;
          });
          // Element sizes are also stored in zone px — scale with the zone.
          const zw = visual.printZoneWidth || 335;
          const w = Math.max(2, el.width * (zonePx.w / zw));
          const h = Math.max(2, el.height * (zonePx.w / zw));
          const cropT = ((el.cropTop ?? 0) / 100) * img.naturalHeight;
          const cropB = ((el.cropBottom ?? 0) / 100) * img.naturalHeight;
          const cropL = ((el.cropLeft ?? 0) / 100) * img.naturalWidth;
          const cropR = ((el.cropRight ?? 0) / 100) * img.naturalWidth;
          ctx.save();
          if (el.cornerRadius) {
            const r = Math.min(el.cornerRadius, w / 2, h / 2);
            ctx.beginPath();
            ctx.roundRect(-w / 2, -h / 2, w, h, r);
            ctx.clip();
          }
          if (el.flipHorizontal) ctx.scale(-1, 1);
          ctx.drawImage(
            img,
            cropL, cropT,
            Math.max(1, img.naturalWidth - cropL - cropR),
            Math.max(1, img.naturalHeight - cropT - cropB),
            -w / 2, -h / 2, w, h,
          );
          ctx.restore();
          if (el.borderWidth && el.borderWidth > 0) {
            ctx.strokeStyle = el.borderColor || '#000';
            ctx.lineWidth = el.borderWidth;
            ctx.strokeRect(-w / 2, -h / 2, w, h);
          }
        } else {
          // Remote/undrawable artwork — dashed placeholder (mirrors the PDF fallback)
          const zw = visual.printZoneWidth || 335;
          const w = Math.max(4, el.width * (zonePx.w / zw));
          const h = Math.max(4, el.height * (zonePx.w / zw));
          ctx.strokeStyle = '#b9221c';
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 2;
          ctx.strokeRect(-w / 2, -h / 2, w, h);
          ctx.setLineDash([]);
          ctx.fillStyle = '#b9221c';
          ctx.font = '700 12px Courier New, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('ARTWORK — SEE SCHEDULE', 0, 0);
        }
      }
      ctx.restore();
    }
  };
  return draw();
}

export type GarmentRenderInput = {
  garmentType: string;
  baseColor?: string;
  tshirtAssetSelection?: GarmentAssetSelection;
  neckTrimColor?: string;
  sleeveTrimColor?: string;
  cuffTrimColor?: string;
  pocketTrimColor?: string;
  tshirtLayerTransforms?: Partial<Record<TshirtLayerId, TshirtLayerTransform>>;
};

function svgTypeOf(garmentType: string): GarmentSvgGarmentType | null {
  return resolveGarmentSvgType(garmentType as never);
}

/**
 * Render the garment composite exactly as the builder preview shows it
 * (fabric colour, selected asset layers, trim colours, user transforms).
 */
export async function renderGarmentPng(
  input: GarmentRenderInput,
  size = 1100,
): Promise<string | null> {
  const svgType = svgTypeOf(input.garmentType);
  if (!svgType) return null;
  const selection = input.tshirtAssetSelection;
  if (!selection || Object.keys(selection).length === 0) return null;
  const svg = garmentCompositeSvg({
    garmentType: svgType,
    baseColor: input.baseColor || '#5C7FB6',
    selection,
    neckTrimColor: input.neckTrimColor,
    sleeveTrimColor: input.sleeveTrimColor,
    cuffTrimColor: input.cuffTrimColor,
    pocketTrimColor: input.pocketTrimColor,
    layerTransforms: input.tshirtLayerTransforms,
  });
  if (!svg) return null;
  return svgToPngDataUrl(svg, size, size);
}

/**
 * Render the front print canvas: garment composite + the print zone with
 * every artwork/text element at its designed position (like the builder).
 */
export async function renderPrintFrontPng(
  input: GarmentRenderInput & { prints: DesignElement[]; printZoneWidth?: number; printZoneHeight?: number },
  size = 1100,
): Promise<string | null> {
  const garment = await renderGarmentPng(input, size);
  if (!garment) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const gImg = new Image();
    await new Promise<void>((resolve) => {
      gImg.onload = () => resolve();
      gImg.onerror = () => resolve();
      gImg.src = garment;
    });
    ctx.drawImage(gImg, 0, 0, size, size);
    const zone = {
      x: PRINT_ZONE.left * size,
      y: PRINT_ZONE.top * size,
      w: (1 - PRINT_ZONE.left - PRINT_ZONE.right) * size,
      h: (1 - PRINT_ZONE.top - PRINT_ZONE.bottom) * size,
    };
    await drawPrintsToCtx(ctx, input.prints, zone, {
      printZoneWidth: input.printZoneWidth,
      printZoneHeight: input.printZoneHeight,
    } as TechPackVisualState);
    return canvas.toDataURL('image/png');
  } catch {
    return garment;
  }
}

/* ── label & packaging previews ────────────────────────────────────────────── */

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderLabelPng(
  opts: { color?: string; brandName?: string; sampleSize?: string; labelType?: string },
  width = 520,
): Promise<string | null> {
  if (!opts.labelType || opts.labelType === 'none') return null;
  const w = width;
  const h = Math.round(width * 0.72);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  // stitch border
  ctx.strokeStyle = '#d8d4cc';
  ctx.setLineDash([7, 5]);
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.setLineDash([]);
  const bg = opts.color && opts.color.toUpperCase() !== '#FFFFFF' ? opts.color : '#141414';
  const lw = w * 0.62;
  const lh = h * 0.58;
  roundRectPath(ctx, (w - lw) / 2, (h - lh) / 2, lw, lh, 8);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(lh * 0.34)}px Helvetica, Arial, sans-serif`;
  ctx.fillText((opts.brandName || 'CERIGA').toUpperCase(), w / 2, h / 2 - lh * 0.12);
  ctx.font = `${Math.round(lh * 0.16)}px "Courier New", monospace`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(`STUDIO · ${(opts.sampleSize || 'M').toUpperCase()}`, w / 2, h / 2 + lh * 0.22);
  return canvas.toDataURL('image/png');
}

export async function renderPackagingPng(
  opts: { color?: string; brandName?: string; packagingType?: string },
  width = 620,
): Promise<string | null> {
  if (!opts.packagingType || opts.packagingType === 'none') return null;
  const w = width;
  const h = Math.round(width * 0.8);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#f3f2ef';
  ctx.fillRect(0, 0, w, h);
  // bag silhouette
  const bw = w * 0.66;
  const bh = h * 0.72;
  const bx = (w - bw) / 2;
  const by = (h - bh) / 2 + 6;
  ctx.fillStyle = opts.color && opts.color.toUpperCase() !== '#F5F5F5' ? opts.color : '#ffffff';
  roundRectPath(ctx, bx, by, bw, bh, 10);
  ctx.fill();
  ctx.strokeStyle = '#c9c5bc';
  ctx.lineWidth = 2;
 ctx.stroke();
  // handle hole
  ctx.beginPath();
  ctx.ellipse(w / 2, by + bh * 0.14, bw * 0.14, bh * 0.05, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#c9c5bc';
  ctx.stroke();
  // brand strip
  const stripH = bh * 0.12;
  ctx.fillStyle = '#141414';
  ctx.fillRect(bx + bw * 0.18, by + bh * 0.46, bw * 0.64, stripH);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(stripH * 0.62)}px Helvetica, Arial, sans-serif`;
  ctx.fillText((opts.brandName || 'CERIGA').toUpperCase(), w / 2, by + bh * 0.46 + stripH / 2 + 1);
  ctx.font = `${Math.round(stripH * 0.4)}px "Courier New", monospace`;
  ctx.fillStyle = '#8a877f';
  ctx.fillText('POLY BAG · RECYCLABLE', w / 2, by + bh * 0.78);
  return canvas.toDataURL('image/png');
}
