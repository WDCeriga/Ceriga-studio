import type { ImportedGarment, ImportedGarmentView, ImportedMeasurementDefinition, ImportedMeasurementId, ImportedMeasurementLandmark, ImportedPart } from './importedGarment';

type Point = [number, number];
export interface ImportedMeasurementGuide {
  id: ImportedMeasurementId;
  name: string;
  points: Point[];
  method: string;
  length: number;
  millimetres: number | null;
  status: 'calibrated' | 'supplied' | 'estimated' | 'uncalibrated' | 'unavailable';
  view: ImportedGarmentView;
  confidence: number;
}

function pathLength(points: Point[]) {
  return points.slice(1).reduce((length, point, index) => length + Math.hypot(point[0] - points[index][0], point[1] - points[index][1]), 0);
}

function intersections(outline: Point[], position: number, axis: 0 | 1): number[] {
  const other = axis === 0 ? 1 : 0;
  return outline.flatMap((start, index) => {
    const finish = outline[(index + 1) % outline.length];
    if ((start[axis] <= position && finish[axis] > position) || (finish[axis] <= position && start[axis] > position)) {
      const portion = (position - start[axis]) / (finish[axis] - start[axis]);
      return [start[other] + portion * (finish[other] - start[other])];
    }
    return [];
  }).sort((first, second) => first - second);
}

function contourPath(outline: Point[], start: Point, finish: Point[]): Point[] {
  const target = finish[0];
  const location = (point: Point) => {
    for (let index = 0; index < outline.length; index++) {
      const a = outline[index], b = outline[(index + 1) % outline.length];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length > 0 && Math.abs(Math.hypot(point[0] - a[0], point[1] - a[1]) + Math.hypot(point[0] - b[0], point[1] - b[1]) - length) < 1e-8)
        return index + Math.hypot(point[0] - a[0], point[1] - a[1]) / length;
    }
    return undefined;
  };
  const startLocation = location(start), endLocation = location(target);
  if (startLocation === undefined || endLocation === undefined) return [];
  const walk = (a: Point, from: number, b: Point, to: number) => {
    if (to < from) to += outline.length;
    const path: Point[] = [a];
    for (let index = Math.floor(from) + 1; index < to; index++) path.push(outline[index % outline.length]);
    return [...path, b];
  };
  return [walk(start, startLocation, target, endLocation), walk(target, endLocation, start, startLocation).reverse()]
    .sort((first, second) => pathLength(first) - pathLength(second))[0];
}

function usableOutline(part: ImportedPart): part is ImportedPart & { outline: Point[] } {
  return Boolean(part.outline && part.outline.length >= 3 && part.outline.every(point => point.length === 2 && point.every(value => Number.isFinite(value) && value >= 0 && value <= 1)));
}

type OutlinedPart = ImportedPart & { outline: Point[] };
type LocatedPoint = { part: OutlinedPart; point: Point; edgeId?: string; confidence?: number };
const role = (part: ImportedPart) => (part.semanticType === 'panel'
  ? `${part.structuralRole ?? ''} ${part.measurementRole ?? ''} panel`
  : part.semanticType).toLowerCase().replace(/[_-]/g, ' ');
const matches = (part: ImportedPart, pattern: RegExp) => pattern.test(role(part));
const distance = (first: Point, second: Point) => Math.hypot(first[0] - second[0], first[1] - second[1]);
const bounds = (part: OutlinedPart) => {
  const xs = part.outline.map(point => point[0]), ys = part.outline.map(point => point[1]);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
};
const polygonArea = (part: OutlinedPart) => Math.abs(part.outline.reduce((sum, point, index) => {
  const next = part.outline[(index + 1) % part.outline.length];
  return sum + point[0] * next[1] - next[0] * point[1];
}, 0)) / 2;

/** Roles drive selection; garment families only provide a fallback for generic panels. */
export function importedGarmentFamily(garmentType: string): 'bifurcated' | 'top' | 'skirt' | 'dress' | 'unknown' {
  const type = garmentType.toLowerCase().replace(/[_-]/g, ' ');
  if (/\b(shorts?|trousers?|pants?|jeans?|joggers?|leggings?)\b/.test(type)) return 'bifurcated';
  if (/\b(dress|gown|tunic)\b/.test(type)) return 'dress';
  if (/\bskirt\b/.test(type)) return 'skirt';
  if (/\b(tee|t shirt|tshirt|shirt|hoodie|sweatshirt|sweater|jacket|coat|top|vest|tank|camisole|singlet)\b/.test(type)) return 'top';
  return 'unknown';
}

