import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
await build({ entryPoints: ['src/app/components/builder/OrderQuantitiesStudio.tsx', 'src/app/data/orderQuantities.ts'], bundle: true, platform: 'node', format: 'esm', outdir: 'node_modules/.cache/order-studio-checks', entryNames: '[name]', loader: { '.css': 'empty', '.svg': 'text' }, external: ['react', 'react-dom', 'lucide-react', '@radix-ui/react-select'], jsx: 'automatic' });
const model = await import('../node_modules/.cache/order-studio-checks/orderQuantities.js');
const { OrderQuantitiesStudio, OrderRequestInspector } = await import('../node_modules/.cache/order-studio-checks/OrderQuantitiesStudio.js');
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log('PASS ' + name); };
const renderInspector = plan => renderToStaticMarkup(createElement(OrderRequestInspector, {plan,onChange(){},onContinue(){}}));
for (const mode of ['techpack', 'custom_clothing']) {
  const plan = model.defaultOrderQuantityPlan(mode);
  check(`${mode} defaults to one sample`, () => {assert.equal(model.sumBreakdown(plan.sample.bySize),1);assert.equal(model.isSampleQuantityValid(plan),true);});
  check(`${mode} allows a single sample in any chosen size`, () => {
    for(const size of ['xs','s','m','l','xl','xxl']) {
      const one={...plan,sample:{...plan.sample,bySize:{...model.emptySizeBreakdown(),[size]:1}}};
      assert.equal(model.isSampleQuantityValid(one),true);
      assert.deepEqual(model.normalizeOrderQuantityPlan(one).sample.bySize,one.sample.bySize);
    }
  });
  check(`${mode} allows multiple samples in one size`, () => {
    const many={...plan,sample:{...plan.sample,bySize:{...model.emptySizeBreakdown(),m:8}}};
    assert.equal(model.isSampleQuantityValid(many),true);
    assert.equal(model.normalizeOrderQuantityPlan(many).sample.bySize.m,8);
  });
  check(`${mode} canvas shows the selected quantity and size curve`, () => {
    const html=renderToStaticMarkup(createElement(OrderQuantitiesStudio,{plan,onChange(){},name:'Test garment',garment:createElement('svg')}));
    assert.ok(html.includes('aria-label="XS:'));assert.ok(html.includes('1 <small>unit'));
  });
  check(`${mode} inspector provides six editable size quantities`, () => {
    assert.equal((renderInspector(plan).match(/aria-label="[A-Z]+ quantity"/g)||[]).length,6);
  });
  check(`${mode} zero samples blocks delivery`, () => {
    const html=renderInspector({...plan,sample:{...plan.sample,bySize:model.emptySizeBreakdown()}});
    assert.ok(/class="order-continue" disabled=""/.test(html));assert.ok(html.includes('Choose at least one sample'));
  });
}
check('Saved quantities survive reload and changing order mode', () => {
  const plan=model.defaultOrderQuantityPlan();
  plan.sample.bySize={xs:2,s:0,m:3,l:1,xl:0,xxl:0};
  plan.bulkRuns=[50,100].map(total=>({...model.newBulkRun(),targetTotal:total,bySize:model.distributeQuantity(total)}));
  const restored=model.normalizeOrderQuantityPlan(JSON.parse(JSON.stringify(plan)));
  assert.deepEqual(restored.sample.bySize,plan.sample.bySize);
  assert.deepEqual(restored.bulkRuns,plan.bulkRuns);
  assert.deepEqual(model.setOrderMode(restored,'techpack').sample.bySize,plan.sample.bySize);
});
check('Fractional, negative and nonfinite sample values are invalid and normalize safely', () => {
  for(const value of [NaN,Infinity,-1,1.5]) {
    const plan=model.defaultOrderQuantityPlan();plan.sample.bySize.m=value;
    assert.equal(model.isSampleQuantityValid(plan),false);
    const normalized=model.normalizeOrderQuantityPlan(plan);
    assert.ok(Number.isFinite(normalized.sample.bySize.m));assert.ok(Number.isInteger(normalized.sample.bySize.m));assert.ok(normalized.sample.bySize.m>=0);
  }
});
check('Bulk distribution keeps exact totals', () => {
  for(const total of [1,5,6,30,50,100,250,999])assert.equal(model.sumBreakdown(model.distributeQuantity(total)),total);
});
check('Incomplete bulk size split blocks delivery', () => {
  const plan=model.defaultOrderQuantityPlan();plan.bulkRuns=[{...model.newBulkRun(),targetTotal:100,bySize:model.distributeQuantity(50)}];
  const html=renderInspector(plan);assert.ok(/class="order-continue" disabled=""/.test(html));assert.ok(html.includes('Match each bulk size split'));
});
console.log(`${checks} order studio checks passed.`);
