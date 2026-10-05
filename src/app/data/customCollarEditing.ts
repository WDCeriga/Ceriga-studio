import svgpath from 'svgpath';
import { filledFabricSilhouette } from '../lib/tshirtSvgUtils';

export type CollarPoint = { x: number; y: number };
export type CollarHandle = 'topLeft' | 'topRight' | 'dip' | 'flareLeft' | 'flareRight' | 'attachmentLeft' | 'attachmentRight' | 'height' | 'scale' | 'move' | 'rotate';
export interface CollarManualEdits {
  version: 1;
  offsets: Partial<Record<CollarHandle, CollarPoint>>;
  translation?: CollarPoint;
}
type CollarPath = { element: Element; points: { point: CollarPoint; move: boolean; close: boolean }[]; matrix: DOMMatrix };
export interface CollarEditGeometry {
  svg: string;
  paths: CollarPath[];
  width: number;
  height: number;
  left: number;
  top: number;
  bottom: number;
  attachment: CollarPoint[];
  pinDepth: number;
  handles: Record<CollarHandle, CollarPoint>;
}
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const cache = new Map<string, CollarEditGeometry>();
const validationCache = new WeakMap<CollarEditGeometry, { key: string; valid: boolean }>();
const renderingCache = new WeakMap<CollarEditGeometry, { key: string; svg: string }>();

export function collarEditGeometry(svg: string): CollarEditGeometry | undefined {
  if (cache.has(svg)) return cache.get(svg);
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (document.querySelector('parsererror') || !document.querySelector('[data-topology="collar-fabric-minus-opening"]')) return undefined;
  const paths: CollarPath[] = [];
  for (const element of document.querySelectorAll('path[d]')) {
    let matrix = new DOMMatrix();
    const ancestors: Element[] = [];
    for (let parent: Element | null = element; parent && parent.localName !== 'svg'; parent = parent.parentElement) ancestors.unshift(parent);
    for (const parent of ancestors) {
      const transform = (parent as SVGGraphicsElement).transform?.baseVal.consolidate()?.matrix;
      if (transform) matrix = matrix.multiply(DOMMatrix.fromMatrix(transform));
    }
    const points: CollarPath['points'] = [];
    const path = svgpath(element.getAttribute('d')!).matrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]).abs().unshort().unarc();
    let start = { x: 0, y: 0 };
    path.iterate((segment, _index, horizontal, vertical) => {
      const command = segment[0];
      const values = segment.slice(1) as number[];
      if (command === 'M') {
        start = { x: values[0], y: values[1] };
        points.push({ point: start, move: true, close: false });
        return;
      }
      const end = command === 'Z' ? start : command === 'H' ? { x: values[0], y: vertical }
        : command === 'V' ? { x: horizontal, y: values[0] } : { x: values.at(-2)!, y: values.at(-1)! };
      const controls = command === 'C' ? [{ x: horizontal, y: vertical }, { x: values[0], y: values[1] }, { x: values[2], y: values[3] }, end]
        : command === 'Q' ? [{ x: horizontal, y: vertical }, { x: values[0], y: values[1] }, end] : [{ x: horizontal, y: vertical }, end];
      const length = controls.slice(1).reduce((total, point, index) => total + Math.hypot(point.x - controls[index].x, point.y - controls[index].y), 0);
      const steps = Math.max(1, Math.ceil(length / 2));
      for (let step = 1; step <= steps; step++) {
        const fraction = step / steps;
        let curve = controls;
        while (curve.length > 1) curve = curve.slice(1).map((point, index) => ({ x: curve[index].x * (1 - fraction) + point.x * fraction, y: curve[index].y * (1 - fraction) + point.y * fraction }));
        points.push({ point: curve[0], move: false, close: command === 'Z' && step === steps });
      }
    });
    paths.push({ element, points, matrix });
  }
  const fabric = paths.filter(path => path.element.closest('[data-topology="collar-fabric-minus-opening"]')).flatMap(path => path.points.map(item => item.point));
  if (!fabric.length) return undefined;
  const left = Math.min(...fabric.map(point => point.x));
  const right = Math.max(...fabric.map(point => point.x));
  const top = Math.min(...fabric.map(point => point.y));
  const bottom = Math.max(...fabric.map(point => point.y));
  const width = right - left;
  const height = bottom - top;
  if (!width || !height) return undefined;
  const attachmentInk = paths.filter(path => path.element.closest('[data-topology="attachmentInk"]')).flatMap(path => path.points.map(item => item.point));
  const boundary = attachmentInk.length ? attachmentInk : fabric;
  const attachment = Array.from({ length: 129 }, (_, index) => {
    const horizontal = left + width * index / 128;
    const nearby = boundary.filter(point => Math.abs(point.x - horizontal) <= width / 128 + 2);
    return { x: horizontal, y: nearby.length ? Math.max(...nearby.map(point => point.y)) : bottom };
  });
  const opening = paths.filter(path => path.element.closest('[data-topology="innerBoundary"]')).flatMap(path => path.points.map(item => item.point));
  const openingBottom = opening.length ? Math.max(...opening.map(point => point.y)) : top + height * .35;
  const openingLeft = opening.length ? Math.min(...opening.map(point => point.x)) : left + width * .2;
  const openingRight = opening.length ? Math.max(...opening.map(point => point.x)) : right - width * .2;
  const center = (left + right) / 2;
  const geometry: CollarEditGeometry = { svg, paths, left, top, bottom, width, height, attachment, pinDepth: 2, handles: {
    topLeft: { x: openingLeft, y: top + height * .08 }, topRight: { x: openingRight, y: top + height * .08 },
    dip: { x: center, y: openingBottom }, flareLeft: { x: left + width * .025, y: top + height * .55 },
    flareRight: { x: right - width * .025, y: top + height * .55 },
    attachmentLeft: attachment[0], attachmentRight: attachment.at(-1)!,
    height: { x: center, y: top }, scale: { x: right + width * .12, y: top - height * .12 },
    move: { x: center - width * .16, y: top - height * .23 }, rotate: { x: center + width * .16, y: top - height * .23 },
  } };
  geometry.pinDepth = boundary.reduce((depth, point) => Math.max(depth, attachmentRow(geometry, point.x) - point.y + 2), 2);
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  cache.set(svg, geometry);
  return geometry;
}

