/**
 * Job A mockup for the boxy pullover hoodie.
 * Raster first (keyed line art), then potrace. Never author path data by hand.
 *
 * Follows scripts/collar/MOCKUP_PROCESS.md:
 *   contrast 1.35, luminance ramp (246 / 120),
 *   alpha upsample 3x, threshold 128,
 *   turdsize 4, minority, alphamax 1.0, opticurve,
 *   even-odd, viewBox = source pixel size.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Jimp = require('jimp');
const potrace = require('potrace');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const WHITE_CUTOFF = 246;
const INK_CUTOFF = 120;
const CONTRAST = 1.35;
const TRACE_SS = 3;
const INK_THRESHOLD = 32;
const CANVAS = 2048;
const INK_COLOR = '#141414';

/** Demo colours follow the test-tee colour-block: one solid per construction panel. */
const PALETTE = [
  '#6BA3D6',
  '#E07A3D',
  '#111111',
  '#F4F4F0',
  '#CC2D24',
  '#6B7280',
  '#1F9D5B',
  '#7C3AED',
];

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function alphaFor(lum) {
  if (lum >= WHITE_CUTOFF) return 0;
  if (lum <= INK_CUTOFF) return 255;
  return Math.round(((WHITE_CUTOFF - lum) / (WHITE_CUTOFF - INK_CUTOFF)) * 255);
}

function keyWhite(image) {
  const keyed = new Jimp(image.bitmap.width, image.bitmap.height, 0x00000000);
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    const contrasted = [
      Math.max(0, Math.min(255, (r - 128) * CONTRAST + 128)),
      Math.max(0, Math.min(255, (g - 128) * CONTRAST + 128)),
      Math.max(0, Math.min(255, (b - 128) * CONTRAST + 128)),
    ];
    const a = alphaFor(luminance(...contrasted));
    const o = keyed.bitmap.data;
    const oi = idx;
    o[oi] = 0;
    o[oi + 1] = 0;
    o[oi + 2] = 0;
    o[oi + 3] = a;
  });
  return keyed;
}

function compositeOnWhite(img) {
  const bg = new Jimp(img.bitmap.width, img.bitmap.height, 0xffffffff);
  return bg.composite(img, 0, 0);
}

function inkMask(keyed) {
  const { width, height, data } = keyed.bitmap;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    mask[i] = data[i * 4 + 3] >= INK_THRESHOLD ? 1 : 0;
  }
  return { mask, width, height };
}

function maskToJimp(mask, width, height, invert) {
  const img = new Jimp(width, height, 0xffffffff);
  const d = img.bitmap.data;
  for (let i = 0; i < mask.length; i++) {
    const ink = invert ? !mask[i] : mask[i];
    const v = ink ? 0 : 255;
    const o = i * 4;
    d[o] = v;
    d[o + 1] = v;
    d[o + 2] = v;
    d[o + 3] = 255;
  }
  return img;
}

function upsampleMask(mask, width, height, ss) {
  const bigW = width * ss;
  const bigH = height * ss;
  const src = maskToJimp(mask, width, height, false);
  src.resize(bigW, bigH, Jimp.RESIZE_BICUBIC);
  const out = new Uint8Array(bigW * bigH);
  const d = src.bitmap.data;
  for (let i = 0; i < out.length; i++) {
    out[i] = d[i * 4] < 128 ? 1 : 0;
  }
  return { mask: out, width: bigW, height: bigH };
}

function countSubpaths(d) {
  return (d.match(/M/g) || []).length;
}

function extractPathD(svg) {
  const match = svg.match(/<path d="([^"]+)"/);
  if (!match) throw new Error('potrace returned no path data');
  return match[1];
}

async function traceBitmap(image, sourceW, sourceH) {
  const buffer = Buffer.isBuffer(image)
    ? image
    : await image.getBufferAsync(Jimp.MIME_PNG);
  return new Promise((resolve, reject) => {
    const tracer = new potrace.Potrace({
      turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY,
      turdSize: 4,
      alphaMax: 1.0,
      optCurve: true,
      optTolerance: 0.2,
      threshold: 128,
      blackOnWhite: true,
      color: '#000000',
      background: potrace.Potrace.COLOR_TRANSPARENT,
      width: sourceW,
      height: sourceH,
    });
    tracer.loadImage(buffer, (err) => {
      if (err) return reject(err);
      const svg = tracer.getSVG();
      const d = extractPathD(svg);
      resolve({ svg, d, subpaths: countSubpaths(d), instance: tracer });
    });
  });
}

function wrapSourceSvg(d, width, height, title) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">\n` +
    `<title>${title}</title>\n` +
    `<path d="${d}" fill="#000000" fill-rule="evenodd"/>\n` +
    `</svg>\n`
  );
}

function mapToBuilder(x, y, width, height) {
  const scale = CANVAS / Math.max(width, height);
  const offsetX = (CANVAS - width * scale) / 2;
  const offsetY = (CANVAS - height * scale) / 2;
  return [
    10 * (offsetX + x * scale),
    10 * (CANVAS - offsetY - y * scale),
  ];
}

function transformPath(d, mapper) {
  return d.replace(/([MLC])([^MLC]*)/gi, (_, cmd, raw) => {
    const nums = raw.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const out = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const [x, y] = mapper(nums[i], nums[i + 1]);
      out.push(`${Math.round(x)} ${Math.round(y)}`);
    }
    return `${cmd}${out.join(' ')}`;
  });
}

