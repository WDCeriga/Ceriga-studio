import { patternKind, type PatternSettings } from './patternGeometry';
import { patternDefaultColors, patternDefinition } from './patternCatalog';

export type PatternPrimitive =
  | { tag: 'path'; d: string; fill?: number | 'none'; stroke?: number; strokeWidth?: number; opacity?: number }
  | { tag: 'circle'; cx: number; cy: number; r: number; fill?: number | 'none'; stroke?: number; strokeWidth?: number; opacity?: number }
  | { tag: 'rect'; x: number; y: number; width: number; height: number; rx?: number; fill?: number | 'none'; stroke?: number; strokeWidth?: number; opacity?: number }
  | { tag: 'image'; href: string; x: number; y: number; width: number; height: number };

export interface PatternMotif {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  /** Conservative transformed bounds, used to emit every boundary-crossing replica. */
  radius: number;
  radiusX?: number;
  radiusY?: number;
  primitives: PatternPrimitive[];
}
export interface PatternReplica { motif: number; dx: number; dy: number }
export interface GeneratedPattern {
  kind: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  angle: number;
  colors: string[];
  background?: number;
  motifs: PatternMotif[];
  replicas: PatternReplica[];
}

const bound = (value: number | undefined, fallback: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value! : fallback));
const n = (value: number) => Number(value.toFixed(5));
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let word = Math.imul(state ^ state >>> 15, state | 1);
    word ^= word + Math.imul(word ^ word >>> 7, word | 61);
    return ((word ^ word >>> 14) >>> 0) / 4294967296;
  };
}

/** Image URLs remain inert SVG image resources, never injected markup or foreignObject. */
export function safePatternSource(source?: string): string | undefined {
  if (!source || source.length > 24_000_000) return undefined;
  if (/^data:image\/(?:png|jpeg|webp|gif|avif|svg\+xml)(?:;[^,]*)?,/i.test(source)) return source;
  if (/^(?:https?:\/\/|blob:|\/(?!\/)|\.\.?\/)/i.test(source) && !/[\u0000-\u001f]/.test(source)) return source;
  return undefined;
}

/** Translation lattice is shared by every primitive in a motif, including images. */
export function periodicReplicas(motifs: PatternMotif[], width: number, height: number): PatternReplica[] {
  const replicas: PatternReplica[] = [];
  for (const motif of motifs) {
    const radiusX = motif.radiusX ?? motif.radius;
    const radiusY = motif.radiusY ?? motif.radius;
    const minX = Math.ceil((-radiusX - motif.x) / width);
    const maxX = Math.floor((width + radiusX - motif.x) / width);
    const minY = Math.ceil((-radiusY - motif.y) / height);
    const maxY = Math.floor((height + radiusY - motif.y) / height);
    for (let row = minY; row <= maxY; row++) for (let column = minX; column <= maxX; column++) {
      replicas.push({ motif: motif.id, dx: column * width || 0, dy: row * height || 0 });
    }
  }
  return replicas;
}

const path = (d: string, fill: number | 'none' = 0, stroke?: number, strokeWidth?: number): PatternPrimitive =>
  ({ tag: 'path', d, fill, stroke, strokeWidth });
const rect = (x: number, y: number, width: number, height: number, fill = 0, opacity = 1): PatternPrimitive =>
  ({ tag: 'rect', x, y, width, height, fill, opacity });
const circle = (cx: number, cy: number, r: number, fill: number | 'none' = 0, stroke?: number, strokeWidth?: number): PatternPrimitive =>
  ({ tag: 'circle', cx, cy, r, fill, stroke, strokeWidth });
const polygon = (points: number[][], fill: number | 'none' = 0, stroke?: number, strokeWidth?: number) =>
  path(`${points.map(([x, y], index) => `${index ? 'L' : 'M'}${n(x)} ${n(y)}`).join(' ')}Z`, fill, stroke, strokeWidth);
