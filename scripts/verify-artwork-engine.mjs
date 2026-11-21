import assert from 'node:assert/strict';
import { surfaceRuntime } from './surface-test-runtime.mjs';

// Artwork engine (plan R1): pure state + geometry modules are unit-tested here.
const { api } = await surfaceRuntime(`export * from './src/app/components/builder/artwork-engine/state/workspaceState';export * from './src/app/components/builder/artwork-engine/geometry/colour';export * from './src/app/components/builder/artwork-engine/state/sharedProperties';export * from './src/app/components/builder/artwork-engine/geometry/placement';export * from './src/app/components/builder/artwork-engine/geometry/spacing';export * from './src/app/components/builder/artwork-engine/geometry/readout';export * from './src/app/components/builder/artwork-engine/geometry/pivot';export * from './src/app/components/builder/artwork-engine/geometry/shapeBuilder';export * from './src/app/components/builder/artwork-engine/geometry/shapes/registry';export { roundVectorPath } from './src/app/lib/roundedVectorPath';export * from './src/app/components/builder/artwork-engine/geometry/repeat';export * from './src/app/components/builder/artwork-engine/geometry/pathCut';export { shapeProfile, middleChord, textAndShape, restoreWarpedShape } from './src/app/components/builder/artwork-engine/geometry/textFit';export { restoreBuiltShapes } from './src/app/components/builder/artwork-engine/geometry/shapeBuilder';export { restoreLiveText } from './src/app/lib/booleanArtwork';export * from './src/app/components/builder/artwork-engine/geometry/blend';export { productionArtworkSvg } from './src/app/lib/productionArtwork';export * from './src/app/components/builder/artwork-engine/geometry/letterStretch';export { overlapColour, overlapIsStale, overlapIssue, overlapShape, createOverlap, refreshOverlap } from './src/app/components/builder/artwork-engine/geometry/overlap';export { sameData, samePreviewProps, changedPreviewProps, withoutArtwork } from './src/app/components/builder/artwork-engine/state/stablePreviewProps';export * from './src/app/components/builder/artwork-engine/geometry/garmentEdges';export { applyVectorTextEffects } from './src/app/lib/vectorTextEffects';export * from './src/app/components/builder/artwork-engine/typography/recipes';export * from './src/app/components/builder/artwork-engine/typography/recipeScale';`);

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

// Phase 2: words as shapes — a rectangle's profile is flat top/bottom; a circle's middle chord is its full width; warps stay finite.
const rect = { id: 'r', type: 'shape', content: 'rect', x: 100, y: 100, width: 80, height: 40, rotation: 0, color: '#111', shapeFilled: true, borderWidth: 0, side: 'front' };
const profile = api.shapeProfile(rect);
assert(profile && profile.width > 50 && profile.topEdge.slice(4, -4).every(v => v < .02) && profile.bottomEdge.slice(4, -4).every(v => v > .98), 'rectangle profile is flat away from its rounded corners');
const disc = api.shapeProfile({ ...rect, id: 'c', content: 'circle', width: 60, height: 60 });
assert(disc.topEdge[24] < disc.topEdge[2], 'circle profile is higher in the middle than at the sides');
assert(Math.abs(api.middleChord(disc).width - disc.width) < disc.width * .08, 'circle middle chord is its diameter');
assert.deepEqual(api.textAndShape([rect, { id: 't', type: 'text', side: 'front' }], ['r', 't']), { textId: 't', shapeId: 'r' });
assert.equal(api.textAndShape([rect], ['r']), null);
const glyph = { closed: true, nodes: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] };
for (const type of ['squeeze', 'inflate', 'fisheye', 'twist', 'fan']) {
  const out = api.applyVectorTextEffects(glyph, [{ id: 'w', type, enabled: true, bend: 60, horizontal: 0, vertical: 0 }], 200, 50);
  assert(out.nodes.length > 4 && out.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y)), `${type} warp produces a finite outline`);
}
const env = api.applyVectorTextEffects(glyph, [{ id: 'e', type: 'envelope', enabled: true, bend: 0, horizontal: 0, vertical: 0, envelope: { top: [.5, 0, .5], bottom: [.5, 1, .5], aspect: 1 } }], 100, 100);
assert(Math.min(...env.nodes.map(n => n.y)) < 5 && Math.max(...env.nodes.map(n => n.y)) > 95, 'envelope stretches the middle to the full height');
console.log('artwork engine: phase 2 text shapes ok');

