import assert from 'node:assert/strict';
import React from 'react';
import { garmentRegressionFixture } from '../../src/app/data/garmentRegressionFixtures';
import { generateEstimatedBack } from '../../src/app/data/importedGarmentBack';
import { mergeImportedGarmentView } from '../../src/app/data/importedGarment';
import { resolveProductSvgType } from '../../src/app/data/garmentSvgCatalog';
import { TshirtSvgPreview } from '../../src/app/components/builder/TshirtSvgPreview';
import { GarmentLabelOverlay } from '../../src/app/components/builder/GarmentLabelOverlay';
import { createGarmentLabel, type GarmentLabel } from '../../src/app/data/garmentLabels';

// Minimal affine DOM geometry for exercising real preview/overlay callbacks without a browser.
class Point {
  constructor(public x = 0, public y = 0) {}
  matrixTransform(matrix: Matrix) { return matrix.transformPoint(this); }
}
class Matrix {
  a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  constructor(values?: number[]) { if (values) [this.a, this.b, this.c, this.d, this.e, this.f] = values; }
  multiply(m: Matrix) { return new Matrix([
    this.a * m.a + this.c * m.b, this.b * m.a + this.d * m.b,
    this.a * m.c + this.c * m.d, this.b * m.c + this.d * m.d,
    this.a * m.e + this.c * m.f + this.e, this.b * m.e + this.d * m.f + this.f,
  ]); }
  translate(x: number, y: number) { return this.multiply(new Matrix([1, 0, 0, 1, x, y])); }
  scale(x: number, y = x) { return this.multiply(new Matrix([x, 0, 0, y, 0, 0])); }
  rotate(angle: number) { const r = angle * Math.PI / 180; return this.multiply(new Matrix([Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0])); }
  inverse() { const det = this.a * this.d - this.b * this.c; return new Matrix([this.d / det, -this.b / det, -this.c / det, this.a / det, (this.c * this.f - this.d * this.e) / det, (this.b * this.e - this.a * this.f) / det]); }
  transformPoint(p: Point) { return new Point(this.a * p.x + this.c * p.y + this.e, this.b * p.x + this.d * p.y + this.f); }
  toString() { return `matrix(${this.a} ${this.b} ${this.c} ${this.d} ${this.e} ${this.f})`; }
}
Object.assign(globalThis, { DOMMatrix: Matrix, DOMPoint: Point });

