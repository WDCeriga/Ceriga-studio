import polygonClipping from 'polygon-clipping';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createOpening, compileOpeningGeometry, constructOpenings, openingArea, openingGap, openingGapProfile, openingNecklineReach, openingOpenAmount, openingPolygonPath, openingLayerClip, resetOpening, setOpeningEndpoint, validateOpening, transformOpeningPolygons, type OpeningPlacement } from '../../src/app/data/garmentOpenings';
import { alignGarmentZip, copyDetailToOpposite, createGarmentDetail, detailPlacement, detailRotation, detailSvg, detailGesture, resizeGarmentDetail, setDetailTransform, type DetailBounds } from '../../src/app/data/garmentDetails';
import { getDefaultGarmentSelection, getGarmentAssetsForFit, resolveGarmentLayers } from '../../src/app/data/garmentSvgCatalog';
import { getPotraceSvgBBox, renderFabricSvg } from '../../src/app/lib/tshirtSvgUtils';
import { TshirtSvgPreview } from '../../src/app/components/builder/TshirtSvgPreview';

function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const close = (a: number, b: number, tolerance = .05) => Math.abs(a - b) < tolerance;
const delay = () => new Promise(resolve => setTimeout(resolve, 60));

export const OPENING_PREVIEW_STAGES = ['before', 'path', 'construction', 'final'] as const;

/** Browser-only real-template fixtures shared by regression tests and milestone galleries. */
export function getOpeningTestFixtures() {
  const fit = 'slim';
  const placements: OpeningPlacement[] = ['neckline', 'shoulder', 'side-seam', 'hem', 'full-front', 'free'];
  return getGarmentAssetsForFit('tshirt', 'Neck', fit).map(neck => {
    const selection = { ...getDefaultGarmentSelection('tshirt', fit), Neck: neck.id };
    const layers = resolveGarmentLayers({ garmentType: 'tshirt', selection, fit });
    const sources = layers.filter(layer => ['base', 'neck', 'bodyHem'].includes(layer.id)).map(layer => ({ id: layer.id, raw: layer.svgRaw, role: layer.id === 'base' ? 'body' as const : layer.id === 'neck' ? 'neck' as const : 'hem' as const }));
    const geometry = compileOpeningGeometry(sources);
    const body = getPotraceSvgBBox(layers.find(layer => layer.id === 'base')!.svgRaw)!;
    const hem = getPotraceSvgBBox(layers.find(layer => layer.id === 'bodyHem')!.svgRaw)!;
    const bounds: DetailBounds = { ...body, maxY: Math.max(body.maxY, hem.maxY), openingGeometry: geometry };
    const legacy = createGarmentDetail('zip', [], '#A3A3A3', 'zip-05');
    return { id: neck.id, name: neck.displayName, garmentType: 'tshirt' as const, fit, selection, bounds, legacy,
      cases: placements.map(placement => {
        const detail = createOpening(legacy, bounds, placement);
        return { placement, detail, validation: validateOpening(detail, bounds) };
      }) };
  });
}

export function getOpeningMilestoneFixtures() {
  const fixtures = getOpeningTestFixtures();
  const examples: { template: string; placement: OpeningPlacement; label: string }[] = [
    { template: 'V-neck', placement: 'neckline', label: 'Short neckline zip' },
    { template: 'Scoop neck', placement: 'neckline', label: 'Short neckline zip' },
    { template: 'Crew neck', placement: 'neckline', label: 'Short neckline zip' },
    { template: 'Deep V-neck', placement: 'neckline', label: 'Short neckline zip' },
  ];
  return examples.map(example => {
    const fixture = fixtures.find(candidate => candidate.name === example.template)!;
    const openingCase = fixture.cases.find(candidate => candidate.placement === example.placement)!;
    let detail = openingCase.detail;
    if (example.placement === 'neckline') {
      const { start, end } = detail.opening!;
      detail = setOpeningEndpoint(detail, fixture.bounds, 'end', { x: start.x + (end.x - start.x) / 2, y: start.y + (end.y - start.y) / 2 });
    }
    const validation = validateOpening(detail, fixture.bounds);
    check(validation.status === 'Valid', `${example.template}/${example.label}: ${validation.reasons.join('; ')}`);
    return { ...fixture, ...openingCase, id: `${fixture.id}-${example.placement}`, label: example.label, detail, validation, stages: OPENING_PREVIEW_STAGES };
  });
}