function section(parts: OutlinedPart[], position: number, axis: 0 | 1): LocatedPoint[] {
  const found = parts.flatMap(part => intersections(part.outline, position, axis).map(value => ({ part,
    point: (axis === 1 ? [value, position] : [position, value]) as Point })));
  return found.sort((a, b) => a.point[axis === 1 ? 0 : 1] - b.point[axis === 1 ? 0 : 1]);
}

// Remove collinear samples and pixel-sized stair steps, retaining source vertices.
function cornerOutline(part: OutlinedPart): Point[] {
  const box = bounds(part);
  const steps = part.outline.map((value, index) => distance(value, part.outline[(index + 1) % part.outline.length])).filter(value => value > 0).sort((a, b) => a - b);
  const tolerance = Math.max(Math.max(box.right - box.left, box.bottom - box.top) * .008,
    part.outline.length > 32 ? (steps[Math.floor(steps.length / 2)] ?? 0) * 1.5 : 0);
  const simplify = (points: Point[]): Point[] => {
    if (points.length <= 2) return points;
    let furthest = 0, index = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const projected = project(points[i], points[0], points.at(-1)!);
      const separation = distance(points[i], projected);
      if (separation > furthest) { furthest = separation; index = i; }
    }
    return furthest > tolerance ? [...simplify(points.slice(0, index + 1)).slice(0, -1), ...simplify(points.slice(index))] : [points[0], points.at(-1)!];
  };
  const start = part.outline.reduce((best, value, i) => value[1] < part.outline[best][1] || value[1] === part.outline[best][1] && value[0] < part.outline[best][0] ? i : best, 0);
  const ordered = [...part.outline.slice(start), ...part.outline.slice(0, start)];
  return simplify([...ordered, ordered[0]]).slice(0, -1);
}

function project(point: Point, a: Point, b: Point): Point {
  const dx = b[0] - a[0], dy = b[1] - a[1], squared = dx * dx + dy * dy;
  const t = squared ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / squared)) : 0;
  return [a[0] + t * dx, a[1] + t * dy];
}

function nearestOutline(point: Point, parts: OutlinedPart[]): LocatedPoint | undefined {
  let nearest: LocatedPoint | undefined, separation = Infinity;
  for (const part of parts) for (let index = 0; index < part.outline.length; index++) {
    const projected = project(point, part.outline[index], part.outline[(index + 1) % part.outline.length]);
    const candidate = distance(point, projected);
    if (candidate < separation) { separation = candidate; nearest = { part, point: projected }; }
  }
  return nearest;
}

function bottomEdge(part: OutlinedPart, fraction = matches(part, /\b(hem|cuff)\b/) ? .65 : .2): Point[] {
  const box = bounds(part), threshold = box.bottom - (box.bottom - box.top) * fraction;
  const outline = cornerOutline(part);
  const lower = outline.map((point, index) => {
    const next = outline[(index + 1) % outline.length];
    return point[1] >= threshold && next[1] >= threshold && Math.abs(next[0] - point[0]) >= Math.abs(next[1] - point[1]);
  });
  const start = lower.findIndex(value => !value);
  if (start === -1) return [];
  const paths: Point[][] = [];
  let path: Point[] = [];
  for (let offset = 1; offset <= outline.length; offset++) {
    const index = (start + offset) % outline.length;
    if (lower[index]) {
      if (!path.length) path.push(outline[index]);
      path.push(outline[(index + 1) % outline.length]);
    } else if (path.length) {
      paths.push(path);
      path = [];
    }
  }
  return paths.sort((a, b) => pathLength(b) - pathLength(a))[0] ?? [];
}