function wrapBuilderSvg(title, fillD, inkD) {
  const group = '<g transform="translate(0,2048) scale(0.1,-0.1)"';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" ` +
    `viewBox="0 0 ${CANVAS} ${CANVAS}">\n` +
    `<title>${title}</title>\n` +
    `${group} fill="#000000" stroke="none">\n` +
    `<path d="${fillD}" fill-rule="evenodd"/>\n` +
    `</g>\n` +
    `${group} fill="${INK_COLOR}" stroke="none">\n` +
    `<path d="${inkD}" fill="${INK_COLOR}" fill-rule="evenodd"/>\n` +
    `</g>\n` +
    `</svg>\n`
  );
}

function parseSubpaths(d) {
  const token = /([MLCZ])([^MLCZ]*)/gi;
  const subpaths = [];
  let current = [];
  let cursor = [0, 0];
  let match;
  while ((match = token.exec(d))) {
    const cmd = match[1].toUpperCase();
    const nums = match[2].trim() ? match[2].trim().split(/[\s,]+/).map(Number) : [];
    if (cmd === 'M') {
      if (current.length > 2) subpaths.push(current);
      cursor = [nums[0], nums[1]];
      current = [cursor];
    } else if (cmd === 'L') {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        cursor = [nums[i], nums[i + 1]];
        current.push(cursor);
      }
    } else if (cmd === 'C') {
      for (let i = 0; i + 5 < nums.length; i += 6) {
        const c1 = [nums[i], nums[i + 1]];
        const c2 = [nums[i + 2], nums[i + 3]];
        const end = [nums[i + 4], nums[i + 5]];
        current.push(...flattenCubic(cursor, c1, c2, end));
        cursor = end;
      }
    } else if (cmd === 'Z') {
      if (current.length > 2) subpaths.push(current);
      current = [];
    }
  }
  if (current.length > 2) subpaths.push(current);
  return subpaths;
}

function flattenCubic(p0, p1, p2, p3) {
  const span =
    Math.abs(p1[0] - p0[0]) + Math.abs(p1[1] - p0[1]) +
    Math.abs(p2[0] - p1[0]) + Math.abs(p2[1] - p1[1]) +
    Math.abs(p3[0] - p2[0]) + Math.abs(p3[1] - p2[1]);
  const steps = Math.max(3, Math.min(48, Math.floor(span / 1.5) + 3));
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push([
      u ** 3 * p0[0] + 3 * u ** 2 * t * p1[0] + 3 * u * t ** 2 * p2[0] + t ** 3 * p3[0],
      u ** 3 * p0[1] + 3 * u ** 2 * t * p1[1] + 3 * u * t ** 2 * p2[1] + t ** 3 * p3[1],
    ]);
  }
  return pts;
}

function rasterizePath(d, srcW, srcH, width, ss) {
  const height = Math.round((width * srcH) / srcW);
  const gw = width * ss;
  const gh = height * ss;
  const scale = gw / srcW;
  const acc = new Uint8Array(gw * gh);
  const subpaths = parseSubpaths(d);
  for (const poly of subpaths) {
    const xs = poly.map((p) => p[0] * scale);
    const ys = poly.map((p) => p[1] * scale);
    fillPolygonXor(acc, gw, gh, xs, ys);
  }
  const out = new Jimp(width, height, 0x00000000);
  const data = out.bitmap.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          sum += acc[(y * ss + sy) * gw + (x * ss + sx)];
        }
      }
      const a = Math.round((sum / (ss * ss)) * 255);
      const i = (y * width + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = a;
    }
  }
  return out;
}

function fillPolygonXor(acc, w, h, xs, ys) {
  let minY = h;
  let maxY = 0;
  for (const y of ys) {
    minY = Math.min(minY, Math.floor(y));
    maxY = Math.max(maxY, Math.ceil(y));
  }
  minY = Math.max(0, minY);
  maxY = Math.min(h - 1, maxY);
  const n = xs.length;
  for (let y = minY; y <= maxY; y++) {
    const scan = y + 0.5;
    const hits = [];
    for (let i = 0; i < n; i++) {
      const x1 = xs[i];
      const y1 = ys[i];
      const x2 = xs[(i + 1) % n];
      const y2 = ys[(i + 1) % n];
      if ((y1 <= scan && y2 > scan) || (y2 <= scan && y1 > scan)) {
        const t = (scan - y1) / (y2 - y1);
        hits.push(x1 + t * (x2 - x1));
      }
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const x0 = Math.max(0, Math.floor(hits[i]));
      const x1 = Math.min(w, Math.ceil(hits[i + 1]));
      const row = y * w;
      for (let x = x0; x < x1; x++) acc[row + x] ^= 1;
    }
  }
}

function neighbors4(x, y, w, h, fn) {
  if (x > 0) fn(x - 1, y);
  if (x + 1 < w) fn(x + 1, y);
  if (y > 0) fn(x, y - 1);
  if (y + 1 < h) fn(x, y + 1);
}

function floodBool(seedMask, w, h, predicate) {
  const seen = new Uint8Array(w * h);
  const qx = [];
  const qy = [];
  for (let x = 0; x < w; x++) {
    if (predicate(x, 0)) { qx.push(x); qy.push(0); seen[x] = 1; }
    if (predicate(x, h - 1)) { qx.push(x); qy.push(h - 1); seen[(h - 1) * w + x] = 1; }
  }
  for (let y = 0; y < h; y++) {
    if (predicate(0, y) && !seen[y * w]) { qx.push(0); qy.push(y); seen[y * w] = 1; }
    if (predicate(w - 1, y) && !seen[y * w + w - 1]) {
      qx.push(w - 1); qy.push(y); seen[y * w + w - 1] = 1;
    }
  }
  let head = 0;
  while (head < qx.length) {
    const x = qx[head];
    const y = qy[head++];
    neighbors4(x, y, w, h, (nx, ny) => {
      const i = ny * w + nx;
      if (seen[i] || !predicate(nx, ny)) return;
      seen[i] = 1;
      qx.push(nx);
      qy.push(ny);
    });
  }
  return seen;
}