// Phase 2: text recipes — words and position never change, Original restores exactly, sizes follow the text, colours read on the garment.
const word = { id: 'w', type: 'text', content: 'Ceriga', x: 40, y: 60, width: 100, height: 30, rotation: 3, fontSize: 30, fontFamily: 'Inter', fontWeight: 'normal', color: '#171717', letterSpacing: 2, printMethod: 'DTG', side: 'front' };
assert(api.TEXT_RECIPES.length >= 18, 'at least the 18 planned recipes');
assert.equal(new Set(api.TEXT_RECIPES.map(recipe => recipe.id)).size, api.TEXT_RECIPES.length, 'recipe ids are unique');
for (const recipe of api.TEXT_RECIPES) for (const surface of ['#34363B', '#FFFFFF', '#C8102E']) {
  const styled = { ...word, ...api.applyTextRecipe(word, recipe.id, surface, 30) };
  assert.deepEqual([styled.content, styled.x, styled.y, styled.rotation, styled.fontSize], ['Ceriga', 40, 60, 3, 30], recipe.id + ' keeps words, place and size');
  assert(styled.textAppearance.length >= 1 && styled.textAppearance.every(item => item.colour), recipe.id + ' has an appearance stack');
  assert(api.contrastRatio(styled.color, surface) >= 3, recipe.id + ' main ink reads on ' + surface);
  const restored = { ...styled, ...api.clearTextRecipe(styled) };
  for (const key of ['fontFamily', 'fontWeight', 'color', 'letterSpacing']) assert.equal(restored[key], word[key], recipe.id + ' restores ' + key);
  assert.equal(restored.textAppearance, undefined); assert.equal(restored.textRecipe, undefined);
}
const once = { ...word, ...api.applyTextRecipe(word, 'varsity', '#FFFFFF', 30) }, twice = { ...once, ...api.applyTextRecipe(once, 'chrome', '#FFFFFF', 30) };
assert.equal(twice.textRecipe.base.fontFamily, 'Inter', 'switching recipes keeps the true original');
const screen = { ...word, printMethod: 'Screen Print' }, flat = { ...screen, ...api.applyTextRecipe(screen, 'chrome', '#FFFFFF', 30) };
assert(!flat.textAppearance.some(item => item.colour.startsWith('paint:')), 'no gradients on screen print');
const before = once.textAppearance.find(item => item.type === 'stroke').widthMm, grown = api.refreshTextRecipeScale({ ...once, fontSize: 60 });
assert(Math.abs(grown.textAppearance.find(item => item.type === 'stroke').widthMm - before * 2) < 1e-6, 'outlines scale with the text');
assert.equal(api.refreshTextRecipeScale(grown), grown, 'scaling is stable');
console.log('artwork engine: phase 2 recipes ok');

// Everything stays editable: builds, warps and combined words can return to their sources.
const built = api.rebuildFromPieces(scene, ['a', 'b'], api.builderPieces(scene, ['a', 'b']), () => crypto.randomUUID());
const back = api.restoreBuiltShapes(built.elements, built.elements[0].builtFrom.id);
assert.deepEqual(back.elements.map(element => element.id), ['a', 'b'], 'a shape build restores its original shapes');
const warpedText = { ...word, id: 'wt', vectorTextEffects: [{ id: 'e', type: 'envelope', enabled: true, bend: 0, horizontal: 0, vertical: 0, envelope: { top: [0, 0], bottom: [1, 1], aspect: 2, strength: 40, sourceShape: rect, textBefore: { x: 1, y: 2, width: 3, height: 4, rotation: 5, fontSize: 6 } } }] };
const unwarped = api.restoreWarpedShape([warpedText], 'wt');
assert.deepEqual(unwarped.map(element => element.id), ['r', 'wt']); assert.equal(unwarped[1].fontSize, 6); assert.equal(unwarped[1].vectorTextEffects, undefined);
assert.equal(api.restoreLiveText({ id: 'o', type: 'shape', x: 9, y: 8, rotation: 7, letteringSource: { ...word } }).type, 'text', 'combined words return as live text');

