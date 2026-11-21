import assert from 'node:assert/strict';
import { surfaceRuntime } from './surface-test-runtime.mjs';

// Artwork engine (plan R1): pure state + geometry modules are unit-tested here.
const { api } = await surfaceRuntime(`export * from './src/app/components/builder/artwork-engine/state/workspaceState';export * from './src/app/components/builder/artwork-engine/geometry/colour';export * from './src/app/components/builder/artwork-engine/state/sharedProperties';export * from './src/app/components/builder/artwork-engine/geometry/placement';export * from './src/app/components/builder/artwork-engine/geometry/spacing';export * from './src/app/components/builder/artwork-engine/geometry/readout';export * from './src/app/components/builder/artwork-engine/geometry/pivot';export * from './src/app/components/builder/artwork-engine/geometry/shapeBuilder';export * from './src/app/components/builder/artwork-engine/geometry/shapes/registry';export { roundVectorPath } from './src/app/lib/roundedVectorPath';export * from './src/app/components/builder/artwork-engine/geometry/repeat';export * from './src/app/components/builder/artwork-engine/geometry/pathCut';`);

// Workspace states (plan §4.2)
const state = input => api.deriveWorkspaceState({ tool: 'select', selectionCount: 0, directEditing: false, ...input });
assert.equal(state({}), 'browse');
assert.equal(state({ selectionCount: 1 }), 'select');
assert.equal(state({ selectionCount: 3 }), 'multi-select');
assert.equal(state({ tool: 'brush' }), 'create');
assert.equal(state({ tool: 'shapeLive', selectionCount: 1 }), 'create', 'an active creation tool wins over a lingering selection');
assert.equal(state({ selectionCount: 1, directEditing: true }), 'direct-edit');
assert.equal(state({ tool: 'textTracking', selectionCount: 1 }), 'direct-edit');
assert.equal(state({ selectionCount: 1, patternEditing: true }), 'pattern-edit');
assert.equal(state({ selectionCount: 1, effectEditing: true }), 'effect-edit');

// Readable default ink
assert.equal(api.readableInk('#171717', '#34363B'), '#FFFFFF', 'dark ink on a dark garment flips to light');
assert.equal(api.readableInk('#171717', '#F5F1E8'), '#171717', 'dark ink stays on a light garment');
assert.equal(api.readableInk('#171717', undefined), '#171717', 'no surface colour keeps the preferred ink');
assert.equal(api.readableInk('#171717', 'not-a-colour'), '#171717');
assert(Math.abs(api.contrastRatio('#000000', '#FFFFFF') - 21) < 1e-9);
assert.equal(api.parseHex('#abc').join(), '170,187,204');

// Multi-object property editing
const doc = [{ id: 'a', type: 'text', color: '#111111' }, { id: 'b', type: 'shape', shapeFilled: true, shapeFillColor: '#111111' }, { id: 'c', type: 'shape', shapeStrokeColor: '#222222', locked: true }];
assert.equal(api.sharedValue(doc.slice(0, 2), api.inkOf), '#111111');
assert.equal(api.sharedValue(doc, api.inkOf), null, 'mixed colours read as null');
const recoloured = api.patchSelection(doc, ['a', 'b', 'c'], e => api.inkPatch(e, '#ff0000'));
assert.equal(recoloured[0].color, '#ff0000');
assert.equal(recoloured[1].shapeFillColor, '#ff0000');
assert.equal(recoloured[2].shapeStrokeColor, '#222222', 'locked objects are not changed');

// Garment placement
const area = { x: 100, y: 50, width: 300, height: 400 }, upc = 6; // 6 canvas units per cm
const chest = api.placeOnGarment({ width: 120, height: 60 }, 'left-chest', area, upc);
assert.equal(Math.round(chest.width), 54, 'left chest is ~9 cm wide'); assert.equal(Math.round(chest.height), 27, 'keeps proportions');
assert(chest.x > area.x + area.width / 2, "left chest sits on the wearer's left (viewer's right)");
const full = api.placeOnGarment({ width: 50, height: 50 }, 'full-front', area, upc);
assert(full.width <= area.width * .78 + 1e-9 && full.height <= area.height * .8 + 1e-9, 'full front stays inside the body');
assert.deepEqual(api.garmentPlacements('back').map(p => p.id), ['upper-back', 'full-back', 'centre']);

