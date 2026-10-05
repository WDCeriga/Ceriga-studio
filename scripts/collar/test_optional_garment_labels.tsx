import assert from 'node:assert/strict';
import React from 'react';
import { GarmentLabelsPanel } from '../../src/app/components/builder/GarmentLabelsPanel';
import { GarmentLabelsPreview } from '../../src/app/components/builder/GarmentLabelsPreview';
import { garmentPreviewBounds } from '../../src/app/components/builder/garmentPreviewBounds';
import { GarmentLabelOverlay, manualLabelPlacement, constrainNeckLabel } from '../../src/app/components/builder/GarmentLabelOverlay';
import { createGarmentLabel, labelVisible, labelSpecification, labelExportFaces, labelWarnings, normalizeLabel, type GarmentLabel, type LabelCategory } from '../../src/app/data/garmentLabels';

Object.defineProperty(globalThis, 'document', { value: { createElement(name: string) {
  assert.equal(name, 'canvas');
  return { getContext: () => ({ font: '', measureText: (value: string) => ({ width: value.length }) }) };
} }, configurable: true });

// A shallow hook harness exercises callbacks and mount effects without a browser or a garment asset catalogue.
// Child artwork and garment rendering remain covered by the existing browser label tests.
function harness() {
  const slots: any[] = [];
  return (Component: any, props: any) => {
    let cursor = 0;
    const effects: Array<() => void> = [];
    const internals = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    const previous = internals.ReactCurrentDispatcher.current;
    internals.ReactCurrentDispatcher.current = {
      useState(initial: any) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], (next: any) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
      },
      useRef(initial: any) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = { current: initial };
        return slots[index];
      },
      useEffect(effect: () => void, dependencies: any[]) {
        const index = cursor++;
        const previousDependencies = slots[index];
        slots[index] = dependencies;
        if (!previousDependencies || !dependencies || dependencies.some((item, offset) => !Object.is(item, previousDependencies[offset]))) effects.push(effect);
      },
    };
    try {
      const result = Component(props);
      effects.forEach(effect => effect());
      return result;
    } finally { internals.ReactCurrentDispatcher.current = previous; }
  };
}
function elements(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  return [node, ...elements((node.props as any).children)];
}
function text(node: any): string {
  if (Array.isArray(node)) return node.map(text).join(' ');
  if (React.isValidElement(node)) return text((node.props as any).children);
  return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}
const button = (tree: any, label: string) => {
  const result = elements(tree).find(element => element.type === 'button' && (element.props['aria-label'] === label || text(element) === label));
  assert.ok(result, `Missing button: ${label}`);
  return result.props;
};

// Empty imported parts produce null geometry, including while the preview has no usable bounds.
const firstBounds = { minX: 100, minY: 200, maxX: 900, maxY: 1400, centerX: 500, centerY: 800 };
const secondBounds = { minX: 50, minY: 250, maxX: 1100, maxY: 1500, centerX: 575, centerY: 875 };
assert.equal(garmentPreviewBounds([]), undefined);
assert.equal(garmentPreviewBounds([null, null]), undefined, 'All-empty imported geometry must not crash or fabricate bounds');
assert.deepEqual(garmentPreviewBounds([null, firstBounds, null]), { minX: 100, minY: 200, maxX: 900, maxY: 1400 });
assert.deepEqual(garmentPreviewBounds([null, firstBounds, secondBounds, null]), { minX: 50, minY: 200, maxX: 1100, maxY: 1500 }, 'Empty parts must not discard valid imported garment geometry');
assert.deepEqual(garmentPreviewBounds([firstBounds, { ...secondBounds, maxX: secondBounds.minX }]), { minX: 100, minY: 200, maxX: 900, maxY: 1400 }, 'Degenerate bounds must stay excluded');

let labels: GarmentLabel[] = [];
let selectedId: string | null = null;
let changes = 0;
let tagView: 'front' | 'back' = 'front';
const panelProps = (manualPlacement = false) => ({ labels, selectedId, manualPlacement, tagView,
  onSelect: (id: string | null) => { selectedId = id; },
  onChange: (next: GarmentLabel[]) => { labels = next; changes++; },
  onTagViewChange: (side: 'front' | 'back') => { tagView = side; },
});
const renderPanel = harness();
let tree = renderPanel(GarmentLabelsPanel, panelProps());
assert.equal(changes, 0, 'Mount must not create a neck label');
assert.match(text(tree), /Nothing is added automatically/);
for (let index = 0; index < 4; index++) {
  const tabs = elements(tree).filter(element => element.props.role === 'tab');
  const tab = tabs[index];
  assert.ok(tab);
  tab.props.onClick();
  tree = renderPanel(GarmentLabelsPanel, panelProps());
  assert.equal(changes, 0, 'Switching categories must not add labels');
}
button(tree, 'Add label').onClick();
assert.equal(labels.length, 1, 'Explicit Add must create one label');
assert.equal(labels[0].category, 'hand', 'Add must respect the chosen category');
assert.equal(selectedId, labels[0].id);
tree = renderPanel(GarmentLabelsPanel, panelProps());
button(tree, 'Delete label').onClick();
assert.equal(labels.length, 0);
assert.equal(selectedId, null);
const afterDeletion = changes;
harness()(GarmentLabelsPanel, panelProps());
renderPanel(GarmentLabelsPanel, panelProps());
assert.equal(changes, afterDeletion, 'Deleted labels must not resurrect on remount or rerender');

