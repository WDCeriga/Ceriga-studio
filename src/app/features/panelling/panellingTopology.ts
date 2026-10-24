import polygonClipping, { type MultiPolygon, type Pair } from 'polygon-clipping';
import { flattenSeam, pointInLoop, pointInSurface, signedArea } from './panellingGeometry';
import type { BoundaryLoop, GraphNode, PanellingSeam, PanellingTopology, PanelRegion, PanellingPoint } from './panellingTypes';

interface Segment {
  a: PanellingPoint;
  b: PanellingPoint;
  kind: 'boundary' | 'seam';
  sourceId: string;
  cuts: { t: number; point: PanellingPoint }[];
}
interface HalfEdge { id: string; from: string; to: string; twin: string; edgeId: string; seamId?: string }
interface Cycle { points: PanellingPoint[]; seamIds: Set<string>; seamSides:Set<string>; area: number; sample: PanellingPoint }

const cross = (a: PanellingPoint, b: PanellingPoint) => a.x * b.y - a.y * b.x;
const vector = (a: PanellingPoint, b: PanellingPoint) => ({ x: b.x - a.x, y: b.y - a.y });
const areaOf = (geometry: MultiPolygon) => geometry.reduce((sum, polygon) => sum + polygon.reduce((value, ring, index) => value + (index ? -1 : 1) * Math.abs(signedArea(ring.map(([x, y]) => ({ x, y })))), 0), 0);
const closeRing = (points: PanellingPoint[]): Pair[] => [...points, points[0]].map(point => [point.x, point.y]);
const multiPath = (geometry: MultiPolygon) => geometry.map(polygon => polygon.map(ring => `M${ring.map(point => point.join(',')).join('L')}Z`).join('')).join('');

function segmentIntersection(first: Segment, second: Segment) {
  const r = vector(first.a, first.b), s = vector(second.a, second.b), denominator = cross(r, s);
  if (Math.abs(denominator) < 1e-8) return undefined;
  const offset = vector(first.a, second.a), t = cross(offset, s) / denominator, u = cross(offset, r) / denominator;
  if (t < -1e-7 || t > 1 + 1e-7 || u < -1e-7 || u > 1 + 1e-7) return undefined;
  return { t: Math.max(0, Math.min(1, t)), u: Math.max(0, Math.min(1, u)), point: { x: first.a.x + t * r.x, y: first.a.y + t * r.y } };
}

function interiorSample(points: PanellingPoint[], area: number): PanellingPoint {
  const edges = points.map((a, i) => ({a, b:points[(i+1)%points.length]})).sort((a,b)=>Math.hypot(b.b.x-b.a.x,b.b.y-b.a.y)-Math.hypot(a.b.x-a.a.x,a.b.y-a.a.y));
  const side = area > 0 ? 1 : -1;
  for (const {a,b} of edges) {
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    if (!length) continue;
    for (const offset of [.05,.005,.0005,.00005]) {
      const sample={x:(a.x+b.x)/2-side*dy/length*offset,y:(a.y+b.y)/2+side*dx/length*offset};
      if (pointInLoop(sample,points)) return sample;
    }
  }
  return points[0];
}

function geometryInsideFace(face: Cycle, other: Cycle) {
  return other.area < face.area - 1e-3 && pointInLoop(other.sample, face.points);
}

function stableId(path: string) {
  let hash = 2166136261;
  for (let index = 0; index < path.length; index++) hash = Math.imul(hash ^ path.charCodeAt(index), 16777619);
  return `panel-${(hash >>> 0).toString(36)}`;
}

function buildBodyGeometry(boundaries: BoundaryLoop[]): MultiPolygon {
  const outers = boundaries.filter(boundary => boundary.role === 'outer');
  return outers.map(outer => [closeRing(outer.points), ...boundaries.filter(boundary => boundary.role === 'hole' && pointInLoop(boundary.points[0], outer.points)).map(hole => closeRing(hole.points))]);
}