/** Mounts actual production previews; returns an unmount function and DOM-stage evidence. */
export async function renderOpeningMilestones(container?: HTMLElement) {
  const fixtures = getOpeningMilestoneFixtures();
  const host = document.createElement('section');
  host.dataset.openingMilestones = '';
  host.style.cssText = container
    ? 'background:#f4f3ef;color:#252525;padding:24px;font:14px system-ui;min-width:960px'
    : 'position:fixed;inset:0;overflow:auto;z-index:2147483647;background:#f4f3ef;color:#252525;padding:24px;font:14px system-ui';
  (container ?? document.body).append(host);
  const root = createRoot(host);
  const unmount = () => { root.unmount(); host.remove(); };
  const reviewStages = ['final', 'slightly-open', 'fully-open'] as const;
  const labels = { final: '1 · Closed', 'slightly-open': '2 · Slightly open (22%)', 'fully-open': '3 · Fully open' };
  const noop = () => {};
  root.render(createElement('div', { style: { minWidth: 960, maxWidth: 1600, margin: '0 auto' } },
    createElement('header', { style: { marginBottom: 24 } },
      createElement('button', { onClick: unmount, style: { float: 'right', border: '1px solid #aaa', padding: '6px 12px' } }, 'Close review'),
      createElement('h1', { style: { fontSize: 24, fontWeight: 600 } }, 'Natural neckline zip integration'),
      createElement('p', null, 'Base neckline + local opening modifier + sewn-in zip. Actual source contours and production renderer, not replacement neck styles.'),
      createElement('p', null, 'Crew, V, deep V and scoop. Closed, slightly open and fully open, with a neck/tape close-up below each garment. Opening depth changes without excessive widening.')),
    ...fixtures.map(fixture => createElement('section', { key: fixture.id, style: { marginBottom: 32 }, 'data-opening-template': fixture.name },
      createElement('h2', { style: { fontSize: 18, fontWeight: 600, marginBottom: 4 } }, `${fixture.name} · ${fixture.label} · ${fixture.validation.status}`),
      createElement('p', { style: { marginBottom: 12, fontSize: 12 } }, fixture.validation.reasons.join(' · ') || 'Attachment and material intersection verified'),
      createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(260px, 1fr))', gap: 16 } },
        ...reviewStages.map(stage => createElement('figure', { key: stage, style: { margin: 0 }, 'data-opening-milestone': stage, 'data-opening-detail': fixture.detail.id },
          createElement('figcaption', { style: { padding: '8px 0', borderTop: '1px solid #bbb', fontWeight: 600 } }, labels[stage]),
          ...[false, true].map(closeUp => createElement('div', { key: String(closeUp), 'data-neckline-closeup': closeUp ? '' : undefined,
            style: { position: 'relative', width: '100%', aspectRatio: '1', marginBottom: 8, background: '#e5e3dd', overflow: 'hidden' } },
            createElement('div', { style: { width: '100%', height: '100%', transform: closeUp ? 'scale(3.2)' : undefined,
              transformOrigin: `${fixture.detail.opening!.start.x / 20.48}% ${fixture.detail.opening!.start.y / 20.48}%` } },
              createElement(TshirtSvgPreview, { garmentType: fixture.garmentType, fit: fixture.fit, selection: fixture.selection,
                color: '#5E7FAF', garmentDetails: [{ ...fixture.detail, fill: '#5E7FAF', zipSliderPosition: stage === 'fully-open' ? 1 : stage === 'slightly-open' ? .22 : 0 }], className: 'h-full w-full',
                detailEditor: { part: 'zip', closeUp: false, onPartChange: noop, onCloseUpChange: noop, openingStage: 'final' } })))))))))));
  try {
    for (let attempt = 0; attempt < 100 && host.querySelectorAll('[data-opening-facing]').length < fixtures.length * 2; attempt++) await delay();
    const evidence = Array.from(host.querySelectorAll<HTMLElement>('[data-opening-milestone]')).map(card => {
      const stage = card.dataset.openingMilestone!;
      const cutLayers = card.querySelectorAll('[data-opening-cut]').length;
      const facings = card.querySelectorAll('[data-opening-facing]').length;
      const paths = card.querySelectorAll('[data-opening-path]').length;
      const hardware = Boolean(card.querySelector(`[data-detail-id="${card.dataset.openingDetail}"]`));
      const final = stage === 'final' || stage === 'slightly-open' || stage === 'fully-open';
      const constructed = stage === 'construction' || final;
      check(Boolean(cutLayers) === constructed && Boolean(facings) === constructed && Boolean(paths) === (stage === 'path') && hardware === final, `Milestone ${stage} did not render its expected construction`);
      return { template: card.closest<HTMLElement>('[data-opening-template]')!.dataset.openingTemplate, stage, cutLayers, facings, paths, hardware };
    });
    check(evidence.length === 12 && host.querySelectorAll('[data-neckline-closeup]').length === 12, 'Expected four necklines with three open states and corresponding close-ups');
    return { host, unmount, evidence };
  } catch (error) { unmount(); throw error; }
}

