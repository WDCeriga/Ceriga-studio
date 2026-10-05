import { strict as assert } from 'node:assert';
import polygonClipping from 'polygon-clipping';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImportedGarmentEditor } from '../../src/app/components/builder/ImportedGarmentEditor';
import { createGarmentRegressionFixture, type GarmentRegressionType } from '../../src/app/data/garmentRegressionFixtures';
import { editEstimatedBackOutline, generateEstimatedBack } from '../../src/app/data/importedGarmentBack';
import { canAcceptImportedConstruction, mergeImportedGarmentView, normalizeImportedGarment, type ImportedGarment } from '../../src/app/data/importedGarment';
import { importedMeasurementGuides } from '../../src/app/data/importedGarmentMeasurements';
import { createPanelledHoodieFixture } from '../../src/app/data/panelledHoodieRegressionFixture';

let checks = 0;
const check = (condition: unknown, message: string) => { checks++; assert.ok(condition, message); };
const estimate = (garment: ImportedGarment) => { const result = generateEstimatedBack(garment); assert.ok(result.available, result.available ? '' : result.reason); return result.garment; };
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Inference must not call a provider.'); };
try {
  for (const family of ['tee', 'hoodie', 'shorts', 'trousers', 'jeans', 'jacket', 'skirt', 'dress'] as GarmentRegressionType[]) {
    const front = createGarmentRegressionFixture(family);
    front.sourceImage = 'front-only-image';
    front.sourceImages = { front: 'front-only-image' };
    front.accepted = true;
    front.measurementCalibration = { measurementId: family === 'shorts' ? 'waist' : 'chest', millimetres: 500, view: 'front' };
    front.measurementCalibrations = { back: { measurementId: 'chest', millimetres: 200, view: 'back' } };
    front.commonCalibrationDimensions = [{ measurementId: 'chest', views: ['front', 'back'], evidence: 'stale cross-view metadata' }];
    const before = JSON.stringify(front), inferred = estimate(front), back = inferred.parts.filter(part => part.view === 'back');
    check(back.length > 0, `${family} has no back`);
    check(JSON.stringify(front) === before, 'Input mutated');
    assert.deepEqual(inferred.parts.filter(part => part.view === 'front'), front.parts);
    assert.deepEqual(inferred.sourceManifest, front.sourceManifest);
    check(inferred.manifest.backView?.inference?.kind === 'estimated-back', 'Inference provenance missing');
    check(!inferred.manifest.backView?.sourceImage && !inferred.manifest.backView?.sourceImageHash && !inferred.manifest.backView?.provenance && !inferred.sourceImages?.back, 'Back falsely claims image/provider evidence');
    check(back.every(part => part.boundary!.confidence < .8 && part.evidence.includes('estimated')), 'Estimated parts claim observed confidence');
    check(canAcceptImportedConstruction(inferred), 'Explicit inferred workflow lost editable controls');
    check(inferred.accepted, 'Adding an estimate discarded accepted front state');
    check(back.every(part => !['pocket', 'label', 'fly', 'button', 'neckband', 'collar'].includes(part.semanticType)), 'Front-only detail copied');
    check(!inferred.detailLayers?.some(detail => detail.view === 'back'), 'Front stitching or detail copied');
    check(back.every(part => part.svg.includes('<path') && part.svg !== front.parts.find(candidate => candidate.name === part.name)?.svg), 'No separate SVG');
    check(inferred.measurementCalibration?.view === 'front' && !inferred.measurementCalibrations?.back && !inferred.commonCalibrationDimensions?.length, 'Physical calibration leaked');
    check(importedMeasurementGuides(inferred, 'back').every(guide => guide.millimetres === null && guide.confidence <= .35), 'Estimated measurements claim physical precision');
    assert.deepEqual(normalizeImportedGarment(JSON.parse(JSON.stringify(inferred))).manifest.backView?.inference, inferred.manifest.backView?.inference);
    check(!generateEstimatedBack(inferred).available, 'Existing back silently overwritten');
    if (['tee', 'hoodie', 'jacket', 'dress'].includes(family)) {
      const frontBody = front.parts.find(part => part.semanticType === 'body')!, backBody = back.find(part => part.semanticType === 'body')!;
      check(JSON.stringify(frontBody.outline) !== JSON.stringify(backBody.outline), 'Front neckline simply mirrored/copied');
      check(backBody.outline!.some(([x, y]) => x > .44 && x < .56 && y < .19), 'Rear neckline was not raised');
      check(frontBody.outline!.filter(([, y]) => y >= .4).every(p => backBody.outline!.some(q => p[0] === q[0] && p[1] === q[1])), 'Main side/hem silhouette changed');
    }
    const editedOutline = back[0].outline!.map((point, i) => [point[0], point[1] + (i === 0 ? .001 : 0)] as [number, number]);
    const edited = editEstimatedBackOutline(inferred, back[0].id, editedOutline);
    check(edited.parts.find(part => part.id === back[0].id)!.svg !== back[0].svg, 'Estimated outline edit did not rebuild SVG');
    assert.deepEqual(edited.parts.filter(part => part.view === 'front'), front.parts);
    check(edited.manifest.backView?.inference?.kind === 'estimated-back', 'Edit discarded inference marker');
    const real = createGarmentRegressionFixture(family, true);
    real.manifest.backView = { ...real.manifest.backView!, sourceImage: 'real-back-image', sourceImageHash: 'real-back-hash' };
    real.sourceImages = { back: 'real-back-image' };
    const replaced = mergeImportedGarmentView(edited, real, 'back');
    check(!replaced.manifest.backView?.inference && replaced.sourceImages?.back === 'real-back-image', 'Real upload did not replace inferred provenance');
    check(!replaced.parts.some(part => part.id.startsWith('estimated-back-')), 'Real upload retained estimated parts');
    check(!replaced.reviewNotes.includes(inferred.manifest.backView!.inference!.notice) && !replaced.manifest.uncertainties.includes(inferred.manifest.backView!.inference!.notice), 'Real back retains an obsolete estimated-back notice');
    assert.deepEqual(replaced.parts.filter(part => part.view === 'front'), front.parts);
  }
  const captured = createPanelledHoodieFixture(), capturedBefore = JSON.stringify(captured);
  const capturedBack = estimate(captured), capturedRear = capturedBack.parts.filter(part => part.view === 'back');
  check(capturedRear.filter(part => part.semanticType === 'body').length === 1, 'Captured panelled hoodie still rejects its torso');
  check(capturedRear.filter(part => part.semanticType === 'hood').length === 1, 'Captured hood panels retained as separate rear faces');
  assert.deepEqual(capturedRear.find(part => part.semanticType === 'body')!.bounds, [.299, .292, .698, .903]);
  assert.deepEqual(capturedRear.find(part => part.semanticType === 'hood')!.bounds, [.378, .025, .619, .328]);
  check(!capturedRear.some(part => ['zip', 'pocket', 'label'].includes(part.semanticType)), 'Captured front-only details copied to back');
  check(capturedRear.every(part => !part.attachmentTo || capturedRear.some(parent => parent.id === part.attachmentTo)), 'Captured attachments do not resolve');
  check(JSON.stringify(captured) === capturedBefore, 'Captured front altered during inference');
  assert.deepEqual(capturedBack.parts.filter(part => part.view === 'front'), captured.parts);
  const capturedChest = importedMeasurementGuides(capturedBack, 'back').find(guide => guide.id === 'chest');
  check(capturedChest && capturedChest.points.length >= 2 && capturedChest.length > 0 && capturedChest.status !== 'unavailable', 'Assembled back lacks a chest guide');
  const front = createGarmentRegressionFixture('tee');
  check(!generateEstimatedBack({ ...front, manifest: { ...front.manifest, garmentType: 'unknown garment' } }).available, 'Unknown family fabricated');
  const body = front.parts.find(part => part.semanticType === 'body')!;
  check(generateEstimatedBack({ ...front, parts: front.parts.map(part => ({ ...part, measurementRole: 'body' })) }).available, 'Broad measurement roles overrode explicit body/sleeve construction types');
  for (const family of ['tee', 'hoodie', 'jacket', 'dress'] as GarmentRegressionType[]) {
    const single = createGarmentRegressionFixture(family);
    const torso = single.parts.find(part => part.semanticType === 'body')!;
    const panels = [[0, 0, .495, .5], [.505, 0, 1, .5], [0, .5, .495, 1], [.505, .5, 1, 1]].map(([l, t, r, b], index) => {
      const outline = polygonClipping.intersection([torso.outline!], [[[l, t], [r, t], [r, b], [l, b]]])[0][0].slice(0, -1);
      return { ...torso, id: `torso-section-${index}`, name: `torso section ${index}`, semanticType: index < 2 ? 'panel' as const : 'body' as const, structuralRole: index < 2 ? 'upper body panel' : 'lower body panel', outline, attachmentTo: null, symmetryPartner: null };
    });
    const other = single.parts.filter(part => part !== torso).map(part => ({ ...part, attachmentTo: part.attachmentTo === torso.id ? panels[part.side === 'right' ? 1 : 0].id : part.attachmentTo }));
    const closure = { ...torso, id: 'observed-closure', semanticType: 'zip' as const, layerKind: 'detail' as const, name: 'closure', attachmentTo: panels[2].id, outline: [[.493, .15], [.507, .15], [.507, .85], [.493, .85]] as [number, number][] };
    const segmented = normalizeImportedGarment({ ...single, parts: [...panels, ...other, closure] });
    const before = JSON.stringify(segmented), inferred = estimate(segmented);
    const back = inferred.parts.filter(part => part.view === 'back'), rearBody = back.find(part => part.semanticType === 'body')!;
    check(back.filter(part => part.semanticType === 'body').length === 1, `${family}: panelled torso did not become one estimated exterior`);
    check(!back.some(part => part.semanticType === 'zip'), `${family}: closure leaked onto rear`);
    check(back.every(part => !part.attachmentTo || back.some(parent => parent.id === part.attachmentTo)), `${family}: assembled panel attachment is dangling`);
    check(JSON.stringify(segmented) === before, `${family}: assembling panels mutated source`);
    assert.deepEqual(inferred.parts.filter(part => part.view === 'front'), segmented.parts);
    check(rearBody.bounds[0] === torso.bounds[0] && rearBody.bounds[2] === torso.bounds[2] && rearBody.bounds[3] === torso.bounds[3], `${family}: closure extended rear exterior`);
    check(rearBody.outline!.filter(([, y]) => y < .2 && y > .17).length === 2, `${family}: split neckline anchors were not raised`);
    check(!generateEstimatedBack({ ...segmented, parts: segmented.parts.filter(part => part.id !== closure.id) }).available, `${family}: unobserved gap bridged`);
    check(!generateEstimatedBack({ ...segmented, parts: segmented.parts.map(part => part.id === closure.id ? { ...part, attachmentTo: 'pocket' } : part) }).available, `${family}: pocket hardware bridged torso`);
    check(!generateEstimatedBack({ ...segmented, parts: segmented.parts.map(part => part.id === closure.id ? { ...part, transform: { x: 0, y: 0, scale: 1, rotation: 20 } } : part) }).available, `${family}: transformed closure bridged torso`);
  }
  const contiguous = normalizeImportedGarment({ ...front, parts: front.parts.flatMap(part => part !== body ? [part] : [0, 1].map(index => ({ ...part, id: `joined-${index}`, outline: polygonClipping.intersection([part.outline!], [[[index * .5, 0], [(index + 1) * .5, 0], [(index + 1) * .5, 1], [index * .5, 1]]])[0][0].slice(0, -1) }))) });
  check(estimate(contiguous).parts.filter(part => part.view === 'back' && part.semanticType === 'body').length === 1, 'Contiguous panels require nonexistent closure hardware');
  const hooded = createGarmentRegressionFixture('hoodie'), hood = hooded.parts.find(part => part.semanticType === 'hood')!;
  const splitHood = normalizeImportedGarment({ ...hooded, parts: hooded.parts.flatMap(part => part !== hood ? [part] : [[0, .46], [.46, .54], [.54, 1]].map(([l, r], index) => ({ ...part, id: `hood-piece-${index}`, outline: polygonClipping.intersection([part.outline!], [[[l, 0], [r, 0], [r, 1], [l, 1]]])[0][0].slice(0, -1) }))) });
  const joinedHood = estimate(splitHood).parts.filter(part => part.view === 'back' && part.semanticType === 'hood');
  check(joinedHood.length === 1, 'Separate front hood panels retained on inferred rear');
  assert.deepEqual(joinedHood[0].outline, estimate(hooded).parts.find(part => part.view === 'back' && part.semanticType === 'hood')!.outline);
  check(joinedHood[0].name === 'Estimated back hood', 'Panel-specific front construction leaked into estimated hood metadata');
  for (const outline of [undefined, [[0, 0], [1, 1], [0, 1], [1, 0]], [[0, 0], [1, 0], [NaN, 1]]]) {
    check(!generateEstimatedBack({ ...front, parts: front.parts.map(part => part.id === body.id ? { ...part, outline: outline as typeof part.outline } : part) }).available, 'Insufficient/invalid geometry fabricated');
  }
  check(!generateEstimatedBack({ ...front, parts: front.parts.map(part => ({ ...part, transform: { ...part.transform, rotation: 20 } })) }).available, 'Unresolved transforms fabricated');
  check(!generateEstimatedBack(createGarmentRegressionFixture('tee', true)).available, 'Observed back overwritten');
  assert.throws(() => editEstimatedBackOutline(estimate(front), 'estimated-back-1', [[0, 0], [1, 1], [0, 1], [1, 0]]));
  const props = { onChange: () => { throw new Error('Render must not infer automatically'); }, onReplace: () => {}, selectedId: null, onSelect: () => {}, onColor: () => {}, onResetColors: () => {}, step: 1 };
  const initial = renderToStaticMarkup(createElement(ImportedGarmentEditor, { ...props, value: front }));
  check(initial.includes('Generate estimated back') && initial.includes('Upload back reference'), 'Explicit action and real upload missing');
  check(!front.manifest.backView, 'Rendering generated a back');
  const colourControls = renderToStaticMarkup(createElement(ImportedGarmentEditor, { ...props, value: front, step: 2 }));
  for (const name of ['body', 'left sleeve', 'right sleeve', 'neckband']) check(colourControls.includes(`aria-label="${name} colour"`), `Fabric & Colour hides ${name}`);
  const sleeveControls = renderToStaticMarkup(createElement(ImportedGarmentEditor, { ...props, value: front, step: 4 }));
  check(sleeveControls.includes('aria-label="left sleeve colour"') && !sleeveControls.includes('aria-label="body colour"'), 'Specific construction steps stopped filtering by category');
  const generated = renderToStaticMarkup(createElement(ImportedGarmentEditor, { ...props, value: estimate(front) }));
  check(generated.includes('ESTIMATED back') && generated.includes('Replace estimate with real back'), 'Persistent estimate notice or replacement option missing');
  check(!generated.includes('Generate estimated back'), 'Generation remains available over existing back');
  console.log(`PASS: ${checks} inferred-back checks across 8 garment families; provider calls disabled.`);
} finally { globalThis.fetch = originalFetch; }
