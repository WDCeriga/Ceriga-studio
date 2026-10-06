import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FabricControls } from '../../src/app/components/builder/FabricControls';
import { FABRIC_LIBRARY, type FabricAssignments, type FabricPart } from '../../src/app/data/garmentFabrics';

export function runFabricControlTests() {
  let checks = 0;
  function check(condition: unknown, message: string) {
    if (!condition) throw new Error(message);
    checks++;
  }
  const parts: FabricPart[] = [{ id: 'body', label: 'Main body', role: 'body' }];
  const material = FABRIC_LIBRARY[0];
  const value: FabricAssignments = { assignments: { body: material.id }, unlinkedGroups: [] };
  let changes = 0;
  const markup = renderToStaticMarkup(<FabricControls parts={parts} value={value} onChange={() => changes++} />);
  check(markup.includes('Apply fabric to'), 'Existing sidebar must expose the material part selector');
  check(markup.includes('Fabric Type'), 'Existing fabric label must remain');
  check(markup.includes('Composition:'), 'Composition must be shown separately');
  check(markup.includes(`${material.gsm} GSM`), 'Selected part must show its fabric weight');
  check(markup.includes('Reset fabrics'), 'Reset must be explicitly material-only');
  check(markup.includes('Quick preset'), 'Construction presets must remain available');
  check(!markup.includes('role="alert"'), 'Reviewable procedural material must render without an unavailable warning');
  check(!markup.includes('scan ready'), 'Procedural material must not be described as a real scan');
  const verifiedMarkup = renderToStaticMarkup(<FabricControls parts={parts} value={{ assignments: { body: 'denim-twill' }, unlinkedGroups: [] }} onChange={() => changes++} />);
  check(!verifiedMarkup.includes('data-fabric-availability="unresolved"'), 'Verified denim must not show a missing-source warning');
  const unknownMarkup = renderToStaticMarkup(<FabricControls parts={parts} value={{ assignments: { body: 'unknown-fabric' }, unlinkedGroups: [] }} onChange={() => changes++} />);
  check(unknownMarkup.includes('role="alert"') && unknownMarkup.includes('unknown-fabric') && unknownMarkup.includes('Unknown saved fabric ID.'), 'Unknown saved IDs must fail visibly');
  check(unknownMarkup.includes('Plain colour is not a fabric preview.'), 'Unresolved assignment must not imply texture success');
  check(changes === 0, 'Rendering controls must not mutate builder history/state');
  check(value.assignments.body === material.id, 'Controls must not mutate input assignments');
  const oldMarkup = renderToStaticMarkup(<FabricControls parts={parts} legacyFabric="jersey" onChange={() => changes++} />);
  check(oldMarkup.includes('Previous specification: jersey'), 'Legacy specification must be retained without inventing assignments');
  check(!oldMarkup.includes('Reset fabrics'), 'Older projects must not acquire implicit assignments');
  const emptyMarkup = renderToStaticMarkup(<FabricControls parts={[]} onChange={() => changes++} />);
  check(emptyMarkup.includes('Select garment parts'), 'Absent geometry must be handled without a fabricated part');
  const pairedParts: FabricPart[] = [
    { id: 'sleeveLeft', label: 'Left sleeve', role: 'sleeve', group: 'sleeves' },
    { id: 'sleeveRight', label: 'Right sleeve', role: 'sleeve', group: 'sleeves' },
  ];
  const unlinked: FabricAssignments = { assignments: { sleeveLeft: material.id, sleeveRight: FABRIC_LIBRARY[1].id }, unlinkedGroups: ['sleeves'] };
  const mixedMarkup = renderToStaticMarkup(<FabricControls parts={pairedParts} value={unlinked} onChange={() => changes++} />);
  check(mixedMarkup.includes('Mixed fabrics'), 'A group with different side assignments must not show a misleading shared fabric');
  check(mixedMarkup.includes('Link matching parts'), 'Paired fabrics must expose independent linking');
  check(!mixedMarkup.includes('Composition:'), 'Mixed groups must not imply one shared composition');
  check(!mixedMarkup.includes('checked=""'), 'Unlinked state must be reflected by the checkbox');
  const linkedMarkup = renderToStaticMarkup(<FabricControls parts={pairedParts} onChange={() => changes++} />);
  check(linkedMarkup.includes('checked=""'), 'Matching part fabrics are linked by default');
  return { checks };
}
