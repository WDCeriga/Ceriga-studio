import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { StudioColorField } from '../../src/app/components/builder/StudioColorField';
import { FabricControls } from '../../src/app/components/builder/FabricControls';
import { FABRIC_LIBRARY, resolvePartFabric, type FabricAssignments, type FabricPart } from '../../src/app/data/garmentFabrics';

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
  check(oldMarkup.includes('Garment default') && oldMarkup.includes('Reset fabrics'), 'Older projects must expose garment material defaults without mutating saved assignments');
  const emptyMarkup = renderToStaticMarkup(<FabricControls parts={[]} onChange={() => changes++} />);
  check(emptyMarkup.includes('Select garment parts'), 'Absent geometry must be handled without a fabricated part');
  const pairedParts: FabricPart[] = [
    { id: 'sleeveLeft', label: 'Left sleeve', role: 'sleeve', group: 'sleeves' },
    { id: 'sleeveRight', label: 'Right sleeve', role: 'sleeve', group: 'sleeves' },
  ];
  const unlinked: FabricAssignments = { assignments: { sleeveLeft: material.id, sleeveRight: FABRIC_LIBRARY[1].id }, unlinkedGroups: ['sleeves'] };
  const mixedMarkup = renderToStaticMarkup(<FabricControls parts={pairedParts} value={unlinked} selectedPartId="group:sleeves" onChange={() => changes++} />);
  check(mixedMarkup.includes('Mixed fabrics'), 'A group with different side assignments must not show a misleading shared fabric');
  check(mixedMarkup.includes('Link matching parts'), 'Paired fabrics must expose independent linking');
  check(!mixedMarkup.includes('Composition:'), 'Mixed groups must not imply one shared composition');
  check(/<input type="checkbox"\s*\/>Link matching parts/.test(mixedMarkup), 'Unlinked state must be reflected by its checkbox');
  const linkedMarkup = renderToStaticMarkup(<FabricControls parts={pairedParts} selectedPartId="sleeveRight" onChange={() => changes++} />);
  check(linkedMarkup.includes('checked=""'), 'Matching part fabrics are linked by default');
  check(linkedMarkup.includes('Right sleeve'), 'Selecting a linked member must retain its actual label');
  check(markup.includes('Garment default'), 'No selection must target garment default rather than body');
  check(markup.includes('Match exterior fabric') && markup.includes('Match exterior colour'), 'Interior matching controls must be independently available');
  check(!markup.includes('id="interior-fabric-type"') && !markup.includes('aria-label="Interior colour"'), 'Interior controls must default to exterior matching');
  check(markup.includes('Lining is separate'), 'Lining must not be presented as fabric reverse');
  check((markup.match(/draggable="true"/g) ?? []).length === FABRIC_LIBRARY.length, 'Every fabric card must support dragging');
  check(markup.includes('drag and drop') && markup.includes('aria-describedby='), 'Fabric dragging must have accessible instructions');
  const customInterior = renderToStaticMarkup(<FabricControls parts={parts} value={{ ...value, interior: { matchExteriorFabric: false, matchExteriorColour: false, fabricId: 'mesh', colour: '#123456' } }} onChange={() => changes++} technicalView onTechnicalViewChange={() => {}} />);
  check(customInterior.includes('id="interior-fabric-type"') && customInterior.includes('aria-label="Interior colour"'), 'Independent interior fabric and colour must be editable');
  check(customInterior.includes('Technical / interior view (view only)'), 'Technical view must be labelled view-only');
  const colors = renderToStaticMarkup(<StudioColorField value="#abc" onChange={() => changes++} mainColors={['#abc', 'invalid']} popularColors={['123456']} />);
  check(colors.includes('Colour #AABBCC') && colors.includes('Colour #123456'), 'Colour swatches must normalize drag colours');
  check(!colors.includes('Colour INVALID') && (colors.match(/draggable="true"/g) ?? []).length === 3, 'Invalid swatches must not create drag payloads');
  check(changes === 0, 'Rendering additional controls must not mutate state');
  return { checks };
}

