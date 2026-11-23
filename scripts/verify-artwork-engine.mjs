import assert from 'node:assert/strict';
import { surfaceRuntime } from './surface-test-runtime.mjs';

// Artwork engine (plan R1): pure state + geometry modules are unit-tested here.
const { api } = await surfaceRuntime(`export * from './src/app/components/builder/artwork-engine/state/workspaceState';export * from './src/app/components/builder/artwork-engine/geometry/colour';export * from './src/app/components/builder/artwork-engine/state/sharedProperties';export * from './src/app/components/builder/artwork-engine/geometry/placement';export * from './src/app/components/builder/artwork-engine/geometry/spacing';export * from './src/app/components/builder/artwork-engine/geometry/readout';export * from './src/app/components/builder/artwork-engine/geometry/pivot';export * from './src/app/components/builder/artwork-engine/geometry/shapeBuilder';export * from './src/app/components/builder/artwork-engine/geometry/shapes/registry';export { roundVectorPath } from './src/app/lib/roundedVectorPath';export * from './src/app/components/builder/artwork-engine/geometry/repeat';export * from './src/app/components/builder/artwork-engine/geometry/pathCut';export { shapeProfile, middleChord, textAndShape, restoreWarpedShape } from './src/app/components/builder/artwork-engine/geometry/textFit';export { restoreBuiltShapes } from './src/app/components/builder/artwork-engine/geometry/shapeBuilder';export { restoreLiveText } from './src/app/lib/booleanArtwork';export * from './src/app/components/builder/artwork-engine/geometry/blend';export { productionArtworkSvg } from './src/app/lib/productionArtwork';export * from './src/app/components/builder/artwork-engine/geometry/letterStretch';export { overlapColour, overlapIsStale, overlapIssue, overlapShape, createOverlap, refreshOverlap } from './src/app/components/builder/artwork-engine/geometry/overlap';export { DEFAULT_FADE, createReflection, refreshReflections, fadeGradient, fadeStyle } from './src/app/components/builder/artwork-engine/geometry/fade';export { orderDesignLayers } from './src/app/lib/designLayerOrdering';export * from './src/app/components/builder/artwork-engine/typography/outcomes';export { expandTextAppearance } from './src/app/lib/textAppearance';export { clearPathBrush, patchPathBrush, pathBrushDrawing, pathBrushPatch } from './src/app/lib/pathBrush';export { captureBrush, readCustomBrushes } from './src/app/lib/customBrushes';export { applyBrushDynamics, brushDynamicsActive } from './src/app/lib/brushDynamics';export { physicalRepeatScale, fittedRepeatCounts } from './src/app/lib/patternPhysical';export { DEFAULT_SETT, SETT_PRESETS, expandSett } from './src/app/lib/patternsPro';export { PATTERN_CATALOG, patternDefaultColors } from './src/app/lib/patternCatalog';export { generatedPatternGeometry } from './src/app/lib/generatedPatterns';export { fashionPatternPalette } from './src/app/lib/fashionPatterns';export { initialPatternSettings, patternAppearance } from './src/app/lib/patternEditing';export { VOLUME_BRUSHES, VOLUME_DEFAULTS, groupVolumeStrokes, insideDistance, isVolumeBrush, shadeVolume } from './src/app/lib/brushVolume';export { clearRestyle, patchDrawingStrokes, restyleDrawing } from './src/app/lib/drawingRestyle';export { supportsVectorDrawing } from './src/app/lib/vectorDrawing';export { BRUSH_PRESETS, DEFAULT_BRUSH_SETTINGS, brushPresetControls } from './src/app/lib/drawingBrush';export { RIBBON_BRUSHES } from './src/app/lib/brushRibbons';export { vectorDrawingMarkup } from './src/app/lib/vectorDrawing';export { CROP_SHAPES, adjustCropToRatio, buildArtworkClipPath, cropShapePoints, cropToRatio } from './src/app/lib/artworkCrop';export { removeImageBackground } from './src/app/lib/removeImageBackground';export { printQuality, isVectorImage } from './src/app/components/builder/artwork-engine/image/printQuality';export { extractPalette } from './src/app/components/builder/artwork-engine/image/grade';export { applyImageGrade, autoLevels, curveTable, gradeIsActive, imageHistogram } from './src/app/components/builder/artwork-engine/image/grade';export { applyTextEffects, createShapeEffect, shapeEffectControls, RETIRED_EFFECTS, TEXT_EFFECTS } from './src/app/lib/textEffects';export * from './src/app/components/builder/artwork-engine/geometry/colourField';export * from './src/app/components/builder/artwork-engine/geometry/widthProfile';export { sameData, samePreviewProps, changedPreviewProps, withoutArtwork } from './src/app/components/builder/artwork-engine/state/stablePreviewProps';export * from './src/app/components/builder/artwork-engine/geometry/garmentEdges';export { applyVectorTextEffects } from './src/app/lib/vectorTextEffects';export * from './src/app/components/builder/artwork-engine/typography/recipes';export * from './src/app/components/builder/artwork-engine/typography/recipeScale';`);

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

// Reference 17: editable fade, blend mode and a reflection that follows its object.
assert(api.fadeGradient(api.DEFAULT_FADE).includes('linear-gradient(180deg'));
assert(api.fadeGradient({ ...api.DEFAULT_FADE, type: 'radial' }).startsWith('radial-gradient'));
assert.equal(api.fadeStyle(boxA), undefined, 'no fade, no mask');
const mirrored2 = api.createReflection([boxA], 'oa', 'rf', 4);
assert.deepEqual(mirrored2.map(item => item.id), ['rf', 'oa'], 'the reflection sits behind its object');
const rf = mirrored2[0]; assert.equal(rf.flipVertical, true); assert.equal(rf.height, 36, 'default length 60%'); assert.equal(rf.y, 50 + 30 + 4 + 18);
const movedSource = api.refreshReflections(mirrored2.map(item => item.id === 'oa' ? { ...item, x: 120, shapeFillColor: '#00aa55' } : item))[0];
assert.equal(movedSource.x, 120); assert.equal(movedSource.shapeFillColor, '#00aa55', 'edits to the object carry to the reflection');
assert.equal(movedSource.opacity, rf.opacity, 'its own strength is kept');
assert.equal(api.refreshReflections(mirrored2), mirrored2, 'an unchanged reflection is stable');
assert.deepEqual(api.refreshReflections([rf]).length, 0, 'deleting the object removes its reflection');
assert.equal(api.orderDesignLayers(mirrored2.map(item => item.id === 'oa' ? { ...item, y: 70 } : item)).find(item => item.id === 'rf').y, 122, 'the layer pipeline keeps it in step');
const fadedSvg = await api.productionArtworkSvg([{ ...boxA, artworkFade: api.DEFAULT_FADE, artworkBlendMode: 'multiply' }], 200, 200);
assert(fadedSvg.includes('<mask') && fadedSvg.includes('linearGradient') && fadedSvg.includes('mix-blend-mode:multiply'), 'fade and blend mode reach the print file');
console.log('artwork engine: fade, blend mode and reflection ok');