function attachmentRow(geometry: CollarEditGeometry, horizontal: number) {
  const index = clamp((horizontal - geometry.left) / geometry.width * 128, 0, 128);
  const lower = Math.floor(index);
  return geometry.attachment[lower].y * (1 - index + lower) + geometry.attachment[Math.min(128, lower + 1)].y * (index - lower);
}

export function editedCollarPoint(geometry: CollarEditGeometry, edits: CollarManualEdits | undefined, point: CollarPoint): CollarPoint {
  const offsets = edits?.offsets ?? {};
  const get = (handle: CollarHandle) => offsets[handle] ?? { x: 0, y: 0 };
  const base = attachmentRow(geometry, point.x);
  const fraction = clamp((point.x - geometry.left) / geometry.width, 0, 1);
  const rise = Math.max(0, base - point.y);
  const pinned = clamp((rise - geometry.pinDepth) / Math.max(1, (base - geometry.top - geometry.pinDepth) * .65), 0, 1);
  const weight = pinned * pinned * (3 - 2 * pinned);
  const center = geometry.left + geometry.width / 2;
  const height = get('height').y;
  const scale = get('scale').x / geometry.width;
  const angle = get('rotate').x / geometry.width * .4;
  let horizontal = (point.x - center) * scale + get('move').x + (base - point.y) * Math.sin(angle);
  let vertical = height * rise / geometry.height - rise * scale + get('move').y + (point.x - center) * Math.sin(angle);
  for (const handle of ['topLeft', 'topRight', 'dip', 'flareLeft', 'flareRight'] as const) {
    const offset = get(handle);
    if (!offset.x && !offset.y) continue;
    const anchor = geometry.handles[handle];
    const spreadX = geometry.width * (handle === 'dip' ? .22 : .3);
    const spreadY = geometry.height * (handle === 'dip' ? .24 : .45);
    const influence = Math.exp(-(((point.x - anchor.x) / spreadX) ** 2) - ((point.y - anchor.y) / spreadY) ** 2);
    horizontal += offset.x * influence;
    vertical += offset.y * influence;
  }
  const attachmentWeight = 1 - clamp(rise / (geometry.height * .6), 0, 1);
  return { x: point.x + (edits?.translation?.x ?? 0) + horizontal * weight + attachmentWeight * (get('attachmentLeft').x * (1 - fraction) + get('attachmentRight').x * fraction),
    y: point.y + (edits?.translation?.y ?? 0) + vertical * weight + attachmentWeight * (get('attachmentLeft').y * (1 - fraction) + get('attachmentRight').y * fraction) };
}

export function validCollarEdits(geometry: CollarEditGeometry, edits: CollarManualEdits): boolean {
  if (edits.translation && (![edits.translation.x, edits.translation.y].every(Number.isFinite)
    || Math.abs(edits.translation.x) > 2048 || Math.abs(edits.translation.y) > 2048)) return false;
  const shape = { version: edits.version, offsets: edits.offsets };
  const key = JSON.stringify(shape);
  const cached = validationCache.get(geometry);
  if (cached?.key === key) return cached.valid;
  const valid = validateCollarEdits(geometry, shape);
  validationCache.set(geometry, { key, valid });
  return valid;
}