function enclosed(ink, w, h) {
  const outside = floodBool(ink, w, h, (x, y) => ink[y * w + x] === 0);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = outside[i] ? 0 : 1;
  return out;
}

function labelComponents(open, w, h) {
  const labels = new Int32Array(w * h);
  let id = 0;
  const qx = [];
  const qy = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!open[i] || labels[i]) continue;
      id += 1;
      qx.length = 0;
      qy.length = 0;
      qx.push(x);
      qy.push(y);
      labels[i] = id;
      let head = 0;
      while (head < qx.length) {
        const cx = qx[head];
        const cy = qy[head++];
        neighbors4(cx, cy, w, h, (nx, ny) => {
          const ni = ny * w + nx;
          if (!open[ni] || labels[ni]) return;
          labels[ni] = id;
          qx.push(nx);
          qy.push(ny);
        });
      }
    }
  }
  return { labels, count: id };
}

function regionStats(labels, id, w, h) {
  let area = 0;
  let sx = 0;
  let sy = 0;
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (labels[y * w + x] !== id) continue;
      area += 1;
      sx += x;
      sy += y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return {
    id,
    area,
    cx: sx / Math.max(area, 1),
    cy: sy / Math.max(area, 1),
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function fillHoles(mask, width, height) {
  const border = floodBool(mask, width, height, (x, y) => mask[y * width + x] === 0);
  const filled = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) filled[i] = mask[i] || !border[i] ? 1 : 0;
  return filled;
}

function dilate(mask, width, height, radius) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(height - 1, y + radius);
      for (let ny = y0; ny <= y1; ny++) {
        for (let nx = x0; nx <= x1; nx++) out[ny * width + nx] = 1;
      }
    }
  }
  return out;
}

function erode(mask, width, height, radius) {
  const inv = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) inv[i] = mask[i] ? 0 : 1;
  const grown = dilate(inv, width, height, radius);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = grown[i] ? 0 : 1;
  return out;
}

function closeMask(mask, width, height, radius) {
  const joined = dilate(mask, width, height, radius);
  return erode(fillHoles(joined, width, height), width, height, radius);
}

/** Keep fills off the construction stroke so the line is the colour cutoff. */
const SEAM_GAP = 4;

function garmentBBox(mask, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function mergeRuns(runs, gap) {
  if (!runs.length) return [];
  const out = [{ ...runs[0] }];
  for (let i = 1; i < runs.length; i++) {
    const prev = out[out.length - 1];
    if (runs[i].x0 - prev.x1 <= gap) prev.x1 = runs[i].x1;
    else out.push({ ...runs[i] });
  }
  return out;
}

function rowRuns(garment, y, width, x0, x1, gap, minWidth) {
  const runs = [];
  let inRun = false;
  let start = x0;
  for (let x = x0; x <= x1; x++) {
    const on = garment[y * width + x];
    if (on && !inRun) {
      inRun = true;
      start = x;
    } else if (!on && inRun) {
      runs.push({ x0: start, x1: x - 1 });
      inRun = false;
    }
  }
  if (inRun) runs.push({ x0: start, x1 });
  return mergeRuns(runs, gap).filter((run) => run.x1 - run.x0 + 1 >= minWidth);
}

function detectHoodieLandmarks(garment, width, height) {
  const bbox = garmentBBox(garment, width, height);
  const gap = Math.max(6, Math.round(bbox.width * 0.01));
  const minWidth = Math.max(10, Math.round(bbox.width * 0.035));
  const rows = [];
  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    rows.push({
      y,
      runs: rowRuns(garment, y, width, bbox.minX, bbox.maxX, gap, minWidth),
    });
  }

  const three = rows.filter((row) => row.runs.length >= 3);
  const sleeveStart = three[0]?.y ?? Math.round(bbox.minY + bbox.height * 0.32);
  const bodyEnd = three.at(-1)?.y ?? Math.round(bbox.minY + bbox.height * 0.84);
  const midThree = three[Math.floor(three.length * 0.42)] ?? three[0];
  const bodyRun = midThree
    ? midThree.runs[Math.floor((midThree.runs.length - 1) / 2)]
    : { x0: bbox.minX + Math.round(bbox.width * 0.22), x1: bbox.maxX - Math.round(bbox.width * 0.22) };
  const midX = Math.round((bodyRun.x0 + bodyRun.x1) / 2);

  const hemSample = rows.find((row) => row.y === bodyEnd) ?? rows.at(-1);
  const hemRun =
    (hemSample?.runs.length ?? 0) >= 3
      ? hemSample.runs[Math.floor((hemSample.runs.length - 1) / 2)]
      : hemSample?.runs[0] ?? bodyRun;
  const hemWidth = hemRun.x1 - hemRun.x0 + 1;
  let hemTop = Math.max(sleeveStart + 20, bodyEnd - Math.round(bbox.height * 0.08));
  for (let y = bodyEnd; y > sleeveStart; y--) {
    const row = rows[y - bbox.minY];
    const center =
      row.runs.length >= 3 ? row.runs[Math.floor((row.runs.length - 1) / 2)] : row.runs[0];
    if (center && center.x1 - center.x0 + 1 > hemWidth * 1.08) {
      hemTop = y;
      break;
    }
  }

  const leftBottomRows = rows.filter((row) =>
    row.runs.some((run) => run.x1 < midX - bbox.width * 0.12),
  );
  const rightBottomRows = rows.filter((row) =>
    row.runs.some((run) => run.x0 > midX + bbox.width * 0.12),
  );
  const leftLast = leftBottomRows.at(-1);
  const rightLast = rightBottomRows.at(-1);
  const cuffBottom = Math.max(leftLast?.y ?? bbox.maxY, rightLast?.y ?? bbox.maxY);
  const leftCuffRun = leftLast?.runs[0];
  const cuffWidth = leftCuffRun ? leftCuffRun.x1 - leftCuffRun.x0 + 1 : Math.round(bbox.width * 0.14);
  let cuffTop = Math.max(hemTop, cuffBottom - Math.round(bbox.height * 0.09));
  for (let i = leftBottomRows.length - 1; i >= 0; i--) {
    const run = leftBottomRows[i].runs[0];
    if (run && run.x1 - run.x0 + 1 > cuffWidth * 1.28) {
      cuffTop = leftBottomRows[i].y;
      break;
    }
  }

  const boxes = {
    leftSleeve: {
      x0: bbox.minX,
      x1: bodyRun.x0 - SEAM_GAP,
      y0: sleeveStart,
      y1: cuffTop - SEAM_GAP,
    },
    rightSleeve: {
      x0: bodyRun.x1 + SEAM_GAP,
      x1: bbox.maxX,
      y0: sleeveStart,
      y1: cuffTop - SEAM_GAP,
    },
    leftCuff: {
      x0: bbox.minX,
      x1: bodyRun.x0 - SEAM_GAP,
      y0: cuffTop + SEAM_GAP,
      y1: cuffBottom,
    },
    rightCuff: {
      x0: bodyRun.x1 + SEAM_GAP,
      x1: bbox.maxX,
      y0: cuffTop + SEAM_GAP,
      y1: cuffBottom,
    },
    hem: {
      x0: Math.min(bodyRun.x0, hemRun.x0),
      x1: Math.max(bodyRun.x1, hemRun.x1),
      y0: hemTop + SEAM_GAP,
      y1: bodyEnd,
    },
  };

  return { bbox, boxes, sleeveStart, hemTop, bodyEnd, cuffTop, cuffBottom, midX, threeCount: three.length };
}