function distalOpening(part: OutlinedPart, direction: Point): Point[] {
  const magnitude = Math.hypot(...direction);
  if (!magnitude) return [];
  const [dx, dy] = direction.map(value => value / magnitude);
  const rotated: Point[] = part.outline.map(([x, y]) => [x * dy - y * dx, x * dx + y * dy]);
  const original = new Map(rotated.map((value, index) => [value, part.outline[index]]));
  return bottomEdge({ ...part, outline: rotated }).map(value => original.get(value)!);
}

function sharedAttachment(sleeve: OutlinedPart, bodies: OutlinedPart[], inkGap = 0): Point[] {
  const box = bounds(sleeve);
  const tolerance = Math.max(inkGap, Math.max(box.right - box.left, box.bottom - box.top) * .002);
  const onBody = (value: Point) => {
    const nearest = nearestOutline(value, bodies);
    return nearest && distance(value, nearest.point) <= tolerance;
  };
  // A semantic seam can cross upper/lower torso partitions and the source stroke
  // separates their fill contours. Attachment metadata names only one neighbour.
  return sleeve.outline.flatMap((a, index) => {
    const b = sleeve.outline[(index + 1) % sleeve.outline.length];
    return onBody(a) && onBody(b) && onBody([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) ? [a, b] : [];
  });
}

/** Re-derived on every edit; serialized schema is metadata, never stale geometry authority. */
export function deriveImportedMeasurementSchema(garment: ImportedGarment, requestedView?: ImportedGarmentView): ImportedMeasurementDefinition[] {
  if (!requestedView) return (['front', 'back'] as const).flatMap(view => deriveImportedMeasurementSchema(garment, view));
  const view = requestedView;
  if (!garment.parts.some(part => part.view === view)) return [];
  const parts = garment.parts.filter(part => part.view === view && (part.layerKind === 'structural' || !part.layerKind && part.structural) && usableOutline(part)) as OutlinedPart[];
  const sourceInk = parts.filter(part => part.structuralRole === 'source-ink');
  const structural = parts.filter(part => part.structuralRole !== 'source-ink' && polygonArea(part) > 1e-10).sort((a, b) => polygonArea(b) - polygonArea(a));
  const inkGap = sourceInk.length ? Math.max(...sourceInk.map(part => {
    const box = bounds(part);
    return Math.max(box.right - box.left, box.bottom - box.top) * .008;
  })) : 0;
  const details = (garment.detailLayers ?? []).filter(detail => detail.view === view);
  const definitions: ImportedMeasurementDefinition[] = [];
  const point = (part: OutlinedPart, value: Point): LocatedPoint => ({ part, point: value });
  const landmark = (id: string, endpoint: LocatedPoint): ImportedMeasurementLandmark => ({ id, partId: endpoint.part.id,
    point: [...endpoint.point], source: endpoint.edgeId ? 'detail-edge' : 'outline', ...(endpoint.edgeId ? { edgeId: endpoint.edgeId } : {}) });
  const add = (id: ImportedMeasurementId, label: string, measurementType: ImportedMeasurementDefinition['measurementType'], method: string,
    endpoints: LocatedPoint[] = [], path?: Point[], confidence = .85) => {
    const start = endpoints[0], end = endpoints.at(-1);
    const points = path ?? (start && end ? [start.point, end.point] : []);
    const available = Boolean(start && end && points.length >= 2 && pathLength(points) > 1e-10);
    const evidenceConfidence = Math.min(...endpoints.map(endpoint => endpoint.confidence ?? endpoint.part.boundary?.confidence ?? .7));
    definitions.push({ id, label, view, measurementType, method, unit: 'mm', calibrationDependency: { view, kind: 'view-scale' },
      confidence: available ? Math.max(0, Math.min(confidence, Number.isFinite(evidenceConfidence) ? evidenceConfidence : 0)) : 0,
      startLandmark: available ? landmark(`${view}:${id}:start`, start!) : null,
      endLandmark: available ? landmark(`${view}:${id}:end`, end!) : null,
      points: available ? points.map(value => [...value] as Point) : [] });
  };
  const edge = (boundaryType: string, part?: OutlinedPart) => details.flatMap(detail => detail.visibleEdges.map(value => ({ detail, value })))
    .filter(({ detail, value }) => (!part || detail.partId === part.id) && structural.some(candidate => candidate.id === detail.partId) &&
      value.boundaryType === boundaryType && value.style === 'solid' && value.confidence >= .8 && value.points.length >= 2 &&
      value.points.every(value => value.length === 2 && value.every(coordinate => Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1)))
    .sort((a, b) => pathLength(b.value.points) - pathLength(a.value.points))[0];
  const edgeEndpoints = (found: NonNullable<ReturnType<typeof edge>>): LocatedPoint[] => {
    const part = structural.find(part => part.id === found.detail.partId)!;
    return [found.value.points[0], found.value.points.at(-1)!].map(value => ({ part, point: value, edgeId: found.value.id, confidence: found.value.confidence }));
  };
  const width = (id: string, label: string, targets: OutlinedPart[], level: number, method: string, confidence = .8) =>
    add(id, label, 'width', method, section(targets, level, 1), undefined, confidence);
  const vertical = (id: string, label: string, target: OutlinedPart | undefined) => {
    const box = target && bounds(target);
    add(id, label, 'length', 'Straight length between visible outline intersections at the panel centre; not a body circumference.',
      target && box ? section([target], (box.left + box.right) / 2, 0) : []);
  };
  let family = importedGarmentFamily(garment.manifest.garmentType);
  if (structural.some(part => matches(part, /\bleg\b/))) family = 'bifurcated';
  else if (structural.some(part => matches(part, /\bskirt\b/)) && family !== 'dress') family = 'skirt';
  else if (family === 'unknown' && structural.some(part => matches(part, /\b(body|torso|bodice|sleeve|hood)\b/))) family = 'top';
  const waistband = structural.find(part => matches(part, /\bwaistband\b/));
  const panels = structural.filter(part => part.semanticType === 'panel' && !matches(part, /\b(sleeve|hood|collar|cuff|waistband|pocket|overlay|lining|yoke|placket)\b/));
  let legs = structural.filter(part => matches(part, /\bleg\b/));
  if (!legs.length && family === 'bifurcated') legs = panels.slice(0, 2);
  legs = legs.slice(0, 2).sort((a, b) => bounds(a).left - bounds(b).left);
  const explicitBodies = structural.filter(part => matches(part, /\b(body|torso|bodice)\b/) && !matches(part, /\b(leg|sleeve|lining|overlay)\b/));
  const upperBodies = structural.filter(part => matches(part, /\byoke\b/) && !part.attachmentTo);
  const bodies = explicitBodies.length ? [...explicitBodies, ...upperBodies] : panels;
  const body = bodies[0];
  const bodyBoxes = bodies.map(bounds);
  const bodyBox = bodies.length ? { left: Math.min(...bodyBoxes.map(box => box.left)), right: Math.max(...bodyBoxes.map(box => box.right)),
    top: Math.min(...bodyBoxes.map(box => box.top)), bottom: Math.max(...bodyBoxes.map(box => box.bottom)) } : undefined;
  const skirt = structural.find(part => matches(part, /\bskirt\b/)) ?? body;
  const hemBands = structural.filter(part => matches(part, /\bhem\b/) && (!part.attachmentTo || bodies.some(body => body.id === part.attachmentTo)));
  const finishedBodies = [...bodies, ...hemBands];
  const centreSection = (targets: OutlinedPart[]): LocatedPoint[] => {
    if (!targets.length) return [];
    const boxes = targets.map(bounds), left = Math.min(...boxes.map(box => box.left)), right = Math.max(...boxes.map(box => box.right));
    const top = Math.min(...boxes.map(box => box.top)), bottom = Math.max(...boxes.map(box => box.bottom)), centre = (left + right) / 2;
    for (let step = 0; step <= 20; step++) {
      for (const sign of [-1, 1]) {
        const found = section(targets, centre + sign * step * (right - left) * .01, 0);
        if (found.length >= 2 && found.at(-1)!.point[1] - found[0].point[1] >= (bottom - top) * .65) return found;
      }
    }
    return [];
  };
  if (family === 'bifurcated') {
    const topParts = waistband ? [waistband] : legs;
    const upperPoints = topParts.flatMap(part => {
      const box = bounds(part);
      return part.outline.filter(value => value[1] <= box.top + (box.bottom - box.top) * (waistband ? .45 : .03)).map(value => point(part, value));
    }).sort((a, b) => a.point[0] - b.point[0]);
    add('waist', 'Waist width', 'width', 'Flat width between visible upper waist corners; not circumference.', upperPoints);
    const waistStart = upperPoints[0], waistEnd = upperPoints.at(-1);
    const centre = waistStart && waistEnd ? (waistStart.point[0] + waistEnd.point[0]) / 2 : 0;
    const waistSection = section(topParts, centre, 0);
    const leg = legs[0];
    const box = leg && bounds(leg);
    const crotchCandidates = leg && box ? leg.outline.filter(value => value[1] > box.top + (box.bottom - box.top) * .05 && value[1] < box.bottom - (box.bottom - box.top) * .15) : [];
    const crotch = crotchCandidates.sort((a, b) => b[0] - a[0] || a[1] - b[1])[0];
    const waistCentre = waistSection[0];
    const waistLower = waistband ? bounds(waistband).bottom : box?.top;
    const hipLevel = crotch && waistLower !== undefined ? (waistLower + crotch[1]) / 2 : box ? box.top + (box.bottom - box.top) * .25 : 0;
    width('hip', 'Hip width', legs, hipLevel, 'Flat width through outline intersections at an estimated mid-rise hip level.', .7);
    add(view === 'front' ? 'front-rise' : 'back-rise', view === 'front' ? 'Front rise' : 'Back rise', 'length',
      'Upper waist centre to the visible inner-leg junction vertex; curved seam allowance excluded.', waistCentre && crotch && leg ? [waistCentre, point(leg, crotch)] : []);
    const hem = leg && edge('hem-edge', leg);
    const hemPath = hem ? hem.value.points : leg ? bottomEdge(leg) : [];
    const hemEnds = hem ? edgeEndpoints(hem) : leg && hemPath.length ? [point(leg, hemPath[0]), point(leg, hemPath.at(-1)!)] : [];
    if (hemEnds.length && hemEnds[0].point[0] > hemEnds[1].point[0]) hemEnds.reverse();
    const outer = hemEnds[0], inner = hemEnds[1];
    const legTop = leg && waistStart && leg.outline.reduce((best, value) => distance(value, waistStart.point) < distance(best, waistStart.point) ? value : best);
    add('outseam', 'Outseam', 'contour', 'Visible outer contour from the upper waist to the outer hem.',
      waistStart && outer ? [waistStart, outer] : [], leg && legTop && waistStart && outer ? [waistStart.point, ...contourPath(leg.outline, legTop, [outer.point])] : []);
    add('inseam', 'Inseam', 'contour', 'Visible inner contour from the crotch vertex to the inner hem.',
      leg && crotch && inner ? [point(leg, crotch), inner] : [], leg && crotch && inner ? contourPath(leg.outline, crotch, [inner.point]) : []);
    add('leg-opening', 'Leg opening', 'contour', 'One visible finished hem edge, measured flat.', hemEnds,
      hemEnds.length && distance(hemEnds[0].point, hemPath[0]) > 1e-10 ? [...hemPath].reverse() : hemPath);
    add('waistband-height', 'Waistband height', 'length', 'Upper to lower waistband outline at its centre.', waistband ? section([waistband], centre, 0) : []);
  }
  if (family === 'top' || family === 'dress') {
    const box = bodyBox;
    const sleeves = structural.filter(part => matches(part, /\bsleeve\b/));
    const attachments = new Map(sleeves.map(sleeve => [sleeve.id, sharedAttachment(sleeve, bodies, inkGap)]));
    const armholes = [...attachments.values()].filter(points => points.length >= 2);
    const chestLevel = armholes.length ? Math.max(...armholes.flat().map(point => point[1])) : box ? box.top + (box.bottom - box.top) * .3 : 0;
    width('chest', 'Chest width', bodies, chestLevel, armholes.length
      ? 'Flat body width at the lower shared sleeve/body armhole junctions, excluding separate sleeves.'
      : 'Flat width across body-panel outline intersections at an estimated chest level, excluding separate sleeves.', armholes.length ? .85 : .7);
    add(family === 'dress' ? 'dress-length' : 'body-length', family === 'dress' ? 'Dress length' : 'Body length', 'length',
      'Straight neckline-to-finished-hem length at centre body or the nearest supported centre-front panel beside an opening.', centreSection(finishedBodies));
    const attachmentShoulders = armholes.map(values => nearestOutline([...values].sort((a, b) => a[1] - b[1])[0], bodies))
      .filter((value): value is LocatedPoint => Boolean(value)).sort((a, b) => a.point[0] - b.point[0]);
    const shoulders = attachmentShoulders.length >= 2 ? [attachmentShoulders[0], attachmentShoulders.at(-1)!] : !sourceInk.length && box ?
      bodies.flatMap(part => part.outline.filter(value => value[1] <= box.top + (box.bottom - box.top) * .15)
        .map(value => point(part, value))).sort((a, b) => a.point[0] - b.point[0]) : [];
    add('shoulder-width', 'Shoulder width', 'width', attachmentShoulders.length >= 2
      ? 'Between the upper left and right sleeve-to-torso attachment endpoints, including upper chest panels.'
      : 'Estimated upper body-panel corners; shoulder attachments are not resolved.', shoulders, undefined, attachmentShoulders.length >= 2 ? .85 : .55);
    const sleeve = structural.find(part => matches(part, /\bsleeve\b/));
    if (sleeve || family === 'top') {
      const sleeveBox = sleeve && bounds(sleeve);
      const referenceBox = box ?? sleeveBox;
      const centre: Point | undefined = referenceBox ? [(referenceBox.left + referenceBox.right) / 2, (referenceBox.top + referenceBox.bottom) / 2] : undefined;
      const cuff = structural.find(part => matches(part, /\bcuff\b/) && (!sleeve || part.attachmentTo === sleeve.id));
      const cuffEdge = sleeve && edge('hem-edge', sleeve);
      const attachment = sleeve ? attachments.get(sleeve.id) ?? [] : [];
      const attachmentCentre: Point | undefined = attachment.length ? [attachment.reduce((sum, value) => sum + value[0], 0) / attachment.length,
        attachment.reduce((sum, value) => sum + value[1], 0) / attachment.length] : centre;
      const direction: Point = sleeveBox && attachmentCentre ? [(sleeveBox.left + sleeveBox.right) / 2 - attachmentCentre[0],
        (sleeveBox.top + sleeveBox.bottom) / 2 - attachmentCentre[1]] : [0, 1];
      const distal = sleeve ? distalOpening(sleeve, direction) : [];
      const cuffPoints = cuffEdge ? cuffEdge.value.points : cuff ? bottomEdge(cuff) : distal;
      const cuffEnds = cuffEdge ? edgeEndpoints(cuffEdge) : cuffPoints.length && (cuff || sleeve) ?
        [point((cuff ?? sleeve)!, cuffPoints[0]), point((cuff ?? sleeve)!, cuffPoints.at(-1)!)] : [];
      const sharedShoulder = [...attachment].sort((a, b) => a[1] - b[1])[0];
      const sleeveStart = sharedShoulder ?? (sleeve && sleeveBox && centre ? sleeve.outline.filter(value => value[1] <= sleeveBox.top + (sleeveBox.bottom - sleeveBox.top) * .1)
        .sort((a, b) => distance(a, centre) - distance(b, centre))[0] : undefined);
      const outerFirst = (a: Point, b: Point) => sleeveBox && centre && (sleeveBox.left + sleeveBox.right) / 2 < centre[0] ? a[0] - b[0] : b[0] - a[0];
      let sleeveEnd = distal.length ? [...distal].sort(outerFirst)[0] : undefined;
      let sleeveEndPart = sleeve;
      let sleevePath = sleeve && sleeveStart && sleeveEnd ? contourPath(sleeve.outline, sleeveStart, [sleeveEnd]) : [];
      if (sourceInk.length && sleeve && sleeveStart && cuff && cuffPoints.length) {
        const cuffEnd = [...cuffPoints].sort(outerFirst)[0];
        const cuffTop = cornerOutline(cuff).filter(value => value[1] < bounds(cuff).top + (bounds(cuff).bottom - bounds(cuff).top) * .4).sort(outerFirst)[0];
        const join = cuffTop && nearestOutline(cuffTop, [sleeve]);
        if (join && distance(join.point, cuffTop) <= inkGap * 2) {
          sleeveEnd = cuffEnd;
          sleeveEndPart = cuff;
          sleevePath = [...contourPath(sleeve.outline, sleeveStart, [join.point]), ...contourPath(cuff.outline, cuffTop, [cuffEnd])];
        }
      }
      add('sleeve-length', 'Sleeve length', 'contour', 'Visible outer sleeve contour from shoulder attachment to the finished opening, including an attached cuff when its join is visible.',
        sleeve && sleeveStart && sleeveEnd && sleeveEndPart ? [point(sleeve, sleeveStart), point(sleeveEndPart, sleeveEnd)] : [], sleevePath);
      add('cuff-opening', 'Cuff opening', 'contour', 'One visible sleeve or cuff opening, measured flat.', cuffEnds, cuffPoints, .8);
    }
    const necks = structural.filter(part => matches(part, /\b(neckband|collar)\b/));
    const neckPoints = necks.length ? necks.flatMap(neck => {
      const neckBox = bounds(neck);
      return neck.outline.filter(value => value[1] <= neckBox.top + (neckBox.bottom - neckBox.top) * .35).map(value => point(neck, value));
    }).sort((a, b) => a.point[0] - b.point[0]) : !sourceInk.length && body && box ?
      body.outline.filter(value => value[1] <= box.top + (box.bottom - box.top) * .15 &&
        value[0] > box.left + (box.right - box.left) * .2 && value[0] < box.right - (box.right - box.left) * .2)
        .sort((a, b) => a[0] - b[0]).map(value => point(body, value)) : [];
    add('neck-opening', 'Neck opening', 'width', 'Visible upper neckband or collar span across both sides; not neck circumference. Unavailable when the opening is concealed.', neckPoints, undefined, .7);
    const hoods = structural.filter(part => matches(part, /\bhood\b/));
    if (hoods.length || /hood/i.test(garment.manifest.garmentType)) add('hood-height', 'Hood height', 'length',
      'Visible hood height across crown and side panels at the nearest supported centre section.', centreSection(hoods));
  }
  if (family === 'skirt' || family === 'dress') {
    const panel = family === 'skirt' ? skirt : body, box = family === 'dress' ? bodyBox : panel && bounds(panel);
    const targets = family === 'dress' ? bodies : panel ? [panel] : [];
    const waistBox = waistband ? bounds(waistband) : box;
    width('waist', 'Waist width', waistband ? [waistband] : targets, waistBox ? waistBox.top + (waistBox.bottom - waistBox.top) * (waistband ? .1 : family === 'dress' ? .45 : .03) : 0,
      'Flat outline width at the waist; waist level estimated unless a separate waistband is present.', .7);
    width('hip', 'Hip width', targets, box ? box.top + (box.bottom - box.top) * (family === 'dress' ? .6 : .3) : 0,
      'Flat outline width at an estimated hip level.', .65);
    if (family === 'skirt') vertical('skirt-length', 'Skirt length', skirt);
  }
  if (family === 'top' || family === 'skirt' || family === 'dress') {
    const panel = family === 'skirt' ? skirt : body;
    if (family !== 'skirt' && finishedBodies.length > 1) {
      const bottom = Math.max(...finishedBodies.map(part => bounds(part).bottom));
      const height = bottom - Math.min(...finishedBodies.map(part => bounds(part).top));
      const lowerPanels = finishedBodies.filter(part => bounds(part).bottom >= bottom - height * .15);
      const completeBands = hemBands.filter(part => {
        const attached = bodies.find(body => body.id === part.attachmentTo);
        return attached && bounds(part).right - bounds(part).left >= (bounds(attached).right - bounds(attached).left) * .7;
      });
      const hemParts = completeBands.length ? completeBands : lowerPanels;
      const hems = hemParts.flatMap(part => {
        const hem = edge('hem-edge', part), path = hem ? hem.value.points : bottomEdge(part);
        return hem ? edgeEndpoints(hem) : path.map(value => point(part, value));
      }).sort((a, b) => a.point[0] - b.point[0]);
      add('hem-width', 'Hem width', 'width', 'Flat span between visible outer hem corners across the body panels.', hems, undefined, .75);
    } else {
      const hem = panel && edge('hem-edge', panel);
      const path = hem ? hem.value.points : panel ? bottomEdge(panel) : [];
      add('hem-width', 'Hem width', 'contour', 'Visible finished body hem, measured flat.', hem ? edgeEndpoints(hem) : panel && path.length ? [point(panel, path[0]), point(panel, path.at(-1)!)] : [], path);
    }
  }
  const placket = garment.parts.filter((part): part is OutlinedPart => part.view === view && usableOutline(part) && matches(part, /\bplacket\b/))
    .sort((a, b) => polygonArea(b) - polygonArea(a))[0];
  if (placket) {
    const box = bounds(placket);
    vertical('placket-length', 'Placket length', placket);
    width('placket-width', 'Placket width', [placket], (box.top + box.bottom) / 2,
      'Flat width through the visible closure placket outline at its mid-length; not the neckline width.');
  }
  const pocket = edge('pocket-edge');
  if (pocket || family === 'bifurcated' || /hood|jacket|coat/i.test(garment.manifest.garmentType))
    add('pocket-opening', 'Pocket opening', 'contour', 'Length of the visible finished pocket mouth; concealed portions excluded.', pocket ? edgeEndpoints(pocket) : [], pocket?.value.points);
  return definitions;
}

export function importedMeasurementGuides(garment: ImportedGarment, view: ImportedGarmentView = garment.manifest.view): ImportedMeasurementGuide[] {
  const definitions = deriveImportedMeasurementSchema(garment, view);
  const calibrationForView = (selectedView: ImportedGarmentView) => garment.measurementCalibrations?.[selectedView] ??
    ((garment.measurementCalibration?.view ?? garment.manifest.view) === selectedView ? garment.measurementCalibration : undefined);
  const directCalibration = calibrationForView(view);
  let calibration = directCalibration;
  let calibrationView = view;
  // A scoped value, even an invalid one, must not silently fall back to a different image's scale.
  if (!directCalibration) {
    for (const candidateView of ['front', 'back'] as const) {
      if (candidateView === view) continue;
      const candidate = calibrationForView(candidateView);
      if (candidate && (!candidate.view || candidate.view === candidateView) && garment.commonCalibrationDimensions?.some(dimension =>
        dimension.measurementId === candidate.measurementId && dimension.views.includes(view) && dimension.views.includes(candidateView) && dimension.evidence.trim())) {
        calibration = candidate;
        calibrationView = candidateView;
        break;
      }
    }
  }
  const sameView = view === calibrationView;
  const sourceReference = calibration && deriveImportedMeasurementSchema(garment, calibrationView).find(definition => definition.id === calibration.measurementId);
  const localReference = calibration && definitions.find(definition => definition.id === calibration.measurementId);
  // A common physical dimension calibrates the OTHER image against its own geometry, never by copying pixel scale.
  const reference = localReference ? pathLength(localReference.points) : 0;
  const scale = calibration && (!calibration.view || calibration.view === calibrationView) && sourceReference && pathLength(sourceReference.points) > 0 &&
    Number.isFinite(calibration.millimetres) && calibration.millimetres > 0 && reference > 0 && Number.isFinite(calibration.millimetres / reference) ? calibration.millimetres / reference : null;
  return definitions.map(definition => {
    const length = pathLength(definition.points);
    const millimetres = scale !== null && length > 0 ? length * scale : null;
    return { id: definition.id, name: definition.label, method: definition.method, points: definition.points, length, millimetres,
      view, confidence: definition.confidence,
      status: !length ? 'unavailable' : millimetres === null ? 'uncalibrated' : definition.id === calibration?.measurementId ? sameView ? 'supplied' : 'calibrated' : 'estimated' };
  });
}

/** Use with the existing 2048-square SVG canvas; domain geometry always remains normalized. */
export function importedMeasurementCanvasPoints(guide: Pick<ImportedMeasurementGuide, 'points'>, canvasSize = 2048): Point[] {
  if (!Number.isFinite(canvasSize) || canvasSize <= 0) throw new RangeError('Canvas size must be finite and positive.');
  return guide.points.map(([x, y]) => [x * canvasSize, y * canvasSize]);
}