// Plan 9.5: one-tap outcomes stay editable, reversible, proportional and live.
const outWord = { ...word, id: 'ow', fontSize: 40, letterSpacing: 2, textUnitsPerCm: 10 };
for (const { id } of api.TEXT_OUTCOMES) {
  const styled = { ...outWord, ...api.applyTextOutcome(outWord, api.defaultOutcome(id, '#111111', '#ffffff'), 10) };
  assert.equal(styled.content, 'Ceriga', id + ' keeps the words'); assert.equal(styled.textOutcome.id, id);
  assert(styled.textAppearance.some(item => item.id.startsWith('outcome-')), id + ' adds editable layers');
  const again = { ...styled, ...api.applyTextOutcome(styled, { ...styled.textOutcome, distance: styled.textOutcome.distance * 2 }, 10) };
  assert.equal(again.textAppearance.length, styled.textAppearance.length, id + ' does not stack up when edited');
  const removed = { ...styled, ...api.clearTextOutcome(styled) };
  assert(!removed.textAppearance.some(item => item.id.startsWith('outcome-')), id + ' removes cleanly'); assert.equal(removed.letterSpacing, 2, id + ' restores tracking');
}
const longShadow = { ...outWord, ...api.applyTextOutcome(outWord, api.defaultOutcome('long-shadow', '#111111', '#ffffff'), 10) };
const depthOf = el => el.textAppearance.find(item => item.type === 'extrude').depthMm;
const doubled = api.refreshTextOutcomeScale({ ...longShadow, fontSize: 80 });
assert(Math.abs(depthOf(doubled) - depthOf(longShadow) * 2) < 1e-6, 'outcomes scale with the text');
assert.equal(api.refreshTextOutcomeScale(doubled), doubled, 'outcome scaling is stable');
const interlocked = { ...outWord, ...api.applyTextOutcome(outWord, api.defaultOutcome('interlock', '#111111', '#ffffff'), 10) };
assert(interlocked.letterSpacing < 2, 'interlock pulls letters together'); assert.equal(interlocked.textAppearance[0].type, 'interlock', 'interlock draws on top');
const restyled = { ...interlocked, ...api.applyTextRecipe(interlocked, 'athletic', '#ffffff', 10) };
assert.equal(restyled.textOutcome.id, 'interlock', 'changing style keeps the outcome'); assert.equal(restyled.textRecipe.id, 'athletic');
assert(restyled.textAppearance.filter(item => item.type === 'interlock').length === 1);
console.log('artwork engine: text outcomes ok');

// References 16 and 17: colour fields and variable-width lines, as editable vectors in the print file.
assert(api.COLOUR_FIELD_PRESETS.length >= 6, 'colour field looks');
const fieldLook = api.COLOUR_FIELD_PRESETS[0].field, fieldSvg = api.colourFieldSvg('f', fieldLook, 200, 100);
assert.equal((fieldSvg.defs.match(/<radialGradient/g) ?? []).length, fieldLook.points.length, 'one gradient per point');
assert.equal((fieldSvg.layers.match(/<rect/g) ?? []).length, fieldLook.points.length + 1, 'base plus one layer per point');
const hardPoint = api.colourFieldSvg('h', { base: '#ffffff', points: [{ id: 'a', x: 50, y: 50, colour: '#000000', size: 50, softness: 0, opacity: 100 }] }, 100, 100);
assert(hardPoint.defs.includes('offset="0.875" stop-color="#000000" stop-opacity="1.0000"'), 'zero softness keeps a solid centre');
assert.notEqual(api.newFieldPoint(fieldLook, 'n').id, fieldLook.points[0].id);
assert.equal(api.widthAt(api.WIDTH_PRESETS[0].stops, 0), 0); assert.equal(api.widthAt(api.WIDTH_PRESETS[0].stops, .5), 1); assert.equal(api.widthAt(api.WIDTH_PRESETS[0].stops, 1), 0);
assert(api.widthAt([{ t: 0, width: 0 }, { t: 1, width: 100 }], .25) < .25, 'width eases between stops');
const taperLine = { closed: false, nodes: [{ x: 0, y: 50 }, { x: 100, y: 50 }] };
const outlined = api.profileOutline(taperLine, 10, { stops: api.WIDTH_PRESETS[0].stops });
const outlineYs = [...outlined.matchAll(/(?:M|L)(-?[\d.]+) (-?[\d.]+)/g)].map(m => Number(m[2]));
assert(Math.max(...outlineYs) <= 55.01 && Math.max(...outlineYs) > 54.5 && Math.min(...outlineYs) < 45.5, 'the line reaches full width in the middle');
assert(api.profileOutline({ closed: true, nodes: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }] }, 4, { stops: [{ t: 0, width: 100 }, { t: 1, width: 100 }] }).split('Z').length > 3, 'a closed line has an inner and outer edge');
const fieldBox = { ...boxA, colourField: fieldLook, shapeWidthProfile: { stops: api.WIDTH_PRESETS[0].stops }, borderWidth: 3 };
const fieldPrint = await api.productionArtworkSvg([fieldBox], 200, 200);
assert(fieldPrint.includes('radialGradient') && fieldPrint.includes('clip-path') && fieldPrint.includes('fill-rule="nonzero"') && !fieldPrint.includes('stroke-width="3"'), 'field and tapered line reach the print file as vectors');
console.log('artwork engine: colour field and width profile ok');