// Equal-spacing smart guides
const row = [{ id: 'a', x: 50, y: 100, width: 40, height: 40 }, { id: 'b', x: 250, y: 100, width: 40, height: 40 }];
const mid = api.equalSpacingSnap({ x: 146, y: 102, halfW: 20, halfH: 20 }, row, 6, { x: false, y: false });
assert.equal(mid.x, 150, 'snaps to the point with equal gaps either side'); assert.equal(mid.hints[0].gap, 60); assert.equal(mid.hints[0].gaps.length, 2);
const rhythm = api.equalSpacingSnap({ x: 247, y: 100, halfW: 20, halfH: 20 }, [{ id: 'a', x: 50, y: 100, width: 40, height: 40 }, { id: 'b', x: 150, y: 100, width: 40, height: 40 }], 6, { x: false, y: false });
assert.equal(rhythm.x, 250, 'continues an existing even rhythm');
const held = api.equalSpacingSnap({ x: 146, y: 102, halfW: 20, halfH: 20 }, row, 6, { x: true, y: false });
assert.equal(held.x, 146, 'an axis that already snapped to an edge/centre is left alone');
assert.equal(api.equalSpacingSnap({ x: 146, y: 300, halfW: 20, halfH: 20 }, row, 6, { x: false, y: false }).hints.length, 0, 'objects not in the same row are ignored');
// Live transform readout
assert.equal(api.formatTransformReadout('rotate', { width: 1, height: 1, rotation: 270 }), '-90°');
assert.equal(api.formatTransformReadout('resize', { width: 54, height: 27, rotation: 0 }, 6), '9.0 × 4.5 cm');
// Transform pivot
const boxP = { x: 100, y: 100, width: 40, height: 20, rotation: 0 };
const aroundCentre = api.rotateAboutPivot(boxP, 90, { u: 0, v: 0 });
assert.deepEqual([aroundCentre.x, aroundCentre.y], [100, 100], 'centre pivot leaves the object in place');
const corner = api.rotateAboutPivot(boxP, 90, { u: -.5, v: -.5 }); // top-left corner is (80, 90)
const rad = Math.PI / 2, cornerAfter = { x: corner.x + (-20 * Math.cos(rad) - -10 * Math.sin(rad)), y: corner.y + (-20 * Math.sin(rad) + -10 * Math.cos(rad)) };
assert(Math.abs(cornerAfter.x - 80) < 1e-9 && Math.abs(cornerAfter.y - 90) < 1e-9, 'rotating about the top-left keeps that corner fixed');
assert.equal(api.PIVOT_GRID.length, 9); assert.equal(api.PIVOT_GRID[4].label, 'Centre');
console.log('PASS: artwork engine — workspace states, readable default ink, shared properties, garment placement, equal spacing, readouts, pivot');

// Phase 1: shape builder — two overlapping squares give three pieces; merging two leaves two; rebuild replaces sources.
const square = (id, x) => ({ id, type: 'shape', content: 'rect', x, y: 50, width: 40, height: 40, rotation: 0, color: '#111111', shapeFilled: true, borderWidth: 0, side: 'front' });
const scene = [square('a', 50), square('b', 70)];
const pieces = api.builderPieces(scene, ['a', 'b']);
assert.equal(pieces.length, 3, 'two overlapping squares divide into three pieces');
assert.equal(api.mergePieces(pieces, [pieces[0].id, pieces[1].id]).length, 2, 'merging two pieces leaves two');
let next = 0;
const rebuilt = api.rebuildFromPieces(scene, ['a', 'b'], pieces, () => `n${next++}`);
assert.equal(rebuilt.elements.length, 3);
assert(rebuilt.elements.every(element => element.content === 'custom-path' && element.shapeFilled), 'pieces rebuild as filled custom paths');

