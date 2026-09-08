/**
 * Ceriga Studio — factory tech pack PDF generator.
 *
 * Renders the 8-page Ceriga tech pack design (cover, style overview,
 * measurements, fabric & colour, construction, prints & design, labels &
 * packaging, order quantities) in LANDSCAPE, filling every page from the
 * real customization-step data of the project.
 *
 * Pure client-side via jsPDF: drawings are jsPDF vector primitives so the
 * PDF stays small and print-crisp.
 *
 * Layout grid (A4 landscape 297×210mm): margins 14mm, top bar to y=22,
 * section head 30–52, content 56–~192, footer rule at H−12.
 */
import { jsPDF } from 'jspdf';
import { measurementGuideLetterAt } from '../components/builder/measurementGuides';
import { ORDER_SIZE_KEYS } from '../data/builderSteps';
import { labelTypeLabel, packagingTypeLabel } from './techPackLabels';
import type { TechPackData, TechPackPrintRow } from './techPackData';
import { formatMeasurementDisplay, type MeasurementUnit } from './measurements';

type Pdf = jsPDF;

/** Page size in mm — landscape A4/Letter. */
const PAGE = {
  A4: { w: 297, h: 210 },
  Letter: { w: 279.4, h: 215.9 },
} as const;

/** Resilient page-dimension lookup (defaults to A4 on unknown key). */
function pageDims(paperSize: string): { w: number; h: number } {
  return (PAGE as Record<string, { w: number; h: number }>)[paperSize] ?? PAGE.A4;
}

/** Pre-rendered bitmaps (PNG data URLs) the PDF embeds when available. */
export type TechPackImages = {
  /** Garment composite with artwork (style overview front board). */
  garmentFront?: string | null;
  /** Clean garment composite (style overview back board + fallbacks). */
  garmentBack?: string | null;
  /** Clean garment composite (fabric & construction boards). */
  garmentPlain?: string | null;
  /** Full print canvas: garment + artwork at designed positions. */
  printCanvasFront?: string | null;
  /** Woven label preview. */
  label?: string | null;
  /** Packaging preview. */
  packaging?: string | null;
};

export type TechPackPageOptions = {
  detailsImage: boolean;
  measurementTable: boolean;
  materialCallouts: boolean;
  frontBackViews: boolean;
  constructionNotes: boolean;
  artworkPages: boolean;
  quantities: boolean;
  paperSize: 'A4' | 'Letter';
  /** Pre-rendered garment/artwork/label/packaging bitmaps to embed. */
  images?: TechPackImages;
  /** Off-white paper tone from the export modal. */
  background: string;
};

const INK = '#0a0a0c';
const PAPER = '#f7f6f2';
const LINE = '#d9d8d3';
const MUTED = '#6f6f73';
const RED = '#df3028';
const SOFT_RED = '#f8e7e4';

/** Content area: x 14 → W−14, y 56 → H−18. */
const MX = 14;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6) || '000000', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function setFill(pdf: Pdf, hex: string) {
  pdf.setFillColor(...hexToRgb(hex));
}
function setStroke(pdf: Pdf, hex: string) {
  pdf.setDrawColor(...hexToRgb(hex));
}
function setText(pdf: Pdf, hex: string) {
  pdf.setTextColor(...hexToRgb(hex));
}

/**
 * Scale for garmentOutline that fits the 236×264-unit path inside a box (mm).
 * The path is drawn around its centre (±118 wide, ±132 tall), so the scale is
 * half the box over the half-path — i.e. box over full path size.
 */
function garmentFit(boxW: number, boxH: number): number {
  return Math.min(boxW / 236, boxH / 264);
}

/** Truncate long strings for table cells (jsPDF cells don't wrap). */
function clampText(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/* ── shared chrome ─────────────────────────────────────────────────────────── */

function chromeTopBar(pdf: Pdf, pageW: number, meta: string, dark = false) {
  setStroke(pdf, dark ? '#3a3a3f' : INK);
  pdf.setLineWidth(0.5);
  pdf.line(MX, 22, pageW - MX, 22);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  setText(pdf, dark ? '#ffffff' : INK);
  pdf.text('CERIGA STUDIO', MX, 17);
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(6.5);
  setText(pdf, dark ? '#aaaab0' : MUTED);
  pdf.text(meta.toUpperCase(), pageW - MX, 17, { align: 'right' });
}

function chromeFooter(
  pdf: Pdf,
  pageW: number,
  pageH: number,
  left: string,
  folio: string,
  dark = false,
) {
  setStroke(pdf, dark ? '#3a3a3f' : LINE);
  pdf.setLineWidth(0.3);
  pdf.line(MX, pageH - 12, pageW - MX, pageH - 12);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  setText(pdf, dark ? '#8d8d92' : MUTED);
  pdf.text(clampText(left, 90), MX, pageH - 8);
  pdf.setFont('helvetica', 'bold');
  setText(pdf, dark ? '#ffffff' : INK);
  pdf.text(folio, pageW - MX, pageH - 8, { align: 'right' });
}

function sectionHead(
  pdf: Pdf,
  pageW: number,
  sectionId: string,
  title: string,
  blurb: string,
) {
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(7);
  setText(pdf, RED);
  pdf.text(sectionId.toUpperCase(), MX, 38);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(21);
  setText(pdf, INK);
  pdf.text(title, MX, 48);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  setText(pdf, MUTED);
  const lines = pdf.splitTextToSize(blurb, 82);
  pdf.text(lines.slice(0, 3), pageW - MX, 38, { align: 'right' });
}

/** Titled bordered panel. */
function panel(
  pdf: Pdf,
  x: number,
  y: number,
  w: number,
  h: number,
  title?: string,
) {
  setStroke(pdf, LINE);
  setFill(pdf, 'ffffff');
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, w, h, 2, 2, 'FD');
  if (title) {
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(6.5);
    setText(pdf, RED);
    pdf.text(title.toUpperCase(), x + 4, y + 7);
  }
}

/** One label/value pair with the classic underline. */
function field(
  pdf: Pdf,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  valueSize = 8.5,
) {
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(5.8);
  setText(pdf, MUTED);
  pdf.text(label.toUpperCase(), x, y + 3);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(valueSize);
  setText(pdf, INK);
  const valueLines = pdf.splitTextToSize(value || '—', w - 2).slice(0, 2);
  pdf.text(valueLines, x, y + 8.5);
  setStroke(pdf, LINE);
  pdf.setLineWidth(0.25);
  const underlineY = y + (valueLines.length > 1 ? 12.5 : 10.5);
  pdf.line(x, underlineY, x + w, underlineY);
  return underlineY;
}

function fieldGrid(
  pdf: Pdf,
  rows: { label: string; value: string }[],
  x: number,
  y: number,
  w: number,
  cols = 2,
  rowH = 13,
): number {
  const colW = (w - (cols - 1) * 5) / cols;
  rows.forEach((row, i) => {
    const cx = x + (i % cols) * (colW + 5);
    const cy = y + Math.floor(i / cols) * rowH;
    field(pdf, cx, cy, colW, row.label, row.value);
  });
  return y + Math.ceil(rows.length / cols) * rowH;
}

/** Height a fieldGrid will consume. */
function fieldGridHeight(count: number, cols = 2, rowH = 13): number {
  return Math.ceil(count / cols) * rowH;
}

function noteBox(
  pdf: Pdf,
  x: number,
  y: number,
  w: number,
  text: string,
  maxLines = 4,
): number {
  const lines = pdf.splitTextToSize(text, w - 10).slice(0, maxLines) as string[];
  const h = Math.max(12, lines.length * 4 + 7);
  setFill(pdf, SOFT_RED);
  pdf.rect(x, y, w, h, 'F');
  setStroke(pdf, RED);
  pdf.setLineWidth(0.8);
  pdf.line(x, y, x, y + h);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.8);
  setText(pdf, '#552b28');
  pdf.text('EXTRA DETAILS', x + 4, y + 5.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.2);
  pdf.text(lines, x + 4, y + 10);
  return y + h;
}