// Artwork Phase 3: every effect stays customisable, repeatable and keeps a visible result on solid ink.
const fxWidth = 120, fxHeight = 60, fxInk = new Uint8ClampedArray(fxWidth * fxHeight * 4);
for (let y = 15; y < 45; y++) for (let x = 20; x < 100; x++) fxInk.set([217, 65, 47, 255], (y * fxWidth + x) * 4);
const fxCoverage = data => { let total = 0; for (let i = 3; i < data.length; i += 4) total += data[i] > 16 ? 1 : 0; return total; };
for (const id of ['halftone', 'chrome', 'foil', 'embroidery', 'photocopy', 'ink-bleed', 'screen-print', 'duotone', 'riso', 'stipple', 'engraving', 'stamp', 'dither', 'inline', 'contour', 'sticker', 'rhinestone', 'glitter']) {
  const fxEffect = { ...api.createShapeEffect(id), seed: 5 }, first = api.applyTextEffects(fxInk, fxWidth, fxHeight, [fxEffect]), second = api.applyTextEffects(fxInk, fxWidth, fxHeight, [fxEffect]);
  assert(api.shapeEffectControls(id).length >= 4, id + ' has at least four controls');
  assert.deepEqual([...first], [...second], id + ' is repeatable from its seed');
  assert(first.some((value, index) => value !== fxInk[index]), id + ' changes the artwork');
  assert(fxCoverage(first) > fxCoverage(fxInk) * .12, id + ' keeps the artwork visible');
  assert.deepEqual([...api.applyTextEffects(fxInk, fxWidth, fxHeight, [{ ...fxEffect, enabled: false }])], [...fxInk], id + ' can be switched off');
}
const fxReseedA = api.applyTextEffects(fxInk, fxWidth, fxHeight, [{ ...api.createShapeEffect('stipple'), seed: 1 }]), fxReseedB = api.applyTextEffects(fxInk, fxWidth, fxHeight, [{ ...api.createShapeEffect('stipple'), seed: 2 }]);
assert(fxReseedA.some((value, index) => value !== fxReseedB[index]), 'a new seed gives a new result');
for (const id of api.RETIRED_EFFECTS) assert(api.applyTextEffects(fxInk, fxWidth, fxHeight, [{ ...api.createShapeEffect(id), seed: 3 }]).some((value, index) => value !== fxInk[index]), id + ' still renders in saved designs');
console.log('artwork engine: effects quality ok');

// Artwork Phase 4: the image grade is exact, reversible and leaves transparency alone.
const gradeWidth = 64, gradeHeight = 4, gradeSource = new Uint8ClampedArray(gradeWidth * gradeHeight * 4);
for (let y = 0; y < gradeHeight; y++) for (let x = 0; x < gradeWidth; x++) gradeSource.set([x * 4, 120, 255 - x * 4, y === 3 ? 0 : 255], (y * gradeWidth + x) * 4);
assert.deepEqual([...api.applyImageGrade(gradeSource, gradeWidth, gradeHeight, {})], [...gradeSource], 'an empty grade changes nothing');
assert.equal(api.gradeIsActive({ black: 20, enabled: false }), false, 'a hidden grade is off');
assert.deepEqual([...api.curveTable([{ x: 0, y: 0 }, { x: 255, y: 255 }])], Array.from({ length: 256 }, (_, i) => i), 'a straight curve is identity');
const sCurve = api.curveTable([{ x: 0, y: 0 }, { x: 64, y: 40 }, { x: 192, y: 220 }, { x: 255, y: 255 }]);
assert(sCurve[64] === 40 && sCurve[192] === 220 && [...sCurve].every((v, i) => !i || v >= sCurve[i - 1]), 'curves pass through their points and never fold back');
const levelled = api.applyImageGrade(gradeSource, gradeWidth, gradeHeight, { black: 40, white: 200 });
assert.equal(levelled[10 * 4], 0, 'black point clips to black'); assert.equal(levelled[55 * 4], 255, 'white point clips to white');
const hueShifted = api.applyImageGrade(new Uint8ClampedArray([230, 30, 30, 255, 30, 30, 230, 255]), 2, 1, { hsl: { red: { s: -100 } } });
assert(Math.abs(hueShifted[0] - hueShifted[1]) < 3 && hueShifted[6] > hueShifted[4] + 150, 'the mixer changes only the chosen colour');
const mappedGrade = api.applyImageGrade(gradeSource, gradeWidth, gradeHeight, { map: { amount: 100, stops: [{ position: 0, color: '#000000' }, { position: 100, color: '#ff0000' }] } });
assert(mappedGrade[1] === 0 && mappedGrade[2] === 0 && mappedGrade[0] > 0, 'gradient map replaces colour by tone');
for (const gradeCase of [{ clarity: 60 }, { denoise: 60 }, { vibrance: 50 }, { black: 30, mid: 90, white: 220 }]) { const graded = api.applyImageGrade(gradeSource, gradeWidth, gradeHeight, gradeCase); for (let i = 3; i < graded.length; i += 4) assert.equal(graded[i], gradeSource[i], 'alpha is preserved'); }
const gradeLevels = api.autoLevels(api.imageHistogram(new Uint8ClampedArray(Array.from({ length: 100 }, (_, i) => [60 + i, 60 + i, 60 + i, 255]).flat())));
assert(gradeLevels.black >= 60 && gradeLevels.white <= 159 && gradeLevels.white > 150, 'auto tone finds the real range');
console.log('artwork engine: image grade ok');