// Phase 1: parametric registry and live corner styles
assert(Object.keys(api.PARAMETRIC_SHAPES).length >= 17, 'fashion shapes registered');
for (const family of ['Badges', 'Ribbons', 'Streetwear', 'Decorative']) assert(api.shapesInFamily(family).length >= 3, `${family} has shapes`);
const box = { closed: true, nodes: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] };
const chamfer = api.roundVectorPath(box, 10, 'chamfer'), scoop = api.roundVectorPath(box, 10, 'scoop'), round = api.roundVectorPath(box, 10);
assert.equal(chamfer.nodes.length, 8, 'chamfer cuts every corner into two points');
// Each corner's curve midpoint: round hugs inward (≈4.1), chamfer sits at the cut line (≈7.1), scoop bows away to the arc around the corner (≈10).
const topRight = { x: 100, y: 0 };
const near = (p, d = 15) => Math.hypot(p.x - topRight.x, p.y - topRight.y) < d;
const cornerMid = path => { const n = path.nodes.length; for (let i = 0; i < n; i++) { const a = path.nodes[i], b = path.nodes[(i + 1) % n]; if (near(a) && near(b)) { const c1 = a.out ?? a, c2 = b.in ?? b; const m = { x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8, y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8 }; return Math.hypot(m.x - topRight.x, m.y - topRight.y); } } return NaN; };
const [dRound, dChamfer, dScoop] = [round, chamfer, scoop].map(cornerMid);
assert(Math.abs(dRound - 4.14) < .5, `round corner midpoint ${dRound}`);
assert(Math.abs(dChamfer - 7.07) < .3, `chamfer corner midpoint ${dChamfer}`);
assert(Math.abs(dScoop - 10) < .8, `scoop corner midpoint ${dScoop}`);
assert(!api.roundVectorPath(box, 0, 'scoop').nodes.some(node => node.out), 'no radius leaves sharp corners');console.log('artwork engine: phase 1 shape builder, registry and corners ok');

// Phase 1: live repeat — radial copies sit on a circle, mirror flips, the master stays hidden, overlapping copies get knockout gaps.
const petal = { id: 'p', type: 'shape', content: 'ellipse', x: 100, y: 60, width: 30, height: 60, rotation: 0, color: '#111111', shapeFilled: true, borderWidth: 0, side: 'front' };
const ring = api.repeatCopies(petal, { mode: 'radial', count: 4, span: 360, rotateCopies: true, centre: { x: 100, y: 100 }, gap: 0 });
assert.equal(ring.length, 4);
assert(Math.abs(ring[2].x - 100) < 1e-6 && Math.abs(ring[2].y - 140) < 1e-6 && ring[2].rotation === 180, 'third of four copies sits opposite and turned 180°');
const mirrored = api.repeatCopies(petal, { mode: 'mirror-x', count: 2, span: 360, rotateCopies: true, centre: { x: 120, y: 60 }, gap: 0 });
assert.equal(mirrored[1].x, 140); assert.equal(mirrored[1].flipHorizontal, true);
const repeated = api.createRepeat([petal], 'p', 'radial', 'g')[0];
assert.equal(repeated.type, 'group'); assert.equal(repeated.children.length, 5, 'hidden master + four copies');
assert(repeated.children[0].hidden && repeated.children[0].repeatMaster, 'master is hidden');
assert.equal(api.refreshRepeat(repeated), repeated, 'unchanged repeat is not regenerated');
const six = api.updateRepeat(repeated, { settings: { count: 6 } });
assert.equal(six.children.length, 7, 'changing the count regenerates copies');
const gapped = api.updateRepeat(six, { settings: { gap: 3 } });
assert(gapped.children.slice(1).every(child => child.content === 'custom-path'), 'overlapping copies are cut by the next copy');
const released = api.releaseRepeat(gapped); assert.equal(released.children.length, 6, `release keeps the copies, drops the master (${gapped.children.length} → ${released.children.length})`);
console.log('artwork engine: phase 1 repeat ok');

// Phase 1: scissors — a closed square opens at an anchor; an open path splits in two; endpoints can't be cut.
const sq = { closed: true, nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] };
const opened = api.cutPathAtNode(sq, 2);
assert(opened && !opened.main.closed && !opened.extra && opened.main.nodes.length === 5, 'closed path opens with the cut point at both ends');
assert.deepEqual([opened.main.nodes[0].x, opened.main.nodes[0].y, opened.main.nodes[4].x, opened.main.nodes[4].y], [10, 10, 10, 10]);
const split = api.cutPathAtNode({ closed: false, nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }] }, 1);
assert.equal(split.main.nodes.length, 2); assert.equal(split.extra.nodes.length, 2);
assert.equal(api.cutPathAtNode({ closed: false, nodes: [{ x: 0, y: 0 }, { x: 5, y: 0 }] }, 0), null);
console.log('artwork engine: phase 1 scissors ok');
