import { strict as assert } from 'node:assert';
import polygonClipping from 'polygon-clipping';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImportedGarmentEditor } from '../../src/app/components/builder/ImportedGarmentEditor';
import { createCroppedTankFixture, createGarmentRegressionFixture, type GarmentRegressionType } from '../../src/app/data/garmentRegressionFixtures';
import { editEstimatedBackOutline, generateEstimatedBack } from '../../src/app/data/importedGarmentBack';
import { canAcceptImportedConstruction, importedGarmentLayers, isImportedHardware, mergeImportedGarmentView, normalizeImportedGarment, type ImportedGarment, type ImportedPart, type ImportedPoint } from '../../src/app/data/importedGarment';
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
    check(back.every(part => part.boundary!.confidence < .8 && /estimated/i.test(part.evidence)), 'Estimated parts claim observed confidence');
    check(canAcceptImportedConstruction(inferred), 'Explicit inferred workflow lost editable controls');
    check(inferred.accepted === false && inferred.reviewed === false, 'Adding an estimate must require explicit review and acceptance');
    check(normalizeImportedGarment(JSON.parse(JSON.stringify(inferred))).accepted === false, 'Estimated construction became accepted after reload');
    check(back.every(part => !['pocket', 'label', 'fly', 'button', 'zip'].includes(part.semanticType)), 'Front-only detail copied');
    check(!inferred.detailLayers?.some(detail => detail.view === 'back'), 'Front stitching or detail copied');
    check(back.every(part => part.svg.includes('<path') && part.svg !== front.parts.find(candidate => candidate.name === part.name)?.svg), 'No separate SVG');
    check(inferred.measurementCalibration?.view === 'front' && !inferred.measurementCalibrations?.back && !inferred.commonCalibrationDimensions?.length, 'Physical calibration leaked');
    check(importedMeasurementGuides(inferred, 'back').every(guide => guide.millimetres === null && guide.confidence <= .35), 'Estimated measurements claim physical precision');
    assert.deepEqual(normalizeImportedGarment(JSON.parse(JSON.stringify(inferred))).manifest.backView?.inference, inferred.manifest.backView?.inference);
    check(!generateEstimatedBack(inferred).available, 'Existing back silently overwritten');
    if (inferred.manifest.backView?.inference?.method === 'conservative-outline-v1' && ['tee', 'hoodie', 'jacket', 'dress'].includes(family)) {
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
  const tank = createCroppedTankFixture(), tankBefore = JSON.stringify(tank);
  const tankBack = estimate(tank), rearTankParts = tankBack.parts.filter(part => part.view === 'back');
  check(rearTankParts.length === 3 && rearTankParts[0].semanticType === 'body', 'Tank must have one rear body and two qualified shoulder loops');
  check(rearTankParts.filter(isImportedHardware).every(part => part.attachmentTo === rearTankParts[0].id && part.boundary?.boundaryType === 'hardware-edge' && part.evidence.includes('estimated')), 'Estimated shoulder attachments or uncertainty were lost');
  check(importedGarmentLayers(tankBack, 'back').filter(layer => layer.displayName.includes('clasp')).every(layer => !layer.washable), 'Estimated hardware received a fabric wash');
  check(JSON.stringify(tank) === tankBefore, 'Tank estimation changed front construction or hardware');
  const ungroupedHardware = normalizeImportedGarment({ ...tank, parts: tank.parts.map(part => ({ ...part, builderCategory: undefined,
    boundary: { ...part.boundary!, boundaryType: 'panel-edge' },
    structuralRole: part.name.includes('buckle') ? 'metal shoulder fastenings' : part.structuralRole,
  })) });
  check(estimate(ungroupedHardware).parts.filter(part => part.view === 'back').length === 3, 'Legacy hardware roles lost qualified shoulder attachment carryover');
  check(ungroupedHardware.parts.filter(part => part.name.includes('buckle')).every(part => part.builderCategory === 'trims-details'), 'Panel-classified metal hardware is not in closure controls');
  check(importedGarmentLayers(ungroupedHardware, 'front').filter(layer => layer.displayName.includes('buckle')).every(layer => !layer.washable), 'Metal hardware received a fabric wash');
  check(!rearTankParts.some(part => /buckle|binding/.test(part.structuralRole ?? '')), 'Front fastenings or scoop binding leaked to rear');
  check(rearTankParts[0].outline!.some(([x, y]) => Math.abs(x - .5) < .01 && y > .3 && y < .4), 'Deep scoop collapsed into a high closed block or retained front depth');
  check(rearTankParts[0].outline!.filter(([x, y]) => x > .34 && x < .66 && y < .43).length >= 40, 'Rear scoop is not smoothly sampled');
  const sourceBody = tank.parts.find(part => part.semanticType === 'body')!;
  check(sourceBody.outline!.filter(([, y]) => y >= .49).every(p => rearTankParts[0].outline!.some(q => p[0] === q[0] && p[1] === q[1])), 'Tank crop length or lower exterior changed');
  const genericTank = { ...tank, manifest: { ...tank.manifest, garmentType: 'other', subtype: 'cropped scoop-neck tank top' } };
  check(estimate(genericTank).parts.some(part => part.view === 'back'), 'Recognized tank subtype lost its conservative back rule');
  const lining: ImportedPart = { ...sourceBody, id: 'visible-inner-back', semanticType: 'lining', layerKind: 'detail', structural: false, structuralRole: 'visible-inner-back' };
  const rearBinding: ImportedPart = { ...tank.parts.find(part => part.id === 'front:scoop-binding')!, id: 'rear-armhole-binding', attachmentTo: lining.id };
  const withLining = normalizeImportedGarment({ ...genericTank, parts: [...tank.parts, lining, rearBinding] });
  assert.deepEqual(estimate(withLining).parts.filter(part => part.view === 'back').map(part => part.outline), rearTankParts.map(part => part.outline), 'Visible lining and its bindings changed the estimated exterior');
  for (const type of ['vest', 'tank', 'tank-top', 'camisole', 'singlet']) for (const reversed of [false, true]) for (const dense of [false, true]) {
    const varied = createCroppedTankFixture();
    varied.manifest.garmentType = type;
    for (const part of varied.parts) {
      const points = part.outline!;
      if (dense) part.outline = points.flatMap((p, i) => [p, [(p[0] + points[(i + 1) % points.length][0]) / 2, (p[1] + points[(i + 1) % points.length][1]) / 2] as [number, number]]);
      if (reversed) part.outline!.reverse();
    }
    const inferred = estimate(varied), rear = inferred.parts.find(part => part.view === 'back')!;
    check(rear.bounds[3] === .7 && rear.bounds[1] === .14, `${type}: crop length or strap height changed`);
    check(canAcceptImportedConstruction(inferred), `${type}: estimated construction is not editable`);
    assert.deepEqual(inferred.parts.filter(part => part.view === 'front'), varied.parts);
    assert.deepEqual(normalizeImportedGarment(JSON.parse(JSON.stringify(inferred))).manifest.backView?.inference, inferred.manifest.backView?.inference);
  }
  const integralTank = createCroppedTankFixture();
  const fabric = integralTank.parts.filter(part => part.boundary?.boundaryType !== 'hardware-edge');
  integralTank.parts = [{ ...fabric[0], outline: polygonClipping.union([fabric[0].outline!], ...fabric.slice(1).map(part => [part.outline!]))[0][0].slice(0, -1) }];
  check(estimate(integralTank).parts.some(part => part.view === 'back'), 'Single-piece deep scoop tank remains unsupported');
  for (const mutate of [
    (value: ImportedGarment) => { value.parts.find(part => part.id === 'front:left-strap')!.attachmentTo = null; },
    (value: ImportedGarment) => { value.parts.find(part => part.id === 'front:left-strap')!.outline = [[.01, .01], [.05, .01], [.05, .04], [.01, .04]]; },
    (value: ImportedGarment) => { value.parts.find(part => part.id === 'front:left-strap')!.transform.rotation = 20; },
    (value: ImportedGarment) => { value.parts.find(part => part.id === 'front:scoop-binding')!.outline = [[.4, .4], [.6, .5], [.4, .5], [.6, .4]]; },
    (value: ImportedGarment) => { value.parts.find(part => part.id === 'front:scoop-binding')!.structuralRole = 'unknown-extension'; },
  ]) {
    const invalid = createCroppedTankFixture(); mutate(invalid);
    check(!generateEstimatedBack(invalid).available, 'Unsupported tank construction was fabricated');
  }
  // Synthetic source-style integral straps, deep armholes and curved crop, with
  // clasps attached through lining folds as in the supported attachment schema.
  const cubic = (a: ImportedPoint, b: ImportedPoint, c: ImportedPoint, d: ImportedPoint): ImportedPoint[] => Array.from({ length: 16 }, (_, i) => {
    const t = (i + 1) / 16, u = 1 - t;
    return [u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0], u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1]];
  });
  const mirrorPoints = (points: ImportedPoint[]): ImportedPoint[] => points.map(([x, y]) => [1 - x, y]);
  const frontScoop: ImportedPoint[] = Array.from({ length: 49 }, (_, i) => [.5 - .23 * Math.cos(Math.PI * i / 48), .2 + .4 * Math.sin(Math.PI * i / 48)]);
  frontScoop[0] = [.27, .2]; frontScoop[48] = [.73, .2];
  const rightExterior: ImportedPoint[] = [[.82, .2], ...cubic([.82, .2], [.80, .44], [.80, .58], [.90, .64]), ...cubic([.90, .64], [.90, .68], [.87, .78], [.84, .84])];
  const hem = cubic([.84, .84], [.62, .82], [.38, .82], [.16, .84]);
  const exterior = [...rightExterior, ...hem, ...mirrorPoints(rightExterior).reverse().slice(1)];
  const smoothOutline = [...frontScoop, ...exterior];
  const rect = (l: number, t: number, r: number, b: number): ImportedPoint[] => [[l, t], [r, t], [r, b], [l, b]];
  const syntheticPart = (id: string, semanticType: ImportedPart['semanticType'], structuralRole: string, outline: ImportedPoint[], attachmentTo: string | null = null, hardware = false): ImportedPart => {
    const xs = outline.map(p => p[0]), ys = outline.map(p => p[1]);
    const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    return { ...sourceBody, id, name: id, userFacingName: id, semanticType, structuralRole, outline, attachmentTo,
      bounds, geometryBounds: bounds, layerKind: hardware || ['lining', 'label', 'decoration'].includes(semanticType) ? 'detail' : 'structural',
      material: hardware ? 'metal' : 'cotton', builderCategory: hardware ? 'trims-details' : 'fabric-colour',
      boundary: { boundaryType: hardware ? 'hardware-edge' : 'silhouette', confidence: .9, evidence: 'Synthetic construction geometry.' },
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 0L1 1Z"/></svg>',
      constructionSvg: '', stitchSvg: '', symmetryPartner: null };
  };
  const smoothParts = [syntheticPart('synthetic-body', 'body', 'body with integral shoulder extensions', smoothOutline),
    syntheticPart('synthetic-hem', 'hem', 'folded hem', polygonClipping.intersection([smoothOutline], [rect(0, .815, 1, 1)])[0][0].slice(0, -1), 'synthetic-body'),
    syntheticPart('synthetic-lining', 'lining', 'lining', smoothOutline),
    syntheticPart('synthetic-fold-left', 'panel', 'shoulder strap', rect(.18, .14, .27, .205), 'synthetic-lining'),
    syntheticPart('synthetic-fold-right', 'panel', 'shoulder strap', rect(.73, .14, .82, .205), 'synthetic-lining'),
    syntheticPart('synthetic-loop-left', 'panel', 'buckle', rect(.19, .16, .26, .22), 'synthetic-fold-left', true),
    syntheticPart('synthetic-loop-right', 'panel', 'buckle', rect(.74, .16, .81, .22), 'synthetic-fold-right', true),
    syntheticPart('synthetic-label', 'label', 'label', rect(.4, .65, .6, .68), 'synthetic-body'),
    syntheticPart('synthetic-decoration', 'decoration', 'decoration', rect(.4, .69, .6, .72), 'synthetic-body'),
    syntheticPart('synthetic-binding', 'panel', 'armhole binding', rect(.88, .62, .915, .665), 'synthetic-body')];
  smoothParts[5].symmetryPartner = smoothParts[6].id; smoothParts[6].symmetryPartner = smoothParts[5].id;
  const smoothTank = normalizeImportedGarment({ ...tank, parts: smoothParts, manifest: { ...tank.manifest, garmentType: 'other', subtype: 'Synthetic scoop-neck cropped tank', regions: smoothParts } });
  for (const reversed of [false, true]) for (const dense of [false, true]) {
    const fixture = { ...smoothTank, parts: smoothTank.parts.map(part => {
      let points = part.outline!.map(p => [...p] as ImportedPoint);
      if (dense) points = points.flatMap((p, i) => [p, [(p[0] + points[(i + 1) % points.length][0]) / 2, (p[1] + points[(i + 1) % points.length][1]) / 2] as ImportedPoint]);
      return { ...part, outline: reversed ? points.reverse() : points };
    }) };
    const before = JSON.stringify(fixture), inferred = estimate(fixture), rear = inferred.parts.filter(part => part.view === 'back');
    const body = rear.find(part => part.semanticType === 'body')!, loops = rear.filter(isImportedHardware);
    check(rear.length === 4 && loops.length === 2, 'Source-style tank must retain body, hem and two simplified attachments only');
    check(JSON.stringify(fixture) === before, 'Source-style front or attachment metadata mutated');
    assert.deepEqual(inferred.parts.filter(part => part.view === 'front'), fixture.parts);
    check(exterior.every(p => body.outline!.some(q => p[0] === q[0] && p[1] === q[1])), 'Approved shoulder caps, armholes, side seams or curved crop changed');
    assert.deepEqual(body.bounds, fixture.parts[0].bounds, 'Binding overlay inflated the approved body proportions');
    assert.deepEqual(rear.find(part => part.semanticType === 'hem')!.outline, fixture.parts.find(part => part.semanticType === 'hem')!.outline);
    const neckline = body.outline!.filter(([x, y]) => x >= .27 && x <= .73 && y < .65).sort((a, b) => a[0] - b[0]);
    const depth = Math.max(...neckline.map(p => p[1])) - .2;
    check(depth > .18 && depth < .24 && neckline.length >= 49, 'Rear scoop is closed/high, copied deep front, or insufficiently smooth');
    const slopes = neckline.slice(1).map((p, i) => Math.atan2(p[1] - neckline[i][1], p[0] - neckline[i][0]));
    check(slopes.slice(1).every((angle, i) => Math.abs(angle - slopes[i]) < .15), 'Rear neckline has a kink or straight-sided generic profile');
    check(polygonClipping.intersection([body.outline!], [rect(0, .299, 1, .301)]).length === 2, 'Rear neck filled the exposed narrow shoulder straps');
    for (const loop of loops) {
      check(loop.attachmentTo === body.id && loops.some(other => other.id === loop.symmetryPartner), 'Rear fastening parent/symmetry does not resolve');
      check(loop.outline!.length === 8 && loop.svg.includes('fill="none"') && loop.svg !== smoothParts[5].svg, 'Source hardware decoration was copied rather than simplified');
      check(polygonClipping.intersection([loop.outline!], [body.outline!]).length > 0, 'Estimated shoulder loop floats away from its attachment');
      check(loop.boundary!.confidence === .35 && loop.evidence.includes('not observed'), 'Shoulder loop claims observed rear construction');
    }
    check(!rear.some(part => /lining|fold|label|decoration/.test(part.semanticType)), 'Front-only or unobserved rear details leaked');
    const real = createGarmentRegressionFixture('tee', true);
    real.manifest.garmentType = fixture.manifest.garmentType; real.manifest.subtype = fixture.manifest.subtype;
    const replaced = mergeImportedGarmentView(inferred, real, 'back');
    check(!replaced.parts.some(part => part.id.startsWith('estimated-back-')) && !replaced.manifest.backView?.inference, 'Real back retained estimated shoulder hardware');
  }
  for (const mutate of [
    (part: ImportedPart) => { part.attachmentTo = null; },
    (part: ImportedPart) => { part.attachmentTo = 'synthetic-lining'; },
    (part: ImportedPart) => { part.outline = rect(.4, .66, .6, .70); },
    (part: ImportedPart) => { part.outline = rect(.19, .08, .26, .12); },
    (part: ImportedPart) => { part.outline = [[.19, .16], [.26, .22], [.19, .22], [.26, .16]]; },
    (part: ImportedPart) => { part.transform = { ...part.transform, rotation: 10 }; },
    (part: ImportedPart) => { part.semanticType = 'decoration'; },
    (part: ImportedPart) => { part.semanticType = 'label'; },
    (part: ImportedPart) => { part.semanticType = 'button'; },
  ]) {
    const fixture = { ...smoothTank, parts: smoothTank.parts.map(part => { const copy = { ...part }; if (isImportedHardware(copy)) mutate(copy); return copy; }) };
    check(!estimate(fixture).parts.filter(part => part.view === 'back').some(isImportedHardware), 'Unqualified, front-only or unresolved hardware was invented at the rear');
  }
  // Synthetic thin, dipped and tilted waistbands must not need neckline-style rear anchors.
  const waistOutlines: [number, number][][] = [
    [[.25, .1], [.75, .13], [.75, .15], [.25, .12]],
    [[.25, .1], [.5, .11], [.75, .1], [.76, .12], [.5, .14], [.24, .12]],
    [[.25, .12], [.5, .1], [.75, .12], [.75, .14], [.5, .12], [.25, .14]],
  ];
  for (const family of ['shorts', 'trousers', 'jeans', 'skirt'] as GarmentRegressionType[]) {
    for (const outline of waistOutlines) for (const reversed of [false, true]) for (const dense of [false, true]) {
      const fixture = createGarmentRegressionFixture(family);
      const contour = dense ? outline.flatMap((point, index) => {
        const next = outline[(index + 1) % outline.length];
        return [point, [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2] as [number, number]];
      }) : outline;
      const points = (reversed ? [...contour].reverse() : contour).map(point => [...point] as [number, number]);
      const waist = fixture.parts.find(part => part.semanticType === 'waistband')!;
      waist.outline = points;
      waist.name = 'Elasticated waistband';
      const before = JSON.stringify(fixture), inferred = estimate(fixture);
      const rear = inferred.parts.find(part => part.view === 'back' && part.semanticType === 'waistband')!;
      assert.deepEqual(rear.outline, points, `${family}: waistband silhouette was distorted`);
      check(rear.id !== waist.id && rear.outline !== waist.outline && rear.svg.includes('<path'), `${family}: rear waistband is not independent geometry`);
      check(JSON.stringify(fixture) === before, `${family}: estimating a waistband mutated the front`);
      check(rear.boundary!.confidence === .35 && inferred.manifest.backView?.inference?.kind === 'estimated-back', 'Waistband falsely claims rear evidence');
      check(!inferred.detailLayers?.some(detail => detail.view === 'back'), 'Waistband inherited front details');
      check(!rear.stitchSvg?.includes('<path'), 'Waistband inherited front stitching');
    }
  }
  const invalidWaist = createGarmentRegressionFixture('trousers');
  invalidWaist.parts.find(part => part.semanticType === 'waistband')!.outline = [[.25, .1], [.75, .2], [.25, .2], [.75, .1]];
  check(!generateEstimatedBack(invalidWaist).available, 'Invalid waistband bypassed outline validation');
  const transformedWaist = createGarmentRegressionFixture('trousers');
  transformedWaist.parts.find(part => part.semanticType === 'waistband')!.transform = { x: 0, y: 0, scale: 1, rotation: 20 };
  check(!generateEstimatedBack(transformedWaist).available, 'Transformed waistband bypassed validation');
  const captured = createPanelledHoodieFixture(), capturedBefore = JSON.stringify(captured);
  const capturedBack = estimate(captured), capturedRear = capturedBack.parts.filter(part => part.view === 'back');
  check(capturedRear.filter(part => part.semanticType === 'body').length === 1, 'Captured panelled hoodie still rejects its torso');
  check(capturedRear.filter(part => part.semanticType === 'hood').length === 1, 'Captured hood panels retained as separate rear faces');
  const capturedBody = capturedRear.find(part => part.semanticType === 'body')!;
  const capturedHem = capturedRear.find(part => ['hem', 'waistband'].includes(part.semanticType))!;
  check(Math.abs(capturedBody.bounds[0] - .299) < .003 && Math.abs(capturedBody.bounds[2] - .698) < .003, 'Cleaned torso exceeded the front-derived width tolerance');
  check(capturedHem && Math.abs(capturedHem.bounds[3] - .903) < .001 && capturedBody.bounds[3] === capturedHem.bounds[1], 'Captured hem was not separated at body boundary');
  const capturedHood = capturedRear.find(part => part.semanticType === 'hood')!;
  check(capturedHood.bounds[0] === .378 && capturedHood.bounds[2] === .619 && capturedHood.bounds[1] === .025, 'Captured hood proportions changed');
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
    const rearTorso = back.filter(part => part === rearBody || (['hem', 'waistband'].includes(part.semanticType) && !/sleeve/i.test(part.name)));
    const torsoBounds = [Math.min(...rearTorso.map(part => part.bounds[0])), Math.max(...rearTorso.map(part => part.bounds[2])), Math.max(...rearTorso.map(part => part.bounds[3]))];
    if (inferred.manifest.backView?.inference?.method === 'conservative-outline-v1') {
      check(torsoBounds.every((coordinate, index) => Math.abs(coordinate - torso.bounds[[0, 2, 3][index]]) < 1e-9), `${family}: closure changed rear torso exterior`);
    } else {
      check(torsoBounds[0] >= torso.bounds[0] - 1e-9 && torsoBounds[1] <= torso.bounds[2] + 1e-9 && Math.abs(torsoBounds[2] - torso.bounds[3]) < 1e-9, `${family}: closure extended rear torso exterior`);
      const missing = polygonClipping.difference([torso.outline!], ...back.map(part => [part.outline!]));
      const missingArea = missing.flat().reduce((sum, ring) => sum + Math.abs(ring.reduce((area, [x, y], index) => {
        const next = ring[(index + 1) % ring.length];
        return area + x * next[1] - next[0] * y;
      }, 0)) / 2, 0);
      check(missingArea < 1e-9, `${family}: anatomical joins lost observed torso volume`);
    }
    if (inferred.manifest.backView?.inference?.method === 'conservative-outline-v1') check(rearBody.outline!.filter(([, y]) => y < .2 && y > .17).length === 2, `${family}: split neckline anchors were not raised`);
    else check(back.some(part => ['hem', 'waistband'].includes(part.semanticType) && part.bounds[3] === torso.bounds[3]), `${family}: separated hem changed rear length`);
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
  check(generated.includes('ESTIMATED BACK') && generated.includes('Replace estimate with real back'), 'Persistent estimate notice or replacement option missing');
  check(!generated.includes('Generate estimated back'), 'Generation remains available over existing back');
  console.log(`PASS: ${checks} inferred-back checks across 8 garment families; provider calls disabled.`);
} finally { globalThis.fetch = originalFetch; }