function render(Component: any, props: any) {
  const internals = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  const previous = internals.ReactCurrentDispatcher.current;
  internals.ReactCurrentDispatcher.current = {
    useState: (value: any) => [typeof value === 'function' ? value() : value, () => {}],
    useRef: (current: any) => ({ current }), useMemo: (fn: any) => fn(), useCallback: (fn: any) => fn,
    useEffect() {}, useLayoutEffect() {}, useId: () => 'fixture-label',
  };
  try { return Component(props); } finally { internals.ReactCurrentDispatcher.current = previous; }
}
function elements(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  return React.isValidElement(node) ? [node, ...elements((node.props as any).children)] : [];
}
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
let cases = 0;
for (const type of ['hoodie', 'tshirt'] as const) {
  const front = garmentRegressionFixture(type, false);
  const estimated = generateEstimatedBack(front);
  assert.ok(estimated.available, `${type} must support estimated back`);
  if (!estimated.available) continue;
  const merged = mergeImportedGarmentView(estimated.garment, garmentRegressionFixture(type, true), 'back');
  for (const [stage, garment] of [['front-only', front], ['inferred-back', estimated.garment], ['real-back-merged', merged]] as const) {
    for (const view of ['front', 'back'] as const) {
      if (!garment.parts.some(part => part.view === view)) continue;
      let labels = [{ ...createGarmentLabel('neck', true), exteriorView: view }];
      const pending = labels[0];
      const tree = render(TshirtSvgPreview, {
        garmentType: resolveProductSvgType(garment.manifest.garmentType) ?? 'tshirt', color: '#86a9a2', selection: {}, detailView: view,
        customAssetState: { importedGarment: garment, importedPartColors: {} }, garmentLabels: labels,
        labelEditor: { selectedId: pending.id, interior: false, onChange(next: GarmentLabel[]) { labels = next; } },
      });
      const overlay = elements(tree).find(element => element.type === GarmentLabelOverlay);
      assert.ok(overlay, `${type}/${stage}/${view}: overlay missing`);
      const bounds = overlay.props.manualBounds;
      assert.ok(bounds && bounds.maxX > bounds.minX && bounds.maxY > bounds.minY, `${type}/${stage}/${view}: actual preview omitted imported bounds`);
      const parts = garment.parts.filter(part => part.view === view);
      near(bounds.minX, Math.min(...parts.map(part => part.geometryBounds[0])) * 2048);
      near(bounds.maxY, Math.max(...parts.map(part => part.geometryBounds[3])) * 2048);
      const pendingTree = render(GarmentLabelOverlay, overlay.props);
      const target = elements(pendingTree).find(element => 'data-label-placement-target' in element.props);
      assert.ok(target, `${type}/${stage}/${view}: accessible placement surface missing`);
      assert.equal(target.props.role, 'button'); assert.equal(target.props.tabIndex, 0);
      assert.ok(!elements(pendingTree).some(element => 'data-garment-label' in element.props));
      target.props.onKeyDown({ key: 'Enter', preventDefault() {} });
      near(labels[0].manualPosition!.x, .5); near(labels[0].manualPosition!.y, .5);
      target.props.onKeyDown({ key: ' ', preventDefault() {} });
      near(labels[0].manualPosition!.x, .5); near(labels[0].manualPosition!.y, .5);
      const screen = new Matrix().translate(30, 70).scale(.25);
      (pendingTree.ref as any).current = { getScreenCTM: () => screen };
      const click = screen.transformPoint(new Point(bounds.minX + (bounds.maxX - bounds.minX) * .3, bounds.minY + (bounds.maxY - bounds.minY) * .6));
      target.props.onPointerDown({ button: 0, clientX: click.x, clientY: click.y, preventDefault() {}, stopPropagation() {} });
      near(labels[0].manualPosition!.x, .3); near(labels[0].manualPosition!.y, .6);
      const placedTree = render(GarmentLabelOverlay, { ...overlay.props, labels });
      assert.ok(elements(placedTree).some(element => element.props['data-garment-label'] === pending.id), 'Positioned label must render');
      assert.ok(!elements(placedTree).some(element => 'data-label-placement-target' in element.props), 'Placement surface must disappear after placement');
      for (const manualPosition of [undefined, null, { x: .3, y: .6 }]) {
        const hand = { ...createGarmentLabel('hand', true), exteriorView: view, manualPosition };
        const handTree = render(TshirtSvgPreview, {
          garmentType: resolveProductSvgType(garment.manifest.garmentType) ?? 'tshirt', color: '#86a9a2', selection: {}, detailView: view,
          customAssetState: { importedGarment: garment, importedPartColors: {} }, garmentLabels: [hand],
          labelEditor: { selectedId: hand.id, interior: false, onChange() { throw new Error('Hand tags cannot be placed'); } },
        });
        const handOverlay = elements(handTree).find(element => element.type === GarmentLabelOverlay);
        if (handOverlay) assert.ok(!elements(render(GarmentLabelOverlay, handOverlay.props)).some(element =>
          'data-garment-label' in element.props || 'data-label-placement-target' in element.props), `${type}/${stage}/${view}: hand tag rendered on garment`);
      }
      cases++;
    }
  }
}
console.log(`PASS imported label placement: ${cases} actual preview cases (hoodie/tshirt, front/inferred back/merged real back), pointer and keyboard placement, rendered labels`);