// Artwork Phase 4: ratio crops, shape crops and refined background removal.
const ratioCrop = api.cropToRatio({}, 400, 200, 1);
assert(Math.abs((100 - ratioCrop.cropLeft - ratioCrop.cropRight) * 4 - (100 - ratioCrop.cropTop - ratioCrop.cropBottom) * 2) < 1e-6, 'ratio crop is really square');
for (const handle of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
  const held = api.adjustCropToRatio(ratioCrop, handle, handle.includes('w') ? 6 : -6, handle.includes('n') ? 9 : -9, .5), heldW = 100 - held.cropLeft - held.cropRight, heldH = 100 - held.cropTop - held.cropBottom;
  assert(Math.abs(heldW / heldH - .5) < 1e-6 && held.cropLeft >= 0 && held.cropTop >= 0 && held.cropRight >= 0 && held.cropBottom >= 0, handle + ' keeps the ratio inside the image');
}
for (const shape of api.CROP_SHAPES) {
  const inset = { cropLeft: 10, cropTop: 20, cropRight: 30, cropBottom: 10 }, shapePoints = api.cropShapePoints(inset, shape.id);
  assert(shapePoints.length >= 3 && shapePoints.every(([x, y]) => x >= 9.99 && x <= 70.01 && y >= 19.99 && y <= 90.01), shape.id + ' stays inside the crop');
  assert(api.buildArtworkClipPath({ ...inset, cropShape: shape.id }).startsWith('polygon('), shape.id + ' clips the canvas');
}
assert.equal(api.buildArtworkClipPath({ cropShape: 'circle' }, { ignoreCrop: true }), undefined, 'the full image shows while cropping');
const shapePrint = await api.productionArtworkSvg([{ id: 'crop-print', type: 'image', content: 'data:image/png;base64,AA==', x: 20, y: 20, width: 40, height: 40, rotation: 0, cropShape: 'star' }], 40, 40);
assert(shapePrint.includes('<polygon') && shapePrint.includes('clip-path'), 'shape crop reaches the print file');
const bgW = 40, bgH = 40, bgImage = new Uint8ClampedArray(bgW * bgH * 4);
for (let y = 0; y < bgH; y++) for (let x = 0; x < bgW; x++) {
  const inRing = Math.hypot(x - 20, y - 20) < 14 && Math.hypot(x - 20, y - 20) > 6, dot = x === 3 && y === 3;
  bgImage.set(inRing || dot ? [20, 20, 200, 255] : x < 20 ? [255, 255, 255, 255] : [235, 60, 60, 255], (y * bgW + x) * 4);
}
const bgAlpha = (data, x, y) => data[(y * bgW + x) * 4 + 3];
const bgPlain = api.removeImageBackground(bgImage, bgW, bgH, 30, 4);
assert(bgAlpha(bgPlain, 1, 20) === 0 && bgAlpha(bgPlain, 38, 20) === 0 && bgAlpha(bgPlain, 20, 10) === 255, 'a two-colour backdrop is removed and the artwork kept');
assert.equal(bgAlpha(bgPlain, 20, 20) > 0, true, 'inner areas stay by default');
assert.equal(bgAlpha(api.removeImageBackground(bgImage, bgW, bgH, 30, 4, undefined, { inner: true }), 20, 20), 0, 'inner areas can be removed');
assert.equal(bgAlpha(bgPlain, 3, 3), 255); assert.equal(bgAlpha(api.removeImageBackground(bgImage, bgW, bgH, 30, 4, undefined, { specks: 100 }), 3, 3), 0, 'specks can be cleaned');
const bgCount = data => { let n = 0; for (let i = 3; i < data.length; i += 4) n += data[i] > 127 ? 1 : 0; return n; };
assert(bgCount(api.removeImageBackground(bgImage, bgW, bgH, 30, 4, undefined, { shift: 2 })) > bgCount(bgPlain) && bgCount(api.removeImageBackground(bgImage, bgW, bgH, 30, 4, undefined, { shift: -2 })) < bgCount(bgPlain), 'the edge can move both ways');
console.log('artwork engine: crop and background ok');

// Artwork Phase 4: recolour, combined cutout and print sharpness.
const imageToRecolour = new Uint8ClampedArray([200, 30, 30, 255, 220, 50, 50, 255, 30, 30, 200, 255, 30, 200, 30, 255]);
const imageRecoloured = api.applyImageGrade(imageToRecolour, 4, 1, { recolour: { range: 60, colours: [{ from: '#c81e1e', to: '#1ec81e' }] } });
assert.deepEqual([...imageRecoloured.slice(0, 3)], [30, 200, 30], 'the chosen colour changes exactly');
assert(imageRecoloured[5] > imageRecoloured[4] && imageRecoloured[5] > imageRecoloured[6], 'nearby shades follow the new colour');
assert.deepEqual([...imageRecoloured.slice(8, 11)], [30, 30, 200], 'other colours stay put');
const paletteImage = new Uint8ClampedArray(400 * 4); for (let i = 0; i < 400; i++) paletteImage.set(i < 300 ? [240, 20, 20, 255] : [20, 20, 240, 255], i * 4);
const foundColours = api.extractPalette(paletteImage, 2);
assert.deepEqual(foundColours, ['#f01414', '#1414f0'], 'palette finds the main colours, largest first');
assert.deepEqual(api.extractPalette(paletteImage, 2), foundColours, 'palette is repeatable');
const cutoutImage = new Uint8ClampedArray(20 * 20 * 4); for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) cutoutImage.set(x > 5 && x < 14 && y > 5 && y < 14 ? [200, 30, 30, 255] : [255, 255, 255, 255], (y * 20 + x) * 4);
const cutoutGraded = api.applyImageGrade(cutoutImage, 20, 20, { cutout: { id: 'remove-background', intensity: 100 }, recolour: { range: 60, colours: [{ from: '#c81e1e', to: '#1e1ec8' }] } });
assert(cutoutGraded[3] === 0 && cutoutGraded[(10 * 20 + 10) * 4 + 3] === 255 && cutoutGraded[(10 * 20 + 10) * 4 + 2] === 200, 'cutout and recolour work together');
const printSharp = api.printQuality(3000, 3000, 200, 200, 10), printLow = api.printQuality(300, 300, 300, 300, 10);
assert(printSharp.grade === 'sharp' && printSharp.ppi === 381 && printSharp.fitScale === 1, 'large image at 20 cm prints sharp');
assert(printLow.grade === 'low' && Math.abs(api.printQuality(300, 300, 300 * printLow.fitScale, 300 * printLow.fitScale, 10).ppi - 150) <= 1, 'Fix resizes to the target resolution');
assert(api.isVectorImage('data:image/svg+xml;base64,AA==') && !api.isVectorImage('data:image/png;base64,AA=='), 'vectors are recognised');
console.log('artwork engine: recolour and print quality ok');

