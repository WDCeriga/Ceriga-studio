import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import clipping, { type MultiPolygon } from 'polygon-clipping';
import { essentialBackParts } from '../../src/app/data/importedGarmentBackEssentials';
import { createCroppedTankFixture, createGarmentRegressionFixture } from '../../src/app/data/garmentRegressionFixtures';
import { normalizeImportedGarment, type ImportedGarment, type ImportedPart, type ImportedPoint } from '../../src/app/data/importedGarment';
import { createPanelledHoodieFixture } from '../../src/app/data/panelledHoodieRegressionFixture';
import captured from './test_imported_garment_back_trace_fixtures.json';

// Run with Vite SSR, e.g. ssrLoadModule('/scripts/collar/test_imported_garment_back_essentials.ts').
let checks = 0;
const check = (condition: unknown, message: string) => { checks++; assert.ok(condition, message); };
const area = (p: ImportedPoint[]) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2);
const geometryArea = (g: MultiPolygon) => g.reduce((s, p) => s + p.reduce((a, r, i) => a + area(r) * (i ? -1 : 1), 0), 0);
const poly = (part: ImportedPart): MultiPolygon => [[part.outline!]];
const count = (parts: ImportedPart[], role: string) => parts.filter(p => p.structuralRole === role).length;
function fixture(name: keyof typeof captured): ImportedGarment {
  const source = structuredClone(captured[name]), base = createGarmentRegressionFixture(name);
  return { ...base, parts: source.parts.map(p => ({ ...base.parts[0], ...p, view: 'front',
    constructionSvg: '<svg data-front-ink="do-not-copy"/>', stitchSvg: '<svg data-front-stitches="do-not-copy"/>',
  })) as ImportedPart[], manifest: { ...base.manifest, garmentType: source.garmentType, subtype: source.subtype } };
}
function verify(front: ImportedGarment, label: string) {
  const before = JSON.stringify(front), parts = essentialBackParts(front);
  check(parts && parts.length >= 3, `${label}: structured estimate missing`);
  assert.equal(JSON.stringify(front), before, `${label}: mutated front`);
  assert.deepEqual(essentialBackParts(front), parts, `${label}: nondeterministic`);
  const ids = new Set(parts!.map(p => p.id));
  check(ids.size === parts!.length, `${label}: duplicate ids`);
  for (const group of ['colourGroup', 'fabricGroup'] as const) {
    check(parts!.every(p => !!p[group]) && new Set(parts!.map(p => p[group])).size === parts!.length, `${label}: ${group} must be unique per essential part`);
  }
  for (const p of parts!) {
    check(p.view === 'back' && p.id.startsWith('estimated-back-'), `${label}: wrong view/id`);
    check(!['pocket', 'zip', 'placket', 'yoke', 'lining', 'decoration', 'label', 'fly', 'flap'].includes(p.semanticType) || p.semanticType === 'flap' && p.structuralRole === 'cuff-tab', `${label}: front detail leaked`);
    check(p.builderCategory && p.colorable && p.editableIndependently && p.evidence.includes('ESTIMATED'), `${label}: essential metadata missing`);
    check(p.boundary?.confidence === .35 && p.inferenceLevel === 'essential', `${label}: essential inference contract requires confidence .35 and inferenceLevel essential`);
    const sourceId = (p as ImportedPart & { estimatedFromPartId: string }).estimatedFromPartId;
    const source = front.parts.find(f => f.view === 'front' && f.id === sourceId);
    check(source, `${label}: missing inheritance source`);
    const sameRole = front.parts.filter(f => f.view === 'front' && f.structuralRole === p.structuralRole);
    check(!sameRole.length || sameRole.some(f => f.id === sourceId), `${label}: inheritance ignored a matching front role`);
    check(p.color === source!.color && p.material === source!.material, `${label}: initial source colour/material defaults differ`);
    if (sameRole.length >= 2 && /-(left|right)-/.test(p.id)) {
      const middle = (f: ImportedPart) => { const xs = f.outline!.map(v => v[0]); return (Math.min(...xs) + Math.max(...xs)) / 2; };
      const expected = [...sameRole].sort((a, b) => p.id.includes('-left-') ? middle(a) - middle(b) : middle(b) - middle(a))[0];
      check(sourceId === expected.id, `${label}: inheritance references opposite-side front part`);
    }
    check(p.outline!.length >= 3 && p.outline!.every(point => point.every(v => Number.isFinite(v) && v >= 0 && v <= 1)), `${label}: invalid coordinates`);
    check(p.area > 1e-6 && Math.abs(p.area - area(p.outline!)) < 1e-10, `${label}: incorrect area`);
    check(p.seed.every(Number.isFinite), `${label}: seed is not finite`);
    const [sx, sy] = p.seed, delta = 1e-8;
    const seedBox: MultiPolygon = [[[[sx - delta, sy - delta], [sx + delta, sy - delta], [sx + delta, sy + delta], [sx - delta, sy + delta]]]];
    check(clipping.intersection(poly(p), seedBox).length > 0, `${label}: seed outside part`);
    const xs = p.outline!.map(v => v[0]), ys = p.outline!.map(v => v[1]);
    assert.deepEqual(p.bounds, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], `${label}: incorrect bounds`);
    assert.deepEqual(p.bounds, p.geometryBounds);
    check(p.svg.includes('viewBox="0 0 2048 2048"') && p.svg.includes('fill="#000000"') && p.svg.includes('Z"'), `${label}: missing closed shared-space fill`);
    check(p.constructionSvg.includes('fill="none"') && p.constructionSvg.includes('stroke=') && !/do-not-copy|data-front|<image|<use/.test(p.constructionSvg), `${label}: front SVG leaked`);
    const coords = p.svg.match(/d="([^"]+)"/)![1].match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    check(coords.every((v, i) => Math.abs(v / 2048 - p.outline![Math.floor(i / 2)][i % 2]) < 1e-9), `${label}: SVG/outline coordinates differ`);
    check(!p.attachmentTo || ids.has(p.attachmentTo), `${label}: dangling attachment`);
    if (p.semanticType === 'hem' && p.id !== 'estimated-back-waistband') {
      const owner = parts!.find(q => q.id === p.attachmentTo)!;
      check(owner && p.area < (owner.area + p.area) * .2, `${label}: hem must be a thin attached anatomical band`);
      check(p.builderCategory === 'hem-cuffs', `${label}: hem has wrong builder category`);
      if (!front.parts.some(q => q.semanticType === 'hem')) {
        check(sourceId === (owner as ImportedPart & { estimatedFromPartId: string }).estimatedFromPartId, `${label}: inferred hem must inherit its sleeve/body/leg defaults`);
      }
    }
    check(!p.symmetryPartner || ids.has(p.symmetryPartner), `${label}: dangling symmetry`);
    check(Math.abs(geometryArea(clipping.union(poly(p))) - p.area) < 1e-9, `${label}: self intersecting geometry`);
  }
  for (let i = 0; i < parts!.length; i++) for (let j = i + 1; j < parts!.length; j++) {
    check(geometryArea(clipping.intersection(poly(parts![i]), poly(parts![j]))) < 1e-10, `${label}: overlapping ${parts![i].id}/${parts![j].id}`);
  }
  console.log(`${label}: ${parts!.length} independently bounded essentials OK`);
  return parts!;
}
function hoodieChecks(front: ImportedGarment, parts: ImportedPart[]) {
  check(parts.length === 7, 'hoodie needs exactly seven essentials');
  for (const [role, expected] of [['body', 1], ['hood', 1], ['hem', 1], ['sleeve', 2], ['cuff', 2]] as const) check(count(parts, role) === expected, `hoodie ${role} count`);
  const body = parts.find(p => p.structuralRole === 'body')!, hood = parts.find(p => p.structuralRole === 'hood')!;
  check(hood.bounds[0] > .32 && hood.bounds[2] < .68 && hood.bounds[1] < .04 && hood.bounds[3] > .28 && hood.bounds[3] < .32, 'hood exterior proportions');
  check(body.bounds[1] < .31 && body.bounds[3] > .76 && body.bounds[2] - body.bounds[0] > .45, 'body loses upper chest or volume');
  for (const sleeve of parts.filter(p => p.structuralRole === 'sleeve')) {
    check(sleeve.bounds[1] < .37 && sleeve.bounds[3] > .89, 'sleeve must include shoulder and inset volumes');
    check(sleeve.area > .065, 'sleeve lost volume to inset source cells');
    const source = front.parts.find(p => p.id === (sleeve as ImportedPart & { estimatedFromPartId: string }).estimatedFromPartId)!;
    check(source.semanticType === 'sleeve', 'sleeve inherits from wrong front region');
    check((source.bounds[0] < .5) === (sleeve.bounds[0] < .5), 'sleeve inherits opposite side');
  }
  const ink = front.parts.find(p => p.structuralRole === 'source-ink')!;
  const union = clipping.union(...parts.map(poly) as [MultiPolygon, ...MultiPolygon[]]);
  check(geometryArea(clipping.xor(union, poly(ink))) < .0005, 'hoodie partition must conserve exterior, not inset-cell union');
  const crown: MultiPolygon = [[[[.485, .09], [.515, .09], [.515, .20], [.485, .20]]]];
  check(geometryArea(clipping.intersection(poly(hood), crown)) > .0032, 'rear hood still has a front lining opening');
}