/** Browser entry point: await (await import('/scripts/collar/test_garment_openings.ts')).verifyGarmentOpenings() */
export async function verifyGarmentOpenings() {
  const source = { id: 'base', role: 'body' as const, raw: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path d="M100 100H1000V1000H100Z" fill="black"/></svg>', matrix: new DOMMatrix() };
  const originalGeometry = compileOpeningGeometry([source]);
  check(compileOpeningGeometry([{ ...source, matrix: new DOMMatrix() }]) === originalGeometry, 'Equivalent previews repeated source contour compilation');
  check(originalGeometry.fabric[0][0].length === 5, 'Straight contour edges were unnecessarily subdivided');
  source.matrix.e = 20;
  const shiftedGeometry = compileOpeningGeometry([source]);
  check(shiftedGeometry !== originalGeometry && close(shiftedGeometry.fabric[0][0][0][0], originalGeometry.fabric[0][0][0][0] + 20), 'Compiled contour cache ignored a changed layer transform');
  check(compileOpeningGeometry([{ ...source, raw: source.raw.replace('1000', '1100') }]) !== shiftedGeometry, 'Compiled contour cache ignored changed source artwork');
  const reports: { neck: string; placement: OpeningPlacement; status: string; removedArea: number }[] = [];
  const fixtures = getOpeningTestFixtures();
  check(fixtures.length >= 6, 'Six real neck templates are required');
  for (const fixture of fixtures) {
    const { fit, selection, bounds, legacy } = fixture;
    const neck = { displayName: fixture.name };
    const geometry = bounds.openingGeometry!;
    const rawLayers = resolveGarmentLayers({ garmentType: 'tshirt', selection, fit, neckFinish: 'raw' });
    const rawGeometry = compileOpeningGeometry(rawLayers.filter(layer => ['base', 'bodyHem'].includes(layer.id)).map(layer => ({ id: layer.id, raw: layer.svgRaw, role: layer.id === 'base' ? 'body' as const : 'hem' as const })));
    check(rawGeometry.fabric.length && openingArea(rawGeometry.fabric) < openingArea(geometry.fabric), `${neck.displayName}: raw-neck source mask was ignored`);
    const snapshot = JSON.stringify(legacy), artwork = detailSvg(legacy);
    check(constructOpenings([legacy], bounds).removed.length === 0 && !legacy.opening, `${neck.displayName}: legacy zip cut fabric`);
    for (const { placement, detail } of fixture.cases) {
      check(detail.opening, 'Opening was not created');
      check(JSON.stringify(legacy) === snapshot && detailSvg(legacy) === artwork, 'Conversion mutated the legacy zip');
      const validation = validateOpening(detail, bounds);
      check(validation.status !== 'Invalid', `${neck.displayName}/${placement}: ${validation.reasons.join('; ')}`);
      const result = constructOpenings([detail], bounds);
      check(constructOpenings([detail], bounds) === result, 'Unchanged live construction repeated its polygon operations');
      const removed = openingArea(result.removed);
      check(removed > 40, `${neck.displayName}/${placement}: no real cut`);
      check(close(openingArea(result.remaining) + removed, openingArea(geometry.fabric), .1), 'Boolean fabric conservation failed');
      check(openingArea(polygonClipping.intersection(result.remaining, result.removed)) < .02, 'Cut is still filled');
      check(result.facing.length && openingArea(result.facing) > 1, 'Missing reconstructed facing edges');
      check(!Object.keys(result.panels).some(id => /sleeve/i.test(id)), 'Unrelated sleeves were cut');
      // Outside the actual local cut, the original neck contour must remain identical.
      const collar = geometry.panels.find(panel => panel.id === 'neck')!;
      const expected = polygonClipping.difference(collar.polygons, result.removed);
      check(openingArea(polygonClipping.xor(expected, result.panels.neck)) < .02, 'Neck identity changed outside cut');
      const frame = detailPlacement(detail, bounds);
      check(close(frame.height, Math.hypot(detail.opening.end.x - detail.opening.start.x, detail.opening.end.y - detail.opening.start.y)), 'Length ignored endpoints');
      const moved = detailGesture(detail, bounds, [], 13, -9).detail;
      check(close(moved.opening!.start.x, detail.opening.start.x + 13) && close(moved.opening!.end.y, detail.opening.end.y - 9), 'Move snapped or teleported endpoints');
      check(moved.opening!.attachment === placement, 'Moving silently reattached the opening');
      const movedFrame = detailPlacement(moved, bounds);
      check(close(movedFrame.height, frame.height), 'Moving changed the cut length');
      let previousArea = -1;
      let previousTeeth = '';
      for (const amount of [0, .5, 1]) {
        const opened = { ...detail, zipSliderPosition: amount };
        const cut = constructOpenings([opened], bounds);
        const area = openingArea(cut.removed);
        check(area > previousArea, `${placement}: opening progress did not increase actual fabric separation`);
        check(openingArea(polygonClipping.intersection(cut.facing, cut.removed)) < .02, 'Facing painted over the opening gap');
        const svg = new DOMParser().parseFromString(detailSvg(opened, frame.width / frame.height), 'image/svg+xml');
        const teeth = svg.querySelector('[data-zip-teeth]')!.innerHTML;
        check(teeth !== previousTeeth && svg.querySelectorAll('[data-opening-tape]').length === 2, 'Hardware did not separate with the fabric');
        check(svg.querySelector('[data-opening-amount]')?.getAttribute('data-opening-amount') === String(amount), 'Hardware progress diverged from construction');
        const joinedHeight = Number(svg.querySelector('[data-zip-joined]')?.getAttribute('height'));
        check(amount === 1 ? joinedHeight === 0 : joinedHeight > 0, 'Closed zipper chain failed to cover the sewn slit');
        const profile = openingGapProfile(opened, frame.width, frame.height);
        check(profile.amount === amount && openingOpenAmount(opened) === amount, 'Opening amount contract drifted');
        check(svg.documentElement.getAttribute('overflow') === 'visible' && svg.querySelector('[data-zip-pull]') && svg.querySelector('[data-zip-slider]'), 'Opened hardware or pull was clipped/omitted');
        check(profile.halfGap(0) <= frame.width * .675 + .001 && profile.halfGap(0) <= frame.width * .025 + frame.height * .045 + .001, 'Opening flared beyond the tape/proportion cap');
        if (amount === 1) check(close(profile.tip, frame.height), 'Full opening failed to extend to the zip end');
        previousArea = area; previousTeeth = teeth;
      }
      const endpoint = setOpeningEndpoint(detail, bounds, 'end', { x: detail.opening.end.x + 21, y: detail.opening.end.y - 14 });
      check(JSON.stringify(endpoint.opening!.start) === JSON.stringify(detail.opening.start), 'Endpoint edit moved its independent partner');
      const rotated = setDetailTransform(detail, bounds, { rotation: detailRotation(detail) + 23 });
      check(close(detailRotation(rotated), (detailRotation(detail) + 23) % 360), 'Rotation did not rotate endpoints');
      check(close(detailPlacement(rotated, bounds).x, frame.x) && close(detailPlacement(rotated, bounds).y, frame.y), 'Rotation projected the opening onto the collar');
      for (const angle of [0, 22.2987, 90, 180, 270, 359.9, -90, 450]) {
        const turned = setDetailTransform(detail, bounds, { rotation: angle });
        const normalized = (angle % 360 + 360) % 360;
        check(close((detailRotation(turned) - normalized + 540) % 360 - 180, 0, 1e-7), `${placement}: requested rotation ${angle} was constrained`);
        const turnedFrame = detailPlacement(turned, bounds);
        check(close(turnedFrame.x, frame.x, 1e-9) && close(turnedFrame.y, frame.y, 1e-9) && close(turnedFrame.height, frame.height, 1e-7), 'Arbitrary rotation moved the midpoint or changed length');
        check(turned.opening!.attachment === placement, 'Arbitrary rotation silently reattached the opening');
      }
      if (placement === 'neckline' || placement === 'full-front') {
        const closedNeck = constructOpenings([{ ...detail, zipSliderPosition: 0 }], bounds).panels.neck;
        const openNeck = constructOpenings([{ ...detail, zipSliderPosition: 1 }], bounds).panels.neck;
        check(openingArea(closedNeck) > openingArea(openNeck), `${neck.displayName}: opening the zip did not open the neckline material`);
        for (const amount of [0, .22, .55, 1]) {
          const state = { ...detail, zipSliderPosition: amount };
          const reach = openingNecklineReach(state, bounds);
          check(reach >= 2, `${neck.displayName}: insertion did not find the real neckline edge`);
          const insertion = openingGap(state, state.opening.width * .45, reach);
          const result = constructOpenings([state], bounds);
          check(openingArea(polygonClipping.intersection(result.panels.neck, insertion)) < .1, `${neck.displayName}: continuous binding remains under the zip`);
          check(openingArea(polygonClipping.difference(insertion, result.inkCut)) < .1, `${neck.displayName}: original outline survives inside the insertion footprint`);
          const hardware = new DOMParser().parseFromString(detailSvg(state, frame.width / frame.height, 'body', true), 'image/svg+xml');
          check(!hardware.querySelector('[data-zip-top-stop]'), 'Joined neckline retained floating top stops at the old zip start');
          const originalNeck = bounds.openingGeometry!.panels.find(panel => panel.id === 'neck')!.polygons;
          check(close(openingArea(polygonClipping.difference(originalNeck, insertion)), openingArea(result.panels.neck), .1), `${neck.displayName}: changed neckline outside the local insertion`);
        }
      }
      const freelyPlaced = setDetailTransform(detail, bounds, { x: .58, y: .62, height: 220, width: 28, rotation: 127 });
      check(validateOpening(freelyPlaced, bounds).status === 'Valid', `${placement}: internal rotated slit was constrained by its creation preset`);
      check(openingArea(constructOpenings([freelyPlaced], bounds).removed) > 0, 'Arbitrary internal slit did not cut material');
      const nearGuide = (.5 - detailPlacement(freelyPlaced, bounds).x) * (bounds.maxX - bounds.minX) + 3;
      const snapped = detailGesture(freelyPlaced, bounds, [], nearGuide, 0, undefined, 4);
      check(close(detailPlacement(snapped.detail, bounds).x, .5) && snapped.guides.some(guide => guide.axis === 'x'), 'Explicit guide snapping was ignored');
      check(snapped.detail.opening!.attachment === placement, 'Guide snapping silently changed the attachment preset');
      const unsupported = { ...bounds, openingGeometry: undefined };
      check(validateOpening(freelyPlaced, unsupported).status === 'Needs Review' && constructOpenings([freelyPlaced], unsupported).removed.length === 0, 'Unavailable contours were cut using a guessed rectangle');
      const resized = resizeGarmentDetail(detail, bounds, 1, 1, 18, 24);
      check(JSON.stringify(resized.opening) !== JSON.stringify(detail.opening), 'Resize did not affect the cut');
      const originalDetails = [detail];
      check(copyDetailToOpposite(originalDetails, detail, 'front') === originalDetails, 'Constructed opening silently copied its attachment to another view');
      check(copyDetailToOpposite([legacy], legacy, 'front').length === 2, 'Legacy overlay copy was disabled');
      const aligned = alignGarmentZip(detail, bounds, 'full');
      check(aligned.opening!.attachment === 'full-front' && aligned.opening!.end.y > aligned.opening!.start.y + 800, 'Alignment only moved the hardware');
      const reset = resetOpening(endpoint);
      check(JSON.stringify(reset.opening) === JSON.stringify(detail.opening), 'Reset lost creation defaults');
      const pointerEndpoint = setOpeningEndpoint(detail, bounds, 'end', new DOMPoint(detail.opening.end.x + 12, detail.opening.end.y + 8));
      check(pointerEndpoint.opening!.end.x === detail.opening.end.x + 12 && pointerEndpoint.opening!.end.y === detail.opening.end.y + 8, 'DOMPoint endpoint lost non-enumerable coordinates');
      for (const savedDefaults of [undefined, {}, { start: { x: 1000 }, end: { y: 975 }, width: null }, { start: null, end: {}, width: -1, attachment: 'old-schema' }, { start: {}, end: { y: null }, version: 99, closure: 'old-schema' }]) {
        const restored = JSON.parse(JSON.stringify(endpoint));
        restored.opening.defaults = savedDefaults;
        const snapshot = JSON.stringify(restored);
        const recovered = resetOpening(restored);
        const opening = recovered.opening!;
        check([opening.start.x, opening.start.y, opening.end.x, opening.end.y, opening.width, recovered.rotation].every(Number.isFinite), 'Partial saved defaults produced missing numeric controls');
        check(opening.start.y === endpoint.opening!.start.y && opening.end.x === endpoint.opening!.end.x, 'Missing saved coordinates overwrote valid current coordinates');
        check(opening.width === endpoint.opening!.width && opening.version === 1 && opening.closure === 'zip', 'Reset corrupted width or construction metadata');
        check(JSON.stringify(restored) === snapshot, 'Reset mutated saved state');
        check(JSON.stringify(resetOpening(recovered).opening) === JSON.stringify(opening), 'Recovered defaults are not stable across repeated reset');
      }
      check(JSON.stringify(JSON.parse(JSON.stringify(detail))) === JSON.stringify(detail), 'Save/reload lost opening');
      const invalid = setOpeningEndpoint(detail, bounds, 'end', detail.opening.start);
      check(validateOpening(invalid, bounds).status === 'Invalid' && constructOpenings([invalid], bounds).removed.length === 0, 'Invalid cut was applied');
      const translated = new DOMMatrix().translate(51, -23).rotate(17).scale(.83, 1.17);
      const inverse = transformOpeningPolygons(transformOpeningPolygons(result.removed, translated), translated.inverse());
      check(close(openingArea(result.removed), openingArea(inverse), .01) && result.removed.every((polygon, p) => polygon.every((ring, r) => ring.every((point, i) =>
        close(point[0], inverse[p][r][i][0], 1e-7) && close(point[1], inverse[p][r][i][1], 1e-7)))), 'Layer inverse mapping changed cut geometry');
      check(openingLayerClip(result.removed, translated.inverse()).startsWith('M'), 'Missing layer clipping result');
      if (placement === 'full-front') {
        const belowNeck = detail.opening.start.y + detail.opening.width * 2;
        const frontTorso = polygonClipping.intersection(result.panels.base, [[[0, belowNeck], [2048, belowNeck], [2048, 2048], [0, 2048], [0, belowNeck]]]);
        const baseParts = frontTorso.filter(polygon => openingArea([polygon]) > 1000);
        check(baseParts.length >= 2, `${neck.displayName}: full front failed to split the front torso below the intact rear neck band`);
        check(openingArea(result.panels.bodyHem) < openingArea(geometry.panels.find(panel => panel.id === 'bodyHem')!.polygons), 'Full opening missed hem');
        const wrongAttachment = { ...detail, opening: { ...detail.opening, attachment: 'hem' as const } };
        check(validateOpening(wrongAttachment, bounds).status === validation.status, 'Creation preset still constrained an otherwise valid cut');
        check(openingArea(polygonClipping.xor(constructOpenings([wrongAttachment], bounds).removed, result.removed)) < .02, 'Preset metadata changed the cut geometry');
        const crossing = setDetailTransform(detail, bounds, { rotation: 15 });
        const combined = constructOpenings([detail, crossing], bounds);
        check(openingArea(polygonClipping.intersection(combined.facing, combined.removed)) < .02, 'Overlapping facings refill another opening');
      }
      reports.push({ neck: neck.displayName, placement, status: validation.status, removedArea: Math.round(removed) });
    }
  }
  return { realTemplates: fixtures.length, cases: reports.length, reports, localBooleanCuts: true, legacyPreserved: true, inverseTransforms: true, independentEndpoints: true, freePlacementWithoutSnapping: true, progressiveFabricAndHardware: true, unsupportedContoursSafe: true };
}

export async function verifyOpeningPreview() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:640px;background:white;z-index:10000';
  document.body.append(host);
  const root = createRoot(host);
  const selection = getDefaultGarmentSelection('tshirt', 'slim');
  let bounds: DetailBounds | undefined;
  const receiveBounds = (next: DetailBounds | undefined) => { bounds = next; };
  const base = { garmentType: 'tshirt' as const, color: '#BBBBBB', fit: 'slim', selection, onDetailBoundsChange: receiveBounds, className: 'h-full w-full' };
  try {
    root.render(createElement(TshirtSvgPreview, base));
    for (let i = 0; i < 50 && !bounds?.openingGeometry?.fabric.length; i++) await delay();
    check(bounds?.openingGeometry?.fabric.length, 'Preview did not publish compiled source geometry');
    const detail: ReturnType<typeof createOpening> = { ...createOpening(createGarmentDetail('zip', [], '#888888'), bounds, 'full-front'), zipSliderPosition: 1 };
    const draft = setOpeningEndpoint(detail, bounds, 'end', { x: detail.opening!.end.x + 45, y: detail.opening!.end.y });
    const editor = { part: 'zip' as const, closeUp: false, onPartChange: () => {}, onCloseUpChange: () => {}, draft };
    let edited: typeof detail | undefined;
    root.render(createElement(TshirtSvgPreview, { ...base, garmentDetails: [detail], selectedDetailId: detail.id, onDetailSelect: () => {}, onDetailsChange: (details) => { edited = details.find(candidate => candidate.id === detail.id); }, detailEditor: editor }));
    for (let i = 0; i < 50 && !host.querySelector('[data-opening-facing]'); i++) await delay();
    check(host.querySelector('[data-opening-facing]'), 'Preview did not reconstruct facing edges');
    check(Number(getComputedStyle(host.querySelector('[data-garment-details]')!).zIndex) > Number(getComputedStyle(host.querySelector('[data-opening-construction]')!).zIndex), 'Facing hides the zip teeth, slider and pull');
    check(host.querySelectorAll('[data-opening-cut]').length >= 3, 'Fabric and construction were not cut together');
    check(!host.querySelector('[data-layer-id^="sleeve"] [data-opening-cut]'), 'Preview globally clipped sleeves');
    check(host.querySelectorAll('[aria-label*="opening start"], [aria-label*="opening end"]').length === 2, 'Missing independent endpoint handles');
    check(!host.querySelector('[data-opening-construction] text'), 'Zip endpoint labels should not appear on the garment');
    const hardwareRotation = Number.parseFloat((host.querySelector('[data-detail-id]') as HTMLElement)?.style.transform.replace('rotate(', '') ?? 'NaN');
    check(close(hardwareRotation, detailRotation(draft)), 'Live hardware ignored the opening draft');
    const expected = constructOpenings([draft], bounds);
    check(host.querySelector('[data-opening-facing]')!.getAttribute('d') === openingPolygonPath(expected.facing), 'Live construction ignored the opening draft');
    check(host.querySelector('[data-opening-interior]')?.getAttribute('fill') === '#c3c3c3', 'Opening interior does not match the lighter back fabric');
    check(host.querySelector('[data-opening-interior]')?.getAttribute('d') === openingPolygonPath(expected.removed), 'Interior is not clipped to the actual opening');
    // Decode source artwork with the same local clip used by the preview; fabric at the cut centre is transparent.
    const layers = resolveGarmentLayers({ garmentType: 'tshirt', selection, fit: 'slim' });
    const body = layers.find(layer => layer.id === 'base')!;
    const svg = renderFabricSvg(body.svgRaw, '#BBBBBB');
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const source = parsed.documentElement.innerHTML;
    const image = new Image();
    image.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><defs><clipPath id="cut"><path d="${openingLayerClip(expected.removed)}" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#cut)">${source}</g></svg>`)}`;
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2048;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, 2048, 2048);
    const mid = { x: (draft.opening!.start.x + draft.opening!.end.x) / 2, y: (draft.opening!.start.y + draft.opening!.end.y) / 2 };
    check(context.getImageData(mid.x, mid.y, 1, 1).data[3] === 0, 'Cut only hid the outline; fabric remains filled');
    host.querySelector('[aria-label*="opening end"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }));
    check(edited?.opening?.end.x === draft.opening!.end.x - 10 && edited.opening.start.x === draft.opening!.start.x, 'Endpoint keyboard edit did not commit independently');
    const endpointHandle = host.querySelector<SVGCircleElement>('[aria-label*="opening end"]')!;
    const endpointMatrix = endpointHandle.ownerSVGElement!.getScreenCTM()!;
    const screen = new DOMPoint(draft.opening!.end.x, draft.opening!.end.y).matrixTransform(endpointMatrix);
    const grabbed = new DOMPoint(screen.x + 3, screen.y + 2);
    const inverse = endpointMatrix.inverse();
    const first = grabbed.matrixTransform(inverse);
    const last = new DOMPoint(grabbed.x + 10, grabbed.y - 7).matrixTransform(inverse);
    // Synthetic events cannot acquire native capture; exercise the same handlers and coordinate math.
    Object.defineProperty(endpointHandle, 'setPointerCapture', { configurable: true, value: () => {} });
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) endpointHandle.dispatchEvent(new PointerEvent(type, {
      pointerId: 17, bubbles: true, button: 0, clientX: grabbed.x + (type === 'pointerdown' ? 0 : 10), clientY: grabbed.y + (type === 'pointerdown' ? 0 : -7),
    }));
    Reflect.deleteProperty(endpointHandle, 'setPointerCapture');
    check(edited?.opening && close(edited.opening.end.x, draft.opening!.end.x + last.x - first.x) && close(edited.opening.end.y, draft.opening!.end.y + last.y - first.y), 'Grabbing away from the handle centre jumped the endpoint');
    check(edited.opening.start.x === draft.opening!.start.x && edited.opening.start.y === draft.opening!.start.y, 'Endpoint pointer drag moved the other endpoint');
    const legacy = createGarmentDetail('zip', [detail], '#888888');
    const button = createGarmentDetail('button', [detail, legacy], '#333333');
    const stageDetails = [detail, legacy, button];
    const before = JSON.stringify(stageDetails);
    let stageUpdate = stageDetails;
    const stageProof: { stage: typeof OPENING_PREVIEW_STAGES[number]; cutLayers: number; facings: number; paths: number; hardware: boolean }[] = [];
    for (const openingStage of OPENING_PREVIEW_STAGES) {
      root.render(createElement(TshirtSvgPreview, { ...base, garmentDetails: stageDetails, selectedDetailId: button.id,
        onDetailsChange: (details) => { stageUpdate = details; }, onDetailSelect: () => {}, detailEditor: { ...editor, openingStage } }));
      await delay();
      stageProof.push({ stage: openingStage, cutLayers: host.querySelectorAll('[data-opening-cut]').length,
        facings: host.querySelectorAll('[data-opening-facing]').length, paths: host.querySelectorAll('[data-opening-path]').length,
        hardware: Boolean(host.querySelector(`[data-detail-id="${detail.id}"]`)) });
      const cutExpected = openingStage === 'construction' || openingStage === 'final';
      check(Boolean(host.querySelector('[data-opening-cut]')) === cutExpected, `${openingStage}: wrong fabric-cut visibility`);
      check(Boolean(host.querySelector('[data-opening-facing]')) === cutExpected, `${openingStage}: wrong reconstructed-edge visibility`);
      check(Boolean(host.querySelector('[data-opening-path]')) === (openingStage === 'path'), `${openingStage}: wrong path visibility`);
      check(Boolean(host.querySelector(`[data-detail-id="${detail.id}"]`)) === (openingStage === 'final'), `${openingStage}: wrong opening hardware visibility`);
      check(host.querySelector(`[data-detail-id="${legacy.id}"]`) && host.querySelector(`[data-detail-id="${button.id}"]`), `${openingStage}: unrelated overlay changed`);
      check(JSON.stringify(stageDetails) === before, `${openingStage}: preview mutated saved details`);
      if (openingStage === 'before') {
        host.querySelector(`[data-detail-id="${button.id}"] button`)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        check(stageUpdate.length === 3 && stageUpdate.find(candidate => candidate.id === button.id)!.x !== button.x && JSON.stringify(stageUpdate.find(candidate => candidate.id === detail.id)) === JSON.stringify(detail), 'Editing an unrelated detail removed the hidden opening');
        host.querySelector(`[data-detail-id="${button.id}"] button`)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
        check(stageUpdate.length === 2 && !stageUpdate.some(candidate => candidate.id === button.id) && stageUpdate.some(candidate => candidate.id === detail.id), 'Deleting an unrelated detail failed or deleted the hidden opening');
      }
    }
    root.render(createElement(TshirtSvgPreview, { ...base, garmentDetails: [detail], partColors: { base: '#204060' }, selectedDetailId: null,
      onDetailsChange: () => {}, onDetailSelect: () => {} }));
    await delay();
    check(host.querySelector('[data-opening-cut]') && host.querySelector(`[data-detail-id="${detail.id}"]`), 'Preview outside detail editor did not default to final');
    check(host.querySelector('[data-opening-interior]')?.getAttribute('fill') === '#3b5773', 'Interior did not follow the resolved body colour');
    check(!host.querySelector('[aria-label*="opening start"], [aria-label*="opening end"], [aria-label^="Rotate Zip"], [data-opening-path]'), 'Deselection left editing guides visible');
    return { compiledBoundsPublished: true, draftHardwareAndConstruction: true, endpointHandles: 2, endpointKeyboardCommit: true, endpointPointerOffsetStable: true, rasterCutTransparent: true, sleevesUntouched: true, stages: 4, stageProof, stageEditingPreservesOpenings: true, defaultFinal: true };
  } finally { root.unmount(); host.remove(); }
}