function boxCenter(box) {
  return [
    Math.round((box.x0 + box.x1) / 2),
    Math.round((box.y0 + box.y1) / 2),
  ];
}

function hoodSeeds(labels, width, bbox, sleeveStart) {
  const seeds = [];
  const seen = new Set();
  const y1 = Math.max(bbox.minY + 8, sleeveStart - 6);
  const step = Math.max(16, Math.round(bbox.width / 24));
  for (let y = bbox.minY + 12; y < y1; y += step) {
    for (let x = bbox.minX + 16; x < bbox.maxX - 16; x += step) {
      const id = labels[y * width + x];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      seeds.push([x, y]);
    }
  }
  if (!seeds.length) {
    seeds.push([Math.round((bbox.minX + bbox.maxX) / 2), Math.round(bbox.minY + bbox.height * 0.12)]);
  }
  return seeds;
}

function classifyInteriorCells(stats, bbox) {
  const midX = (bbox.minX + bbox.maxX) / 2;
  const cells = stats.map((s) => ({
    ...s,
    taken: false,
    relX: (s.cx - midX) / Math.max(bbox.width / 2, 1),
    relY: (s.cy - bbox.minY) / Math.max(bbox.height, 1),
  }));

  const pick = (pred, cmp = (a, b) => b.area - a.area) => {
    const list = cells.filter((cell) => !cell.taken && pred(cell));
    if (!list.length) return null;
    list.sort(cmp);
    list[0].taken = true;
    return list[0];
  };

  const hoodCells = cells.filter((cell) => cell.relY < 0.3);
  for (const cell of hoodCells) cell.taken = true;

  const body = pick((cell) => Math.abs(cell.relX) < 0.48 && cell.relY > 0.26 && cell.relY < 0.78);
  const pocket = pick((cell) => Math.abs(cell.relX) < 0.3 && cell.relY > 0.46 && cell.relY < 0.82);
  const leftSleeve = pick((cell) => cell.relX < -0.36 && cell.relY > 0.28 && cell.relY < 0.78);
  const rightSleeve = pick((cell) => cell.relX > 0.36 && cell.relY > 0.28 && cell.relY < 0.78);
  const hem = pick((cell) => cell.relY > 0.76 && Math.abs(cell.relX) < 0.5);
  const leftCuff = pick((cell) => cell.relX < -0.4 && cell.relY > 0.7);
  const rightCuff = pick((cell) => cell.relX > 0.4 && cell.relY > 0.7);

  return { hoodCells, hem, leftCuff, rightCuff, leftSleeve, rightSleeve, pocket, body, midX };
}

function cellBox(cell, pad = 2) {
  return {
    x0: cell.minX - pad,
    x1: cell.maxX + pad,
    y0: cell.minY - pad,
    y1: cell.maxY + pad,
  };
}