const saved = createGarmentLabel('care');
labels = [saved]; selectedId = saved.id;
const beforeSavedMount = changes;
tree = harness()(GarmentLabelsPanel, panelProps());
assert.equal(changes, beforeSavedMount);
assert.equal(labels[0], saved, 'Opening panel must preserve saved label data');
assert.ok(elements(tree).some(element => element.type === 'button' && element.props.onClick && text(element).includes(saved.brand)));

labels = []; selectedId = null;
const manualPanel = harness();
tree = manualPanel(GarmentLabelsPanel, panelProps(true));
button(tree, 'Add label').onClick();
assert.equal(labels[0].manualPosition, null, 'Imported Add must await a user position');
assert.equal(labelVisible(labels[0], 'front'), false);
tree = manualPanel(GarmentLabelsPanel, panelProps(true));
assert.match(text(tree), /It stays off the garment/);
assert.ok(!elements(tree).some(element => element.props.title === 'Position on garment'));
labels = [{ ...labels[0], manualPosition: { x: .25, y: .7 } }];
tree = manualPanel(GarmentLabelsPanel, panelProps(true));
button(tree, 'Duplicate label').onClick();
assert.equal(labels.at(-1)!.manualPosition, null, 'Duplicated imported label must be positioned explicitly');
tree = manualPanel(GarmentLabelsPanel, panelProps(true));
button(tree, 'Choose placement again').onClick();
assert.equal(labels.at(-1)!.manualPosition, null);

const frontTag = createGarmentLabel('tag');
labels = [frontTag]; selectedId = frontTag.id; tagView = 'front';
const tagPanel = harness();
tree = tagPanel(GarmentLabelsPanel, panelProps());
const beforeSide = changes;
button(tree, 'Back').onClick();
tree = tagPanel(GarmentLabelsPanel, panelProps());
assert.equal(changes, beforeSide, 'Switching tag side must not add anything');
assert.equal(selectedId, null);
assert.match(text(tree), /No tag selected on the back/);

const previewProps = (nextLabels: GarmentLabel[], id: string | null, imported = false) => ({
  labels: nextLabels, selectedId: id, onSelect() {}, onChange() { throw new Error('Preview created a label'); }, tagView: 'back',
  garmentProps: { customAssetState: imported ? { importedGarment: {} } : undefined },
});
for (const [nextLabels, id] of [[[], null], [[frontTag], frontTag.id]] as const) {
  tree = harness()(GarmentLabelsPreview, previewProps([...nextLabels], id));
  assert.match(text(tree), /No labels added|No label is selected/);
  assert.ok(!elements(tree).some(element => 'data-label-camera' in element.props), 'Empty template preview must not show a phantom garment close-up');
  assert.ok(!elements(tree).some(element => element.type === 'button' && text(element) === 'Add label'), 'Preview must not create an assumed neck label');
}
const pending = createGarmentLabel('neck', true);
tree = harness()(GarmentLabelsPreview, previewProps([pending], pending.id, true));
assert.match(text(tree), /Click the garment to position/);
const camera = elements(tree).find(element => 'data-label-camera' in element.props);
assert.ok(camera, 'Unplaced imported label needs its actual garment placement canvas');
assert.match(camera.props.style.transform, /scale\(1\)/);
assert.doesNotMatch(text(tree), /500 mm chest/);

for (const category of ['neck', 'care', 'tag'] as LabelCategory[]) {
  const unplaced = createGarmentLabel(category, true);
  assert.equal(unplaced.manualPosition, null);
  assert.ok(!labelVisible(unplaced, 'front') && !labelVisible(unplaced, 'back'));
  assert.equal(labelSpecification(unplaced).attachment, 'Not positioned');
  assert.equal(manualLabelPlacement(unplaced, undefined, 500), null);
  const placed = normalizeLabel({ ...unplaced, manualPosition: { x: .3, y: .6 }, rotation: 90, exteriorView: 'back' });
  assert.equal(placed.rotation, 90);
  assert.ok(labelVisible(placed, 'back') && !labelVisible(placed, 'front'));
  assert.equal(constrainNeckLabel(placed, [], 500, {}), placed, 'Manual placement must not impose neck anatomy');
  assert.deepEqual(JSON.parse(JSON.stringify(labelSpecification(placed))).manualPosition, { x: .3, y: .6 });
  assert.equal(normalizeLabel({ ...placed, manualPosition: { x: NaN, y: .5 } }).manualPosition, null);
}
assert.equal(createGarmentLabel('neck').manualPosition, undefined, 'Template defaults must keep their original attachment behavior');
assert.ok(labelVisible(createGarmentLabel('neck'), 'front'));
assert.ok(!labelVisible(createGarmentLabel('hand'), 'front'));