export async function runFabricControlInteractions() {
  let checks = 0;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); checks++; };
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const parts: FabricPart[] = [
    { id: 'body', label: 'Main body', role: 'body' },
    { id: 'left', label: 'Left sleeve', role: 'sleeve', group: 'sleeves' },
    { id: 'right', label: 'Right sleeve', role: 'sleeve', group: 'sleeves' },
    { id: 'source-region-17', label: 'Imported sleeve', role: 'panel', materialCategory: 'sleeves' },
    { id: 'lining', label: 'Separate lining', role: 'interior', surface: 'lining' },
  ];
  let value: FabricAssignments | undefined;
  let selected: string | null = null;
  let technicalView = false;
  let changes = 0;
  const selectedCallbacks: (string | null)[] = [];
  const render = () => flushSync(() => root.render(<FabricControls parts={parts} garmentType="hoodie" value={value} selectedPartId={selected}
    onSelectPart={id => { selectedCallbacks.push(id); selected = id; render(); }} onChange={next => { value = next; changes++; render(); }}
    technicalView={technicalView} onTechnicalViewChange={next => { technicalView = next; render(); }} />));
  const button = (name: string) => {
    const found = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(item => item.getAttribute('aria-label') === name || item.textContent === name);
    if (!found) throw new Error(`Button missing: ${name}`);
    return found;
  };
  const toggle = (name: string) => {
    const found = Array.from(host.querySelectorAll('label')).find(item => item.textContent?.trim() === name)?.querySelector('input');
    if (!found) throw new Error(`Toggle missing: ${name}`);
    found.click();
  };
  const selectOption = async (id: string, label: string) => {
    host.querySelector(`#${id}`)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(item => item.textContent === label);
    if (!option) throw new Error(`Option missing: ${label}`);
    option.click();
    await new Promise(resolve => setTimeout(resolve, 0));
  };
  const drag = (node: HTMLElement) => {
    const dataTransfer = new DataTransfer();
    node.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
    return { payload: JSON.parse(dataTransfer.getData('application/x-ceriga-material')), effect: dataTransfer.effectAllowed };
  };
  try {
    render();
    check(changes === 0 && host.querySelector('#fabric-part')?.textContent === 'Garment default', 'Initial target must be garment default without a write');
    button('Apply Denim twill fabric').click();
    check(value?.garmentDefault === 'denim-twill' && Object.keys(value.assignments).length === 0, 'Default choice must not create body-only assignments');
    const beforeCategorySelection = changes;
    await selectOption('fabric-part', 'Sleeve category default');
    check(selected === null && host.querySelector('#fabric-part')?.textContent === 'Sleeve category default', 'Category selection must clear native selection and retain its own target');
    check(changes === beforeCategorySelection, 'Selecting category must not duplicate inherited state');
    button('Apply Waffle knit fabric').click();
    check(value?.categoryDefaults?.sleeves === 'waffle' && Object.keys(value.assignments).length === 0, 'Category choice must only write category defaults');
    check(parts.filter(part => ['left', 'right', 'source-region-17'].includes(part.id)).every(part => resolvePartFabric(value, part, parts)?.id === 'waffle'), 'Native and semantic imported sleeves must inherit one shared category default');
    check(resolvePartFabric(value, parts[0], parts)?.id === 'denim-twill', 'Sleeve category default must not override garment body');
    selected = 'right'; render();
    check(host.querySelector('#fabric-part')?.textContent === 'Right sleeve', 'Linked member must show actual selection');
    button('Apply Mesh fabric').click();
    check(value?.assignments.left === 'mesh' && value.assignments.right === 'mesh', 'Linked part choice must update matching parts');
    toggle("Link matching parts' fabrics");
    button('Apply Single jersey fabric').click();
    check(value?.assignments.right === 'single-jersey' && value.assignments.left === 'mesh', 'Unlinked choice must only update selected member');
    await selectOption('fabric-part', 'Sleeve category default');
    button('Apply French terry fabric').click();
    check(value?.categoryDefaults?.sleeves === 'french-terry' && value.assignments.right === 'single-jersey' && value.assignments.left === 'mesh', 'Category edits must preserve explicit individual and group overrides');
    check(resolvePartFabric(value, parts[2], parts)?.id === 'single-jersey' && resolvePartFabric(value, parts[3], parts)?.id === 'french-terry', 'Explicit part override must win while unassigned imported sleeve follows category');
    check(button('Apply French terry fabric').getAttribute('aria-pressed') === 'true', 'Category target must show its own default, not a member override');
    await selectOption('fabric-part', 'Right sleeve');
    button('Reset selected part fabric').click();
    check(!value?.assignments.right && value?.assignments.left === 'mesh' && value.garmentDefault === 'denim-twill', 'Part reset must remove only relevant overrides');
    check(resolvePartFabric(value, parts[2], parts)?.id === 'french-terry', 'Reset explicit part must reveal category inheritance without copying it');
    toggle("Link matching parts' fabrics");
    button('Reset selected part fabric').click();
    check(!value?.assignments.left && !value?.assignments.right, 'Linked reset must remove both member overrides');
    await selectOption('fabric-part', 'Sleeve category default');
    button('Reset category fabric').click();
    check(!value?.categoryDefaults?.sleeves && resolvePartFabric(value, parts[2], parts)?.id === 'denim-twill', 'Category reset must restore garment inheritance without explicit assignments');
    await selectOption('fabric-part', 'Sleeves');
    button('Apply Mesh fabric').click();
    check(value?.assignments.left === 'mesh' && value.assignments.right === 'mesh' && !value.categoryDefaults?.sleeves, 'Explicit matching-parts group must remain separate from category defaults');
    button('Reset selected part fabric').click();
    check(selectedCallbacks.every(id => id === null || parts.some(part => part.id === id)), 'Category and group menu IDs must never leak through selected-part callback');
    await selectOption('fabric-part', 'Garment default');
    check(selected === null && host.querySelector('#fabric-part')?.textContent === 'Garment default', 'Choosing garment default must clear selected part');
    selected = 'lining'; render();
    button('Apply Mesh fabric').click();
    toggle('Match exterior fabric');
    toggle('Match exterior colour');
    check(value?.interior?.matchExteriorFabric === false && value.interior.matchExteriorColour === false, 'Interior matching toggles must be independent');
    check(!!host.querySelector('#interior-fabric-type') && !!host.querySelector('[aria-label="Interior colour"]'), 'Disabled matching must expose independent controls');
    await selectOption('interior-fabric-type', 'Brushed fleece');
    check(value?.interior?.fabricId === 'brushed-fleece' && value.assignments.lining === 'mesh', 'Independent reverse fabric must not alter separate lining');
    const swatch = host.querySelector<HTMLButtonElement>('[aria-label="Colour #3B82F6"]')!;
    swatch.click();
    check(value?.interior?.colour === '#3B82F6' && value.assignments.lining === 'mesh', 'Interior colour must not alter lining assignment');
    toggle('Match exterior colour');
    check(value?.interior?.matchExteriorFabric === false && value.interior.matchExteriorColour === true, 'Colour matching must not relink fabric');
    const beforeView = JSON.stringify(value), beforeChanges = changes;
    toggle('Technical / interior view (view only)');
    check(technicalView && JSON.stringify(value) === beforeView && changes === beforeChanges, 'Technical view must not edit material state');
    const fabricDrag = drag(button('Apply French terry fabric'));
    check(fabricDrag.payload.kind === 'fabric' && fabricDrag.payload.fabricId === 'french-terry', 'Fabric drag must carry canonical material payload');
    button('Reset fabrics to material defaults').click();
    check(value?.garmentDefault === 'french-terry' && Object.keys(value.assignments).length === 0 && value.unlinkedGroups.length === 0, 'Whole reset must restore garment defaults and clear overrides/link exceptions');
    check(value?.interior?.matchExteriorFabric === true && value.interior.matchExteriorColour === true, 'Whole reset must restore interior matching');
    let colour = '';
    flushSync(() => root.render(<StudioColorField value="#abc" onChange={next => { colour = next; }} mainColors={['#abc', 'invalid']} popularColors={['123456']} />));
    const colourDrag = drag(button('Colour #AABBCC'));
    check(colourDrag.payload.kind === 'colour' && colourDrag.payload.colour === '#AABBCC', 'Preset drag must normalize the colour payload');
    check(drag(button('Open colour picker')).payload.colour === '#AABBCC', 'Current colour swatch must also be draggable');
    button('Colour #123456').click();
    check(colour === '#123456', 'Dragging must preserve ordinary swatch click behavior');
    flushSync(() => root.render(<StudioColorField value="invalid" onChange={() => {}} mainColors={[]} popularColors={[]} />));
    check(button('Open colour picker').draggable === false, 'Invalid current colour must not be draggable');
  } finally {
    flushSync(() => root.unmount());
    host.remove();
  }
  return { checks };
}
