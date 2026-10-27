import {stablePolygonUnion,stablePolygonDifference} from '../../lib/stablePolygonUnion';
import polygonClipping, {type MultiPolygon, type Pair} from 'polygon-clipping';
import svgpath from 'svgpath';
import type { BoundaryLoop, PanellingPoint, PanellingSeam, SeamAnchor } from './panellingTypes';

export const PANELLING_VIEWBOX = 2048;

export const distance = (a: PanellingPoint, b: PanellingPoint) => Math.hypot(a.x - b.x, a.y - b.y);
export const signedArea = (points: PanellingPoint[]) => points.reduce((area, point, index) => {
  const next = points[(index + 1) % points.length];
  return area + point.x * next.y - next.x * point.y;
}, 0) / 2;

export function pointInLoop(point: PanellingPoint, loop: PanellingPoint[]) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i], b = loop[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function pointInSurface(point: PanellingPoint, boundaries: BoundaryLoop[]) {
  const surfaces = new Map<string, BoundaryLoop[]>();
  for (const boundary of boundaries) {
    const id = boundary.surfaceId ?? 'surface';
    surfaces.set(id, [...(surfaces.get(id) ?? []), boundary]);
  }
  return [...surfaces.values()].some(loops => loops.reduce((inside, boundary) => pointInLoop(point, boundary.points) ? !inside : inside, false));
}

export function projectToSegment(point: PanellingPoint, a: PanellingPoint, b: PanellingPoint) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
  return { point: { x: a.x + t * dx, y: a.y + t * dy }, t };
}

export function closestBoundaryPoint(point: PanellingPoint, boundaries: BoundaryLoop[]) {
  let nearest: { point: PanellingPoint; distance: number; boundaryId: string } | undefined;
  for (const boundary of boundaries) for (let i = 0; i < boundary.points.length; i++) {
    const projected = projectToSegment(point, boundary.points[i], boundary.points[(i + 1) % boundary.points.length]).point;
    const candidateDistance = distance(point, projected);
    if (!nearest || candidateDistance < nearest.distance) nearest = { point: projected, distance: candidateDistance, boundaryId: boundary.id };
  }
  return nearest;
}

export function mirrorPoint(point: PanellingPoint, axis: number): PanellingPoint {
  return { x: 2 * axis - point.x, y: point.y };
}

export function mirrorSeam(seam: PanellingSeam, axis: number): PanellingSeam {
  return {
    ...seam,
    id: `${seam.id}:mirror`,
    label: `${seam.label} mirror`,
    mirrorGroupId: seam.mirrorGroupId ?? seam.id,
    anchors: seam.anchors.map(anchor => ({
      ...anchor,
      id: `${anchor.id}:mirror`,
      ...mirrorPoint(anchor, axis),
      incoming: anchor.incoming ? mirrorPoint(anchor.incoming, axis) : undefined,
      outgoing: anchor.outgoing ? mirrorPoint(anchor.outgoing, axis) : undefined,
      boundaryId: undefined,
    })),
  };
}

function cubicPoint(a: PanellingPoint, b: PanellingPoint, c: PanellingPoint, d: PanellingPoint, t: number): PanellingPoint {
  const inverse = 1 - t;
  return {
    x: inverse ** 3 * a.x + 3 * inverse ** 2 * t * b.x + 3 * inverse * t ** 2 * c.x + t ** 3 * d.x,
    y: inverse ** 3 * a.y + 3 * inverse ** 2 * t * b.y + 3 * inverse * t ** 2 * c.y + t ** 3 * d.y,
  };
}

export function flattenSeam(seam: PanellingSeam, curveSteps = 48) {
  const result: PanellingPoint[] = [];
  for (let index = 0; index < seam.anchors.length - 1; index++) {
    const start = seam.anchors[index], end = seam.anchors[index + 1];
    if (!index) result.push({ x: start.x, y: start.y });
    if (start.outgoing || end.incoming) {
      const control1 = start.outgoing ?? start, control2 = end.incoming ?? end;
      for (let step = 1; step <= curveSteps; step++) result.push(cubicPoint(start, control1, control2, end, step / curveSteps));
    } else result.push({ x: end.x, y: end.y });
  }
  return result;
}

export function seamPath(anchors: SeamAnchor[], close = false) {
  if (!anchors.length) return '';
  let path = `M ${anchors[0].x} ${anchors[0].y}`;
  for (let i = 1; i < anchors.length; i++) {
    const previous = anchors[i - 1], next = anchors[i];
    if (previous.outgoing || next.incoming) {
      const first = previous.outgoing ?? previous, second = next.incoming ?? next;
      path += ` C ${first.x} ${first.y} ${second.x} ${second.y} ${next.x} ${next.y}`;
    } else path += ` L ${next.x} ${next.y}`;
  }
  return close ? `${path} Z` : path;
}

