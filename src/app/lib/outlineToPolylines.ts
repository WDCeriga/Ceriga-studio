export type PolyPoint = { x: number; y: number };

export type CodedOutlinePolyline = {
  /** Points in normalized viewBox space (0..viewBox). */
  points: PolyPoint[];
};

export type CodedOutline = {
  viewBox: number;
  /** One chain per traced stroke (e.g. 2 per sleeve side). */
  polylines: CodedOutlinePolyline[];
  /**
   * One closed polygon per sleeve/object (left + right separately).
   * Avoids bow-tie fills from merging both sleeves into one path.
   */
  closedPolygons: PolyPoint[][];
  /** @deprecated use closedPolygons[0] — kept for older callers */
  closedPolygon: PolyPoint[];
  /** Human-readable snippet you could paste into code. */
  codeSnippet: string;
};

function hexToRgba(hex: string): [number, number, number, number] {
  const n = hex.replace('#', '').trim();
  const full =
    n.length === 3
      ? n
          .split('')
          .map((c) => c + c)
          .join('')
      : n.padStart(6, '0').slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
    255,
  ];
}

async function rasterizeOutlineSvg(raw: string, size: number): Promise<Uint8Array> {
  // Important: do NOT use width/height="100%" — canvas often paints blank for %.
  let svg = raw
    .replace(/fill="#000000"/gi, 'fill="#000000"')
    .replace(/fill="#000"/gi, 'fill="#000000"')
    .replace(/fill="black"/gi, 'fill="#000000"')
    .replace(/width="[^"]*"/i, `width="${size}"`)
    .replace(/height="[^"]*"/i, `height="${size}"`);

  if (!/viewBox=/i.test(svg)) {
    svg = svg.replace(/<svg\b/i, `<svg viewBox="0 0 2048 2048"`);
  }

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const mask = new Uint8Array(size * size);
    let inkCount = 0;
    for (let i = 0, idx = 0; i < data.length; i += 4, idx += 1) {
      const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (luminance < 200) {
        mask[idx] = 1;
        inkCount += 1;
      }
    }
    if (inkCount < 20) {
      throw new Error('SVG rasterized empty — no outline ink detected');
    }
    return mask;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function dilateMask(mask: Uint8Array, size: number, radius: number) {
  if (radius <= 0) return mask;
  let cur = mask;
  for (let pass = 0; pass < radius; pass += 1) {
    const next = new Uint8Array(cur);
    for (let y = 1; y < size - 1; y += 1) {
      for (let x = 1; x < size - 1; x += 1) {
        const idx = y * size + x;
        if (cur[idx]) continue;
        let hit = false;
        for (let dy = -1; dy <= 1 && !hit; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (cur[(y + dy) * size + (x + dx)]) {
              hit = true;
              break;
            }
          }
        }
        if (hit) next[idx] = 1;
      }
    }
    cur = next;
  }
  return cur;
}

function idxToPoint(idx: number, size: number): PolyPoint {
  return { x: idx % size, y: (idx / size) | 0 };
}

function normalizePoints(points: PolyPoint[], size: number, viewBox: number): PolyPoint[] {
  const scale = viewBox / size;
  return points.map((p) => ({
    x: Math.round(p.x * scale * 10) / 10,
    y: Math.round(p.y * scale * 10) / 10,
  }));
}

function dist(a: PolyPoint, b: PolyPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function toCodeSnippet(
  groups: { label: string; lines: PolyPoint[][] }[],
  viewBox: number,
): string {
  const blocks = groups.map((g) => {
    const lines = g.lines
      .map((pts, i) => {
        const body = pts.map((p) => `{ x: ${p.x}, y: ${p.y} }`).join(', ');
        return `    // ${g.label} line ${i + 1}\n    [${body}]`;
      })
      .join(',\n');
    return `  // ${g.label}\n  [\n${lines}\n  ]`;
  });
  return `const sleeveParts = [\n${blocks.join(',\n')}\n]; // viewBox 0..${viewBox}`;
}

function labelInkBlobs(mask: Uint8Array, size: number) {
  const seen = new Uint8Array(size * size);
  const components: {
    pixels: number[];
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }[] = [];
  const queue: number[] = [];

  for (let start = 0; start < size * size; start += 1) {
    if (!mask[start] || seen[start]) continue;
    const pixels: number[] = [];
    let minX = size;
    let minY = size;
    let maxX = 0;
    let maxY = 0;
    seen[start] = 1;
    queue.length = 0;
    queue.push(start);
    while (queue.length) {
      const idx = queue.pop()!;
      pixels.push(idx);
      const x = idx % size;
      const y = (idx / size) | 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const nidx = ny * size + nx;
          if (!mask[nidx] || seen[nidx]) continue;
          seen[nidx] = 1;
          queue.push(nidx);
        }
      }
    }
    if (pixels.length < 30) continue;
    components.push({ pixels, minX, minY, maxX, maxY });
  }

  components.sort((a, b) => b.pixels.length - a.pixels.length);
  return components;
}

/**
 * Fit one sleeve blob as a V: tip + two open ends → two coded lines.
 */
