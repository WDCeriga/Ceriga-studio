/**
 * Parametric garment drawing schema for the JSON lab.
 * Pieces can be freeform polygons/polylines, or generative kinds (e.g. sleeve)
 * driven by landmarks + params.
 */

export type JsonPoint = { x: number; y: number };

export type GarmentPieceKind = 'polygon' | 'polyline' | 'sleeve' | 'body' | 'neckline' | 'cuff';

export type GarmentPiece = {
  id: string;
  label?: string;
  kind: GarmentPieceKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Named attach / guide points (editable on canvas). */
  landmarks?: Record<string, JsonPoint>;
  /** Numeric drivers — e.g. length, cuffWidth, unitsPerCm. */
  params?: Record<string, number>;
  /** Explicit outline when kind is polygon (closed) or polyline (open). */
  points?: JsonPoint[];
  /** Optional extra open strokes (stitch guides, etc.). */
  guides?: JsonPoint[][];
};

export type GarmentDrawing = {
  name: string;
  viewBox: number;
  background?: string;
  pieces: GarmentPiece[];
};

export type ResolvedPieceGeometry = {
  piece: GarmentPiece;
  polygons: JsonPoint[][];
  polylines: JsonPoint[][];
  landmarks: { name: string; point: JsonPoint }[];
};

export type ParseDrawingResult =
  | { ok: true; drawing: GarmentDrawing }
  | { ok: false; error: string };

function isPoint(v: unknown): v is JsonPoint {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function isPointArray(v: unknown): v is JsonPoint[] {
  return Array.isArray(v) && v.every(isPoint);
}

const KINDS: GarmentPieceKind[] = ['polygon', 'polyline', 'sleeve', 'body', 'neckline', 'cuff'];

function parsePiece(raw: unknown, index: number): GarmentPiece | string {
  if (!raw || typeof raw !== 'object') return `pieces[${index}] must be an object`;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : `piece-${index + 1}`;
  const kindRaw = typeof o.kind === 'string' ? o.kind : 'polygon';
  if (!KINDS.includes(kindRaw as GarmentPieceKind)) {
    return `pieces[${index}].kind must be one of: ${KINDS.join(', ')}`;
  }
  const kind = kindRaw as GarmentPieceKind;

  let landmarks: Record<string, JsonPoint> | undefined;
  if (o.landmarks !== undefined) {
    if (!o.landmarks || typeof o.landmarks !== 'object' || Array.isArray(o.landmarks)) {
      return `pieces[${index}].landmarks must be an object of {x,y}`;
    }
    landmarks = {};
    for (const [key, val] of Object.entries(o.landmarks as Record<string, unknown>)) {
      if (!isPoint(val)) return `pieces[${index}].landmarks.${key} must be {x,y}`;
      landmarks[key] = { x: val.x, y: val.y };
    }
  }

  let params: Record<string, number> | undefined;
  if (o.params !== undefined) {
    if (!o.params || typeof o.params !== 'object' || Array.isArray(o.params)) {
      return `pieces[${index}].params must be an object of numbers`;
    }
    params = {};
    for (const [key, val] of Object.entries(o.params as Record<string, unknown>)) {
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        return `pieces[${index}].params.${key} must be a finite number`;
      }
      params[key] = val;
    }
  }

  let points: JsonPoint[] | undefined;
  if (o.points !== undefined) {
    if (!isPointArray(o.points)) return `pieces[${index}].points must be [{x,y}, ...]`;
    points = o.points.map((p) => ({ x: p.x, y: p.y }));
  }

  let guides: JsonPoint[][] | undefined;
  if (o.guides !== undefined) {
    if (!Array.isArray(o.guides) || !o.guides.every(isPointArray)) {
      return `pieces[${index}].guides must be [[{x,y}, ...], ...]`;
    }
    guides = o.guides.map((g) => g.map((p) => ({ x: p.x, y: p.y })));
  }

  return {
    id,
    label: typeof o.label === 'string' ? o.label : undefined,
    kind,
    fill: typeof o.fill === 'string' ? o.fill : undefined,
    stroke: typeof o.stroke === 'string' ? o.stroke : undefined,
    strokeWidth: typeof o.strokeWidth === 'number' ? o.strokeWidth : undefined,
    landmarks,
    params,
    points,
    guides,
  };
}