// Garment edges: read from a part mask, on the correct side, refit unless the user moved the text.
const maskW = 200, maskH = 100, mask = new Uint8ClampedArray(maskW * maskH * 4);
for (let y = 40; y < 60; y++) for (let x = 20; x < 180; x++) mask[(y * maskW + x) * 4 + 3] = 255;
const part = id => ({ id, alpha: mask, canvas: { width: maskW, height: maskH }, width: maskW, height: maskH });
const edges = api.garmentEdges([part('neck'), part('bodyHem'), part('sleeveLeft')]);
assert.deepEqual(edges.map(item => item.id), ['neckline', 'hem', 'sleeve-left']);
assert(edges[0].path.nodes.every(n => Math.abs(n.y - 59) < 1.5), 'neckline follows the bottom of the collar');
assert(edges[1].path.nodes.every(n => Math.abs(n.y - 40) < 1.5), 'hem follows the top of the hem');
assert(edges[2].path.nodes[0].x < edges[2].path.nodes.at(-1).x, 'sleeve text reads left to right');
assert(api.edgeOffset('below', 5, 20) > 5 && api.edgeOffset('above', 5, 20) === -5);
const edgeText = { ...word, ...api.textOnEdge(word, edges[1], 'front', 5, 400) };
assert(edgeText.fontSize < word.fontSize, 'long words shrink to fit the edge');
assert.equal(api.refreshEdgeText(edgeText, edges, 'front'), null, 'unchanged garment does not move linked text');
const lower = [{ ...edges[1], path: { ...edges[1].path, nodes: edges[1].path.nodes.map(n => ({ ...n, y: n.y + 12, in: n.in && { ...n.in, y: n.in.y + 12 }, out: n.out && { ...n.out, y: n.out.y + 12 } })) } }];
assert(api.refreshEdgeText(edgeText, lower, 'front'), 'linked text follows a changed hem');
assert.equal(api.refreshEdgeText({ ...edgeText, x: edgeText.x + 20 }, lower, 'front'), null, 'text the user moved stays where they put it');
const vee = Array.from({ length: 41 }, (_, i) => ({ x: i * 5, y: 100 - Math.abs(i - 20) * 3 }));
const gentle = api.gentleCurveBelow(vee);
assert(gentle.every((p, i) => p.y >= vee[i].y - 1e-6), 'the curve never crosses the collar');
assert(Math.max(...gentle.map(p => p.y)) - Math.min(...gentle.map(p => p.y)) <= 200 * .16 + 1e-6, 'a V-neck becomes a gentle curve');
console.log('artwork engine: editable sources and garment edges ok');

// Reference 16: live blend. Sources stay editable, lines are generated, every value changes the result.
const blendLine = (id, y, extra = {}) => ({ id, type: 'shape', content: 'custom-path', shapeGeometry: 'bounds', x: 100, y, width: 100, height: 20, rotation: 0, color: '#112233', shapeStrokeColor: '#112233', borderWidth: 1, shapeFilled: false, side: 'front', shapePath: { closed: false, nodes: [{ x: 0, y: 50 }, { x: 50, y: 0 }, { x: 100, y: 50 }] }, ...extra });
const lines = [blendLine('l1', 50), blendLine('l2', 150, { color: '#ddeeff', shapeStrokeColor: '#ddeeff' })];
assert.equal(api.blendIssue(lines, ['l1', 'l2']), null);
assert(api.blendIssue(lines, ['l1']), 'one path cannot blend');
const blended = api.createBlend(lines, ['l1', 'l2'], 'blend', 10);
assert.equal(blended.length, 1); const live = blended[0];
assert.equal(live.children.length, 2, 'only the sources are stored'); assert(live.children.every(child => child.hidden));
const countLines = group => api.blendBands(group).reduce((sum, band) => sum + 1 + (band.shapePath.subpaths?.length ?? 0), 0);
assert.equal(countLines(live), 98, '96 steps plus both sources');
assert.equal(countLines(api.updateBlend(live, { steps: 10 })), 12, 'steps change the line count');
assert(api.blendBands(live).length > 1, 'colour change makes colour bands'); assert(api.blendBands(live).length <= 32);
assert.equal(api.refreshBlend(live), live, 'an unchanged blend is not rebuilt');
const moved = api.updateBlendSource(live, live.children[1].id, { y: live.children[1].y + 40 });
assert(moved.height > live.height + 30, 'moving a source updates the blend');
const keyed = api.addBlendKey(live, 'mid'); assert.equal(keyed.children.length, 3); assert.equal(api.removeBlendKey(keyed, 'mid').children.length, 2);
const closedA = { closed: true, nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] };
const rotated = { closed: true, nodes: [closedA.nodes[2], closedA.nodes[3], closedA.nodes[0], closedA.nodes[1]] };
const aligned = api.alignPoints(api.resamplePath(closedA, 40), api.resamplePath(rotated, 40), true);
assert(Math.hypot(aligned[0].x, aligned[0].y) < 1, 'closed paths align their start points so the blend does not twist');
const expanded = api.expandBlend(live); assert(expanded.children.every(child => !child.hidden && child.type === 'shape')); assert.equal(expanded.blendExpandedFrom.id, 'blend');
assert(api.releaseBlend(live).children.every(child => !child.hidden), 'release returns the paths');
for (const result of [api.expandBlend(live), api.releaseBlend(live)]) { const merged = { ...live, ...result }; assert.equal(merged.artworkBlend, undefined, 'leaving blend mode survives a panel merge'); assert.equal(merged.blendKey, undefined); }
const spined = api.setBlendSpine([live, blendLine('sp', 100)], 'blend', 'sp'); assert.equal(spined.length, 1); assert(spined[0].artworkBlend.spine);
assert.equal(api.clearBlendSpine(spined, 'blend').length, 2, 'releasing the spine returns its path');
console.log('artwork engine: blend ok');

