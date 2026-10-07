import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { editEstimatedBackOutline, generateEstimatedBack } from '../../src/app/data/importedGarmentBack';
import { canAcceptImportedConstruction, mergeImportedGarmentView, normalizeImportedGarment, type ImportedGarment, type ImportedPart, type ImportedPoint } from '../../src/app/data/importedGarment';
import { createGarmentRegressionFixture } from '../../src/app/data/garmentRegressionFixtures';
import captured from './test_imported_garment_back_trace_fixtures.json';

let checks = 0;
function check(condition: unknown, message: string): asserts condition { checks++; assert.ok(condition, message); }
const emptySvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"/>';
const area = (points: ImportedPoint[]) => Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
const bounds = (points: ImportedPoint[]) => [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
const estimate = (front: ImportedGarment) => { const result = generateEstimatedBack(front); check(result.available, result.available ? '' : result.reason); return result.garment; };

// Exact exterior and semantic outlines captured from the three supplied session
// artifacts; large raster previews/ink SVG payloads are omitted from this fixture.
function fixture(name: keyof typeof captured): ImportedGarment {
  const source = captured[name];
  const base = createGarmentRegressionFixture(name);
  const template = base.parts[0];
  const parts = source.parts.map(item => ({ ...template, ...item, view: 'front',
    svg: emptySvg, constructionSvg: item.structuralRole === 'source-ink' ? '<svg><path d="M0,0L10,0Z" data-immutable="source-ink"/></svg>' : emptySvg,
    stitchSvg: emptySvg, layerKind: 'structural', structural: true,
    boundary: { boundaryType: 'panel-edge', confidence: 1, evidence: 'Captured source-supported boundary.' },
    attachmentTo: null, symmetryPartner: null,
  })) as ImportedPart[];
  return normalizeImportedGarment({ ...base, parts, detailLayers: [], constructionRegions: undefined,
    processingMode: source.processingMode as 'photo' | 'trace-only', manifest: { ...base.manifest, garmentType: source.garmentType, subtype: source.subtype },
  });
}

function verify(front: ImportedGarment, name: string, expectedNeck: 'hood' | 'neck') {
  const before = JSON.stringify(front), ink = front.parts.find(part => part.structuralRole === 'source-ink')!;
  const result = estimate(front), rear = result.parts.filter(part => part.view === 'back');
  check(JSON.stringify(front) === before, `${name}: input was mutated`);
  assert.deepEqual(result.parts.filter(part => part.view === 'front'), front.parts);
  assert.deepEqual(result.sourceManifest, front.sourceManifest);
  assert.deepEqual(result.manifest.frontView, front.manifest.frontView);
  assert.deepEqual(result.constructionRegions, front.constructionRegions);
  check(rear.length >= 7, `${name}: essential rear regions are missing`);
  const back = rear.find(part => part.semanticType === 'body')!;
  check(Boolean(back), `${name}: main back body missing`);
  check(rear.filter(part => part.semanticType === 'sleeve').length === 2, `${name}: sleeves not separated`);
  check(rear.filter(part => part.semanticType === 'cuff' || (part.semanticType === 'hem' && /sleeve/i.test(part.name))).length === 2, `${name}: cuffs/sleeve hems not separated`);
  check(rear.some(part => ['hem', 'waistband'].includes(part.semanticType)), `${name}: bottom hem missing`);
  check(rear.some(part => expectedNeck === 'hood' ? part.semanticType === 'hood' : ['neckband', 'collar'].includes(part.semanticType)), `${name}: neck/hood missing`);
  check(rear.every(part => !['pocket', 'zip', 'button', 'label', 'decoration'].includes(part.semanticType)), `${name}: unknown detail invented`);
  check(rear.every(part => part.outline!.length >= 3 && area(part.outline!) > 0 && part.colorable), `${name}: invalid editable region`);
  check(new Set(rear.map(part => part.colourGroup)).size === rear.length && new Set(rear.map(part => part.fabricGroup)).size === rear.length, `${name}: rear controls are linked`);
  check(rear.every(part => part.estimatedFromPartId && front.parts.some(source => source.id === part.estimatedFromPartId)), `${name}: front appearance references missing`);
  check(rear.every(part => !part.constructionSvg.includes('data-immutable') && part.constructionSvg !== ink.constructionSvg), `${name}: original front ink copied to rear`);
  check(rear.every(part => part.boundary!.confidence === .35 && part.inferenceLevel === 'essential'), `${name}: estimate claims source evidence`);
  check(result.manifest.backView?.inference?.notice.includes('ESTIMATED BACK'), `${name}: estimate not clearly marked`);
  check(result.manifest.backView?.inference?.method === 'structured-front-v3', `${name}: wrong inference method`);
  const semantic = result.manifest.backView?.constructionRegions;
  check(semantic?.regions.length === rear.length && semantic.status === 'needs-review' && Boolean(semantic.constructionInk), `${name}: semantic review data missing`);
  check(!result.manifest.backView?.sourceImage && !result.manifest.backView?.provenance && !result.sourceImages?.back, `${name}: fabricated rear image provenance`);
  check(!result.detailLayers?.some(detail => detail.view === 'back'), `${name}: front details leaked to rear`);
  check(canAcceptImportedConstruction(result), `${name}: estimate cannot be reviewed`);
  check(!result.accepted && !result.reviewed, `${name}: estimate accepted automatically`);
  check(!generateEstimatedBack(result).available, `${name}: an existing back was overwritten`);
  const frontBounds = bounds(ink.outline!);
  const rearBounds = bounds(rear.flatMap(part => part.outline!));
  check(rearBounds.every((value, index) => Math.abs(value - frontBounds[index]) < .04), `${name}: rear lost front proportions`);
  const reloaded = normalizeImportedGarment(JSON.parse(JSON.stringify(result)));
  check(reloaded.parts.find(part => part.id === back.id)!.constructionSvg === back.constructionSvg, `${name}: reload lost rear neckline`);
  const edited = editEstimatedBackOutline(reloaded, back.id, back.outline!.map(([x, y]) => [x * .998 + .001, y]));
  const editedPart = edited.parts.find(part => part.id === back.id)!;
  const editedRegion = edited.manifest.backView!.constructionRegions!.regions.find(region => region.id === back.id)!;
  check(editedPart.constructionSvg.includes('<path') && editedRegion.path !== semantic!.regions.find(region => region.id === back.id)!.path, `${name}: outline edit did not update semantic geometry`);
  assert.deepEqual(edited.parts.filter(part => part.view === 'front'), front.parts);
  const real = createGarmentRegressionFixture(front.manifest.garmentType === 'jacket' ? 'jacket' : front.manifest.garmentType === 'hoodie' ? 'hoodie' : 'tee', true);
  const replaced = mergeImportedGarmentView(result, real, 'back');
  check(!replaced.manifest.backView?.inference && !replaced.parts.some(part => part.id === back.id), `${name}: real back did not replace estimate`);
  assert.deepEqual(replaced.parts.filter(part => part.view === 'front'), front.parts);
  check(!generateEstimatedBack(replaced).available, `${name}: real back was overwritten`);
}

const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Estimated backs must not call a provider.'); };
try {
  for (const name of ['hoodie', 'tee', 'jacket'] as const) {
    const front = fixture(name);
    verify(front, name, name === 'tee' ? 'neck' : 'hood');
    if (process.env.GARMENT_BACK_FIXTURES) {
      const actual = normalizeImportedGarment(JSON.parse(readFileSync(join(process.env.GARMENT_BACK_FIXTURES, `${name}-regions-result.json`), 'utf8')));
      verify(actual, `full ${name} artifact`, name === 'tee' ? 'neck' : 'hood');
    }
    const ink = front.parts.find(part => part.structuralRole === 'source-ink')!;
    const invalid = (replacement: Partial<ImportedPart>) => ({ ...front, parts: front.parts.map(part => part === ink ? { ...part, ...replacement } : part) });
    for (const points of [undefined, [[0, 0], [1, 1], [0, 1], [1, 0]], [[0, 0], [1, 0], [NaN, 1]]]) check(!generateEstimatedBack(invalid({ outline: points as ImportedPoint[] })).available, `${name}: invalid exterior accepted`);
    check(!generateEstimatedBack(invalid({ transform: { x: .1, y: 0, scale: 1, rotation: 0 } })).available, `${name}: unresolved transform accepted`);
    check(!generateEstimatedBack({ ...front, parts: [...front.parts, { ...ink, id: 'second-ink' }] }).available, `${name}: ambiguous exterior accepted`);
    check(!generateEstimatedBack({ ...front, parts: [...front.parts, { ...front.parts[1], id: 'estimated-back-body' }] }).available, `${name}: part ID collision accepted`);
    const inkOnly = estimate({ ...front, parts: [ink] });
    check(inkOnly.parts.filter(part => part.view === 'back').length >= 7, `${name}: essential anatomy was not inferred from garment type`);
  }
  for (const family of ['skirt', 'dress', 'unclassified upload']) {
    const front = fixture('tee');
    const ink = front.parts.find(part => part.structuralRole === 'source-ink')!;
    const result = estimate({ ...front, parts: [ink], manifest: { ...front.manifest, garmentType: family } });
    const exterior = ink.outline!.filter((point, index, points) => index !== points.length - 1 || point[0] !== points[0][0] || point[1] !== points[0][1]);
    assert.deepEqual(result.parts.find(part => part.view === 'back')!.outline, exterior);
  }
  console.log(`PASS: ${checks} source-silhouette estimated-back checks; real hoodie/tee/jacket geometry, immutable front, neck/hood cues, no provider calls.`);
} finally { globalThis.fetch = originalFetch; }