function boxesFromCells(classified, bbox, garment, labels, width) {
  const left = classified.leftSleeve;
  const right = classified.rightSleeve;
  const body = classified.body || classified.pocket;
  const bodyX0 = body?.minX ?? Math.round(bbox.minX + bbox.width * 0.22);
  const bodyX1 = body?.maxX ?? Math.round(bbox.maxX - bbox.width * 0.22);
  const midX = Math.round((bbox.minX + bbox.maxX) / 2);
  const hemTop = Math.min(
    body?.maxY ?? bbox.minY + Math.round(bbox.height * 0.8),
    classified.hem?.minY ?? Number.POSITIVE_INFINITY,
  );

  let hemBottom = hemTop;
  for (let y = hemTop; y <= bbox.maxY; y++) {
    if (garment[y * width + midX]) hemBottom = y;
  }
  let lowerBodyRun = { x0: bodyX0, x1: bodyX1, count: 0 };
  if (body) {
    for (let y = hemTop - 1; y >= Math.max(body.minY, hemTop - 32); y--) {
      let x0 = width;
      let x1 = -1;
      let count = 0;
      for (let x = bbox.minX; x <= bbox.maxX; x++) {
        if (labels[y * width + x] !== body.id) continue;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        count++;
      }
      if (count >= Math.max(24, Math.round(bbox.width * 0.1))) {
        lowerBodyRun = { x0, x1, count };
        break;
      }
    }
  }

  const sideBottom = (x0, x1) => {
    let bottom = hemTop;
    for (let y = hemTop; y <= bbox.maxY; y++) {
      for (let x = x0; x <= x1; x++) {
        if (garment[y * width + x]) bottom = y;
      }
    }
    return bottom;
  };
  const leftCuffTop = left?.maxY ?? Math.round(bbox.minY + bbox.height * 0.9);
  const rightCuffTop = right?.maxY ?? leftCuffTop;
  const leftBottom = sideBottom(
    bbox.minX,
    Math.round(bbox.minX + bbox.width * 0.24),
  );
  const rightBottom = sideBottom(
    Math.round(bbox.maxX - bbox.width * 0.24),
    bbox.maxX,
  );

  return {
    leftSleeve: {
      x0: left?.minX ?? bbox.minX,
      x1: left?.maxX ?? bodyX0 - SEAM_GAP,
      y0: left?.minY ?? Math.round(bbox.minY + bbox.height * 0.3),
      y1: leftCuffTop - SEAM_GAP,
    },
    rightSleeve: {
      x0: right?.minX ?? bodyX1 + SEAM_GAP,
      x1: right?.maxX ?? bbox.maxX,
      y0: right?.minY ?? Math.round(bbox.minY + bbox.height * 0.3),
      y1: rightCuffTop - SEAM_GAP,
    },
    leftCuff: {
      x0: left?.minX ?? bbox.minX,
      x1: left?.maxX ?? bodyX0 - SEAM_GAP,
      y0: leftCuffTop + SEAM_GAP,
      y1: leftBottom,
    },
    rightCuff: {
      x0: right?.minX ?? bodyX1 + SEAM_GAP,
      x1: right?.maxX ?? bbox.maxX,
      y0: rightCuffTop + SEAM_GAP,
      y1: rightBottom,
    },
    hem: {
      // The sleeve/body construction cells terminate at the actual side-seam
      // lines. Clamp the waistband to those lines so it cannot claim sleeve
      // pixels even when the outer silhouettes overlap at the junction.
      x0: Math.max(lowerBodyRun.x0, left?.maxX ?? lowerBodyRun.x0),
      x1: Math.min(lowerBodyRun.x1, right?.minX ?? lowerBodyRun.x1),
      y0: hemTop + SEAM_GAP,
      y1: hemBottom,
    },
  };
}

function hoodSeedsAboveBody(labels, width, bodyTop) {
  const seeds = [];
  const seen = new Set();
  for (let y = 0; y < bodyTop; y++) {
    for (let x = 0; x < width; x++) {
      const id = labels[y * width + x];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      seeds.push([x, y]);
    }
  }
  return seeds;
}

function makePartSeeds(classified, boxes, labels, width) {
  const seedsFor = (cell, fallback) =>
    cell ? [[Math.round(cell.cx), Math.round(cell.cy)]] : [fallback];
  const hoodSeedsList = hoodSeedsAboveBody(
    labels,
    width,
    classified.body?.minY ?? boxes.leftSleeve.y0,
  );
  if (!hoodSeedsList.length) {
    hoodSeedsList.push([classified.midX, Math.round((boxes.leftSleeve.y0 + 40) / 2)]);
  }
  const hemTop = boxes.hem.y0;
  return [
    {
      name: 'Body',
      seeds: seedsFor(classified.body, [classified.midX, Math.round((boxes.leftSleeve.y0 + hemTop) / 2)]),
      maxY: hemTop - SEAM_GAP,
    },
    {
      name: 'Kangaroo pocket',
      seeds: seedsFor(classified.pocket, [classified.midX, Math.round(hemTop - 40)]),
      maxY: hemTop - SEAM_GAP,
    },
    { name: 'Left sleeve', seeds: seedsFor(classified.leftSleeve, boxCenter(boxes.leftSleeve)), box: boxes.leftSleeve },
    { name: 'Right sleeve', seeds: seedsFor(classified.rightSleeve, boxCenter(boxes.rightSleeve)), box: boxes.rightSleeve },
    { name: 'Left cuff', box: boxes.leftCuff, fromGarment: true, close: true },
    { name: 'Right cuff', box: boxes.rightCuff, fromGarment: true, close: true },
    { name: 'Hood', seeds: hoodSeedsList },
    { name: 'Rib hem', box: boxes.hem, fromGarment: true, close: true },
  ];
}

function clipToBox(mask, width, height, box) {
  const out = new Uint8Array(mask.length);
  const x0 = Math.max(0, box.x0);
  const x1 = Math.min(width - 1, box.x1);
  const y0 = Math.max(0, box.y0);
  const y1 = Math.min(height - 1, box.y1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * width + x;
      if (mask[i]) out[i] = 1;
    }
  }
  return out;
}