// Artwork Phase 5: direction-aware brushes stay editable, repeatable and vector.
const brushLine = Array.from({ length: 80 }, (_, i) => ({ x: 20 + i * 4, y: 100 + Math.sin(i / 12) * 30, p: .4 + Math.sin(i / 79 * Math.PI) * .6, tilt: 0 }));
const brushDrawing = (id, patch = {}, points = brushLine) => { const preset = api.BRUSH_PRESETS.find(item => item.id === id); return { width: 400, height: 200, strokes: [{ points, seed: 9, opacity: 1, settings: { ...api.DEFAULT_BRUSH_SETTINGS, ...preset.settings, brushPreset: id, brushSize: preset.size, color: '#d9412f', opacity: 100, pressure: true, stabilization: 20, grain: 0, pencil: { pencilOnly: false, tiltShading: false, doubleTapTogglesEraser: false }, ...patch } }] }; };
assert(api.BRUSH_PRESETS.length >= 52 && new Set(api.BRUSH_PRESETS.map(item => item.id)).size === api.BRUSH_PRESETS.length, 'brush library is complete and unique');
for (const id of api.RIBBON_BRUSHES) {
  assert(api.BRUSH_PRESETS.some(item => item.id === id), id + ' is in the library');
  const markup = api.vectorDrawingMarkup(brushDrawing(id), 'b');
  assert(markup.includes('<path') && !markup.includes('NaN') && !markup.includes('<image'), id + ' exports as clean vector');
  assert.equal(markup, api.vectorDrawingMarkup(brushDrawing(id), 'b'), id + ' is repeatable');
  assert(api.vectorDrawingMarkup(brushDrawing(id, {}, [brushLine[0]]), 'b').includes('<path'), id + ' works for a single tap');
  assert(api.vectorDrawingMarkup(brushDrawing(id, {}, [brushLine[0], { ...brushLine[0] }]), 'b').includes('<path'), id + ' survives a stroke with no length');
  assert(api.brushPresetControls(id).length >= 1, id + ' has controls');
}
for (const id of ['rope', 'chain-link', 'barbed-wire', 'zipper', 'ribbon', 'star-scatter', 'sparkle-scatter', 'flower-scatter']) {
  assert.deepEqual(api.brushPresetControls(id).map(control => control.key), ['patternScale', 'patternGap', 'patternJitter'], id + ' has pattern controls');
  assert.notEqual(api.vectorDrawingMarkup(brushDrawing(id, { patternScale: 180 }), 'b'), api.vectorDrawingMarkup(brushDrawing(id), 'b'), id + ' repeat size changes the stroke');
}
const brushMarks = (id, count) => (api.vectorDrawingMarkup(brushDrawing(id, {}, brushLine.slice(0, count)), 'b').match(/<path/g) ?? []).length;
assert(brushMarks('star-scatter', 80) > brushMarks('star-scatter', 30), 'longer strokes place more marks');
assert.equal((api.vectorDrawingMarkup(brushDrawing('highlighter'), 'b').match(/<path/g) ?? []).length, 1, 'a see-through ink is one even shape, so it cannot band');
console.log('artwork engine: brushes ok');

// Artwork Phase 5: 3D brushes are lit surfaces, and any drawing can be brushRestyled and restored.
const volW = 90, volH = 50, volMask = new Float32Array(volW * volH);
for (let y = 0; y < volH; y++) for (let x = 0; x < volW; x++) volMask[y * volW + x] = Math.abs(y - 25) <= 16 && x > 8 && x < 82 ? 1 : 0;
const volDistance = api.insideDistance(volMask, volW, volH);
assert(Math.abs(volDistance[25 * volW + 45] - 17) < 1e-6 && volDistance[2 * volW + 45] === 0, 'distance to the edge is exact');
assert(api.VOLUME_BRUSHES.length >= 16, '3D and contour family');
const volLum = (data, x, y) => { const i = (y * volW + x) * 4; return data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722; };
for (const brush of api.VOLUME_BRUSHES) {
  const options = { ...api.VOLUME_DEFAULTS, ...brush.settings }, shaded = api.shadeVolume(brush.id, volMask, volW, volH, 17, options, [200, 60, 50], 4, 1);
  assert.deepEqual([...shaded], [...api.shadeVolume(brush.id, volMask, volW, volH, 17, options, [200, 60, 50], 4, 1)], brush.id + ' is repeatable');
  assert(shaded.some(value => value > 0) && !shaded.some(Number.isNaN), brush.id + ' draws');
  const volTones = new Set(); for (let index = 0; index < shaded.length; index += 4) if (volMask[index / 4] === 1) volTones.add(Math.round((shaded[index] * .2126 + shaded[index + 1] * .7152 + shaded[index + 2] * .0722) * shaded[index + 3] / 255 / 8)); assert(volTones.size > 1, brush.id + ' has real shading or line work');
  assert(api.BRUSH_PRESETS.some(item => item.id === brush.id), brush.id + ' is in the library');
}
const volLit = light => api.shadeVolume('inflate', volMask, volW, volH, 17, { ...api.VOLUME_DEFAULTS, volumeLight: light, volumeGloss: 0 }, [200, 200, 200], 4, 1);
assert(volLum(volLit(270), 45, 13) > volLum(volLit(270), 45, 37) + 30 && volLum(volLit(90), 45, 37) > volLum(volLit(90), 45, 13) + 30, 'the light angle really moves the highlight');
const volOff = api.shadeVolume('stipple-tube', volMask, volW, volH, 17, { ...api.VOLUME_DEFAULTS, volumePaperOn: false }, [0, 0, 0], 4, 1), volOn = api.shadeVolume('stipple-tube', volMask, volW, volH, 17, { ...api.VOLUME_DEFAULTS, volumePaperOn: true }, [0, 0, 0], 4, 1);
assert(volOff.some((value, index) => index % 4 === 3 && value === 0 && volMask[(index - 3) / 4] === 1) && volOn[(25 * volW + 45) * 4 + 3] === 255, 'ink can print alone or over a fill');
const volA = { points: [], seed: 1, settings: { brushPreset: 'inflate', color: '#111111' } }, volB = { ...volA }, volC = { ...volA, settings: { brushPreset: 'inflate', color: '#ff0000' } }, volD = { ...volC, settings: { ...volC.settings, volumeMerge: false } };
assert.deepEqual(api.groupVolumeStrokes([volA, volB, volC, volD]).map(group => group.length), [2, 1, 1], 'same brush and colour fuse, others stay apart');
const restyleSource = brushDrawing('pen'), restyleEl = { drawing: restyleSource }, brushRestyled = api.restyleDrawing(restyleEl, 'inflate');
assert.equal(brushRestyled.drawing.strokes[0].settings.brushPreset, 'inflate'); assert.deepEqual(brushRestyled.drawing.strokes[0].points, restyleSource.strokes[0].points, 'restyle never moves the line');
assert.equal(brushRestyled.drawing.strokes[0].settings.color, '#d9412f', 'restyle keeps the colour');
const brushRestyledTwice = api.restyleDrawing({ ...restyleEl, ...brushRestyled }, 'chalk'); assert.equal(brushRestyledTwice.drawingRestyle.original[0].brushPreset, 'pen', 'the original survives repeated restyles');
assert.equal(api.restyleDrawing({ ...restyleEl, ...brushRestyled }, 'inflate', 2).drawing.strokes[0].settings.brushSize, brushRestyled.drawing.strokes[0].settings.brushSize * 2, 'stroke size is editable');
assert.deepEqual(api.clearRestyle({ ...restyleEl, ...brushRestyledTwice }).drawing.strokes[0].settings, restyleSource.strokes[0].settings, 'back to original is exact');
assert.equal(api.patchDrawingStrokes({ ...restyleEl, ...brushRestyled }, { volumeLight: 40 }).drawing.strokes[0].settings.volumeLight, 40, 'finished strokes stay editable');
assert.equal(api.supportsVectorDrawing(brushRestyled.drawing), false); assert.equal(api.supportsVectorDrawing(restyleSource), true);
console.log('artwork engine: 3D brushes and restyle ok');