export function parseGarmentDrawing(input: unknown): ParseDrawingResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Root must be a JSON object' };
  }
  const o = input as Record<string, unknown>;
  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : 'untitled';
  const viewBox = typeof o.viewBox === 'number' && o.viewBox > 0 ? o.viewBox : NaN;
  if (!Number.isFinite(viewBox)) return { ok: false, error: 'viewBox must be a positive number' };
  if (!Array.isArray(o.pieces)) return { ok: false, error: 'pieces must be an array' };

  const pieces: GarmentPiece[] = [];
  for (let i = 0; i < o.pieces.length; i++) {
    const piece = parsePiece(o.pieces[i], i);
    if (typeof piece === 'string') return { ok: false, error: piece };
    pieces.push(piece);
  }

  return {
    ok: true,
    drawing: {
      name,
      viewBox,
      background: typeof o.background === 'string' ? o.background : undefined,
      pieces,
    },
  };
}

export function parseGarmentDrawingJson(text: string): ParseDrawingResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid JSON' };
  }
  return parseGarmentDrawing(parsed);
}

function sub(a: JsonPoint, b: JsonPoint): JsonPoint {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: JsonPoint, b: JsonPoint): JsonPoint {
  return { x: a.x + b.x, y: a.y + b.y };
}

function mul(a: JsonPoint, s: number): JsonPoint {
  return { x: a.x * s, y: a.y * s };
}

function len(a: JsonPoint): number {
  return Math.hypot(a.x, a.y);
}

function norm(a: JsonPoint): JsonPoint {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
}

function perp(a: JsonPoint): JsonPoint {
  return { x: -a.y, y: a.x };
}

function mid(a: JsonPoint, b: JsonPoint): JsonPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function roundPoint(p: JsonPoint, decimals = 1): JsonPoint {
  const f = 10 ** decimals;
  return { x: Math.round(p.x * f) / f, y: Math.round(p.y * f) / f };
}

/** Build a tapered sleeve from shoulder/underarm + length (cm) × unitsPerCm. */
export function buildSleevePolygon(piece: GarmentPiece): JsonPoint[] | null {
  const shoulder = piece.landmarks?.shoulder;
  const underarm = piece.landmarks?.underarm;
  if (!shoulder || !underarm) return null;

  const lengthCm = piece.params?.length ?? 8;
  const unitsPerCm = piece.params?.unitsPerCm ?? 18;
  const cuffWidth = piece.params?.cuffWidth ?? Math.max(40, len(sub(shoulder, underarm)) * 0.55);
  const side = piece.params?.side === -1 ? -1 : 1; // 1 = right-ish outward, -1 = mirror

  const armholeMid = mid(shoulder, underarm);
  const armholeAxis = norm(sub(shoulder, underarm));
  // Default hang: down + slightly outward from canvas center heuristics
  const outward = norm({ x: side * Math.abs(armholeAxis.y) + side * 0.35, y: 1 });
  const cuffCenter = add(armholeMid, mul(outward, lengthCm * unitsPerCm));
  const cuffPerp = norm(perp(outward));
  const half = cuffWidth / 2;
  const cuffA = add(cuffCenter, mul(cuffPerp, half));
  const cuffB = add(cuffCenter, mul(cuffPerp, -half));

  return [shoulder, cuffA, cuffB, underarm].map((p) => roundPoint(p));
}