function validateCollarEdits(geometry: CollarEditGeometry, edits: CollarManualEdits): boolean {
  if (edits.version !== 1) return false;
  for (const [handle, offset] of Object.entries(edits.offsets)) {
    if (!(handle in geometry.handles) || !offset || !Number.isFinite(offset.x) || !Number.isFinite(offset.y)) return false;
    const limit = handle.startsWith('attachment') ? .08 : handle === 'move' || handle === 'rotate' ? .12 : .35;
    if (Math.abs(offset.x) > geometry.width * limit || Math.abs(offset.y) > geometry.height * limit) return false;
  }
  for (let column = 0; column <= 40; column++) {
    const horizontal = geometry.left + geometry.width * column / 40;
    for (let row = 0; row <= 24; row++) {
      const point = { x: horizontal, y: geometry.top + (attachmentRow(geometry, horizontal) - geometry.top) * row / 24 };
      const left = editedCollarPoint(geometry, edits, { x: point.x - .1, y: point.y });
      const right = editedCollarPoint(geometry, edits, { x: point.x + .1, y: point.y });
      const above = editedCollarPoint(geometry, edits, { x: point.x, y: point.y - .1 });
      const below = editedCollarPoint(geometry, edits, { x: point.x, y: point.y + .1 });
      if ((right.x - left.x) * (below.y - above.y) - (below.x - above.x) * (right.y - left.y) < .008) return false;
    }
  }
  return true;
}

export function collarBackFabric(svg: string, edits?: CollarManualEdits): string | undefined {
  const geometry = collarEditGeometry(svg);
  if (!geometry) return undefined;
  const document = new DOMParser().parseFromString(editedCollarSvg(svg, edits), 'image/svg+xml');
  const root = document.documentElement;
  for (const path of root.querySelectorAll('path')) {
    if (!path.closest('[data-topology="collar-fabric-minus-opening"]')) path.remove();
  }
  return filledFabricSilhouette(new XMLSerializer().serializeToString(root));
}

export function collarBodyFabric(bodySvg: string, registeredBodySvg: string, geometry: CollarEditGeometry | undefined,
  edits: CollarManualEdits | undefined, socket: { minX: number; minY: number; maxX: number; maxY: number }): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(bodySvg, 'image/svg+xml');
  const root = document.documentElement;
  const namespace = 'http://www.w3.org/2000/svg';
  const attachment = geometry?.attachment.map(point => editedCollarPoint(geometry, edits, point)) ?? [];
  const left = Math.floor(Math.min(socket.minX, ...attachment.map(point => point.x))) - 8;
  const right = Math.ceil(Math.max(socket.maxX, ...attachment.map(point => point.x))) + 8;
  const bottom = Math.ceil(Math.max(socket.maxY, ...attachment.map(point => point.y))) + 8;
  const suffix = Math.abs(left * 31 + right * 17 + bottom).toString().replace('.', '-');
  const patchId = `collar-body-patch-${suffix}`;
  const defs = document.createElementNS(namespace, 'defs');
  const patch = document.createElementNS(namespace, 'clipPath');
  patch.setAttribute('id', patchId);
  const patchPath = document.createElementNS(namespace, 'path');
  patchPath.setAttribute('d', `M${left} 0H${right}V${bottom}H${left}Z`);
  patch.append(patchPath);
  defs.append(patch);
  const replacement = parser.parseFromString(registeredBodySvg, 'image/svg+xml').documentElement;
  const fabric = replacement.querySelector('g[fill="#000000"]');
  const patchGroup = document.createElementNS(namespace, 'g');
  patchGroup.setAttribute('clip-path', `url(#${patchId})`);
  patchGroup.setAttribute('data-collar-body-patch', 'true');
  if (fabric) {
    fabric.setAttribute('data-shared-fabric', 'true');
    patchGroup.append(document.importNode(fabric, true));
  }
  root.append(patchGroup, defs);
  return new XMLSerializer().serializeToString(root);
}

export function editedCollarSvg(svg: string, edits?: CollarManualEdits): string {
  if (edits?.translation && (edits.translation.x || edits.translation.y)) {
    const geometry = collarEditGeometry(svg);
    if (!geometry || !validCollarEdits(geometry, edits)) return svg;
    const shape = editedCollarSvg(svg, { version: edits.version, offsets: edits.offsets });
    const document = new DOMParser().parseFromString(shape, 'image/svg+xml');
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('transform', `translate(${edits.translation.x} ${edits.translation.y})`);
    group.append(...Array.from(document.documentElement.childNodes));
    document.documentElement.append(group);
    return new XMLSerializer().serializeToString(document.documentElement);
  }
  if (!edits || !Object.values(edits.offsets).some(offset => offset && (offset.x || offset.y))) return svg;
  const geometry = collarEditGeometry(svg);
  if (!geometry || !validCollarEdits(geometry, edits)) return svg;
  const key = JSON.stringify(edits);
  const cached = renderingCache.get(geometry);
  if (cached?.key === key) return cached.svg;
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const elements = document.querySelectorAll('path[d]');
  geometry.paths.forEach((path, index) => {
    const inverse = path.matrix.inverse();
    const commands = path.points.map(item => {
      const mapped = editedCollarPoint(geometry, edits, item.point);
      const local = new DOMPoint(mapped.x, mapped.y).matrixTransform(inverse);
      return `${item.move ? 'M' : 'L'}${local.x.toFixed(3)} ${local.y.toFixed(3)}${item.close ? 'Z' : ''}`;
    });
    elements[index].setAttribute('d', commands.join(''));
  });
  const rendered = new XMLSerializer().serializeToString(document.documentElement);
  renderingCache.set(geometry, { key, svg: rendered });
  return rendered;
}