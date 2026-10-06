export interface ShapePathNode {
  x: number;
  y: number;
  in?: { x: number; y: number };
  out?: { x: number; y: number };
}

/** Coordinates and cubic handles are absolute percentages of the element bounds. */
export interface ShapePath {
  closed: boolean;
  nodes: ShapePathNode[];
  subpaths?: ShapePath[];
}

export interface ShapeGeometryElement {
  type?: string;
  content: string;
  width?: number;
  height?: number;
  borderWidth?: number;
  shapeGeometry?: 'bounds';
  shapeParameters?: Record<string, number | string>;
  shapePath?: ShapePath;
}

export interface ShapeControl {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number | string;
  options?: { value: string; label: string }[];
}

const control = (key: string, label: string, min: number, max: number, value: number, step = 1): ShapeControl => ({ key, label, min, max, step, default: value });
const roundness = control('roundness', 'Roundness', 0, 100, 0);
const corners = ['Top left', 'Top right', 'Bottom right', 'Bottom left'].map((label, i) => control(['cornerTopLeft', 'cornerTopRight', 'cornerBottomRight', 'cornerBottomLeft'][i], `${label} corner`, 0, 32, 4));

export function shapeControls(content: string): ShapeControl[] {
  switch (content) {
    case 'star': return [control('points', 'Points', 3, 32, 5), control('innerRadius', 'Inner radius', 1, 48, 22), control('outerRadius', 'Outer radius', 2, 48, 44), control('sharpness', 'Sharpness', 0, 100, 100), roundness];
    case 'polygon': case 'custom-polygon': return [control('sides', 'Sides', 3, 32, 6), roundness];
    case 'triangle': case 'diamond': return [roundness];
    case 'rect': return corners;
    case 'rounded-rect': return corners.map(item => ({ ...item, default: 14 }));
    case 'burst': case 'sunburst': case 'badge': case 'seal': return [control('rays', 'Rays', 4, 48, content === 'burst' || content === 'sunburst' ? 12 : 16), control('innerRadius', 'Inner radius', 1, 48, content === 'burst' || content === 'sunburst' ? 28 : 39), control('outerRadius', 'Outer radius', 2, 48, 44), control('rotation', 'Ray rotation', -180, 180, 0), roundness];
    case 'spiral': return [control('turns', 'Turns', 0.5, 8, 3, 0.1), control('spacing', 'Spacing', 1, 20, 12, 0.5), { key: 'direction', label: 'Direction', min: 0, max: 0, step: 1, default: 'clockwise', options: [{ value: 'clockwise', label: 'Clockwise' }, { value: 'counterclockwise', label: 'Counterclockwise' }] }];
    case 'wave': case 'squiggly': return [control('frequency', 'Frequency', 0.5, 12, 2, 0.5), control('amplitude', 'Amplitude', 0, 44, 28.5, 0.5)];
    case 'arrow': return [control('head', 'Head length', 5, 65, 30), control('headWidth', 'Head width', 10, 90, 64), control('shaft', 'Shaft width', 2, 80, 40), control('length', 'Length', 20, 96, 84)];
    case 'zigzag': return [control('peaks', 'Peaks', 1, 20, 4), control('height', 'Height', 0, 90, 72), control('spacing', 'Spacing', 1, 24, 12)];
    case 'arc': return [control('startAngle', 'Start angle', -180, 180, -150), control('sweep', 'Sweep', 10, 350, 120)];
    case 'ring': return [control('innerRadius', 'Inner radius', 2, 42, 26)];
    case 'crescent': return [control('inset', 'Crescent depth', 4, 48, 48)];
    case 'blob': return [control('lobes', 'Lobes', 3, 10, 5), control('variation', 'Variation', 0, 20, 9), control('seed', 'Variation seed', 0, 30, 1)];
    default: return [];
  }
}

export function shapeParameterValue(element: ShapeGeometryElement, item: ShapeControl): number | string {
  const raw = element.shapeParameters?.[item.key];
  if (item.options) return item.options.some(option => option.value === raw) ? String(raw) : item.default;
  const value = raw === undefined ? Number(item.default) : Number(raw);
  if (!Number.isFinite(value)) return item.default;
  return Math.min(item.max, Math.max(item.min, value));
}

