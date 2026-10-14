import { distance, flattenSeam, mirrorSeam, pointInSurface } from './panellingGeometry';
import { convertSeamToCurve, insertSeamAnchor, moveSeamAnchor, setAnchorMode, snapAnchor } from './panellingSeams';
import { recomputePanellingTopology } from './panellingTopology';
import type { BoundaryLoop, PanellingSeam } from './panellingTypes';

const rectangle: BoundaryLoop[] = [{ id: 'body', role: 'outer', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] }];
const seam = (id: string, points: [number, number][]): PanellingSeam => ({ id, label: id, construction: 'standard', anchors: points.map(([x, y], index) => ({ id: `${id}-${index}`, x, y })) });
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

export function runPanellingSelfTests() {
  const results: { name: string; passed: boolean }[] = [];
  const test = (name: string, run: () => void) => { run(); results.push({ name, passed: true }); };

  test('boundary-to-boundary seam creates two inherited panels', () => {
    const topology = recomputePanellingTopology(rectangle, [seam('center', [[50, 0], [50, 100]])]);
    assert(topology.panels.length === 2, `Expected 2 panels; received ${topology.panels.length}`);
    assert(topology.panels.every(panel => panel.parentId === 'body' && !panel.fillOverride), 'Panels must inherit their parent material by default.');
  });
  test('crossing seams create a shared junction and four faces', () => {
    const topology = recomputePanellingTopology(rectangle, [seam('vertical', [[50, 0], [50, 100]]), seam('horizontal', [[0, 50], [100, 50]])]);
    assert(topology.nodes.some(node => node.kind === 'intersection' && node.seamIds.length === 2), 'Crossing did not create a shared seam junction.');
    assert(topology.panels.length === 4, `Expected 4 panels; received ${topology.panels.length}`);
  });
  test('a seam joining an existing seam creates a junction and third face', () => {
    const topology = recomputePanellingTopology(rectangle, [seam('vertical', [[50, 0], [50, 100]]), seam('side-join', [[0, 50], [50, 50]])]);
    assert(topology.nodes.some(node => node.kind === 'intersection' && node.seamIds.length === 2), 'Seam connection did not create a shared junction.');
    assert(topology.panels.length === 3, `Expected 3 panels; received ${topology.panels.length}`);
  });
  test('closed internal loop creates its own panel without overlap', () => {
    const square = seam('square', [[30, 30], [70, 30], [70, 70], [30, 70], [30, 30]]);
    const panels = recomputePanellingTopology(rectangle, [square]).panels;
    assert(panels.length === 2, `Expected square and surrounding panels; received ${panels.length}`);
    assert(Math.abs(panels.reduce((sum, panel) => sum + panel.area, 0) - 10000) < 1, 'Generated regions do not conserve parent area.');
  });
  test('curved seam flattens for topology while retaining Bezier controls', () => {
    const curved = seam('curve', [[0, 50], [100, 50]]);
    curved.anchors[0].outgoing = { x: 35, y: 15 };
    curved.anchors[1].incoming = { x: 65, y: 85 };
    assert(flattenSeam(curved).length > 10, 'Bezier segment was not sampled.');
    assert(recomputePanellingTopology(rectangle, [curved]).panels.length === 2, 'Curved boundary-to-boundary seam did not split the surface.');
  });
  test('mirroring reflects anchors and swaps reflected handles', () => {
    const curved = seam('mirror', [[20, 40], [60, 70]]);
    curved.anchors[0].outgoing = { x: 28, y: 30 };
    const reflected = mirrorSeam(curved, 50);
    assert(reflected.anchors[0].x === 80 && reflected.anchors[0].incoming?.x === 72, 'Mirror axis or handle reflection is incorrect.');
  });
  test('segment insertion and anchor movement preserve seam identity', () => {
    const original = seam('editable', [[10, 50], [90, 50]]);
    const inserted = insertSeamAnchor(original, { x: 45, y: 52 });
    assert(inserted.id === original.id && inserted.anchors.length === 3, 'Insertion created a duplicate seam or missed the new point.');
    const moved = moveSeamAnchor(inserted, inserted.anchors[1].id, { x: 45, y: 65 });
    assert(moved.anchors[1].y === 65, 'Anchor move did not update seam geometry.');
  });
  test('inserting a point into a curved segment preserves its curve', () => {
    const curved = seam('curve-insert', [[0, 50], [100, 50]]);
    curved.anchors[0].outgoing = { x: 20, y: 10 };
    curved.anchors[1].incoming = { x: 80, y: 10 };
    const before = flattenSeam(curved, 48), inserted = insertSeamAnchor(curved, { x: 50, y: 20 }), after = flattenSeam(inserted, 48);
    assert(inserted.anchors.length === 3, 'Curve insertion did not add an anchor.');
    assert(before.every(point => Math.min(...after.map(candidate => distance(point, candidate))) < 1), 'Curve changed shape during insertion.');
  });
  test('straight segments convert to editable curves without an initial geometry jump', () => {
    const straight = seam('convert', [[10, 50], [90, 50]]), converted = convertSeamToCurve(straight, 0);
    assert(converted.anchors[0].outgoing && converted.anchors[1].incoming, 'Conversion did not create Bezier handles.');
    assert(flattenSeam(straight).every((point, index) => Math.abs(point.y - flattenSeam(converted)[index].y) < 1e-6), 'Conversion changed the initial straight appearance.');
  });
  test('anchor modes remove, align, or preserve independent handles', () => {
    const curve = seam('modes', [[0, 50], [50, 50], [100, 50]]);
    const smooth = setAnchorMode(curve, 'modes-1', 'smooth'), point = smooth.anchors[1];
    assert(point.incoming && point.outgoing && Math.abs(point.incoming.y - point.outgoing.y) < 1e-6, 'Smooth mode did not create aligned handles.');
    const corner = setAnchorMode(smooth, point.id, 'corner').anchors[1];
    assert(!corner.incoming && !corner.outgoing, 'Corner mode kept curve handles.');
    assert(setAnchorMode(smooth, point.id, 'independent').anchors[1].handleMode === 'independent', 'Independent mode was not retained.');
  });
  test('snap resolves a nearby garment boundary', () => {
    const anchor = snapAnchor({ x: 48, y: 1 }, rectangle, [], 4);
    assert(anchor.boundaryId === 'body' && anchor.y === 0, 'Boundary snap failed.');
  });
  test('hole boundary is excluded from garment material', () => {
    const boundaries: BoundaryLoop[] = [...rectangle, { id: 'neckline', role: 'hole', points: [{ x: 40, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 20 }, { x: 40, y: 20 }] }];
    assert(!pointInSurface({ x: 50, y: 10 }, boundaries), 'Neck opening was treated as garment material.');
    assert(pointInSurface({ x: 20, y: 20 }, boundaries), 'Body material was incorrectly classified as a hole.');
  });

  return results;
}