let positioned: GarmentLabel[] = [];
tree = harness()(GarmentLabelOverlay, { labels: [pending], selectedId: pending.id, layers: [], view: 'front', manualPlacement: true,
  manualBounds: { minX: 100, minY: 200, maxX: 900, maxY: 1400 }, onChange(next: GarmentLabel[]) { positioned = next; } });
assert.ok(!elements(tree).some(element => 'data-garment-label' in element.props), 'Pending imported label must not be painted on the garment');
const target = elements(tree).find(element => element.props.role === 'button');
assert.ok(target, 'Manual placement must expose an accessible placement target');
target.props.onKeyDown({ key: 'Enter', preventDefault() {} });
assert.deepEqual(positioned[0].manualPosition, { x: .5, y: .5 }, 'Explicit keyboard placement should position the selected label');
for (const imported of [false, true]) {
  labels = []; selectedId = null;
  const handPanel = harness();
  tree = handPanel(GarmentLabelsPanel, panelProps(imported));
  elements(tree).find(element => element.props.role === 'tab' && text(element) === 'Hand Tags').props.onClick();
  tree = handPanel(GarmentLabelsPanel, panelProps(imported));
  assert.equal(labels.length, 0, 'Opening Hand Tags must not create anything');
  button(tree, 'Add label').onClick();
  assert.equal(labels.length, 1);
  assert.equal(labels[0].category, 'hand');
  assert.equal(labels[0].manualPosition, undefined, 'Hand tags must never await garment placement');
  labels = [{ ...labels[0], brand: 'HAND FRONT' }];
  tree = handPanel(GarmentLabelsPanel, panelProps(imported));
  assert.doesNotMatch(text(tree), /Manual placement|Garment attachment|Click the garment preview|position \(%\)/);
  assert.ok(!elements(tree).some(element => ['Choose placement again', 'Restore default placement'].includes(element.props['aria-label'])));
  button(tree, 'Back').onClick();
  assert.equal(labels.length, 1, 'Face switching must not create another hand tag');
  assert.equal(labels[0].exteriorView, 'back');
  assert.equal(labels[0].brand, '');
  labels = [{ ...labels[0], brand: 'HAND BACK' }];
  tree = handPanel(GarmentLabelsPanel, panelProps(imported));
  button(tree, 'Front').onClick();
  assert.equal(labels[0].brand, 'HAND FRONT', 'Front artwork must survive back editing');
  assert.deepEqual(labelExportFaces(labels[0]).map(face => [face.exteriorView, face.brand]), [['front', 'HAND FRONT'], ['back', 'HAND BACK']]);
  const spec = labelSpecification(labels[0]);
  assert.equal(spec.faces!.front!.brand, 'HAND FRONT');
  assert.equal(spec.faces!.back!.brand, 'HAND BACK');
  for (const manualPosition of [undefined, null, { x: .2, y: .7 }]) {
    const legacy = { ...labels[0], manualPosition };
    assert.ok(!labelVisible(legacy, 'front') && !labelVisible(legacy, 'back'), 'Saved hand coordinates must never enable garment rendering');
    assert.equal(normalizeLabel(legacy).manualPosition, undefined);
    assert.equal(manualLabelPlacement(legacy, { minX: 0, minY: 0, maxX: 2048, maxY: 2048 }, 500), null);
    assert.equal(labelSpecification(legacy).attachment, 'Standalone hand tag');
    assert.ok(!('manualPosition' in JSON.parse(JSON.stringify(labelSpecification(legacy)))));
    assert.ok(!labelWarnings(legacy).some(warning => warning.includes('position on the garment')));
    const handPreview = harness()(GarmentLabelsPreview, previewProps([legacy], legacy.id, imported));
    assert.ok(elements(handPreview).some(element => 'data-isolated-label' in element.props));
    assert.ok(!elements(handPreview).some(element => 'data-label-camera' in element.props));
    assert.doesNotMatch(text(handPreview), /Not positioned|Click the garment to position|Manual garment position/);
    const handOverlay = harness()(GarmentLabelOverlay, { labels: [legacy], selectedId: legacy.id, layers: [], view: 'front', manualPlacement: imported,
      manualBounds: { minX: 0, minY: 0, maxX: 2048, maxY: 2048 }, onChange() { throw new Error('Hand tag placement mutation'); } });
    assert.ok(!elements(handOverlay).some(element => 'data-garment-label' in element.props || 'data-label-placement-target' in element.props));
  }
}
console.log('PASS optional labels: null/empty/mixed bounds, no auto-creation, sewn-label manual placement, standalone hand tags, saved-coordinate suppression, front/back editing/export, template compatibility');
