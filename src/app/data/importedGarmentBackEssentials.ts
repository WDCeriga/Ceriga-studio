import clipping, { type MultiPolygon } from 'polygon-clipping';
import type { ImportedGarment, ImportedPart, ImportedPoint } from './importedGarment';

type Point = ImportedPoint;
type EssentialPart = ImportedPart & { estimatedFromPartId: string; inferenceLevel: 'essential' };
type Role = 'body' | 'sleeve' | 'cuff' | 'hem' | 'hood' | 'neckband' | 'collar' | 'leg' | 'waistband' | 'flap';
const evidence = 'ESTIMATED back: essential anatomical cuts inferred from front proportions, not observed rear construction.';
const emptySvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"/>';
const area = (p: Point[]) => Math.abs(p.reduce((sum, a, i) => { const b = p[(i + 1) % p.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0) / 2);
const bounds = (p: Point[]) => [Math.min(...p.map(v => v[0])), Math.min(...p.map(v => v[1])), Math.max(...p.map(v => v[0])), Math.max(...p.map(v => v[1]))];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rect = (l: number, t: number, r: number, b: number): MultiPolygon => [[[[l, t], [r, t], [r, b], [l, b], [l, t]]]];
const polygon = (p: Point[]): MultiPolygon => [[p]];
const clean = (p: Point[]) => p.filter((v, i) => (!i || v[0] !== p[i - 1][0] || v[1] !== p[i - 1][1]) && (i !== p.length - 1 || v[0] !== p[0][0] || v[1] !== p[0][1])).map(v => [...v] as Point);
const roleOf = (p: ImportedPart) => (p.semanticType === 'panel' ? p.structuralRole || p.measurementRole || 'panel' : p.semanticType).toLowerCase().replace(/[_-]/g, ' ');
const hasRole = (p: ImportedPart, role: string) => new RegExp(`\\b${role}\\b`).test(roleOf(p));
const isInk = (p: ImportedPart) => p.structuralRole === 'source-ink';
const isCuffTab = (p: ImportedPart) => {
  const label = `${p.name} ${p.structuralRole ?? ''}`.toLowerCase().replace(/[_-]/g, ' ');
  return ['flap', 'panel', 'cuff'].includes(p.semanticType) && /\b(cuff|wrist)\b/.test(label) && /\b(tab|strap)\b/.test(label) && !/\b(pocket|throat|zip)\b/.test(label);
};
function crossings(points: Point[], y: number): number[] {
  const xs: number[] = [];
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]));
  });
  return xs.sort((a, b) => a - b);
}
/** Unknown traces need clear short-sleeve wings above a continuous, narrower torso. */
function shortSleevedExterior(points: Point[]): boolean {
  const [l, t, r, b] = bounds(points), w = r - l, h = b - t, cx = (l + r) / 2;
  const widthAt = (fraction: number) => {
    const xs = crossings(points, t + h * fraction);
    return xs.length === 2 && Math.abs((xs[0] + xs[1]) / 2 - cx) < w * .1 ? xs[1] - xs[0] : 0;
  };
  const shoulder = widthAt(.1), wings = Math.max(...[.25, .35, .45].map(widthAt));
  const torso = [.65, .8, .9].map(widthAt), narrow = Math.min(...torso), wide = Math.max(...torso);
  return shoulder > w * .35 && wings > w * .8 && narrow > w * .35 && wide < w * .78 && wide - narrow < w * .15 && wings > wide * 1.3;
}