function garmentInBox(garment, width, height, box) {
  const mask = new Uint8Array(garment.length);
  const x0 = Math.max(0, box.x0);
  const x1 = Math.min(width - 1, box.x1);
  const y0 = Math.max(0, box.y0);
  const y1 = Math.min(height - 1, box.y1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * width + x;
      if (garment[i]) mask[i] = 1;
    }
  }
  return mask;
}

function subtractMask(base, cut) {
  const out = new Uint8Array(base.length);
  for (let i = 0; i < base.length; i++) out[i] = base[i] && !cut[i] ? 1 : 0;
  return out;
}

function andMask(a, b) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] && b[i] ? 1 : 0;
  return out;
}

function padBox(box, pad, y0Pad = pad) {
  return {
    x0: box.x0 - pad,
    x1: box.x1 + pad,
    y0: box.y0 - y0Pad,
    y1: box.y1 + pad,
  };
}

function partitionGarmentMasks(candidates, growthDomain, outputDomain, width, height) {
  const priority = [
    'Hood',
    'Kangaroo pocket',
    'Left cuff',
    'Right cuff',
    'Rib hem',
    'Left sleeve',
    'Right sleeve',
    'Body',
  ];
  const owner = new Uint8Array(growthDomain.length);
  const queue = new Int32Array(growthDomain.length);
  let queueLength = 0;

  for (let ownerId = 1; ownerId <= priority.length; ownerId++) {
    const mask = candidates[priority[ownerId - 1]];
    if (!mask) continue;
    for (let i = 0; i < mask.length; i++) {
      if (!growthDomain[i] || !mask[i] || owner[i]) continue;
      owner[i] = ownerId;
      queue[queueLength++] = i;
    }
  }

  for (let cursor = 0; cursor < queueLength; cursor++) {
    const i = queue[cursor];
    const x = i % width;
    const neighbours = [
      i - width,
      i + width,
      x > 0 ? i - 1 : -1,
      x < width - 1 ? i + 1 : -1,
    ];
    for (const next of neighbours) {
      if (
        next < 0 ||
        next >= growthDomain.length ||
        !growthDomain[next] ||
        owner[next]
      ) continue;
      owner[next] = owner[i];
      queue[queueLength++] = next;
    }
  }

  const partitioned = Object.fromEntries(
    priority.map((name) => [name, new Uint8Array(outputDomain.length)]),
  );
  let missing = 0;
  for (let i = 0; i < outputDomain.length; i++) {
    if (!outputDomain[i]) continue;
    if (!owner[i]) {
      missing++;
      continue;
    }
    partitioned[priority[owner[i] - 1]][i] = 1;
  }
  if (missing) throw new Error(`unassigned garment pixels: ${missing}`);
  return partitioned;
}

function buildNamedMasks(labels, garment, ink, width, height, partSeeds) {
  const interiors = subtractMask(garment, ink);
  const parts = [];
  const byName = {};
  for (const entry of partSeeds) {
    let mask = new Uint8Array(labels.length);
    if (entry.fromGarment && entry.box) {
      mask = garmentInBox(interiors, width, height, entry.box);
    } else {
      const ids = [];
      for (const [sx, sy] of entry.seeds || []) {
        const regionId = labels[sy * width + sx];
        if (!regionId) {
          console.log(`  !! ${entry.name}: seed (${sx}, ${sy}) is not inside a region`);
          continue;
        }
        ids.push(regionId);
      }
      for (const regionId of ids) {
        for (let i = 0; i < labels.length; i++) {
          if (labels[i] !== regionId) continue;
          const y = Math.floor(i / width);
          if (entry.maxY != null && y > entry.maxY) continue;
          mask[i] = 1;
        }
      }
      if (entry.box) mask = clipToBox(mask, width, height, entry.box);
    }
    /*
     * Seeded construction cells already stop at the drawn seam. Do not
     * fill their holes here: doing so can bridge a curved body/sleeve seam
     * and let the sleeve claim waistband pixels on the other side.
     */
    let filled = entry.close
      ? clipToBox(closeMask(mask, width, height, 4), width, height, entry.box)
      : mask;
    if (entry.box) filled = clipToBox(filled, width, height, entry.box);
    byName[entry.name] = filled;
  }

  /*
   * Assign every non-ink fabric pixel to exactly one panel. Construction-line
   * pixels remain reserved for the fixed black outline layer, forming a clean
   * separator that no neighbouring colour can cross.
   */
  const partitioned = partitionGarmentMasks(
    byName,
    garment,
    interiors,
    width,
    height,
  );

  for (const entry of partSeeds) {
    const filled = partitioned[entry.name];
    const area = filled.reduce((n, v) => n + v, 0);
    if (area < 200) {
      console.log(`  !! ${entry.name}: empty after clip`);
      continue;
    }
    parts.push({ name: entry.name, mask: filled, area, ids: [], box: entry.box });
  }
  return parts;
}

function maskFromLabel(labels, id) {
  const mask = new Uint8Array(labels.length);
  for (let i = 0; i < labels.length; i++) mask[i] = labels[i] === id ? 1 : 0;
  return mask;
}

async function traceMask(mask, width, height, invert = false) {
  const img = maskToJimp(mask, width, height, invert);
  const big = img.resize(width * TRACE_SS, height * TRACE_SS, Jimp.RESIZE_NEAREST_NEIGHBOR);
  return traceBitmap(big, width, height);
}