export function recomputePanellingTopology(boundaries: BoundaryLoop[], seams: PanellingSeam[], parentId = 'body'): PanellingTopology {
  if (!boundaries.some(boundary => boundary.role === 'outer')) return { nodes: [], edges: [], panels: [] };
  const segments: Segment[] = [];
  for (const boundary of boundaries) for (let index = 0; index < boundary.points.length; index++) {
    segments.push({ a: boundary.points[index], b: boundary.points[(index + 1) % boundary.points.length], kind: 'boundary', sourceId: boundary.id, cuts: [] });
  }
  for (const seam of seams) {
    const points = flattenSeam(seam);
    for (let index = 0; index < points.length - 1; index++) {
      segments.push({ a: points[index], b: points[index + 1], kind: 'seam', sourceId: seam.id, cuts: [] });
    }
  }

  const sorted = segments.map((segment, index) => ({ segment, index, minX: Math.min(segment.a.x, segment.b.x), maxX: Math.max(segment.a.x, segment.b.x),
    minY: Math.min(segment.a.y, segment.b.y), maxY: Math.max(segment.a.y, segment.b.y) })).sort((a, b) => a.minX - b.minX);
  for (let i = 0; i < sorted.length; i++) {
    const left = sorted[i];
    for (let j = i + 1; j < sorted.length && sorted[j].minX <= left.maxX + 1e-6; j++) {
      const right = sorted[j];
      if (right.minY > left.maxY || right.maxY < left.minY) continue;
      const hit = segmentIntersection(left.segment, right.segment);
      if (!hit) {
        const a = left.segment, b = right.segment;
        const r = vector(a.a, a.b), length = r.x*r.x + r.y*r.y;
        if (length && Math.abs(cross(r, vector(a.a, b.a))) < 1e-6 && Math.abs(cross(r, vector(a.a, b.b))) < 1e-6) {
          for (const [segment, point] of [[a, b.a], [a, b.b], [b, a.a], [b, a.b]] as [Segment, PanellingPoint][]) {
            const d = vector(segment.a, segment.b), l = d.x*d.x + d.y*d.y;
            const t = l ? ((point.x-segment.a.x)*d.x + (point.y-segment.a.y)*d.y) / l : -1;
            if (t >= 0 && t <= 1) segment.cuts.push({ t, point });
          }
        }
        continue;
      }
      left.segment.cuts.push({ t: hit.t, point: hit.point });
      right.segment.cuts.push({ t: hit.u, point: hit.point });
    }
  }

  const graphNodes = new Map<string, GraphNode>();
  const graphNodeById = new Map<string, GraphNode>();
  const getNode = (point: PanellingPoint, kind: GraphNode['kind'], seamId?: string) => {
    const key = `${Math.round(point.x * 1e6) / 1e6},${Math.round(point.y * 1e6) / 1e6}`;
    let node = graphNodes.get(key);
    if (!node) {
      node = { id: `node-${graphNodes.size + 1}`, ...point, kind, seamIds: [] };
      graphNodes.set(key, node);
      graphNodeById.set(node.id, node);
    }
    if (kind === 'intersection' || node.kind === 'intersection') node.kind = 'intersection';
    else if ((kind === 'anchor' && node.kind === 'boundary') || (kind === 'boundary' && node.kind === 'anchor')) node.kind = 'intersection';
    if (seamId && !node.seamIds.includes(seamId)) node.seamIds.push(seamId);
    return node;
  };
  const graphEdges: PanellingTopology['edges'] = [];
  const adjacency = new Map<string, HalfEdge[]>();
  const halfEdges = new Map<string, HalfEdge>();
  const edgeById = new Map<string, PanellingTopology['edges'][number]>();
  const edgeKeys = new Set<string>();
  const addEdge = (from: GraphNode, to: GraphNode, segment: Segment, index: number) => {
    if (from.id === to.id) return;
    const key = [from.id, to.id].sort().join(':');
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    const id = `edge-${graphEdges.length + 1}`;
    const edge = { id, from: from.id, to: to.id, kind: segment.kind, ...(segment.kind === 'seam' ? { seamId: segment.sourceId } : {}) };
    graphEdges.push(edge); edgeById.set(id, edge);
    const forward: HalfEdge = { id, from: from.id, to: to.id, twin: `${id}:r`, edgeId: id, seamId: edge.seamId };
    const reverse: HalfEdge = { id: `${id}:r`, from: to.id, to: from.id, twin: id, edgeId: id, seamId: edge.seamId };
    halfEdges.set(id, forward); halfEdges.set(`${id}:r`, reverse);
    adjacency.set(from.id, [...(adjacency.get(from.id) ?? []), forward]);
    adjacency.set(to.id, [...(adjacency.get(to.id) ?? []), reverse]);
    void index;
  };

  segments.forEach(segment => {
    const direction = vector(segment.a, segment.b), denominator = direction.x * direction.x + direction.y * direction.y || 1;
    const cuts = [{ t: 0, point: segment.a }, ...segment.cuts, { t: 1, point: segment.b }]
      .sort((a, b) => a.t - b.t).filter((cut, index, all) => !index || Math.abs(cut.t - all[index - 1].t) > 1e-7);
    for (let index = 0; index < cuts.length - 1; index++) {
      const first = cuts[index], second = cuts[index + 1];
      // Split only the part physically inside this semantic surface; never extend a seam.
      if (segment.kind === 'seam' && !pointInSurface({ x: (first.point.x + second.point.x) / 2, y: (first.point.y + second.point.y) / 2 }, boundaries)) continue;
      const atSeamEnd = segment.kind === 'seam' && (first.t < 1e-7 || second.t > 1 - 1e-7);
      const kind: GraphNode['kind'] = atSeamEnd ? 'anchor' : segment.kind === 'boundary' ? 'boundary' : 'anchor';
      const from = getNode(first.point, kind, segment.kind === 'seam' ? segment.sourceId : undefined);
      const to = getNode(second.point, kind, segment.kind === 'seam' ? segment.sourceId : undefined);
      addEdge(from, to, segment, index);
    }
  });

  for (const [nodeId, edges] of adjacency) edges.sort((a, b) => {
    const origin = graphNodeById.get(nodeId)!, first = graphNodeById.get(a.to)!, second = graphNodeById.get(b.to)!;
    return Math.atan2(first.y - origin.y, first.x - origin.x) - Math.atan2(second.y - origin.y, second.x - origin.x);
  });

  const visited = new Set<string>(), cycles: Cycle[] = [];
  for (const initial of halfEdges.values()) {
    if (visited.has(initial.id)) continue;
    let edge: HalfEdge | undefined = initial;
    const points: PanellingPoint[] = [], seamIds = new Set<string>(),seamSides=new Set<string>();
    let closed = false;
    let guard = halfEdges.size + 1;
    while (edge && !visited.has(edge.id) && guard-- > 0) {
      visited.add(edge.id);
      const node = graphNodeById.get(edge.from)!;
      points.push({ x: node.x, y: node.y });
      if (edge.seamId){seamIds.add(edge.seamId);seamSides.add(edge.seamId+(edge.id.endsWith(':r')?':right':':left'));}
      const nextOptions = adjacency.get(edge.to) ?? [];
      const reverseIndex = nextOptions.findIndex(candidate => candidate.id === edge!.twin);
      if (reverseIndex < 0) break;
      edge = nextOptions[(reverseIndex - 1 + nextOptions.length) % nextOptions.length];
      if (edge.id === initial.id) { closed = true; break; }
    }
    if (!closed || points.length < 3) continue;
    const area = signedArea(points);
    if (area <= 2) continue;
    const sample = interiorSample(points, area);
    if (pointInSurface(sample, boundaries)) cycles.push({ points, seamIds,seamSides, area, sample });
  }

  const body = buildBodyGeometry(boundaries);
  const hasHoles = boundaries.some(boundary => boundary.role === 'hole');
  const panels: PanelRegion[] = [];
  for (const face of cycles) {
    let geometry: MultiPolygon = hasHoles
      ? polygonClipping.intersection([[closeRing(face.points)]], body)
      : [[closeRing(face.points)]];
    for (const child of cycles) {
      if (child === face || !geometryInsideFace(face, child)) continue;
      const inner = hasHoles
        ? polygonClipping.intersection([[closeRing(child.points)]], body)
        : [[closeRing(child.points)]];
      if (inner.length) geometry = polygonClipping.difference(geometry, inner);
    }
    if (areaOf(geometry) < 4) continue;
    const path = multiPath(geometry);
    const legacyId=stableId(`${parentId}:${path}`),signature=[...face.seamSides].sort().join('|'),baseId=signature?stableId(parentId+':seam-face:'+signature):legacyId;
    const repeat=panels.filter(panel=>panel.id===baseId||panel.id.startsWith(baseId+'-')).length,id=repeat?baseId+'-'+repeat:baseId;
    panels.push({ id,legacyId:id!==legacyId?legacyId:undefined, label: `${parentId} Panel ${panels.length + 1}`, parentId,
      path, points: face.points, area: areaOf(geometry), seamIds: [...face.seamIds] });
  }

  const seamDegree = new Map<string, number>();
  for (const edge of graphEdges) if (edge.seamId) {
    seamDegree.set(edge.from, (seamDegree.get(edge.from) ?? 0) + 1);
    seamDegree.set(edge.to, (seamDegree.get(edge.to) ?? 0) + 1);
  }
  for (const [nodeId, node] of graphNodeById) if (node.seamIds.length > 1 || (seamDegree.get(nodeId) ?? 0) > 2) node.kind = 'intersection';
  return { nodes: [...graphNodes.values()], edges: graphEdges, panels };
}
/** Each construction piece owns its faces; one seam ID may contribute edges to many surfaces. */
export function recomputeGarmentPanellingTopology(boundaries: BoundaryLoop[], seams: PanellingSeam[]): PanellingTopology {
  const ids = [...new Set(boundaries.map(boundary => boundary.surfaceId ?? 'base'))];
  const result: PanellingTopology = { nodes: [], edges: [], panels: [] };
  const names: Record<string, string> = { base: 'Body', sleeveLeft: 'Left Sleeve', sleeveRight: 'Right Sleeve', neck: 'Neck', bodyHem: 'Body Hem', sleeveHemLeft: 'Left Cuff', sleeveHemRight: 'Right Cuff' };
  const junctions = new Map<string, GraphNode>();
  for (const id of ids) {
    const topology = recomputePanellingTopology(boundaries.filter(boundary => (boundary.surfaceId ?? 'base') === id), seams, id);
    const prefix = (key: string) => `${id}:${key}`;
    const nodeIds = new Map<string, string>();
    for (const node of topology.nodes) {
      const key = Math.round(node.x*1e6)+','+Math.round(node.y*1e6);
      const shared = node.seamIds.length ? junctions.get(key) : undefined;
      if (shared) {
        shared.kind='intersection';
        shared.surfaceIds = [...new Set([...(shared.surfaceIds ?? []),id])];
        shared.seamIds = [...new Set([...shared.seamIds,...node.seamIds])];
        nodeIds.set(node.id,shared.id);
      } else {
        const next = {...node,id:prefix(node.id),surfaceIds:[id]};
        result.nodes.push(next);
        nodeIds.set(node.id,next.id);
        if(node.seamIds.length) junctions.set(key,next);
      }
    }
    result.edges.push(...topology.edges.map(edge => ({ ...edge, id: prefix(edge.id), from: nodeIds.get(edge.from)!, to: nodeIds.get(edge.to)! })));
    // Multiple disconnected SVG contours still belong to one untouched semantic piece.
    // Keep each exact subpath; do not invent a connecting edge between components.
    const untouched = topology.panels.filter(panel=>panel.seamIds.length===0);
    const divided = topology.panels.filter(panel=>panel.seamIds.length>0);
    const path = untouched.map(panel=>panel.path).join('');
    const semantic = untouched.length>1 ? [{...untouched[0],id:stableId(id+':'+path),path,area:untouched.reduce((sum,p)=>sum+p.area,0)},...divided] : topology.panels;
    result.panels.push(...semantic.map((panel, index) => ({ ...panel, label: `${names[id] ?? id} Panel ${index + 1}` })));
  }
  return result;
}