function fitVForBlob(
  pixels: number[],
  size: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): { lines: PolyPoint[][]; openEnds: [PolyPoint, PolyPoint] } | null {
  if (pixels.length < 20) return null;

  const nearest = (target: PolyPoint) => {
    let best = target;
    let bestDist = Infinity;
    const step = Math.max(1, (pixels.length / 400) | 0);
    for (let i = 0; i < pixels.length; i += step) {
      const p = idxToPoint(pixels[i], size);
      const d = dist(p, target);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  };

  let a: PolyPoint;
  let b: PolyPoint;
  let tip: PolyPoint;

  if (pixels.length > 600) {
    const left = nearest({ x: minX, y: (minY + maxY) / 2 });
    const right = nearest({ x: maxX, y: (minY + maxY) / 2 });
    const top = nearest({ x: (minX + maxX) / 2, y: minY });
    const bottom = nearest({ x: (minX + maxX) / 2, y: maxY });
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const candidates = [left, right, top, bottom];
    tip = candidates[0];
    let tipScore = -1;
    for (const t of candidates) {
      const score = Math.hypot(t.x - cx, t.y - cy);
      if (score > tipScore) {
        tipScore = score;
        tip = t;
      }
    }
    const ends = candidates
      .filter((p) => dist(p, tip) > 4)
      .sort((p, q) => dist(q, tip) - dist(p, tip));
    if (ends.length < 2) return null;
    a = ends[0];
    b = ends[1];
  } else {
    a = idxToPoint(pixels[0], size);
    b = a;
    let bestD = -1;
    const step = Math.max(1, (pixels.length / 250) | 0);
    for (let i = 0; i < pixels.length; i += step) {
      const p = idxToPoint(pixels[i], size);
      for (let j = i + step; j < pixels.length; j += step) {
        const q = idxToPoint(pixels[j], size);
        const d = dist(p, q);
        if (d > bestD) {
          bestD = d;
          a = p;
          b = q;
        }
      }
    }
    tip = a;
    let bestArea = -1;
    const tipStep = Math.max(1, (pixels.length / 300) | 0);
    for (let i = 0; i < pixels.length; i += tipStep) {
      const p = idxToPoint(pixels[i], size);
      const area = Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
      if (area > bestArea) {
        bestArea = area;
        tip = p;
      }
    }
  }

  if (dist(tip, a) < 4 || dist(tip, b) < 4 || dist(a, b) < 4) return null;
  return {
    lines: [
      [tip, a],
      [tip, b],
    ],
    openEnds: [a, b],
  };
}

/**
 * Transform a potrace outline SVG into coded polylines (each sleeve → two lines),
 * then close + fill each sleeve separately (no bow-tie across L/R).
 */
export async function extractCodedOutlineFromSvg(
  raw: string,
  options?: {
    size?: number;
    viewBox?: number;
    simplifyEpsilon?: number;
    maxStrokes?: number;
    asStraightLines?: boolean;
    dilate?: number;
  },
): Promise<CodedOutline> {
  const size = options?.size ?? 512;
  const viewBox = options?.viewBox ?? 1000;
  const dilate = options?.dilate ?? 2;

  const ink = dilateMask(await rasterizeOutlineSvg(raw, size), size, dilate);
  const components = labelInkBlobs(ink, size).slice(0, 4);

  const groups: { label: string; lines: PolyPoint[][] }[] = [];
  const closedPolygons: PolyPoint[][] = [];
  const allPolylines: CodedOutlinePolyline[] = [];

  components.forEach((comp, index) => {
    const fitted = fitVForBlob(
      comp.pixels,
      size,
      comp.minX,
      comp.minY,
      comp.maxX,
      comp.maxY,
    );
    if (!fitted) return;

    const lines = fitted.lines.map((pts) => normalizePoints(pts, size, viewBox));
    const open = fitted.openEnds.map((p) => normalizePoints([p], size, viewBox)[0]) as [
      PolyPoint,
      PolyPoint,
    ];
    const label =
      components.length === 1
        ? 'sleeve'
        : index === 0
          ? 'left sleeve'
          : index === 1
            ? 'right sleeve'
            : `part ${index + 1}`;

    groups.push({ label, lines });
    for (const pts of lines) allPolylines.push({ points: pts });

    const tip = lines[0][0];
    closedPolygons.push([tip, open[0], open[1], tip]);
  });

  if (!allPolylines.length) {
    throw new Error('Could not extract any coded lines from this SVG');
  }

  return {
    viewBox,
    polylines: allPolylines,
    closedPolygons,
    closedPolygon: closedPolygons[0] ?? [],
    codeSnippet: toCodeSnippet(groups, viewBox),
  };
}

/** Render coded outline as an SVG string (lines + filled polygons per sleeve). */
export function renderCodedOutlineSvg(
  outline: CodedOutline,
  options: {
    stroke: string;
    fill: string;
    showLines?: boolean;
    showFill?: boolean;
    strokeWidth?: number;
  },
): string {
  const vb = outline.viewBox;
  const sw = options.strokeWidth ?? Math.max(2, vb * 0.006);
  const parts: string[] = [];
  const polygons =
    outline.closedPolygons?.length > 0
      ? outline.closedPolygons
      : outline.closedPolygon?.length
        ? [outline.closedPolygon]
        : [];

  if (options.showFill !== false) {
    for (const poly of polygons) {
      if (poly.length < 3) continue;
      const d = poly.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      parts.push(
        `<path d="${d} Z" fill="${options.fill}" stroke="none" fill-rule="evenodd" />`,
      );
    }
  }

  if (options.showLines !== false) {
    for (const pl of outline.polylines) {
      if (pl.points.length < 2) continue;
      const d = pl.points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
        .join(' ');
      parts.push(
        `<path d="${d}" fill="none" stroke="${options.stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" />`,
      );
    }
    for (const poly of polygons) {
      if (poly.length < 3) continue;
      const openA = poly[1];
      const openB = poly[2];
      parts.push(
        `<path d="M ${openA.x} ${openA.y} L ${openB.x} ${openB.y}" fill="none" stroke="#5B8CF5" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${sw * 2} ${sw * 2}" />`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${parts.join('')}</svg>`;
}

export function shadeHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgba(hex);
  const mix = (c: number) => {
    const next = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
    return Math.round(Math.min(255, Math.max(0, next)));
  };
  const to = (c: number) => mix(c).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