// Artwork Phase 5: any brush on a live path, and saved brushes.
const brushPathShape = { id: 'bp', type: 'shape', content: 'custom-path', x: 50, y: 50, width: 200, height: 100, rotation: 0, borderWidth: 3, shapeStrokeColor: '#c81e1e', shapeGeometry: 'bounds', shapePath: { closed: false, nodes: [{ x: 0, y: 50 }, { x: 50, y: 0 }, { x: 100, y: 50 }], subpaths: [{ closed: true, nodes: [{ x: 10, y: 80 }, { x: 30, y: 80 }, { x: 20, y: 95 }] }] } };
const brushPathPatch = api.pathBrushPatch(brushPathShape, 'inflate'), brushedShape = { ...brushPathShape, ...brushPathPatch }, brushedDrawing = api.pathBrushDrawing(brushedShape);
assert.equal(brushedDrawing.strokes.length, 2, 'every contour gets the brush');
assert(brushedDrawing.strokes.every(stroke => stroke.settings.brushPreset === 'inflate' && stroke.settings.color === '#c81e1e' && stroke.settings.brushSize === brushedShape.borderWidth), 'brush, colour and size come from the object');
assert.deepEqual([brushedDrawing.strokes[0].points[0].x, brushedDrawing.strokes[0].points[0].y], [0, 50], 'the line follows the path');
const brushedMoved = api.pathBrushDrawing({ ...brushedShape, shapePath: { ...brushedShape.shapePath, nodes: [{ x: 20, y: 10 }, { x: 50, y: 0 }, { x: 100, y: 50 }] } });
assert.deepEqual([brushedMoved.strokes[0].points[0].x, brushedMoved.strokes[0].points[0].y], [40, 10], 'editing a point moves the brush');
assert.equal(api.pathBrushDrawing({ ...brushedShape, width: 400 }).strokes[0].points.at(-1).x, 400, 'resizing keeps the line on the path');
assert.equal(api.patchPathBrush(brushedShape, { volumeLight: 10 }).shapeBrush.strokes[0].settings.volumeLight, 10, 'brush values stay editable');
assert.equal(api.pathBrushPatch(brushedShape, 'chalk').shapeBrush.previousWidth, 3, 'the original line width survives brush changes');
assert.deepEqual(api.clearPathBrush({ ...brushedShape, ...api.pathBrushPatch(brushedShape, 'chalk') }), { shapeBrush: undefined, borderWidth: 3 }, 'removing the brush restores the line');
const savedBrush = api.captureBrush({ ...api.DEFAULT_BRUSH_SETTINGS, brushPreset: 'inflate', brushSize: 41, grain: 7, volumeLight: 33, customTextureSource: 'data:large' }, '  Tube  ', 'x');
assert(savedBrush.name === 'Tube' && savedBrush.base === 'inflate' && savedBrush.size === 41 && savedBrush.grain === 7 && savedBrush.settings.volumeLight === 33 && !('customTextureSource' in savedBrush.settings), 'a saved brush keeps every setting');
assert.deepEqual(api.readCustomBrushes(JSON.stringify([savedBrush, { id: 'bad', name: 'x', base: 'nope', size: 1, grain: 0, settings: {} }])), [savedBrush], 'damaged saved brushes are ignored');
assert.deepEqual(api.readCustomBrushes('not json'), [], 'bad storage is safe');
console.log('artwork engine: path brush and my brushes ok');

// Pattern brushes bend round sharp corners and close without a seam.
const cornerSquare = [[20, 20], [180, 20], [180, 180], [20, 180], [20, 20]].flatMap(([x, y], i, row) => i === row.length - 1 ? [{ x, y, p: 1, tilt: 0 }] : Array.from({ length: 40 }, (_, k) => ({ x: x + (row[i + 1][0] - x) * k / 40, y: y + (row[i + 1][1] - y) * k / 40, p: 1, tilt: 0 })));
const ropeDrawing = brushDrawing('rope', { pressure: false, patternJitter: 0, brushSize: 18 }, cornerSquare); ropeDrawing.width = ropeDrawing.height = 200;
const ropePath = /<path d="([^"]+)"/.exec(api.vectorDrawingMarkup(ropeDrawing, 'r'))[1], ropeStrands = ropePath.split('Z').filter(Boolean).map(part => [...part.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]));
assert(ropeStrands.length > 40, 'rope is made of many strands');
const ropeSquareReach = ([x, y]) => Math.max(20 - x, x - 180, 20 - y, y - 180);
assert(ropeStrands.flat().every(point => ropeSquareReach(point) <= 9.01), 'rope strands never poke past the line width at a corner');
const ropeCentres = ropeStrands.map(row => [row.reduce((sum, q) => sum + q[0], 0) / row.length, row.reduce((sum, q) => sum + q[1], 0) / row.length]), ropeGaps = ropeCentres.map(([x, y], i) => Math.hypot(ropeCentres[(i + 1) % ropeCentres.length][0] - x, ropeCentres[(i + 1) % ropeCentres.length][1] - y)), ropeMean = ropeGaps.reduce((sum, value) => sum + value, 0) / ropeGaps.length;
assert(Math.max(...ropeGaps) < ropeMean * 1.7, 'rope closes on a shape without a seam');
const ribbonDrawing = brushDrawing('ribbon', { pressure: false, patternJitter: 0, brushSize: 18 }, cornerSquare); ribbonDrawing.width = ribbonDrawing.height = 200;
const ribbonPaths = [...api.vectorDrawingMarkup(ribbonDrawing, 'r').matchAll(/<path d="([^"]+)"/g)].map(match => match[1]), ribbonPoints = path => [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
assert.equal(ribbonPaths.length, 2, 'ribbon is one unbroken band with front faces over it');
assert.equal(ribbonPaths[0].split('M').length, 2, 'the band has no breaks');
assert(ribbonPaths.flatMap(ribbonPoints).every(point => ropeSquareReach(point) <= 9.01), 'ribbon stays inside the line width at corners');
const ribbonFronts = ribbonPaths[1].split('Z').filter(Boolean).map(ribbonPoints), ribbonCentres = ribbonFronts.map(row => [row.reduce((sum, q) => sum + q[0], 0) / row.length, row.reduce((sum, q) => sum + q[1], 0) / row.length]), ribbonGaps = ribbonCentres.map(([x, y], i) => Math.hypot(ribbonCentres[(i + 1) % ribbonCentres.length][0] - x, ribbonCentres[(i + 1) % ribbonCentres.length][1] - y)), ribbonMean = ribbonGaps.reduce((sum, value) => sum + value, 0) / ribbonGaps.length;
assert(ribbonFronts.length >= 4 && Math.max(...ribbonGaps) < ribbonMean * 1.7, 'ribbon folds stay even and close without a seam');
console.log('artwork engine: pattern brush corners ok');