export function flattenAbsolutePath(d: string, step: number): PanellingPoint[] | null {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!tokens) return [];
  const points: PanellingPoint[] = [];
  let index = 0, current: PanellingPoint = { x: 0, y: 0 }, start = current, command = '';
  const read = () => Number(tokens[index++]);
  const line = (to: PanellingPoint) => {
    const count = Math.max(1, Math.ceil(distance(current, to) / step));
    for (let i = 1; i <= count; i++) points.push({ x: current.x + (to.x - current.x) * i / count, y: current.y + (to.y - current.y) * i / count });
    current = to;
  };
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    else if (!command) return null;
    if (command === 'M' || command === 'L') {
      const to = { x: read(), y: read() };
      if (command === 'M') { current = start = to; points.push(to); command = 'L'; } else line(to);
    } else if (command === 'C') {
      const c1 = { x: read(), y: read() }, c2 = { x: read(), y: read() }, to = { x: read(), y: read() };
      const count = Math.max(1, Math.ceil((distance(current, c1) + distance(c1, c2) + distance(c2, to)) / step));
      for (let i = 1; i <= count; i++) {
        const t = i / count, u = 1 - t;
        points.push({
          x: u * u * u * current.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
          y: u * u * u * current.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y,
        });
      }
      current = to;
    } else if (command === 'Z' || command === 'z') {
      line(start);
    } else return null;
  }
  return points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)) ? points : null;
}

/** Keep SVG subpaths separate. Only an explicit Z supplies a closing boundary. */
export function flattenPathContours(d: string, step = 2): PanellingPoint[][] {
  const contours: PanellingPoint[][] = [];
  let points: PanellingPoint[] = [], current = { x: 0, y: 0 };
  const line = (end: PanellingPoint) => {
    const count = Math.max(1, Math.ceil(distance(current, end) / step));
    const start = current;
    for (let i = 1; i <= count; i++) points.push({ x: start.x + (end.x - start.x) * i / count, y: start.y + (end.y - start.y) * i / count });
    current = end;
  };
  svgpath(d).abs().unshort().unarc().iterate(segment => {
    const v = segment.slice(1) as number[];
    switch (segment[0]) {
      case 'M': points = [{ x: v[0], y: v[1] }]; current = points[0]; break;
      case 'L': line({ x: v[0], y: v[1] }); break;
      case 'H': line({ x: v[0], y: current.y }); break;
      case 'V': line({ x: current.x, y: v[0] }); break;
      case 'Q': {
        const start = current, control = { x: v[0], y: v[1] }, end = { x: v[2], y: v[3] };
        const count = Math.max(2, Math.ceil((distance(start, control) + distance(control, end)) / step));
        for (let i = 1; i <= count; i++) { const t = i / count, u = 1 - t;
          points.push({ x: u*u*start.x + 2*u*t*control.x + t*t*end.x, y: u*u*start.y + 2*u*t*control.y + t*t*end.y }); }
        current = end; break;
      }
      case 'C': {
        const start = current, c1 = { x: v[0], y: v[1] }, c2 = { x: v[2], y: v[3] }, end = { x: v[4], y: v[5] };
        const count = Math.max(2, Math.ceil((distance(start, c1) + distance(c1, c2) + distance(c2, end)) / step));
        for (let i = 1; i <= count; i++) points.push(cubicPoint(start, c1, c2, end, i / count));
        current = end; break;
      }
      case 'Z': case 'z':
        if (points.length >= 3) { line(points[0]); contours.push(points); }
        points = []; break;
    }
    return undefined;
  });
  return contours;
}