const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Geometry must not make network requests.'); };
try {
  for (const name of ['hoodie', 'tee', 'jacket'] as const) {
    const front = fixture(name), parts = verify(front, `captured ${name}`);
    if (name === 'hoodie') hoodieChecks(front, parts);
    else {
      check(count(parts, 'body') === 1 && count(parts, 'sleeve') === 2, `${name}: essentials absent`);
      if (name === 'tee') {
        check(count(parts, 'neckband') === 1 && count(parts, 'hem') === 3 && parts.length === 7, 'tee needs body, sleeves, rear neckband, sleeve hems and bottom hem');
        check(parts.find(p => p.structuralRole === 'neckband')!.bounds[3] < .08, 'tee rear neck is not shallow');
      } else {
        const torsoSide: MultiPolygon = [[[[.27, .76], [.30, .76], [.30, .80], [.27, .80]]]];
        check(Math.abs(geometryArea(clipping.intersection(poly(parts.find(p => p.structuralRole === 'body')!), torsoSide)) - .0012) < 1e-9, 'inset jacket hem must not turn lower torso into a sleeve');
      }
    }
    const reversed = { ...front, parts: front.parts.map(p => ({ ...p, outline: [...p.outline!].reverse() })) };
    const reverseParts = verify(reversed, `reversed ${name}`);
    check(reverseParts.length === parts.length, `${name}: winding changed partition count`);
    for (const p of parts) check(geometryArea(clipping.xor(poly(p), poly(reverseParts.find(q => q.id === p.id)!))) < 1e-9, `${name}: winding changed geometry`);
  }
  for (const family of ['tee', 'hoodie', 'jacket', 'trousers', 'shorts', 'jeans'] as const) {
    const parts = verify(createGarmentRegressionFixture(family), `synthetic ${family}`);
    if (['trousers', 'shorts', 'jeans'].includes(family)) {
      check(count(parts, 'leg') === 2 && count(parts, 'waistband') === 1 && count(parts, 'hem') === 2 && parts.length === 5, `${family}: incorrect lower essentials`);
      const seam = parts.find(p => p.id === 'estimated-back-left-leg')!.constructionSvg.match(/data-estimated-seam="centre-rise" d="M([\d.]+),([\d.]+)L([\d.]+),([\d.]+)"/);
      check(seam, `${family}: rear centre seam missing`);
      assert.deepEqual(seam!.slice(1).map(v => Number(v) / 2048), [.5, .2, .5, .43], `${family}: centre seam must run from waistband to crotch only`);
      const front = createGarmentRegressionFixture(family);
      const expected = clipping.union(...front.parts.map(poly) as [MultiPolygon, ...MultiPolygon[]]);
      const actual = clipping.union(...parts.map(poly) as [MultiPolygon, ...MultiPolygon[]]);
      check(geometryArea(clipping.xor(expected, actual)) < 1e-9, `${family}: hem splitting changed the exterior`);
    }
    if (family === 'tee') {
      check(parts.length === 7 && count(parts, 'hem') === 3, 'legacy tee needs three essential hem bands');
      const sleeveHem = parts.find(p => p.id === 'estimated-back-left-sleeve-hem')!;
      check(sleeveHem.bounds[3] - sleeveHem.bounds[1] > .15, 'slanted sleeve hem must span the opening, not just the bottom tip');
    }
  }
  const panelled = createPanelledHoodieFixture(), panelledBack = verify(panelled, 'legacy panelled hoodie');
  check(panelledBack.length === 7 && count(panelledBack, 'hood') === 1 && count(panelledBack, 'body') === 1, 'panelled hoodie needs seven essentials');
  const panelledExterior = clipping.union(...panelled.parts.filter(p => !['zip', 'pocket'].includes(p.semanticType)).map(poly) as [MultiPolygon, ...MultiPolygon[]]);
  const estimatedExterior = clipping.union(...panelledBack.map(poly) as [MultiPolygon, ...MultiPolygon[]]);
  check(geometryArea(clipping.difference(panelledExterior, estimatedExterior)) < 1e-8, 'panelled hoodie lost observed fabric volume');
  const panelledHood = panelledBack.find(p => p.semanticType === 'hood')!;
  check(panelledHood.bounds[1] === .025 && panelledHood.bounds[0] === .378 && panelledHood.bounds[2] === .619, 'rear hood lost its crown/side exterior');
  const hoodCentre: MultiPolygon = [[[[.48, .16], [.52, .16], [.52, .20], [.48, .20]]]];
  check(Math.abs(geometryArea(clipping.intersection(poly(panelledHood), hoodCentre)) - .0016) < 1e-10, 'rear hood still has a front face opening');
  check(panelledBack.find(p => p.id === 'estimated-back-waistband')!.estimatedFromPartId!.includes('front'), 'torso waistband inherited an unrelated sleeve hem');
  for (const side of ['left', 'right']) {
    check(panelledBack.find(p => p.id === `estimated-back-${side}-cuff`)!.estimatedFromPartId === `${side}-sleeve-hem`, 'cuff ignored corresponding observed sleeve finish');
  }
  const noCentreClosure = { ...panelled, parts: panelled.parts.filter(p => p.id !== 'front-zipper') };
  assert.throws(() => essentialBackParts(noCentreClosure), /body panels/, 'hood/pocket zips must not bridge unobserved torso gaps');
  for (const family of ['tee', 'hoodie', 'jacket'] as const) {
    const front = createGarmentRegressionFixture(family), body = front.parts.find(p => p.semanticType === 'body')!;
    const panels = [[0, 0, .495, .5], [.505, 0, 1, .5], [0, .5, .495, 1], [.505, .5, 1, 1]].map(([l, t, r, b], i) => ({
      ...body, id: `torso-section-${i}`, semanticType: i < 2 ? 'panel' as const : 'body' as const,
      structuralRole: i < 2 ? 'upper body panel' : 'lower body panel', attachmentTo: null, symmetryPartner: null,
      outline: clipping.intersection(poly(body), [[[[l, t], [r, t], [r, b], [l, b]]]])[0][0].slice(0, -1),
    }));
    const other = front.parts.filter(p => p !== body).map(p => ({ ...p, attachmentTo: p.attachmentTo === body.id ? panels[p.side === 'right' ? 1 : 0].id : p.attachmentTo }));
    const closure = { ...body, id: 'observed-closure', semanticType: 'zip' as const, structuralRole: 'front closure hardware', layerKind: 'detail' as const, attachmentTo: panels[2].id,
      outline: [[.493, .15], [.507, .15], [.507, .85], [.493, .85]] as ImportedPoint[] };
    const segmented = normalizeImportedGarment({ ...front, parts: [...panels, ...other, closure] });
    const parts = verify(segmented, `closure assembled ${family}`);
    check(count(parts, 'body') === 1 && parts.length === 7, `${family}: body assembly failed`);
    const originalFabric = clipping.union(...front.parts.filter(p => !['zip', 'pocket', 'label', 'decoration'].includes(p.semanticType)).map(poly) as [MultiPolygon, ...MultiPolygon[]]);
    const reconstructed = clipping.union(...parts.map(poly) as [MultiPolygon, ...MultiPolygon[]]);
    check(geometryArea(clipping.difference(originalFabric, reconstructed)) < 1e-9, `${family}: anatomical joins discarded front fabric volume`);
    const bottom = parts.find(p => p.id === 'estimated-back-bottom-hem' || p.id === 'estimated-back-waistband')!;
    check(bottom.bounds[3] <= Math.max(body.bounds[3], ...other.filter(p => p.semanticType === 'hem').map(p => p.bounds[3])) + 1e-9, `${family}: closure extended torso bottom`);
    for (const changed of [
      undefined,
      { ...closure, attachmentTo: 'pocket' },
      { ...closure, transform: { x: 0, y: 0, scale: 1, rotation: 20 } },
      { ...closure, outline: [[.496, .15], [.504, .15], [.504, .85], [.496, .85]] as ImportedPoint[] },
      { ...closure, outline: [[.4, .15], [.6, .15], [.6, .85], [.4, .85]] as ImportedPoint[] },
      { ...closure, outline: [[.493, .4], [.507, .4], [.507, .45], [.493, .45]] as ImportedPoint[] },
      { ...closure, outline: [[.493, .15], [.507, .85], [.493, .85], [.507, .3]] as ImportedPoint[] },
    ]) {
      assert.throws(() => essentialBackParts({ ...segmented, parts: [...panels, ...other, ...(changed ? [changed] : [])] }), /body panels/, `${family}: invalid closure bridged gap`);
    }
    const contiguous = normalizeImportedGarment({ ...front, parts: [...other, ...[0, 1].map(i => ({ ...body, id: `joined-${i}`, outline: clipping.intersection(poly(body), [[[[i * .5, 0], [(i + 1) * .5, 0], [(i + 1) * .5, 1], [i * .5, 1]]]])[0][0].slice(0, -1) }))] });
    check(verify(contiguous, `contiguous ${family}`).length === 7, 'touching torso panels require no closure');
  }
  for (const family of ['trousers', 'shorts', 'jeans'] as const) {
    const front = createGarmentRegressionFixture(family), waist = front.parts.find(p => p.semanticType === 'waistband')!;
    waist.outline = [[.25, .1], [.5, .11], [.75, .1], [.76, .12], [.5, .14], [.24, .12]];
    const parts = verify(front, `detached dipped waistband ${family}`);
    assert.deepEqual(parts.find(p => p.semanticType === 'waistband')!.outline, waist.outline, 'detached waistband outline changed');
    const expected = clipping.union(...front.parts.map(poly) as [MultiPolygon, ...MultiPolygon[]]);
    const actual = clipping.union(...parts.map(poly) as [MultiPolygon, ...MultiPolygon[]]);
    check(geometryArea(clipping.xor(expected, actual)) < 1e-9, 'detached waistband fabricated a bridge or lost leg volume');
  }
  const scaled = fixture('hoodie');
  scaled.parts = scaled.parts.map(p => ({ ...p, outline: p.outline!.map(([x, y]) => [.12 + x * .7, .08 + y * .7]) }));
  const original = essentialBackParts(fixture('hoodie'))!, scaledParts = verify(scaled, 'scaled translated hoodie');
  for (const p of original) {
    const expected: MultiPolygon = [[p.outline!.map(([x, y]) => [.12 + x * .7, .08 + y * .7])]];
    check(geometryArea(clipping.xor(expected, poly(scaledParts.find(q => q.id === p.id)!))) < 1e-9, 'estimate uses stale bounds or fixed template coordinates');
  }
  for (const name of ['hoodie', 'tee', 'jacket'] as const) {
    const exteriorOnly = fixture(name); exteriorOnly.parts = exteriorOnly.parts.filter(p => p.structuralRole === 'source-ink');
    const parts = verify(exteriorOnly, `exterior-only ${name}`);
    check(parts.length === 7 && count(parts, 'body') === 1 && count(parts, 'sleeve') === 2, `${name}: source-only essential anatomy missing`);
    check(count(parts, name === 'tee' ? 'neckband' : 'hood') === 1, `${name}: source-only neck/hood missing`);
    check(name === 'tee' ? count(parts, 'hem') === 3 : count(parts, 'cuff') === 2 && count(parts, 'hem') === 1, `${name}: source-only essential finishes missing`);
    check(parts.every(p => p.estimatedFromPartId === exteriorOnly.parts[0].id), `${name}: exterior-only inheritance must resolve to source ink`);
    if (name === 'tee') {
      const ink = exteriorOnly.parts[0], ys = ink.outline!.map(p => p[1]), top = Math.min(...ys), bottom = Math.max(...ys);
      const belowNeck: MultiPolygon = [[[[0, top + (bottom - top) * .15], [1, top + (bottom - top) * .15], [1, 1], [0, 1]]]];
      const original = clipping.intersection(poly(ink), belowNeck);
      const rear = clipping.union(...parts.map(poly) as [MultiPolygon, ...MultiPolygon[]]);
      check(geometryArea(clipping.difference(original, rear)) < 1e-9, 'exterior-only tee lost lower torso strips into disconnected sleeves');
      for (const outline of [
        [[.2, .1], [.8, .1], [.8, .9], [.2, .9]],
        [[.35, .1], [.65, .1], [.9, .9], [.1, .9]],
      ] as ImportedPoint[][]) {
        check(essentialBackParts({ ...exteriorOnly, parts: [{ ...ink, outline }] }) === undefined, 'unknown straight/flared exterior fabricated tee anatomy without sleeve evidence');
      }
      for (const garmentType of ['skirt', 'dress', 'unclassified upload']) {
        check(essentialBackParts({ ...exteriorOnly, manifest: { ...exteriorOnly.manifest, garmentType } }) === undefined, 'exterior recognition overrode unsupported garment family');
      }
    }
  }
  const sweatshirt = createGarmentRegressionFixture('jacket');
  sweatshirt.manifest.garmentType = 'sweatshirt'; sweatshirt.manifest.subtype = 'crew sweatshirt';
  verify(sweatshirt, 'synthetic sweatshirt');
  for (const unsupported of [createCroppedTankFixture(), createGarmentRegressionFixture('skirt'), createGarmentRegressionFixture('dress')]) assert.equal(essentialBackParts(unsupported), undefined);
  const bad = fixture('hoodie'); bad.parts[0].outline![0] = [NaN, .1];
  assert.throws(() => essentialBackParts(bad), /finite normalized exterior/);
  const transformed = fixture('hoodie'); transformed.parts[0].transform = { x: 1, y: 0, scale: 1, rotation: 0 };
  assert.throws(() => essentialBackParts(transformed), /bake the front transform/);
  for (const name of ['hoodie', 'tee', 'jacket'] as const) {
    const ambiguous = fixture(name), ink = ambiguous.parts.find(p => p.structuralRole === 'source-ink')!;
    ambiguous.parts.push({ ...structuredClone(ink), id: 'second-ink' });
    const before = JSON.stringify(ambiguous);
    assert.throws(() => essentialBackParts(ambiguous), /multiple source-ink exteriors are ambiguous/, `${name}: duplicate authoritative ink accepted`);
    check(JSON.stringify(ambiguous) === before, `${name}: rejecting ambiguous ink mutated the front`);
    ambiguous.parts.reverse();
    assert.throws(() => essentialBackParts(ambiguous), /multiple source-ink exteriors are ambiguous/, `${name}: ambiguous ink depends on source ordering`);
  }
  const missing = fixture('hoodie'); missing.parts = [];
  assert.throws(() => essentialBackParts(missing), /front geometry is missing/);
  // Optional full provider capture; the compact committed capture above always runs.
  const fullPath = process.env.ESSENTIAL_BACK_HOODIE_FIXTURE;
  if (fullPath) {
    assert.ok(existsSync(fullPath), 'ESSENTIAL_BACK_HOODIE_FIXTURE does not exist');
    const full = JSON.parse(readFileSync(fullPath, 'utf8')) as ImportedGarment;
    hoodieChecks(full, verify(full, 'full source hoodie'));
  }
  console.log(`Essential back geometry: ${checks} checks passed.`);
} finally { globalThis.fetch = originalFetch; }