function radialPoints(count: number, radius: (index: number) => number, phase = -Math.PI / 2) {
  return Array.from({ length: count }, (_, index) => {
    const angle = phase + index * Math.PI * 2 / count;
    return [Math.cos(angle) * radius(index), Math.sin(angle) * radius(index)];
  });
}
function blob(random: () => number, roughness: number, radius = .5) {
  const points = radialPoints(12, () => radius * (.78 + (random() - .5) * roughness * .65));
  const midpoint = (a: number[], b: number[]) => `${n((a[0] + b[0]) / 2)} ${n((a[1] + b[1]) / 2)}`;
  return `M${midpoint(points[11], points[0])} ${points.map((point, i) => `Q${n(point[0])} ${n(point[1])} ${midpoint(point, points[(i + 1) % 12])}`).join(' ')}Z`;
}

/** Generates a bounded, seeded tile; legacy IDs intentionally stay in patternGeometry. */
export function generatedPatternGeometry(settings: PatternSettings): GeneratedPattern {
  const kind = patternKind(settings);
  const definition = patternDefinition(kind);
  const width = bound(settings.width, 80, 1, 100000);
  const height = bound(settings.height, 80, 1, 100000);
  const count = Math.round(bound(settings.patternCount, 5, 1, 32));
  const scale = bound(settings.patternScale, 100, 10, 400) / 100;
  const cell = Math.max(.1, (settings.type === 'customArea' ? 120 / count : Math.min(width, height) / count) * scale);
  const pitchX = cell + bound(settings.patternSpacingX ?? settings.patternSpacing, 0, 0, 200);
  const pitchY = cell + bound(settings.patternSpacingY ?? settings.patternSpacing, 0, 0, 200);
  const thickness = bound(settings.patternThickness, cell / scale * .055, .1, 1000) * scale / cell;
  const t = Math.min(.3, Math.max(.008, thickness));
  const roughness = bound(settings.patternRoughness, 55, 0, 100) / 100;
  const variation = bound(settings.patternVariation, 65, 0, 100) / 100;
  const random = seeded(bound(settings.patternSeed, 1, 0, 0xffffffff));
  const randomType = definition?.randomise === true;
  const fine = ['noise', 'grain', 'dither', 'distressed'].includes(kind);
  const repeat = settings.patternRepeat ?? 'grid';
  const divisions = kind === 'custom' ? (repeat === 'random' ? 4 : 2) : fine ? 8 : randomType ? 4 : 2;
  const tileWidth = pitchX * divisions;
  const tileHeight = pitchY * divisions;
  const defaults = patternDefaultColors(kind);
  const colors = defaults.map((color, index) => (index === 0 ? settings.color : undefined) || settings.patternColors?.[index] || color);
  const background = ['tartan', 'argyle', 'camo', 'digital-camo', 'cow', 'leopard', 'zebra', 'snake'].includes(kind) ? 1 : undefined;
  const motifs: PatternMotif[] = [];
  const source = safePatternSource(settings.patternSource);
  const sourceWidth = bound(settings.patternSourceWidth, 1, 1, 100000);
  const sourceHeight = bound(settings.patternSourceHeight, 1, 1, 100000);
  const sourceAspect = sourceWidth / sourceHeight;
  const imageWidth = Math.min(1, sourceAspect);
  const imageHeight = Math.min(1, 1 / sourceAspect);
  const add = (x: number, y: number, primitives: PatternPrimitive[], rotation = 0, sx = cell, sy = cell, localRadius = 1.25) => {
    motifs.push({ id: motifs.length, x, y, rotation, scaleX: sx, scaleY: sy,
      radius: localRadius * Math.max(Math.abs(sx), Math.abs(sy)), primitives });
  };

  for (let row = 0; row < divisions; row++) for (let column = 0; column < divisions; column++) {
    let x = (column + .5) * pitchX;
    let y = (row + .5) * pitchY;
    const primitives: PatternPrimitive[] = [];
    const jitter = () => (random() - .5) * variation;
    if (kind === 'custom') {
      if (!source) continue;
      if (repeat === 'brick' && row % 2) x += pitchX / 2;
      if (repeat === 'half-drop' && column % 2) y += pitchY / 2;
      const scattered = repeat === 'random';
      const position = bound(settings.patternRandomPosition, 70, 0, 100) / 100;
      const rotation = scattered ? (random() * 2 - 1) * bound(settings.patternRandomRotation, 30, 0, 180) : 0;
      const first = bound(settings.patternMinScale, 70, 10, 300);
      const last = bound(settings.patternMaxScale, 130, 10, 300);
      const imageScale = scattered ? (Math.min(first, last) + random() * Math.abs(last - first)) / 100 : 1;
      if (scattered) { x += (random() - .5) * pitchX * position; y += (random() - .5) * pitchY * position; }
      add(x, y, [{ tag: 'image', href: source, x: -imageWidth / 2, y: -imageHeight / 2, width: imageWidth, height: imageHeight }],
        rotation, cell * imageScale * (repeat === 'mirror' && column % 2 ? -1 : 1),
        cell * imageScale * (repeat === 'mirror' && row % 2 ? -1 : 1), .72);
      continue;
    }
    switch (kind) {
      case 'pinstripes': primitives.push(rect(-.5, -.5, Math.min(.06, t / 2), 1)); break;
      case 'grid': primitives.push(rect(-.5, -.5, 1, t), rect(-.5, -.5, t, 1)); break;
      case 'diamonds': primitives.push(polygon([[0, -.45], [.38, 0], [0, .45], [-.38, 0]], 'none', 0, t)); break;
      case 'triangles': primitives.push(polygon([[-.45, .4], [0, -.4], [.45, .4]], 'none', 0, t)); break;
      case 'honeycomb': {
        // A two-row staggered hexagonal lattice with matching shared edges.
        if (row % 2) x += pitchX / 2;
        primitives.push(polygon([[0, -2 / 3], [.5, -1 / 3], [.5, 1 / 3], [0, 2 / 3], [-.5, 1 / 3], [-.5, -1 / 3]], 'none', 0, t / 2));
        break;
      }
      case 'crosses': primitives.push(rect(-.35, -t / 2, .7, t), rect(-t / 2, -.35, t, .7)); break;
      case 'stars': primitives.push(polygon(radialPoints(10, index => index % 2 ? .19 : .45), 'none', 0, t)); break;
      case 'waves': primitives.push(path('M-.5 0 C-.25 -.45 .25 .45 .5 0', 'none', 0, t)); break;
      case 'chevron': primitives.push(path('M-.5 .25 L0 -.25 L.5 .25', 'none', 0, t)); break;
      case 'spiral': {
        const points = Array.from({ length: 81 }, (_, index) => {
          const angle = index / 80 * Math.PI * 5;
          const radius = .03 + index / 80 * .4;
          return `${index ? 'L' : 'M'}${n(Math.cos(angle) * radius)} ${n(Math.sin(angle) * radius)}`;
        });
        primitives.push(path(points.join(' '), 'none', 0, t / 2)); break;
      }
      case 'concentric': for (let ring = 1; ring <= 4; ring++) primitives.push(circle(0, 0, ring * .105, 'none', 0, t / 2)); break;
      case 'sunburst': for (let ray = 0; ray < 12; ray++) {
        const a = ray * Math.PI / 6;
        const spread = Math.min(.24, t * 1.45);
        primitives.push(polygon([[.08 * Math.cos(a), .08 * Math.sin(a)], [.47 * Math.cos(a - spread), .47 * Math.sin(a - spread)], [.47 * Math.cos(a + spread), .47 * Math.sin(a + spread)]]));
      } break;
      case 'halftone': {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
          const phase = (column * 4 + i) / 8 * Math.PI * 2;
          primitives.push(circle((i + .5) / 4 - .5, (j + .5) / 4 - .5, (.025 + .075 * (1 + Math.cos(phase)) / 2) * Math.min(1.2, .6 + t * 8)));
        } break;
      }
      case 'tartan':
        primitives.push(rect(-.5, -.23, 1, .35, 0, .85), rect(-.23, -.5, .35, 1, 0, .85),
          rect(-.5, .25, 1, .12, 2, .85), rect(.25, -.5, .12, 1, 2, .85),
          rect(-.5, -.4, 1, t / 3, 3), rect(-.4, -.5, t / 3, 1, 3)); break;
      case 'houndstooth':
        primitives.push(path('M-.5 -.5 H0 V-.25 L.25 -.5 H.5 L.25 -.25 V0 H0 V.25 L-.25 .5 H-.5 L-.25 .25 V0 H-.5Z')); break;
      case 'argyle':
        primitives.push(polygon([[0, -.5], [.5, 0], [0, .5], [-.5, 0]], (row + column) % 2 ? 2 : 0),
          path('M-.5 -.5 L.5 .5 M-.5 .5 L.5 -.5', 'none', 3, t / 3)); break;
      case 'camo':
        for (let i = 0; i < 3; i++) {
          const d = blob(random, roughness, .6 + random() * .15);
          primitives.push(path(d, [0, 2, 3][(i + row + column) % 3]));
          // Separate lobed patches, not recolored copies of one outline.
          if (i < 2) add(x + jitter() * cell, y + jitter() * cell, [primitives.pop()!], random() * 360, cell, cell * (.6 + random() * .5));
        } break;
      case 'digital-camo':
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
          const value = random();
          if (value > .16 + (1 - variation) * .2 + roughness * .15) primitives.push(rect(i / 4 - .5, j / 4 - .5, .251, .251, [0, 2, 3][Math.floor(random() * 3)]));
        } break;
      case 'cow': primitives.push(path(blob(random, roughness, .56 + jitter() * .3))); x += jitter() * cell * .35; y += jitter() * cell * .35; break;
      case 'leopard': {
        const outline = blob(random, roughness, .34 + jitter() * .12);
        primitives.push(path(outline, 2, 0, .075 + roughness * .035));
        for (let i = 0; i < 3; i++) primitives.push(circle(jitter() * .95, jitter() * .95, .02 + random() * .025));
        break;
      }
      case 'zebra': {
        if (row !== 0) continue;
        const phase = random() * Math.PI * 2;
        const phase2 = random() * Math.PI * 2;
        const left: number[][] = [], right: number[][] = [];
        for (let step = 0; step <= 64; step++) {
          const u = step / 64;
          const a = u * Math.PI * 2;
          const bend = Math.sin(a + phase) * (.1 + variation * .13)
            + Math.sin(a * 3 + phase2) * roughness * .07;
          const halfWidth = .07 + .13 * (1 + Math.sin(a * 2 + phase2)) / 2;
          const py = -.5 + u * divisions;
          left.push([bend - halfWidth, py]); right.push([bend + halfWidth, py]);
        }
        add(x, y, [polygon([...left, ...right.reverse()])], 0, cell, pitchY, divisions);
        motifs[motifs.length - 1].radiusX = cell * .55;
        motifs[motifs.length - 1].radiusY = pitchY * (divisions - .5);
        continue;
      }
      case 'snake': {
        if (row % 2) x += pitchX / 2;
        const size = 1 + jitter() * .12;
        primitives.push(path(`M-.48 -.45 Q0 ${n(-.58 - roughness * .18)} .48 -.45 Q.48 .2 0 .5 Q-.48 .2 -.48 -.45Z`, 2, 0, .025 + roughness * .025),
          polygon([[0, -.25 * size], [.18, 0], [0, .28 * size], [-.18, 0]], 0));
        break;
      }
      case 'flames': {
        const tip = jitter() * .5;
        primitives.push(path(`M-.38 .45 C${n(-.48 - roughness * .3)} .02 -.06 -.03 ${n(tip)} -.55 C.23 -.22 .02 -.12 .22 .08 Q.4 -.02 .37 -.22 C.69 .25 .3 .6 -.38 .45Z`),
          path('M-.12 .4 Q-.3 .18 .04 -.08 Q-.01 .18 .19 .12 Q.33 .45 -.12 .4Z', 1)); break;
      }
      case 'lightning': {
        const lean = jitter() * .2;
        primitives.push(polygon([[.05 + lean, -.48], [-.25 - roughness * .16, .1], [-.06, .07], [-.18, .49], [.27 + roughness * .16, -.16], [.08, -.1]])); break;
      }
      case 'barbed-wire':
        primitives.push(path('M-.5 -.06 Q-.25 .08 0 -.06 T.5 -.06 M-.5 .04 Q-.25 -.1 0 .04 T.5 .04', 'none', 0, t / 2),
          path('M-.15 -.2 L.13 .2 M-.12 .2 L.15 -.2 M-.15 -.2 L-.17 -.06 M.15 -.2 L.02 -.18 M.13 .2 L.16 .06 M-.12 .2 L.01 .18', 'none', 0, t / 2)); break;
      case 'chain':
        primitives.push({ tag: 'rect', x: -.46, y: -.2, width: .72, height: .4, rx: .19, fill: 'none', stroke: 0, strokeWidth: t },
          path('M.12 -.06 H.5 M.12 .06 H.5', 'none', 0, t / 2)); break;
      case 'tribal': {
        const tip = -.45 + jitter() * .15;
        primitives.push(path(`M-.48 .4 Q-.16 .04 ${n(tip)} -.45 Q${n(.08 + roughness * .17)} -.27 .05 .1 Q.18 -.08 .47 -.32 Q.2 .17 .42 .42 Q.07 .32 -.02 .22 Q-.2 .39 -.48 .4Z`)); break;
      }
      case 'graffiti':
        primitives.push(path(`M-.4 .24 Q${n(jitter())} -.65 .36 -.15 L.12 .16 L.4 .12`, 'none', 0, .085),
          path('M-.34 .35 L.4 .2 M.14 .25 V.49', 'none', 1, .045));
        for (let i = 0; i < 7; i++) primitives.push(circle(jitter() * 1.25, jitter() * 1.25, .008 + random() * (.01 + roughness * .04), i % 3));
        break;
      case 'topographic': {
        const radii = Array.from({ length: 16 }, () => .72 + random() * roughness * .25);
        for (let ring = 1; ring <= 6; ring++) {
          const points = radialPoints(16, index => radii[index] * ring * .075);
          primitives.push(polygon(points, 'none', 0, .012));
        } x += jitter() * cell * .2; y += jitter() * cell * .2; break;
      }
      case 'organic-blob': primitives.push(path(blob(random, roughness, .48 + jitter() * .25))); x += jitter() * cell * .4; y += jitter() * cell * .4; break;
      case 'cracked': {
        // Shared lattice corners keep fracture lines connected at tile boundaries.
        const centerX = jitter() * .5, centerY = jitter() * .5;
        const edge = .5;
        primitives.push(path(`M-.5 -.5 L${n(centerX)} ${n(centerY)} L.5 -.5 M${n(centerX)} ${n(centerY)} L.5 .5 M${n(centerX)} ${n(centerY)} L-.5 .5`, 'none', 0, .012 + roughness * .025));
        if (random() < roughness) primitives.push(path(`M${n(centerX)} ${n(centerY)} l${n(jitter() * edge)} -.24`, 'none', 0, .008));
        break;
      }
      case 'distressed':
        for (let i = 0; i < 6; i++) {
          const px = jitter(), py = jitter();
          primitives.push(path(`M${n(px)} ${n(py)} l${n(.02 + random() * roughness * .12)} ${n(.1 + random() * variation * .3)} l-.025 .015Z`));
        } break;
      case 'noise':
        for (let i = 0; i < 8; i++) primitives.push({ ...circle((random() - .5), (random() - .5), .012 + random() * (.025 + roughness * .04)), opacity: .2 + random() * .8 });
        x += jitter() * cell * .2; break;
      case 'grain':
        for (let i = 0; i < 6; i++) {
          const px = random() - .5, py = random() - .5;
          primitives.push(path(`M${n(px)} ${n(py)} l${n(.01 + roughness * .025)} ${n(.06 + random() * (.12 + variation * .15))}`, 'none', 0, .012));
        } break;
      case 'dither': {
        const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
        const threshold = .3 + .4 * (1 + Math.cos(column / divisions * Math.PI * 2)) / 2;
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
          if ((bayer[j * 4 + i] + random() * variation * 2) / 16 < threshold) primitives.push(rect(i / 4 - .5, j / 4 - .5, .08 + roughness * .08, .08 + roughness * .08));
        } break;
      }
      case 'pixel-grid':
        primitives.push(rect(-.5 + t, -.5 + t, 1 - 2 * t, 1 - 2 * t)); break;
      default: break;
    }
    if (primitives.length) add(x, y, primitives);
  }
  return { kind, width, height, tileWidth, tileHeight,
    angle: bound(settings.patternRotation, 0, -360, 360), colors, background, motifs,
    replicas: periodicReplicas(motifs, tileWidth, tileHeight) };
}