/** Height a noteBox will consume. */
function noteBoxHeight(pdf: Pdf, w: number, text: string, maxLines = 4): number {
  const lines = pdf.splitTextToSize(text, w - 10).slice(0, maxLines) as string[];
  return Math.max(12, lines.length * 4 + 7);
}

/** Blueprint-style garment outline (t-shirt path; generic for other garments). */
function garmentOutline(
  pdf: Pdf,
  cx: number,
  cy: number,
  scale: number,
  opts: { detail?: boolean; dashedLines?: Array<[number, number, number, number]>; labels?: string[] } = {},
) {
  // Path coordinates in a 300×360 design box. Actual bounds: x 32–268, y 43–307.
  const outline: [number, number][] = [
    [105, 55], [70, 69], [32, 110], [64, 139], [86, 118], [82, 307], [218, 307],
    [214, 118], [236, 139], [268, 110], [230, 69], [195, 55], [178, 43], [122, 43],
  ];
  const tx = (px: number, py: number): [number, number] => [
    cx + (px - 150) * scale,
    cy + (py - 180) * scale,
  ];

  setStroke(pdf, '#243b53');
  pdf.setLineWidth(0.5);

  const pts = outline.map(([px, py]) => tx(px, py));
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    pdf.line(a[0], a[1], b[0], b[1]);
  }

  if (opts.detail !== false) {
    setStroke(pdf, '#72869a');
    pdf.setLineWidth(0.3);
    const c1 = tx(122, 43);
    const c2 = tx(178, 43);
    pdf.line(c1[0], c1[1], c1[0] + (c2[0] - c1[0]) * 0.3, c1[1] + 8 * scale);
    pdf.line(c2[0], c2[1], c2[0] - (c2[0] - c1[0]) * 0.3, c2[1] + 8 * scale);
    const s1 = tx(64, 139);
    const s2 = tx(86, 118);
    pdf.line(s1[0], s1[1], s2[0], s2[1]);
    const s3 = tx(214, 118);
    const s4 = tx(236, 139);
    pdf.line(s3[0], s3[1], s4[0], s4[1]);
    const h1 = tx(82, 307);
    const h2 = tx(218, 307);
    pdf.line(h1[0], h1[1], h2[0], h2[1]);
  }

  if (opts.dashedLines) {
    setStroke(pdf, RED);
    pdf.setLineWidth(0.35);
    pdf.setLineDashPattern([1.2, 0.9], 0);
    opts.dashedLines.forEach(([x1, y1, x2, y2]) => {
      const a = tx(x1, y1);
      const b = tx(x2, y2);
      pdf.line(a[0], a[1], b[0], b[1]);
    });
    pdf.setLineDashPattern([], 0);
    (opts.labels ?? []).forEach((label, i) => {
      const dl = opts.dashedLines![i];
      if (!dl) return;
      const mid = tx((dl[0] + dl[2]) / 2, (dl[1] + dl[3]) / 2);
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(5.5);
      setText(pdf, RED);
      pdf.text(label, mid[0] + 1.5, mid[1] - 1.5);
    });
  }
}

/** Visual board with grid background (the blueprint panels). */
function visualBoard(
  pdf: Pdf,
  x: number,
  y: number,
  w: number,
  h: number,
  tag?: string,
) {
  setFill(pdf, 'ffffff');
  setStroke(pdf, LINE);
  pdf.setLineWidth(0.3);
  pdf.rect(x, y, w, h, 'FD');
  setStroke(pdf, '#e6e5e0');
  pdf.setLineWidth(0.1);
  for (let gx = x + 8; gx < x + w - 1; gx += 8) pdf.line(gx, y, gx, y + h);
  for (let gy = y + 8; gy < y + h - 1; gy += 8) pdf.line(x, gy, x + w, gy);
  if (tag) {
    setFill(pdf, SOFT_RED);
    pdf.roundedRect(x + 3, y + 3, tag.length * 1.9 + 5, 5.5, 2.75, 2.75, 'F');
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(5.8);
    setText(pdf, '#b9221c');
    pdf.text(tag.toUpperCase(), x + 5.5, y + 6.8);
  }
}

function table(
  pdf: Pdf,
  x: number,
  y: number,
  colWidths: number[],
  header: string[],
  rows: string[][],
  opts: { rowH?: number; maxRows?: number } = {},
): number {
  const rowH = opts.rowH ?? 7.5;
  const totalW = colWidths.reduce((a, b) => a + b, 0);

  // header
  setFill(pdf, INK);
  pdf.rect(x, y, totalW, rowH, 'F');
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(5.8);
  setText(pdf, '#ffffff');
  let cx = x;
  header.forEach((h, i) => {
    if (i === 0) {
      pdf.text(h.toUpperCase(), cx + 2, y + rowH / 2 + 1.2, { align: 'left' });
    } else {
      pdf.text(h.toUpperCase(), cx + colWidths[i] / 2, y + rowH / 2 + 1.2, { align: 'center' });
    }
    cx += colWidths[i];
  });

  // body (cap rows when space is tight; overflow noted in the last row)
  let visible = rows;
  if (opts.maxRows != null && rows.length > opts.maxRows) {
    const hidden = rows.length - (opts.maxRows - 1);
    visible = [
      ...rows.slice(0, opts.maxRows - 1),
      rows[0]!.map((_, ci) => (ci === 1 ? `… +${hidden} more not shown` : '')),
    ];
  }

  visible.forEach((row, ri) => {
    const ry = y + rowH * (ri + 1);
    if (ri % 2 === 1) {
      setFill(pdf, '#efeeea');
      pdf.rect(x, ry, totalW, rowH, 'F');
    }
    setStroke(pdf, LINE);
    pdf.setLineWidth(0.2);
    pdf.rect(x, ry, totalW, rowH, 'S');
    cx = x;
    row.forEach((cell, ci) => {
      pdf.setFont('helvetica', ci === 0 ? 'bold' : 'normal');
      pdf.setFontSize(6.6);
      setText(pdf, ci === 0 ? INK : '#454549');
      if (ci === 0) {
        pdf.text(cell, cx + 2, ry + rowH / 2 + 1.2, { align: 'left' });
      } else {
        pdf.text(cell, cx + colWidths[ci] / 2, ry + rowH / 2 + 1.2, { align: 'center' });
      }
      cx += colWidths[ci];
    });
  });
  return y + rowH * (visible.length + 1);
}

/** Table column widths that span the full content width. */
function spanWidths(first: number, middle: number[], last: number): number[] {
  return [first, ...middle, last];
}

/* ── page 01 · cover ───────────────────────────────────────────────────────── */