const straight = Array.from({ length: 100 }, (_, i) => ({ x: i, y: 0 }));
assert.equal(api.simplifyStep(straight).length, 2, 'straight lines need only their ends');
const cornerRun = [...straight, ...Array.from({ length: 50 }, (_, i) => ({ x: 99, y: i + 1 }))];
assert.equal(api.simplifyStep(cornerRun).length, 3, 'a corner is preserved');
console.log('artwork engine: blend simplification ok');

// Speed: the garment skips redraws only when its own data is unchanged.
assert(api.sameData({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })); assert(!api.sameData({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] }));
assert(!api.sameData({ fn() {} }, { fn() {} }), 'different functions are never treated as equal');
const garmentProps = (color, art, extra = {}) => ({ color, customAssetState: { torsoCrop: 2, prints: art, studioArtwork: art }, ...extra });
assert(api.samePreviewProps(garmentProps('#111111', [1]), garmentProps('#111111', [2])), 'an artwork-only edit does not redraw the garment');
assert(!api.samePreviewProps(garmentProps('#111111', [1]), garmentProps('#222222', [1])), 'a colour change redraws the garment');
assert(!api.samePreviewProps({ customAssetState: { torsoCrop: 1 } }, { customAssetState: { torsoCrop: 2 } }), 'a garment change redraws it');
const drawA = () => 1, drawB = () => 2;
assert(api.samePreviewProps({ renderMeasurements: drawA, renderMeasurementsDeps: ['x'] }, { renderMeasurements: drawB, renderMeasurementsDeps: ['x'] }), 'an overlay with unchanged data does not redraw');
assert(!api.samePreviewProps({ renderMeasurements: drawA, renderMeasurementsDeps: ['x'] }, { renderMeasurements: drawB, renderMeasurementsDeps: ['y'] }), 'an overlay with new data redraws');
assert(!api.samePreviewProps({ renderMeasurements: drawA }, { renderMeasurements: drawB }), 'an undeclared overlay always redraws');
console.log('artwork engine: preview memo ok');

// Text along a part starts centred and no taller than the part; after that the size is the designer's.
const sleeveEdge = api.garmentEdges([part('sleeveLeft')])[0];
assert(sleeveEdge.thickness > 15 && sleeveEdge.thickness < 25, 'sleeve width is measured');
const onSleeve = api.textOnEdge({ ...word, fontSize: 60 }, sleeveEdge, 'front', 0, 100);
assert(onSleeve.fontSize * .72 <= sleeveEdge.thickness * .6 + 1e-6, 'text starts inside the sleeve');
assert.equal(onSleeve.textPath.offset, onSleeve.fontSize * .72 / 2, 'text starts centred on the sleeve');
assert.equal(api.textOnEdge({ ...word, fontSize: 60 }, sleeveEdge, 'front', 0).fontSize, 60, 'a size the designer sets is kept');
console.log('artwork engine: sleeve fit ok');

