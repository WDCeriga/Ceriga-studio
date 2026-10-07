import React from 'react';
import clipping from 'polygon-clipping';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGarmentRegressionFixture } from '../../src/app/data/garmentRegressionFixtures';
import { normalizeImportedGarment, type ImportedPart, type ImportedPoint } from '../../src/app/data/importedGarment';
import { cleanBackExterior, structuredBackParts } from '../../src/app/data/importedGarmentBackStructure';
import { generateEstimatedBack, regenerateEstimatedBack } from '../../src/app/data/importedGarmentBack';
import { EstimatedBackComparison } from '../../src/app/components/builder/EstimatedBackComparison';
import captured from './test_imported_garment_back_trace_fixtures.json';

export function createStructuredBackFixture(name: keyof typeof captured) {
  const base = createGarmentRegressionFixture(name), source = captured[name];
  const svg = (outline: ImportedPoint[], ink: boolean) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path d="M${outline.map(p => p.map(n => n * 2048).join(',')).join('L')}Z" fill="${ink ? 'none' : '#000000'}"${ink ? ' stroke="#172033" stroke-width="2"' : ''}/></svg>`;
  const parts = source.parts.map(item => ({ ...base.parts[0], ...item, view: 'front', outline: item.outline,
    svg: svg(item.outline as ImportedPoint[], item.structuralRole === 'source-ink'), constructionSvg: svg(item.outline as ImportedPoint[], true),
    stitchSvg: '<svg xmlns="http://www.w3.org/2000/svg"/>', attachmentTo: null, symmetryPartner: null,
    boundary: { boundaryType: 'panel-edge', confidence: 1, evidence: 'Captured front technical geometry.' },
  })) as ImportedPart[];
  return normalizeImportedGarment({ ...base, parts, detailLayers: [], constructionRegions: undefined,
    manifest: { ...base.manifest, garmentType: source.garmentType, subtype: source.subtype },
  });
}

export function verifyStructuredBack() {
  let checks = 0;
  const check = (condition: unknown, message: string) => { checks++; if (!condition) throw new Error(message); };
  for (const name of ['hoodie', 'tee', 'jacket'] as const) {
    const front = createStructuredBackFixture(name), before = JSON.stringify(front), result = generateEstimatedBack(front);
    if (!result.available) throw new Error(result.reason);
    const back = result.garment, report = back.manifest.backView!.inference!.structure!;
    check(back.manifest.backView!.inference!.method === 'structured-front-v3', `${name}: missing structured pipeline`);
    check(report.source === 'front-technical-outline-and-regions' && report.attempt <= 2, `${name}: missing bounded quality gate`);
    check(report.silhouetteDifference < .035, `${name}: excessive silhouette change`);
    check(report.contourPointsAfter < report.contourPointsBefore, `${name}: noisy contour was not reduced`);
    check(report.checks.length === (name === 'jacket' ? 9 : 7), `${name}: missing essential component measurements`);
    for (const dimension of report.checks) {
      check(Math.abs(dimension.frontDerivedWidth - dimension.backWidth) < .012, `${name}: width mismatch`);
      check(Math.abs(dimension.frontDerivedHeight - dimension.backHeight) < .012, `${name}: height mismatch`);
      check(dimension.sourceIds.every(id => front.parts.some(p => p.id === id)), `${name}: missing front provenance`);
    }
    const rearParts = back.parts.filter(p => p.view === 'back');
    const tabs = rearParts.filter(p => p.structuralRole === 'cuff-tab');
    check(tabs.length === (name === 'jacket' ? 2 : 0), `${name}: missing or invented cuff tabs`);
    for (const tab of tabs) {
      const source = front.parts.find(p => p.id === tab.estimatedFromPartId)!;
      const cuff = rearParts.find(p => p.id === tab.attachmentTo)!;
      check(source?.name.includes('cuff adjustment tab'), 'Tab inherited a pocket or throat flap');
      check(cuff?.semanticType === 'cuff' && cuff.id.includes(tab.id.includes('-left-') ? '-left-' : '-right-'), 'Tab attached to the wrong cuff');
      check(clipping.xor([[source.outline!]], [[tab.outline!]]).length === 0, 'Smoothing changed the source-supported tab outline');
      check(tab.id.includes('-left-') ? tab.bounds[0] < cuff.bounds[0] : tab.bounds[2] > cuff.bounds[2], 'Tab no longer protrudes past the cuff edge');
      check(tab.colorable && tab.editableIndependently && tab.builderCategory === 'hem-cuffs', 'Tab is not independently editable cuff fabric');
      check(tab.colourGroup !== cuff.colourGroup && tab.fabricGroup !== cuff.fabricGroup, 'Tab shares cuff appearance controls');
      check(rearParts.find(p => p.id === tab.symmetryPartner)?.structuralRole === 'cuff-tab', 'Missing opposite cuff-tab link');
      check(back.manifest.backView!.constructionRegions!.regions.some(r => r.id === tab.id && r.parentRegionId === cuff.id), 'Tab missing from selectable construction regions');
      for (const part of rearParts.filter(p => p.id !== tab.id)) check(clipping.intersection([[tab.outline!]], [[part.outline!]]).length === 0, `Tab overlaps ${part.id}`);
    }
    check(rearParts.filter(p => p.semanticType === 'flap').every(p => p.structuralRole === 'cuff-tab'), 'Ordinary front flaps leaked into the back');
    check(JSON.stringify(front) === before, `${name}: mutated front`);
    check(JSON.stringify(generateEstimatedBack(front)) === JSON.stringify(result), `${name}: nondeterministic output`);
    check(JSON.stringify(normalizeImportedGarment(JSON.parse(JSON.stringify(back))).manifest.backView!.inference!.structure) === JSON.stringify(report), `${name}: report lost on reload`);
    const regenerated = regenerateEstimatedBack(back);
    check(regenerated.available && JSON.stringify(regenerated.garment.parts.filter(p => p.view === 'back')) === JSON.stringify(back.parts.filter(p => p.view === 'back')), `${name}: regeneration changed unchanged geometry`);
    const markup = renderToStaticMarkup(<EstimatedBackComparison value={back}/>);
    for (const heading of ['Front technical drawing', 'Clean estimated back', 'Editable back regions', 'Front-derived proportion checks']) check(markup.includes(heading), `${name}: missing ${heading}`);
    check(markup.includes('Later manual edits are not covered'), `${name}: stale report could be mistaken for live validation`);
    console.log(`${name}: ${report.contourPointsBefore} → ${report.contourPointsAfter} vertices, ${(report.silhouetteDifference * 100).toFixed(2)}% silhouette difference`);
  }
  const withoutTabs = createStructuredBackFixture('jacket');
  withoutTabs.parts = withoutTabs.parts.filter(p => !/cuff adjustment tab/i.test(p.name));
  check(structuredBackParts(withoutTabs)!.parts.length === 7, 'Invented cuff tabs without front semantic evidence');
  const oneSided = createStructuredBackFixture('jacket');
  oneSided.parts = oneSided.parts.filter(p => p.id !== 'front-cuff-tab-right');
  const oneSidedTabs = structuredBackParts(oneSided)!.parts.filter(p => p.structuralRole === 'cuff-tab');
  check(oneSidedTabs.length === 1 && oneSidedTabs[0].symmetryPartner === null, 'Invented an unobserved opposite cuff tab');
  for (const invalidTab of ['detached', 'oversized', 'transformed'] as const) {
    const front = createStructuredBackFixture('jacket');
    const tab = front.parts.find(p => p.id === 'front-cuff-tab-left')!;
    if (invalidTab === 'detached') tab.outline = tab.outline!.map(([x, y]) => [x, y - .65]);
    if (invalidTab === 'oversized') tab.outline = [[.1, .5], [.9, .5], [.9, .9], [.1, .9]];
    if (invalidTab === 'transformed') tab.transform = { x: .01, y: 0, scale: 1, rotation: 0 };
    check(!generateEstimatedBack(front).available, `Accepted ${invalidTab} cuff tab`);
  }
  const simple: ImportedPoint[] = [[.2, .2], [.8, .2], [.8, .8], [.2, .8]];
  check(JSON.stringify(cleanBackExterior(simple, .003)) === JSON.stringify(simple), 'Already-clean technical corners changed');
  const invalid = createStructuredBackFixture('jacket');
  invalid.parts.find(p => p.structuralRole === 'source-ink')!.outline = [[0, 0], [1, 1], [NaN, 0]];
  check(!generateEstimatedBack(invalid).available, 'Invalid source geometry accepted');
  check(structuredBackParts(createGarmentRegressionFixture('skirt')) === undefined, 'Unsupported template changed legacy family behavior');
  return { checks };
}