function pageCover(pdf: Pdf, d: TechPackData, opts: TechPackPageOptions, pageNum: number, total: number) {
  const W = pageDims(opts.paperSize).w;
  const H = pageDims(opts.paperSize).h;
  // Dark cover background with a subtle red glow (concentric fading rings)
  setFill(pdf, '#050506');
  pdf.rect(0, 0, W, H, 'F');
  const glowLayers: Array<[number, string]> = [
    [52, '#16090a'],
    [38, '#2a0d0c'],
    [26, '#43120f'],
    [16, '#6b1815'],
  ];
  glowLayers.forEach(([r, hex]) => {
    setFill(pdf, hex);
    pdf.circle(W * 0.82, H * 0.28, r, 'F');
  });

  chromeTopBar(pdf, W, 'FACTORY TECH PACK', true);

  const kickerY = 60;
  setStroke(pdf, RED);
  pdf.setLineWidth(1.4);
  pdf.line(16, kickerY - 1.5, 26, kickerY - 1.5);
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(8);
  setText(pdf, '#f06a63');
  pdf.text('PRECISION BUILT', 29, kickerY);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(42);
  setText(pdf, '#ffffff');
  pdf.text('Factory-ready', 16, kickerY + 22);
  setText(pdf, '#ef6d66');
  pdf.text('tech pack.', 16, kickerY + 38);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.6);
  setText(pdf, '#aaaab0');
  const blurb = pdf.splitTextToSize(
    `Complete production specification generated from the Ceriga Studio clothing builder. Every selected detail — ${d.garmentType.toLowerCase()} measurements, fabric, construction, artwork, trims and quantities — is arranged for fast sampling, quoting and manufacturing.`,
    106,
  );
  pdf.text(blurb.slice(0, 4), 16, kickerY + 50);

  // Tags
  const tagY = kickerY + 76;
  const tag = (t: string, x: number) => {
    const w = t.length * 1.75 + 8;
    setFill(pdf, '#1c1c20');
    pdf.roundedRect(x, tagY, w, 7, 3.5, 3.5, 'F');
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(5.8);
    setText(pdf, '#e9e9eb');
    pdf.text(t.toUpperCase(), x + 4, tagY + 4.6);
    return w;
  };
  let tagX = 16;
  tagX += tag('SELECTED CONFIGURATION', tagX) + 3;
  tag(`${opts.paperSize} LANDSCAPE · PRINT READY`, tagX);

  // Style number
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(7);
  setText(pdf, '#7f7f85');
  pdf.text('STYLE NUMBER', 16, tagY + 20);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  setText(pdf, '#ffffff');
  pdf.text(d.styleNumber, 16, tagY + 28);

  // Right card with technical drawing
  const cardX = W / 2 + 22;
  const cardY = 52;
  const cardW = W - cardX - 20;
  const cardH = 118;
  setStroke(pdf, '#3a3a3f');
  setFill(pdf, '#101014');
  pdf.setLineWidth(0.4);
  pdf.roundedRect(cardX, cardY, cardW, cardH, 3, 3, 'FD');
  // corner accents (top-left, bottom-right)
  setStroke(pdf, RED);
  pdf.setLineWidth(1.2);
  pdf.line(cardX, cardY, cardX + 5, cardY);
  pdf.line(cardX, cardY, cardX, cardY + 5);
  pdf.line(cardX + cardW - 5, cardY + cardH, cardX + cardW, cardY + cardH);
  pdf.line(cardX + cardW, cardY + cardH - 5, cardX + cardW, cardY + cardH);

  const coverImg = opts.images?.garmentPlain;
  if (coverImg) {
    const side = Math.min(cardW * 0.8, cardH * 0.82);
    try {
      pdf.addImage(coverImg, 'PNG', cardX + cardW / 2 - side / 2, cardY + cardH / 2 + 4 - side / 2, side, side, undefined, 'FAST');
    } catch {
      garmentOutline(pdf, cardX + cardW / 2, cardY + cardH / 2 + 4, scale, {
        dashedLines: [
          [150, 83, 150, 307],
          [86, 151, 214, 151],
          [82, 285, 218, 285],
        ],
        labels: ['A · LENGTH', 'B · CHEST', 'C · BOTTOM'],
      });
    }
  } else {
    garmentOutline(pdf, cardX + cardW / 2, cardY + cardH / 2 + 4, scale, {
      dashedLines: [
        [150, 83, 150, 307],
        [86, 151, 214, 151],
        [82, 285, 218, 285],
      ],
      labels: ['A · LENGTH', 'B · CHEST', 'C · BOTTOM'],
    });
  }

  chromeFooter(pdf, W, H, 'ceriga-studio.vercel.app', `${String(pageNum).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, true);
}

/* ── page 02 · style overview ──────────────────────────────────────────────── */

function pageStyleOverview(
  pdf: Pdf,
  d: TechPackData,
  opts: TechPackPageOptions,
  pageNum: number,
  total: number,
) {
  const W = pageDims(opts.paperSize).w;
  const H = pageDims(opts.paperSize).h;
  setFill(pdf, opts.background);
  pdf.rect(0, 0, W, H, 'F');
  chromeTopBar(pdf, W, `${d.styleNumber} / STYLE OVERVIEW`);
  sectionHead(pdf, W, '01 / Style', 'Style overview', 'Selected product and measurement settings from the clothing builder.');

  const overviewRows = [
    { label: 'Product', value: d.productBlueprint },
    { label: 'Project', value: d.title },
    { label: 'Fit type', value: d.fit },
    { label: 'Size range', value: d.sizeRange },
    { label: 'Sample size', value: d.sampleSizeLabel },
    { label: 'Measurement unit', value: d.measurementUnit },
  ];
  const panelH = 8 + fieldGridHeight(overviewRows.length, 2, 13) + 2;
  panel(pdf, MX, 56, W - 28, panelH);
  const used = fieldGrid(pdf, overviewRows, MX + 6, 61, W - 40);

  if (opts.frontBackViews) {
    const boardY = used + 8;
    const boardH = H - boardY - 20;
    const halfW = (W - 28 - 6) / 2;
    visualBoard(pdf, MX, boardY, halfW, boardH, 'Front');
    visualBoard(pdf, MX + halfW + 6, boardY, halfW, boardH, 'Back');
    const frontImg = opts.images?.garmentFront;
    const backImg = opts.images?.garmentBack;
    if (frontImg) {
      try {
        const side = Math.min(halfW * 0.8, boardH * 0.86);
        pdf.addImage(frontImg, 'PNG', MX + halfW / 2 - side / 2, boardY + boardH / 2 - side / 2, side, side, undefined, 'FAST');
      } catch {
        garmentOutline(pdf, MX + halfW / 2, boardY + boardH / 2, garmentFit(halfW * 0.8, boardH * 0.86));
      }
    } else {
      garmentOutline(pdf, MX + halfW / 2, boardY + boardH / 2, garmentFit(halfW * 0.8, boardH * 0.86));
    }
    if (backImg) {
      try {
        const side = Math.min(halfW * 0.8, boardH * 0.86);
        pdf.addImage(backImg, 'PNG', MX + halfW + 6 + halfW / 2 - side / 2, boardY + boardH / 2 - side / 2, side, side, undefined, 'FAST');
      } catch {
        garmentOutline(pdf, MX + halfW + 6 + halfW / 2, boardY + boardH / 2, garmentFit(halfW * 0.8, boardH * 0.86));
      }
    } else {
      garmentOutline(pdf, MX + halfW + 6 + halfW / 2, boardY + boardH / 2, garmentFit(halfW * 0.8, boardH * 0.86));
    }
  }

  chromeFooter(pdf, W, H, `Factory Tech Pack · ${d.title}`, `${String(pageNum).padStart(2, '0')} / ${String(total).padStart(2, '0')}`);
}

/* ── page 03 · measurement ─────────────────────────────────────────────────── */

function pageMeasurements(
  pdf: Pdf,
  d: TechPackData,
  opts: TechPackPageOptions,
  pageNum: number,
  total: number,
) {
  const W = pageDims(opts.paperSize).w;
  const H = pageDims(opts.paperSize).h;
  setFill(pdf, opts.background);
  pdf.rect(0, 0, W, H, 'F');
  chromeTopBar(pdf, W, `${d.styleNumber} / MEASUREMENT`);
  sectionHead(
    pdf,
    W,
    '02 / Measurement',
    'Size specification',
    `All values in ${d.measurementUnit === 'in' ? 'inches' : 'centimetres'}, measured garment flat.`,
  );

  const contentW = W - 28;
  const showTable = opts.measurementTable && d.measurements.length > 0;
  let y = 56;

  if (showTable) {
    const sizeCols = ORDER_SIZE_KEYS.map((k) => k.toUpperCase());
    // Point-of-measure + 6 sizes, spanning the full content width.
    const colWidths = spanWidths(
      contentW - ORDER_SIZE_KEYS.length * 28,
      ORDER_SIZE_KEYS.map(() => 28),
      0,
    );
    const rows = d.measurements.map((guide, gi) => {
      const letter = measurementGuideLetterAt(gi);
      const values = ORDER_SIZE_KEYS.map((size) => {
        const raw = d.measurementValues[guide.id]?.[size] ?? '';
        if (!raw) return '—';
        return formatMeasurementDisplay(raw, d.measurementUnit as MeasurementUnit);
      });
      return [`${letter} · ${guide.label}`, ...values];
    });
    // Board below needs ≥ 44mm: cap table height accordingly.
    // 11 rows fit while keeping the map board ≥ 44mm tall (56 + 12*7 = 140 ≤ 146).
    const maxTableRows = Math.max(3, Math.min(11, Math.floor((H - 56 - 64) / 7) - 1));
    y = table(pdf, MX, y, colWidths, ['Point of measure', ...sizeCols], rows, { rowH: 7, maxRows: maxTableRows });
    y += 2;
  } else {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    setText(pdf, MUTED);
    pdf.text(
      d.measurements.length === 0
        ? 'No measurements defined yet — the graded size table appears once the builder measurement step is completed.'
        : 'Measurement table disabled in export options.',
      MX,
      y + 4,
    );
    y += 16;
  }

  // Measurement map (left) + settings / extra details (right)
  const boardY = y + 6;
  const boardH = H - boardY - 20;
  const halfW = (contentW - 6) / 2;
  visualBoard(pdf, MX, boardY, halfW, boardH, 'Measurement map');
  garmentOutline(pdf, MX + halfW / 2, boardY + boardH / 2, garmentFit(halfW * 0.8, boardH * 0.86), {
    dashedLines: d.measurements.slice(0, 6).map((_, i) => {
      const presets: Array<[number, number, number, number]> = [
        [150, 83, 150, 307],
        [86, 151, 214, 151],
        [82, 285, 218, 285],
        [107, 62, 61, 127],
        [124, 51, 176, 51],
        [106, 60, 194, 60],
      ];
      return presets[i % presets.length];
    }),
    labels: d.measurements.slice(0, 6).map((_, i) => measurementGuideLetterAt(i)),
  });

  const rightX = MX + halfW + 6;
  panel(pdf, rightX, boardY, halfW, boardH, 'Measurement settings');
  const settingsBottom = fieldGrid(
    pdf,
    [
      { label: 'Fit type', value: d.fit },
      { label: 'Sample size', value: d.sampleSizeLabel },
      { label: 'Unit', value: d.measurementUnit },
      { label: 'Method', value: 'Garment flat' },
    ],
    rightX + 5,
    boardY + 11,
    halfW - 10,
  );
  const note = d.extraDetails.measurements?.trim()
    ?? (d.referenceUploadFileNames ? `Reference uploads: ${d.referenceUploadFileNames}` : '');
  if (note) {
    const noteH = noteBoxHeight(pdf, halfW, note, 3);
    noteBox(pdf, rightX + 5, Math.max(settingsBottom + 3, boardY + boardH - noteH - 4), halfW - 10, note, 3);
  }

  chromeFooter(pdf, W, H, 'Builder section · Measurement', `${String(pageNum).padStart(2, '0')} / ${String(total).padStart(2, '0')}`);
}

/* ── page 04 · fabric & colour ─────────────────────────────────────────────── */

function swatchCircle(pdf: Pdf, x: number, y: number, r: number, hex: string) {
  setFill(pdf, hex);
  pdf.setLineWidth(0.3);
  setStroke(pdf, '#bbbbbb');
  pdf.circle(x, y, r, 'FD');
}

function pageFabricColour(
  pdf: Pdf,
  d: TechPackData,
  opts: TechPackPageOptions,
  pageNum: number,
  total: number,
) {
  const W = pageDims(opts.paperSize).w;
  const H = pageDims(opts.paperSize).h;
  setFill(pdf, opts.background);
  pdf.rect(0, 0, W, H, 'F');
  chromeTopBar(pdf, W, `${d.styleNumber} / FABRIC & COLOUR`);
  sectionHead(pdf, W, '03 / Materials', 'Fabric & colour', 'All selected values from the Fabric & Colour builder section.');

  const contentW = W - 28;
  const halfW = (contentW - 6) / 2;
  const topPanelH = 40;

  // Fabric settings panel
  panel(pdf, MX, 56, halfW, topPanelH, 'Fabric settings');
  fieldGrid(
    pdf,
    d.fabricRows.slice(0, 4).map((r) => ({ label: r.label, value: r.value })),
    MX + 5,
    63,
    halfW - 10,
  );

  // Colour selection panel (swatches centred inside THIS panel)
  const colours = d.colors.length > 0 ? d.colors : [{ hex: '#FFFFFF', pantone: '' }];
  const colourPanelX = MX + halfW + 6;
  panel(pdf, colourPanelX, 56, halfW, topPanelH, 'Colour selection');
  const shown = colours.slice(0, 5);
  shown.forEach((c, i) => {
    const cx = colourPanelX + halfW / 2 + (i - (shown.length - 1) / 2) * 17;
    swatchCircle(pdf, cx, 76, 5.5, c.hex);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.4);
    setText(pdf, INK);
    pdf.text(c.hex.toUpperCase(), cx, 87.5, { align: 'center' });
    if (c.pantone) {
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(5);
      setText(pdf, MUTED);
      pdf.text(clampText(c.pantone.toUpperCase(), 12), cx, 91.5, { align: 'center' });
    }
  });

  // Option highlight cards
  const cardY = 102;
  const cardW = (contentW - 12) / 3;
  const cards = [
    { tag: 'FABRIC TYPE', value: d.fabricRows.find((r) => r.label === 'Fabric type')?.value ?? '—' },
    { tag: 'BASE COLOUR', value: colours[0]?.hex.toUpperCase() ?? '—' },
    { tag: 'GSM', value: (d.fabricRows.find((r) => r.label === 'Fabric weight')?.value ?? '—').replace(/\s*GSM$/i, '') },
  ];
  cards.forEach((card, i) => {
    const cx = MX + i * (cardW + 6);
    setStroke(pdf, LINE);
    setFill(pdf, 'ffffff');
    pdf.setLineWidth(0.3);
    pdf.roundedRect(cx, cardY, cardW, 20, 2, 2, 'FD');
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(5.8);
    setText(pdf, RED);
    pdf.text(card.tag, cx + 4, cardY + 6.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    setText(pdf, INK);
    pdf.text(clampText(card.value, 22), cx + 4, cardY + 14.5);
  });

  // Base garment board + extra details note
  const note = d.extraDetails.fabric?.trim();
  const noteH = note ? noteBoxHeight(pdf, contentW, note, 2) + 4 : 0;
  if (opts.materialCallouts) {
    const boardY = cardY + 28;
    const boardH = H - 20 - noteH - boardY;
    visualBoard(pdf, MX, boardY, contentW, boardH, `${d.garmentType} base`);
    const plainImg = opts.images?.garmentPlain;
    if (plainImg) {
      try {
        const side = Math.min(contentW * 0.7, boardH * 0.84);
        pdf.addImage(plainImg, 'PNG', MX + contentW / 2 - side / 2, boardY + boardH / 2 - side / 2, side, side, undefined, 'FAST');
      } catch {
        garmentOutline(pdf, MX + contentW / 2, boardY + boardH / 2, garmentFit(contentW * 0.7, boardH * 0.84));
      }
    } else {
      garmentOutline(pdf, MX + contentW / 2, boardY + boardH / 2, garmentFit(contentW * 0.7, boardH * 0.84));
    }
    if (colours[0] && colours[0].hex.toUpperCase() !== '#FFFFFF') {
      setFill(pdf, colours[0].hex);
      pdf.circle(MX + 14, boardY + 16, 3, 'F');
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(5);
      setText(pdf, MUTED);
      pdf.text('BASE COLOUR', MX + 19, boardY + 17.5);
    }
  }
  if (note) {
    noteBox(pdf, MX, H - 20 - noteH + 4, contentW, note, 2);
  }

  chromeFooter(pdf, W, H, 'Builder section · Fabric & Colour', `${String(pageNum).padStart(2, '0')} / ${String(total).padStart(2, '0')}`);
}

/* ── page 05 · construction ────────────────────────────────────────────────── */

function pageConstruction(
  pdf: Pdf,
  d: TechPackData,
  opts: TechPackPageOptions,
  pageNum: number,
  total: number,
) {
  const W = pageDims(opts.paperSize).w;
  const H = pageDims(opts.paperSize).h;
  setFill(pdf, opts.background);
  pdf.rect(0, 0, W, H, 'F');
  chromeTopBar(pdf, W, `${d.styleNumber} / CONSTRUCTION`);
  sectionHead(pdf, W, '04 / Construction', 'Selected construction', 'Neck, sleeves, hem & cuffs, pockets & zips, fading and stitching selections.');

  const contentW = W - 28;
  const rows = d.constructionRows;
  const cols = 4;
  const cardW = (contentW - (cols - 1) * 5) / cols;
  const cardH = 24;
  // Trim / thread colours associated with each construction card.
  const cardColorFor: Record<string, string | undefined> = {
    'Neck / collar': d.trims.neckTrimColor,
    'Sleeves': d.trims.sleeveTrimColor,
    'Cuffs': d.trims.cuffTrimColor,
    'Pockets': d.trims.pocketTrimColor,
    'Stitching': d.stitchingColor,
  };
  rows.slice(0, 8).forEach((row, i) => {
    const cx = MX + (i % cols) * (cardW + 5);
    const cy = 56 + Math.floor(i / cols) * (cardH + 5);
    setStroke(pdf, LINE);
    setFill(pdf, 'ffffff');
    pdf.setLineWidth(0.3);
    pdf.roundedRect(cx, cy, cardW, cardH, 2, 2, 'FD');
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(5.4);
    setText(pdf, RED);
    pdf.text(row.label.toUpperCase(), cx + 3.5, cy + 6);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    setText(pdf, INK);
    const value = pdf.splitTextToSize(row.value, cardW - 7).slice(0, 2);
    pdf.text(value, cx + 3.5, cy + 11.5);
    const swatch = cardColorFor[row.label];
    if (swatch) {
      // Trim / thread colour swatch pinned to the card's top-right corner.
      setFill(pdf, swatch);
      pdf.setLineWidth(0.25);
      setStroke(pdf, '#bbbbbb');
      pdf.circle(cx + cardW - 4.5, cy + 4.5, 2, 'FD');
    }
  });

  const gridRows = Math.ceil(Math.min(rows.length, 8) / cols);
  const mapY = 56 + gridRows * (cardH + 5) + 8;
  const mapH = H - mapY - 20;
  const halfW = (contentW - 6) / 2;

  if (opts.detailsImage && mapH > 40) {
    visualBoard(pdf, MX, mapY, halfW, mapH, 'Construction map');
    const constrImg = opts.images?.garmentPlain;
    if (constrImg) {
      try {
        const side = Math.min(halfW * 0.8, mapH * 0.86);
        pdf.addImage(constrImg, 'PNG', MX + halfW / 2 - side / 2, mapY + mapH / 2 - side / 2, side, side, undefined, 'FAST');
      } catch {
        garmentOutline(pdf, MX + halfW / 2, mapY + mapH / 2, garmentFit(halfW * 0.8, mapH * 0.86), {
          dashedLines: [
            [150, 43, 150, 83],
            [61, 110, 86, 139],
            [82, 285, 218, 307],
          ],
          labels: ['01 NECK', '02 SLEEVE', '03 HEM'],
        });
      }
    } else {
      garmentOutline(pdf, MX + halfW / 2, mapY + mapH / 2, fitC, {
        dashedLines: [
          [150, 43, 150, 83],
          [61, 110, 86, 139],
          [82, 285, 218, 307],
        ],
        labels: ['01 NECK', '02 SLEEVE', '03 HEM'],
      });
    }

    // Right panel: per-section extra-detail notes (real builder notes).
    const rightX = MX + halfW + 6;
    panel(pdf, rightX, mapY, halfW, mapH, 'Construction notes');
    const noteSources: Array<{ label: string; key: 'neck' | 'sleeves' | 'hem' | 'pockets' | 'stitching' | 'fading' }> = [
      { label: 'Neck', key: 'neck' },
      { label: 'Sleeves', key: 'sleeves' },
      { label: 'Hem & cuffs', key: 'hem' },
      { label: 'Pockets', key: 'pockets' },
      { label: 'Stitching', key: 'stitching' },
      { label: 'Fading', key: 'fading' },
    ];
    const notes = noteSources
      .map((n) => ({ label: n.label, text: d.extraDetails[n.key]?.trim() ?? '' }))
      .filter((n) => n.text.length > 0)
      .slice(0, 4);

    let ny = mapY + 11;
    if (opts.constructionNotes && notes.length > 0) {
      const rowH = 12.5;
      const maxRows = Math.max(
        1,
        Math.floor((mapH - 22) / rowH),
      );
      notes.slice(0, maxRows).forEach((n) => {
        pdf.setFont('courier', 'bold');
        pdf.setFontSize(5.4);
        setText(pdf, RED);
        pdf.text(n.label.toUpperCase(), rightX + 5, ny + 2.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6.8);
        setText(pdf, '#454549');
        const lines = pdf.splitTextToSize(n.text, halfW - 12).slice(0, 2);
        pdf.text(lines, rightX + 5, ny + 7);
        ny += rowH;
      });
    } else {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(7);
      setText(pdf, MUTED);
      pdf.text(
        opts.constructionNotes
          ? 'No additional construction notes entered.'
          : 'Construction notes disabled in export options.',
        rightX + 5,
        ny + 3,
      );
    }
    // Standard seam-allowance line pinned to the panel bottom.
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(5.4);
    setText(pdf, MUTED);
    pdf.text('SEAM ALLOWANCE 10 MM UNLESS OTHERWISE STATED', rightX + 5, mapY + mapH - 4);
  }

  chromeFooter(pdf, W, H, 'Builder sections · Neck / Sleeves / Hem / Pockets / Fading / Stitching', `${String(pageNum).padStart(2, '0')} / ${String(total).padStart(2, '0')}`);
}

/* ── page 06 · prints & design ─────────────────────────────────────────────── */

/** Draw a print element inside a zone rectangle (design space 335×400). */
function drawPrintElement(
  pdf: Pdf,
  el: TechPackPrintRow,
  zone: { x: number; y: number; w: number; h: number },
  designW = 335,
  designH = 400,
) {
  const sx = zone.w / designW;
  const sy = zone.h / designH;
  const cx = zone.x + el.x * sx;
  const cy = zone.y + el.y * sy;
  const w = Math.max(2, el.width * sx);
  const h = Math.max(2, el.height * sy);

  if (el.kind === 'image') {
    if (el.content.startsWith('data:')) {
      try {
        const fmt = el.content.slice(5, el.content.indexOf(';')) as 'PNG' | 'JPEG';
        pdf.addImage(el.content, fmt === 'JPEG' ? 'JPEG' : 'PNG', cx - w / 2, cy - h / 2, w, h, undefined, 'FAST', el.rotation);
      } catch {
        /* ignore malformed image */
      }
    } else {
      // Remote / non-embedded artwork can't be drawn reliably in print —
      // draw a dashed placeholder box instead of dumping the URL as text.
      setStroke(pdf, '#b9221c');
      pdf.setLineWidth(0.25);
      pdf.setLineDashPattern([1.4, 1], 0);
      pdf.rect(cx - w / 2, cy - h / 2, w, h, 'S');
      pdf.setLineDashPattern([], 0);
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(5);
      setText(pdf, '#b9221c');
      pdf.text('ARTWORK — SEE SCHEDULE', cx, cy, { align: 'center', baseline: 'middle' });
    }
  } else {
    const fontSize = (el.fontSize ?? 30) * ((sx + sy) / 2);
    pdf.setFont('helvetica', el.fontStyle === 'italic' ? 'bolditalic' : 'bold');
    pdf.setFontSize(Math.max(4, Math.min(48, fontSize)));
    let text = el.content;
    if (el.textTransform === 'uppercase') text = text.toUpperCase();
    if (el.textTransform === 'lowercase') text = text.toLowerCase();
    setText(pdf, el.color ?? '#ffffff');
    const align = (el.textAlign ?? 'center') as 'left' | 'center' | 'right';
    try {
      pdf.text(text, cx, cy, {
        align,
        baseline: 'middle',
        angle: el.rotation,
        maxWidth: el.kind === 'text' ? w : undefined,
      });
    } catch {
      pdf.text(clampText(text, 40), cx, cy, { align: 'center', baseline: 'middle' });
    }
  }
}

function describePlacement(p: TechPackPrintRow): string {
  const xPct = Math.round((p.x / 335) * 100);
  const yPct = Math.round((p.y / 400) * 100);
  let zone = 'Centre';
  if (xPct < 40) zone = 'Left';
  else if (xPct > 60) zone = 'Right';
  const vPos = yPct < 40 ? 'upper' : yPct > 60 ? 'lower' : 'mid';
  return `${zone} ${vPos} · x ${xPct}% / y ${yPct}%`;
}

function pagePrints(
  pdf: Pdf,
  d: TechPackData,
  opts: TechPackPageOptions,
  pageNum: number,
  total: number,
) {
  const W = pageDims(opts.paperSize).w;
  const H = pageDims(opts.paperSize).h;
  setFill(pdf, opts.background);
  pdf.rect(0, 0, W, H, 'F');
  chromeTopBar(pdf, W, `${d.styleNumber} / PRINTS & DESIGN`);
  sectionHead(pdf, W, '05 / Artwork', 'Prints & design', 'Uploaded designs, added text and selected placement from the builder canvas.');

  const contentW = W - 28;
  const footerSafe = H - 16;

  if (!opts.artworkPages) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    setText(pdf, MUTED);
    pdf.text('Artwork pages disabled in export options.', MX, 66);
    chromeFooter(pdf, W, H, 'Builder section · Prints & Design', `${String(pageNum).padStart(2, '0')} / ${String(total).padStart(2, '0')}`);
    return;
  }

  const halfW = (contentW - 6) / 2;
  const zoneH = 78;

  const drawView = (x: number, view: 'front' | 'back') => {
    const boxH = zoneH + 14;
    setStroke(pdf, LINE);
    setFill(pdf, 'ffffff');
    pdf.setLineWidth(0.3);
    pdf.rect(x, 56, halfW, boxH, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    setText(pdf, INK);
    pdf.text(view === 'front' ? 'Front view' : 'Back view', x + 4, 63);
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(5.5);
    setText(pdf, view === 'front' ? RED : MUTED);
    pdf.text('BUILDER CANVAS', x + halfW - 4, 63, { align: 'right' });
    setStroke(pdf, '#eceae5');
    pdf.line(x + 4, 65.5, x + halfW - 4, 65.5);

    const zoneY = 68;
    setStroke(pdf, '#f0efeb');
    pdf.setLineWidth(0.1);
    for (let gx = x + 7; gx < x + halfW - 1; gx += 7) pdf.line(gx, zoneY, gx, zoneY + zoneH);
    for (let gy = zoneY + 7; gy < zoneY + zoneH - 1; gy += 7) pdf.line(x, gy, x + halfW, gy);

    const zone = { x: x + halfW * 0.14, y: zoneY + 3, w: halfW * 0.72, h: zoneH - 6 };
    const canvasImg = view === 'front' ? opts.images?.printCanvasFront : null;
    let drewBitmap = false;
    if (canvasImg) {
      try {
        const imgH = zoneH + 2;
        const imgW = imgH; // square canvas
        pdf.addImage(canvasImg, 'PNG', x + halfW / 2 - imgW / 2, zoneY - 1, imgW, imgH, undefined, 'FAST');
        drewBitmap = true;
      } catch {
        drewBitmap = false;
      }
    }
    if (!drewBitmap) {
      garmentOutline(pdf, x + halfW / 2, zoneY + zoneH / 2, garmentFit(halfW * 0.7, zoneH * 0.84));
      // Builder canvas is a single front-facing zone — render every print element onto it.
      d.prints.forEach((p) => drawPrintElement(pdf, p, zone));
    }
    return 56 + boxH;
  };
  const viewsBottom = Math.max(drawView(MX, 'front'), drawView(MX + halfW + 6, 'back'));

  // Print schedule table
  const tableY = viewsBottom + 8;
  if (d.prints.length > 0) {
    const colWidths = spanWidths(16, [96, 24, 34], contentW - 170);
    const rows = d.prints.map((p, i) => [
      `A${String(i + 1).padStart(2, '0')}`,
      p.kind === 'text'
        ? clampText(`Text: ${p.content}`, 44)
        : clampText(`Uploaded artwork (${p.name})`, 44),
      p.kind === 'text'
        ? 'Text'
        : (p.content.startsWith('data:')
            ? (p.content.slice(5, p.content.indexOf(';')).toUpperCase() || 'IMAGE')
            : 'Image (ref)'),
      p.printMethod,
      describePlacement(p),
    ]);
    const maxRows = Math.max(1, Math.floor((footerSafe - tableY) / 6.5) - 1);
    table(
      pdf,
      MX,
      tableY,
      colWidths,
      ['Ref', 'Element', 'Type', 'Print method', 'Placement (builder zone)'],
      rows,
      { rowH: 6.5, maxRows },
    );
  } else {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7.5);
    setText(pdf, MUTED);
    pdf.text('No prints, text or artwork layers on this style yet.', MX, tableY + 4);
  }

  chromeFooter(pdf, W, H, 'Builder section · Prints & Design', `${String(pageNum).padStart(2, '0')} / ${String(total).padStart(2, '0')}`);
}

/* ── page 07 · labels & packaging ──────────────────────────────────────────── */

function pageLabelsPackaging(
  pdf: Pdf,
  d: TechPackData,
  opts: TechPackPageOptions,
  pageNum: number,
  total: number,
) {
  const W = pageDims(opts.paperSize).w;
  const H = pageDims(opts.paperSize).h;
  setFill(pdf, opts.background);
  pdf.rect(0, 0, W, H, 'F');
  chromeTopBar(pdf, W, `${d.styleNumber} / LABELS & PACKAGING`);
  sectionHead(pdf, W, '06 / Trims', 'Labels & packaging', 'All selected label and packaging values from the builder.');

  const contentW = W - 28;
  const halfW = (contentW - 6) / 2;
  const panelH = 98;

  // ── Labels panel ──
  panel(pdf, MX, 56, halfW, panelH, 'Labels');
  const previewH = 32;
  setStroke(pdf, '#aaaaaa');
  setFill(pdf, 'ffffff');
  pdf.setLineWidth(0.3);
  pdf.setLineDashPattern([1.2, 1], 0);
  pdf.rect(MX + 5, 66, halfW - 10, previewH, 'FD');
  pdf.setLineDashPattern([], 0);
  const lw = 40;
  const lh = 20;
  const lx = MX + halfW / 2 - lw / 2;
  const ly = 66 + (previewH - lh) / 2;
  const labelImg = opts.images?.label;
  if (labelImg) {
    try {
      pdf.addImage(labelImg, 'PNG', lx, ly, lw, lh, undefined, 'FAST');
    } catch {
      /* fall through to vector preview */
    }
  }
  if (!labelImg) {
    setFill(pdf, d.labelColor && d.labelColor.toUpperCase() !== '#FFFFFF' ? d.labelColor : INK);
    pdf.rect(lx, ly, lw, lh, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    setText(pdf, '#ffffff');
    pdf.text('CERIGA', lx + lw / 2, ly + lh / 2 - 1, { align: 'center' });
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(5.5);
    setText(pdf, '#aaaaaa');
    pdf.text(`STUDIO · ${d.sampleSizeLabel}`, lx + lw / 2, ly + lh / 2 + 4, { align: 'center' });
  }

  fieldGrid(
    pdf,
    [
      { label: 'Main label', value: labelTypeLabel(d.labelType) },
      { label: 'Placement', value: d.labelType === 'none' ? '—' : 'CB neck seam' },
      { label: 'Label layers', value: d.labelPrints.length ? `${d.labelPrints.length} element(s)` : 'None' },
      { label: 'Label colour', value: d.labelColor ?? '—' },
    ],
    MX + 5,
    102,
    halfW - 10,
  );
  const labelNote = d.extraDetails.labels?.trim();
  if (labelNote) {
    const noteH = noteBoxHeight(pdf, halfW - 10, labelNote, 2);
    noteBox(pdf, MX + 5, 56 + panelH - noteH - 4, halfW - 10, labelNote, 2);
  }

  // ── Packaging panel ──
  const px = MX + halfW + 6;
  panel(pdf, px, 56, halfW, panelH, 'Packaging');
  const pkgH = 32;
  setStroke(pdf, LINE);
  setFill(pdf, '#e8e8e8');
  pdf.setLineWidth(0.3);
  pdf.rect(px + 5, 66, halfW - 10, pkgH, 'FD');
  const pkgImg = opts.images?.packaging;
  if (pkgImg) {
    try {
      const pad = 3;
      const availW = halfW - 10 - pad * 2;
      const availH = pkgH - pad * 2;
      const imgRatio = 0.8; // renderPackagingPng is w×0.8w
      let dw = availW;
      let dh = dw * imgRatio;
      if (dh > availH) {
        dh = availH;
        dw = dh / imgRatio;
      }
      pdf.addImage(pkgImg, 'PNG', px + 5 + pad + (availW - dw) / 2, 66 + pad + (availH - dh) / 2, dw, dh, undefined, 'FAST');
    } catch {
      /* fall through to vector preview */
    }
  }
  if (!pkgImg) {
    setFill(pdf, '#f6f6f6');
    pdf.rect(px + 10, 71, halfW - 20, pkgH - 10, 'FD');
    setFill(pdf, d.packagingColor && d.packagingColor.toUpperCase() !== '#F5F5F5' ? d.packagingColor : INK);
    pdf.rect(px + 16, 78, halfW - 32, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    setText(pdf, '#ffffff');
    pdf.text('CERIGA STUDIO', px + halfW / 2, 83.3, { align: 'center' });
  }

  fieldGrid(
    pdf,
    [
      { label: 'Pack type', value: packagingTypeLabel(d.packagingType) },
      { label: 'Packaging layers', value: d.packagingPrints.length ? `${d.packagingPrints.length} element(s)` : 'None' },
      { label: 'Packaging colour', value: d.packagingColor ?? '—' },
      { label: 'Warning print', value: d.packagingType === 'none' ? '—' : 'Required' },
    ],
    px + 5,
    102,
    halfW - 10,
  );
  const pkgNote = d.extraDetails.packaging?.trim();
  if (pkgNote) {
    const noteH = noteBoxHeight(pdf, halfW - 10, pkgNote, 2);
    noteBox(pdf, px + 5, 56 + panelH - noteH - 4, halfW - 10, pkgNote, 2);
  }

  // ── Component schedule table ──
  const tableY = 56 + panelH + 8;
  const rows: string[][] = [];
  if (d.labelType !== 'none') {
    rows.push([
      'Main neck label',
      labelTypeLabel(d.labelType),
      `${d.labelColor ?? '#000000'} / white`,
      'Centre back neck',
    ]);
  }
  if (d.packagingType !== 'none') {
    rows.push([
      'Packaging',
      packagingTypeLabel(d.packagingType),
      d.packagingColor ?? '—',
      'Each unit',
    ]);
  }
  d.labelPrints.forEach((lp, i) => {
    rows.push([
      `Label artwork ${i + 1}`,
      lp.kind === 'text' ? clampText(`Text: ${lp.content}`, 46) : 'Uploaded artwork',
      lp.color ?? '—',
      'Per label artwork',
    ]);
  });
  if (rows.length > 0) {
    const maxRows = Math.max(1, Math.floor((H - 16 - tableY) / 6.5) - 1);
    table(
      pdf,
      MX,
      tableY,
      spanWidths(40, [56, 72], contentW - 168),
      ['Component', 'Specification', 'Artwork / colour', 'Placement'],
      rows,
      { rowH: 6.5, maxRows },
    );
  } else {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7.5);
    setText(pdf, MUTED);
    pdf.text('No custom labels or packaging selected for this style.', MX, tableY + 4);
  }

  chromeFooter(pdf, W, H, 'Builder sections · Labels / Packaging', `${String(pageNum).padStart(2, '0')} / ${String(total).padStart(2, '0')}`);
}

/* ── page 08 · order quantities ────────────────────────────────────────────── */

function pageQuantities(
  pdf: Pdf,
  d: TechPackData,
  opts: TechPackPageOptions,
  pageNum: number,
  total: number,
) {
  const W = pageDims(opts.paperSize).w;
  const H = pageDims(opts.paperSize).h;
  setFill(pdf, opts.background);
  pdf.rect(0, 0, W, H, 'F');
  chromeTopBar(pdf, W, `${d.styleNumber} / ORDER QUANTITIES`);
  sectionHead(pdf, W, '07 / Production', 'Order quantities', 'Sample sizes and bulk quote tiers selected in the builder.');

  const contentW = W - 28;
  let y = 58;

  if (opts.quantities) {
    // Order type + 6 sizes + Total = 8 columns, spanning full content width.
    const colWidths = spanWidths(
      contentW - ORDER_SIZE_KEYS.length * 26 - 26,
      ORDER_SIZE_KEYS.map(() => 26),
      26,
    );
    const rows = d.quantities.map((q) => [
      q.label,
      ...ORDER_SIZE_KEYS.map((k) => String(q.bySize[k] ?? 0)),
      String(q.total),
    ]);
    y = table(pdf, MX, y, colWidths, ['Order type', ...ORDER_SIZE_KEYS.map((k) => k.toUpperCase()), 'Total'], rows, { rowH: 8 });

    // Mode / total panels
    const panelY = y + 6;
    const halfW = (contentW - 6) / 2;
    panel(pdf, MX, panelY, halfW, 16);
    fieldGrid(
      pdf,
      [{ label: 'Mode', value: d.quantities.some((q) => q.total > 0) ? 'Specified per size' : 'Not set' }],
      MX + 5,
      panelY + 4,
      halfW - 10,
    );
    panel(pdf, MX + halfW + 6, panelY, halfW, 16);
    fieldGrid(
      pdf,
      [{ label: 'Total units', value: String(d.quantities.reduce((sum, q) => sum + q.total, 0)) }],
      MX + halfW + 11,
      panelY + 4,
      halfW - 10,
    );
    y = panelY + 22;

    // Bulk tier breakdown
    const bulkLines = d.quantities.filter((q) => q.label.startsWith('Bulk'));
    if (bulkLines.length > 0) {
      const bulkH = 14 + bulkLines.length * 7;
      panel(pdf, MX, y, contentW, bulkH, 'Bulk quote tiers');
      let ty = y + 12;
      bulkLines.forEach((q) => {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.2);
        setText(pdf, INK);
        pdf.text(clampText(q.label, 24), MX + 6, ty + 2.5);
        pdf.setFont('courier', 'normal');
        pdf.setFontSize(6.4);
        setText(pdf, '#454549');
        pdf.text(
          ORDER_SIZE_KEYS.map((k) => `${k.toUpperCase()} ${q.bySize[k] ?? 0}`).join('  ·  '),
          MX + 44,
          ty + 2.5,
        );
        ty += 7;
      });
      y += bulkH + 6;
    }
  } else {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    setText(pdf, MUTED);
    pdf.text('Quantities hidden in export options.', MX, y + 4);
    y += 16;
  }

  // Revision history
  const sigSpace = 22;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  setText(pdf, INK);
  pdf.text('Revision history', MX, y + 4);
  const revHeaderY = y + 8;
  setFill(pdf, INK);
  pdf.rect(MX, revHeaderY, contentW, 7, 'F');
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(5.8);
  setText(pdf, '#ffffff');
  pdf.text('REV.', MX + 3, revHeaderY + 4.6);
  pdf.text('DATE', MX + 18, revHeaderY + 4.6);
  pdf.text('DESCRIPTION', MX + 42, revHeaderY + 4.6);
  pdf.text('APPROVED', W - MX - 28, revHeaderY + 4.6);
  setStroke(pdf, LINE);
  setFill(pdf, 'ffffff');
  pdf.setLineWidth(0.2);
  pdf.rect(MX, revHeaderY + 7, contentW, 8, 'FD');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  setText(pdf, MUTED);
  pdf.text('—', MX + 3, revHeaderY + 14);
  pdf.text(new Date().toLocaleDateString('en-GB'), MX + 18, revHeaderY + 14);
  pdf.text('Generated from builder state at export time.', MX + 42, revHeaderY + 14);
  const revBottom = revHeaderY + 15;

  // Approval signatures (only when they fit above the footer)
  const sigY = Math.max(revBottom + 8, H - sigSpace);
  if (sigY + 8 <= H - 14) {
    const sigW = (contentW - 12) / 3;
    ['Pattern approval', 'Production approval', 'Brand sign-off'].forEach((label, i) => {
      const sx = MX + i * (sigW + 6);
      setStroke(pdf, INK);
      pdf.setLineWidth(0.4);
      pdf.line(sx, sigY, sx + sigW - 8, sigY);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      setText(pdf, MUTED);
      pdf.text(label, sx, sigY + 4);
    });
  }

  chromeFooter(pdf, W, H, 'Builder sections · Order Quantities / Review & Export', `${String(pageNum).padStart(2, '0')} / ${String(total).padStart(2, '0')}`);
}

/* ── entry point ───────────────────────────────────────────────────────────── */

/**
 * Rasterize the builder's real visuals for PDF embedding. Best-effort:
 * any failure (no DOM, tainted canvas, unsupported type) simply omits that
 * image and the PDF falls back to its vector drawing.
 */
export async function resolveTechPackImages(d: TechPackData): Promise<TechPackImages | undefined> {
  if (typeof document === 'undefined') return undefined;
  const v = d.visual;
  if (!v) return undefined;
  try {
    const rz = await import('./techPackRasterize');
    const garmentInput = {
      garmentType: v.garmentType,
      baseColor: v.baseColor,
      tshirtAssetSelection: v.tshirtAssetSelection,
      neckTrimColor: v.neckTrimColor,
      sleeveTrimColor: v.sleeveTrimColor,
      cuffTrimColor: v.cuffTrimColor,
      pocketTrimColor: v.pocketTrimColor,
      tshirtLayerTransforms: v.tshirtLayerTransforms,
    };
    const [garmentFront, printCanvasFront, label, packaging] = await Promise.all([
      rz.renderGarmentPng(garmentInput),
      rz.renderPrintFrontPng({
        ...garmentInput,
        prints: v.prints,
        printZoneWidth: v.printZoneWidth,
        printZoneHeight: v.printZoneHeight,
      }),
      rz.renderLabelPng({ color: v.labelColor, labelType: v.labelType, sampleSize: d.sampleSizeLabel }),
      rz.renderPackagingPng({ color: v.packagingColor, packagingType: v.packagingType }),
    ]);
    return {
      garmentFront,
      garmentBack: garmentFront,
      garmentPlain: garmentFront,
      printCanvasFront,
      label,
      packaging,
    };
  } catch (err) {
    console.warn('Tech pack image rasterization skipped', err);
    return undefined;
  }
}

export type TechPackPdfResult = {
  /** jsPDF blob — ready to download or upload. */
  blob: Blob;
  fileName: string;
  pageCount: number;
};

export function buildTechPackPdf(
  d: TechPackData,
  options: Partial<TechPackPageOptions> = {},
): TechPackPdfResult {
  const opts: TechPackPageOptions = {
    detailsImage: true,
    measurementTable: true,
    materialCallouts: true,
    frontBackViews: true,
    constructionNotes: true,
    artworkPages: true,
    quantities: true,
    paperSize: 'A4',
    background: PAPER,
    images: undefined,
    ...options,
  };

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: opts.paperSize === 'Letter' ? 'letter' : 'a4',
    compress: true,
  });

  const activePages: Array<(p: number, t: number) => void> = [
    (n, t) => pageCover(pdf, d, opts, n, t),
    (n, t) => pageStyleOverview(pdf, d, opts, n, t),
    (n, t) => pageMeasurements(pdf, d, opts, n, t),
    (n, t) => pageFabricColour(pdf, d, opts, n, t),
    (n, t) => pageConstruction(pdf, d, opts, n, t),
  ];
  if (opts.artworkPages) {
    activePages.push((n, t) => pagePrints(pdf, d, opts, n, t));
  }
  activePages.push((n, t) => pageLabelsPackaging(pdf, d, opts, n, t));
  if (opts.quantities) {
    activePages.push((n, t) => pageQuantities(pdf, d, opts, n, t));
  }

  const total = activePages.length;
  activePages.forEach((render, i) => {
    if (i > 0) pdf.addPage(opts.paperSize === 'Letter' ? 'letter' : 'a4', 'landscape');
    render(i + 1, total);
  });

  const safeName = d.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'tech-pack';
  const fileName = `Ceriga-Tech-Pack-${safeName}-${d.styleNumber}.pdf`;
  return { blob: pdf.output('blob'), fileName, pageCount: total };
}

export async function downloadTechPackPdf(d: TechPackData, options: Partial<TechPackPageOptions> = {}) {
  // Rasterize the real builder visuals (garment composite, artwork, label,
  // packaging) before building — jsPDF can only embed PNG/JPEG data.
  const images = await resolveTechPackImages(d);
  const { blob, fileName } = buildTechPackPdf(d, { ...options, images });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