// Artwork Phase 5: brush dynamics are repeatable, optional and reach every brush family.
const dynLine = Array.from({ length: 60 }, (_, i) => ({ x: i * (i < 30 ? 1 : 8), y: 20, p: .5, tilt: 0 }));
assert.equal(api.applyBrushDynamics(dynLine, { brushSize: 20 }, 1), dynLine, 'no dynamics leaves the stroke untouched');
assert(api.applyBrushDynamics(dynLine, { brushSize: 20, pressureCurve: 100 }, 1)[5].p < .5 && api.applyBrushDynamics(dynLine, { brushSize: 20, pressureCurve: -100 }, 1)[5].p > .5, 'pressure curve bends both ways');
const dynSpeed = api.applyBrushDynamics(dynLine, { brushSize: 20, velocityResponse: 100 }, 1); assert(dynSpeed[58].p < dynSpeed[20].p, 'faster movement thins the line');
const dynVaried = api.applyBrushDynamics(dynLine, { brushSize: 20, sizeJitter: 80 }, 1, 3); assert(new Set(dynVaried.map(point => point.p.toFixed(3))).size > 8, 'size variation changes along the line');
assert.deepEqual(dynVaried, api.applyBrushDynamics(dynLine, { brushSize: 20, sizeJitter: 80 }, 1, 3), 'dynamics are repeatable');
assert(dynVaried.every(point => point.p > 0 && point.p <= 1 && point.x === dynLine[dynVaried.indexOf(point)].x), 'dynamics change width only');
for (const id of ['pen', 'rope', 'marker']) assert.notEqual(api.vectorDrawingMarkup(brushDrawing(id, { sizeJitter: 90, patternJitter: 0 }), 'b'), api.vectorDrawingMarkup(brushDrawing(id, { patternJitter: 0 }), 'b'), id + ' responds to dynamics');
assert.notEqual(api.vectorDrawingMarkup(brushDrawing('chalk', { angleJitter: 120 }), 'b'), api.vectorDrawingMarkup(brushDrawing('chalk'), 'b'), 'angle variation reaches stamped brushes');
assert.notEqual(api.vectorDrawingMarkup(brushDrawing('chalk', { opacityJitter: 70 }), 'b'), api.vectorDrawingMarkup(brushDrawing('chalk'), 'b'), 'opacity variation reaches stamped brushes');
console.log('artwork engine: brush dynamics ok');

// Artwork Phase 6: textile patterns are seeded, editable, finite and keep saved colours.
const proPatterns = api.PATTERN_CATALOG.filter(item => item.pro);
assert(proPatterns.length >= 25 && new Set(api.PATTERN_CATALOG.map(item => item.id)).size === api.PATTERN_CATALOG.length, 'pattern library is complete and unique');
for (const item of proPatterns) {
  const base = { ...api.initialPatternSettings(item.id), type: 'pattern', content: item.id, width: 300, height: 400, patternSeed: 1729 }, tile = api.generatedPatternGeometry(base), text = JSON.stringify(tile);
  assert(tile.motifs[0].primitives.length > 0 && !/NaN|Infinity/.test(text), item.id + ' draws clean geometry');
  assert.equal(text, JSON.stringify(api.generatedPatternGeometry(base)), item.id + ' is repeatable');
  if (item.randomise) assert.notEqual(JSON.stringify(api.generatedPatternGeometry({ ...base, patternSeed: 77 }).motifs), JSON.stringify(tile.motifs), item.id + ' Randomise really changes it');
  assert(item.options.length >= 3 && item.colors.length === api.patternDefaultColors(item.id).length, item.id + ' is fully customisable');
  const changed = item.options.filter(option => { const value = option.value === option.max ? option.min : option.max; return JSON.stringify(api.generatedPatternGeometry({ ...base, patternOptions: { [option.key]: value } }).motifs) !== JSON.stringify(tile.motifs); });
  assert.equal(changed.length, item.options.length, item.id + ' every control changes the pattern');
  for (const count of [1, 32]) assert(!/NaN|Infinity/.test(JSON.stringify(api.generatedPatternGeometry({ ...base, patternCount: count, patternScale: count === 1 ? 400 : 10 }))), item.id + ' survives extreme sizes');
  const recoloured = api.generatedPatternGeometry({ ...base, patternColors: item.colors.map(() => '#123456') });
  assert(recoloured.colors.every(colour => colour === '#123456'), item.id + ' recolours');
  assert.equal(JSON.stringify(recoloured.motifs), JSON.stringify(tile.motifs), item.id + ' recolouring keeps the drawing');
}
assert.equal(api.fashionPatternPalette({ color: '#ff0000' }, 'cracked')[0], '#ff0000', 'saved one-colour patterns keep their ink');
for (const id of ['graffiti', 'tribal', 'camo']) { const old = api.PATTERN_CATALOG.find(item => item.id === id); assert(old?.retired, id + ' left the gallery'); assert(api.generatedPatternGeometry({ ...api.initialPatternSettings(id), type: 'pattern', content: id, width: 200, height: 200, patternSeed: 3 }).motifs.length > 0, id + ' still renders in saved designs'); }
assert.equal(api.generatedPatternGeometry({ ...api.initialPatternSettings('noise'), type: 'pattern', content: 'noise', width: 200, height: 200 }).background, undefined, 'ink textures let the garment show through');
console.log('artwork engine: textile patterns ok');