// Reference 17: colour per key shape, blur, and print export of a blend.
const threeKeys = api.updateBlendSource(api.addBlendKey(live, 'peach'), 'peach', { blendColour: '#ff0000' });
const midBand = api.blendBands(threeKeys).find(band => /Blend 1[5-8]/.test(band.layerName));
assert(parseInt(midBand.color.slice(1, 3), 16) > parseInt(midBand.color.slice(5, 7), 16) + 40, 'the blend passes through the key colour');
const blurred = api.updateBlend(live, { blur: 6 });
assert(blurred.width >= live.width + 30 && blurred.height >= live.height + 30, 'the frame makes room for the blur');
const exported = await api.productionArtworkSvg([blurred], 400, 400);
assert(exported.includes('feGaussianBlur'), 'blur reaches the print file');
assert(!exported.includes('Blend sources') && (exported.match(/<path/g) ?? []).length >= 8, 'the generated lines reach the print file');
const releasedInks = api.releaseBlend(api.updateBlend(live, { startColour: '#ff0000', endColour: '#00ff00' }));
assert.equal(api.inkOf(releasedInks.children[0]).toLowerCase(), '#ff0000', 'released paths keep their blend colours');
assert.equal(api.inkOf(releasedInks.children[1]).toLowerCase(), '#00ff00');
console.log('artwork engine: blend colour, blur and export ok');

// Reference 19: stretch one letter from any handle; the opposite edge stays put.
const letterBox = { left: 10, top: 20, right: 30, bottom: 60 }, letterPivot = { x: 20, y: 40 };
const place = (t, x, y) => ({ x: letterPivot.x + t.x + (x - letterPivot.x) * t.scaleX, y: letterPivot.y + t.y + (y - letterPivot.y) * t.scaleY });
const down = api.stretchLetter(api.IDENTITY_LETTER, letterBox, letterPivot, { x: 0, y: 1 }, 0, 40);
assert(Math.abs(place(down, 20, 20).y - 20) < 1e-6 && Math.abs(place(down, 20, 60).y - 100) < 1e-6, 'dragging the bottom keeps the top fixed');
assert.equal(down.scaleX, 1, 'an edge handle changes one axis');
const corner2 = api.stretchLetter(api.IDENTITY_LETTER, letterBox, letterPivot, { x: 1, y: 1 }, 20, 10, { proportional: true });
assert.equal(corner2.scaleX, corner2.scaleY, 'Shift keeps proportion');
const centred = api.stretchLetter(api.IDENTITY_LETTER, letterBox, letterPivot, { x: 1, y: 0 }, 10, 0, { fromCentre: true });
assert(Math.abs(place(centred, 10, 40).x - 0) < 1e-6 && Math.abs(place(centred, 30, 40).x - 40) < 1e-6, 'Alt scales from the centre');
assert(api.stretchLetter(api.IDENTITY_LETTER, letterBox, letterPivot, { x: 0, y: 1 }, 0, -500).scaleY >= .05, 'a letter cannot collapse or invert');

// Reference 19: a live overlap colour that follows both objects.
const boxA = { id: 'oa', type: 'shape', content: 'custom-path', shapeGeometry: 'bounds', x: 50, y: 50, width: 60, height: 60, rotation: 0, color: '#0044cc', shapeFilled: true, shapeFillColor: '#0044cc', borderWidth: 0, side: 'front', shapePath: { closed: true, nodes: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] } };
const boxB = { ...boxA, id: 'ob', x: 80, color: '#dd2222', shapeFillColor: '#dd2222' };
const withOverlap = await api.createOverlap([boxA, boxB], ['oa', 'ob'], 'ov');
assert.deepEqual(withOverlap.map(item => item.id), ['oa', 'ob', 'ov'], 'the overlap sits above both objects');
const ov = withOverlap[2]; assert(Math.abs(ov.width - 30) < .1 && Math.abs(ov.x - 65) < .1, 'the overlap is exactly the shared area');
assert(![boxA.color, boxB.color].includes(ov.color), 'the overlap starts in its own colour');
assert.equal(api.overlapIsStale(ov, boxA, boxB), false);
const movedB = { ...boxB, x: 70 }; assert.equal(api.overlapIsStale(ov, boxA, movedB), true, 'moving a source marks it stale');
const refreshed = await api.refreshOverlap(ov, boxA, movedB); assert(Math.abs(refreshed.width - 40) < .1, 'the overlap reshapes');
assert.equal((await api.refreshOverlap(ov, boxA, { ...boxB, x: 500 })).hidden, true, 'it hides when the objects stop touching');
console.log('artwork engine: letter stretch and overlap ok');