export function sampleSvgBoundaries(svg: SVGSVGElement, parentSurfaceId?: string, pathStep = 8): BoundaryLoop[] {
  const contours: PanellingPoint[][] = [];
  const surface = parentSurfaceId ? svg.querySelector<SVGGElement>(`[data-panelling-parent="${parentSurfaceId}"]`) : svg;
  if (!surface) return [];
  const rootMatrix = svg.getScreenCTM();
  const rootInverse = rootMatrix?.inverse();
  const fabric = surface.getAttribute('data-fabric-only') === 'true'
    ? [...surface.querySelectorAll<SVGGElement>('g[transform]')].find(group=>!group.closest('defs')) : undefined;
  surface.querySelectorAll('path').forEach(path => {
    if (path.closest('defs,clipPath,mask') || path.getAttribute('fill') === 'none') return;
    if (fabric && !fabric.contains(path) && !path.closest('[data-shared-fabric="true"]')) return;
    const ctm = path.getScreenCTM();
    const matrix = ctm ? (rootInverse ? rootInverse.multiply(ctm) : ctm) : null;
    const scale = matrix ? Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d)) : 1;
    for (const contour of flattenPathContours(path.getAttribute('d') ?? '', pathStep / (scale || 1))) {
      const placed = contour.map(point => {
        if (!matrix) return point;
        const transformed = new DOMPoint(point.x, point.y).matrixTransform(matrix);
        return { x: transformed.x, y: transformed.y };
      }).filter((point, index, all) => !index || distance(point, all[index - 1]) > 1e-5);
      if (distance(placed[0], placed.at(-1)!) < 1e-5) placed.pop();
      if (placed.length >= 3 && Math.abs(signedArea(placed)) > 1) contours.push(placed);
    }
  });
  let loops: BoundaryLoop[] = contourBoundaries(contours,parentSurfaceId ?? 'garment');
  // The visible source fabric can be trimmed by existing SVG masks (e.g. long sleeves).
  // Apply those exact vector masks to topology as well as to the live rendering.
  if (fabric && rootInverse) {
    let ancestor: Element | null = fabric;
    const applied = new Set<string>();
    while (ancestor && ancestor !== surface) {
      const ref = ancestor.getAttribute('mask')?.match(/url\(#([^)]*)\)/)?.[1];
      const mask = ref ? [...surface.querySelectorAll('mask')].find(mask=>mask.id===ref) : undefined;
      if (mask && !applied.has(ref!)) {
        applied.add(ref!);
        const alpha = (mask.getAttribute('style') ?? '').includes('mask-type:alpha');
        const positive: MultiPolygon[] = [], negative: MultiPolygon[] = [];
        for (const shape of mask.querySelectorAll<SVGGraphicsElement>('path,rect,polygon')) {
          const matrix=shape.getScreenCTM(); if (!matrix) continue;
          const placed=rootInverse.multiply(matrix);
          let raw: PanellingPoint[][]=[];
          if(shape.tagName.toLowerCase()==='path') raw=flattenPathContours(shape.getAttribute('d')??'',8/Math.max(1e-6,Math.hypot(placed.a,placed.b)));
          else if(shape.tagName.toLowerCase()==='rect') { const x=Number(shape.getAttribute('x')??0),y=Number(shape.getAttribute('y')??0),w=Number(shape.getAttribute('width')),h=Number(shape.getAttribute('height')); raw=[[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]]; }
          else { const values=(shape.getAttribute('points')??'').trim().split(/[\s,]+/).map(Number);raw=[Array.from({length:values.length/2},(_,i)=>({x:values[i*2],y:values[i*2+1]}))]; }
          const contours=raw.map(ring=>ring.map(point=>{const p=new DOMPoint(point.x,point.y).matrixTransform(placed);return {x:p.x,y:p.y}}));
          const geometry=boundaryGeometry(contourBoundaries(contours,'mask'));
          if(!geometry.length) continue;
          const fill=shape.getAttribute('fill')??shape.closest('[fill]')?.getAttribute('fill')??'black';
          if(!alpha && /^(black|#000(?:000)?)$/i.test(fill)) negative.push(geometry); else if(fill!=='none') positive.push(geometry);
        }
        if (positive.length) {
          let keep=stablePolygonUnion(positive[0],...positive.slice(1));
          if(negative.length) keep=stablePolygonDifference(keep,...negative);
          loops=geometryBoundaries(polygonClipping.intersection(boundaryGeometry(loops),keep),parentSurfaceId??'garment');
        }
      }
      ancestor=ancestor.parentElement;
    }
  }
  const side = surface.getAttribute('data-panelling-side');
  if (side && rootInverse) {
    const surfaceMatrix = (surface as SVGGraphicsElement).getScreenCTM();
    if (surfaceMatrix) {
      const matrix = rootInverse.multiply(surfaceMatrix);
      const left = side === 'left' ? 0 : 1024, right = side === 'left' ? 1024 : 2048;
      const clip: Pair[] = [[left,0],[right,0],[right,2048],[left,2048],[left,0]].map(([x,y])=>{
        const p=new DOMPoint(x,y).matrixTransform(matrix);return [p.x,p.y];
      });
      loops = geometryBoundaries(polygonClipping.intersection(boundaryGeometry(loops), [[clip]]), parentSurfaceId ?? 'garment');
    }
  }
  return loops;
}

export function inferSymmetryAxis(boundaries: BoundaryLoop[]) {
  const outer = boundaries.filter(boundary => boundary.role === 'outer').sort((a, b) => Math.abs(signedArea(b.points)) - Math.abs(signedArea(a.points)))[0];
  if (!outer) return PANELLING_VIEWBOX / 2;
  const xs = outer.points.map(point => point.x);
  return (Math.min(...xs) + Math.max(...xs)) / 2;
}

export function bezierSplit(start: SeamAnchor, end: SeamAnchor, t: number) {
  const p0 = { x: start.x, y: start.y }, p1 = start.outgoing ?? p0, p3 = { x: end.x, y: end.y }, p2 = end.incoming ?? p3;
  const lerp = (a: PanellingPoint, b: PanellingPoint): PanellingPoint => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const p01 = lerp(p0, p1), p12 = lerp(p1, p2), p23 = lerp(p2, p3), p012 = lerp(p01, p12), p123 = lerp(p12, p23), split = lerp(p012, p123);
  return {
    start: { ...start, outgoing: p01 },
    inserted: { id: crypto.randomUUID(), ...split, incoming: p012, outgoing: p123 },
    end: { ...end, incoming: p23 },
  };
}
/** The SVG body fill may underpaint sleeves. Later construction pieces own their material. */
export function sampleGarmentSurfaces(svg: SVGSVGElement): BoundaryLoop[] {
  const surfaces = [...svg.querySelectorAll<SVGGElement>('[data-panelling-parent]')]
    .filter(group => group.dataset.technicalInk !== 'true' && !['outline', 'stitching', 'innerBackNeck'].includes(group.dataset.panellingParent!))
    .map(group => ({ id: group.dataset.panellingParent!, boundaries: sampleSvgBoundaries(svg, group.dataset.panellingParent!) }));
  let covered: MultiPolygon = [];
  const result: BoundaryLoop[] = [];
  for (const {id, boundaries} of surfaces.reverse()) {
    const close = (loop: BoundaryLoop): Pair[] => [...loop.points, loop.points[0]].map(p=>[p.x,p.y]);
    const geometry: MultiPolygon = boundaries.filter(b=>b.role==='outer').map(outer=>[close(outer),...boundaries.filter(hole=>hole.role==='hole' && pointInLoop(hole.points[0],outer.points)).map(close)]);
    if (!geometry.length) continue;
    const owned = covered.length ? stablePolygonDifference(geometry, covered) : geometry;
    for (const [polygonIndex, polygon] of owned.entries()) for (const [ringIndex, ring] of polygon.entries()) {
      let points = ring.slice(0,-1).map(([x,y])=>({x,y}));
      const outer = ringIndex===0;
      if ((signedArea(points)>0)!==outer) points=points.reverse();
      result.push({id:id+'-boundary-'+polygonIndex+'-'+ringIndex, surfaceId:id, role:outer?'outer':'hole',points});
    }
    covered = covered.length ? stablePolygonUnion(covered, geometry) : geometry;
  }
  return result.reverse();
}

function boundaryGeometry(boundaries: BoundaryLoop[]): MultiPolygon {
  const close = (loop: BoundaryLoop): Pair[] => [...loop.points, loop.points[0]].map(p=>[p.x,p.y]);
  return boundaries.filter(b=>b.role==='outer').map(outer=>[close(outer),...boundaries.filter(hole=>hole.role==='hole' && pointInLoop(hole.points[0],outer.points)).map(close)]);
}
function geometryBoundaries(geometry: MultiPolygon, id: string): BoundaryLoop[] {
  return geometry.flatMap((polygon, polygonIndex)=>polygon.map((ring, ringIndex)=>{
    let points=ring.slice(0,-1).map(([x,y])=>({x,y})); const outer=ringIndex===0;
    if ((signedArea(points)>0)!==outer) points=points.reverse();
    return {id:id+'-boundary-'+polygonIndex+'-'+ringIndex,role:outer?'outer' as const:'hole' as const,points};
  }));
}

function contourBoundaries(contours: PanellingPoint[][], id: string): BoundaryLoop[] {
  const ordered=contours.filter(points=>points.length>=3 && Math.abs(signedArea(points))>1).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)));
  return ordered.map((points,index)=>{
    const hole=ordered.slice(0,index).filter(parent=>pointInLoop(points[0],parent)).length%2===1;
    return {id:id+'-boundary-'+index,role:hole?'hole':'outer',points:(signedArea(points)>0)!==hole?points:[...points].reverse()};
  });
}