function interiorPoint(points: Point[]): Point {
  const bb = bounds(points), y = (bb[1] + bb[3]) / 2;
  const xs = crossings(points, y);
  let best = 0;
  for (let i = 2; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > xs[best + 1] - xs[best]) best = i;
  return [(xs[best] + xs[best + 1]) / 2, y];
}
const path = (p: Point[]) => `M${p.map(([x, y]) => `${+(x * 2048).toFixed(6)},${+(y * 2048).toFixed(6)}`).join('L')}Z`;
const svg = (p: Point[], stroke = false) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path d="${path(p)}" fill="${stroke ? 'none' : '#000000'}"${stroke ? ' stroke="#172033" stroke-width="2" stroke-linejoin="round"' : ''}/></svg>`;

function geometryFields(outline: Point[]) {
  const bb = bounds(outline);
  return { outline, bounds: bb, geometryBounds: [...bb], seed: interiorPoint(outline), area: area(outline),
    svg: svg(outline), constructionSvg: svg(outline, true),
    measurement: { unit: 'relative', width: bb[2] - bb[0], height: bb[3] - bb[1] } };
}

function checkedOutline(part: ImportedPart): Point[] {
  const p = part.outline;
  if (!p || p.length < 3 || p.length > 8192 || p.some(v => v.length !== 2 || v.some(n => !Number.isFinite(n) || n < 0 || n > 1))) {
    throw new Error(`Essential estimated back: ${part.id} needs a finite normalized exterior outline.`);
  }
  if (part.transform && (part.transform.x || part.transform.y || part.transform.rotation || part.transform.scale !== 1)) {
    throw new Error(`Essential estimated back: bake the front transform for ${part.id} before estimating.`);
  }
  const result = clean(p);
  if (area(result) < 1e-7) throw new Error(`Essential estimated back: ${part.id} has a degenerate outline.`);
  return result;
}

function single(geometry: MultiPolygon, label: string): Point[] {
  const sorted = geometry.filter(p => p.length && area(p[0]) > 1e-9).sort((a, b) => area(b[0]) - area(a[0]));
  if (!sorted.length || area(sorted[0][0]) < 1e-6) throw new Error(`Essential estimated back: cannot resolve ${label}.`);
  // A raster stair-step can leave tiny slivers at a cut; never discard a real garment component.
  const mainArea = area(sorted[0][0]);
  if (sorted.slice(1).reduce((sum, p) => sum + area(p[0]), 0) > Math.max(1e-5, mainArea * .01) || sorted[0].slice(1).some(ring => area(ring) > 1e-7)) {
    throw new Error(`Essential estimated back: ${label} is disconnected or contains an unresolved opening.`);
  }
  return clean(sorted[0][0]);
}

function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a: Point, b: Point, c: Point) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const chain = (points: Point[]) => {
    const hull: Point[] = [];
    for (const p of points) {
      while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop();
      hull.push(p);
    }
    return hull.slice(0, -1);
  };
  return [...chain(sorted), ...chain([...sorted].reverse())];
}

/** Assemble only gaps actually spanned by a central, body-attached front closure. */
function assembledBody(panels: ImportedPart[], front: ImportedPart[], outlines: Map<string, Point[]>): MultiPolygon {
  let merged = clipping.union(...panels.map(p => polygon(outlines.get(p.id)!)) as [MultiPolygon, ...MultiPolygon[]]);
  if (merged.length > 1) {
    const [l, t, r, b] = bounds(panels.flatMap(p => outlines.get(p.id)!)), w = r - l, h = b - t;
    const ids = new Set(panels.map(p => p.id));
    for (const part of front) {
      if (!/\b(zip|placket)\b/.test(roleOf(part)) || !ids.has(part.attachmentTo ?? '')) continue;
      let outline: Point[];
      try {
        outline = checkedOutline(part);
        const resolved = clipping.union(polygon(outline));
        if (resolved.length !== 1 || resolved[0].length !== 1 || Math.abs(area(resolved[0][0]) - area(outline)) > 1e-9) continue;
      } catch { continue; }
      const bb = bounds(outline);
      if (bb[2] - bb[0] > w * .15 || bb[3] - bb[1] < h * .5 || Math.abs(bb[0] + bb[2] - l - r) > w * .3) continue;
      const bridge = clipping.intersection(polygon(outline), rect(l, t, r, b));
      // Contact can be a shared edge, not necessarily an area intersection. A valid
      // bridge must reduce the component count without extending the body bounds.
      const candidate = clipping.union(merged, bridge);
      if (candidate.length < merged.length) merged = candidate;
    }
  }
  return polygon(single(merged, 'body panels (an observed contacting closure is required across gaps)'));
}

/** Find an anatomical terminal edge, not a horizontal slice of a slanted opening. */
function terminalHem(geometry: MultiPolygon, direction: Point, thickness: number): MultiPolygon {
  const outline = single(geometry, 'hem parent'), hull = convexHull(outline);
  const length = Math.hypot(...direction);
  if (length < 1e-8) throw new Error('Essential estimated back: cannot locate the terminal hem direction.');
  let score = -1, normal: Point = [0, 1], offset = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], dx = b[0] - a[0], dy = b[1] - a[1], edgeLength = Math.hypot(dx, dy);
    const n: Point = [dy / edgeLength, -dx / edgeLength];
    const alignment = Math.max(0, (n[0] * direction[0] + n[1] * direction[1]) / length);
    const candidate = edgeLength * alignment ** 4;
    if (candidate > score) { score = candidate; normal = n; offset = n[0] * a[0] + n[1] * a[1]; }
  }
  // The hull only selects a cut normal; the actual fill always stays inside the exterior.
  const threshold = offset - thickness, distance = (p: Point) => p[0] * normal[0] + p[1] * normal[1] - threshold;
  const square: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1]], mask: Point[] = [];
  square.forEach((a, i) => {
    const b = square[(i + 1) % square.length], da = distance(a), db = distance(b);
    if (da >= 0) mask.push(a);
    if ((da >= 0) !== (db >= 0)) mask.push([a[0] + (b[0] - a[0]) * da / (da - db), a[1] + (b[1] - a[1]) * da / (da - db)]);
  });
  const hem = clipping.intersection(geometry, polygon(mask));
  if (area(single(hem, 'terminal hem')) > area(outline) * .2) throw new Error('Essential estimated back: inferred hem is too broad.');
  return hem;
}

function curve(a: Point, b: Point, depth: number): Point[] {
  return Array.from({ length: 17 }, (_, i) => {
    const t = i / 16;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + 4 * depth * t * (1 - t)];
  });
}

/** Replace only the front neck arc; no front opening, binding or internal ink is reused. */
function shallowNeck(exterior: Point[], neck: number[], height: number): { exterior: Point[]; edge: Point[] } {
  const nearest = (x: number) => exterior.reduce((best, p, i) => Math.hypot(p[0] - x, p[1] - neck[1]) < Math.hypot(exterior[best][0] - x, exterior[best][1] - neck[1]) ? i : best, 0);
  const left = nearest(neck[0]), right = nearest(neck[2]);
  if (left === right) throw new Error('Essential estimated back: cannot locate the rear neck anchors.');
  const walk = (a: number, b: number) => {
    const points = [exterior[a]];
    for (let i = (a + 1) % exterior.length; i !== b; i = (i + 1) % exterior.length) points.push(exterior[i]);
    return [...points, exterior[b]];
  };
  const forward = walk(left, right), backward = walk(right, left);
  const forwardIsTop = Math.max(...forward.map(p => p[1])) < Math.max(...backward.map(p => p[1]));
  const upper = forwardIsTop ? forward : backward, lower = forwardIsTop ? backward : forward;
  if (Math.max(...upper.map(p => p[1])) > neck[3] + height * .1) throw new Error('Essential estimated back: ambiguous front neckline.');
  const edge = curve(upper[0], upper[upper.length - 1], height * .012);
  return { exterior: clean([...edge, ...lower.slice(1, -1)]), edge };
}

/**
 * Geometry only: the caller owns back-view provenance and live colour/fabric inheritance.
 * Source ink contributes its OUTER contour, never SVG ink or internal source cell edges.
 * Unsupported sleeveless/skirt/dress families deliberately defer to the existing estimator.
 */
export function essentialBackParts(value: ImportedGarment, cleanExterior?: (outline: Point[]) => Point[]): ImportedPart[] | undefined {
  let family = value.manifest.garmentType.toLowerCase().replace(/[_-]/g, ' ');
  const front = value.parts.filter(p => p.view === 'front');
  if (/^(unknown|auto)$/.test(family)) {
    if (front.some(p => hasRole(p, 'hood'))) family = 'hoodie';
    else if (front.some(p => hasRole(p, 'body')) && front.filter(p => hasRole(p, 'sleeve')).length >= 2) {
      const body = front.find(p => hasRole(p, 'body'))!, sleeve = front.find(p => hasRole(p, 'sleeve'))!;
      const bb = bounds(checkedOutline(body)), sb = bounds(checkedOutline(sleeve));
      family = sb[3] - sb[1] > (bb[3] - bb[1]) * .65 ? 'sweatshirt' : 'tee';
    } else {
      const source = front.find(isInk);
      if (source && shortSleevedExterior(checkedOutline(source))) family = 'tee';
    }
  }
  const description = `${family} ${value.manifest.subtype}`.toLowerCase();
  if (/\b(skirt|dress|tank|sleeveless|vest|camisole)\b/.test(description)) return undefined;
  const lower = /\b(trousers?|pants|jeans|shorts)\b/.test(family);
  if (!lower && !/\b(tee|t shirt|tshirt|sweatshirt|hoodie|jacket)\b/.test(family)) return undefined;
  const semantic = front.filter(p => !isInk(p) && !isCuffTab(p) && /\b(body|sleeve|cuff|hem|hood|neckband|collar|leg|waistband|yoke)\b/.test(roleOf(p)) && !['lining', 'pocket', 'flap', 'zip', 'decoration', 'label'].includes(p.semanticType));
  const inkParts = front.filter(isInk);
  if (inkParts.length > 1) throw new Error('Essential estimated back: multiple source-ink exteriors are ambiguous; exactly one authoritative front exterior is required.');
  const ink = inkParts[0];
  if (!front.length || (!ink && !semantic.length)) throw new Error('Essential estimated back: front geometry is missing.');
  if (!lower && !ink && !semantic.some(p => hasRole(p, 'sleeve'))) return undefined;
  const outlines = new Map(semantic.map(p => [p.id, checkedOutline(p)]));
  const separateWaist = !ink && lower ? semantic.filter(p => hasRole(p, 'waistband')) : [];
  let exterior: Point[];
  if (ink) exterior = checkedOutline(ink);
  else {
    const bodyPanels = lower ? [] : semantic.filter(p => hasRole(p, 'body'));
    const hoodPanels = semantic.filter(p => hasRole(p, 'hood'));
    const assembled = new Set([...bodyPanels, ...hoodPanels, ...separateWaist]);
    const shapes = semantic.filter(p => !assembled.has(p)).map(p => polygon(outlines.get(p.id)!));
    // Validate torso connectivity independently: a hood or trim must not hide an
    // unsupported gap between front body panels. Only hood openings are filled.
    if (bodyPanels.length) shapes.push(assembledBody(bodyPanels, front, outlines));
    if (hoodPanels.length) shapes.push(polygon(convexHull(hoodPanels.flatMap(p => outlines.get(p.id)!))));
    exterior = single(clipping.union(...shapes as [MultiPolygon, ...MultiPolygon[]]), 'front exterior');
  }
  // Reject self-intersecting/multiple-ring exteriors instead of emitting invalid fill geometry.
  exterior = single(clipping.union(polygon(exterior)), 'front exterior');
  if (cleanExterior) exterior = single(clipping.union(polygon(cleanExterior(exterior))), 'clean back exterior');
  const [l, t, r, b] = bounds(exterior), w = r - l, h = b - t, cx = (l + r) / 2;
  const sources = (role: string) => semantic.filter(p => hasRole(p, role));
  const combined = (parts: ImportedPart[]) => parts.length ? bounds(parts.flatMap(p => outlines.get(p.id)!)) : undefined;
  const match = (roles: string[], x = cx): ImportedPart => {
    for (const role of roles) {
      const candidates = sources(role);
      if (candidates.length) return candidates.reduce((best, p) => {
        const distance = (q: ImportedPart) => { const bb = bounds(outlines.get(q.id)!); return Math.abs((bb[0] + bb[2]) / 2 - x); };
        return distance(p) < distance(best) ? p : best;
      });
    }
    return ink ?? semantic[0];
  };
  const hemSource = (owner: ImportedPart, geometry: MultiPolygon) => {
    const candidates = sources('hem').map(part => ({ part, overlap: clipping.intersection(geometry, polygon(outlines.get(part.id)!)).reduce((sum, p) => sum + area(p[0]), 0) }));
    candidates.sort((a, b) => b.overlap - a.overlap);
    return candidates[0]?.overlap > 1e-7 ? candidates[0].part : owner;
  };
  const result: EssentialPart[] = [];
  const add = (name: string, role: Role, geometry: MultiPolygon, parent: ImportedPart) => {
    const outline = single(geometry, name), id = `estimated-back-${name}`;
    const category = ['hood', 'neckband', 'collar'].includes(role) ? 'neck-hood' : role === 'sleeve' ? 'sleeves' : ['hem', 'cuff', 'waistband', 'flap'].includes(role) ? 'hem-cuffs' : 'fabric-colour';
    // Legs use the existing panel + leg structural role contract (no leg region enum).
    result.push({ id, name: `Estimated back ${name.replace(/-/g, ' ')}`, userFacingName: `Estimated back ${name.replace(/-/g, ' ')}`,
      semanticType: role === 'leg' ? 'panel' : role, structuralRole: role, measurementRole: `${role}-outline`,
      estimatedFromPartId: parent.id, inferenceLevel: 'essential', view: 'back', material: parent.material, color: parent.color,
      parentGarment: parent.parentGarment, evidence, boundary: { boundaryType: 'panel-edge', confidence: .35, evidence },
      colorable: true, structural: true, layerKind: 'structural', builderCategory: category,
      editableIndependently: true, attachmentTo: null, symmetryPartner: null, colourGroup: id, fabricGroup: id,
      ...geometryFields(outline), stitchSvg: emptySvg, layerOrder: result.length,
      transform: { x: 0, y: 0, scale: 1, rotation: 0 } });
  };
  let envelope = polygon(exterior);
  if (lower) {
    const band = combined(sources('waistband'));
    const waistY = clamp(band?.[3] ?? t + h * .09, t + h * .025, t + h * .22);
    // Separately represented legacy waistbands can be detached from leg panels.
    // Keep that independent outline; never fill the unobserved space between them.
    const waist = separateWaist.length === 1 ? polygon(outlines.get(separateWaist[0].id)!) : separateWaist.length
      ? clipping.union(...separateWaist.map(p => polygon(outlines.get(p.id)!)) as [MultiPolygon, ...MultiPolygon[]])
      : clipping.intersection(envelope, rect(0, 0, 1, waistY));
    add('waistband', 'waistband', waist, match(['waistband', 'leg', 'body']));
    envelope = clipping.difference(envelope, waist);
    const legStart = separateWaist.length ? 0 : waistY;
    for (const [side, x, mask] of [['left', l, rect(0, legStart, cx, 1)], ['right', r, rect(cx, legStart, 1, 1)]] as const) {
      const leg = clipping.intersection(envelope, mask), owner = match(['leg', 'body'], x);
      const hem = terminalHem(leg, [0, 1], h * .015);
      add(`${side}-leg-hem`, 'hem', hem, hemSource(owner, hem));
      add(`${side}-leg`, 'leg', clipping.difference(leg, hem), owner);
    }
    // The shared vertical cut is the estimated rear rise, not a copied front fly/zip.
    const leftLeg = result.find(p => p.id === 'estimated-back-left-leg')!;
    const centre = leftLeg.outline!.filter(([x]) => Math.abs(x - cx) < 1e-8).map(([, y]) => y);
    if (centre.length >= 2) {
      const top = Math.min(...centre), bottom = Math.max(...centre);
      const seam = `<path data-estimated-seam="centre-rise" d="M${cx * 2048},${top * 2048}L${cx * 2048},${bottom * 2048}" fill="none" stroke="#172033" stroke-width="2"/>`;
      leftLeg.constructionSvg = leftLeg.constructionSvg.replace('</svg>', `${seam}</svg>`);
    }
  } else {
    const hoodBounds = combined(sources('hood'));
    const hooded = !!hoodBounds || /\b(hoodie|hooded)\b/.test(description);
    // Without fill cells, measure the lower tee torso from its actual exterior.
    // Fixed-width guesses can strand lower side strips as disconnected sleeves.
    const bodyBounds = combined(sources('body')) ?? (!hooded && /\b(tee|t shirt|tshirt)\b/.test(family)
      ? bounds(single(clipping.intersection(envelope, rect(0, t + h * .65, 1, 1)), 'lower tee torso')) : undefined);
    const torsoHems = sources('hem').filter(p => !/\b(sleeve|leg)\b/.test(p.structuralRole ?? '') && !semantic.some(owner => owner.id === p.attachmentTo && /\b(sleeve|leg)\b/.test(roleOf(owner))));
    const hemBounds = combined([...torsoHems, ...sources('waistband')]);
    const neckBounds = combined([...sources('neckband'), ...sources('collar')]);
    const neck = hoodBounds ?? neckBounds ?? [cx - w * .14, t, cx + w * .14, t + h * (hooded ? .26 : .10)];
    let neckEdge: Point[] | undefined;
    if (!hooded) {
      const rear = shallowNeck(exterior, neck, h);
      exterior = rear.exterior; neckEdge = rear.edge; envelope = polygon(exterior);
    }
    const neckY = hooded ? clamp(neck[3], t + h * .1, t + h * .38) : Math.max(...neckEdge!.map(p => p[1]));
    const long = hooded || /\b(sweatshirt|jacket)\b/.test(family);
    const torsoBottom = clamp(hemBounds?.[3] ?? bodyBounds?.[3] ?? (long ? t + h * .87 : b), neckY + h * .35, b);
    const waistLeft = clamp(hemBounds?.[0] ?? bodyBounds?.[0] ?? cx - w * .27, l + w * .15, cx - w * .15);
    const waistRight = clamp(hemBounds?.[2] ?? bodyBounds?.[2] ?? cx + w * .27, cx + w * .15, r - w * .15);
    const underY = clamp(neckY + (torsoBottom - neckY) * .38, neckY + h * .12, torsoBottom - h * .12);
    const bodyLeft = clamp(bodyBounds?.[0] ?? cx - w * .29, l + w * .16, cx - w * .18);
    const bodyRight = clamp(bodyBounds?.[2] ?? cx + w * .29, cx + w * .18, r - w * .16);
    const shoulderLeft = cx - (cx - bodyLeft) * .8, shoulderRight = cx + (bodyRight - cx) * .8;
    // Shoulder caps come from the whole exterior, including front yoke shoulder volume.
    // Below the armholes these cuts bridge inset/disconnected source cells, not their gaps.
    const sideCut = (side: 'left' | 'right', shoulder: number, bodyEdge: number, waistEdge: number): Point[] => {
      const cut: Point[] = [[shoulder, 0], [shoulder, neckY]];
      const midY = (neckY + underY) / 2, midX = bodyEdge + (shoulder - bodyEdge) * .3;
      const detailed = (!ink && long) || (!long && !sources('body').length);
      const levels = !detailed ? Array.from({ length: 32 }, (_, i) => underY + (torsoBottom - underY) * (i + 1) / 32)
        : [...new Set([midY, underY, torsoBottom, ...exterior.map(p => p[1]).filter(y => y > neckY && y < torsoBottom), ...Array.from({ length: 32 }, (_, i) => neckY + (torsoBottom - neckY) * (i + 1) / 32)])].sort((a, b) => a - b);
      if (!detailed) cut.push([midX, midY], [bodyEdge, underY]);
      let gapX: number | undefined;
      for (const y of levels) {
        const xs = crossings(exterior, y);
        const centre = xs.findIndex((x, index) => index % 2 === 0 && x <= cx && xs[index + 1] >= cx);
        // Once the silhouette exposes an arm/body gap, keep the cut inside it.
        // Sparse/inset hem cells must not route the outer torso into a sleeve.
        if (centre >= 0 && xs[centre + 1] - xs[centre] > w * .25) {
          if (side === 'left' && centre >= 2) gapX = (xs[centre - 1] + xs[centre]) / 2;
          if (side === 'right' && centre + 2 < xs.length) gapX = (xs[centre + 1] + xs[centre + 2]) / 2;
          if (detailed && gapX !== undefined) gapX = side === 'left' ? Math.min(gapX, xs[centre]) : Math.max(gapX, xs[centre + 1]);
        }
        const anatomicalX = y <= midY ? shoulder + (midX - shoulder) * (y - neckY) / (midY - neckY)
          : y <= underY ? midX + (bodyEdge - midX) * (y - midY) / (underY - midY)
          : bodyEdge + (waistEdge - bodyEdge) * (y - underY) / (torsoBottom - underY);
        cut.push([gapX ?? anatomicalX, y]);
      }
      cut.push([cut[cut.length - 1][0], 1]);
      return cut;
    };
    const leftCut = sideCut('left', shoulderLeft, bodyLeft, waistLeft);
    const rightCut = sideCut('right', shoulderRight, bodyRight, waistRight);
    let torso = clipping.intersection(envelope, polygon([...leftCut, ...[...rightCut].reverse()]));
    const arms = clipping.difference(envelope, torso);
    if (hooded) {
      // Closed rear hood exterior; no lining, face opening, drawstrings or centre zip.
      const hoodEdge = curve([neck[0], neckY - h * .012], [neck[2], neckY - h * .012], h * .012);
      const hoodMask = polygon([[neck[0], 0], [neck[2], 0], ...[...hoodEdge].reverse()]);
      const hood = clipping.intersection(torso, hoodMask);
      add('hood', 'hood', hood, match(['hood', 'body']));
      torso = clipping.difference(torso, hood);
    } else if (neckEdge && (neckBounds || /\b(tee|t shirt|tshirt|sweatshirt)\b/.test(family))) {
      const thickness = clamp((neck[3] - neck[1]) * .18, h * .007, h * .018);
      const strip = polygon([...neckEdge, ...[...neckEdge].reverse().map(([x, y]): Point => [x, y + thickness])]);
      const band = clipping.intersection(torso, strip);
      const neckRole = sources('neckband').length || !sources('collar').length ? 'neckband' : 'collar';
      add(neckRole, neckRole, band, match([neckRole, 'body']));
      torso = clipping.difference(torso, band);
    }
    if (hemBounds || long) {
      const hemY = clamp(hemBounds?.[1] ?? torsoBottom - h * .04, underY + h * .12, torsoBottom - h * .012);
      const hem = clipping.intersection(torso, rect(0, hemY, 1, 1));
      add('waistband', 'hem', hem, hemSource(match(['waistband', 'body']), hem));
      torso = clipping.difference(torso, hem);
    } else {
      const hem = terminalHem(torso, [0, 1], h * .015);
      add('bottom-hem', 'hem', hem, hemSource(match(['body', 'yoke']), hem));
      torso = clipping.difference(torso, hem);
    }
    add('body', 'body', torso, match(['body', 'yoke']));
    for (const [side, x, mask] of [['left', l, rect(0, 0, cx, 1)], ['right', r, rect(cx, 0, 1, 1)]] as const) {
      let arm = clipping.intersection(arms, mask);
      const cuffCandidates = sources('cuff').filter(p => { const bb = bounds(outlines.get(p.id)!); return side === 'left' ? (bb[0] + bb[2]) / 2 < cx : (bb[0] + bb[2]) / 2 > cx; });
      if (cuffCandidates.length || long) {
        const armBox = bounds(single(arm, `${side} sleeve`));
        const cuffY = clamp(combined(cuffCandidates)?.[1] ?? armBox[3] - h * .04, armBox[1] + (armBox[3] - armBox[1]) * .72, armBox[3] - h * .008);
        const cuff = clipping.intersection(arm, rect(0, cuffY, 1, 1));
        add(`${side}-cuff`, 'cuff', cuff, cuffCandidates.length ? match(['cuff'], x) : hemSource(match(['sleeve', 'body'], x), cuff));
        arm = clipping.difference(arm, cuff);
      } else {
        const owner = match(['sleeve', 'yoke', 'body'], x), armBox = bounds(single(arm, `${side} sleeve`));
        const joinX = side === 'left' ? (shoulderLeft + bodyLeft) / 2 : (shoulderRight + bodyRight) / 2;
        const direction: Point = [(armBox[0] + armBox[2]) / 2 - joinX, (armBox[1] + armBox[3]) / 2 - (neckY + underY) / 2];
        const hem = terminalHem(arm, direction, h * .012);
        add(`${side}-sleeve-hem`, 'hem', hem, hemSource(owner, hem));
        arm = clipping.difference(arm, hem);
      }
      add(`${side}-sleeve`, 'sleeve', arm, match(['sleeve', 'yoke', 'body'], x));
    }
    // Cuff adjustment tabs are fabric at the sleeve end, not front-only pocket/closure flaps.
    // Restore their observed contour after smoothing, and partition the underlying masks.
    const tabCounts = { left: 0, right: 0 };
    for (const source of front.filter(isCuffTab)) {
      const outline = checkedOutline(source), tab = polygon(single(clipping.union(polygon(outline)), source.name)), tb = bounds(outline);
      const side = (tb[0] + tb[2]) / 2 < cx ? 'left' : 'right';
      const cuff = result.find(p => p.id === `estimated-back-${side}-cuff`);
      const sleeve = result.find(p => p.id === `estimated-back-${side}-sleeve`);
      if (!cuff || !sleeve) throw new Error(`Essential estimated back: ${source.name} has no cuff attachment.`);
      const cb = bounds(cuff.outline!), cw = cb[2] - cb[0], ch = cb[3] - cb[1];
      if (tb[2] - tb[0] > cw * 2.5 || tb[3] - tb[1] > ch * 2.5 || tb[2] < cb[0] - cw * .25 || tb[0] > cb[2] + cw * .25 || tb[3] < cb[1] - ch * .25 || tb[1] > cb[3] + ch * .25) {
        throw new Error(`Essential estimated back: ${source.name} is not supported at the cuff.`);
      }
      const arm = clipping.union(polygon(cuff.outline!), polygon(sleeve.outline!));
      if (clipping.union(arm, tab).length !== 1 || !clipping.intersection(arm, tab).length) throw new Error(`Essential estimated back: ${source.name} is detached from the sleeve.`);
      for (const part of [cuff, sleeve]) {
        Object.assign(part, geometryFields(single(clipping.difference(polygon(part.outline!), tab), part.name)));
      }
      const count = ++tabCounts[side];
      add(`${side}-cuff-tab${count === 1 ? '' : `-${count}`}`, 'flap', tab, source);
      const added = result[result.length - 1];
      added.structuralRole = 'cuff-tab';
      added.measurementRole = 'cuff-tab-outline';
      added.attachmentTo = cuff.id;
      added.evidence = 'ESTIMATED back: source-confirmed fabric cuff adjustment tab; rear fastening orientation is unobserved.';
      added.boundary = { ...added.boundary!, evidence: added.evidence };
    }
  }
  for (const part of result) {
    const partner = part.id.includes('-left-') ? part.id.replace('-left-', '-right-') : part.id.includes('-right-') ? part.id.replace('-right-', '-left-') : undefined;
    part.symmetryPartner = result.some(p => p.id === partner) ? partner! : null;
    if (part.structuralRole !== 'cuff-tab') part.attachmentTo = /-(sleeve|leg)-hem$/.test(part.id) ? part.id.replace(/-hem$/, '') : part.structuralRole === 'cuff' ? part.id.replace('-cuff', '-sleeve') : !lower && part.structuralRole !== 'body' ? 'estimated-back-body' : null;
  }
  return result;
}