// Artwork Phase 6: word repeats, tartan builder, fit to panel and the pattern maker.
const wordBase = { ...api.initialPatternSettings('word-repeat'), type: 'pattern', content: 'word-repeat', width: 300, height: 300, patternReferenceSize: 300 };
const wordTile = api.generatedPatternGeometry(wordBase), myWord = { text: 'CERIGA', font: 'Test', d: 'M0 0H500V100H0Z', width: 500, height: 100 }, wordCustom = api.generatedPatternGeometry({ ...wordBase, patternWord: myWord });
assert(wordTile.motifs[0].primitives.length >= 2 && wordCustom.tileWidth > wordTile.tileWidth, 'the repeat follows the word');
assert(wordCustom.motifs[0].primitives.every(item => item.d === myWord.d), 'the typed word is what repeats');
assert(wordTile.motifs[0].primitives.some(item => item.fill === 'none') && wordTile.motifs[0].primitives.some(item => item.fill === 0), 'solid and outline rows alternate');
assert.equal(api.patternAppearance({ patternWord: { ...myWord, d: '<script>' } }).patternWord, undefined, 'unsafe word paths are refused');
assert.deepEqual(api.patternAppearance({ patternWord: myWord }).patternWord, myWord, 'a word travels with the pattern');
assert.equal(api.expandSett({ mirror: true, stripes: [{ color: 0, width: 1 }, { color: 1, width: 2 }, { color: 2, width: 3 }] }).map(item => item.color).join(''), '0121', 'a mirrored sett pivots on its ends');
assert.equal(api.expandSett({ mirror: false, stripes: [{ color: 0, width: 1 }, { color: 1, width: 2 }, { color: 2, width: 3 }] }).length, 3, 'an open sett stays as drawn');
const tartanBase = { ...api.initialPatternSettings('tartan-builder'), type: 'pattern', content: 'tartan-builder', width: 300, height: 300 };
for (const preset of api.SETT_PRESETS) assert(api.generatedPatternGeometry({ ...tartanBase, patternSett: preset.sett, patternColors: preset.colors }).motifs[0].primitives.length >= 2, preset.id + ' builds');
const tartanA = JSON.stringify(api.generatedPatternGeometry(tartanBase).motifs), tartanSettB = { ...api.DEFAULT_SETT, stripes: api.DEFAULT_SETT.stripes.map((item, i) => i ? item : { ...item, width: 40 }) };
assert.notEqual(tartanA, JSON.stringify(api.generatedPatternGeometry({ ...tartanBase, patternSett: tartanSettB }).motifs), 'changing a stripe changes the cloth');
assert.notEqual(tartanA, JSON.stringify(api.generatedPatternGeometry({ ...tartanBase, patternSett: { ...api.DEFAULT_SETT, twill: false } }).motifs), 'weave can be switched');
const fitTile = { width: 37, height: 53 }, fitEl = { width: 300, height: 200, patternFit: { mode: 'panel' } }, fitScale = api.physicalRepeatScale(fitEl, fitTile), fitCounts = api.fittedRepeatCounts(fitEl, fitTile);
assert(Math.abs(fitScale.x * fitTile.width * fitCounts.across - 300) < 1e-6 && Math.abs(fitScale.y * fitTile.height * fitCounts.down - 200) < 1e-6, 'fit panel lands on whole repeats both ways');
const fitWide = api.physicalRepeatScale({ width: 300, height: 200, patternFit: { mode: 'width', across: 5 } }, fitTile); assert(Math.abs(fitWide.x * 37 * 5 - 300) < 1e-6 && fitWide.x === fitWide.y, 'fit width keeps proportions');
assert.deepEqual(api.physicalRepeatScale({ width: 300, height: 200 }, fitTile), { x: 1, y: 1 }, 'free placement is unchanged');
const motifA = 'data:image/png;base64,AA==', motifB = 'data:image/png;base64,BB==', makerBase = { ...api.initialPatternSettings('custom'), type: 'pattern', content: 'custom', width: 300, height: 300, patternReferenceSize: 300, patternCount: 4, patternSeed: 5, patternSource: motifA, patternSourceWidth: 200, patternSourceHeight: 100 };
const makerMotifs = patch => api.generatedPatternGeometry({ ...makerBase, ...patch }).motifs;
for (const layout of ['grid', 'brick', 'half-drop', 'diamond', 'mirror', 'toss', 'pinwheel', 'spaced', 'random']) assert(makerMotifs({ patternRepeat: layout }).length > 0 && !/NaN|Infinity/.test(JSON.stringify(makerMotifs({ patternRepeat: layout }))), layout + ' lays out');
assert(makerMotifs({ patternRepeat: 'diamond' }).length < makerMotifs({ patternRepeat: 'grid' }).length, 'diamond skips alternate cells');
assert.equal(new Set(makerMotifs({ patternRepeat: 'pinwheel' }).map(item => item.rotation)).size, 4, 'pinwheel turns through four directions');
assert.equal(new Set(makerMotifs({ patternRepeat: 'toss' }).map(item => item.rotation)).size, 2, 'toss alternates');
assert.equal(new Set(makerMotifs({ patternExtraSources: [{ src: motifB, name: 'b', width: 100, height: 100 }] }).map(item => item.primitives[0].href)).size, 2, 'several motifs take turns');
assert(Math.abs(makerMotifs({ patternMotifScale: 50 })[0].scaleX * 2 - makerMotifs({})[0].scaleX) < 1e-6, 'motif size is editable');
assert.equal(makerMotifs({ patternMotifRotation: 30 })[0].rotation, 30, 'motif turn is editable');
const groundTile = api.generatedPatternGeometry({ ...makerBase, patternGround: '#112233' }); assert.equal(groundTile.colors[groundTile.background], '#112233', 'a custom repeat can have a background');
assert.equal(api.generatedPatternGeometry(makerBase).background, undefined, 'custom repeats stay transparent by default');
console.log('artwork engine: pattern builders and maker ok');