function writeProof(labels, count, w, h, dest) {
  const img = new Jimp(w, h, 0xffffffff);
  const hues = [];
  for (let i = 1; i <= count; i++) {
    const hue = (i * 47) % 360;
    hues[i] = hue;
  }
  img.scan(0, 0, w, h, function (x, y, idx) {
    const id = labels[y * w + x];
    if (!id) return;
    const hue = hues[id];
    const rgb = hslToRgb(hue / 360, 0.55, 0.58);
    this.bitmap.data[idx] = rgb[0];
    this.bitmap.data[idx + 1] = rgb[1];
    this.bitmap.data[idx + 2] = rgb[2];
    this.bitmap.data[idx + 3] = 255;
  });
  return img.writeAsync(dest);
}

function hslToRgb(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

export async function packHoodie({ fit, source, output, photo = '', onlyPart, skipRaster = false }) {
  const FIT = fit;
  const LINEART_SRC = path.resolve(source);
  const PHOTO_SRC = photo;
  const OUT = path.resolve(output);
  if (OUT.startsWith(path.join(ROOT, 'src', 'assets') + path.sep)) {
    throw new Error('Generate into staging, never into live assets');
  }
  fs.mkdirSync(OUT, { recursive: true });
  if (!fs.existsSync(LINEART_SRC)) {
    throw new Error(`missing line art: ${LINEART_SRC}`);
  }
  if (PHOTO_SRC && fs.existsSync(PHOTO_SRC)) {
    fs.copyFileSync(PHOTO_SRC, path.join(OUT, 'reference.png'));
  }
  fs.copyFileSync(LINEART_SRC, path.join(OUT, 'hoodie-lineart-bold.png'));

  console.log(`pack ${FIT}`);
  console.log('key white (luminance ramp)...');
  const lineart = await Jimp.read(LINEART_SRC);
  const keyed = keyWhite(lineart);
  await keyed.writeAsync(path.join(OUT, 'hoodie-lineart-transparent.png'));
  await compositeOnWhite(keyed).writeAsync(path.join(OUT, 'hoodie-lineart.png'));

  const { mask, width, height } = inkMask(keyed);
  const inkCount = mask.reduce((n, v) => n + v, 0);
  const transparent = [...keyed.bitmap.data].filter((_, i) => i % 4 === 3 && keyed.bitmap.data[i] === 0).length;
  const total = width * height;
  console.log(`source ${width}x${height}, ink ${inkCount}px, fully transparent ${(transparent / total * 100).toFixed(1)}%`);

  console.log('upsample 3x, potrace...');
  const up = upsampleMask(mask, width, height, TRACE_SS);
  let bitmap = maskToJimp(up.mask, up.width, up.height, false);
  let traced = await traceBitmap(bitmap, width, height);
  if (traced.subpaths < 40) {
    console.log(`polarity looks wrong (${traced.subpaths} subpaths) — inverting and retrying`);
    bitmap = maskToJimp(up.mask, up.width, up.height, true);
    traced = await traceBitmap(bitmap, width, height);
  }
  console.log(`SVG subpaths: ${traced.subpaths}`);
  if (traced.subpaths < 40) {
    throw new Error('SVG polarity is still wrong (too few subpaths)');
  }

  const sourceSvg = wrapSourceSvg(traced.d, width, height, `${FIT} pullover hoodie`);
  fs.writeFileSync(path.join(OUT, 'hoodie-lineart.svg'), sourceSvg);
  console.log('wrote hoodie-lineart.svg');

  if (!skipRaster && !process.env.SKIP_RASTER) {
    console.log('raster 2048...');
    const v2048 = rasterizePath(traced.d, width, height, 2048, 2);
    await v2048.writeAsync(path.join(OUT, 'hoodie-vector-2048.png'));
    console.log('raster 4096...');
    const v4096 = rasterizePath(traced.d, width, height, 4096, 1);
    await v4096.writeAsync(path.join(OUT, 'hoodie-vector-4096.png'));
  }

  console.log('split construction regions...');
  const garment = enclosed(mask, width, height);
  const open = new Uint8Array(width * height);
  for (let i = 0; i < open.length; i++) open[i] = garment[i] && !mask[i] ? 1 : 0;
  const { labels, count } = labelComponents(open, width, height);
  const minArea = Math.max(400, Math.round(garment.reduce((n, v) => n + v, 0) * 0.004));
  const stats = [];
  for (let id = 1; id <= count; id++) {
    const stat = regionStats(labels, id, width, height);
    if (stat.area >= minArea) stats.push(stat);
  }
  stats.sort((a, b) => b.area - a.area);
  const bbox = garmentBBox(garment, width, height);
  console.log(`${stats.length} large cells (from ${count} total, min ${minArea}px) bbox=${bbox.width}x${bbox.height}`);
  for (const s of stats.slice(0, 16)) {
    const relX = ((s.cx - (bbox.minX + bbox.maxX) / 2) / (bbox.width / 2)).toFixed(2);
    const relY = ((s.cy - bbox.minY) / bbox.height).toFixed(2);
    console.log(`  #${s.id} area=${s.area} rel=${relX},${relY} box=${s.minX},${s.minY}-${s.maxX},${s.maxY}`);
  }

  await writeProof(
    labels,
    count,
    width,
    height,
    path.join(OUT, 'hoodie-regions.png'),
  );

  const classified = classifyInteriorCells(stats, bbox);
  const boxes = boxesFromCells(classified, bbox, garment, labels, width);
  console.log('classified', {
    hood: classified.hoodCells.map((c) => c.id),
    body: classified.body?.id,
    pocket: classified.pocket?.id,
    leftSleeve: classified.leftSleeve?.id,
    rightSleeve: classified.rightSleeve?.id,
    hem: classified.hem?.id,
    leftCuff: classified.leftCuff?.id,
    rightCuff: classified.rightCuff?.id,
  });
  console.log('boxes', JSON.stringify(boxes));

  const named = buildNamedMasks(
    labels,
    garment,
    mask,
    width,
    height,
    makePartSeeds(classified, boxes, labels, width),
  );
  const requiredPartNames = [
    'Body',
    'Kangaroo pocket',
    'Left sleeve',
    'Right sleeve',
    'Left cuff',
    'Right cuff',
    'Hood',
    'Rib hem',
  ];
  const missingPartNames = requiredPartNames.filter(
    (name) => !named.some((part) => part.name === name),
  );
  if (missingPartNames.length) {
    throw new Error(`missing hoodie parts: ${missingPartNames.join(', ')}`);
  }
  const areaByName = Object.fromEntries(named.map((part) => [part.name, part.area]));
  const cuffRatio = areaByName['Left cuff'] / areaByName['Right cuff'];
  if (cuffRatio < 0.75 || cuffRatio > 1.33) {
    throw new Error(`asymmetric cuff masks: ratio ${cuffRatio.toFixed(2)}`);
  }
  let missingFillPixels = 0;
  let overlappingFillPixels = 0;
  let overflowingFillPixels = 0;
  const fillable = subtractMask(garment, mask);
  for (let i = 0; i < fillable.length; i++) {
    const owners = named.reduce((countOwners, part) => countOwners + part.mask[i], 0);
    if (fillable[i] && owners === 0) missingFillPixels++;
    if (owners > 1) overlappingFillPixels++;
    if (!fillable[i] && owners > 0) overflowingFillPixels++;
  }
  if (missingFillPixels || overlappingFillPixels || overflowingFillPixels) {
    throw new Error(
      `invalid fill partition: ${missingFillPixels} missing, ` +
        `${overlappingFillPixels} overlapping, ${overflowingFillPixels} overflowing`,
    );
  }
  console.log('  exact fill partition: 0 missing, 0 overlapping, 0 overflowing');
  const proof = new Jimp(width, height, 0xffffffff);
  const proofZ = {
    'Left sleeve': 10,
    'Right sleeve': 10,
    Body: 20,
    'Rib hem': 28,
    'Left cuff': 32,
    'Right cuff': 32,
    Hood: 40,
    'Kangaroo pocket': 52,
  };
  const proofColors = Object.fromEntries(
    named.map((part, index) => [part.name, PALETTE[index % PALETTE.length]]),
  );
  [...named].sort((a, b) => proofZ[a.name] - proofZ[b.name]).forEach((part) => {
    const hex = proofColors[part.name].replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const data = proof.bitmap.data;
    for (let i = 0; i < part.mask.length; i++) {
      if (!part.mask[i]) continue;
      const o = i * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  });
  await proof.writeAsync(path.join(OUT, 'hoodie-parts-proof.png'));
  const parts = [];
  const mapper = (x, y) => mapToBuilder(x, y, width, height);
  const inkBuilder = transformPath(traced.d, mapper);

  for (let index = 0; index < named.length; index++) {
    const part = named[index];
    if (onlyPart && part.name !== onlyPart) continue;
    const partTrace = await traceMask(part.mask, width, height);
    if (!partTrace.d) throw new Error(`Empty traced part: ${part.name}`);
    const fillD = transformPath(partTrace.d, mapper);
    const isCuff = part.name.endsWith('cuff');
    let inkRegion = andMask(mask, dilate(part.mask, width, height, 3));
    if (part.box) {
      inkRegion = clipToBox(
        inkRegion,
        width,
        height,
        padBox(part.box, 4, isCuff ? 8 : 4),
      );
    }
    const inkTrace = await traceMask(inkRegion, width, height);
    const inkD = inkTrace.d ? transformPath(inkTrace.d, mapper) : '';
    parts.push({
      id: `part-${index + 1}`,
      name: part.name,
      svg: wrapBuilderSvg(`${FIT} pullover hoodie - ${part.name}`, fillD, inkD),
      color: PALETTE[index % PALETTE.length],
      area: part.area,
    });
    console.log(
      `  traced ${part.name} (${part.area}px fill, ${partTrace.subpaths} fill / ${inkTrace.subpaths || 0} ink)`,
    );
  }

  const result = {
    type: 'result',
    ok: true,
    source: 'hoodie-lineart',
    parts,
    lineArtSvg: wrapBuilderSvg(`${FIT} pullover hoodie - construction ink`, '', inkBuilder),
    partCount: parts.length,
    process: {
      rasterFirst: true,
      whiteKey: 'luminance-ramp',
      contrast: CONTRAST,
      traceSupersampling: TRACE_SS,
      bitmapInverted: traced.subpaths >= 40,
      fillRule: 'evenodd',
      exclusiveFillPartition: true,
      viewBox: '0 0 2048 2048',
      sourceWidth: width,
      sourceHeight: height,
      turdsize: 4,
      turnPolicy: 'minority',
    },
  };
  const target = path.join(OUT, 'mockup.json');
  fs.writeFileSync(target, JSON.stringify(result));
  console.log(`wrote mockup.json (${(fs.statSync(target).size / 1024).toFixed(0)} KB, ${parts.length} parts)`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fit = (process.argv[2] || 'boxy').toLowerCase();
  if (!['boxy', 'cropped', 'baggy', 'regular', 'slim'].includes(fit)) throw new Error('Unknown fit');
  packHoodie({
    fit,
    source: process.argv[3] || path.join(ROOT, 'src/assets/studio-hoodie', fit === 'boxy' ? '' : `fits/${fit}`, 'hoodie-lineart-bold.png'),
    output: path.join(ROOT, '.tmp-hoodie-assembly', `pack-${fit}`),
    photo: process.argv[4],
  }).catch((error) => { console.error(error); process.exitCode = 1; });
}