function parameter(element: ShapeGeometryElement, key: string, fallback: number, min = 0, max = 100) {
  const raw = element.shapeParameters?.[key];
  const value = raw === undefined ? fallback : Number(raw);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

const node = (x: number, y: number): ShapePathNode => ({ x, y });
const mix = (a: ShapePathNode, b: ShapePathNode, t: number) => node(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const points = (values: number[][]): ShapePathNode[] => values.map(([x, y]) => node(x, y));
const polygon = (nodes: ShapePathNode[], amount = 0): ShapePath => {
  if (!amount) return { closed: true, nodes };
  const t = Math.min(0.49, Math.max(0, amount / 200));
  return { closed: true, nodes: nodes.flatMap((corner, i) => {
    const a = mix(corner, nodes[(i + nodes.length - 1) % nodes.length], t);
    const b = mix(corner, nodes[(i + 1) % nodes.length], t);
    a.out = mix(a, corner, 2 / 3);
    b.in = mix(b, corner, 2 / 3);
    return [a, b];
  }) };
};

function ellipseArc(cx: number, cy: number, rx: number, ry: number, start: number, sweep: number): ShapePath {
  const segments = Math.max(1, Math.ceil(Math.abs(sweep) / 90));
  const step = sweep * Math.PI / 180 / segments;
  const nodes: ShapePathNode[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = start * Math.PI / 180 + i * step;
    const n = node(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
    const k = 4 / 3 * Math.tan(step / 4);
    if (i) n.in = node(n.x + k * rx * Math.sin(angle), n.y - k * ry * Math.cos(angle));
    if (i < segments) n.out = node(n.x - k * rx * Math.sin(angle), n.y + k * ry * Math.cos(angle));
    nodes.push(n);
  }
  if (Math.abs(sweep) === 360) {
    nodes[0].in = nodes.pop()!.in;
    return { closed: true, nodes };
  }
  return { closed: false, nodes };
}

function rectangle(x: number, y: number, width: number, height: number, radii: number[], aspect = 1): ShapePath {
  // SVG rect corners are circular in the geometry's own viewBox, including quick-draw bounds.
  const r = radii.map(value => Math.max(0, value));
  const scale = Math.min(1, width / Math.max(1, r[0] + r[1], r[2] + r[3]), height / Math.max(1, (r[0] + r[3]) * aspect, (r[1] + r[2]) * aspect));
  const [tl, tr, br, bl] = r.map(value => value * scale);
  const nodes: ShapePathNode[] = [];
  for (const [cx, cy, radius, angle] of [[x + tl, y + tl * aspect, tl, 180], [x + width - tr, y + tr * aspect, tr, 270], [x + width - br, y + height - br * aspect, br, 0], [x + bl, y + height - bl * aspect, bl, 90]]) {
    nodes.push(...ellipseArc(cx, cy, radius, radius * aspect, angle, 90).nodes);
  }
  return { closed: true, nodes };
}

function radial(count: number, outer: number, inner: number | undefined, rotation = 0): ShapePathNode[] {
  return Array.from({ length: inner === undefined ? count : count * 2 }, (_, i) => {
    const radius = inner === undefined || i % 2 === 0 ? outer : inner;
    const angle = (-90 + rotation) * Math.PI / 180 + i * Math.PI * 2 / (inner === undefined ? count : count * 2);
    return node(50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle));
  });
}

function clonePath(path: ShapePath): ShapePath {
  return { closed: !!path.closed, nodes: path.nodes.map(n => ({ x: n.x, y: n.y, ...(n.in ? { in: { ...n.in } } : {}), ...(n.out ? { out: { ...n.out } } : {}) })), ...(path.subpaths ? { subpaths: path.subpaths.map(clonePath) } : {}) };
}

/** Materializes the visible geometry without baking in rotation, flips, paint, or effects. */
export function shapeToEditablePath(element: ShapeGeometryElement): ShapePath {
  if (element.shapePath) return clonePath(element.shapePath);
  const content = element.content;
  const p = (key: string, fallback: number, min = 0, max = 100) => parameter(element, key, fallback, min, max);
  const rounding = p('roundness', 0);
  const poly = (values: number[][]) => polygon(points(values), rounding);
  if (element.shapeGeometry === 'bounds') {
    const sw = Math.max(0, element.borderWidth ?? 4);
    const width = Math.max(sw, element.width ?? 100);
    const height = Math.max(sw, element.height ?? 100);
    const x = sw / width * 50, y = sw / height * 50;
    if (content === 'ellipse' || content === 'circle') return ellipseArc(50, 50, 50 - x, 50 - y, 0, 360);
    if (content === 'semicircle-open' || content === 'semicircle-closed') return { ...ellipseArc(50, 100 - y, 50 - x, 100 - 2 * y, 180, 180), closed: content === 'semicircle-closed' };
    if (content === 'rect') return rectangle(x, y, 100 - 2 * x, 100 - 2 * y, corners.map(item => p(item.key, 0) * 100 / width), width / height);
    if (content === 'line') return { closed: false, nodes: points([[x, 50], [100 - x, 50]]) };
  }
  switch (content) {
    case 'ellipse': return ellipseArc(50, 50, 42, 32, 0, 360);
    case 'circle': return ellipseArc(50, 50, 42, 42, 0, 360);
    case 'rect': case 'rounded-rect': return rectangle(12, 18, 76, 64, corners.map(item => p(item.key, content === 'rect' ? 4 : 14, 0, 32)));
    case 'line': return { closed: false, nodes: points([[8, 50], [92, 50]]) };
    case 'triangle': return poly([[50, 12], [90, 86], [10, 86]]);
    case 'diamond': return poly([[50, 6], [94, 50], [50, 94], [6, 50]]);
    case 'star': {
      if (!['points', 'innerRadius', 'outerRadius', 'sharpness'].some(key => element.shapeParameters?.[key] !== undefined)) return poly([[50, 8], [61, 38], [94, 38], [67, 58], [78, 90], [50, 70], [22, 90], [33, 58], [6, 38], [39, 38]]);
      const outer = p('outerRadius', 44, 2, 48);
      const inner = Math.min(outer, p('innerRadius', 22, 1, 48));
      return polygon(radial(Math.round(p('points', 5, 3, 32)), outer, outer - (outer - inner) * p('sharpness', 100) / 100), rounding);
    }
    case 'polygon': case 'custom-polygon': return polygon(radial(Math.round(p('sides', 6, 3, 32)), 44, undefined), rounding);
    case 'burst': case 'sunburst': case 'badge': case 'seal': {
      const badge = content === 'badge' || content === 'seal';
      const outer = p('outerRadius', 44, 2, 48);
      return polygon(radial(Math.round(p('rays', badge ? 16 : 12, 4, 48)), outer, Math.min(outer, p('innerRadius', badge ? 39 : 28, 1, 48)), p('rotation', 0, -180, 180)), rounding);
    }
    case 'arrow': {
      const length = p('length', 84, 20, 96), x = (100 - length) / 2;
      const shoulder = x + length - Math.min(length - 1, p('head', 30, 5, 65));
      const head = p('headWidth', 64, 10, 90) / 2, shaft = Math.min(head, p('shaft', 40, 2, 80) / 2);
      return poly([[x, 50 - shaft], [shoulder, 50 - shaft], [shoulder, 50 - head], [100 - x, 50], [shoulder, 50 + head], [shoulder, 50 + shaft], [x, 50 + shaft]]);
    }
    case 'zigzag': {
      if (!element.shapeParameters || !Object.keys(element.shapeParameters).length) return { closed: false, nodes: points([[4, 86], [16, 14], [28, 86], [40, 14], [52, 86], [64, 14], [76, 86], [88, 14], [96, 86]]) };
      const count = Math.round(p('peaks', 4, 1, 20)) * 2;
      const spacing = Math.min(p('spacing', 12, 1, 24), 92 / count), height = p('height', 72, 0, 90) / 2;
      return { closed: false, nodes: Array.from({ length: count + 1 }, (_, i) => node(50 - count * spacing / 2 + i * spacing, 50 + (i % 2 ? -height : height))) };
    }
    case 'squiggly': {
      if (!element.shapeParameters || !Object.keys(element.shapeParameters).length) return { closed: false, nodes: [
        { x: 4, y: 50, out: node(12.25, 12) }, { x: 28, y: 50, in: node(19.75, 12), out: node(36.25, 88) },
        { x: 52, y: 50, in: node(43.75, 88), out: node(60.25, 12) }, { x: 76, y: 50, in: node(67.75, 12), out: node(84.25, 88) }, { x: 96, y: 50, in: node(91.75, 88) },
      ] };
      return wave(p('frequency', 2, 0.5, 12), p('amplitude', 28.5, 0, 44));
    }
    case 'wave': return wave(p('frequency', 2, 0.5, 12), p('amplitude', 28.5, 0, 44));
    case 'arc': return ellipseArc(50, 50, 42, 42, p('startAngle', -150, -180, 180), p('sweep', 120, 10, 350));
    case 'ring': return { ...ellipseArc(50, 50, 44, 44, 0, 360), subpaths: [ellipseArc(50, 50, p('innerRadius', 26, 2, 42), p('innerRadius', 26, 2, 42), 0, -360)] };
    case 'semicircle': case 'semi-circle': case 'semicircle-closed': return { ...ellipseArc(50, 84, 42, 68, 180, 180), closed: true };
    case 'semicircle-open': return ellipseArc(50, 84, 42, 68, 180, 180);
    case 'cross': case 'plus': return poly([[36, 8], [64, 8], [64, 36], [92, 36], [92, 64], [64, 64], [64, 92], [36, 92], [36, 64], [8, 64], [8, 36], [36, 36]]);
    case 'chevron': return poly([[8, 12], [42, 12], [92, 50], [42, 88], [8, 88], [58, 50]]);
    case 'trapezoid': return poly([[28, 18], [72, 18], [94, 82], [6, 82]]);
    case 'parallelogram': return poly([[28, 18], [94, 18], [72, 82], [6, 82]]);
    case 'lightning': case 'lightning-bolt': return poly([[54, 4], [20, 56], [46, 56], [36, 96], [84, 38], [57, 38], [72, 4]]);
    case 'heart': return { closed: true, nodes: [
      { x: 50, y: 28, in: node(38, 6), out: node(62, 6) }, { x: 92, y: 30, in: node(90, 6), out: node(100, 54) },
      { x: 50, y: 92, in: node(65, 74), out: node(35, 74) }, { x: 8, y: 30, in: node(0, 54), out: node(10, 6) },
    ] };
    case 'crescent': {
      const path = ellipseArc(50, 50, 42, 42, -90, -180);
      path.closed = true;
      path.nodes[path.nodes.length - 1].out = node(50 - p('inset', 48, 4, 48), 82);
      path.nodes[0].in = node(50 - p('inset', 48, 4, 48), 18);
      return path;
    }
    case 'spiral': {
      const turns = p('turns', 3, 0.5, 8), spacing = p('spacing', 12, 1, 20);
      const direction = element.shapeParameters?.direction === 'counterclockwise' ? -1 : 1;
      const total = turns * Math.PI * 2, segments = Math.ceil(turns * 32), step = total / segments;
      const growth = Math.min(spacing, 44 / turns) / (Math.PI * 2);
      return { closed: false, nodes: Array.from({ length: segments + 1 }, (_, i) => {
        const t = i * step, a = direction * t, r = growth * t;
        const n = node(50 + r * Math.cos(a), 50 + r * Math.sin(a));
        const dx = growth * Math.cos(a) - r * Math.sin(a) * direction, dy = growth * Math.sin(a) + r * Math.cos(a) * direction;
        if (i) n.in = node(n.x - dx * step / 3, n.y - dy * step / 3);
        if (i < segments) n.out = node(n.x + dx * step / 3, n.y + dy * step / 3);
        return n;
      }) };
    }
    case 'speech-bubble': return { closed: true, nodes: [
      { x: 20, y: 12, in: node(13.37, 12) }, { x: 80, y: 12, out: node(86.63, 12) },
      { x: 92, y: 24, in: node(92, 17.37) }, { x: 92, y: 62, out: node(92, 68.63) },
      { x: 80, y: 74, in: node(86.63, 74) }, node(46, 74), node(23, 94), node(28, 74),
      { x: 20, y: 74, out: node(13.37, 74) }, { x: 8, y: 62, in: node(8, 68.63) },
      { x: 8, y: 24, out: node(8, 17.37) },
    ] };
    case 'cloud': return { closed: true, nodes: [
      { x: 20, y: 78, in: node(1, 78) }, { x: 80, y: 78, out: node(100, 78) },
      { x: 90, y: 42, in: node(100, 48), out: node(94, 19) }, { x: 62, y: 24, in: node(71, 12), out: node(40, 2) },
      { x: 26, y: 36, in: node(25, 10), out: node(10, 28) }, { x: 12, y: 49, in: node(7, 34), out: node(0, 50) },
    ] };
    case 'blob': {
      const lobes = Math.round(p('lobes', 5, 3, 10)), variation = p('variation', 9, 0, 20), seed = p('seed', 1, 0, 30);
      const count = lobes * 12, step = 2 * Math.PI / count;
      const sample = (t: number) => {
        const radius = 39 - variation / 2 + variation / 2 * Math.sin(lobes * t + seed) + variation / 5 * Math.sin(3 * t + seed * 2);
        return node(50 + radius * Math.cos(t), 50 + radius * Math.sin(t));
      };
      return { closed: true, nodes: Array.from({ length: count }, (_, i) => {
        const t = i * step, n = sample(t), prev = sample(t - 0.0001), next = sample(t + 0.0001);
        const dx = (next.x - prev.x) / 0.0002 * step / 3, dy = (next.y - prev.y) / 0.0002 * step / 3;
        return { ...n, in: node(n.x - dx, n.y - dy), out: node(n.x + dx, n.y + dy) };
      }) };
    }
    default: return { closed: false, nodes: [] };
  }
}

function wave(frequency: number, amplitude: number): ShapePath {
  const count = Math.ceil(frequency * 16), dx = 92 / count, omega = frequency * Math.PI * 2 / 92;
  return { closed: false, nodes: Array.from({ length: count + 1 }, (_, i) => {
    const phase = i * dx * omega, n = node(4 + i * dx, 50 - amplitude * Math.sin(phase));
    const slope = -amplitude * omega * Math.cos(phase);
    if (i) n.in = node(n.x - dx / 3, n.y - slope * dx / 3);
    if (i < count) n.out = node(n.x + dx / 3, n.y + slope * dx / 3);
    return n;
  }) };
}

export function shapePathData(path: ShapePath): string {
  const coordinate = (value: number) => Number.isFinite(value) ? String(Math.round(value * 1000000) / 1000000) : '0';
  const xy = (n: { x: number; y: number }) => `${coordinate(n.x)} ${coordinate(n.y)}`;
  const nodes = path.nodes;
  const commands: string[] = [];
  if (nodes.length) {
    commands.push(`M ${xy(nodes[0])}`);
    const length = nodes.length + (path.closed ? 1 : 0);
    for (let i = 1; i < length; i++) {
      const a = nodes[i - 1], b = nodes[i % nodes.length];
      commands.push(a.out || b.in ? `C ${xy(a.out ?? a)} ${xy(b.in ?? b)} ${xy(b)}` : `L ${xy(b)}`);
    }
    if (path.closed) commands.push('Z');
  }
  for (const subpath of path.subpaths ?? []) commands.push(shapePathData(subpath));
  return commands.join(' ');
}

export function shapeIsClosed(element: ShapeGeometryElement): boolean {
  if (element.type && element.type !== 'shape') return false;
  const path = shapeToEditablePath(element);
  const contours = (part: ShapePath): ShapePath[] => [...(part.nodes.length ? [part] : []), ...(part.subpaths ?? []).flatMap(contours)];
  const parts = contours(path);
  return parts.length > 0 && parts.every(part => part.closed && part.nodes.length >= 3);
}