/** Simple body block from shoulder/hem landmarks + bodyLength param. */
export function buildBodyPolygon(piece: GarmentPiece): JsonPoint[] | null {
  const leftShoulder = piece.landmarks?.leftShoulder;
  const rightShoulder = piece.landmarks?.rightShoulder;
  const leftHem = piece.landmarks?.leftHem;
  const rightHem = piece.landmarks?.rightHem;
  if (leftShoulder && rightShoulder && leftHem && rightHem) {
    return [leftShoulder, rightShoulder, rightHem, leftHem].map((p) => roundPoint(p));
  }

  const neckLeft = piece.landmarks?.neckLeft;
  const neckRight = piece.landmarks?.neckRight;
  if (!neckLeft || !neckRight) return null;

  const lengthCm = piece.params?.length ?? 70;
  const unitsPerCm = piece.params?.unitsPerCm ?? 8;
  const halfChest = piece.params?.halfChest ?? len(sub(neckRight, neckLeft)) * 1.8;
  const drop = lengthCm * unitsPerCm;
  const center = mid(neckLeft, neckRight);
  const across = norm(sub(neckRight, neckLeft));
  const down = { x: 0, y: 1 };
  const leftShoulderPt = add(neckLeft, mul(across, -halfChest * 0.15));
  const rightShoulderPt = add(neckRight, mul(across, halfChest * 0.15));
  const leftHemPt = add(add(center, mul(across, -halfChest / 2)), mul(down, drop));
  const rightHemPt = add(add(center, mul(across, halfChest / 2)), mul(down, drop));
  return [leftShoulderPt, rightShoulderPt, rightHemPt, leftHemPt].map((p) => roundPoint(p));
}

export function buildNecklinePolygon(piece: GarmentPiece): JsonPoint[] | null {
  const left = piece.landmarks?.left;
  const right = piece.landmarks?.right;
  const bottom = piece.landmarks?.bottom;
  if (!left || !right) return null;
  const depth = piece.params?.depth ?? 40;
  const units = piece.params?.unitsPerCm ?? 1;
  const dip =
    bottom ??
    roundPoint({
      x: (left.x + right.x) / 2,
      y: Math.max(left.y, right.y) + depth * units,
    });
  return [left, right, dip].map((p) => roundPoint(p));
}

export function buildCuffPolygon(piece: GarmentPiece): JsonPoint[] | null {
  const left = piece.landmarks?.left;
  const right = piece.landmarks?.right;
  if (!left || !right) return null;
  const height = piece.params?.height ?? 28;
  const across = norm(sub(right, left));
  const down = norm(perp(across));
  // Prefer "down" toward +y
  const d = down.y >= 0 ? down : mul(down, -1);
  return [
    left,
    right,
    add(right, mul(d, height)),
    add(left, mul(d, height)),
  ].map((p) => roundPoint(p));
}

function geometryForPiece(piece: GarmentPiece): ResolvedPieceGeometry {
  const landmarks = Object.entries(piece.landmarks ?? {}).map(([name, point]) => ({
    name,
    point,
  }));

  if (piece.kind === 'polyline') {
    return {
      piece,
      polygons: [],
      polylines: piece.points && piece.points.length >= 2 ? [piece.points] : [],
      landmarks,
    };
  }

  let polygon: JsonPoint[] | null = null;
  if (piece.kind === 'sleeve') polygon = buildSleevePolygon(piece);
  else if (piece.kind === 'body') polygon = buildBodyPolygon(piece);
  else if (piece.kind === 'neckline') polygon = buildNecklinePolygon(piece);
  else if (piece.kind === 'cuff') polygon = buildCuffPolygon(piece);
  else if (piece.points && piece.points.length >= 3) polygon = piece.points;

  const guides = piece.guides?.filter((g) => g.length >= 2) ?? [];

  return {
    piece,
    polygons: polygon && polygon.length >= 3 ? [polygon] : [],
    polylines: guides,
    landmarks,
  };
}

export function resolveGarmentDrawing(drawing: GarmentDrawing): ResolvedPieceGeometry[] {
  return drawing.pieces.map(geometryForPiece);
}

function pointsToPath(points: JsonPoint[], close: boolean): string {
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return close ? `${d} Z` : d;
}

export function renderGarmentDrawingSvg(
  drawing: GarmentDrawing,
  options?: {
    showLandmarks?: boolean;
    showGuides?: boolean;
    highlightPieceId?: string | null;
    /** When tracing over a reference image, lower fill so the PNG shows through. */
    pieceFillOpacity?: number;
    /** Skip solid background rect so a HTML reference image can sit behind. */
    skipBackground?: boolean;
    /** Canvas chrome — affects grid contrast. */
    theme?: 'dark' | 'light';
  },
): string {
  const vb = drawing.viewBox;
  const showLandmarks = options?.showLandmarks !== false;
  const showGuides = options?.showGuides !== false;
  const theme = options?.theme ?? 'dark';
  const bg =
    options?.skipBackground
      ? 'transparent'
      : theme === 'light'
        ? '#F2F2F4'
        : (drawing.background ?? '#0c0c0e');
  const pieceFillOpacity = options?.pieceFillOpacity ?? 1;
  const gridStroke = theme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)';
  const resolved = resolveGarmentDrawing(drawing);
  const parts: string[] = [];

  if (bg !== 'transparent') {
    parts.push(`<rect width="${vb}" height="${vb}" fill="${bg}" />`);
  }

  // Light grid
  const step = vb / 10;
  for (let i = 1; i < 10; i++) {
    const v = i * step;
    parts.push(
      `<line x1="${v}" y1="0" x2="${v}" y2="${vb}" stroke="${gridStroke}" stroke-width="1" />`,
      `<line x1="0" y1="${v}" x2="${vb}" y2="${v}" stroke="${gridStroke}" stroke-width="1" />`,
    );
  }

  for (const geo of resolved) {
    const { piece } = geo;
    const fill = piece.fill ?? '#CC2D24';
    const stroke = piece.stroke ?? '#1a1a1c';
    const sw = piece.strokeWidth ?? Math.max(2, vb * 0.004);
    const isHi = options?.highlightPieceId === piece.id;
    const dim = options?.highlightPieceId && !isHi ? 0.35 : 1;
    const fillOpacity = Math.max(0, Math.min(1, pieceFillOpacity * dim));

    for (const poly of geo.polygons) {
      parts.push(
        `<path d="${pointsToPath(poly, true)}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" />`,
      );
    }

    if (showGuides) {
      for (const line of geo.polylines) {
        parts.push(
          `<path d="${pointsToPath(line, false)}" fill="none" stroke="#5B8CF5" stroke-opacity="${dim}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${sw * 2} ${sw * 2}" />`,
        );
      }
    }

    if (piece.kind === 'polyline' && piece.points && piece.points.length >= 2) {
      parts.push(
        `<path d="${pointsToPath(piece.points, false)}" fill="none" stroke="${stroke}" stroke-opacity="${dim}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" />`,
      );
    }

    if (showLandmarks) {
      const r = Math.max(4, vb * 0.008);
      for (const lm of geo.landmarks) {
        parts.push(
          `<circle cx="${lm.point.x}" cy="${lm.point.y}" r="${r}" fill="#111113" stroke="#F5C84C" stroke-width="${r * 0.35}" data-piece="${piece.id}" data-landmark="${lm.name}" />`,
          `<text x="${lm.point.x + r * 1.4}" y="${lm.point.y - r * 0.6}" fill="#F5C84C" font-size="${Math.max(10, vb * 0.018)}" font-family="ui-sans-serif, system-ui, sans-serif">${lm.name}</text>`,
        );
      }
      if (piece.kind === 'polygon' && piece.points) {
        piece.points.forEach((p, i) => {
          parts.push(
            `<circle cx="${p.x}" cy="${p.y}" r="${r * 0.85}" fill="#111113" stroke="#7DD3A8" stroke-width="${r * 0.3}" data-piece="${piece.id}" data-point="${i}" />`,
          );
        });
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${parts.join('')}</svg>`;
}

export function formatGarmentDrawing(drawing: GarmentDrawing): string {
  return `${JSON.stringify(drawing, null, 2)}\n`;
}

export type GarmentPreset = {
  id: string;
  label: string;
  blurb: string;
  drawing: GarmentDrawing;
};

export const GARMENT_JSON_PRESETS: GarmentPreset[] = [
  {
    id: 'sleeve',
    label: 'Sleeve (parametric)',
    blurb: 'Change params.length — shoulder/underarm stay fixed; cuff rebuilds.',
    drawing: {
      name: 'tshirt-sleeve-left',
      viewBox: 1000,
      background: '#0c0c0e',
      pieces: [
        {
          id: 'sleeve-left',
          label: 'Left sleeve',
          kind: 'sleeve',
          fill: '#CC2D24',
          stroke: '#2a2a2e',
          landmarks: {
            shoulder: { x: 420, y: 260 },
            underarm: { x: 460, y: 360 },
          },
          params: {
            length: 8,
            cuffWidth: 110,
            unitsPerCm: 22,
            side: -1,
          },
        },
      ],
    },
  },
  {
    id: 'body',
    label: 'Body block',
    blurb: 'Hem drops with params.length; neck landmarks stay put.',
    drawing: {
      name: 'tshirt-body',
      viewBox: 1000,
      background: '#0c0c0e',
      pieces: [
        {
          id: 'body',
          label: 'Body',
          kind: 'body',
          fill: '#3D6B4F',
          stroke: '#1e1e22',
          landmarks: {
            neckLeft: { x: 420, y: 180 },
            neckRight: { x: 580, y: 180 },
          },
          params: {
            length: 70,
            halfChest: 280,
            unitsPerCm: 8,
          },
        },
      ],
    },
  },
  {
    id: 'neckline',
    label: 'Neckline',
    blurb: 'Crew-style V from left/right + depth.',
    drawing: {
      name: 'tshirt-neckline',
      viewBox: 1000,
      background: '#0c0c0e',
      pieces: [
        {
          id: 'neck',
          label: 'Neckline',
          kind: 'neckline',
          fill: '#E8E4DC',
          stroke: '#2a2a2e',
          landmarks: {
            left: { x: 430, y: 200 },
            right: { x: 570, y: 200 },
          },
          params: {
            depth: 55,
            unitsPerCm: 1,
          },
        },
      ],
    },
  },
  {
    id: 'cuff',
    label: 'Cuff / sleeve hem',
    blurb: 'Band under cuff landmarks; height is parametric.',
    drawing: {
      name: 'tshirt-cuff',
      viewBox: 1000,
      background: '#0c0c0e',
      pieces: [
        {
          id: 'cuff',
          label: 'Cuff',
          kind: 'cuff',
          fill: '#FFFFFF',
          stroke: '#2a2a2e',
          landmarks: {
            left: { x: 300, y: 620 },
            right: { x: 420, y: 640 },
          },
          params: {
            height: 36,
          },
        },
      ],
    },
  },
  {
    id: 'full-tee',
    label: 'Mini tee (stacked)',
    blurb: 'Body + both sleeves + neck — edit any piece’s params live.',
    drawing: {
      name: 'tshirt-mini',
      viewBox: 1000,
      background: '#0c0c0e',
      pieces: [
        {
          id: 'body',
          kind: 'body',
          fill: '#2F5D8C',
          landmarks: {
            neckLeft: { x: 430, y: 220 },
            neckRight: { x: 570, y: 220 },
          },
          params: { length: 62, halfChest: 260, unitsPerCm: 8 },
        },
        {
          id: 'sleeve-left',
          kind: 'sleeve',
          fill: '#2F5D8C',
          landmarks: {
            shoulder: { x: 400, y: 250 },
            underarm: { x: 430, y: 330 },
          },
          params: { length: 8, cuffWidth: 95, unitsPerCm: 18, side: -1 },
        },
        {
          id: 'sleeve-right',
          kind: 'sleeve',
          fill: '#2F5D8C',
          landmarks: {
            shoulder: { x: 600, y: 250 },
            underarm: { x: 570, y: 330 },
          },
          params: { length: 8, cuffWidth: 95, unitsPerCm: 18, side: 1 },
        },
        {
          id: 'neck',
          kind: 'neckline',
          fill: '#E8E4DC',
          landmarks: {
            left: { x: 445, y: 215 },
            right: { x: 555, y: 215 },
          },
          params: { depth: 42, unitsPerCm: 1 },
        },
      ],
    },
  },
  {
    id: 'freeform',
    label: 'Freeform polygon',
    blurb: 'Raw points array — drag or edit numbers directly.',
    drawing: {
      name: 'freeform-pocket',
      viewBox: 1000,
      background: '#0c0c0e',
      pieces: [
        {
          id: 'pocket',
          label: 'Pocket',
          kind: 'polygon',
          fill: '#8B6914',
          stroke: '#1e1e22',
          points: [
            { x: 460, y: 420 },
            { x: 560, y: 420 },
            { x: 560, y: 540 },
            { x: 460, y: 540 },
          ],
          landmarks: {
            topLeft: { x: 460, y: 420 },
            topRight: { x: 560, y: 420 },
          },
        },
      ],
    },
  },
];

export function getPresetById(id: string): GarmentPreset | undefined {
  return GARMENT_JSON_PRESETS.find((p) => p.id === id);
}
